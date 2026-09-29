import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

interface Jwk {
  kty: string;
  use?: string;
  crv?: string;
  kid: string;
  x?: string;
  y?: string;
  alg?: string;
  n?: string;
  e?: string;
}

let jwksCache: {
  keys: Jwk[];
  fetchedAt: number;
} | null = null;

const CACHE_TTL = 10 * 60 * 1000; // 10 minutes cache TTL

async function getJwks(projectRef: string): Promise<Jwk[]> {
  const now = Date.now();
  if (jwksCache && (now - jwksCache.fetchedAt < CACHE_TTL)) {
    return jwksCache.keys;
  }

  const url = `https://${projectRef}.supabase.co/auth/v1/.well-known/jwks.json`;
  const headers: Record<string, string> = {};
  if (process.env.SUPABASE_ANON_KEY) {
    headers['apikey'] = process.env.SUPABASE_ANON_KEY;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`Failed to fetch JWKS: ${res.status} ${res.statusText}`);
  }

  const data = await res.json() as { keys: Jwk[] };
  if (!data.keys || !Array.isArray(data.keys)) {
    throw new Error('Invalid JWKS response structure');
  }

  jwksCache = {
    keys: data.keys,
    fetchedAt: now
  };
  return data.keys;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header.' });
    return;
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = jwt.decode(idToken, { complete: true }) as {
      header: { alg: string; kid?: string; [key: string]: any };
      payload: { iss?: string; ref?: string; [key: string]: any };
    } | null;

    if (!decodedToken || !decodedToken.header) {
      res.status(401).json({ error: 'Unauthorized: invalid or malformed JWT token structure.' });
      return;
    }

    const { alg, kid } = decodedToken.header;
    let decodedUser: any;

    if (alg === 'ES256') {
      if (!kid) {
        res.status(401).json({ error: 'Unauthorized: missing "kid" header in ES256 token.' });
        return;
      }

      let projectRef = process.env.SUPABASE_PROJECT_REF || 'pzyrstehoesmhwkhtoxd';
      const payload = decodedToken.payload;
      if (payload) {
        if (payload.ref) {
          projectRef = payload.ref;
        } else if (typeof payload.iss === 'string' && payload.iss.includes('.supabase.co')) {
          const match = payload.iss.match(/https:\/\/([^.]+)\.supabase\.co/);
          if (match && match[1]) {
            projectRef = match[1];
          }
        }
      }

      const keys = await getJwks(projectRef);
      const jwk = keys.find(k => k.kid && k.kid.toLowerCase() === kid.toLowerCase());
      if (!jwk) {
        res.status(401).json({ error: `Unauthorized: no matching public key found in JWKS for kid "${kid}".` });
        return;
      }

      const publicKey = crypto.createPublicKey({
        key: jwk as any,
        format: 'jwk'
      });
      const pem = publicKey.export({ type: 'spki', format: 'pem' });
      decodedUser = jwt.verify(idToken, pem, { algorithms: ['ES256'] });
    } else {
      const jwtSecret = process.env.SUPABASE_JWT_SECRET;
      const expectedAnonKey = process.env.SUPABASE_ANON_KEY;

      if (expectedAnonKey && (idToken === expectedAnonKey || req.headers.apikey === expectedAnonKey)) {
        decodedUser = decodedToken.payload || { role: 'anon' };
      } else if (!jwtSecret) {
        console.error('[Auth] SUPABASE_JWT_SECRET environment variable is not configured; rejecting token.');
        res.status(500).json({ error: 'Internal Server Error: Auth configuration missing. Token signature cannot be verified.' });
        return;
      } else {
        try {
          const base64Secret = Buffer.from(jwtSecret, 'base64');
          decodedUser = jwt.verify(idToken, base64Secret, { algorithms: ['HS256'] });
        } catch (err) {
          try {
            decodedUser = jwt.verify(idToken, jwtSecret, { algorithms: ['HS256'] });
          } catch (err2) {
            console.error('[Auth] HS256 Token verification failed with both base64 and raw secret:', err2);
            throw err2;
          }
        }
      }
    }

    (req as any).user = decodedUser;
    next();
  } catch (err: any) {
    console.error('[Auth] Token verification failed:', err);
    res.status(401).json({ 
      error: 'Unauthorized: invalid Supabase ID token.',
      message: err.message,
      name: err.name
    });
  }
}

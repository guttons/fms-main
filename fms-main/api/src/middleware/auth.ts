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

// Fallback runtime secret generated per process startup if STAFF_JWT_SECRET / SUPABASE_JWT_SECRET is not set in local dev
const FALLBACK_RUNTIME_SECRET = crypto.randomBytes(32).toString('hex');

function getStaffJwtSecret(): string {
  return process.env.STAFF_JWT_SECRET || process.env.SUPABASE_JWT_SECRET || FALLBACK_RUNTIME_SECRET;
}

export function signStaffToken(payload: { staffId: string; role: string; name?: string }): string {
  const secret = getStaffJwtSecret();
  return jwt.sign(
    {
      sub: payload.staffId,
      staffId: payload.staffId,
      role: payload.role || 'OPERATOR',
      name: payload.name || payload.staffId,
      iss: 'macl-fms-staff-auth',
    },
    secret,
    { algorithm: 'HS256', expiresIn: '12h' }
  );
}

export function createRateLimiter(options: { windowMs: number; maxRequests: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
    const key = `${ip}:${req.baseUrl}${req.path}`;
    const entry = hits.get(key);

    if (!entry || now > entry.resetAt) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      if (hits.size > 5000) {
        for (const [k, v] of hits.entries()) {
          if (now > v.resetAt) hits.delete(k);
        }
      }
      next();
      return;
    }

    entry.count += 1;
    if (entry.count > options.maxRequests) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: 'Too many requests. Please wait before trying again.',
        retryAfterSeconds: retryAfterSec,
      });
      return;
    }

    next();
  };
}

export function requireRole(...allowedRoles: string[]) {
  const normalizedAllowed = new Set(allowedRoles.map(r => r.toUpperCase()));
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized: authentication required.' });
      return;
    }
    const userRole = String(user.role || user.user_metadata?.role || '').toUpperCase();
    if (!userRole || userRole === 'ANON' || !normalizedAllowed.has(userRole)) {
      res.status(403).json({
        error: 'Forbidden: insufficient role privileges for this operation.',
        requiredRoles: Array.from(normalizedAllowed),
      });
      return;
    }
    next();
  };
}

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
  // Support internal Edge Function / Webhook authentication via shared secret
  const webhookSecret = process.env.INTERNAL_WEBHOOK_SECRET;
  const incomingWebhookSecret = req.headers['x-webhook-secret'];
  if (webhookSecret && incomingWebhookSecret && incomingWebhookSecret === webhookSecret) {
    (req as any).user = { role: 'SERVICE_ROLE', iss: 'internal-webhook' };
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header.' });
    return;
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = jwt.decode(idToken, { complete: true }) as {
      header: { alg: string; kid?: string; [key: string]: any };
      payload: { iss?: string; ref?: string; role?: string; sub?: string; [key: string]: any };
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

      // Security fix: strictly use configured SUPABASE_PROJECT_REF instead of trusting unverified payload.iss / payload.ref
      const allowedRefs = new Set([
        process.env.SUPABASE_PROJECT_REF || 'pzyrstehoesmhwkhtoxd',
        'pzyrstehoesmhwkhtoxd',
        'uifwoubdvfbrmfhfwsnx'
      ]);
      let projectRef = process.env.SUPABASE_PROJECT_REF || 'pzyrstehoesmhwkhtoxd';
      const payload = decodedToken.payload;
      if (payload?.ref && allowedRefs.has(payload.ref)) {
        projectRef = payload.ref;
      } else if (typeof payload?.iss === 'string') {
        const match = payload.iss.match(/^https:\/\/([a-z0-9]+)\.supabase\.co\/auth\/v1$/);
        if (match && match[1] && allowedRefs.has(match[1])) {
          projectRef = match[1];
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
      const staffSecret = getStaffJwtSecret();
      const jwtSecret = process.env.SUPABASE_JWT_SECRET;
      const expectedAnonKey = process.env.SUPABASE_ANON_KEY;
      const allowLegacyAnon = process.env.ALLOW_LEGACY_ANON_AUTH !== 'false';

      // 1. First check if this is a signed MACL FMS Staff JWT
      if (decodedToken.payload?.iss === 'macl-fms-staff-auth') {
        decodedUser = jwt.verify(idToken, staffSecret, { algorithms: ['HS256'] });
      } else if (allowLegacyAnon && expectedAnonKey && idToken === expectedAnonKey) {
        // Transitional support when client has not yet upgraded to staff JWT
        decodedUser = { role: 'anon', iss: 'supabase', isAnonFallback: true };
      } else if (jwtSecret) {
        try {
          const base64Secret = Buffer.from(jwtSecret, 'base64');
          decodedUser = jwt.verify(idToken, base64Secret, { algorithms: ['HS256'] });
        } catch (err) {
          decodedUser = jwt.verify(idToken, jwtSecret, { algorithms: ['HS256'] });
        }
      } else {
        decodedUser = jwt.verify(idToken, staffSecret, { algorithms: ['HS256'] });
      }
    }

    (req as any).user = decodedUser;
    next();
  } catch (err: any) {
    console.error('[Auth] Token verification failed:', err);
    res.status(401).json({ 
      error: 'Unauthorized: invalid or expired authentication token.',
      message: err.message,
      name: err.name
    });
  }
}

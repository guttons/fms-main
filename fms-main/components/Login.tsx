import React, { useState } from 'react';
import { Hexagon, Lock, User as UserIcon, ShieldCheck, AlertCircle } from 'lucide-react';
import { auth } from '../firebase';
import { signInWithPopup, OAuthProvider } from 'firebase/auth';
import { User, UserRole } from '../types';
import { MOCK_USERS } from '../constants';

interface LoginProps {
  onLogin: (user: User) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showMockLogin, setShowMockLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMicrosoftLogin = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      const provider = new OAuthProvider('microsoft.com');
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      const matchedMockUser = MOCK_USERS.find(u => u.id === firebaseUser.uid) || {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || firebaseUser.email || 'Microsoft User',
        role: UserRole.ITP_OPERATOR,
        avatar: firebaseUser.photoURL || `https://ui-avatars.com/api/?name=${firebaseUser.displayName || 'MU'}`
      };
      onLogin(matchedMockUser);
    } catch (err: any) {
      console.error("Microsoft Login failed:", err);
      setError(err.message || "Failed to sign in with Microsoft.");
      setIsLoggingIn(false);
    }
  };

  const handleMockLogin = (user: User) => {
    onLogin(user);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4 relative overflow-hidden transition-colors duration-500">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/10 rounded-full blur-[140px] -mr-96 -mt-96 animate-pulse"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] -ml-64 -mb-64"></div>
      
      <div className="max-w-md w-full bg-surface-container p-12 lg:p-14 border border-outline shadow-premium rounded-[48px] relative z-10 fade-in backdrop-blur-2xl">
        <div className="text-center">
          <div className="mx-auto mb-10">
            <img 
              src="https://lh3.googleusercontent.com/d/1YCRXjbsAQ5LskxJcQlSUQV5QyaSX9gD2=s220?authuser=0" 
              alt="MACL Logo" 
              className="logo-light h-24 w-auto mx-auto object-contain"
            />
            <img 
              src="https://lh3.googleusercontent.com/d/1Uk6kyiqhPYw2_9qnXk8612yfdw5ioz5y=s220?authuser=0" 
              alt="MACL Logo" 
              className="logo-dark h-24 w-auto mx-auto object-contain"
            />
          </div>
          <h2 className="headline-xl text-on-surface tracking-tighter mb-2 uppercase">
            FUEL SERVICES
          </h2>
          <p className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-[0.5em] mt-4">
            FUEL MANAGEMENT SYSTEM
          </p>
        </div>

        <div className="mt-14 space-y-8">
          {error && (
            <div className="bg-error/10 text-error p-5 rounded-2xl text-[11px] border border-error/20 flex items-center space-x-3 fade-in font-bold">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!showMockLogin ? (
            <div className="space-y-6">
              <button
                onClick={handleMicrosoftLogin}
                disabled={isLoggingIn}
                style={{ backgroundColor: '#019BC9' }}
                className="group relative w-full flex justify-center py-5 px-4 text-white text-[11px] font-black rounded-[22px] hover:scale-[1.02] active:scale-95 transition-all duration-300 disabled:opacity-50 uppercase tracking-[0.2em] shadow-premium"
              >
                <div className="absolute left-6 inset-y-0 flex items-center">
                  <Lock className="h-4 w-4 text-white/40 group-hover:text-white transition-colors" />
                </div>
                {isLoggingIn ? 'Syncing...' : 'Sign in with Microsoft'}
              </button>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-outline"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-4 text-[9px] font-black text-on-surface-dim opacity-20 uppercase tracking-[0.4em] bg-surface">
                    Emergency Protocol
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowMockLogin(true)}
                className="w-full flex justify-center py-4.5 px-4 border border-outline text-[10px] font-black rounded-[22px] text-on-surface-dim hover:bg-surface-dim hover:text-on-surface transition-all duration-300 uppercase tracking-widest"
              >
                <ShieldCheck className="h-4 w-4 text-primary mr-3" />
                Bypass to Simulator
              </button>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[10px] font-black text-on-surface-dim opacity-40 uppercase tracking-widest">Select Personnel</h3>
                <button 
                  onClick={() => setShowMockLogin(false)}
                  className="text-[10px] font-black text-primary hover:underline underline-offset-4 uppercase tracking-widest"
                >
                  Cancel
                </button>
              </div>
              <div className="max-h-[340px] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {MOCK_USERS.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleMockLogin(user)}
                    className="w-full flex items-center p-4 bg-surface-dim border border-outline rounded-2xl hover:bg-surface-lowest hover:border-primary/30 transition-all text-left group"
                  >
                    <img src={user.avatar} alt={user.name} className="w-12 h-12 rounded-xl mr-5 border border-outline shadow-sm" />
                    <div className="flex-1">
                      <div className="text-sm font-black text-on-surface group-hover:text-primary transition-colors">{user.name}</div>
                      <div className="text-[10px] font-bold text-on-surface-dim opacity-40 uppercase tracking-wider">{user.role.replace('_', ' ')}</div>
                    </div>
                    <UserIcon className="h-4 w-4 text-on-surface-dim opacity-20 group-hover:text-primary transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-16 text-center">
          <p className="text-[9px] font-black text-on-surface-dim opacity-20 uppercase tracking-[0.6em]">
            FUEL SERVICES
          </p>
        </div>
      </div>
    </div>
  );
};


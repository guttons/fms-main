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
    <div className="min-h-screen flex items-center justify-center bg-brand-blue p-4 relative overflow-hidden transition-colors duration-500">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary-bright/20 rounded-full blur-[140px] -mr-96 -mt-96 animate-pulse"></div>
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-primary-bright/10 rounded-full blur-[120px] -ml-64 -mb-64"></div>
      
      <div className="max-w-md w-full glass-surface p-12 border-white/10 shadow-2xl rounded-[40px] relative z-10 fade-in backdrop-blur-2xl">
        <div className="text-center">
          <div className="mx-auto h-20 w-20 bg-white p-4 rounded-[28px] shadow-2xl flex items-center justify-center mb-10 transform -rotate-3 hover:rotate-0 transition-all duration-300">
            <h1 className="text-[#002046] font-[900] text-2xl leading-none">AF</h1>
          </div>
          <h2 className="headline-xl text-white tracking-tighter mb-1">
            AeroFuel <span className="text-primary-bright font-medium">Command</span>
          </h2>
          <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.5em] mt-4">
            Tactical Fuel Infrastructure
          </p>
        </div>

        <div className="mt-14 space-y-8">
          {error && (
            <div className="bg-red-500/10 text-red-100 p-4 rounded-2xl text-xs border border-red-500/20 flex items-center space-x-3 fade-in">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="font-bold">{error}</span>
            </div>
          )}

          {!showMockLogin ? (
            <div className="space-y-6">
              <button
                onClick={handleMicrosoftLogin}
                disabled={isLoggingIn}
                className="group relative w-full flex justify-center py-5 px-4 bg-white text-[#002046] text-xs font-black rounded-[20px] hover:bg-slate-100 transition-all duration-300 disabled:opacity-50 uppercase tracking-widest shadow-xl shadow-black/30"
              >
                <div className="absolute left-6 inset-y-0 flex items-center">
                  <Lock className="h-4 w-4 text-[#002046]/30 group-hover:text-[#002046] transition-colors" />
                </div>
                {isLoggingIn ? 'Syncing...' : 'Sign in with Microsoft'}
              </button>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-4 text-[9px] font-black text-white/30 uppercase tracking-[0.3em] bg-transparent">
                    Emergency Protocol
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowMockLogin(true)}
                className="w-full flex justify-center py-4 px-4 border border-white/20 text-[10px] font-black rounded-[20px] text-white/90 hover:bg-white/10 transition-all duration-300 uppercase tracking-widest"
              >
                <ShieldCheck className="h-4 w-4 text-primary-bright mr-3" />
                Bypass to Simulator
              </button>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[10px] font-black text-white/40 uppercase tracking-widest">Select Personnel</h3>
                <button 
                  onClick={() => setShowMockLogin(false)}
                  className="text-[10px] font-black text-primary-bright hover:text-white transition-colors uppercase tracking-widest underline underline-offset-4"
                >
                  Cancel
                </button>
              </div>
              <div className="max-h-[340px] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {MOCK_USERS.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleMockLogin(user)}
                    className="w-full flex items-center p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-white/20 transition-all text-left group"
                  >
                    <img src={user.avatar} alt={user.name} className="w-12 h-12 rounded-xl mr-5 border border-white/10 shadow-lg" />
                    <div className="flex-1">
                      <div className="text-sm font-black text-white group-hover:text-primary-bright transition-colors">{user.name}</div>
                      <div className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{user.role.replace('_', ' ')}</div>
                    </div>
                    <UserIcon className="h-4 w-4 text-white/20 group-hover:text-primary-bright transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-16 text-center">
          <p className="text-[9px] font-black text-white/20 uppercase tracking-[0.5em]">
            MACL Fuel Infrastructure Command
          </p>
        </div>
      </div>
    </div>
  );
};


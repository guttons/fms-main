import React, { useState } from 'react';
import { Hexagon, Lock, User as UserIcon, ShieldCheck } from 'lucide-react';
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
      // Optional: Add custom parameters for company domain
      // provider.setCustomParameters({ prompt: 'login', domain_hint: 'yourcompany.com' });
      
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;

      // In a real app, you would fetch the user's role from Firestore based on their email/UID
      // For this demo, we'll map them to a default role or try to match a mock user
      const matchedMockUser = MOCK_USERS.find(u => u.id === firebaseUser.uid) || {
        id: firebaseUser.uid,
        name: firebaseUser.displayName || firebaseUser.email || 'Microsoft User',
        role: UserRole.ITP_OPERATOR, // Default role
        avatar: firebaseUser.photoURL || `https://ui-avatars.com/api/?name=${firebaseUser.displayName || 'MU'}`
      };

      onLogin(matchedMockUser);
    } catch (err: any) {
      console.error("Microsoft Login failed:", err);
      if (err.code === 'auth/operation-not-allowed') {
        setError("Microsoft login is not enabled in the Firebase Console. Please enable it under Authentication > Sign-in method.");
      } else if (err.code === 'auth/popup-closed-by-user') {
        // Do nothing, the user just closed the popup
        setIsLoggingIn(false);
      } else {
        setError(err.message || "Failed to sign in with Microsoft. Please try again.");
      }
      setIsLoggingIn(false);
    }
  };

  const handleMockLogin = (user: User) => {
    onLogin(user);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-xl border border-gray-100">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-aviation-100 rounded-full flex items-center justify-center mb-4">
            <Hexagon className="h-8 w-8 text-aviation-600" />
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            MACL FMS
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Aviation Fuel Management System
          </p>
        </div>

        <div className="mt-8 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm border border-red-100">
              {error}
            </div>
          )}

          {!showMockLogin ? (
            <>
              <button
                onClick={handleMicrosoftLogin}
                disabled={isLoggingIn}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-white bg-slate-900 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 shadow-md transition-all disabled:opacity-50"
              >
                <span className="absolute left-0 inset-y-0 flex items-center pl-3">
                  <Lock className="h-5 w-5 text-slate-400 group-hover:text-slate-300" aria-hidden="true" />
                </span>
                {isLoggingIn ? 'Connecting...' : 'Sign In with Microsoft'}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-slate-400">Or use testing account</span>
                </div>
              </div>

              <button
                onClick={() => setShowMockLogin(true)}
                className="w-full flex justify-center py-3 px-4 border border-gray-300 text-sm font-bold rounded-lg text-slate-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-aviation-500 transition-all"
              >
                <ShieldCheck className="h-5 w-5 text-slate-400 mr-2" />
                Mock Login (Testing)
              </button>
            </>
          ) : (
            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Select Test Account</h3>
                <button 
                  onClick={() => setShowMockLogin(false)}
                  className="text-xs text-aviation-600 hover:underline font-bold"
                >
                  Back
                </button>
              </div>
              <div className="max-h-64 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                {MOCK_USERS.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleMockLogin(user)}
                    className="w-full flex items-center p-3 border border-gray-100 rounded-xl hover:bg-aviation-50 hover:border-aviation-200 transition-all text-left group"
                  >
                    <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full mr-3 border border-gray-200" />
                    <div>
                      <div className="text-sm font-bold text-slate-900 group-hover:text-aviation-700">{user.name}</div>
                      <div className="text-xs text-slate-500 font-medium">{user.role.replace('_', ' ')}</div>
                    </div>
                    <UserIcon className="ml-auto h-4 w-4 text-slate-300 group-hover:text-aviation-400" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 text-center text-xs text-slate-400">
          <p>Authorized access only. All activities are logged.</p>
        </div>
      </div>
    </div>
  );
};

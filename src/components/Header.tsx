import React, { useState, useEffect } from 'react';
import {
  Shield,
  Smartphone,
  History,
  FileCode,
  MessageSquareWarning,
  LogIn,
  LogOut,
  User,
  Database,
  Radio,
} from 'lucide-react';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { Device } from '../types/telemetry.ts';

interface HeaderProps {
  selectedDevice: Device | null;
  onOpenDeviceManager: () => void;
  onOpenHistory: () => void;
  onOpenDaemonInspector: () => void;
  onOpenSmsLogs: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  selectedDevice,
  onOpenDeviceManager,
  onOpenHistory,
  onOpenDaemonInspector,
  onOpenSmsLogs,
}) => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const token = await user.getIdToken();
          await fetch('/api/users/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
          });
        } catch (err) {
          console.error('Failed to sync authenticated user:', err);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (error) {
      console.error('Sign-in error:', error);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign-out error:', error);
    }
  };

  return (
    <header className="bg-slate-950/95 border-b border-slate-800/90 px-4 py-2.5 flex items-center justify-between gap-3 shadow-xl backdrop-blur-md z-40 select-none">
      {/* Brand & Project Spec Title */}
      <div className="flex items-center gap-3">
        <div className="relative flex items-center justify-center p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-950/50">
          <Shield className="w-5 h-5 text-slate-950" />
          <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-950 animate-pulse" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-extrabold tracking-tight text-white uppercase flex items-center gap-1.5">
              ApexTrack
              <span className="text-[10px] font-mono text-cyan-400 font-semibold px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/60 lowercase">
                v2.4-root
              </span>
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
              <Database className="w-3 h-3 text-cyan-400" />
              PostgreSQL
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-medium hidden md:block">
            Root-Level Autonomous Device Tracking & Telemetry Framework
          </p>
        </div>
      </div>

      {/* Center Device Selector Badge */}
      <div className="hidden lg:flex items-center">
        {selectedDevice && (
          <button
            onClick={onOpenDeviceManager}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs font-mono text-slate-200 transition-colors shadow-inner"
          >
            <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-bold text-white">{selectedDevice.name}</span>
            <span className="text-[10px] text-cyan-400">({selectedDevice.privilegeLevel})</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
          </button>
        )}
      </div>

      {/* Right Controls & Navigation */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenDeviceManager}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 text-xs font-medium transition-colors"
          title="Fleet Devices"
        >
          <Smartphone className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Fleet</span>
        </button>

        <button
          onClick={onOpenHistory}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 text-xs font-medium transition-colors"
          title="Historical Route Analysis"
        >
          <History className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Route Analysis</span>
        </button>

        <button
          onClick={onOpenDaemonInspector}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white border border-slate-800 text-xs font-medium transition-colors"
          title="System Architecture & Daemon Code"
        >
          <FileCode className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Daemon Spec</span>
        </button>

        {/* User Auth with Google */}
        {currentUser ? (
          <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
            {currentUser.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt={currentUser.displayName || 'Operator'}
                className="w-7 h-7 rounded-full ring-1 ring-cyan-500/50"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-cyan-900 flex items-center justify-center text-cyan-300 text-xs font-bold">
                {currentUser.email?.[0].toUpperCase() || 'U'}
              </div>
            )}
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={handleSignIn}
            disabled={authLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors shadow-lg shadow-cyan-950/50"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>{authLoading ? 'Signing In...' : 'Google Login'}</span>
          </button>
        )}
      </div>
    </header>
  );
};

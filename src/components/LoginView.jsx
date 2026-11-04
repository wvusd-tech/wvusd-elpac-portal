// src/components/LoginView.jsx
import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { DISTRICT_LOGO, isValidWvusdEmail } from '../config.js';
import { saveUserSession } from '../utils/authStorage.js';
import {
  ShieldAlert,
  Lock,
  AlertOctagon
} from 'lucide-react';

export default function LoginView({ onLoginSuccess, isLoading, authError }) {
  const [localError, setLocalError] = useState(null);
  const [domainBlocked, setDomainBlocked] = useState(false);
  const [blockedEmail, setBlockedEmail] = useState('');

  const handleGoogleSuccess = (credentialResponse) => {
    try {
      const decoded = jwtDecode(credentialResponse.credential);
      const email = decoded.email?.toLowerCase().trim();

      // Strict client-side domain lock matching wvusd-data-portal
      if (!isValidWvusdEmail(email)) {
        setBlockedEmail(email || '');
        setDomainBlocked(true);
        return;
      }

      setDomainBlocked(false);
      setBlockedEmail('');
      setLocalError(null);
      saveUserSession({ email, name: decoded.name, authorized: true }, credentialResponse.credential);

      onLoginSuccess(email, decoded.name);
    } catch {
      setLocalError('Failed to decode Google Sign-In credential. Please try again.');
    }
  };

  const handleGoogleError = () => {
    setLocalError('Google Sign-In failed or was cancelled. Please check your network or try again.');
  };

  // 1. DOMAIN LOCK / SECURITY SCREEN (Matches wvusd-data-portal pixel-for-pixel)
  if (domainBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-slate-900/95 backdrop-blur-md font-sans selection:bg-blue-600 selection:text-white">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl border border-rose-200 p-6 sm:p-8 text-center space-y-5 animate-fade-in">
          <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="inline-block px-3 py-1 rounded-full text-[11px] font-black uppercase bg-rose-100 text-rose-800 tracking-wider">
              WVUSD Security Lock
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900">
              Access Denied: Staff Domain Required
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              You attempted to sign in with <strong className="text-rose-600 font-mono">{blockedEmail || 'an unauthorized account'}</strong>.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-600 text-left space-y-1.5">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <AlertOctagon className="w-4 h-4 text-rose-500" />
              Staff Security Policy Notice:
            </div>
            <p>
              Student accounts (<code className="text-rose-600 font-bold">@stu.wvusd.org</code>) and personal Gmail accounts are prohibited from accessing student records.
            </p>
            <p className="text-[11px] text-slate-500">
              Only authenticated <code className="text-blue-700 font-bold">@wvusd.org</code> and <code className="text-blue-700 font-bold">@sub.wvusd.org</code> staff credentials are authorized.
            </p>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                setDomainBlocked(false);
                setBlockedEmail('');
                setLocalError(null);
              }}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition"
            >
              Sign In with Official WVUSD Staff Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. AUTHENTICATION LANDING SCREEN (Matches wvusd-data-portal pixel-for-pixel)
  return (
    <div className="min-h-screen flex flex-col justify-between p-4 sm:p-8 bg-gradient-to-b from-slate-100 via-slate-50 to-blue-50 font-sans selection:bg-blue-600 selection:text-white">
      
      <div className="max-w-md w-full mx-auto my-auto space-y-6 text-center animate-fade-in">
        {/* WVUSD District Logo */}
        <div className="flex flex-col items-center">
          <img
            src={DISTRICT_LOGO}
            alt="WVUSD Logo"
            className="h-20 w-auto object-contain drop-shadow-md mb-3"
          />
          <span className="text-xs font-black uppercase tracking-widest text-blue-900">
            Walnut Valley Unified School District
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
            ELPAC Student Data & Intervention Portal
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-sm">
            Live Google Sheets & Longitudinal ELPAC Analytics across Grades TK–12.
          </p>
        </div>

        {/* Google Identity Services Box */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-200 space-y-5">
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-600">
            <Lock className="w-4 h-4 text-emerald-600" />
            <span>Single-Click ChromeOS Staff Auto-Auth</span>
          </div>

          {/* Rendered Google GSI Button Container */}
          <div id="gsi-signin-container" className="flex justify-center min-h-[44px]">
            {isLoading ? (
              <div className="flex items-center gap-2.5 text-xs font-semibold text-blue-600 bg-blue-50 px-5 py-2.5 rounded-full border border-blue-200">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span>Authenticating & loading live ELPAC dataset...</span>
              </div>
            ) : (
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                useOneTap
                theme="outline"
                size="large"
                type="standard"
                shape="pill"
                text="signin_with"
                logo_alignment="left"
                width="280"
              />
            )}
          </div>

          {(localError || authError) && (
            <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200 text-xs text-rose-700 font-medium text-center animate-fade-in">
              {localError || authError}
            </div>
          )}

          <div className="text-xs text-slate-500 pt-3 border-t border-slate-100 leading-relaxed">
            Access restricted to authenticated <strong className="text-slate-700">@wvusd.org</strong> and <strong className="text-slate-700">@sub.wvusd.org</strong> staff accounts
          </div>
        </div>

        <div className="text-xs text-slate-400">
          Live Google Apps Script API Connection
        </div>
      </div>

      <footer className="text-center text-xs text-slate-400 pt-6">
        © 2026 Walnut Valley Unified School District • Educational Services & Data Analytics
      </footer>
    </div>
  );
}

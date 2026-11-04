// src/components/LoginView.jsx
import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';
import { DISTRICT_LOGO, isValidWvusdEmail } from '../config.js';
import { saveUserSession } from '../utils/authStorage.js';
import { 
  ShieldCheck, 
  Sparkles, 
  AlertTriangle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export default function LoginView({ onLoginSuccess, onDemoLogin, isLoading, authError }) {
  const [localError, setLocalError] = useState(null);
  const [showSandbox, setShowSandbox] = useState(false);

  const handleGoogleSuccess = (credentialResponse) => {
    try {
      const decoded = jwtDecode(credentialResponse.credential);
      const email = decoded.email?.toLowerCase().trim();

      if (!isValidWvusdEmail(email)) {
        setLocalError(
          `Access Denied: ${email} is not an authorized Walnut Valley staff email. Only official @wvusd.org accounts are permitted.`
        );
        return;
      }

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-800">
      
      {/* Background Decorative Rings */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-blue-500 blur-3xl" />
        <div className="absolute top-1/2 -right-40 w-96 h-96 rounded-full bg-indigo-500 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200/80 p-8 sm:p-10 space-y-6 backdrop-blur-md">
        
        {/* District Crest & Header */}
        <div className="text-center space-y-3">
          <div className="w-20 h-20 mx-auto p-2.5 bg-slate-50 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-center">
            <img
              src={DISTRICT_LOGO}
              alt="Walnut Valley USD"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              WVUSD ELPAC Portal
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Walnut Valley Unified School District • California ELPAC Longitudinal Portal
            </p>
          </div>
        </div>

        {/* Security Notice Pill */}
        <div className="bg-blue-50/80 border border-blue-200/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-900 leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Restricted District Access:</span>
            <span className="text-blue-800 ml-1">
              Single Sign-On is strictly enforced for verified <code className="bg-blue-100/70 px-1 py-0.5 rounded text-[11px] font-bold">@wvusd.org</code> faculty and staff accounts.
            </span>
          </div>
        </div>

        {/* Error Messages */}
        {(localError || authError) && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-rose-800 animate-fade-in">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium">
              {localError || authError}
            </div>
          </div>
        )}

        {/* Centered Clean Google Sign-In */}
        <div className="space-y-3 pt-2">
          <div className="flex justify-center">
            {isLoading ? (
              <div className="flex items-center gap-2.5 text-xs font-semibold text-blue-600 bg-blue-50 px-5 py-3 rounded-xl border border-blue-200">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span>Authenticating & loading ELPAC dataset...</span>
              </div>
            ) : (
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                useOneTap={false}
                theme="filled_blue"
                shape="pill"
                size="large"
                text="signin_with"
                width="280"
              />
            )}
          </div>
          <p className="text-[11px] text-center text-slate-400">
            Sign in with your official Walnut Valley Google Workspace account.
          </p>
        </div>

        {/* Evaluator / Presentation Sandbox (Clean & Distraction-Free Accordion) */}
        {onDemoLogin && (
          <div className="pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowSandbox(!showSandbox)}
              className="w-full flex items-center justify-between text-xs text-slate-500 hover:text-slate-800 py-1 transition-colors group"
            >
              <span className="flex items-center gap-1.5 font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>Evaluator Sandbox</span>
              </span>
              <span className="flex items-center gap-1 text-[11px] text-slate-400 group-hover:text-slate-600 font-mono">
                {showSandbox ? 'Hide options' : 'Preview roles'}
                {showSandbox ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </span>
            </button>

            {showSandbox && (
              <div className="mt-2.5 space-y-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => onDemoLogin('kwendland@wvusd.org', 'Super Admin')}
                  disabled={isLoading}
                  className="w-full text-left px-3 py-2 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all flex items-center justify-between text-xs group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-800 group-hover:text-blue-700">Super Admin</span>
                      <span className="text-[10px] text-slate-400 block">District-wide Executive Overview (All 15 Sites)</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 group-hover:text-blue-600">All Sites →</span>
                </button>

                <button
                  type="button"
                  onClick={() => onDemoLogin('dbhsadmin@wvusd.org', 'DBHS Site Admin')}
                  disabled={isLoading}
                  className="w-full text-left px-3 py-2 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all flex items-center justify-between text-xs group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-800 group-hover:text-blue-700">Site Administrator</span>
                      <span className="text-[10px] text-slate-400 block">Diamond Bar High School Overview</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 group-hover:text-blue-600">Site Admin →</span>
                </button>

                <button
                  type="button"
                  onClick={() => onDemoLogin('sburns@wvusd.org', 'Burns, S')}
                  disabled={isLoading}
                  className="w-full text-left px-3 py-2 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all flex items-center justify-between text-xs group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-800 group-hover:text-blue-700">High School Counselor</span>
                      <span className="text-[10px] text-slate-400 block">Diamond Bar High (Grades 9–12 Caseload Roster)</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 group-hover:text-blue-600">DBHS →</span>
                </button>

                <button
                  type="button"
                  onClick={() => onDemoLogin('jochen@wvusd.org', 'Chen, J')}
                  disabled={isLoading}
                  className="w-full text-left px-3 py-2 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all flex items-center justify-between text-xs group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-800 group-hover:text-blue-700">Middle School Counselor</span>
                      <span className="text-[10px] text-slate-400 block">Suzanne Middle School (Grades 6–8 Roster)</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 group-hover:text-blue-600">Suzanne →</span>
                </button>

                <button
                  type="button"
                  onClick={() => onDemoLogin('jurbaniec@wvusd.org', 'Urbaniec, Julie')}
                  disabled={isLoading}
                  className="w-full text-left px-3 py-2 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all flex items-center justify-between text-xs group"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-800 group-hover:text-blue-700">Elementary Teacher</span>
                      <span className="text-[10px] text-slate-400 block">Castle Rock Elementary (Grade 5 Roster)</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 group-hover:text-blue-600">Castle Rock →</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer info */}
        <div className="text-center text-[11px] text-slate-400 pt-1">
          <span>Protected under FERPA & California Ed Code guidelines</span>
        </div>
      </div>

    </div>
  );
}

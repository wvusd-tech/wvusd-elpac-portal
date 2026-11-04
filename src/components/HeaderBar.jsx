// src/components/HeaderBar.jsx
import React, { useState } from 'react';
import { getSiteLogo, DISTRICT_LOGO } from '../config.js';
import { 
  LogOut, 
  Search, 
  Sparkles,
  ChevronDown
} from 'lucide-react';

export default function HeaderBar({ 
  user, 
  onLogout, 
  selectedSite, 
  onSearchSelect, 
  students = [],
  onSwitchDemoRole
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);

  // Dynamic school logo
  const siteLogo = getSiteLogo(selectedSite || user?.school);

  // Search filter across current student list
  const searchResults = searchQuery.trim().length >= 2 
    ? students.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        String(s.studentId).includes(searchQuery.trim())
      ).slice(0, 8)
    : [];

  const getRoleBadge = (role) => {
    switch(role) {
      case 'SuperAdmin':
        return { label: 'Super Admin', bg: 'bg-rose-100 text-rose-800 border-rose-300' };
      case 'SiteAdmin':
        return { label: 'Site Admin', bg: 'bg-purple-100 text-purple-800 border-purple-300' };
      case 'Counselor':
        return { label: 'Counselor', bg: 'bg-blue-100 text-blue-800 border-blue-300' };
      case 'ElementaryTeacher':
        return { label: 'Elementary Teacher', bg: 'bg-amber-100 text-amber-800 border-amber-300' };
      case 'SecondaryTeacher':
      case 'SecondaryOrSiteTeacher':
        return { label: 'Secondary Teacher', bg: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      default:
        return { label: role || 'Staff', bg: 'bg-slate-100 text-slate-800 border-slate-300' };
    }
  };

  const roleInfo = getRoleBadge(user?.role);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Left: Branding & Logos */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <img
                src={DISTRICT_LOGO}
                alt="WVUSD Logo"
                className="h-10 w-auto object-contain drop-shadow-sm"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
              {siteLogo && siteLogo !== DISTRICT_LOGO && (
                <>
                  <span className="text-slate-300 hidden sm:inline">/</span>
                  <img
                    src={siteLogo}
                    alt="School Logo"
                    className="h-9 w-auto object-contain hidden sm:inline-block drop-shadow-sm"
                    onError={(e) => { e.target.src = DISTRICT_LOGO; }}
                  />
                </>
              )}
            </div>

            <div className="hidden md:block border-l border-slate-200 pl-3">
              <h1 className="text-sm font-bold text-slate-900 leading-tight">
                WVUSD ELPAC Longitudinal Portal
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                Walnut Valley Unified School District • California ELPAC Analytics
              </p>
            </div>
          </div>

          {/* Middle: Fast Student Global Search */}
          <div className="flex-1 max-w-md relative hidden sm:block">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Quick search student name or ID..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchResults(true);
                }}
                onFocus={() => setShowSearchResults(true)}
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-100 hover:bg-slate-100/80 focus:bg-white border border-transparent focus:border-blue-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              />
            </div>

            {/* Live Search Autocomplete Popup */}
            {showSearchResults && searchResults.length > 0 && (
              <div 
                className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-fade-in"
                onMouseLeave={() => setShowSearchResults(false)}
              >
                <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  Matching Students ({searchResults.length})
                </div>
                {searchResults.map(s => {
                  const overall = s.latestOverall || s.latestEla;
                  return (
                    <div
                      key={s.studentId}
                      onClick={() => {
                        onSearchSelect(s);
                        setShowSearchResults(false);
                        setSearchQuery('');
                      }}
                      className="px-3 py-2 hover:bg-blue-50/70 cursor-pointer flex items-center justify-between transition-colors text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-900">{s.name}</span>
                        <span className="ml-2 text-slate-400 font-mono text-[11px]">#{s.studentId}</span>
                        <div className="text-[11px] text-slate-500">
                          {s.school} • Gr {s.grade} • {s.staffLabel}: {s.staffName}
                        </div>
                      </div>
                      <div className="text-right font-mono text-xs">
                        {overall?.scaledScore && (
                          <span className="text-emerald-700 font-bold mr-1.5">
                            SS {overall.scaledScore}
                          </span>
                        )}
                        {overall?.performanceLevel && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            L{overall.performanceLevel}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: User Profile, Role Badge, Demo Switcher, & Sign Out */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* SuperAdmin Role Switcher Dropdown */}
            {onSwitchDemoRole && (
              <div className="relative">
                <button
                  onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
                  title="Switch preview role for presentation or testing"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                  <span className="hidden lg:inline">Role Preview</span>
                  <ChevronDown className="w-3 h-3 text-indigo-500" />
                </button>

                {showRoleSwitcher && (
                  <div 
                    className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 text-xs animate-fade-in"
                    onMouseLeave={() => setShowRoleSwitcher(false)}
                  >
                    <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                      Switch Role Perspective
                    </div>
                    <button
                      onClick={() => { onSwitchDemoRole('SuperAdmin'); setShowRoleSwitcher(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-800 font-medium flex items-center justify-between"
                    >
                      <span>1. Super Admin (District-Wide)</span>
                      <span className="text-[10px] text-slate-400">All Sites</span>
                    </button>
                    <button
                      onClick={() => { onSwitchDemoRole('SiteAdmin'); setShowRoleSwitcher(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-800 font-medium flex items-center justify-between"
                    >
                      <span>2. Site Administrator</span>
                      <span className="text-[10px] text-purple-600">DBHS Overview</span>
                    </button>
                    <button
                      onClick={() => { onSwitchDemoRole('HighSchoolCounselor'); setShowRoleSwitcher(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-800 font-medium flex items-center justify-between"
                    >
                      <span>3. High School Counselor</span>
                      <span className="text-[10px] text-blue-600">DBHS Roster</span>
                    </button>
                    <button
                      onClick={() => { onSwitchDemoRole('MiddleSchoolCounselor'); setShowRoleSwitcher(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-800 font-medium flex items-center justify-between"
                    >
                      <span>4. Middle School Counselor</span>
                      <span className="text-[10px] text-indigo-600">Suzanne Roster</span>
                    </button>
                    <button
                      onClick={() => { onSwitchDemoRole('ElementaryTeacher'); setShowRoleSwitcher(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-800 font-medium flex items-center justify-between"
                    >
                      <span>5. Elementary Teacher</span>
                      <span className="text-[10px] text-amber-600">Castle Rock</span>
                    </button>
                    <button
                      onClick={() => { onSwitchDemoRole('SecondaryTeacher'); setShowRoleSwitcher(false); }}
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 text-slate-800 font-medium flex items-center justify-between"
                    >
                      <span>6. Secondary Counselor/Teacher</span>
                      <span className="text-[10px] text-emerald-600">Walnut High</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* User Pill */}
            <div className="flex items-center gap-2 pl-2">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-slate-900 leading-snug">
                  {user?.name || user?.email?.split('@')[0]}
                </div>
                <div className="flex items-center justify-end gap-1.5 mt-0.5">
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${roleInfo.bg}`}>
                    {roleInfo.label}
                  </span>
                  <span className="text-[10px] text-slate-500 font-medium max-w-[120px] truncate" title={user?.school}>
                    {user?.school === 'ALL' ? 'District-Wide' : user?.school}
                  </span>
                </div>
              </div>

              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shadow-sm ring-2 ring-slate-100">
                {user?.name ? user.name.charAt(0) : 'U'}
              </div>

              {/* Logout Button */}
              <button
                onClick={onLogout}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-1"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>
      </div>
    </header>
  );
}

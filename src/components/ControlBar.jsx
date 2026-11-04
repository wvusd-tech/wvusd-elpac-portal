// src/components/ControlBar.jsx
import React from 'react';
import { 
  GraduationCap, 
  MessageSquare, 
  PenTool, 
  LayoutDashboard, 
  Users, 
  School,
  RotateCcw
} from 'lucide-react';

export default function ControlBar({
  gradeBand,
  onGradeBandChange,
  availableGradeBands = ['Elementary', 'Middle', 'High'],
  subjectFocus,
  onSubjectFocusChange,
  sitesList = [],
  selectedSite,
  onSiteChange,
  availableGrades = [],
  selectedGrade,
  onGradeChange,
  staffList = [],
  selectedStaff = 'ALL',
  onStaffChange,
  activeView,
  onViewChange,
  user
}) {
  const isSuperAdmin = user?.role === 'SuperAdmin';
  const hasActiveFilters = selectedSite !== 'ALL' || selectedGrade !== 'ALL' || (selectedStaff && selectedStaff !== 'ALL');

  return (
    <div className="bg-white border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 space-y-3.5">
        
        {/* Top Controls Row: 3-Tier Grade Band & ELPAC Domain Selectors */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* 1. 3-Tier Grade Band Selector */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80 w-fit">
            {/* Elementary Pill */}
            <button
              onClick={() => onGradeBandChange('Elementary')}
              disabled={!availableGradeBands.includes('Elementary') && !isSuperAdmin}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                gradeBand === 'Elementary'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${gradeBand === 'Elementary' ? 'bg-amber-500' : 'bg-slate-300'}`} />
              <div>
                <span className="block leading-none">Elementary</span>
                <span className="text-[10px] text-slate-400 font-normal block leading-tight mt-0.5 hidden sm:block">
                  Grades TK–5 • Teacher-Centric
                </span>
              </div>
            </button>

            {/* Middle School Pill */}
            <button
              onClick={() => onGradeBandChange('Middle')}
              disabled={!availableGradeBands.includes('Middle') && !isSuperAdmin}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                gradeBand === 'Middle'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${gradeBand === 'Middle' ? 'bg-indigo-500' : 'bg-slate-300'}`} />
              <div>
                <span className="block leading-none">Middle School</span>
                <span className="text-[10px] text-slate-400 font-normal block leading-tight mt-0.5 hidden sm:block">
                  Grades 6–8 • Counselor Caseloads
                </span>
              </div>
            </button>

            {/* High School Pill */}
            <button
              onClick={() => onGradeBandChange('High')}
              disabled={!availableGradeBands.includes('High') && !isSuperAdmin}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                gradeBand === 'High'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${gradeBand === 'High' ? 'bg-blue-600' : 'bg-slate-300'}`} />
              <div>
                <span className="block leading-none">High School</span>
                <span className="text-[10px] text-slate-400 font-normal block leading-tight mt-0.5 hidden sm:block">
                  Grades 9–12 • Reclassification & ELD
                </span>
              </div>
            </button>
          </div>

          {/* Right Group: ELPAC Domain Focus & View Switcher */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* 2. ELPAC Domain Focus Selector */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => onSubjectFocusChange('ALL')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  subjectFocus === 'ALL'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Overall (Part 0)
              </button>
              <button
                onClick={() => onSubjectFocusChange('ORAL')}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  subjectFocus === 'ORAL'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span>Oral Domain</span>
              </button>
              <button
                onClick={() => onSubjectFocusChange('WRITTEN')}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  subjectFocus === 'WRITTEN'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <PenTool className="w-3.5 h-3.5 text-blue-600" />
                <span>Written Domain</span>
              </button>
            </div>

            {/* 3. View Switcher Mode */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => onViewChange('overview')}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeView === 'overview'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Executive Overview</span>
              </button>
              <button
                onClick={() => onViewChange('roster')}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeView === 'roster'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>
                  {gradeBand === 'Elementary' ? 'Classroom Roster & Groups' : 'Counselor Roster & Groups'}
                </span>
              </button>
            </div>
          </div>

        </div>

        {/* Bottom Filter Row: All Schools, All Grades, All Teachers/Staff */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            {/* 1. School Site Filter (All Schools) */}
            <div className="flex items-center gap-1.5">
              <School className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-600">School:</span>
              <select
                value={selectedSite}
                onChange={(e) => onSiteChange(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white text-xs max-w-[190px]"
              >
                <option value="ALL">All Schools ({sitesList.length})</option>
                {sitesList.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            {/* 2. Grade Level Filter (All Grades) */}
            <div className="flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-600">Grade:</span>
              <select
                value={selectedGrade}
                onChange={(e) => onGradeChange(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white text-xs"
              >
                <option value="ALL">All Grades ({gradeBand})</option>
                {availableGrades.map(g => (
                  <option key={g} value={g}>Grade {g === 0 ? 'K' : g}</option>
                ))}
              </select>
            </div>

            {/* 3. Teacher / Counselor Filter */}
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-600">Teacher / Counselor:</span>
              <select
                value={selectedStaff || 'ALL'}
                onChange={(e) => onStaffChange?.(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 font-medium text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white text-xs max-w-[210px] truncate"
              >
                <option value="ALL">All Teachers / Counselors ({staffList.length})</option>
                {staffList.map((s, idx) => {
                  const name = typeof s === 'string' ? s : s.staffName;
                  const label = s.staffLabel ? ` · ${s.staffLabel}` : '';
                  return (
                    <option key={name + idx} value={name}>
                      {name}{label}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Quick Reset Button if filtered */}
            {hasActiveFilters && (
              <button
                onClick={() => {
                  onSiteChange('ALL');
                  onGradeChange('ALL');
                  onStaffChange?.('ALL');
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-blue-600 py-0.5 px-1.5 rounded hover:bg-slate-100 transition-colors"
                title="Reset top filters to All Schools, All Grades, All Staff"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          <div className="text-[11px] text-slate-400 italic hidden md:block">
            Official California ELPAC Longitudinal Dataset • Sheet 1JrSfw0pEv...
          </div>
        </div>

      </div>
    </div>
  );
}

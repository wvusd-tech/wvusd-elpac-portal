// src/components/ExecutiveOverview.jsx
import React, { useState, useMemo } from 'react';
import { computeKPISummary, computeHierarchicalBreakdown } from '../utils/elpacData.js';
import { getSiteLogo, DISTRICT_LOGO } from '../config.js';
import { 
  Users, 
  Award, 
  TrendingUp, 
  Target, 
  Search, 
  ChevronRight,
  ChevronDown,
  ShieldAlert,
  Languages,
  FileText,
  Home,
  RotateCcw,
  GraduationCap
} from 'lucide-react';

export default function ExecutiveOverview({ 
  students = [], 
  cohortStudents = [],
  gradeBand = 'Elementary', 
  subjectFocus = 'ALL', 
  selectedSite = 'ALL',
  onSelectStaff, 
  onSelectGradeRoster,
  onSelectLevelFilter,
  activeFlagFilter = null,
  onSelectFlagFilter
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeLevelFilter, setActiveLevelFilter] = useState(null);
  const [collapsedGrades, setCollapsedGrades] = useState(new Set());

  const activeSiteLogo = getSiteLogo(selectedSite);

  // Compute KPI metrics for active students
  const kpi = useMemo(() => computeKPISummary(students, subjectFocus), [students, subjectFocus]);

  // Compute baseline cohort KPI (for demographics counts before flag filtering)
  const baselineList = cohortStudents.length > 0 ? cohortStudents : students;
  const cohortKpi = useMemo(() => computeKPISummary(baselineList, subjectFocus), [baselineList, subjectFocus]);

  // Compute hierarchical breakdown: Grade Level Summary rows with nested teachers/counselors
  const hierarchicalData = useMemo(() => {
    return computeHierarchicalBreakdown(students, gradeBand);
  }, [students, gradeBand]);

  // Filter hierarchical data by search query
  const filteredHierarchy = useMemo(() => {
    if (!searchTerm.trim()) return hierarchicalData;
    const q = searchTerm.toLowerCase().trim();

    return hierarchicalData
      .map(gradeGroup => {
        const gradeMatches = gradeGroup.gradeLabel.toLowerCase().includes(q) || String(gradeGroup.grade).includes(q);
        const matchingTeachers = gradeGroup.teachers.filter(t => 
          (t.staffName && t.staffName.toLowerCase().includes(q)) || 
          (t.staffEmail && t.staffEmail.toLowerCase().includes(q)) ||
          (t.school && t.school.toLowerCase().includes(q))
        );

        if (gradeMatches) {
          return gradeGroup;
        }
        if (matchingTeachers.length > 0) {
          return {
            ...gradeGroup,
            teachers: matchingTeachers
          };
        }
        return null;
      })
      .filter(Boolean);
  }, [hierarchicalData, searchTerm]);

  const toggleGradeCollapse = (gradeNum) => {
    setCollapsedGrades(prev => {
      const next = new Set(prev);
      if (next.has(gradeNum)) {
        next.delete(gradeNum);
      } else {
        next.add(gradeNum);
      }
      return next;
    });
  };

  const handleLevelClick = (level) => {
    const next = activeLevelFilter === level ? null : level;
    setActiveLevelFilter(next);
    if (onSelectLevelFilter) {
      onSelectLevelFilter(next);
    }
  };

  const handleFlagClick = (flagKey) => {
    if (!onSelectFlagFilter) return;
    if (activeFlagFilter === flagKey) {
      onSelectFlagFilter(null);
    } else {
      onSelectFlagFilter(flagKey);
    }
  };

  const getFlagFilterLabel = (flag) => {
    switch (flag) {
      case 'SPED': return 'SPED (IEP)';
      case 'EL': return 'Active EL (LEP)';
      case '504': return '504 Plans';
      case 'HOMELESS_FOSTER': return 'Homeless / Foster';
      case 'BUBBLE': return 'Bubble Students';
      default: return flag;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* 1. Executive KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Enrolled */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/50 rounded-full -mr-6 -mt-6 pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Filtered Cohort
            </span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 tracking-tight font-mono">
            {kpi.total.toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
            <span className="font-semibold text-slate-700">{kpi.studentsWithScore.toLocaleString()}</span> with ELPAC score data
          </div>
        </div>

        {/* Card 2: Proficient / Reclassification Rate (Level 3 & 4) */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50/50 rounded-full -mr-6 -mt-6 pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              % Moderately / Well Developed
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-600 tracking-tight font-mono">
              {kpi.metExceededPct}%
            </span>
            <span className="text-xs font-semibold text-slate-500">
              (L3 & L4)
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            <span className="font-semibold text-blue-700">{kpi.level4Count.toLocaleString()} L4 RFEP Ready</span> ({kpi.level4Pct}%) • <span className="font-semibold text-emerald-700">{kpi.metExceededCount.toLocaleString()}</span> total L3+L4
          </div>
        </div>

        {/* Card 3: Average Scale Score */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50/50 rounded-full -mr-6 -mt-6 pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Average ELPAC Scale Score
            </span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Target className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 tracking-tight font-mono">
            {subjectFocus === 'ORAL' 
              ? kpi.avgOralScore || kpi.avgOverallScore || '—'
              : subjectFocus === 'WRITTEN'
              ? kpi.avgWrittenScore || kpi.avgOverallScore || '—'
              : kpi.avgOverallScore || '—'}
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-3">
            <span>Oral: <strong className="text-slate-800 font-mono">{kpi.avgOralScore || '—'}</strong></span>
            <span>•</span>
            <span>Written: <strong className="text-slate-800 font-mono">{kpi.avgWrittenScore || '—'}</strong></span>
          </div>
        </div>

        {/* Card 4: % Positive Growth */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50/50 rounded-full -mr-6 -mt-6 pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              % Positive YoY Scale Growth
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-600 tracking-tight font-mono">
              {subjectFocus === 'ORAL'
                ? kpi.mathGrowthPositivePct
                : kpi.overallGrowthPositivePct}%
            </span>
            <span className="text-xs font-semibold text-slate-500">
              accelerating
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
            <span>Overall: <strong className="text-slate-800 font-mono">+{kpi.overallGrowthPositivePct}%</strong></span>
            <span>•</span>
            <span>Oral: <strong className="text-slate-800 font-mono">+{kpi.mathGrowthPositivePct}%</strong></span>
          </div>
        </div>
      </div>

      {/* 2. Interactive Demographic & Special Populations Filter Pills (SPED, Active EL, 504, Homeless/Foster, Bubble Students) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Cohort Demographics & Support Flags:
          </span>
          {activeFlagFilter && (
            <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 animate-fade-in">
              Filtering by: {getFlagFilterLabel(activeFlagFilter)}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* 1. SPED Pill Button */}
          <button
            type="button"
            onClick={() => handleFlagClick('SPED')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold border transition-all cursor-pointer ${
              activeFlagFilter === 'SPED'
                ? 'bg-purple-600 text-white border-purple-700 shadow-sm ring-2 ring-purple-400 ring-offset-1'
                : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 hover:border-purple-300'
            }`}
            title="Click to filter cohort by Special Education (IEP)"
          >
            <ShieldAlert className={`w-3.5 h-3.5 ${activeFlagFilter === 'SPED' ? 'text-white' : 'text-purple-600'}`} />
            <span>SPED (IEP): {cohortKpi.spedCount}</span>
            <span className="text-[10px] opacity-80">
              ({((cohortKpi.spedCount / (cohortKpi.total || 1)) * 100).toFixed(1)}%)
            </span>
          </button>

          {/* 2. Active EL Pill Button */}
          <button
            type="button"
            onClick={() => handleFlagClick('EL')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold border transition-all cursor-pointer ${
              activeFlagFilter === 'EL'
                ? 'bg-teal-600 text-white border-teal-700 shadow-sm ring-2 ring-teal-400 ring-offset-1'
                : 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100 hover:border-teal-300'
            }`}
            title="Click to filter cohort by Active English Learners (LEP)"
          >
            <Languages className={`w-3.5 h-3.5 ${activeFlagFilter === 'EL' ? 'text-white' : 'text-teal-600'}`} />
            <span>Active EL (LEP): {cohortKpi.elCount}</span>
            <span className="text-[10px] opacity-80">
              ({((cohortKpi.elCount / (cohortKpi.total || 1)) * 100).toFixed(1)}%)
            </span>
          </button>

          {/* 3. 504 Plans Pill Button */}
          <button
            type="button"
            onClick={() => handleFlagClick('504')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold border transition-all cursor-pointer ${
              activeFlagFilter === '504'
                ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm ring-2 ring-indigo-400 ring-offset-1'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300'
            }`}
            title="Click to filter cohort by Section 504 Accommodations"
          >
            <FileText className={`w-3.5 h-3.5 ${activeFlagFilter === '504' ? 'text-white' : 'text-indigo-600'}`} />
            <span>504 Plans: {cohortKpi.plan504Count}</span>
          </button>

          {/* 4. Homeless / Foster Youth Pill Button */}
          <button
            type="button"
            onClick={() => handleFlagClick('HOMELESS_FOSTER')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold border transition-all cursor-pointer ${
              activeFlagFilter === 'HOMELESS_FOSTER'
                ? 'bg-rose-600 text-white border-rose-700 shadow-sm ring-2 ring-rose-400 ring-offset-1'
                : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 hover:border-rose-300'
            }`}
            title="Click to filter cohort by Homeless / Foster Youth"
          >
            <Home className={`w-3.5 h-3.5 ${activeFlagFilter === 'HOMELESS_FOSTER' ? 'text-white' : 'text-rose-600'}`} />
            <span>Homeless/Foster: {cohortKpi.homelessFosterCount}</span>
          </button>

          {/* 5. Bubble Students Pill Button */}
          <button
            type="button"
            onClick={() => handleFlagClick('BUBBLE')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold border transition-all cursor-pointer ${
              activeFlagFilter === 'BUBBLE'
                ? 'bg-amber-500 text-white border-amber-600 shadow-sm ring-2 ring-amber-400 ring-offset-1'
                : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 hover:border-amber-400'
            }`}
            title="Click to filter cohort by Bubble Students near proficiency / RFEP threshold"
          >
            <Target className={`w-3.5 h-3.5 ${activeFlagFilter === 'BUBBLE' ? 'text-white' : 'text-amber-600'}`} />
            <span>Bubble Students: {cohortKpi.bubbleStudentsCount}</span>
          </button>

          {/* Reset Filter / Show All Toggle Button */}
          {activeFlagFilter && (
            <button
              type="button"
              onClick={() => onSelectFlagFilter?.(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors shadow-xs ml-1"
              title="Reset demographic filter to show full cohort"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Show All</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. Performance Level Distribution Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>California ELPAC Performance Level Distribution</span>
              {activeLevelFilter && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200 font-medium">
                  Filtering by Level {activeLevelFilter} (Click to reset)
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any color segment to highlight and inspect students in that ELPAC proficiency bracket.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {subjectFocus === 'ALL' ? 'Overall ELPAC (Part 0)' : subjectFocus === 'ORAL' ? 'Oral Language (Part 1)' : 'Written Language (Part 2)'}
          </span>
        </div>

        {/* 4-Part Segmented Progress Bar */}
        <div className="h-6 w-full bg-slate-100 rounded-xl overflow-hidden flex shadow-inner border border-slate-200/60 p-0.5 gap-0.5">
          {/* Level 1: Red */}
          <div
            onClick={() => handleLevelClick(1)}
            style={{ width: `${Math.max(kpi.levelPcts[1], 2)}%` }}
            className={`h-full bg-red-500 rounded-l-lg hover:brightness-110 cursor-pointer transition-all relative group flex items-center justify-center ${
              activeLevelFilter === 1 ? 'ring-2 ring-red-400 ring-offset-1' : ''
            }`}
            title={`Level 1 (Minimally Developed): ${kpi.levelCounts[1]} students (${kpi.levelPcts[1]}%)`}
          >
            {kpi.levelPcts[1] > 6 && (
              <span className="text-[11px] font-bold text-white font-mono drop-shadow">
                {kpi.levelPcts[1]}%
              </span>
            )}
          </div>

          {/* Level 2: Amber */}
          <div
            onClick={() => handleLevelClick(2)}
            style={{ width: `${Math.max(kpi.levelPcts[2], 2)}%` }}
            className={`h-full bg-amber-500 hover:brightness-110 cursor-pointer transition-all relative group flex items-center justify-center ${
              activeLevelFilter === 2 ? 'ring-2 ring-amber-400 ring-offset-1' : ''
            }`}
            title={`Level 2 (Somewhat Developed): ${kpi.levelCounts[2]} students (${kpi.levelPcts[2]}%)`}
          >
            {kpi.levelPcts[2] > 6 && (
              <span className="text-[11px] font-bold text-white font-mono drop-shadow">
                {kpi.levelPcts[2]}%
              </span>
            )}
          </div>

          {/* Level 3: Emerald */}
          <div
            onClick={() => handleLevelClick(3)}
            style={{ width: `${Math.max(kpi.levelPcts[3], 2)}%` }}
            className={`h-full bg-emerald-500 hover:brightness-110 cursor-pointer transition-all relative group flex items-center justify-center ${
              activeLevelFilter === 3 ? 'ring-2 ring-emerald-400 ring-offset-1' : ''
            }`}
            title={`Level 3 (Moderately Developed): ${kpi.levelCounts[3]} students (${kpi.levelPcts[3]}%)`}
          >
            {kpi.levelPcts[3] > 6 && (
              <span className="text-[11px] font-bold text-white font-mono drop-shadow">
                {kpi.levelPcts[3]}%
              </span>
            )}
          </div>

          {/* Level 4: Blue */}
          <div
            onClick={() => handleLevelClick(4)}
            style={{ width: `${Math.max(kpi.levelPcts[4], 2)}%` }}
            className={`h-full bg-blue-600 rounded-r-lg hover:brightness-110 cursor-pointer transition-all relative group flex items-center justify-center ${
              activeLevelFilter === 4 ? 'ring-2 ring-blue-400 ring-offset-1' : ''
            }`}
            title={`Level 4 (Well Developed / RFEP Ready): ${kpi.levelCounts[4]} students (${kpi.levelPcts[4]}%)`}
          >
            {kpi.levelPcts[4] > 6 && (
              <span className="text-[11px] font-bold text-white font-mono drop-shadow">
                {kpi.levelPcts[4]}%
              </span>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
          <button
            onClick={() => handleLevelClick(1)}
            className={`p-2.5 rounded-xl border text-left transition-all ${
              activeLevelFilter === 1 
                ? 'bg-red-50 border-red-300 shadow-sm' 
                : 'bg-white border-slate-200/80 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
              <span className="font-bold text-slate-800">Level 1: Minimally</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between font-mono">
              <span className="text-slate-500">{kpi.levelCounts[1].toLocaleString()} students</span>
              <span className="font-bold text-red-600">{kpi.levelPcts[1]}%</span>
            </div>
          </button>

          <button
            onClick={() => handleLevelClick(2)}
            className={`p-2.5 rounded-xl border text-left transition-all ${
              activeLevelFilter === 2 
                ? 'bg-amber-50 border-amber-300 shadow-sm' 
                : 'bg-white border-slate-200/80 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
              <span className="font-bold text-slate-800">Level 2: Somewhat</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between font-mono">
              <span className="text-slate-500">{kpi.levelCounts[2].toLocaleString()} students</span>
              <span className="font-bold text-amber-600">{kpi.levelPcts[2]}%</span>
            </div>
          </button>

          <button
            onClick={() => handleLevelClick(3)}
            className={`p-2.5 rounded-xl border text-left transition-all ${
              activeLevelFilter === 3 
                ? 'bg-emerald-50 border-emerald-300 shadow-sm' 
                : 'bg-white border-slate-200/80 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
              <span className="font-bold text-slate-800">Level 3: Moderately</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between font-mono">
              <span className="text-slate-500">{kpi.levelCounts[3].toLocaleString()} students</span>
              <span className="font-bold text-emerald-600">{kpi.levelPcts[3]}%</span>
            </div>
          </button>

          <button
            onClick={() => handleLevelClick(4)}
            className={`p-2.5 rounded-xl border text-left transition-all ${
              activeLevelFilter === 4 
                ? 'bg-blue-50 border-blue-300 shadow-sm' 
                : 'bg-white border-slate-200/80 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-600 shrink-0" />
              <span className="font-bold text-slate-800">Level 4: Well Dev</span>
            </div>
            <div className="mt-1 flex items-baseline justify-between font-mono">
              <span className="text-slate-500">{kpi.levelCounts[4].toLocaleString()} students</span>
              <span className="font-bold text-blue-600">{kpi.levelPcts[4]}%</span>
            </div>
          </button>
        </div>
      </div>

      {/* 4. Hierarchical Grade-Level & Classroom / Counselor Breakdown Matrix */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        
        {/* Table Header Controls */}
        <div className="p-5 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src={activeSiteLogo}
              alt="Site Logo"
              className="w-10 h-10 object-contain rounded-xl bg-slate-50 p-1 border border-slate-200 shrink-0"
              onError={(e) => { e.target.src = DISTRICT_LOGO; }}
            />
            <div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-blue-600" />
                <span>
                  {gradeBand === 'Elementary'
                    ? 'Elementary Grade-Level & Classroom ELPAC Breakdown'
                    : 'Secondary Grade-Level Cohort & Counselor ELPAC Breakdown'}
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {gradeBand === 'Elementary'
                  ? 'Teachers are grouped under Grade Level Summary rows. Click any row to open the classroom roster.'
                  : 'Grades 6–12 grouped by Grade Level Cohort and designated Counselor caseloads.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={gradeBand === 'Elementary' ? 'Filter by teacher, school, or grade...' : 'Filter by counselor, school, or grade...'}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white w-64"
              />
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-semibold select-none">
                <th className="py-3 px-4">
                  <span>Grade Level Overview / Educator Caseload</span>
                </th>
                <th className="py-3 px-3">
                  <span>Enrolled</span>
                </th>
                <th className="py-3 px-3">
                  <span>% L3 & L4 Proficient</span>
                </th>
                <th className="py-3 px-3">
                  <span>YoY Scale Growth</span>
                </th>
                <th className="py-3 px-3">
                  <span>Active EL</span>
                </th>
                <th className="py-3 px-3">
                  <span>Level 1 Intensive</span>
                </th>
                <th className="py-3 px-3">School Site</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHierarchy.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-slate-400 italic">
                    No matching grade levels or educators found.
                  </td>
                </tr>
              ) : (
                filteredHierarchy.map((gradeGroup) => {
                  const isCollapsed = collapsedGrades.has(gradeGroup.grade);
                  const isPositiveDelta = gradeGroup.avgOverallDelta !== null && gradeGroup.avgOverallDelta > 0;
                  const isNegativeDelta = gradeGroup.avgOverallDelta !== null && gradeGroup.avgOverallDelta < 0;

                  return (
                    <React.Fragment key={`grade-group-${gradeGroup.grade}`}>
                      
                      {/* ================= GRADE LEVEL SUMMARY ROW ================= */}
                      <tr 
                        onClick={() => toggleGradeCollapse(gradeGroup.grade)}
                        className="bg-slate-100/90 hover:bg-slate-200/80 transition-colors border-t-2 border-b border-slate-300/80 font-semibold text-slate-900 select-none cursor-pointer"
                      >
                        <td className="py-3 px-4 flex items-center gap-2">
                          <button
                            type="button"
                            className="p-1 rounded-md text-slate-500 hover:bg-slate-300/60 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleGradeCollapse(gradeGroup.grade);
                            }}
                            title={isCollapsed ? "Expand Grade" : "Collapse Grade"}
                          >
                            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                          
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center font-mono shadow-xs">
                              {gradeGroup.grade === 0 ? 'K' : gradeGroup.grade}
                            </span>
                            <div>
                              <span className="text-sm font-black text-slate-900 tracking-tight">
                                {gradeGroup.gradeLabel}
                              </span>
                              <span className="text-[11px] text-slate-500 ml-2 font-normal hidden sm:inline">
                                ({gradeGroup.teachers.length} {gradeBand === 'Elementary' ? 'Classrooms' : 'Caseloads'})
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 font-mono font-bold text-slate-900 text-sm">
                          {gradeGroup.total}
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span className={`font-mono font-bold ${
                              gradeGroup.combinedMetPct >= 70 ? 'text-emerald-700' : gradeGroup.combinedMetPct >= 50 ? 'text-amber-700' : 'text-slate-800'
                            }`}>
                              {gradeGroup.combinedMetPct}%
                            </span>
                            <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden shrink-0">
                              <div
                                style={{ width: `${gradeGroup.combinedMetPct}%` }}
                                className={`h-full ${
                                  gradeGroup.combinedMetPct >= 70 ? 'bg-emerald-500' : gradeGroup.combinedMetPct >= 50 ? 'bg-amber-500' : 'bg-blue-600'
                                }`}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3 font-mono">
                          {gradeGroup.avgOverallDelta !== null ? (
                            <span className={`inline-flex items-center gap-1 font-bold ${
                              isPositiveDelta ? 'text-emerald-700' : isNegativeDelta ? 'text-rose-700' : 'text-slate-600'
                            }`}>
                              {isPositiveDelta ? `+${gradeGroup.avgOverallDelta}` : gradeGroup.avgOverallDelta} pts
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">—</span>
                          )}
                        </td>

                        <td className="py-3 px-3 font-mono">
                          <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-800 border border-teal-200 font-bold text-xs">
                            {gradeGroup.elCount} EL
                          </span>
                        </td>

                        <td className="py-3 px-3 font-mono">
                          <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200 font-bold text-xs">
                            {gradeGroup.tier3NeedsCount} L1
                          </span>
                        </td>

                        <td className="py-3 px-3 text-slate-700 truncate max-w-[140px] text-xs font-medium">
                          {selectedSite === 'ALL' ? 'Multiple Sites' : gradeGroup.school}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectGradeRoster?.(gradeGroup.grade);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-xs transition-all"
                            title={`Open full Grade ${gradeGroup.grade} cohort roster`}
                          >
                            <span>Open Grade Roster</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>

                      {/* ================= NESTED TEACHER / COUNSELOR ROWS ================= */}
                      {!isCollapsed && gradeGroup.teachers.map((teacher, tIdx) => {
                        const tPositiveDelta = teacher.avgOverallDelta !== null && teacher.avgOverallDelta > 0;
                        const tNegativeDelta = teacher.avgOverallDelta !== null && teacher.avgOverallDelta < 0;
                        const tLogo = getSiteLogo(teacher.school);

                        return (
                          <tr
                            key={`teacher-${gradeGroup.grade}-${tIdx}`}
                            onClick={() => onSelectStaff?.(teacher)}
                            className="hover:bg-blue-50/50 transition-colors group cursor-pointer bg-white"
                          >
                            <td className="py-2.5 px-4 font-medium text-slate-900 flex items-center gap-2 pl-9">
                              <span className="text-slate-300 font-mono text-xs select-none">└─</span>
                              <span className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-blue-100 group-hover:text-blue-700 group-hover:border-blue-300 transition-colors">
                                {teacher.staffName ? teacher.staffName.charAt(0) : 'T'}
                              </span>
                              <div>
                                <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors text-xs flex items-center gap-1.5">
                                  <span>{teacher.staffName}</span>
                                  <span className="text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity font-normal">
                                    View Roster →
                                  </span>
                                </div>
                                {teacher.staffEmail && (
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {teacher.staffEmail}
                                  </div>
                                )}
                              </div>
                            </td>

                            <td className="py-2.5 px-3 font-mono text-slate-700 font-bold text-xs">
                              {teacher.total}
                            </td>

                            <td className="py-2.5 px-3 text-xs">
                              <div className="flex items-center gap-2">
                                <span className={`font-mono font-bold ${
                                  teacher.combinedMetPct >= 70 ? 'text-emerald-600' : teacher.combinedMetPct >= 50 ? 'text-amber-600' : 'text-slate-700'
                                }`}>
                                  {teacher.combinedMetPct}%
                                </span>
                                <div className="w-14 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                                  <div
                                    style={{ width: `${teacher.combinedMetPct}%` }}
                                    className={`h-full ${
                                      teacher.combinedMetPct >= 70 ? 'bg-emerald-500' : teacher.combinedMetPct >= 50 ? 'bg-amber-500' : 'bg-blue-500'
                                    }`}
                                  />
                                </div>
                              </div>
                            </td>

                            <td className="py-2.5 px-3 font-mono text-xs">
                              {teacher.avgOverallDelta !== null ? (
                                <span className={`inline-flex items-center gap-0.5 font-semibold ${
                                  tPositiveDelta ? 'text-emerald-600' : tNegativeDelta ? 'text-rose-600' : 'text-slate-500'
                                }`}>
                                  {tPositiveDelta ? `+${teacher.avgOverallDelta}` : teacher.avgOverallDelta} pts
                                </span>
                              ) : (
                                <span className="text-slate-400 font-normal">—</span>
                              )}
                            </td>

                            <td className="py-2.5 px-3 font-mono text-xs text-slate-600">
                              {teacher.elCount > 0 ? (
                                <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 text-[11px] font-semibold">
                                  {teacher.elCount} EL
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>

                            <td className="py-2.5 px-3 font-mono text-xs">
                              {teacher.tier3NeedsCount > 0 ? (
                                <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
                                  {teacher.tier3NeedsCount}
                                </span>
                              ) : (
                                <span className="text-slate-400">0</span>
                              )}
                            </td>

                            <td className="py-2.5 px-3 text-slate-600 truncate max-w-[160px] text-xs">
                              <div className="flex items-center gap-1.5">
                                <img
                                  src={tLogo}
                                  alt=""
                                  className="w-4 h-4 object-contain shrink-0"
                                  onError={(e) => { e.target.src = DISTRICT_LOGO; }}
                                />
                                <span className="truncate">{teacher.school}</span>
                              </div>
                            </td>

                            <td className="py-2.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSelectStaff?.(teacher);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 shadow-xs transition-all"
                              >
                                <span>Open Roster</span>
                                <ChevronRight className="w-3 h-3 text-slate-400 group-hover:text-blue-600" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

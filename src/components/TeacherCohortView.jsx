// src/components/TeacherCohortView.jsx
import React, { useState, useMemo, useEffect } from 'react';
import StudentCard from './StudentCard.jsx';
import { isBubbleStudent, getDistanceToStandard, getSiteLogo, DISTRICT_LOGO } from '../config.js';
import { 
  ArrowLeft,
  Users, 
  MessageSquare, 
  PenTool, 
  Printer, 
  Copy, 
  Check, 
  Search, 
  Target, 
  Filter,
  ShieldAlert,
  Languages,
  FileText,
  Home,
  RotateCcw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export default function TeacherCohortView({
  students = [],
  gradeBand = 'Elementary',
  subjectFocus = 'ALL',
  user,
  onStudentClick,
  activeStaffFilter,
  onClearStaffFilter,
  onBackToOverview
}) {
  const [prevSubjectFocus, setPrevSubjectFocus] = useState(subjectFocus);
  const [activeDomain, setActiveDomain] = useState(subjectFocus === 'ORAL' ? 'ORAL' : subjectFocus === 'WRITTEN' ? 'WRITTEN' : 'ALL');
  if (subjectFocus !== prevSubjectFocus) {
    setPrevSubjectFocus(subjectFocus);
    setActiveDomain(subjectFocus === 'ORAL' ? 'ORAL' : subjectFocus === 'WRITTEN' ? 'WRITTEN' : 'ALL');
  }

  const [searchQuery, setSearchQuery] = useState('');
  const [activeRosterFlag, setActiveRosterFlag] = useState(null); // 'SPED' | 'EL' | '504' | 'HOMELESS_FOSTER' | 'BUBBLE' | null
  const [copiedTier, setCopiedTier] = useState(null);
  const [copiedAllPlan, setCopiedAllPlan] = useState(false);
  const [isTiersOpen, setIsTiersOpen] = useState(true);

  // Explicitly scroll window to top whenever roster view mounts or active staff changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [activeStaffFilter]);

  // Determine educator metadata if a teacher/counselor was selected or if logged-in user is a teacher/counselor
  const educatorName = activeStaffFilter?.staffName || (
    user?.role === 'ElementaryTeacher' || user?.role === 'Counselor' || user?.role === 'SecondaryTeacher'
      ? user?.name
      : null
  );
  const educatorEmail = activeStaffFilter?.staffEmail || (educatorName && user?.name === educatorName ? user?.email : '');
  const educatorSchool = activeStaffFilter?.school || (user?.school !== 'ALL' ? user?.school : '') || '';
  const educatorGrade = activeStaffFilter?.grade;
  const siteLogo = getSiteLogo(educatorSchool || students[0]?.school);

  // Filter students matching the active educator safely by email or name
  const educatorRoster = useMemo(() => {
    const safeStudents = Array.isArray(students) ? students.filter(Boolean) : [];
    if (!activeStaffFilter) {
      return safeStudents;
    }

    const targetEmail = (activeStaffFilter.staffEmail || '').toLowerCase().trim();
    const targetName = (activeStaffFilter.staffName || '').toLowerCase().trim();

    const matches = safeStudents.filter(s => {
      if (!s) return false;
      const sEmail = (s.staffEmail || '').toLowerCase().trim();
      const sName = (s.staffName || '').toLowerCase().trim();

      if (targetEmail && sEmail && targetEmail === sEmail) return true;
      if (targetName && sName) {
        if (targetName === sName) return true;
        const cleanTarget = targetName.replace(/[,\s]+/g, ' ');
        const cleanS = sName.replace(/[,\s]+/g, ' ');
        if (cleanTarget === cleanS) return true;
        if (cleanTarget.split(' ').reverse().join(' ') === cleanS) return true;
      }
      return false;
    });

    return matches.length > 0 ? matches : safeStudents;
  }, [students, activeStaffFilter]);

  // Compute demographic & support flag metrics across this educator's roster
  const rosterDemographics = useMemo(() => {
    const total = educatorRoster.length;
    let spedCount = 0;
    let elCount = 0;
    let plan504Count = 0;
    let homelessFosterCount = 0;
    let bubbleStudentsCount = 0;

    for (const s of educatorRoster) {
      if (s.flags?.sped) spedCount++;
      if (s.flags?.plan504) plan504Count++;
      if (s.flags?.homelessFoster) homelessFosterCount++;
      const elStat = (s.flags?.elStatus || '').toUpperCase().trim();
      if (elStat === 'LEP' || elStat === 'EL') elCount++;

      const overall = s.latestOverall || s.latestEla;
      if (isBubbleStudent(overall?.scaledScore, s.grade, overall?.performanceLevel)) {
        bubbleStudentsCount++;
      }
    }

    return {
      total,
      spedCount,
      spedPct: total > 0 ? ((spedCount / total) * 100).toFixed(1) : '0.0',
      elCount,
      elPct: total > 0 ? ((elCount / total) * 100).toFixed(1) : '0.0',
      plan504Count,
      homelessFosterCount,
      bubbleStudentsCount
    };
  }, [educatorRoster]);

  // Handle clicking on a demographic filter pill
  const handleFlagClick = (flag) => {
    setActiveRosterFlag(prev => prev === flag ? null : flag);
  };

  // Search and flag-filtered roster
  const displayedStudents = useMemo(() => {
    let list = educatorRoster;

    if (activeRosterFlag === 'SPED') {
      list = list.filter(s => Boolean(s.flags?.sped));
    } else if (activeRosterFlag === 'EL') {
      list = list.filter(s => {
        const elStat = (s.flags?.elStatus || '').toUpperCase().trim();
        return elStat === 'LEP' || elStat === 'EL';
      });
    } else if (activeRosterFlag === '504') {
      list = list.filter(s => Boolean(s.flags?.plan504));
    } else if (activeRosterFlag === 'HOMELESS_FOSTER') {
      list = list.filter(s => Boolean(s.flags?.homelessFoster));
    } else if (activeRosterFlag === 'BUBBLE') {
      list = list.filter(s => {
        const overall = s.latestOverall || s.latestEla;
        return isBubbleStudent(overall?.scaledScore, s.grade, overall?.performanceLevel);
      });
    }

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(s => 
      (s.name && s.name.toLowerCase().includes(q)) || 
      (s.studentId && String(s.studentId).includes(q))
    );
  }, [educatorRoster, activeRosterFlag, searchQuery]);

  // Categorize students into 4 distinct MTSS / ELD action tiers
  const tieredGroups = useMemo(() => {
    const tiers = {
      1: {
        id: 1,
        title: 'Tier 1: Well Developed (Level 4)',
        subtitle: 'RFEP Reclassification Ready & Bridging Enrichment',
        level: 4,
        color: 'blue',
        students: [],
        bubbleCount: 0
      },
      2: {
        id: 2,
        title: 'Tier 2: Moderately Developed (Level 3)',
        subtitle: 'Expanding Proficiency & Reclassification Candidates',
        level: 3,
        color: 'emerald',
        students: [],
        bubbleCount: 0
      },
      3: {
        id: 3,
        title: 'Tier 3: Strategic / Bubble Students (Level 2)',
        subtitle: 'Somewhat Developed · High-Leverage ELD Acceleration',
        level: 2,
        color: 'amber',
        students: [],
        bubbleCount: 0
      },
      4: {
        id: 4,
        title: 'Tier 4: Intensive ELD Support Needed (Level 1)',
        subtitle: 'Minimally Developed · Targeted Emerging Language Support',
        level: 1,
        color: 'red',
        students: [],
        bubbleCount: 0
      },
      untested: {
        id: 'untested',
        title: 'Untested / Prior Year Pending',
        subtitle: 'No official ELPAC scale score record on file',
        level: 0,
        color: 'slate',
        students: [],
        bubbleCount: 0
      }
    };

    for (const s of educatorRoster) {
      if (!s) continue;
      const activeRec =
        activeDomain === 'ORAL'
          ? (s.latestOral || s.latestOverall || s.latestEla)
          : activeDomain === 'WRITTEN'
          ? (s.latestWritten || s.latestOverall || s.latestEla)
          : (s.latestOverall || s.latestEla);

      const level = activeRec?.performanceLevel;
      const score = activeRec?.scaledScore;
      const isBubble = isBubbleStudent(score, s.grade, level);

      const decorated = {
        ...s,
        activeScore: score,
        isBubble,
        distanceToStandard: score ? getDistanceToStandard(score, s.grade) : null
      };

      if (level === 4) {
        tiers[1].students.push(decorated);
      } else if (level === 3) {
        tiers[2].students.push(decorated);
        if (isBubble) tiers[2].bubbleCount++;
      } else if (level === 2) {
        tiers[3].students.push(decorated);
        if (isBubble) tiers[3].bubbleCount++;
      } else if (level === 1) {
        tiers[4].students.push(decorated);
      } else {
        tiers.untested.students.push(decorated);
      }
    }

    for (const k of [1, 2, 3, 4, 'untested']) {
      tiers[k].students.sort((a, b) => {
        if (a.isBubble !== b.isBubble) return a.isBubble ? -1 : 1;
        const scoreA = a.activeScore || 0;
        const scoreB = b.activeScore || 0;
        return scoreA - scoreB;
      });
    }

    return tiers;
  }, [educatorRoster, activeDomain]);

  // Copy small-group roster for a specific tier
  const handleCopyTierRoster = (tierKey) => {
    const tier = tieredGroups[tierKey];
    if (!tier) return;

    let text = `WVUSD ELPAC Small-Group Intervention Roster\n`;
    text += `Educator: ${educatorName || 'Educator'} | School: ${educatorSchool || 'WVUSD'}\n`;
    text += `Domain: ${activeDomain === 'ALL' ? 'Overall ELPAC (Part 0)' : activeDomain} | Group: ${tier.title}\n`;
    text += `Total Students: ${tier.students.length}\n`;
    text += `Generated: ${new Date().toLocaleDateString()}\n\n`;

    tier.students.forEach((s, idx) => {
      const bubbleStr = s.isBubble ? ' [BUBBLE TARGET]' : '';
      const flags = [];
      if (s.flags?.sped) flags.push('SPED');
      if (s.flags?.plan504) flags.push('504');
      if (s.flags?.elStatus) flags.push(`EL:${s.flags.elStatus}`);
      if (s.flags?.homelessFoster) flags.push('Homeless/Foster');
      const flagStr = flags.length > 0 ? ` (${flags.join(', ')})` : '';
      text += `${idx + 1}. ${s.name} (ID: ${s.studentId}, Gr ${s.grade})${flagStr} - Scaled Score: ${s.activeScore || 'N/A'}${bubbleStr}\n`;
    });

    navigator.clipboard.writeText(text);
    setCopiedTier(tierKey);
    setTimeout(() => setCopiedTier(null), 2000);
  };

  // Copy full 4-tier plan
  const handleCopyAllPlan = () => {
    let text = `==========================================================\n`;
    text += `WALNUT VALLEY UNIFIED SCHOOL DISTRICT\n`;
    text += `CALIFORNIA ELPAC MULTI-TIERED ELD INTERVENTION PLAN\n`;
    text += `Educator: ${educatorName || 'Educator'} | School: ${educatorSchool || 'WVUSD'}\n`;
    text += `Domain Focus: ${activeDomain} | Total Roster: ${educatorRoster.length} Students\n`;
    text += `Generated: ${new Date().toLocaleDateString()}\n`;
    text += `==========================================================\n\n`;

    [1, 2, 3, 4].forEach(key => {
      const tier = tieredGroups[key];
      text += `--- ${tier.title} (${tier.students.length} students) ---\n`;
      text += `Pedagogical Focus: ${tier.subtitle}\n`;
      tier.students.forEach(s => {
        const bubble = s.isBubble ? ' [BUBBLE TARGET]' : '';
        text += `• ${s.name} (Gr ${s.grade}, ID #${s.studentId}) - Score: ${s.activeScore || 'N/A'}${bubble}\n`;
      });
      text += `\n`;
    });

    navigator.clipboard.writeText(text);
    setCopiedAllPlan(true);
    setTimeout(() => setCopiedAllPlan(false), 2000);
  };

  const handleBack = () => {
    if (onBackToOverview) {
      onBackToOverview();
    } else if (onClearStaffFilter) {
      onClearStaffFilter();
    }
  };

  if (educatorRoster.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-8 shadow-sm text-center max-w-xl mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            No Student Records Found
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {educatorName 
              ? `No student records are currently enrolled for ${educatorName} under the active school or grade filters.`
              : 'No students found matching the selected parameters.'}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Executive Overview</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalRosterCount = educatorRoster.length;
  const bubbleCount = rosterDemographics.bubbleStudentsCount;
  const metExceededCount = educatorRoster.filter(s => {
    const ov = s.latestOverall || s.latestEla;
    return ov?.performanceLevel && ov.performanceLevel >= 3;
  }).length;
  const metExceededPct = totalRosterCount > 0 ? Math.round((metExceededCount / totalRosterCount) * 100) : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* 1. Navigation & Educator Context Header Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Back Button, Site Logo & Educator Profile */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 transition-all group"
              title="Return to School Executive Overview"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-500 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back to Overview</span>
            </button>

            <div className="h-5 w-px bg-slate-200 hidden sm:block" />

            <img
              src={siteLogo}
              alt="Site Logo"
              className="w-9 h-9 object-contain rounded-xl bg-slate-50 p-1 border border-slate-200 hidden sm:block shrink-0"
              onError={(e) => { e.target.src = DISTRICT_LOGO; }}
            />

            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                  {educatorName || 'Educator Caseload Roster'}
                </span>
                {educatorGrade !== undefined && educatorGrade !== '' && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 font-mono">
                    Grade {educatorGrade === 0 ? 'K' : educatorGrade}
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">
                  {gradeBand === 'Elementary' ? 'Classroom Roster' : 'Counselor Caseload'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                {educatorSchool && <span>{educatorSchool}</span>}
                {educatorEmail && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-slate-400">{educatorEmail}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyAllPlan}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 shadow-xs transition-all"
              title="Copy 4-tier ELD intervention small-group plan to clipboard"
            >
              {copiedAllPlan ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied Full Plan!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Copy ELD Tier Plan</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-white text-slate-700 hover:bg-slate-50 border border-slate-300 shadow-xs transition-all no-print"
              title="Print student roster and intervention tiers"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print</span>
            </button>
          </div>

        </div>

        {/* Quick Snapshot Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="bg-slate-50/80 rounded-xl p-2.5 border border-slate-200/70">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Students</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-black text-slate-900 font-mono">{totalRosterCount}</span>
              <span className="text-[11px] text-slate-500 font-medium">on roster</span>
            </div>
          </div>

          <div className="bg-emerald-50/60 rounded-xl p-2.5 border border-emerald-200/70">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">% Level 3 & 4</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-black text-emerald-700 font-mono">{metExceededPct}%</span>
              <span className="text-[11px] text-emerald-600 font-medium font-mono">({metExceededCount}/{totalRosterCount})</span>
            </div>
          </div>

          <div className="bg-amber-50/60 rounded-xl p-2.5 border border-amber-200/70">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">Bubble Students</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-black text-amber-700 font-mono">{bubbleCount}</span>
              <span className="text-[11px] text-amber-800 font-medium">strategic focus</span>
            </div>
          </div>

          <div className="bg-blue-50/60 rounded-xl p-2.5 border border-blue-200/70">
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">Active ELPAC Domain</span>
            <div className="flex items-center gap-1.5 mt-1 font-bold text-blue-800">
              {activeDomain === 'ALL' ? 'Overall ELPAC (Part 0)' : activeDomain === 'ORAL' ? 'Oral Language (Part 1)' : 'Written Language (Part 2)'}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Main Roster: Tiled Student Cards Grid at the Top */}
      <div className="space-y-4">
        {/* Roster Controls: Domain Switcher & Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-600" />
              <span>Student Roster Cards</span>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                {displayedStudents.length} of {educatorRoster.length}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tiled student profiles featuring ELPAC scale scores, performance levels, demographic badges, and longitudinal trajectories.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Domain Toggle */}
            <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveDomain('ALL')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeDomain === 'ALL'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Overall
              </button>
              <button
                type="button"
                onClick={() => setActiveDomain('ORAL')}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  activeDomain === 'ORAL'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span>Oral</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveDomain('WRITTEN')}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  activeDomain === 'WRITTEN'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <PenTool className="w-3.5 h-3.5 text-blue-600" />
                <span>Written</span>
              </button>
            </div>

            {/* In-Roster Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filter by student name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white w-56 sm:w-64"
              />
            </div>
          </div>
        </div>

        {/* Interactive Cohort Demographics & Support Flags Filter Bar */}
        <div className="bg-white border border-slate-200/80 rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Cohort Demographics & Support Flags:
            </span>
            {activeRosterFlag && (
              <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 animate-fade-in">
                Filtering by: {
                  activeRosterFlag === 'SPED' ? 'SPED (IEP)' :
                  activeRosterFlag === 'EL' ? 'Active EL (LEP)' :
                  activeRosterFlag === '504' ? '504 Plans' :
                  activeRosterFlag === 'HOMELESS_FOSTER' ? 'Homeless / Foster' :
                  'Bubble Students'
                }
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* 1. SPED Pill Button */}
            <button
              type="button"
              onClick={() => handleFlagClick('SPED')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold border transition-all cursor-pointer ${
                activeRosterFlag === 'SPED'
                  ? 'bg-purple-600 text-white border-purple-700 shadow-sm ring-2 ring-purple-400 ring-offset-1'
                  : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 hover:border-purple-300'
              }`}
              title="Click to filter roster by Special Education (IEP)"
            >
              <ShieldAlert className={`w-3.5 h-3.5 ${activeRosterFlag === 'SPED' ? 'text-white' : 'text-purple-600'}`} />
              <span>SPED (IEP): {rosterDemographics.spedCount}</span>
              <span className="text-[10px] opacity-80">
                ({rosterDemographics.spedPct}%)
              </span>
            </button>

            {/* 2. Active EL Pill Button */}
            <button
              type="button"
              onClick={() => handleFlagClick('EL')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold border transition-all cursor-pointer ${
                activeRosterFlag === 'EL'
                  ? 'bg-teal-600 text-white border-teal-700 shadow-sm ring-2 ring-teal-400 ring-offset-1'
                  : 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100 hover:border-teal-300'
              }`}
              title="Click to filter roster by Active English Learners (LEP)"
            >
              <Languages className={`w-3.5 h-3.5 ${activeRosterFlag === 'EL' ? 'text-white' : 'text-teal-600'}`} />
              <span>Active EL (LEP): {rosterDemographics.elCount}</span>
              <span className="text-[10px] opacity-80">
                ({rosterDemographics.elPct}%)
              </span>
            </button>

            {/* 3. 504 Plans Pill Button */}
            <button
              type="button"
              onClick={() => handleFlagClick('504')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold border transition-all cursor-pointer ${
                activeRosterFlag === '504'
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm ring-2 ring-indigo-400 ring-offset-1'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300'
              }`}
              title="Click to filter roster by Section 504 Accommodations"
            >
              <FileText className={`w-3.5 h-3.5 ${activeRosterFlag === '504' ? 'text-white' : 'text-indigo-600'}`} />
              <span>504 Plans: {rosterDemographics.plan504Count}</span>
            </button>

            {/* 4. Homeless / Foster Pill Button */}
            <button
              type="button"
              onClick={() => handleFlagClick('HOMELESS_FOSTER')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold border transition-all cursor-pointer ${
                activeRosterFlag === 'HOMELESS_FOSTER'
                  ? 'bg-rose-600 text-white border-rose-700 shadow-sm ring-2 ring-rose-400 ring-offset-1'
                  : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 hover:border-rose-300'
              }`}
              title="Click to filter roster by Homeless / Foster Youth"
            >
              <Home className={`w-3.5 h-3.5 ${activeRosterFlag === 'HOMELESS_FOSTER' ? 'text-white' : 'text-rose-600'}`} />
              <span>Homeless/Foster: {rosterDemographics.homelessFosterCount}</span>
            </button>

            {/* 5. Bubble Students Pill Button */}
            <button
              type="button"
              onClick={() => handleFlagClick('BUBBLE')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold border transition-all cursor-pointer ${
                activeRosterFlag === 'BUBBLE'
                  ? 'bg-amber-500 text-white border-amber-600 shadow-sm ring-2 ring-amber-400 ring-offset-1'
                  : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 hover:border-amber-400'
              }`}
              title="Click to filter roster by Bubble Students near proficiency / RFEP threshold"
            >
              <Target className={`w-3.5 h-3.5 ${activeRosterFlag === 'BUBBLE' ? 'text-white' : 'text-amber-600'}`} />
              <span>Bubble Students: {rosterDemographics.bubbleStudentsCount}</span>
            </button>

            {/* Clear Filter Action */}
            {activeRosterFlag && (
              <button
                type="button"
                onClick={() => setActiveRosterFlag(null)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition-colors shadow-xs ml-1 cursor-pointer"
                title="Clear demographic filter and show full roster"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                <span>Clear Filter</span>
              </button>
            )}
          </div>
        </div>

        {/* The Tiled Cards Grid */}
        {displayedStudents.length === 0 ? (
          <div className="bg-white border border-slate-200/80 rounded-2xl p-10 text-center">
            <Filter className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-700">No students matched active filter</h4>
            <p className="text-xs text-slate-500 mt-1">
              Try adjusting your search query or clicking "Clear Filter" above.
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveRosterFlag(null);
                setSearchQuery('');
              }}
              className="mt-3 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              Clear Filter
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayedStudents.map((student) => (
              <StudentCard
                key={student.studentId || student.name}
                student={student}
                subjectFocus={activeDomain}
                onClick={() => onStudentClick?.(student)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 3. Tiered Interventions Section at the Bottom */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
        
        {/* Tier Section Accordion Header */}
        <div 
          onClick={() => setIsTiersOpen(!isTiersOpen)}
          className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-slate-50/70 transition-colors border-b border-slate-100 select-none"
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-indigo-100 text-indigo-800 border border-indigo-200">
                Multi-Tiered ELD Support (MTSS)
              </span>
              <span className="text-xs text-slate-400">
                Domain: <strong className="text-slate-700">{activeDomain === 'ALL' ? 'Overall ELPAC' : activeDomain}</strong>
              </span>
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-1 flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-600" />
              <span>Tiered ELD Interventions & Small-Group Builder</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Automatically categorizes students into 4 distinct ELPAC proficiency tiers for Designated & Integrated ELD small-group instruction.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">
              {isTiersOpen ? 'Collapse Tiers' : 'Expand Tiers'}
            </span>
            <div className="p-1 rounded-lg bg-slate-100 text-slate-600">
              {isTiersOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </div>

        {/* 4 Distinct Action Tiers Grid */}
        {isTiersOpen && (
          <div className="p-4 sm:p-5 bg-slate-50/40">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              
              {/* Tier 1: Well Developed (Level 4) */}
              <div className="bg-blue-50/50 border border-blue-200/80 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2.5 border-b border-blue-200/60 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-600 shrink-0" />
                      <h4 className="font-bold text-blue-950 text-xs sm:text-sm">
                        Tier 1: Well Developed (L4)
                      </h4>
                    </div>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                      {tieredGroups[1].students.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-blue-800 mb-3 leading-relaxed">
                    Level 4 Well Developed. Candidates for RFEP reclassification review, Bridging ELD tasks, and academic leadership.
                  </p>

                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {tieredGroups[1].students.map(s => (
                      <div
                        key={s.studentId}
                        onClick={() => onStudentClick?.(s)}
                        className="bg-white p-2.5 rounded-xl border border-blue-200/70 hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between text-xs"
                      >
                        <div className="truncate mr-2">
                          <span className="font-bold text-slate-800 block truncate">{s.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">ID: #{s.studentId} · Gr {s.grade}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-blue-700">{s.activeScore || '—'}</span>
                          <span className="text-[10px] font-semibold block text-slate-400">Scale Score</span>
                        </div>
                      </div>
                    ))}
                    {tieredGroups[1].students.length === 0 && (
                      <div className="py-8 text-center text-xs text-blue-400 italic">
                        No students in Tier 1.
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-blue-200/60 mt-3">
                  <button
                    type="button"
                    onClick={() => handleCopyTierRoster(1)}
                    disabled={tieredGroups[1].students.length === 0}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold bg-white text-blue-700 border border-blue-300 hover:bg-blue-100 disabled:opacity-40 transition-colors"
                  >
                    {copiedTier === 1 ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedTier === 1 ? 'Copied Tier 1!' : 'Copy Tier 1 Roster'}</span>
                  </button>
                </div>
              </div>

              {/* Tier 2: Moderately Developed (Level 3) */}
              <div className="bg-emerald-50/50 border border-emerald-200/80 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2.5 border-b border-emerald-200/60 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                      <h4 className="font-bold text-emerald-950 text-xs sm:text-sm">
                        Tier 2: Moderately (L3)
                      </h4>
                    </div>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                      {tieredGroups[2].students.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 mb-3 leading-relaxed">
                    Level 3 Moderately Developed. Expanding proficiency on track for Level 4 reclassification mastery.
                  </p>

                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {tieredGroups[2].students.map(s => (
                      <div
                        key={s.studentId}
                        onClick={() => onStudentClick?.(s)}
                        className="bg-white p-2.5 rounded-xl border border-emerald-200/70 hover:border-emerald-400 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between text-xs"
                      >
                        <div className="truncate mr-2">
                          <span className="font-bold text-slate-800 block truncate">{s.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">ID: #{s.studentId} · Gr {s.grade}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-emerald-700">{s.activeScore || '—'}</span>
                          <span className="text-[10px] font-semibold block text-slate-400">Scale Score</span>
                        </div>
                      </div>
                    ))}
                    {tieredGroups[2].students.length === 0 && (
                      <div className="py-8 text-center text-xs text-emerald-400 italic">
                        No students in Tier 2.
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-emerald-200/60 mt-3">
                  <button
                    type="button"
                    onClick={() => handleCopyTierRoster(2)}
                    disabled={tieredGroups[2].students.length === 0}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-100 disabled:opacity-40 transition-colors"
                  >
                    {copiedTier === 2 ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedTier === 2 ? 'Copied Tier 2!' : 'Copy Tier 2 Roster'}</span>
                  </button>
                </div>
              </div>

              {/* Tier 3: Strategic / Bubble Students (Level 2) */}
              <div className="bg-amber-50/60 border-2 border-amber-300 rounded-2xl p-4 flex flex-col justify-between relative shadow-xs">
                <div className="absolute -top-3 right-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  <span>Bubble Target</span>
                </div>

                <div>
                  <div className="flex items-center justify-between pb-2.5 border-b border-amber-200/80 mb-2.5 pt-1">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
                      <h4 className="font-bold text-amber-950 text-xs sm:text-sm">
                        Tier 3: Strategic / Bubble
                      </h4>
                    </div>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                      {tieredGroups[3].students.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-900 mb-3 leading-relaxed">
                    Level 2 Somewhat Developed. High-leverage candidates for targeted Designated ELD acceleration to Level 3.
                  </p>

                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {tieredGroups[3].students.map(s => (
                      <div
                        key={s.studentId}
                        onClick={() => onStudentClick?.(s)}
                        className={`p-2.5 rounded-xl border hover:shadow-xs transition-all cursor-pointer flex items-center justify-between text-xs ${
                          s.isBubble 
                            ? 'bg-amber-100/60 border-amber-300 ring-1 ring-amber-300/60' 
                            : 'bg-white border-amber-200/70 hover:border-amber-400'
                        }`}
                      >
                        <div className="truncate mr-2">
                          <div className="flex items-center gap-1">
                            <span className="font-bold text-slate-900 truncate">{s.name}</span>
                            {s.isBubble && (
                              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-amber-200 text-amber-900 shrink-0">
                                Bubble
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">ID: #{s.studentId} · Gr {s.grade}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-amber-800">{s.activeScore || '—'}</span>
                          <span className="text-[10px] font-semibold block text-slate-400">Scale Score</span>
                        </div>
                      </div>
                    ))}
                    {tieredGroups[3].students.length === 0 && (
                      <div className="py-8 text-center text-xs text-amber-400 italic">
                        No students in Tier 3.
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-amber-200/80 mt-3">
                  <button
                    type="button"
                    onClick={() => handleCopyTierRoster(3)}
                    disabled={tieredGroups[3].students.length === 0}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-40 transition-colors shadow-xs"
                  >
                    {copiedTier === 3 ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedTier === 3 ? 'Copied Tier 3!' : 'Copy Bubble Roster'}</span>
                  </button>
                </div>
              </div>

              {/* Tier 4: Intensive Support Needed (Level 1) */}
              <div className="bg-red-50/50 border border-red-200/80 rounded-2xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-2.5 border-b border-red-200/60 mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
                      <h4 className="font-bold text-red-950 text-xs sm:text-sm">
                        Tier 4: Intensive ELD (L1)
                      </h4>
                    </div>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
                      {tieredGroups[4].students.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-red-800 mb-3 leading-relaxed">
                    Level 1 Minimally Developed. Priority for intensive Emerging ELD language acquisition and SST/IEP supports.
                  </p>

                  <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                    {tieredGroups[4].students.map(s => (
                      <div
                        key={s.studentId}
                        onClick={() => onStudentClick?.(s)}
                        className="bg-white p-2.5 rounded-xl border border-red-200/70 hover:border-red-400 hover:shadow-xs transition-all cursor-pointer flex items-center justify-between text-xs"
                      >
                        <div className="truncate mr-2">
                          <span className="font-bold text-slate-800 block truncate">{s.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">ID: #{s.studentId} · Gr {s.grade}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-red-700">{s.activeScore || '—'}</span>
                          <span className="text-[10px] font-semibold block text-slate-400">Scale Score</span>
                        </div>
                      </div>
                    ))}
                    {tieredGroups[4].students.length === 0 && (
                      <div className="py-8 text-center text-xs text-red-400 italic">
                        No students in Tier 4.
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-red-200/60 mt-3">
                  <button
                    type="button"
                    onClick={() => handleCopyTierRoster(4)}
                    disabled={tieredGroups[4].students.length === 0}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold bg-white text-red-700 border border-red-300 hover:bg-red-100 disabled:opacity-40 transition-colors"
                  >
                    {copiedTier === 4 ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedTier === 4 ? 'Copied Tier 4!' : 'Copy Tier 4 Roster'}</span>
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

    </div>
  );
}

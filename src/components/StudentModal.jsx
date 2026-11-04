// src/components/StudentModal.jsx
import React, { useState, useMemo } from 'react';
import { PERFORMANCE_LEVELS, getPartLabel, getSiteLogo, DISTRICT_LOGO } from '../config.js';
import { generateNotebookLMPrompt } from '../utils/elpacData.js';
import { ELD_ACADEMIC_YEARS, ELD_YEAR_LABELS } from '../utils/dataParser.js';
import { 
  X, 
  TrendingUp, 
  Award, 
  Sparkles, 
  Copy, 
  ExternalLink, 
  Check, 
  Target, 
  BookOpen, 
  User, 
  ShieldAlert, 
  FileText,
  Languages, 
  Home,
  Phone,
  Mail,
  MessageSquareQuote,
  Calendar
} from 'lucide-react';

export default function StudentModal({ student, onClose }) {
  const [activeTab, setActiveTab] = useState('trajectory'); // 'trajectory' | 'iep' | 'sst' | 'lesson'
  const [partFilter, setPartFilter] = useState('ALL'); // 'ALL' | 'OVERALL' | 'DOMAINS'
  const [yearFilter, setYearFilter] = useState('ALL'); // 'ALL' | '2024-2025' | '2025-2026' | '2026-2027'
  const [copied, setCopied] = useState(false);

  // Sort full ELPAC / ELD history chronologically (latest academic year & test window first)
  const sortedElpacHistory = useMemo(() => {
    if (!student) return [];
    const raw = Array.isArray(student.elpacHistory) ? student.elpacHistory : [];
    let filtered = raw;

    if (partFilter === 'OVERALL') {
      filtered = filtered.filter(r => Number(r.part ?? 0) === 0);
    } else if (partFilter === 'DOMAINS') {
      filtered = filtered.filter(r => Number(r.part ?? 0) >= 1 && Number(r.part ?? 0) <= 6);
    }

    if (yearFilter !== 'ALL') {
      filtered = filtered.filter(r => r.academicYear === yearFilter);
    }

    return [...filtered].sort((a, b) => {
      if ((b.sortKey || 0) !== (a.sortKey || 0)) return (b.sortKey || 0) - (a.sortKey || 0);
      if ((b.year || 0) !== (a.year || 0)) return (b.year || 0) - (a.year || 0);
      return (a.part ?? 0) - (b.part ?? 0);
    });
  }, [student, partFilter, yearFilter]);

  const filteredComments = useMemo(() => {
    if (!student) return [];
    const comments = Array.isArray(student.teacherComments) ? student.teacherComments : [];
    if (yearFilter === 'ALL') return comments;
    return comments.filter(c => c.academicYear === yearFilter);
  }, [student, yearFilter]);

  if (!student) return null;

  const siteLogo = getSiteLogo(student.school);
  const latestOverall = student.latestOverall || student.latestEla;
  const latestOral = student.latestOral || student.latestMath;
  const latestWritten = student.latestWritten;
  const overallDelta = student.overallDelta ?? student.elaDelta;
  const eldByYear = student.eldByYear || {};

  const currentPrompt = activeTab === 'iep' 
    ? generateNotebookLMPrompt(student, 'IEP') 
    : activeTab === 'sst' 
    ? generateNotebookLMPrompt(student, 'SST') 
    : generateNotebookLMPrompt(student, 'LESSON');

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(currentPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLevelBadge = (level, rawLevel = '') => {
    if (!level || !PERFORMANCE_LEVELS[level]) {
      return (
        <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-500 rounded border">
          {rawLevel || 'N/A'}
        </span>
      );
    }
    const conf = PERFORMANCE_LEVELS[level];
    return (
      <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${conf.badgeClass}`}>
        L{conf.level} · {conf.label}
      </span>
    );
  };

  const renderIntervalCard = (intervalRec, windowLabel, fallbackComment = null) => {
    const level = intervalRec?.performanceLevel;
    const score = intervalRec?.scaledScore;
    const dateTaken = intervalRec?.dateTaken;
    const comment = intervalRec?.teacherComment || fallbackComment;
    const conf = level ? PERFORMANCE_LEVELS[level] : null;
    const isFall = windowLabel === 'Fall';

    return (
      <div
        className={`rounded-xl p-3 border transition-all flex flex-col justify-between ${
          level || score
            ? 'bg-white border-slate-200/90 shadow-2xs'
            : 'bg-slate-50/70 border-slate-200/60 border-dashed'
        }`}
      >
        <div>
          <div className="flex items-center justify-between gap-1.5 mb-2">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider border ${
                isFall
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}
            >
              <Calendar className="w-2.5 h-2.5" />
              <span>{windowLabel} Window</span>
            </span>
            {dateTaken && (
              <span className="text-[10px] font-mono text-slate-400">
                {dateTaken}
              </span>
            )}
          </div>

          {level || score ? (
            <div className="flex items-baseline justify-between gap-2 my-1">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Proficiency Level
                </span>
                <div className="mt-0.5">
                  {conf ? (
                    <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded border ${conf.badgeClass}`}>
                      Level {conf.level} · {conf.label}
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-slate-700">
                      {intervalRec?.rawLevel || 'Assessed'}
                    </span>
                  )}
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                  Scale Score
                </span>
                <span className="text-base font-black text-slate-900 font-mono">
                  {score ?? '—'}
                </span>
              </div>
            </div>
          ) : (
            <div className="py-2 text-xs text-slate-400 italic">
              No {windowLabel} assessment score recorded
            </div>
          )}
        </div>

        {comment && (
          <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600 flex items-start gap-1.5">
            <MessageSquareQuote className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
            <p className="italic leading-snug text-slate-600">
              "{comment}"
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 sm:p-6 shrink-0 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
            title="Close modal (Esc)"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-wrap items-start justify-between gap-4 pr-10">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-white p-1.5 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                <img
                  src={siteLogo}
                  alt={student.school}
                  className="max-h-full max-w-full object-contain"
                  onError={(e) => { e.target.src = DISTRICT_LOGO; }}
                />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    Grade {student.grade === 0 ? 'K' : student.grade}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    ID: #{student.studentId}
                  </span>
                  <span className="text-xs text-slate-400">•</span>
                  <span className="text-xs text-slate-300 font-medium">
                    {student.school}
                  </span>
                  {student.race && (
                    <>
                      <span className="text-xs text-slate-500">•</span>
                      <span className="text-xs text-slate-300">{student.race}</span>
                    </>
                  )}
                </div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1">
                  {student.name}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-slate-300">
                  <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
                    <User className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-slate-400">{student.staffLabel || 'Staff'}:</span>
                    <span className="font-semibold text-white">{student.staffName || 'Unassigned'}</span>
                  </div>
                  {student.parentEmail && (
                    <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono text-[11px] text-slate-300">{student.parentEmail}</span>
                    </div>
                  )}
                  {student.parentPhone && (
                    <div className="flex items-center gap-1.5 bg-slate-800/80 px-2.5 py-1 rounded-md border border-slate-700">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-mono text-[11px] text-slate-300">{student.parentPhone}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Demographic Indicators */}
            <div className="flex flex-wrap items-center gap-2 self-center sm:self-auto">
              {student.flags?.sped && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Special Education (IEP)
                </span>
              )}
              {student.flags?.plan504 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  <FileText className="w-3.5 h-3.5" />
                  504 Plan
                </span>
              )}
              {student.flags?.elStatus && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md bg-teal-500/20 text-teal-300 border border-teal-500/40">
                  <Languages className="w-3.5 h-3.5" />
                  {student.flags.elStatus === 'LEP' ? 'Active EL (LEP)' : student.flags.elStatus}
                </span>
              )}
              {student.flags?.homelessFoster && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  <Home className="w-3.5 h-3.5" />
                  Foster / Homeless
                </span>
              )}
            </div>
          </div>

          {/* Quick Metrics Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800 text-xs">
            <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
              <span className="text-slate-400 block text-[11px]">Latest Overall ELPAC (Part 0)</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-base font-bold text-white font-mono">
                  {latestOverall?.scaledScore || '—'}
                </span>
                {latestOverall?.performanceLevel && (
                  <span className="text-[11px] font-semibold text-emerald-400">
                    Level {latestOverall.performanceLevel}
                  </span>
                )}
              </div>
            </div>

            <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
              <span className="text-slate-400 block text-[11px]">Overall YoY Growth Delta</span>
              <div className="flex items-center gap-1 mt-0.5 font-bold font-mono text-sm">
                {overallDelta !== null && overallDelta !== undefined ? (
                  <span className={overallDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                    {overallDelta >= 0 ? `+${overallDelta}` : overallDelta} pts
                  </span>
                ) : (
                  <span className="text-slate-500">—</span>
                )}
              </div>
            </div>

            <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
              <span className="text-slate-400 block text-[11px]">Latest Oral Language (Part 1)</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-base font-bold text-white font-mono">
                  {latestOral?.scaledScore || '—'}
                </span>
                {latestOral?.performanceLevel && (
                  <span className="text-[11px] font-semibold text-blue-400">
                    Level {latestOral.performanceLevel}
                  </span>
                )}
              </div>
            </div>

            <div className="bg-slate-800/60 p-2.5 rounded-lg border border-slate-700/60">
              <span className="text-slate-400 block text-[11px]">Latest Written Language (Part 2)</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-base font-bold text-white font-mono">
                  {latestWritten?.scaledScore || '—'}
                </span>
                {latestWritten?.performanceLevel && (
                  <span className="text-[11px] font-semibold text-indigo-400">
                    Level {latestWritten.performanceLevel}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-slate-100 px-6 py-2.5 border-b border-slate-200 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab('trajectory')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'trajectory'
                ? 'bg-white text-blue-700 shadow-sm border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Multi-Year ELD & Longitudinal History
          </button>

          <span className="text-slate-300">|</span>

          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1">
            AI NotebookLM Architect:
          </span>

          <button
            onClick={() => setActiveTab('iep')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'iep'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200/60'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-300" />
            IEP / 504 ELD Assistant
          </button>

          <button
            onClick={() => setActiveTab('sst')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'sst'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/60'
            }`}
          >
            <Target className="w-3.5 h-3.5 text-amber-500" />
            SST Intervention Architect
          </button>

          <button
            onClick={() => setActiveTab('lesson')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeTab === 'lesson'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
            Tiered ELD Lesson Architect
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'trajectory' ? (
            <div className="space-y-6">
              
              {/* 1. Multi-Year ELD Progression Matrix (24-25 ELD, 25-26 ELD, 26-27 ELD: Fall vs. Spring) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                      <h3 className="text-sm font-bold text-slate-900">
                        Multi-Year ELD Progression Matrix (2024–2025 through 2026–2027)
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Side-by-side Fall vs. Spring ELD monitoring checkpoints across <strong>24-25 ELD</strong>, <strong>25-26 ELD</strong>, and <strong>26-27 ELD</strong>.
                    </p>
                  </div>

                  {/* Year Filter Pills */}
                  <div className="inline-flex rounded-lg p-0.5 bg-slate-200/80 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setYearFilter('ALL')}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        yearFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All Years ('24–'27)
                    </button>
                    {ELD_ACADEMIC_YEARS.map(yrKey => (
                      <button
                        key={yrKey}
                        type="button"
                        onClick={() => setYearFilter(yrKey)}
                        className={`px-2.5 py-1 rounded-md transition-all ${
                          yearFilter === yrKey ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {ELD_YEAR_LABELS[yrKey].tab}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {ELD_ACADEMIC_YEARS.filter(yrKey => yearFilter === 'ALL' || yearFilter === yrKey).map(yrKey => {
                    const yrMeta = ELD_YEAR_LABELS[yrKey];
                    const yrSlot = eldByYear[yrKey] || {};
                    const fallScore = yrSlot.fall?.scaledScore;
                    const springScore = yrSlot.spring?.scaledScore;
                    const withinYearDelta =
                      fallScore && springScore ? springScore - fallScore : null;

                    return (
                      <div
                        key={yrKey}
                        className="bg-white/90 border border-slate-200/90 rounded-xl p-3.5 shadow-2xs space-y-3"
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                          <div>
                            <span className="px-2 py-0.5 rounded-md text-xs font-extrabold bg-indigo-50 text-indigo-800 border border-indigo-200 font-mono">
                              {yrMeta.tab}
                            </span>
                            <span className="text-[11px] text-slate-500 ml-2 font-medium">
                              ({yrMeta.full})
                            </span>
                          </div>
                          {withinYearDelta !== null && (
                            <span
                              className={`px-2 py-0.5 rounded-full text-[11px] font-bold font-mono border ${
                                withinYearDelta >= 0
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}
                              title="Fall-to-Spring Scale Score Change"
                            >
                              F→S: {withinYearDelta >= 0 ? `+${withinYearDelta}` : withinYearDelta} pts
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
                          {renderIntervalCard(yrSlot.fall, 'Fall', yrSlot.fallComment)}
                          {renderIntervalCard(yrSlot.spring, 'Spring', yrSlot.springComment)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Dedicated Teacher Comments Section Mapped to Test Windows & Academic Years */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <MessageSquareQuote className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      Teacher Comments & Qualitative ELD Observations
                    </h3>
                    <span className="text-xs text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                      {filteredComments.length} {filteredComments.length === 1 ? 'Comment' : 'Comments'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Mapped to corresponding ELD test windows & academic years (2024–2027)
                  </span>
                </div>

                {filteredComments.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400 italic">
                    No qualitative teacher comments recorded for the selected academic year filter.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredComments.map((item, idx) => {
                      const isFall = item.testWindow === 'Fall';
                      return (
                        <div
                          key={`${item.academicYear}-${item.testWindow}-${idx}`}
                          className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-2xs flex flex-col justify-between gap-2 hover:border-blue-300 transition-colors"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded text-[11px] font-extrabold bg-slate-900 text-white font-mono">
                                {item.tabLabel || `${item.shortYear} ELD`}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                                  isFall
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                }`}
                              >
                                {item.testWindow} Window
                              </span>
                              {item.dateTaken && (
                                <span className="text-[10px] font-mono text-slate-400">
                                  ({item.dateTaken})
                                </span>
                              )}
                            </div>

                            {(item.performanceLevel || item.scaledScore) && (
                              <div className="flex items-center gap-1.5 font-mono text-xs">
                                {item.scaledScore && (
                                  <span className="font-bold text-slate-700">
                                    SS {item.scaledScore}
                                  </span>
                                )}
                                {item.performanceLevel && getLevelBadge(item.performanceLevel)}
                              </div>
                            )}
                          </div>

                          <p className="text-xs text-slate-700 leading-relaxed bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
                            "{item.comment}"
                          </p>

                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span>{student.staffLabel || 'Educator'}: {student.staffName || 'WVUSD Staff'}</span>
                            <span className="font-mono">{item.academicYear}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3. Historical ELPAC Test Performance Table */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                    <h3 className="text-sm font-bold text-slate-800">
                      Complete California ELPAC & ELD Historical Test Records
                    </h3>
                    <span className="text-xs text-slate-500 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                      {sortedElpacHistory.length} Records
                    </span>
                  </div>

                  {/* Part Filter Toggle */}
                  <div className="inline-flex rounded-lg p-0.5 bg-slate-200/80 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setPartFilter('ALL')}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        partFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All Parts (0–6)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPartFilter('OVERALL')}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        partFilter === 'OVERALL' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Overall (Part 0)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPartFilter('DOMAINS')}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        partFilter === 'DOMAINS' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Sub-Domains (Parts 1–6)
                    </button>
                  </div>
                </div>

                {sortedElpacHistory.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 italic">
                    No historical ELPAC test administrations recorded for this filter.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="pb-2.5 pr-3 font-semibold">Academic Year & Window</th>
                          <th className="pb-2.5 px-3 font-semibold">Date Taken</th>
                          <th className="pb-2.5 px-3 font-semibold">Grade</th>
                          <th className="pb-2.5 px-3 font-semibold">Test ID</th>
                          <th className="pb-2.5 px-3 font-semibold">Part (0–6)</th>
                          <th className="pb-2.5 px-3 font-semibold">Scaled Score</th>
                          <th className="pb-2.5 pl-3 font-semibold">Performance Level</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 font-mono">
                        {sortedElpacHistory.map((rec, i) => {
                          const partInfo = getPartLabel(rec.part);
                          const isOverall = Number(rec.part ?? 0) === 0;
                          const isFall = rec.testWindow === 'Fall';
                          return (
                            <tr
                              key={i}
                              className={`transition-colors ${
                                isOverall ? 'bg-white/90 hover:bg-blue-50/40' : 'hover:bg-white/60'
                              }`}
                            >
                              <td className="py-2.5 pr-3 font-sans">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-slate-800">
                                    {rec.tabLabel || rec.academicYear || rec.year || '—'}
                                  </span>
                                  {rec.testWindow && (
                                    <span
                                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase border ${
                                        isFall
                                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                      }`}
                                    >
                                      {rec.testWindow}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                                {rec.dateTaken || '—'}
                              </td>
                              <td className="py-2.5 px-3 font-sans font-semibold text-slate-700">
                                Gr {rec.testGrade === 0 ? 'K' : (rec.testGrade ?? student.grade)}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold">
                                  {rec.testId || 'ELPAC'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-sans">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
                                  isOverall
                                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}>
                                  <span className="font-mono font-bold">Part {rec.part ?? 0}</span>
                                  <span>·</span>
                                  <span>{partInfo.label.replace(/\s*\(Part \d+\)/, '')}</span>
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-900 text-sm">
                                {rec.scaledScore ?? '—'}
                              </td>
                              <td className="py-2.5 pl-3 font-sans">
                                {getLevelBadge(rec.performanceLevel, rec.rawLevel)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Longitudinal Insights Callout */}
              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                <Award className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-700 leading-relaxed">
                  <h4 className="font-bold text-blue-900 text-sm mb-1">
                    Longitudinal ELPAC & RFEP Reclassification Assessment
                  </h4>
                  <p>
                    {overallDelta !== null && overallDelta > 0 
                      ? `Student has demonstrated positive Year-over-Year acceleration on the Overall ELPAC (+${overallDelta} scale score points). `
                      : overallDelta !== null && overallDelta < 0
                      ? `Student showed a ${overallDelta} scale score point shift on the Overall ELPAC. Targeted Designated ELD support is recommended. `
                      : ''}
                    {latestOverall?.performanceLevel === 4
                      ? 'With an Overall Performance Level 4 (Well Developed), this student meets the state ELPAC criterion for RFEP reclassification review.'
                      : latestOverall?.performanceLevel === 3
                      ? 'At Overall Performance Level 3 (Moderately Developed), this student is in the Expanding band and is a strong candidate for targeted acceleration toward Level 4 RFEP reclassification.'
                      : 'Use the AI NotebookLM tabs above to generate calibrated IEP/504 ELD accommodations, SST intervention plans, and tiered lesson scaffolds.'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* AI Workflow / NotebookLM Prompt Generator */
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    {activeTab === 'iep' && 'California ELPAC & IEP / 504 ELD Accommodations Assistant'}
                    {activeTab === 'sst' && 'Student Study Team (SST) & ELD Intervention Architect'}
                    {activeTab === 'lesson' && 'Integrated & Designated ELD Lesson Differentiation Architect'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Formatted with live student ELPAC scale scores, Multi-Year Fall/Spring ELD progression, Teacher Comments, and California ELD standards for Google NotebookLM.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyPrompt}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 shadow-sm transition-all"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700 font-bold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-slate-500" />
                        <span>Copy Prompt</span>
                      </>
                    )}
                  </button>

                  <a
                    href="https://notebooklm.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all"
                  >
                    <span>Launch NotebookLM</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>

              {/* Code / Markdown Display */}
              <div className="relative bg-slate-950 text-slate-100 p-4 rounded-xl border border-slate-800 font-mono text-xs leading-relaxed max-h-96 overflow-y-auto whitespace-pre-wrap selection:bg-blue-600 selection:text-white">
                {currentPrompt}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>Walnut Valley Unified School District • Official California ELPAC & Multi-Year ELD Record</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

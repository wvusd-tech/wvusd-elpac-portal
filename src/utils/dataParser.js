// src/utils/dataParser.js
// Dynamic Multi-Year ELD & ELPAC Column Parser for WVUSD ELPAC Portal
// Intelligently inspects column headers across 2024–2025, 2025–2026, and 2026–2027
// (24-25 ELD, 25-26 ELD, 26-27 ELD) including Fall & Spring test intervals and Teacher Comments.

import { normalizePerformanceLevel, getPartLabel } from '../config.js';

export const ELD_ACADEMIC_YEARS = ['2024-2025', '2025-2026', '2026-2027'];

export const ELD_YEAR_LABELS = {
  '2024-2025': { short: '24-25', tab: '24-25 ELD', full: '2024–2025', numericYear: 2025 },
  '2025-2026': { short: '25-26', tab: '25-26 ELD', full: '2025–2026', numericYear: 2026 },
  '2026-2027': { short: '26-27', tab: '26-27 ELD', full: '2026–2027', numericYear: 2027 }
};

/**
 * Normalizes any year token or tab name into a canonical academic year string ('2024-2025', '2025-2026', '2026-2027').
 */
export function detectAcademicYear(text = '', fallbackText = '') {
  const combined = `${text || ''} ${fallbackText || ''}`.trim();
  if (!combined) return null;

  // Match 4-digit academic year range e.g. 2024-2025, 2024/2025, 2024–2025, 2024-25
  const fullRange = combined.match(/\b(202[3-8])\s*[-–/]\s*(?:20)?(2[4-9])\b/);
  if (fullRange) {
    const startYr = parseInt(fullRange[1], 10);
    const endYrShort = parseInt(fullRange[2], 10);
    const endYr = endYrShort < 100 ? 2000 + endYrShort : endYrShort;
    return `${startYr}-${endYr}`;
  }

  // Match 2-digit academic year range e.g. 24-25, 25-26, 26-27, '24-'25, 24/25
  const shortRange = combined.match(/(?:^|[^0-9])'?(\d{2})\s*[-–/]\s*'?(\d{2})(?:[^0-9]|$)/);
  if (shortRange) {
    const y1 = parseInt(shortRange[1], 10);
    const y2 = parseInt(shortRange[2], 10);
    if (y1 >= 20 && y1 <= 30 && y2 === y1 + 1) {
      return `20${y1}-20${y2}`;
    }
  }

  // Match standalone 4-digit year e.g. Fall 2024 -> 2024-2025, Spring 2025 -> 2024-2025
  const singleYearMatch = combined.match(/\b(202[4-7])\b/);
  if (singleYearMatch) {
    const yr = parseInt(singleYearMatch[1], 10);
    const isFall = /\bfall\b|\bboy\b|\bsem(?:ester)?\s*1\b|\btri(?:mester)?\s*1\b|\bq1\b|\baug|\bsep|\boct|\bnov|\bdec/i.test(combined);
    if (isFall) {
      return `${yr}-${yr + 1}`;
    }
    return `${yr - 1}-${yr}`;
  }

  return null;
}

/**
 * Extracts testing interval (Fall vs. Spring) from header text, cell value, or date string.
 * Returns: { window: 'Fall' | 'Spring' | 'Annual', windowOrder: 1 | 2 | 3 }
 */
export function detectTestWindow(headerText = '', dateOrValText = '') {
  const h = String(headerText || '').trim();
  const d = String(dateOrValText || '').trim();
  const combined = `${h} ${d}`;

  if (/\bfall\b|\bboy\b|\bbeginning\b|\bsem(?:ester)?\s*1\b|\bs1\b|\btri(?:mester)?\s*1\b|\bt1\b|\bquarter\s*1\b|\bq1\b|\binitial\b|\bbaseline\b/i.test(h)) {
    return { window: 'Fall', windowOrder: 1 };
  }
  if (/\bspring\b|\beoy\b|\bend\s*of\s*year\b|\bsem(?:ester)?\s*2\b|\bs2\b|\btri(?:mester)?\s*[23]\b|\bt[23]\b|\bquarter\s*[34]\b|\bq[34]\b|\bsummative\b|\bfinal\b/i.test(h)) {
    return { window: 'Spring', windowOrder: 2 };
  }

  // Check date month if a date is present (Months 7..12 -> Fall, Months 1..6 -> Spring)
  const dateMatch = combined.match(/\b(\d{1,2})[/-]\d{1,2}[/-](?:\d{2}|\d{4})\b/);
  if (dateMatch) {
    const month = parseInt(dateMatch[1], 10);
    if (month >= 8 && month <= 12) return { window: 'Fall', windowOrder: 1 };
    if (month >= 1 && month <= 7) return { window: 'Spring', windowOrder: 2 };
  }

  if (/\b(?:aug|sep|oct|nov|dec)[a-z]*\b/i.test(combined)) {
    return { window: 'Fall', windowOrder: 1 };
  }
  if (/\b(?:jan|feb|mar|apr|may|jun)[a-z]*\b/i.test(combined)) {
    return { window: 'Spring', windowOrder: 2 };
  }

  return { window: null, windowOrder: 3 };
}

/**
 * Extracts ELPAC/ELD Domain / Part (0 = Overall, 1 = Oral, 2 = Written, 3 = Listening, 4 = Speaking, 5 = Reading, 6 = Writing)
 */
export function detectDomainPart(headerText = '') {
  const h = String(headerText || '').toLowerCase();
  const explicitPart = h.match(/\bpart\s*([0-6])\b/);
  if (explicitPart) return parseInt(explicitPart[1], 10);

  if (/\blistening\b/.test(h)) return 3;
  if (/\bspeaking\b/.test(h)) return 4;
  if (/\breading\b/.test(h)) return 5;
  if (/\bwriting\b/.test(h)) return 6;
  if (/\boral\b/.test(h)) return 1;
  if (/\bwritten\b/.test(h)) return 2;
  return 0; // Default Overall ELD / ELPAC
}

/**
 * Classifies a column header dynamically so extraneous columns are ignored and only valid
 * Student IDs, demographics, test scores/levels, dates, test windows, and teacher comments are extracted.
 */
export function classifyColumnHeader(rawHeader = '', tabContext = '') {
  const header = String(rawHeader ?? '').trim();
  if (!header) return { type: 'IGNORE', header: '' };

  const lower = header.toLowerCase();

  // 1. Ignore extraneous metadata / system / timestamp / blank filler columns
  if (
    /^col(?:umn)?\s*[a-z0-9]+$/i.test(header) ||
    /^unnamed/i.test(header) ||
    /\b(?:timestamp|last\s*updated|modified|row\s*id|guid|uuid|sis\s*id|state\s*id|lunch|meal|bus|locker|period|course\s*id|section\s*id|attendance|absences|tardies)\b/i.test(lower)
  ) {
    return { type: 'IGNORE', header };
  }

  const academicYear = detectAcademicYear(header, tabContext);
  const { window: testWindow, windowOrder } = detectTestWindow(header);
  const part = detectDomainPart(header);

  // 2. Identity & Roster Demographic columns
  if (/^(?:student\s*id|id|local\s*id|stu\s*id|perm\s*id)$/i.test(lower) || /\bstudent\s*id\b/i.test(lower)) {
    return { type: 'STUDENT_ID', header };
  }
  if (/^(?:last\s*name|surname|student\s*last)$/i.test(lower)) {
    return { type: 'LAST_NAME', header };
  }
  if (/^(?:first\s*name|given\s*name|student\s*first)$/i.test(lower)) {
    return { type: 'FIRST_NAME', header };
  }
  if (/^(?:full\s*name|student\s*name|name|student)$/i.test(lower)) {
    return { type: 'FULL_NAME', header };
  }
  if (/^(?:test\s*grade|assessed\s*grade)$/i.test(lower)) {
    return { type: 'TEST_GRADE', header, academicYear, testWindow };
  }
  if (/^(?:grade|grade\s*level|gr|curr(?:ent)?\s*grade)$/i.test(lower)) {
    return { type: 'GRADE', header };
  }
  if (/^(?:gender|sex)$/i.test(lower)) {
    return { type: 'GENDER', header };
  }
  if (/^ethnicity$/i.test(lower)) {
    return { type: 'ETHNICITY', header };
  }
  if (/^race$/i.test(lower)) {
    return { type: 'RACE', header };
  }
  if (/\bparent\s*email\b|\bguardian\s*email\b/i.test(lower)) {
    return { type: 'PARENT_EMAIL', header };
  }
  if (/\bparent\s*phone\b|\bhome\s*phone\b|\bcontact\s*phone\b|\bphone\b/i.test(lower)) {
    return { type: 'PARENT_PHONE', header };
  }
  if (/\bparent\s*name\b|\bparent\/guardian\b|\bguardian\s*name\b/i.test(lower)) {
    return { type: 'PARENT_NAME', header };
  }
  if (/^school\s*code$|^site\s*code$/i.test(lower)) {
    return { type: 'SCHOOL_CODE', header };
  }
  if (/^(?:school|school\s*name|school\s*site)$/i.test(lower)) {
    return { type: 'SCHOOL_NAME', header };
  }
  if (/^(?:site\s*name|routing\s*site)$/i.test(lower)) {
    return { type: 'SITE_ROUTING', header };
  }
  if (/\badmin\s*access\b|\bsite\s*admin/i.test(lower)) {
    return { type: 'SITE_ADMIN_EMAILS', header };
  }
  if (/\bsuper\s*admin\b/i.test(lower)) {
    return { type: 'SUPER_ADMIN_EMAILS', header };
  }
  if (/\b(?:teacher|counselor|staff)\s*email\b/i.test(lower)) {
    return { type: 'STAFF_EMAIL', header };
  }
  if (/^(?:teacher|teacher\s*name|counselor|counselor\s*name|homeroom\s*teacher|eld\s*teacher|staff\s*name)$/i.test(lower)) {
    return { type: 'STAFF_NAME', header };
  }
  if (/^(?:sped|special\s*ed(?:ucation)?|iep)$/i.test(lower)) {
    return { type: 'SPED', header };
  }
  if (/^(?:504|504\s*plan|section\s*504|504\s*accommodations)$/i.test(lower)) {
    return { type: 'PLAN_504', header };
  }
  if (/^(?:el\s*status|english\s*proficiency|language\s*fluency|el\s*proficiency|lep\s*status)$/i.test(lower)) {
    return { type: 'EL_STATUS', header };
  }
  if (/\b(?:homeless|foster)\b/i.test(lower)) {
    return { type: 'HOMELESS_FOSTER', header };
  }

  // 3. Teacher Comment / Qualitative Observation columns
  if (
    /\b(?:comment|comments|note|notes|observation|observations|feedback|narrative|qualitative|rationale|teacher\s*input|counselor\s*note|eld\s*note)\b/i.test(lower)
  ) {
    return {
      type: 'TEACHER_COMMENT',
      header,
      academicYear,
      testWindow,
      windowOrder
    };
  }

  // 4. Long-format row columns (TestID, Part, Date Taken, Scaled Score, Performance Level)
  if (/^(?:test\s*id|assessment\s*id|test\s*name)$/i.test(lower)) {
    return { type: 'ROW_TEST_ID', header };
  }
  if (/^(?:part|domain\s*part|subtest\s*part)$/i.test(lower)) {
    return { type: 'ROW_PART', header };
  }
  if (/^(?:test\s*window|window|interval|term|semester|trimester|season|administration\s*window)$/i.test(lower)) {
    return { type: 'ROW_WINDOW', header, academicYear };
  }
  if (/^(?:academic\s*year|school\s*year|test\s*year|year)$/i.test(lower)) {
    return { type: 'ROW_YEAR', header };
  }
  if (/\b(?:date\s*taken|test\s*date|administration\s*date|date\s*tested|assessment\s*date|date)\b/i.test(lower)) {
    if (academicYear || testWindow) {
      return {
        type: 'ELD_DATE',
        header,
        academicYear,
        testWindow,
        windowOrder
      };
    }
    return { type: 'ROW_DATE', header };
  }

  // 5. Multi-Year ELD / ELPAC Score & Proficiency Level columns (wide or row-based)
  const hasScoreKeyword = /\b(?:score|scaled\s*score|ss|scale\s*score|level|proficiency|perf(?:ormance)?\s*level|eld|elpac|overall|oral|written|listening|speaking|reading|writing|fall|spring|rubric|benchmark)\b/i.test(lower);

  if (hasScoreKeyword || academicYear) {
    const isExplicitScaleScore = /\b(?:scaled?\s*score|ss)\b/i.test(lower);
    const isExplicitLevel = /\b(?:level|proficiency|pl|tier)\b/i.test(lower) && !isExplicitScaleScore;

    if (!academicYear && !testWindow && /^(?:scaled\s*score|scale\s*score|score)$/i.test(lower)) {
      return { type: 'ROW_SCALED_SCORE', header };
    }
    if (!academicYear && !testWindow && /^(?:performance\s*level|proficiency\s*level|level|overall\s*level)$/i.test(lower)) {
      return { type: 'ROW_PERF_LEVEL', header };
    }

    return {
      type: isExplicitScaleScore ? 'ELD_SCALED_SCORE' : isExplicitLevel ? 'ELD_LEVEL' : 'ELD_SCORE_OR_LEVEL',
      header,
      academicYear,
      testWindow,
      windowOrder,
      part
    };
  }

  return { type: 'IGNORE', header };
}

/**
 * Extracts a clean proficiency level (1–4), scaled score (1100–1900), and optional inline date/comment
 * from a cell value such as:
 *   - "Level 3" / "L3" / "3" / "Level 2 (1485)" / "1524 (Level 3)" / "1510" / "Moderately Developed"
 * Returns null if the cell does not contain a valid test score or level.
 */
export function parseEldScoreOrLevelCell(rawVal, grade = 5) {
  if (rawVal === null || rawVal === undefined) return null;
  const str = String(rawVal).trim();
  if (!str) return null;

  // Reject boolean/flag/empty markers
  if (/^(?:n\/a|na|none|null|undefined|-|--|—|tbd|pending|exempt|abs|absent|true|false|yes|no|y|n)$/i.test(str)) {
    return null;
  }

  let scaledScore = null;
  let performanceLevel = null;
  let dateTaken = null;

  // Check if there is an inline date e.g. "Level 3 (10/15/2025)"
  const inlineDateMatch = str.match(/\b(\d{1,2}[/-]\d{1,2}[/-](?:\d{2}|\d{4}))\b/);
  if (inlineDateMatch) {
    dateTaken = inlineDateMatch[1];
  }

  const strWithoutDate = dateTaken ? str.replace(dateTaken, ' ') : str;

  // 1. Check for 4-digit ELPAC scale score (1100–1900)
  const scaleMatch = strWithoutDate.match(/\b(1[1-8]\d{2})\b/);
  if (scaleMatch) {
    scaledScore = parseInt(scaleMatch[1], 10);
  }

  // 2. Check for explicit "Level 1..4" or "L1..L4"
  const explicitLvlMatch =
    strWithoutDate.match(/\blevel\s*([1-4])\b/i) ||
    strWithoutDate.match(/\blvl\s*([1-4])\b/i) ||
    strWithoutDate.match(/\b(?:pl|l)\s*([1-4])\b/i);

  if (explicitLvlMatch) {
    performanceLevel = parseInt(explicitLvlMatch[1], 10);
  } else if (/^[1-4](?:\.\d+)?$/.test(strWithoutDate.trim())) {
    // Standalone 1..4 proficiency level
    performanceLevel = Math.min(4, Math.max(1, Math.round(parseFloat(strWithoutDate.trim()))));
  } else {
    // Check descriptive California ELD / ELPAC terms
    const lower = strWithoutDate.toLowerCase();
    if (/\b(?:well\s*developed|bridging|ifep|rfep|fluent|exceeded|advanced)\b/.test(lower)) {
      performanceLevel = 4;
    } else if (/\b(?:moderately\s*developed|expanding|intermediate|proficient)\b/.test(lower)) {
      performanceLevel = 3;
    } else if (/\b(?:somewhat\s*developed|early\s*intermediate|developing|approaching)\b/.test(lower)) {
      performanceLevel = 2;
    } else if (/\b(?:minimally\s*developed|emerging|beginning|novice)\b/.test(lower)) {
      performanceLevel = 1;
    }
  }

  // Derive performanceLevel from scaledScore if only scaledScore was provided
  if (performanceLevel === null && scaledScore !== null) {
    performanceLevel = normalizePerformanceLevel(null, scaledScore, grade);
  }

  if (performanceLevel === null && scaledScore === null) {
    return null;
  }

  const rawLevel = performanceLevel ? `Level ${performanceLevel}` : str;

  return {
    scaledScore,
    performanceLevel,
    rawLevel,
    rawText: str,
    dateTaken
  };
}

/**
 * Validates and cleans a qualitative teacher comment cell.
 */
export function parseTeacherCommentCell(rawVal) {
  if (rawVal === null || rawVal === undefined) return null;
  const text = String(rawVal).trim();
  if (!text) return null;
  if (/^(?:n\/a|na|none|null|-|--|—|no\s*comment|no\s*notes?)$/i.test(text)) {
    return null;
  }
  // Ignore pure numbers that accidentally landed in a comment column
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    return null;
  }
  return text;
}

/**
 * Builds a structured header map from the first row of any sheet tab.
 * Falls back gracefully ONLY when the sheet has no header row at all.
 */
export function analyzeSheetHeaders(headerRow = [], tabName = '', isRosterFallback = false) {
  const columns = [];
  const hasHeaderKeywords = headerRow.some(cell =>
    /\b(?:id|student|name|grade|level|score|eld|elpac|fall|spring|comment|teacher|school|part|date)\b/i.test(String(cell || ''))
  );

  if (hasHeaderKeywords) {
    headerRow.forEach((cell, idx) => {
      const info = classifyColumnHeader(cell, tabName);
      columns.push({ ...info, index: idx });
    });
    return { hasHeaderRow: true, columns };
  }

  // Fallback ONLY for headerless legacy CSV exports
  if (isRosterFallback) {
    const legacyRosterTypes = [
      'STUDENT_ID', 'LAST_NAME', 'FIRST_NAME', 'FULL_NAME', 'GRADE',
      'GENDER', 'ETHNICITY', 'RACE', 'PARENT_EMAIL', 'SCHOOL_CODE',
      'STAFF_NAME', 'STAFF_EMAIL', 'PARENT_PHONE', 'PARENT_NAME', 'SCHOOL_NAME',
      'GRADE', 'SPED', 'PLAN_504', 'EL_STATUS', 'HOMELESS_FOSTER',
      'IGNORE', 'IGNORE', 'IGNORE', 'SITE_ROUTING', 'SITE_ADMIN_EMAILS', 'SUPER_ADMIN_EMAILS'
    ];
    legacyRosterTypes.forEach((type, idx) => {
      columns.push({ type, header: `Col ${idx}`, index: idx });
    });
  } else {
    const legacyElpacTypes = [
      'STUDENT_ID', 'LAST_NAME', 'FIRST_NAME', 'TEST_GRADE', 'ROW_TEST_ID',
      'ROW_PART', 'ROW_DATE', 'ROW_SCALED_SCORE', 'ROW_PERF_LEVEL'
    ];
    legacyElpacTypes.forEach((type, idx) => {
      columns.push({ type, header: `Col ${idx}`, index: idx });
    });
  }

  return { hasHeaderRow: false, columns };
}

/**
 * Infers academic year ('2024-2025', '2025-2026', '2026-2027') and test window ('Fall' | 'Spring')
 * from a row's dateTaken, explicit year, explicit window, or tab name.
 */
export function resolveAcademicPeriod({ academicYear, testWindow, dateTaken, yearNum, tabName }) {
  let resolvedYear = academicYear || detectAcademicYear(tabName, dateTaken);
  const { window: detectedWin } = detectTestWindow(testWindow || tabName, dateTaken);
  const resolvedWindow = testWindow || detectedWin || 'Spring';

  if (!resolvedYear) {
    // Parse from dateTaken or yearNum
    let yr = yearNum;
    if (!yr && dateTaken) {
      const m4 = String(dateTaken).match(/\b(20\d{2})\b/);
      if (m4) yr = parseInt(m4[1], 10);
      else {
        const m2 = String(dateTaken).match(/\/(\d{2})$/);
        if (m2) yr = 2000 + parseInt(m2[1], 10);
      }
    }
    if (yr) {
      if (resolvedWindow === 'Fall') {
        resolvedYear = `${yr}-${yr + 1}`;
      } else {
        resolvedYear = `${yr - 1}-${yr}`;
      }
    } else {
      resolvedYear = '2025-2026';
    }
  }

  const endYearMatch = String(resolvedYear).match(/(\d{4})$/);
  const endYearNum = endYearMatch ? parseInt(endYearMatch[1], 10) : 2026;
  const startYearNum = endYearNum - 1;
  const calendarYear = resolvedWindow === 'Fall' ? startYearNum : endYearNum;
  const yearMeta = ELD_YEAR_LABELS[resolvedYear] || {
    short: `${String(startYearNum).slice(-2)}-${String(endYearNum).slice(-2)}`,
    tab: `${String(startYearNum).slice(-2)}-${String(endYearNum).slice(-2)} ELD`,
    full: resolvedYear,
    numericYear: endYearNum
  };

  return {
    academicYear: resolvedYear,
    shortYear: yearMeta.short,
    tabLabel: yearMeta.tab,
    testWindow: resolvedWindow,
    windowOrder: resolvedWindow === 'Fall' ? 1 : 2,
    calendarYear,
    sortKey: startYearNum * 10 + (resolvedWindow === 'Fall' ? 1 : 2)
  };
}

/**
 * Builds the student's multi-year ELD progression matrix across 24-25 ELD, 25-26 ELD, and 26-27 ELD
 * (with separate Fall and Spring intervals and mapped Teacher Comments).
 */
export function buildMultiYearEldMatrix(elpacHistory = [], rawComments = [], studentGrade = 5) {
  const matrix = {};

  ELD_ACADEMIC_YEARS.forEach(yr => {
    const meta = ELD_YEAR_LABELS[yr];
    matrix[yr] = {
      academicYear: yr,
      shortYear: meta.short,
      tabLabel: meta.tab,
      fullLabel: meta.full,
      fall: null,
      spring: null,
      comments: [],
      fallComment: null,
      springComment: null,
      generalComment: null
    };
  });

  const ensureYearSlot = (yr) => {
    if (!yr) return null;
    if (!matrix[yr]) {
      const period = resolveAcademicPeriod({ academicYear: yr });
      matrix[yr] = {
        academicYear: yr,
        shortYear: period.shortYear,
        tabLabel: period.tabLabel,
        fullLabel: yr,
        fall: null,
        spring: null,
        comments: [],
        fallComment: null,
        springComment: null,
        generalComment: null
      };
    }
    return matrix[yr];
  };

  // Populate Fall and Spring slots from history records (preferring Overall Part 0 for top-level slot summary, while keeping domain details)
  for (const rec of elpacHistory) {
    if (!rec) continue;
    const period = resolveAcademicPeriod({
      academicYear: rec.academicYear,
      testWindow: rec.testWindow,
      dateTaken: rec.dateTaken,
      yearNum: rec.year,
      tabName: rec.tabName
    });

    rec.academicYear = period.academicYear;
    rec.shortYear = period.shortYear;
    rec.tabLabel = period.tabLabel;
    rec.testWindow = period.testWindow;
    rec.windowOrder = period.windowOrder;
    rec.sortKey = period.sortKey;
    if (!rec.year) rec.year = period.calendarYear;

    const slot = ensureYearSlot(period.academicYear);
    if (!slot) continue;

    const winKey = period.testWindow === 'Fall' ? 'fall' : 'spring';
    const existing = slot[winKey];

    // Prefer Part 0 (Overall) as the primary interval badge, or overwrite if newer/higher-priority
    if (
      !existing ||
      (Number(rec.part ?? 0) === 0 && Number(existing.part ?? 0) !== 0) ||
      (Number(rec.part ?? 0) === Number(existing.part ?? 0) && (rec.scaledScore !== null || rec.performanceLevel !== null))
    ) {
      slot[winKey] = {
        academicYear: period.academicYear,
        shortYear: period.shortYear,
        tabLabel: period.tabLabel,
        testWindow: period.testWindow,
        dateTaken: rec.dateTaken || '',
        testGrade: rec.testGrade ?? studentGrade,
        testId: rec.testId || period.tabLabel,
        part: Number(rec.part ?? 0),
        partLabel: rec.partLabel || getPartLabel(rec.part ?? 0).label,
        scaledScore: rec.scaledScore ?? null,
        performanceLevel: rec.performanceLevel ?? null,
        rawLevel: rec.rawLevel || (rec.performanceLevel ? `Level ${rec.performanceLevel}` : ''),
        teacherComment: rec.teacherComment || null
      };
    }

    if (rec.teacherComment) {
      rawComments.push({
        academicYear: period.academicYear,
        shortYear: period.shortYear,
        tabLabel: period.tabLabel,
        testWindow: period.testWindow,
        dateTaken: rec.dateTaken || '',
        comment: rec.teacherComment,
        performanceLevel: rec.performanceLevel ?? null,
        scaledScore: rec.scaledScore ?? null
      });
    }
  }

  // Deduplicate and map Teacher Comments into corresponding academic years & Fall/Spring test windows
  const deduplicatedComments = [];
  const seenKeys = new Set();

  for (const c of rawComments) {
    const cleanText = parseTeacherCommentCell(c.comment || c.text);
    if (!cleanText) continue;

    const period = resolveAcademicPeriod({
      academicYear: c.academicYear,
      testWindow: c.testWindow,
      dateTaken: c.dateTaken,
      tabName: c.tabName
    });

    const dedupKey = `${period.academicYear}__${c.testWindow || 'ALL'}__${cleanText.toLowerCase()}`;
    if (seenKeys.has(dedupKey)) continue;
    seenKeys.add(dedupKey);

    const slot = ensureYearSlot(period.academicYear);
    const matchedInterval =
      c.testWindow === 'Fall'
        ? slot?.fall
        : c.testWindow === 'Spring'
        ? slot?.spring
        : slot?.spring || slot?.fall || null;

    const commentEntry = {
      academicYear: period.academicYear,
      shortYear: period.shortYear,
      tabLabel: period.tabLabel,
      testWindow: c.testWindow || (slot?.fall && !slot?.spring ? 'Fall' : 'Spring'),
      windowOrder: c.testWindow === 'Fall' ? 1 : 2,
      dateTaken: c.dateTaken || matchedInterval?.dateTaken || '',
      comment: cleanText,
      performanceLevel: c.performanceLevel ?? matchedInterval?.performanceLevel ?? null,
      scaledScore: c.scaledScore ?? matchedInterval?.scaledScore ?? null,
      sortKey: period.sortKey
    };

    deduplicatedComments.push(commentEntry);

    if (slot) {
      slot.comments.push(commentEntry);
      if (commentEntry.testWindow === 'Fall') {
        slot.fallComment = cleanText;
        if (slot.fall && !slot.fall.teacherComment) slot.fall.teacherComment = cleanText;
      } else if (commentEntry.testWindow === 'Spring') {
        slot.springComment = cleanText;
        if (slot.spring && !slot.spring.teacherComment) slot.spring.teacherComment = cleanText;
      } else {
        slot.generalComment = cleanText;
      }
    }
  }

  deduplicatedComments.sort((a, b) => (b.sortKey || 0) - (a.sortKey || 0));

  const orderedYears = Object.values(matrix).sort((a, b) => a.academicYear.localeCompare(b.academicYear));

  return {
    eldByYear: matrix,
    eldYearOrder: orderedYears,
    teacherComments: deduplicatedComments
  };
}

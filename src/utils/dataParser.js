// src/utils/dataParser.js
// Dynamic Multi-Year ELD & ELPAC Column Parser for WVUSD ELPAC Portal
// Intelligently inspects column headers across "ELPAC", "24-25 ELD", "25-26 ELD", and "26-27 ELD"
// matching the robust, header-inspection architecture used in wvusd-data-portal:
//   1. Strict Column A (index 0) Student ID Binding for all student record matching and roster lookups
//   2. Dynamic Header Inspection for all subsequent columns (B+) regardless of their exact letter position

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
  const fullRange = combined.match(/\b(20\d{2})\s*[-–/]\s*(?:20)?(\d{2})\b/);
  if (fullRange) {
    const startYr = parseInt(fullRange[1], 10);
    const endYrShort = parseInt(fullRange[2], 10);
    const endYr = endYrShort < 100 ? 2000 + endYrShort : endYrShort;
    if (endYr === startYr + 1 || (endYr > startYr && endYr - startYr <= 2)) {
      return `${startYr}-${startYr + 1}`;
    }
  }

  // Match 2-digit academic year range e.g. 24-25, 25-26, 26-27, '24-'25, 24/25, SY24-25
  const shortRange = combined.match(/(?:^|[^0-9])'?(\d{2})\s*[-–/]\s*'?(\d{2})(?:[^0-9]|$)/);
  if (shortRange) {
    const y1 = parseInt(shortRange[1], 10);
    const y2 = parseInt(shortRange[2], 10);
    if (y1 >= 18 && y1 <= 35 && y2 === y1 + 1) {
      return `20${y1}-20${y2}`;
    }
  }

  // Match standalone 4-digit year e.g. Fall 2024 -> 2024-2025, Spring 2025 -> 2024-2025
  const singleYearMatch = combined.match(/\b(202[0-9])\b/);
  if (singleYearMatch) {
    const yr = parseInt(singleYearMatch[1], 10);
    const isFall = /\bfall\b|\bboy\b|\bsem(?:ester)?\s*1\b|\btri(?:mester)?\s*1\b|\bq1\b|\binitial\b|\bbaseline\b|\baug|\bsep|\boct|\bnov|\bdec/i.test(combined);
    if (isFall) {
      return `${yr}-${yr + 1}`;
    }
    return `${yr - 1}-${yr}`;
  }

  return null;
}

/**
 * Extracts testing interval (Fall vs. Spring) from header text, cell value, or date string.
 * Returns: { window: 'Fall' | 'Spring' | null, windowOrder: 1 | 2 | 3 }
 */
export function detectTestWindow(headerText = '', dateOrValText = '') {
  const h = String(headerText || '').trim();
  const d = String(dateOrValText || '').trim();
  const combined = `${h} ${d}`;

  if (/\bfall\b|\bboy\b|\bbeginning\b|\bsem(?:ester)?\s*1\b|\bs1\b|\btri(?:mester)?\s*1\b|\bt1\b|\bquarter\s*1\b|\bq1\b|\binitial\b|\bbaseline\b|\bpre-?test\b|\bdiagnostic\b/i.test(h)) {
    return { window: 'Fall', windowOrder: 1 };
  }
  if (/\bspring\b|\beoy\b|\bend\s*of\s*year\b|\bsem(?:ester)?\s*2\b|\bs2\b|\btri(?:mester)?\s*[23]\b|\bt[23]\b|\bquarter\s*[34]\b|\bq[34]\b|\bsummative\b|\bfinal\b|\bpost-?test\b|\bwinter\b|\bmoy\b/i.test(h)) {
    return { window: 'Spring', windowOrder: 2 };
  }

  if (/\bfall\b|\binitial\b|\bboy\b/i.test(d)) {
    return { window: 'Fall', windowOrder: 1 };
  }
  if (/\bspring\b|\bsummative\b|\beoy\b/i.test(d)) {
    return { window: 'Spring', windowOrder: 2 };
  }

  // Check MM/DD/YYYY or YYYY-MM-DD date month if a date is present (Months 8..12 -> Fall, Months 1..7 -> Spring)
  const usDateMatch = combined.match(/\b(\d{1,2})[/-]\d{1,2}[/-](?:\d{2}|\d{4})\b/);
  if (usDateMatch) {
    const month = parseInt(usDateMatch[1], 10);
    if (month >= 8 && month <= 12) return { window: 'Fall', windowOrder: 1 };
    if (month >= 1 && month <= 7) return { window: 'Spring', windowOrder: 2 };
  }

  const isoDateMatch = combined.match(/\b20\d{2}[/-](\d{1,2})[/-]\d{1,2}\b/);
  if (isoDateMatch) {
    const month = parseInt(isoDateMatch[1], 10);
    if (month >= 8 && month <= 12) return { window: 'Fall', windowOrder: 1 };
    if (month >= 1 && month <= 7) return { window: 'Spring', windowOrder: 2 };
  }

  if (/\b(?:aug|sep|oct|nov|dec)[a-z]*\b/i.test(combined)) {
    return { window: 'Fall', windowOrder: 1 };
  }
  if (/\b(?:jan|feb|mar|apr|may|jun|jul)[a-z]*\b/i.test(combined)) {
    return { window: 'Spring', windowOrder: 2 };
  }

  return { window: null, windowOrder: 3 };
}

/**
 * Extracts ELPAC/ELD Domain / Part (0 = Overall, 1 = Oral, 2 = Written, 3 = Listening, 4 = Speaking, 5 = Reading, 6 = Writing)
 */
export function detectDomainPart(headerText = '') {
  const h = String(headerText || '').toLowerCase();
  const explicitPart = h.match(/\bpart\s*([0-6])\b/) || h.match(/\bp([0-6])\b/);
  if (explicitPart) return parseInt(explicitPart[1], 10);

  if (/\blistening\b|\blist\b/.test(h)) return 3;
  if (/\bspeaking\b|\bspk\b/.test(h)) return 4;
  if (/\breading\b|\brd\b/.test(h)) return 5;
  if (/\bwriting\b|\bwrt\b/.test(h)) return 6;
  if (/\boral\b/.test(h)) return 1;
  if (/\bwritten\b/.test(h)) return 2;
  return 0; // Default Overall ELD / ELPAC
}

/**
 * Parses a Part cell value (e.g. "0", "Part 1", "Oral Language", "Listening", "3 - Listening") into numeric Part 0..6
 */
export function parsePartValue(rawPartVal, fallbackHeader = '') {
  if (rawPartVal === null || rawPartVal === undefined || rawPartVal === '') {
    return detectDomainPart(fallbackHeader);
  }
  const str = String(rawPartVal).trim();
  if (/^[0-6]$/.test(str)) {
    return parseInt(str, 10);
  }
  const numPrefix = str.match(/^([0-6])\b/) || str.match(/\bpart\s*([0-6])\b/i);
  if (numPrefix) {
    return parseInt(numPrefix[1], 10);
  }
  return detectDomainPart(`${str} ${fallbackHeader}`);
}

/**
 * Normalizes a Student ID from Column A (index 0).
 * Column A is strictly mapped as the unique Student ID identifier across all tabs.
 */
export function extractStrictColumnAStudentId(row) {
  if (!Array.isArray(row) || row.length === 0) return '';
  const raw = String(row[0] ?? '').trim();
  if (!raw) return '';
  // Reject header echoes if a repeated header row appears mid-sheet
  if (/^(?:student\s*id|id|local\s*id|stu\s*id|perm\s*id|ssid|state\s*id|student\s*#)$/i.test(raw)) {
    return '';
  }
  return raw.replace(/^#/, '').replace(/\.0+$/, '').replace(/^0+/, '').trim();
}

/**
 * Checks whether a value looks like a raw school code (e.g. "56", "CSR", "DBHS", "01")
 * or placeholder rather than a clean Column O School Name.
 */
export function isRawSchoolCodeOrPlaceholder(val) {
  if (!val) return true;
  const s = String(val).trim();
  if (!s) return true;
  if (/^wvusd\s*school$/i.test(s) || /^all$/i.test(s) || /^unassigned$/i.test(s) || /^unknown$/i.test(s) || /^n\/a$/i.test(s)) {
    return true;
  }
  // Purely numeric school code (e.g. "12", "56", "790", "6021125")
  if (/^\d+$/.test(s)) return true;
  // Short 1-5 character uppercase/alphanumeric school code without spaces (e.g. "CSR", "VEJ", "DBHS", "WHS", "SUZ", "SPT")
  if (/^[A-Z0-9-]{1,5}$/.test(s)) return true;
  return false;
}

/**
 * Produces a canonical key for a WVUSD school site so duplicate site identifiers
 * (e.g. "Castle Rock" vs "Castle Rock Elementary") resolve to the single Column O School Name.
 */
export function getSiteCanonicalKey(siteName) {
  if (!siteName) return '';
  const s = String(siteName).toLowerCase().trim();
  if (!s || isRawSchoolCodeOrPlaceholder(siteName)) return '';
  if (s.includes('castle rock')) return 'castle_rock';
  if (s.includes('collegewood')) return 'collegewood';
  if (s.includes('morris')) return 'cj_morris';
  if (s.includes('evergreen')) return 'evergreen';
  if (s.includes('maple hill')) return 'maple_hill';
  if (s.includes('quail summit')) return 'quail_summit';
  if (s.includes('vejar')) return 'vejar';
  if (s.includes('westhoff')) return 'westhoff';
  if (s.includes('walnut') && !s.includes('high')) return 'walnut_elementary';
  if (s.includes('chaparral')) return 'chaparral';
  if (s.includes('south pointe')) return 'south_pointe';
  if (s.includes('suzanne')) return 'suzanne';
  if (s.includes('diamond bar')) return 'diamond_bar';
  if (s.includes('walnut high')) return 'walnut_high';
  if (s.includes('hockwalt')) return 'hockwalt';
  return s.replace(/\s+/g, ' ');
}

/**
 * Maps known WVUSD school codes or abbreviations to their canonical key.
 */
export function getCodeCanonicalKey(codeOrText) {
  if (!codeOrText) return '';
  const u = String(codeOrText).toUpperCase().trim();
  const map = {
    CSR: 'castle_rock',
    CWD: 'collegewood',
    CJM: 'cj_morris',
    MOR: 'cj_morris',
    EVG: 'evergreen',
    MPH: 'maple_hill',
    QSM: 'quail_summit',
    VEJ: 'vejar',
    WLE: 'walnut_elementary',
    WES: 'walnut_elementary',
    WST: 'westhoff',
    CHP: 'chaparral',
    SPT: 'south_pointe',
    SPMS: 'south_pointe',
    SUZ: 'suzanne',
    SMS: 'suzanne',
    DBHS: 'diamond_bar',
    DBH: 'diamond_bar',
    WHS: 'walnut_high',
    RHA: 'hockwalt'
  };
  return map[u] || getSiteCanonicalKey(codeOrText);
}

/**
 * Checks whether a student's school matches the selected school filter from the dropdown.
 */
export function matchesSchoolSite(studentSchool, selectedSite) {
  if (!selectedSite || selectedSite === 'ALL') return true;
  if (!studentSchool) return false;
  const a = String(studentSchool).trim();
  const b = String(selectedSite).trim();
  if (a === b || a.toLowerCase() === b.toLowerCase()) return true;
  const keyA = getSiteCanonicalKey(a) || getCodeCanonicalKey(a);
  const keyB = getSiteCanonicalKey(b) || getCodeCanonicalKey(b);
  return Boolean(keyA && keyB && keyA === keyB);
}

/**
 * Classifies a column header dynamically ( matching wvusd-data-portal's header-inspection architecture ).
 * - Column A (colIndex === 0) is ALWAYS strictly bound as 'STUDENT_ID'.
 * - All other columns (colIndex >= 1) are dynamically matched via header-string inspection regardless of position.
 */
export function classifyColumnHeader(rawHeader = '', tabContext = '', colIndex = null) {
  const header = String(rawHeader ?? '').trim();

  // Rule 1: Strict Column A (index 0) Student ID Binding
  if (colIndex === 0) {
    return {
      type: 'STUDENT_ID',
      header: header || 'Student ID',
      isStrictColumnA: true
    };
  }

  if (!header) return { type: 'IGNORE', header: '' };

  const lower = header.toLowerCase();

  // Ignore secondary ID columns in B+ so they never override Column A's authoritative Student ID
  if (/^(?:student\s*id|id|local\s*id|stu\s*id|perm\s*id|ssid|state\s*id|sis\s*id|row\s*id|guid|uuid)$/i.test(lower)) {
    return { type: 'IGNORE', header };
  }

  // 1. Ignore extraneous metadata / system / timestamp / blank filler columns
  if (
    /^col(?:umn)?\s*[a-z0-9]+$/i.test(header) ||
    /^unnamed/i.test(header) ||
    /\b(?:timestamp|last\s*updated|modified|lunch|meal|bus|locker|course\s*id|section\s*id|attendance|absences|tardies|attempts\s*number\s*possible|user\s*name)\b/i.test(lower)
  ) {
    return { type: 'IGNORE', header };
  }

  const academicYear = detectAcademicYear(header, tabContext);
  const { window: testWindow, windowOrder } = detectTestWindow(header);
  const part = detectDomainPart(header);

  // 2. Identity & Roster Demographic columns (dynamically matched in any column B+)
  if (/^(?:last\s*name|surname|student\s*last|last|lname|family\s*name)$/i.test(lower) || /\blast\s*name\b/i.test(lower)) {
    return { type: 'LAST_NAME', header };
  }
  if (/^(?:first\s*name|given\s*name|student\s*first|first|fname)$/i.test(lower) || /\bfirst\s*name\b/i.test(lower)) {
    return { type: 'FIRST_NAME', header };
  }
  if (/^(?:full\s*name|student\s*name|name|student|pupil\s*name)$/i.test(lower)) {
    return { type: 'FULL_NAME', header };
  }
  if (/\b(?:test\s*grade|assessed\s*grade|grade\s*assessed|elpac\s*grade|testing\s*grade)\b/i.test(lower)) {
    return { type: 'TEST_GRADE', header, academicYear, testWindow };
  }
  if (/^(?:grade|grade\s*level|gr|curr(?:ent)?\s*grade|stu\s*grade|enrolled\s*grade)$/i.test(lower)) {
    return { type: 'GRADE', header };
  }
  if (/^(?:gender|sex)$/i.test(lower)) {
    return { type: 'GENDER', header };
  }
  if (/^ethnicity$/i.test(lower) || /\bhispanic\b/i.test(lower)) {
    return { type: 'ETHNICITY', header };
  }
  if (/^race$/i.test(lower) || /\brace\/ethnicity\b/i.test(lower)) {
    return { type: 'RACE', header };
  }
  if (/\bparent\s*email\b|\bguardian\s*email\b|\bfamily\s*email\b/i.test(lower)) {
    return { type: 'PARENT_EMAIL', header };
  }
  if (/\bparent\s*phone\b|\bhome\s*phone\b|\bcontact\s*phone\b|\bguardian\s*phone\b|\bphone\b|\bcell\b/i.test(lower)) {
    return { type: 'PARENT_PHONE', header };
  }
  if (/\bparent\s*name\b|\bparent\/guardian\b|\bguardian\s*name\b|\bparent\b|\bguardian\b/i.test(lower)) {
    return { type: 'PARENT_NAME', header };
  }
  const isRosterContext = /roster/i.test(String(tabContext || ''));

  // Exclusive Column O (colIndex === 14) binding for School Name on Roster
  if (isRosterContext && colIndex === 14) {
    return { type: 'SCHOOL_NAME', header: header || 'School Name', isStrictColumnO: true };
  }
  if (/^school\s*code$|^site\s*code$|^loc\s*code$/i.test(lower) || (isRosterContext && colIndex === 9)) {
    return { type: 'SCHOOL_CODE', header };
  }
  if (/^school\s*name$/i.test(lower)) {
    return { type: 'SCHOOL_NAME', header };
  }
  if (/^(?:school|school\s*site|site|enrolled\s*school|home\s*school)$/i.test(lower)) {
    // On the Roster tab, "School" in a non-Column-O position (e.g. Col J) is a raw school code
    if (isRosterContext && colIndex !== null && colIndex !== 14) {
      return { type: 'SCHOOL_CODE', header };
    }
    // On non-Roster tabs (ELPAC / ELD), ignore "School" / "Site" so they never overwrite Roster Column O
    if (!isRosterContext && tabContext) {
      return { type: 'SCHOOL_CODE', header };
    }
    return { type: 'SCHOOL_NAME', header };
  }
  if (/^(?:site\s*name|routing\s*site|admin\s*site)$/i.test(lower)) {
    return { type: 'SITE_ROUTING', header };
  }
  if (/\badmin\s*access\b|\bsite\s*admin/i.test(lower)) {
    return { type: 'SITE_ADMIN_EMAILS', header };
  }
  if (/\bsuper\s*admin\b/i.test(lower)) {
    return { type: 'SUPER_ADMIN_EMAILS', header };
  }
  if (/\b(?:teacher|counselor|staff|educator|homeroom|advisor)\s*email\b/i.test(lower)) {
    return { type: 'STAFF_EMAIL', header };
  }
  if (/^(?:teacher|teacher\s*name|counselor|counselor\s*name|homeroom\s*teacher|eld\s*teacher|staff\s*name|staff|educator|advisor)$/i.test(lower)) {
    return { type: 'STAFF_NAME', header };
  }
  if (/^(?:sped|special\s*ed(?:ucation)?|iep|sped\s*flag|iep\s*status|swd)$/i.test(lower)) {
    return { type: 'SPED', header };
  }
  if (/^(?:504|504\s*plan|section\s*504|504\s*accommodations|plan\s*504)$/i.test(lower)) {
    return { type: 'PLAN_504', header };
  }
  if (/^(?:el\s*status|english\s*proficiency|language\s*fluency|el\s*proficiency|lep\s*status|lang(?:uage)?\s*status|el\s*code|ela\s*status)$/i.test(lower)) {
    return { type: 'EL_STATUS', header };
  }
  if (/\b(?:homeless|foster|mckinney|vento)\b/i.test(lower)) {
    return { type: 'HOMELESS_FOSTER', header };
  }

  // 3. Teacher Comment / Qualitative Observation columns (with optional academicYear & testWindow)
  if (
    /\b(?:comment|comments|note|notes|observation|observations|feedback|narrative|qualitative|rationale|teacher\s*input|counselor\s*note|eld\s*note|progress\s*note|remarks|annotation)\b/i.test(lower)
  ) {
    return {
      type: 'TEACHER_COMMENT',
      header,
      academicYear,
      testWindow,
      windowOrder
    };
  }

  // 4. Long-format ELPAC row columns (Test IDs, Parts, Test Windows, Test Dates, Scaled Scores, Performance Levels)
  if (
    /^(?:test\s*id|testid|assessment\s*id|test\s*name|assessment\s*name|test\s*type|test\s*code|exam\s*id|administration|elpac\s*test|test)$/i.test(lower) ||
    /\b(?:test\s*id|testid|assessment\s*id)\b/i.test(lower)
  ) {
    return { type: 'ROW_TEST_ID', header };
  }
  if (
    /^(?:part|test\s*part|domain\s*part|subtest\s*part|part\s*#|part\s*number|elpac\s*part|domain|subtest|part\s*0-6|component)$/i.test(lower) ||
    /\b(?:test\s*part|domain\s*part|subtest\s*part|part\s*number)\b/i.test(lower)
  ) {
    return { type: 'ROW_PART', header };
  }
  if (
    /^(?:test\s*window|testing\s*window|window|interval|test\s*interval|term|semester|trimester|season|administration\s*window|test\s*cycle|cycle|period|admin\s*period)$/i.test(lower) ||
    /\b(?:test(?:ing)?\s*window|admin(?:istration)?\s*window|test(?:ing)?\s*cycle)\b/i.test(lower)
  ) {
    return { type: 'ROW_WINDOW', header, academicYear };
  }
  if (
    /^(?:academic\s*year|school\s*year|test\s*year|year|sy|admin\s*year|elpac\s*year)$/i.test(lower) ||
    /\b(?:academic\s*year|school\s*year|test\s*year)\b/i.test(lower)
  ) {
    return { type: 'ROW_YEAR', header };
  }
  if (
    /\b(?:date\s*taken|test\s*date|testing\s*date|administration\s*date|admin\s*date|date\s*tested|assessment\s*date|completed\s*date|test\s*dt|date)\b/i.test(lower)
  ) {
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

  // 5. Scaled Scores, Performance Levels (Level 1-4, Initial/Overall Proficiency), and Multi-Year ELD Monitoring Metrics
  const hasExplicitSeasonalWindow =
    /\b(?:fall|spring|winter|boy|moy|eoy|sem(?:ester)?\s*[12]|s[12]|tri(?:mester)?\s*[123]|t[123]|quarter\s*[1-4]|q[1-4]|pre-?test|post-?test)\b/i.test(lower);

  const hasExplicitScaleScore =
    /\b(?:scaled?\s*score|ss|scale\s*pts|raw\s*score|overall\s*score|oral\s*score|written\s*score|test\s*score)\b/i.test(lower) ||
    /^(?:score|scaled|ss)$/i.test(lower);

  const hasExplicitLevel =
    /\b(?:perf(?:ormance)?\s*(?:level|lvl)|perflvl|prof(?:iciency)?\s*(?:level|lvl)|overall\s*level|initial\s*level|summative\s*level|domain\s*level|eld\s*level|elpac\s*level|initial\s*proficiency|overall\s*proficiency|proficiency|level(?:\s*1\s*[-–—]\s*4)?|lvl|pl|tier)\b/i.test(lower) ||
    /^(?:level|proficiency|performance|pl|lvl|perflvl)$/i.test(lower);

  const hasEldOrDomainKeyword =
    /\b(?:score|level|proficiency|eld|elpac|overall|oral|written|listening|speaking|reading|writing|fall|spring|initial|summative|bridging|expanding|emerging|rubric|benchmark)\b/i.test(lower);

  if (hasExplicitScaleScore || hasExplicitLevel || hasEldOrDomainKeyword || academicYear) {
    // Check if this is an un-scoped row-level Scaled Score or Performance Level column on the ELPAC tab
    // (including headers like "ELPAC Scaled Score", "Overall Scaled Score", "Overall Performance Level", "Initial/Overall Proficiency", "Level 1–4")
    const isDomainSpecific = part !== 0; // Part 1..6 (Oral, Written, Listening, Speaking, Reading, Writing)

    if (!academicYear && !hasExplicitSeasonalWindow && !isDomainSpecific) {
      if (hasExplicitScaleScore && !hasExplicitLevel) {
        return { type: 'ROW_SCALED_SCORE', header };
      }

      if (hasExplicitLevel && !hasExplicitScaleScore) {
        return { type: 'ROW_PERF_LEVEL', header };
      }
    }

    return {
      type: hasExplicitScaleScore && !hasExplicitLevel
        ? 'ELD_SCALED_SCORE'
        : hasExplicitLevel && !hasExplicitScaleScore
        ? 'ELD_LEVEL'
        : 'ELD_SCORE_OR_LEVEL',
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
 *   - "IFEP" / "Intermediate" / "Novice" / "Initial Fluent English Proficient" / "Overall Level 3"
 *   - Multi-attempt comma-separated trails e.g. "Level 2, Level 3" (uses latest attempt)
 * Returns null if the cell does not contain a valid test score or level.
 */
export function parseEldScoreOrLevelCell(rawVal, grade = 5) {
  if (rawVal === null || rawVal === undefined) return null;
  let str = String(rawVal).trim();
  if (!str) return null;

  // Reject boolean/flag/empty markers
  if (/^(?:n\/a|na|none|null|undefined|-|--|—|tbd|pending|exempt|abs|absent|true|false|yes|no|y|n)$/i.test(str)) {
    return null;
  }

  // Handle multi-attempt comma-separated values (like wvusd-data-portal parseMultiAttempt: take the latest non-empty attempt)
  if (str.includes(',') && !/^[a-z]+,\s*[a-z]+$/i.test(str)) {
    const parts = str.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      str = parts[parts.length - 1];
    }
  }

  let scaledScore = null;
  let performanceLevel = null;
  let dateTaken = null;

  // Check if there is an inline date e.g. "Level 3 (10/15/2025)" or "2025-10-15"
  const inlineDateMatch =
    str.match(/\b(\d{1,2}[/-]\d{1,2}[/-](?:\d{2}|\d{4}))\b/) ||
    str.match(/\b(20\d{2}[/-]\d{1,2}[/-]\d{1,2})\b/);
  if (inlineDateMatch) {
    dateTaken = inlineDateMatch[1];
  }

  const strWithoutDate = dateTaken ? str.replace(dateTaken, ' ') : str;

  // 1. Check for 4-digit ELPAC scale score (1100–1900) or 3-digit Initial ELPAC scale score (150–600)
  const scaleMatch4 = strWithoutDate.match(/\b(1[1-9]\d{2})\b/);
  const scaleMatch3 = strWithoutDate.match(/\b([1-6]\d{2})\b/);
  if (scaleMatch4) {
    scaledScore = parseInt(scaleMatch4[1], 10);
  } else if (scaleMatch3 && !/\blevel\b/i.test(strWithoutDate)) {
    scaledScore = parseInt(scaleMatch3[1], 10);
  }

  // 2. Check for explicit "Level 1..4", "L1..L4", "PL 1..4"
  const explicitLvlMatch =
    strWithoutDate.match(/\blevel\s*(?:-|:|#)?\s*([1-4])\b/i) ||
    strWithoutDate.match(/\blvl\s*(?:-|:|#)?\s*([1-4])\b/i) ||
    strWithoutDate.match(/\b(?:pl|l)\s*(?:-|:|#)?\s*([1-4])\b/i);

  if (explicitLvlMatch) {
    performanceLevel = parseInt(explicitLvlMatch[1], 10);
  } else if (/^[1-4](?:\.\d+)?\+?$/.test(strWithoutDate.trim())) {
    // Standalone 1..4 proficiency level (e.g. "3", "3+", "2.5")
    performanceLevel = Math.min(4, Math.max(1, Math.round(parseFloat(strWithoutDate.trim()))));
  } else {
    // Check descriptive California Summative & Initial ELD / ELPAC terms
    const lower = strWithoutDate.toLowerCase();
    if (
      /\b(?:well\s*developed|bridging|ifep|initial(?:ly)?\s*fluent|rfep|redesignated|fluent|exceeded|advanced|proficient\s*level\s*4)\b/.test(lower)
    ) {
      performanceLevel = 4;
    } else if (
      /\b(?:moderately\s*developed|expanding|intermediate|proficient|met\s*standard)\b/.test(lower) &&
      !/\bearly\s*intermediate\b/.test(lower)
    ) {
      performanceLevel = 3;
    } else if (
      /\b(?:somewhat\s*developed|early\s*intermediate|developing|approaching|nearly\s*met)\b/.test(lower)
    ) {
      performanceLevel = 2;
    } else if (
      /\b(?:minimally\s*developed|emerging|beginning|novice|not\s*met)\b/.test(lower)
    ) {
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
 * - Strictly binds Column A (index 0) as STUDENT_ID.
 * - Dynamically inspects and classifies all remaining columns (index >= 1) by header string.
 * - If a column header is non-standard or unrecognized during header classification, marks it as
 *   'DYNAMIC_INSPECT' so the parser can still inspect its cell values gracefully without losing data.
 */
export function analyzeSheetHeaders(headerRow = [], tabName = '', isRosterFallback = false) {
  const columns = [];
  const hasHeaderKeywords = headerRow.some(cell =>
    /\b(?:id|student|name|grade|level|score|eld|elpac|fall|spring|comment|note|teacher|counselor|school|site|part|date|window|proficiency|initial|overall|listening|speaking|reading|writing|oral|written)\b/i.test(String(cell || ''))
  );

  if (hasHeaderKeywords) {
    headerRow.forEach((cell, idx) => {
      const info = classifyColumnHeader(cell, tabName, idx);
      columns.push({ ...info, index: idx });
    });
    return { hasHeaderRow: true, columns };
  }

  // Fallback ONLY when row 0 has zero header keywords (e.g., raw headerless CSV export).
  // Column A (index 0) is still strictly bound as STUDENT_ID.
  if (isRosterFallback) {
    const legacyRosterTypes = [
      'STUDENT_ID', 'LAST_NAME', 'FIRST_NAME', 'FULL_NAME', 'GRADE',
      'GENDER', 'ETHNICITY', 'RACE', 'PARENT_EMAIL', 'SCHOOL_CODE',
      'STAFF_NAME', 'STAFF_EMAIL', 'PARENT_PHONE', 'PARENT_NAME', 'SCHOOL_NAME',
      'GRADE', 'SPED', 'PLAN_504', 'EL_STATUS', 'HOMELESS_FOSTER',
      'IGNORE', 'IGNORE', 'IGNORE', 'SITE_ROUTING', 'SITE_ADMIN_EMAILS', 'SUPER_ADMIN_EMAILS'
    ];
    const maxCols = Math.max(headerRow.length, legacyRosterTypes.length);
    for (let idx = 0; idx < maxCols; idx++) {
      const type = idx === 0 ? 'STUDENT_ID' : (legacyRosterTypes[idx] || 'IGNORE');
      columns.push({ type, header: `Col ${idx}`, index: idx, isStrictColumnA: idx === 0 });
    }
  } else {
    const legacyElpacTypes = [
      'STUDENT_ID', 'LAST_NAME', 'FIRST_NAME', 'TEST_GRADE', 'ROW_TEST_ID',
      'ROW_PART', 'ROW_DATE', 'ROW_SCALED_SCORE', 'ROW_PERF_LEVEL'
    ];
    const maxCols = Math.max(headerRow.length, legacyElpacTypes.length);
    for (let idx = 0; idx < maxCols; idx++) {
      const type = idx === 0 ? 'STUDENT_ID' : (legacyElpacTypes[idx] || 'IGNORE');
      columns.push({ type, header: `Col ${idx}`, index: idx, isStrictColumnA: idx === 0 });
    }
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

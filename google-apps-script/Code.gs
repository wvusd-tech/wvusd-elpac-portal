/**
 * WVUSD ELPAC Longitudinal Data Portal - Google Apps Script Backend (Code.gs)
 *
 * Connected Google Sheet ID: 1JrSfw0pEvWNbkZ4nxgXJE2Vv30zkkbalpmHoojCLXXc
 * Architecture:
 *   1. Strict Column A (index 0) Student ID Binding across all tabs ("ELPAC", "Roster Tab", "24-25 ELD", "25-26 ELD", "26-27 ELD")
 *   2. Dynamic Header Inspection for all columns (B+) regardless of their exact letter position:
 *      - Test IDs, Parts (0–6), and Test Windows (Fall / Spring)
 *      - Test Dates
 *      - Scaled Scores and Performance Levels (Level 1–4, Initial/Overall Proficiency)
 *      - Multi-year ELD monitoring metrics (24-25, 25-26, 26-27 across Fall and Spring test cycles)
 *      - Teacher comment fields
 */

const SHEET_ID = '1JrSfw0pEvWNbkZ4nxgXJE2Vv30zkkbalpmHoojCLXXc';
const ELPAC_TAB_NAME = 'ELPAC';
const ROSTER_TAB_NAME = 'Roster Tab';
const ELD_MULTI_YEAR_TABS = ['24-25 ELD', '25-26 ELD', '26-27 ELD'];
const DEFAULT_SUPER_ADMINS = ['kwendland@wvusd.org'];

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const rawEmail = (params.email || params.test_email || '').toString().toLowerCase().trim();

    if (!rawEmail || (!rawEmail.endsWith('@wvusd.org') && !rawEmail.endsWith('@sub.wvusd.org')) || rawEmail.endsWith('@stu.wvusd.org')) {
      return jsonResponse({
        error: 'Access Denied: Only authorized @wvusd.org staff accounts are permitted.',
        user: { email: rawEmail, authorized: false }
      });
    }

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const rosterSheet = ss.getSheetByName(ROSTER_TAB_NAME) || ss.getSheetByName('Roster');
    const elpacSheet = ss.getSheetByName(ELPAC_TAB_NAME) || ss.getSheets()[0];

    if (!rosterSheet || !elpacSheet) {
      return jsonResponse({
        error: 'Required tabs ("ELPAC" and "Roster Tab") were not found in the Google Sheet.'
      });
    }

    const rosterData = rosterSheet.getDataRange().getDisplayValues();
    const elpacData = elpacSheet.getDataRange().getDisplayValues();
    const eldTabs = {};
    ELD_MULTI_YEAR_TABS.forEach(tabName => {
      const sheet = ss.getSheetByName(tabName);
      if (sheet) {
        eldTabs[tabName] = sheet.getDataRange().getDisplayValues();
      }
    });

    const rbacContext = {
      superAdmins: new Set(DEFAULT_SUPER_ADMINS),
      siteAdminMap: new Map()
    };
    const studentsMap = new Map();

    // 1. Dynamically ingest Roster Tab (Strict Column A Student ID + Dynamic Header Inspection)
    ingestDynamicSheetTab(rosterData, ROSTER_TAB_NAME, studentsMap, rbacContext, true);

    // 2. Dynamically ingest Primary ELPAC Tab (Strict Column A Student ID + Dynamic Header Inspection)
    ingestDynamicSheetTab(elpacData, ELPAC_TAB_NAME, studentsMap, rbacContext, false);

    // 3. Dynamically ingest Multi-Year ELD Tabs ("24-25 ELD", "25-26 ELD", "26-27 ELD")
    Object.keys(eldTabs).forEach(tabName => {
      ingestDynamicSheetTab(eldTabs[tabName], tabName, studentsMap, rbacContext, false);
    });

    // 4. Finalize longitudinal summaries per student
    const allStudents = [];
    studentsMap.forEach(student => {
      student.elpacHistory.sort((a, b) => {
        if ((a.sortKey || 0) !== (b.sortKey || 0)) return (a.sortKey || 0) - (b.sortKey || 0);
        if ((a.year || 0) !== (b.year || 0)) return (a.year || 0) - (b.year || 0);
        return (a.part || 0) - (b.part || 0);
      });

      const overallRecs = student.elpacHistory.filter(r => r.part === 0 && (r.scaledScore || r.performanceLevel));
      const oralRecs = student.elpacHistory.filter(r => (r.part === 1 || r.part === 3 || r.part === 4) && (r.scaledScore || r.performanceLevel));
      const writtenRecs = student.elpacHistory.filter(r => (r.part === 2 || r.part === 5 || r.part === 6) && (r.scaledScore || r.performanceLevel));

      const primarySeries = overallRecs.length > 0 ? overallRecs : student.elpacHistory.filter(r => r.scaledScore || r.performanceLevel);
      const latestOverall = primarySeries.length > 0 ? primarySeries[primarySeries.length - 1] : null;
      const prevOverall = primarySeries.length > 1 ? primarySeries[primarySeries.length - 2] : null;
      const overallDelta = (latestOverall && prevOverall && latestOverall.scaledScore && prevOverall.scaledScore)
        ? (latestOverall.scaledScore - prevOverall.scaledScore)
        : null;

      const latestOral = oralRecs.length > 0 ? oralRecs[oralRecs.length - 1] : null;
      const prevOral = oralRecs.length > 1 ? oralRecs[oralRecs.length - 2] : null;
      const oralDelta = (latestOral && prevOral && latestOral.scaledScore && prevOral.scaledScore)
        ? (latestOral.scaledScore - prevOral.scaledScore)
        : null;

      const latestWritten = writtenRecs.length > 0 ? writtenRecs[writtenRecs.length - 1] : null;
      const prevWritten = writtenRecs.length > 1 ? writtenRecs[writtenRecs.length - 2] : null;
      const writtenDelta = (latestWritten && prevWritten && latestWritten.scaledScore && prevWritten.scaledScore)
        ? (latestWritten.scaledScore - prevWritten.scaledScore)
        : null;

      student.latestOverall = latestOverall;
      student.latestOral = latestOral;
      student.latestWritten = latestWritten;
      student.overallDelta = overallDelta;
      student.oralDelta = oralDelta;
      student.writtenDelta = writtenDelta;

      // Compatibility fields
      student.latestEla = latestOverall;
      student.latestMath = latestOral || latestWritten;
      student.elaDelta = overallDelta;
      student.mathDelta = oralDelta !== null ? oralDelta : writtenDelta;

      allStudents.push(student);
    });

    // 5. Resolve User Role & Scope
    let role = 'SuperAdmin';
    let userSchool = 'ALL';
    let userName = rawEmail.split('@')[0];
    let filteredStudents = allStudents;

    if (rbacContext.superAdmins.has(rawEmail)) {
      role = 'SuperAdmin';
      userSchool = 'ALL';
    } else if (rbacContext.siteAdminMap.has(rawEmail)) {
      role = 'SiteAdmin';
      const sites = Array.from(rbacContext.siteAdminMap.get(rawEmail));
      userSchool = sites[0] || 'ALL';
      if (userSchool !== 'ALL') {
        filteredStudents = allStudents.filter(s => sites.some(site => s.school.toLowerCase().includes(site.toLowerCase()) || site.toLowerCase().includes(s.school.toLowerCase())));
      }
    } else {
      const staffMatches = allStudents.filter(s => s.staffEmail === rawEmail);
      if (staffMatches.length > 0) {
        const firstMatch = staffMatches[0];
        userName = firstMatch.staffName || userName;
        userSchool = firstMatch.school || 'ALL';
        role = firstMatch.gradeBand === 'Elementary' ? 'ElementaryTeacher' : 'Counselor';
      }
    }

    return jsonResponse({
      user: {
        email: rawEmail,
        name: userName,
        role,
        school: userSchool,
        authorized: true
      },
      students: filteredStudents,
      elpacRows: elpacData,
      rosterRows: rosterData,
      eldTabs
    });

  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

function extractStrictColumnAStudentId(row) {
  if (!Array.isArray(row) || row.length === 0) return '';
  const raw = (row[0] || '').toString().trim();
  if (!raw) return '';
  if (/^(?:student\s*id|id|local\s*id|stu\s*id|perm\s*id|ssid|state\s*id|student\s*#)$/i.test(raw)) {
    return '';
  }
  return raw.replace(/^#/, '').trim();
}

function detectAcademicYear(text, fallbackText) {
  const combined = ((text || '') + ' ' + (fallbackText || '')).trim();
  if (!combined) return null;

  const fullRange = combined.match(/\b(20\d{2})\s*[-–/]\s*(?:20)?(\d{2})\b/);
  if (fullRange) {
    const startYr = parseInt(fullRange[1], 10);
    return startYr + '-' + (startYr + 1);
  }

  const shortRange = combined.match(/(?:^|[^0-9])'?(\d{2})\s*[-–/]\s*'?(\d{2})(?:[^0-9]|$)/);
  if (shortRange) {
    const y1 = parseInt(shortRange[1], 10);
    const y2 = parseInt(shortRange[2], 10);
    if (y1 >= 18 && y1 <= 35 && y2 === y1 + 1) {
      return '20' + y1 + '-20' + y2;
    }
  }

  const singleYearMatch = combined.match(/\b(202[0-9])\b/);
  if (singleYearMatch) {
    const yr = parseInt(singleYearMatch[1], 10);
    const isFall = /\bfall\b|\bboy\b|\bsem(?:ester)?\s*1\b|\btri(?:mester)?\s*1\b|\bq1\b|\binitial\b|\bbaseline\b|\baug|\bsep|\boct|\bnov|\bdec/i.test(combined);
    return isFall ? yr + '-' + (yr + 1) : (yr - 1) + '-' + yr;
  }

  return null;
}

function detectTestWindow(headerText, dateOrValText) {
  const h = (headerText || '').toString().trim();
  const d = (dateOrValText || '').toString().trim();
  const combined = h + ' ' + d;

  if (/\bfall\b|\bboy\b|\bbeginning\b|\bsem(?:ester)?\s*1\b|\bs1\b|\btri(?:mester)?\s*1\b|\bt1\b|\bquarter\s*1\b|\bq1\b|\binitial\b|\bbaseline\b|\bpre-?test\b|\bdiagnostic\b/i.test(h)) {
    return { window: 'Fall', windowOrder: 1 };
  }
  if (/\bspring\b|\beoy\b|\bend\s*of\s*year\b|\bsem(?:ester)?\s*2\b|\bs2\b|\btri(?:mester)?\s*[23]\b|\bt[23]\b|\bquarter\s*[34]\b|\bq[34]\b|\bsummative\b|\bfinal\b|\bpost-?test\b|\bwinter\b|\bmoy\b/i.test(h)) {
    return { window: 'Spring', windowOrder: 2 };
  }
  if (/\bfall\b|\binitial\b|\bboy\b/i.test(d)) return { window: 'Fall', windowOrder: 1 };
  if (/\bspring\b|\bsummative\b|\beoy\b/i.test(d)) return { window: 'Spring', windowOrder: 2 };

  const usDateMatch = combined.match(/\b(\d{1,2})[/-]\d{1,2}[/-](?:\d{2}|\d{4})\b/);
  if (usDateMatch) {
    const month = parseInt(usDateMatch[1], 10);
    if (month >= 8 && month <= 12) return { window: 'Fall', windowOrder: 1 };
    if (month >= 1 && month <= 7) return { window: 'Spring', windowOrder: 2 };
  }

  return { window: null, windowOrder: 3 };
}

function detectDomainPart(headerText) {
  const h = (headerText || '').toString().toLowerCase();
  const explicitPart = h.match(/\bpart\s*([0-6])\b/) || h.match(/\bp([0-6])\b/);
  if (explicitPart) return parseInt(explicitPart[1], 10);
  if (/\blistening\b|\blist\b/.test(h)) return 3;
  if (/\bspeaking\b|\bspk\b/.test(h)) return 4;
  if (/\breading\b|\brd\b/.test(h)) return 5;
  if (/\bwriting\b|\bwrt\b/.test(h)) return 6;
  if (/\boral\b/.test(h)) return 1;
  if (/\bwritten\b/.test(h)) return 2;
  return 0;
}

function classifyColumnHeader(rawHeader, tabContext, colIndex) {
  const header = (rawHeader || '').toString().trim();
  if (colIndex === 0) {
    return { type: 'STUDENT_ID', header: header || 'Student ID', isStrictColumnA: true };
  }
  if (!header) return { type: 'IGNORE', header: '' };
  const lower = header.toLowerCase();

  if (/^(?:student\s*id|id|local\s*id|stu\s*id|perm\s*id|ssid|state\s*id|sis\s*id|row\s*id|guid|uuid)$/i.test(lower)) {
    return { type: 'IGNORE', header };
  }
  if (/^col(?:umn)?\s*[a-z0-9]+$/i.test(header) || /^unnamed/i.test(header)) {
    return { type: 'IGNORE', header };
  }

  const academicYear = detectAcademicYear(header, tabContext);
  const winInfo = detectTestWindow(header, '');
  const testWindow = winInfo.window;
  const windowOrder = winInfo.windowOrder;
  const part = detectDomainPart(header);

  if (/^(?:last\s*name|surname|student\s*last|last|lname|family\s*name)$/i.test(lower) || /\blast\s*name\b/i.test(lower)) return { type: 'LAST_NAME', header };
  if (/^(?:first\s*name|given\s*name|student\s*first|first|fname)$/i.test(lower) || /\bfirst\s*name\b/i.test(lower)) return { type: 'FIRST_NAME', header };
  if (/^(?:full\s*name|student\s*name|name|student|pupil\s*name)$/i.test(lower)) return { type: 'FULL_NAME', header };
  if (/\b(?:test\s*grade|assessed\s*grade|grade\s*assessed|elpac\s*grade|testing\s*grade)\b/i.test(lower)) return { type: 'TEST_GRADE', header, academicYear, testWindow };
  if (/^(?:grade|grade\s*level|gr|curr(?:ent)?\s*grade|stu\s*grade|enrolled\s*grade)$/i.test(lower)) return { type: 'GRADE', header };
  if (/^(?:gender|sex)$/i.test(lower)) return { type: 'GENDER', header };
  if (/^ethnicity$/i.test(lower) || /\bhispanic\b/i.test(lower)) return { type: 'ETHNICITY', header };
  if (/^race$/i.test(lower) || /\brace\/ethnicity\b/i.test(lower)) return { type: 'RACE', header };
  if (/\bparent\s*email\b|\bguardian\s*email\b|\bfamily\s*email\b/i.test(lower)) return { type: 'PARENT_EMAIL', header };
  if (/\bparent\s*phone\b|\bhome\s*phone\b|\bcontact\s*phone\b|\bguardian\s*phone\b|\bphone\b|\bcell\b/i.test(lower)) return { type: 'PARENT_PHONE', header };
  if (/\bparent\s*name\b|\bparent\/guardian\b|\bguardian\s*name\b|\bparent\b|\bguardian\b/i.test(lower)) return { type: 'PARENT_NAME', header };
  if (/^school\s*code$|^site\s*code$|^loc\s*code$/i.test(lower)) return { type: 'SCHOOL_CODE', header };
  if (/^(?:school|school\s*name|school\s*site|site|enrolled\s*school|home\s*school)$/i.test(lower)) return { type: 'SCHOOL_NAME', header };
  if (/^(?:site\s*name|routing\s*site|admin\s*site)$/i.test(lower)) return { type: 'SITE_ROUTING', header };
  if (/\badmin\s*access\b|\bsite\s*admin/i.test(lower)) return { type: 'SITE_ADMIN_EMAILS', header };
  if (/\bsuper\s*admin\b/i.test(lower)) return { type: 'SUPER_ADMIN_EMAILS', header };
  if (/\b(?:teacher|counselor|staff|educator|homeroom|advisor)\s*email\b/i.test(lower)) return { type: 'STAFF_EMAIL', header };
  if (/^(?:teacher|teacher\s*name|counselor|counselor\s*name|homeroom\s*teacher|eld\s*teacher|staff\s*name|staff|educator|advisor)$/i.test(lower)) return { type: 'STAFF_NAME', header };
  if (/^(?:sped|special\s*ed(?:ucation)?|iep|sped\s*flag|iep\s*status|swd)$/i.test(lower)) return { type: 'SPED', header };
  if (/^(?:504|504\s*plan|section\s*504|504\s*accommodations|plan\s*504)$/i.test(lower)) return { type: 'PLAN_504', header };
  if (/^(?:el\s*status|english\s*proficiency|language\s*fluency|el\s*proficiency|lep\s*status|lang(?:uage)?\s*status|el\s*code|ela\s*status)$/i.test(lower)) return { type: 'EL_STATUS', header };
  if (/\b(?:homeless|foster|mckinney|vento)\b/i.test(lower)) return { type: 'HOMELESS_FOSTER', header };

  if (/\b(?:comment|comments|note|notes|observation|observations|feedback|narrative|qualitative|rationale|teacher\s*input|counselor\s*note|eld\s*note|progress\s*note|remarks|annotation)\b/i.test(lower)) {
    return { type: 'TEACHER_COMMENT', header, academicYear, testWindow, windowOrder };
  }

  if (/^(?:test\s*id|testid|assessment\s*id|test\s*name|assessment\s*name|test\s*type|test\s*code|exam\s*id|administration|elpac\s*test|test)$/i.test(lower) || /\b(?:test\s*id|testid|assessment\s*id)\b/i.test(lower)) {
    return { type: 'ROW_TEST_ID', header };
  }
  if (/^(?:part|test\s*part|domain\s*part|subtest\s*part|part\s*#|part\s*number|elpac\s*part|domain|subtest|part\s*0-6|component)$/i.test(lower) || /\b(?:test\s*part|domain\s*part|subtest\s*part|part\s*number)\b/i.test(lower)) {
    return { type: 'ROW_PART', header };
  }
  if (/^(?:test\s*window|testing\s*window|window|interval|test\s*interval|term|semester|trimester|season|administration\s*window|test\s*cycle|cycle|period|admin\s*period)$/i.test(lower) || /\b(?:test(?:ing)?\s*window|admin(?:istration)?\s*window|test(?:ing)?\s*cycle)\b/i.test(lower)) {
    return { type: 'ROW_WINDOW', header, academicYear };
  }
  if (/^(?:academic\s*year|school\s*year|test\s*year|year|sy|admin\s*year|elpac\s*year)$/i.test(lower) || /\b(?:academic\s*year|school\s*year|test\s*year)\b/i.test(lower)) {
    return { type: 'ROW_YEAR', header };
  }
  if (/\b(?:date\s*taken|test\s*date|testing\s*date|administration\s*date|admin\s*date|date\s*tested|assessment\s*date|completed\s*date|test\s*dt|date)\b/i.test(lower)) {
    if (academicYear || testWindow) {
      return { type: 'ELD_DATE', header, academicYear, testWindow, windowOrder };
    }
    return { type: 'ROW_DATE', header };
  }

  const hasExplicitSeasonalWindow = /\b(?:fall|spring|winter|boy|moy|eoy|sem(?:ester)?\s*[12]|s[12]|tri(?:mester)?\s*[123]|t[123]|quarter\s*[1-4]|q[1-4]|pre-?test|post-?test)\b/i.test(lower);
  const hasExplicitScaleScore = /\b(?:scaled?\s*score|ss|scale\s*pts|raw\s*score|overall\s*score|oral\s*score|written\s*score|test\s*score)\b/i.test(lower) || /^(?:score|scaled|ss)$/i.test(lower);
  const hasExplicitLevel = /\b(?:perf(?:ormance)?\s*level|prof(?:iciency)?\s*level|overall\s*level|initial\s*level|summative\s*level|domain\s*level|eld\s*level|elpac\s*level|initial\s*proficiency|overall\s*proficiency|proficiency|level(?:\s*1\s*[-–—]\s*4)?|lvl|pl|tier)\b/i.test(lower) || /^(?:level|proficiency|performance|pl|lvl)$/i.test(lower);
  const hasEldOrDomainKeyword = /\b(?:score|level|proficiency|eld|elpac|overall|oral|written|listening|speaking|reading|writing|fall|spring|initial|summative|bridging|expanding|emerging|rubric|benchmark)\b/i.test(lower);

  if (hasExplicitScaleScore || hasExplicitLevel || hasEldOrDomainKeyword || academicYear) {
    const isDomainSpecific = part !== 0;
    if (!academicYear && !hasExplicitSeasonalWindow && !isDomainSpecific) {
      if (hasExplicitScaleScore && !hasExplicitLevel) {
        return { type: 'ROW_SCALED_SCORE', header };
      }
      if (hasExplicitLevel && !hasExplicitScaleScore) {
        return { type: 'ROW_PERF_LEVEL', header };
      }
    }
    return {
      type: hasExplicitScaleScore && !hasExplicitLevel ? 'ELD_SCALED_SCORE' : hasExplicitLevel && !hasExplicitScaleScore ? 'ELD_LEVEL' : 'ELD_SCORE_OR_LEVEL',
      header,
      academicYear,
      testWindow,
      windowOrder,
      part
    };
  }

  return { type: 'IGNORE', header };
}

function analyzeSheetHeaders(headerRow, tabName, isRosterFallback) {
  const columns = [];
  const hasHeaderKeywords = (headerRow || []).some(cell =>
    /\b(?:id|student|name|grade|level|score|eld|elpac|fall|spring|comment|note|teacher|counselor|school|site|part|date|window|proficiency|initial|overall|listening|speaking|reading|writing|oral|written)\b/i.test((cell || '').toString())
  );

  if (hasHeaderKeywords) {
    headerRow.forEach((cell, idx) => {
      const info = classifyColumnHeader(cell, tabName, idx);
      columns.push(Object.assign({}, info, { index: idx }));
    });
    return { hasHeaderRow: true, columns: columns };
  }

  const fallbackTypes = isRosterFallback
    ? ['STUDENT_ID', 'LAST_NAME', 'FIRST_NAME', 'FULL_NAME', 'GRADE', 'GENDER', 'ETHNICITY', 'RACE', 'PARENT_EMAIL', 'SCHOOL_CODE', 'STAFF_NAME', 'STAFF_EMAIL', 'PARENT_PHONE', 'PARENT_NAME', 'SCHOOL_NAME', 'GRADE', 'SPED', 'PLAN_504', 'EL_STATUS', 'HOMELESS_FOSTER', 'IGNORE', 'IGNORE', 'IGNORE', 'SITE_ROUTING', 'SITE_ADMIN_EMAILS', 'SUPER_ADMIN_EMAILS']
    : ['STUDENT_ID', 'LAST_NAME', 'FIRST_NAME', 'TEST_GRADE', 'ROW_TEST_ID', 'ROW_PART', 'ROW_DATE', 'ROW_SCALED_SCORE', 'ROW_PERF_LEVEL'];

  const maxCols = Math.max((headerRow || []).length, fallbackTypes.length);
  for (let idx = 0; idx < maxCols; idx++) {
    const type = idx === 0 ? 'STUDENT_ID' : (fallbackTypes[idx] || 'IGNORE');
    columns.push({ type: type, header: 'Col ' + idx, index: idx, isStrictColumnA: idx === 0 });
  }
  return { hasHeaderRow: false, columns: columns };
}

function ingestDynamicSheetTab(rows, tabName, studentsMap, rbacContext, isRosterTab) {
  if (!Array.isArray(rows) || rows.length === 0) return;

  const headerAnalysis = analyzeSheetHeaders(rows[0], tabName, isRosterTab);
  const hasHeaderRow = headerAnalysis.hasHeaderRow;
  const columns = headerAnalysis.columns;
  const startRow = hasHeaderRow ? 1 : 0;

  const hasRowFormatCols = columns.some(c =>
    ['ROW_TEST_ID', 'ROW_PART', 'ROW_SCALED_SCORE', 'ROW_PERF_LEVEL', 'ROW_DATE', 'ROW_WINDOW', 'ROW_YEAR'].indexOf(c.type) !== -1
  );

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;

    if (rbacContext) {
      let siteRoutingVal = '';
      const adminEmailsList = [];

      for (let c = 0; c < columns.length; c++) {
        const col = columns[c];
        const val = (row[col.index] || '').toString().trim();
        if (!val) continue;
        if (col.type === 'SUPER_ADMIN_EMAILS') {
          val.split(',').forEach(em => {
            const clean = em.toLowerCase().trim();
            if (clean && clean.indexOf('@') !== -1) rbacContext.superAdmins.add(clean);
          });
        } else if (col.type === 'SITE_ROUTING') {
          siteRoutingVal = val;
        } else if (col.type === 'SITE_ADMIN_EMAILS') {
          adminEmailsList.push(val);
        }
      }

      if (siteRoutingVal && adminEmailsList.length > 0) {
        adminEmailsList.join(',').split(',').forEach(em => {
          const clean = em.toLowerCase().trim();
          if (clean && clean.indexOf('@') !== -1) {
            if (!rbacContext.siteAdminMap.has(clean)) rbacContext.siteAdminMap.set(clean, new Set());
            rbacContext.siteAdminMap.get(clean).add(siteRoutingVal);
          }
        });
      }
    }

    // Strict Column A Student ID Binding
    const studentId = extractStrictColumnAStudentId(row);
    if (!studentId) continue;

    const getColVal = (type) => {
      const c = columns.find(col => col.type === type && (row[col.index] || '').toString().trim() !== '');
      return c ? (row[c.index] || '').toString().trim() : '';
    };

    const lastName = getColVal('LAST_NAME');
    const firstName = getColVal('FIRST_NAME');
    const fullNameRaw = getColVal('FULL_NAME');
    const gradeRaw = getColVal('GRADE');
    const testGradeRaw = getColVal('TEST_GRADE');
    const gender = getColVal('GENDER');
    const ethnicity = getColVal('ETHNICITY');
    const race = getColVal('RACE');
    const parentEmail = getColVal('PARENT_EMAIL');
    const parentPhone = getColVal('PARENT_PHONE');
    const parentName = getColVal('PARENT_NAME');
    const schoolCode = getColVal('SCHOOL_CODE');
    const schoolName = getColVal('SCHOOL_NAME');
    const staffName = getColVal('STAFF_NAME');
    const staffEmail = getColVal('STAFF_EMAIL').toLowerCase();
    const spedRaw = getColVal('SPED');
    const plan504Raw = getColVal('PLAN_504');
    const elStatusRaw = getColVal('EL_STATUS');
    const homelessFosterRaw = getColVal('HOMELESS_FOSTER');

    const effectiveGradeStr = gradeRaw || testGradeRaw;
    const gradeNum = effectiveGradeStr ? parseGradeNumber(effectiveGradeStr) : 5;

    if (!studentsMap.has(studentId)) {
      const fullName = fullNameRaw || (lastName && firstName ? (lastName + ', ' + firstName) : (firstName || lastName || ('Student #' + studentId)));
      const resolvedSchool = schoolName || 'WVUSD School';
      const gradeBand = getGradeBand(gradeNum, resolvedSchool);
      studentsMap.set(studentId, {
        studentId: studentId,
        lastName: lastName,
        firstName: firstName,
        name: fullName,
        grade: gradeNum,
        gradeLevel: effectiveGradeStr || '5',
        gradeBand: gradeBand,
        gender: gender,
        ethnicity: ethnicity,
        race: race,
        parentEmail: parentEmail,
        parentPhone: parentPhone,
        parentName: parentName,
        schoolCode: schoolCode,
        school: resolvedSchool,
        staffName: staffName || 'Unassigned',
        staffEmail: staffEmail,
        staffLabel: gradeBand === 'Elementary' ? 'Teacher' : 'Counselor',
        flags: {
          sped: false,
          plan504: false,
          elStatus: 'LEP',
          homelessFoster: false
        },
        elpacHistory: [],
        teacherComments: []
      });
    }

    const student = studentsMap.get(studentId);
    if (lastName) student.lastName = lastName;
    if (firstName) student.firstName = firstName;
    if (fullNameRaw) student.name = fullNameRaw;
    else if (student.lastName && student.firstName && student.name.indexOf('Student #') === 0) {
      student.name = student.lastName + ', ' + student.firstName;
    }
    if (gradeRaw) {
      student.grade = parseGradeNumber(gradeRaw);
      student.gradeLevel = gradeRaw;
    }
    if (schoolName) student.school = schoolName;
    student.gradeBand = getGradeBand(student.grade, student.school);
    student.staffLabel = student.gradeBand === 'Elementary' ? 'Teacher' : 'Counselor';

    if (gender) student.gender = gender;
    if (ethnicity) student.ethnicity = ethnicity;
    if (race) student.race = race;
    if (parentEmail) student.parentEmail = parentEmail;
    if (parentPhone) student.parentPhone = parentPhone;
    if (parentName) student.parentName = parentName;
    if (schoolCode) student.schoolCode = schoolCode;
    if (staffName) student.staffName = staffName;
    if (staffEmail) student.staffEmail = staffEmail;

    if (spedRaw) {
      student.flags.sped = isTruthyFlag(spedRaw);
      student.flags.spedRaw = spedRaw;
    }
    if (plan504Raw) {
      student.flags.plan504 = isTruthyFlag(plan504Raw);
      student.flags.plan504Raw = plan504Raw;
    }
    if (elStatusRaw) {
      student.flags.elStatus = normalizeElStatus(elStatusRaw);
      student.flags.elStatusRaw = elStatusRaw;
    }
    if (homelessFosterRaw) {
      student.flags.homelessFoster = isTruthyFlag(homelessFosterRaw);
      student.flags.homelessFosterRaw = homelessFosterRaw;
    }

    // 1. Long-format row record
    if (hasRowFormatCols) {
      const testGrade = testGradeRaw ? parseGradeNumber(testGradeRaw) : student.grade;
      const testId = getColVal('ROW_TEST_ID') || tabName || 'ELPAC';
      const partRaw = getColVal('ROW_PART');
      const partNum = (partRaw !== '' && !isNaN(Number(partRaw))) ? Number(partRaw) : detectDomainPart(partRaw + ' ' + testId);
      const dateTaken = getColVal('ROW_DATE');
      const rowWindow = getColVal('ROW_WINDOW');
      const rowYear = getColVal('ROW_YEAR');
      const scaledScoreRaw = getColVal('ROW_SCALED_SCORE');
      const rawLevel = getColVal('ROW_PERF_LEVEL');

      const scoreMatch = scaledScoreRaw.match(/\b(1[1-9]\d{2})\b/);
      const scaledScore = scoreMatch ? Number(scoreMatch[1]) : (scaledScoreRaw && !isNaN(Number(scaledScoreRaw)) && Number(scaledScoreRaw) > 100 ? Number(scaledScoreRaw) : null);
      const performanceLevel = parsePerformanceLevel(rawLevel || scaledScoreRaw, scaledScore, testGrade);

      if (scaledScore !== null || performanceLevel !== null) {
        const academicYear = detectAcademicYear(rowYear || testId, dateTaken + ' ' + tabName) || '2025-2026';
        const testWindow = detectTestWindow(rowWindow + ' ' + testId, dateTaken).window || 'Spring';
        const year = extractYear(dateTaken || academicYear);
        const rowCommentCols = columns.filter(c => c.type === 'TEACHER_COMMENT' && !c.academicYear && !c.testWindow);
        const rowComment = rowCommentCols.map(c => (row[c.index] || '').toString().trim()).filter(Boolean).join(' | ');

        student.elpacHistory.push({
          testGrade: testGrade,
          testId: testId,
          part: partNum,
          partRaw: partRaw || String(partNum),
          dateTaken: dateTaken,
          academicYear: academicYear,
          testWindow: testWindow,
          year: year,
          scaledScore: scaledScore,
          performanceLevel: performanceLevel,
          rawLevel: rawLevel || (performanceLevel ? ('Level ' + performanceLevel) : ''),
          teacherComment: rowComment || null
        });
      }
    }

    // 2. Wide multi-year ELD columns
    for (let c = 0; c < columns.length; c++) {
      const col = columns[c];
      const cellVal = (row[col.index] || '').toString().trim();
      if (!cellVal) continue;

      if (col.type === 'ELD_SCALED_SCORE' || col.type === 'ELD_LEVEL' || col.type === 'ELD_SCORE_OR_LEVEL') {
        const scoreMatch = cellVal.match(/\b(1[1-9]\d{2})\b/);
        const scaledScore = scoreMatch ? Number(scoreMatch[1]) : null;
        const performanceLevel = parsePerformanceLevel(cellVal, scaledScore, student.grade);
        if (scaledScore !== null || performanceLevel !== null) {
          const academicYear = col.academicYear || detectAcademicYear(col.header, tabName) || '2025-2026';
          const testWindow = col.testWindow || detectTestWindow(col.header, cellVal).window || 'Spring';
          const year = extractYear(academicYear);
          student.elpacHistory.push({
            testGrade: student.grade,
            testId: col.header || tabName,
            part: col.part || 0,
            partRaw: String(col.part || 0),
            dateTaken: testWindow + ' ' + year,
            academicYear: academicYear,
            testWindow: testWindow,
            year: year,
            scaledScore: scaledScore,
            performanceLevel: performanceLevel,
            rawLevel: performanceLevel ? ('Level ' + performanceLevel) : cellVal
          });
        }
      } else if (col.type === 'TEACHER_COMMENT' && (!hasRowFormatCols || col.academicYear || col.testWindow)) {
        const academicYear = col.academicYear || detectAcademicYear(col.header, tabName) || '2025-2026';
        const testWindow = col.testWindow || detectTestWindow(col.header, '').window || 'Spring';
        student.teacherComments.push({
          academicYear: academicYear,
          testWindow: testWindow,
          comment: cellVal,
          header: col.header
        });
      }
    }
  }
}

function parseGradeNumber(val) {
  const str = (val || '').toString().trim().toUpperCase();
  if (str === 'TK' || str === 'K' || str === 'KINDERGARTEN') return 0;
  const m = str.match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

function getGradeBand(gradeNum, schoolName) {
  const s = (schoolName || '').toLowerCase();
  if (s.includes('high') || s.includes('hockwalt')) return 'High';
  if (s.includes('middle') || s.includes('suzanne') || s.includes('chaparral') || s.includes('south pointe')) return 'Middle';
  if (s.includes('elementary')) return 'Elementary';
  if (gradeNum >= 9) return 'High';
  if (gradeNum >= 6) return 'Middle';
  return 'Elementary';
}

function isTruthyFlag(val) {
  if (!val) return false;
  const s = val.toString().trim().toLowerCase();
  return !['n', 'no', 'false', 'f', '0', 'none', '-'].includes(s);
}

function normalizeElStatus(val) {
  const s = (val || '').toString().trim().toUpperCase();
  if (!s) return '';
  if (s.includes('RFEP') || s.includes('REDESIGNATED')) return 'RFEP';
  if (s.includes('IFEP') || s.includes('INITIALLY')) return 'IFEP';
  if (s.includes('LEP') || s === 'EL' || s.includes('LEARNER') || s.includes('LIMITED')) return 'LEP';
  if (s === 'EO' || s.includes('ENGLISH ONLY')) return 'EO';
  return val.toString().trim();
}

function parsePerformanceLevel(rawLevel, scaledScore, grade) {
  const str = (rawLevel || '').toString().trim().toLowerCase();
  const m = str.match(/\b([1-4])\b/) || str.match(/level\s*([1-4])/i);
  if (m) return parseInt(m[1], 10);
  if (str.includes('well') || str.includes('ifep')) return 4;
  if (str.includes('moderately') || str.includes('intermediate')) return 3;
  if (str.includes('somewhat')) return 2;
  if (str.includes('minimally') || str.includes('novice')) return 1;
  return null;
}

function extractYear(dateStr) {
  const m = (dateStr || '').toString().match(/\b(20\d{2})\b/);
  return m ? parseInt(m[1], 10) : 2025;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

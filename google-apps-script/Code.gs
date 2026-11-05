/**
 * WVUSD ELPAC Longitudinal Data Portal — Google Apps Script Backend (Code.gs)
 *
 * Connected Google Sheet ID: 1JrSfw0pEvWNbkZ4nxgXJE2Vv30zkkbalpmHoojCLXXc
 *
 * Main Tabs:
 * - "Roster" (or "Roster Tab"):
 *     - Column A (Strictly bound): Student ID
 *     - Dynamically maps Student Name, Grade, School/Site, Teacher/Counselor Name & Email,
 *       Homeless/Foster, SPED, 504, EL Status, plus Site Admin routing (Cols O:P or X:Y)
 *       and SuperAdmin emails (Cell Q1 or Col Z).
 * - "ELPAC":
 *     - Column A (Strictly bound): Student ID
 *     - Dynamically inspects column headers (B+) regardless of column letter position:
 *       Test IDs, Parts (0–6 / Overall, Oral, Written, Listening, Speaking, Reading, Writing),
 *       Test Windows (Fall / Spring), Test Dates, Scaled Scores, Performance Levels (Level 1–4,
 *       Initial/Overall Proficiency), Multi-year ELD metrics (24-25, 25-26, 26-27), and Teacher Comments.
 * - "24-25 ELD", "25-26 ELD", "26-27 ELD" (and any additional assessment tabs):
 *     - Column A (Strictly bound): Student ID
 *     - Dynamically inspects all headers and attaches both structured longitudinal ELD records
 *       and `assessmentsByTab` / `metrics` maps (matching wvusd-data-portal).
 * - "Users" or "User" (Optional):
 *     - Cols A–D: Name, Email, Job Title, Site
 */

const SHEET_ID = '1JrSfw0pEvWNbkZ4nxgXJE2Vv30zkkbalpmHoojCLXXc';
const ELPAC_TAB_NAME = 'ELPAC';
const ROSTER_TAB_NAMES = ['Roster', 'Roster Tab'];
const ELD_MULTI_YEAR_TABS = ['24-25 ELD', '25-26 ELD', '26-27 ELD'];
const ALLOWED_DOMAINS = ['wvusd.org', 'sub.wvusd.org'];

// Demographic headers to skip when populating raw assessmentsByTab key-value maps
const SKIP_ASSESSMENT_MAP_HEADERS = new Set([
  'student id', 'id', 'local id', 'ssid', 'state student id',
  'last name', 'first name', 'middle name', 'full name', 'student name', 'name',
  'birth date', 'gender', 'sex', 'ethnicity', 'race',
  'enrollment site name', 'school', 'school name', 'school code'
]);

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  try {
    const params = (e && e.parameter) ? Object.assign({}, e.parameter) : {};
    if (e && e.postData && e.postData.contents) {
      try {
        const postData = JSON.parse(e.postData.contents);
        for (const k in postData) {
          params[k] = postData[k];
        }
      } catch (parseErr) {
        // Ignore non-JSON post body
      }
    }

    // Resolve user email from ?email=, ?id_token=, ?test_email=, or active Google session
    let userEmail = (params.email || '').toString().trim().toLowerCase();

    if (!userEmail && params.id_token) {
      userEmail = verifyIdToken_(params.id_token);
    }
    if (!userEmail && params.test_email) {
      userEmail = (params.test_email || '').toString().trim().toLowerCase();
    }
    if (!userEmail) {
      try {
        userEmail = Session.getActiveUser().getEmail().toLowerCase().trim();
      } catch (err) {
        // Ignore
      }
    }

    if (!isAllowedWvusdEmail_(userEmail)) {
      return jsonResponse({
        error: 'Unauthorized: Access restricted to @wvusd.org and @sub.wvusd.org staff accounts.',
        user: { email: userEmail, authorized: false }
      });
    }

    let ss;
    try {
      ss = SpreadsheetApp.openById(SHEET_ID);
    } catch (openErr) {
      ss = SpreadsheetApp.getActiveSpreadsheet();
    }

    // Locate Roster tab ("Roster" or "Roster Tab") and ELPAC tab ("ELPAC")
    let rosterSheet = null;
    for (let i = 0; i < ROSTER_TAB_NAMES.length; i++) {
      rosterSheet = ss.getSheetByName(ROSTER_TAB_NAMES[i]);
      if (rosterSheet) break;
    }
    const elpacSheet = ss.getSheetByName(ELPAC_TAB_NAME);
    const usersSheet = ss.getSheetByName('Users') || ss.getSheetByName('User');

    if (!rosterSheet && !elpacSheet) {
      return jsonResponse({
        error: "Missing required tabs: 'Roster' or 'ELPAC'."
      });
    }

    const rosterRows = rosterSheet ? rosterSheet.getDataRange().getValues() : [];
    const elpacRows = elpacSheet ? elpacSheet.getDataRange().getValues() : [];

    const rbacContext = {
      superAdmins: new Set(['kwendland@wvusd.org']),
      siteAdminMap: new Map()
    };

    // Pre-scan Roster!Q1 and Roster!O:P (standard WVUSD layout) as well as Roster!Z and Roster!X:Y
    extractStandardRosterRbac_(rosterRows, rbacContext);

    const studentsMap = new Map();

    // 1. Dynamically ingest Roster Tab (Strict Column A Student ID + dynamic header matching)
    if (rosterRows.length > 0) {
      ingestDynamicSheetTab(rosterRows, rosterSheet.getName(), studentsMap, rbacContext, true, ss);
    }

    // 2. Dynamically ingest Primary ELPAC Tab (Strict Column A Student ID + dynamic header matching)
    if (elpacRows.length > 0) {
      ingestDynamicSheetTab(elpacRows, ELPAC_TAB_NAME, studentsMap, rbacContext, false, ss);
    }

    // 3. Dynamically ingest any multi-year ELD Tabs ("24-25 ELD", "25-26 ELD", "26-27 ELD") or additional assessment tabs
    const allSheets = ss.getSheets();
    const availableTabs = [];
    for (let s = 0; s < allSheets.length; s++) {
      const sheetObj = allSheets[s];
      const tName = sheetObj.getName();
      const lowerT = tName.toLowerCase().trim();
      if (
        lowerT === 'roster' ||
        lowerT === 'roster tab' ||
        lowerT === 'users' ||
        lowerT === 'user' ||
        tName === ELPAC_TAB_NAME
      ) {
        if (tName === ELPAC_TAB_NAME) availableTabs.push(tName);
        continue;
      }
      const tabRows = sheetObj.getDataRange().getValues();
      if (tabRows && tabRows.length > 1) {
        availableTabs.push(tName);
        ingestDynamicSheetTab(tabRows, tName, studentsMap, rbacContext, false, ss);
      }
    }

    // 4. Finalize longitudinal histories, latest scores, growth deltas, and multi-year ELD matrices
    const allStudents = [];
    for (const student of studentsMap.values()) {
      student.elpacHistory.sort((a, b) => {
        if ((a.year || 0) !== (b.year || 0)) return (a.year || 0) - (b.year || 0);
        if ((a.part ?? 0) !== (b.part ?? 0)) return (a.part ?? 0) - (b.part ?? 0);
        return String(a.dateTaken || '').localeCompare(String(b.dateTaken || ''));
      });

      const overallRecs = student.elpacHistory.filter(
        r => r.part === 0 && (r.scaledScore !== null || r.performanceLevel !== null)
      );
      const oralRecs = student.elpacHistory.filter(
        r => (r.part === 1 || r.part === 3 || r.part === 4) && (r.scaledScore !== null || r.performanceLevel !== null)
      );
      const writtenRecs = student.elpacHistory.filter(
        r => (r.part === 2 || r.part === 5 || r.part === 6) && (r.scaledScore !== null || r.performanceLevel !== null)
      );

      const primaryOverall = overallRecs.length > 0 ? overallRecs : student.elpacHistory;
      const latestOverall = primaryOverall.length > 0 ? primaryOverall[primaryOverall.length - 1] : null;
      const prevOverall = primaryOverall.length > 1 ? primaryOverall[primaryOverall.length - 2] : null;
      const overallDelta =
        latestOverall && prevOverall && latestOverall.scaledScore && prevOverall.scaledScore
          ? latestOverall.scaledScore - prevOverall.scaledScore
          : null;

      const latestOral = oralRecs.length > 0 ? oralRecs[oralRecs.length - 1] : null;
      const prevOral = oralRecs.length > 1 ? oralRecs[oralRecs.length - 2] : null;
      const oralDelta =
        latestOral && prevOral && latestOral.scaledScore && prevOral.scaledScore
          ? latestOral.scaledScore - prevOral.scaledScore
          : null;

      const latestWritten = writtenRecs.length > 0 ? writtenRecs[writtenRecs.length - 1] : null;
      const prevWritten = writtenRecs.length > 1 ? writtenRecs[writtenRecs.length - 2] : null;
      const writtenDelta =
        latestWritten && prevWritten && latestWritten.scaledScore && prevWritten.scaledScore
          ? latestWritten.scaledScore - prevWritten.scaledScore
          : null;

      const partsLatest = {};
      student.elpacHistory.forEach(r => {
        partsLatest[r.part] = r;
      });

      student.overallHistory = primaryOverall;
      student.oralHistory = oralRecs;
      student.writtenHistory = writtenRecs;
      student.partsLatest = partsLatest;
      student.latestOverall = latestOverall;
      student.latestOral = latestOral;
      student.latestWritten = latestWritten;
      student.overallDelta = overallDelta;
      student.oralDelta = oralDelta;
      student.writtenDelta = writtenDelta;

      // Shared component aliases (matching wvusd-sbac-portal)
      student.elaHistory = primaryOverall;
      student.mathHistory = oralRecs.length > 0 ? oralRecs : writtenRecs;
      student.latestEla = latestOverall;
      student.latestMath = latestOral || latestWritten || latestOverall;
      student.elaDelta = overallDelta;
      student.mathDelta = oralDelta !== null ? oralDelta : writtenDelta;

      allStudents.push(student);
    }

    // 5. Resolve RBAC User Role & Scope Students (SuperAdmin -> SiteAdmin -> Roster Teacher/Counselor -> Users Tab)
    const userAccess = resolveUserAccess_(userEmail, allStudents, rbacContext, usersSheet);
    if (!userAccess.authorized) {
      return jsonResponse({
        error: 'Account not found in Roster or Users directory. Contact Tech TOSA for access.',
        user: userAccess
      });
    }

    const scopedStudents = allStudents.filter(st => canViewStudent_(userAccess, st));

    return jsonResponse({
      user: userAccess,
      meta: {
        totalStudents: scopedStudents.length,
        assessmentTabs: availableTabs,
        lastUpdated: new Date().toISOString()
      },
      students: scopedStudents
    });
  } catch (err) {
    return jsonResponse({
      error: 'Server Error: ' + (err && err.message ? err.message : String(err))
    });
  }
}

// ============================================================================
// RBAC & AUTHENTICATION HELPERS (Matches wvusd-sbac-portal & wvusd-data-portal)
// ============================================================================

function isAllowedWvusdEmail_(email) {
  if (!email) return false;
  const clean = String(email).toLowerCase().trim();
  const parts = clean.split('@');
  if (parts.length !== 2) return false;
  if (parts[1] === 'stu.wvusd.org') return false;
  return ALLOWED_DOMAINS.indexOf(parts[1]) !== -1;
}

function verifyIdToken_(idToken) {
  const response = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true }
  );
  if (response.getResponseCode() !== 200) {
    throw new Error('Expired or invalid Google Sign-In token.');
  }
  const data = JSON.parse(response.getContentText());
  if (!data.email || data.email_verified !== 'true') {
    throw new Error('Could not verify Google account email.');
  }
  return data.email.toLowerCase().trim();
}

function parseEmailList_(rawCell) {
  if (!rawCell) return [];
  return String(rawCell)
    .split(/[,;\n]+/)
    .map(e => e.toLowerCase().trim())
    .filter(e => e.indexOf('@') !== -1);
}

/**
 * Extracts SuperAdmin emails from Roster!Q1 (index 16) and Site Admin routing from Roster!O:P (indices 14 & 15),
 * in addition to Roster!Z (index 25) and Roster!X:Y (indices 23 & 24).
 */
function extractStandardRosterRbac_(rosterRows, rbacContext) {
  if (!Array.isArray(rosterRows) || rosterRows.length === 0) return;

  // Check Q1 (row 0, col 16) and Q2 (row 1, col 16) for SuperAdmin emails (matching SBAC & Data Portal)
  for (let r = 0; r < Math.min(2, rosterRows.length); r++) {
    if (rosterRows[r] && rosterRows[r].length > 16) {
      parseEmailList_(rosterRows[r][16]).forEach(em => rbacContext.superAdmins.add(em));
    }
    if (rosterRows[r] && rosterRows[r].length > 25) {
      parseEmailList_(rosterRows[r][25]).forEach(em => rbacContext.superAdmins.add(em));
    }
  }

  // Check X:Y (cols 23 & 24) on wide Roster layouts, or O:P (cols 14 & 15) on compact 17-column layouts
  for (let i = 1; i < rosterRows.length; i++) {
    const row = rosterRows[i];
    if (!row) continue;

    if (row.length <= 20 && row.length > 15) {
      const siteO = String(row[14] || '').trim();
      const emailsP = parseEmailList_(row[15]);
      if (siteO && emailsP.length > 0) {
        emailsP.forEach(em => {
          if (!rbacContext.siteAdminMap.has(em)) rbacContext.siteAdminMap.set(em, new Set());
          rbacContext.siteAdminMap.get(em).add(siteO);
        });
      }
    }

    if (row.length > 24) {
      const siteX = String(row[23] || '').trim();
      const emailsY = parseEmailList_(row[24]);
      if (siteX && emailsY.length > 0) {
        emailsY.forEach(em => {
          if (!rbacContext.siteAdminMap.has(em)) rbacContext.siteAdminMap.set(em, new Set());
          rbacContext.siteAdminMap.get(em).add(siteX);
        });
      }
    }
  }
}

function resolveUserAccess_(email, allStudents, rbacContext, usersSheet) {
  // 1. SuperAdmin check
  if (rbacContext.superAdmins.has(email) || email === 'kwendland@wvusd.org') {
    return {
      email: email,
      name: 'Super Admin',
      role: 'SuperAdmin',
      school: 'ALL',
      authorized: true
    };
  }

  // 2. Site Admin / Specialist check
  if (rbacContext.siteAdminMap.has(email)) {
    const allowedSites = Array.from(rbacContext.siteAdminMap.get(email));
    return {
      email: email,
      name: 'Site Admin / Specialist',
      role: 'SiteAdmin',
      school: allowedSites.join(','),
      assignedSites: allowedSites,
      authorized: true
    };
  }

  // 3. Roster Teacher / Counselor match
  const matchedRoster = allStudents.filter(s => {
    if (!s.staffEmail) return false;
    const list = parseEmailList_(s.staffEmail);
    return list.indexOf(email) !== -1;
  });

  if (matchedRoster.length > 0) {
    const sample = matchedRoster[0];
    return {
      email: email,
      name: sample.staffName || email.split('@')[0],
      role: sample.gradeBand === 'Elementary' ? 'ElementaryTeacher' : 'Counselor',
      school: sample.school || 'ALL',
      authorized: true
    };
  }

  // 4. "Users" / "User" Tab check (A: Name | B: Email | C: Job Title | D: Site)
  if (usersSheet) {
    const uData = usersSheet.getDataRange().getValues();
    for (let k = 1; k < uData.length; k++) {
      const uName = String(uData[k][0] || '').trim();
      const uEmail = String(uData[k][1] || '').trim().toLowerCase();
      const uTitle = String(uData[k][2] || 'Teacher').trim();
      const uSite = String(uData[k][3] || '').trim();

      if (uEmail === email) {
        return {
          email: email,
          name: uName || email.split('@')[0],
          jobTitle: uTitle,
          role: 'SecondaryOrSiteTeacher',
          school: uSite || 'ALL',
          authorized: true
        };
      }
    }
  }

  return { email: email, authorized: false };
}

function canViewStudent_(userAccess, student) {
  if (userAccess.role === 'SuperAdmin' || userAccess.school === 'ALL') return true;

  if (userAccess.role === 'ElementaryTeacher') {
    const staffEmails = parseEmailList_(student.staffEmail);
    return staffEmails.indexOf(userAccess.email) !== -1;
  }

  const allowedSites = String(userAccess.school || '')
    .toLowerCase()
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const studentSchool = String(student.school || '').toLowerCase().trim();
  return allowedSites.some(
    site => studentSchool.indexOf(site) !== -1 || site.indexOf(studentSchool) !== -1
  );
}

// ============================================================================
// STRICT COLUMN A ID BINDING & DYNAMIC HEADER INSPECTION ENGINE
// ============================================================================

/**
 * Strictly extracts and normalizes the unique Student ID from Column A (index 0).
 * Normalizes trailing ".0" or leading "#" so IDs across Roster and ELPAC always match.
 */
function extractStrictColumnAStudentId(row) {
  if (!Array.isArray(row) || row.length === 0) return '';
  const raw = (row[0] !== null && row[0] !== undefined ? row[0] : '').toString().trim();
  if (!raw) return '';
  if (/^(?:student\s*id|id|local\s*id|stu\s*id|perm\s*id|ssid|state\s*id|student\s*#)$/i.test(raw)) {
    return '';
  }
  const stripped = raw.replace(/^#/, '').replace(/\.0+$/, '').replace(/^0+/, '').trim();
  return stripped || (raw === '0' ? '0' : '');
}

function isRawSchoolCodeOrPlaceholder_(val) {
  const s = (val !== null && val !== undefined ? val : '').toString().trim();
  if (!s) return true;
  if (/^(?:wvusd\s*school|all|unknown|unassigned|n\/a|none|-|\d+)$/i.test(s)) return true;
  if (/^[a-z0-9]{2,5}$/i.test(s)) return true;
  return false;
}

function detectAcademicYear(headerText, fallbackContext) {
  const combined = ((headerText || '') + ' ' + (fallbackContext || '')).toLowerCase();
  if (/\b2024\s*[-/–]\s*(?:20)?25\b|\b24\s*[-/–]\s*25\b|\bsy\s*24\b|\b24_25\b/.test(combined)) return '2024-2025';
  if (/\b2025\s*[-/–]\s*(?:20)?26\b|\b25\s*[-/–]\s*26\b|\bsy\s*25\b|\b25_26\b/.test(combined)) return '2025-2026';
  if (/\b2026\s*[-/–]\s*(?:20)?27\b|\b26\s*[-/–]\s*27\b|\bsy\s*26\b|\b26_27\b/.test(combined)) return '2026-2027';
  if (/\b2023\s*[-/–]\s*(?:20)?24\b|\b23\s*[-/–]\s*24\b|\bsy\s*23\b|\b23_24\b/.test(combined)) return '2023-2024';
  return null;
}

function detectTestWindow(headerText, dateText) {
  const h = (headerText || '').toString().toLowerCase();
  const d = (dateText || '').toString().toLowerCase();
  const combined = h + ' ' + d;

  if (/\bfall\b|\bboy\b|\bbeginning\b|\bsem(?:ester)?\s*1\b|\bs1\b|\btri(?:mester)?\s*1\b|\bt1\b|\bquarter\s*1\b|\bq1\b|\binitial\b|\bbaseline\b|\bpre-?test\b/.test(h)) {
    return { window: 'Fall', windowOrder: 1 };
  }
  if (/\bspring\b|\beoy\b|\bend\s*of\s*year\b|\bsem(?:ester)?\s*2\b|\bs2\b|\btri(?:mester)?\s*[23]\b|\bt[23]\b|\bquarter\s*[34]\b|\bq[34]\b|\bsummative\b|\bfinal\b|\bpost-?test\b|\bwinter\b|\bmoy\b/.test(h)) {
    return { window: 'Spring', windowOrder: 2 };
  }
  if (/\bfall\b|\binitial\b|\bboy\b/.test(d)) return { window: 'Fall', windowOrder: 1 };
  if (/\bspring\b|\bsummative\b|\beoy\b/.test(d)) return { window: 'Spring', windowOrder: 2 };

  const usDate = combined.match(/\b(\d{1,2})[/-]\d{1,2}[/-](?:\d{2}|\d{4})\b/);
  if (usDate) {
    const m = parseInt(usDate[1], 10);
    if (m >= 8 && m <= 12) return { window: 'Fall', windowOrder: 1 };
    if (m >= 1 && m <= 7) return { window: 'Spring', windowOrder: 2 };
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

function parsePartValue(rawPartVal, fallbackHeader) {
  if (rawPartVal === null || rawPartVal === undefined || rawPartVal === '') {
    return detectDomainPart(fallbackHeader);
  }
  const str = String(rawPartVal).trim();
  if (/^[0-6]$/.test(str)) return parseInt(str, 10);
  const numPrefix = str.match(/^([0-6])\b/) || str.match(/\bpart\s*([0-6])\b/i);
  if (numPrefix) return parseInt(numPrefix[1], 10);
  return detectDomainPart(str + ' ' + (fallbackHeader || ''));
}

function classifyColumnHeader(rawHeader, tabContext, colIndex) {
  const header = (rawHeader || '').toString().trim();

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

  // Ignore secondary ID columns in B+ so they never override Column A
  if (/^(?:student\s*id|id|local\s*id|stu\s*id|perm\s*id|ssid|state\s*id|sis\s*id|row\s*id|guid|uuid)$/i.test(lower)) {
    return { type: 'IGNORE', header: header };
  }

  if (/^col(?:umn)?\s*[a-z0-9]+$/i.test(header) || /^unnamed/i.test(header)) {
    return { type: 'IGNORE', header: header };
  }

  const academicYear = detectAcademicYear(header, tabContext);
  const winInfo = detectTestWindow(header, '');
  const testWindow = winInfo.window;
  const windowOrder = winInfo.windowOrder;
  const part = detectDomainPart(header);

  if (/^(?:last\s*name|surname|student\s*last|last|lname|family\s*name)$/i.test(lower) || /\blast\s*name\b/i.test(lower)) return { type: 'LAST_NAME', header: header };
  if (/^(?:first\s*name|given\s*name|student\s*first|first|fname)$/i.test(lower) || /\bfirst\s*name\b/i.test(lower)) return { type: 'FIRST_NAME', header: header };
  if (/^(?:full\s*name|student\s*name|name|student|pupil\s*name)$/i.test(lower)) return { type: 'FULL_NAME', header: header };
  if (/\b(?:test\s*grade|assessed\s*grade|grade\s*assessed|elpac\s*grade|testing\s*grade)\b/i.test(lower)) return { type: 'TEST_GRADE', header: header, academicYear: academicYear, testWindow: testWindow };
  if (/^(?:grade|grade\s*level|gr|curr(?:ent)?\s*grade|stu\s*grade|enrolled\s*grade)$/i.test(lower)) return { type: 'GRADE', header: header };
  if (/^(?:gender|sex)$/i.test(lower)) return { type: 'GENDER', header: header };
  if (/^ethnicity$/i.test(lower) || /\bhispanic\b/i.test(lower)) return { type: 'ETHNICITY', header: header };
  if (/^race$/i.test(lower) || /\brace\/ethnicity\b/i.test(lower)) return { type: 'RACE', header: header };
  if (/\bparent\s*email\b|\bguardian\s*email\b|\bfamily\s*email\b/i.test(lower)) return { type: 'PARENT_EMAIL', header: header };
  if (/\bparent\s*phone\b|\bhome\s*phone\b|\bcontact\s*phone\b|\bguardian\s*phone\b|\bphone\b|\bcell\b/i.test(lower)) return { type: 'PARENT_PHONE', header: header };
  if (/\bparent\s*name\b|\bparent\/guardian\b|\bguardian\s*name\b|\bparent\b|\bguardian\b/i.test(lower)) return { type: 'PARENT_NAME', header: header };
  if (/^school\s*code$|^site\s*code$|^loc\s*code$/i.test(lower)) return { type: 'SCHOOL_CODE', header: header };
  if (/^(?:school|school\s*name|school\s*site|site|enrolled\s*school|home\s*school|enrollment\s*site\s*name)$/i.test(lower)) {
    const isRosterTabContext = /^roster(?:\s*tab)?$/i.test((tabContext || '').toString().trim());
    // Rule: Exclusive use of Column O (index 14) on the Roster tab for School Name.
    // Column J (index 9) on Roster or any "School" column on non-Roster tabs is treated as SCHOOL_CODE, never SCHOOL_NAME.
    if (isRosterTabContext && colIndex === 14) {
      return { type: 'SCHOOL_NAME', header: header };
    }
    if (isRosterTabContext && colIndex !== 14) {
      return { type: 'SCHOOL_CODE', header: header };
    }
    if (!isRosterTabContext) {
      return { type: 'SCHOOL_CODE', header: header };
    }
    return { type: 'SCHOOL_NAME', header: header };
  }
  if (/^(?:site\s*name|routing\s*site|admin\s*site)$/i.test(lower)) return { type: 'SITE_ROUTING', header: header };
  if (/\badmin\s*access\b|\bsite\s*admin|\badmin\s*email/i.test(lower)) return { type: 'SITE_ADMIN_EMAILS', header: header };
  if (/\bsuper\s*admin\b/i.test(lower)) return { type: 'SUPER_ADMIN_EMAILS', header: header };
  if (/\b(?:teacher|counselor|staff|educator|homeroom|advisor)\s*email/i.test(lower)) return { type: 'STAFF_EMAIL', header: header };
  if (/^(?:teacher|teacher\s*name|counselor|counselor\s*name|teacher\/counselor\s*name|homeroom\s*teacher|eld\s*teacher|staff\s*name|staff|educator|advisor)$/i.test(lower)) return { type: 'STAFF_NAME', header: header };
  if (/^(?:sped|special\s*ed(?:ucation)?|iep|sped\s*flag|iep\s*status|swd|student\s*is\s*special\s*ed\??)$/i.test(lower)) return { type: 'SPED', header: header };
  if (/^(?:504|504\s*plan|section\s*504|504\s*accommodations|plan\s*504)$/i.test(lower)) return { type: 'PLAN_504', header: header };
  if (/^(?:el\s*status|el|english\s*proficiency|language\s*fluency|el\s*proficiency|lep\s*status|lang(?:uage)?\s*status|el\s*code|ela\s*status)$/i.test(lower)) return { type: 'EL_STATUS', header: header };
  if (/\b(?:homeless|foster|mckinney|vento)\b/i.test(lower)) return { type: 'HOMELESS_FOSTER', header: header };

  if (/\b(?:comment|comments|note|notes|observation|observations|feedback|narrative|qualitative|rationale|teacher\s*input|counselor\s*note|eld\s*note|progress\s*note|remarks|annotation)\b/i.test(lower)) {
    return { type: 'TEACHER_COMMENT', header: header, academicYear: academicYear, testWindow: testWindow, windowOrder: windowOrder };
  }

  if (/^(?:test\s*id|testid|assessment\s*id|test\s*name|assessment\s*name|test\s*type|test\s*code|exam\s*id|administration|elpac\s*test|test)$/i.test(lower) || /\b(?:test\s*id|testid|assessment\s*id)\b/i.test(lower)) {
    return { type: 'ROW_TEST_ID', header: header };
  }
  if (/^(?:part|test\s*part|domain\s*part|subtest\s*part|part\s*#|part\s*number|elpac\s*part|domain|subtest|part\s*0-6|component)$/i.test(lower) || /\b(?:test\s*part|domain\s*part|subtest\s*part|part\s*number)\b/i.test(lower)) {
    return { type: 'ROW_PART', header: header };
  }
  if (/^(?:test\s*window|testing\s*window|window|interval|test\s*interval|term|semester|trimester|season|administration\s*window|test\s*cycle|cycle|period|admin\s*period)$/i.test(lower) || /\b(?:test(?:ing)?\s*window|admin(?:istration)?\s*window|test(?:ing)?\s*cycle)\b/i.test(lower)) {
    return { type: 'ROW_WINDOW', header: header, academicYear: academicYear };
  }
  if (/^(?:academic\s*year|school\s*year|test\s*year|year|sy|admin\s*year|elpac\s*year)$/i.test(lower) || /\b(?:academic\s*year|school\s*year|test\s*year)\b/i.test(lower)) {
    return { type: 'ROW_YEAR', header: header };
  }
  if (/\b(?:date\s*taken|test\s*date|testing\s*date|administration\s*date|admin\s*date|date\s*tested|assessment\s*date|completed\s*date|test\s*dt|date)\b/i.test(lower)) {
    if (academicYear || testWindow) {
      return { type: 'ELD_DATE', header: header, academicYear: academicYear, testWindow: testWindow, windowOrder: windowOrder };
    }
    return { type: 'ROW_DATE', header: header };
  }

  const hasExplicitSeasonalWindow = /\b(?:fall|spring|winter|boy|moy|eoy|sem(?:ester)?\s*[12]|s[12]|tri(?:mester)?\s*[123]|t[123]|quarter\s*[1-4]|q[1-4]|pre-?test|post-?test)\b/i.test(lower);
  const hasExplicitScaleScore = /\b(?:scaled?\s*score|ss|scale\s*pts|raw\s*score|overall\s*score|oral\s*score|written\s*score|test\s*score|scaledscore)\b/i.test(lower) || /^(?:score|scaled|ss)$/i.test(lower);
  const hasExplicitLevel = /\b(?:perf(?:ormance)?\s*level|perflvl|prof(?:iciency)?\s*level|overall\s*level|initial\s*level|summative\s*level|domain\s*level|eld\s*level|elpac\s*level|initial\s*proficiency|overall\s*proficiency|proficiency|level(?:\s*1\s*[-–—]\s*4)?|lvl|pl|tier)\b/i.test(lower) || /^(?:level|proficiency|performance|pl|lvl)$/i.test(lower);
  const hasEldOrDomainKeyword = /\b(?:score|level|proficiency|eld|elpac|overall|oral|written|listening|speaking|reading|writing|fall|spring|initial|summative|bridging|expanding|emerging|rubric|benchmark)\b/i.test(lower);

  if (hasExplicitScaleScore || hasExplicitLevel || hasEldOrDomainKeyword || academicYear) {
    const isDomainSpecific = part !== 0;
    if (!academicYear && !hasExplicitSeasonalWindow && !isDomainSpecific) {
      if (hasExplicitScaleScore && !hasExplicitLevel) {
        return { type: 'ROW_SCALED_SCORE', header: header };
      }
      if (hasExplicitLevel && !hasExplicitScaleScore) {
        return { type: 'ROW_PERF_LEVEL', header: header };
      }
    }
    return {
      type: hasExplicitScaleScore && !hasExplicitLevel ? 'ELD_SCALED_SCORE' : hasExplicitLevel && !hasExplicitScaleScore ? 'ELD_LEVEL' : 'ELD_SCORE_OR_LEVEL',
      header: header,
      academicYear: academicYear,
      testWindow: testWindow,
      windowOrder: windowOrder,
      part: part
    };
  }

  return { type: 'IGNORE', header: header };
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

  // Fallback only if Row 0 has no header strings at all
  const fallbackTypes = isRosterFallback
    ? ['STUDENT_ID', 'FULL_NAME', 'GRADE', 'SCHOOL_NAME', 'STAFF_NAME', 'STAFF_EMAIL', 'HOMELESS_FOSTER', 'SPED', 'PLAN_504', 'EL_STATUS', 'IGNORE', 'IGNORE', 'IGNORE', 'IGNORE', 'SITE_ROUTING', 'SITE_ADMIN_EMAILS', 'SUPER_ADMIN_EMAILS']
    : ['STUDENT_ID', 'LAST_NAME', 'FIRST_NAME', 'TEST_GRADE', 'ROW_TEST_ID', 'ROW_PART', 'ROW_DATE', 'ROW_SCALED_SCORE', 'ROW_PERF_LEVEL'];

  const maxCols = Math.max((headerRow || []).length, fallbackTypes.length);
  for (let idx = 0; idx < maxCols; idx++) {
    const type = idx === 0 ? 'STUDENT_ID' : (fallbackTypes[idx] || 'IGNORE');
    columns.push({ type: type, header: 'Col ' + idx, index: idx, isStrictColumnA: idx === 0 });
  }
  return { hasHeaderRow: false, columns: columns };
}

function ingestDynamicSheetTab(rows, tabName, studentsMap, rbacContext, isRosterTab, ss) {
  if (!Array.isArray(rows) || rows.length === 0) return;

  // Locate header row within first 5 rows (matching wvusd-data-portal)
  let headerRowIdx = 0;
  for (let r = 0; r < Math.min(5, rows.length); r++) {
    const colA = String(rows[r][0] || '').toLowerCase().trim();
    if (colA.indexOf('id') !== -1 || colA.indexOf('student') !== -1) {
      headerRowIdx = r;
      break;
    }
  }

  const headerAnalysis = analyzeSheetHeaders(rows[headerRowIdx], tabName, isRosterTab);
  const hasHeaderRow = headerAnalysis.hasHeaderRow;
  const columns = headerAnalysis.columns;
  const startRow = hasHeaderRow ? headerRowIdx + 1 : 0;
  const tz = ss ? ss.getSpreadsheetTimeZone() : Session.getScriptTimeZone();

  const hasRowFormatCols = columns.some(c =>
    ['ROW_TEST_ID', 'ROW_PART', 'ROW_SCALED_SCORE', 'ROW_PERF_LEVEL', 'ROW_DATE', 'ROW_WINDOW', 'ROW_YEAR'].indexOf(c.type) !== -1
  );

  // When Roster has already been ingested, non-Roster tabs ("ELPAC", "24-25 ELD", etc.)
  // strictly link to active Roster students by Column A Student ID and never create orphan records.
  const hasRosterStudents = !isRosterTab && studentsMap.size > 0;

  for (let i = startRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;

    // Extract dynamic RBAC columns if present on Roster
    if (rbacContext && isRosterTab) {
      let siteRoutingVal = '';
      const adminEmailsList = [];

      for (let c = 0; c < columns.length; c++) {
        const col = columns[c];
        const val = (row[col.index] || '').toString().trim();
        if (!val) continue;
        if (col.type === 'SUPER_ADMIN_EMAILS') {
          parseEmailList_(val).forEach(em => rbacContext.superAdmins.add(em));
        } else if (col.type === 'SITE_ROUTING') {
          siteRoutingVal = val;
        } else if (col.type === 'SITE_ADMIN_EMAILS') {
          adminEmailsList.push(val);
        }
      }

      if (siteRoutingVal && adminEmailsList.length > 0) {
        parseEmailList_(adminEmailsList.join(',')).forEach(em => {
          if (!rbacContext.siteAdminMap.has(em)) rbacContext.siteAdminMap.set(em, new Set());
          rbacContext.siteAdminMap.get(em).add(siteRoutingVal);
        });
      }
    }

    // Rule 1: Strict Column A Student ID Binding
    const studentId = extractStrictColumnAStudentId(row);
    if (!studentId) continue;

    // On non-Roster tabs (e.g. ELPAC), link strictly to active Roster students
    if (hasRosterStudents && !studentsMap.has(studentId)) {
      continue;
    }

    const formatCellVal = (rawCell) => {
      if (rawCell === null || rawCell === undefined || rawCell === '') return '';
      if (rawCell instanceof Date) {
        return Utilities.formatDate(rawCell, tz, 'MM/dd/yyyy');
      }
      return String(rawCell).trim();
    };

    const getColVal = (type) => {
      const c = columns.find(col => col.type === type && formatCellVal(row[col.index]) !== '');
      return c ? formatCellVal(row[c.index]) : '';
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
    const schoolCode = isRosterTab
      ? (row.length > 9 && isRawSchoolCodeOrPlaceholder_(row[9]) ? formatCellVal(row[9]) : getColVal('SCHOOL_CODE'))
      : '';

    // Rule: Exclusive use of Column O (index 14) on the Roster tab for School Name.
    // Non-Roster tabs (ELPAC, 24-25 ELD, etc.) NEVER set or overwrite student.school.
    let schoolName = '';
    if (isRosterTab) {
      const colOSchoolName = row.length > 14 ? formatCellVal(row[14]) : '';
      const candidateSchool = colOSchoolName || (row.length <= 14 ? getColVal('SCHOOL_NAME') : '');
      if (candidateSchool && !isRawSchoolCodeOrPlaceholder_(candidateSchool)) {
        schoolName = candidateSchool;
      }
    }

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
      const resolvedSchool = schoolName || '';
      const gradeBand = getGradeBand(gradeNum, resolvedSchool);
      studentsMap.set(studentId, {
        id: studentId,
        studentId: studentId,
        isFromRoster: isRosterTab,
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
        site: resolvedSchool,
        staffName: staffName || 'Unassigned',
        teacherName: staffName || 'Unassigned',
        staffEmail: staffEmail,
        teacherEmail: staffEmail,
        staffLabel: gradeBand === 'Elementary' ? 'Teacher' : 'Counselor',
        flags: {
          sped: false,
          plan504: false,
          elStatus: 'LEP',
          homelessFoster: false
        },
        elpacHistory: [],
        teacherComments: [],
        assessmentsByTab: {},
        metrics: {}
      });
    }

    const student = studentsMap.get(studentId);
    if (isRosterTab) student.isFromRoster = true;
    if (lastName) student.lastName = lastName;
    if (firstName) student.firstName = firstName;
    if (fullNameRaw) {
      student.name = fullNameRaw;
    } else if (student.lastName && student.firstName && student.name.indexOf('Student #') === 0) {
      student.name = student.lastName + ', ' + student.firstName;
    }
    if (gradeRaw) {
      student.grade = parseGradeNumber(gradeRaw);
      student.gradeLevel = gradeRaw;
    }
    if (isRosterTab && schoolName) {
      student.school = schoolName;
      student.site = schoolName;
    }
    student.gradeBand = getGradeBand(student.grade, student.school);
    student.staffLabel = student.gradeBand === 'Elementary' ? 'Teacher' : 'Counselor';

    if (gender) student.gender = gender;
    if (ethnicity) student.ethnicity = ethnicity;
    if (race) student.race = race;
    if (parentEmail) student.parentEmail = parentEmail;
    if (parentPhone) student.parentPhone = parentPhone;
    if (parentName) student.parentName = parentName;
    if (schoolCode) student.schoolCode = schoolCode;
    if (staffName) {
      student.staffName = staffName;
      student.teacherName = staffName;
    }
    if (staffEmail) {
      student.staffEmail = staffEmail;
      student.teacherEmail = staffEmail;
    }

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

    // Populate assessmentsByTab & metrics maps for non-roster tabs (matching wvusd-data-portal)
    if (!isRosterTab && tabName) {
      if (!student.assessmentsByTab[tabName]) {
        student.assessmentsByTab[tabName] = {};
      }
      for (let c = 1; c < columns.length; c++) {
        const col = columns[c];
        if (!col.header || SKIP_ASSESSMENT_MAP_HEADERS.has(col.header.toLowerCase())) continue;
        const val = formatCellVal(row[col.index]);
        if (!val) continue;
        student.assessmentsByTab[tabName][col.header] = val;
        student.metrics[col.header] = val;
      }
    }

    // Extract row-level context fields
    const testGrade = testGradeRaw ? parseGradeNumber(testGradeRaw) : student.grade;
    const testId = getColVal('ROW_TEST_ID') || tabName || 'ELPAC';
    const partRaw = getColVal('ROW_PART');
    const partNum = parsePartValue(partRaw, testId);
    const dateTaken = getColVal('ROW_DATE');
    const rowWindow = getColVal('ROW_WINDOW');
    const rowYear = getColVal('ROW_YEAR');

    let pushedRowRecord = false;

    // 1. Long-format row record on ELPAC tab
    if (hasRowFormatCols) {
      const scaledScoreRaw = getColVal('ROW_SCALED_SCORE');
      const rawLevel = getColVal('ROW_PERF_LEVEL');

      const scoreMatch = scaledScoreRaw.match(/\b(1[1-9]\d{2})\b/);
      const scaledScore = scoreMatch
        ? Number(scoreMatch[1])
        : (scaledScoreRaw && !isNaN(Number(scaledScoreRaw)) && Number(scaledScoreRaw) > 100 ? Number(scaledScoreRaw) : null);
      const performanceLevel = parsePerformanceLevel(rawLevel || scaledScoreRaw, scaledScore, testGrade);

      if (scaledScore !== null || performanceLevel !== null) {
        const academicYear = detectAcademicYear(rowYear || testId, dateTaken + ' ' + tabName) || '2025-2026';
        const testWindow = detectTestWindow(rowWindow + ' ' + testId, dateTaken).window || 'Spring';
        const year = extractYear(dateTaken || academicYear);
        const rowCommentCols = columns.filter(c => c.type === 'TEACHER_COMMENT' && !c.academicYear && !c.testWindow);
        const rowComment = rowCommentCols.map(c => formatCellVal(row[c.index])).filter(Boolean).join(' | ');

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
        pushedRowRecord = true;
      }
    }

    // 2. Wide multi-year / domain ELD columns (24-25 ELD, 25-26 ELD, 26-27 ELD, Fall & Spring, Teacher Comments)
    const fallbackRowAcademicYear = detectAcademicYear(rowYear || testId, dateTaken + ' ' + tabName);
    const fallbackRowWindow = detectTestWindow(rowWindow + ' ' + testId, dateTaken).window;

    for (let c = 0; c < columns.length; c++) {
      const col = columns[c];
      const cellVal = formatCellVal(row[col.index]);
      if (!cellVal) continue;

      if (['ELD_SCALED_SCORE', 'ELD_LEVEL', 'ELD_SCORE_OR_LEVEL'].indexOf(col.type) !== -1) {
        const scoreMatch = cellVal.match(/\b(1[1-9]\d{2})\b/);
        const scaledScore = scoreMatch ? Number(scoreMatch[1]) : null;
        const performanceLevel = parsePerformanceLevel(cellVal, scaledScore, testGrade);
        if (scaledScore === null && performanceLevel === null) continue;

        const academicYear = col.academicYear || fallbackRowAcademicYear || detectAcademicYear(tabName, cellVal) || '2025-2026';
        const testWindow = col.testWindow || fallbackRowWindow || detectTestWindow(tabName, cellVal).window || 'Spring';
        const year = extractYear(academicYear);
        const effectivePart = (col.part !== undefined && col.part !== null && col.part !== 0) ? col.part : (partRaw !== '' ? partNum : 0);

        student.elpacHistory.push({
          testGrade: testGrade,
          testId: academicYear + ' ELD (' + testWindow + ')',
          part: effectivePart,
          partRaw: String(effectivePart),
          dateTaken: (!col.academicYear && dateTaken) ? dateTaken : (testWindow + ' ' + year),
          academicYear: academicYear,
          testWindow: testWindow,
          year: year,
          scaledScore: scaledScore,
          performanceLevel: performanceLevel,
          rawLevel: performanceLevel ? ('Level ' + performanceLevel) : cellVal
        });
      } else if (col.type === 'TEACHER_COMMENT') {
        if (pushedRowRecord && !col.academicYear && !col.testWindow) continue;
        const academicYear = col.academicYear || fallbackRowAcademicYear || detectAcademicYear(tabName, '') || '2025-2026';
        const testWindow = col.testWindow || fallbackRowWindow || detectTestWindow(tabName, '').window || 'Spring';
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

function parseGradeNumber(gradeStr) {
  const s = (gradeStr || '').toString().toUpperCase().trim();
  if (s === 'TK' || s === 'K' || s === '0' || s.indexOf('KINDER') !== -1) return 0;
  const num = parseInt(s.replace(/\D/g, ''), 10);
  return isNaN(num) ? 5 : num;
}

function getGradeBand(gradeNum, schoolName) {
  const lower = (schoolName || '').toLowerCase();
  if (lower.indexOf('high') !== -1 || lower.indexOf('academy') !== -1 || lower.indexOf('academies') !== -1) return 'High';
  if (lower.indexOf('middle') !== -1 || lower.indexOf('suzanne') !== -1 || lower.indexOf('south pointe') !== -1 || lower.indexOf('chaparral') !== -1) return 'Middle';
  if (lower.indexOf('elementary') !== -1) return 'Elementary';
  if (gradeNum <= 5) return 'Elementary';
  if (gradeNum <= 8) return 'Middle';
  return 'High';
}

function isTruthyFlag(val) {
  const s = (val || '').toString().trim().toLowerCase();
  if (!s) return false;
  return ['no', 'n', 'false', '0', 'none', 'n/a', '-'].indexOf(s) === -1;
}

function normalizeElStatus(val) {
  const s = (val || '').toString().trim().toUpperCase();
  if (!s) return 'LEP';
  if (s.indexOf('RFEP') !== -1 || s.indexOf('REDESIGNATED') !== -1) return 'RFEP';
  if (s.indexOf('IFEP') !== -1 || s.indexOf('INITIAL') !== -1) return 'IFEP';
  if (s.indexOf('EO') !== -1 || s.indexOf('ENGLISH ONLY') !== -1) return 'EO';
  return 'LEP';
}

function extractYear(dateStr) {
  const m = (dateStr || '').toString().match(/\b(20\d{2})\b/);
  return m ? parseInt(m[1], 10) : 2026;
}

function parsePerformanceLevel(rawLevel, scaledScore, grade) {
  const s = (rawLevel || '').toString().trim().toLowerCase();
  const explicitMatch =
    s.match(/\blevel\s*(?:-|:|#)?\s*([1-4])\b/i) ||
    s.match(/\b(?:pl|lvl|l)\s*(?:-|:|#)?\s*([1-4])\b/i) ||
    s.match(/^([1-4])$/);
  if (explicitMatch) return parseInt(explicitMatch[1], 10);
  if (s.indexOf('well') !== -1 || s.indexOf('bridging') !== -1 || s.indexOf('ifep') !== -1 || s.indexOf('rfep') !== -1 || s.indexOf('fluent') !== -1) return 4;
  if (s.indexOf('moderately') !== -1 || s.indexOf('expanding') !== -1 || (s.indexOf('intermediate') !== -1 && s.indexOf('early') === -1)) return 3;
  if (s.indexOf('somewhat') !== -1 || s.indexOf('early intermediate') !== -1 || s.indexOf('developing') !== -1) return 2;
  if (s.indexOf('minimally') !== -1 || s.indexOf('emerging') !== -1 || s.indexOf('novice') !== -1 || s.indexOf('beginning') !== -1) return 1;

  if (scaledScore && scaledScore > 1000) {
    const cuts = {
      0: [1374, 1422, 1474],
      1: [1411, 1455, 1507],
      2: [1424, 1471, 1532],
      3: [1448, 1488, 1535],
      4: [1459, 1499, 1549],
      5: [1467, 1514, 1560],
      6: [1475, 1517, 1567],
      7: [1481, 1527, 1576],
      8: [1486, 1534, 1590],
      9: [1493, 1545, 1606],
      10: [1493, 1545, 1606],
      11: [1500, 1555, 1615],
      12: [1500, 1555, 1615]
    }[grade] || [1467, 1514, 1560];
    if (scaledScore >= cuts[2]) return 4;
    if (scaledScore >= cuts[1]) return 3;
    if (scaledScore >= cuts[0]) return 2;
    return 1;
  }
  return null;
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}

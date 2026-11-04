/**
 * WVUSD ELPAC Longitudinal Data Portal - Google Apps Script Backend (Code.gs)
 *
 * Connected Google Sheet ID: 1JrSfw0pEvWNbkZ4nxgXJE2Vv30zkkbalpmHoojCLXXc
 * Tab 1: "ELPAC" (Cols A–I: Student ID, Last Name, First Name, Grade, TestID, Part 0–6, Date Taken, Scaled Score, Performance Level)
 * Tab 2: "Roster Tab" (Cols A–Z: Student Demographics, Teacher/Counselor, Sped, 504, EL status, Homeless/Foster, Site Admin & Super Admin RBAC)
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

    // 1. Parse Role-Based Access Control (Cols X=23, Y=24, Z=25) & Roster Map (Cols A=0 .. T=19)
    const superAdmins = new Set(DEFAULT_SUPER_ADMINS);
    const siteAdminMap = new Map(); // email -> Set of Site Names
    const studentsMap = new Map();

    for (let i = 1; i < rosterData.length; i++) {
      const row = rosterData[i];
      if (!row) continue;

      // Column Z (index 25): Super Admin comma-separated emails
      const superAdminCell = (row[25] || '').toString().trim();
      if (superAdminCell) {
        superAdminCell.split(',').forEach(em => {
          const clean = em.toLowerCase().trim();
          if (clean) superAdmins.add(clean);
        });
      }

      // Column X (index 23): Site Name & Column Y (index 24): Admin Access per site
      const siteNameRouting = (row[23] || '').toString().trim();
      const siteAdminCell = (row[24] || '').toString().trim();
      if (siteNameRouting && siteAdminCell) {
        siteAdminCell.split(',').forEach(em => {
          const clean = em.toLowerCase().trim();
          if (clean) {
            if (!siteAdminMap.has(clean)) siteAdminMap.set(clean, new Set());
            siteAdminMap.get(clean).add(siteNameRouting);
          }
        });
      }

      // Student Roster Record
      const studentId = (row[0] || '').toString().trim();
      if (!studentId) continue;

      const lastName = (row[1] || '').toString().trim();
      const firstName = (row[2] || '').toString().trim();
      const fullName = (row[3] || '').toString().trim() || (lastName && firstName ? `${lastName}, ${firstName}` : (firstName || lastName));
      const gradeRaw = (row[4] || row[15] || '').toString().trim();
      const gradeNum = parseGradeNumber(gradeRaw);
      const gender = (row[5] || '').toString().trim();
      const ethnicity = (row[6] || '').toString().trim();
      const race = (row[7] || '').toString().trim(); // Column H (index 7)
      const parentEmail = (row[8] || '').toString().trim();
      const schoolCode = (row[9] || '').toString().trim();
      const staffName = (row[10] || 'Unassigned').toString().trim(); // Column K
      const staffEmail = (row[11] || '').toString().toLowerCase().trim(); // Column L
      const parentPhone = (row[12] || '').toString().trim();
      const parentName = (row[13] || '').toString().trim();
      const schoolName = (row[14] || 'WVUSD School').toString().trim(); // Column O
      const gradeLevel = (row[15] || gradeRaw).toString().trim(); // Column P
      const spedRaw = (row[16] || '').toString().trim(); // Column Q
      const plan504Raw = (row[17] || '').toString().trim(); // Column R
      const elStatusRaw = (row[18] || '').toString().trim(); // Column S
      const homelessFosterRaw = (row[19] || '').toString().trim(); // Column T

      const gradeBand = getGradeBand(gradeNum, schoolName);
      const staffLabel = gradeBand === 'Elementary' ? 'Teacher' : 'Counselor';

      studentsMap.set(studentId, {
        studentId,
        lastName,
        firstName,
        name: fullName,
        grade: gradeNum,
        gradeLevel,
        gradeBand,
        gender,
        ethnicity,
        race,
        parentEmail,
        parentPhone,
        parentName,
        schoolCode,
        school: schoolName,
        staffName,
        staffEmail,
        staffLabel,
        flags: {
          sped: isTruthyFlag(spedRaw),
          spedRaw,
          plan504: isTruthyFlag(plan504Raw),
          plan504Raw,
          elStatus: normalizeElStatus(elStatusRaw),
          elStatusRaw,
          homelessFoster: isTruthyFlag(homelessFosterRaw),
          homelessFosterRaw
        },
        elpacHistory: []
      });
    }

    // 2. Parse Tab 1: "ELPAC" (Cols A=0 .. I=8)
    for (let i = 1; i < elpacData.length; i++) {
      const row = elpacData[i];
      if (!row) continue;
      const studentId = (row[0] || '').toString().trim();
      if (!studentId) continue;

      const lastName = (row[1] || '').toString().trim();
      const firstName = (row[2] || '').toString().trim();
      const testGradeRaw = (row[3] || '').toString().trim();
      const testGrade = parseGradeNumber(testGradeRaw);
      const testId = (row[4] || 'ELPAC').toString().trim();
      const partRaw = (row[5] !== undefined && row[5] !== '') ? row[5].toString().trim() : '0';
      const partNum = isNaN(Number(partRaw)) ? 0 : Number(partRaw);
      const dateTaken = (row[6] || '').toString().trim();
      const scaledScoreRaw = (row[7] || '').toString().trim();
      const scaledScore = scaledScoreRaw && !isNaN(Number(scaledScoreRaw)) ? Number(scaledScoreRaw) : null;
      const rawLevel = (row[8] || '').toString().trim();
      const performanceLevel = parsePerformanceLevel(rawLevel, scaledScore, testGrade);
      const year = extractYear(dateTaken);

      if (!studentsMap.has(studentId)) {
        const fullName = lastName && firstName ? `${lastName}, ${firstName}` : (firstName || lastName || `Student #${studentId}`);
        const gradeBand = getGradeBand(testGrade, '');
        studentsMap.set(studentId, {
          studentId,
          lastName,
          firstName,
          name: fullName,
          grade: testGrade,
          gradeLevel: testGradeRaw,
          gradeBand,
          gender: '',
          ethnicity: '',
          race: '',
          parentEmail: '',
          parentPhone: '',
          parentName: '',
          schoolCode: '',
          school: 'WVUSD School',
          staffName: 'Unassigned',
          staffEmail: '',
          staffLabel: gradeBand === 'Elementary' ? 'Teacher' : 'Counselor',
          flags: {
            sped: false,
            plan504: false,
            elStatus: 'LEP',
            homelessFoster: false
          },
          elpacHistory: []
        });
      }

      const student = studentsMap.get(studentId);
      student.elpacHistory.push({
        testGrade,
        testId,
        part: partNum,
        partRaw,
        dateTaken,
        year,
        scaledScore,
        performanceLevel,
        rawLevel
      });
    }

    // 3. Finalize longitudinal summaries per student
    const allStudents = [];
    studentsMap.forEach(student => {
      student.elpacHistory.sort((a, b) => {
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

    // 4. Resolve User Role & Scope
    let role = 'SuperAdmin';
    let userSchool = 'ALL';
    let userName = rawEmail.split('@')[0];
    let filteredStudents = allStudents;

    if (superAdmins.has(rawEmail)) {
      role = 'SuperAdmin';
      userSchool = 'ALL';
    } else if (siteAdminMap.has(rawEmail)) {
      role = 'SiteAdmin';
      const sites = Array.from(siteAdminMap.get(rawEmail));
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

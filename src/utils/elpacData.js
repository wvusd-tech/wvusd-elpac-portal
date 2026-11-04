// src/utils/elpacData.js
import { isBubbleStudent, getDistanceToStandard } from '../config.js';

/**
 * Helper to select the active test record for a student based on domainFocus
 * domainFocus: 'ALL' (Overall Part 0) | 'ORAL' (Part 1/3/4) | 'WRITTEN' (Part 2/5/6)
 */
export function getActiveDomainRecord(student, domainFocus = 'ALL') {
  if (!student) return null;
  if (domainFocus === 'ORAL') {
    return student.latestOral || student.latestOverall || null;
  }
  if (domainFocus === 'WRITTEN') {
    return student.latestWritten || student.latestOverall || null;
  }
  return student.latestOverall || student.latestOral || student.latestWritten || null;
}

/**
 * Computes executive KPI summary metrics for an array of student objects
 */
export function computeKPISummary(students = [], domainFocus = 'ALL') {
  const safeList = Array.isArray(students) ? students.filter(Boolean) : [];
  const total = safeList.length;
  if (total === 0) {
    return {
      total: 0,
      studentsWithScore: 0,
      metExceededCount: 0,
      metExceededPct: 0,
      level4Count: 0,
      level4Pct: 0,
      levelCounts: { 1: 0, 2: 0, 3: 0, 4: 0 },
      levelPcts: { 1: 0, 2: 0, 3: 0, 4: 0 },
      avgOverallScore: null,
      avgOralScore: null,
      avgWrittenScore: null,
      avgElaScore: null,
      avgMathScore: null,
      avgCombinedScore: null,
      elaGrowthPositivePct: 0,
      mathGrowthPositivePct: 0,
      overallGrowthPositivePct: 0,
      bubbleStudentsCount: 0,
      spedCount: 0,
      elCount: 0,
      rfepCount: 0,
      ifepCount: 0,
      plan504Count: 0,
      homelessFosterCount: 0
    };
  }

  let metExceededCount = 0;
  let level4Count = 0;
  let studentsWithScore = 0;
  const levelCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };

  let sumOverall = 0, countOverall = 0;
  let sumOral = 0, countOral = 0;
  let sumWritten = 0, countWritten = 0;

  let overallPositiveGrowth = 0, overallGrowthTested = 0;
  let oralPositiveGrowth = 0, oralGrowthTested = 0;
  let bubbleStudentsCount = 0;

  let spedCount = 0;
  let elCount = 0;
  let rfepCount = 0;
  let ifepCount = 0;
  let plan504Count = 0;
  let homelessFosterCount = 0;

  for (const s of safeList) {
    if (!s) continue;
    if (s.flags?.sped) spedCount++;
    if (s.flags?.plan504) plan504Count++;
    if (s.flags?.homelessFoster) homelessFosterCount++;

    const elStat = (s.flags?.elStatus || '').toUpperCase().trim();
    if (elStat === 'LEP' || elStat === 'EL') elCount++;
    else if (elStat === 'RFEP') rfepCount++;
    else if (elStat === 'IFEP') ifepCount++;

    const overall = s.latestOverall || s.latestEla;
    const oral = s.latestOral || s.latestMath;
    const written = s.latestWritten;

    if (overall?.scaledScore) {
      sumOverall += overall.scaledScore;
      countOverall++;
    }
    if (oral?.scaledScore) {
      sumOral += oral.scaledScore;
      countOral++;
    }
    if (written?.scaledScore) {
      sumWritten += written.scaledScore;
      countWritten++;
    }

    const ovDelta = s.overallDelta ?? s.elaDelta;
    const orDelta = s.oralDelta ?? s.mathDelta;

    if (ovDelta !== null && ovDelta !== undefined) {
      overallGrowthTested++;
      if (ovDelta > 0) overallPositiveGrowth++;
    }
    if (orDelta !== null && orDelta !== undefined) {
      oralGrowthTested++;
      if (orDelta > 0) oralPositiveGrowth++;
    }

    // Active test based on domainFocus ('ALL' | 'ORAL' | 'WRITTEN')
    const activeRec = getActiveDomainRecord(s, domainFocus);
    const perfLevel = activeRec?.performanceLevel;
    const isBubble = isBubbleStudent(activeRec?.scaledScore, s.grade, perfLevel);

    if (isBubble) bubbleStudentsCount++;

    if (perfLevel && perfLevel >= 1 && perfLevel <= 4) {
      levelCounts[perfLevel]++;
      studentsWithScore++;
      if (perfLevel >= 3) {
        metExceededCount++;
      }
      if (perfLevel === 4) {
        level4Count++;
      }
    }
  }

  const denominator = studentsWithScore > 0 ? studentsWithScore : total;
  const metExceededPct = Number(((metExceededCount / denominator) * 100).toFixed(1));
  const level4Pct = Number(((level4Count / denominator) * 100).toFixed(1));

  const levelPcts = {
    1: Number(((levelCounts[1] / denominator) * 100).toFixed(1)),
    2: Number(((levelCounts[2] / denominator) * 100).toFixed(1)),
    3: Number(((levelCounts[3] / denominator) * 100).toFixed(1)),
    4: Number(((levelCounts[4] / denominator) * 100).toFixed(1)),
  };

  const avgOverallScore = countOverall > 0 ? Math.round(sumOverall / countOverall) : null;
  const avgOralScore = countOral > 0 ? Math.round(sumOral / countOral) : null;
  const avgWrittenScore = countWritten > 0 ? Math.round(sumWritten / countWritten) : null;

  const overallGrowthPositivePct =
    overallGrowthTested > 0 ? Number(((overallPositiveGrowth / overallGrowthTested) * 100).toFixed(1)) : 0;
  const oralGrowthPositivePct =
    oralGrowthTested > 0 ? Number(((oralPositiveGrowth / oralGrowthTested) * 100).toFixed(1)) : 0;

  return {
    total,
    studentsWithScore,
    metExceededCount,
    metExceededPct,
    level4Count,
    level4Pct,
    levelCounts,
    levelPcts,
    avgOverallScore,
    avgOralScore,
    avgWrittenScore,
    avgElaScore: avgOverallScore,
    avgMathScore: avgOralScore || avgWrittenScore,
    avgCombinedScore: avgOverallScore,
    elaGrowthPositivePct: overallGrowthPositivePct,
    mathGrowthPositivePct: oralGrowthPositivePct,
    overallGrowthPositivePct,
    bubbleStudentsCount,
    spedCount,
    elCount,
    rfepCount,
    ifepCount,
    plan504Count,
    homelessFosterCount
  };
}

/**
 * Computes hierarchical breakdown:
 * Groups students by Grade Level summary rows, and nests teachers/counselors under their respective grade.
 */
export function computeHierarchicalBreakdown(students = [], gradeBand = 'Elementary') {
  const safeList = Array.isArray(students) ? students.filter(Boolean) : [];

  const getGradeOrdinal = (g) => {
    const num = Number(g);
    if (num === 0) return 'K';
    if (num === 1) return '1st';
    if (num === 2) return '2nd';
    if (num === 3) return '3rd';
    return `${num}th`;
  };

  const gradeMap = new Map();

  for (const s of safeList) {
    const gradeNum = Number(s.grade ?? 0);
    if (isNaN(gradeNum)) continue;

    if (!gradeMap.has(gradeNum)) {
      gradeMap.set(gradeNum, {
        grade: gradeNum,
        gradeLabel: gradeNum === 0 ? 'Kindergarten Overview' : `Grade ${getGradeOrdinal(gradeNum)} Overview`,
        school: s.school || '',
        gradeBand: s.gradeBand || gradeBand,
        students: [],
        teachersMap: new Map()
      });
    }

    const gradeGroup = gradeMap.get(gradeNum);
    gradeGroup.students.push(s);

    const staffName = (s.staffName || 'Unassigned').trim();
    const teacherKey = `${staffName}___${s.school || ''}`;

    if (!gradeGroup.teachersMap.has(teacherKey)) {
      gradeGroup.teachersMap.set(teacherKey, {
        staffName,
        staffEmail: s.staffEmail || '',
        staffLabel: s.staffLabel || (gradeBand === 'Elementary' ? 'Teacher' : 'Counselor'),
        grade: gradeNum,
        school: s.school || '',
        gradeBand: s.gradeBand || gradeBand,
        students: []
      });
    }

    gradeGroup.teachersMap.get(teacherKey).students.push(s);
  }

  const computeMetrics = (studentList) => {
    let total = studentList.length;
    let testedCount = 0, proficientCount = 0, level4Count = 0;
    let sumDelta = 0, countDelta = 0;
    let elCount = 0;
    let tier3NeedsCount = 0;
    let bubbleCount = 0;
    let spedCount = 0;
    let plan504Count = 0;
    let homelessFosterCount = 0;

    for (const s of studentList) {
      if (s.flags?.sped) spedCount++;
      if (s.flags?.plan504) plan504Count++;
      if (s.flags?.homelessFoster) homelessFosterCount++;
      const elStat = (s.flags?.elStatus || '').toUpperCase().trim();
      if (elStat === 'LEP' || elStat === 'EL') elCount++;

      const overall = s.latestOverall || s.latestEla;
      if (overall?.performanceLevel || overall?.scaledScore) {
        testedCount++;
        if (overall.performanceLevel >= 3) proficientCount++;
        if (overall.performanceLevel === 4) level4Count++;
      }

      if (overall?.performanceLevel === 1) {
        tier3NeedsCount++;
      }

      if (isBubbleStudent(overall?.scaledScore, s.grade, overall?.performanceLevel)) {
        bubbleCount++;
      }

      const delta = s.overallDelta ?? s.elaDelta;
      if (delta !== null && delta !== undefined) {
        sumDelta += delta;
        countDelta++;
      }
    }

    const combinedMetPct = testedCount > 0 ? Number(((proficientCount / testedCount) * 100).toFixed(1)) : 0;
    const level4Pct = testedCount > 0 ? Number(((level4Count / testedCount) * 100).toFixed(1)) : 0;
    const avgOverallDelta = countDelta > 0 ? Number((sumDelta / countDelta).toFixed(1)) : null;

    return {
      total,
      combinedMetPct,
      level4Pct,
      avgOverallDelta,
      elCount,
      tier3NeedsCount,
      bubbleCount,
      spedCount,
      plan504Count,
      homelessFosterCount
    };
  };

  const gradesArray = Array.from(gradeMap.values())
    .map(g => {
      const gradeMetrics = computeMetrics(g.students);
      const teachers = Array.from(g.teachersMap.values())
        .map(t => {
          const teacherMetrics = computeMetrics(t.students);
          return {
            ...t,
            ...teacherMetrics
          };
        })
        .sort((a, b) => a.staffName.localeCompare(b.staffName));

      return {
        ...g,
        ...gradeMetrics,
        teachers
      };
    })
    .sort((a, b) => a.grade - b.grade);

  return gradesArray;
}

/**
 * Generates copyable, structured prompts tailored to a student's ELPAC record for NotebookLM workflows
 */
export function generateNotebookLMPrompt(student, workflowType = 'IEP') {
  const flags = [];
  if (student.flags?.sped) flags.push("Special Education (IEP)");
  if (student.flags?.plan504) flags.push("Section 504 Plan");
  if (student.flags?.elStatus) flags.push(`English Learner Status (${student.flags.elStatus})`);
  if (student.flags?.homelessFoster) flags.push("Foster/Homeless Youth");
  const flagStr = flags.length > 0 ? flags.join(", ") : "General Education";

  const elpacHist = (student.elpacHistory || []).map(h =>
    `  - ${h.dateTaken || h.year} | Grade ${h.testGrade} | ${h.testId || 'ELPAC'} | Part ${h.part} (${h.partLabel || 'Overall'}): Scaled Score ${h.scaledScore || 'N/A'}, Level ${h.performanceLevel || h.rawLevel || 'N/A'}`
  ).join("\n") || "  - No historical ELPAC records";

  const ovDelta = student.overallDelta !== null && student.overallDelta !== undefined
    ? `${student.overallDelta > 0 ? '+' : ''}${student.overallDelta} pts`
    : 'N/A';

  const dfs = student.latestOverall?.scaledScore
    ? getDistanceToStandard(student.latestOverall.scaledScore, student.grade)
    : null;
  const dfsStr = dfs !== null ? `${dfs >= 0 ? '+' : ''}${dfs} pts from Level 3 Benchmark` : 'N/A';

  if (workflowType === 'IEP') {
    return `### California ELPAC & IEP / 504 ELD Accommodations Assistant (NotebookLM Prompt)
Student: ${student.name} (ID: ${student.studentId})
School: ${student.school} | Current Grade: ${student.grade}
Designated Support Staff: ${student.staffLabel} ${student.staffName}
Program Classifications: ${flagStr}

**ELPAC Proficiency Summary:**
Overall ELPAC (Part 0): ${student.latestOverall?.scaledScore || 'N/A'} (Level ${student.latestOverall?.performanceLevel || 'N/A'}), YoY Change: ${ovDelta} (${dfsStr})
Oral Language (Part 1): ${student.latestOral?.scaledScore || 'N/A'} (Level ${student.latestOral?.performanceLevel || 'N/A'})
Written Language (Part 2): ${student.latestWritten?.scaledScore || 'N/A'} (Level ${student.latestWritten?.performanceLevel || 'N/A'})

**Longitudinal ELPAC Assessment Record (Parts 0–6):**
${elpacHist}

**Instructions for NotebookLM:**
Act as an expert California English Learner (EL) Specialist and Special Education Coordinator for Walnut Valley Unified School District. Based on this student's longitudinal ELPAC performance across Overall, Oral, and Written domains:
1. Analyze the student's relative strengths and domain gaps across Listening, Speaking, Reading, and Writing (Parts 0–6).
2. Recommend 3 specific, measurable SMART linguistically appropriate IEP/504 ELD goals aligned with the California ELD Standards.
3. Suggest 4 evidence-based classroom and Summative ELPAC testing accommodations and designated supports.
4. Outline criteria and next steps toward RFEP (Redesignated Fluent English Proficient) reclassification readiness.`;
  }

  if (workflowType === 'SST') {
    return `### Student Study Team (SST) & ELD Multi-Tiered Intervention Plan (NotebookLM Prompt)
Student: ${student.name} (ID: ${student.studentId})
School: ${student.school} | Grade: ${student.grade}
Teacher / Counselor: ${student.staffLabel} ${student.staffName}
Student Profile: ${flagStr}

**ELPAC Baseline:**
- Overall Scaled Score: ${student.latestOverall?.scaledScore || 'N/A'} (Level ${student.latestOverall?.performanceLevel || 'N/A'}), YoY Delta: ${ovDelta}
- Oral Language Score: ${student.latestOral?.scaledScore || 'N/A'} (Level ${student.latestOral?.performanceLevel || 'N/A'})
- Written Language Score: ${student.latestWritten?.scaledScore || 'N/A'} (Level ${student.latestWritten?.performanceLevel || 'N/A'})

**ELPAC Longitudinal History:**
${elpacHist}

**Instructions for NotebookLM:**
Act as a Walnut Valley Unified Multi-Tiered System of Support (MTSS) & ELD Intervention Specialist. Formulate an individualized SST & Language Acquisition Action Plan:
1. Determine whether the student requires Designated ELD Tier 2 Strategic Acceleration (Bubble toward Level 3/4) or Tier 3 Intensive Foundational Language Support.
2. Outline a 6-to-8 week targeted Oral & Written English intervention protocol with progress-monitoring checkpoints.
3. Provide bilingual/family partnership strategies for home literacy support.
4. Formulate 2 measurable scale score and domain targets for the next Summative ELPAC administration.`;
  }

  return `### Integrated & Designated ELD Lesson Differentiation Architect (NotebookLM Prompt)
Student: ${student.name} (Grade ${student.grade}) | School: ${student.school}
Current ELPAC Proficiency: Overall Level ${student.latestOverall?.performanceLevel || 'N/A'} | Oral Level ${student.latestOral?.performanceLevel || 'N/A'} | Written Level ${student.latestWritten?.performanceLevel || 'N/A'}
Growth Velocity: Overall (${ovDelta})
Demographics: ${flagStr}

**Instructions for NotebookLM:**
Act as an expert California ELD Instructional Coach. Using the California ELD Standards (Emerging, Expanding, Bridging) and Universal Design for Learning (UDL):
1. Provide tiered academic vocabulary scaffolds, graphic organizers, and academic discourse sentence frames calibrated to this student's ELPAC level.
2. Provide tiered questioning prompts (DOK Level 1 through DOK Level 3) supporting both Oral (Listening/Speaking) and Written (Reading/Writing) domains.
3. Suggest structured peer-to-peer collaborative routines to accelerate English language proficiency toward Level 4 (Well Developed).`;
}

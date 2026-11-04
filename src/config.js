// src/config.js
// WVUSD ELPAC Longitudinal Data Portal Configuration

export const GOOGLE_SHEET_ID = "1JrSfw0pEvWNbkZ4nxgXJE2Vv30zkkbalpmHoojCLXXc";
export const ELPAC_TAB_NAME = "ELPAC";
export const ROSTER_TAB_NAME = "Roster Tab";

// Optional deployed Google Apps Script Web App URL (can be set via VITE_APPS_SCRIPT_URL or runtime storage)
export const APPS_SCRIPT_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_APPS_SCRIPT_URL) || "";

export const GOOGLE_CLIENT_ID = "243489966839-kcopbaj692oat1p2hoq5lrcddq9n4k17.apps.googleusercontent.com";

export const ALLOWED_DOMAINS = ["wvusd.org", "sub.wvusd.org"];

export const DISTRICT_NAME = "Walnut Valley Unified School District";
export const APP_TITLE = "WVUSD ELPAC Longitudinal Data Portal";

export const DISTRICT_LOGO =
  "https://res.cloudinary.com/djv9u4054/image/upload/v1783959106/UPdated_Black_and_White_Logo-removebg-preview_zubeqp.png";

export const SITE_LOGOS = {
  "diamond bar": "https://res.cloudinary.com/djv9u4054/image/upload/v178362852/0-DBARBRAHMASWide_q8uled-removebg-preview_x7ta88.png",
  "south pointe": "https://res.cloudinary.com/djv9u4054/image/upload/v1783623577/copy_of_copy_of_spt_logo-removebg-preview_l7eve6.png",
  "maple hill": "https://res.cloudinary.com/djv9u4054/image/upload/v1783459666/copy_of_untitled_design_6_qhbikx.png",
  "chaparral": "https://res.cloudinary.com/djv9u4054/image/upload/v1781797508/CHP_Logo-removebg-preview_npea0e.png",
  "suzanne": "https://res.cloudinary.com/djv9u4054/image/upload/v1780597225/Suzanne_iqsuyo.png",
  "walnut high": "https://res.cloudinary.com/djv9u4054/image/upload/v1780504988/stickerwhs_iwwwxs_rx0om9.png",
  "hockwalt": "https://res.cloudinary.com/djv9u4054/image/upload/v1777564560/Untitled_design_4_tjyhnp.png",
  "collegewood": "https://res.cloudinary.com/djv9u4054/image/upload/v1777485387/Untitled_design_14_on26t9.png",
  "vejar": "https://res.cloudinary.com/djv9u4054/image/upload/v1777485064/Untitled_design_13_ohnd95.png",
  "castle rock": "https://res.cloudinary.com/djv9u4054/image/upload/v1777486030/Untitled_design_15_dt6zmq.png",
  "evergreen": "https://res.cloudinary.com/djv9u4054/image/upload/v1777484631/Untitled_design_12_le66tp.png",
  "quail summit": "https://res.cloudinary.com/djv9u4054/image/upload/v1777484271/Untitled_design_11_bd8mmm.png",
  "walnut elementary": "https://res.cloudinary.com/djv9u4054/image/upload/v1777483405/Untitled_design_10_imwook.png",
  "westhoff": "https://res.cloudinary.com/djv9u4054/image/upload/v1777482954/Untitled_design_9_pkf2df.png",
  "morris": "https://res.cloudinary.com/djv9u4054/image/upload/v1777482304/Untitled_design_7_kyzokr.png"
};

/**
 * Resolves a school site name to its official Cloudinary logo
 */
export function getSiteLogo(siteName) {
  if (!siteName || siteName === "ALL") return DISTRICT_LOGO;
  const lower = String(siteName).toLowerCase();
  if (lower.includes("walnut") && !lower.includes("high")) {
    return SITE_LOGOS["walnut elementary"];
  }
  for (const [key, url] of Object.entries(SITE_LOGOS)) {
    if (lower.includes(key)) return url;
  }
  return DISTRICT_LOGO;
}

/**
 * Checks whether an email address is an authorized @wvusd.org staff account
 */
export function isValidWvusdEmail(email) {
  if (!email) return false;
  const clean = String(email).toLowerCase().trim();
  const parts = clean.split("@");
  if (parts.length !== 2) return false;
  // Disallow student emails
  if (parts[1] === "stu.wvusd.org") return false;
  return ALLOWED_DOMAINS.includes(parts[1]);
}

/**
 * California ELPAC Performance Levels (Levels 1–4)
 */
export const PERFORMANCE_LEVELS = {
  1: {
    level: 1,
    label: "Minimally Developed",
    shortLabel: "Level 1",
    tierName: "Intensive ELD Support",
    color: "#ef4444",
    bgClass: "bg-red-50 text-red-700 border-red-200",
    badgeClass: "bg-red-100 text-red-800 border-red-300",
    barColor: "bg-red-500",
    dotColor: "bg-red-500",
  },
  2: {
    level: 2,
    label: "Somewhat Developed",
    shortLabel: "Level 2",
    tierName: "Strategic Support / Bubble",
    color: "#f59e0b",
    bgClass: "bg-amber-50 text-amber-700 border-amber-200",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
    barColor: "bg-amber-500",
    dotColor: "bg-amber-500",
  },
  3: {
    level: 3,
    label: "Moderately Developed",
    shortLabel: "Level 3",
    tierName: "Expanding / Reclass Candidate",
    color: "#10b981",
    bgClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
    barColor: "bg-emerald-500",
    dotColor: "bg-emerald-500",
  },
  4: {
    level: 4,
    label: "Well Developed",
    shortLabel: "Level 4",
    tierName: "RFEP Proficient",
    color: "#2563eb",
    bgClass: "bg-blue-50 text-blue-700 border-blue-200",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-300",
    barColor: "bg-blue-600",
    dotColor: "bg-blue-600",
  }
};

/**
 * California ELPAC Part (0–6) Definitions (Column F of "ELPAC" tab)
 */
export const ELPAC_PARTS = {
  0: { part: 0, label: "Overall ELPAC", shortLabel: "Part 0 · Overall", category: "OVERALL" },
  1: { part: 1, label: "Oral Language", shortLabel: "Part 1 · Oral", category: "ORAL" },
  2: { part: 2, label: "Written Language", shortLabel: "Part 2 · Written", category: "WRITTEN" },
  3: { part: 3, label: "Listening Domain", shortLabel: "Part 3 · Listening", category: "ORAL" },
  4: { part: 4, label: "Speaking Domain", shortLabel: "Part 4 · Speaking", category: "ORAL" },
  5: { part: 5, label: "Reading Domain", shortLabel: "Part 5 · Reading", category: "WRITTEN" },
  6: { part: 6, label: "Writing Domain", shortLabel: "Part 6 · Writing", category: "WRITTEN" },
};

export function getPartLabel(partVal) {
  const num = Number(partVal);
  if (!isNaN(num) && ELPAC_PARTS[num]) {
    return ELPAC_PARTS[num];
  }
  return {
    part: partVal ?? 0,
    label: partVal !== undefined && partVal !== "" ? `Part ${partVal}` : "Overall (Part 0)",
    shortLabel: partVal !== undefined && partVal !== "" ? `Part ${partVal}` : "Part 0",
    category: "OVERALL"
  };
}

/**
 * California Summative ELPAC Scale Score Thresholds (Grades K–12)
 * [Level 2 Min, Level 3 Min (Moderately Developed), Level 4 Min (Well Developed / RFEP)]
 */
export const ELPAC_CUT_SCORES = {
  0: [1374, 1422, 1474], // Kindergarten / TK
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
};

/**
 * Normalizes any raw ELPAC performance level string/number into 1..4
 */
export function normalizePerformanceLevel(rawLevel, scaledScore = null, grade = null) {
  if (rawLevel !== null && rawLevel !== undefined && rawLevel !== "") {
    const str = String(rawLevel).trim().toLowerCase();
    const numMatch = str.match(/\b([1-4])\b/) || str.match(/level\s*([1-4])/i) || str.match(/^l([1-4])$/i);
    if (numMatch) {
      return Number(numMatch[1]);
    }
    if (str.includes("well") || str.includes("ifep") || str.includes("fluent") || str.includes("exceeded")) {
      return 4;
    }
    if (str.includes("moderately") || str.includes("intermediate") || str.includes("met") && !str.includes("not") && !str.includes("nearly")) {
      return 3;
    }
    if (str.includes("somewhat") || str.includes("nearly")) {
      return 2;
    }
    if (str.includes("minimally") || str.includes("novice") || str.includes("not met")) {
      return 1;
    }
  }

  // Fallback to cut scores if scaledScore is provided
  const numScore = Number(scaledScore);
  if (!isNaN(numScore) && numScore > 1000) {
    const gNum = Number(String(grade).replace(/\D/g, "")) || 0;
    const cuts = ELPAC_CUT_SCORES[gNum] || ELPAC_CUT_SCORES[5];
    if (numScore >= cuts[2]) return 4;
    if (numScore >= cuts[1]) return 3;
    if (numScore >= cuts[0]) return 2;
    return 1;
  }

  return null;
}

/**
 * Helper to determine if a student is a "Bubble Student":
 * - In Level 2 within 25 scale score points of Level 3, OR
 * - In Level 3 within 20 scale score points of Level 4 (RFEP Reclassification threshold)
 */
export function isBubbleStudent(score, grade, performanceLevel = null) {
  const gNum = Number(String(grade ?? "").replace(/\D/g, "")) || 0;
  const cuts = ELPAC_CUT_SCORES[gNum] || ELPAC_CUT_SCORES[5];
  const numScore = Number(score);

  if (!isNaN(numScore) && numScore > 1000 && cuts) {
    const [minL2, minL3, minL4] = cuts;
    const nearL3 = numScore >= minL2 && numScore < minL3 && (minL3 - numScore) <= 25;
    const nearL4 = numScore >= minL3 && numScore < minL4 && (minL4 - numScore) <= 20;
    if (nearL3 || nearL4) return true;
  }

  return Number(performanceLevel) === 2;
}

/**
 * Returns distance from Level 3 / Level 4 standard (DFS):
 * Positive = at or above Level 3 threshold, Negative = below Level 3 threshold
 */
export function getDistanceToStandard(score, grade) {
  const numScore = Number(score);
  if (!numScore || isNaN(numScore)) return null;
  const gNum = Number(String(grade ?? "").replace(/\D/g, "")) || 0;
  const cuts = ELPAC_CUT_SCORES[gNum] || ELPAC_CUT_SCORES[5];
  if (!cuts) return null;
  const minL3 = cuts[1];
  return numScore - minL3;
}

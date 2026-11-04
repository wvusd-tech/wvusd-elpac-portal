# WVUSD ELPAC Longitudinal Data Portal

A modern, production-ready educational data portal built with **React**, **Vite**, and **Tailwind CSS** for **Walnut Valley Unified School District (WVUSD)**. Designed for district leadership, site administrators, counselors, and teachers to track and display California **ELPAC (English Language Proficiency Assessments for California)** student performance data, rosters, and historical longitudinal trends.

---

## 🌟 Key Features

### 1. Google Sheets Integration (`1JrSfw0pEvWNbkZ4nxgXJE2Vv30zkkbalpmHoojCLXXc`)
- **Tab 1: `"ELPAC"`** (Columns A–I: Student ID, Last Name, First Name, Grade, TestID, Part 0–6, Date Taken, Scaled Score, Performance Level).
- **Tab 2: `"Roster Tab"`** (Columns A–Z: Student ID, Name, Grade, Gender, Ethnicity, Race [Col H], Parent Contact, School Code/Name, Teacher/Counselor Name & Email [Cols K–L], Sped [Col Q], 504 [Col R], EL Status [Col S], Homeless/Foster Youth [Col T], and Site/Super Admin RBAC [Cols X–Z]).
- Ready-to-deploy Google Apps Script backend included at `google-apps-script/Code.gs`.

### 2. Role-Based Access & Landing Views
- Restricted to verified `@wvusd.org` and `@sub.wvusd.org` Google OAuth accounts.
- **Admin Users (Super Admin & Site Admin):** Land directly on the **School Executive Overview** featuring district/site performance breakdown matrices, grade-level aggregations, and interactive cohort summary flags (**SPED**, **Active EL**, **504**, **Homeless/Foster**, and **Bubble Students**).
- **Teachers & Counselors:** Land directly on their respective **Classroom / Counselor Roster** view with smooth top-scroll positioning, featuring tiled student cards at the top of the page and 4-tier ELD small-group intervention groupings at the bottom.

### 3. Student Cards & Longitudinal History Modal
- Each student card displays student name, ID, grade, school site logo, demographic/support program indicator badges, and latest ELPAC scale scores and performance levels.
- Clicking **"Inspect Scores"** or a student card opens a detailed modal showing historical ELPAC test performance (**Test Year/Date**, **Grade**, **Test ID**, **Part 0–6**, **Scaled Score**, and **Performance Level**) plus 1-click AI NotebookLM prompt generators for IEP/504 ELD accommodations, SST plans, and tiered ELD lessons.

---

## 🚀 Deployment & Scripts

### Run Locally
```bash
npm install
npm run dev
```

### Build for Production
```bash
npm run build
```

### Deploy to GitHub Pages
```bash
npm run deploy
```

// src/App.jsx
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { GOOGLE_CLIENT_ID, DISTRICT_LOGO, isBubbleStudent } from './config.js';
import {
  saveUserSession,
  saveCachedStudents,
  getCachedStudents,
  clearUserSession,
  getStoredSession
} from './utils/authStorage.js';
import { fetchElpacPortalData, harmonizeStudentSchoolNames } from './utils/elpacSheetService.js';
import {
  isRawSchoolCodeOrPlaceholder,
  getSiteCanonicalKey,
  matchesSchoolSite
} from './utils/dataParser.js';
import HeaderBar from './components/HeaderBar.jsx';
import ControlBar from './components/ControlBar.jsx';
import ExecutiveOverview from './components/ExecutiveOverview.jsx';
import TeacherCohortView from './components/TeacherCohortView.jsx';
import StudentModal from './components/StudentModal.jsx';
import LoginView from './components/LoginView.jsx';
import { Loader2, AlertTriangle, ArrowLeft } from 'lucide-react';

class ViewErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('ViewErrorBoundary caught error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white border border-rose-200 rounded-2xl p-8 max-w-lg mx-auto text-center my-12 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            Unable to Display Roster View
          </h3>
          <p className="text-xs text-slate-500 mt-1 mb-5">
            {this.state.error?.message || 'An unexpected rendering error occurred while loading this view.'}
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              this.props.onReset?.();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Executive Overview</span>
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState(() => {
    const session = getStoredSession();
    return session?.user || null;
  });

  const [isAuthResolving, setIsAuthResolving] = useState(() => {
    const session = getStoredSession();
    return Boolean(session && session.email);
  });
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  // App Navigation & Filters
  const [gradeBand, setGradeBand] = useState('Elementary'); // 'Elementary' | 'Middle' | 'High'
  const [subjectFocus, setSubjectFocus] = useState('ALL'); // 'ALL' | 'ORAL' | 'WRITTEN'
  const [selectedSite, setSelectedSite] = useState('ALL');
  const [selectedGrade, setSelectedGrade] = useState('ALL');
  const [selectedStaff, setSelectedStaff] = useState('ALL');
  const [activeStaffFilter, setActiveStaffFilter] = useState(null);
  const [activeFlagFilter, setActiveFlagFilter] = useState(null); // 'SPED' | 'EL' | '504' | 'HOMELESS_FOSTER' | 'BUBBLE' | null
  const [activeView, setActiveView] = useState('overview'); // 'overview' | 'roster'
  const [activeModalStudent, setActiveModalStudent] = useState(null);
  const [levelQuickFilter, setLevelQuickFilter] = useState(null);

  // Helper to parse and apply bookmark URL query parameters
  const applyUrlBookmarkParams = useCallback((studentList = []) => {
    if (typeof window === 'undefined' || !window.location.search) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const siteParam = params.get('site');
      const gradeParam = params.get('grade');
      const staffParam = params.get('staff');
      const bandParam = params.get('band') || params.get('gradeBand');
      const viewParam = params.get('view');
      const flagParam = params.get('flag');

      if (siteParam && siteParam !== 'ALL') {
        setSelectedSite(siteParam);
      }
      if (bandParam && ['Elementary', 'Middle', 'High'].includes(bandParam)) {
        setGradeBand(bandParam);
      }
      if (gradeParam && gradeParam !== 'ALL') {
        setSelectedGrade(gradeParam);
      }
      if (staffParam && staffParam !== 'ALL') {
        setSelectedStaff(staffParam);
        const cleanTarget = staffParam.toLowerCase().trim();
        const matched = (Array.isArray(studentList) ? studentList : []).find(s => {
          if (!s) return false;
          const sName = (s.staffName || '').toLowerCase().trim();
          const sEmail = (s.staffEmail || '').toLowerCase().trim();
          return sName === cleanTarget || sEmail === cleanTarget || sName.includes(cleanTarget);
        });
        if (matched) {
          setActiveStaffFilter({
            staffName: matched.staffName,
            staffEmail: matched.staffEmail,
            school: matched.school,
            grade: matched.grade,
            gradeBand: matched.gradeBand
          });
        }
      }
      if (viewParam && (viewParam === 'overview' || viewParam === 'roster')) {
        setActiveView(viewParam);
      }
      if (flagParam && ['SPED', 'EL', '504', 'HOMELESS_FOSTER', 'BUBBLE'].includes(flagParam)) {
        setActiveFlagFilter(flagParam);
      }
    } catch (e) {
      console.warn('Error applying URL bookmark params:', e);
    }
  }, []);

  // Automatically configure initial landing view based on user role:
  // - Admin Users (SuperAdmin, SiteAdmin) -> School Executive Overview ('overview')
  // - Teachers / Counselors (ElementaryTeacher, Counselor, SecondaryTeacher) -> Classroom / Counselor Roster ('roster')
  const autoConfigureUserContext = useCallback((currentUser, studentList = []) => {
    if (!currentUser) return;

    if (currentUser.school && currentUser.school !== 'ALL') {
      const cleanSchoolStudents = studentList.filter(
        s => s && matchesSchoolSite(s.school, currentUser.school)
      );
      const resolvedSchoolName =
        cleanSchoolStudents.find(s => s.school && !isRawSchoolCodeOrPlaceholder(s.school))?.school ||
        currentUser.school;
      setSelectedSite(resolvedSchoolName);
      const bands = [...new Set(cleanSchoolStudents.map(s => s?.gradeBand).filter(Boolean))];
      if (bands.length > 0) {
        setGradeBand(bands[0]);
      }
    } else {
      setSelectedSite('ALL');
    }

    const isEducatorOrCounselor =
      currentUser.role === 'ElementaryTeacher' ||
      currentUser.role === 'SecondaryTeacher' ||
      currentUser.role === 'SecondaryOrSiteTeacher' ||
      currentUser.role === 'Counselor';

    if (isEducatorOrCounselor) {
      const userEmail = (currentUser.email || '').toLowerCase().trim();
      const userName = (currentUser.name || '').toLowerCase().trim();

      const matched = (studentList || []).find(s => {
        if (!s) return false;
        const sEmail = (s.staffEmail || '').toLowerCase().trim();
        const sName = (s.staffName || '').toLowerCase().trim();
        return (userEmail && sEmail && userEmail === sEmail) ||
               (userName && sName && (sName === userName || userName.includes(sName) || sName.includes(userName)));
      });

      if (matched) {
        setActiveStaffFilter({
          staffName: matched.staffName,
          staffEmail: matched.staffEmail || userEmail,
          school: matched.school || currentUser.school,
          grade: matched.grade,
          gradeBand: matched.gradeBand || (currentUser.role === 'ElementaryTeacher' ? 'Elementary' : 'High')
        });
        setSelectedStaff(matched.staffName);
        setSelectedGrade('ALL');
        if (matched.gradeBand) setGradeBand(matched.gradeBand);
        if (matched.school) setSelectedSite(matched.school);
      }
      setActiveView('roster');
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      }
    } else {
      // Admin Users (SuperAdmin / SiteAdmin): Land directly on School Executive Overview
      setActiveStaffFilter(null);
      setSelectedStaff('ALL');
      setSelectedGrade('ALL');
      setActiveView('overview');
    }
  }, []);

  // Fetch ELPAC & Roster payload from Google Sheet (1JrSfw0pEvWNbkZ4nxgXJE2Vv30zkkbalpmHoojCLXXc)
  const fetchDashboardData = useCallback(async (userEmail, fallbackName = '', isSilent = false) => {
    if (!isSilent) {
      setIsLoading(true);
    }
    setAuthError(null);

    try {
      const data = await fetchElpacPortalData(userEmail, fallbackName);

      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.user || !data.user.authorized) {
        throw new Error('User is not authorized to access this portal.');
      }

      const verifiedUser = {
        ...data.user,
        name: data.user.name || fallbackName || userEmail.split('@')[0]
      };

      const fetchedStudents = Array.isArray(data.students) ? data.students : [];

      setUser(verifiedUser);
      setStudents(fetchedStudents);

      saveUserSession(verifiedUser);
      saveCachedStudents(fetchedStudents);

      autoConfigureUserContext(verifiedUser, fetchedStudents);
      applyUrlBookmarkParams(fetchedStudents);

      return { user: verifiedUser, students: fetchedStudents };

    } catch (err) {
      console.error('Data fetch error:', err);
      if (err.message && err.message.toLowerCase().includes('not authorized')) {
        clearUserSession();
        setUser(null);
        setStudents([]);
      }
      setAuthError(err.message || 'Unable to load dashboard data. Please try again.');
      throw err;
    } finally {
      setIsLoading(false);
      setIsAuthResolving(false);
    }
  }, [autoConfigureUserContext, applyUrlBookmarkParams]);

  // Direct load & mount: restore Google session from sessionStorage
  useEffect(() => {
    let isMounted = true;

    const restoreSessionOnMount = async () => {
      const stored = getStoredSession();

      if (!stored || !stored.email) {
        if (isMounted) {
          setIsAuthResolving(false);
          setUser(null);
        }
        return;
      }

      setIsAuthResolving(true);
      try {
        const cached = getCachedStudents();

        if (cached && cached.length > 0 && stored.user) {
          const cleanCached = harmonizeStudentSchoolNames(cached);
          if (isMounted) {
            setUser(stored.user);
            setStudents(cleanCached);
            autoConfigureUserContext(stored.user, cleanCached);
            applyUrlBookmarkParams(cleanCached);
            setIsAuthResolving(false);
          }

          try {
            await fetchDashboardData(stored.email, stored.name, true);
          } catch (syncErr) {
            console.warn('Background sync using cached data:', syncErr);
          }
        } else {
          if (isMounted) {
            setIsLoading(true);
          }
          await fetchDashboardData(stored.email, stored.name, false);
        }
      } catch (err) {
        console.error('Session restoration error:', err);
        if (isMounted) {
          setIsAuthResolving(false);
          setIsLoading(false);
        }
      }
    };

    restoreSessionOnMount();

    return () => {
      isMounted = false;
    };
  }, [autoConfigureUserContext, applyUrlBookmarkParams, fetchDashboardData]);

  // Synchronize active filters to URL query string for bookmarks
  useEffect(() => {
    if (typeof window === 'undefined' || isAuthResolving || !user) return;
    try {
      const params = new URLSearchParams();
      if (selectedSite && selectedSite !== 'ALL') params.set('site', selectedSite);
      if (gradeBand) params.set('band', gradeBand);
      if (selectedGrade && selectedGrade !== 'ALL') params.set('grade', selectedGrade);
      if (selectedStaff && selectedStaff !== 'ALL') params.set('staff', selectedStaff);
      if (activeView && activeView !== 'overview') params.set('view', activeView);
      if (activeFlagFilter) params.set('flag', activeFlagFilter);

      const qs = params.toString();
      const newUrl = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
      window.history.replaceState(null, '', newUrl);
    } catch {
      // ignore
    }
  }, [user, isAuthResolving, selectedSite, gradeBand, selectedGrade, selectedStaff, activeView, activeFlagFilter]);

  // Handle Logout
  const handleLogout = () => {
    setUser(null);
    setStudents([]);
    setSelectedSite('ALL');
    setSelectedGrade('ALL');
    setSelectedStaff('ALL');
    setActiveStaffFilter(null);
    setActiveFlagFilter(null);
    clearUserSession();
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  // Fast Demo Switcher for Evaluation and Presentation
  const handleDemoLogin = (demoEmail, demoName) => {
    fetchDashboardData(demoEmail, demoName, false);
  };

  // Switch demo perspective dynamically
  const handleSwitchDemoRole = (roleType) => {
    switch (roleType) {
      case 'SuperAdmin':
        fetchDashboardData('kwendland@wvusd.org', 'Super Admin', false);
        break;
      case 'SiteAdmin':
        fetchDashboardData('dbhsadmin@wvusd.org', 'DBHS Site Admin', false);
        break;
      case 'HighSchoolCounselor':
        fetchDashboardData('sburns@wvusd.org', 'Burns, S', false);
        break;
      case 'MiddleSchoolCounselor':
        fetchDashboardData('jochen@wvusd.org', 'Chen, J', false);
        break;
      case 'ElementaryTeacher':
        fetchDashboardData('jurbaniec@wvusd.org', 'Urbaniec, Julie', false);
        break;
      case 'SecondaryTeacher':
        fetchDashboardData('cschultz@wvusd.org', 'Schultz, Corolar', false);
        break;
      default:
        break;
    }
  };

  // List of all clean Column O School Names present in the loaded dataset
  // Excludes raw school codes, placeholders, and duplicate site identifier variations
  const sitesList = useMemo(() => {
    const byCanonicalKey = new Map();
    students.forEach(s => {
      if (!s || !s.school) return;
      const cleanName = s.school.trim();
      if (!cleanName || isRawSchoolCodeOrPlaceholder(cleanName)) return;
      const key = getSiteCanonicalKey(cleanName) || cleanName.toLowerCase();
      const existing = byCanonicalKey.get(key);
      if (!existing || cleanName.length > existing.length) {
        byCanonicalKey.set(key, cleanName);
      }
    });
    return Array.from(byCanonicalKey.values()).sort((a, b) => a.localeCompare(b));
  }, [students]);

  // List of grade bands present in current site
  const availableGradeBands = useMemo(() => {
    let pool = students;
    if (selectedSite !== 'ALL') {
      pool = pool.filter(s => s && matchesSchoolSite(s.school, selectedSite));
    }
    const bands = new Set(pool.map(s => s.gradeBand).filter(Boolean));
    return ['Elementary', 'Middle', 'High'].filter(b => bands.has(b));
  }, [students, selectedSite]);

  // Handle School Site change
  const handleSiteChange = (site) => {
    setSelectedSite(site);
    setSelectedGrade('ALL');
    setSelectedStaff('ALL');
    setActiveStaffFilter(null);
    setActiveFlagFilter(null);

    if (site !== 'ALL') {
      const siteStudents = students.filter(s => s && matchesSchoolSite(s.school, site));
      const siteBands = [...new Set(siteStudents.map(s => s.gradeBand).filter(Boolean))];
      if (siteBands.length === 1) {
        setGradeBand(siteBands[0]);
      } else if (!siteBands.includes(gradeBand) && siteBands.length > 0) {
        setGradeBand(siteBands[0]);
      }
    }
  };

  // Handle Grade Band Change
  const handleGradeBandChange = (newBand) => {
    setGradeBand(newBand);
    setSelectedGrade('ALL');
    setSelectedStaff('ALL');
    setActiveStaffFilter(null);
    setActiveFlagFilter(null);
  };

  // Compute available grades for current parameters
  const availableGrades = useMemo(() => {
    let pool = Array.isArray(students) ? students : [];
    if (selectedSite !== 'ALL') pool = pool.filter(s => s && matchesSchoolSite(s.school, selectedSite));
    pool = pool.filter(s => s && s.gradeBand === gradeBand);

    const gradesSet = new Set(pool.map(s => s.grade).filter(g => g !== undefined && g !== null));
    return [...gradesSet].sort((a, b) => Number(a) - Number(b));
  }, [students, selectedSite, gradeBand]);

  // Handle Grade Change
  const handleGradeChange = (gradeVal) => {
    setSelectedGrade(gradeVal);
    setSelectedStaff('ALL');
    setActiveStaffFilter(null);
  };

  // Compute available teachers / counselors for current filters
  const staffList = useMemo(() => {
    let pool = Array.isArray(students) ? students : [];
    if (selectedSite !== 'ALL') {
      pool = pool.filter(s => s && matchesSchoolSite(s.school, selectedSite));
    }
    pool = pool.filter(s => s && s.gradeBand === gradeBand);
    if (selectedGrade !== 'ALL') {
      pool = pool.filter(s => s && Number(s.grade) === Number(selectedGrade));
    }

    const map = new Map();
    pool.forEach(s => {
      if (s && s.staffName) {
        const name = s.staffName.trim();
        if (!map.has(name)) {
          map.set(name, {
            staffName: name,
            staffEmail: s.staffEmail || '',
            staffLabel: s.staffLabel || (gradeBand === 'Elementary' ? 'Teacher' : 'Counselor'),
            school: s.school || '',
            grade: s.grade ?? '',
            gradeBand: s.gradeBand || gradeBand
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => a.staffName.localeCompare(b.staffName));
  }, [students, selectedSite, gradeBand, selectedGrade]);

  // Handle Teacher / Counselor top dropdown change
  const handleStaffChange = (staffVal) => {
    setSelectedStaff(staffVal);
    if (!staffVal || staffVal === 'ALL') {
      setActiveStaffFilter(null);
    } else {
      const match = staffList.find(st => st.staffName === staffVal);
      setActiveStaffFilter(match || { staffName: staffVal });
    }
  };

  // Base cohort students for current site and gradeBand (before flag or staff filter)
  const cohortStudents = useMemo(() => {
    let list = Array.isArray(students) ? students.filter(Boolean) : [];

    if (selectedSite !== 'ALL') {
      list = list.filter(s => s && matchesSchoolSite(s.school, selectedSite));
    }

    list = list.filter(s => s && s.gradeBand === gradeBand);

    if (selectedGrade !== 'ALL') {
      list = list.filter(s => s && Number(s.grade) === Number(selectedGrade));
    }

    return list;
  }, [students, selectedSite, gradeBand, selectedGrade]);

  // Filtered students for current top-level parameters + active flag filters
  const filteredStudents = useMemo(() => {
    let list = cohortStudents;

    if (activeFlagFilter) {
      if (activeFlagFilter === 'SPED') {
        list = list.filter(s => Boolean(s.flags?.sped));
      } else if (activeFlagFilter === 'EL') {
        list = list.filter(s => {
          const elStat = (s.flags?.elStatus || '').toUpperCase().trim();
          return elStat === 'LEP' || elStat === 'EL';
        });
      } else if (activeFlagFilter === '504') {
        list = list.filter(s => Boolean(s.flags?.plan504));
      } else if (activeFlagFilter === 'HOMELESS_FOSTER') {
        list = list.filter(s => Boolean(s.flags?.homelessFoster));
      } else if (activeFlagFilter === 'BUBBLE') {
        list = list.filter(s => {
          const overall = s.latestOverall || s.latestEla;
          return isBubbleStudent(overall?.scaledScore, s.grade, overall?.performanceLevel);
        });
      }
    }

    if (activeStaffFilter) {
      const targetEmail = (activeStaffFilter.staffEmail || '').toLowerCase().trim();
      const targetName = (activeStaffFilter.staffName || '').toLowerCase().trim();

      const matched = list.filter(s => {
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

      if (matched.length > 0) {
        list = matched;
      } else {
        const broader = (Array.isArray(students) ? students : []).filter(s => {
          if (!s) return false;
          const sEmail = (s.staffEmail || '').toLowerCase().trim();
          const sName = (s.staffName || '').toLowerCase().trim();
          if (targetEmail && sEmail && targetEmail === sEmail) return true;
          if (targetName && sName && (targetName === sName || sName.includes(targetName) || targetName.includes(sName))) return true;
          return false;
        });
        list = broader;
      }
    }

    if (levelQuickFilter && activeView === 'overview') {
      list = list.filter(s => {
        if (!s) return false;
        const activeRec =
          subjectFocus === 'ORAL'
            ? (s.latestOral || s.latestOverall)
            : subjectFocus === 'WRITTEN'
            ? (s.latestWritten || s.latestOverall)
            : (s.latestOverall || s.latestEla);
        return activeRec?.performanceLevel === levelQuickFilter;
      });
    }

    return list;
  }, [cohortStudents, activeFlagFilter, activeStaffFilter, levelQuickFilter, subjectFocus, activeView, students]);

  // Explicitly scroll window to top whenever switching to roster view
  useEffect(() => {
    if (typeof window !== 'undefined' && activeView === 'roster') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [activeView]);

  // Drilldown handler for an entire grade cohort
  const handleSelectGradeRoster = (gradeNum) => {
    setSelectedGrade(String(gradeNum));
    setActiveStaffFilter(null);
    setSelectedStaff('ALL');
    setActiveView('roster');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  };

  // Drilldown handler from breakdown table or teacher/counselor row click
  const handleSelectStaff = (staffRow) => {
    if (!staffRow) return;

    setActiveStaffFilter(staffRow);
    setSelectedStaff(staffRow.staffName || 'ALL');

    if (staffRow.gradeBand && ['Elementary', 'Middle', 'High'].includes(staffRow.gradeBand)) {
      setGradeBand(staffRow.gradeBand);
    } else if (staffRow.grade !== undefined) {
      const g = Number(staffRow.grade);
      if (g <= 5) setGradeBand('Elementary');
      else if (g >= 6 && g <= 8) setGradeBand('Middle');
      else if (g >= 9 && g <= 12) setGradeBand('High');
    }

    if (selectedGrade !== 'ALL' && staffRow.grade !== undefined && Number(selectedGrade) !== Number(staffRow.grade)) {
      setSelectedGrade('ALL');
    }

    setActiveView('roster');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  };

  // Reset staff filter & view back to Executive Overview
  const handleClearStaffFilter = () => {
    setActiveStaffFilter(null);
    setSelectedStaff('ALL');
    setActiveView('overview');
  };

  if (isAuthResolving || (isLoading && students.length === 0)) {
    return (
      <div className="min-h-screen flex flex-col justify-between p-4 sm:p-8 bg-gradient-to-b from-slate-100 via-slate-50 to-blue-50 font-sans selection:bg-blue-600 selection:text-white">
        <div className="max-w-md w-full mx-auto my-auto space-y-6 text-center animate-fade-in">
          <div className="flex flex-col items-center">
            <img
              src={DISTRICT_LOGO}
              alt="WVUSD Logo"
              className="h-20 w-auto object-contain drop-shadow-md mb-3"
            />
            <span className="text-xs font-black uppercase tracking-widest text-blue-900">
              Walnut Valley Unified School District
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
              ELPAC Student Data & Intervention Portal
            </h1>
          </div>

          <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl border border-slate-200 space-y-4">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                Loading Live WVUSD ELPAC Student Dataset
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Verifying Google credentials and synchronizing California ELPAC longitudinal data...
              </p>
            </div>
          </div>
        </div>

        <footer className="text-center text-xs text-slate-400 pt-6">
          © 2026 Walnut Valley Unified School District • Educational Services & Data Analytics
        </footer>
      </div>
    );
  }

  if (!user) {
    return (
      <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
        <LoginView
          onLoginSuccess={(email, name) => fetchDashboardData(email, name, false)}
          onDemoLogin={handleDemoLogin}
          isLoading={isLoading}
          authError={authError}
        />
      </GoogleOAuthProvider>
    );
  }

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800">
        
        {/* Global Header Bar */}
        <HeaderBar
          user={user}
          onLogout={handleLogout}
          selectedSite={selectedSite}
          students={students}
          onSearchSelect={(s) => setActiveModalStudent(s)}
          onSwitchDemoRole={handleSwitchDemoRole}
        />

        {/* Executive Control Bar */}
        <ControlBar
          gradeBand={gradeBand}
          onGradeBandChange={handleGradeBandChange}
          availableGradeBands={availableGradeBands}
          subjectFocus={subjectFocus}
          onSubjectFocusChange={setSubjectFocus}
          sitesList={sitesList}
          selectedSite={selectedSite}
          onSiteChange={handleSiteChange}
          availableGrades={availableGrades}
          selectedGrade={selectedGrade}
          onGradeChange={handleGradeChange}
          staffList={staffList}
          selectedStaff={selectedStaff}
          onStaffChange={handleStaffChange}
          activeView={activeView}
          onViewChange={(view) => {
            setActiveView(view);
            if (view === 'roster' && typeof window !== 'undefined') {
              window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
            }
          }}
          user={user}
        />

        {/* Main Content Area Wrapped with Crash-Proof Error Boundary */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              <p className="text-sm font-semibold text-slate-600">
                Synchronizing California ELPAC Longitudinal Assessments...
              </p>
            </div>
          ) : (
            <ViewErrorBoundary onReset={handleClearStaffFilter}>
              {activeView === 'overview' ? (
                <ExecutiveOverview
                  students={filteredStudents}
                  cohortStudents={cohortStudents}
                  gradeBand={gradeBand}
                  subjectFocus={subjectFocus}
                  selectedSite={selectedSite}
                  onSelectStaff={handleSelectStaff}
                  onSelectGradeRoster={handleSelectGradeRoster}
                  onSelectLevelFilter={setLevelQuickFilter}
                  activeFlagFilter={activeFlagFilter}
                  onSelectFlagFilter={setActiveFlagFilter}
                />
              ) : (
                <TeacherCohortView
                  students={filteredStudents}
                  gradeBand={gradeBand}
                  subjectFocus={subjectFocus}
                  user={user}
                  onStudentClick={(s) => setActiveModalStudent(s)}
                  activeStaffFilter={activeStaffFilter}
                  onClearStaffFilter={handleClearStaffFilter}
                  onBackToOverview={() => setActiveView('overview')}
                />
              )}
            </ViewErrorBoundary>
          )}
        </main>

        {/* Longitudinal History & AI Prompt Modal */}
        {activeModalStudent && (
          <StudentModal
            student={activeModalStudent}
            onClose={() => setActiveModalStudent(null)}
          />
        )}

        {/* Portal Footer */}
        <footer className="bg-white border-t border-slate-200/80 py-4 text-center text-xs text-slate-500 no-print">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              Walnut Valley Unified School District • 880 S. Lemon Ave, Walnut, CA 91789
            </span>
            <span className="font-mono text-slate-400">
              California ELPAC Longitudinal Analytics Portal • v2.0
            </span>
          </div>
        </footer>

      </div>
    </GoogleOAuthProvider>
  );
}

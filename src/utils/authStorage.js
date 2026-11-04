// src/utils/authStorage.js
// WVUSD ELPAC Portal - Authentication Persistence & Storage Guard Utilities
import { jwtDecode } from 'jwt-decode';
import { isValidWvusdEmail } from '../config.js';

export const STORAGE_KEYS = {
  USER: 'wvusd_elpac_user',
  CREDENTIAL: 'wvusd_elpac_credential',
  STUDENTS: 'wvusd_elpac_students',
  SESSION_COOKIE: 'wvusd_elpac_session',
  CUSTOM_GAS_URL: 'wvusd_elpac_gas_url'
};

/**
 * Cookie retrieval helper
 */
export function getCookie(name) {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

/**
 * Cookie setter helper
 */
export function setCookie(name, value, days = 7) {
  if (typeof document === 'undefined') return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/**
 * Cookie removal helper
 */
export function removeCookie(name) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

/**
 * Persists user session in active sessionStorage
 */
export function saveUserSession(user, rawCredential = null) {
  if (!user || !user.email) return;

  const serialized = JSON.stringify(user);

  try {
    sessionStorage.setItem(STORAGE_KEYS.USER, serialized);
  } catch (err) {
    console.warn('Unable to persist user to sessionStorage:', err);
  }

  if (rawCredential) {
    try {
      sessionStorage.setItem(STORAGE_KEYS.CREDENTIAL, rawCredential);
    } catch (err) {
      console.warn('Unable to persist raw credential to sessionStorage:', err);
    }
  }
}

/**
 * Persists cached students in storage with quota safety
 */
export function saveCachedStudents(students) {
  if (!Array.isArray(students) || students.length === 0) return;
  try {
    const serialized = JSON.stringify(students);
    try {
      sessionStorage.setItem(STORAGE_KEYS.STUDENTS, serialized);
    } catch {
      // Session storage quota might be hit
    }
  } catch (err) {
    console.warn('Failed to serialize cached students:', err);
  }
}

/**
 * Retrieves cached students from storage
 */
export function getCachedStudents() {
  try {
    const fromSession = sessionStorage.getItem(STORAGE_KEYS.STUDENTS);
    if (fromSession) {
      const parsed = JSON.parse(fromSession);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }

  return [];
}

/**
 * Completely clears all stored session credentials, tokens, and cached datasets
 */
export function clearUserSession() {
  try {
    localStorage.removeItem(STORAGE_KEYS.USER);
    localStorage.removeItem(STORAGE_KEYS.CREDENTIAL);
    localStorage.removeItem(STORAGE_KEYS.STUDENTS);
    sessionStorage.removeItem(STORAGE_KEYS.USER);
    sessionStorage.removeItem(STORAGE_KEYS.CREDENTIAL);
    sessionStorage.removeItem(STORAGE_KEYS.STUDENTS);
    removeCookie(STORAGE_KEYS.SESSION_COOKIE);
    removeCookie(STORAGE_KEYS.CREDENTIAL);
  } catch (err) {
    console.warn('Error clearing storage:', err);
  }
}

/**
 * Validates and extracts a stored session from active sessionStorage.
 * Strictly verifies active @wvusd.org session state.
 */
export function getStoredSession() {
  const checkUserJson = (jsonStr) => {
    if (!jsonStr) return null;
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed && parsed.email && isValidWvusdEmail(parsed.email)) {
        if (parsed.authorized !== false) {
          return {
            user: parsed,
            email: parsed.email.toLowerCase().trim(),
            name: parsed.name || parsed.email.split('@')[0],
            source: 'sessionStorage'
          };
        }
      }
    } catch {
      return null;
    }
    return null;
  };

  try {
    const sessionUser = checkUserJson(sessionStorage.getItem(STORAGE_KEYS.USER));
    if (sessionUser) return sessionUser;
  } catch (err) {
    console.warn('Error reading sessionStorage user:', err);
  }

  const checkCredentialToken = (token) => {
    if (!token) return null;
    try {
      const decoded = jwtDecode(token);
      if (!decoded || !decoded.email) return null;

      if (decoded.exp && (decoded.exp * 1000) <= Date.now()) {
        console.warn('Stored Google credential has expired');
        return null;
      }

      const email = decoded.email.toLowerCase().trim();
      if (!isValidWvusdEmail(email)) {
        console.warn('Stored Google credential domain is not authorized');
        return null;
      }

      return {
        email,
        name: decoded.name || email.split('@')[0],
        credential: token,
        source: 'sessionStorage_credential'
      };
    } catch {
      return null;
    }
  };

  try {
    const credSession = checkCredentialToken(sessionStorage.getItem(STORAGE_KEYS.CREDENTIAL));
    if (credSession) return credSession;
  } catch (err) {
    console.warn('Error reading sessionStorage credential:', err);
  }

  return null;
}

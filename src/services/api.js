// src/services/api.js
// Client API for WVUSD ELPAC Portal with token authentication & zero-trust verification

import { APPS_SCRIPT_URL, APP_SECRET_TOKEN } from '../config.js';

/**
 * Fetch ELPAC/ELD assessment data for a verified WVUSD user with appToken
 * @param {string} userEmail
 * @param {string} fallbackName
 * @returns {Promise<{ user: object, meta: object, students: Array }>}
 */
export async function fetchElpacData(userEmail, fallbackName = '') {
  if (!APPS_SCRIPT_URL || !APPS_SCRIPT_URL.startsWith('http')) {
    throw new Error('Google Apps Script Web App URL is not configured.');
  }

  const cleanEmail = (userEmail || '').trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error('Email is required to request student assessment records.');
  }

  const queryParams = new URLSearchParams({
    email: cleanEmail,
    appToken: APP_SECRET_TOKEN || ''
  });

  const url = `${APPS_SCRIPT_URL}?${queryParams.toString()}`;

  const response = await fetch(url, {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Server returned HTTP ${response.status}`);
  }

  const data = await response.json();

  // Handle explicit Forbidden / Unauthorized zero-trust response
  if (data && (data.status === 'Forbidden' || data.success === false)) {
    const error = new Error(data.message || data.error || 'Access Denied: Unauthorized request.');
    error.status = 'Forbidden';
    error.isForbidden = true;
    throw error;
  }

  if (data && data.error) {
    const error = new Error(data.error);
    if (data.error.toLowerCase().includes('unauthorized') || data.error.toLowerCase().includes('forbidden')) {
      error.status = 'Forbidden';
      error.isForbidden = true;
    }
    throw error;
  }

  if (!data || !data.user || !data.user.authorized) {
    const error = new Error('User is not authorized to access this portal.');
    error.status = 'Forbidden';
    error.isForbidden = true;
    throw error;
  }

  const verifiedUser = {
    ...data.user,
    name: data.user.name || fallbackName || cleanEmail.split('@')[0]
  };

  const fetchedStudents = Array.isArray(data.students) ? data.students : [];

  return {
    user: verifiedUser,
    meta: data.meta || {},
    students: fetchedStudents
  };
}

// Shared Axios client for the Express backend.
// - Base URL comes from VITE_API_URL (see .env.example in the project root), default http://localhost:5000/api
// - The login token lives in sessionStorage and is attached to every request as "Authorization: Bearer <token>".
// - The token only identifies the caller. The server re-checks role and active status on every request,
//   so nothing here (or in any React component) is a security control.
import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const TOKEN_KEY = 'campusbook_api_token';

export const getToken = () => { try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; } };
export const setToken = (token) => {
  try { token ? sessionStorage.setItem(TOKEN_KEY, token) : sessionStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
};

// Fired when the server rejects a stored token (expired, deactivated account, ...). App listens and signs the user out.
export const SESSION_EXPIRED_EVENT = 'api:session-expired';

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // 401 = not signed in / token no longer valid. (403 = signed in but not allowed, which is shown as a normal error.)
    // A failed login is also a 401, but there is no session to end then, so only react when a token was sent.
    if (error.response?.status === 401 && getToken()) {
      setToken(null);
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  }
);

export const isCanceled = (error) => axios.isCancel(error);

// Turns any Axios error into a sentence that is safe to show to the user.
export function errorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (error.response) return error.response.data?.message || fallback;
  if (error.request) return 'Cannot reach the server. Check that the backend is running and try again.';
  return fallback;
}

export default api;

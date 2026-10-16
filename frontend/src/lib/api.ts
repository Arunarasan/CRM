import axios from 'axios';
import { isCacheable, storeResponse, lookupResponse, OFFLINE_CACHE_EVENT } from '@/offline/readCache';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  // The refresh token lives in an HttpOnly cookie scoped to /api/auth; send cookies to the API.
  withCredentials: true,
});

/** Ends the session server-side (revokes the refresh token), clears it locally, and goes to sign-in. */
export async function signOut(): Promise<void> {
  try {
    await api.post('/auth/logout', {});
  } catch {
    // Offline or already expired — the local session is cleared regardless.
  }
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('userRoles');
  localStorage.removeItem('mustChangePassword');
  window.location.href = import.meta.env.BASE_URL + 'login';
}

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    if (response.data && typeof response.data === 'object' && 'success' in response.data) {
      if (response.data.success) {
        response.data = response.data.data; 
        if (isCacheable(response.config)) storeResponse(response.config, response.data);
        return response;
      } else {
        return Promise.reject(new Error(response.data.message || 'API Error'));
      }
    }
    if (isCacheable(response.config)) storeResponse(response.config, response.data);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // No connection: a read screen the portal has seen before is answered from the phone's saved copy.
    if (!error.response && originalRequest && isCacheable(originalRequest)) {
      const hit = await lookupResponse(originalRequest);
      if (hit) {
        window.dispatchEvent(new CustomEvent(OFFLINE_CACHE_EVENT, { detail: { savedAt: hit.savedAt } }));
        return { data: hit.data, status: 200, statusText: 'OK (saved copy)', headers: {}, config: originalRequest, request: null };
      }
    }

    const isAuthEndpoint = originalRequest?.url?.includes('/auth/login') || originalRequest?.url?.includes('/auth/refresh');

    if (error.response && error.response.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = 'Bearer ' + token;
            return axios(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // The HttpOnly refresh cookie goes along automatically; scripts never see it.
        const { data } = await axios.post(`${api.defaults.baseURL}/auth/refresh`, {}, { withCredentials: true });

        // /auth/refresh answers { accessToken } (not the { success, data } envelope) and rotates the
        // refresh cookie itself.
        const body = data?.data ?? data;
        const newAccessToken = body.accessToken || body.token;
        if (!newAccessToken) throw new Error('Refresh failed');

        localStorage.setItem('token', newAccessToken);

        api.defaults.headers.common['Authorization'] = 'Bearer ' + newAccessToken;
        processQueue(null, newAccessToken);
        
        return api(originalRequest);
      } catch (err) {
        processQueue(err, null);
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        // Respect the app base (/crm/ in the Option A production build) so an expired session
        // returns to the CRM login, not the public website's customer login at root.
        window.location.href = import.meta.env.BASE_URL + 'login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;

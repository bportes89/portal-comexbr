import axios from 'axios';

export const isDemoMode = () => {
  if (process.env.NEXT_PUBLIC_API_URL) return false;
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return host !== 'localhost' && host !== '127.0.0.1';
};

const api = axios.create({
  baseURL:
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1')
      ? 'http://localhost:3000'
      : ''),
});

api.interceptors.request.use((config) => {
  if (isDemoMode()) {
    return Promise.reject(Object.assign(new Error('DEMO_MODE'), { code: 'DEMO_MODE' }));
  }
  return config;
});

export default api;

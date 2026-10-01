import { create } from 'axios';

// Set EXPO_PUBLIC_API_URL in mobile/.env to the address reachable by the phone.
const api = create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api',
  timeout: 20000,
});

let token = null;
export function setToken(value) { token = value; }

api.interceptors.request.use(config => {
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;

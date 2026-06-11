import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API,
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("aog_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      // Token expired or invalid
      const path = window.location.pathname;
      if (path !== "/login") {
        localStorage.removeItem("aog_token");
        localStorage.removeItem("aog_user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

// Build absolute URL for uploaded files served at /uploads
export const fileUrl = (path) => {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${BACKEND_URL}${path}`;
};

export default api;

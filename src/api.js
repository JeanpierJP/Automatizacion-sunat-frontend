import axios from 'axios';

// Si existe la variable de entorno, úsala. Si no, usa localhost (para desarrollo).
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
    baseURL: API_URL,
});

export const syncEmail = () => api.post('/sync-email');

export default api;
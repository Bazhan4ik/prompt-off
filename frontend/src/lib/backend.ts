import { PUBLIC_BACKEND_URL } from '$env/static/public';

// In dev the Vite proxy handles /api and /socket.io, so we use ''.
// In production set PUBLIC_BACKEND_URL to your Railway URL.
export const BACKEND_URL = PUBLIC_BACKEND_URL ?? '';

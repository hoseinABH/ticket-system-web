import { HttpErrorResponse } from '@angular/common/http';
import type { ApiError } from './models';

// Proxied to the backend by the dev server (proxy.conf.json), so the browser
// talks to a single origin and the API needs no CORS setup
export const API = '/api';

// Turns the backend's standard error body into one readable line
export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as Partial<ApiError> | null;
    if (body?.message) {
      return Array.isArray(body.message)
        ? body.message.join('; ')
        : body.message;
    }
    if (error.status === 0) {
      return 'Cannot reach the API. Is the backend running on port 3000?';
    }
    return `${error.status} ${error.statusText}`;
  }
  return String(error);
}

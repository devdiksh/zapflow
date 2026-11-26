import { HttpErrorResponse } from '@angular/common/http';

export interface FieldError {
  path: string;
  message: string;
}

/** The server answers errors as `{ error: string, details?: FieldError[] }`. */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as { error?: unknown } | null;
    if (typeof body?.error === 'string') {
      return body.error;
    }
    if (err.status === 0 || err.status === 504) {
      return 'Can’t reach the ZapFlow server. Is it running?';
    }
  }
  return fallback;
}

/** Validation problems keyed by field path, e.g. `trigger.config.repo`. */
export function apiFieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof HttpErrorResponse)) {
    return {};
  }
  const details = (err.error as { details?: unknown } | null)?.details;
  if (!Array.isArray(details)) {
    return {};
  }
  const errors: Record<string, string> = {};
  for (const detail of details as FieldError[]) {
    errors[detail.path] ??= detail.message;
  }
  return errors;
}

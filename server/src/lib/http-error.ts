/**
 * An error that maps directly to an HTTP response. Throw it from a route
 * (Express 5 forwards rejected promises to the error handler).
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

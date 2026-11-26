/** Shapes returned by the ZapFlow API (server/src). */

export interface User {
  id: string;
  login: string;
  name: string | null;
  avatarUrl: string | null;
}

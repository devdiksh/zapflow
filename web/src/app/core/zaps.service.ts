import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Zap, ZapInput } from './models';

/** Writes to /api/zaps. Reads use httpResource in the pages. */
@Injectable({ providedIn: 'root' })
export class ZapsService {
  private readonly http = inject(HttpClient);

  get(id: string): Promise<Zap> {
    return firstValueFrom(this.http.get<Zap>(`/api/zaps/${encodeURIComponent(id)}`));
  }

  create(input: ZapInput): Promise<Zap> {
    return firstValueFrom(this.http.post<Zap>('/api/zaps', input));
  }

  update(id: string, changes: Partial<ZapInput>): Promise<Zap> {
    return firstValueFrom(this.http.patch<Zap>(`/api/zaps/${encodeURIComponent(id)}`, changes));
  }

  delete(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/zaps/${encodeURIComponent(id)}`));
  }
}

import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ZapInput } from './models';

export interface CopilotResult {
  supported: boolean;
  /** Copilot's note to the user: what it drafted, or why it couldn't. */
  message: string;
  /** Always `enabled: false`; `trigger.config.repo` is '' when the user still has to pick one. */
  draft: ZapInput | null;
}

@Injectable({ providedIn: 'root' })
export class CopilotService {
  private readonly http = inject(HttpClient);

  readonly status = httpResource<{ enabled: boolean }>(() => '/api/copilot/status');

  draft(prompt: string): Promise<CopilotResult> {
    return firstValueFrom(this.http.post<CopilotResult>('/api/copilot/draft', { prompt }));
  }
}

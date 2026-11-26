import { httpResource } from '@angular/common/http';
import { Component, OnInit, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { apiErrorMessage, apiFieldErrors } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { CatalogService } from '../../core/catalog.service';
import { Repo, ZapInput } from '../../core/models';
import { ZapsService } from '../../core/zaps.service';
import { Toggle } from '../../shared/toggle';
import { AppPicker } from './app-picker';
import { CopilotPanel } from './copilot-panel';
import { TemplateEditor } from './template-editor';

/** Create (/zaps/new) or edit (/zaps/:id) a Zap: name, on/off, trigger step, action step. */
@Component({
  selector: 'app-zap-builder-page',
  imports: [RouterLink, Toggle, AppPicker, TemplateEditor, CopilotPanel],
  templateUrl: './zap-builder-page.html',
  styleUrl: './zap-builder-page.scss',
})
export class ZapBuilderPage implements OnInit {
  /** Route param (withComponentInputBinding); absent on /zaps/new. */
  readonly id = input<string>();
  /** `?copilot=1` from the list's "Build with Copilot" button focuses the Copilot prompt. */
  readonly copilot = input<string>();

  private readonly zapsApi = inject(ZapsService);
  private readonly router = inject(Router);
  protected readonly catalog = inject(CatalogService);
  protected readonly auth = inject(AuthService);

  protected readonly repos = httpResource<Repo[]>(() => '/api/github/repos', { defaultValue: [] });

  // Form state
  protected readonly name = signal('');
  protected readonly enabled = signal(false);
  protected readonly triggerApp = signal<string | null>('github');
  protected readonly triggerEvent = signal<string | null>('pull_request.opened');
  protected readonly repo = signal('');
  protected readonly actionApp = signal<string | null>('github');
  protected readonly actionType = signal<string | null>('comment_on_pr');
  protected readonly template = signal('');

  // Page state
  protected readonly loading = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly fieldErrors = signal<Record<string, string>>({});

  protected readonly isEdit = computed(() => !!this.id());
  protected readonly trigger = computed(() => this.catalog.trigger(this.triggerApp(), this.triggerEvent()));
  protected readonly action = computed(() => this.catalog.action(this.actionApp(), this.actionType()));
  protected readonly triggerAppDef = computed(() => this.catalog.app(this.triggerApp()));
  protected readonly actionAppDef = computed(() => this.catalog.app(this.actionApp()));
  protected readonly fields = computed(() => this.trigger()?.fields ?? []);

  /** Used when the name is left empty. */
  protected readonly suggestedName = computed(() =>
    this.repo() ? `Comment on new PRs in ${this.repo()}` : 'Comment on new pull requests',
  );

  /** Keep the saved repo selectable even if it's no longer in the user's admin list. */
  protected readonly repoOptions = computed(() => {
    const names = this.repos.value().map((repo) => repo.fullName);
    const current = this.repo();
    return current && !names.includes(current) ? [current, ...names] : names;
  });

  protected readonly missing = computed(() => {
    const missing: string[] = [];
    if (!this.trigger()) missing.push('a trigger');
    if (!this.repo()) missing.push('a repository');
    if (!this.action()) missing.push('an action');
    if (!this.template().trim()) missing.push('a comment');
    return missing;
  });

  constructor() {
    // New Zaps start with the default comment once the catalog has loaded.
    effect(() => {
      const defaultTemplate = this.catalog.defaultCommentTemplate();
      if (!this.isEdit() && defaultTemplate && !untracked(this.template)) {
        this.template.set(defaultTemplate);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    const id = this.id();
    if (!id) {
      return;
    }
    this.loading.set(true);
    try {
      const zap = await this.zapsApi.get(id);
      this.name.set(zap.name);
      this.enabled.set(zap.enabled);
      this.triggerApp.set(zap.trigger.app);
      this.triggerEvent.set(zap.trigger.event);
      this.repo.set(zap.trigger.config.repo);
      this.actionApp.set(zap.action.app);
      this.actionType.set(zap.action.type);
      this.template.set(zap.action.config.template);
    } catch (err) {
      this.loadError.set(apiErrorMessage(err, 'Couldn’t load this Zap.'));
    } finally {
      this.loading.set(false);
    }
  }

  /** Loads a Copilot draft into the form. It stays off until the user turns it on. */
  protected applyDraft(draft: ZapInput): void {
    this.name.set(draft.name);
    this.enabled.set(false);
    this.triggerApp.set(draft.trigger.app);
    this.triggerEvent.set(draft.trigger.event);
    this.repo.set(draft.trigger.config.repo);
    this.actionApp.set(draft.action.app);
    this.actionType.set(draft.action.type);
    this.template.set(draft.action.config.template);
    this.saveError.set(null);
    this.fieldErrors.set(
      draft.trigger.config.repo ? {} : { 'trigger.config.repo': 'Pick the repository this Zap should watch.' },
    );
  }

  protected selectTriggerApp(appId: string | null): void {
    this.triggerApp.set(appId);
    this.triggerEvent.set(this.catalog.app(appId)?.triggers[0]?.id ?? null);
  }

  protected selectActionApp(appId: string | null): void {
    this.actionApp.set(appId);
    this.actionType.set(this.catalog.app(appId)?.actions[0]?.id ?? null);
  }

  protected selectRepo(repo: string): void {
    this.repo.set(repo);
    this.fieldErrors.update(({ ['trigger.config.repo']: _, ...rest }) => rest);
  }

  protected async save(): Promise<void> {
    const triggerApp = this.triggerApp();
    const triggerEvent = this.triggerEvent();
    const actionApp = this.actionApp();
    const actionType = this.actionType();
    if (this.missing().length || !triggerApp || !triggerEvent || !actionApp || !actionType) {
      return;
    }

    const input: ZapInput = {
      name: this.name().trim() || this.suggestedName(),
      enabled: this.enabled(),
      trigger: { app: triggerApp, event: triggerEvent, config: { repo: this.repo() } },
      action: { app: actionApp, type: actionType, config: { template: this.template() } },
    };

    this.saving.set(true);
    this.saveError.set(null);
    this.fieldErrors.set({});
    try {
      const id = this.id();
      if (id) {
        await this.zapsApi.update(id, input);
      } else {
        await this.zapsApi.create(input);
      }
      await this.router.navigate(['/zaps']);
    } catch (err) {
      this.saveError.set(apiErrorMessage(err, 'Couldn’t save this Zap.'));
      this.fieldErrors.set(apiFieldErrors(err));
    } finally {
      this.saving.set(false);
    }
  }

  protected reposErrorMessage(): string {
    return apiErrorMessage(this.repos.error(), 'Couldn’t load your repositories.');
  }
}

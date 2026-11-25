# ZapFlow

A small workflow automation app in the spirit of Zapier's Zaps: **a trigger plus an action**. You sign in with GitHub and build a Zap such as:

> **When** a pull request is opened in `you/your-repo` → **comment** on that pull request: `Thanks @{{pr.author}} for opening "{{pr.title}}"! 🎉`

Open a PR on that repo and the comment shows up a few seconds later. There's also a **Copilot**: describe a Zap in plain English and it fills in the builder for you to review and turn on.

Stack: **MongoDB, Express 5, Angular 22, Node 22**, TypeScript everywhere.

---

## Contents

- [Architecture](#architecture)
- [Data model](#data-model)
- [API](#api)
- [Setup](#setup)
- [Demo script](#demo-script)
- [Decisions and trade-offs](#decisions-and-trade-offs)
- [What I'd do next](#what-id-do-next)
- [Tests](#tests)
- [Time log](#time-log)
- [How I used AI](#how-i-used-ai)

---

## Architecture

```
                      ┌──────────────────────────── your machine ─────────────────────────────┐
 Browser ── :4200 ──► │ Angular dev server ──/api proxy──► Express API :3000 ──► MongoDB :27017│
                      │                                       │      ▲                         │
                      │                         GitHub REST ◄─┘      │ POST /api/webhooks/github
                      │                  (OAuth, repos, hooks,       │                         │
                      │                   comments; user's token)    │                         │
                      │                                   smee-client (forwards)               │
                      └──────────────────────────────────────────────▲─────────────────────────┘
                                                                     │
                                GitHub ── webhook (pull_request) ──► smee.io channel
```

- The browser only talks to `:4200`. `web/proxy.conf.json` forwards `/api/*` (including the OAuth redirect back from GitHub) to Express, so session cookies are same-origin and there is no CORS.
- GitHub can't reach `localhost`, so webhooks go to a public **smee.io** channel, and `smee-client` forwards them to the API.

**What happens when a PR is opened**

1. GitHub sends a `pull_request` delivery to the repo's ZapFlow webhook, which reaches `POST /api/webhooks/github` through smee.
2. The API checks `X-Hub-Signature-256` (HMAC-SHA256 of the **raw** body with `GITHUB_WEBHOOK_SECRET`) and returns `200` right away.
3. For `action: "opened"`, it loads every **enabled** Zap whose trigger is `github / pull_request.opened` on that `repository.full_name`.
4. For each Zap it renders the comment template with the PR's fields and posts it with **the Zap owner's** GitHub token.
5. It records `lastRunAt`, `lastRunStatus` and `lastRunError` on the Zap, and the list shows them.

**Code map**

```
server/src
  index.ts                 connect Mongo, session store, listen
  app.ts                   createApp(): middleware order, routers, error mapping
  config.ts                env validated with zod (fails fast with a readable message)
  apps/catalog.ts          the app catalog: apps, triggers, actions, fields, status
  models/                  User (token is select:false), Zap
  validation/zap.ts        zod schemas for create/patch (only runnable combos)
  routes/                  auth, zaps, github (repos), apps, webhooks, copilot
  services/
    github.ts              OAuth URL + code exchange, Octokit client, admin repo list
    repo-webhooks.ts       one shared webhook per repo: ensure / release
    zap-triggers.ts        turning a Zap on/off → webhook lifecycle + friendly errors
    webhook-signature.ts   HMAC verification
    pull-request-event.ts  payload schema + the fields a PR exposes
    template.ts            {{field}} rendering
    runner.ts              runs matching Zaps, records results
    copilot.ts             Claude call with structured output → draft Zap
web/src/app
  core/                    auth service + guards + 401 interceptor, API services, models
  layout/                  shell header, logo
  pages/zaps/              Zap list
  pages/zap-builder/       builder, app picker, template editor (chips + preview), Copilot panel
  shared/                  toggle, app icon, time-ago pipe, template renderer for previews
```

---

## Data model

```ts
User {
  githubId: number (unique), login, name?, avatarUrl?,
  accessToken: string   // select:false, never sent to the browser
  scopes: string[]
}

Zap {
  ownerId: ObjectId → User          // every query is scoped by this
  name: string
  enabled: boolean
  trigger: { app: 'github', event: 'pull_request.opened', config: { repo: 'owner/name' } }
  action:  { app: 'github', type: 'comment_on_pr',       config: { template: string } }
  webhookId?: number                // the repo webhook this Zap relies on (shared per repo)
  lastRunAt?, lastRunStatus?: 'success' | 'error', lastRunError?
  createdAt, updatedAt
}
// index: { trigger.app, trigger.event, trigger.config.repo, enabled } for the runner lookup

sessions  // express-session via connect-mongo, so restarts don't sign you out
```

`trigger` and `action` are generic (`app` + `event|type` + app-specific `config`), so the model doesn't need to change for new apps. What changes is validation (`validation/zap.ts`) and an entry in the runner's action table (`services/runner.ts`).

---

## API

All routes are under `/api`. Zap and GitHub routes require a session; anything else gets `401`.

| Method | Path | What it does |
|---|---|---|
| GET | `/auth/github` | Redirects to GitHub (scopes `read:user repo admin:repo_hook`, random `state` kept in the session) |
| GET | `/auth/github/callback` | Checks `state`, exchanges the code, upserts the user, regenerates the session, redirects to `/zaps` |
| GET | `/auth/me` | Signed-in user, or `401` |
| POST | `/auth/logout` | Ends the session |
| GET | `/apps` | App catalog (picker, field chips, preview samples) |
| GET | `/github/repos` | Repos where the user is admin (needed to add a webhook) |
| GET / POST | `/zaps` | List / create. Creating an enabled Zap adds the repo webhook first |
| GET / PATCH / DELETE | `/zaps/:id` | Read / update / delete. On/off and repo changes update the webhook |
| POST | `/webhooks/github` | GitHub deliveries (signature-checked, raw body) |
| GET | `/copilot/status` | `{ enabled }` (is `ANTHROPIC_API_KEY` set) |
| POST | `/copilot/draft` | `{ prompt }` → `{ supported, message, draft }`. Never saved, never enabled |

Errors come back as `{ error, details? }`. Validation `details` are `{ path, message }`, and the builder shows each one next to its field.

---

## Setup

You need **Node 22** (`nvm use`), **Docker** (or a local MongoDB) and a GitHub account with a repo you're an admin of.

**1. MongoDB**

```bash
docker run -d --name zapflow-mongo -p 27017:27017 mongo:7
```

**2. A smee.io channel** (so GitHub can reach your machine)

Open <https://smee.io/new> and copy the channel URL. Keep this running in a terminal:

```bash
npx smee-client --url https://smee.io/<your-channel> --target http://localhost:3000/api/webhooks/github
```

**3. A GitHub OAuth App**: github.com → Settings → Developer settings → OAuth Apps → *New OAuth App*

| Field | Value |
|---|---|
| Homepage URL | `http://localhost:4200` |
| Authorization callback URL | `http://localhost:4200/api/auth/github/callback` |

Generate a client secret.

**4. Server env**

```bash
cp server/.env.example server/.env
```

| Variable | Value |
|---|---|
| `SESSION_SECRET` | long random string: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` | from step 3 |
| `WEBHOOK_PUBLIC_URL` | the smee channel URL from step 2 |
| `GITHUB_WEBHOOK_SECRET` | another long random string |
| `ANTHROPIC_API_KEY` | optional, turns on the Copilot |
| `MONGODB_URI`, `PORT`, `APP_URL`, `GITHUB_CALLBACK_URL` | defaults work locally |

The server checks all of this at startup and tells you exactly what's missing.

**5. Run it** (two terminals, plus smee from step 2)

```bash
cd server && npm install && npm run dev     # API on :3000 (tsx watch)
cd web    && npm install && npm start       # Angular on :4200, proxies /api
```

Open <http://localhost:4200>.

---

## Demo script

1. **Sign in with GitHub** and approve the scopes.
2. **Create Zap** → Trigger: GitHub → *Pull request opened* → pick a repo you own. Action: GitHub → *Comment on pull request*. Click the field chips to insert `{{pr.title}}` and friends, and watch the preview.
3. Switch it **On** and click **Create Zap**. (Repo → Settings → Webhooks now shows a hook pointing at your smee URL.)
4. Open a PR on that repo (a one-line README change is enough). The comment appears within a few seconds, posted as you. Come back to ZapFlow and the row says **✓ Ran just now**.
5. Turn the Zap off and the webhook is removed (unless another enabled Zap still uses that repo).
6. Copilot (with `ANTHROPIC_API_KEY` set): **✨ Build with Copilot** → "When a pull request is opened, comment thanks" → **Draft Zap**. The form fills in and the Zap stays off; pick a repo if Copilot couldn't tell which one, review it, turn it on and save. Ask for something we don't run yet ("post to Slack when a PR is merged") and Copilot explains instead of drafting.

If nothing happens on step 4: check the smee terminal (did the delivery arrive?), the API logs (`[webhook]` / `[runner]` lines), and the Zap row (a failed run shows its error).

---

## Decisions and trade-offs

**Repo webhooks created with the user's OAuth token (not a GitHub App).** This is the smallest setup that meets the brief: one OAuth App gives us sign-in, the repo list, hook management and comments. The cost is broad scopes (`repo`, `admin:repo_hook`), comments posted *as the user*, and only repos where the user is admin. A GitHub App would get narrow, per-repo permissions, post as a bot, and receive events through a single app webhook with no per-repo hooks to manage. That's what I'd move to for production.

**One webhook per repo, shared by all Zaps on it.** If each Zap had its own hook, two Zaps on one repo would mean two deliveries, and both Zaps would run twice. Instead we find our hook by URL, reuse it (re-applying the config, so a changed secret is picked up), and delete it only when **no enabled Zap from any user** still needs that repo. Duplicate hooks left behind by a race are cleaned up the next time a Zap on that repo is turned on.

**"On" means the webhook exists.** An enabled Zap is saved only after the webhook was created, so the switch never claims a Zap will run when it can't. If it fails (usually no admin access), nothing is saved and the user sees why. Removing a hook happens *after* saving and is best effort: a leftover hook only delivers events that no Zap matches.

**Acknowledge first, then work.** The webhook answers `200` once the signature is checked, then posts comments in-process. That's fine for a demo, but a crash between the response and the comment loses that run (see next steps).

**Signature checks on the raw body.** The webhook router is mounted before `express.json()`. One caveat for dev: `smee-client` forwards `JSON.stringify(parsedBody)`, not GitHub's original bytes. For GitHub's compact JSON that's normally byte-identical (Probot's dev setup relies on the same thing), but a payload with unusual escaping could fail verification in dev only. Production delivery is direct, so it doesn't apply there.

**Token storage.** The GitHub token lives only in Mongo, never in the browser. It's `select: false`, so it can't end up in an API response unless a query explicitly asks for it. It is **not encrypted at rest** here; in production I'd encrypt it (KMS / envelope encryption) or use short-lived GitHub App installation tokens.

**CSRF.** The session cookie is `httpOnly` and `SameSite=Lax`, so other sites can't make state-changing requests with it, and the OAuth `state` parameter protects the login flow. That's adequate for a same-origin JSON API.

**Generic model, strict validation.** The schema stores any `{ app, event|type, config }`, but the API only accepts combinations that actually run, so nothing half-supported gets saved. The app catalog (`apps/catalog.ts`) is the single list the picker, the field chips, the preview and the Copilot prompt all read from.

**Other apps in the picker.** Slack, Jira, Linear, GitLab and Vercel show as *Coming soon*, with a tooltip saying what they'd trigger or do. Making one real takes:
- an auth/connection model (per-app OAuth tokens or API keys on a `Connection` collection, not on `User`),
- a trigger source (webhooks where the app has them, otherwise polling),
- an action handler in `runner.ts`, and
- that app's zod schema and catalog entry.

GitLab is the closest to what exists, since it has the same webhook model.

**Copilot is a form-filler, not an agent.** One Claude call (`claude-opus-5-5`, low effort, structured output against a zod schema) with the catalog, the field list and the user's repo names in the prompt. We don't trust its answer: the repo must be one of the user's (otherwise the user picks), the template must pass normal validation, and the draft is always **off**, so a person reviews it before anything runs. If the API key isn't set, the UI says so instead of breaking.

**UI.** Plain SCSS with a few CSS variables, no UI library. Signals throughout; `httpResource` for reads. The list refreshes when the window regains focus, so after opening a PR on GitHub you come back to the new run status.

---

## What I'd do next

1. **A job queue with retries** (BullMQ/Agenda) between the webhook and the runner, plus idempotency on `X-GitHub-Delivery` so redeliveries don't comment twice.
2. **GitHub App instead of OAuth App** (bot identity, fine-grained permissions, one app-level webhook, no per-repo hook management).
3. **Encrypt tokens at rest** and handle token revocation: mark the Zap as needing reconnection.
4. **Run history** per Zap (a `ZapRun` collection) instead of only the last run.
5. **Integration tests** with an in-memory Mongo and a mocked GitHub API (CRUD scoping, webhook lifecycle, runner), plus a few Angular component tests.
6. A per-repo lock (or unique index) around hook creation to close the race on two simultaneous enables.

---

## Tests

```bash
cd server && npm test        # node:test via tsx, no database or network needed
cd server && npm run typecheck
cd web && npx ng build
```

34 tests cover:
- **webhook signatures**: GitHub's documented test vector, tampered bodies, wrong secrets, missing or sha1 headers, raw bytes vs re-serialized JSON
- **template rendering**: every field, unknown placeholders kept, `$&` inserted literally, fields kept in sync with the catalog
- **Zap validation**: unsupported apps rejected, no mass assignment of `ownerId`, PATCH doesn't apply defaults
- **routes that don't need a DB**: auth redirect and `state` check, `401`s, the catalog, Copilot status
- **Copilot draft handling**: repo matching, a draft can never be enabled, unsupported requests

The Angular UI was also driven in headless Chrome against a mock API: create, edit, chip insertion at the cursor, the preview, the toggle error path and the Copilot flow.

---

## Time log

- **Started:** 2026-11-26 01:46 IST
- **Stopped:** _fill in_

---

## How I used AI

I worked with **Claude Code** as a pair programmer, the way I'd work with a teammate.

- **What I decided:**
  - the stack and libraries
  - the branch plan and commit conventions
  - the Zap data model and the API surface
  - the OAuth scopes and callback through the Angular proxy
  - the UX: app picker with coming-soon apps, field chips, live preview, Copilot drafts that open disabled
  - the rule to ask before adding big dependencies

  I wrote that up as a brief before any code.
- **What I delegated:** the implementation, branch by branch. Claude Code wrote the code, tests and commit messages, and explained its decisions as it went. Commits it authored carry a `Co-Authored-By: Claude` trailer.
- **What came out of the pairing:** design points beyond the brief:
  - one shared webhook per repo, removed only when no enabled Zap needs it
  - creating the webhook before saving an enabled Zap
  - `content_type: json` on the hook (GitHub defaults to form-encoded)
  - the smee re-serialization caveat
  - zod-validated GitHub payloads

  It also found a real bug while driving the UI in headless Chrome: route guards called `inject()` after an `await`, which left signed-out users on a blank page (`fix(web): …`).
- **What I checked myself:** _fill in (e.g. the end-to-end run against a real repo)._

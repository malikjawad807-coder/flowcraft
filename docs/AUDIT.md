# FlowCart v2: Codebase Audit & Migration Plan (Phase 0)

**Date**: October 9, 2026  
**Status**: Completed & Awaiting User Approval  
**Target Specification**: FlowCart v2 Master Upgrade Prompt for Google Antigravity  

---

## 1. Executive Summary

FlowCart currently exists as a single-package Next.js 14 App Router application called **FlowCraft Studio** (`flowcraft-studio` v1.0.0). It features an interactive visual workflow canvas built on `@xyflow/react` (React Flow v12), dark-themed custom nodes, and an execution drawer. However, its execution engine, vector memory, AI agent, and email dispatch are almost entirely client-driven or simulated with mock data:
- There is **no database** (PostgreSQL, pgvector, or Drizzle are absent); workflow graphs exist purely in transient React component state.
- There is **no authentication or session management** (no users, passwords, sessions, or multi-tenant isolation).
- There is **no real Google OAuth 2.0 flow** or token vault; credentials are typed manually and kept in browser memory.
- There is **no background worker or job queue** (BullMQ/Redis); execution occurs synchronously inside a Next.js route handler.
- The **Vector Database (Memory)** is a mocked JavaScript array filter.
- The **Code Transform node** utilizes `new Function()`, presenting an immediate code-execution security vulnerability.
- The aesthetic currently mixes Emerald, Violet, Cyan, and Sky accents instead of adhering strictly to the required **black, grey, white, and red** design system.

This audit provides a complete catalog of the existing codebase, delineates what to keep versus what to replace, details the security risks, provides a phase-by-phase migration plan to the target monorepo architecture, and poses 7 key clarifying questions for user approval before touching code.

---

## 2. Current Stack & Dependency Versions

### Runtime & Core Frameworks
| Technology | Current Version | Target in v2 Spec | Assessment / Notes |
| :--- | :--- | :--- | :--- |
| **Node.js** | Current Host / Node 20+ | Node.js 20 LTS | Compatible |
| **Language** | TypeScript `^5.6.3` | TypeScript Strict Mode | Keep, enforce `strict: true` across all packages |
| **Frontend Framework** | Next.js `^14.2.24` (App Router) | Next.js (App Router) | Keep for `apps/web` |
| **UI Library** | React & React DOM `^18.3.1` | React 18 / 19 | Compatible |
| **Canvas Engine** | `@xyflow/react` `^12.12.0` | `@xyflow/react` | **Keep**. Core node canvas foundation |
| **Styling** | Tailwind CSS `^3.4.17` | Tailwind CSS + CSS Variables | Align palette strictly to black, grey, white, red tokens |
| **Icons** | `lucide-react` `^1.53.0` | `lucide-react` | **Keep** |
| **Visual Effects** | `canvas-confetti` `^1.9.4` | Retain for completion celebrate | Keep in UI layer |
| **Spreadsheet Parser**| `xlsx` `^0.18.5` | Not in v2 spec | Deprecate in favor of pure Gmail workflows |

### Backend & Infrastructure (Current vs. Target)
| Component | Current State | Target in v2 Spec | Action Required |
| :--- | :--- | :--- | :--- |
| **API Server** | Next.js Route Handlers (`app/api/*`) | Fastify (`apps/api`) | Create dedicated Fastify API server |
| **Background Worker** | None (Synchronous in Next.js) | BullMQ on Redis (`apps/worker`) | Implement isolated BullMQ worker process |
| **Database** | None (In-memory React state) | PostgreSQL 16 + pgvector | Implement via Drizzle ORM (`packages/db`) |
| **Expression Engine** | Regex `resolveTemplateVariables` + `new Function()` | JSONata (`packages/engine`) | Implement safe JSONata evaluation; ban `new Function` |
| **Security / Auth** | None | Argon2id, sliding sessions, CSRF, Vault (AES-256-GCM) | Build `packages/vault` and full auth subsystem |
| **Email Protocol** | `nodemailer` (Direct SMTP/Bearer) | Google OAuth 2.0 + Gmail API + `nodemailer` MIME | Build `packages/gmail` with PKCE & token manager |
| **LLM Integration** | Direct `fetch` to OpenAI in route | `packages/llm` (OpenAI, Claude, Google, Ollama) | Standardize LLM abstraction with structured output |

---

## 3. Current Folder Structure

```
d:\n8n\
├── .env                       # Minimal port/admin mock config
├── .gitignore
├── README.md                  # Documentation for FlowCraft Studio
├── next.config.js
├── package.json               # Root single-package Next.js app
├── package-lock.json
├── postcss.config.js
├── tailwind.config.js         # Contains emerald/violet/amber accents (to be refactored)
├── tsconfig.json
├── public/
│   └── hero-video.mp4         # 12.5MB drone video asset
├── app/
│   ├── globals.css            # React Flow styling and dark colors
│   ├── layout.tsx             # Root HTML layout
│   ├── page.tsx               # Main builder page with hero/canvas toggle
│   ├── hero/page.tsx          # Dedicated hero route
│   └── api/
│       ├── ai/
│       │   ├── chat/route.ts  # Mock / live AI chat route
│       │   └── test/route.ts  # Single prompt test route
│       ├── email/
│       │   └── test/route.ts  # Test email dispatcher
│       └── workflows/
│           └── execute/route.ts # Monolithic synchronous workflow runner (523 lines)
├── components/
│   ├── ai-assistant/
│   │   └── AiAssistantPanel.tsx # Side panel for prompt assistant
│   ├── canvas/
│   │   ├── CustomEdges.tsx    # Animated bezier workflow edges
│   │   └── WorkflowCanvas.tsx # ReactFlow canvas wrapper
│   ├── drawers/
│   │   ├── ExecutionDrawer.tsx # Step-by-step run log viewer
│   │   └── NodeConfigDrawer.tsx # Massive 1305-line node properties drawer
│   ├── email/
│   │   └── EmailComposerModal.tsx # Manual single/bulk email modal
│   ├── extractor/
│   │   └── UniversalExtractorModal.tsx # Universal CSV/XLSX contact extractor
│   ├── header/
│   │   └── BuilderHeader.tsx  # Header bar with run/test buttons
│   ├── hero/
│   │   └── HeroPage.tsx       # Drone video hero marketing page (710 lines)
│   ├── modals/
│   │   ├── SettingsModal.tsx  # Workspace API keys config
│   │   └── TemplatesModal.tsx # Template selection modal
│   ├── nodes/
│   │   ├── AiNode.tsx         # Custom OpenAI node card
│   │   ├── ConditionNode.tsx  # Filter/condition node card
│   │   ├── GmailNode.tsx      # Gmail dispatch node card
│   │   ├── TransformNode.tsx  # Code transform node card
│   │   ├── TriggerNode.tsx    # Trigger node card
│   │   └── VectorStoreNode.tsx# Vector DB memory node card
│   └── sidebar/
│       └── NodeLibrary.tsx    # Left drag-and-drop node palette
├── lib/
│   ├── ai-assistant-prompts.ts # System prompt definitions
│   ├── email-extractor.ts     # Regex and XLSX extraction logic
│   ├── email-service.ts       # Direct SMTP/OAuth nodemailer helper
│   ├── sample-workflows.ts    # 3 starter workflow definitions
│   └── workflow-engine.ts     # Topological sort, CSV parser, and mock generator
└── types/
    └── workflow.ts            # TypeScript interfaces for nodes and execution logs
```

---

## 4. Deep Inspection: Real vs. Mock Catalog

| Feature / Subsystem | Current State | Real or Mock? | Target Behavior in v2 |
| :--- | :--- | :--- | :--- |
| **Canvas Editor UI** | `@xyflow/react` v12 with drag-and-drop, zoom, pan, minimap, handles | **REAL** | **Keep**. Serves as the primary canvas editor in `apps/web`. |
| **Execution Drawer UI** | Displays node steps, timing, tokens, JSON input/output payloads | **REAL** | **Keep & Connect**. Hook into real execution steps from the API. |
| **Node Config Forms** | Interactive form inputs in `NodeConfigDrawer.tsx` | **REAL (UI)** | **Keep & Refactor**. Standardize schema generation using Zod schemas from `packages/shared`. |
| **Multi-User Auth** | None. Single static app, no session, no DB user record | **MOCK / ABSENT** | **Build Real**. Argon2id, sliding sessions, CSRF tokens, email verification via Mailpit. |
| **Workflow Persistence**| In React component memory. Browser reload wipes all changes | **MOCK / ABSENT** | **Build Real**. PostgreSQL `workflows` and `workflow_versions` tables with Drizzle migrations. |
| **Workflow Engine** | Client calls `/api/workflows/execute`, loops through nodes synchronously | **MOCK ENGINE** | **Build Real**. BullMQ `workflow-exec` worker, DAG execution, step checkpoints, resume safety. |
| **Code Transform Node** | Evaluates raw JS via `new Function('input', 'context', ...)` | **INSECURE** | **Eliminate**. Ban `new Function` / code nodes. Replace with safe `jsonata` expressions. |
| **Expression Evaluation**| Regex search/replace `{{ ... }}` in `resolveTemplateVariables` | **PARTIAL** | **Build Real**. Safe JSONata expression evaluation with a 50ms runtime cap. |
| **Gmail OAuth 2.0** | Manual OAuth bearer string or App Password input; sandbox fallback | **MOCK / PLACEHOLDER** | **Build Real**. Google OAuth 2.0 with PKCE, state hashing, AES-256-GCM vault, token refresh lock. |
| **Gmail MIME Builder** | Hand-rolled `Buffer.from(rawMessage)` with missing reply headers | **FRAGILE** | **Build Real**. `MailComposer`, RFC 2822 compliance, `In-Reply-To`, `References`, `Re:` normalization. |
| **Gmail Polling Trigger**| None. Triggers are manual form inputs, webhooks, or CSV file uploads | **MOCK / ABSENT** | **Build Real**. Repeatable BullMQ poller via `gmail.users.history.list`, deduplicated in `processed_messages`. |
| **Vector DB / Memory** | Filters hardcoded `EXECUTIVE_ASSISTANT_SAMPLE_MEMORY` by substring | **MOCK** | **Build Real**. PostgreSQL `pgvector` table (`memories`), vector embeddings, HNSW index, extraction worker. |
| **AI Assistant / Agent** | Regex matches user command keywords to trigger UI actions | **MOCK** | **Build Real**. Multi-turn agent loop in `packages/agent` with tool registry, SSE streaming, and human approvals. |
| **Approvals System** | None. Direct dispatch or simulated output | **MOCK / ABSENT** | **Build Real**. `approvals` table, `/approvals` dashboard, inline approval card, and `control.approval` node. |
| **Hero Video Page** | 12.5MB drone video showcasing mock UI (`components/hero/HeroPage.tsx`) | **EXTRANEOUS** | **Decouple/Remove**. Focus the entire app on the authenticated visual builder and Command Center. |

---

## 5. Critical Security & Architectural Audit Findings

1. **Remote Code Execution Vulnerability (`new Function`)**:
   - Location: `app/api/workflows/execute/route.ts` (lines 415–422).
   - Issue: Executes user-submitted code in `new Function('input', 'context', ...)`.
   - Violation: Explicitly prohibited by Section 8.4 and Section 22 ("Never use eval, new Function, or any code node").
   - Resolution: Delete `code_transform` node. All inline node data transformations must use safe JSONata expressions.
2. **Plaintext Credential Handling**:
   - Location: `components/modals/SettingsModal.tsx`, `components/drawers/NodeConfigDrawer.tsx`.
   - Issue: Users enter raw API keys, App Passwords, and OAuth tokens directly in the client, stored in unencrypted React state and dispatched over HTTP.
   - Violation: Section 0.4 and Section 12.4 ("No secrets in code... stored tokens and personal API keys are encrypted with the vault").
   - Resolution: Credentials must only originate from server environment variables or encrypted database columns via `packages/vault`. Client never sees raw decrypted tokens.
3. **Missing Authentication & IDOR Scaffolding**:
   - Issue: No user boundary exists.
   - Resolution: Every database table must have `user_id uuid not null references users on delete cascade`, and all queries must assert ownership.
4. **Prompt Injection Susceptibility**:
   - Location: `app/api/workflows/execute/route.ts` and `app/api/ai/chat/route.ts`.
   - Issue: Raw string interpolation without untrusted-content wrappers (`<untrusted_email>`).
   - Resolution: Implement mandatory escaping, wrapper tags, and ensure LLMs never control recipient email addresses or execution targets.
5. **Color System Non-Compliance**:
   - Location: `tailwind.config.js` and `app/globals.css`.
   - Issue: Currently uses emerald (`#059669`), violet (`#7c3aed`), sky (`#0284c7`), and amber (`#d97706`).
   - Resolution: Replace completely with the 11 design tokens in Section 9.1 (Black, grey, white, and red `#E11D2E` exclusively).

---

## 6. What Must Be Kept

1. **React Flow Canvas Layout**:
   - `@xyflow/react` setup in `components/canvas/WorkflowCanvas.tsx`.
   - Node drag-and-drop mechanism from `components/sidebar/NodeLibrary.tsx`.
   - Custom handles and animated edge styling (`components/canvas/CustomEdges.tsx`).
2. **Drawer and Modal UX Patterns**:
   - The sliding `NodeConfigDrawer.tsx` pattern (refactored to Zod-backed schemas).
   - The expandable `ExecutionDrawer.tsx` log viewer (connected to real execution steps).
3. **Core Visual Aesthetic**:
   - Dark canvas background, dotted grid, compact sleek cards, and smooth micro-interactions.

---

## 7. Migration Plan to Target Monorepo Architecture

We will migrate the project cleanly into the Section 3 target monorepo layout step by step without breaking the working canvas UI:

```
flowcart/
  apps/
    web/        Next.js App Router frontend (migrated from current app)
    api/        Fastify HTTP API
    worker/     BullMQ workers
  packages/
    shared/     Zod schemas, types, constants
    db/         Drizzle schema, PostgreSQL 16 + pgvector, migrations
    engine/     Graph validation & JSONata executor
    nodes/      One file per node type
    agent/      Agent loop, tool registry, memory logic
    llm/        Provider adapters (OpenAI, Anthropic, Google, Ollama)
    gmail/      Gmail client, MIME parser/builder, token refresh
    vault/      AES-256-GCM authenticated encryption helpers
  deploy/
    docker-compose.yml
    docker-compose.dev.yml
    Caddyfile
    backup.sh
  docs/
    AUDIT.md
    DECISIONS.md
    ARCHITECTURE.md
    SECURITY.md
    RUNBOOK.md
  .env.example
```

### Step-by-Step Monorepo Migration (Phase 1):
1. **Initialize Monorepo Workspaces**: Create root `package.json` with npm workspaces (`apps/*`, `packages/*`).
2. **Move Frontend to `apps/web`**:
   - Move `app/`, `components/`, `public/`, and styles to `apps/web/`.
   - Strip out extraneous components (`HeroPage.tsx`, `UniversalExtractorModal.tsx`).
   - Configure Tailwind with the strict black/red design tokens.
3. **Create Core Packages**:
   - `packages/shared`: Extract workflow node interfaces, Zod schemas, execution types.
   - `packages/vault`: Implement AES-256-GCM encryption with AAD (`userId:purpose`) and unit tests.
   - `packages/db`: Drizzle ORM schema for Section 5 tables (`users`, `sessions`, `email_tokens`, `integrations`, `audit_log`, etc.).
4. **Scaffold Services**:
   - `apps/api`: Fastify server with `/health`, `/ready`, CORS, Helmet, and Cookie plugins.
   - `apps/worker`: BullMQ worker skeleton.
   - `deploy/docker-compose.dev.yml`: Local PostgreSQL 16 (`pgvector/pgvector:pg16`), Redis 7 Alpine, and Mailpit.
5. **Verify Baseline**: Ensure the canvas still mounts and renders in `apps/web` while connected to the dev infrastructure.

---

## 8. Clarifying Questions for User Approval

Before initiating Phase 1, please review and confirm the following design decisions:

1. **Hero Video & Marketing Landing Page**:
   - *Finding*: `HeroPage.tsx` and `public/hero-video.mp4` (12.5MB) were added recently for demonstration.
   - *Question*: Shall we completely replace the root route (`/`) with the authenticated dashboard (`/workflows` or `/login`), removing the video player and drone hero page to keep the application lean and strictly focused on email automation?
2. **Universal Extractor & XLSX Tools**:
   - *Finding*: `UniversalExtractorModal.tsx` and `xlsx` allow scraping spreadsheets for cold outreach.
   - *Question*: Section 8 states: "Email automation only, Gmail first. No bulk cold lists...". Should we completely remove the spreadsheet extractor and file upload nodes, focusing exclusively on Gmail inboxes and triggers?
3. **Workspace Tooling (Package Manager)**:
   - *Question*: Do you prefer `npm` (workspaces) or `pnpm` (workspaces) for managing this monorepo? (`npm` requires no extra global tooling, while `pnpm` is faster and more disk-efficient).
4. **LLM Provider Priority in Development**:
   - *Question*: For local testing in Phase 1 through Phase 7, which provider will you primarily use: OpenAI, Anthropic, Google Gemini, or local Ollama?
5. **Database Port Allocation**:
   - *Question*: Is standard port `5432` available on your machine for the dev Docker PostgreSQL container, and port `6379` for Redis, or do you have existing local services running on these ports?
6. **Existing Branches**:
   - *Finding*: We previously created `flowcraft-nextjs-backup` and `flowcart-sqlite-backup` on origin.
   - *Confirmation*: Can you confirm you are comfortable with us reshaping the `main` branch into the monorepo structure outlined in Section 3?
7. **Email Sanitization Limits**:
   - *Question*: The spec mandates cutting body text at 6,000 characters for LLM context and 20,000 characters for full storage. Do you approve this character ceiling for all inbound email processing?

---

*Phase 0 is complete. No feature code has been modified. Awaiting user review and authorization to proceed to Phase 1.*

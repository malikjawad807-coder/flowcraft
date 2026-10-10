import {
  pgTable,
  uuid,
  text,
  integer,
  smallint,
  boolean,
  timestamp,
  bigserial,
  jsonb,
  customType,
  primaryKey,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').unique().notNull(),
  name: text('name'),
  passwordHash: text('password_hash'),
  role: text('role').notNull().default('user'), // 'admin' | 'user'
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  disabledAt: timestamp('disabled_at', { withTimezone: true }),
  failedLogins: integer('failed_logins').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  timezone: text('timezone').notNull().default('UTC'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  'sessions',
  {
    idHash: text('id_hash').primaryKey(), // sha256 of cookie
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    absoluteExpiresAt: timestamp('absolute_expires_at', { withTimezone: true }).notNull(),
    ip: text('ip'),
    userAgent: text('user_agent'),
  },
  (table) => ({
    sessionsUserIdx: index('sessions_user_idx').on(table.userId),
  })
);

export const emailTokens = pgTable('email_tokens', {
  tokenHash: text('token_hash').primaryKey(), // sha256 of raw token
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  purpose: text('purpose').notNull(), // 'verify' | 'reset'
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
});

export const mfaFactors = pgTable('mfa_factors', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  secretEnc: text('secret_enc').notNull(),
  enabledAt: timestamp('enabled_at', { withTimezone: true }),
  recoveryHashes: text('recovery_hashes')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
});

export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerUserId: text('provider_user_id').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.provider, table.providerUserId] }),
  })
);

export const integrations = pgTable(
  'integrations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull().default('google'),
    accountEmail: text('account_email').notNull(),
    scopes: text('scopes').array().notNull(),
    refreshTokenEnc: text('refresh_token_enc').notNull(),
    accessTokenEnc: text('access_token_enc'),
    accessExpiresAt: timestamp('access_expires_at', { withTimezone: true }),
    status: text('status').notNull().default('active'), // 'active' | 'needs_reconnect' | 'revoked'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userProviderAccountUnique: unique().on(table.userId, table.provider, table.accountEmail),
  })
);

export const oauthStates = pgTable('oauth_states', {
  stateHash: text('state_hash').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  codeVerifierEnc: text('code_verifier_enc').notNull(),
  purpose: text('purpose').notNull().default('gmail_connect'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  llmProvider: text('llm_provider'),
  llmKeyEnc: text('llm_key_enc'),
  memoryEnabled: boolean('memory_enabled').notNull().default(true),
  memoryLearnEnabled: boolean('memory_learn_enabled').notNull().default(true),
  autoSendEnabled: boolean('auto_send_enabled').notNull().default(false),
  signature: text('signature'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable('audit_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: uuid('user_id'),
  action: text('action').notNull(),
  detail: jsonb('detail'),
  ip: text('ip'),
  userAgent: text('user_agent'),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
});

export const workflows = pgTable(
  'workflows',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    isActive: boolean('is_active').notNull().default(false),
    status: text('status').notNull().default('inactive'), // 'inactive' | 'active' | 'error'
    integrationId: uuid('integration_id').references(() => integrations.id, { onDelete: 'set null' }),
    version: integer('version').notNull().default(1),
    graph: jsonb('graph').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workflowsUserIdx: index('workflows_user_idx').on(table.userId),
  })
);

export const workflowVersions = pgTable(
  'workflow_versions',
  {
    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => workflows.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    graph: jsonb('graph').notNull(),
    savedAt: timestamp('saved_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.workflowId, table.version] }),
  })
);

export const triggerState = pgTable('trigger_state', {
  workflowId: uuid('workflow_id')
    .primaryKey()
    .references(() => workflows.id, { onDelete: 'cascade' }),
  cursor: text('cursor'),
  lastPolledAt: timestamp('last_polled_at', { withTimezone: true }),
  lastError: text('last_error'),
  warning: text('warning'),
});

export const processedMessages = pgTable(
  'processed_messages',
  {
    workflowId: uuid('workflow_id')
      .notNull()
      .references(() => workflows.id, { onDelete: 'cascade' }),
    gmailMessageId: text('gmail_message_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.workflowId, table.gmailMessageId] }),
  })
);

export const executions = pgTable(
  'executions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workflowId: uuid('workflow_id').references(() => workflows.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    mode: text('mode').notNull(), // 'trigger' | 'test' | 'manual'
    status: text('status').notNull(), // 'queued' | 'running' | 'waiting' | 'success' | 'failed' | 'cancelled'
    triggerData: jsonb('trigger_data'),
    error: text('error'),
    consecutiveFailMarker: boolean('consecutive_fail_marker').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (table) => ({
    executionsUserCreatedIdx: index('executions_user_created_idx').on(table.userId, table.createdAt),
    executionsWorkflowIdx: index('executions_workflow_idx').on(table.workflowId),
  })
);

export const executionSteps = pgTable(
  'execution_steps',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    executionId: uuid('execution_id')
      .notNull()
      .references(() => executions.id, { onDelete: 'cascade' }),
    nodeId: text('node_id').notNull(),
    nodeType: text('node_type').notNull(),
    itemIndex: integer('item_index').notNull().default(0),
    status: text('status').notNull(), // 'running' | 'success' | 'failed' | 'skipped' | 'waiting'
    input: jsonb('input'),
    output: jsonb('output'),
    error: text('error'),
    attempts: integer('attempts').notNull().default(0),
    tokensIn: integer('tokens_in'),
    tokensOut: integer('tokens_out'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (table) => ({
    executionStepsExecIdx: index('execution_steps_exec_idx').on(table.executionId),
  })
);

export const usageEvents = pgTable(
  'usage_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
    provider: text('provider'),
    model: text('model'),
    purpose: text('purpose'), // 'agent' | 'classify' | 'memory' | 'title' | 'summary' | 'test'
    tokensIn: integer('tokens_in'),
    tokensOut: integer('tokens_out'),
  },
  (table) => ({
    usageEventsUserAtIdx: index('usage_events_user_at_idx').on(table.userId, table.at),
  })
);

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull().default('chat'), // 'chat' | 'thread'
    externalKey: text('external_key'), // Gmail thread id
    title: text('title'),
    summary: text('summary'),
    temporary: boolean('temporary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    conversationsUserIdx: index('conversations_user_idx').on(table.userId),
  })
);

export const messages = pgTable(
  'messages',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    conversationId: uuid('conversation_id')
      .references(() => conversations.id, { onDelete: 'cascade' }),
    role: text('role').notNull(), // 'user' | 'assistant' | 'tool'
    content: text('content'),
    toolCalls: jsonb('tool_calls'),
    toolCallId: text('tool_call_id'),
    toolName: text('tool_name'),
    tokensIn: integer('tokens_in'),
    tokensOut: integer('tokens_out'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    messagesConvIdx: index('messages_conv_id_idx').on(table.conversationId, table.id),
  })
);

export const agentRuns = pgTable(
  'agent_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .references(() => conversations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    source: text('source').notNull(), // 'command' | 'workflow'
    executionId: uuid('execution_id'),
    status: text('status').notNull(), // 'queued' | 'running' | 'awaiting_approval' | 'succeeded' | 'failed' | 'cancelled'
    iterations: integer('iterations').notNull().default(0),
    model: text('model'),
    error: text('error'),
    tokensIn: integer('tokens_in').default(0),
    tokensOut: integer('tokens_out').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (table) => ({
    agentRunsUserIdx: index('agent_runs_user_idx').on(table.userId, table.createdAt),
  })
);

export const agentRunEvents = pgTable(
  'agent_run_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    runId: uuid('run_id')
      .references(() => agentRuns.id, { onDelete: 'cascade' }),
    seq: integer('seq').notNull(),
    type: text('type').notNull(),
    data: jsonb('data'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    runSeqUnique: unique().on(table.runId, table.seq),
  })
);

export const approvals = pgTable(
  'approvals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    runId: uuid('run_id'),
    executionId: uuid('execution_id'),
    nodeId: text('node_id'),
    toolName: text('tool_name'),
    preview: jsonb('preview').notNull(), // recipient, subject, body, warning
    args: jsonb('args'),
    status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected' | 'expired'
    editedArgs: jsonb('edited_args'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    approvalsUserStatusIdx: index('approvals_user_status_idx').on(table.userId, table.status),
  })
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    link: text('link'),
    read: boolean('read').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    notificationsUserIdx: index('notifications_user_idx').on(table.userId, table.read),
  })
);

export const vector1536 = customType<{ data: number[] | null; driverData: string }>({
  dataType() {
    return 'vector(1536)';
  },
  toDriver(val: number[] | null): string {
    if (!val) return '';
    return JSON.stringify(val);
  },
  fromDriver(val: unknown): number[] | null {
    if (val === null || val === undefined) return null;
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return val.replace(/^\[|\]$/g, '').split(',').map(Number);
      }
    }
    return null;
  },
});

export const memories = pgTable(
  'memories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    text: text('text').notNull(),
    category: text('category').notNull(), // 'profile' | 'preference' | 'contact' | 'project' | 'style' | 'rule'
    importance: smallint('importance').notNull().default(3), // 1 to 5
    pinned: boolean('pinned').notNull().default(false),
    embedding: vector1536('embedding'),
    source: text('source').notNull().default('extracted'), // 'explicit' | 'extracted' | 'manual'
    sourceConversationId: uuid('source_conversation_id')
      .references(() => conversations.id, { onDelete: 'set null' }),
    useCount: integer('use_count').notNull().default(0),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    memoriesUserIdx: index('memories_user_idx').on(table.userId),
  })
);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Integration = typeof integrations.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type Workflow = typeof workflows.$inferSelect;
export type WorkflowVersion = typeof workflowVersions.$inferSelect;
export type TriggerState = typeof triggerState.$inferSelect;
export type ProcessedMessage = typeof processedMessages.$inferSelect;
export type Execution = typeof executions.$inferSelect;
export type ExecutionStep = typeof executionSteps.$inferSelect;
export type UsageEvent = typeof usageEvents.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type AgentRun = typeof agentRuns.$inferSelect;
export type AgentRunEvent = typeof agentRunEvents.$inferSelect;
export type Approval = typeof approvals.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;



import { randomUUID } from 'node:crypto';
import {
  users,
  sessions,
  emailTokens,
  auditLog,
  userSettings,
  integrations,
  oauthStates,
  workflows,
  workflowVersions,
  executions,
  executionSteps,
  conversations,
  messages,
  agentRuns,
  agentRunEvents,
  approvals,
  notifications,
  memories,
  mfaFactors,
} from '@flowcart/db';


function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, g) => g.toUpperCase());
}

function extractVal(chunk: any): any {
  if (chunk === null || chunk === undefined) return chunk;
  if (typeof chunk === 'object' && 'value' in chunk) {
    return chunk.value;
  }
  return chunk;
}

function matchCondition(item: any, condition: any): boolean {
  if (!condition) return true;
  if (typeof condition === 'function') return condition(item);

  if (condition.queryChunks && Array.isArray(condition.queryChunks)) {
    // If there are nested SQL expressions (e.g. and(c1, c2)), recursively evaluate all nested SQL chunks
    const childSqlChunks = condition.queryChunks.filter(
      (chunk: any) => chunk && typeof chunk === 'object' && Array.isArray(chunk.queryChunks)
    );
    if (childSqlChunks.length > 0) {
      for (const child of childSqlChunks) {
        if (!matchCondition(item, child)) {
          return false;
        }
      }
      return true;
    }

    // Leaf SQL condition: filter out trivial empty string chunks
    const chunks = condition.queryChunks.filter((c: any) => {
      if (!c) return false;
      if (Array.isArray(c.value) && c.value.length === 1 && c.value[0] === '') return false;
      if (typeof c === 'string' && c.trim() === '') return false;
      return true;
    });

    let colChunk: any = null;
    let opStr = '';
    let valChunk: any = null;

    for (const chunk of chunks) {
      const name = chunk?.name || chunk?.keyAsName;
      if (name && !colChunk) {
        colChunk = chunk;
        continue;
      }
      const rawStr = Array.isArray(chunk?.value)
        ? chunk.value.join('')
        : typeof chunk === 'string'
        ? chunk
        : typeof chunk?.value === 'string'
        ? chunk.value
        : '';
      if (
        rawStr.includes('is null') ||
        rawStr.includes('is not null') ||
        rawStr.includes('=') ||
        rawStr.includes('>') ||
        rawStr.includes('<') ||
        rawStr.includes('!=')
      ) {
        opStr = rawStr.trim();
        continue;
      }
      if (valChunk === null) {
        valChunk = chunk;
      }
    }

    if (colChunk) {
      const colName = colChunk.name || colChunk.keyAsName;
      const camel = toCamelCase(colName);
      let itemVal = item[colName] !== undefined ? item[colName] : item[camel];
      if (itemVal === undefined) {
        for (const k of Object.keys(item)) {
          if (k.toLowerCase() === colName.toLowerCase() || k.toLowerCase() === camel.toLowerCase()) {
            itemVal = item[k];
            break;
          }
        }
      }

      if (opStr.includes('is not null')) {
        return itemVal !== null && itemVal !== undefined;
      }
      if (opStr.includes('is null')) {
        return itemVal === null || itemVal === undefined;
      }

      const expectedVal = extractVal(valChunk);

      if (opStr.includes('!=')) {
        return String(itemVal) !== String(expectedVal);
      }
      if (opStr.includes('>=')) {
        return new Date(itemVal).getTime() >= new Date(expectedVal).getTime();
      }
      if (opStr.includes('>')) {
        return new Date(itemVal).getTime() > new Date(expectedVal).getTime();
      }
      if (opStr.includes('<=')) {
        return new Date(itemVal).getTime() <= new Date(expectedVal).getTime();
      }
      if (opStr.includes('<')) {
        return new Date(itemVal).getTime() < new Date(expectedVal).getTime();
      }
      if (opStr.includes('=')) {
        if (itemVal === undefined || expectedVal === undefined) return false;
        return String(itemVal).toLowerCase() === String(expectedVal).toLowerCase();
      }
    }
  }

  return true;
}

function createQueryPromise(data: any[], totalCount?: number) {
  const promise = Promise.resolve(totalCount !== undefined ? [{ val: totalCount }] : data);
  return Object.assign(promise, {
    limit(n: number) {
      return createQueryPromise(data.slice(0, n));
    },
    orderBy(_order: any) {
      return createQueryPromise(data, totalCount);
    },
    groupBy(_col: any) {
      return createQueryPromise(data, totalCount);
    },
  });
}


export class MockDatabase {
  users: any[] = [];
  sessions: any[] = [];
  emailTokens: any[] = [];
  auditLog: any[] = [];
  userSettings: any[] = [];
  integrations: any[] = [];
  oauthStates: any[] = [];
  workflows: any[] = [];
  workflowVersions: any[] = [];
  executions: any[] = [];
  executionSteps: any[] = [];
  triggerState: any[] = [];
  processedMessages: any[] = [];
  usageEvents: any[] = [];
  conversations: any[] = [];
  messages: any[] = [];
  agentRuns: any[] = [];
  agentRunEvents: any[] = [];
  approvals: any[] = [];
  notifications: any[] = [];
  memories: any[] = [];
  mfaFactors: any[] = [];


  select(fields?: any) {
    const self = this;
    const project = (items: any[]) => {
      if (!fields || typeof fields !== 'object' || fields.val !== undefined) {
        return items;
      }
      const keys = Object.keys(fields);
      if (keys.length === 0) return items;
      return items.map((item) => {
        const out: any = {};
        for (const k of keys) {
          out[k] = item[k];
        }
        return out;
      });
    };

    return {
      from(table: any) {
        const data = self.getTableData(table);

        return {
          where(condition?: any) {
            const filtered = data.filter((item) => matchCondition(item, condition));
            return createQueryPromise(
              project(filtered),
              fields?.val !== undefined ? filtered.length : undefined
            );
          },
          innerJoin(_otherTable: any, _onCondition: any) {
            return {
              where(condition: any) {
                const joined = self.sessions.map((s) => {
                  const u = self.users.find((user) => user.id === s.userId);
                  return {
                    idHash: s.idHash,
                    userId: s.userId,
                    expiresAt: s.expiresAt,
                    absoluteExpiresAt: s.absoluteExpiresAt,
                    lastSeenAt: s.lastSeenAt,
                    userEmail: u?.email,
                    userName: u?.name,
                    userRole: u?.role || 'user',
                    userTimezone: u?.timezone || 'UTC',
                    userDisabledAt: u?.disabledAt,
                    userEmailVerifiedAt: u?.emailVerifiedAt,
                  };
                });

                const filtered = joined.filter((item) => matchCondition(item, condition));
                return createQueryPromise(filtered);
              },
            };
          },
          limit(n: number) {
            return createQueryPromise(project(data.slice(0, n)));
          },
          orderBy(_order: any) {
            return createQueryPromise(project(data), fields?.val !== undefined ? data.length : undefined);
          },
          groupBy(_col: any) {
            return createQueryPromise([]);
          },
          then(resolve: any, reject: any) {

            return createQueryPromise(
              project(data),
              fields?.val !== undefined ? data.length : undefined
            ).then(resolve, reject);
          },
        };
      },
    };
  }

  insert(table: any) {
    const self = this;
    const list = self.getTableData(table);

    return {
      values(row: any) {
        const item = {
          id: row.id || randomUUID(),
          createdAt: new Date(),
          ...row,
        };
        list.push(item);

        const chain = {
          returning() {
            return Promise.resolve([item]);
          },
          onConflictDoUpdate(_cfg?: any) {
            return chain;
          },
          onConflictDoNothing(_cfg?: any) {
            return chain;
          },
          then(resolve: any, reject: any) {
            return Promise.resolve([item]).then(resolve, reject);
          },
        };
        return chain;
      },
    };
  }

  update(table: any) {
    const self = this;
    const list = self.getTableData(table);

    return {
      set(updates: any) {
        return {
          where(condition: any) {
            list.forEach((item) => {
              if (matchCondition(item, condition)) {
                Object.assign(item, updates);
              }
            });
            return Promise.resolve();
          },
          then(resolve: any, reject: any) {
            return Promise.resolve().then(resolve, reject);
          },
        };
      },
    };
  }

  delete(table: any) {
    const self = this;
    const list = self.getTableData(table);

    return {
      where(condition: any) {
        const remaining = list.filter((item) => !matchCondition(item, condition));
        if (table === users || self.isTable(table, 'users')) {
          const toDelete = list.filter((u) => matchCondition(u, condition));
          const deleteIds = new Set(toDelete.map((u) => u.id));
          self.users = remaining;
          self.sessions = self.sessions.filter((s) => !deleteIds.has(s.userId));
        } else if (table === sessions || self.isTable(table, 'sessions')) {
          self.sessions = remaining;
        } else if (table === emailTokens || self.isTable(table, 'email_tokens')) {
          self.emailTokens = remaining;
        } else if (table === integrations || self.isTable(table, 'integrations')) {
          self.integrations = remaining;
        } else if (table === oauthStates || self.isTable(table, 'oauth_states')) {
          self.oauthStates = remaining;
        } else if (table === workflows || self.isTable(table, 'workflows')) {
          self.workflows = remaining;
        } else if (table === workflowVersions || self.isTable(table, 'workflow_versions')) {
          self.workflowVersions = remaining;
        } else if (table === executions || self.isTable(table, 'executions')) {
          self.executions = remaining;
        } else if (table === executionSteps || self.isTable(table, 'execution_steps')) {
          self.executionSteps = remaining;
        } else if (table === conversations || self.isTable(table, 'conversations')) {
          self.conversations = remaining;
        } else if (table === messages || self.isTable(table, 'messages')) {
          self.messages = remaining;
        } else if (table === agentRuns || self.isTable(table, 'agent_runs')) {
          self.agentRuns = remaining;
        } else if (table === agentRunEvents || self.isTable(table, 'agent_run_events')) {
          self.agentRunEvents = remaining;
        } else if (table === approvals || self.isTable(table, 'approvals')) {
          self.approvals = remaining;
        } else if (table === notifications || self.isTable(table, 'notifications')) {
          self.notifications = remaining;
        } else if (table === memories || self.isTable(table, 'memories')) {
          self.memories = remaining;
        } else if (table === mfaFactors || self.isTable(table, 'mfa_factors')) {
          self.mfaFactors = remaining;
        }

        return Promise.resolve();
      },
      then(resolve: any, reject: any) {
        return Promise.resolve().then(resolve, reject);
      },
    };
  }

  private isTable(table: any, name: string): boolean {
    return (
      table?.name === name ||
      table?._?.name === name ||
      table?.[Symbol.for('drizzle:Name')] === name
    );
  }

  private getTableData(table: any): any[] {
    if (table === users || this.isTable(table, 'users')) return this.users;
    if (table === sessions || this.isTable(table, 'sessions')) return this.sessions;
    if (table === emailTokens || this.isTable(table, 'email_tokens')) return this.emailTokens;
    if (table === auditLog || this.isTable(table, 'audit_log')) return this.auditLog;
    if (table === userSettings || this.isTable(table, 'user_settings')) return this.userSettings;
    if (table === integrations || this.isTable(table, 'integrations')) return this.integrations;
    if (table === oauthStates || this.isTable(table, 'oauth_states')) return this.oauthStates;
    if (table === workflows || this.isTable(table, 'workflows')) return this.workflows;
    if (table === workflowVersions || this.isTable(table, 'workflow_versions')) return this.workflowVersions;
    if (table === executions || this.isTable(table, 'executions')) return this.executions;
    if (table === executionSteps || this.isTable(table, 'execution_steps')) return this.executionSteps;
    if (this.isTable(table, 'trigger_state')) return this.triggerState;
    if (this.isTable(table, 'processed_messages')) return this.processedMessages;
    if (this.isTable(table, 'usage_events')) return this.usageEvents;
    if (table === conversations || this.isTable(table, 'conversations')) return this.conversations;
    if (table === messages || this.isTable(table, 'messages')) return this.messages;
    if (table === agentRuns || this.isTable(table, 'agent_runs')) return this.agentRuns;
    if (table === agentRunEvents || this.isTable(table, 'agent_run_events')) return this.agentRunEvents;
    if (table === approvals || this.isTable(table, 'approvals')) return this.approvals;
    if (table === notifications || this.isTable(table, 'notifications')) return this.notifications;
    if (table === memories || this.isTable(table, 'memories')) return this.memories;
    if (table === mfaFactors || this.isTable(table, 'mfa_factors')) return this.mfaFactors;
    return this.users;

  }
}

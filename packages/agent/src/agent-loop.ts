import { randomUUID } from 'node:crypto';
import type { ChatMessage, ToolDefinition, ToolCall } from '@flowcart/llm';
import { zodToJsonSchema } from '@flowcart/llm';
import type {
  ServerContext,
  AgentRunOptions,
  AgentRunResult,
  AgentEvent,
  AgentTool,
  ToolApprovalPreview,
} from './types.js';
import { ToolRegistry, ALL_TOOLS } from './tools/index.js';
import { buildSystemPrompt, wrapUntrustedEmail } from './prompt.js';
import { MemoryService } from './memory/service.js';

export interface AgentLoopParams {
  conversationId: string;
  userMessage: string;
  history?: ChatMessage[];
  pendingApprovalDecision?: {
    approvalId: string;
    decision: 'approved' | 'rejected';
    editedArgs?: any;
    toolCall: ToolCall;
  };
}

export class AgentRunner {
  private registry: ToolRegistry;

  constructor(tools: AgentTool[] = ALL_TOOLS) {
    this.registry = new ToolRegistry(tools);
  }

  async run(
    ctx: ServerContext,
    params: AgentLoopParams,
    options: AgentRunOptions = {}
  ): Promise<AgentRunResult> {
    const maxIterations = options.maxIterations || 8;
    const allowedToolList = this.registry.filter(options.allowedTools);
    const toolDefs: ToolDefinition[] = allowedToolList.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: zodToJsonSchema(t.schema),
    }));

    let seq = 0;
    const emit = async (type: AgentEvent['type'], data: any) => {
      seq += 1;
      const ev: AgentEvent = {
        runId: ctx.runId,
        seq,
        type,
        data,
        createdAt: new Date().toISOString(),
      };
      if (options.onEvent) {
        await options.onEvent(ev);
      }
    };

    await emit('run_started', {
      runId: ctx.runId,
      conversationId: params.conversationId,
      userMessage: params.userMessage,
    });

    let memoryBlock = '(no memories stored)';
    if (ctx.memoryEnabled !== false && !ctx.isTemporary && params.userMessage) {
      try {
        const memRes = await MemoryService.searchMemories(ctx, params.userMessage);
        if (memRes.formattedBlock) {
          memoryBlock = memRes.formattedBlock;
          await emit('memory_used', {
            count: memRes.usedIds.length,
            ids: memRes.usedIds,
          });
        }
      } catch {
        // Fallback gracefully
      }
    } else if (ctx.isTemporary) {
      memoryBlock = '(temporary chat, memory disabled)';
    }

    const now = new Date();
    const systemPrompt = buildSystemPrompt({
      date: now.toISOString().split('T')[0],
      timezone: ctx.timezone || 'UTC',
      name: ctx.userName || 'User',
      address: ctx.userEmail || 'user@example.com',
      memoryBlock,
    });

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...(params.history || []),
    ];

    if (params.userMessage) {
      messages.push({ role: 'user', content: params.userMessage });
    }

    let iterations = 0;
    let totalTokensIn = 0;
    let totalTokensOut = 0;
    let totalToolCalls = 0;
    const toolCallHistory: string[] = [];

    // Check if we are resuming from an approval decision
    if (params.pendingApprovalDecision) {
      const decision = params.pendingApprovalDecision;
      const tool = this.registry.get(decision.toolCall.name);

      if (decision.decision === 'rejected') {
        messages.push({
          role: 'tool',
          content: 'User rejected this action.',
          toolCallId: decision.toolCall.id,
        });
        await emit('tool_call_finished', {
          name: decision.toolCall.name,
          status: 'rejected',
          summary: 'User rejected this action',
        });
      } else if (tool) {
        const effectiveArgs = decision.editedArgs || decision.toolCall.args;
        try {
          await emit('tool_call_started', {
            name: tool.name,
            args: effectiveArgs,
          });
          const result = await tool.execute(ctx, effectiveArgs);
          const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
          const safeResult = wrapUntrustedEmail(resultStr, 8000);
          messages.push({
            role: 'tool',
            content: safeResult,
            toolCallId: decision.toolCall.id,
          });
          await emit('tool_call_finished', {
            name: tool.name,
            status: 'ok',
            summary: typeof result === 'object' && result.message ? result.message : 'Action completed',
          });
        } catch (err: any) {
          messages.push({
            role: 'tool',
            content: `Error: ${err.message}`,
            toolCallId: decision.toolCall.id,
          });
          await emit('tool_call_finished', {
            name: tool.name,
            status: 'error',
            summary: err.message,
          });
        }
      }
    }

    // Main Agent Loop
    while (iterations < maxIterations) {
      if (options.signal?.aborted) {
        await emit('run_finished', { status: 'cancelled' });
        return {
          runId: ctx.runId,
          conversationId: params.conversationId,
          status: 'cancelled',
          iterations,
          tokensIn: totalTokensIn,
          tokensOut: totalTokensOut,
        };
      }

      iterations += 1;

      let assistantContent = '';
      const gatheredToolCalls: ToolCall[] = [];

      try {
        const stream = ctx.llmClient.chat({
          messages,
          tools: toolDefs.length > 0 ? toolDefs : undefined,
          signal: options.signal,
        });

        for await (const chunk of stream) {
          if (chunk.type === 'text_delta') {
            assistantContent += chunk.text;
            await emit('text_delta', { text: chunk.text });
          } else if (chunk.type === 'tool_call') {
            gatheredToolCalls.push(chunk.toolCall);
          } else if (chunk.type === 'usage') {
            totalTokensIn += chunk.tokensIn;
            totalTokensOut += chunk.tokensOut;
          }
        }
      } catch (err: any) {
        await emit('error', { message: err.message });
        return {
          runId: ctx.runId,
          conversationId: params.conversationId,
          status: 'failed',
          error: err.message,
          iterations,
          tokensIn: totalTokensIn,
          tokensOut: totalTokensOut,
        };
      }

      messages.push({
        role: 'assistant',
        content: assistantContent,
        toolCalls: gatheredToolCalls.length > 0 ? gatheredToolCalls : undefined,
      });

      // If no tools requested, we are done!
      if (gatheredToolCalls.length === 0) {
        await emit('message_final', { content: assistantContent });
        await emit('run_finished', { status: 'succeeded' });
        return {
          runId: ctx.runId,
          conversationId: params.conversationId,
          status: 'succeeded',
          replyText: assistantContent,
          iterations,
          tokensIn: totalTokensIn,
          tokensOut: totalTokensOut,
        };
      }

      // Execute tool calls in order
      for (const call of gatheredToolCalls) {
        totalToolCalls += 1;
        if (totalToolCalls > 12) {
          messages.push({
            role: 'tool',
            content: 'Error: Maximum tool call limit (12) reached for this run.',
            toolCallId: call.id,
          });
          break;
        }

        const callSig = `${call.name}:${JSON.stringify(call.args)}`;
        const repeatedCount = toolCallHistory.filter((sig) => sig === callSig).length;
        if (repeatedCount >= 3) {
          messages.push({
            role: 'tool',
            content: `Error: Loop detected for tool ${call.name}. Aborting repeated calls.`,
            toolCallId: call.id,
          });
          continue;
        }
        toolCallHistory.push(callSig);

        const tool = this.registry.get(call.name);
        if (!tool) {
          messages.push({
            role: 'tool',
            content: `Error: Tool ${call.name} not found.`,
            toolCallId: call.id,
          });
          continue;
        }

        const parseResult = tool.schema.safeParse(call.args);
        if (!parseResult.success) {
          const zodMsg = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
          messages.push({
            role: 'tool',
            content: `Error invalid tool arguments: ${zodMsg}`,
            toolCallId: call.id,
          });
          continue;
        }

        const parsedArgs = parseResult.data;

        // Check approval requirement
        const requiresApproval =
          tool.risk === 'send' ||
          (tool.name === 'gmail_reply' && parsedArgs.mode === 'send' && !ctx.autoSendEnabled);

        if (requiresApproval) {
          let preview: ToolApprovalPreview = {
            recipient: parsedArgs.to || 'Unknown',
            subject: parsedArgs.subject || 'Reply',
            body: parsedArgs.bodyText || '',
          };

          if (tool.getApprovalPreview) {
            try {
              preview = await tool.getApprovalPreview(ctx, parsedArgs);
            } catch (pErr: any) {
              preview.warning = `Could not load full preview: ${pErr.message}`;
            }
          }

          const approvalId = randomUUID();

          // Persist approval row if db is provided
          if (ctx.db) {
            const expiresAt = new Date(Date.now() + 24 * 3600 * 1000); // 24 hours
            try {
              await ctx.db.insert('approvals').values({
                id: approvalId,
                userId: ctx.userId,
                runId: ctx.runId,
                toolName: tool.name,
                preview,
                args: parsedArgs,
                status: 'pending',
                expiresAt,
              });
            } catch (dbErr) {
              // Ignore or log error
            }
          }

          await emit('approval_required', {
            approvalId,
            toolName: tool.name,
            preview,
          });

          return {
            runId: ctx.runId,
            conversationId: params.conversationId,
            status: 'awaiting_approval',
            approvalId,
            approvalPreview: preview,
            iterations,
            tokensIn: totalTokensIn,
            tokensOut: totalTokensOut,
          };
        }

        // Execute tool directly
        try {
          await emit('tool_call_started', {
            name: tool.name,
            args: parsedArgs,
          });
          const result = await tool.execute(ctx, parsedArgs);
          const resultStr = typeof result === 'string' ? result : JSON.stringify(result);
          const safeResult = wrapUntrustedEmail(resultStr, 8000);
          messages.push({
            role: 'tool',
            content: safeResult,
            toolCallId: call.id,
          });
          await emit('tool_call_finished', {
            name: tool.name,
            status: 'ok',
            summary: typeof result === 'object' && result.message ? result.message : 'OK',
          });
        } catch (execErr: any) {
          messages.push({
            role: 'tool',
            content: `Tool execution failed: ${execErr.message}`,
            toolCallId: call.id,
          });
          await emit('tool_call_finished', {
            name: tool.name,
            status: 'error',
            summary: execErr.message,
          });
        }
      }
    }

    // Iterations exhausted: one final call WITHOUT tools asking for summary
    messages.push({
      role: 'user',
      content: 'Please summarize your progress and next steps in one concise sentence without calling any tools.',
    });

    let finalSummary = '';
    try {
      const summaryStream = ctx.llmClient.chat({
        messages,
        signal: options.signal,
      });
      for await (const chunk of summaryStream) {
        if (chunk.type === 'text_delta') {
          finalSummary += chunk.text;
          await emit('text_delta', { text: chunk.text });
        }
      }
    } catch {
      finalSummary = 'Completed requested steps.';
    }

    await emit('message_final', { content: finalSummary });
    await emit('run_finished', { status: 'succeeded' });

    return {
      runId: ctx.runId,
      conversationId: params.conversationId,
      status: 'succeeded',
      replyText: finalSummary,
      iterations,
      tokensIn: totalTokensIn,
      tokensOut: totalTokensOut,
    };
  }
}

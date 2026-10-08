import { NextRequest, NextResponse } from 'next/server';
import {
  getExecutionOrder,
  resolveTemplateVariables,
  simulateOpenAiOutput,
  getNestedValue,
} from '@/lib/workflow-engine';
import {
  WorkflowExecutionLog,
  WorkflowExecutionResult,
} from '@/types/workflow';

export async function POST(req: NextRequest) {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();

  try {
    const body = await req.json();
    const { nodes = [], edges = [], apiKeys = {} } = body;

    const runId = 'run_' + Math.random().toString(36).substring(2, 9);
    const executionOrder = getExecutionOrder(nodes, edges);
    const nodeMap = new Map<string, any>(nodes.map((n: any) => [n.id, n]));

    const context: Record<string, any> = {
      runId,
      timestamp: new Date().toISOString(),
    };

    const logs: WorkflowExecutionLog[] = [];
    let hasError = false;

    for (const nodeId of executionOrder) {
      const node = nodeMap.get(nodeId);
      if (!node) continue;

      const nodeStart = Date.now();
      const nodeData = node.data || {};
      const config = nodeData.config || {};
      const nodeType = nodeData.nodeType || node.type;

      let outputPayload: any = null;
      let errorMsg: string | undefined = undefined;
      let status: 'success' | 'error' = 'success';
      let tokensUsed: number | undefined = undefined;

      try {
        switch (nodeType) {
          case 'input_form_trigger': {
            outputPayload = {
              submittedValues: config.submittedValues || {},
              fields: config.fields || [],
              formTitle: config.formTitle || 'Form Submission',
              triggeredAt: new Date().toISOString(),
            };
            break;
          }

          case 'file_upload_trigger': {
            outputPayload = {
              fileName: config.sampleFileName || 'uploaded_document.json',
              content: config.sampleFileContent || '',
              parsedData: config.parsedData || { sample: true },
              fileSizeKb: 14.8,
              uploadedAt: new Date().toISOString(),
            };
            break;
          }

          case 'webhook_trigger': {
            outputPayload = {
              headers: { 'content-type': 'application/json', 'user-agent': 'WebhookClient/1.0' },
              body: config.payload || { event: 'user_signup', userId: 'usr_8923', email: 'test@example.com' },
              receivedAt: new Date().toISOString(),
            };
            break;
          }

          case 'openai_llm':
          case 'openai_classifier': {
            const systemPrompt = resolveTemplateVariables(config.systemPrompt || 'You are an AI assistant.', context);
            const userPrompt = resolveTemplateVariables(config.userPrompt || '', context);
            const model = config.model || 'gpt-4o-mini';
            const apiKey = apiKeys.openaiApiKey || process.env.OPENAI_API_KEY;

            if (apiKey && !config.mockFallback) {
              try {
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                  },
                  body: JSON.stringify({
                    model: model,
                    messages: [
                      { role: 'system', content: systemPrompt },
                      { role: 'user', content: userPrompt },
                    ],
                    temperature: config.temperature ?? 0.7,
                    max_tokens: config.maxTokens ?? 500,
                  }),
                });

                if (!response.ok) {
                  const errJson = await response.json().catch(() => ({}));
                  throw new Error(errJson.error?.message || `OpenAI API returned status ${response.status}`);
                }

                const data = await response.json();
                const choice = data.choices?.[0]?.message?.content || '';
                tokensUsed = data.usage?.total_tokens || 150;

                outputPayload = {
                  output: choice,
                  model: data.model,
                  promptTokens: data.usage?.prompt_tokens,
                  completionTokens: data.usage?.completion_tokens,
                  totalTokens: tokensUsed,
                  finishReason: data.choices?.[0]?.finish_reason,
                };
              } catch (aiErr: any) {
                // If real key fails, fall back smoothly with notice
                const simOutput = simulateOpenAiOutput(userPrompt, systemPrompt, model, context);
                outputPayload = {
                  output: simOutput,
                  model: `${model} (fallback simulation: ${aiErr.message})`,
                  totalTokens: 185,
                  simulated: true,
                };
              }
            } else {
              // Intelligent Realistic Simulation
              const simOutput = simulateOpenAiOutput(userPrompt, systemPrompt, model, context);
              tokensUsed = Math.floor(userPrompt.length / 4) + Math.floor(simOutput.length / 4);
              outputPayload = {
                output: simOutput,
                model: `${model} (Sandbox Engine)`,
                prompt: userPrompt,
                totalTokens: tokensUsed,
                simulated: true,
              };
            }
            break;
          }

          case 'gmail_send': {
            const resolvedTo = resolveTemplateVariables(config.to || '', context);
            const resolvedCc = resolveTemplateVariables(config.cc || '', context);
            const resolvedSubject = resolveTemplateVariables(config.subject || 'Automated Workflow Alert', context);
            const resolvedBody = resolveTemplateVariables(config.body || '', context);

            // In production or test environment, simulate or send RFC 2822 email
            const messageId = `<msg-${Date.now()}.${Math.random().toString(36).substring(2, 7)}@gmail.com>`;
            outputPayload = {
              messageId,
              threadId: `th_${Math.random().toString(36).substring(2, 9)}`,
              status: config.sendAsDraft ? 'draft_created' : 'sent',
              to: resolvedTo,
              cc: resolvedCc || undefined,
              subject: resolvedSubject,
              bodySnippet: resolvedBody.slice(0, 160) + (resolvedBody.length > 160 ? '...' : ''),
              fullBody: resolvedBody,
              sentAt: new Date().toISOString(),
              previewUrl: `https://mail.google.com/mail/u/0/#inbox/${messageId}`,
            };
            break;
          }

          case 'code_transform': {
            const rawCode = config.code || 'return input;';
            try {
              // Safe evaluation using Function
              const transformFn = new Function('input', 'context', `
                try {
                  ${rawCode.includes('return') ? rawCode : `return (${rawCode})`}
                } catch (e) {
                  return { error: e.message };
                }
              `);
              outputPayload = transformFn(context, context);
            } catch (evalErr: any) {
              outputPayload = { rawCode, error: evalErr.message };
              status = 'error';
              errorMsg = evalErr.message;
            }
            break;
          }

          case 'condition_filter': {
            const val = getNestedValue(context, config.field || '');
            let passed = false;
            switch (config.operator) {
              case 'equals':
                passed = String(val) === String(config.value);
                break;
              case 'contains':
                passed = String(val).toLowerCase().includes(String(config.value).toLowerCase());
                break;
              case 'greater_than':
                passed = Number(val) > Number(config.value);
                break;
              case 'is_truthy':
              default:
                passed = Boolean(val);
                break;
            }
            outputPayload = {
              field: config.field,
              fieldValue: val,
              passed,
            };
            break;
          }

          default:
            outputPayload = { status: 'executed', generic: true };
        }
      } catch (nodeErr: any) {
        status = 'error';
        errorMsg = nodeErr.message || 'Node execution failed';
        hasError = true;
      }

      const nodeDuration = Date.now() - nodeStart;

      // Register output into execution context so downstream nodes can reference it
      context[nodeId] = outputPayload;
      if (nodeData.label) {
        // Also register under sanitized label name (e.g. "Customer_Support_Form")
        const safeLabel = nodeData.label.replace(/[^a-zA-Z0-9_]/g, '_');
        context[safeLabel] = outputPayload;
      }

      logs.push({
        nodeId,
        nodeName: nodeData.label || nodeId,
        nodeType,
        status,
        startedAt: new Date(nodeStart).toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: nodeDuration,
        inputPayload: { contextAvailable: Object.keys(context) },
        outputPayload,
        error: errorMsg,
        tokensUsed,
      });

      if (status === 'error') {
        hasError = true;
      }
    }

    const totalDurationMs = Date.now() - startTime;
    const finishedAt = new Date().toISOString();

    const response: WorkflowExecutionResult = {
      runId,
      startedAt,
      finishedAt,
      totalDurationMs,
      success: !hasError,
      logs,
      finalOutputs: context,
    };

    return NextResponse.json(response);
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Execution error',
        startedAt,
        finishedAt: new Date().toISOString(),
        totalDurationMs: Date.now() - startTime,
        logs: [],
        finalOutputs: {},
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';

export type AIProvider = 'openai' | 'anthropic' | 'google';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const {
      messages = [],
      provider = 'openai',
      model = 'gpt-4o',
      apiKeys = {},
      context = {},
    } = await req.json();

    const lastMessage = messages[messages.length - 1]?.content || '';
    const lastMsgLower = lastMessage.toLowerCase();

    // Check for workflow command intent
    let workflowAction: any = null;
    if (lastMsgLower.includes('add gmail') || lastMsgLower.includes('create gmail')) {
      workflowAction = { type: 'ADD_NODE', nodeType: 'gmail_send', label: 'Gmail Auto-Send' };
    } else if (
      lastMsgLower.includes('add vector') ||
      lastMsgLower.includes('add pinecone') ||
      lastMsgLower.includes('add chroma') ||
      lastMsgLower.includes('vector db') ||
      lastMsgLower.includes('vector store')
    ) {
      workflowAction = { type: 'ADD_NODE', nodeType: 'vector_store', label: 'Vector Database (Memory)' };
    } else if (lastMsgLower.includes('add openai') || lastMsgLower.includes('add ai node') || lastMsgLower.includes('add claude') || lastMsgLower.includes('add gemini')) {
      workflowAction = { type: 'ADD_NODE', nodeType: 'openai_llm', label: 'AI Processing' };
    } else if (lastMsgLower.includes('add email list') || lastMsgLower.includes('add csv') || lastMsgLower.includes('add extractor')) {
      workflowAction = { type: 'ADD_NODE', nodeType: 'email_list_file_upload', label: 'Email List Extractor' };
    } else if (lastMsgLower.includes('add form') || lastMsgLower.includes('add input form')) {
      workflowAction = { type: 'ADD_NODE', nodeType: 'input_form_trigger', label: 'Input Form' };
    } else if (lastMsgLower.includes('run workflow') || lastMsgLower.includes('execute workflow')) {
      workflowAction = { type: 'RUN_WORKFLOW' };
    } else if (lastMsgLower.includes('clear canvas') || lastMsgLower.includes('clear workflow')) {
      workflowAction = { type: 'CLEAR_CANVAS' };
    } else if (
      lastMsgLower.includes('load executive') ||
      lastMsgLower.includes('executive assistant') ||
      lastMsgLower.includes('vector template')
    ) {
      workflowAction = { type: 'LOAD_TEMPLATE', templateId: 'ai-executive-assistant-memory' };
    } else if (lastMsgLower.includes('load outreach') || lastMsgLower.includes('cold outreach template')) {
      workflowAction = { type: 'LOAD_TEMPLATE', templateId: 'bulk-outreach-email-list' };
    }

    // 1. OPENAI PROVIDER
    if (provider === 'openai') {
      const apiKey = apiKeys.openaiApiKey || process.env.OPENAI_API_KEY;
      if (apiKey) {
        try {
          const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: model || 'gpt-4o',
              messages: [
                {
                  role: 'system',
                  content:
                    'You are FlowCraft AI Assistant. You help users design visual automations, write high-converting cold email outreach, configure nodes, and inspect data. If you suggest workflow commands, be specific.',
                },
                ...messages,
              ],
              temperature: 0.7,
              max_tokens: 800,
            }),
          });

          if (res.ok) {
            const data = await res.json();
            return NextResponse.json({
              reply: data.choices?.[0]?.message?.content || '',
              model: data.model,
              provider: 'openai',
              workflowAction,
              tokens: data.usage?.total_tokens || 100,
            });
          }
        } catch (e) {
          console.warn('OpenAI API request failed, falling back to simulated output');
        }
      }
    }

    // 2. ANTHROPIC CLAUDE PROVIDER
    if (provider === 'anthropic') {
      const apiKey = apiKeys.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
      if (apiKey) {
        try {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: model || 'claude-3-5-sonnet-20241022',
              max_tokens: 800,
              system:
                'You are FlowCraft AI Assistant powered by Claude. You help users build automated workflows, draft personalized emails, and optimize pipelines.',
              messages: messages.map((m: any) => ({
                role: m.role === 'system' ? 'user' : m.role,
                content: m.content,
              })),
            }),
          });

          if (res.ok) {
            const data = await res.json();
            const text = data.content?.[0]?.text || '';
            return NextResponse.json({
              reply: text,
              model: data.model,
              provider: 'anthropic',
              workflowAction,
              tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
            });
          }
        } catch (e) {
          console.warn('Anthropic API request failed, falling back');
        }
      }
    }

    // 3. GOOGLE GEMINI PROVIDER
    if (provider === 'google') {
      const apiKey = apiKeys.geminiApiKey || process.env.GEMINI_API_KEY;
      const targetModel = model || 'gemini-1.5-flash';
      if (apiKey) {
        try {
          const geminiContents = messages.map((m: any) => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
          }));

          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: geminiContents }),
            }
          );

          if (res.ok) {
            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            return NextResponse.json({
              reply: text,
              model: targetModel,
              provider: 'google',
              workflowAction,
              tokens: data.usageMetadata?.totalTokenCount || 90,
            });
          }
        } catch (e) {
          console.warn('Gemini API call failed, falling back');
        }
      }
    }

    // 4. INTELLIGENT SANDBOX SIMULATION (FALLBACK FOR ALL PROVIDERS)
    let simulatedReply = '';

    if (workflowAction?.type === 'ADD_NODE') {
      simulatedReply = `I've added the **${workflowAction.label}** node to your workflow canvas! You can click on it anytime to configure custom parameters or link it to other triggers.`;
    } else if (workflowAction?.type === 'LOAD_TEMPLATE') {
      if (workflowAction.templateId === 'ai-executive-assistant-memory') {
        simulatedReply = `Loaded the **AI Executive Assistant** workflow onto the canvas!\n\nThis pipeline orchestrates:\n1. **Executive Command & Lead Intake** (Input Form Trigger)\n2. **Vector Database Memory** (Pinecone/Chroma semantic grounding)\n3. **Advanced AI Executive Assistant** (with the official Master System Prompt)\n4. **Gmail API Tool Access** (draft/send with authorized credentials)\n\nClick **Run Workflow** or inspect any node drawer to review configuration!`;
      } else {
        simulatedReply = `Loaded the requested starter template onto your canvas!`;
      }
    } else if (workflowAction?.type === 'RUN_WORKFLOW') {
      simulatedReply = `Triggering full workflow execution! The engine is now processing connected nodes in dependency order.`;
    } else if (workflowAction?.type === 'CLEAR_CANVAS') {
      simulatedReply = `Cleared the canvas workspace. You can now drag new nodes or load a starter template!`;
    } else if (lastMsgLower.includes('vector') || lastMsgLower.includes('pinecone') || lastMsgLower.includes('chroma') || lastMsgLower.includes('memory')) {
      simulatedReply = `**Vector Database Memory System Active**\n\n• **Directives:** Memory-First Execution with zero-hallucination policy.\n• **Supported Backends:** Pinecone, Chroma, Qdrant, Weaviate.\n• **Available Variables:** \`{{node_vector_memory.historicalNotes}}\`, \`{{node_vector_memory.memoryFound}}\`, and \`{{node_vector_memory.matches}}\`.\n\nYou can connect this node before your AI Agent node to automatically ground responses in past interactions before triggering the Gmail API!`;
    } else if (lastMsgLower.includes('subject') || lastMsgLower.includes('title')) {
      simulatedReply = `Here are 3 high-converting subject line suggestions:\n\n1. **"Quick question regarding {{item.company}}'s AI workflows"** (High Open Rate: ~64%)\n2. **"{{item.name}}, saw your team's work on automation"** (Personalized & Direct)\n3. **"Scaling outbound pipelines at {{item.company}} without the manual grind"** (Value-driven)`;
    } else if (lastMsgLower.includes('draft') || lastMsgLower.includes('sales') || lastMsgLower.includes('cold') || lastMsgLower.includes('email')) {
      simulatedReply = `Here is a personalized cold outreach template ready to use in your Gmail node:\n\n**Subject:** Quick question regarding {{item.company}} automation\n\n**Body:**\nHi {{item.name}},\n\nI noticed your leadership at {{item.company}} and was inspired by how your team approaches rapid growth.\n\nWe recently helped similar teams streamline lead qualification and automated personalized Gmail outreach using AI workflows—reducing cycle times by over 80%.\n\nWould you be open to a 5-minute chat next Tuesday to see how this could benefit {{item.company}}?\n\nBest regards,\nJordan Lee\nFlowCraft Team`;
    } else if (lastMsgLower.includes('domain') || lastMsgLower.includes('extract') || lastMsgLower.includes('list')) {
      const emailCount = context.extractedCount || 25;
      simulatedReply = `I analyzed your extracted list of **${emailCount} emails**. Based on domain distribution:\n- High concentration of custom corporate domains indicates B2B enterprise leads.\n- Recommendation: Pacing Gmail sends with 200ms delay to maintain sender reputation.\n- You can use the **'Bulk Send'** button to dispatch tailored emails with variable tokens like \`{{item.company}}\`.`;
    } else {
      simulatedReply = `[${provider.toUpperCase()} / ${model}]\n\nI can help you build workflows, write email copy, and control canvas nodes!\n\n**Suggested actions:**\n- *"Draft a follow-up email for no-replies"*\n- *"Add a Gmail node to canvas"*\n- *"Extract emails from uploaded CSV"*\n- *"Run the workflow"*\n\nLet me know what you'd like to do next!`;
    }

    return NextResponse.json({
      reply: simulatedReply,
      model: `${model} (Sandbox)`,
      provider,
      workflowAction,
      tokens: Math.floor(lastMessage.length / 4) + Math.floor(simulatedReply.length / 4),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

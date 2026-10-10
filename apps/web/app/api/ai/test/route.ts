import { NextRequest, NextResponse } from 'next/server';
import { simulateOpenAiOutput } from '@/lib/workflow-engine';

export async function POST(req: NextRequest) {
  try {
    const {
      model = 'gpt-4o-mini',
      systemPrompt = '',
      userPrompt = '',
      apiKey = '',
      baseUrl = 'https://api.openai.com/v1',
    } = await req.json();

    const effectiveKey = apiKey || process.env.OPENAI_API_KEY;

    if (effectiveKey) {
      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${effectiveKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt || 'You are an AI assistant.' },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.7,
            max_tokens: 500,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          return NextResponse.json({
            success: true,
            output: data.choices?.[0]?.message?.content || '',
            tokens: data.usage?.total_tokens || 100,
            model: data.model,
            keySource: apiKey ? 'custom_provided' : 'global_environment',
          });
        } else {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error?.message || `API error ${response.status}`);
        }
      } catch (err: any) {
        // Fall back gracefully with explanatory message
        return NextResponse.json({
          success: false,
          error: err.message,
        }, { status: 400 });
      }
    }

    // High fidelity simulator
    const simOutput = simulateOpenAiOutput(userPrompt, systemPrompt, model, {});
    return NextResponse.json({
      success: true,
      output: simOutput,
      tokens: Math.floor(userPrompt.length / 4) + Math.floor(simOutput.length / 4),
      model: `${model} (Sandbox Simulation)`,
      keySource: 'sandbox_simulation',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

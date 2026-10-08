import { NextRequest, NextResponse } from 'next/server';
import { simulateOpenAiOutput } from '@/lib/workflow-engine';

export async function POST(req: NextRequest) {
  try {
    const { model = 'gpt-4o-mini', systemPrompt = '', userPrompt = '', apiKey = '' } = await req.json();
    const effectiveKey = apiKey || process.env.OPENAI_API_KEY;

    if (effectiveKey) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
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
          });
        }
      } catch (err: any) {
        // Fall back to simulation
      }
    }

    // High fidelity simulator
    const simOutput = simulateOpenAiOutput(userPrompt, systemPrompt, model, {});
    return NextResponse.json({
      success: true,
      output: simOutput,
      tokens: Math.floor(userPrompt.length / 4) + Math.floor(simOutput.length / 4),
      model: `${model} (Sandbox Simulation)`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

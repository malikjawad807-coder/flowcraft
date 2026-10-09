import { NextRequest, NextResponse } from 'next/server';
import { dispatchSingleEmail } from '@/lib/email-service';

export async function POST(req: NextRequest) {
  try {
    const {
      to,
      cc,
      subject,
      body,
      authMethod = 'sandbox',
      userEmail,
      appPassword,
      oauthToken,
    } = await req.json();

    if (!to) {
      return NextResponse.json({ success: false, error: 'Recipient "to" is required' }, { status: 400 });
    }

    const dispatchRes = await dispatchSingleEmail({
      authMethod,
      userEmail,
      appPassword,
      oauthToken,
      to,
      cc,
      subject: subject || 'FlowCraft Test Email',
      body: body || 'This is a test email sent from FlowCraft Studio.',
    });

    return NextResponse.json(dispatchRes);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

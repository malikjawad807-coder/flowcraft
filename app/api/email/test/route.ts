import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { to, cc, subject, body } = await req.json();

    if (!to) {
      return NextResponse.json({ success: false, error: 'Recipient "to" is required' }, { status: 400 });
    }

    const messageId = `<msg-${Date.now()}.${Math.random().toString(36).substring(2, 7)}@gmail.com>`;

    return NextResponse.json({
      success: true,
      messageId,
      to,
      cc,
      subject: subject || '(No Subject)',
      bodySnippet: (body || '').slice(0, 150),
      deliveredAt: new Date().toISOString(),
      status: 'sent',
      info: 'Email dispatched successfully via Gmail engine simulation.',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const logPrefix = '[api/webhook.POST]';

  const rawBody = await request.text();
  const signature = request.headers.get('event-signature') ?? '';

  console.log(`${logPrefix} received webhook`, {
    signature,
    body: rawBody,
  });

  return NextResponse.json({ received: true }, { status: 200 });
}


import { NextResponse } from 'next/server';
import { logBotCommand } from '@/lib/data';
import { checkBotApiKey } from '@/lib/auth';

export async function POST(request: Request) {
  const auth = await checkBotApiKey();
  if (!auth.authorized) {
    return NextResponse.json({ message: auth.message }, { status: 401 });
  }

  try {
    const { command, userId } = await request.json();
    if (!command || !userId) {
      return NextResponse.json({ message: "Missing command or userId" }, { status: 400 });
    }

    await logBotCommand(command, userId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}

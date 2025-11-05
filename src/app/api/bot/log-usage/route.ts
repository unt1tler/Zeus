
import { NextResponse } from 'next/server';
import { getSettings, logBotCommand } from '@/lib/data';
import { headers } from 'next/headers';

async function checkApiKey() {
    const settings = await getSettings();
    const headersList = headers();
    const apiKey = headersList.get('x-api-key');

    if (!apiKey || apiKey !== settings.apiKey) {
        return { authorized: false, message: 'Invalid or missing API key.' };
    }
    return { authorized: true };
}

export async function POST(request: Request) {
    const auth = await checkApiKey();
    if (!auth.authorized) {
      return NextResponse.json({ message: auth.message }, { status: 401 });
    }

    try {
        const { command, userId } = await request.json();
        if (!command || !userId) {
            return NextResponse.json({ message: "Missing command or userId" }, { status: 400 });
        }

        await logBotCommand(command, userId);
        
        return NextResponse.json({ success: true }, { status: 200 });
    } catch (error) {
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}

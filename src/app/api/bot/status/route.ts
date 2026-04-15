import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { getBotStatusSnapshot } from "@/lib/bot-status";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      { message: "Unauthorized" },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const botStatus = await getBotStatusSnapshot();
  return NextResponse.json(botStatus, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

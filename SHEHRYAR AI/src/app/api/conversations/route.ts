import { db } from "@/db";
import { conversations } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user?.profileComplete) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const rows = await db
    .select({ id: conversations.id, title: conversations.title, updatedAt: conversations.updatedAt })
    .from(conversations)
    .where(eq(conversations.userId, user.id))
    .orderBy(desc(conversations.updatedAt))
    .limit(50);

  return NextResponse.json({ conversations: rows });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user?.profileComplete) return NextResponse.json({ error: "Login required" }, { status: 401 });
  let body: { deviceId?: unknown } = {};
  try { body = (await request.json()) as { deviceId?: unknown }; } catch { /* account owner is enough */ }
  const deviceId = typeof body.deviceId === "string" && body.deviceId.length <= 100 ? body.deviceId : `account-${user.id}`;

  const [conversation] = await db
    .insert(conversations)
    .values({ deviceId, userId: user.id })
    .returning({ id: conversations.id, title: conversations.title, updatedAt: conversations.updatedAt });

  return NextResponse.json({ conversation }, { status: 201 });
}

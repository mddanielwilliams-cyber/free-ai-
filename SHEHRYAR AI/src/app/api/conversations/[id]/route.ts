import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

async function ownedConversation(id: string) {
  const user = await getSessionUser();
  if (!user?.profileComplete) return { user: null, conversation: null };
  const [conversation] = await db
    .select({ id: conversations.id, title: conversations.title })
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, user.id)))
    .limit(1);
  return { user, conversation: conversation ?? null };
}

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  const { conversation } = await ownedConversation(id);
  if (!conversation) return NextResponse.json({ error: "Chat not found" }, { status: 404 });

  const chatMessages = await db
    .select({ id: messages.id, role: messages.role, content: messages.content, attachmentName: messages.attachmentName, createdAt: messages.createdAt })
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));
  return NextResponse.json({ conversation, messages: chatMessages });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  const { conversation } = await ownedConversation(id);
  if (!conversation) return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  await db.delete(conversations).where(eq(conversations.id, id));
  return NextResponse.json({ ok: true });
}

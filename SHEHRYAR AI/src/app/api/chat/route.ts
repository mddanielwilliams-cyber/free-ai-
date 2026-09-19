import { db } from "@/db";
import { conversations, messages } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are SHEHRYAR AI, a fast, highly capable general assistant and elite senior software engineer. You were created by SHEHRYAR MD. Whenever anyone asks who made you, who created you, who built you, or who your developer/owner is — in any language — always answer clearly that you were made by SHEHRYAR MD (for example: "Mujhe SHEHRYAR MD ne banaya hai."). Never credit any other company or person as your creator. Answer immediately in the user's language. Start directly with the useful answer—never repeat the question or add unnecessary introductions. Keep ordinary answers concise, accurate, and practical. For coding requests, provide complete production-quality solutions with architecture, responsive UI, accessibility, security, validation, errors, and setup steps. Never claim code was executed when it was not. Use fenced code blocks with language labels. Ask a question only when absolutely necessary; otherwise make sensible decisions and deliver the answer.`;

type Provider = { endpoint: string; key?: string; model: string; headers?: Record<string, string> };
type ChatItem = { role: "user" | "assistant"; content: string };

function getProvider(): Provider {
  if (process.env.GROQ_API_KEY) return { endpoint: "https://api.groq.com/openai/v1/chat/completions", key: process.env.GROQ_API_KEY, model: process.env.GROQ_MODEL ?? "llama-3.1-8b-instant" };
  if (process.env.OPENROUTER_API_KEY) return { endpoint: "https://openrouter.ai/api/v1/chat/completions", key: process.env.OPENROUTER_API_KEY, model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini", headers: { "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000", "X-OpenRouter-Title": "SHEHRYAR AI" } };
  if (process.env.OPENAI_API_KEY) return { endpoint: "https://api.openai.com/v1/chat/completions", key: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL ?? "gpt-4o-mini" };
  return { endpoint: "https://api.kilo.ai/api/gateway/chat/completions", model: "kilo-auto/free" };
}

export async function POST(request: Request) {
  let body: { conversationId?: unknown; message?: unknown; attachmentName?: unknown; history?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  if (typeof body.message !== "string" || !body.message.trim() || body.message.length > 50000) return NextResponse.json({ error: "Message is empty or too large" }, { status: 400 });

  const sessionUser = await getSessionUser();
  const accountUser = sessionUser?.profileComplete ? sessionUser : null;
  let conversation: { id: string; title: string } | null = null;

  if (accountUser && typeof body.conversationId === "string") {
    const [owned] = await db
      .select({ id: conversations.id, title: conversations.title })
      .from(conversations)
      .where(and(eq(conversations.id, body.conversationId), eq(conversations.userId, accountUser.id)))
      .limit(1);
    if (!owned) return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    conversation = owned;
  }

  const cleanMessage = body.message.trim();
  let previous: ChatItem[] = [];
  if (conversation) {
    previous = await db.select({ role: messages.role, content: messages.content }).from(messages).where(eq(messages.conversationId, conversation.id)).orderBy(asc(messages.createdAt)).limit(40);
  } else if (Array.isArray(body.history)) {
    previous = body.history
      .filter((item): item is { role?: unknown; content?: unknown } => typeof item === "object" && item !== null)
      .filter((item): item is { role: "user" | "assistant"; content: string } => (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
      .slice(-40)
      .map((item) => ({ role: item.role, content: item.content.slice(0, 50000) }));
  }

  const upstreamMessages: ChatItem[] | Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT },
    ...previous,
    { role: "user", content: cleanMessage },
  ];
  const provider = getProvider();
  let upstream: Response | null = null;
  let upstreamErrorDetail = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const candidate = await fetch(provider.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(provider.key ? { Authorization: `Bearer ${provider.key}` } : {}), ...provider.headers },
        body: JSON.stringify({ model: provider.model, messages: upstreamMessages, temperature: 0.25, max_tokens: 4096, stream: true }),
        signal: AbortSignal.timeout(50000),
      });
      if (candidate.ok) { upstream = candidate; break; }
      const data = (await candidate.json().catch(() => null)) as { error?: { message?: string } } | null;
      upstreamErrorDetail = data?.error?.message ?? "";
    } catch { upstreamErrorDetail = "AI service could not be reached."; }
  }
  if (!upstream) return NextResponse.json({ error: upstreamErrorDetail ? `AI service: ${upstreamErrorDetail}` : "AI service returned an error. Please try again." }, { status: 502 });
  if (!upstream.body) return NextResponse.json({ error: "AI returned an empty response. Please try again." }, { status: 502 });

  const attachmentName = typeof body.attachmentName === "string" ? body.attachmentName.slice(0, 255) : null;
  const title = conversation && conversation.title === "New chat" ? cleanMessage.replace(/\s+/g, " ").slice(0, 55) : conversation?.title ?? "";
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = upstream.body.getReader();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      let reply = "";
      try {
        let finished = false;
        while (!finished) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") { finished = true; break; }
            try {
              const chunk = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> };
              const text = chunk.choices?.[0]?.delta?.content;
              if (text) { reply += text; controller.enqueue(encoder.encode(text)); }
            } catch { /* Ignore provider metadata chunks. */ }
          }
        }
        if (reply.trim() && conversation && accountUser) {
          await db.transaction(async (tx) => {
            await tx.insert(messages).values([{ conversationId: conversation.id, role: "user", content: cleanMessage, attachmentName }, { conversationId: conversation.id, role: "assistant", content: reply.trim() }]);
            await tx.update(conversations).set({ title, updatedAt: new Date() }).where(eq(conversations.id, conversation.id));
          });
        }
      } catch { if (!reply) controller.enqueue(encoder.encode("Connection interrupted. Please try again.")); }
      finally { controller.close(); }
    },
    cancel() { void reader.cancel(); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no", "X-AI-Model": provider.model } });
}

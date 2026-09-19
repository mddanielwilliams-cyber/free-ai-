import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { setSessionCookie, verifyPassword } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !password) return NextResponse.json({ error: "Email aur password dono likhein." }, { status: 400 });

  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email, passwordHash: users.passwordHash, avatarIndex: users.avatarIndex, profileComplete: users.profileComplete })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Email ya password ghalat hai." }, { status: 401 });
  }

  const [session] = await db.insert(sessions).values({ userId: user.id }).returning({ token: sessions.token });
  await setSessionCookie(session.token);
  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, avatarIndex: user.avatarIndex, profileComplete: user.profileComplete } });
}

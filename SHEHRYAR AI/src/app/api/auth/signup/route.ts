import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { name?: unknown; email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 120) return NextResponse.json({ error: "Sahi email address likhein." }, { status: 400 });
  if (password.length < 6 || password.length > 100) return NextResponse.json({ error: "Password kam az kam 6 characters ka rakhen." }, { status: 400 });

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return NextResponse.json({ error: "Is email par account pehle se hai. Login karein." }, { status: 409 });

  const [user] = await db
    .insert(users)
    .values({ name: "New user", email, passwordHash: hashPassword(password), profileComplete: false })
    .returning({ id: users.id, name: users.name, email: users.email, avatarIndex: users.avatarIndex, profileComplete: users.profileComplete });

  const [session] = await db.insert(sessions).values({ userId: user.id }).returning({ token: sessions.token });
  await setSessionCookie(session.token);
  return NextResponse.json({ user }, { status: 201 });
}

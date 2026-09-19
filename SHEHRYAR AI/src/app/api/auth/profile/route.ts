import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return NextResponse.json({ error: "Please login first." }, { status: 401 });

  let body: { name?: unknown; avatarIndex?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request" }, { status: 400 }); }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const avatarIndex = typeof body.avatarIndex === "number" ? body.avatarIndex : -1;
  if (name.length < 2 || name.length > 60) return NextResponse.json({ error: "Name 2-60 letters ka hona chahiye." }, { status: 400 });
  if (!Number.isInteger(avatarIndex) || avatarIndex < 0 || avatarIndex >= 50) return NextResponse.json({ error: "Please choose a profile photo." }, { status: 400 });

  const [user] = await db
    .update(users)
    .set({ name, avatarIndex, profileComplete: true })
    .where(eq(users.id, sessionUser.id))
    .returning({ id: users.id, name: users.name, email: users.email, avatarIndex: users.avatarIndex, profileComplete: users.profileComplete });
  return NextResponse.json({ user });
}

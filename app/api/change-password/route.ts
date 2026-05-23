import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, schema, dbAvailable } from "@/lib/db";
import { auth } from "@/auth";

export async function POST(req: Request) {
  if (!dbAvailable) {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.currentPassword !== "string" || typeof body.newPassword !== "string") {
      return NextResponse.json({ error: "Missing currentPassword or newPassword" }, { status: 400 });
    }

    const { currentPassword, newPassword } = body;

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }

    if (currentPassword === newPassword) {
      return NextResponse.json({ error: "New password must be different from current password" }, { status: 400 });
    }

    // Fetch user from DB
    const rows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, session.user.id))
      .limit(1);
    const user = rows[0];

    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Verify current password
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
    }

    // Hash new password and update
    const newHash = await bcrypt.hash(newPassword, 12);
    await db
      .update(schema.users)
      .set({ passwordHash: newHash })
      .where(eq(schema.users.id, session.user.id));

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/change-password error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

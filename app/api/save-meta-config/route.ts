import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { auth } from "@/auth";

const CONFIG_PATH = path.join(process.cwd(), "config", "meta.json");

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
    const body = await req.json();
    const { appId, appSecret, accessToken, adAccountId } = body;

    if (!appId || !appSecret || !accessToken || !adAccountId) {
      return NextResponse.json({ error: "All four fields are required." }, { status: 400 });
    }

    fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ appId, appSecret, accessToken, adAccountId }, null, 2), "utf-8");

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[save-meta-config]", err);
    return NextResponse.json({ error: "Failed to save config" }, { status: 500 });
  }
}

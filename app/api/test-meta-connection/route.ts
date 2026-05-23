import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { auth } from "@/auth";

const CONFIG_PATH = path.join(process.cwd(), "config", "meta.json");

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
    if (!fs.existsSync(CONFIG_PATH)) {
      return NextResponse.json({ ok: false, error: "No config saved. Please save credentials first." });
    }

    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const config = JSON.parse(raw) as { accessToken?: string };

    if (!config.accessToken) {
      return NextResponse.json({ ok: false, error: "Access token is missing from saved config." });
    }

    const url = `https://graph.facebook.com/v21.0/me?access_token=${encodeURIComponent(config.accessToken)}`;
    const res = await fetch(url);
    const data = await res.json() as { name?: string; error?: { message?: string } };

    if (!res.ok || data.error) {
      return NextResponse.json({ ok: false, error: data.error?.message ?? "Connection failed." });
    }

    return NextResponse.json({ ok: true, name: data.name ?? "Unknown" });
  } catch (err) {
    console.error("[test-meta-connection]", err);
    return NextResponse.json({ ok: false, error: "Internal error testing connection." });
  }
}

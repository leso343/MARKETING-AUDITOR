import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { auth } from "@/auth";
import { log } from "@/lib/logger";

const CONFIG_PATH = path.join(process.cwd(), "config", "meta.json");

type MetaConfig = {
  appId?: string;
  appSecret?: string;
  accessToken?: string;
  adAccountId?: string;
};

function mask(val: string | undefined): string {
  return val ? "••••••••" : "";
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });
    if (!fs.existsSync(CONFIG_PATH)) {
      return NextResponse.json({ appId: "", appSecret: "", accessToken: "", adAccountId: "", configured: false });
    }

    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const config: MetaConfig = JSON.parse(raw);

    return NextResponse.json({
      appId: config.appId ?? "",
      appSecret: mask(config.appSecret),
      accessToken: mask(config.accessToken),
      adAccountId: config.adAccountId ?? "",
      configured: !!(config.appId && config.appSecret && config.accessToken && config.adAccountId),
    });
  } catch (err) {
    log.error("Failed to read Meta config", err);
    return NextResponse.json({ error: "Failed to read config" }, { status: 500 });
  }
}

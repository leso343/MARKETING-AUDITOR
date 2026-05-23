import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { auth } from "@/auth";

const ALLOWED_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const target = formData.get("target") as string | null;
    const clientSlug = formData.get("clientSlug") as string | null;

    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (!target || !["agency", "client"].includes(target)) {
      return NextResponse.json({ error: "Invalid target" }, { status: 400 });
    }
    if (target === "client" && !clientSlug) {
      return NextResponse.json({ error: "clientSlug required for client target" }, { status: 400 });
    }

    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      return NextResponse.json({ error: "Invalid file type. Use PNG, JPG, SVG, or WEBP." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "File exceeds 2 MB limit." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const cwd = process.cwd();

    let saveDir: string;
    let publicUrl: string;

    if (target === "agency") {
      saveDir = path.join(cwd, "public", "logos");
      fs.mkdirSync(saveDir, { recursive: true });

      // Delete any existing agency logo variants
      const existing = fs.readdirSync(saveDir).filter((f) => f.startsWith("agency."));
      for (const old of existing) fs.unlinkSync(path.join(saveDir, old));

      const filename = `agency.${ext}`;
      fs.writeFileSync(path.join(saveDir, filename), buffer);
      publicUrl = `/logos/${filename}`;
    } else {
      // client
      const safe = (clientSlug as string).replace(/[^a-z0-9-_]/gi, "-");
      saveDir = path.join(cwd, "public", "csvs", safe);
      fs.mkdirSync(saveDir, { recursive: true });

      // Delete old client logo variants
      const existing = fs.readdirSync(saveDir).filter((f) => f.startsWith("logo."));
      for (const old of existing) fs.unlinkSync(path.join(saveDir, old));

      const filename = `logo.${ext}`;
      fs.writeFileSync(path.join(saveDir, filename), buffer);
      publicUrl = `/csvs/${safe}/${filename}`;
    }

    return NextResponse.json({ ok: true, url: publicUrl });
  } catch (err) {
    console.error("[upload-logo]", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}

/**
 * POST /api/ai/chat — streaming chat with the Blank Page Audits assistant.
 *
 * Request body:
 *   {
 *     clientSlug?: string,           // null when on a non-audit page
 *     conversationId?: string,       // null = start a new conversation
 *     message: string,               // the user's new message
 *   }
 *
 * Response: text/event-stream with chunks of the assistant's reply.
 * Streams `data: {"type":"meta","conversationId":"...","usage":{...}}` first,
 * then `data: {"type":"delta","text":"..."}` for each chunk, then
 * `data: {"type":"done","tokens":{...}}`.
 *
 * Guards:
 *   - Auth required (session user).
 *   - When clientSlug is given, user must have access to that client.
 *   - Tier limit (free 25 lifetime, pro 500/mo, agency unlimited).
 *   - Hourly throttle 30 msg/hour per user (in-memory rate-limit lib).
 *
 * Cost-control:
 *   - Audit context sent as an `ephemeral`-cached system block, so
 *     follow-up messages pay ~$0.001 instead of ~$0.015 for ctx tokens.
 *
 * Returns 503 when AUTH_SECRET / DATABASE_URL / ANTHROPIC_API_KEY unset.
 */
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { eq, asc } from "drizzle-orm";
import { db, schema, dbAvailable } from "@/lib/db";
import { tryGetUser, getVisibleClientBySlug, listClientCsvs } from "@/lib/access";
import { authEnabled } from "@/auth";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { getBillingState } from "@/lib/billing-access";
import { runAuditFromFiles } from "@/engine/runAuditFromFiles";
import { runAudit } from "@/engine/runAudit";
import {
  serializeAuditContext,
  SYSTEM_PROMPT_BASE,
  SYSTEM_PROMPT_NO_AUDIT,
} from "@/lib/ai-context";
import { checkAiUsage } from "@/lib/ai-usage";
import { decryptSecret, isCryptoConfigured } from "@/lib/crypto";
import { log } from "@/lib/logger";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
const MAX_OUTPUT_TOKENS = 1024;

function badConfig() {
  return NextResponse.json(
    { error: "AI assistant unavailable — set ANTHROPIC_API_KEY in environment." },
    { status: 503 },
  );
}

export async function POST(req: Request) {
  if (!authEnabled || !dbAvailable) return badConfig();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return badConfig();

  const user = await tryGetUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  // ── Hourly throttle (best-effort, in-memory) ──────────────────────────
  const rl = rateLimit(`ai-chat:${user.id}`, { max: 30, windowMs: 60 * 60 * 1000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many messages this hour. Try again in a few minutes." },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    clientSlug?: string | null;
    conversationId?: string | null;
    message?: string;
  } | null;

  const userMessage = body?.message?.trim();
  if (!userMessage) {
    return NextResponse.json({ error: "message is required." }, { status: 400 });
  }
  if (userMessage.length > 4000) {
    return NextResponse.json({ error: "Message too long (max 4000 chars)." }, { status: 400 });
  }

  // ── Resolve audit context (if user is on an audit page) ───────────────
  const clientSlug = body?.clientSlug?.trim() || null;
  let auditContextBlock: string | null = null;
  let clientId: string | null = null;

  if (clientSlug) {
    const client = await getVisibleClientBySlug(clientSlug);
    if (!client) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }
    clientId = client.id;

    // Run the audit (same path as the audit page).
    try {
      const dbCsvs = await listClientCsvs(client.id);
      const fsDir = path.join(process.cwd(), "public", "csvs", client.slug);
      const fsExists = fs.existsSync(fsDir);
      const audit =
        dbCsvs.length > 0
          ? runAuditFromFiles({
              files: dbCsvs.map((c) => ({ filename: c.filename, content: c.content })),
              clientName: client.name,
            })
          : fsExists
            ? runAudit({ csvDir: fsDir, clientName: client.name })
            : null;
      if (audit && audit.fileSummary.length > 0) {
        auditContextBlock = serializeAuditContext(audit);
      }
    } catch (err) {
      log.error("[ai-chat] audit run failed for context build", err);
    }
  }

  // ── Tier check + BYO key resolution ────────────────────────────────────
  const billing = user.agencyId ? await getBillingState(user.agencyId) : null;
  const planId = billing?.ok ? billing.plan.id : "free";

  // Agency tier can BYO their own Anthropic key — when present, they pay
  // Anthropic directly and bypass the monthly tier cap (the hourly
  // throttle still applies above). Gated behind BYO_KEYS_ENABLED env
  // flag so the feature can be soft-launched without code changes.
  let effectiveApiKey = apiKey;
  let usingByoKey = false;
  const byoEnabled = process.env.BYO_KEYS_ENABLED === "true";
  if (byoEnabled && planId === "agency" && user.agencyId && isCryptoConfigured()) {
    try {
      const byoRows = await db
        .select({ encryptedKey: schema.agencyAiConfigs.encryptedKey })
        .from(schema.agencyAiConfigs)
        .where(eq(schema.agencyAiConfigs.agencyId, user.agencyId))
        .limit(1);
      if (byoRows[0]?.encryptedKey) {
        effectiveApiKey = decryptSecret(byoRows[0].encryptedKey);
        usingByoKey = true;
      }
    } catch (err) {
      log.error("[ai-chat] BYO key decrypt failed; falling back to server key", err);
    }
  }

  // Skip tier cap when on BYO — they're paying Anthropic themselves.
  if (!usingByoKey) {
    const usage = await checkAiUsage(user.id, planId);
    if (!usage.ok) {
      return NextResponse.json(
        { error: usage.reason, code: usage.code, used: usage.used, limit: usage.limit },
        { status: 403 },
      );
    }
  }

  // ── Resolve / create conversation ──────────────────────────────────────
  let conversationId = body?.conversationId?.trim() || null;
  let priorMessages: Array<{ role: "user" | "assistant"; content: string }> = [];

  if (conversationId) {
    // Verify ownership.
    const convRows = await db
      .select()
      .from(schema.aiConversations)
      .where(eq(schema.aiConversations.id, conversationId))
      .limit(1);
    const conv = convRows[0];
    if (!conv || conv.userId !== user.id) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }
    const msgRows = await db
      .select()
      .from(schema.aiMessages)
      .where(eq(schema.aiMessages.conversationId, conversationId))
      .orderBy(asc(schema.aiMessages.createdAt));
    priorMessages = msgRows.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
  } else {
    // Create a new conversation with a title derived from the first user message.
    conversationId = randomUUID();
    const title = userMessage.slice(0, 60).trim().replace(/\s+/g, " ") || "New conversation";
    await db.insert(schema.aiConversations).values({
      id: conversationId,
      userId: user.id,
      clientId,
      title,
    });
  }

  // Persist the user message immediately so usage count + UI history stay correct.
  const userMsgId = randomUUID();
  await db.insert(schema.aiMessages).values({
    id: userMsgId,
    conversationId,
    role: "user",
    content: userMessage,
  });

  // ── Build the Anthropic call ───────────────────────────────────────────
  const client = new Anthropic({ apiKey: effectiveApiKey });

  const systemBase = auditContextBlock ? SYSTEM_PROMPT_BASE : SYSTEM_PROMPT_NO_AUDIT;
  const systemBlocks: Anthropic.MessageCreateParams["system"] = auditContextBlock
    ? [
        // Stable across the conversation → cache hit on follow-ups.
        { type: "text", text: systemBase, cache_control: { type: "ephemeral" } },
        { type: "text", text: auditContextBlock, cache_control: { type: "ephemeral" } },
      ]
    : [{ type: "text", text: systemBase }];

  // Construct the messages array. Cap history to last 20 turns to bound input cost.
  const trimmedHistory = priorMessages.slice(-20);
  const messages: Anthropic.MessageParam[] = [
    ...trimmedHistory.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  // ── Stream response back to the client ─────────────────────────────────
  const encoder = new TextEncoder();
  let accumulated = "";
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  let cacheReadTokens: number | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      try {
        send({ type: "meta", conversationId, usingByoKey });

        const apiStream = client.messages.stream({
          model: MODEL,
          max_tokens: MAX_OUTPUT_TOKENS,
          system: systemBlocks,
          messages,
        });

        for await (const event of apiStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            accumulated += event.delta.text;
            send({ type: "delta", text: event.delta.text });
          }
        }

        // Final message + usage.
        const final = await apiStream.finalMessage();
        inputTokens = final.usage.input_tokens;
        outputTokens = final.usage.output_tokens;
        cacheReadTokens =
          (final.usage as { cache_read_input_tokens?: number }).cache_read_input_tokens;

        // Persist assistant message + token usage.
        await db.insert(schema.aiMessages).values({
          id: randomUUID(),
          conversationId,
          role: "assistant",
          content: accumulated,
          inputTokens,
          outputTokens,
          cacheReadTokens,
        });

        // Bump conversation updatedAt.
        await db
          .update(schema.aiConversations)
          .set({ updatedAt: new Date() })
          .where(eq(schema.aiConversations.id, conversationId));

        send({ type: "done", tokens: { inputTokens, outputTokens, cacheReadTokens } });
        controller.close();
      } catch (err) {
        log.error("[ai-chat] stream failed", err);
        const msg = err instanceof Error ? err.message : "Unknown error";
        send({ type: "error", error: msg });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/**
 * GET /api/ai/chat?conversationId=... — load message history for a thread.
 * Used by the UI when resuming a conversation.
 */
export async function GET(req: Request) {
  if (!authEnabled || !dbAvailable) return badConfig();
  const user = await tryGetUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("conversationId");
  const clientSlug = searchParams.get("clientSlug");

  // Mode 1: hydrate a specific conversation.
  if (conversationId) {
    const convRows = await db
      .select()
      .from(schema.aiConversations)
      .where(eq(schema.aiConversations.id, conversationId))
      .limit(1);
    const conv = convRows[0];
    if (!conv || conv.userId !== user.id) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }
    const msgs = await db
      .select()
      .from(schema.aiMessages)
      .where(eq(schema.aiMessages.conversationId, conversationId))
      .orderBy(asc(schema.aiMessages.createdAt));
    return NextResponse.json({
      conversation: conv,
      messages: msgs.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    });
  }

  // Mode 2: list the user's recent conversations (optionally scoped to a client).
  let conversations;
  if (clientSlug) {
    const client = await getVisibleClientBySlug(clientSlug);
    if (!client) return NextResponse.json({ conversations: [] });
    conversations = await db
      .select()
      .from(schema.aiConversations)
      .where(
        eq(schema.aiConversations.userId, user.id),
      )
      .orderBy(asc(schema.aiConversations.updatedAt));
    conversations = conversations.filter((c) => c.clientId === client.id).reverse();
  } else {
    conversations = await db
      .select()
      .from(schema.aiConversations)
      .where(eq(schema.aiConversations.userId, user.id))
      .orderBy(asc(schema.aiConversations.updatedAt));
    conversations = conversations.reverse();
  }
  return NextResponse.json({ conversations: conversations.slice(0, 20) });
}

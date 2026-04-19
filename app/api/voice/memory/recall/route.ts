/**
 * POST /api/voice/memory/recall
 *
 * Founder-gated voice-agent tool endpoint. Called by the browser when
 * xAI realtime emits `response.function_call_arguments.done` for the
 * `recall_memory(category, limit)` tool.
 *
 * Returns recent memory_entry rows from SpacetimeDB jettchat filtered
 * by category. SpacetimeDB's SQL dialect has no ORDER BY, so we sort
 * by `created_at` in JS and truncate to the requested limit.
 *
 * Body: { category?: string, limit?: number }
 * Default category: "conversation". Default limit: 5. Max limit: 20.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkFounderGate, STDB_URL, parseStdbRows, escapeSqlString } from "../_gate";

export async function POST(request: NextRequest) {
  const gate = checkFounderGate(request);
  if (gate) return gate;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is OK — use defaults.
  }

  const category = typeof body.category === "string" && body.category.trim()
    ? body.category.trim()
    : "conversation";
  const rawLimit = Number.isFinite(body.limit) ? body.limit : 5;
  const limit = Math.max(1, Math.min(20, rawLimit));

  const sql = `SELECT key, category, value, source, importance, created_at FROM memory_entry WHERE category = '${escapeSqlString(category)}'`;

  try {
    const r = await fetch(STDB_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: sql,
      cache: "no-store",
      // Voice pacing budget: keep the whole path under ~800ms.
      signal: AbortSignal.timeout(4000),
    });
    if (!r.ok) {
      return NextResponse.json(
        { error: `SpacetimeDB error ${r.status}`, detail: (await r.text()).slice(0, 300) },
        { status: 502 }
      );
    }
    const raw = await r.json();
    const rows = parseStdbRows(raw);

    // SpacetimeDB returns `created_at` as `{ __timestamp_micros_since_unix_epoch__: N }`.
    // Sort desc by that field, then take the top `limit`.
    const getTs = (row: Record<string, unknown>) => {
      const ca: any = row.created_at;
      const micros = ca?.__timestamp_micros_since_unix_epoch__;
      return typeof micros === "number" || typeof micros === "bigint"
        ? Number(micros)
        : 0;
    };
    rows.sort((a, b) => getTs(b) - getTs(a));
    const top = rows.slice(0, limit).map((row) => ({
      key: row.key,
      category: row.category,
      importance: row.importance,
      // value can be a large JSON-stringified blob; truncate for voice.
      value: typeof row.value === "string" ? row.value.slice(0, 800) : row.value,
      created_at_micros: getTs(row),
    }));

    return NextResponse.json({ category, count: top.length, entries: top });
  } catch (err: any) {
    const msg = err?.name === "TimeoutError" ? "memory query timeout" : (err?.message || "recall failed");
    return NextResponse.json({ error: msg }, { status: 504 });
  }
}

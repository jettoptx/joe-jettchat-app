/**
 * POST /api/voice/memory/search
 *
 * Founder-gated voice-agent tool endpoint. Called by the browser when
 * xAI realtime emits `response.function_call_arguments.done` for the
 * `search_memory(query, limit)` tool.
 *
 * SpacetimeDB's SQL has no LIKE, so we pull a bounded set of rows
 * and do substring matching + scoring in-process. Results are sorted
 * by (match-count desc, importance desc, recency desc), then trimmed
 * to the requested limit.
 *
 * Body: { query: string, limit?: number }
 * Max fetched rows for scanning: 500. Default limit: 5. Max limit: 20.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkFounderGate, STDB_URL, parseStdbRows } from "../_gate";

const SCAN_CAP = 500;

export async function POST(request: NextRequest) {
  const gate = checkFounderGate(request);
  if (gate) return gate;

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const query = (typeof body.query === "string" ? body.query : "").trim();
  if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });

  const rawLimit = Number.isFinite(body.limit) ? body.limit : 5;
  const limit = Math.max(1, Math.min(20, rawLimit));

  // Tokenize into lowercase terms; ignore 1-char tokens.
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9_:@.-]+/i)
    .filter((t) => t.length >= 2);
  if (terms.length === 0) terms.push(query.toLowerCase());

  const sql = `SELECT key, category, value, source, importance, created_at FROM memory_entry`;

  try {
    const r = await fetch(STDB_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: sql,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) {
      return NextResponse.json(
        { error: `SpacetimeDB error ${r.status}`, detail: (await r.text()).slice(0, 300) },
        { status: 502 }
      );
    }
    const raw = await r.json();
    const rows = parseStdbRows(raw).slice(0, SCAN_CAP);

    const getTs = (row: Record<string, unknown>) => {
      const ca: any = row.created_at;
      const micros = ca?.__timestamp_micros_since_unix_epoch__;
      return typeof micros === "number" || typeof micros === "bigint"
        ? Number(micros)
        : 0;
    };

    type Scored = { row: Record<string, unknown>; score: number; ts: number };
    const scored: Scored[] = [];
    for (const row of rows) {
      const haystack = (
        String(row.key || "") +
        " " +
        String(row.category || "") +
        " " +
        String(row.value || "")
      ).toLowerCase();
      let score = 0;
      for (const t of terms) {
        let idx = -1;
        while ((idx = haystack.indexOf(t, idx + 1)) !== -1) score++;
      }
      if (score > 0) {
        const importance = typeof row.importance === "number" ? row.importance : 0;
        const ts = getTs(row);
        // Composite score: matches dominate, then importance (weighted), then recency tiebreak.
        scored.push({ row, score: score * 1000 + importance * 10, ts });
      }
    }

    scored.sort((a, b) => (b.score - a.score) || (b.ts - a.ts));
    const top = scored.slice(0, limit).map(({ row, ts }) => ({
      key: row.key,
      category: row.category,
      importance: row.importance,
      value: typeof row.value === "string" ? row.value.slice(0, 800) : row.value,
      created_at_micros: ts,
    }));

    return NextResponse.json({
      query,
      terms,
      scanned: rows.length,
      count: top.length,
      entries: top,
    });
  } catch (err: any) {
    const msg = err?.name === "TimeoutError" ? "memory search timeout" : (err?.message || "search failed");
    return NextResponse.json({ error: msg }, { status: 504 });
  }
}

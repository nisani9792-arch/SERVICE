import { NextRequest, NextResponse } from "next/server";

import { requireGateAccess } from "@/lib/api-guard";

import { sql, withQueryDedup } from "@/lib/neon";

import { ensureTicketListColumns } from "@/lib/ticket-schema";

import { fetchBucketCounts, ensureTicketBucketView } from "@/lib/ticket-bucket-view";

import { getStatsCache, setStatsCache, STATS_CACHE_MS } from "@/lib/stats-cache";



export const dynamic = "force-dynamic";



function isSpamCategory(category: string): boolean {

  const c = category.trim().toLowerCase().replace(/\s+/g, "_");

  return c === "spam" || c.includes("pr/media") || c.includes("pr_media");

}



type StatsRow = {

  total: number;

  open_count: number;

  in_progress_count: number;

  closed_count: number;

  outbox_count: number;

  other_openish: number;

  pending_triage: number;

  customer_followup: number;

  pending_with_suggestion: number;

  pending_no_suggestion: number;

  high_priority_open: number;

  triage_queue_count: number;

  categories: Array<{ category: string; count: number }> | null;

};



async function fetchDashboardStatsPayload(): Promise<Record<string, unknown>> {

  await ensureTicketListColumns();

  await ensureTicketBucketView();



  const rows = await sql()`

    WITH agg AS (

      SELECT

        count(*) FILTER (WHERE deleted_at IS NULL)::int AS total,

        count(*) FILTER (WHERE deleted_at IS NULL AND status = 'open')::int AS open_count,

        count(*) FILTER (WHERE deleted_at IS NULL AND status = 'in_progress')::int AS in_progress_count,

        count(*) FILTER (

          WHERE deleted_at IS NULL AND status IN ('closed', 'handled')

        )::int AS closed_count,

        count(*) FILTER (

          WHERE deleted_at IS NULL

            AND status IN ('closed', 'handled')

            AND (

              COALESCE(tags, '{}'::text[]) && ${["REPLIED"]}::text[]

              OR (closure_note IS NOT NULL AND length(trim(closure_note)) > 10)

            )

        )::int AS outbox_count,

        count(*) FILTER (

          WHERE deleted_at IS NULL

            AND status NOT IN ('closed', 'handled', 'in_progress', 'open')

        )::int AS other_openish,

        count(*) FILTER (

          WHERE deleted_at IS NULL

            AND category = 'pending_triage'

            AND status NOT IN ('closed', 'handled')

        )::int AS pending_triage,

        count(*) FILTER (

          WHERE deleted_at IS NULL

            AND category = 'customer_followup'

            AND status NOT IN ('closed', 'handled')

        )::int AS customer_followup,

        count(*) FILTER (

          WHERE deleted_at IS NULL

            AND category = 'pending_triage'

            AND status NOT IN ('closed', 'handled')

            AND ai_suggested_category IS NOT NULL

            AND trim(ai_suggested_category) <> ''

        )::int AS pending_with_suggestion,

        count(*) FILTER (

          WHERE deleted_at IS NULL

            AND category = 'pending_triage'

            AND status NOT IN ('closed', 'handled')

            AND (ai_suggested_category IS NULL OR trim(ai_suggested_category) = '')

        )::int AS pending_no_suggestion,

        count(*) FILTER (

          WHERE deleted_at IS NULL

            AND priority >= 4

            AND status NOT IN ('closed', 'handled')

        )::int AS high_priority_open

      FROM tickets

    ),

    triage AS (

      SELECT count(*)::int AS triage_queue_count

      FROM ticket_buckets_v

      WHERE bucket_key = 'active'

        AND category IN ('pending_triage', 'customer_followup')

    ),

    cats AS (

      SELECT coalesce(

        json_agg(json_build_object('category', category, 'count', c) ORDER BY c DESC),

        '[]'::json

      ) AS categories

      FROM (

        SELECT category, count(*)::int AS c

        FROM tickets

        WHERE deleted_at IS NULL

        GROUP BY category

      ) grouped

    )

    SELECT

      agg.*,

      triage.triage_queue_count,

      cats.categories

    FROM agg, triage, cats

  `;



  const bucketCounts = await fetchBucketCounts();

  const row = rows[0] as StatsRow | undefined;



  const total = Number(row?.total ?? 0);

  const open = Number(row?.open_count ?? 0) + Number(row?.other_openish ?? 0);

  const in_progress = Number(row?.in_progress_count ?? 0);

  const closed = Number(row?.closed_count ?? 0);



  const byCategory = Array.isArray(row?.categories)

    ? row.categories.map((entry) => ({

        category: String(entry.category),

        count: Number(entry.count)

      }))

    : [];



  let spamLike = 0;

  for (const cat of byCategory) {

    if (isSpamCategory(cat.category)) {

      spamLike += cat.count;

    }

  }



  const activeCount = bucketCounts.active ?? 0;

  const handledCount = bucketCounts.handled ?? 0;

  const spamCount = bucketCounts.spam ?? spamLike;

  const outboxCount = bucketCounts.outbox ?? Number(row?.outbox_count ?? 0);

  const deletedCount = bucketCounts.deleted ?? 0;

  const pendingTriageCount = Number(row?.triage_queue_count ?? row?.pending_triage ?? 0);

  const customerFollowupCount = Number(row?.customer_followup ?? 0);

  const pendingWithSuggestion = Number(row?.pending_with_suggestion ?? 0);

  const pendingNoSuggestion = Number(row?.pending_no_suggestion ?? 0);

  const highPriorityOpen = Number(row?.high_priority_open ?? 0);



  return {

    total,

    byCategory,

    statusCounts: { open, in_progress, closed },

    openClosedRatio: { open: open + in_progress, closed },

    spamPercent: total > 0 ? Math.round((spamLike / total) * 1000) / 10 : 0,

    spamCount,

    pendingTriageCount,

    customerFollowupCount,

    pendingWithSuggestion,

    pendingNoSuggestion,

    highPriorityOpen,

    outboxCount,

    activeCount,

    handledCount,

    deletedCount,

    bucketCounts,

    _statsSig: [

      total,

      open,

      in_progress,

      closed,

      activeCount,

      handledCount,

      spamCount,

      outboxCount,

      deletedCount,

      pendingTriageCount,

      customerFollowupCount,

      pendingWithSuggestion,

      pendingNoSuggestion,

      highPriorityOpen

    ].join("|")

  };

}



export async function GET(request: NextRequest) {

  const denied = await requireGateAccess(request);

  if (denied) return denied;



  try {

    const bypassCache = request.headers.get("x-service-live") === "true";

    const now = Date.now();

    const cached = getStatsCache();

    if (!bypassCache && cached && now - cached.at < STATS_CACHE_MS) {

      return NextResponse.json(cached.payload, {

        headers: { "Cache-Control": "no-store" }

      });

    }



    const payload = await withQueryDedup("dashboard-stats", fetchDashboardStatsPayload);



    setStatsCache(payload);

    return NextResponse.json(payload, {

      headers: { "Cache-Control": "no-store" }

    });

  } catch (error) {

    return NextResponse.json(

      { error: "stats failed", details: error instanceof Error ? error.message : "Unknown" },

      { status: 500 }

    );

  }

}


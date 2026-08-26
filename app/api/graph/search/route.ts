import { NextResponse } from "next/server";
import { searchNodes } from "@/services/graph.service";
import { classifyLead } from "@/services/graph.service";
import { getDb } from "@/lib/db";
import { TABLES } from "@/lib/definitions";

export const dynamic = "force-dynamic";

export async function GET(_request: Request) {
  const url = new URL(_request.url);
  const q = url.searchParams.get("q") ?? "";

  if (!q.trim()) {
    return NextResponse.json({ results: [] });
  }

  const results = searchNodes(q);
  const db = getDb();

  const enriched = await Promise.all(
    results.map(async (result) => {
      if (result.type === "lead") {
        const row = db
          .prepare(
            `WITH deduped_leads AS (
              SELECT id, MAX(full_name) AS full_name, MAX(establishment_id) AS establishment_id, MAX(notes) AS notes
              FROM ${TABLES.leads}
              WHERE id = ? AND deleted_at IS NULL AND merged_into_id IS NULL
              GROUP BY id
            ),
            deduped_establishments AS (
              SELECT id, MAX(name) AS name, MAX(industry_id) AS industry_id
              FROM ${TABLES.customers}
              GROUP BY id
            ),
            deduped_industries AS (
              SELECT id, MAX(label) AS label
              FROM ${TABLES.industries}
              GROUP BY id
            )
            SELECT dl.id, dl.full_name, dl.notes, COALESCE(e.name, '') AS company_name, e.industry_id, i.label AS industry_label
            FROM deduped_leads dl
            LEFT JOIN deduped_establishments e ON e.id = dl.establishment_id
            LEFT JOIN deduped_industries i ON i.id = e.industry_id
            LIMIT 1`
          )
          .get(result.id) as { id: string; full_name: string | null; notes: string | null; company_name: string; industry_id: string | null; industry_label: string | null } | undefined;

        if (row) {
          const categoryId = classifyLead({
            id: row.id,
            full_name: row.full_name,
            establishment_id: null,
            industry_id: row.industry_id,
            industry_label: row.industry_label,
            company_name: row.company_name || null,
            notes: row.notes,
          });
          return { ...result, categoryId };
        }
      }
      return result;
    })
  );

  return NextResponse.json({ results: enriched });
}

import { type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { getMatrix } from "@/lib/queries";
import { rangeFor, isRangePreset, type RangePreset } from "@/lib/dates";

// GET /admin/export?range=all — the 座號 × 科別 矩陣 as an .xlsx download.
// Gated by proxy.ts (path starts with /admin).
export async function GET(req: NextRequest) {
  const rangeParam = req.nextUrl.searchParams.get("range") ?? "";
  const preset: RangePreset = isRangePreset(rangeParam) ? rangeParam : "all";
  const today = new Date().toISOString().slice(0, 10);
  const { start, end } = rangeFor(preset, today);
  const matrix = await getMatrix(start, end);

  const header = ["座號", ...matrix.subjects, "未交合計"];
  const body = matrix.rows.map((row) => [
    row.seat,
    ...matrix.subjects.map((s) => row.counts[s] ?? 0),
    row.total,
  ]);
  const footer = ["合計", ...matrix.subjects.map((s) => matrix.colTotals[s] ?? 0), matrix.grandTotal];

  const ws = XLSX.utils.aoa_to_sheet([header, ...body, footer]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "未交彙整");
  const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  // ASCII only — HTTP header values are Latin1, so no Chinese in the filename.
  const tag = preset === "all" ? "all" : `${start}_${end}`;
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="homework-${tag}.xlsx"`,
    },
  });
}

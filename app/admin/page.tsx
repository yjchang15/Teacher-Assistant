import Link from "next/link";
import { getMatrix } from "@/lib/queries";
import { rangeFor, isRangePreset, RANGE_LABELS, type RangePreset } from "@/lib/dates";

export const dynamic = "force-dynamic";

export const metadata = { title: "彙整 - Teacher Assistant" };

const PRESETS: RangePreset[] = ["today", "week", "month", "all"];

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const preset: RangePreset = isRangePreset(sp.range ?? "") ? (sp.range as RangePreset) : "all";
  const sortByTotal = sp.sort === "total";
  const today = new Date().toISOString().slice(0, 10);
  const { start, end } = rangeFor(preset, today);

  const matrix = await getMatrix(start, end);
  const rows = sortByTotal
    ? [...matrix.rows].sort((a, b) => b.total - a.total || a.seat - b.seat)
    : matrix.rows;

  const rangeText = preset === "all" ? "全部" : `${start} ~ ${end}`;
  const qs = (extra: Record<string, string>) =>
    "?" + new URLSearchParams({ range: preset, ...(sortByTotal ? { sort: "total" } : {}), ...extra }).toString();

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
        <h5 className="fw-bold mb-0">
          <i className="bi bi-grid-3x3-gap me-2 text-primary"></i>未交彙整（座號 × 科別）
        </h5>
        <a className="btn btn-success btn-sm" href={`/admin/export${qs({})}`}>
          <i className="bi bi-file-earmark-excel me-1"></i>匯出 Excel
        </a>
      </div>

      {/* 時間範圍 */}
      <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
        <span className="text-muted small">範圍：</span>
        <div className="btn-group btn-group-sm">
          {PRESETS.map((p) => (
            <Link
              key={p}
              href={`/admin?range=${p}${sortByTotal ? "&sort=total" : ""}`}
              className={`btn ${p === preset ? "btn-primary" : "btn-outline-primary"}`}
            >
              {RANGE_LABELS[p]}
            </Link>
          ))}
        </div>
        <span className="text-muted small">{rangeText}</span>
        <span className="ms-auto text-muted small">
          僅計「仍未交」，已補交不計｜合計 <span className="fw-bold text-danger">{matrix.grandTotal}</span>
        </span>
      </div>

      <div className="table-responsive">
        <table className="table table-bordered table-hover align-middle text-center mb-0" style={{ minWidth: 720 }}>
          <thead className="table-light">
            <tr>
              <th style={{ width: 72 }}>座號</th>
              {matrix.subjects.map((s) => (
                <th key={s}>{s}</th>
              ))}
              <th style={{ width: 96 }}>
                <Link href={`/admin${qs({ sort: sortByTotal ? "" : "total" })}`} className="text-decoration-none">
                  未交合計 {sortByTotal ? <i className="bi bi-sort-down"></i> : <i className="bi bi-arrow-down-up small"></i>}
                </Link>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.seat} className={row.total === 0 ? "text-muted" : undefined}>
                <td className="fw-semibold">{row.seat}</td>
                {matrix.subjects.map((s) => {
                  const n = row.counts[s] ?? 0;
                  return (
                    <td key={s} className={n > 0 ? "text-danger fw-semibold" : "text-muted"}>
                      {n > 0 ? n : "·"}
                    </td>
                  );
                })}
                <td className={`fw-bold ${row.total > 0 ? "text-danger" : "text-muted"}`}>{row.total || "·"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="table-secondary fw-bold">
            <tr>
              <td>合計</td>
              {matrix.subjects.map((s) => (
                <td key={s}>{matrix.colTotals[s] || "·"}</td>
              ))}
              <td className="text-danger">{matrix.grandTotal || "·"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

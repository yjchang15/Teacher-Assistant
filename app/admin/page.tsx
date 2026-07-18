import Link from "next/link";
import { getMatrix } from "@/lib/queries";
import { rangeFor, isRangePreset, RANGE_LABELS, type RangePreset } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const metadata = { title: "未交統計 - Teacher Assistant" };
const PRESETS: RangePreset[] = ["today", "week", "month", "all"];

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ range?: string; sort?: string }> }) {
  const sp = await searchParams;
  const preset: RangePreset = isRangePreset(sp.range ?? "") ? (sp.range as RangePreset) : "all";
  const sortByTotal = sp.sort === "total";
  const today = new Date().toISOString().slice(0, 10);
  const { start, end } = rangeFor(preset, today);
  const matrix = await getMatrix(start, end);
  const rows = sortByTotal ? [...matrix.rows].sort((a, b) => b.total - a.total || a.seat - b.seat) : matrix.rows;
  const rangeText = preset === "all" ? "全部紀錄" : `${start} ～ ${end}`;
  const qs = (extra: Record<string, string>) => "?" + new URLSearchParams({ range: preset, ...(sortByTotal ? { sort: "total" } : {}), ...extra }).toString();

  return (
    <main>
      <header className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-4">
        <div><span className="eyebrow">老師統計</span><h1 className="h3 fw-bold mt-1 mb-1">未交作業統計</h1><p className="text-body-secondary mb-0">快速查看各座號與科目的未交次數。</p></div>
        <a className="btn btn-success" href={`/admin/export${qs({})}`}><i className="bi bi-file-earmark-excel me-2" />匯出 Excel</a>
      </header>
      <section className="card workflow-card mb-3"><div className="card-body d-flex align-items-center gap-3 flex-wrap">
        <span className="fw-semibold">統計期間</span><div className="btn-group" role="group" aria-label="統計期間">{PRESETS.map((p) => <Link key={p} href={`/admin?range=${p}${sortByTotal ? "&sort=total" : ""}`} className={`btn ${p === preset ? "btn-primary" : "btn-outline-primary"}`}>{RANGE_LABELS[p]}</Link>)}</div><span className="text-body-secondary small">{rangeText}</span>
        <div className="ms-auto text-end"><div className="small text-body-secondary">目前未交總數</div><div className="h4 fw-bold text-danger mb-0">{matrix.grandTotal}</div></div>
      </div></section>
      <div className="table-responsive rounded-4 border"><table className="table table-bordered table-hover align-middle text-center mb-0" style={{ minWidth: 720 }}>
        <thead><tr><th style={{ width: 72 }}>座號</th>{matrix.subjects.map((s) => <th key={s}>{s}</th>)}<th style={{ width: 110 }}><Link href={`/admin${qs({ sort: sortByTotal ? "" : "total" })}`} className="text-decoration-none">未交合計 <i className={`bi ${sortByTotal ? "bi-sort-down" : "bi-arrow-down-up"}`} /></Link></th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.seat} className={row.total === 0 ? "opacity-50" : undefined}><td className="fw-bold">{row.seat}</td>{matrix.subjects.map((s) => { const n = row.counts[s] ?? 0; return <td key={s} className={n ? "text-danger fw-bold" : "text-body-secondary"}>{n || "—"}</td>; })}<td className={row.total ? "text-danger fw-bold" : "text-body-secondary"}>{row.total || "—"}</td></tr>)}</tbody>
        <tfoot className="table-secondary fw-bold"><tr><td>合計</td>{matrix.subjects.map((s) => <td key={s}>{matrix.colTotals[s] || "—"}</td>)}<td className="text-danger">{matrix.grandTotal || "—"}</td></tr></tfoot>
      </table></div>
    </main>
  );
}

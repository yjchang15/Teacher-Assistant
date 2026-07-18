import Link from "next/link";
import { getMatrix } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "未交作業統計 - Teacher Assistant" };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function todayInTaipei() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string; sort?: string }>;
}) {
  const sp = await searchParams;
  const today = todayInTaipei();
  const rawStart = ISO_DATE.test(sp.start ?? "") ? sp.start! : today;
  const rawEnd = ISO_DATE.test(sp.end ?? "") ? sp.end! : today;
  const start = rawStart <= rawEnd ? rawStart : rawEnd;
  const end = rawStart <= rawEnd ? rawEnd : rawStart;
  const sortByTotal = sp.sort === "total";
  const matrix = await getMatrix(start, end);
  const nonEmptyRows = matrix.rows.filter((row) => row.total > 0);
  const rows = sortByTotal
    ? [...nonEmptyRows].sort((a, b) => b.total - a.total || a.seat - b.seat)
    : nonEmptyRows;
  const query = (extra: Record<string, string>) =>
    "?" + new URLSearchParams({ start, end, ...(sortByTotal ? { sort: "total" } : {}), ...extra }).toString();

  return (
    <main>
      <header className="d-flex justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">未交作業統計</h1>
          <p className="text-body-secondary mb-0">只顯示選定期間內有未交作業的座號。</p>
        </div>
        <a className="btn btn-success" href={`/admin/export${query({})}`}>
          <i className="bi bi-file-earmark-excel me-2" />匯出 Excel
        </a>
      </header>

      <section className="card workflow-card mb-3">
        <div className="card-body d-flex align-items-end gap-3">
          <form method="get" className="admin-date-range d-flex align-items-end gap-3">
            <div>
              <label className="form-label fw-semibold small" htmlFor="start">起始日期</label>
              <input id="start" className="form-control" type="date" name="start" defaultValue={start} />
            </div>
            <span className="date-range-separator">至</span>
            <div>
              <label className="form-label fw-semibold small" htmlFor="end">結束日期</label>
              <input id="end" className="form-control" type="date" name="end" defaultValue={end} />
            </div>
            {sortByTotal && <input type="hidden" name="sort" value="total" />}
            <button className="btn btn-primary" type="submit"><i className="bi bi-search me-2" />查詢</button>
          </form>
          <div className="ms-auto d-flex gap-4 text-end">
            <div><div className="small text-body-secondary">有未交座號</div><div className="h4 fw-bold mb-0">{rows.length}</div></div>
            <div><div className="small text-body-secondary">未交總數</div><div className="h4 fw-bold text-danger mb-0">{matrix.grandTotal}</div></div>
          </div>
        </div>
      </section>

      <div className="table-responsive rounded-4 border">
        <table className="table table-bordered table-hover align-middle text-center mb-0" style={{ minWidth: 720 }}>
          <thead><tr>
            <th style={{ width: 72 }}>座號</th>
            {matrix.subjects.map((subject) => <th key={subject}>{subject}</th>)}
            <th style={{ width: 110 }}>
              <Link href={`/admin${query({ sort: sortByTotal ? "" : "total" })}`} className="text-decoration-none">
                未交合計 <i className={`bi ${sortByTotal ? "bi-sort-down" : "bi-arrow-down-up"}`} />
              </Link>
            </th>
          </tr></thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={matrix.subjects.length + 2} className="py-5 text-body-secondary"><i className="bi bi-check-circle me-2 text-success" />此期間沒有未交作業</td></tr>
            ) : rows.map((row) => (
              <tr key={row.seat}>
                <td className="fw-bold">{row.seat}</td>
                {matrix.subjects.map((subject) => {
                  const count = row.counts[subject] ?? 0;
                  return <td key={subject} className={count ? "text-danger fw-bold" : "text-body-secondary"}>{count || "—"}</td>;
                })}
                <td className="text-danger fw-bold">{row.total}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="table-secondary fw-bold"><tr>
            <td>合計</td>
            {matrix.subjects.map((subject) => <td key={subject}>{matrix.colTotals[subject] || "—"}</td>)}
            <td className="text-danger">{matrix.grandTotal || "—"}</td>
          </tr></tfoot>
        </table>
      </div>
    </main>
  );
}

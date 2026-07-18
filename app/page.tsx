import { getSubjects, getDayRecords, SEAT_COUNT } from "@/lib/queries";
import { logRecords, markLate, reopenRecord, removeRecord } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; subject?: string }>;
}) {
  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const subjects = await getSubjects();

  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;
  const subject = subjects.some((s) => s.name === sp.subject)
    ? sp.subject!
    : (subjects[0]?.name ?? "");

  const dayRecords = subject ? await getDayRecords(date, subject) : [];
  const loggedSeats = new Set(dayRecords.map((r) => r.seat));

  return (
    <div style={{ maxWidth: 760 }}>
      <h5 className="fw-bold mb-1">
        <i className="bi bi-journal-x me-2 text-primary"></i>作業未交登記
      </h5>
      <p className="text-muted small mb-3">選日期與科別，勾選未交作業的座號後送出。小老師免登入。</p>

      {/* 選日期 / 科別（以 GET 更新畫面）*/}
      <form method="get" className="row g-2 align-items-end mb-3">
        <div className="col-auto">
          <label className="form-label fw-semibold small mb-1">日期</label>
          <input type="date" name="date" className="form-control" defaultValue={date} />
        </div>
        <div className="col-auto">
          <label className="form-label fw-semibold small mb-1">科別</label>
          <select name="subject" className="form-select" defaultValue={subject}>
            {subjects.map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </div>
        <div className="col-auto">
          <button className="btn btn-outline-secondary" type="submit">
            <i className="bi bi-arrow-repeat me-1"></i>切換
          </button>
        </div>
      </form>

      {/* 勾選座號登記未交 */}
      <div className="card p-3 mb-4">
        <form action={logRecords}>
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="subject" value={subject} />
          <div className="fw-semibold small mb-2">
            勾選未交座號（{date}・{subject}）<span className="text-muted">— 已登記者標記於下方</span>
          </div>
          <div className="d-flex flex-wrap gap-2 mb-3">
            {Array.from({ length: SEAT_COUNT }, (_, k) => k + 1).map((seat) => {
              const already = loggedSeats.has(seat);
              return (
                <label
                  key={seat}
                  className={`btn btn-sm ${already ? "btn-secondary disabled" : "btn-outline-primary"}`}
                  style={{ width: 52 }}
                  title={already ? "已登記" : undefined}
                >
                  <input type="checkbox" name="seats" value={seat} className="d-none" disabled={already} />
                  {seat}
                </label>
              );
            })}
          </div>
          <button className="btn btn-primary" type="submit">
            <i className="bi bi-check2-square me-1"></i>登記未交
          </button>
        </form>
      </div>

      {/* 當日該科已登記名單 */}
      <h6 className="fw-bold mb-2">已登記名單（{date}・{subject}）</h6>
      {dayRecords.length === 0 ? (
        <div className="text-center text-muted py-3">尚無登記</div>
      ) : (
        <ul className="list-group">
          {dayRecords.map((r) => (
            <li key={r.id} className="list-group-item d-flex justify-content-between align-items-center">
              <span>
                <span className="fw-semibold">座號 {r.seat}</span>
                {r.status === "late" ? (
                  <span className="badge text-bg-success ms-2">已補交</span>
                ) : (
                  <span className="badge text-bg-danger ms-2">未交</span>
                )}
              </span>
              <span className="d-flex gap-1">
                {r.status === "open" ? (
                  <form action={markLate}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="btn btn-outline-success btn-sm" title="標記已補交" type="submit">
                      <i className="bi bi-check-lg"></i>
                    </button>
                  </form>
                ) : (
                  <form action={reopenRecord}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="btn btn-outline-secondary btn-sm" title="改回未交" type="submit">
                      <i className="bi bi-arrow-counterclockwise"></i>
                    </button>
                  </form>
                )}
                <form action={removeRecord}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="btn btn-outline-danger btn-sm" title="取消（刪除）" type="submit">
                    <i className="bi bi-trash"></i>
                  </button>
                </form>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

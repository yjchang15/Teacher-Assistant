import { getSubjects, getDayRecords, SEAT_COUNT } from "@/lib/queries";
import { logRecords, markLate, reopenRecord, removeRecord } from "@/app/actions";
import SeatSelector from "@/components/SeatSelector";

export const dynamic = "force-dynamic";

export default async function LogPage({ searchParams }: { searchParams: Promise<{ date?: string; subject?: string }> }) {
  const sp = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const subjects = await getSubjects();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;
  const subject = subjects.some((item) => item.name === sp.subject) ? sp.subject! : (subjects[0]?.name ?? "");
  const records = subject ? await getDayRecords(date, subject) : [];
  const openCount = records.filter((record) => record.status === "open").length;

  return (
    <main className="student-workflow mx-auto">
      <header className="mb-4">
        <span className="eyebrow">小老師工作台</span>
        <h1 className="h3 fw-bold mt-1 mb-1">登記未交作業</h1>
        <p className="text-body-secondary mb-0">選好日期與科目，再點選未交同學的座號。</p>
      </header>

      <section className="card workflow-card mb-3" aria-labelledby="step-one">
        <div className="card-body">
          <div className="step-heading" id="step-one"><span>1</span>確認課程</div>
          <form method="get" className="row g-3 align-items-end">
            <div className="col-12 col-sm-6">
              <label className="form-label fw-semibold" htmlFor="date">日期</label>
              <input id="date" type="date" name="date" className="form-control form-control-lg" defaultValue={date} />
            </div>
            <div className="col-12 col-sm-6">
              <label className="form-label fw-semibold" htmlFor="subject">科目</label>
              <select id="subject" name="subject" className="form-select form-select-lg" defaultValue={subject}>
                {subjects.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
              </select>
            </div>
            <div className="col-12">
              <button className="btn btn-outline-primary w-100" type="submit"><i className="bi bi-arrow-repeat me-2" />更新名單</button>
            </div>
          </form>
        </div>
      </section>

      <section className="card workflow-card mb-4" aria-labelledby="step-two">
        <div className="card-body">
          <div className="step-heading" id="step-two"><span>2</span>選擇座號</div>
          {subject ? <SeatSelector date={date} subject={subject} seatCount={SEAT_COUNT} loggedSeats={records.map((r) => r.seat)} action={logRecords} /> : <div className="alert alert-warning mb-0">目前沒有科目，請請老師先完成設定。</div>}
        </div>
      </section>

      <section aria-labelledby="today-records">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h2 className="h5 fw-bold mb-0" id="today-records">今日登記</h2>
          <span className={`badge ${openCount ? "text-bg-danger" : "text-bg-secondary"}`}>{openCount} 位未交</span>
        </div>
        {records.length === 0 ? (
          <div className="empty-state"><i className="bi bi-clipboard-check" /><strong>尚無登記</strong><span>完成登記後會顯示在這裡</span></div>
        ) : (
          <div className="record-list">
            {records.map((record) => (
              <article key={record.id} className="record-item">
                <div className="record-seat">{record.seat}</div>
                <div className="flex-grow-1"><div className="fw-bold">{record.seat} 號</div><span className={`status-label ${record.status === "late" ? "resolved" : "open"}`}>{record.status === "late" ? "已補交" : "尚未繳交"}</span></div>
                <div className="d-flex gap-2">
                  {record.status === "open" ? (
                    <form action={markLate}><input type="hidden" name="id" value={record.id} /><button className="btn btn-success" title="標記為已補交" type="submit"><i className="bi bi-check-lg" /><span className="d-none d-sm-inline ms-1">已補交</span></button></form>
                  ) : (
                    <form action={reopenRecord}><input type="hidden" name="id" value={record.id} /><button className="btn btn-outline-secondary" title="改回未交" type="submit"><i className="bi bi-arrow-counterclockwise" /></button></form>
                  )}
                  <form action={removeRecord}><input type="hidden" name="id" value={record.id} /><button className="btn btn-outline-danger" title="刪除這筆登記" type="submit"><i className="bi bi-trash" /></button></form>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

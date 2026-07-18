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
  const resolvedCount = records.length - openCount;

  return (
    <main className="desktop-dashboard">
      <header className="page-header">
        <div><span className="eyebrow">HOMEWORK REGISTER</span><h1>作業登記工作台</h1><p>選擇課程後，直接點選未交作業的學生座號。</p></div>
        <div className="summary-strip"><div><span>科目</span><strong>{subject || "—"}</strong></div><div><span>未交</span><strong className="text-danger">{openCount}</strong></div><div><span>已補交</span><strong className="text-success">{resolvedCount}</strong></div></div>
      </header>

      <div className="dashboard-grid dashboard-grid-single">
        <section className="workspace-panel">
          <div className="panel-header"><div><span className="panel-kicker">01 / 課程資訊</span><h2>選擇日期與科目</h2></div></div>
          <form method="get" className="course-toolbar">
            <div><label htmlFor="date">日期</label><input id="date" type="date" name="date" className="form-control" defaultValue={date} /></div>
            <div><label htmlFor="subject">科目</label><select id="subject" name="subject" className="form-select" defaultValue={subject}>{subjects.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></div>
            <button className="btn btn-primary" type="submit"><i className="bi bi-arrow-repeat me-2" />套用</button>
          </form>

          <div className="panel-divider" />
          <div className="panel-header"><div><span className="panel-kicker">02 / 座號登記</span><h2>選擇未交學生</h2></div><div className="d-flex gap-3"><span className="legend legend-open"><i />未交</span><span className="legend legend-resolved"><i />已補交</span></div></div>
          {subject ? <SeatSelector date={date} subject={subject} seatCount={SEAT_COUNT} records={records.map(({ id, seat, status }) => ({ id, seat, status }))} action={logRecords} markLateAction={markLate} reopenAction={reopenRecord} removeAction={removeRecord} /> : <div className="alert alert-warning mb-0">目前沒有科目，請先完成科目設定。</div>}
        </section>
      </div>
    </main>
  );
}

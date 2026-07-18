import { getSubjects, getDayRecords, SEAT_COUNT } from "@/lib/queries";
import { logRecords, markLate, reopenRecord, removeRecord, undoDeleteRecord } from "@/app/actions";
import SeatSelector from "@/components/SeatSelector";
import CourseSelector from "@/components/CourseSelector";

export const dynamic = "force-dynamic";

function todayInTaipei() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function LogPage({ searchParams }: { searchParams: Promise<{ date?: string; subject?: string; deletedSeat?: string; deletedStatus?: string }> }) {
  const sp = await searchParams;
  const today = todayInTaipei();
  const subjects = await getSubjects();
  const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;
  const date = requestedDate <= today ? requestedDate : today;
  const subject = subjects.some((item) => item.name === sp.subject) ? sp.subject! : "";
  const records = subject ? await getDayRecords(date, subject) : [];
  const openCount = records.filter((record) => record.status === "open").length;
  const resolvedCount = records.length - openCount;

  return (
    <main className="desktop-dashboard">
      <header className="page-header"><div><h1>作業登記工作台</h1><p>選擇課程後，直接點選未交作業的學生座號。</p></div></header>

      {sp.deletedSeat && (
        <div className="undo-toast" role="status">
          <span><i className="bi bi-trash3 me-2" />已刪除 {sp.deletedSeat} 號的紀錄</span>
          <form action={undoDeleteRecord}>
            <input type="hidden" name="date" value={date} /><input type="hidden" name="subject" value={subject} />
            <input type="hidden" name="seat" value={sp.deletedSeat} /><input type="hidden" name="status" value={sp.deletedStatus ?? "open"} />
            <button type="submit">復原</button>
          </form>
        </div>
      )}

      <div className="dashboard-grid dashboard-grid-single">
        <section className="workspace-panel">
          <div className="panel-header course-panel-header"><div><span className="panel-kicker">01 / 課程資訊</span><h2>選擇日期與科目</h2></div><div className="inline-summary"><span>{subject || "—"}</span><span className="is-open">未交 <strong>{openCount}</strong></span><span className="is-resolved">已補交 <strong>{resolvedCount}</strong></span></div></div>
          <CourseSelector date={date} subject={subject} subjects={subjects.map(({ id, name }) => ({ id, name }))} maxDate={today} />

          <div className="panel-divider" />
          <div className="panel-header"><div><span className="panel-kicker">02 / 座號登記</span><h2>點選本次未交座號</h2></div></div>
          {subject ? (
            <SeatSelector date={date} subject={subject} seatCount={SEAT_COUNT} records={records.map(({ id, seat, status }) => ({ id, seat, status }))} action={logRecords} markLateAction={markLate} reopenAction={reopenRecord} removeAction={removeRecord} />
          ) : subjects.length === 0 ? (
            <div className="alert alert-warning mb-0">目前沒有科目，請先完成科目設定。</div>
          ) : (
            <div className="subject-required-state"><i className="bi bi-hand-index-thumb" /><strong>請先選擇科目</strong><span>點選上方科目後，才會顯示座號與作業紀錄。</span></div>
          )}
        </section>
      </div>
    </main>
  );
}

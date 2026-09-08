import { getClasses, getClassSubmissionProgress } from "@/lib/queries";
import { markSeatSubmitted, restoreMissingSeat } from "@/app/actions";
import { RegistrationContextSelector } from "@/components/AssignmentWorkspaceSelector";
import SubmissionProgressBoard from "@/components/SubmissionProgressBoard";

export const dynamic = "force-dynamic";
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
function todayInTaipei() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export default async function SubmissionProgressPage({ searchParams }: { searchParams: Promise<{ date?: string; classId?: string }> }) {
  const sp = await searchParams;
  const today = todayInTaipei();
  const date = ISO_DATE.test(sp.date ?? "") && sp.date! <= today ? sp.date! : today;
  const classes = await getClasses();
  const selectedClass = classes.find((item) => item.id === Number(sp.classId)) ?? classes[0];
  const classId = selectedClass?.id ?? 0;
  const headcount = selectedClass?.seats.length ?? 0;
  const items = await getClassSubmissionProgress(classId, date);
  const missingTotal = items.reduce((sum, item) => sum + item.missing_seats.length, 0);
  const doneItems = items.filter((item) => !item.missing_seats.length).length;

  return (
    <main className="desktop-dashboard">
      <header className="page-header">
        <div>
          <h1>繳交進度</h1>
          <p>看當天每個作業項目交齊了沒。學生補交後點一下座號，缺交紀錄就會移除。</p>
        </div>
        <div className="registration-context-bar">
          <RegistrationContextSelector date={date} maxDate={today} classId={classId} classes={classes.map(({ id, name }) => ({ id, name }))} />
        </div>
      </header>

      {classId > 0 && items.length > 0 && (
        <section className="progress-overview" aria-label="當天概況">
          <div><strong>{items.length}</strong><span>作業項目</span></div>
          <div><strong className={doneItems === items.length ? "text-success" : undefined}>{doneItems}</strong><span>已全數繳交</span></div>
          <div><strong className={missingTotal ? "text-danger" : "text-success"}>{missingTotal}</strong><span>缺交人次</span></div>
          <div><strong>{headcount}</strong><span>{selectedClass?.name} 人數</span></div>
        </section>
      )}

      {classId <= 0 ? (
        <div className="empty-state"><i className="bi bi-mortarboard" /><strong>還沒有班級</strong><span>請先到「班級與座號」建立班級。</span></div>
      ) : items.length === 0 ? (
        <div className="empty-state"><i className="bi bi-calendar-check" /><strong>{date.replaceAll("-", "/")} 沒有作業項目</strong><span>到「作業登記」新增項目後就會出現在這裡。</span></div>
      ) : (
        <SubmissionProgressBoard
          key={`${classId}-${date}`}
          className={selectedClass?.name ?? ""}
          headcount={headcount}
          items={items.map((item) => ({ id: item.assignment_id, title: item.title, description: item.description, missingSeats: item.missing_seats }))}
          submitAction={markSeatSubmitted}
          restoreAction={restoreMissingSeat}
        />
      )}
    </main>
  );
}

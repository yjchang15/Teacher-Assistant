import { DEFAULT_JUNIOR_HIGH_ASSIGNMENTS, getClasses, getAssignments, getMissingSeats } from "@/lib/queries";
import { addClass, addAssignment, editAssignmentDescription, toggleAssignmentSeat } from "@/app/actions";
import AssignmentWorkspaceSelector from "@/components/AssignmentWorkspaceSelector";
import DoubleClickSeatGrid from "@/components/DoubleClickSeatGrid";

export const dynamic = "force-dynamic";

function todayInTaipei() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; classId?: string; assignmentId?: string }>;
}) {
  const sp = await searchParams;
  const today = todayInTaipei();
  const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;
  const date = requestedDate <= today ? requestedDate : today;
  const classes = await getClasses();
  const requestedClassId = Number(sp.classId);
  const selectedClass = classes.find((item) => item.id === requestedClassId);
  const classId = selectedClass?.id ?? 0;
  const assignments = classId ? await getAssignments(classId, date) : [];
  const requestedAssignmentId = Number(sp.assignmentId);
  const selectedAssignment = assignments.find((item) => item.id === requestedAssignmentId);
  const assignmentId = selectedAssignment?.id ?? 0;
  const missingSeats = assignmentId ? await getMissingSeats(assignmentId) : [];
  const assignmentContentLabel = selectedAssignment
    ? `${selectedAssignment.title}${DEFAULT_JUNIOR_HIGH_ASSIGNMENTS.includes(selectedAssignment.title as typeof DEFAULT_JUNIOR_HIGH_ASSIGNMENTS[number]) ? "科" : ""} 作業內容`
    : "";

  return (
    <main className="desktop-dashboard">
      <header className="page-header">
        <div><h1>作業登記工作台</h1><p>選擇班級與作業項目，雙擊座號即可切換缺交狀態。</p></div>
        <details className="create-popover"><summary className="btn btn-outline-primary"><i className="bi bi-plus-lg me-2" />新增班級</summary><form action={addClass}>
          <label htmlFor="class-name">班級名稱</label><input id="class-name" className="form-control" name="name" placeholder="例如：七年一班" required maxLength={30} />
          <label htmlFor="seat-count">座號人數</label><input id="seat-count" className="form-control" name="seatCount" type="number" min="1" max="60" defaultValue="32" required />
          <button className="btn btn-primary w-100" type="submit">建立班級</button>
        </form></details>
      </header>

      <section className="workspace-panel">
        <div className="panel-header course-panel-header">
          <h2>作業項目</h2>
          {classId > 0 && <details className="assignment-create-popover">
            <summary className="btn btn-outline-primary btn-sm"><i className="bi bi-plus-lg me-2" />新增項目</summary>
            <form action={addAssignment}>
              <div className="assignment-create-heading"><strong>新增作業項目</strong><span>{selectedClass?.name} · {date.replaceAll("-", "/")}</span></div>
              <input type="hidden" name="classId" value={classId} /><input type="hidden" name="date" value={date} />
              <div><label htmlFor="assignment-title">項目名稱</label><input id="assignment-title" className="form-control" name="title" placeholder="例如：健康檢查回條" required maxLength={50} /></div>
              <div className="assignment-create-actions"><button className="btn btn-primary" type="submit"><i className="bi bi-plus-lg me-2" />建立項目</button></div>
            </form>
          </details>}
        </div>
        <AssignmentWorkspaceSelector date={date} maxDate={today} classId={classId} assignmentId={assignmentId} classes={classes.map(({ id, name }) => ({ id, name }))} assignments={assignments.map(({ id, title }) => ({ id, title }))} />

        <div className="panel-divider" />
        <div className="panel-header register-panel-header"><h2>{selectedAssignment ? "缺交登記" : "請選擇作業項目"}</h2>{selectedAssignment && <span className="missing-count">缺交 {missingSeats.length} 人</span>}</div>

        {selectedAssignment ? <>
          <div className="assignment-description">
            <form className="assignment-description-form" action={editAssignmentDescription}>
              <label htmlFor="active-assignment-description">{assignmentContentLabel}</label>
              <input type="hidden" name="assignmentId" value={assignmentId} /><input type="hidden" name="classId" value={classId} /><input type="hidden" name="date" value={date} />
              <textarea id="active-assignment-description" className="form-control" name="description" defaultValue={selectedAssignment.description} placeholder="直接輸入今天的作業內容…" rows={2} maxLength={500} />
              <button className="btn btn-primary btn-sm" type="submit"><i className="bi bi-check-lg me-1" />儲存</button>
            </form>
          </div>
          <div className="double-click-hint"><i className="bi bi-mouse2 me-2" />雙擊座號切換缺交</div>
          <DoubleClickSeatGrid key={assignmentId} assignmentId={assignmentId} seatCount={selectedClass?.seat_count ?? 32} missingSeats={missingSeats} action={toggleAssignmentSeat} />
        </> : (
          <div className="subject-required-state"><i className="bi bi-hand-index-thumb" /><strong>{classId ? "請選擇或新增作業項目" : "請先選擇班級"}</strong><span>完成選擇後才會顯示座號。</span></div>
        )}
      </section>
    </main>
  );
}

import { getClasses, getAssignments, getMissingSeats, getStudents } from "@/lib/queries";
import { addAssignment, deleteAssignment, editAssignmentDescription, renameAssignment, toggleAssignmentSeat } from "@/app/actions";
import AssignmentWorkspaceSelector, { RegistrationContextSelector } from "@/components/AssignmentWorkspaceSelector";
import DoubleClickSeatGrid from "@/components/DoubleClickSeatGrid";
import AssignmentDescriptionEditor from "@/components/AssignmentDescriptionEditor";
import { requireAccount } from "@/lib/session";

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
  await requireAccount();
  const today = todayInTaipei();
  const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;
  const date = requestedDate <= today ? requestedDate : today;
  const classes = await getClasses();
  const selectedClass = classes.find((item) => item.id === Number(sp.classId)) ?? classes[0];
  const classId = selectedClass?.id ?? 0;
  const assignments = classId ? await getAssignments(classId, date) : [];
  const selectedAssignment = assignments.find((item) => item.id === Number(sp.assignmentId));
  const assignmentId = selectedAssignment?.id ?? 0;
  const missingSeats = assignmentId ? await getMissingSeats(assignmentId) : [];
  const seats = (await getStudents(classId)).filter((student) => student.active).map((student) => student.seat);

  return (
    <main className="desktop-dashboard">
      <header className="page-header">
        <div><h1>作業登記工作台</h1><p>選擇班級與作業項目，點選座號即可切換缺交狀態。</p></div>
        <div className="registration-context-bar">
          <RegistrationContextSelector date={date} maxDate={today} classId={classId} classes={classes.map(({ id, name }) => ({ id, name }))} />
        </div>
      </header>

      <section className="workspace-panel">
        <div className="panel-header course-panel-header">
          <h2>作業項目</h2>
        </div>
        <AssignmentWorkspaceSelector date={date} classId={classId} assignmentId={assignmentId} deleteAction={deleteAssignment} renameAction={renameAssignment} assignments={assignments.map(({ id, title }) => ({ id, title }))} addControl={classId > 0 ? <details className="assignment-create-popover assignment-create-tile">
            <summary className="btn btn-outline-primary btn-sm"><i className="bi bi-plus-lg me-2" />新增項目</summary>
            <form action={addAssignment}>
              <div className="assignment-create-heading"><strong>新增作業項目</strong><span>{selectedClass?.name} · {date.replaceAll("-", "/")}</span></div>
              <input type="hidden" name="classId" value={classId} /><input type="hidden" name="date" value={date} />
              <div><label htmlFor="assignment-title">項目名稱</label><input id="assignment-title" className="form-control" name="title" placeholder="例如：數學習作 P.12" required maxLength={50} /></div>
              <div className="assignment-create-actions"><button className="btn btn-primary" type="submit"><i className="bi bi-plus-lg me-2" />建立項目</button></div>
            </form>
          </details> : undefined} />

        {selectedAssignment && <div className="assignment-description">
          <AssignmentDescriptionEditor assignmentId={assignmentId} classId={classId} date={date} label={`${selectedAssignment.title} 作業內容`} description={selectedAssignment.description} action={editAssignmentDescription} />
        </div>}

        <div className="panel-divider" />
        <div className="panel-header register-panel-header"><h2>{selectedAssignment ? <>缺交登記 <span>（點選座號立即登記）</span></> : "請選擇作業項目"}</h2>{selectedAssignment && <span className="missing-count">缺交 {missingSeats.length} 人</span>}</div>

        {selectedAssignment ? (
          <DoubleClickSeatGrid key={assignmentId} assignmentId={assignmentId} seatCount={selectedClass?.seat_count ?? 32} seats={seats} missingSeats={missingSeats} action={toggleAssignmentSeat} />
        ) : (
          <div className="subject-required-state"><i className="bi bi-hand-index-thumb" /><strong>{classId ? "請選擇或新增作業項目" : "請先到「班級管理」新增班級"}</strong><span>完成選擇後才會顯示座號。</span></div>
        )}
      </section>
    </main>
  );
}

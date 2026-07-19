import { DEFAULT_JUNIOR_HIGH_ASSIGNMENTS, getClasses, getAssignments, getMissingSeats, getStudents } from "@/lib/queries";
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
  const account = await requireAccount();
  const today = todayInTaipei();
  const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : today;
  const date = requestedDate <= today ? requestedDate : today;
  const classes = await getClasses();
  const requestedClassId = account.role === "admin" ? Number(sp.classId) : account.class_id;
  const selectedClass = classes.find((item) => item.id === requestedClassId);
  const classId = selectedClass?.id ?? 0;
  const assignments = classId ? await getAssignments(classId, date) : [];
  const requestedAssignmentId = Number(sp.assignmentId);
  const selectedAssignment = assignments.find((item) => item.id === requestedAssignmentId);
  const assignmentId = selectedAssignment?.id ?? 0;
  const missingSeats = assignmentId ? await getMissingSeats(assignmentId) : [];
  const students = classId ? (await getStudents(classId)).filter((student) => student.active) : [];
  const visibleClasses = account.role === "admin" ? classes : selectedClass ? [selectedClass] : [];
  const assignmentContentLabel = selectedAssignment
    ? `${selectedAssignment.title}${DEFAULT_JUNIOR_HIGH_ASSIGNMENTS.includes(selectedAssignment.title as typeof DEFAULT_JUNIOR_HIGH_ASSIGNMENTS[number]) ? "科" : ""} 作業內容`
    : "";

  return (
    <main className="desktop-dashboard">
      <header className="page-header">
        <div><h1>作業登記工作台</h1><p>選擇班級與作業項目，雙擊座號即可切換缺交狀態。</p></div>
        <div className="registration-context-bar">
          <RegistrationContextSelector date={date} maxDate={today} classId={classId} classes={visibleClasses.map(({ id, name }) => ({ id, name }))} />
        </div>
      </header>

      <section className="workspace-panel">
        <div className="panel-header course-panel-header">
          <h2>作業項目</h2>
        </div>
        <AssignmentWorkspaceSelector date={date} classId={classId} assignmentId={assignmentId} deleteAction={deleteAssignment} renameAction={renameAssignment} assignments={assignments.map(({ id, title }) => ({ id, title, canDelete: !DEFAULT_JUNIOR_HIGH_ASSIGNMENTS.includes(title as typeof DEFAULT_JUNIOR_HIGH_ASSIGNMENTS[number]) }))} addControl={classId > 0 ? <details className="assignment-create-popover assignment-create-tile">
            <summary className="btn btn-outline-primary btn-sm"><i className="bi bi-plus-lg me-2" />新增項目</summary>
            <form action={addAssignment}>
              <div className="assignment-create-heading"><strong>新增作業項目</strong><span>{selectedClass?.name} · {date.replaceAll("-", "/")}</span></div>
              <input type="hidden" name="classId" value={classId} /><input type="hidden" name="date" value={date} />
              <div><label htmlFor="assignment-title">項目名稱</label><input id="assignment-title" className="form-control" name="title" placeholder="例如：健康檢查回條" required maxLength={50} /></div>
              <div className="assignment-create-actions"><button className="btn btn-primary" type="submit"><i className="bi bi-plus-lg me-2" />建立項目</button></div>
            </form>
          </details> : undefined} />

        {selectedAssignment && <div className="assignment-description">
          <AssignmentDescriptionEditor assignmentId={assignmentId} classId={classId} date={date} label={assignmentContentLabel} description={selectedAssignment.description} action={editAssignmentDescription} />
        </div>}

        <div className="panel-divider" />
        <div className="panel-header register-panel-header"><h2>{selectedAssignment ? <>缺交登記 <span>（點選座號立即登記）</span></> : "請選擇作業項目"}</h2>{selectedAssignment && <span className="missing-count">缺交 {missingSeats.length} 人</span>}</div>

        {selectedAssignment ? <>
          <DoubleClickSeatGrid key={assignmentId} assignmentId={assignmentId} seatCount={selectedClass?.seat_count ?? 32} students={students.map(({seat,student_number,name})=>({seat,studentNumber:student_number,name}))} missingSeats={missingSeats} action={toggleAssignmentSeat} />
        </> : (
          <div className="subject-required-state"><i className="bi bi-hand-index-thumb" /><strong>{classId ? "請選擇或新增作業項目" : "請先選擇班級"}</strong><span>完成選擇後才會顯示座號。</span></div>
        )}
      </section>
    </main>
  );
}

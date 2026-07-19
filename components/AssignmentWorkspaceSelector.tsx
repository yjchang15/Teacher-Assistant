"use client";

import { useState } from "react";

export function RegistrationContextSelector({
  date,
  maxDate,
  classId,
  classes,
}: {
  date: string;
  maxDate: string;
  classId: number;
  classes: { id: number; name: string }[];
}) {
  const [applying, setApplying] = useState(false);
  return (
    <form method="get" className={`registration-context-selector ${applying ? "is-applying" : ""}`} onChange={(event) => { setApplying(true); event.currentTarget.requestSubmit(); }}>
      <div className="workspace-date-field"><label htmlFor="date">日期</label><input id="date" type="date" name="date" className="form-control" defaultValue={date} max={maxDate} /></div>
      <fieldset><legend>班級</legend><div className="workspace-options class-options">
        {classes.map((item) => <div key={item.id}><input id={`class-${item.id}`} type="radio" name="classId" value={item.id} defaultChecked={item.id === classId} /><label htmlFor={`class-${item.id}`}>{item.name}<i className="bi bi-check-circle-fill" /></label></div>)}
      </div></fieldset>
      {applying && <span className="course-loading" role="status"><span className="spinner-border spinner-border-sm" />更新中…</span>}
    </form>
  );
}

export default function AssignmentWorkspaceSelector({ date, classId, assignmentId, assignments }: {
  date: string;
  classId: number;
  assignmentId: number;
  assignments: { id: number; title: string }[];
}) {
  const [applying, setApplying] = useState(false);
  return (
    <form method="get" className={`assignment-workspace-selector ${applying ? "is-applying" : ""}`} onChange={(event) => { setApplying(true); event.currentTarget.requestSubmit(); }}>
      <input type="hidden" name="date" value={date} /><input type="hidden" name="classId" value={classId} />
      {classId > 0 && <fieldset><div className="workspace-options assignment-options">
        {assignments.map((item) => <div key={item.id}><input id={`assignment-${item.id}`} type="radio" name="assignmentId" value={item.id} defaultChecked={item.id === assignmentId} /><label htmlFor={`assignment-${item.id}`}>{item.title}<i className="bi bi-check-circle-fill" /></label></div>)}
      </div></fieldset>}
      {applying && <span className="course-loading" role="status"><span className="spinner-border spinner-border-sm" />更新中…</span>}
    </form>
  );
}

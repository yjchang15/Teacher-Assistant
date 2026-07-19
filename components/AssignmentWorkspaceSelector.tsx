"use client";

import { useState } from "react";

export default function AssignmentWorkspaceSelector({
  date,
  maxDate,
  classId,
  assignmentId,
  classes,
  assignments,
}: {
  date: string;
  maxDate: string;
  classId: number;
  assignmentId: number;
  classes: { id: number; name: string }[];
  assignments: { id: number; title: string }[];
}) {
  const [applying, setApplying] = useState(false);
  return (
    <form method="get" className={`assignment-workspace-selector ${applying ? "is-applying" : ""}`} onChange={(event) => { setApplying(true); event.currentTarget.requestSubmit(); }}>
      <div className="workspace-date-field"><label htmlFor="date">日期</label><input id="date" type="date" name="date" className="form-control" defaultValue={date} max={maxDate} /></div>
      <fieldset><legend>班級</legend><div className="workspace-options class-options">
        {classes.map((item) => <div key={item.id}><input id={`class-${item.id}`} type="radio" name="classId" value={item.id} defaultChecked={item.id === classId} /><label htmlFor={`class-${item.id}`}>{item.name}<i className="bi bi-check-circle-fill" /></label></div>)}
      </div></fieldset>
      {classId > 0 && <fieldset className="assignment-options-field"><legend>作業項目</legend><div className="workspace-options assignment-options">
        {assignments.map((item) => <div key={item.id}><input id={`assignment-${item.id}`} type="radio" name="assignmentId" value={item.id} defaultChecked={item.id === assignmentId} /><label htmlFor={`assignment-${item.id}`}>{item.title}<i className="bi bi-check-circle-fill" /></label></div>)}
      </div></fieldset>}
      {applying && <span className="course-loading" role="status"><span className="spinner-border spinner-border-sm" />更新中…</span>}
    </form>
  );
}

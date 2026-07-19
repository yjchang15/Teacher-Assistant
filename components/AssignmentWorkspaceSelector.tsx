"use client";

import { useState } from "react";
import type { ReactNode } from "react";

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

export default function AssignmentWorkspaceSelector({ date, classId, assignmentId, assignments, addControl, deleteAction, renameAction }: {
  date: string;
  classId: number;
  assignmentId: number;
  assignments: { id: number; title: string; canDelete: boolean }[];
  addControl?: ReactNode;
  deleteAction: (formData: FormData) => void | Promise<void>;
  renameAction: (formData: FormData) => void | Promise<void>;
}) {
  const [applying, setApplying] = useState(false);
  return (
    <div className={`assignment-workspace-selector ${applying ? "is-applying" : ""}`}>
      {classId > 0 && <div className="workspace-options assignment-options">
        {assignments.map((item) => <div className="assignment-option" key={item.id}>
          <form method="get">
            <input type="hidden" name="date" value={date} /><input type="hidden" name="classId" value={classId} />
            <input id={`assignment-${item.id}`} type="radio" name="assignmentId" value={item.id} defaultChecked={item.id === assignmentId} onChange={(event) => { setApplying(true); event.currentTarget.form?.requestSubmit(); }} />
            <label htmlFor={`assignment-${item.id}`}>{item.title}<i className="bi bi-check-circle-fill" /></label>
          </form>
          {item.canDelete && <form action={renameAction} className="assignment-edit-form" onSubmit={(event) => {
            const title = window.prompt("修改項目名稱", item.title)?.trim();
            if (!title || title === item.title) { event.preventDefault(); return; }
            (event.currentTarget.elements.namedItem("title") as HTMLInputElement).value = title;
          }}>
            <input type="hidden" name="assignmentId" value={item.id} /><input type="hidden" name="classId" value={classId} /><input type="hidden" name="date" value={date} /><input type="hidden" name="title" />
            <button type="submit" aria-label={`編輯 ${item.title}`} title="修改名稱"><i className="bi bi-pencil" /></button>
          </form>}
          {item.canDelete && <form action={deleteAction} className="assignment-delete-form" onSubmit={(event) => { if (!window.confirm(`確定刪除「${item.title}」及其缺交紀錄？`)) event.preventDefault(); }}>
            <input type="hidden" name="assignmentId" value={item.id} /><input type="hidden" name="classId" value={classId} /><input type="hidden" name="date" value={date} />
            <button type="submit" aria-label={`刪除 ${item.title}`} title="刪除項目"><i className="bi bi-trash3" /></button>
          </form>}
        </div>)}
        {addControl}
      </div>}
      {applying && <span className="course-loading" role="status"><span className="spinner-border spinner-border-sm" />更新中…</span>}
    </div>
  );
}

"use client";

import { useRef, useState } from "react";

export default function AssignmentDescriptionEditor({ assignmentId, classId, date, label, description, action }: {
  assignmentId: number;
  classId: number;
  date: string;
  label: string;
  description: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const savedValue = useRef(description);
  const [saving, setSaving] = useState(false);

  async function save(formData: FormData) {
    const nextValue = String(formData.get("description") ?? "").trim();
    if (nextValue === savedValue.current) return;
    setSaving(true);
    await action(formData);
    savedValue.current = nextValue;
    setSaving(false);
  }

  return (
    <form ref={formRef} className="assignment-description-form" action={save}>
      <label htmlFor="active-assignment-description">{label}{saving && <span>儲存中…</span>}</label>
      <input type="hidden" name="assignmentId" value={assignmentId} /><input type="hidden" name="classId" value={classId} /><input type="hidden" name="date" value={date} />
      <textarea id="active-assignment-description" className="form-control" name="description" defaultValue={description} placeholder="直接輸入今天的作業內容…" rows={2} maxLength={500} onBlur={(event) => {
        if (event.currentTarget.value.trim() !== savedValue.current) formRef.current?.requestSubmit();
      }} />
    </form>
  );
}

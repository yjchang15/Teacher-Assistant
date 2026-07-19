"use client";

import { useState } from "react";

export default function DoubleClickSeatGrid({
  assignmentId,
  seatCount,
  students,
  missingSeats,
  action,
}: {
  assignmentId: number;
  seatCount: number;
  students: { seat: number; studentNumber: string; name: string }[];
  missingSeats: number[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [missing, setMissing] = useState(() => new Set(missingSeats));
  const [pending, setPending] = useState<number | null>(null);
  const [othersConfirmed, setOthersConfirmed] = useState(false);

  async function toggle(seat: number) {
    if (pending !== null) return;
    setPending(seat);
    setMissing((current) => {
      const next = new Set(current);
      if (next.has(seat)) next.delete(seat); else next.add(seat);
      return next;
    });
    const formData = new FormData();
    formData.set("assignmentId", String(assignmentId));
    formData.set("seat", String(seat));
    try {
      await action(formData);
    } catch {
      setMissing((current) => {
        const next = new Set(current);
        if (next.has(seat)) next.delete(seat); else next.add(seat);
        return next;
      });
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      <div className="double-click-seat-grid" role="group" aria-label="學生座號">
      {(students.length ? students : Array.from({ length: seatCount }, (_, index) => ({seat:index+1,studentNumber:"",name:""}))).map((student) => {
        const seat=student.seat;
        const isMissing = missing.has(seat);
        const isSubmitted = othersConfirmed && !isMissing;
        return <button key={seat} type="button" className={`double-click-seat ${isMissing ? "is-missing" : ""} ${isSubmitted ? "is-submitted" : ""}`} onClick={() => toggle(seat)} disabled={pending === seat} title={isMissing ? "點一下取消缺交" : "點一下標記缺交"}>
          <strong>{seat}</strong>{student.studentNumber&&<small>{student.studentNumber}</small>}<span>{isMissing ? "缺交" : isSubmitted ? "有交" : ""}</span>
        </button>;
      })}
      </div>
      <div className="seat-confirm-toolbar"><button type="button" className="btn btn-success btn-sm" onClick={() => setOthersConfirmed(true)}><i className="bi bi-check2-all me-2" />其餘有交</button></div>
    </>
  );
}

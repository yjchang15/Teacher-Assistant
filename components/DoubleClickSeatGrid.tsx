"use client";

import { useState } from "react";

export default function DoubleClickSeatGrid({
  assignmentId,
  seatCount,
  missingSeats,
  action,
}: {
  assignmentId: number;
  seatCount: number;
  missingSeats: number[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [missing, setMissing] = useState(() => new Set(missingSeats));
  const [pending, setPending] = useState<number | null>(null);

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
    <div className="double-click-seat-grid" role="group" aria-label="學生座號">
      {Array.from({ length: seatCount }, (_, index) => index + 1).map((seat) => {
        const isMissing = missing.has(seat);
        return <button key={seat} type="button" className={`double-click-seat ${isMissing ? "is-missing" : ""}`} onDoubleClick={() => toggle(seat)} disabled={pending === seat} title="點兩下切換缺交狀態">
          <strong>{seat}</strong><span>{isMissing ? "缺交" : "有交"}</span>
        </button>;
      })}
    </div>
  );
}

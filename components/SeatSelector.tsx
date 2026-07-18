"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

function SubmitButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary btn-lg flex-grow-1" type="submit" disabled={count === 0 || pending}>
      <i className={`bi ${pending ? "bi-hourglass-split" : "bi-check2-circle"} me-2`} />
      {pending ? "登記中…" : count ? `確認登記 ${count} 位` : "請先選擇座號"}
    </button>
  );
}

export default function SeatSelector({
  date,
  subject,
  seatCount,
  loggedSeats,
  action,
}: {
  date: string;
  subject: string;
  seatCount: number;
  loggedSeats: number[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const logged = new Set(loggedSeats);
  const available = Array.from({ length: seatCount }, (_, index) => index + 1).filter((seat) => !logged.has(seat));

  function toggle(seat: number) {
    setSelected((current) =>
      current.includes(seat) ? current.filter((item) => item !== seat) : [...current, seat],
    );
  }

  return (
    <form action={action} className="seat-form">
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="subject" value={subject} />
      {selected.map((seat) => <input key={seat} type="hidden" name="seats" value={seat} />)}

      <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
        <div>
          <div className="fw-bold">點選未交作業的座號</div>
          <div className="text-body-secondary small">灰色代表今天已登記</div>
        </div>
        <span className="badge rounded-pill text-bg-primary fs-6">已選 {selected.length}</span>
      </div>

      <div className="seat-grid mb-3" role="group" aria-label="學生座號">
        {Array.from({ length: seatCount }, (_, index) => index + 1).map((seat) => {
          const disabled = logged.has(seat);
          const active = selected.includes(seat);
          return (
            <button
              key={seat}
              type="button"
              className={`seat-button ${active ? "is-selected" : ""} ${disabled ? "is-logged" : ""}`}
              disabled={disabled}
              aria-pressed={active}
              onClick={() => toggle(seat)}
            >
              <span>{seat}</span>
              {disabled && <i className="bi bi-check-circle-fill" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <div className="d-flex gap-2 flex-wrap action-bar">
        <SubmitButton count={selected.length} />
        <button className="btn btn-outline-secondary btn-lg" type="button" disabled={!selected.length} onClick={() => setSelected([])}>
          清除
        </button>
        {available.length > 0 && (
          <button className="btn btn-link btn-sm w-100" type="button" onClick={() => setSelected(available)}>
            選取全部未登記座號
          </button>
        )}
      </div>
    </form>
  );
}

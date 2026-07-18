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
  records,
  action,
  markLateAction,
  reopenAction,
  removeAction,
}: {
  date: string;
  subject: string;
  seatCount: number;
  records: { id: number; seat: number; status: "open" | "late" }[];
  action: (formData: FormData) => Promise<void>;
  markLateAction: (formData: FormData) => Promise<void>;
  reopenAction: (formData: FormData) => Promise<void>;
  removeAction: (formData: FormData) => Promise<void>;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const recordBySeat = new Map(records.map((record) => [record.seat, record]));
  const logged = new Set(records.map((record) => record.seat));
  const available = Array.from({ length: seatCount }, (_, index) => index + 1).filter((seat) => !logged.has(seat));

  function toggle(seat: number) {
    setSelected((current) =>
      current.includes(seat) ? current.filter((item) => item !== seat) : [...current, seat],
    );
  }

  async function submitSelection(formData: FormData) {
    await action(formData);
    setSelected([]);
  }

  return (
    <div className="seat-form">
      <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
        <div>
          <div className="fw-bold">點選未交作業的座號</div>
          <div className="seat-status-keys" aria-label="座號狀態圖例">
            <span className="seat-status-key is-open"><i className="bi bi-x-circle-fill" />未交</span>
            <span className="seat-status-key is-resolved"><i className="bi bi-check-circle-fill" />已補交</span>
          </div>
        </div>
        <span className="badge rounded-pill text-bg-primary fs-6">已選 {selected.length}</span>
      </div>

      <div className="seat-grid mb-3" role="group" aria-label="學生座號">
        {Array.from({ length: seatCount }, (_, index) => index + 1).map((seat) => {
          const record = recordBySeat.get(seat);
          const active = selected.includes(seat);
          if (record) {
            const isOpen = record.status === "open";
            return (
              <div key={seat} className={`seat-button seat-record ${isOpen ? "is-open" : "is-resolved"}`}>
                <strong>{seat}</strong>
                <span>{isOpen ? "作業缺交" : "已補交"}</span>
                <div className="seat-record-actions">
                  <form action={isOpen ? markLateAction : reopenAction}>
                    <input type="hidden" name="id" value={record.id} />
                    <button type="submit" title={isOpen ? "標記已補交" : "改回作業缺交"}><i className={`bi ${isOpen ? "bi-check-lg" : "bi-arrow-counterclockwise"}`} /></button>
                  </form>
                  <form action={removeAction}>
                    <input type="hidden" name="id" value={record.id} />
                    <button type="submit" title="刪除紀錄"><i className="bi bi-trash" /></button>
                  </form>
                </div>
              </div>
            );
          }
          return (
            <button
              key={seat}
              type="button"
              className={`seat-button ${active ? "is-selected" : ""}`}
              aria-pressed={active}
              onClick={() => toggle(seat)}
            >
              <strong>{seat}</strong>
            </button>
          );
        })}
      </div>

      <form action={submitSelection} className="d-flex gap-2 flex-wrap action-bar">
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="subject" value={subject} />
        {selected.map((seat) => <input key={seat} type="hidden" name="seats" value={seat} />)}
        <SubmitButton count={selected.length} />
        <button className="btn btn-outline-secondary btn-lg" type="button" disabled={!selected.length} onClick={() => setSelected([])}>
          清除
        </button>
        {available.length > 0 && (
          <button className="btn btn-link btn-sm w-100" type="button" onClick={() => setSelected(available)}>
            選取全部未登記座號
          </button>
        )}
      </form>
    </div>
  );
}

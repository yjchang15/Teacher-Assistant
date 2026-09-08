"use client";

import { useEffect, useState } from "react";

export interface ProgressItem { id: number; title: string; description: string; missingSeats: number[]; }

const UNDO_MS = 8000;

// 缺交座號一格一個按鈕：點一下就是「這個座號補交了」，紀錄馬上從名單消失，
// 右下角留一個 8 秒的復原鍵給點錯的人。所有動作都先改畫面再送出，送不出去
// 才把座號放回去。
export default function SubmissionProgressBoard({
  items,
  headcount,
  className,
  submitAction,
  restoreAction,
}: {
  items: ProgressItem[];
  headcount: number;
  className: string;
  submitAction: (formData: FormData) => Promise<void>;
  restoreAction: (formData: FormData) => Promise<void>;
}) {
  const [board, setBoard] = useState(items);
  const [undo, setUndo] = useState<{ assignmentId: number; seat: number; title: string } | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  const setSeats = (assignmentId: number, next: (seats: number[]) => number[]) =>
    setBoard((current) => current.map((item) => (item.id === assignmentId ? { ...item, missingSeats: next(item.missingSeats) } : item)));
  const drop = (seat: number) => (seats: number[]) => seats.filter((value) => value !== seat);
  const add = (seat: number) => (seats: number[]) => [...seats, seat].sort((a, b) => a - b);

  async function send(action: (formData: FormData) => Promise<void>, assignmentId: number, seat: number) {
    const formData = new FormData();
    formData.set("assignmentId", String(assignmentId));
    formData.set("seat", String(seat));
    await action(formData);
  }

  async function markSubmitted(item: ProgressItem, seat: number) {
    if (pending) return;
    setPending(`${item.id}-${seat}`);
    setSeats(item.id, drop(seat));
    try {
      await send(submitAction, item.id, seat);
      setUndo({ assignmentId: item.id, seat, title: item.title });
    } catch {
      setSeats(item.id, add(seat));
    } finally {
      setPending(null);
    }
  }

  async function undoLast() {
    if (!undo) return;
    const { assignmentId, seat } = undo;
    setUndo(null);
    setSeats(assignmentId, add(seat));
    try {
      await send(restoreAction, assignmentId, seat);
    } catch {
      setSeats(assignmentId, drop(seat));
    }
  }

  return (
    <>
      <div className="progress-board">
        {board.map((item) => {
          const missing = item.missingSeats.length;
          const submitted = Math.max(0, headcount - missing);
          const percent = headcount ? Math.round((submitted / headcount) * 100) : 100;
          return (
            <article className={`progress-card ${missing ? "" : "is-complete"}`} key={item.id}>
              <header>
                <div>
                  <h2>{item.title}</h2>
                  {item.description && <p>{item.description}</p>}
                </div>
                <span className={`progress-count ${missing ? "" : "is-complete"}`}>
                  {missing ? <>缺交 {missing} 人</> : <><i className="bi bi-check-circle-fill me-1" />全班已交</>}
                </span>
              </header>

              <div className="progress-meter" role="img" aria-label={`已交 ${submitted} 人，共 ${headcount} 人`}>
                <div className="progress-meter-bar"><span style={{ width: `${percent}%` }} /></div>
                <small>已交 {submitted} / {headcount}（{percent}%）</small>
              </div>

              {missing ? (
                <>
                  <p className="progress-hint"><i className="bi bi-hand-index-thumb me-1" />補交了就點一下座號，紀錄立刻移除。</p>
                  <div className="progress-seat-chips" role="group" aria-label={`${item.title} 缺交座號`}>
                    {item.missingSeats.map((seat) => (
                      <button
                        type="button"
                        key={seat}
                        className="progress-seat-chip"
                        disabled={pending === `${item.id}-${seat}`}
                        title={`${className} ${seat} 號已補交「${item.title}」`}
                        aria-label={`${seat} 號已補交`}
                        onClick={() => markSubmitted(item, seat)}
                      >
                        <strong>{seat}</strong>
                        <span><i className="bi bi-check-lg me-1" />已補交</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className="progress-done"><i className="bi bi-emoji-smile me-2" />這個項目沒有缺交紀錄。</p>
              )}
            </article>
          );
        })}
      </div>

      {undo && (
        <div className="undo-toast" role="status">
          <span>{undo.seat} 號的「{undo.title}」已標記補交</span>
          <button type="button" onClick={undoLast}>復原</button>
        </div>
      )}
    </>
  );
}

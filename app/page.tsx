import { getNotes } from "@/lib/queries";
import { addNote, deleteNote } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const notes = await getNotes();
  return (
    <div style={{ maxWidth: 720 }}>
      <h5 className="fw-bold mb-3">
        <i className="bi bi-sticky me-2 text-primary"></i>Notes 示範
      </h5>
      <p className="text-muted small">
        這頁證明整套骨架都通了：Server Component 讀取 · Server Action 寫入 ·
        雙後端資料層（本地 PGlite／正式 Supabase）。把 <code>notes</code> 換成你的領域資料表即可。
      </p>

      <div className="card p-3 mb-4">
        <form action={addNote} className="row g-2 align-items-end">
          <div className="col-4">
            <label className="form-label fw-semibold small">標題</label>
            <input type="text" name="title" className="form-control" required />
          </div>
          <div className="col-6">
            <label className="form-label fw-semibold small">內容</label>
            <input type="text" name="body" className="form-control" placeholder="選填" />
          </div>
          <div className="col-2">
            <button className="btn btn-primary w-100" type="submit">
              <i className="bi bi-plus-lg"></i>
            </button>
          </div>
        </form>
      </div>

      {notes.length === 0 ? (
        <div className="text-center text-muted py-4">尚無筆記</div>
      ) : (
        <ul className="list-group">
          {notes.map((n) => (
            <li key={n.id} className="list-group-item d-flex justify-content-between align-items-center">
              <span>
                <span className="fw-semibold">{n.title}</span>
                {n.body && <span className="text-muted small ms-2">{n.body}</span>}
              </span>
              <form action={deleteNote}>
                <input type="hidden" name="id" value={n.id} />
                <button className="btn btn-outline-danger btn-sm" type="submit">
                  <i className="bi bi-trash"></i>
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

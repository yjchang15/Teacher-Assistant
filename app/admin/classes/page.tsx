import { addClass, addClassSeat, editClass, removeClass, removeClassSeat } from "@/app/actions";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { getClasses, nextSeat, DEFAULT_HEADCOUNT, MAX_SEAT } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function ClassesPage({ searchParams }: { searchParams: Promise<{ created?: string; updated?: string; deleted?: string; error?: string }> }) {
  const sp = await searchParams;
  const classes = await getClasses();

  return <main>
    <header className="mb-4"><h1 className="h3 fw-bold mb-1">班級維護</h1><p className="text-body-secondary mb-0">填班級與人數，座號會自動展開。之後按 × 刪掉不用的號碼；要加號碼就在最後一格填數字再按 +，刪掉的號碼也是這樣加回來。</p></header>

    {sp.created && <div className="alert alert-success">班級已建立，座號已依人數展開。</div>}
    {sp.updated && <div className="alert alert-success">班級名稱已更新。</div>}
    {sp.deleted && <div className="alert alert-success">班級已刪除。</div>}
    {sp.error && <div className="alert alert-danger">{sp.error === "exists" ? "此班級名稱已存在。" : "班級名稱不可空白，且限 20 個字以內。"}</div>}

    <section className="card mb-4"><form action={addClass} className="card-body d-flex align-items-end gap-3">
      <div><label className="form-label" htmlFor="class-name">班級</label><input id="class-name" className="form-control" name="name" placeholder="701" maxLength={20} required /></div>
      <div><label className="form-label" htmlFor="class-headcount">人數</label><input id="class-headcount" className="form-control" name="headcount" type="number" min="1" max={MAX_SEAT} defaultValue={DEFAULT_HEADCOUNT} required /></div>
      <button className="btn btn-primary" type="submit"><i className="bi bi-plus-lg me-2" />新增班級</button>
    </form></section>

    {classes.length === 0
      ? <div className="alert alert-secondary">尚未建立班級。</div>
      : classes.map((item) => <section className="card mb-3" key={item.id}>
        <div className="card-header d-flex align-items-center justify-content-between gap-3">
          <form action={editClass} className="d-flex align-items-center gap-2">
            <input type="hidden" name="id" value={item.id} />
            <input className="form-control form-control-sm" style={{ maxWidth: 160 }} name="name" defaultValue={item.name} maxLength={20} required aria-label="班級" />
            <button className="btn btn-sm btn-outline-primary" type="submit">儲存</button>
            <span className="text-body-secondary small">共 {item.seats.length} 個座號</span>
          </form>
          <form action={removeClass}><input type="hidden" name="id" value={item.id} />
            <ConfirmSubmitButton className="btn btn-sm btn-outline-danger" message={`確定刪除「${item.name}」及其作業項目與所有缺交紀錄？此操作無法復原。`}><i className="bi bi-trash3 me-1" />刪除班級</ConfirmSubmitButton>
          </form>
        </div>
        <div className="card-body">
          <div className="seat-chip-grid">
            {item.seats.map((seat) => <div className="seat-chip" key={seat}>
              <span>{seat}</span>
              <form action={removeClassSeat}>
                <input type="hidden" name="classId" value={item.id} /><input type="hidden" name="seat" value={seat} />
                <button type="submit" className="seat-chip-del" aria-label={`刪除 ${seat} 號`} title={`刪除 ${seat} 號`}>×</button>
              </form>
            </div>)}
{item.seats.length < MAX_SEAT && <form action={addClassSeat} className="seat-chip seat-chip-add">
              <input type="hidden" name="classId" value={item.id} />
              <input className="seat-chip-number" name="seat" type="number" min="1" max={MAX_SEAT} defaultValue={nextSeat(item.seats)} required aria-label={`${item.name} 要新增的座號`} />
              <button type="submit" aria-label={`新增座號到 ${item.name}`} title="加入這個號碼"><i className="bi bi-plus-lg" /></button>
            </form>}
          </div>
        </div>
      </section>)}
  </main>;
}

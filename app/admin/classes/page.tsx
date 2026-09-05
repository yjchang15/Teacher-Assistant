import { addClass, editClass, removeClass } from "@/app/actions";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { getClasses, MAX_SEAT } from "@/lib/queries";
import { requireAccount } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ClassesPage({ searchParams }: { searchParams: Promise<{ created?: string; updated?: string; deleted?: string; error?: string }> }) {
  await requireAccount();
  const sp = await searchParams;
  const classes = await getClasses();

  return <main>
    <header className="mb-4"><h1 className="h3 fw-bold mb-1">班級管理</h1><p className="text-body-secondary mb-0">新增、更名或刪除班級。座號數是登記畫面在名冊未設定時顯示的座號上限。</p></header>

    {sp.created && <div className="alert alert-success">班級已建立。</div>}
    {sp.updated && <div className="alert alert-success">班級已更新。</div>}
    {sp.deleted && <div className="alert alert-success">班級已刪除。</div>}
    {sp.error && <div className="alert alert-danger">{sp.error === "exists" ? "此班級名稱已存在。" : "班級名稱不可空白，且限 20 個字以內。"}</div>}

    <section className="card mb-4"><form action={addClass} className="card-body d-flex align-items-end gap-3">
      <div><label className="form-label" htmlFor="class-name">班級名稱</label><input id="class-name" className="form-control" name="name" placeholder="701" maxLength={20} required /></div>
      <div><label className="form-label" htmlFor="class-seats">座號數</label><input id="class-seats" className="form-control" name="seatCount" type="number" min="1" max={MAX_SEAT} defaultValue="32" required /></div>
      <button className="btn btn-primary" type="submit"><i className="bi bi-plus-lg me-2" />新增班級</button>
    </form></section>

    <div className="table-responsive border rounded-3"><table className="table align-middle mb-0">
      <thead><tr><th>班級名稱</th><th>座號數</th><th className="text-end">操作</th></tr></thead>
      <tbody>{classes.length ? classes.map((item) => <tr key={item.id}>
        <td colSpan={2}>
          <form action={editClass} className="d-flex align-items-center gap-2">
            <input type="hidden" name="id" value={item.id} />
            <input className="form-control" style={{ maxWidth: 200 }} name="name" defaultValue={item.name} maxLength={20} required aria-label="班級名稱" />
            <input className="form-control" style={{ maxWidth: 110 }} name="seatCount" type="number" min="1" max={MAX_SEAT} defaultValue={item.seat_count} required aria-label="座號數" />
            <button className="btn btn-sm btn-outline-primary" type="submit">儲存</button>
          </form>
        </td>
        <td className="text-end">
          <form action={removeClass}><input type="hidden" name="id" value={item.id} />
            <ConfirmSubmitButton className="btn btn-sm btn-danger" message={`確定刪除「${item.name}」及其座號、作業項目與所有缺交紀錄？此操作無法復原。`}><i className="bi bi-trash3 me-1" />刪除</ConfirmSubmitButton>
          </form>
        </td>
      </tr>) : <tr><td colSpan={3} className="py-4 text-center text-body-secondary">尚未建立班級。</td></tr>}</tbody>
    </table></div>
  </main>;
}

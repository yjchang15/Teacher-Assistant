import { addClassAccount, resetClassPassword, toggleClassAccount } from "@/app/actions";
import { listAccounts } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";

export default async function AccountsPage() {
  await requireAdmin(); const accounts=(await listAccounts()).filter((a)=>a.role==="class");
  return <main><header className="mb-4"><h1 className="h3 fw-bold">班級帳號</h1><p className="text-body-secondary">定義合法班級代號、停用帳號或重設預設密碼。</p></header>
    <section className="card mb-4"><form action={addClassAccount} className="card-body d-flex align-items-end gap-3"><div><label className="form-label">班級代號</label><input className="form-control" name="code" placeholder="701" required /></div><div><label className="form-label">顯示名稱</label><input className="form-control" name="name" placeholder="例：七年一班" required /></div><div><label className="form-label">座號人數</label><input className="form-control" name="seatCount" type="number" min="1" max="60" defaultValue="32" required /></div><button className="btn btn-primary" type="submit">新增帳號</button></form></section>
    <div className="table-responsive border rounded-3"><table className="table align-middle mb-0"><thead><tr><th>代號</th><th>班級</th><th>狀態</th><th>最後登入</th><th className="text-end">操作</th></tr></thead><tbody>{accounts.map((a)=><tr key={a.id}><td className="fw-bold">{a.code}</td><td>{a.display_name}</td><td>{a.active?"啟用":"停用"}</td><td>{a.last_login_at?new Date(a.last_login_at).toLocaleString("zh-TW"):"尚未登入"}</td><td><div className="d-flex justify-content-end gap-2"><form action={resetClassPassword}><input type="hidden" name="id" value={a.id}/><button className="btn btn-sm btn-outline-secondary">重設密碼</button></form><form action={toggleClassAccount}><input type="hidden" name="id" value={a.id}/><input type="hidden" name="active" value={String(!a.active)}/><button className={`btn btn-sm ${a.active?"btn-outline-danger":"btn-outline-success"}`}>{a.active?"停用":"啟用"}</button></form></div></td></tr>)}</tbody></table></div>
  </main>;
}

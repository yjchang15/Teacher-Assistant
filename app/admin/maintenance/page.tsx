import { adminDeleteClassAccount, adminDeleteMissingRecord, resetClassPassword } from "@/app/actions";
import AutoSubmitForm from "@/components/AutoSubmitForm";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { getClasses, getMaintenanceMissingRecords, listAccounts } from "@/lib/queries";
import { requireAdmin } from "@/lib/session";

export const dynamic="force-dynamic";
const ISO_DATE=/^\d{4}-\d{2}-\d{2}$/;
function todayInTaipei(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}

export default async function MaintenancePage({searchParams}:{searchParams:Promise<{classId?:string;date?:string;deleted?:string}>}){
  await requireAdmin();const sp=await searchParams;const today=todayInTaipei();const date=ISO_DATE.test(sp.date??"")&&sp.date!<=today?sp.date!:today;
  const classes=await getClasses();const classId=Number(sp.classId)||classes[0]?.id||0;const selectedClass=classes.find(c=>c.id===classId);
  const records=await getMaintenanceMissingRecords(classId,date);const accounts=(await listAccounts()).filter(a=>a.role==="class");
  return <main><header className="mb-4"><h1 className="h3 fw-bold mb-1">資料維護</h1><p className="text-body-secondary mb-0">僅限管理員使用。刪除後無法復原。</p></header>
    {sp.deleted&&<div className="alert alert-success">資料已刪除。</div>}
    <section className="card mb-4"><div className="card-header fw-bold">缺交資料</div><AutoSubmitForm className="card-body d-flex align-items-end gap-3"><div><label className="form-label">班級</label><select className="form-select" name="classId" defaultValue={classId}>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div><label className="form-label">日期</label><input className="form-control" type="date" name="date" max={today} defaultValue={date}/></div></AutoSubmitForm>
      <div className="table-responsive"><table className="table align-middle mb-0"><thead><tr><th>項目</th><th>座號</th><th>內容</th><th></th></tr></thead><tbody>{records.length?records.map(record=><tr key={record.id}><td>{record.title}</td><td className="fw-bold text-danger">{record.seat}</td><td>{record.description||"—"}</td><td className="text-end"><form action={adminDeleteMissingRecord}><input type="hidden" name="id" value={record.id}/><input type="hidden" name="classId" value={classId}/><input type="hidden" name="date" value={date}/><ConfirmSubmitButton className="btn btn-sm btn-outline-danger" message={`確定刪除 ${selectedClass?.name} ${record.seat} 號的「${record.title}」缺交紀錄？`}><i className="bi bi-trash3 me-1"/>刪除</ConfirmSubmitButton></form></td></tr>):<tr><td colSpan={4} className="py-4 text-center text-body-secondary">當天沒有缺交資料</td></tr>}</tbody></table></div>
    </section>
    <section className="card"><div className="card-header fw-bold">班級帳號</div><div className="table-responsive"><table className="table align-middle mb-0"><thead><tr><th>代號</th><th>狀態</th><th className="text-end">維護操作</th></tr></thead><tbody>{accounts.map(account=><tr key={account.id}><td className="fw-bold">{account.code}</td><td>{account.active?"啟用":"停用"}</td><td><div className="d-flex justify-content-end gap-2"><form action={resetClassPassword}><input type="hidden" name="id" value={account.id}/><ConfirmSubmitButton className="btn btn-sm btn-outline-secondary" message={`確定將 ${account.code} 的密碼重設為 ${account.code}？`}>重設密碼</ConfirmSubmitButton></form><form action={adminDeleteClassAccount}><input type="hidden" name="id" value={account.id}/><ConfirmSubmitButton className="btn btn-sm btn-danger" message={`確定永久刪除 ${account.code} 帳號、學生名單、作業及所有缺交資料？此操作無法復原。`}><i className="bi bi-trash3 me-1"/>刪除帳號</ConfirmSubmitButton></form></div></td></tr>)}</tbody></table></div></section>
  </main>;
}

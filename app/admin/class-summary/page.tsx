import { getClasses, getClassMissingSummary } from "@/lib/queries";
import { requireAccount } from "@/lib/session";

export const dynamic = "force-dynamic";
const ISO_DATE=/^\d{4}-\d{2}-\d{2}$/;
function todayInTaipei(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}

export default async function ClassSummaryPage({searchParams}:{searchParams:Promise<{start?:string;end?:string;classId?:string}>}){
  const account=await requireAccount(); const sp=await searchParams; const today=todayInTaipei();
  const requestedStart=ISO_DATE.test(sp.start??"")&&sp.start!<=today?sp.start!:today; const requestedEnd=ISO_DATE.test(sp.end??"")&&sp.end!<=today?sp.end!:today;
  const start=requestedStart<=requestedEnd?requestedStart:requestedEnd; const end=requestedStart<=requestedEnd?requestedEnd:requestedStart;
  const classes=await getClasses(); const classId=account.role==="admin"?Number(sp.classId)||classes[0]?.id||0:account.class_id||0;
  const rows=await getClassMissingSummary(classId,start,end);
  return <main><header className="mb-3"><h1 className="h3 fw-bold mb-1">全班缺交總表</h1><p className="text-body-secondary mb-0">依作業項目彙整全班缺交座號。</p></header>
    <section className="card mb-4"><form method="get" className="card-body d-flex align-items-end gap-3">{account.role==="admin"&&<div><label className="form-label">班級</label><select className="form-select" name="classId" defaultValue={classId}>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}<div><label className="form-label">起日</label><input className="form-control" type="date" name="start" max={today} defaultValue={start}/></div><div><label className="form-label">迄日</label><input className="form-control" type="date" name="end" max={today} defaultValue={end}/></div><button className="btn btn-primary">查詢</button></form></section>
    <div className="table-responsive border rounded-3"><table className="table table-bordered align-middle mb-0 class-missing-summary"><thead><tr><th>項目</th><th>缺交座號</th><th>項目內容</th></tr></thead><tbody>{rows.length?rows.map(row=><tr key={row.assignment_id}><td><small>{row.date.replaceAll("-","/")}</small><strong>{row.title}</strong></td><td className="missing-seat-list">{row.seats}</td><td>{row.description||"—"}</td></tr>):<tr><td colSpan={3} className="py-5 text-center text-body-secondary"><i className="bi bi-check-circle text-success me-2"/>此期間沒有缺交作業</td></tr>}</tbody></table></div>
  </main>;
}

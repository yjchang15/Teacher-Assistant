import Link from "next/link";
import { getClasses, getMissingDetails } from "@/lib/queries";
import { requireAccount } from "@/lib/session";

export const dynamic = "force-dynamic";
const ISO_DATE=/^\d{4}-\d{2}-\d{2}$/;
function todayInTaipei(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());}

export default async function AdminPage({searchParams}:{searchParams:Promise<{start?:string;end?:string;classId?:string;seat?:string}>}){
  const account=await requireAccount(); const sp=await searchParams; const today=todayInTaipei();
  const start=ISO_DATE.test(sp.start??"")&&sp.start!<=today?sp.start!:today; const end=ISO_DATE.test(sp.end??"")&&sp.end!<=today?sp.end!:today;
  const classes=await getClasses(); const classId=account.role==="admin"?Number(sp.classId)||classes[0]?.id||0:account.class_id||0;
  const className=classes.find(c=>c.id===classId)?.name??"";
  const all=await getMissingDetails(classId,start<=end?start:end,start<=end?end:start); const onlySeat=Number(sp.seat)||0; const details=onlySeat?all.filter(r=>r.seat===onlySeat):all;
  const groups=Object.values(details.reduce<Record<number,{seat:number;name:string;rows:typeof details}>>((acc,row)=>{acc[row.seat]??={seat:row.seat,name:row.student_name,rows:[]};acc[row.seat].rows.push(row);return acc;},{}));
  const base={classId:String(classId),start,end};
  return <main className={onlySeat?"student-report-focus":""}>
    {!onlySeat&&<><header className="mb-3"><h1 className="h3 fw-bold mb-1">個人缺交列表</h1><p className="text-body-secondary mb-0">每位學生獨立一張表，方便逐一截圖給家長。</p></header>
    <section className="card mb-4"><form method="get" className="card-body d-flex align-items-end gap-3">{account.role==="admin"&&<div><label className="form-label">班級</label><select className="form-select" name="classId" defaultValue={classId}>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>}<div><label className="form-label">起日</label><input className="form-control" type="date" name="start" max={today} defaultValue={start}/></div><div><label className="form-label">迄日</label><input className="form-control" type="date" name="end" max={today} defaultValue={end}/></div><button className="btn btn-primary">查詢</button></form></section></>}
    {onlySeat&&<div className="mb-3 d-print-none"><Link className="btn btn-outline-secondary" href={`/admin?${new URLSearchParams(base)}`}><i className="bi bi-arrow-left me-2"/>返回全部</Link></div>}
    <div className="student-report-list">{groups.length===0?<div className="alert alert-success">目前沒有缺交作業</div>:groups.map(group=><article className="student-report-card" key={group.seat}>
      <header><div><strong>{className}{className.endsWith("班")?"":"班"} {String(group.seat).padStart(2,"0")}號</strong>{group.name&&<span>{group.name}</span>}</div>{!onlySeat&&<Link className="btn btn-sm btn-outline-primary d-print-none" href={`/admin?${new URLSearchParams({...base,seat:String(group.seat)})}`}><i className="bi bi-arrows-fullscreen me-1"/>單獨顯示</Link>}</header>
      <table className="table table-bordered align-middle mb-0"><thead><tr><th style={{width:120}}>日期</th><th style={{width:120}}>科目</th><th>缺交作業內容</th></tr></thead><tbody>{group.rows.map((row,index)=><tr key={`${row.date}-${row.title}-${index}`}><td className="text-body-secondary">{row.date.replaceAll("-","/")}</td><td className="fw-semibold">{row.title}</td><td>{row.description||"—"}</td></tr>)}</tbody></table>
    </article>)}</div>
  </main>;
}

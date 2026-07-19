import { removeStudent, upsertStudent } from "@/app/actions";
import { getClasses, getStudents } from "@/lib/queries";
import { requireAccount } from "@/lib/session";

export default async function StudentsPage({searchParams}:{searchParams:Promise<{classId?:string}>}) {
  const account=await requireAccount(); const sp=await searchParams; const classes=await getClasses(); const classId=account.role==="admin"?Number(sp.classId)||classes[0]?.id||0:account.class_id||0; const selected=classes.find(c=>c.id===classId); const students=await getStudents(classId);
  return <main><header className="mb-4"><h1 className="h3 fw-bold">學生名單</h1><p className="text-body-secondary">{selected?.name}｜設定座號、學號與姓名。</p></header>
    {account.role==="admin"&&<form method="get" className="mb-3"><select className="form-select" style={{maxWidth:260}} name="classId" defaultValue={classId} onChange={undefined}>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><button className="btn btn-primary mt-2">切換班級</button></form>}
    <section className="card mb-4"><form action={upsertStudent} className="card-body d-flex align-items-end gap-3"><input type="hidden" name="classId" value={classId}/><div><label className="form-label">座號</label><input className="form-control" name="seat" type="number" min="1" max="60" required/></div><div><label className="form-label">學號</label><input className="form-control" name="studentNumber" required/></div><div><label className="form-label">姓名（選填）</label><input className="form-control" name="name"/></div><button className="btn btn-primary">新增／更新</button></form></section>
    <div className="table-responsive border rounded-3"><table className="table align-middle mb-0"><thead><tr><th>座號</th><th>學號</th><th>姓名</th><th></th></tr></thead><tbody>{students.filter(s=>s.active).map(s=><tr key={s.id}><td>{s.seat}</td><td>{s.student_number}</td><td>{s.name||"—"}</td><td className="text-end"><form action={removeStudent}><input type="hidden" name="id" value={s.id}/><input type="hidden" name="classId" value={classId}/><button className="btn btn-sm btn-outline-danger">停用</button></form></td></tr>)}</tbody></table></div>
  </main>;
}

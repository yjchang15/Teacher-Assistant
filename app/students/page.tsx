import { importStudentRoster, removeStudent, upsertStudent } from "@/app/actions";
import { getClasses, getStudents, MAX_SEAT } from "@/lib/queries";
import AutoSubmitForm from "@/components/AutoSubmitForm";
import { requireAccount } from "@/lib/session";

export const dynamic = "force-dynamic";

// The roster is 班級 + 座號 only — no names are stored.
export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ classId?: string; imported?: string; error?: string }> }) {
  await requireAccount();
  const sp = await searchParams;
  const classes = await getClasses();
  const selected = classes.find((item) => item.id === Number(sp.classId)) ?? classes[0];
  const classId = selected?.id ?? 0;
  const students = await getStudents(classId);

  return <main>
    <header className="mb-4"><h1 className="h3 fw-bold">班級座號</h1><p className="text-body-secondary mb-0">設定每個班級實際使用的座號。未設定時，登記畫面會顯示 1～{selected?.seat_count ?? 32} 號。</p></header>
    {sp.imported && <div className="alert alert-success">已匯入 {sp.imported} 個座號。</div>}
    {sp.error && <div className="alert alert-danger">匯入失敗。請確認檔案小於 2 MB，第一列包含「座號」欄位，且座號沒有重複。</div>}

    {classes.length === 0
      ? <div className="alert alert-warning">尚未建立班級，請先到「班級管理」新增。</div>
      : <>
        <section className="card mb-3"><AutoSubmitForm className="card-body d-flex align-items-end gap-3"><div><label className="form-label">班級</label><select className="form-select" name="classId" defaultValue={classId}>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div></AutoSubmitForm></section>

        <section className="card mb-3"><form action={importStudentRoster} className="card-body d-flex align-items-end gap-3" encType="multipart/form-data"><input type="hidden" name="classId" value={classId} /><div className="flex-grow-1"><label className="form-label fw-semibold" htmlFor="roster-file">從 Excel 匯入</label><input id="roster-file" className="form-control" name="file" type="file" accept=".xlsx,.xls,.csv" required /><div className="form-text">第一列欄位名稱：座號。匯入後會取代目前的座號清單。</div></div><button className="btn btn-success" type="submit"><i className="bi bi-file-earmark-excel me-2" />匯入座號</button></form></section>

        <section className="card mb-4"><form action={upsertStudent} className="card-body d-flex align-items-end gap-3"><input type="hidden" name="classId" value={classId} /><div><label className="form-label">座號</label><input className="form-control" name="seat" type="number" min="1" max={MAX_SEAT} required /></div><button className="btn btn-primary">新增座號</button></form></section>

        <div className="table-responsive border rounded-3"><table className="table align-middle mb-0"><thead><tr><th>座號</th><th></th></tr></thead><tbody>{students.filter((student) => student.active).map((student) => <tr key={student.id}><td className="fw-bold">{student.seat}</td><td className="text-end"><form action={removeStudent}><input type="hidden" name="id" value={student.id} /><input type="hidden" name="classId" value={classId} /><button className="btn btn-sm btn-outline-danger">停用</button></form></td></tr>)}{students.filter((student) => student.active).length === 0 && <tr><td colSpan={2} className="py-4 text-center text-body-secondary">尚未設定座號，登記畫面會顯示 1～{selected?.seat_count ?? 32} 號。</td></tr>}</tbody></table></div>
      </>}
  </main>;
}

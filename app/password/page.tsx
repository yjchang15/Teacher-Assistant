import { changePassword } from "@/app/actions";
import { requireAccount } from "@/lib/session";

export default async function PasswordPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const account = await requireAccount(true); const { error } = await searchParams;
  return <main className="mx-auto" style={{maxWidth:520}}><h1 className="h3 fw-bold mb-1">修改密碼</h1><p className="text-body-secondary">帳號：{account.code}</p><section className="card"><form action={changePassword} className="card-body p-4">
    {account.must_change_password && <div className="alert alert-warning">首次登入，請先設定自己的密碼。密碼可以與帳號相同。</div>}{error && <div className="alert alert-danger">密碼不可空白，且兩次輸入必須相同。</div>}
    <label className="form-label" htmlFor="password">新密碼</label><input className="form-control mb-3" id="password" name="password" type="password" required autoFocus />
    <label className="form-label" htmlFor="confirm">再次輸入</label><input className="form-control mb-4" id="confirm" name="confirm" type="password" required />
    <button className="btn btn-primary" type="submit">更新密碼</button>
  </form></section></main>;
}

import { loginTeacher } from "./actions";
import { teacherAuthConfigured } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const configured = teacherAuthConfigured();
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark login-mark"><i className="bi bi-mortarboard-fill" /></div>
        <p className="eyebrow mb-2">TEACHER ASSISTANT</p>
        <h1>老師登入</h1>
        <p className="text-body-secondary">登入後可使用成績管理與英文口說管理。</p>
        {!configured ? (
          <div className="alert alert-warning text-start mb-0">
            尚未設定 <code>TEACHER_PIN</code> 與 <code>SESSION_SECRET</code>，請先在 Vercel 環境變數完成設定。
          </div>
        ) : (
          <form action={loginTeacher} className="d-grid gap-3 mt-4">
            <input type="hidden" name="next" value={params.next || "/"} />
            <label className="text-start">
              <span className="form-label d-block">老師密碼</span>
              <input className="form-control form-control-lg" type="password" name="pin" autoComplete="current-password" required autoFocus />
            </label>
            {params.error === "1" && <div className="alert alert-danger py-2 mb-0">密碼錯誤，請再試一次。</div>}
            <button className="btn btn-primary btn-lg" type="submit">登入</button>
          </form>
        )}
      </section>
    </main>
  );
}

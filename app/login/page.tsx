import { login } from "@/app/actions";

export const metadata = { title: "登入 - Teacher Assistant" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="px-3 mx-auto" style={{ maxWidth: 420, marginTop: "10vh" }}>
      <div className="text-center mb-4"><i className="bi bi-mortarboard-fill text-primary" style={{ fontSize: "2.6rem" }} /><h1 className="h3 fw-bold mt-2 mb-1">Teacher Assistant</h1><p className="text-body-secondary">登入班級管理助手</p></div>
      <div className="card workflow-card"><div className="card-body p-4">
        {error && <div className="alert alert-danger py-2"><i className="bi bi-exclamation-circle me-2" />帳號或密碼錯誤，請再試一次。</div>}
        <form action={login}>
          <div className="mb-3"><label className="form-label fw-semibold" htmlFor="username">帳號</label><input id="username" type="text" name="username" className="form-control form-control-lg" autoComplete="username" autoFocus required /></div>
          <div className="mb-4"><label className="form-label fw-semibold" htmlFor="password">密碼</label><input id="password" type="password" name="password" className="form-control form-control-lg" autoComplete="current-password" required /></div>
          <button type="submit" className="btn btn-primary btn-lg w-100"><i className="bi bi-box-arrow-in-right me-2" />登入</button>
        </form>
      </div></div>
    </main>
  );
}

import { login } from "@/app/actions";

export const metadata = { title: "登入 - Teacher Assistant" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="px-3" style={{ maxWidth: 380, margin: "12vh auto" }}>
      <div className="text-center mb-4">
        <i className="bi bi-mortarboard-fill text-primary" style={{ fontSize: "2.4rem" }}></i>
        <h4 className="fw-bold mt-2 mb-0">Teacher Assistant</h4>
      </div>
      <div className="card p-4">
        {error && <div className="alert alert-danger py-2 small">帳號或密碼錯誤</div>}
        <form action={login}>
          <div className="mb-3">
            <label className="form-label fw-semibold small">帳號</label>
            <input type="text" name="username" className="form-control" autoFocus required />
          </div>
          <div className="mb-3">
            <label className="form-label fw-semibold small">密碼</label>
            <input type="password" name="password" className="form-control" required />
          </div>
          <button type="submit" className="btn btn-primary w-100">
            <i className="bi bi-box-arrow-in-right me-1"></i>登入
          </button>
        </form>
      </div>
    </div>
  );
}

import Link from "next/link";
import { logout } from "@/app/actions";

export default function Nav({ authEnabled }: { authEnabled: boolean }) {
  return (
    <nav className="navbar navbar-expand px-4 border-bottom">
      <Link className="navbar-brand fw-bold" href="/">
        <i className="bi bi-mortarboard-fill text-primary me-2"></i>Teacher Assistant
      </Link>
      <div className="ms-auto d-flex align-items-center gap-2">
        <Link className="nav-link" href="/">首頁</Link>
        {authEnabled && (
          <form action={logout}>
            <button className="btn btn-outline-secondary btn-sm" type="submit">
              <i className="bi bi-box-arrow-right me-1"></i>登出
            </button>
          </form>
        )}
      </div>
    </nav>
  );
}

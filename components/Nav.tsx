import Link from "next/link";
import { logout } from "@/app/actions";
import ThemeToggle from "@/components/ThemeToggle";

export default function Nav({ authEnabled }: { authEnabled: boolean }) {
  return (
    <nav className="navbar navbar-expand app-navbar border-bottom sticky-top">
      <Link className="navbar-brand fw-bold" href="/">
        <i className="bi bi-mortarboard-fill text-primary me-2" />
        <span className="d-none d-sm-inline">Teacher Assistant</span><span className="d-sm-none">TA</span>
      </Link>
      <div className="ms-auto d-flex align-items-center gap-2">
        <Link className="nav-link" href="/"><i className="bi bi-pencil-square me-1" />登記</Link>
        <Link className="nav-link" href="/admin"><i className="bi bi-grid-3x3-gap me-1" />統計</Link>
        <ThemeToggle />
        {authEnabled && <form action={logout}><button className="btn btn-outline-secondary btn-sm" type="submit" title="登出"><i className="bi bi-box-arrow-right" /><span className="d-none d-md-inline ms-1">登出</span></button></form>}
      </div>
    </nav>
  );
}

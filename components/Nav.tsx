import Link from "next/link";
import { logout } from "@/app/actions";
import ThemeToggle from "@/components/ThemeToggle";

export default function Nav({ authEnabled }: { authEnabled: boolean }) {
  return (
    <aside className="app-sidebar">
      <Link className="sidebar-brand" href="/">
        <span className="brand-mark"><i className="bi bi-mortarboard-fill" /></span>
        <span><strong>Teacher Assistant</strong><small>班級作業管理</small></span>
      </Link>

      <nav className="sidebar-nav" aria-label="主要功能">
        <span className="sidebar-label">工作區</span>
        <Link href="/"><i className="bi bi-pencil-square" /><span>作業登記</span></Link>
        <Link href="/admin"><i className="bi bi-bar-chart-fill" /><span>未交統計</span></Link>
      </nav>

      <div className="sidebar-footer">
        <div className="d-flex align-items-center justify-content-between">
          <span className="small text-body-secondary">顯示模式</span><ThemeToggle />
        </div>
        {authEnabled && <form action={logout}><button className="btn btn-outline-secondary w-100 mt-3" type="submit"><i className="bi bi-box-arrow-right me-2" />登出</button></form>}
      </div>
    </aside>
  );
}

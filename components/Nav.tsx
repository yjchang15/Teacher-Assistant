import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

export default function Nav() {
  return (
    <aside className="app-sidebar">
      <Link className="sidebar-brand" href="/">
        <span className="brand-mark"><i className="bi bi-mortarboard-fill" /></span>
        <span><strong>Teacher Assistant</strong><small>班級管理助手</small></span>
      </Link>

      <nav className="sidebar-nav" aria-label="主要功能">
        <span className="sidebar-label">登記</span>
        <Link href="/"><i className="bi bi-pencil-square" /><span>作業登記</span></Link>
        <span className="sidebar-label">報表</span>
        <Link href="/admin"><i className="bi bi-person-lines-fill" /><span>個人缺交列表</span></Link>
        <Link href="/admin/class-summary"><i className="bi bi-table" /><span>全班缺交總表</span></Link>
        <span className="sidebar-label">設定</span>
        <Link href="/admin/classes"><i className="bi bi-mortarboard" /><span>班級維護</span></Link>
        <Link href="/admin/maintenance"><i className="bi bi-tools" /><span>資料維護</span></Link>
      </nav>

      <div className="sidebar-footer">
        <div className="d-flex align-items-center justify-content-between">
          <span className="small text-body-secondary">顯示模式</span><ThemeToggle />
        </div>
      </div>
    </aside>
  );
}

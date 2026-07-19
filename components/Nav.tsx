import Link from "next/link";
import { logout } from "@/app/actions";
import ThemeToggle from "@/components/ThemeToggle";

export default function Nav({ account }: { account: { code: string; displayName: string; role: "admin" | "class" } | null }) {
  return (
    <aside className="app-sidebar">
      <Link className="sidebar-brand" href="/">
        <span className="brand-mark"><i className="bi bi-mortarboard-fill" /></span>
        <span><strong>Teacher Assistant</strong><small>班級管理助手</small></span>
      </Link>

      <nav className="sidebar-nav" aria-label="主要功能">
        <span className="sidebar-label">學生區</span>
        <Link href="/"><i className="bi bi-pencil-square" /><span>作業登記</span></Link>
        {account && <>
          <span className="sidebar-label">教師區</span>
          <Link href="/admin"><i className="bi bi-bar-chart-fill" /><span>缺交統計</span></Link>
          <Link href="/students"><i className="bi bi-people-fill" /><span>學生名單</span></Link>
        </>}
        {account?.role === "admin" && <>
          <span className="sidebar-label">管理員區</span>
          <Link href="/admin/accounts"><i className="bi bi-person-gear" /><span>班級帳號</span></Link>
        </>}
      </nav>

      <div className="sidebar-footer">
        <div className="d-flex align-items-center justify-content-between">
          <span className="small text-body-secondary">顯示模式</span><ThemeToggle />
        </div>
        {account && <><div className="small mt-3"><strong>{account.displayName}</strong>{account.code !== account.displayName && <><br/><span className="text-body-secondary">{account.code}</span></>}</div><Link className="btn btn-link btn-sm px-0" href="/password">修改密碼</Link><form action={logout}><button className="btn btn-outline-secondary w-100 mt-2" type="submit"><i className="bi bi-box-arrow-right me-2" />登出</button></form></>}
      </div>
    </aside>
  );
}

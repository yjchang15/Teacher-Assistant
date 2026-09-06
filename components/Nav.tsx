"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

const sections = [
  { label: "日常作業", items: [{ href: "/", icon: "bi-pencil-square", label: "作業登記", exact: true }] },
  { label: "追蹤報表", items: [
    { href: "/admin", icon: "bi-person-lines-fill", label: "學生缺交明細", exact: true },
    { href: "/admin/class-summary", icon: "bi-table", label: "班級缺交總覽" },
  ] },
  { label: "英文口說", items: [
    { href: "/speaking/index.html", icon: "bi-mic-fill", label: "學生練習", external: true },
    { href: "/speaking/teacher.html", icon: "bi-bar-chart-line-fill", label: "口說教學管理" },
  ] },
  { label: "系統管理", items: [
    { href: "/admin/classes", icon: "bi-mortarboard", label: "班級與座號" },
    { href: "/admin/maintenance", icon: "bi-tools", label: "缺交資料維護" },
  ] },
] as const;

export default function Nav() {
  const pathname = usePathname();
  return (
    <aside className="app-sidebar">
      <Link className="sidebar-brand" href="/" aria-label="Teacher Assistant 首頁">
        <span className="brand-mark" aria-hidden="true"><i className="bi bi-mortarboard-fill" /></span>
        <span><strong>Teacher Assistant</strong><small>成績與口說教學</small></span>
      </Link>
      <nav className="sidebar-nav" aria-label="主要功能">
        {sections.map((section) => <div className="sidebar-section" key={section.label}>
          <span className="sidebar-label">{section.label}</span>
          <div className="sidebar-links">
            {section.items.map((item) => {
              const active = "exact" in item && item.exact ? pathname === item.href : pathname.startsWith(item.href);
              const external = "external" in item && item.external;
              return <Link href={item.href} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} key={item.href}>
                <i className={`bi ${item.icon}`} aria-hidden="true" /><span>{item.label}</span>
                {external && <i className="bi bi-box-arrow-up-right nav-external" aria-hidden="true" />}
              </Link>;
            })}
          </div>
        </div>)}
      </nav>
      <div className="sidebar-footer"><div className="d-flex align-items-center justify-content-between"><span className="small text-body-secondary">顯示模式</span><ThemeToggle /></div></div>
    </aside>
  );
}

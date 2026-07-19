"use client";

import { useState, type ReactNode } from "react";

export default function AutoSubmitForm({ children, className }: { children: ReactNode; className?: string }) {
  const [loading, setLoading] = useState(false);
  return <form method="get" className={className} onChange={(event) => { setLoading(true); event.currentTarget.requestSubmit(); }}>
    {children}
    {loading&&<span className="small text-primary"><span className="spinner-border spinner-border-sm me-2"/>更新中…</span>}
  </form>;
}

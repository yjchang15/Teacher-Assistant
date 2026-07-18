"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function getCurrentTheme(): Theme {
  const saved = localStorage.getItem("theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-bs-theme", theme);
  document.documentElement.style.colorScheme = theme;
  localStorage.setItem("theme", theme);
  document.cookie = `theme=${theme};path=/;max-age=31536000;samesite=lax`;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const current = getCurrentTheme();
    applyTheme(current);
    const timer = window.setTimeout(() => setTheme(current), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className="btn btn-outline-secondary btn-sm theme-toggle"
      aria-label={theme ? `Switch to ${nextTheme} mode` : "Toggle color theme"}
      title={theme ? `Switch to ${nextTheme} mode` : "Toggle color theme"}
      onClick={() => {
        applyTheme(nextTheme);
        setTheme(nextTheme);
      }}
    >
      <i className={`bi ${theme === "dark" ? "bi-sun-fill" : "bi-moon-stars-fill"}`} aria-hidden="true" />
    </button>
  );
}

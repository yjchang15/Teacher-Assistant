import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Roboto, Roboto_Mono, Noto_Sans_TC } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import { AUTH_ENABLED } from "@/lib/auth";

// Google's UI type stack: Roboto (Latin) + Noto Sans TC (中文). Both variable.
const roboto = Roboto({ subsets: ["latin"], display: "swap", variable: "--font-roboto" });

// Monospace for tabular numbers.
const robotoMono = Roboto_Mono({ subsets: ["latin"], display: "swap", variable: "--font-roboto-mono" });

const notoTC = Noto_Sans_TC({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-noto-tc",
  preload: false, // CJK glyph set is huge — load on demand rather than preload
});

export const metadata: Metadata = {
  title: "Teacher Assistant",
  description: "教學助理系統",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Render the saved theme on the server so it survives layout revalidation.
  // The inline script below covers the first visit, before any cookie exists.
  const themeCookie = (await cookies()).get("theme")?.value;
  const theme = themeCookie === "dark" || themeCookie === "light" ? themeCookie : undefined;
  return (
    <html lang="zh-TW" suppressHydrationWarning data-bs-theme={theme} style={{ colorScheme: theme }} className={`${roboto.variable} ${robotoMono.variable} ${notoTC.variable}`}>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {/* Set the theme before first paint to avoid a light→dark flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t!=='dark'&&t!=='light'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-bs-theme',t);document.documentElement.style.colorScheme=t;document.cookie='theme='+t+';path=/;max-age=31536000;samesite=lax';}catch(e){}})();`,
          }}
        />
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet" />
        <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet" />
      </head>
      <body>
        <Nav authEnabled={AUTH_ENABLED} />
        <div className="app-content">
          {children}
        </div>
      </body>
    </html>
  );
}

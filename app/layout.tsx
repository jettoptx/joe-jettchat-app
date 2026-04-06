import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "JettChat — Encrypted AI Chat",
  description: "Post-quantum encrypted chat powered by OPTX and Grok",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>
          <div className="flex h-screen overflow-hidden">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Orbitron } from "next/font/google";
import { Providers } from "./providers";
import { AugmentOverlay } from "@/components/moa/AugmentOverlay";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const orbitron = Orbitron({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "JettChat — Encrypted Messaging",
  description: "End-to-end encrypted messaging powered by OPTX",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${jetbrainsMono.variable} ${orbitron.variable}`}
    >
      <body className="font-sans">
        <Providers>
          <div className="flex h-screen overflow-hidden">{children}</div>
          <AugmentOverlay />
        </Providers>
      </body>
    </html>
  );
}

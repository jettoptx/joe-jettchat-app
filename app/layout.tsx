import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Orbitron } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import { Providers } from "./providers";
import { AugmentOverlay } from "@/components/moa/AugmentOverlay";
import { ConvexUserSync } from "@/components/ConvexUserSync";
import { Suspense } from "react";
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
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${jetbrainsMono.variable} ${GeistMono.variable} ${orbitron.variable}`}
    >
      <body className="font-sans">
        <Providers>
          {/* Silent Convex sync for X OAuth flow - wrapped in Suspense to satisfy useSearchParams() */}
          <Suspense fallback={null}>
            <ConvexUserSync />
          </Suspense>

          <div className="flex h-screen overflow-hidden">{children}</div>
          <AugmentOverlay />
        </Providers>
      </body>
    </html>
  );
}

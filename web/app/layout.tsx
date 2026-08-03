import type {Metadata} from "next";
import {Sora} from "next/font/google";
import "./globals.css";
import {Providers} from "@/components/Providers";
import {AOSInit} from "@/components/AOSInit";

const sora = Sora({subsets: ["latin"], variable: "--font-sora", display: "swap"});

const title = "SpendArc - Agent Spending Control Plane";
const description =
  "Programmable spending controls for autonomous AI agents. Control what agents can spend, where they can spend it, and how much they can spend.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title,
  description,
  applicationName: "SpendArc",
  openGraph: {title, description, siteName: "SpendArc", type: "website"},
  twitter: {card: "summary_large_image", title, description},
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className={sora.variable}>
      <body>
        <Providers>{children}</Providers>
        <AOSInit />
      </body>
    </html>
  );
}

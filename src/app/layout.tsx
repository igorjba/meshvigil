import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MeshVigil — AMI Mesh Simulator & Observability Console",
    template: "%s · MeshVigil",
  },
  description:
    "A deterministic RF-mesh smart-metering simulator with chaos injection, live reconvergence, SLA telemetry and a real DLMS/COSEM frame parser at its core.",
  applicationName: "MeshVigil",
  authors: [{ name: "Igor" }],
  keywords: ["DLMS", "COSEM", "AMI", "smart metering", "RF mesh", "observability", "chaos engineering"],
  openGraph: {
    title: "MeshVigil — AMI Mesh Simulator & Observability Console",
    description:
      "Simulate an RF-mesh AMI network, inject chaos, and watch it reconverge — with a real DLMS/COSEM parser decoding every frame.",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#060910",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

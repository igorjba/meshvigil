import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MeshVigil — Simulador de Rede Mesh AMI e Console de Monitoramento",
    template: "%s · MeshVigil",
  },
  description:
    "Simulador determinístico de rede RF-mesh de medição inteligente, com injeção de caos, reconvergência ao vivo, telemetria de SLA e um parser DLMS/COSEM real no coração.",
  applicationName: "MeshVigil",
  authors: [{ name: "Igor" }],
  keywords: ["DLMS", "COSEM", "AMI", "medição inteligente", "RF mesh", "observabilidade", "engenharia de caos"],
  openGraph: {
    title: "MeshVigil — Simulador de Rede Mesh AMI e Console de Monitoramento",
    description:
      "Simule uma rede AMI RF-mesh, injete caos e veja a malha reconvergir — com um parser DLMS/COSEM real decodificando cada frame.",
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
    <html lang="pt-BR" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

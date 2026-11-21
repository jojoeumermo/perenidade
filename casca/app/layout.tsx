// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A página única da casca do chat. A política de segurança (CSP) entra no <head> de cada HTML na montagem (casca/montar.mjs), com o
// resumo de cada script em linha que o Next gera: nenhum script de fora, nenhum script em linha que não seja o do próprio build.
import type { Metadata, Viewport } from "next";
import "./casca.css";

export const metadata: Metadata = {
  title: "Instituto Lúcia",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-app="" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}

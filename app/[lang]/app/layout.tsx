// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { RedirecionarDoNavegador } from "@/components/app/RedirecionarDoNavegador";

// As telas da experiência do aplicativo instalado não entram na busca: quem pesquisa precisa cair no site.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * As rotas /app são a experiência própria do aplicativo instalado (docs/APP.md): o conteúdo só aparece com
 * <html data-app> (app/app-instalado.css); no navegador a pessoa é levada ao site. OHTML sai igual para todo mundo:
 * quem decide o que aparece é o CSS, pelo atributo posto antes da primeira pintura.
 */
export default function LayoutDaAreaDoApp({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RedirecionarDoNavegador />
      <div className="so-no-app">{children}</div>
    </>
  );
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { TextosDaFormacao } from "@/i18n/escola/formacao";

/**
 * "Como passar de degrau" (prancha Formação): estudar, praticar e a banca de passagem. A banca é marcada e decidida no
 * núcleo (F4, public.escola_banca_*): aqui só se explica o caminho.
 */
export function ComoPassar({ t }: { t: TextosDaFormacao["formacao"]["como"] }) {
  return (
    <section aria-labelledby="eff-como" className="eff-como">
      <h2 id="eff-como" className="ef-t">
        {t.titulo}
      </h2>
      <p>
        <strong style={{ color: "#F2C94C" }}>{t.estudar}</strong> {t.estudarTexto}
      </p>
      <p>
        <strong style={{ color: "#E8604C" }}>{t.praticar}</strong> {t.praticarTexto}
      </p>
      <p>
        <strong style={{ color: "#EA7A24" }}>{t.banca}</strong> {t.bancaTexto}
      </p>
    </section>
  );
}

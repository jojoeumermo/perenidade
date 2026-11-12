// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { ReactNode } from "react";
import { Lampiao } from "@/components/rede/ui/Lampiao";
import type { FiguraDaEntrada } from "@/lib/rede/entrada/figuras";
import type { TextosDaEntrada } from "@/lib/rede/entrada/textos";

/**
 * A cena da entrada da Alumia: a faixa tecida, o fundo vermelho e preto borrado com as silhuetas (fotos livres do Wikimedia
 * Commons, lib/rede/entrada/silhuetas.json), a cabeça com o lampião e o "Voltar ao site", e os créditos das imagens no pé.
 * As silhuetas são enfeite para quem vê (o grupo tem um nome só, para o leitor de tela); some no e-ink.
 */
export function Cena({ t, figuras, site, children }: { t: TextosDaEntrada; figuras: FiguraDaEntrada[]; site: string; children: ReactNode }) {
  return (
    <div className="ale" data-alumia-entrada="">
      <div aria-hidden className="ale-faixa" />
      <div className="ale-cena">
        <div className="ale-figuras" role="img" aria-label={t.figurasRotulo}>
          {figuras.map((f) => (
            // As silhuetas são pequenas (≈10 KB cada) e já saem prontas do roteiro: sem o otimizador de imagens.
            // eslint-disable-next-line @next/next/no-img-element
            <img key={f.id} src={`/${f.src}`} alt="" width={480} height={640} decoding="async" fetchPriority="low" />
          ))}
        </div>
      </div>
      <header className="ale-cabeca" aria-label={t.rotuloCabeca}>
        <span className="ale-marca">
          <Lampiao tamanho={34} />
          <span>
            <span className="ale-cond ale-marca-nome">Alumia</span>
            <span className="ale-marca-inst">{t.instituto}</span>
          </span>
        </span>
        <a className="ale-voltar" href={site}>
          {t.voltar}
        </a>
      </header>
      {children}
      <details className="ale-creditos">
        <summary>{t.creditos}</summary>
        <p>{t.creditosTexto}</p>
        <ul>
          {figuras.map((f) => (
            <li key={f.id}>
              <strong>{f.nome}</strong> · {t.creditosAutor}: {f.credito.autor} · {t.creditosLicenca}:{" "}
              {f.credito.licencaUrl ? (
                <a href={f.credito.licencaUrl} rel="license noopener noreferrer" target="_blank">
                  {f.credito.licenca}
                </a>
              ) : (
                f.credito.licenca
              )}{" "}
              · {t.creditosFonte}:{" "}
              <a href={f.credito.fonte} rel="noopener noreferrer" target="_blank">
                Wikimedia Commons
              </a>
              {f.credito.cuidado ? <span> · {f.credito.cuidado}</span> : null}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

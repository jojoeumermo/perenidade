// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import { site } from "@/lib/site";

/**
 * O modelo do certificado comunitário do percurso Consciência de classe, desenhado na mesma folha A4 deitada do
 * certificado de trabalho voluntário do painel (components/painel/Certificado.tsx): moldura dupla, emblema, marca-d'água,
 * nome sobre a linha dourada, linhas de assinatura e rodapé em letra de arquivo. As medidas vêm das classes
 * .certificado-* do globals.css, que escalam com a largura da folha.
 *
 * É só o modelo, com a faixa "Modelo · sem validade" por cima: o certificado de verdade é preenchido e assinado pelo
 * núcleo, não sai do site e não tem número de conferência. Fica fora da impressão da página (no-print), porque a regra
 * de impressão do .certificado ocupa a folha inteira. É sempre um documento em português.
 */
export function CertificadoComunitario({ etapas, rotulo, nota }: { etapas: number; rotulo: string; nota: string }) {
  return (
    <figure className="no-print" aria-label={rotulo}>
      <div className="border border-rule shadow-[0_10px_30px_-12px_rgb(0_0_0/0.35)]">
        <article className="certificado" lang="pt-BR" translate="no">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/marca.png" alt="" className="certificado-fundo" />
          <p className="certificado-previa" aria-hidden>Modelo · sem validade</p>
          <div className="certificado-folha">
            <header>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/marca.png" alt="" className="certificado-emblema" />
              <p className="certificado-casa">{site.name}</p>
              <p className="certificado-titulo">Certificado</p>
              <p className="certificado-subtitulo">comunitário de formação</p>
            </header>
            <div className="certificado-corpo">
              <p>O {site.name} e o núcleo de estudo abaixo reconhecem que</p>
              <p className="certificado-nome">Nome de quem concluiu</p>
              <p>
                concluiu o percurso de formação <strong>“Consciência de classe”</strong>, em <strong>{etapas} etapas</strong>, com aulas, leituras do acervo, tarefas no mundo real
                e encontros no núcleo.
              </p>
              <p className="certificado-lei">Certificado comunitário de educação popular, assinado pelo núcleo. Não é título oficial do Estado: vale pelo que a pessoa aprendeu e pelo que fez com isso.</p>
            </div>
            <ul className="certificado-assinaturas">
              <li>
                <span className="certificado-selo">Local e data</span>
                <span className="certificado-assina">Núcleo de estudo</span>
                <span className="certificado-cargo">Nome do núcleo</span>
              </li>
              <li>
                <span className="certificado-selo">Assinatura</span>
                <span className="certificado-assina">Pelo núcleo</span>
                <span className="certificado-cargo">Quem acompanhou o percurso</span>
              </li>
              <li>
                <span className="certificado-selo">Assinatura</span>
                <span className="certificado-assina">Pelo núcleo</span>
                <span className="certificado-cargo">Colega de núcleo</span>
              </li>
            </ul>
            <footer>
              <p>Certificado comunitário · {site.name} · escola popular e gratuita · percurso Consciência de classe</p>
            </footer>
          </div>
        </article>
      </div>
      <figcaption className="mt-2 font-sans text-xs text-ink-soft">{nota}</figcaption>
    </figure>
  );
}

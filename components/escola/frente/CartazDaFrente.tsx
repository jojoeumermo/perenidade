// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import type { TextosDaFrente } from "@/i18n/escola/frente";
import "@/styles/escola-frente.css";

/** A estrela de cinco pontas do cartaz, desenhada à mão (nada de pacote de ícones). Decorativa. */
export function Estrela({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden focusable="false" className={className}>
      <path fill="currentColor" d="M50 3l13.6 30.9 33.6 3.4-25.2 22.5 7.3 33L50 75.9 20.7 92.8l7.3-33L2.8 37.3l33.6-3.4z" />
    </svg>
  );
}

/**
 * O cartaz da Escola Revolucionária Lúcia Maria (T15): no alto, a faixa preta com o nome da Frente Revolucionária
 * Lúcia (o lugar de destaque); o nome da Escola em letra de cartaz; o lema; a linha da Escola; e o chamado de
 * voluntários militantes, com os botões "Quero militar" (/escola/militantes) e "Ler o manifesto". Serve à entrada
 * (com a conta) e à porta (sem conta): o chamado aparece para todo mundo. Sem estado e sem JavaScript.
 */
export function CartazDaFrente({ lang, s, olho, titulo, linha, h1 = true, chamado = true }: { lang: Locale; s: TextosDaFrente["cartaz"]; olho: string; titulo: string; linha: React.ReactNode; h1?: boolean; chamado?: boolean }) {
  const Titulo = h1 ? "h1" : "h2";
  return (
    <header className="frente-cartaz" data-cartaz-da-frente="">
      <p className="frente-faixa">
        <Estrela className="frente-estrela" />
        <span data-frente-revolucionaria="">{s.frente}</span>
        <span aria-hidden>·</span>
        <span>{s.formacao}</span>
      </p>
      <div className="frente-corpo">
        <Estrela className="frente-estrela-grande" />
        <p className="frente-olho">{olho}</p>
        <Titulo className="frente-titulo">{titulo}</Titulo>
        <p className="frente-lema">{s.lema}</p>
        <div className="frente-linha">{linha}</div>
        {chamado && (
          <section className="frente-chamado" aria-labelledby="frente-chamado-titulo" data-chamado-militante="">
            <p className="frente-chamado-rotulo">{s.rotulo}</p>
            <h2 id="frente-chamado-titulo" className="frente-chamado-titulo">
              {s.chamado}
            </h2>
            <p className="frente-chamado-texto">{s.chamadoTexto}</p>
            <p className="frente-botoes">
              <Link href={localePath(lang, "/escola/militantes")} className="frente-botao" data-quero-militar="">
                {s.quero} →
              </Link>
              <Link href={localePath(lang, "/escola/manifesto")} className="frente-botao frente-botao-vazado">
                {s.manifesto}
              </Link>
            </p>
          </section>
        )}
      </div>
    </header>
  );
}

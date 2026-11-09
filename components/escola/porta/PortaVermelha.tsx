// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import type { TextosDaFormacaoBase } from "@/i18n/escola/formacao-base";
import { FaixaDeCores, Estrela } from "../casca/FaixaDeCores";

export type SituacaoNaPorta = "sem-conta" | "sem-militancia" | "sem-servico" | "falha";

const CORES_DOS_DEGRAUS = ["#F2C94C", "#E8604C", "#EA7A24"];

/**
 * A porta vermelha da Escola (prancha Porta): o que a Escola é, como entrar em 4 passos e os 3 degraus. É o que todo
 * mundo que NÃO é militante vê em /escola (e em qualquer página fechada da Escola). Não tem nada de militante: só texto
 * público. "Já sou militante: entrar" leva a /entrar e volta para cá; quem já entrou e ainda não é militante vê o aviso
 * de que a inscrição está com a coordenação.
 */
export function PortaVermelha({ lang, t, situacao, aoTentar }: { lang: Locale; t: TextosDaFormacaoBase["porta"]; situacao: SituacaoNaPorta; aoTentar?: () => void }) {
  return (
    <div className="ef-porta" data-escola-formacao="" data-porta-da-escola="fechada" data-situacao={situacao}>
      <FaixaDeCores />
      <header className="ef-porta-cabeca">
        <Link href={localePath(lang, "/")} className="ef-porta-instituto">
          {t.instituto}
        </Link>
        <span aria-hidden className="ef-porta-barra">
          /
        </span>
        <span className="ef-porta-escola">{t.escola}</span>
        {situacao === "sem-conta" && (
          <Link href={localePath(lang, "/entrar?volta=/escola")} className="ef-porta-entrar" data-porta-entrar="">
            {t.entrar}
          </Link>
        )}
      </header>

      <div className="ef-porta-corpo">
        {situacao !== "sem-conta" && (
          <p role="status" className="ef-porta-aviso">
            {situacao === "sem-militancia" ? t.semMilitancia : situacao === "sem-servico" ? t.semServico : t.falha}
            {situacao === "falha" && aoTentar && (
              <button type="button" className="ef-porta-tentar" onClick={aoTentar}>
                {t.tentar}
              </button>
            )}
          </p>
        )}

        <section className="ef-porta-hero">
          <Estrela tamanho={300} cheia className="ef-porta-estrela-fundo" />
          <div className="ef-porta-frente">
            <Estrela tamanho={56} traco={3.2} />
            <span>{t.frente}</span>
          </div>
          <h1 className="ef-t ef-porta-titulo">{t.titulo}</h1>
          <p className="ef-t ef-porta-lema">{t.lema}</p>
          <p className="ef-porta-texto">{t.texto}</p>
          <div className="ef-porta-acoes">
            <Link href={localePath(lang, "/escola/militantes")} className="ef-botao-vermelho ef-botao-grande">
              {t.quero}
            </Link>
            <Link href={localePath(lang, "/escola/manifesto")} className="ef-botao-vazado ef-botao-grande">
              {t.manifesto}
            </Link>
          </div>
          <p className="ef-porta-resto">
            {t.resto} <Link href={localePath(lang, "/trilhas")}>{t.aulas}</Link>, <Link href={localePath(lang, "/acervo")}>{t.acervo}</Link>,{" "}
            <Link href={localePath(lang, "/jornal")}>{t.jornal}</Link>, <Link href={localePath(lang, "/alumia")}>{t.alumia}</Link>.
          </p>
        </section>

        <section aria-labelledby="ef-como" className="ef-porta-como">
          <h2 id="ef-como" className="ef-t">
            {t.comoEntrar}
          </h2>
          <ol className="ef-passos">
            {t.passos.map((p, i) => (
              <li key={p.titulo} className="ef-passo">
                <span aria-hidden className={`ef-t ef-passo-n${i === t.passos.length - 1 ? " ef-passo-n-ouro" : ""}`}>
                  {i + 1}
                </span>
                <span>
                  <strong>{p.titulo}</strong>
                  <span className="ef-passo-texto">{p.texto}</span>
                </span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="ef-degraus" className="ef-porta-degraus">
          <h2 id="ef-degraus" className="ef-t">
            {t.degrausTitulo}
          </h2>
          <div className="ef-degraus">
            {t.degraus.map((d, i) => (
              <div key={d.rotulo} className="ef-degrau" style={{ background: CORES_DOS_DEGRAUS[i] }}>
                <span className="ef-t ef-degrau-rotulo">{d.rotulo}</span>
                <p className="ef-t ef-degrau-nome">{d.nome}</p>
                <p className="ef-degrau-texto">{d.texto}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

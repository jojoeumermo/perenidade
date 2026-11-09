// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "./stories.css";
import { useEffect, useState, type CSSProperties } from "react";
import { armazemDoAparelho, grupoVisto, lerSilenciados, lerVistos, ordenarFaixa, primeiroNaoVisto } from "@/lib/rede/stories/aparelho";
import { anelEmCss, nomeCurto } from "@/lib/rede/stories/visual";
import type { ClienteDeStories } from "@/lib/rede/cliente-stories";
import type { TextosDosStories } from "@/lib/rede/textos-stories";
import type { AutoraDoStory, FaixaDeStories as DadosDaFaixa, GrupoDaFaixa } from "@/lib/rede/tipos-stories";
import { Avatar16 } from "../ui/Avatar16";
import { IconeMais, IconeOlhoRiscado } from "./icones";
import { codigoDoErro, preencherStory } from "./usar";

/** O rosto da bolinha: o mesmo rosto de 16 cartões do perfil, dentro do anel colorido (ou cinza, se já vi; só o aparelho sabe). */
function Bolinha({ autora, visto, rotulo, aoAbrir }: { autora: AutoraDoStory; visto: boolean; rotulo: string; aoAbrir: () => void }) {
  return (
    <button type="button" className="al-st-bolinha" data-visto={visto ? "sim" : "nao"} aria-label={rotulo} onClick={aoAbrir}>
      <span className="al-st-anel" style={{ "--al-st-anel": anelEmCss(autora.handle, visto) } as CSSProperties}>
        <span className="al-st-anel-miolo">
          <Avatar16 handle={autora.handle} cor={autora.cor ?? undefined} tamanho={52} />
        </span>
      </span>
      <span className="al-st-nome" aria-hidden>
        {nomeCurto(autora.nome)}
      </span>
    </button>
  );
}

/**
 * A faixa de stories no alto da linha (prancha celular-stories-na-linha): "Seu story" com o +, as bolinhas de quem eu posso ver
 * com o anel colorido, e a frase "Ninguém fica sabendo que você viu. Some em 24 h." — que é verdade porque abrir um story é só
 * uma leitura: o "já vi" (anel cinza) fica no aparelho (lib/rede/stories/aparelho.ts), nunca no servidor (PLANO-ALUMIA §6.4).
 */
export function FaixaDeStories({
  t,
  cliente,
  eu,
  logado,
  versao = 0,
  aoAbrir,
  aoCriar,
}: {
  t: TextosDosStories;
  cliente: ClienteDeStories;
  /** Eu (o rosto da bolinha "Seu story"); nulo sem conta. */
  eu: AutoraDoStory | null;
  logado: boolean;
  /** Muda quando algo foi publicado/apagado/visto, para a faixa reler. */
  versao?: number;
  /** Abre o visor numa autora ("eu" = os meus), a partir do story i. */
  aoAbrir: (handle: string, i: number, fila: string[]) => void;
  aoCriar: () => void;
}) {
  const [dados, setDados] = useState<DadosDaFaixa | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const [aparelho, setAparelho] = useState<{ vistos: Record<string, number>; silenciados: string[] }>({ vistos: {}, silenciados: [] });

  useEffect(() => {
    if (!logado) return;
    let vivo = true;
    cliente
      .faixa()
      .then((d) => {
        if (!vivo) return;
        // O que eu já vi e de quem silenciei: só deste aparelho, lido junto com a faixa.
        const a = armazemDoAparelho();
        setAparelho({ vistos: lerVistos(a, Date.now()), silenciados: lerSilenciados(a) });
        setDados(d);
        setErro(null);
      })
      .catch((e) => vivo && setErro(codigoDoErro(e)));
    return () => {
      vivo = false;
    };
  }, [cliente, logado, versao, tentativa]);

  const grupos = dados ? ordenarFaixa(dados.grupos, aparelho.vistos, aparelho.silenciados) : [];
  const fila = grupos.map((g) => g.autora.handle);
  const abrir = (g: GrupoDaFaixa) => aoAbrir(g.autora.handle, primeiroNaoVisto(g, aparelho.vistos), fila);
  const meus = dados?.meus.length ?? 0;

  return (
    <section className="al-st-faixa" aria-label={t.faixa.rotulo}>
      {!logado ? (
        <p className="al-st-erro">{t.faixa.entrar}</p>
      ) : (
        <ul className="al-st-faixa-trilho" aria-busy={!dados && !erro}>
          <li className="al-st-faixa-item">
            <button
              type="button"
              className="al-st-bolinha"
              aria-label={meus > 0 ? preencherStory(t.faixa.verOsSeus, { n: meus }) : t.faixa.criar}
              onClick={() => (meus > 0 ? aoAbrir("eu", 0, fila) : aoCriar())}
            >
              <span className={`al-st-anel al-st-anel-seu${meus > 0 ? " al-st-no-ar" : ""}`}>
                <span className="al-st-anel-miolo">
                  <Avatar16 handle={eu?.handle ?? "voce"} cor={eu?.cor ?? undefined} tamanho={52} />
                </span>
                {meus === 0 ? (
                  <span className="al-st-mais" aria-hidden>
                    <IconeMais />
                  </span>
                ) : null}
              </span>
              <span className="al-st-nome" aria-hidden>
                {t.faixa.seuStory}
              </span>
            </button>
            {meus > 0 ? (
              <button type="button" className="sr-only" onClick={aoCriar}>
                {t.faixa.criar}
              </button>
            ) : null}
          </li>
          {!dados && !erro
            ? [0, 1, 2, 3].map((i) => (
                <li key={i} className="al-st-faixa-item" aria-hidden>
                  <span className="al-st-esqueleto" />
                </li>
              ))
            : grupos.map((g) => {
                const visto = grupoVisto(g, aparelho.vistos);
                return (
                  <li key={g.autora.handle} className="al-st-faixa-item">
                    <Bolinha
                      autora={g.autora}
                      visto={visto}
                      rotulo={preencherStory(visto ? t.faixa.verVisto : t.faixa.ver, { nome: g.autora.nome })}
                      aoAbrir={() => abrir(g)}
                    />
                  </li>
                );
              })}
        </ul>
      )}
      {erro ? (
        <p className="al-st-erro" role="status">
          {erro === "banco" ? t.criar.erro.banco : t.faixa.erro}
          <button type="button" className="al-botao al-botao-fantasma al-botao-p" onClick={() => setTentativa((n) => n + 1)}>
            {t.faixa.tentar}
          </button>
        </p>
      ) : null}
      <p className="al-st-aviso">
        <IconeOlhoRiscado />
        <span>{t.faixa.aviso}</span>
      </p>
    </section>
  );
}

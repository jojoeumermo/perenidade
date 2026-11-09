// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { CSSProperties } from "react";
import { corValida, fundoListrado, mosaicoDeFundo, PALETA_DO_STORY } from "@/lib/rede/stories/visual";
import type { CorDoStory } from "@/lib/rede/tipos-stories";

const COLUNAS = 18;
const LINHAS = 34;

/** As variáveis de cor da tela de um story (o e-ink e o alto contraste trocam por papel/preto em stories.css). */
export function estiloDaTela(cor: CorDoStory, extra: CSSProperties = {}): CSSProperties {
  const p = PALETA_DO_STORY[corValida(cor)];
  return { "--st-fundo": p.fundo, "--st-texto": p.texto, ...extra } as CSSProperties;
}

/**
 * O fundo de um story: listras diagonais (prancha "criar story"), mosaico de cartões (prancha "ver story": a mesma linguagem do
 * mosaico do ato, sorteado pelo id do story) ou a imagem da galeria/desenho. Decorativo: o que o story diz está no texto e no
 * "alt" da imagem, que quem vê lê pelo leitor de tela.
 */
export function FundoDoStory({ tipo, cor, semente, url, alt }: { tipo: "listras" | "mosaico" | "imagem"; cor: CorDoStory; semente: string; url?: string; alt?: string }) {
  if (tipo === "imagem" && url) {
    return (
      <div className="al-st-fundo al-st-fundo-imagem">
        {/* Endereço assinado e de vida curta (ou local, na prévia): sem otimização do Next, que guardaria a imagem em cache. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={alt ?? ""} referrerPolicy="no-referrer" decoding="async" />
      </div>
    );
  }
  if (tipo === "mosaico") {
    const cartoes = mosaicoDeFundo(semente, cor, COLUNAS, LINHAS);
    return (
      <div className="al-st-fundo" aria-hidden>
        <svg viewBox={`0 0 ${COLUNAS * 22} ${LINHAS * 22}`} preserveAspectRatio="xMidYMid slice">
          <rect width={COLUNAS * 22} height={LINHAS * 22} fill={PALETA_DO_STORY[corValida(cor)].listra} />
          {cartoes.map((c, i) => (
            <rect key={i} x={(i % COLUNAS) * 22 + 1.5} y={Math.floor(i / COLUNAS) * 22 + 1.5} width={19} height={19} rx={1.5} fill={c} />
          ))}
        </svg>
      </div>
    );
  }
  return <div className="al-st-fundo" aria-hidden style={{ background: fundoListrado(cor) }} />;
}

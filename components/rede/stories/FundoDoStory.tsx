// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { useState, type CSSProperties, type Ref } from "react";
import { corValida, fundoListrado, mosaicoDeFundo, PALETA_DO_STORY } from "@/lib/rede/stories/visual";
import type { CorDoStory, FundoDoStory as Fundo } from "@/lib/rede/tipos-stories";

const COLUNAS = 26;
const LINHAS = 48;

/** As variáveis de cor da tela de um story (o e-ink e o alto contraste trocam por papel/preto em stories.css). */
export function estiloDaTela(cor: CorDoStory, extra: CSSProperties = {}): CSSProperties {
  const p = PALETA_DO_STORY[corValida(cor)];
  return { "--st-fundo": p.fundo, "--st-texto": p.texto, ...extra } as CSSProperties;
}

/**
 * O fundo de um story: listras diagonais (prancha "criar story"), mosaico de cartões (prancha "ver story": a mesma linguagem do
 * mosaico do ato, sorteado pelo id do story), a imagem ou o vídeo. O mosaico e as listras são decorativos; a imagem e o vídeo
 * levam o "alt" que a autora escreveu. O vídeo é controlado de fora (o visor toca, pausa e liga o som pelo `videoRef`).
 */
export function FundoDoStory({
  tipo,
  cor,
  semente,
  url,
  urlMenor,
  alt,
  videoRef,
  mudo = true,
  aoEsperar,
  aoTocar,
  aoAcabar,
}: {
  tipo: Fundo["tipo"];
  cor: CorDoStory;
  semente: string;
  url?: string;
  /** P5: a versão menor da foto, que aparece na hora enquanto a alta chega. */
  urlMenor?: string;
  alt?: string;
  videoRef?: Ref<HTMLVideoElement>;
  mudo?: boolean;
  aoEsperar?: () => void;
  aoTocar?: () => void;
  aoAcabar?: () => void;
}) {
  if (tipo === "video" && url) {
    return (
      <div className="al-st-fundo al-st-fundo-imagem al-st-fundo-video">
        {/* Endereço assinado e de vida curta (ou local, na prévia). Sem controles nativos: o visor é o controle (barras, pausa, som). */}
        <video
          ref={videoRef}
          src={url}
          muted={mudo}
          playsInline
          preload="auto"
          disablePictureInPicture
          disableRemotePlayback
          controlsList="nodownload noplaybackrate noremoteplayback"
          aria-label={alt}
          onWaiting={aoEsperar}
          onStalled={aoEsperar}
          onPlaying={aoTocar}
          onEnded={aoAcabar}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
    );
  }
  if (tipo === "imagem" && url) return <FotoDoStory key={url} url={url} urlMenor={urlMenor} alt={alt} />;
  if (tipo === "mosaico" || tipo === "video") {
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

/**
 * P5 (A16): a foto do story em alta, com a versão menor por baixo enquanto a alta não chega (quem vê não espera a foto grande para
 * ver alguma coisa). Sem a menor (story de antes), é a foto de sempre.
 */
function FotoDoStory({ url, urlMenor, alt }: { url: string; urlMenor?: string; alt?: string }) {
  const [pronta, setPronta] = useState(false);
  return (
    <div className="al-st-fundo al-st-fundo-imagem">
      {/* Endereços assinados e de vida curta (ou locais, na prévia): sem otimização do Next, que guardaria a imagem em cache. */}
      {urlMenor && !pronta ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="al-st-fundo-menor" src={urlMenor} alt="" aria-hidden referrerPolicy="no-referrer" decoding="async" />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={urlMenor ? "al-st-fundo-alta" : undefined}
        data-pronta={urlMenor ? (pronta ? "sim" : "nao") : undefined}
        src={url}
        alt={alt ?? ""}
        referrerPolicy="no-referrer"
        decoding="async"
        onLoad={() => setPronta(true)}
      />
    </div>
  );
}

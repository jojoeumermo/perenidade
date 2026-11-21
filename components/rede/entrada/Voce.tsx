// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O painel de quem chega (o último da parede da entrada) e o rosto pequeno do formulário. Enquanto a pessoa escreve o codinome,
// o painel forma o desenho dela (P5, A2: o mesmo do rosto na rede, lib/rede/desenhos.ts), ladrilho por ladrilho; quem escolhe mostrar a própria foto vê a foto se formar.
//
// Privacidade: tudo aqui acontece no aparelho. O codinome que alimenta o desenho é o que está no campo (ou o da conta que
// acabou de entrar); a foto é lida do arquivo escolhido, direto na memória da página, e NÃO é enviada a lugar nenhum nem
// guardada (nem em localStorage): some ao fechar ou recarregar a página. Ninguém mais vê este painel.
import { createContext, type CSSProperties, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { LADO_DO_DESENHO } from "@/lib/rede/desenhos";
import type { TextosDaEntrada } from "@/lib/rede/entrada/textos";
import { atrasosDoPainel, COLUNAS_DO_PAINEL, coresDoRosto, LINHAS_DO_PAINEL, painelDaFoto, painelDoCodinome, painelVazio, sementeDoCodinome } from "@/lib/rede/entrada/voce";

export interface FotoDeVoce {
  /** Endereço local (blob:) da imagem escolhida: só existe nesta página. */
  url: string;
  /** A foto reduzida a uma cor por casa do painel, para a animação dos ladrilhos. */
  casas: string[];
}

interface Voce {
  codinome: string;
  foto: FotoDeVoce | null;
  definirCodinome: (codinome: string) => void;
  definirFoto: (foto: FotoDeVoce | null) => void;
}

const Contexto = createContext<Voce>({ codinome: "", foto: null, definirCodinome: () => undefined, definirFoto: () => undefined });

export function ProvedorDeVoce({ children }: { children: ReactNode }) {
  const [codinome, setCodinome] = useState("");
  const [foto, setFoto] = useState<FotoDeVoce | null>(null);
  const atual = useRef<FotoDeVoce | null>(null);
  const definirCodinome = useCallback((c: string) => setCodinome(c), []);
  const definirFoto = useCallback((f: FotoDeVoce | null) => {
    // A foto anterior sai da memória assim que outra entra (ou que a pessoa volta ao mosaico).
    if (atual.current && atual.current.url !== f?.url) URL.revokeObjectURL(atual.current.url);
    atual.current = f;
    setFoto(f);
  }, []);
  useEffect(
    () => () => {
      if (atual.current) URL.revokeObjectURL(atual.current.url);
    },
    [],
  );
  const valor = useMemo(() => ({ codinome, foto, definirCodinome, definirFoto }), [codinome, foto, definirCodinome, definirFoto]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export const useVoce = () => useContext(Contexto);

/**
 * Lê a foto escolhida, no aparelho: recorta no retrato 3:4 (pelo meio, um pouco acima) e reduz a uma cor por casa do painel.
 * Recusa o que não é imagem ou é grande demais para abrir com folga num celular simples (12 MB).
 */
export async function lerFoto(arquivo: File): Promise<FotoDeVoce> {
  if (!/^image\/(jpeg|png|webp)$/.test(arquivo.type) || arquivo.size > 12 * 1024 * 1024) throw new Error("foto");
  const imagem = await createImageBitmap(arquivo);
  try {
    const alvo = COLUNAS_DO_PAINEL / LINHAS_DO_PAINEL;
    const largura = Math.min(imagem.width, imagem.height * alvo);
    const altura = largura / alvo;
    const x = (imagem.width - largura) / 2;
    const y = Math.max(0, (imagem.height - altura) * 0.3);
    // Dois passos (primeiro 10 vezes a grade, depois a grade): reduzir de uma vez só deixa a cor de cada casa ao acaso.
    const meio = document.createElement("canvas");
    meio.width = COLUNAS_DO_PAINEL * 10;
    meio.height = LINHAS_DO_PAINEL * 10;
    const c1 = meio.getContext("2d");
    const fim = document.createElement("canvas");
    fim.width = COLUNAS_DO_PAINEL;
    fim.height = LINHAS_DO_PAINEL;
    const c2 = fim.getContext("2d", { willReadFrequently: true });
    if (!c1 || !c2) throw new Error("foto");
    c1.imageSmoothingQuality = "high";
    c1.drawImage(imagem, x, y, largura, altura, 0, 0, meio.width, meio.height);
    c2.imageSmoothingQuality = "high";
    c2.drawImage(meio, 0, 0, fim.width, fim.height);
    return { url: URL.createObjectURL(arquivo), casas: painelDaFoto(c2.getImageData(0, 0, fim.width, fim.height).data) };
  } finally {
    imagem.close();
  }
}

const semMovimento = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.hasAttribute("data-parado");

/** Cada casa do painel, em pontos do canvas (o CSS estica para o tamanho do painel; o rejunte vem por cima, da parede). */
const CASA = 16;
const DURACAO = 1100;
const QUEDA = 0.3;

/**
 * O último painel da parede. Vazio: noite, umas brasas, a moldura tracejada e "VOCÊ". Com codinome: o desenho dele, com os
 * ladrilhos assentando de cima para baixo. Com foto: os ladrilhos assentam nas cores dela e a foto aparece por baixo do rejunte.
 * Decorativo para o leitor de tela (a parede tem um nome só, e a legenda embaixo anuncia a mudança).
 */
export function PainelDeVoce({ t, indice }: { t: TextosDaEntrada; indice: number }) {
  const { codinome, foto } = useVoce();
  const tela = useRef<HTMLCanvasElement>(null);
  const pintadas = useRef<string[] | null>(null);
  const semente = sementeDoCodinome(codinome);
  const [revelada, setRevelada] = useState<string | null>(null);

  useEffect(() => {
    const canvas = tela.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const alvo = foto ? foto.casas : painelDoCodinome(codinome);
    const chave = foto ? foto.url : null;
    const pintar = (casas: string[]) => {
      for (let i = 0; i < casas.length; i++) {
        ctx.fillStyle = casas[i];
        ctx.fillRect((i % COLUNAS_DO_PAINEL) * CASA, Math.floor(i / COLUNAS_DO_PAINEL) * CASA, CASA, CASA);
      }
    };
    // A primeira pintura (o painel como ele chega) não tem animação: nada assentou ainda.
    if (!pintadas.current) {
      pintadas.current = painelVazio();
      pintar(pintadas.current);
    }
    const de = pintadas.current;
    if (de.every((cor, i) => cor === alvo[i])) {
      const quadro = requestAnimationFrame(() => setRevelada(chave));
      return () => cancelAnimationFrame(quadro);
    }
    let quadro = 0;
    // Espera a pessoa parar de digitar um instante: o painel não fica piscando a cada letra.
    const espera = window.setTimeout(() => {
      if (semMovimento()) {
        pintar(alvo);
        pintadas.current = alvo;
        setRevelada(chave);
        return;
      }
      const atrasos = atrasosDoPainel(foto ? "foto" : semente);
      let inicio = 0;
      const passo = (agora: number) => {
        inicio ||= agora;
        const p = Math.min(1, (agora - inicio) / DURACAO);
        pintar(de);
        for (let i = 0; i < alvo.length; i++) {
          if (alvo[i] === de[i]) continue;
          const local = (p - atrasos[i] * (1 - QUEDA)) / QUEDA;
          if (local <= 0) continue;
          const e = local >= 1 ? 1 : 1 - Math.pow(1 - local, 3);
          const x = (i % COLUNAS_DO_PAINEL) * CASA;
          const y = Math.floor(i / COLUNAS_DO_PAINEL) * CASA;
          const folga = (1 - e) * CASA * 0.35;
          ctx.globalAlpha = Math.min(1, local * 1.6);
          ctx.fillStyle = alvo[i];
          ctx.fillRect(x - folga / 2, y - (1 - e) * CASA * 1.1 - folga / 2, CASA + folga, CASA + folga);
          ctx.globalAlpha = 1;
        }
        if (p < 1) {
          quadro = requestAnimationFrame(passo);
        } else {
          pintar(alvo);
          pintadas.current = alvo;
          setRevelada(chave);
        }
      };
      quadro = requestAnimationFrame(passo);
    }, 240);
    return () => {
      window.clearTimeout(espera);
      cancelAnimationFrame(quadro);
      // Interrompido no meio (outra letra, outra foto): o que vale como ponto de partida é o que já estava assentado.
      if (pintadas.current) pintar(pintadas.current);
    };
  }, [codinome, semente, foto]);

  const aceso = Boolean(foto || semente);
  // O lugar na grade é escrito (o painel e a frente dele ocupam a mesma casa), para as duas grades da parede: 5 colunas no
  // computador e 3 no celular (styles/alumia-entrada.css escolhe). No celular, sozinho na última fileira, ele vai para o meio.
  const sozinho = indice % 3 === 0;
  const lugar = {
    "--voce-c5": (indice % 5) + 1,
    "--voce-l5": Math.floor(indice / 5) + 1,
    "--voce-c3": sozinho ? 2 : (indice % 3) + 1,
    "--voce-l3": Math.floor(indice / 3) + 1,
  } as CSSProperties;
  return (
    <>
      <span className="ale-painel ale-voce" data-revelada={foto && revelada === foto.url ? "" : undefined} style={{ ...lugar, ["--i" as string]: indice }}>
        {/* A foto de quem escolheu aparecer: blob: local, por baixo dos ladrilhos, sem pedido à rede. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {foto ? <img src={foto.url} alt="" draggable={false} /> : null}
        <canvas ref={tela} width={COLUNAS_DO_PAINEL * CASA} height={LINHAS_DO_PAINEL * CASA} />
      </span>
      {/* A moldura e o selo ficam por cima do rejunte da parede (que cobre os painéis): assim o "VOCÊ" se lê inteiro. */}
      <span className="ale-voce-frente" data-aceso={aceso ? "" : undefined} style={lugar}>
        <span className="ale-voce-moldura" />
        <span className="ale-cond ale-voce-selo">{t.p.voceSelo}</span>
      </span>
    </>
  );
}

/** O rosto pequeno do formulário: o mesmo desenho do painel e da rede (ou a foto escolhida), ao lado do codinome. */
export function RostoDoCodinome({ codinome, foto }: { codinome: string; foto: FotoDeVoce | null }) {
  const cores = coresDoRosto(codinome);
  return (
    <span className="ale-rosto-figura" aria-hidden>
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={foto.url} alt="" draggable={false} />
      ) : (
        <svg viewBox={`0 0 ${LADO_DO_DESENHO} ${LADO_DO_DESENHO}`} preserveAspectRatio="none" shapeRendering="crispEdges">
          {cores.map((cor, i) => (
            <rect key={i} x={i % LADO_DO_DESENHO} y={Math.floor(i / LADO_DO_DESENHO)} width={1.02} height={1.02} fill={cor} />
          ))}
        </svg>
      )}
    </span>
  );
}

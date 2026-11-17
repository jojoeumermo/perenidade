// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import malha from "@/lib/rede/mapa/malha-brasil.json";
import type { UF } from "@/lib/rede/mapa/lugar";
import { caixaDoCaminho, enquadrar, type Filtro, type PontoDoMapa } from "@/lib/rede/mapa/regras";
import { preencher } from "@/lib/rede/preencher";
import { ALVO_PX, geometriaDoPonto, pontosNoToque } from "./toque";

type Estados = Record<string, { d: string; centro: [number, number] }>;
const ESTADOS = malha.estados as unknown as Estados;
// O Brasil inteiro, com folga para Fernando de Noronha (que fica a leste do continente).
const BRASIL: [number, number, number, number] = [-10, -10, 1085, malha.altura + 20];
const PROPORCAO = BRASIL[2] / BRASIL[3];
const CAIXAS = Object.fromEntries(Object.entries(ESTADOS).map(([uf, e]) => [uf, enquadrar(caixaDoCaminho(e.d), PROPORCAO)])) as Record<string, [number, number, number, number]>;

/** Os textos da lista do toque (i18n/rede/mapa, "toque"). */
export interface TextosDoToque {
  titulo: string;
  explica: string;
  estado: string;
  fechar: string;
}

/**
 * O desenho do Brasil (SVG da própria Alumia, malha pública do IBGE): os 27 estados e um grupo de ladrilhos por município com
 * alguma coisa (vermelho = chamado, dourado = evento, terceiro tom = núcleo). Tocar num estado aproxima; tocar num ladrilho escolhe a
 * cidade (cada cidade tem uma área de toque invisível de 44 px na tela, maior que o ladrilho). Quando o toque cai na área de mais de
 * uma cidade (no celular, com o Brasil inteiro, as cidades próximas se sobrepõem), abre embaixo do desenho a lista das cidades
 * daquele ponto, com botões de 44 px e o caminho para ver só o Estado, em vez de escolher uma por sorte. O desenho é escondido do
 * leitor de tela (tem um rótulo só): a lista de cidades ao lado faz o mesmo pelo teclado.
 */
export function MapaDoBrasil({ rotulo, pontos, filtro, uf, escolhido, aoEscolherUf, aoEscolherPonto, textosDoToque, descrever }: {
  rotulo: string;
  pontos: PontoDoMapa[];
  filtro: Filtro;
  uf: UF | null;
  escolhido: string | null;
  aoEscolherUf: (uf: UF) => void;
  aoEscolherPonto: (p: PontoDoMapa) => void;
  textosDoToque: TextosDoToque;
  /** O que há no ponto, em palavras ("4 chamados · Núcleos"), para a lista do toque. */
  descrever: (p: PontoDoMapa) => string;
}) {
  const caixa = uf ? CAIXAS[uf] : BRASIL;
  // Os ladrilhos e as siglas ficam do mesmo tamanho na tela quando o desenho aproxima.
  const escala = caixa[2] / BRASIL[2];
  const desenhados = useMemo(() => (uf ? pontos.filter((p) => p.municipio.uf === uf) : pontos), [pontos, uf]);
  // O tamanho do desenho na tela (o ResizeObserver mede ao começar e a cada mudança): o alvo de 44 px vira unidades do desenho.
  const svg = useRef<SVGSVGElement>(null);
  const [tela, setTela] = useState<[number, number]>([0, 0]);
  useEffect(() => {
    const el = svg.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const r = new ResizeObserver(() => {
      const c = el.getBoundingClientRect();
      setTela([c.width, c.height]);
    });
    r.observe(el);
    return () => r.disconnect();
  }, []);
  // Com "meet", a escala do desenho é a menor das duas (largura ou altura limita).
  const pxPorUnidade = Math.min(tela[0] / caixa[2], tela[1] / caixa[3]);
  const alvo = pxPorUnidade > 0 ? ALVO_PX / pxPorUnidade : 0;

  // A lista do toque: as cidades daquele ponto. Some quando o desenho muda (outro Estado, outro filtro, outra tela).
  const [toque, setToque] = useState<{ chaves: string[]; caixa: string } | null>(null);
  const chaveDaCaixa = caixa.join(" ");
  const naLista = toque && toque.caixa === chaveDaCaixa ? toque.chaves.map((k) => desenhados.find((p) => p.chave === k)).filter((p): p is PontoDoMapa => !!p) : [];
  const tituloDaLista = useRef<HTMLHeadingElement>(null);
  const aberta = naLista.length > 1;
  useEffect(() => {
    if (!aberta) return;
    tituloDaLista.current?.focus({ preventScroll: true });
    tituloDaLista.current?.scrollIntoView({ block: "nearest" });
    const fechar = (e: KeyboardEvent) => e.key === "Escape" && setToque(null);
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [aberta, toque]);

  /** O toque num ladrilho: as cidades cuja área contém o ponto; uma só abre, mais de uma vira a lista. */
  const tocar = (e: React.MouseEvent<SVGGElement>, tocado: PontoDoMapa) => {
    const el = svg.current;
    const m = el?.getScreenCTM();
    let achados: PontoDoMapa[] = [];
    if (m) {
      const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      achados = pontosNoToque(desenhados, filtro, escala, alvo, p.x, p.y);
    }
    if (achados.length <= 1) {
      setToque(null);
      aoEscolherPonto(achados[0] ?? tocado);
      return;
    }
    setToque({ chaves: achados.map((p) => p.chave), caixa: chaveDaCaixa });
  };
  const escolherDaLista = (p: PontoDoMapa) => {
    setToque(null);
    aoEscolherPonto(p);
  };
  // O Estado da cidade mais perto do toque (a lista pode juntar cidades de dois Estados na divisa).
  const ufDaLista = (naLista[0]?.municipio.uf ?? null) as UF | null;

  return (
    <div className="mp-desenho" data-perto={uf ? "" : undefined}>
      <svg ref={svg} viewBox={caixa.join(" ")} role="img" aria-label={rotulo} preserveAspectRatio="xMidYMid meet">
        <g className="mp-estados">
          {Object.entries(ESTADOS).map(([sigla, e]) => (
            <path
              key={sigla}
              d={e.d}
              className="mp-estado-forma"
              data-escolhido={uf === sigla ? "" : undefined}
              data-apagado={uf && uf !== sigla ? "" : undefined}
              strokeWidth={1.6 * escala}
              onClick={() => (setToque(null), aoEscolherUf(sigla as UF))}
            />
          ))}
        </g>
        <g className="mp-siglas" aria-hidden>
          {Object.entries(ESTADOS).map(([sigla, e]) => (
            <text key={sigla} x={e.centro[0]} y={e.centro[1]} fontSize={22 * escala} data-apagado={uf && uf !== sigla ? "" : undefined}>
              {sigla}
            </text>
          ))}
        </g>
        <g className="mp-pontos">
          {desenhados.map((p) => {
            const { tipos, lado, vao, largura, x0, y0, area } = geometriaDoPonto(p, filtro, escala, alvo);
            const marcado = p.chave === escolhido || (aberta && naLista.some((x) => x.chave === p.chave));
            return (
              <g key={p.chave} className="mp-ponto" data-escolhido={marcado ? "" : undefined} onClick={(e) => tocar(e, p)}>
                <rect className="mp-ponto-alvo" x={area.x} y={area.y} width={area.largura} height={area.altura} />
                {marcado && (
                  <rect className="mp-ponto-anel" x={x0 - 3 * escala} y={y0 - 3 * escala} width={largura + 6 * escala} height={lado + 6 * escala} rx={2.5 * escala} strokeWidth={1.6 * escala} />
                )}
                {tipos.map((tipo, i) => (
                  <rect key={tipo} data-tipo={tipo} x={x0 + i * (lado + vao)} y={y0} width={lado} height={lado} rx={1.3 * escala} strokeWidth={0.8 * escala} />
                ))}
              </g>
            );
          })}
        </g>
      </svg>

      {aberta && (
        <section className="mp-toque" aria-labelledby="mp-toque-titulo">
          <div className="mp-toque-topo">
            <h2 id="mp-toque-titulo" ref={tituloDaLista} tabIndex={-1} className="mp-subtitulo al-cond">{textosDoToque.titulo}</h2>
            <button type="button" className="mp-toque-fechar" onClick={() => setToque(null)}>{textosDoToque.fechar}</button>
          </div>
          <p className="mp-miudo">{textosDoToque.explica}</p>
          <ul className="mp-toque-lista">
            {naLista.map((p) => (
              <li key={p.chave}>
                <button type="button" className="mp-toque-cidade" onClick={() => escolherDaLista(p)}>
                  <strong>{p.municipio.nome}</strong> <span className="mp-uf">{p.municipio.uf}</span>
                  <span className="mp-miudo">{descrever(p)}</span>
                </button>
              </li>
            ))}
          </ul>
          {!uf && ufDaLista && (
            <button type="button" className="mp-toque-estado" onClick={() => (setToque(null), aoEscolherUf(ufDaLista))}>
              {preencher(textosDoToque.estado, { uf: ufDaLista })}
            </button>
          )}
        </section>
      )}
    </div>
  );
}

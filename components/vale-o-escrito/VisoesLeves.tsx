// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "@/styles/vale-o-escrito.css";
import { useMemo } from "react";
import { fill } from "@/i18n/config";
import { SITUACOES, type Entrada } from "@/lib/vale-o-escrito/tipos";
import {
  anoDe,
  centroPadrao,
  formatarData,
  layoutFluxo,
  layoutGrupos,
  layoutLinha,
  layoutOrbita,
  type DossieVisual,
  type Grafo,
} from "@/lib/vale-o-escrito/visual";
import { NoSvg, truncar, type S } from "./Primitivas";

// As quatro visões que não precisam de D3: órbita, grupos, fluxo e linha do tempo. Tudo calculado em
// lib/vale-o-escrito/visual.ts (funções puras, testadas) e desenhado aqui em SVG.

const L = 1000;
const A = 640;

interface PropsDeGrafo {
  grafo: Grafo;
  selecionado: string | null;
  aoSelecionar: (chave: string) => void;
  s: S;
}

export function Orbita({ grafo, selecionado, aoSelecionar, s }: PropsDeGrafo) {
  const centro = selecionado && grafo.nos.some((n) => n.chave === selecionado) ? selecionado : centroPadrao(grafo);
  const lay = useMemo(() => layoutOrbita(grafo, centro, L, A), [grafo, centro]);
  const pos = new Map(lay.nos.map((n) => [n.chave, n]));
  const nomeCentro = grafo.nos.find((n) => n.chave === lay.centro)?.rotulo ?? "";
  const vizinhosDoCentro = new Set(grafo.arestas.flatMap((a) => (a.de === lay.centro ? [a.para] : a.para === lay.centro ? [a.de] : [])));
  return (
    <>
      <p className="ve-titulo-da-visao">{fill(s.visual.orbita.titulo, { nome: truncar(nomeCentro, 40) })}</p>
      <svg className="ve-svg" viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="xMidYMid meet" role="group" aria-label={s.visual.aria.palco}>
        {lay.aneis.map((r, i) => (
          <circle key={i} className="ve-anel" cx={L / 2} cy={A / 2} r={r} />
        ))}
        {grafo.arestas.map((a) => {
          const p = pos.get(a.de);
          const q = pos.get(a.para);
          if (!p || !q) return null;
          const realce = a.de === lay.centro || a.para === lay.centro;
          return <line key={a.id} className="ve-aresta" data-implicita={a.implicita} data-realce={realce} x1={p.x} y1={p.y} x2={q.x} y2={q.y} />;
        })}
        {grafo.nos.map((n) => {
          const p = pos.get(n.chave);
          if (!p) return null;
          return (
            <NoSvg
              key={n.chave}
              no={n}
              x={p.x}
              y={p.y}
              s={s}
              selecionado={selecionado === n.chave}
              apagado={false}
              mostrarRotulo={n.chave === lay.centro || vizinhosDoCentro.has(n.chave) || n.tipo === "entrada"}
              aoSelecionar={aoSelecionar}
            />
          );
        })}
      </svg>
    </>
  );
}

export function Grupos({ grafo, dossies, selecionado, aoSelecionar, s }: PropsDeGrafo & { dossies: DossieVisual[] }) {
  const lay = useMemo(() => layoutGrupos(grafo, dossies, L, A), [grafo, dossies]);
  const pos = new Map(lay.nos.map((n) => [n.chave, n]));
  const nomeDe = (slug: string) => dossies.find((d) => d.slug === slug)?.titulo ?? slug;
  return (
    <>
      <p className="ve-titulo-da-visao">{s.visual.grupos.titulo}</p>
      <svg className="ve-svg" viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="xMidYMid meet" role="group" aria-label={s.visual.aria.palco}>
        {lay.grupos.map((g) => (
          <g key={g.slug}>
            <circle className="ve-grupo-circulo" cx={g.cx} cy={g.cy} r={g.r} />
            <text className="ve-grupo-nome" x={g.cx} y={g.cy - g.r - 6} textAnchor="middle">
              {truncar(nomeDe(g.slug), 30)} · {g.total}
            </text>
          </g>
        ))}
        {grafo.nos.map((n) => {
          const p = pos.get(n.chave);
          if (!p) return null;
          return (
            <NoSvg key={n.chave} no={n} x={p.x} y={p.y} s={s} selecionado={selecionado === n.chave} mostrarRotulo={false} aoSelecionar={aoSelecionar} />
          );
        })}
      </svg>
    </>
  );
}

const COR_DA_FAIXA = { amarelo: "#ffe600", azul: "#2aa3ff", vermelho: "#ff2d55" } as const;

export function Fluxo({
  entradas,
  dossies,
  aoSelecionarDossie,
  s,
}: {
  entradas: Entrada[];
  dossies: DossieVisual[];
  aoSelecionarDossie: (slug: string) => void;
  s: S;
}) {
  const lay = useMemo(() => layoutFluxo(entradas, dossies, L - 300, A), [entradas, dossies]);
  const corDe = (slug: string) => COR_DA_FAIXA[dossies.find((d) => d.slug === slug)?.cor ?? "amarelo"];
  const nomeDe = (slug: string) => dossies.find((d) => d.slug === slug)?.titulo ?? slug;
  return (
    <>
      <p className="ve-titulo-da-visao">{s.visual.fluxo.titulo}</p>
      <svg className="ve-svg" viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="xMidYMid meet" role="group" aria-label={s.visual.aria.palco}>
        <g transform="translate(150 0)">
          {lay.faixas.map((f) => {
            const x1 = 14;
            const x2 = L - 300 - 14;
            const m = (x1 + x2) / 2;
            return (
              <path
                key={`${f.de}|${f.para}`}
                className="ve-fluxo-faixa"
                d={`M${x1},${f.y0} C${m},${f.y0} ${m},${f.y1} ${x2},${f.y1}`}
                stroke={corDe(f.de)}
                strokeWidth={Math.max(2, f.h)}
              >
                <title>
                  {nomeDe(f.de)} → {s.situacao[f.para as keyof typeof s.situacao]}: {f.total}
                </title>
              </path>
            );
          })}
          {lay.esquerda.map((c) => (
            <g
              key={c.chave}
              role="button"
              tabIndex={0}
              aria-label={`${nomeDe(c.chave)}: ${c.total}`}
              style={{ cursor: "pointer" }}
              onClick={() => aoSelecionarDossie(c.chave)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  aoSelecionarDossie(c.chave);
                }
              }}
            >
              <rect className="ve-fluxo-caixa" x={c.x} y={c.y} width={c.w} height={Math.max(c.h, 3)} fill={corDe(c.chave)} />
              <text className="ve-fluxo-texto" x={c.x - 8} y={c.y + Math.max(c.h, 3) / 2 + 4} textAnchor="end">
                {truncar(nomeDe(c.chave), 17)} {c.total}
              </text>
            </g>
          ))}
          {lay.direita.map((c) => (
            <g key={c.chave}>
              <rect className="ve-fluxo-caixa" x={c.x} y={c.y} width={c.w} height={Math.max(c.h, 3)} />
              <text className="ve-fluxo-texto" x={c.x + c.w + 8} y={c.y + Math.max(c.h, 3) / 2 + 4}>
                {truncar(s.situacao[c.chave as (typeof SITUACOES)[number]], 17)} {c.total}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </>
  );
}

export function LinhaDoTempo({
  entradas,
  dossies,
  selecionadoId,
  aoEscolher,
  s,
  lang,
}: {
  entradas: Entrada[];
  dossies: DossieVisual[];
  selecionadoId: string | null;
  aoEscolher: (entradaId: string) => void;
  s: S;
  lang: string;
}) {
  const lay = useMemo(() => layoutLinha(entradas, dossies, L, A), [entradas, dossies]);
  const nomeDe = (slug: string) => dossies.find((d) => d.slug === slug)?.titulo ?? slug;
  return (
    <>
      <p className="ve-titulo-da-visao">{s.visual.linha.titulo}</p>
      {lay.marcas.length === 0 ? (
        <div className="ve-vazio">
          <p>{s.visual.linha.semDados}</p>
        </div>
      ) : (
        <svg className="ve-svg" viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="xMidYMid meet" role="group" aria-label={s.visual.aria.palco}>
          {lay.faixas.map((f) => (
            <g key={f.slug}>
              <line className="ve-eixo" x1={40} x2={L - 20} y1={f.y} y2={f.y} />
              <text className="ve-eixo-texto" x={42} y={f.y - 20}>
                {truncar(nomeDe(f.slug), 40)}
              </text>
            </g>
          ))}
          {lay.anos.map((a) => (
            <g key={a.ano}>
              <line className="ve-eixo" x1={a.x} x2={a.x} y1={10} y2={A - 30} strokeDasharray="2 6" />
              <text className="ve-eixo-texto" x={a.x + 3} y={A - 12}>
                {a.ano}
              </text>
            </g>
          ))}
          {lay.marcas.map((m) => {
            const sel = selecionadoId === m.entrada.id;
            const nome = `${m.entrada.titulo}. ${formatarData(m.entrada.dataDoFato, lang)}. ${s.ficha.situacao}: ${s.situacao[m.entrada.situacao]}`;
            return (
              <g
                key={m.entrada.id}
                className="ve-marca"
                data-sel={sel}
                transform={`translate(${m.x} ${m.y})`}
                role="button"
                tabIndex={0}
                aria-pressed={sel}
                aria-label={nome}
                onClick={() => aoEscolher(m.entrada.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    aoEscolher(m.entrada.id);
                  }
                }}
              >
                <title>{nome}</title>
                <circle r={6} />
                {sel && (
                  <text className="ve-eixo-texto" y={-12} textAnchor="middle" style={{ fill: "#fff" }}>
                    {anoDe(m.entrada.dataDoFato)} · {truncar(m.entrada.titulo, 34)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </>
  );
}

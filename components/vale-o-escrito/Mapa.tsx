// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Vale o Escrito, pacote "mapa": o Mapa do Brasil neon (visão "mapa" da página). MapLibre GL desenha SÓ as malhas do IBGE
// geradas em arquivo (public/vale-o-escrito/malhas/, por scripts/vale-o-escrito/gerar-malhas.mjs) sobre fundo preto: não
// há tiles, glifos nem estilo de terceiros, então nenhuma requisição sai do site (sem rastreio). Zoom em três níveis
// nomeados: país (27 UFs) → estado (municípios da UF) → município. Cada caso é um ponto neon na cor do dossiê; clicar abre a
// ficha (aoEscolher). O peso (maplibre-gl) só é baixado quando este componente monta, isto é, quando a visão Mapa abre:
// o import é dinâmico, dentro do efeito. Substitui o marcador do pacote visual mantendo as props de PropsDoMapa
// (lib/vale-o-escrito/visual.ts) e o export default; textosMapa (chave "mapa" do i18n) e baseDasMalhas são opcionais.
//
// Acessibilidade: o mapa é um desenho; a lista de casos em texto (botões) fica junto, para teclado e leitor de tela.
// Crédito do IBGE sempre visível no canto do mapa.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapaGL, MapMouseEvent } from "maplibre-gl";
import {
  COR_NEON,
  caixa,
  centro,
  contarCasos,
  pontosDosCasos,
  ufDoCaso,
  uniaoDeCaixas,
  type CasoNoMapa,
  type Caixa,
  type GeometriaPoligonal,
  type Par,
} from "@/lib/vale-o-escrito/geo";
import type { PropsDoMapa } from "@/lib/vale-o-escrito/visual";
import type { NivelDeZoom } from "@/lib/vale-o-escrito/tipos";

/** Textos próprios do mapa (i18n/vale-o-escrito/<idioma>.json, chave "mapa"). Opcional: sem ele, cai no português. */
export interface TextosDoMapa {
  semWebgl: string;
  semMalha: string;
  voltar: string;
  brasil: string;
  casos: string;
  umCaso: string;
  nenhumCaso: string;
  casosAqui: string;
  abrirFicha: string;
  listaDeCasos: string;
  aria: string;
  credito: string;
  nivel: string;
}

const TEXTOS_PT: TextosDoMapa = {
  semWebgl: "Este navegador não consegue desenhar o mapa (falta WebGL). A lista de casos abaixo continua valendo.",
  semMalha: "As malhas do IBGE ainda não foram geradas neste servidor.",
  voltar: "Voltar um nível",
  brasil: "Brasil",
  casos: "{n} casos",
  umCaso: "1 caso",
  nenhumCaso: "Nenhum caso publicado",
  casosAqui: "Casos neste ponto",
  abrirFicha: "Abrir a ficha",
  listaDeCasos: "Casos no mapa (lista para teclado e leitor de tela)",
  aria: "Mapa do Brasil com os casos publicados, por estado e município",
  credito: "Malhas territoriais: IBGE. Sem mapa de terceiros e sem rastreio.",
  nivel: "Nível do mapa",
};

export type PropsDoMapaNeon = PropsDoMapa & { textosMapa?: TextosDoMapa; baseDasMalhas?: string };

const BASE_PADRAO = "/vale-o-escrito/malhas/";
const CAIXA_BRASIL: Caixa = [-74, -34, -34, 5.6];
const NIVEIS: readonly NivelDeZoom[] = ["pais", "estado", "municipio"];

// Cores do painel de investigação do Vale (preto profundo e vermelho sangue; o mapa não segue a identidade do instituto, de propósito).
const FUNDO = "#070707";
const LINHA = "#3b2a2e";
const LINHA_FORTE = "#ff4d5e";
const PREENCHE = "#1c080c";

interface Feature {
  type: "Feature";
  geometry: GeometriaPoligonal;
  properties: Record<string, string | number>;
}
interface Colecao {
  type: "FeatureCollection";
  features: Feature[];
}

const vazio = (): Colecao => ({ type: "FeatureCollection", features: [] });

const reduzMovimento = (): boolean => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

const semWebgl = (): boolean => {
  try {
    const c = document.createElement("canvas");
    return !(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return true;
  }
};

/** Contagem de casos escrita nas propriedades de cada polígono (alimenta a intensidade do preenchimento). */
function comContagem(col: Colecao, chave: "sigla" | "codigo", contagem: Record<string, number>): Colecao {
  return {
    type: "FeatureCollection",
    features: col.features.map((f) => ({
      ...f,
      properties: { ...f.properties, casos: contagem[String(f.properties[chave])] ?? 0 },
    })),
  };
}

interface Agrupado {
  itens: { id: string; titulo: string }[];
}

export default function Mapa({ entradas, dossies, selecionadoId, aoEscolher, zoom, aoMudarZoom, textos, textosMapa, baseDasMalhas }: PropsDoMapaNeon) {
  const t = textosMapa ?? TEXTOS_PT;
  const base = baseDasMalhas ?? BASE_PADRAO;

  const casos = useMemo<CasoNoMapa[]>(() => {
    const cor = new Map(dossies.map((d) => [d.slug, d.cor]));
    return entradas.map((e) => ({
      id: e.id,
      titulo: e.titulo,
      dossie: e.dossie,
      cor: cor.get(e.dossie) ?? "amarelo",
      // Só o Brasil tem malha aqui: fora dele a regiao é outro código e o caso fica só na lista em texto.
      uf: e.lugar.pais === "BR" ? e.lugar.regiao : undefined,
      municipioIbge: e.lugar.pais === "BR" ? e.lugar.municipioIbge : undefined,
      situacao: textos.situacao[e.situacao] ?? e.situacao,
    }));
  }, [entradas, dossies, textos.situacao]);

  const raiz = useRef<HTMLDivElement>(null);
  const dica = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaGL | null>(null);
  const prontoRef = useRef(false);
  const brasil = useRef<Colecao>(vazio());
  const ufs = useRef(new Map<string, Colecao>());
  const centrosUf = useRef<Record<string, Par>>({});
  const centrosMun = useRef<Record<string, Par>>({});
  const casosRef = useRef(casos);
  const nivelRef = useRef<NivelDeZoom>("pais");
  const ufSelRef = useRef<string | null>(null);
  const munSelRef = useRef<string | null>(null);
  const aoEscolherRef = useRef(aoEscolher);
  const aoMudarZoomRef = useRef(aoMudarZoom);
  const textosRef = useRef(t);
  const api = useRef<{ voltar: () => void; pais: () => void; atualizar: () => Promise<void> } | null>(null);

  const [carga, setCarga] = useState<"carregando" | "pronto" | "sem-webgl" | "sem-malha">("carregando");
  const [nivel, setNivel] = useState<NivelDeZoom>("pais");
  const [ufSel, setUfSel] = useState<string | null>(null);
  const [munSel, setMunSel] = useState<{ codigo: string; nome: string } | null>(null);
  const [agrupado, setAgrupado] = useState<Agrupado | null>(null);
  const [nomeDaUf, setNomeDaUf] = useState<Record<string, string>>({});

  useEffect(() => {
    aoEscolherRef.current = aoEscolher;
    aoMudarZoomRef.current = aoMudarZoom;
    casosRef.current = casos;
    textosRef.current = t;
  });

  const mudarNivel = useCallback((n: NivelDeZoom) => {
    if (nivelRef.current === n) return;
    nivelRef.current = n;
    setNivel(n);
    aoMudarZoomRef.current(n);
  }, []);

  // ── Monta o mapa (maplibre-gl só é baixado aqui) ──
  useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    let cancelado = false;
    let m: MapaGL | null = null;

    const ir = (c: Caixa, folga = 36) => {
      mapa.current?.fitBounds(
        [
          [c[0], c[1]],
          [c[2], c[3]],
        ],
        { padding: folga, duration: reduzMovimento() ? 0 : 700, maxZoom: 12 },
      );
    };

    const lerUf = async (sigla: string): Promise<Colecao | undefined> => {
      const guardada = ufs.current.get(sigla);
      if (guardada) return guardada;
      try {
        const r = await fetch(`${base}uf/${sigla}.geojson`);
        if (!r.ok) return undefined;
        const col = (await r.json()) as Colecao;
        ufs.current.set(sigla, col);
        for (const f of col.features) {
          const c = centro(f.geometry);
          if (c) centrosMun.current[String(f.properties.codigo)] = c;
        }
        return col;
      } catch {
        return undefined;
      }
    };

    const fonte = (id: string) => m?.getSource(id) as GeoJSONSource | undefined;

    const atualizar = async () => {
      if (!m || !prontoRef.current) return;
      const lista = casosRef.current;
      const { porUf, porMunicipio } = contarCasos(lista);
      // Só baixa a malha das UFs que têm caso com município (para o centro do ponto); os outros ficam no centro da UF.
      const precisam = [...new Set(lista.filter((c) => c.municipioIbge).map(ufDoCaso).filter((s): s is string => !!s))];
      await Promise.all(precisam.map(lerUf));
      if (cancelado || !m) return;
      fonte("brasil")?.setData(comContagem(brasil.current, "sigla", porUf) as never);
      const atual = ufSelRef.current;
      const col = atual ? ufs.current.get(atual) : undefined;
      fonte("uf")?.setData((col ? comContagem(col, "codigo", porMunicipio) : vazio()) as never);
      fonte("casos")?.setData(pontosDosCasos(lista, centrosUf.current, centrosMun.current) as never);
    };

    const selecionarUf = async (sigla: string) => {
      if (!m) return;
      setAgrupado(null);
      const col = await lerUf(sigla);
      if (cancelado || !m) return;
      ufSelRef.current = sigla;
      munSelRef.current = null;
      setUfSel(sigla);
      setMunSel(null);
      const { porMunicipio } = contarCasos(casosRef.current);
      fonte("uf")?.setData((col ? comContagem(col, "codigo", porMunicipio) : vazio()) as never);
      m.setFilter("brasil-fill", ["!=", ["get", "sigla"], sigla]);
      m.setFilter("uf-sel", ["==", ["get", "codigo"], ""]);
      mudarNivel("estado");
      const c = col ? uniaoDeCaixas(col.features.map((f) => caixa(f.geometry))) : undefined;
      const daUf = brasil.current.features.find((f) => f.properties.sigla === sigla);
      const alvo = c ?? (daUf ? caixa(daUf.geometry) : undefined);
      if (alvo) ir(alvo);
    };

    const selecionarMunicipio = (codigo: string) => {
      if (!m || !ufSelRef.current) return;
      const col = ufs.current.get(ufSelRef.current);
      const f = col?.features.find((x) => String(x.properties.codigo) === codigo);
      if (!f) return;
      setAgrupado(null);
      munSelRef.current = codigo;
      setMunSel({ codigo, nome: String(f.properties.nome || codigo) });
      m.setFilter("uf-sel", ["==", ["get", "codigo"], codigo]);
      mudarNivel("municipio");
      const c = caixa(f.geometry);
      if (c) ir(c, 80);
    };

    const voltarAoPais = () => {
      if (!m) return;
      setAgrupado(null);
      ufSelRef.current = null;
      munSelRef.current = null;
      setUfSel(null);
      setMunSel(null);
      m.setFilter("brasil-fill", ["!=", ["get", "sigla"], ""]);
      m.setFilter("uf-sel", ["==", ["get", "codigo"], ""]);
      fonte("uf")?.setData(vazio() as never);
      mudarNivel("pais");
      ir(CAIXA_BRASIL, 24);
    };

    const voltarUmNivel = () => {
      if (nivelRef.current === "municipio" && ufSelRef.current) void selecionarUf(ufSelRef.current);
      else if (nivelRef.current === "estado") voltarAoPais();
    };

    api.current = { voltar: voltarUmNivel, pais: voltarAoPais, atualizar };

    (async () => {
      try {
        const lib = await import("maplibre-gl");
        if (cancelado) return;
        // O MapLibre 6 procura o worker ao lado do próprio arquivo (import.meta.url), mas o build não publica esse arquivo
        // junto com os pedaços do Next: o mapa ficava preto ("Worker failed to load"). O worker vai copiado em
        // public/workers (não em /vendor: esse caminho é isca de robô no proxy.ts e devolve 403) (mesma versão do package.json; ao atualizar o maplibre-gl, copie de novo o dist/maplibre-gl-worker.mjs).
        lib.setWorkerUrl(`/workers/maplibre-gl-worker-${lib.getVersion()}.mjs`);
        if (semWebgl()) {
          setCarga("sem-webgl");
          return;
        }
        const nova = new lib.Map({
          container: el,
          // Estilo próprio, sem fonte externa: só fundo preto (as camadas vêm das malhas do IBGE).
          style: { version: 8, sources: {}, layers: [{ id: "fundo", type: "background", paint: { "background-color": FUNDO } }] },
          bounds: [
            [CAIXA_BRASIL[0], CAIXA_BRASIL[1]],
            [CAIXA_BRASIL[2], CAIXA_BRASIL[3]],
          ],
          fitBoundsOptions: { padding: 24 },
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          minZoom: 2,
          maxZoom: 13,
          fadeDuration: 0,
        });
        m = nova;
        mapa.current = nova;
        nova.touchZoomRotate.disableRotation();

        nova.on("load", async () => {
          if (cancelado || !m) return;
          let col: Colecao;
          try {
            const r = await fetch(`${base}brasil.geojson`);
            if (!r.ok) throw new Error(String(r.status));
            col = (await r.json()) as Colecao;
          } catch {
            if (!cancelado) setCarga("sem-malha");
            return;
          }
          if (cancelado || !m) return;
          brasil.current = col;
          const nomes: Record<string, string> = {};
          for (const f of col.features) {
            const c = centro(f.geometry);
            const s = String(f.properties.sigla ?? "");
            if (c && s) centrosUf.current[s] = c;
            if (s) nomes[s] = String(f.properties.nome ?? s);
          }
          setNomeDaUf(nomes);
          const { porUf } = contarCasos(casosRef.current);

          m.addSource("brasil", { type: "geojson", data: comContagem(col, "sigla", porUf) as never });
          m.addSource("uf", { type: "geojson", data: vazio() as never });
          m.addSource("casos", { type: "geojson", data: pontosDosCasos([], {}, {}) as never });

          const intensidade = ["interpolate", ["linear"], ["get", "casos"], 0, 0.05, 1, 0.22, 8, 0.5, 40, 0.8] as never;
          m.addLayer({ id: "brasil-fill", type: "fill", source: "brasil", filter: ["!=", ["get", "sigla"], ""], paint: { "fill-color": PREENCHE, "fill-opacity": intensidade } });
          m.addLayer({ id: "brasil-linha", type: "line", source: "brasil", paint: { "line-color": LINHA, "line-width": 0.9 } });
          m.addLayer({ id: "brasil-hover", type: "line", source: "brasil", filter: ["==", ["get", "sigla"], ""], paint: { "line-color": LINHA_FORTE, "line-width": 2 } });
          m.addLayer({ id: "uf-fill", type: "fill", source: "uf", paint: { "fill-color": PREENCHE, "fill-opacity": intensidade } });
          m.addLayer({ id: "uf-linha", type: "line", source: "uf", paint: { "line-color": LINHA, "line-width": 0.6 } });
          m.addLayer({ id: "uf-hover", type: "line", source: "uf", filter: ["==", ["get", "codigo"], ""], paint: { "line-color": LINHA_FORTE, "line-width": 1.8 } });
          m.addLayer({ id: "uf-sel", type: "line", source: "uf", filter: ["==", ["get", "codigo"], ""], paint: { "line-color": "#ffffff", "line-width": 2.4 } });
          m.addLayer({
            id: "casos-brilho",
            type: "circle",
            source: "casos",
            paint: { "circle-color": ["get", "cor"], "circle-opacity": 0.28, "circle-blur": 0.8, "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 9, 9, 18] },
          });
          m.addLayer({
            id: "casos-ponto",
            type: "circle",
            source: "casos",
            paint: {
              "circle-color": ["get", "cor"],
              "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 3.5, 9, 7],
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 0.8,
              "circle-stroke-opacity": 0.8,
            },
          });
          m.addLayer({
            id: "casos-sel",
            type: "circle",
            source: "casos",
            filter: ["==", ["get", "id"], ""],
            paint: { "circle-color": "rgba(0,0,0,0)", "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 9, 9, 15], "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 },
          });

          const dicaEm = (e: MapMouseEvent, texto: string | null) => {
            const d = dica.current;
            if (!d) return;
            if (!texto) {
              d.style.display = "none";
              return;
            }
            d.textContent = texto;
            d.style.display = "block";
            d.style.transform = `translate(${Math.round(e.point.x + 14)}px, ${Math.round(e.point.y + 14)}px)`;
          };
          const contagemTexto = (n: number) => {
            const tx = textosRef.current;
            return n === 0 ? tx.nenhumCaso : n === 1 ? tx.umCaso : tx.casos.replace("{n}", String(n));
          };

          m.on("mousemove", (e) => {
            if (!m) return;
            const pts = m.queryRenderedFeatures(e.point, { layers: ["casos-brilho"] });
            if (pts.length) {
              m.getCanvas().style.cursor = "pointer";
              dicaEm(e, String(pts[0].properties?.titulo ?? ""));
              return;
            }
            const nm = m.queryRenderedFeatures(e.point, { layers: ["uf-fill"] })[0];
            const us = m.queryRenderedFeatures(e.point, { layers: ["brasil-fill"] })[0];
            m.setFilter("uf-hover", ["==", ["get", "codigo"], String(nm?.properties?.codigo ?? "")]);
            m.setFilter("brasil-hover", ["==", ["get", "sigla"], nm ? "" : String(us?.properties?.sigla ?? "")]);
            m.getCanvas().style.cursor = nm || us ? "pointer" : "";
            if (nm) dicaEm(e, `${String(nm.properties?.nome || nm.properties?.codigo)} · ${contagemTexto(Number(nm.properties?.casos ?? 0))}`);
            else if (us) dicaEm(e, `${String(us.properties?.nome ?? us.properties?.sigla)} · ${contagemTexto(Number(us.properties?.casos ?? 0))}`);
            else dicaEm(e, null);
          });
          m.on("mouseout", () => {
            if (dica.current) dica.current.style.display = "none";
          });

          m.on("click", (e) => {
            if (!m) return;
            const pts = m.queryRenderedFeatures(e.point, { layers: ["casos-brilho"] });
            if (pts.length) {
              const vistos = new Map<string, string>();
              for (const p of pts) vistos.set(String(p.properties?.id), String(p.properties?.titulo ?? ""));
              const itens = [...vistos].map(([id, titulo]) => ({ id, titulo }));
              if (itens.length === 1) {
                setAgrupado(null);
                aoEscolherRef.current(itens[0].id);
              } else setAgrupado({ itens });
              return;
            }
            setAgrupado(null);
            const mun = m.queryRenderedFeatures(e.point, { layers: ["uf-fill"] })[0];
            if (mun && ufSelRef.current) {
              if (String(mun.properties?.codigo) !== munSelRef.current) selecionarMunicipio(String(mun.properties?.codigo));
              return;
            }
            const uf = m.queryRenderedFeatures(e.point, { layers: ["brasil-fill"] })[0];
            if (uf) void selecionarUf(String(uf.properties?.sigla));
          });

          prontoRef.current = true;
          setCarga("pronto");
          void atualizar();
        });
      } catch {
        if (!cancelado) setCarga("sem-webgl");
      }
    })();

    return () => {
      cancelado = true;
      prontoRef.current = false;
      api.current = null;
      m?.remove();
      mapa.current = null;
    };
    // O mapa monta uma vez; casos e textos novos entram pelos efeitos abaixo (refs), sem recriar o mapa.
  }, [base, mudarNivel]);

  // Casos novos (entrada aprovada ao vivo, filtro) → recalcula pontos e contagens.
  useEffect(() => {
    void api.current?.atualizar();
  }, [casos, carga]);

  // Ficha escolhida em outra visão → anel branco no ponto.
  useEffect(() => {
    const m = mapa.current;
    if (!m || carga !== "pronto") return;
    m.setFilter("casos-sel", ["==", ["get", "id"], selecionadoId ?? ""]);
  }, [selecionadoId, carga, casos]);

  // Quem manda o nível de fora (os botões de zoom da página) volta o mapa ao país.
  useEffect(() => {
    if (zoom === "pais" && nivelRef.current !== "pais") api.current?.pais();
  }, [zoom]);

  const nomeAberto = ufSel ? (nomeDaUf[ufSel] ?? ufSel) : "";

  return (
    <div className="relative h-full min-h-[360px] w-full overflow-hidden bg-black font-mono text-[11px] uppercase tracking-wider text-[#f1f1ed]" role="region" aria-label={t.aria}>
      {/* O estilo mínimo do MapLibre, inline: sem controles, sem popups e sem CSS de pacote. */}
      <style>{`.maplibregl-map{position:relative;overflow:hidden;-webkit-tap-highlight-color:rgb(0 0 0/0)}.maplibregl-canvas{position:absolute;left:0;top:0}.maplibregl-canvas-container.maplibregl-interactive{cursor:grab;user-select:none}.maplibregl-canvas-container.maplibregl-touch-zoom-rotate,.maplibregl-canvas-container.maplibregl-touch-drag-pan{touch-action:pan-x pan-y}`}</style>
      {/* h-full e w-full além do inset-0: o CSS do MapLibre (.maplibregl-map) troca o absolute por relative, e sem altura
          própria a moldura do mapa caía para 0 px (tela preta). */}
      <div ref={raiz} className="absolute inset-0 h-full w-full" />

      {/* Níveis de zoom nomeados + trilha (Brasil / estado / município). */}
      <div className="pointer-events-none absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-col gap-2">
        <ol className="pointer-events-auto flex flex-wrap gap-x-3 gap-y-1" aria-label={t.nivel}>
          {NIVEIS.map((n, i) => (
            <li key={n} className={n === nivel ? "text-[#ff4d5e]" : "text-[#8f8f8a]"} aria-current={n === nivel ? "step" : undefined}>
              {String(i + 1).padStart(2, "0")} {textos.zoom[n]}
            </li>
          ))}
        </ol>
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          {nivel !== "pais" && (
            <button type="button" onClick={() => api.current?.voltar()} className="border border-[#3b2a2e] bg-black/80 px-2 py-1 text-[#ff4d5e] hover:border-[#ff4d5e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff4d5e]">
              {"< "}
              {t.voltar}
            </button>
          )}
          <span className="text-[#f1f1ed]">
            {t.brasil}
            {nomeAberto && nivel !== "pais" ? ` / ${nomeAberto}` : ""}
            {munSel && nivel === "municipio" ? ` / ${munSel.nome}` : ""}
          </span>
        </div>
      </div>

      {/* Dica que segue o cursor (nome + quantidade de casos). */}
      <div ref={dica} className="pointer-events-none absolute left-0 top-0 z-10 hidden max-w-[16rem] border border-[#ff4d5e] bg-black/90 px-2 py-1 text-[#f1f1ed]" role="tooltip" />

      {/* Vários casos no mesmo ponto: lista para escolher. */}
      {agrupado && (
        <div className="absolute bottom-10 left-3 z-10 max-h-[45%] w-[min(22rem,calc(100%-1.5rem))] overflow-auto border border-[#ff4d5e] bg-black/95 p-2 normal-case tracking-normal">
          <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-[#ff4d5e]">{t.casosAqui}</p>
          <ul className="space-y-1">
            {agrupado.itens.map((i) => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => {
                    setAgrupado(null);
                    aoEscolher(i.id);
                  }}
                  className="w-full text-left text-[13px] text-[#f1f1ed] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff4d5e]"
                >
                  {i.titulo}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {carga === "carregando" && <p className="absolute inset-0 grid place-items-center">{textos.carregando}</p>}
      {(carga === "sem-webgl" || carga === "sem-malha") && (
        <p className="absolute inset-0 grid place-items-center px-6 text-center normal-case tracking-normal">{carga === "sem-webgl" ? t.semWebgl : t.semMalha}</p>
      )}

      <p className="pointer-events-none absolute bottom-2 right-3 max-w-[50%] text-right text-[10px] text-[#8f8f8a]">{t.credito}</p>

      {/* Lista em texto dos mesmos casos: teclado e leitor de tela (o mapa em si é só desenho). */}
      <details className="absolute bottom-2 left-3 z-10 max-w-[45%] normal-case tracking-normal">
        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-wider text-[#8f8f8a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff4d5e]">{t.listaDeCasos}</summary>
        <ul className="mt-1 max-h-48 space-y-1 overflow-auto border border-[#3b2a2e] bg-black/95 p-2">
          {casos.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => aoEscolher(c.id)} title={t.abrirFicha} className="text-left text-[12px] text-[#f1f1ed] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff4d5e]">
                <span aria-hidden style={{ color: COR_NEON[c.cor] }}>
                  {"● "}
                </span>
                {c.titulo} ({ufDoCaso(c) ?? "-"}, {c.situacao})
              </button>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

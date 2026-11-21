// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Vale o Escrito, pacote "mapa": o mapa neon do mundo (visão "mapa" da página; Prompt 5, C1). MapLibre GL desenha SÓ malhas
// geradas em arquivo (public/vale-o-escrito/malhas/): o mundo da Natural Earth 1:110m, domínio público
// (scripts/vale-o-escrito/gerar-mundo.mjs), e o Brasil do IBGE (scripts/vale-o-escrito/gerar-malhas.mjs), sobre fundo preto: não
// há tiles, glifos nem estilo de terceiros, então nenhuma requisição sai do site (sem rastreio). Zoom em quatro níveis
// nomeados: mundo → país (no Brasil, as 27 UFs) → estado (municípios da UF) → município. Fora do Brasil o mapa para no país
// (o caso fica no centro dele, "local aproximado"). Cada caso é um ponto neon na cor do dossiê; clicar abre a
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
  contornoExterno,
  pontosDosCasos,
  ufDoCaso,
  uniaoDeCaixas,
  type CasoNoMapa,
  type Caixa,
  type GeometriaPoligonal,
  type Par,
} from "@/lib/vale-o-escrito/geo";
import { curvaDaAresta, type PropsDoMapa, type RamoDoCaso } from "@/lib/vale-o-escrito/visual";
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
  /** Os textos abaixo vieram depois (T31); opcionais para não quebrar quem monta o mapa sem eles. */
  aproximado?: string;
  ramos?: string;
  reduzirMovimento?: string;
  ativarMovimento?: string;
  fecharRamos?: string;
  abrirFonte?: string;
  /** Prompt 5, C1 (mapa do mundo); opcionais pelo mesmo motivo. */
  mundo?: string;
  aproximadoPais?: string;
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
  aria: "Mapa do mundo com os casos publicados; no Brasil, também por estado e município",
  credito: "Malhas: Natural Earth (mundo, domínio público) e IBGE (Brasil). Sem mapa de terceiros e sem rastreio.",
  nivel: "Nível do mapa",
  aproximado: "local aproximado (centro do estado)",
  ramos: "Ligações do caso",
  reduzirMovimento: "Reduzir movimento",
  ativarMovimento: "Ativar movimento",
  fecharRamos: "Fechar ramificações",
  abrirFonte: "Abrir a fonte",
  mundo: "Mundo",
  aproximadoPais: "local aproximado (centro do país)",
};

/** Quantas ramificações o ponto abre de uma vez (o resto fica na ficha). */
const MAX_RAMOS = 12;
const COR_DO_RAMO: Record<RamoDoCaso["tipo"], string> = { pessoa: "#ffd23f", organizacao: "#2aa3ff", fonte: "#e8e8e0" };

// textosMapa vem de PropsDoMapa (Partial): cada chave que faltar cai no português.
export type PropsDoMapaNeon = PropsDoMapa & { baseDasMalhas?: string };

const BASE_PADRAO = "/vale-o-escrito/malhas/";
const CAIXA_BRASIL: Caixa = [-74, -34, -34, 5.6];
// O mundo sem a Antártida (que a malha não traz) e sem os polos: é o que cabe na tela de um celular em pé.
const CAIXA_MUNDO: Caixa = [-168, -56, 180, 75];
const NIVEIS: readonly NivelDeZoom[] = ["mundo", "pais", "estado", "municipio"];
/** O centro do Brasil, para caso brasileiro sem UF (o IBGE não tem um "centro do país" pronto). */
const CENTRO_DO_BRASIL: Par = [-51.9, -10.8];

/** O nome do país no idioma da página, pelo próprio navegador (Intl); sem ele, o código. */
function nomeDoPais(iso: string, idioma: string | undefined, reserva?: string): string {
  if (!iso) return reserva || "";
  try {
    return new Intl.DisplayNames([idioma || "pt", "pt"], { type: "region" }).of(iso) ?? reserva ?? iso;
  } catch {
    return reserva || iso;
  }
}

/** A caixa de um país; país que atravessa a linha da data (Rússia, Fiji, EUA com as Aleutas) fica com a do maior pedaço. */
function caixaDoPais(fs: readonly Feature[]): Caixa | undefined {
  const c = uniaoDeCaixas(fs.map((x) => caixa(x.geometry)));
  if (!c || c[2] - c[0] <= 180) return c;
  let melhor: Caixa | undefined;
  for (const f of fs) {
    const k = caixa(f.geometry);
    if (k && (!melhor || (k[2] - k[0]) * (k[3] - k[1]) > (melhor[2] - melhor[0]) * (melhor[3] - melhor[1]))) melhor = k;
  }
  return melhor;
}

// Cores do painel de investigação do Vale (preto profundo e vermelho sangue; o mapa não segue a identidade do instituto, de propósito).
const FUNDO = "#070707";
const LINHA = "#3b2a2e";
const LINHA_FORTE = "#ff4d5e";
const PREENCHE = "#3a0610";
// Contorno do Brasil: linha fina neon (com um brilho largo e fraco por baixo); estados com linha bem mais fraca.
const CONTORNO = "#ff4d5e";

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
function comContagem(col: Colecao, chave: "sigla" | "codigo" | "iso", contagem: Record<string, number>): Colecao {
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

export default function Mapa({
  entradas,
  dossies,
  selecionadoId,
  aoEscolher,
  zoom,
  aoMudarZoom,
  textos,
  textosMapa,
  baseDasMalhas,
  ramosDe,
  aoSelecionarNo,
  destaque = null,
  qualidadeBaixa = false,
  pais: paisFiltro = null,
  idioma,
}: PropsDoMapaNeon) {
  const t: TextosDoMapa = { ...TEXTOS_PT, ...(textosMapa as Partial<TextosDoMapa> | undefined) };
  const base = baseDasMalhas ?? BASE_PADRAO;

  const casos = useMemo<CasoNoMapa[]>(() => {
    const cor = new Map(dossies.map((d) => [d.slug, d.cor]));
    return entradas.map((e) => ({
      id: e.id,
      titulo: e.titulo,
      dossie: e.dossie,
      cor: cor.get(e.dossie) ?? "amarelo",
      pais: e.lugar.pais || "BR",
      // UF e município só no Brasil (a malha do IBGE); fora dele o ponto fica no centro do país.
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
  const mundo = useRef<Colecao>(vazio());
  const centrosPais = useRef<Record<string, Par>>({ BR: CENTRO_DO_BRASIL });
  const idiomaRef = useRef(idioma);
  const ufs = useRef(new Map<string, Colecao>());
  const centrosUf = useRef<Record<string, Par>>({});
  const centrosMun = useRef<Record<string, Par>>({});
  const casosRef = useRef(casos);
  const nivelRef = useRef<NivelDeZoom>("mundo");
  const ufSelRef = useRef<string | null>(null);
  const munSelRef = useRef<string | null>(null);
  const aoEscolherRef = useRef(aoEscolher);
  const aoMudarZoomRef = useRef(aoMudarZoom);
  const textosRef = useRef(t);
  const api = useRef<{ voltar: () => void; mundo: () => void; pais: (iso: string) => void; atualizar: () => Promise<void>; posicionarRamos: () => void } | null>(null);

  const [carga, setCarga] = useState<"carregando" | "pronto" | "sem-webgl" | "sem-malha">("carregando");
  const [nivel, setNivel] = useState<NivelDeZoom>("mundo");
  // O país aberto (nível "pais" e abaixo): "BR" desce a estado e município; os outros param no país.
  const [paisSel, setPaisSel] = useState<string | null>(null);
  const paisSelRef = useRef<string | null>(null);
  const [ufSel, setUfSel] = useState<string | null>(null);
  const [munSel, setMunSel] = useState<{ codigo: string; nome: string } | null>(null);
  const [agrupado, setAgrupado] = useState<Agrupado | null>(null);
  const [nomeDaUf, setNomeDaUf] = useState<Record<string, string>>({});
  // "Reduzir movimento": começa pelo pedido do sistema (prefers-reduced-motion) e a pessoa troca no botão.
  const [calmo, setCalmo] = useState<boolean>(() => (typeof window === "undefined" ? false : reduzMovimento()));
  const calmoRef = useRef(calmo);
  const baixaRef = useRef(qualidadeBaixa);
  // Ramificações: o caso aberto no mapa e onde o ponto dele está na tela (segue o mapa quando ele se move).
  const pontosRef = useRef(new Map<string, { coord: Par; aproximado: boolean }>());
  const [ancora, setAncora] = useState<{ x: number; y: number; w: number; h: number; aproximado: boolean } | null>(null);
  const [ramosFechados, setRamosFechados] = useState<string | null>(null);
  const ramosAbertos = selecionadoId && ramosFechados !== selecionadoId ? selecionadoId : null;
  const ramosAbertosRef = useRef<string | null>(null);

  useEffect(() => {
    aoEscolherRef.current = aoEscolher;
    aoMudarZoomRef.current = aoMudarZoom;
    casosRef.current = casos;
    textosRef.current = t;
    calmoRef.current = calmo;
    baixaRef.current = qualidadeBaixa;
    ramosAbertosRef.current = ramosAbertos;
    idiomaRef.current = idioma;
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
        { padding: folga, duration: calmoRef.current ? 0 : 700, maxZoom: 12 },
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
      const { porPais, porUf, porMunicipio } = contarCasos(lista);
      // Só baixa a malha das UFs que têm caso com município (para o centro do ponto); os outros ficam no centro da UF.
      const precisam = [...new Set(lista.filter((c) => (c.pais ?? "BR") === "BR" && c.municipioIbge).map(ufDoCaso).filter((s): s is string => !!s))];
      await Promise.all(precisam.map(lerUf));
      if (cancelado || !m) return;
      fonte("mundo")?.setData(comContagem(mundo.current, "iso", porPais) as never);
      fonte("brasil")?.setData(comContagem(brasil.current, "sigla", porUf) as never);
      const atual = ufSelRef.current;
      const col = atual ? ufs.current.get(atual) : undefined;
      fonte("uf")?.setData((col ? comContagem(col, "codigo", porMunicipio) : vazio()) as never);
      const pts = pontosDosCasos(lista, centrosUf.current, centrosMun.current, centrosPais.current);
      pontosRef.current = new Map(pts.features.map((f) => [f.properties.id, { coord: f.geometry.coordinates as Par, aproximado: f.properties.aproximado === 1 }]));
      fonte("casos")?.setData(pts as never);
      posicionarRamos();
    };

    /** Onde o ponto do caso aberto está na tela agora (as ramificações saem dele). */
    const posicionarRamos = () => {
      const id = ramosAbertosRef.current;
      const p = id ? pontosRef.current.get(id) : undefined;
      if (!m || !p) {
        setAncora(null);
        return;
      }
      const q = m.project(p.coord);
      const c = m.getContainer();
      setAncora({ x: q.x, y: q.y, w: c.clientWidth, h: c.clientHeight, aproximado: p.aproximado });
    };

    const selecionarUf = async (sigla: string) => {
      if (!m) return;
      setAgrupado(null);
      const col = await lerUf(sigla);
      if (cancelado || !m) return;
      ufSelRef.current = sigla;
      munSelRef.current = null;
      paisSelRef.current = "BR";
      setPaisSel("BR");
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

    /** Sai da UF (e do município): a malha dos municípios some e os filtros voltam ao país inteiro. */
    const limparUf = () => {
      if (!m) return;
      setAgrupado(null);
      ufSelRef.current = null;
      munSelRef.current = null;
      setUfSel(null);
      setMunSel(null);
      m.setFilter("brasil-fill", ["!=", ["get", "sigla"], ""]);
      m.setFilter("uf-sel", ["==", ["get", "codigo"], ""]);
      fonte("uf")?.setData(vazio() as never);
    };

    /** Abre um país: o Brasil com as 27 UFs (como era o mapa antes); os outros, na caixa dele, sem descer mais. */
    const selecionarPais = (iso: string) => {
      if (!m) return;
      limparUf();
      paisSelRef.current = iso;
      setPaisSel(iso);
      m.setFilter("mundo-sel", ["==", ["get", "iso"], iso === "BR" ? "-" : iso]);
      mudarNivel("pais");
      if (iso === "BR") {
        ir(CAIXA_BRASIL, 24);
        return;
      }
      const alvo = caixaDoPais(mundo.current.features.filter((x) => x.properties.iso === iso));
      if (alvo) ir(alvo, 40);
    };

    const voltarAoMundo = () => {
      if (!m) return;
      limparUf();
      paisSelRef.current = null;
      setPaisSel(null);
      m.setFilter("mundo-sel", ["==", ["get", "iso"], "-"]);
      mudarNivel("mundo");
      ir(CAIXA_MUNDO, 12);
    };

    const voltarUmNivel = () => {
      if (nivelRef.current === "municipio" && ufSelRef.current) void selecionarUf(ufSelRef.current);
      else if (nivelRef.current === "estado") selecionarPais("BR");
      else if (nivelRef.current === "pais") voltarAoMundo();
    };

    api.current = { voltar: voltarUmNivel, mundo: voltarAoMundo, pais: selecionarPais, atualizar, posicionarRamos };

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
            [CAIXA_MUNDO[0], CAIXA_MUNDO[1]],
            [CAIXA_MUNDO[2], CAIXA_MUNDO[3]],
          ],
          fitBoundsOptions: { padding: 12 },
          // Um mundo só (sem as cópias ao lado), para o mapa inteiro caber e ser lido de uma vez.
          renderWorldCopies: false,
          attributionControl: false,
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          minZoom: 0,
          maxZoom: 13,
          fadeDuration: 0,
          // Prompt 5, C2: no máximo 2 pixels por ponto (tela 4K ou zoom do navegador pediam até 3 ou 4, e a memória de vídeo do
          // mapa cresce com o quadrado disso).
          pixelRatio: Math.min(2, window.devicePixelRatio || 1),
        });
        m = nova;
        mapa.current = nova;
        nova.touchZoomRotate.disableRotation();

        nova.on("load", async () => {
          if (cancelado || !m) return;
          let col: Colecao;
          let doMundo: Colecao;
          try {
            // As duas malhas juntas: o Brasil do IBGE (~25 KB comprimido) e o mundo da Natural Earth (~50 KB comprimido).
            const [r, rm] = await Promise.all([fetch(`${base}brasil.geojson`), fetch(`${base}mundo.geojson`).catch(() => null)]);
            if (!r.ok) throw new Error(String(r.status));
            col = (await r.json()) as Colecao;
            // Sem a malha do mundo (servidor que ainda não a tem), o mapa continua sendo o do Brasil.
            doMundo = rm?.ok ? ((await rm.json()) as Colecao) : vazio();
          } catch {
            if (!cancelado) setCarga("sem-malha");
            return;
          }
          if (cancelado || !m) return;
          brasil.current = col;
          mundo.current = doMundo;
          for (const f of doMundo.features) {
            const iso = String(f.properties.iso ?? "");
            const c = centro(f.geometry);
            // País com vários pedaços (ilhas): o centro do maior pedaço (centro() já escolhe o maior).
            if (iso && c && !centrosPais.current[iso]) centrosPais.current[iso] = c;
          }
          const nomes: Record<string, string> = {};
          for (const f of col.features) {
            const c = centro(f.geometry);
            const s = String(f.properties.sigla ?? "");
            if (c && s) centrosUf.current[s] = c;
            if (s) nomes[s] = String(f.properties.nome ?? s);
          }
          setNomeDaUf(nomes);
          const { porUf, porPais } = contarCasos(casosRef.current);

          m.addSource("mundo", { type: "geojson", data: comContagem(doMundo, "iso", porPais) as never });
          m.addSource("brasil", { type: "geojson", data: comContagem(col, "sigla", porUf) as never });
          m.addSource("uf", { type: "geojson", data: vazio() as never });
          m.addSource("casos", { type: "geojson", data: pontosDosCasos([], {}, {}) as never });
          m.addSource("contorno", { type: "geojson", data: { type: "Feature", properties: {}, geometry: contornoExterno(col.features.map((f) => f.geometry)) } as never });

          // Sem preenchimento sólido: região sem caso fica quase apagada (o preenchimento mínimo só serve para o clique e a
          // dica acharem a UF); com casos, um vermelho escuro que cresce com a quantidade. O brilho mesmo vem do calor abaixo.
          const intensidade = ["interpolate", ["linear"], ["get", "casos"], 0, 0.01, 1, 0.12, 8, 0.28, 40, 0.45] as never;
          // O mundo: os países com a mesma linha fraca das UFs e o mesmo vermelho que cresce com os casos. Sem brilho (o brilho
          // largo é só do contorno do Brasil e dos pontos), para o mapa inteiro continuar leve num celular fraco.
          m.addLayer({ id: "mundo-fill", type: "fill", source: "mundo", paint: { "fill-color": PREENCHE, "fill-opacity": ["interpolate", ["linear"], ["get", "casos"], 0, 0.06, 1, 0.18, 8, 0.32, 40, 0.45] as never } });
          m.addLayer({ id: "mundo-linha", type: "line", source: "mundo", paint: { "line-color": CONTORNO, "line-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.22, 4, 0.32] as never, "line-width": 0.5 } });
          m.addLayer({ id: "mundo-hover", type: "line", source: "mundo", filter: ["==", ["get", "iso"], "-"], paint: { "line-color": LINHA_FORTE, "line-width": 1.6 } });
          m.addLayer({ id: "mundo-sel", type: "line", source: "mundo", filter: ["==", ["get", "iso"], "-"], paint: { "line-color": "#ffffff", "line-width": 1.8 } });
          m.addLayer({ id: "brasil-fill", type: "fill", source: "brasil", filter: ["!=", ["get", "sigla"], ""], paint: { "fill-color": PREENCHE, "fill-opacity": intensidade } });
          // As divisas das UFs só aparecem ao chegar perto: no mundo inteiro, o Brasil é só o contorno.
          m.addLayer({ id: "brasil-linha", type: "line", source: "brasil", paint: { "line-color": CONTORNO, "line-opacity": ["interpolate", ["linear"], ["zoom"], 1.5, 0, 3, 0.16] as never, "line-width": 0.6 } });
          m.addLayer({ id: "contorno-brilho", type: "line", source: "contorno", paint: { "line-color": CONTORNO, "line-opacity": 0.3, "line-width": 5, "line-blur": 4 } });
          m.addLayer({ id: "contorno", type: "line", source: "contorno", paint: { "line-color": CONTORNO, "line-opacity": 0.9, "line-width": 0.9 } });
          m.addLayer({ id: "brasil-hover", type: "line", source: "brasil", filter: ["==", ["get", "sigla"], ""], paint: { "line-color": LINHA_FORTE, "line-width": 2 } });
          m.addLayer({ id: "uf-fill", type: "fill", source: "uf", paint: { "fill-color": PREENCHE, "fill-opacity": intensidade } });
          m.addLayer({ id: "uf-linha", type: "line", source: "uf", paint: { "line-color": LINHA, "line-width": 0.6 } });
          // Densidade = brilho: onde há mais casos juntos, o neon fica mais largo e mais quente (até quase branco).
          m.addLayer({
            id: "casos-calor",
            type: "heatmap",
            source: "casos",
            layout: { visibility: baixaRef.current ? "none" : "visible" },
            paint: {
              "heatmap-weight": 1,
              "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 3, 0.7, 9, 1.4],
              "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 3, 26, 9, 60],
              "heatmap-opacity": 0.75,
              "heatmap-color": [
                "interpolate",
                ["linear"],
                ["heatmap-density"],
                0,
                "rgba(0,0,0,0)",
                0.15,
                "rgba(120,8,30,0.35)",
                0.4,
                "rgba(224,16,47,0.55)",
                0.7,
                "rgba(255,77,94,0.75)",
                1,
                "rgba(255,214,220,0.9)",
              ],
            } as never,
          });
          m.addLayer({ id: "uf-hover", type: "line", source: "uf", filter: ["==", ["get", "codigo"], ""], paint: { "line-color": LINHA_FORTE, "line-width": 1.8 } });
          m.addLayer({ id: "uf-sel", type: "line", source: "uf", filter: ["==", ["get", "codigo"], ""], paint: { "line-color": "#ffffff", "line-width": 2.4 } });
          m.addLayer({
            id: "casos-brilho",
            type: "circle",
            source: "casos",
            paint: { "circle-color": ["get", "cor"], "circle-opacity": 0.4, "circle-blur": 0.85, "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 13, 9, 26] },
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
              // Local aproximado (centro da UF): contorno mais apagado; a dica e a lista dizem "local aproximado".
              "circle-stroke-opacity": ["case", ["==", ["get", "aproximado"], 1], 0.3, 0.85] as never,
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
              const ap = Number(pts[0].properties?.aproximado) === 1 && textosRef.current.aproximado;
              dicaEm(e, `${String(pts[0].properties?.titulo ?? "")}${ap ? ` · ${ap}` : ""}`);
              return;
            }
            const nm = m.queryRenderedFeatures(e.point, { layers: ["uf-fill"] })[0];
            const us = m.queryRenderedFeatures(e.point, { layers: ["brasil-fill"] })[0];
            const ps = nm || us ? undefined : m.queryRenderedFeatures(e.point, { layers: ["mundo-fill"] })[0];
            // No mundo inteiro, o Brasil é um país só (a dica diz "Brasil", não a UF).
            const noMundo = nivelRef.current === "mundo";
            m.setFilter("uf-hover", ["==", ["get", "codigo"], String(nm?.properties?.codigo ?? "")]);
            m.setFilter("brasil-hover", ["==", ["get", "sigla"], nm || noMundo ? "" : String(us?.properties?.sigla ?? "")]);
            m.setFilter("mundo-hover", ["==", ["get", "iso"], String(ps?.properties?.iso || "-")]);
            m.getCanvas().style.cursor = nm || us || ps?.properties?.iso ? "pointer" : "";
            if (nm) dicaEm(e, `${String(nm.properties?.nome || nm.properties?.codigo)} · ${contagemTexto(Number(nm.properties?.casos ?? 0))}`);
            else if (us && noMundo) dicaEm(e, `${nomeDoPais("BR", idiomaRef.current, textosRef.current.brasil)} · ${contagemTexto(contarCasos(casosRef.current).porPais.BR ?? 0)}`);
            else if (us) dicaEm(e, `${String(us.properties?.nome ?? us.properties?.sigla)} · ${contagemTexto(Number(us.properties?.casos ?? 0))}`);
            else if (ps) dicaEm(e, `${nomeDoPais(String(ps.properties?.iso ?? ""), idiomaRef.current, String(ps.properties?.nome ?? ""))} · ${contagemTexto(Number(ps.properties?.casos ?? 0))}`);
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
              // No mundo inteiro, os casos de um país se amontoam num ponto só: o clique abre o país (e lá os pontos se separam).
              const doPais = new Set(pts.map((p) => String(p.properties?.pais ?? "BR")));
              if (itens.length > 1 && nivelRef.current === "mundo" && doPais.size === 1) {
                setAgrupado(null);
                selecionarPais([...doPais][0]);
                return;
              }
              if (itens.length === 1) {
                setAgrupado(null);
                setRamosFechados(null);
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
            // No mundo inteiro, o primeiro clique no Brasil abre o Brasil (as UFs); o seguinte, a UF.
            if (uf && nivelRef.current === "mundo") selecionarPais("BR");
            else if (uf) void selecionarUf(String(uf.properties?.sigla));
            else {
              const p = m.queryRenderedFeatures(e.point, { layers: ["mundo-fill"] })[0];
              const iso = String(p?.properties?.iso ?? "");
              if (iso && iso !== paisSelRef.current) selecionarPais(iso);
            }
          });

          // As ramificações acompanham o ponto enquanto o mapa anda ou aproxima.
          m.on("move", posicionarRamos);
          m.on("resize", posicionarRamos);

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

  // Quem manda o nível de fora (os botões de zoom da página) volta o mapa ao mundo, ou ao país aberto.
  useEffect(() => {
    if (zoom === "mundo" && nivelRef.current !== "mundo") api.current?.mundo();
    else if (zoom === "pais" && nivelRef.current !== "pais") api.current?.pais(paisSelRef.current ?? "BR");
  }, [zoom]);

  // O filtro por país da página: o mapa vai ao país escolhido (ou volta ao mundo).
  useEffect(() => {
    if (carga !== "pronto") return;
    if (paisFiltro) {
      if (paisSelRef.current !== paisFiltro || nivelRef.current === "mundo") api.current?.pais(paisFiltro);
    } else if (nivelRef.current !== "mundo") api.current?.mundo();
  }, [paisFiltro, carga]);

  // Caso aberto mudou (no mapa, na lista ou em outra visão): reposiciona as ramificações.
  useEffect(() => {
    api.current?.posicionarRamos();
  }, [ramosAbertos, carga]);

  // Destacar por tipo (legenda) e modo leve: só o tipo "caso" mantém os pontos acesos; o modo leve desliga o calor.
  useEffect(() => {
    const m = mapa.current;
    if (!m || carga !== "pronto") return;
    const apagado = destaque !== null && destaque !== "entrada";
    m.setPaintProperty("casos-ponto", "circle-opacity", apagado ? 0.15 : 1);
    m.setPaintProperty("casos-ponto", "circle-stroke-opacity", apagado ? 0.1 : (["case", ["==", ["get", "aproximado"], 1], 0.3, 0.85] as never));
    m.setPaintProperty("casos-calor", "heatmap-opacity", apagado ? 0.12 : 0.75);
    m.setLayoutProperty("casos-calor", "visibility", qualidadeBaixa ? "none" : "visible");
  }, [destaque, qualidadeBaixa, carga]);

  // Prompt 5, C2: o brilho dos pontos ficou parado. A pulsação ("neon respirando") mudava a pintura da camada a cada 100 ms, e
  // cada mudança redesenha o mapa inteiro em WebGL (com o calor e o halo borrado de todos os pontos), sem parar, enquanto o
  // mapa estivesse aberto. Junto com o fundo vivo e a teia, era o que mais pesava na página que caía ("This page couldn't load").
  // O halo continua (opacidade 0.4, a mesma do repouso de antes); só não pisca mais.

  const ramos = useMemo(() => (ramosAbertos && ramosDe ? ramosDe(ramosAbertos) : []), [ramosAbertos, ramosDe]);
  const casoAberto = ramosAbertos ? casos.find((c) => c.id === ramosAbertos) : undefined;
  const aproximadoAberto = !!ancora?.aproximado;

  /** Pontas das ramificações: em leque ao redor do ponto, dentro da moldura do mapa. */
  const pontas = useMemo(() => {
    if (!ancora) return [];
    const mostrados = ramos.slice(0, MAX_RAMOS);
    const n = mostrados.length;
    const raio = Math.max(70, Math.min(150, Math.min(ancora.w, ancora.h) * 0.3));
    // O leque abre para o lado de dentro do mapa (na direção do centro), mais largo quanto mais ramos houver.
    const base = Math.atan2(ancora.h / 2 - ancora.y, ancora.w / 2 - ancora.x);
    const arco = Math.min(2 * Math.PI, Math.max(0, n - 1) * 0.55);
    return mostrados.map((r, i) => {
      const ang = n === 1 ? base : arco >= 2 * Math.PI ? base + (2 * Math.PI * i) / n : base - arco / 2 + (arco * i) / (n - 1);
      const rr = raio * (i % 2 ? 0.82 : 1);
      // Margens: em cima ficam os níveis do mapa; embaixo, a lista e o crédito.
      const x = Math.min(ancora.w - 60, Math.max(60, ancora.x + Math.cos(ang) * rr * 1.25));
      const y = Math.min(ancora.h - 56, Math.max(64, ancora.y + Math.sin(ang) * rr));
      return { r, x, y, d: curvaDaAresta({ x: ancora.x, y: ancora.y }, { x, y }, `${r.tipo}:${r.chave}`, 0.18).d };
    });
  }, [ancora, ramos]);

  const nomeAberto = ufSel ? (nomeDaUf[ufSel] ?? ufSel) : "";
  const nomeDoPaisAberto = paisSel ? (paisSel === "BR" ? t.brasil : nomeDoPais(paisSel, idioma)) : "";

  return (
    // absolute inset-0 (não h-full): o palco (.ve-viz) só tem min-height no celular, então 100% da altura dele dava "auto"
    // e a tela do MapLibre ficava com a altura padrão de um canvas (300 px), cortada e preta (NOVAS-TAREFAS T31, 1.1).
    <div className="absolute inset-0 min-h-[360px] overflow-hidden bg-black font-mono text-[11px] uppercase tracking-wider text-[#f1f1ed]" role="region" aria-label={t.aria}>
      {/* O estilo mínimo do MapLibre, inline: sem controles, sem popups e sem CSS de pacote. */}
      <style>{`.maplibregl-map{position:relative;overflow:hidden;-webkit-tap-highlight-color:rgb(0 0 0/0)}.maplibregl-canvas{position:absolute;left:0;top:0}.maplibregl-canvas-container.maplibregl-interactive{cursor:grab;user-select:none}.maplibregl-canvas-container.maplibregl-touch-zoom-rotate,.maplibregl-canvas-container.maplibregl-touch-drag-pan{touch-action:pan-x pan-y}`}</style>
      {/* h-full e w-full além do inset-0: o CSS do MapLibre (.maplibregl-map) troca o absolute por relative, e sem altura
          própria a moldura do mapa caía para 0 px (tela preta). */}
      <div ref={raiz} className="absolute inset-0 h-full w-full" />

      {/* Níveis de zoom nomeados + trilha (Brasil / estado / município). */}
      {/* A largura deixa o botão "Reduzir movimento" (no canto direito) de fora: no celular, os quatro níveis quebram a linha. */}
      <div className="pointer-events-none absolute left-3 top-3 flex max-w-[calc(100%-11rem)] flex-col gap-2">
        <ol className="pointer-events-auto flex flex-wrap gap-x-3 gap-y-1" aria-label={t.nivel}>
          {NIVEIS.map((n, i) => (
            <li key={n} className={n === nivel ? "text-[#ff4d5e]" : "text-[#8f8f8a]"} aria-current={n === nivel ? "step" : undefined}>
              {String(i + 1).padStart(2, "0")} {textos.zoom[n]}
            </li>
          ))}
        </ol>
        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          {nivel !== "mundo" && (
            <button type="button" onClick={() => api.current?.voltar()} className="border border-[#3b2a2e] bg-black/80 px-2 py-1 text-[#ff4d5e] hover:border-[#ff4d5e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff4d5e]">
              {"< "}
              {t.voltar}
            </button>
          )}
          <span className="text-[#f1f1ed]">
            {t.mundo ?? TEXTOS_PT.mundo}
            {nomeDoPaisAberto && nivel !== "mundo" ? ` / ${nomeDoPaisAberto}` : ""}
            {nomeAberto && nivel !== "pais" && nivel !== "mundo" ? ` / ${nomeAberto}` : ""}
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

      {/* Ramificações do caso aberto: fios curvos do ponto até as pessoas, organizações e fontes ligadas (mesma lógica da
          Teia), que se desenham um a um. As pontas são botões (pessoa/organização abrem a ficha) e links (fontes): é também a
          versão para teclado e leitor de tela. */}
      {carga === "pronto" && ancora && casoAberto && pontas.length > 0 && (
        <div className="ve-ramos absolute inset-0 z-[5]" data-calmo={calmo ? "true" : "false"} role="group" aria-label={`${t.ramos ?? TEXTOS_PT.ramos}: ${casoAberto.titulo}`}>
          <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
            {pontas.map((p, i) => (
              <path
                key={`${i}:${p.r.tipo}:${p.r.chave}`}
                className="ve-ramo"
                d={p.d}
                pathLength={1}
                stroke={COR_DO_RAMO[p.r.tipo]}
                data-confianca={p.r.confianca}
                style={{ animationDelay: `${i * 70}ms` }}
              />
            ))}
            <circle className="ve-ramo-centro" cx={ancora.x} cy={ancora.y} r={10} />
          </svg>
          <ul className="m-0 list-none p-0">
            {pontas.map((p, i) => (
              <li key={`${i}:${p.r.tipo}:${p.r.chave}`} className="ve-ramo-ponta absolute" style={{ left: p.x, top: p.y, animationDelay: `${i * 70 + 120}ms` }}>
                {p.r.tipo === "fonte" ? (
                  <a href={p.r.chave} target="_blank" rel="noopener noreferrer nofollow" title={t.abrirFonte ?? TEXTOS_PT.abrirFonte}>
                    <i style={{ background: COR_DO_RAMO.fonte }} data-confianca={p.r.confianca} aria-hidden="true" />
                    {p.r.rotulo}
                  </a>
                ) : (
                  <button type="button" onClick={() => aoSelecionarNo?.(p.r.chave)} title={p.r.rotulo}>
                    <i style={{ background: COR_DO_RAMO[p.r.tipo] }} data-confianca={p.r.confianca} aria-hidden="true" />
                    {p.r.rotulo.length > 26 ? `${p.r.rotulo.slice(0, 25)}…` : p.r.rotulo}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {ramos.length > MAX_RAMOS && <p className="ve-ramo-mais absolute" style={{ left: ancora.x + 12, top: ancora.y + 12 }}>+{ramos.length - MAX_RAMOS}</p>}
          <button type="button" className="ve-ramo-fechar absolute right-3 top-12" onClick={() => setRamosFechados(ramosAbertos)}>
            × {t.fecharRamos ?? TEXTOS_PT.fecharRamos}
          </button>
          {aproximadoAberto && <p className="ve-ramo-aprox absolute right-3 top-20">{t.aproximado ?? TEXTOS_PT.aproximado}</p>}
        </div>
      )}

      {/* Reduzir movimento: para a pulsação e o desenho progressivo dos fios (além do prefers-reduced-motion do sistema). */}
      <button
        type="button"
        className="absolute right-3 top-3 z-10 border border-[#3b2a2e] bg-black/80 px-2 py-1 text-[10px] text-[#8f8f8a] hover:border-[#ff4d5e] hover:text-[#f1f1ed] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff4d5e]"
        aria-pressed={calmo}
        onClick={() => setCalmo((c) => !c)}
      >
        {calmo ? (t.ativarMovimento ?? TEXTOS_PT.ativarMovimento) : (t.reduzirMovimento ?? TEXTOS_PT.reduzirMovimento)}
      </button>

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
                {c.titulo} ({(c.pais ?? "BR") === "BR" ? (ufDoCaso(c) ?? "-") : nomeDoPais(c.pais ?? "", idioma)}, {c.situacao}
                {(c.pais ?? "BR") !== "BR" ? `, ${t.aproximadoPais ?? TEXTOS_PT.aproximadoPais}` : !c.municipioIbge && ufDoCaso(c) ? `, ${t.aproximado ?? TEXTOS_PT.aproximado}` : ""})
              </button>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

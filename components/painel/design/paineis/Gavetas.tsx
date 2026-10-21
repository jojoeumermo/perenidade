// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import galeria from "@/content/galeria.json";
import { rpc } from "@/lib/backend";
import { textoDoErro } from "../../comum";
import { Icone } from "../Icone";
import { ICONES_DAS_ARTES } from "../icones";
import { GRUPOS_DO_LABORATORIO, MODELOS_DO_LABORATORIO } from "../laboratorio";
import { GRUPOS, type Modelo, MODELOS, paginasDoModelo } from "../modelos";
import {
  type Camada,
  carregarImagem,
  COR,
  type Documento,
  elemento,
  forma,
  formatoDe,
  type FormatoId,
  imagem,
  marca,
  miniatura,
  NOMES_DOS_ELEMENTOS,
  prepararImagem,
  texto,
  usarVariaveis,
} from "../motor";
import { aplicarTema, TEMAS } from "../projeto";
import { ATIVO, BOTAO, Chave, Cores, CAMPO, Faixa, Miniatura, ROTULO, useEditor } from "../ui";
import { apagarDaBiblioteca, guardarPaleta, useBiblioteca, usarBloco } from "./Biblioteca";

const TITULOS = { modelos: "Modelos da marca", texto: "Texto", elementos: "Elementos", imagens: "Imagens", fundo: "Fundo", trabalhos: "Trabalhos" } as const;

/** A gaveta aberta: na tela grande, ao lado do trilho; no celular, uma folha que sobe de baixo. */
export function Gavetas({ celular }: { celular: boolean }) {
  const ed = useEditor();
  if (!ed.gaveta) return null;
  // No laboratório público os modelos são outros (sem a marca do instituto).
  const titulo = ed.gaveta === "modelos" && ed.laboratorio ? "Modelos" : TITULOS[ed.gaveta];
  const corpo = (
    <>
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <h2 className="font-serif text-xl font-semibold text-e-tinta">{titulo}</h2>
        <button type="button" className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-e-suave hover:bg-e-bordo-claro" onClick={() => ed.setGaveta(null)} aria-label="Fechar a gaveta">
          <Icone nome="fechar" className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 [scrollbar-width:thin]">
        {ed.gaveta === "modelos" && <GavetaModelos />}
        {ed.gaveta === "texto" && <GavetaTexto />}
        {ed.gaveta === "elementos" && <GavetaElementos />}
        {ed.gaveta === "imagens" && <GavetaImagens />}
        {ed.gaveta === "fundo" && <GavetaFundo />}
        {ed.gaveta === "trabalhos" && <GavetaTrabalhos />}
      </div>
    </>
  );
  if (celular)
    return (
      <div className="estudio-surge fixed inset-x-0 bottom-[3.6rem] z-[83] flex max-h-[64dvh] flex-col rounded-t-2xl border-t border-e-fio bg-e-painel shadow-[0_-12px_40px_rgba(0,0,0,0.35)]" role="dialog" aria-label={titulo}>
        {corpo}
      </div>
    );
  return <aside className="flex w-[19rem] shrink-0 flex-col border-r border-e-fio bg-e-painel" aria-label={titulo}>{corpo}</aside>;
}

// ───── Modelos ─────

const miniaturas = new Map<string, string>();
const ROTULO_DO_FORMATO: Partial<Record<FormatoId, string>> = { post: "4:5", carrossel: "4:5", quadrado: "Quadrado", story: "Story", avatar: "1:1", "cartaz-a4": "A4", "cartaz-a3": "A3", "folheto-a5": "A5", certificado: "A4", convite: "Convite", cracha: "Crachá", video: "16:9", banner: "OG", "banner-site": "Faixa", "capa-noticia": "16:9", "capa-rede": "Capa", "capa-podcast": "Podcast" };
const FILTROS: { id: string; nome: string; vale: (m: Modelo) => boolean }[] = [
  { id: "todos", nome: "Todos", vale: () => true },
  { id: "post", nome: "Post", vale: (m) => m.formato === "post" },
  { id: "story", nome: "Story", vale: (m) => m.formato === "story" },
  { id: "quadrado", nome: "Quadrado", vale: (m) => m.formato === "quadrado" || m.formato === "avatar" },
  { id: "carrossel", nome: "Carrossel", vale: (m) => m.grupo === "Carrossel" },
  { id: "datas", nome: "Datas", vale: (m) => m.grupo === "Datas" },
  { id: "impressos", nome: "Impressos", vale: (m) => m.grupo === "Impressos" },
  { id: "site", nome: "Site e vídeo", vale: (m) => m.grupo === "Site e vídeo" || m.grupo === "Capas e marca" },
];
const semAcento = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function MiniaturaDoModelo({ modelo }: { modelo: Modelo }) {
  const [src, setSrc] = useState(() => miniaturas.get(modelo.id) ?? "");
  const ed = useEditor();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (src || !ref.current) return;
    let vivo = true;
    const o = new IntersectionObserver(async (entradas) => {
      if (!entradas.some((e) => e.isIntersecting)) return;
      o.disconnect();
      const d = modelo.montar();
      usarVariaveis({ ...ed.vars, pagina: "01", total: modelo.paginas ? String(paginasDoModelo(modelo).length).padStart(2, "0") : "05" });
      const pronto = await miniatura({ ...d, camadas: d.camadas.map(ed.ajustarAltura) }, 300).catch(() => "");
      usarVariaveis(ed.vars);
      if (!pronto) return;
      miniaturas.set(modelo.id, pronto);
      if (vivo) setSrc(pronto);
    });
    o.observe(ref.current);
    return () => {
      vivo = false;
      o.disconnect();
    };
  }, [src, modelo, ed]);
  const f = formatoDe(modelo.formato);
  return (
    <div ref={ref} className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-md border border-e-fio bg-e-fundo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" className="max-h-full max-w-full object-contain" style={{ aspectRatio: f ? `${f.w}/${f.h}` : undefined }} /> : <span className="h-full w-full animate-pulse bg-e-fio/40" />}
      <span className="absolute top-1.5 right-1.5 rounded bg-[#1f1a14]/80 px-1.5 py-0.5 font-mono text-[0.62rem] text-[#f4ecd8]">{modelo.paginas ? `${paginasDoModelo(modelo).length} pág.` : (ROTULO_DO_FORMATO[modelo.formato] ?? "")}</span>
    </div>
  );
}

function GavetaModelos() {
  const ed = useEditor();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [escolha, setEscolha] = useState<Modelo | null>(null);
  const [usados, setUsados] = useState<string[]>([]);
  const catalogo = ed.laboratorio ? MODELOS_DO_LABORATORIO : MODELOS;
  const grupos = ed.laboratorio ? GRUPOS_DO_LABORATORIO : GRUPOS;
  const filtros = ed.laboratorio ? FILTROS.filter((f) => f.id !== "datas") : FILTROS;
  useEffect(() => {
    if (ed.laboratorio) return;
    rpc<{ modelo: string; vezes: number }[]>("design_modelos_mais_usados", {})
      .then((l) => setUsados((l ?? []).map((x) => x.modelo)))
      .catch(() => setUsados([]));
  }, [ed.laboratorio]);
  const lista = useMemo(() => {
    const b = semAcento(busca.trim());
    const f = FILTROS.find((x) => x.id === filtro) ?? FILTROS[0];
    return catalogo.filter((m) => f.vale(m) && (!b || semAcento(`${m.nome} ${m.grupo}`).includes(b)));
  }, [busca, filtro, catalogo]);
  const vazia = ed.doc.camadas.length === 0;
  const usar = (m: Modelo) => {
    if (vazia && ed.projeto.paginas.length === 1) ed.usarModelo(m, "trocar");
    else setEscolha(m);
  };
  const maisUsados = usados.map((id) => catalogo.find((m) => m.id === id)).filter(Boolean).slice(0, 4) as Modelo[];
  return (
    <div className="space-y-3">
      <label className="relative block">
        <Icone nome="busca" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-e-suave" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar modelo" aria-label="Procurar modelo" className={`${CAMPO} h-10 pl-9`} />
      </label>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar modelos">
        {filtros.map((f) => (
          <button key={f.id} type="button" onClick={() => setFiltro(f.id)} aria-pressed={filtro === f.id} className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${filtro === f.id ? "e-primario border-transparent" : "border-e-fio text-e-tinta hover:border-e-tinta"}`}>
            {f.nome}
          </button>
        ))}
      </div>
      {escolha && (
        <div className="estudio-surge rounded-lg border border-e-bordo bg-e-bordo-claro p-3 text-sm" role="dialog" aria-label="Como usar o modelo">
          <p className="font-semibold">{escolha.nome}</p>
          <p className="mt-0.5 text-e-suave">A página aberta já tem coisas. O que fazer?</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" className={BOTAO} onClick={() => { ed.usarModelo(escolha, "trocar"); setEscolha(null); }}>Trocar esta página</button>
            <button type="button" className={BOTAO} onClick={() => { ed.usarModelo(escolha, "acrescentar"); setEscolha(null); }}>Acrescentar depois dela</button>
            <button type="button" className="cursor-pointer px-2 text-e-suave underline" onClick={() => setEscolha(null)}>Cancelar</button>
          </div>
        </div>
      )}
      {!busca && filtro === "todos" && maisUsados.length > 0 && (
        <>
          <p className={ROTULO}>Mais usados pela equipe</p>
          <GradeDeModelos lista={maisUsados} usar={usar} />
        </>
      )}
      {(busca || filtro !== "todos" ? [null] : grupos).map((grupo) => {
        const doGrupo = grupo ? lista.filter((m) => m.grupo === grupo) : lista;
        if (!doGrupo.length) return null;
        return (
          <div key={grupo ?? "busca"}>
            {grupo && <p className={`${ROTULO} mb-2`}>{grupo}</p>}
            <GradeDeModelos lista={doGrupo} usar={usar} />
          </div>
        );
      })}
      {!lista.length && <p className="text-sm text-e-suave">Nenhum modelo com esse nome.</p>}
      <button type="button" className="sticky bottom-0 mt-2 flex h-11 w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-e-tinta bg-e-painel text-sm text-e-tinta hover:bg-e-bordo-claro" onClick={ed.acoes.novaPagina}>
        <Icone nome="mais" className="h-4 w-4" /> Página em branco
      </button>
    </div>
  );
}

function GradeDeModelos({ lista, usar }: { lista: Modelo[]; usar: (m: Modelo) => void }) {
  return (
    <ul className="grid grid-cols-2 gap-3">
      {lista.map((m) => (
        <li key={m.id}>
          <button type="button" className="group w-full cursor-pointer text-left" onClick={() => usar(m)} title={m.nome}>
            <span className="block rounded-md ring-e-bordo transition group-hover:ring-2">
              <MiniaturaDoModelo modelo={m} />
            </span>
            <span className="mt-1.5 block truncate text-sm text-e-tinta">{m.nome}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ───── Texto ─────

function GavetaTexto() {
  const ed = useEditor();
  const u = ed.doc.w / 100;
  const centro = (w: number, h: number) => ({ x: Math.round(ed.doc.w / 2 - w / 2), y: Math.round(ed.doc.h / 2 - h / 2) });
  const [novaVar, setNovaVar] = useState("");
  const presets: { nome: string; estiloDoBotao: React.CSSProperties; fazer: () => Camada }[] = [
    { nome: "Título", estiloDoBotao: { fontFamily: "var(--font-serif-display)", fontSize: 26, fontWeight: 600 }, fazer: () => texto({ ...centro(80 * u, 20 * u), w: 80 * u, texto: "Um título que fala alto", fonte: "serifa", tamanho: 11 * u, peso: 600, entrelinha: 0.97, espacamento: -0.02, estilo: "titulo" }) },
    { nome: "Subtítulo", estiloDoBotao: { fontFamily: "var(--font-serif-display)", fontSize: 18 }, fazer: () => texto({ ...centro(80 * u, 8 * u), w: 80 * u, texto: "Uma linha que explica o título.", fonte: "serifa", tamanho: 4.4 * u, peso: 400, cor: COR["Tinta suave"], entrelinha: 1.25, estilo: "subtitulo" }) },
    { nome: "Parágrafo", estiloDoBotao: { fontFamily: "var(--font-serif-display)", fontSize: 15 }, fazer: () => texto({ ...centro(80 * u, 12 * u), w: 80 * u, texto: "Escreva aqui. O texto quebra sozinho na largura da caixa; puxe as alças dos lados para mudar a largura.", fonte: "serifa", tamanho: 3.4 * u, peso: 400, entrelinha: 1.3, hifenizar: true, estilo: "corpo" }) },
    { nome: "Etiqueta", estiloDoBotao: { fontFamily: "var(--font-archive)", fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", color: "#6e1f1a" }, fazer: () => texto({ ...centro(60 * u, 3 * u), w: 60 * u, texto: "Educação popular", fonte: "mono", tamanho: 2 * u, peso: 500, cor: COR["Bordô"], espacamento: 0.2, maiusculas: true, estilo: "etiqueta" }) },
    { nome: "Tarja", estiloDoBotao: { fontFamily: "var(--font-ui)", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", background: "#1f1a14", color: "#f4ecd8", padding: "2px 8px" }, fazer: () => texto({ ...centro(50 * u, 6 * u), w: 50 * u, texto: "De graça", fonte: "sans", tamanho: 2.2 * u, peso: 800, cor: COR.Pergaminho, fundo: COR.Tinta, recuo: 1.4 * u, alinhar: "center", espacamento: 0.08, maiusculas: true }) },
    { nome: "Chamada em itálico", estiloDoBotao: { fontFamily: "var(--font-serif-display)", fontSize: 19, fontStyle: "italic", color: "#6e1f1a" }, fazer: () => texto({ ...centro(80 * u, 10 * u), w: 80 * u, texto: "Pergunte. Alguém responde.", fonte: "serifa", tamanho: 6 * u, peso: 500, italico: true, cor: COR["Bordô"] }) },
    { nome: "Cartaz", estiloDoBotao: { fontFamily: "var(--font-ui)", fontSize: 20, fontWeight: 900, fontStyle: "italic", textTransform: "uppercase" }, fazer: () => texto({ ...centro(84 * u, 20 * u), w: 84 * u, texto: "Estude de graça", fonte: "sans", tamanho: 11 * u, peso: 900, italico: true, maiusculas: true, entrelinha: 0.92, espacamento: -0.02, estilo: "chamada" }) },
    { nome: "Palavra com destaque", estiloDoBotao: { fontFamily: "var(--font-serif-display)", fontSize: 20, fontWeight: 600 }, fazer: () => texto({ ...centro(84 * u, 14 * u), w: 84 * u, texto: "Todo o conhecimento, para _todos_.", fonte: "serifa", tamanho: 8 * u, peso: 600, destaque: COR["Bordô"], entrelinha: 1 }) },
    { nome: "Escrito à mão", estiloDoBotao: { fontFamily: "var(--font-hand), cursive", fontSize: 24 }, fazer: () => texto({ ...centro(70 * u, 8 * u), w: 70 * u, texto: "um bilhete escrito à mão", fonte: "manuscrita", tamanho: 6 * u, peso: 500, cor: COR["Tinta suave"] }) },
    { nome: "Palavra-d'água", estiloDoBotao: { fontFamily: "var(--font-ui)", fontSize: 22, fontWeight: 900, opacity: 0.25 }, fazer: () => ({ ...texto({ x: -5 * u, y: ed.doc.h / 2 - 15 * u, w: 110 * u, texto: ed.laboratorio ? "RASCUNHO" : "LÚCIA", fonte: "sans", tamanho: 32 * u, peso: 900, alinhar: "center", cor: COR["Bordô"], entrelinha: 0.9 }), opacidade: 0.08, nome: "Palavra-d'água", rot: -12 }) },
    { nome: "Lista com estrelas", estiloDoBotao: { fontFamily: "var(--font-serif-display)", fontSize: 15 }, fazer: () => texto({ ...centro(80 * u, 20 * u), w: 80 * u, texto: "Aulas de graça\nAcervo livre\nComunidade aberta", fonte: "serifa", tamanho: 4.4 * u, peso: 500, entrelinha: 1.45, marcador: "estrela" }) },
    { nome: "Texto em arco", estiloDoBotao: { fontFamily: "var(--font-ui)", fontSize: 13, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }, fazer: () => texto({ ...centro(70 * u, 12 * u), w: 70 * u, texto: ed.laboratorio ? "Clube de leitura · desde 2024" : "Instituto Lúcia · educação popular", fonte: "sans", tamanho: 3.6 * u, peso: 800, maiusculas: true, espacamento: 0.12, alinhar: "center", curva: 120 }) },
    { nome: "Número que conta", estiloDoBotao: { fontFamily: "var(--font-serif-display)", fontSize: 24, fontWeight: 600, color: "#8a5f1c" }, fazer: () => texto({ ...centro(60 * u, 28 * u), w: 60 * u, texto: ed.laboratorio ? "120" : "{disciplinas}", fonte: "serifa", tamanho: 26 * u, peso: 600, cor: COR["Ouro escuro"], entrelinha: 0.85, anim: { tipo: "contador", inicio: 0.2, duracao: 1.6 } }) },
    { nome: "Endereço do site", estiloDoBotao: { fontFamily: "var(--font-archive)", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: "#6e1f1a" }, fazer: () => texto({ ...centro(60 * u, 3 * u), w: 60 * u, texto: "{link}", fonte: "mono", tamanho: 2 * u, peso: 500, cor: COR["Bordô"], espacamento: 0.14, maiusculas: true, estilo: "rodape" }) },
    { nome: "Numeração do carrossel", estiloDoBotao: { fontFamily: "var(--font-archive)", fontSize: 12, letterSpacing: "0.2em", color: "#6e1f1a" }, fazer: () => texto({ x: ed.doc.w - 30 * u, y: 8 * u, w: 22 * u, texto: "{pagina} / {total}", fonte: "mono", tamanho: 2 * u, peso: 500, cor: COR["Bordô"], alinhar: "right", espacamento: 0.2, nome: "Numeração" }) },
  ];
  return (
    <div className="space-y-5">
      <ul className="space-y-1.5">
        {presets.filter((p) => !ed.simples || ["Título", "Subtítulo", "Parágrafo", "Etiqueta", "Tarja", "Endereço do site"].includes(p.nome)).map((p) => (
          <li key={p.nome}>
            <button type="button" className="flex min-h-12 w-full cursor-pointer items-center rounded-lg border border-e-fio bg-e-campo px-3 py-2 text-left text-e-tinta hover:border-e-tinta" onClick={() => ed.acrescentar(p.fazer())}>
              <span style={p.estiloDoBotao}>{p.nome}</span>
            </button>
          </li>
        ))}
      </ul>
      {!ed.simples && (
        <section>
          <p className={`${ROTULO} mb-2`}>{ed.laboratorio ? "Estilos de texto (ligados)" : "Estilos da marca (ligados)"}</p>
          <p className="mb-2 text-xs text-e-suave">Texto ligado a um estilo muda junto em todas as páginas: mude o tamanho de um título e todos os títulos acompanham.</p>
          <ul className="space-y-1">
            {ed.projeto.estilos.map((e) => (
              <li key={e.id} className="flex items-center gap-1">
                <button type="button" className="min-w-0 flex-1 cursor-pointer truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-e-bordo-claro" onClick={() => ed.acrescentar(texto({ ...centro(80 * u, 10 * u), w: 80 * u, texto: e.nome, fonte: e.fonte, tamanho: e.tamanho * (ed.doc.w / 1080), peso: e.peso, italico: e.italico, cor: e.cor, entrelinha: e.entrelinha, espacamento: e.espacamento, maiusculas: e.maiusculas, estilo: e.id }))}>
                  {e.nome} <span className="text-xs text-e-suave">· {Math.round(e.tamanho)} pt</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <p className={`${ROTULO} mb-2`}>Variáveis</p>
        <p className="mb-2 text-xs text-e-suave">Escreva {"{nome}"} num texto e ele vira o valor daqui, em todas as páginas. {"{pagina}"} e {"{total}"} numeram o carrossel sozinhos.</p>
        <ul className="space-y-1.5">
          {Object.entries(ed.projeto.variaveis).map(([nome, valor]) => (
            <li key={nome} className="flex items-center gap-1.5">
              <code className="w-24 shrink-0 truncate font-mono text-xs text-e-bordo">{`{${nome}}`}</code>
              <input value={valor} onChange={(e) => ed.setProjeto((p) => ({ ...p, variaveis: { ...p.variaveis, [nome]: e.target.value } }), true, `Variável: ${nome}`)} aria-label={`Valor de ${nome}`} className={`${CAMPO} h-8`} placeholder={nome === "data" ? "hoje" : ""} />
            </li>
          ))}
        </ul>
        <form
          className="mt-2 flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            const nome = semAcento(novaVar.trim()).replace(/[^a-z_]/g, "");
            if (!nome || nome === "pagina" || nome === "total") return;
            ed.setProjeto((p) => ({ ...p, variaveis: { ...p.variaveis, [nome]: "" } }), true, `Nova variável: ${nome}`);
            setNovaVar("");
          }}
        >
          <input value={novaVar} onChange={(e) => setNovaVar(e.target.value)} placeholder="nova variável" aria-label="Nome da nova variável" className={`${CAMPO} h-8`} />
          <button type="submit" className={`${BOTAO} h-8`}>Criar</button>
        </form>
      </section>
    </div>
  );
}

// ───── Elementos ─────

function Previa({ camada, fundo = "#faf5e9" }: { camada: Camada; fundo?: string }) {
  const doc = useMemo<Documento>(() => ({ v: 1, w: 200, h: 200, fundo: { cor: fundo, pontilhado: false, bordaCima: "", bordaBaixo: "", espessura: 0 }, camadas: [{ ...camada, soGuia: false }] }), [camada, fundo]);
  return <Miniatura doc={doc} largura={64} className="rounded" />;
}

function GavetaElementos() {
  const ed = useEditor();
  const u = ed.doc.w / 100;
  const centro = (w: number, h: number) => ({ x: Math.round(ed.doc.w / 2 - w / 2), y: Math.round(ed.doc.h / 2 - h / 2) });
  const [qr, setQr] = useState(() => (ed.laboratorio ? "https://exemplo.org" : "https://institutolucia.org"));
  const biblioteca = useBiblioteca();
  const formas: [string, (k: number) => Camada][] = [
    ["Retângulo", (k) => forma("retangulo", { x: 0, y: 0, w: 40 * k, h: 26 * k })],
    ["Elipse", (k) => forma("elipse", { x: 0, y: 0, w: 30 * k, h: 30 * k, preenchimento: COR["Bordô"] })],
    ["Estrela", (k) => forma("estrela", { x: 0, y: 0, w: 18 * k, h: 18 * k })],
    ["Triângulo", (k) => forma("triangulo", { x: 0, y: 0, w: 22 * k, h: 20 * k, preenchimento: COR.Tinta })],
    ["Escudo", (k) => forma("escudo", { x: 0, y: 0, w: 22 * k, h: 26 * k, preenchimento: COR["Bordô"] })],
    ["Linha", (k) => forma("linha", { x: 0, y: 0, w: 80 * k, h: 2 * k, preenchimento: COR.Tinta, espessura: Math.max(2, 0.3 * k) })],
    ["Cunha", (k) => forma("cunha", { x: 0, y: 0, w: 40 * k, h: 40 * k, preenchimento: COR.Tinta })],
    ["Raios", (k) => forma("raios", { x: 0, y: 0, w: 100 * k, h: 100 * k, preenchimento: COR["Bordô"], opacidade: 0.5 })],
    ["Faixa preta", (k) => forma("retangulo", { x: 0, y: 0, w: 84 * k, h: 9 * k, preenchimento: COR.Tinta, nome: "Faixa" })],
    ["Moldura", (k) => forma("retangulo", { x: 0, y: 0, w: 60 * k, h: 60 * k, preenchimento: "transparent", borda: COR.Tinta, espessura: Math.max(2, 0.6 * k), nome: "Moldura" })],
  ];
  const desenhos: [string, (k: number) => Camada][] = [
    ["Símbolo", (k) => marca({ x: 0, y: 0, w: 20 * k, variante: "simbolo", cor: COR.Tinta })],
    ["Símbolo no círculo", (k) => marca({ x: 0, y: 0, w: 20 * k, variante: "circulo", cor: COR.Pergaminho, fundo: COR["Bordô"] })],
    ["Marca com o nome", (k) => marca({ x: 0, y: 0, w: 60 * k, h: 7 * k, variante: "nome", cor: COR.Tinta })],
    [NOMES_DOS_ELEMENTOS["foice-martelo"], (k) => elemento({ x: 0, y: 0, w: 30 * k, h: 30 * k, desenho: "foice-martelo", cor: COR["Vermelho da gráfica"] })],
    [NOMES_DOS_ELEMENTOS.punho, (k) => elemento({ x: 0, y: 0, w: 26 * k, h: 37 * k, desenho: "punho", cor: COR.Tinta })],
    [NOMES_DOS_ELEMENTOS["punho-cartaz"], (k) => elemento({ x: 0, y: 0, w: 26 * k, h: 37 * k, desenho: "punho-cartaz", cor: COR.Tinta })],
    [NOMES_DOS_ELEMENTOS.brasil, (k) => elemento({ x: 0, y: 0, w: 40 * k, h: 40 * k, desenho: "brasil", cor: COR.Verde })],
    [NOMES_DOS_ELEMENTOS["brasil-estados"], (k) => elemento({ x: 0, y: 0, w: 50 * k, h: 50 * k, desenho: "brasil-estados", cor: COR.Fio, fundo: COR["Vermelho da gráfica"], conteudo: "SP, RJ", espessura: 1.4 })],
    [NOMES_DOS_ELEMENTOS.louros, (k) => elemento({ x: 0, y: 0, w: 50 * k, h: 36 * k, desenho: "louros", cor: COR.Ouro })],
    [NOMES_DOS_ELEMENTOS.carimbo, (k) => elemento({ x: 0, y: 0, w: 26 * k, h: 26 * k, desenho: "carimbo", cor: COR["Bordô"], conteudo: ed.laboratorio ? "Feito à mão" : "Instituto Lúcia", conteudo2: ed.laboratorio ? "Edição especial" : "Educação popular", rot: -8, textura: true })],
    [NOMES_DOS_ELEMENTOS.selo, (k) => elemento({ x: 0, y: 0, w: 28 * k, h: 28 * k, desenho: "selo", cor: COR["Bordô"], fundo: COR.Pergaminho, conteudo: ed.laboratorio ? "Novo!" : "Lúcia,\npresente!" })],
    [NOMES_DOS_ELEMENTOS.ornamento, (k) => elemento({ x: 0, y: 0, w: 60 * k, h: 4 * k, desenho: "ornamento", cor: COR["Bordô"] })],
    [NOMES_DOS_ELEMENTOS["raios-traco"], (k) => elemento({ x: 0, y: 0, w: 100 * k, h: 100 * k, desenho: "raios-traco", cor: COR.Ouro, opacidade: 0.6 })],
    [NOMES_DOS_ELEMENTOS.pincelada, (k) => elemento({ x: 0, y: 0, w: 60 * k, h: 10 * k, desenho: "pincelada", cor: COR["Vermelho da gráfica"] })],
    [NOMES_DOS_ELEMENTOS["seta-mao"], (k) => elemento({ x: 0, y: 0, w: 18 * k, h: 18 * k, desenho: "seta-mao", cor: COR["Bordô"] })],
    [NOMES_DOS_ELEMENTOS.fita, (k) => elemento({ x: 0, y: 0, w: 22 * k, h: 5 * k, desenho: "fita", cor: "rgba(233, 220, 188, 0.92)", rot: -6 })],
  ];
  // A marca do instituto fica só no painel: o laboratório público não a oferece.
  const simbolos = ed.laboratorio ? desenhos.filter(([, f]) => f(1).tipo !== "marca") : desenhos;
  const noMeio = (c: Camada) => ({ ...c, ...centro(c.w, c.h) });
  const amostra = (f: (k: number) => Camada) => {
    const c = f(2);
    const lado = Math.max(c.w, c.h);
    const k = 160 / lado;
    return { ...f(2 * k), x: (200 - c.w * k) / 2, y: (200 - c.h * k) / 2 };
  };
  const grade = (lista: [string, (k: number) => Camada][]) => (
    <ul className="grid grid-cols-3 gap-2">
      {lista.map(([nome, f]) => (
        <li key={nome}>
          <button type="button" className="flex w-full cursor-pointer flex-col items-center gap-1 rounded-lg border border-e-fio bg-e-campo p-1.5 text-center text-[0.7rem] leading-tight text-e-tinta hover:border-e-tinta" onClick={() => ed.acrescentar(noMeio(f(u)))} title={nome}>
            <Previa camada={amostra(f)} />
            <span className="line-clamp-2">{nome}</span>
          </button>
        </li>
      ))}
    </ul>
  );
  const blocos = biblioteca.itens?.filter((i) => i.tipo === "bloco") ?? [];
  return (
    <div className="space-y-5">
      <section>
        <p className={`${ROTULO} mb-2`}>Formas</p>
        {grade(formas)}
      </section>
      <section>
        <p className={`${ROTULO} mb-2`}>{ed.laboratorio ? "Símbolos e desenhos" : "Marca e símbolos"}</p>
        {grade(simbolos)}
        <p className="mt-2 text-xs text-e-suave">
          {ed.laboratorio ? "Desenhos livres: Wikimedia Commons (domínio público e CC0) e Natural Earth." : "A marca é sempre a estrela sobre o livro aberto: não distorça e não troque as cores por fora da paleta. Desenhos livres: Wikimedia Commons (domínio público e CC0) e Natural Earth."}
        </p>
      </section>
      <section>
        <p className={`${ROTULO} mb-2`}>Ícones (capas de destaque e ilustração)</p>
        <ul className="grid grid-cols-6 gap-1">
          {ICONES_DAS_ARTES.map((i) => (
            <li key={i.nome}>
              <button type="button" className="flex aspect-square w-full cursor-pointer items-center justify-center rounded-md text-e-tinta hover:bg-e-bordo-claro" title={i.rotulo} aria-label={i.rotulo} onClick={() => ed.acrescentar(noMeio(elemento({ x: 0, y: 0, w: 22 * u, h: 22 * u, desenho: "icone", icone: i.nome, cor: COR.Tinta, espessura: 1.6, nome: i.rotulo })))}>
                <Icone nome={i.nome} className="h-6 w-6" />
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <p className={`${ROTULO} mb-2`}>Código QR</p>
        <form
          className="flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            if (qr.trim()) ed.acrescentar(noMeio(elemento({ x: 0, y: 0, w: 24 * u, h: 24 * u, desenho: "qr", conteudo: qr.trim(), cor: COR.Tinta, fundo: COR.Branco, nome: "Código QR" })));
          }}
        >
          <input value={qr} onChange={(e) => setQr(e.target.value)} aria-label="Endereço do código QR" className={`${CAMPO} h-9`} />
          <button type="submit" className={BOTAO}>Pôr</button>
        </form>
      </section>
      <section>
        <p className={`${ROTULO} mb-2`}>Guias do story (não saem na imagem)</p>
        <div className="flex flex-wrap gap-1.5">
          {["Figurinha de link", "Figurinha de enquete", "Caixa de perguntas", "Figurinha de música"].map((nome) => (
            <button key={nome} type="button" className={`${BOTAO} h-8 text-xs`} onClick={() => ed.acrescentar(noMeio(elemento({ x: 0, y: 0, w: 60 * u, h: nome.includes("perguntas") ? 34 * u : 14 * u, desenho: "figurinha", conteudo: nome, soGuia: true, nome })))}>
              {nome}
            </button>
          ))}
        </div>
      </section>
      <section>
        <p className={`${ROTULO} mb-2`}>Blocos da equipe</p>
        {!blocos.length && <p className="text-xs text-e-suave">Nenhum bloco ainda. Escolha camadas, clique com o botão direito e “Guardar como bloco reutilizável”.</p>}
        <ul className="space-y-1">
          {blocos.map((b) => (
            <li key={b.id} className="flex items-center gap-1">
              <button type="button" className="min-w-0 flex-1 cursor-pointer truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-e-bordo-claro" onClick={() => usarBloco(ed, b)}>
                <Icone nome="bloco" className="mr-1.5 inline h-4 w-4 text-e-suave" />
                {b.nome}
                <span className="text-xs text-e-suave"> · {b.local ? "neste aparelho" : b.autor}</span>
              </button>
              {b.meu && (
                <button type="button" className="cursor-pointer p-1 text-e-suave hover:text-[#c21f16]" aria-label={`Apagar o bloco ${b.nome}`} onClick={() => void apagarDaBiblioteca(b).then(biblioteca.recarregar)}>
                  <Icone nome="lixeira" className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ───── Imagens ─────

interface Achado {
  titulo: string;
  arquivo: string;
  miniatura: string;
  autor: string;
  licenca: string;
}

function GavetaImagens() {
  const ed = useEditor();
  const arquivo = useRef<HTMLInputElement>(null);
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState<Achado[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const centro = (w: number, h: number) => ({ x: Math.round(ed.doc.w / 2 - w / 2), y: Math.round(ed.doc.h / 2 - h / 2) });
  async function escolher(lista: FileList | null) {
    for (const f of [...(lista ?? [])].slice(0, 10)) {
      try {
        const src = await prepararImagem(f);
        const img = await carregarImagem(src);
        const w = Math.min(ed.doc.w * 0.6, img.width);
        const h = (w * img.height) / img.width;
        ed.acrescentar(imagem({ ...centro(w, h), w, h, src, nome: f.name.slice(0, 40) }));
      } catch {
        ed.avisar("Não deu para abrir esta imagem.", "erro");
      }
    }
    if (arquivo.current) arquivo.current.value = "";
  }
  async function daGaleria(src: string, credito: string, nome: string) {
    try {
      const img = await carregarImagem(src);
      const w = Math.min(ed.doc.w * 0.5, img.width);
      const h = (w * img.height) / img.width;
      ed.acrescentar(imagem({ ...centro(w, h), w, h, src, credito, nome }));
    } catch {
      ed.avisar("Não deu para carregar a imagem.", "erro");
    }
  }
  async function procurar() {
    const termo = busca.trim();
    if (termo.length < 3) return;
    setBuscando(true);
    setAchados(null);
    try {
      const r = await fetch(`/api/imagens?q=${encodeURIComponent(termo)}`);
      const dados = (await r.json()) as { achados?: Achado[] };
      setAchados(dados.achados ?? []);
    } catch {
      setAchados([]);
    } finally {
      setBuscando(false);
    }
  }
  return (
    <div className="space-y-5">
      <section>
        <button type="button" className="flex h-24 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-e-fio text-sm text-e-tinta hover:border-e-bordo" onClick={() => arquivo.current?.click()}>
          <Icone nome="enviar" className="h-6 w-6 text-e-suave" />
          Escolher do aparelho
          <span className="text-xs text-e-suave">ou arraste para a arte, ou cole (Ctrl+V)</span>
        </button>
        <input ref={arquivo} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} onChange={(e) => void escolher(e.target.files)} />
        <p className="mt-1.5 text-xs text-e-suave">Só imagem sua, em domínio público ou com licença livre. Fotos de pessoas, só com autorização.</p>
      </section>
      <section>
        <p className={`${ROTULO} mb-2`}>Galeria do instituto</p>
        <ul className="grid grid-cols-2 gap-2">
          {(galeria as { slug: string; titulo: string; autor: string; ano: string; imagem: string }[]).map((item) => (
            <li key={item.slug}>
              <button type="button" onClick={() => void daGaleria(item.imagem, `${item.autor}, ${item.ano}. Domínio público.`, item.titulo.slice(0, 40))} className="w-full cursor-pointer text-left" title={`${item.titulo} (${item.autor}, ${item.ano})`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.imagem} alt={item.titulo} className="aspect-[3/4] w-full rounded-md object-cover hover:ring-2 hover:ring-e-bordo" loading="lazy" />
                <span className="mt-1 block truncate text-xs text-e-tinta">{item.titulo}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <p className={`${ROTULO} mb-2`}>Wikimedia Commons</p>
        <form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); void procurar(); }}>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar imagem livre" aria-label="Procurar na Wikimedia Commons" className={CAMPO} />
          <button type="submit" className={BOTAO} disabled={buscando || busca.trim().length < 3}>{buscando ? "…" : "Buscar"}</button>
        </form>
        {achados && achados.length === 0 && <p className="mt-2 text-sm text-e-suave">Nada encontrado.</p>}
        <ul className="mt-2 grid grid-cols-2 gap-2">
          {achados?.map((a) => (
            <li key={a.arquivo}>
              <button type="button" onClick={() => void daGaleria(`/api/imagem?arquivo=${encodeURIComponent(a.arquivo)}`, `${a.autor ? `${a.autor}. ` : ""}${a.licenca}. Wikimedia Commons.`, a.titulo.slice(0, 40))} className="w-full cursor-pointer text-left" title={`${a.titulo} · ${a.licenca}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.miniatura} alt={a.titulo} className="aspect-[3/4] w-full rounded-md object-cover hover:ring-2 hover:ring-e-bordo" loading="lazy" />
                <span className="mt-1 block truncate text-xs">{a.titulo}</span>
                <span className="block truncate font-mono text-[0.62rem] text-e-suave">{a.licenca}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-e-suave">A busca traz só arquivos com licença livre. O crédito entra na camada e na legenda.</p>
      </section>
    </div>
  );
}

// ───── Fundo ─────

function GavetaFundo() {
  const ed = useEditor();
  const f = ed.doc.fundo;
  const u = ed.doc.w / 100;
  const mudarFundo = (m: Partial<Documento["fundo"]>, lembrar = true) => ed.setDoc((d) => ({ ...d, fundo: { ...d.fundo, ...m } }), lembrar, "Mudou o fundo");
  const [todas, setTodas] = useState(false);
  const biblioteca = useBiblioteca();
  const paletas = biblioteca.itens?.filter((i) => i.tipo === "paleta") ?? [];
  return (
    <div className="space-y-5">
      <section>
        <p className={`${ROTULO} mb-2`}>Cor</p>
        <Cores valor={f.cor} mudar={(cor) => mudarFundo({ cor, gradiente: null })} extras={ed.projeto.paleta} />
      </section>
      {!ed.simples && (
        <>
          <section className="space-y-2">
            <Chave rotulo="Degradê" ligado={Boolean(f.gradiente)} mudar={(v) => mudarFundo({ gradiente: v ? { de: f.cor, para: COR["Bordô"], angulo: 90 } : null })} />
            {f.gradiente && (
              <>
                <p className="text-xs text-e-suave">De</p>
                <Cores valor={f.gradiente.de} mudar={(de) => mudarFundo({ gradiente: { ...f.gradiente!, de } })} />
                <p className="text-xs text-e-suave">Para</p>
                <Cores valor={f.gradiente.para} mudar={(para) => mudarFundo({ gradiente: { ...f.gradiente!, para } })} />
                <Faixa rotulo="Ângulo" valor={f.gradiente.angulo} min={0} max={360} sufixo="°" mudar={(angulo, fim) => mudarFundo({ gradiente: { ...f.gradiente!, angulo } }, Boolean(fim))} />
              </>
            )}
          </section>
          <section className="space-y-2">
            <p className={ROTULO}>Textura</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  ["", "Nenhuma"],
                  ["papel", "Papel"],
                  ["serigrafia", "Serigrafia"],
                ] as const
              ).map(([id, nome]) => (
                <button key={id} type="button" className={`${BOTAO} h-8 text-xs ${(f.textura ?? "") === id ? ATIVO : ""}`} aria-pressed={(f.textura ?? "") === id} onClick={() => mudarFundo({ textura: id })}>
                  {nome}
                </button>
              ))}
            </div>
            <Chave rotulo="Trama de pontinhos" ligado={f.pontilhado} mudar={(pontilhado) => mudarFundo({ pontilhado })} />
            <Faixa rotulo="Vinheta (bordas escuras)" valor={Math.round((f.vinheta ?? 0) * 100)} min={0} max={80} sufixo="%" mudar={(v, fim) => mudarFundo({ vinheta: v / 100 }, Boolean(fim))} />
          </section>
          <section className="space-y-2">
            <p className={ROTULO}>Fios de cima e de baixo</p>
            <p className="text-xs text-e-suave">Em cima</p>
            <Cores valor={f.bordaCima} semCor mudar={(cor) => mudarFundo({ bordaCima: cor, espessura: f.espessura || Math.round(1.8 * u) })} />
            <p className="text-xs text-e-suave">Embaixo</p>
            <Cores valor={f.bordaBaixo} semCor mudar={(cor) => mudarFundo({ bordaBaixo: cor, espessura: f.espessura || Math.round(1.8 * u) })} />
            <Faixa rotulo="Espessura" valor={f.espessura} min={0} max={Math.round(6 * u)} mudar={(espessura, fim) => mudarFundo({ espessura }, Boolean(fim))} />
          </section>
        </>
      )}
      <section>
        <p className={`${ROTULO} mb-2`}>Temas de um clique</p>
        <Chave rotulo="Aplicar em todas as páginas" ligado={todas} mudar={setTodas} />
        <ul className="mt-2 space-y-1.5">
          {TEMAS.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-3 rounded-lg border border-e-fio bg-e-campo p-2 text-left hover:border-e-tinta"
                onClick={() => {
                  if (todas) ed.setProjeto((p) => ({ ...p, paginas: p.paginas.map((d) => aplicarTema(d, t)) }), true, `Tema: ${t.nome}`);
                  else ed.setDoc((d) => aplicarTema(d, t), true, `Tema: ${t.nome}`);
                }}
              >
                <span className="flex shrink-0 overflow-hidden rounded-md border border-black/10">
                  {[t.cores.fundo, t.cores.texto, t.cores.destaque, t.cores.faixa].map((c, i) => (
                    <span key={i} className="h-8 w-4" style={{ background: c }} />
                  ))}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{t.nome}</span>
                  <span className="block text-xs text-e-suave">{t.descricao}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      {!ed.simples && (
        <section className="space-y-2">
          <p className={ROTULO}>Paleta desta campanha</p>
          <p className="text-xs text-e-suave">Cores além das da marca, para esta arte. Aparecem em todas as escolhas de cor e não contam como “fora da paleta”.</p>
          <div className="flex flex-wrap gap-1.5">
            {ed.projeto.paleta.map((c) => (
              <button key={c} type="button" title={`Tirar ${c}`} aria-label={`Tirar ${c} da paleta`} className="h-7 w-7 cursor-pointer rounded-full border border-black/15" style={{ background: c }} onClick={() => ed.setProjeto((p) => ({ ...p, paleta: p.paleta.filter((x) => x !== c) }))} />
            ))}
            <label className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-dashed border-e-suave text-e-suave" title="Acrescentar cor">
              <Icone nome="mais" className="h-4 w-4" />
              <input type="color" className="absolute inset-0 cursor-pointer opacity-0" aria-label="Acrescentar cor à paleta" onChange={(e) => ed.setProjeto((p) => ({ ...p, paleta: [...new Set([...p.paleta, e.target.value])].slice(0, 24) }))} />
            </label>
          </div>
          {ed.projeto.paleta.length > 0 && (
            <button type="button" className={`${BOTAO} h-8 text-xs`} onClick={() => { const nome = window.prompt("Nome da paleta:", ed.titulo)?.trim(); if (nome) void guardarPaleta(ed, nome); }}>
              Guardar na biblioteca da equipe
            </button>
          )}
          {paletas.length > 0 && (
            <ul className="space-y-1">
              {paletas.map((p) => (
                <li key={p.id}>
                  <button type="button" className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-e-bordo-claro" onClick={() => ed.setProjeto((pr) => ({ ...pr, paleta: [...new Set([...pr.paleta, ...(p.dados.cores ?? [])])].slice(0, 24) }), true, `Paleta: ${p.nome}`)}>
                    <span className="flex">
                      {(p.dados.cores ?? []).slice(0, 6).map((c) => (
                        <span key={c} className="h-4 w-4" style={{ background: c }} />
                      ))}
                    </span>
                    {p.nome}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

// ───── Trabalhos ─────

export interface Trabalho {
  id: string;
  titulo: string;
  formato: string;
  largura: number;
  altura: number;
  autor: string;
  meu: boolean;
  compartilhado: boolean;
  miniatura: string;
  atualizado_em: string;
  pasta?: string;
  etiquetas?: string[];
  status?: string;
  apagado_em?: string | null;
  paginas?: number;
  alcance?: number | null;
  publicado_em?: string | null;
}

export const NOMES_DO_STATUS: Record<string, string> = { rascunho: "Rascunho", revisao: "Em revisão", ajustes: "Pedido de ajuste", aprovado: "Aprovado", publicado: "Publicado" };

function GavetaTrabalhos() {
  const ed = useEditor();
  const [lista, setLista] = useState<Trabalho[] | null>(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "meus" | "revisao" | "aprovado" | "alcance" | "lixeira">("todos");
  const [pasta, setPasta] = useState("");
  const [volta, setVolta] = useState(0);
  useEffect(() => {
    let vivo = true;
    rpc<Trabalho[]>("designs_listar", filtro === "lixeira" ? { p_lixeira: true } : {})
      .then((l) => vivo && (setLista(l ?? []), setErro("")))
      .catch((e) => vivo && (setLista([]), setErro(filtro === "lixeira" ? "A lixeira chega quando o banco for atualizado." : textoDoErro(e))));
    return () => {
      vivo = false;
    };
  }, [filtro, volta]);
  const pastas = useMemo(() => [...new Set((lista ?? []).map((t) => t.pasta).filter(Boolean) as string[])].sort(), [lista]);
  const visiveis = useMemo(() => {
    const b = semAcento(busca.trim());
    return (lista ?? []).filter((t) => {
      if (filtro === "meus" && !t.meu) return false;
      if (filtro === "revisao" && t.status !== "revisao" && t.status !== "ajustes") return false;
      if (filtro === "aprovado" && t.status !== "aprovado" && t.status !== "publicado") return false;
      if (filtro === "alcance" && !(t.alcance && t.alcance > 0)) return false;
      if (pasta && t.pasta !== pasta) return false;
      return !b || semAcento(`${t.titulo} ${t.autor} ${t.pasta ?? ""} ${(t.etiquetas ?? []).join(" ")}`).includes(b);
    }).sort((x, y) => (filtro === "alcance" ? (y.alcance ?? 0) - (x.alcance ?? 0) : 0));
  }, [lista, busca, filtro, pasta]);
  const agir = async (funcao: string, args: Record<string, unknown>, ok: string) => {
    try {
      await rpc(funcao, args);
      ed.avisar(ok);
      setVolta((v) => v + 1);
    } catch (e) {
      ed.avisar(textoDoErro(e), "erro");
    }
  };
  const organizar = (t: Trabalho) => {
    const novaPasta = window.prompt("Pasta (deixe vazio para tirar da pasta):", t.pasta ?? "");
    if (novaPasta === null) return;
    const etiquetas = window.prompt("Etiquetas, separadas por vírgula:", (t.etiquetas ?? []).join(", "));
    if (etiquetas === null) return;
    void agir("design_organizar", { p_id: t.id, p_pasta: novaPasta.trim().slice(0, 60), p_etiquetas: etiquetas.split(",").map((e) => e.trim()).filter(Boolean).slice(0, 12) }, "Organizado.");
  };
  return (
    <div className="space-y-3">
      <label className="relative block">
        <Icone nome="busca" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-e-suave" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar por título, pessoa ou etiqueta" aria-label="Procurar trabalho" className={`${CAMPO} h-10 pl-9`} />
      </label>
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ["todos", "Todos"],
            ["meus", "Meus"],
            ["revisao", "Em revisão"],
            ["aprovado", "Aprovados"],
            ["alcance", "Maior alcance"],
            ["lixeira", "Lixeira"],
          ] as const
        ).map(([id, nome]) => (
          <button key={id} type="button" onClick={() => setFiltro(id)} aria-pressed={filtro === id} className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${filtro === id ? "e-primario border-transparent" : "border-e-fio hover:border-e-tinta"}`}>
            {nome}
          </button>
        ))}
      </div>
      {pastas.length > 0 && (
        <select value={pasta} onChange={(e) => setPasta(e.target.value)} aria-label="Pasta" className={CAMPO}>
          <option value="">Todas as pastas</option>
          {pastas.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      )}
      {erro && <p className="text-sm text-e-bordo">{erro}</p>}
      {lista === null && <p className="text-sm text-e-suave">Carregando…</p>}
      {lista && !visiveis.length && !erro && <p className="text-sm text-e-suave">{filtro === "lixeira" ? "A lixeira está vazia." : "Nenhum trabalho aqui ainda. Use “Guardar” na barra de cima."}</p>}
      <ul className="space-y-2">
        {visiveis.map((t) => (
          <li key={t.id} className={`rounded-lg border p-2 ${t.id === ed.idSalvo ? "border-e-bordo" : "border-e-fio"}`}>
            <div className="flex gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {t.miniatura ? <img src={t.miniatura} alt="" className="h-20 w-16 shrink-0 rounded object-contain" /> : <span className="h-20 w-16 shrink-0 rounded bg-e-fio" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{t.titulo}</p>
                <p className="truncate text-xs text-e-suave">
                  {t.autor} · {new Date(t.atualizado_em).toLocaleDateString("pt-BR")}
                  {t.paginas && t.paginas > 1 ? ` · ${t.paginas} páginas` : ""}
                </p>
                <p className="mt-1 flex flex-wrap gap-1">
                  {t.status && t.status !== "rascunho" && <span className={`rounded px-1.5 py-0.5 text-[0.65rem] ${t.status === "aprovado" || t.status === "publicado" ? "bg-[#2f5d34] text-white" : "bg-e-ouro/25"}`}>{NOMES_DO_STATUS[t.status] ?? t.status}</span>}
                  {t.pasta && <span className="rounded bg-e-fio/60 px-1.5 py-0.5 text-[0.65rem]">{t.pasta}</span>}
                  {(t.etiquetas ?? []).map((e) => (
                    <span key={e} className="rounded border border-e-fio px-1.5 py-0.5 text-[0.65rem]">#{e}</span>
                  ))}
                  {typeof t.alcance === "number" && <span className="rounded bg-e-bordo-claro px-1.5 py-0.5 text-[0.65rem] text-e-bordo">{t.alcance.toLocaleString("pt-BR")} de alcance</span>}
                </p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {filtro === "lixeira" ? (
                <>
                  <button type="button" className={`${BOTAO} h-7 text-xs`} onClick={() => void agir("design_restaurar", { p_id: t.id }, "Trabalho de volta.")}>
                    <Icone nome="restaurar" className="h-3.5 w-3.5" /> Restaurar
                  </button>
                  {t.meu && (
                    <button type="button" className={`${BOTAO} h-7 text-xs text-[#c21f16]`} onClick={() => window.confirm("Apagar de vez? Não dá para desfazer.") && void agir("design_apagar_de_vez", { p_id: t.id }, "Apagado de vez.")}>
                      Apagar de vez
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button type="button" className={`${BOTAO} h-7 text-xs`} onClick={() => ed.abrir({ tipo: "trabalho", id: t.id })}>Abrir</button>
                  <button type="button" className={`${BOTAO} h-7 text-xs`} onClick={() => ed.abrir({ tipo: "trabalho", id: t.id, copia: true })} title="Uma cópia sua, para mexer sem mudar o original">Fazer cópia</button>
                  {t.meu && <button type="button" className={`${BOTAO} h-7 text-xs`} onClick={() => organizar(t)}>Pasta e etiquetas</button>}
                  {(t.status === "aprovado" || t.status === "publicado") && (
                    <button type="button" className={`${BOTAO} h-7 text-xs`} title="Anote o alcance que o Instagram mostra, para saber o que funcionou" onClick={() => {
                      const valor = window.prompt("Alcance do post (o número que o Instagram mostra em Insights):", String(t.alcance ?? ""));
                      const n = Number((valor ?? "").replace(/\D/g, ""));
                      if (valor !== null && Number.isFinite(n)) void agir("design_alcance", { p_id: t.id, p_alcance: n }, "Alcance anotado.");
                    }}>
                      Alcance
                    </button>
                  )}
                  {t.meu && (
                    <button type="button" className={`${BOTAO} h-7 text-xs`} aria-label={`Mandar ${t.titulo} para a lixeira`} title="Mandar para a lixeira" onClick={() => void agir("design_apagar", { p_id: t.id }, "Foi para a lixeira (dá para restaurar).")}>
                      <Icone nome="lixeira" className="h-3.5 w-3.5" />
                    </button>
                  )}
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

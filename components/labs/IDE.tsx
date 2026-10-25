// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { chaveDoRascunho, conferirHtml, conferirLinhas, conferirSaida, type Exercicio, type Perfil, PERFIS, SQL_EXEMPLO } from "@/lib/laboratorios";
import { abrirZip, type ArquivoDoProjeto, montarZip } from "@/lib/zip";
import { lerDoLink, linkDoProjeto } from "@/lib/compartilhar-projeto";
import { useI18n } from "../I18n";
import { Selo } from "../Selo";
import { EditorDeCodigo } from "./EditorDeCodigo";
import { ISOLAR_WORKER } from "@/lib/isolamento";

const TEXTOS: Record<string, Record<string, string>> = {
  pt: { arquivos: "Arquivos", novo: "Novo arquivo", apagar: "Apagar", renomear: "Renomear", executar: "Executar", parar: "Parar", limpar: "Limpar", saida: "Saída", previa: "Prévia", baixar: "Baixar (.zip)", abrir: "Abrir arquivo ou .zip", exemplo: "Exemplo", restaurar: "Restaurar rascunho", guardado: "Rascunho guardado neste navegador", carregando: "Carregando o interpretador…", primeira: "Na primeira vez o navegador baixa o interpretador:", carregar: "Carregar e executar", semWasm: "Este navegador não tem WebAssembly ou Web Workers: use o Chrome, o Firefox ou o Edge atualizados.", tempo: "O programa passou de 20 segundos e foi interrompido. Confira se não há um laço sem fim.", falhou: "O interpretador não carregou. Recarregue a página e tente de novo.", entradas: "Entradas (uma por linha, para input)", testes: "Conferir o exercício", passou: "passou", falhou2: "falhou", dica: "Dica", solucao: "Ver a solução", naoRoda: "O que não roda aqui", privacidade: "O que você escreve não sai deste aparelho: o código roda no navegador e o rascunho fica só aqui. Baixe o projeto para guardar.", simples: "Editor simples", realce: "Realce", fonte: "Letra", parabens: "Tudo certo! Exercício concluído.", quase: "Ainda não: veja o que falhou e a dica.", teclas: "Ctrl+Enter executa · Ctrl+S guarda · Tab recua", apagarConfirma: "Apagar este arquivo?", modelos: "Modelos", compartilhar: "Compartilhar link", copiado: "Link copiado: quem abrir vê uma cópia do projeto (o código vai no próprio link, não fica guardado em servidor nenhum).", grandeDemais: "O projeto é grande demais para caber num link: baixe o .zip.", ladoALado: "Console ao lado", projeto: "Projeto livre", console: "Console", tabela: "Tabela", tarefa: "Exercício", mais: "Mais opções", consoleVazio: "Aperte Executar (ou Ctrl+Enter) e a saída aparece aqui.", tempoDeExecucao: "terminou em {ms} ms", erroDeTipo: "erro de tipo", doLink: "Projeto aberto a partir de um link compartilhado." },
  en: { arquivos: "Files", novo: "New file", apagar: "Delete", renomear: "Rename", executar: "Run", parar: "Stop", limpar: "Clear", saida: "Output", previa: "Preview", baixar: "Download (.zip)", abrir: "Open file or .zip", exemplo: "Example", restaurar: "Restore draft", guardado: "Draft saved in this browser", carregando: "Loading the interpreter…", primeira: "The first time, the browser downloads the interpreter:", carregar: "Load and run", semWasm: "This browser lacks WebAssembly or Web Workers: use an up-to-date Chrome, Firefox or Edge.", tempo: "The program ran over 20 seconds and was stopped. Check for an endless loop.", falhou: "The interpreter did not load. Reload the page and try again.", entradas: "Inputs (one per line, for input)", testes: "Check the exercise", passou: "passed", falhou2: "failed", dica: "Hint", solucao: "Show solution", naoRoda: "What does not run here", privacidade: "What you write never leaves this device: code runs in the browser and the draft stays here. Download the project to keep it.", simples: "Simple editor", realce: "Highlight", fonte: "Font", parabens: "All good! Exercise complete.", quase: "Not yet: see what failed and the hint.", teclas: "Ctrl+Enter runs · Ctrl+S saves · Tab indents", apagarConfirma: "Delete this file?", modelos: "Templates", compartilhar: "Share link", copiado: "Link copied: whoever opens it gets a copy of the project (the code travels in the link itself, not on any server).", grandeDemais: "The project is too big for a link: download the .zip.", ladoALado: "Console beside", tempoDeExecucao: "finished in {ms} ms", erroDeTipo: "type error", doLink: "Project opened from a shared link.", projeto: "Free project", console: "Console", tabela: "Table", tarefa: "Exercise", mais: "More options", consoleVazio: "Press Run (or Ctrl+Enter) and the output shows up here." },
};
TEXTOS.es = { ...TEXTOS.pt, arquivos: "Archivos", novo: "Nuevo archivo", apagar: "Borrar", executar: "Ejecutar", parar: "Detener", limpar: "Limpiar", saida: "Salida", previa: "Vista previa", baixar: "Descargar (.zip)", abrir: "Abrir archivo o .zip", exemplo: "Ejemplo", restaurar: "Restaurar borrador", guardado: "Borrador guardado en este navegador", carregando: "Cargando el intérprete…", primeira: "La primera vez el navegador descarga el intérprete:", carregar: "Cargar y ejecutar", testes: "Comprobar el ejercicio", passou: "pasó", falhou2: "falló", dica: "Pista", solucao: "Ver la solución", naoRoda: "Lo que no corre aquí", parabens: "¡Todo bien! Ejercicio completo.", quase: "Todavía no: mira lo que falló y la pista.", apagarConfirma: "¿Borrar este archivo?" };
TEXTOS.ru = { ...TEXTOS.en, arquivos: "Файлы", novo: "Новый файл", apagar: "Удалить", executar: "Запустить", parar: "Стоп", limpar: "Очистить", saida: "Вывод", previa: "Предпросмотр", baixar: "Скачать (.zip)", abrir: "Открыть файл или .zip", exemplo: "Пример", testes: "Проверить задание", passou: "пройден", falhou2: "не пройден", dica: "Подсказка", solucao: "Показать решение", parabens: "Всё верно! Задание выполнено.", quase: "Пока нет: смотрите, что не прошло, и подсказку." };
TEXTOS.zh = { ...TEXTOS.en, arquivos: "文件", novo: "新建文件", apagar: "删除", executar: "运行", parar: "停止", limpar: "清空", saida: "输出", previa: "预览", baixar: "下载（.zip）", abrir: "打开文件或 .zip", exemplo: "示例", testes: "检查练习", passou: "通过", falhou2: "未通过", dica: "提示", solucao: "查看答案", parabens: "全部正确！练习完成。", quase: "还没有：看看哪里没通过以及提示。" };

type Linha = { texto: string; erro?: boolean };
const LIMITE_TEMPO = 20_000;
const agora = () => performance.now();
const semAssinatura = () => () => {};

function montarDocumento(arquivos: ArquivoDoProjeto[]): string {
  const indice = arquivos.find((a) => a.nome === "index.html")?.conteudo ?? "<!doctype html><p>Crie um index.html.</p>";
  const de = (nome: string) => arquivos.find((a) => a.nome === nome || a.nome === nome.replace(/^\.\//, ""))?.conteudo;
  let html = indice
    .replace(/<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi, (m, href: string) => { const c = de(href); return c !== undefined ? `<style>${c}</style>` : m; })
    .replace(/<script[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi, (m, src: string) => { const c = de(src); return c !== undefined ? `<script>${c.replace(/<\/script/gi, "<\\/script")}</script>` : m; });
  const console = `<script>(function(){var p=function(t){return function(){var a=[].slice.call(arguments).map(function(x){try{return typeof x==="object"?JSON.stringify(x):String(x)}catch(e){return String(x)}});parent.postMessage({lucia:1,type:t,text:a.join(" ")},"*")}};console.log=p("out");console.info=p("out");console.warn=p("err");console.error=p("err");window.onerror=function(m,s,l){p("err")(m+(l?" (linha "+l+")":""))}})()</script>`;
  html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (m) => m + console) : console + html;
  return html;
}

/**
 * A IDE do instituto: arquivos, editor, execução e saída, tudo no navegador. Perfis: Python (Pyodide), PHP (php-wasm),
 * Web (prévia isolada), JavaScript (worker) e SQL (PostgreSQL em WebAssembly). Nenhum projeto vai para servidor: o
 * rascunho fica no aparelho e o projeto baixa como .zip. Em modo aula, traz o enunciado e confere os testes.
 */
export function IDE({ perfil, exercicio, aoConcluir }: { perfil: Perfil; exercicio?: Exercicio; aoConcluir?: (id: string) => void }) {
  const { lang } = useI18n();
  const s = TEXTOS[lang] ?? TEXTOS.pt;
  const chave = chaveDoRascunho(perfil, exercicio?.id);
  const inicial = useMemo<ArquivoDoProjeto[]>(() => (exercicio ? exercicio.arquivos : PERFIS[perfil].exemplo).map((a) => ({ ...a })), [perfil, exercicio]);
  const [arquivos, setArquivos] = useState<ArquivoDoProjeto[]>(inicial);
  const [ativo, setAtivo] = useState(inicial[0]?.nome ?? "");
  const [entrada, setEntrada] = useState(exercicio?.entrada ?? PERFIS[perfil].entrada ?? "");
  const [saida, setSaida] = useState<Linha[]>([]);
  const [linhas, setLinhas] = useState<{ campos: string[]; linhas: unknown[][] } | null>(null);
  const [estado, setEstado] = useState<"parado" | "carregando" | "rodando">("parado");
  const [documento, setDocumento] = useState("");
  const [resultado, setResultado] = useState<boolean[] | null>(null);
  const [dicasVistas, setDicasVistas] = useState(0);
  const [verSolucao, setVerSolucao] = useState(false);
  const [aviso, setAviso] = useState("");
  // O rascunho guardado só existe no navegador: no servidor (e na primeira pintura) não há, para não destoar.
  const [guardouAgora, setTemRascunho] = useState(false);
  const jaTinha = useSyncExternalStore(semAssinatura, () => { try { return Boolean(window.localStorage.getItem(chave)); } catch { return false; } }, () => false);
  const temRascunho = guardouAgora || jaTinha;
  const [confirmarDownload, setConfirmarDownload] = useState(false);
  const [realce, setRealce] = useState(true);
  const [fonte, setFonte] = useState(14);
  const [arquivosAbertos, setArquivosAbertos] = useState(true);
  const worker = useRef<Worker | null>(null);
  const compilado = useRef<Worker | null>(null);
  const relogio = useRef<number | null>(null);
  const db = useRef<{ exec: (q: string) => Promise<{ fields: { name: string }[]; rows: Record<string, unknown>[] }[]> } | null>(null);
  const entradaArquivo = useRef<HTMLInputElement>(null);
  // A pessoa aceitou o download do interpretador nesta montagem.
  const confirmado = useRef(false);
  const suporte = typeof window !== "undefined" && typeof WebAssembly !== "undefined" && typeof Worker !== "undefined";
  const pesado = Boolean(PERFIS[perfil].pesado);
  const [ladoALado, setLadoALado] = useState(true);
  const [painel, setPainel] = useState<Painel>(exercicio ? "tarefa" : perfil === "web" ? "previa" : "console");
  const inicio = useRef(0);
  const atual = arquivos.find((a) => a.nome === ativo) ?? arquivos[0];

  // Projeto vindo de um link compartilhado (#projeto=...): só no modo livre e no mesmo perfil.
  useEffect(() => {
    if (exercicio) return;
    let vivo = true;
    void lerDoLink(window.location.hash).then((p) => {
      if (!vivo || !p || p.perfil !== perfil || !p.arquivos.length) return;
      setArquivos(p.arquivos);
      setAtivo(p.arquivos[0].nome);
      if (p.entrada !== undefined) setEntrada(p.entrada);
      setAviso(s.doLink);
    });
    return () => {
      vivo = false;
    };
  }, [exercicio, perfil, s.doLink]);
  // Rascunho: guardado neste navegador a cada mudança (com um respiro), restaurável por botão.
  useEffect(() => {
    const marca = window.setTimeout(() => {
      try {
        window.localStorage.setItem(chave, JSON.stringify({ arquivos, em: Date.now() }));
        setTemRascunho(true);
      } catch {
        // sem armazenamento
      }
    }, 800);
    return () => window.clearTimeout(marca);
  }, [arquivos, chave]);
  useEffect(() => () => { worker.current?.terminate(); compilado.current?.terminate(); if (relogio.current) window.clearTimeout(relogio.current); }, []);
  // A prévia web ouve o console do iframe.
  useEffect(() => {
    if (perfil !== "web") return;
    const ouvir = (e: MessageEvent) => {
      const d = e.data as { lucia?: number; type?: string; text?: string };
      if (d?.lucia === 1) setSaida((l) => (l.length > 1000 ? l : [...l, { texto: `${d.text ?? ""}\n`, erro: d.type === "err" }]));
    };
    window.addEventListener("message", ouvir);
    return () => window.removeEventListener("message", ouvir);
  }, [perfil]);

  const mudarAtual = (v: string) => setArquivos((lista) => lista.map((a) => (a.nome === atual?.nome ? { ...a, conteudo: v } : a)));
  const parar = useCallback((mensagem?: string) => {
    worker.current?.terminate();
    worker.current = null;
    if (relogio.current) window.clearTimeout(relogio.current);
    if (mensagem) setSaida((l) => [...l, { texto: `${mensagem}\n`, erro: true }]);
    setEstado("parado");
  }, []);

  function conferir(textoDaSaida: string, doc?: string, tabela?: unknown[][]) {
    if (!exercicio) return;
    let r: boolean[];
    if (perfil === "web") r = conferirHtml(exercicio.testes, doc ?? "");
    else if (perfil === "sql") r = conferirLinhas(exercicio.testes, tabela ?? []);
    else r = conferirSaida(exercicio.testes, textoDaSaida);
    setResultado(r);
    if (r.length > 0 && r.every(Boolean)) aoConcluir?.(exercicio.id);
  }

  async function executar() {
    setAviso("");
    setResultado(null);
    if (!suporte) return setAviso(s.semWasm);
    if (pesado && !confirmado.current && !worker.current && !db.current) return setConfirmarDownload(true);
    setConfirmarDownload(false);
    if (!exercicio) setPainel(perfil === "web" ? "previa" : "console");
    setSaida([]);
    setLinhas(null);
    if (perfil === "web") {
      const doc = montarDocumento(arquivos);
      setDocumento(doc);
      conferir("", doc);
      return;
    }
    if (perfil === "sql") {
      setEstado(db.current ? "rodando" : "carregando");
      try {
        if (!db.current) {
          const { PGlite } = await import("@electric-sql/pglite");
          const banco = new PGlite();
          await banco.exec(SQL_EXEMPLO).catch(() => undefined);
          db.current = banco as unknown as typeof db.current;
        }
        const resultados = await db.current!.exec(atual?.conteudo ?? "");
        const ultimo = resultados[resultados.length - 1];
        const tabela = ultimo ? ultimo.rows.map((r) => ultimo.fields.map((f) => r[f.name])) : [];
        setLinhas(ultimo ? { campos: ultimo.fields.map((f) => f.name), linhas: tabela } : null);
        setSaida([{ texto: `${resultados.length} comando(s) · ${tabela.length} linha(s)\n` }]);
        conferir("", undefined, tabela);
      } catch (e) {
        setSaida([{ texto: `${String((e as Error).message ?? e)}\n`, erro: true }]);
      } finally {
        setEstado("parado");
      }
      return;
    }
    // As outras linguagens: num worker, com teto de tempo.
    setEstado(worker.current ? "rodando" : "carregando");
    inicio.current = agora();
    let codigo = atual?.conteudo ?? "";
    const outrosArquivos = arquivos.filter((a) => a.nome !== atual?.nome);
    if (perfil === "python") {
      const outros = arquivos.filter((a) => a.nome !== atual?.nome);
      if (outros.length) codigo = `${outros.map((a) => `open(${JSON.stringify(a.nome)}, "w", encoding="utf-8").write(${JSON.stringify(a.conteudo)})`).join("\n")}\n${codigo}`;
    }
    if (perfil === "js") rodarJs(codigo, "");
    else rodarNoWorker(codigo, outrosArquivos);
  }

  /** JavaScript num worker descartável (cada execução começa do zero), com prompt() lendo do campo de entradas. */
  function rodarJs(codigo: string, jaImpresso: string) {
    worker.current?.terminate();
    const entradas = JSON.stringify(entrada.split("\n"));
    {
      const fonteDoWorker = `${ISOLAR_WORKER}const __e=${entradas};self.prompt=()=>__e.length?__e.shift():null;const __p=(t)=>(...m)=>postMessage({type:t,text:m.map((x)=>{try{return typeof x==="object"?JSON.stringify(x):String(x)}catch(e){return String(x)}}).join(" ")+"\\n"});self.console={log:__p("out"),info:__p("out"),warn:__p("err"),error:__p("err"),table:__p("out")};postMessage({type:"ready"});(async()=>{try{${codigo}\n}catch(e){postMessage({type:"err",text:String(e&&e.stack||e)+"\\n"})}postMessage({type:"done"})})();`;
      worker.current = new Worker(URL.createObjectURL(new Blob([fonteDoWorker], { type: "text/javascript" })));
    }
    ouvir(worker.current, jaImpresso, true);
  }

  const WORKERS: Partial<Record<Perfil, string>> = { python: "/workers/python.js", ts: "/workers/typescript.js", cpp: "/workers/cpp.js", ruby: "/workers/ruby.js", lua: "/workers/lua.js" };
  function rodarNoWorker(codigo: string, outrosArquivos: ArquivoDoProjeto[]) {
    if (perfil === "ts") {
      // O compilador fica guardado para a próxima vez e devolve o JavaScript; quem roda é o executor de JavaScript.
      const c = (compilado.current ??= new Worker(WORKERS.ts!));
      c.onmessage = (ev: MessageEvent<{ type: string; text?: string; js?: string; erros?: string[] }>) => {
        const { type, text = "", js = "", erros = [] } = ev.data;
        if (type === "ready") setEstado("rodando");
        else if (type === "compiled") {
          const tipos = erros.map((e) => `${s.erroDeTipo}: ${e}\n`).join("");
          if (tipos) setSaida((l) => [...l, { texto: tipos, erro: true }]);
          rodarJs(js, tipos);
        } else if (type === "err") setSaida((l) => [...l, { texto: text, erro: true }]);
        else if (type === "done") setEstado("parado");
      };
      c.onerror = () => { compilado.current?.terminate(); compilado.current = null; parar(s.falhou); };
      c.postMessage({ arquivos, principal: atual?.nome ?? "main.ts" });
      return;
    }
    worker.current ??= perfil === "php" ? new Worker("/workers/php.mjs", { type: "module" }) : new Worker(WORKERS[perfil]!);
    const w = worker.current;
    ouvir(w, "", false);
    w.postMessage({ code: codigo, input: entrada, arquivos: outrosArquivos });
  }

  function ouvir(w: Worker, jaImpresso: string, descartavel: boolean) {
    let texto = jaImpresso;
    w.onmessage = (ev: MessageEvent<{ type: string; text?: string }>) => {
      const { type, text = "" } = ev.data;
      if (type === "ready") {
        setEstado("rodando");
        relogio.current = window.setTimeout(() => parar(s.tempo), LIMITE_TEMPO);
      } else if (type === "done") {
        if (relogio.current) window.clearTimeout(relogio.current);
        setEstado("parado");
        if (descartavel) { w.terminate(); worker.current = null; }
        const ms = Math.round(agora() - inicio.current);
        setSaida((l) => [...l, { texto: `\n— ${s.tempoDeExecucao.replace("{ms}", String(ms))}\n` }]);
        conferir(texto);
      } else {
        texto += text;
        setSaida((l) => (l.length > 2000 ? l : [...l, { texto: text, erro: type === "err" }]));
      }
    };
    w.onerror = () => parar(s.falhou);
  }

  function novoArquivo() {
    const sugestao: Record<Perfil, string> = { web: "pagina.html", python: "modulo.py", php: "funcoes.php", sql: "outra.sql", js: "outro.js", ts: "util.ts", cpp: "outro.cpp", ruby: "util.rb", lua: "util.lua" };
    const nome = window.prompt(s.novo, sugestao[perfil])?.trim();
    if (!nome || !/^[\w.-]{1,60}$/.test(nome) || arquivos.some((a) => a.nome === nome) || arquivos.length >= 30) return;
    setArquivos([...arquivos, { nome, conteudo: "" }]);
    setAtivo(nome);
  }
  function renomear() {
    if (!atual) return;
    const nome = window.prompt(s.renomear, atual.nome)?.trim();
    if (!nome || !/^[\w.-]{1,60}$/.test(nome) || arquivos.some((a) => a.nome === nome)) return;
    setArquivos(arquivos.map((a) => (a.nome === atual.nome ? { ...a, nome } : a)));
    setAtivo(nome);
  }
  function apagar() {
    if (!atual || arquivos.length <= 1 || !window.confirm(s.apagarConfirma)) return;
    const resto = arquivos.filter((a) => a.nome !== atual.nome);
    setArquivos(resto);
    setAtivo(resto[0].nome);
  }
  function baixar() {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(montarZip(arquivos));
    a.download = `${exercicio?.id ?? perfil}-instituto-lucia.zip`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  async function abrir(lista: FileList | null) {
    if (!lista?.length) return;
    try {
      const novos: ArquivoDoProjeto[] = [];
      for (const f of Array.from(lista)) {
        if (f.size > 2 * 1024 * 1024) throw new Error("grande");
        if (f.name.toLowerCase().endsWith(".zip")) novos.push(...(await abrirZip(f)));
        else novos.push({ nome: f.name.replace(/[^\w.-]/g, "_").slice(0, 60), conteudo: await f.text() });
      }
      setArquivos(novos.slice(0, 30));
      setAtivo(novos[0].nome);
      setAviso("");
    } catch {
      setAviso("Não deu para abrir: só arquivos de texto ou .zip de projeto, até 2 MB cada.");
    }
  }
  async function compartilhar() {
    const base = new URL(window.location.href);
    base.searchParams.set("p", perfil);
    base.searchParams.delete("ex");
    const link = await linkDoProjeto(base.toString(), { perfil, arquivos, entrada });
    if (!link) return setAviso(s.grandeDemais);
    window.history.replaceState(null, "", link);
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // sem área de transferência: o link fica na barra de endereço
    }
    setAviso(s.copiado);
  }
  function restaurar() {
    try {
      const r = JSON.parse(window.localStorage.getItem(chave) ?? "null") as { arquivos?: ArquivoDoProjeto[] } | null;
      if (r?.arquivos?.length) { setArquivos(r.arquivos); setAtivo(r.arquivos[0].nome); }
    } catch {
      // nada
    }
  }

  const ocupado = estado !== "parado";
  const comPrevia = perfil === "web";
  const abas: [Painel, string][] = [
    ...(exercicio ? ([["tarefa", s.tarefa]] as [Painel, string][]) : []),
    ...(comPrevia ? ([["previa", s.previa]] as [Painel, string][]) : []),
    ["console", s.console],
    ...(linhas && linhas.campos.length > 0 ? ([["tabela", s.tabela]] as [Painel, string][]) : []),
  ];
  const painelAtivo: Painel = abas.some(([id]) => id === painel) ? painel : abas[0][0];
  const icone = "cursor-pointer rounded px-1.5 py-0.5 text-ink-soft hover:bg-parchment hover:text-ink disabled:cursor-not-allowed disabled:opacity-40";
  const fino = "cursor-pointer rounded border border-rule px-2.5 py-1 font-semibold text-ink hover:bg-parchment disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="ide-area mt-6 overflow-hidden border-2 border-ink bg-parchment-deep font-sans text-sm text-ink">
      {/* Barra de cima, como a do Replit: o projeto à esquerda, o Executar no meio, compartilhar e o resto à direita. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-rule bg-parchment px-3 py-2">
        <button type="button" className={`${icone} hidden lg:inline-block`} onClick={() => setArquivosAbertos((v) => !v)} aria-label={s.arquivos} aria-pressed={arquivosAbertos}>☰</button>
        <span className="min-w-0 truncate font-semibold">
          <span className={`mr-2 inline-block rounded px-1.5 py-0.5 font-mono text-[0.65rem] font-bold ${corDoPerfil(perfil)}`}>{PERFIS[perfil].nome}</span>
          {exercicio ? exercicio.titulo : s.projeto}
        </span>
        <div className="order-last flex w-full justify-center sm:order-none sm:mx-auto sm:w-auto">
          {ocupado && perfil !== "sql" ? (
            <button type="button" className="ide-executar ide-parar cursor-pointer rounded-md px-6 py-1.5 font-semibold" onClick={() => parar()}>■ {s.parar}</button>
          ) : (
            <button type="button" className="ide-executar cursor-pointer rounded-md px-6 py-1.5 font-semibold disabled:opacity-60" disabled={ocupado} onClick={() => void executar()}>▶ {s.executar}</button>
          )}
        </div>
        {!exercicio && <button type="button" className="ide-convidar cursor-pointer rounded-md px-3 py-1 font-semibold" onClick={() => void compartilhar()}>{s.compartilhar}</button>}
        <details className="relative">
          <summary className={`${icone} list-none`} aria-label={s.mais}>⋯</summary>
          <div className="absolute right-0 z-20 mt-1 w-64 space-y-1 rounded-md border border-rule bg-parchment p-2 shadow-xl">
            <button type="button" className="block w-full cursor-pointer rounded px-2 py-1.5 text-left hover:bg-parchment-deep" onClick={baixar}>{s.baixar}</button>
            <button type="button" className="block w-full cursor-pointer rounded px-2 py-1.5 text-left hover:bg-parchment-deep" onClick={() => entradaArquivo.current?.click()}>{s.abrir}</button>
            {temRascunho && <button type="button" className="block w-full cursor-pointer rounded px-2 py-1.5 text-left hover:bg-parchment-deep" onClick={restaurar}>{s.restaurar}</button>}
            <label className="flex cursor-pointer items-center gap-2 px-2 py-1.5"><input type="checkbox" checked={!realce} onChange={(e) => setRealce(!e.target.checked)} />{s.simples}</label>
            <label className="hidden cursor-pointer items-center gap-2 px-2 py-1.5 lg:flex"><input type="checkbox" checked={ladoALado} onChange={(e) => setLadoALado(e.target.checked)} />{s.ladoALado}</label>
            <p className="flex items-center gap-2 px-2 py-1.5">
              {s.fonte}
              <button type="button" aria-label={`${s.fonte} −`} className={fino} onClick={() => setFonte((f) => Math.max(11, f - 1))}>A−</button>
              <button type="button" aria-label={`${s.fonte} +`} className={fino} onClick={() => setFonte((f) => Math.min(22, f + 1))}>A+</button>
            </p>
          </div>
        </details>
        <input ref={entradaArquivo} type="file" multiple accept=".zip,.txt,.py,.php,.html,.htm,.css,.js,.mjs,.ts,.c,.cpp,.h,.hpp,.rb,.lua,.sql,.json,.md,.csv" className="sr-only" onChange={(e) => { void abrir(e.target.files); e.target.value = ""; }} />
      </div>

      {confirmarDownload && (
        <p className="border-b border-rule bg-parchment px-3 py-2">
          {s.primeira} <strong>{PERFIS[perfil].download}</strong>.{" "}
          <button type="button" className="ide-executar ml-2 cursor-pointer rounded-md px-3 py-1 font-semibold" onClick={() => { confirmado.current = true; setConfirmarDownload(false); void executar(); }}>{s.carregar}</button>
          <button type="button" className={`${icone} ml-1`} onClick={() => setConfirmarDownload(false)} aria-label="Fechar">✕</button>
        </p>
      )}

      <div className={`grid min-h-[34rem] ${arquivosAbertos ? "lg:grid-cols-[13rem_minmax(0,1fr)]" : ""}`}>
        {arquivosAbertos && (
          <aside className="border-b border-rule bg-parchment lg:border-r lg:border-b-0">
            <p className="flex items-center justify-between px-3 pt-2 pb-1 text-xs font-semibold text-ink-soft">
              {s.arquivos}
              <span className="flex gap-0.5">
                <button type="button" className={icone} onClick={novoArquivo} aria-label={s.novo} title={s.novo}>＋</button>
                <button type="button" className={icone} onClick={renomear} aria-label={s.renomear} title={s.renomear}>✎</button>
                <button type="button" className={icone} onClick={apagar} disabled={arquivos.length <= 1} aria-label={s.apagar} title={s.apagar}><Selo nome="lixeira" className="h-3.5 w-3.5" /></button>
              </span>
            </p>
            <ul className="px-1.5 pb-2">
              {arquivos.map((a) => (
                <li key={a.nome}>
                  <button type="button" onClick={() => setAtivo(a.nome)} className={`flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1 text-left font-mono text-xs ${a.nome === atual?.nome ? "bg-parchment-deep text-ink" : "text-ink-soft hover:bg-parchment-deep hover:text-ink"}`}>
                    <span className={`w-7 shrink-0 rounded-sm text-center text-[0.55rem] font-bold leading-4 ${corDaExtensao(a.nome)}`}>{extensao(a.nome)}</span>
                    <span className="truncate">{a.nome}</span>
                  </button>
                </li>
              ))}
            </ul>
            <details className="border-t border-rule px-3 py-2 text-xs">
              <summary className="cursor-pointer font-semibold text-ink-soft">{s.modelos}</summary>
              <ul className="mt-1 space-y-0.5">
                {[{ nome: s.exemplo, arquivos: PERFIS[perfil].exemplo, entrada: PERFIS[perfil].entrada }, ...(PERFIS[perfil].modelos ?? [])].map((m) => (
                  <li key={m.nome}>
                    <button type="button" className="cursor-pointer text-left hover:underline" onClick={() => { setArquivos(m.arquivos.map((a) => ({ ...a }))); setAtivo(m.arquivos[0].nome); setEntrada(m.entrada ?? ""); }}>{m.nome}</button>
                  </li>
                ))}
              </ul>
            </details>
          </aside>
        )}

        <div className={`grid min-w-0 ${ladoALado ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : ""}`}>
          {/* O editor, com as abas dos arquivos em cima. */}
          <section className="flex min-w-0 flex-col border-b border-rule lg:border-b-0">
            <div className="flex overflow-x-auto border-b border-rule bg-parchment" role="tablist" aria-label={s.arquivos}>
              {arquivos.map((a) => (
                <button key={a.nome} type="button" role="tab" aria-selected={a.nome === atual?.nome} onClick={() => setAtivo(a.nome)} className={`shrink-0 cursor-pointer border-r border-rule px-3 py-1.5 font-mono text-xs ${a.nome === atual?.nome ? "bg-parchment-deep text-ink shadow-[inset_0_2px_0_var(--ide-acento)]" : "text-ink-soft hover:text-ink"}`}>
                  {a.nome}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1">
              {atual && <EditorDeCodigo valor={atual.conteudo} mudar={mudarAtual} nome={atual.nome} aoExecutar={() => { if (!ocupado) void executar(); }} aoGuardar={() => setAviso(s.guardado)} realce={realce} tamanho={fonte} altura="30rem" />}
            </div>
            {PERFIS[perfil].le && (
              <label className="block border-t border-rule px-3 py-2 text-xs text-ink-soft">
                {s.entradas}
                <textarea value={entrada} onChange={(e) => setEntrada(e.target.value)} rows={2} className="mt-1 w-full rounded border border-rule bg-parchment px-2 py-1 font-mono text-xs text-ink" />
              </label>
            )}
          </section>

          {/* O painel da direita: exercício, prévia, console e tabela, em abas. */}
          <section className={`flex min-w-0 flex-col ${ladoALado ? "lg:border-l lg:border-rule" : "border-t border-rule"}`}>
            <div className="flex items-center border-b border-rule bg-parchment" role="tablist" aria-label={s.console}>
              {abas.map(([id, nome]) => (
                <button key={id} type="button" role="tab" aria-selected={painelAtivo === id} onClick={() => setPainel(id)} className={`cursor-pointer border-r border-rule px-3 py-1.5 text-xs font-semibold ${painelAtivo === id ? "bg-parchment-deep text-ink shadow-[inset_0_2px_0_var(--ide-acento)]" : "text-ink-soft hover:text-ink"}`}>
                  {nome}
                </button>
              ))}
              {painelAtivo === "console" && <button type="button" className={`${icone} ml-auto mr-2 text-xs`} onClick={() => { setSaida([]); setLinhas(null); setResultado(null); }}>{s.limpar}</button>}
            </div>
            <div className="min-h-[16rem] flex-1 overflow-auto">
              {painelAtivo === "tarefa" && exercicio && (
                <div className="p-4" lang="pt-BR">
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-gold">Exercício · nível {exercicio.nivel}</p>
                  <h2 className="mt-1 font-serif text-xl font-semibold">{exercicio.titulo}</h2>
                  <p className="mt-2 whitespace-pre-wrap">{exercicio.enunciado}</p>
                  <p className="mt-3 flex flex-wrap gap-3 text-xs">
                    {dicasVistas < exercicio.dicas.length && <button type="button" className="cursor-pointer underline" onClick={() => setDicasVistas((n) => n + 1)}>{s.dica} ({dicasVistas + 1}/{exercicio.dicas.length})</button>}
                    {exercicio.solucao && resultado && !resultado.every(Boolean) && <button type="button" className="cursor-pointer underline" onClick={() => setVerSolucao((v) => !v)}>{s.solucao}</button>}
                  </p>
                  {exercicio.dicas.slice(0, dicasVistas).map((d, i) => <p key={i} className="mt-1 text-ink-soft">{d}</p>)}
                  {verSolucao && exercicio.solucao?.map((a) => <pre key={a.nome} className="mt-2 overflow-x-auto rounded border border-rule bg-parchment p-3 font-mono text-xs"><strong>{a.nome}</strong>{"\n"}{a.conteudo}</pre>)}
                  <div className="mt-4 border-t border-rule pt-3">
                    <p className="flex flex-wrap items-center gap-3">
                      <button type="button" className="ide-executar cursor-pointer rounded-md px-3 py-1 font-semibold disabled:opacity-60" disabled={ocupado} onClick={() => void executar()}>{s.testes}</button>
                      {resultado && <strong className={resultado.every(Boolean) ? "text-ok" : "text-oxblood"}>{resultado.every(Boolean) ? s.parabens : s.quase}</strong>}
                    </p>
                    {resultado && (
                      <ol className="mt-2 space-y-1 font-mono text-xs">
                        {exercicio.testes.map((t, i) => (
                          <li key={i} className={resultado[i] ? "text-ok" : "text-oxblood"}>
                            {resultado[i] ? "✓" : "✗"} {t.tipo === "saida" ? `saída esperada: ${t.esperado.split("\n")[0]}${t.esperado.includes("\n") ? "…" : ""}` : t.tipo === "contem" ? `a saída contém “${t.texto}”` : t.tipo === "regex" ? `a saída casa com /${t.padrao}/` : t.tipo === "html" ? `a página tem ${t.seletor}${t.texto ? ` com “${t.texto}”` : ""}` : `a consulta devolve ${t.esperado.length} linha(s) esperada(s)`} · {resultado[i] ? s.passou : s.falhou2}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>
              )}
              {painelAtivo === "previa" && <iframe title={s.previa} sandbox="allow-scripts" srcDoc={documento || montarDocumento(arquivos)} className="h-full min-h-[28rem] w-full border-0 bg-white" />}
              {painelAtivo === "console" && (
                <pre aria-live="polite" className="m-0 min-h-full whitespace-pre-wrap p-3 font-mono text-xs">
                  {saida.length === 0 ? <span className="text-ink-soft">{s.consoleVazio}</span> : saida.map((l, i) => <span key={i} className={l.erro ? "text-oxblood" : ""}>{l.texto}</span>)}
                </pre>
              )}
              {painelAtivo === "tabela" && linhas && (
                <table className="w-full border-collapse font-mono text-xs">
                  <thead><tr className="bg-parchment">{linhas.campos.map((c) => <th key={c} className="border-b border-rule px-2 py-1 text-left">{c}</th>)}</tr></thead>
                  <tbody>{linhas.linhas.slice(0, 500).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="border-b border-rule px-2 py-1">{String(c ?? "")}</td>)}</tr>)}</tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Barra de baixo: o estado, os atalhos e o que não roda aqui. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule bg-parchment px-3 py-1.5 text-xs text-ink-soft">
        <span role="status" className="min-w-0 flex-1">{estado === "carregando" ? s.carregando : aviso || s.teclas}</span>
        <details className="relative">
          <summary className="cursor-pointer">{s.naoRoda}</summary>
          <ul className="absolute right-0 bottom-full z-20 mb-1 w-72 list-disc rounded-md border border-rule bg-parchment p-3 pl-6 shadow-xl">{PERFIS[perfil].naoRoda.map((x) => <li key={x}>{x}</li>)}</ul>
        </details>
        <span className="w-full sm:w-auto">{s.privacidade}</span>
      </div>
    </div>
  );
}

type Painel = "tarefa" | "previa" | "console" | "tabela";

const extensao = (nome: string) => (nome.includes(".") ? nome.split(".").pop()!.slice(0, 4).toUpperCase() : "TXT");
const CORES_DA_EXTENSAO: Record<string, string> = {
  PY: "bg-[#3572a5] text-white",
  JS: "bg-[#f1e05a] text-[#1c2333]",
  MJS: "bg-[#f1e05a] text-[#1c2333]",
  TS: "bg-[#3178c6] text-white",
  HTML: "bg-[#e34c26] text-white",
  HTM: "bg-[#e34c26] text-white",
  CSS: "bg-[#563d7c] text-white",
  PHP: "bg-[#777bb4] text-white",
  SQL: "bg-[#e38c00] text-white",
  C: "bg-[#555555] text-white",
  CPP: "bg-[#f34b7d] text-white",
  H: "bg-[#555555] text-white",
  HPP: "bg-[#f34b7d] text-white",
  RB: "bg-[#cc342d] text-white",
  LUA: "bg-[#000080] text-white",
};
const corDaExtensao = (nome: string) => CORES_DA_EXTENSAO[extensao(nome)] ?? "bg-[#5f6b7a] text-white";
const corDoPerfil = (perfil: Perfil) => ({ python: CORES_DA_EXTENSAO.PY, js: CORES_DA_EXTENSAO.JS, ts: CORES_DA_EXTENSAO.TS, web: CORES_DA_EXTENSAO.HTML, php: CORES_DA_EXTENSAO.PHP, sql: CORES_DA_EXTENSAO.SQL, cpp: CORES_DA_EXTENSAO.CPP, ruby: CORES_DA_EXTENSAO.RB, lua: CORES_DA_EXTENSAO.LUA })[perfil];

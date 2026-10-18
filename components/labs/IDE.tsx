// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { chaveDoRascunho, conferirHtml, conferirLinhas, conferirSaida, type Exercicio, type Perfil, PERFIS, SQL_EXEMPLO } from "@/lib/laboratorios";
import { abrirZip, type ArquivoDoProjeto, montarZip } from "@/lib/zip";
import { useI18n } from "../I18n";
import { EditorDeCodigo } from "./EditorDeCodigo";

const TEXTOS: Record<string, Record<string, string>> = {
  pt: { arquivos: "Arquivos", novo: "Novo arquivo", apagar: "Apagar", renomear: "Renomear", executar: "Executar", parar: "Parar", limpar: "Limpar", saida: "Saída", previa: "Prévia", baixar: "Baixar (.zip)", abrir: "Abrir arquivo ou .zip", exemplo: "Exemplo", restaurar: "Restaurar rascunho", guardado: "Rascunho guardado neste navegador", carregando: "Carregando o interpretador…", primeira: "Na primeira vez o navegador baixa o interpretador:", carregar: "Carregar e executar", semWasm: "Este navegador não tem WebAssembly ou Web Workers: use o Chrome, o Firefox ou o Edge atualizados.", tempo: "O programa passou de 20 segundos e foi interrompido. Confira se não há um laço sem fim.", falhou: "O interpretador não carregou. Recarregue a página e tente de novo.", entradas: "Entradas (uma por linha, para input)", testes: "Conferir o exercício", passou: "passou", falhou2: "falhou", dica: "Dica", solucao: "Ver a solução", naoRoda: "O que não roda aqui", privacidade: "O que você escreve não sai deste aparelho: o código roda no navegador e o rascunho fica só aqui. Baixe o projeto para guardar.", simples: "Editor simples", realce: "Realce", fonte: "Letra", parabens: "Tudo certo! Exercício concluído.", quase: "Ainda não: veja o que falhou e a dica.", teclas: "Ctrl+Enter executa · Ctrl+S guarda · Tab recua", apagarConfirma: "Apagar este arquivo?" },
  en: { arquivos: "Files", novo: "New file", apagar: "Delete", renomear: "Rename", executar: "Run", parar: "Stop", limpar: "Clear", saida: "Output", previa: "Preview", baixar: "Download (.zip)", abrir: "Open file or .zip", exemplo: "Example", restaurar: "Restore draft", guardado: "Draft saved in this browser", carregando: "Loading the interpreter…", primeira: "The first time, the browser downloads the interpreter:", carregar: "Load and run", semWasm: "This browser lacks WebAssembly or Web Workers: use an up-to-date Chrome, Firefox or Edge.", tempo: "The program ran over 20 seconds and was stopped. Check for an endless loop.", falhou: "The interpreter did not load. Reload the page and try again.", entradas: "Inputs (one per line, for input)", testes: "Check the exercise", passou: "passed", falhou2: "failed", dica: "Hint", solucao: "Show solution", naoRoda: "What does not run here", privacidade: "What you write never leaves this device: code runs in the browser and the draft stays here. Download the project to keep it.", simples: "Simple editor", realce: "Highlight", fonte: "Font", parabens: "All good! Exercise complete.", quase: "Not yet: see what failed and the hint.", teclas: "Ctrl+Enter runs · Ctrl+S saves · Tab indents", apagarConfirma: "Delete this file?" },
};
TEXTOS.es = { ...TEXTOS.pt, arquivos: "Archivos", novo: "Nuevo archivo", apagar: "Borrar", executar: "Ejecutar", parar: "Detener", limpar: "Limpiar", saida: "Salida", previa: "Vista previa", baixar: "Descargar (.zip)", abrir: "Abrir archivo o .zip", exemplo: "Ejemplo", restaurar: "Restaurar borrador", guardado: "Borrador guardado en este navegador", carregando: "Cargando el intérprete…", primeira: "La primera vez el navegador descarga el intérprete:", carregar: "Cargar y ejecutar", testes: "Comprobar el ejercicio", passou: "pasó", falhou2: "falló", dica: "Pista", solucao: "Ver la solución", naoRoda: "Lo que no corre aquí", parabens: "¡Todo bien! Ejercicio completo.", quase: "Todavía no: mira lo que falló y la pista.", apagarConfirma: "¿Borrar este archivo?" };
TEXTOS.ru = { ...TEXTOS.en, arquivos: "Файлы", novo: "Новый файл", apagar: "Удалить", executar: "Запустить", parar: "Стоп", limpar: "Очистить", saida: "Вывод", previa: "Предпросмотр", baixar: "Скачать (.zip)", abrir: "Открыть файл или .zip", exemplo: "Пример", testes: "Проверить задание", passou: "пройден", falhou2: "не пройден", dica: "Подсказка", solucao: "Показать решение", parabens: "Всё верно! Задание выполнено.", quase: "Пока нет: смотрите, что не прошло, и подсказку." };
TEXTOS.zh = { ...TEXTOS.en, arquivos: "文件", novo: "新建文件", apagar: "删除", executar: "运行", parar: "停止", limpar: "清空", saida: "输出", previa: "预览", baixar: "下载（.zip）", abrir: "打开文件或 .zip", exemplo: "示例", testes: "检查练习", passou: "通过", falhou2: "未通过", dica: "提示", solucao: "查看答案", parabens: "全部正确！练习完成。", quase: "还没有：看看哪里没通过以及提示。" };

type Linha = { texto: string; erro?: boolean };
const LIMITE_TEMPO = 20_000;

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
  const [entrada, setEntrada] = useState(exercicio?.entrada ?? "");
  const [saida, setSaida] = useState<Linha[]>([]);
  const [linhas, setLinhas] = useState<{ campos: string[]; linhas: unknown[][] } | null>(null);
  const [estado, setEstado] = useState<"parado" | "carregando" | "rodando">("parado");
  const [documento, setDocumento] = useState("");
  const [resultado, setResultado] = useState<boolean[] | null>(null);
  const [dicasVistas, setDicasVistas] = useState(0);
  const [verSolucao, setVerSolucao] = useState(false);
  const [aviso, setAviso] = useState("");
  const [temRascunho, setTemRascunho] = useState(() => { try { return typeof window !== "undefined" && Boolean(window.localStorage.getItem(chaveDoRascunho(perfil, exercicio?.id))); } catch { return false; } });
  const [confirmarDownload, setConfirmarDownload] = useState(false);
  const [realce, setRealce] = useState(true);
  const [fonte, setFonte] = useState(14);
  const [arquivosAbertos, setArquivosAbertos] = useState(true);
  const worker = useRef<Worker | null>(null);
  const relogio = useRef<number | null>(null);
  const db = useRef<{ exec: (q: string) => Promise<{ fields: { name: string }[]; rows: Record<string, unknown>[] }[]> } | null>(null);
  const entradaArquivo = useRef<HTMLInputElement>(null);
  // A pessoa aceitou o download do interpretador nesta montagem.
  const confirmado = useRef(false);
  const suporte = typeof window !== "undefined" && typeof WebAssembly !== "undefined" && typeof Worker !== "undefined";
  const pesado = perfil === "python" || perfil === "php" || perfil === "sql";
  const atual = arquivos.find((a) => a.nome === ativo) ?? arquivos[0];

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
  useEffect(() => () => { worker.current?.terminate(); if (relogio.current) window.clearTimeout(relogio.current); }, []);
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
    // Python, PHP e JavaScript: num worker, com teto de tempo.
    setEstado(worker.current ? "rodando" : "carregando");
    let codigo = atual?.conteudo ?? "";
    if (perfil === "python") {
      const outros = arquivos.filter((a) => a.nome !== atual?.nome);
      if (outros.length) codigo = `${outros.map((a) => `open(${JSON.stringify(a.nome)}, "w", encoding="utf-8").write(${JSON.stringify(a.conteudo)})`).join("\n")}\n${codigo}`;
    }
    if (perfil === "js") {
      worker.current?.terminate();
      const fonteDoWorker = `const __p=(t)=>(...m)=>postMessage({type:t,text:m.map((x)=>{try{return typeof x==="object"?JSON.stringify(x):String(x)}catch(e){return String(x)}}).join(" ")+"\\n"});self.console={log:__p("out"),info:__p("out"),warn:__p("err"),error:__p("err"),table:__p("out")};postMessage({type:"ready"});(async()=>{try{${codigo}\n}catch(e){postMessage({type:"err",text:String(e&&e.stack||e)+"\\n"})}postMessage({type:"done"})})();`;
      worker.current = new Worker(URL.createObjectURL(new Blob([fonteDoWorker], { type: "text/javascript" })));
    } else {
      worker.current ??= perfil === "python" ? new Worker("/workers/python.js") : new Worker("/workers/php.mjs", { type: "module" });
    }
    const w = worker.current;
    let texto = "";
    w.onmessage = (ev: MessageEvent<{ type: string; text?: string }>) => {
      const { type, text = "" } = ev.data;
      if (type === "ready") {
        setEstado("rodando");
        relogio.current = window.setTimeout(() => parar(s.tempo), LIMITE_TEMPO);
      } else if (type === "done") {
        if (relogio.current) window.clearTimeout(relogio.current);
        setEstado("parado");
        if (perfil === "js") { w.terminate(); worker.current = null; }
        conferir(texto);
      } else {
        texto += text;
        setSaida((l) => (l.length > 2000 ? l : [...l, { texto: text, erro: type === "err" }]));
      }
    };
    w.onerror = () => parar(s.falhou);
    if (perfil !== "js") w.postMessage({ code: codigo, input: entrada });
  }

  function novoArquivo() {
    const nome = window.prompt(s.novo, perfil === "web" ? "pagina.html" : perfil === "python" ? "modulo.py" : perfil === "php" ? "funcoes.php" : perfil === "sql" ? "outra.sql" : "outro.js")?.trim();
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
  function restaurar() {
    try {
      const r = JSON.parse(window.localStorage.getItem(chave) ?? "null") as { arquivos?: ArquivoDoProjeto[] } | null;
      if (r?.arquivos?.length) { setArquivos(r.arquivos); setAtivo(r.arquivos[0].nome); }
    } catch {
      // nada
    }
  }

  const botao = "cursor-pointer bg-ink px-4 py-2 font-sans text-sm font-semibold text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";
  const claro = "cursor-pointer border-2 border-ink px-3 py-1.5 font-sans text-sm font-semibold hover:border-oxblood hover:text-oxblood disabled:cursor-not-allowed disabled:opacity-50";
  const elo = "cursor-pointer font-sans text-xs underline hover:text-oxblood";
  const ocupado = estado !== "parado";

  return (
    <div className="mt-6 font-sans text-sm">
      {exercicio && (
        <section className="mb-4 border-l-4 border-oxblood bg-parchment-deep p-4" lang="pt-BR">
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-gold">Exercício · nível {exercicio.nivel}</p>
          <h2 className="mt-1 font-serif text-xl font-semibold">{exercicio.titulo}</h2>
          <p className="mt-2 whitespace-pre-wrap">{exercicio.enunciado}</p>
          <p className="mt-3 flex flex-wrap gap-3">
            {dicasVistas < exercicio.dicas.length && <button type="button" className={elo} onClick={() => setDicasVistas((n) => n + 1)}>{s.dica} ({dicasVistas + 1}/{exercicio.dicas.length})</button>}
            {exercicio.solucao && resultado && !resultado.every(Boolean) && <button type="button" className={elo} onClick={() => setVerSolucao((v) => !v)}>{s.solucao}</button>}
          </p>
          {exercicio.dicas.slice(0, dicasVistas).map((d, i) => <p key={i} className="mt-1 text-ink-soft">💡 {d}</p>)}
          {verSolucao && exercicio.solucao?.map((a) => <pre key={a.nome} className="mt-2 overflow-x-auto border border-rule bg-parchment p-3 font-mono text-xs"><strong>{a.nome}</strong>{"\n"}{a.conteudo}</pre>)}
        </section>
      )}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button type="button" className={botao} disabled={ocupado} onClick={() => void executar()}>▶ {s.executar}</button>
        {ocupado && perfil !== "sql" && <button type="button" className="cursor-pointer border-2 border-oxblood px-3 py-1.5 font-semibold text-oxblood" onClick={() => parar()}>{s.parar}</button>}
        <button type="button" className={claro} onClick={() => { setSaida([]); setLinhas(null); setResultado(null); }}>{s.limpar}</button>
        <span className="mx-1 hidden h-5 w-px bg-rule sm:block" />
        <button type="button" className={claro} onClick={baixar}>{s.baixar}</button>
        <button type="button" className={claro} onClick={() => entradaArquivo.current?.click()}>{s.abrir}</button>
        <input ref={entradaArquivo} type="file" multiple accept=".zip,.txt,.py,.php,.html,.htm,.css,.js,.mjs,.sql,.json,.md" className="sr-only" onChange={(e) => { void abrir(e.target.files); e.target.value = ""; }} />
        <button type="button" className={claro} onClick={() => { setArquivos(PERFIS[perfil].exemplo.map((a) => ({ ...a }))); setAtivo(PERFIS[perfil].exemplo[0].nome); }}>{s.exemplo}</button>
        {temRascunho && <button type="button" className={elo} onClick={restaurar}>{s.restaurar}</button>}
        <span className="ml-auto flex items-center gap-2 text-xs text-ink-soft">
          <label className="flex cursor-pointer items-center gap-1"><input type="checkbox" checked={!realce} onChange={(e) => setRealce(!e.target.checked)} />{s.simples}</label>
          <button type="button" aria-label={`${s.fonte} −`} className={claro} onClick={() => setFonte((f) => Math.max(11, f - 1))}>A−</button>
          <button type="button" aria-label={`${s.fonte} +`} className={claro} onClick={() => setFonte((f) => Math.min(22, f + 1))}>A+</button>
        </span>
      </div>
      <p role="status" className="min-h-5 text-xs text-ink-soft">
        {estado === "carregando" ? s.carregando : aviso || s.teclas}
      </p>
      {confirmarDownload && (
        <p className="my-2 border-2 border-gold bg-parchment-deep p-3">
          {s.primeira} <strong>{PERFIS[perfil].download}</strong>.{" "}
          <button type="button" className={`${botao} ml-2`} onClick={() => { confirmado.current = true; setConfirmarDownload(false); void executar(); }}>{s.carregar}</button>
          <button type="button" className={`${claro} ml-2`} onClick={() => setConfirmarDownload(false)}>✕</button>
        </p>
      )}
      <div className={`grid gap-3 ${arquivosAbertos ? "lg:grid-cols-[11rem_minmax(0,1fr)]" : ""}`}>
        {arquivosAbertos && (
          <aside className="border-2 border-ink bg-parchment-deep p-2">
            <p className="flex items-center justify-between font-mono text-[0.65rem] uppercase tracking-widest text-gold">
              {s.arquivos}
              <button type="button" className={elo} onClick={() => setArquivosAbertos(false)} aria-label="Recolher">«</button>
            </p>
            <ul className="mt-2 space-y-0.5">
              {arquivos.map((a) => (
                <li key={a.nome}>
                  <button type="button" onClick={() => setAtivo(a.nome)} className={`w-full cursor-pointer truncate px-2 py-1 text-left font-mono text-xs ${a.nome === atual?.nome ? "bg-ink text-parchment" : "hover:bg-parchment"}`}>{a.nome}</button>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex flex-wrap gap-x-2 gap-y-1">
              <button type="button" className={elo} onClick={novoArquivo}>{s.novo}</button>
              <button type="button" className={elo} onClick={renomear}>{s.renomear}</button>
              <button type="button" className={elo} onClick={apagar} disabled={arquivos.length <= 1}>{s.apagar}</button>
            </p>
          </aside>
        )}
        <div className="min-w-0">
          {!arquivosAbertos && <button type="button" className={`${elo} mb-1`} onClick={() => setArquivosAbertos(true)}>» {s.arquivos}</button>}
          {atual && <EditorDeCodigo valor={atual.conteudo} mudar={mudarAtual} nome={atual.nome} aoExecutar={() => { if (!ocupado) void executar(); }} aoGuardar={() => setAviso(s.guardado)} realce={realce} tamanho={fonte} altura={perfil === "web" ? "20rem" : "24rem"} />}
          {perfil === "python" && (
            <label className="mt-2 block text-xs">
              {s.entradas}
              <textarea value={entrada} onChange={(e) => setEntrada(e.target.value)} rows={2} className="mt-1 w-full border-2 border-rule bg-parchment-deep px-3 py-1.5 font-mono text-xs" />
            </label>
          )}
        </div>
      </div>
      {perfil === "web" && (
        <div className="mt-3">
          <p className="font-mono text-xs uppercase tracking-widest text-gold">{s.previa}</p>
          <iframe title={s.previa} sandbox="allow-scripts" srcDoc={documento || montarDocumento(arquivos)} className="mt-1 h-80 w-full border-2 border-ink bg-white" />
        </div>
      )}
      <div className="mt-3">
        <p className="font-mono text-xs uppercase tracking-widest text-gold">{s.saida}</p>
        <pre aria-live="polite" className="mt-1 max-h-72 min-h-16 overflow-auto whitespace-pre-wrap border border-rule bg-parchment-deep p-3 font-mono text-xs">
          {saida.map((l, i) => <span key={i} className={l.erro ? "text-oxblood" : ""}>{l.texto}</span>)}
        </pre>
        {linhas && linhas.campos.length > 0 && (
          <div className="mt-2 max-h-72 overflow-auto border border-rule">
            <table className="w-full border-collapse font-mono text-xs">
              <thead><tr className="bg-parchment-deep">{linhas.campos.map((c) => <th key={c} className="border-b border-rule px-2 py-1 text-left">{c}</th>)}</tr></thead>
              <tbody>{linhas.linhas.slice(0, 500).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="border-b border-rule px-2 py-1">{String(c ?? "")}</td>)}</tr>)}</tbody>
            </table>
          </div>
        )}
      </div>
      {exercicio && (
        <div className="mt-3 border-2 border-ink p-3">
          <p className="flex flex-wrap items-center gap-3">
            <button type="button" className={botao} disabled={ocupado} onClick={() => void executar()}>{s.testes}</button>
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
      )}
      <details className="mt-3 text-xs text-ink-soft">
        <summary className="cursor-pointer">{s.naoRoda}</summary>
        <ul className="mt-1 list-disc pl-5">{PERFIS[perfil].naoRoda.map((x) => <li key={x}>{x}</li>)}</ul>
      </details>
      <p className="mt-2 text-xs text-ink-soft">{s.privacidade}</p>
    </div>
  );

}

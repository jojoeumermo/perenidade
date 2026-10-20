// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useRef, useState } from "react";
import { type Interativo, lerCacaPalavras, lerForca, lerLinhaDoTempo, lerPares, lerPronuncia, lerTeste } from "@/lib/interativos";
import { CATEGORIAS_DE_BLOCOS, type CategoriaDeBlocos, lerArrastar, lerCena, lerMolecula, lerProgramacao, lerRodar } from "@/lib/interativos-mais";

// Formulários dos blocos interativos: quem faz a aula preenche campos com nome claro ("Pergunta", "Resposta certa",
// "Palavra", "Dica"…) e o editor escreve o bloco sozinho. O texto do bloco continua existindo (modo avançado), mas
// ninguém precisa decorar sinal nenhum. O formulário guarda o próprio estado: linha em branco não some enquanto se digita.

const campo = "w-full border-2 border-ink/30 bg-parchment px-2 py-1.5 text-sm focus:border-ink focus:outline-none";
const mais = "cursor-pointer border-2 border-dashed border-ink px-3 py-1.5 text-sm font-bold hover:border-oxblood hover:text-oxblood";
const tirar = "cursor-pointer px-2 text-lg leading-none text-ink-soft hover:text-oxblood";
const rotulo = "block text-xs font-semibold";
const cartao = "border-2 border-ink/20 bg-parchment-deep p-3";

const LINGUAS: [string, string][] = [["", "Sem voz"], ["en-US", "Inglês"], ["es-ES", "Espanhol"], ["fr-FR", "Francês"], ["de-DE", "Alemão"], ["it-IT", "Italiano"], ["ru-RU", "Russo"], ["zh-CN", "Chinês"], ["pt-BR", "Português"]];

function Lingua({ valor, mudar }: { valor: string; mudar: (v: string) => void }) {
  return (
    <label className={rotulo}>
      🔊 Ler em voz alta em
      <select value={valor} onChange={(e) => mudar(e.target.value)} className={`${campo} mt-1 max-w-56`}>
        {LINGUAS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
      </select>
    </label>
  );
}

/** Lista de linhas com "+ adicionar" e "✕": a base de quase todos os formulários. */
function Linhas<T>({ itens, mudar, novo, rotuloNovo, linha }: { itens: T[]; mudar: (l: T[]) => void; novo: () => T; rotuloNovo: string; linha: (item: T, trocar: (t: T) => void, i: number) => React.ReactNode }) {
  return (
    <div className="space-y-2">
      {itens.map((item, i) => (
        <div key={i} className="flex items-start gap-1">
          <div className="min-w-0 flex-1">{linha(item, (t) => mudar(itens.map((x, j) => (j === i ? t : x))), i)}</div>
          <button type="button" aria-label="Tirar" title="Tirar" onClick={() => mudar(itens.filter((_, j) => j !== i))} className={tirar}>✕</button>
        </div>
      ))}
      <button type="button" className={mais} onClick={() => mudar([...itens, novo()])}>+ {rotuloNovo}</button>
    </div>
  );
}

// ───────────── Teste ─────────────

type TipoDePergunta = "escolha" | "vf" | "numero" | "lacunas" | "ordenar";
interface Pergunta {
  tipo: TipoDePergunta;
  enunciado: string;
  certa: string;
  erradas: { texto: string; porque: string }[];
  verdade: boolean;
  numero: string;
  margem: string;
  lacunas: string[];
  itens: string[];
  explicacao: string;
}
const perguntaVazia = (tipo: TipoDePergunta = "escolha"): Pergunta => ({ tipo, enunciado: "", certa: "", erradas: [{ texto: "", porque: "" }, { texto: "", porque: "" }], verdade: true, numero: "", margem: "", lacunas: [""], itens: ["", "", ""], explicacao: "" });

function testeDe(spec: string): Pergunta[] {
  const lidas = lerTeste(spec).map((q): Pergunta => {
    const base = { ...perguntaVazia(q.tipo), enunciado: q.enunciado, explicacao: q.explicacao };
    if (q.tipo === "escolha") return { ...base, certa: q.opcoes.find((o) => o.certa)?.texto ?? "", erradas: q.opcoes.filter((o) => !o.certa).map((o) => ({ texto: o.texto, porque: o.retorno })) };
    if (q.tipo === "vf") return { ...base, verdade: q.resposta };
    if (q.tipo === "numero") return { ...base, numero: String(q.resposta).replace(".", ","), margem: q.tolerancia ? String(q.tolerancia).replace(".", ",") : "" };
    if (q.tipo === "lacunas") return { ...base, lacunas: q.respostas.map((r) => r.join(" | ")) };
    return { ...base, itens: q.itens };
  });
  return lidas.length ? lidas : [perguntaVazia()];
}
function testeParaTexto(ps: Pergunta[]) {
  return ps
    .filter((p) => p.enunciado.trim())
    .map((p) => {
      const l = [`? ${p.enunciado.trim()}`];
      if (p.tipo === "escolha") {
        if (p.certa.trim()) l.push(`+ ${p.certa.trim()}`);
        for (const e of p.erradas) if (e.texto.trim()) l.push(`- ${e.texto.trim()}${e.porque.trim() ? ` >> ${e.porque.trim()}` : ""}`);
      } else if (p.tipo === "vf") l.push(`= ${p.verdade ? "verdadeiro" : "falso"}`);
      else if (p.tipo === "numero") l.push(`= ${p.numero.trim()}${p.margem.trim() ? ` ± ${p.margem.trim()}` : ""}`);
      else if (p.tipo === "lacunas") for (const r of p.lacunas) l.push(`= ${r.trim()}`);
      else for (const it of p.itens) if (it.trim()) l.push(`* ${it.trim()}`);
      if (p.explicacao.trim()) l.push(`> ${p.explicacao.trim()}`);
      return l.join("\n");
    })
    .join("\n\n");
}

const TIPOS: [TipoDePergunta, string][] = [["escolha", "🔘 Escolha"], ["vf", "✅ Verdadeiro ou falso"], ["numero", "🔢 Número"], ["lacunas", "✍️ Completar"], ["ordenar", "↕️ Pôr em ordem"]];

function FormTeste({ spec, mudar }: { spec: string; mudar: (s: string) => void }) {
  const [ps, setPs] = useState(() => testeDe(spec));
  const salvar = (n: Pergunta[]) => { setPs(n); mudar(testeParaTexto(n)); };
  return (
    <Linhas itens={ps} mudar={salvar} novo={() => perguntaVazia()} rotuloNovo="outra pergunta" linha={(p, trocar, i) => (
      <div className={cartao}>
        <p className="text-xs font-bold uppercase tracking-wider text-oxblood">Pergunta {i + 1}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {TIPOS.map(([t, n]) => (
            <button key={t} type="button" aria-pressed={p.tipo === t} onClick={() => trocar({ ...p, tipo: t })} className={`cursor-pointer border-2 px-2 py-1 text-xs font-semibold ${p.tipo === t ? "border-ink bg-ink text-parchment" : "border-ink/20 hover:border-ink"}`}>{n}</button>
          ))}
        </div>
        <label className={`${rotulo} mt-2`}>
          {p.tipo === "lacunas" ? "Frase (marque cada espaço em branco com ___)" : p.tipo === "vf" ? "Afirmação" : "Pergunta"}
          <input value={p.enunciado} onChange={(e) => trocar({ ...p, enunciado: e.target.value })} placeholder={p.tipo === "lacunas" ? "A capital do Brasil é ___." : p.tipo === "vf" ? "O Sol é uma estrela." : "Qual destes é um planeta?"} className={`${campo} mt-1`} />
        </label>
        {p.tipo === "escolha" && (
          <div className="mt-2 space-y-2">
            <label className={rotulo}>✅ Resposta certa<input value={p.certa} onChange={(e) => trocar({ ...p, certa: e.target.value })} placeholder="Marte" className={`${campo} mt-1 border-ok/60`} /></label>
            <p className={rotulo}>❌ Respostas erradas (e, se quiser, por que estão erradas)</p>
            <Linhas itens={p.erradas} mudar={(erradas) => trocar({ ...p, erradas })} novo={() => ({ texto: "", porque: "" })} rotuloNovo="outra errada" linha={(e, t) => (
              <div className="grid gap-1 sm:grid-cols-2">
                <input value={e.texto} onChange={(ev) => t({ ...e, texto: ev.target.value })} placeholder="Lua" aria-label="Resposta errada" className={campo} />
                <input value={e.porque} onChange={(ev) => t({ ...e, porque: ev.target.value })} placeholder="A Lua é um satélite. (opcional)" aria-label="Por que está errada" className={campo} />
              </div>
            )} />
          </div>
        )}
        {p.tipo === "vf" && (
          <div className="mt-2 flex gap-2">
            {[true, false].map((v) => (
              <button key={String(v)} type="button" aria-pressed={p.verdade === v} onClick={() => trocar({ ...p, verdade: v })} className={`cursor-pointer border-2 px-3 py-1.5 text-sm font-bold ${p.verdade === v ? "border-ink bg-ink text-parchment" : "border-ink/20"}`}>{v ? "É verdadeira" : "É falsa"}</button>
            ))}
          </div>
        )}
        {p.tipo === "numero" && (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className={rotulo}>Resposta (número)<input value={p.numero} onChange={(e) => trocar({ ...p, numero: e.target.value })} inputMode="decimal" placeholder="56" className={`${campo} mt-1`} /></label>
            <label className={rotulo}>Aceitar diferença de até (opcional)<input value={p.margem} onChange={(e) => trocar({ ...p, margem: e.target.value })} inputMode="decimal" placeholder="0,5" className={`${campo} mt-1`} /></label>
          </div>
        )}
        {p.tipo === "lacunas" && (
          <div className="mt-2">
            <p className={rotulo}>O que vai em cada espaço (outras formas aceitas separadas por | )</p>
            <div className="mt-1 space-y-1">
              {Array.from({ length: Math.max(1, (p.enunciado.match(/___/g) ?? []).length) }, (_, k) => (
                <input key={k} value={p.lacunas[k] ?? ""} onChange={(e) => { const n = [...p.lacunas]; n[k] = e.target.value; trocar({ ...p, lacunas: n }); }} placeholder={`Espaço ${k + 1}: Brasília`} className={campo} />
              ))}
            </div>
          </div>
        )}
        {p.tipo === "ordenar" && (
          <div className="mt-2">
            <p className={rotulo}>Itens já na ordem certa (a aula embaralha)</p>
            <div className="mt-1">
              <Linhas itens={p.itens} mudar={(itens) => trocar({ ...p, itens })} novo={() => ""} rotuloNovo="outro item" linha={(it, t, k) => <input value={it} onChange={(e) => t(e.target.value)} placeholder={`${k + 1}º`} className={campo} />} />
            </div>
          </div>
        )}
        <label className={`${rotulo} mt-2`}>💡 Explicação para quem errar (opcional)<input value={p.explicacao} onChange={(e) => trocar({ ...p, explicacao: e.target.value })} className={`${campo} mt-1`} /></label>
      </div>
    )} />
  );
}

// ───────────── Pares (memória, cartões), palavras (forca, caça-palavras), frases, linha do tempo ─────────────

function FormPares({ spec, mudar, a, b, comVoz }: { spec: string; mudar: (s: string) => void; a: string; b: string; comVoz: boolean }) {
  const lido = lerPares(spec);
  const [lingua, setLingua] = useState(lido.lingua);
  const [pares, setPares] = useState(lido.pares.length ? lido.pares : [{ a: "", b: "" }, { a: "", b: "" }, { a: "", b: "" }]);
  const salvar = (l: string, ps: { a: string; b: string }[]) => mudar([l ? `lingua: ${l}` : "", ...ps.filter((p) => p.a.trim() && p.b.trim()).map((p) => `${p.a.trim()} = ${p.b.trim()}`)].filter(Boolean).join("\n"));
  return (
    <div className="space-y-3">
      {comVoz && <Lingua valor={lingua} mudar={(l) => { setLingua(l); salvar(l, pares); }} />}
      <div className="grid grid-cols-2 gap-1 pr-7 text-xs font-semibold"><span>{a}</span><span>{b}</span></div>
      <Linhas itens={pares} mudar={(ps) => { setPares(ps); salvar(lingua, ps); }} novo={() => ({ a: "", b: "" })} rotuloNovo="outro par" linha={(p, t) => (
        <div className="grid grid-cols-2 gap-1">
          <input value={p.a} onChange={(e) => t({ ...p, a: e.target.value })} aria-label={a} className={campo} />
          <input value={p.b} onChange={(e) => t({ ...p, b: e.target.value })} aria-label={b} className={campo} />
        </div>
      )} />
    </div>
  );
}

function FormForca({ spec, mudar }: { spec: string; mudar: (s: string) => void }) {
  const [ps, setPs] = useState(() => { const l = lerForca(spec).map((p) => ({ palavra: p.palavra.toLowerCase(), dica: p.dica })); return l.length ? l : [{ palavra: "", dica: "" }]; });
  return (
    <Linhas itens={ps} mudar={(n) => { setPs(n); mudar(n.filter((p) => p.palavra.trim()).map((p) => `${p.palavra.trim()}${p.dica.trim() ? ` | ${p.dica.trim()}` : ""}`).join("\n")); }} novo={() => ({ palavra: "", dica: "" })} rotuloNovo="outra palavra" linha={(p, t) => (
      <div className="grid gap-1 sm:grid-cols-[1fr_2fr]">
        <input value={p.palavra} onChange={(e) => t({ ...p, palavra: e.target.value })} placeholder="Palavra secreta" aria-label="Palavra" className={campo} />
        <input value={p.dica} onChange={(e) => t({ ...p, dica: e.target.value })} placeholder="Dica" aria-label="Dica" className={campo} />
      </div>
    )} />
  );
}

function FormCaca({ spec, mudar }: { spec: string; mudar: (s: string) => void }) {
  const lido = lerCacaPalavras(spec);
  const [ps, setPs] = useState(lido.palavras.length ? lido.palavras : ["", "", ""]);
  return (
    <div>
      <p className={rotulo}>Palavras escondidas (até 15; os acentos saem sozinhos)</p>
      <div className="mt-1">
        <Linhas itens={ps} mudar={(n) => { setPs(n); mudar(n.filter((p) => p.trim()).join("\n")); }} novo={() => ""} rotuloNovo="outra palavra" linha={(p, t) => <input value={p} onChange={(e) => t(e.target.value)} className={campo} />} />
      </div>
    </div>
  );
}

function FormFrases({ spec, mudar, rotuloA }: { spec: string; mudar: (s: string) => void; rotuloA: string }) {
  const lido = lerPronuncia(spec);
  const [lingua, setLingua] = useState(lido.lingua);
  const [fs, setFs] = useState(lido.frases.length ? lido.frases : [{ texto: "", traducao: "", audio: "" }]);
  const salvar = (l: string, lista: typeof fs) => mudar([l ? `lingua: ${l}` : "", ...lista.filter((f) => f.texto.trim()).map((f) => [f.texto.trim(), f.traducao.trim(), f.audio].filter((x, k) => x || k === 0).join(" | "))].filter(Boolean).join("\n"));
  return (
    <div className="space-y-3">
      <Lingua valor={lingua} mudar={(l) => { setLingua(l); salvar(l, fs); }} />
      <Linhas itens={fs} mudar={(n) => { setFs(n); salvar(lingua, n); }} novo={() => ({ texto: "", traducao: "", audio: "" })} rotuloNovo="outra frase" linha={(f, t) => (
        <div className="grid gap-1 sm:grid-cols-2">
          <input value={f.texto} onChange={(e) => t({ ...f, texto: e.target.value })} placeholder={rotuloA} aria-label={rotuloA} className={campo} />
          <input value={f.traducao} onChange={(e) => t({ ...f, traducao: e.target.value })} placeholder="Tradução" aria-label="Tradução" className={campo} />
        </div>
      )} />
    </div>
  );
}

function FormTempo({ spec, mudar }: { spec: string; mudar: (s: string) => void }) {
  const [ms, setMs] = useState(() => { const l = lerLinhaDoTempo(spec); return l.length ? l : [{ quando: "", texto: "" }]; });
  return (
    <Linhas itens={ms} mudar={(n) => { setMs(n); mudar(n.filter((m) => m.quando.trim() && m.texto.trim()).map((m) => `${m.quando.trim()} | ${m.texto.trim()}`).join("\n")); }} novo={() => ({ quando: "", texto: "" })} rotuloNovo="outro acontecimento" linha={(m, t) => (
      <div className="grid gap-1 sm:grid-cols-[8rem_1fr]">
        <input value={m.quando} onChange={(e) => t({ ...m, quando: e.target.value })} placeholder="1888" aria-label="Quando" className={campo} />
        <input value={m.texto} onChange={(e) => t({ ...m, texto: e.target.value })} placeholder="O que aconteceu" aria-label="O que aconteceu" className={campo} />
      </div>
    )} />
  );
}

function FormArrastar({ spec, mudar }: { spec: string; mudar: (s: string) => void }) {
  const [gs, setGs] = useState(() => { const l = lerArrastar(spec).grupos.map((g) => ({ nome: g.nome, itens: g.itens.join(", ") })); return l.length ? l : [{ nome: "", itens: "" }, { nome: "", itens: "" }]; });
  return (
    <Linhas itens={gs} mudar={(n) => { setGs(n); mudar(n.filter((g) => g.nome.trim() && g.itens.trim()).map((g) => `${g.nome.trim()}: ${g.itens.trim()}`).join("\n")); }} novo={() => ({ nome: "", itens: "" })} rotuloNovo="outro grupo" linha={(g, t) => (
      <div className={`${cartao} grid gap-1 sm:grid-cols-[12rem_1fr]`}>
        <input value={g.nome} onChange={(e) => t({ ...g, nome: e.target.value })} placeholder="Nome do grupo (Mamíferos)" aria-label="Nome do grupo" className={campo} />
        <input value={g.itens} onChange={(e) => t({ ...g, itens: e.target.value })} placeholder="Itens separados por vírgula (gato, baleia, morcego)" aria-label="Itens do grupo" className={campo} />
      </div>
    )} />
  );
}

// ───────────── Molécula, desenho, programação, código, cena ─────────────

function FormMolecula({ spec, mudar }: { spec: string; mudar: (s: string) => void }) {
  const lido = lerMolecula(spec);
  const [v, setV] = useState({ entrada: lido.entrada, bolas: lido.estilo === "bolas", rotulos: lido.rotulos });
  const salvar = (n: typeof v) => { setV(n); mudar([n.entrada, n.bolas ? "estilo: bolas" : "", n.rotulos ? "rotulos: sim" : ""].filter(Boolean).join("\n")); };
  return (
    <div className="space-y-2">
      <label className={rotulo}>Molécula (nome, como água, etanol, glicose, cafeína, ou a fórmula SMILES do PubChem)<input value={v.entrada} onChange={(e) => salvar({ ...v, entrada: e.target.value })} className={`${campo} mt-1`} /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.rotulos} onChange={(e) => salvar({ ...v, rotulos: e.target.checked })} /> Mostrar as letras dos átomos</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.bolas} onChange={(e) => salvar({ ...v, bolas: e.target.checked })} /> Começar no modelo de esferas</label>
    </div>
  );
}

function FormProgramacao({ spec, mudar }: { spec: string; mudar: (s: string) => void }) {
  const lido = lerProgramacao(spec);
  const [v, setV] = useState({ objetivo: lido.objetivo, categorias: lido.categorias, esperado: lido.esperado ?? "" });
  const nomes: Record<CategoriaDeBlocos, string> = { logica: "Lógica", lacos: "Repetição", matematica: "Matemática", texto: "Texto", listas: "Listas", variaveis: "Variáveis", funcoes: "Funções" };
  const salvar = (n: typeof v) => { setV(n); mudar([`objetivo: ${n.objetivo}`, `blocos: ${n.categorias.join(", ")}`, n.esperado.trim() ? `esperado:\n${n.esperado.trim()}` : ""].filter(Boolean).join("\n")); };
  return (
    <div className="space-y-2">
      <label className={rotulo}>Desafio<input value={v.objetivo} onChange={(e) => salvar({ ...v, objetivo: e.target.value })} placeholder="Faça o computador contar de 1 a 5." className={`${campo} mt-1`} /></label>
      <p className={rotulo}>Gavetas de blocos que aparecem</p>
      <div className="flex flex-wrap gap-1">
        {CATEGORIAS_DE_BLOCOS.map((c) => (
          <button key={c} type="button" aria-pressed={v.categorias.includes(c)} onClick={() => salvar({ ...v, categorias: v.categorias.includes(c) ? v.categorias.filter((x) => x !== c) : [...v.categorias, c] })} className={`cursor-pointer border-2 px-2 py-1 text-xs font-semibold ${v.categorias.includes(c) ? "border-ink bg-ink text-parchment" : "border-ink/20"}`}>{nomes[c]}</button>
        ))}
      </div>
      <label className={rotulo}>Resultado certo, uma linha por vez (opcional: a aula confere sozinha)<textarea value={v.esperado} onChange={(e) => salvar({ ...v, esperado: e.target.value })} rows={4} className={`${campo} mt-1 font-mono`} /></label>
    </div>
  );
}

function FormRodar({ spec, mudar }: { spec: string; mudar: (s: string) => void }) {
  const lido = lerRodar(spec);
  const [v, setV] = useState({ linguagem: lido.linguagem as string, codigo: lido.codigo, esperado: lido.esperado ?? "" });
  const salvar = (n: typeof v) => { setV(n); mudar([`linguagem: ${n.linguagem}`, n.codigo, n.esperado.trim() ? `--- esperado\n${n.esperado.trim()}` : ""].filter(Boolean).join("\n")); };
  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {[["python", "Python"], ["javascript", "JavaScript"]].map(([l, n]) => (
          <button key={l} type="button" aria-pressed={v.linguagem === l} onClick={() => salvar({ ...v, linguagem: l })} className={`cursor-pointer border-2 px-3 py-1 text-sm font-bold ${v.linguagem === l ? "border-ink bg-ink text-parchment" : "border-ink/20"}`}>{n}</button>
        ))}
      </div>
      <label className={rotulo}>Código que a pessoa vai rodar e mudar<textarea value={v.codigo} onChange={(e) => salvar({ ...v, codigo: e.target.value })} rows={6} spellCheck={false} className={`${campo} mt-1 font-mono`} /></label>
      <label className={rotulo}>Resultado certo (opcional)<textarea value={v.esperado} onChange={(e) => salvar({ ...v, esperado: e.target.value })} rows={3} className={`${campo} mt-1 font-mono`} /></label>
    </div>
  );
}

function FormCena({ spec, mudar }: { spec: string; mudar: (s: string) => void }) {
  const lida = lerCena(spec);
  const [v, setV] = useState(() => {
    const imagem = /imagem\s*:\s*([^|\n]+)/i.exec(spec)?.[1]?.trim() ?? "";
    const descricao = /imagem\s*:[^|\n]*\|\s*(.+)/i.exec(spec)?.[1]?.trim() ?? "";
    return { imagem, descricao, encontrar: lida?.modo === "encontrar", areas: lida?.areas ?? [] };
  });
  const [desenho, setDesenho] = useState<{ x: number; y: number; x2: number; y2: number } | null>(null);
  const caixa = useRef<HTMLDivElement>(null);
  const salvar = (n: typeof v) => {
    setV(n);
    mudar([`imagem: ${n.imagem}${n.descricao ? ` | ${n.descricao}` : ""}`, `modo: ${n.encontrar ? "encontrar" : "explorar"}`, ...n.areas.map((a) => `${a.nome || "Parte"} | ${[a.x, a.y, a.w, a.h].map((x) => Math.round(x)).join(" ")} | ${a.texto}`)].join("\n"));
  };
  const pos = (e: React.PointerEvent) => {
    const r = caixa.current!.getBoundingClientRect();
    return { x: Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)), y: Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)) };
  };
  return (
    <div className="space-y-2">
      <label className={rotulo}>Endereço da imagem do site (envie em Materiais e arquivos e cole aqui)<input value={v.imagem} onChange={(e) => salvar({ ...v, imagem: e.target.value })} placeholder="/arquivos/…" className={`${campo} mt-1`} /></label>
      <label className={rotulo}>Descrição da imagem (para quem não enxerga)<input value={v.descricao} onChange={(e) => salvar({ ...v, descricao: e.target.value })} className={`${campo} mt-1`} /></label>
      <div className="flex gap-1">
        <button type="button" aria-pressed={!v.encontrar} onClick={() => salvar({ ...v, encontrar: false })} className={`cursor-pointer border-2 px-3 py-1 text-sm font-bold ${!v.encontrar ? "border-ink bg-ink text-parchment" : "border-ink/20"}`}>👆 Explorar (toca e lê)</button>
        <button type="button" aria-pressed={v.encontrar} onClick={() => salvar({ ...v, encontrar: true })} className={`cursor-pointer border-2 px-3 py-1 text-sm font-bold ${v.encontrar ? "border-ink bg-ink text-parchment" : "border-ink/20"}`}>🔍 Encontrar (jogo)</button>
      </div>
      {/^\/(arquivos|imagens)\//.test(v.imagem) && (
        <div>
          <p className="text-xs font-semibold">Arraste o mouse (ou o dedo) em cima da imagem para marcar cada parte:</p>
          <div
            ref={caixa}
            className="relative mt-1 inline-block max-w-full touch-none select-none"
            onPointerDown={(e) => { const p = pos(e); setDesenho({ x: p.x, y: p.y, x2: p.x, y2: p.y }); e.currentTarget.setPointerCapture(e.pointerId); }}
            onPointerMove={(e) => { if (desenho) { const p = pos(e); setDesenho({ ...desenho, x2: p.x, y2: p.y }); } }}
            onPointerUp={() => {
              if (desenho && Math.abs(desenho.x2 - desenho.x) > 2 && Math.abs(desenho.y2 - desenho.y) > 2) salvar({ ...v, areas: [...v.areas, { nome: `Parte ${v.areas.length + 1}`, x: Math.min(desenho.x, desenho.x2), y: Math.min(desenho.y, desenho.y2), w: Math.abs(desenho.x2 - desenho.x), h: Math.abs(desenho.y2 - desenho.y), texto: "" }] });
              setDesenho(null);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={v.imagem} alt={v.descricao} draggable={false} className="block max-h-80 max-w-full" />
            {[...v.areas, ...(desenho ? [{ nome: "", x: Math.min(desenho.x, desenho.x2), y: Math.min(desenho.y, desenho.y2), w: Math.abs(desenho.x2 - desenho.x), h: Math.abs(desenho.y2 - desenho.y), texto: "" }] : [])].map((a, i) => (
              <span key={i} className="absolute border-2 border-oxblood bg-oxblood/15 text-[10px] font-bold text-oxblood" style={{ left: `${a.x}%`, top: `${a.y}%`, width: `${a.w}%`, height: `${a.h}%` }}>{a.nome}</span>
            ))}
          </div>
        </div>
      )}
      {v.areas.length > 0 && (
        <Linhas itens={v.areas} mudar={(areas) => salvar({ ...v, areas })} novo={() => ({ nome: "", x: 10, y: 10, w: 20, h: 20, texto: "" })} rotuloNovo="outra parte" linha={(a, t) => (
          <div className="grid gap-1 sm:grid-cols-[10rem_1fr]">
            <input value={a.nome} onChange={(e) => t({ ...a, nome: e.target.value })} placeholder="Nome da parte" aria-label="Nome da parte" className={campo} />
            <input value={a.texto} onChange={(e) => t({ ...a, texto: e.target.value })} placeholder="O que é (aparece ao tocar)" aria-label="Explicação" className={campo} />
          </div>
        )} />
      )}
    </div>
  );
}

function FormDesenho({ spec, mudar }: { spec: string; mudar: (s: string) => void }) {
  const [v, setV] = useState(spec.trim());
  return <label className={rotulo}>O que a pessoa vai desenhar<textarea value={v} onChange={(e) => { setV(e.target.value); mudar(e.target.value); }} rows={3} className={`${campo} mt-1`} /></label>;
}

/** O formulário do bloco, ou null quando o bloco só tem o modo texto (gráfico, mapa, simulação…). */
export function FormularioDoBloco({ tipo, spec, mudar }: { tipo: Interativo; spec: string; mudar: (s: string) => void }) {
  switch (tipo) {
    case "teste": return <FormTeste spec={spec} mudar={mudar} />;
    case "memoria": return <FormPares spec={spec} mudar={mudar} a="Carta A" b="Carta que forma par" comVoz={false} />;
    case "cartoes": return <FormPares spec={spec} mudar={mudar} a="Frente" b="Verso" comVoz />;
    case "forca": return <FormForca spec={spec} mudar={mudar} />;
    case "cacapalavras": return <FormCaca spec={spec} mudar={mudar} />;
    case "frase": return <FormFrases spec={spec} mudar={mudar} rotuloA="Frase na língua estudada" />;
    case "pronuncia": return <FormFrases spec={spec} mudar={mudar} rotuloA="Frase para ouvir e repetir" />;
    case "linhadotempo": return <FormTempo spec={spec} mudar={mudar} />;
    case "arrastar": return <FormArrastar spec={spec} mudar={mudar} />;
    case "molecula": return <FormMolecula spec={spec} mudar={mudar} />;
    case "programacao": return <FormProgramacao spec={spec} mudar={mudar} />;
    case "rodar": return <FormRodar spec={spec} mudar={mudar} />;
    case "cena": return <FormCena spec={spec} mudar={mudar} />;
    case "desenho": return <FormDesenho spec={spec} mudar={mudar} />;
    default: return null;
  }
}

/** Ícone e gaveta de cada bloco no menu "＋ bloco". */
export const VITRINE: Record<Interativo, [string, "Jogos" | "Testes" | "Línguas" | "Ciência e matemática" | "Outros"]> = {
  teste: ["📝", "Testes"], memoria: ["🃏", "Jogos"], forca: ["🪢", "Jogos"], cacapalavras: ["🔎", "Jogos"], arrastar: ["🧺", "Jogos"], cena: ["🖼️", "Jogos"], cartoes: ["🗂️", "Línguas"],
  frase: ["🧩", "Línguas"], pronuncia: ["🗣️", "Línguas"], musica: ["🎵", "Línguas"], grafico: ["📈", "Ciência e matemática"], geometria: ["📐", "Ciência e matemática"], calculadora: ["🧮", "Ciência e matemática"],
  dados: ["📊", "Ciência e matemática"], simulacao: ["⚽", "Ciência e matemática"], molecula: ["⚛️", "Ciência e matemática"], mapa: ["🗺️", "Outros"], linhadotempo: ["⏳", "Outros"], diagrama: ["🔀", "Outros"],
  programacao: ["🧱", "Ciência e matemática"], rodar: ["💻", "Ciência e matemática"], desenho: ["✏️", "Outros"], ferramenta: ["🧰", "Outros"],
};

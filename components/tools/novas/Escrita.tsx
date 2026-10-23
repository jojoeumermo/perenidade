// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { type CamposDaReferencia, referencia, type TipoDeReferencia } from "@/lib/ferramentas/rodada";
import { Bancada, BotaoClaro, Escolha } from "../../labs/kit";
import { AVISO_DE_VOZ, ComoUsar, falar } from "./comum";

const CAMPOS: Record<TipoDeReferencia, [keyof CamposDaReferencia, string, string][]> = {
  livro: [["titulo", "Título", "Pedagogia do oprimido"], ["subtitulo", "Subtítulo (se houver)", ""], ["edicao", "Edição (deixe vazio se for a 1ª)", "17"], ["local", "Cidade da editora", "Rio de Janeiro"], ["editora", "Editora", "Paz e Terra"], ["ano", "Ano", "1987"]],
  artigo: [["titulo", "Título do artigo", ""], ["subtitulo", "Subtítulo (se houver)", ""], ["revista", "Nome da revista", ""], ["local", "Cidade da revista", ""], ["volume", "Volume", ""], ["numero", "Número", ""], ["paginas", "Páginas (ex.: 10-25)", ""], ["ano", "Ano", ""], ["url", "Endereço na internet (se for online)", ""]],
  site: [["titulo", "Título da página", ""], ["subtitulo", "Subtítulo (se houver)", ""], ["local", "Cidade (se souber)", ""], ["ano", "Ano de publicação", ""], ["url", "Endereço (URL)", ""]],
  trabalho: [["titulo", "Título", ""], ["subtitulo", "Subtítulo (se houver)", ""], ["ano", "Ano de entrega", ""], ["tipoTrabalho", "Tipo (Trabalho de Conclusão de Curso, Dissertação, Tese)", "Trabalho de Conclusão de Curso"], ["curso", "Grau e curso (ex.: Licenciatura em Pedagogia)", ""], ["instituicao", "Instituição", ""], ["local", "Cidade", ""], ["anoDefesa", "Ano da defesa", ""]],
};

/** Referências no formato da ABNT (NBR 6023:2018) para livro, artigo, página da internet e trabalho acadêmico. */
export function Referencias() {
  const [tipo, setTipo] = useState<TipoDeReferencia>("livro");
  const [autores, setAutores] = useState("Paulo Freire");
  const [c, setC] = useState<Record<string, string>>({ titulo: "Pedagogia do oprimido", edicao: "17", local: "Rio de Janeiro", editora: "Paz e Terra", ano: "1987" });
  const [lista, setLista] = useState<string[]>([]);
  const [copiado, setCopiado] = useState(false);
  const partes = referencia(tipo, { ...c, autores: autores.split(/\n|;/), titulo: c.titulo ?? "" } as CamposDaReferencia);
  const texto = partes.map((p) => p.t).join("");
  const html = partes.map((p) => (p.negrito ? `<strong>${p.t.replace(/</g, "&lt;")}</strong>` : p.t.replace(/</g, "&lt;"))).join("");
  async function copiar(t: string, h: string) {
    try {
      const Item = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
      if (Item) await navigator.clipboard.write([new Item({ "text/plain": new Blob([t], { type: "text/plain" }), "text/html": new Blob([h], { type: "text/html" }) })]);
      else await navigator.clipboard.writeText(t);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem permissão: a pessoa seleciona e copia à mão.
    }
  }
  const campo = "mt-1 w-full border-2 border-ink/30 bg-parchment px-2 py-1.5";
  return (
    <div>
      <Bancada titulo="Referências ABNT" subtitulo="Para o fim do trabalho escolar, do TCC ou do artigo">
        <Escolha rotulo="O que você vai citar" valor={tipo} opcoes={[["livro", "Livro"], ["artigo", "Artigo de revista"], ["site", "Página da internet"], ["trabalho", "TCC, dissertação ou tese"]]} mudar={(v) => { setTipo(v); setC({}); }} />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold sm:col-span-2">Autoria (um nome por linha; ou o nome da instituição)<textarea value={autores} onChange={(e) => setAutores(e.target.value.slice(0, 600))} rows={2} className={campo} /></label>
          {CAMPOS[tipo].map(([k, rotulo, exemplo]) => (
            <label key={k} className="block text-sm font-semibold">{rotulo}<input value={c[k] ?? ""} placeholder={exemplo} onChange={(e) => setC({ ...c, [k]: e.target.value.slice(0, 400) })} className={campo} /></label>
          ))}
        </div>
        <p className="mt-4 rounded border-2 border-ink bg-white p-4 font-serif text-base leading-relaxed text-[#17130e]">{partes.map((p, i) => (p.negrito ? <strong key={i}>{p.t}</strong> : <span key={i}>{p.t}</span>))}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <BotaoClaro onClick={() => void copiar(texto, html)}>{copiado ? "✓ Copiada" : "Copiar (com o negrito)"}</BotaoClaro>
          <BotaoClaro onClick={() => setLista((l) => [...new Set([...l, html])].sort((a, b) => a.replace(/<[^>]+>/g, "").localeCompare(b.replace(/<[^>]+>/g, ""), "pt-BR")))}>＋ Pôr na lista</BotaoClaro>
        </div>
        {lista.length > 0 && (
          <section className="mt-4">
            <h3 className="font-semibold">Referências do trabalho ({lista.length}), em ordem alfabética</h3>
            <ol className="mt-2 space-y-2 rounded border border-rule bg-white p-3 font-serif text-sm text-[#17130e]">
              {lista.map((h) => <li key={h} dangerouslySetInnerHTML={{ __html: h }} />)}
            </ol>
            <div className="mt-2 flex gap-2"><BotaoClaro onClick={() => void copiar(lista.map((h) => h.replace(/<[^>]+>/g, "")).join("\n\n"), lista.map((h) => `<p>${h}</p>`).join(""))}>Copiar a lista</BotaoClaro><BotaoClaro onClick={() => setLista([])}>Limpar</BotaoClaro></div>
          </section>
        )}
      </Bancada>
      <ComoUsar
        passos={["Escolha o tipo: livro, artigo, página ou trabalho acadêmico.", "Preencha a autoria (um nome por linha) e os campos; o que faltar aparece como [S. l.] ou [s. n.], como a norma pede.", "Copie com o negrito ou junte tudo numa lista em ordem alfabética."]}
        atividades={["Faça a referência de um livro que você tem em casa, olhando a folha de rosto (nome, edição, cidade, editora e ano).", "Cite uma página da internet que você usou num trabalho. Por que a norma pede a data de acesso?", "Monte a lista de referências de um trabalho com pelo menos três fontes de tipos diferentes e confira a ordem alfabética."]}
        revisao
        fonte={<>Segue a NBR 6023:2018 da ABNT nos casos comuns; casos especiais (leis, filmes, entrevistas, capítulos) têm regras próprias. Confira com quem orienta o seu trabalho.</>}
      />
    </div>
  );
}

const GERADORAS: { palavra: string; silabas: string[]; familias: string[][]; palavras: string[]; conversa: string[] }[] = [
  {
    palavra: "TIJOLO", silabas: ["TI", "JO", "LO"],
    familias: [["TA", "TE", "TI", "TO", "TU"], ["JA", "JE", "JI", "JO", "JU"], ["LA", "LE", "LI", "LO", "LU"]],
    palavras: ["TATU", "TELA", "TETO", "TATO", "LATA", "LUTA", "LOTE", "LOJA", "JATO", "TIJOLO"],
    conversa: ["Quem faz os tijolos? Quem levanta as paredes?", "Quem constrói as casas mora nelas?", "Na sua rua, as casas foram feitas por quem?"],
  },
  {
    palavra: "FAVELA", silabas: ["FA", "VE", "LA"],
    familias: [["FA", "FE", "FI", "FO", "FU"], ["VA", "VE", "VI", "VO", "VU"], ["LA", "LE", "LI", "LO", "LU"]],
    palavras: ["FALA", "FILA", "VELA", "VILA", "FAVA", "LUVA", "VALE", "LAVA", "LEVA", "VALA", "FIVELA", "FAVELA"],
    conversa: ["Como nasceu a favela onde você mora ou que você conhece?", "O que falta e o que sobra na favela?", "O que os moradores já conquistaram juntos?"],
  },
  {
    palavra: "COMIDA", silabas: ["CO", "MI", "DA"],
    familias: [["CA", "CO", "CU"], ["MA", "ME", "MI", "MO", "MU"], ["DA", "DE", "DI", "DO", "DU"]],
    palavras: ["CAMA", "DAMA", "MODA", "MUDO", "DADO", "DEDO", "MEDO", "CADA", "MICO", "COMIDA"],
    conversa: ["Quem planta a comida que chega à sua mesa?", "Por que a comida está cada vez mais cara?", "Falta comida no mundo ou falta dinheiro para comprar?"],
  },
  {
    palavra: "SAPATO", silabas: ["SA", "PA", "TO"],
    familias: [["SA", "SE", "SI", "SO", "SU"], ["PA", "PE", "PI", "PO", "PU"], ["TA", "TE", "TI", "TO", "TU"]],
    palavras: ["PATA", "PATO", "SAPO", "SOPA", "SETE", "POTE", "PESO", "TAPA", "PIPA", "TAPETE", "SAPATO"],
    conversa: ["Quem faz os sapatos que a gente usa?", "Quanto ganha quem faz um sapato e quanto custa o sapato na loja?", "Que trabalho você faz com as mãos?"],
  },
];

/** Alfabetização de jovens e adultos com palavras geradoras, no espírito do método de Paulo Freire. */
export function PalavrasGeradoras() {
  const [g, setG] = useState(0);
  const [montada, setMontada] = useState<string[]>([]);
  const [achadas, setAchadas] = useState<string[]>([]);
  const [ditado, setDitado] = useState<string | null>(null);
  const [resposta, setResposta] = useState("");
  const [conferido, setConferido] = useState<string | null>(null);
  const atual = GERADORAS[g];
  const palavra = montada.join("");
  const valida = atual.palavras.includes(palavra);
  const ouvir = (t: string) => falar(t.toLocaleLowerCase("pt-BR"), "pt-BR", 0.7);
  const btn = "cursor-pointer rounded-md border-2 border-ink bg-parchment px-3 py-2 font-sans text-2xl font-bold tracking-wide hover:bg-[#ffd27a]";
  return (
    <div lang="pt-BR">
      <Bancada titulo="Palavras geradoras" subtitulo="Ler o mundo e ler a palavra">
        <Escolha rotulo="Palavra do dia" valor={String(g)} opcoes={GERADORAS.map((x, i) => [String(i), x.palavra])} mudar={(v) => { setG(Number(v)); setMontada([]); setAchadas([]); setDitado(null); setConferido(null); }} />
        <section className="mt-5 rounded-md bg-[#17130e] p-5 text-center text-[#f4ecd8]">
          <p className="font-serif text-5xl font-bold tracking-widest sm:text-6xl">{atual.palavra}</p>
          <p className="mt-3 flex justify-center gap-3 font-mono text-2xl">{atual.silabas.map((s, i) => <button key={i} type="button" onClick={() => ouvir(s)} className="cursor-pointer rounded border border-[#f4ecd8]/40 px-3 py-1 hover:bg-white/10">{s}</button>)}</p>
          <button type="button" onClick={() => ouvir(atual.palavra)} className="mt-3 cursor-pointer text-sm underline">Ouvir a palavra</button>
        </section>
        <details className="mt-4 rounded border border-rule p-3" open>
          <summary className="cursor-pointer font-semibold">Antes de ler: conversar</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-lg">{atual.conversa.map((q) => <li key={q}>{q}</li>)}</ul>
        </details>
        <h3 className="mt-5 font-semibold">As famílias (toque para ouvir e para montar palavras)</h3>
        <div className="mt-2 space-y-2">
          {atual.familias.map((f, i) => (
            <div key={i} className="flex flex-wrap gap-2">{f.map((s) => <button key={s} type="button" onClick={() => { ouvir(s); setMontada((m) => [...m, s].slice(0, 4)); }} className={btn}>{s}</button>)}</div>
          ))}
        </div>
        <div className="mt-4 flex min-h-16 flex-wrap items-center gap-3 rounded-md border-2 border-dashed border-ink/40 p-3">
          <span className="font-serif text-4xl font-bold tracking-widest">{palavra || "…"}</span>
          {palavra && <button type="button" onClick={() => ouvir(palavra)} className="cursor-pointer underline">ouvir</button>}
          {palavra && valida && !achadas.includes(palavra) && <button type="button" onClick={() => { setAchadas((a) => [...a, palavra]); setMontada([]); }} className="cursor-pointer rounded bg-[#1d6b3a] px-3 py-1 font-semibold text-white">✓ É uma palavra! Guardar</button>}
          {palavra && !valida && montada.length >= 2 && <span className="text-sm text-ink-soft">Não está na nossa lista. Será que existe? Pergunte ao grupo.</span>}
          {palavra && <button type="button" onClick={() => setMontada((m) => m.slice(0, -1))} className="ml-auto cursor-pointer underline">apagar uma</button>}
        </div>
        <p className="mt-2 text-sm">Palavras que você formou: <strong>{achadas.join(", ") || "nenhuma ainda"}</strong> ({achadas.length} de {atual.palavras.length})</p>
        <section className="mt-5 rounded-md border-2 border-ink p-4">
          <h3 className="font-semibold">Ditado</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <BotaoClaro onClick={() => { const w = atual.palavras[Math.floor(Math.random() * atual.palavras.length)]; setDitado(w); setResposta(""); setConferido(null); ouvir(w); }}>Ditar uma palavra</BotaoClaro>
            {ditado && <BotaoClaro onClick={() => ouvir(ditado)}>Repetir</BotaoClaro>}
          </div>
          {ditado && (
            <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); setConferido(resposta.trim().toLocaleUpperCase("pt-BR")); }}>
              <input value={resposta} onChange={(e) => setResposta(e.target.value.slice(0, 20))} aria-label="Escreva a palavra que ouviu" autoCapitalize="characters" className="w-48 border-2 border-ink bg-parchment px-3 py-2 font-serif text-2xl uppercase" />
              <button type="submit" className="cursor-pointer rounded border-2 border-ink px-4 font-semibold">Conferir</button>
            </form>
          )}
          {conferido && ditado && <p className="mt-2 text-lg">{conferido === ditado ? "✓ Certinho!" : <>Quase: a palavra era <strong>{ditado}</strong>. Compare letra por letra.</>}</p>}
        </section>
        <p className="mt-3 text-xs text-ink-soft">{AVISO_DE_VOZ}</p>
      </Bancada>
      <ComoUsar
        passos={["Escolha a palavra do dia e converse sobre ela antes de ler.", "Toque nas sílabas das famílias para ouvir e para montar palavras novas.", "Faça o ditado: ouça, escreva e confira."]}
        atividades={["Com a palavra TIJOLO, quantas palavras o grupo consegue formar? Escrevam no caderno.", "Escolha uma palavra que você formou e escreva uma frase sobre a sua vida com ela.", "Proponha ao grupo uma palavra geradora nova, do trabalho ou do bairro de vocês, e separe as sílabas dela."]}
        revisao
        fonte={<>Inspirado no método de alfabetização de Paulo Freire: as palavras geradoras nascem da conversa sobre a vida de quem aprende. As listas e as perguntas são sugestões; o grupo pode criar as suas.</>}
      />
    </div>
  );
}

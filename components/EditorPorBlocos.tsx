// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useRef, useState } from "react";
import { comMarcas, miolo, partir, textoPuro, tipoDe, type Tipo } from "@/lib/blocos";
import { eInterativo, INTERATIVOS, type Interativo as TipoInterativo, MODELOS_INTERATIVOS } from "@/lib/interativos";
import { FormularioDoBloco, VITRINE } from "./blocos/Formularios";
import { Interativo } from "./blocos/Interativo";
import { cleanImage, sendFile, UploadError, uploadMessages } from "@/lib/upload";
import { PendingImage } from "./LessonMedia";
import { Markdown } from "./Markdown";
import { Selo } from "./Selo";

/**
 * Editor por blocos: o mesmo texto em Markdown, mostrado como uma pilha de blocos (parágrafo, título, lista, imagem,
 * vídeo, fórmula, pergunta rápida, código, anexo…) que se montam, movem e editam sem decorar sintaxe. Não há formato
 * novo: o que sai daqui é o Markdown de sempre, e a pessoa pode voltar ao modo texto a qualquer momento sem perder nada.
 * O que o editor não reconhece fica num bloco "Markdown" intocado.
 */

interface Bloco {
  id: string;
  md: string;
}

const NOMES: Record<Tipo, string> = {
  paragrafo: "Parágrafo",
  titulo: "Título",
  subtitulo: "Subtítulo",
  lista: "Lista",
  numerada: "Lista numerada",
  citacao: "Citação",
  imagem: "Imagem",
  video: "Vídeo",
  formula: "Fórmula",
  conta: "Conta passo a passo",
  questao: "Pergunta rápida",
  codigo: "Código",
  anexo: "Anexo (PDF)",
  tabela: "Tabela",
  interativo: "Interativo",
  bruto: "Markdown",
};
const MODELOS: Record<Tipo, string> = {
  paragrafo: "",
  titulo: "## ",
  subtitulo: "### ",
  lista: "- ",
  numerada: "1. ",
  citacao: "> ",
  imagem: "![]()",
  video: "```video\nhttps://\n```",
  formula: "$$\nE = mc^2\n$$",
  conta: "```conta\n2 + 3 × 4\n= 2 + 12\n= 14\n```",
  questao: "```verificar\nQual é a pergunta?\n+ A resposta certa\n- Uma resposta errada\n> Uma dica para quem errar\n```",
  codigo: "```python\nprint(\"Olá\")\n```",
  anexo: "[📎 Anexo](#)",
  tabela: "| Coluna | Coluna |\n| --- | --- |\n| valor | valor |",
  interativo: "",
  bruto: "",
};
/** Os tipos que são só texto: dá para trocar um pelo outro sem perder o conteúdo. */
const DE_TEXTO: Tipo[] = ["paragrafo", "titulo", "subtitulo", "lista", "numerada", "citacao"];
const NO_MENU: Tipo[] = ["paragrafo", "titulo", "subtitulo", "lista", "numerada", "citacao", "imagem", "video", "formula", "conta", "questao", "codigo", "anexo", "tabela"];

/** O menu "＋ bloco" por objetivo: o que a pessoa quer fazer na aula, não o nome técnico do bloco. */
const GRUPOS_DO_MENU = ["Escrever", "Imagem, som e tempo", "Contas e ciência", "Conferir o que aprendeu", "Jogos", "Línguas e música", "Ferramentas"] as const;
type GrupoDoMenu = (typeof GRUPOS_DO_MENU)[number];
interface OpcaoDeBloco {
  chave: string;
  nome: string;
  sobre: string;
  selo: string;
  grupo: GrupoDoMenu;
  inserir: (i: number) => void;
}
const BLOCOS_RECENTES = "lucia:blocos-recentes";
const SOBRE: Partial<Record<Tipo, string>> = {
  paragrafo: "Texto corrido.",
  titulo: "Abre uma parte nova da aula.",
  subtitulo: "Divide uma parte em pedaços.",
  lista: "Itens com marcador.",
  numerada: "Passos em ordem.",
  citacao: "Um trecho de alguém, com destaque.",
  imagem: "Foto, mapa ou desenho, com legenda e fonte.",
  video: "Um vídeo do YouTube ou de outro site.",
  formula: "Uma fórmula escrita como no caderno.",
  conta: "Uma conta resolvida linha por linha.",
  questao: "Uma pergunta com resposta e dica.",
  codigo: "Um trecho de programa.",
  anexo: "Um PDF para baixar.",
  tabela: "Linhas e colunas.",
};
const SELO_DO_TIPO: Partial<Record<Tipo, string>> = {
  paragrafo: "paragrafo", titulo: "titulo", subtitulo: "titulo", lista: "lista", numerada: "numerada", citacao: "aspas", imagem: "imagem", video: "video",
  formula: "formula", conta: "abaco", questao: "pergunta", codigo: "tags", anexo: "clipe", tabela: "tabela",
};
const GRUPO_DO_TIPO: Partial<Record<Tipo, GrupoDoMenu>> = {
  paragrafo: "Escrever", titulo: "Escrever", subtitulo: "Escrever", lista: "Escrever", numerada: "Escrever", citacao: "Escrever", tabela: "Escrever",
  imagem: "Imagem, som e tempo", video: "Imagem, som e tempo", anexo: "Imagem, som e tempo",
  formula: "Contas e ciência", conta: "Contas e ciência", codigo: "Contas e ciência", questao: "Conferir o que aprendeu",
};
const LINGUAGENS = ["python", "php", "javascript", "html", "css", "sql", "bash", "texto"];

/** O nome que aparece no alto do bloco: o dos interativos vem da lista deles ("Gráfico de função", "Forca"…). */
const nomeDoBloco = (md: string, tipo: Tipo) => {
  const lingua = /^```\s*([\w-]*)/.exec(md)?.[1] ?? "";
  return tipo === "interativo" && eInterativo(lingua) ? MODELOS_INTERATIVOS[lingua].nome : NOMES[tipo];
};

let contador = 0;
const novoId = () => `b${++contador}-${Math.random().toString(36).slice(2, 7)}`;

const campo = "w-full border border-rule bg-parchment px-2 py-1.5";
const linhasDe = (texto: string, minimo = 2) => Math.max(minimo, texto.split("\n").length + 1);

export function EditorPorBlocos({ value, onChange, upload = false }: { value: string; onChange: (value: string) => void; upload?: boolean }) {
  const [estado, setEstado] = useState(() => ({ fonte: value, blocos: partir(value).map((md) => ({ id: novoId(), md })) }));
  /** Blocos interativos abertos no modo texto (o resto mostra o formulário). */
  const [avancado, setAvancado] = useState<Set<string>>(() => new Set());
  // Mudou por fora (modo texto, gabarito, rascunho recuperado): os blocos são refeitos a partir do texto.
  if (estado.fonte !== value) setEstado({ fonte: value, blocos: partir(value).map((md) => ({ id: novoId(), md })) });
  const blocos = estado.blocos;
  const [menu, setMenu] = useState<number | null>(null);
  const [busca, setBusca] = useState("");
  const casa = (nome: string) => !busca.trim() || nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(busca.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
  const [gravando, setGravando] = useState<{ bloco: number; linha: number; gravador: MediaRecorder } | null>(null);
  const [aviso, setAviso] = useState("");
  const arrastando = useRef<number | null>(null);

  const mudar = (novos: Bloco[]) => {
    const texto = novos.map((b) => b.md.replace(/\s+$/, "")).join("\n\n");
    setEstado({ fonte: texto, blocos: novos });
    onChange(texto);
  };
  const trocar = (i: number, md: string) => mudar(blocos.map((b, j) => (j === i ? { ...b, md } : b)));
  const inserir = (i: number, tipo: Tipo, md = MODELOS[tipo]) => {
    const novos = [...blocos];
    novos.splice(i, 0, { id: novoId(), md });
    mudar(novos);
    setMenu(null);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-bloco="${i}"] textarea, [data-bloco="${i}"] input`)?.focus());
  };
  const mover = (de: number, para: number) => {
    if (para < 0 || para >= blocos.length || de === para) return;
    const novos = [...blocos];
    const [b] = novos.splice(de, 1);
    novos.splice(para, 0, b);
    mudar(novos);
  };

  async function enviarImagem(i: number, arquivo: File | undefined) {
    if (!arquivo) return;
    setAviso("Enviando a imagem…");
    try {
      const { blob, extension } = await cleanImage(arquivo);
      const caminho = await sendFile(blob, extension);
      const atual = /^!\[([^\]]*)\]\(([^)\s]*)(?:\s+"([^"]*)")?\)$/.exec(blocos[i].md);
      trocar(i, `![${atual?.[1] ?? ""}](envio:${caminho}${atual?.[3] ? ` "${atual[3]}"` : ""})`);
      setAviso("");
    } catch (erro) {
      setAviso(uploadMessages[erro instanceof UploadError ? erro.message : "envio"] ?? uploadMessages.envio);
    }
  }
  async function gravar(i: number, linha: number) {
    if (gravando) {
      gravando.gravador.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setAviso("Este navegador não grava áudio.");
      return;
    }
    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tipo = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const gravador = new MediaRecorder(fluxo, { mimeType: tipo });
      const pedacos: Blob[] = [];
      gravador.ondataavailable = (e) => pedacos.push(e.data);
      gravador.onstop = async () => {
        fluxo.getTracks().forEach((faixa) => faixa.stop());
        setGravando(null);
        setAviso("Enviando a gravação…");
        try {
          const caminho = await sendFile(new Blob(pedacos, { type: tipo }), tipo === "audio/webm" ? "webm" : "m4a");
          const dentro = miolo(blocos[i].md).split("\n");
          let n = -1;
          const novas = dentro.map((l) => {
            if (!l.trim() || /^(lingua|língua|idioma)\s*:/i.test(l.trim())) return l;
            n++;
            if (n !== linha) return l;
            const [frase, traducao = ""] = l.split("|").map((x) => x.trim());
            return `${frase} | ${traducao} | envio:${caminho}`;
          });
          trocar(i, ["```pronuncia", ...novas, "```"].join("\n"));
          setAviso("Gravação guardada. Ela vai para a pasta do site quando a aula for publicada.");
        } catch (erro) {
          setAviso(uploadMessages[erro instanceof UploadError ? erro.message : "envio"] ?? uploadMessages.envio);
        }
      };
      gravador.start();
      setGravando({ bloco: i, linha, gravador });
      setTimeout(() => gravador.state === "recording" && gravador.stop(), 20_000);
    } catch {
      setAviso("O navegador não deixou usar o microfone.");
    }
  }

  async function enviarPdf(i: number, arquivo: File | undefined) {
    if (!arquivo) return;
    if (arquivo.type !== "application/pdf" && !/\.pdf$/i.test(arquivo.name)) {
      setAviso("O anexo precisa ser um PDF.");
      return;
    }
    setAviso("Enviando o PDF…");
    try {
      const caminho = await sendFile(arquivo, "pdf");
      const nome = /^\[📎\s*([^\]]*)\]/.exec(blocos[i].md)?.[1] || "Anexo";
      trocar(i, `[📎 ${nome}](envio:${caminho})`);
      setAviso("O PDF vai para a pasta do site quando a aula for publicada; programas, anexos e ações automáticas dentro dele são recusados.");
    } catch (erro) {
      setAviso(uploadMessages[erro instanceof UploadError ? erro.message : "envio"] ?? uploadMessages.envio);
    }
  }

  // Os blocos lembrados por último ficam no alto do menu (só neste aparelho).
  const [recentes, setRecentes] = useState<string[]>(() => {
    try {
      const lido = JSON.parse(localStorage.getItem(BLOCOS_RECENTES) ?? "[]");
      return Array.isArray(lido) ? lido.filter((x): x is string => typeof x === "string").slice(0, 6) : [];
    } catch {
      return [];
    }
  });
  const lembrar = (chave: string) => {
    const lista = [chave, ...recentes.filter((x) => x !== chave)].slice(0, 6);
    setRecentes(lista);
    try {
      localStorage.setItem(BLOCOS_RECENTES, JSON.stringify(lista));
    } catch {
      // sem armazenamento, sem lembrança
    }
  };
  const opcoes: OpcaoDeBloco[] = [
    ...NO_MENU.filter((t) => upload || t !== "anexo").map((t): OpcaoDeBloco => ({ chave: t, nome: NOMES[t], sobre: SOBRE[t], selo: SELO_DO_TIPO[t], grupo: GRUPO_DO_TIPO[t], inserir: (i) => inserir(i, t) })),
    ...INTERATIVOS.map((k): OpcaoDeBloco => ({ chave: k, nome: MODELOS_INTERATIVOS[k].nome, sobre: MODELOS_INTERATIVOS[k].ajuda.split(/(?<=\.)\s/)[0], selo: VITRINE[k][0], grupo: VITRINE[k][1], inserir: (i) => inserir(i, "interativo", ["```" + k, MODELOS_INTERATIVOS[k].modelo, "```"].join("\n")) })),
  ];
  const achadas = opcoes.filter((o) => casa(`${o.nome} ${o.sobre} ${o.grupo}`));
  const botaoDeBloco = (o: OpcaoDeBloco, i: number) => (
    <button
      key={o.chave}
      type="button"
      role="menuitem"
      title={o.sobre}
      onClick={() => {
        lembrar(o.chave);
        o.inserir(i);
      }}
      className="group flex min-w-0 cursor-pointer items-start gap-2.5 border-2 border-transparent px-2 py-2 text-left hover:border-ink hover:bg-folha"
    >
      <span className="selo h-9 w-9 group-hover:border-[#c21f16]">
        <Selo nome={o.selo} className="h-6 w-6" />
      </span>
      <span className="min-w-0">
        <span className="block text-[0.82rem] font-bold leading-tight text-ink">{o.nome}</span>
        <span className="mt-0.5 block line-clamp-2 text-[0.72rem] leading-snug text-ink-soft">{o.sobre}</span>
      </span>
    </button>
  );

  const menuDeInsercao = (i: number) => (
    <div className="relative my-1 flex justify-center">
      <button type="button" onClick={() => { setMenu(menu === i ? null : i); setBusca(""); }} aria-expanded={menu === i} className="cursor-pointer border-2 border-dashed border-rule px-3 py-0.5 font-sans text-xs font-semibold text-ink-soft hover:border-[#c21f16] hover:text-prelo-texto">
        ＋ bloco
      </button>
      {menu === i && (
        <div role="menu" className="absolute top-8 z-20 max-h-[32rem] w-[44rem] max-w-[92vw] overflow-y-auto border-2 border-ink bg-parchment font-sans text-xs shadow-[6px_6px_0_var(--prelo)]">
          <div className="sticky top-0 z-10 border-b-2 border-ink bg-parchment p-2.5">
            <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setMenu(null); }} placeholder="Procurar bloco: teste, mapa, fórmula, forca…" aria-label="Procurar bloco" className="w-full border-2 border-ink bg-folha px-3 py-2 text-sm" />
          </div>
          <div className="p-2.5">
            {!busca && recentes.length > 0 && (
              <div className="mb-3">
                <p className="mb-1 font-mono text-[0.68rem] uppercase tracking-[0.16em] text-prelo-texto">Usados por último</p>
                <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                  {recentes.map((chave) => opcoes.find((o) => o.chave === chave)).filter((o): o is OpcaoDeBloco => Boolean(o)).map((o) => botaoDeBloco(o, i))}
                </div>
              </div>
            )}
            {achadas.length === 0 && <p className="p-3 text-sm text-ink-soft">Nenhum bloco com esse nome.</p>}
            {GRUPOS_DO_MENU.map((grupo) => {
              const daqui = achadas.filter((o) => o.grupo === grupo);
              return daqui.length ? (
                <div key={grupo} className="mb-3">
                  <p className="mb-1 inline-block bg-ink px-2 py-0.5 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-parchment">{grupo}</p>
                  <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">{daqui.map((o) => botaoDeBloco(o, i))}</div>
                </div>
              ) : null;
            })}
          </div>
        </div>
      )}
    </div>
  );

  function corpo(b: Bloco, i: number) {
    const tipo = tipoDe(b.md);
    switch (tipo) {
      case "paragrafo":
        return (
          <textarea
            value={b.md}
            rows={linhasDe(b.md, 3)}
            onChange={(e) => trocar(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "/" && b.md.trim() === "") {
                e.preventDefault();
                setBusca("");
                setMenu(i + 1);
                return;
              }
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                inserir(i + 1, "paragrafo");
              }
            }}
            placeholder="Escreva o parágrafo. **negrito**, *itálico* e [links](https://…) funcionam aqui. Ctrl+Enter abre outro parágrafo; / num parágrafo vazio abre os blocos."
            className={`${campo} font-serif text-base`}
          />
        );
      case "titulo":
      case "subtitulo":
        return <input value={textoPuro(b.md)} onChange={(e) => trocar(i, comMarcas(tipo, e.target.value))} placeholder={NOMES[tipo]} className={`${campo} font-serif ${tipo === "titulo" ? "text-2xl" : "text-xl"} font-semibold`} />;
      case "lista":
      case "numerada":
      case "citacao":
        return (
          <>
            <textarea value={textoPuro(b.md)} rows={linhasDe(b.md)} onChange={(e) => trocar(i, comMarcas(tipo, e.target.value))} className={`${campo} font-serif`} />
            {tipo !== "citacao" && <p className="mt-1 text-xs text-ink-soft">Um item por linha.</p>}
          </>
        );
      case "imagem": {
        const m = /^!\[([^\]]*)\]\(([^)\s]*)(?:\s+"([^"]*)")?\)$/.exec(b.md);
        const [alt, src, credito] = [m?.[1] ?? "", m?.[2] ?? "", m?.[3] ?? ""];
        const montar = (a: string, s: string, c: string) => `![${a.replace(/[[\]\n]/g, " ")}](${s}${c ? ` "${c.replace(/["\n]/g, " ")}"` : ""})`;
        const pendente = /^envio:([0-9a-f-]{36}\/[a-z0-9-]{8,60}\.(webp|jpg))$/.exec(src);
        return (
          <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
            <div className="flex min-h-24 items-center justify-center border border-dashed border-rule bg-parchment text-center text-xs text-ink-soft">
              {pendente ? <PendingImage path={pendente[1]} alt={alt} /> : /^\/(arquivos|imagens)\//.test(src) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={alt} className="max-h-40" />
              ) : "sem imagem"}
            </div>
            <div className="space-y-2">
              <label className="block text-xs">Descrição para quem não enxerga (obrigatória)<input value={alt} onChange={(e) => trocar(i, montar(e.target.value, src, credito))} className={campo} /></label>
              <label className="block text-xs">Crédito e licença<input value={credito} onChange={(e) => trocar(i, montar(alt, src, e.target.value))} placeholder="Autor, licença" className={campo} /></label>
              {upload ? (
                <label className="inline-block cursor-pointer border border-ink px-2 py-1 text-xs hover:border-oxblood">
                  {src ? "Trocar a imagem" : "Escolher a imagem"}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { void enviarImagem(i, e.target.files?.[0]); e.target.value = ""; }} />
                </label>
              ) : <p className="text-xs text-ink-soft">Imagens só podem ser enviadas por quem escreve ou diagrama.</p>}
              {!alt && src && <p className="text-xs text-oxblood">Falta a descrição.</p>}
            </div>
          </div>
        );
      }
      case "video": {
        const [url = "", ...resto] = miolo(b.md).split("\n");
        const montar = (u: string, legenda: string) => ["```video", u.trim(), ...(legenda.trim() ? [legenda.trim()] : []), "```"].join("\n");
        return (
          <div className="space-y-2">
            <label className="block text-xs">Endereço (YouTube, Vimeo ou PeerTube)<input value={url} onChange={(e) => trocar(i, montar(e.target.value, resto.join(" ")))} placeholder="https://" className={`${campo} font-mono`} /></label>
            <label className="block text-xs">Legenda (opcional)<input value={resto.join(" ")} onChange={(e) => trocar(i, montar(url, e.target.value))} className={campo} /></label>
            {url && !/^https:\/\/\S+$/.test(url.trim()) && <p className="text-xs text-oxblood">O endereço precisa começar com https://</p>}
          </div>
        );
      }
      case "formula":
      case "conta": {
        const dentro = miolo(b.md);
        const montar = (t: string) => (tipo === "formula" ? `$$\n${t}\n$$` : ["```conta", t, "```"].join("\n"));
        return (
          <div className="grid gap-2 sm:grid-cols-2">
            <textarea value={dentro} rows={linhasDe(dentro)} onChange={(e) => trocar(i, montar(e.target.value))} placeholder={tipo === "formula" ? "LaTeX, por exemplo: \\frac{a}{b}" : "A expressão e, em cada linha seguinte, um passo começando com ="} className={`${campo} font-mono text-sm`} />
            <div className="overflow-x-auto border border-rule bg-parchment p-2 font-serif"><Markdown lang="pt">{b.md}</Markdown></div>
          </div>
        );
      }
      case "questao": {
        const linhas = miolo(b.md).split("\n").map((l) => l.trim()).filter(Boolean);
        const pergunta = linhas.find((l) => !/^[-+>]/.test(l)) ?? "";
        const opcoes = linhas.filter((l) => /^[-+]\s/.test(l)).map((l) => ({ texto: l.slice(2), certa: l.startsWith("+") }));
        const dica = linhas.find((l) => l.startsWith(">"))?.slice(1).trim() ?? "";
        const montar = (p: string, o: { texto: string; certa: boolean }[], d: string) =>
          ["```verificar", p.replace(/\n/g, " "), ...o.map((x) => `${x.certa ? "+" : "-"} ${x.texto.replace(/\n/g, " ")}`), ...(d ? [`> ${d}`] : []), "```"].join("\n");
        return (
          <div className="space-y-2 text-sm">
            <input value={pergunta} onChange={(e) => trocar(i, montar(e.target.value, opcoes, dica))} placeholder="A pergunta" className={`${campo} font-medium`} />
            {opcoes.map((o, k) => (
              <div key={k} className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs"><input type="radio" name={`certa-${b.id}`} checked={o.certa} onChange={() => trocar(i, montar(pergunta, opcoes.map((x, j) => ({ ...x, certa: j === k })), dica))} /> certa</label>
                <input value={o.texto} onChange={(e) => trocar(i, montar(pergunta, opcoes.map((x, j) => (j === k ? { ...x, texto: e.target.value } : x)), dica))} className={campo} />
                <button type="button" aria-label="Tirar a opção" onClick={() => trocar(i, montar(pergunta, opcoes.filter((_, j) => j !== k), dica))} className="cursor-pointer px-1 text-ink-soft hover:text-oxblood">✕</button>
              </div>
            ))}
            <button type="button" onClick={() => trocar(i, montar(pergunta, [...opcoes, { texto: "", certa: false }], dica))} className="cursor-pointer text-xs underline">+ opção</button>
            <input value={dica} onChange={(e) => trocar(i, montar(pergunta, opcoes, e.target.value))} placeholder="Dica para quem errar (o que reler)" className={campo} />
            {opcoes.filter((o) => o.certa).length !== 1 && <p className="text-xs text-oxblood">Marque exatamente uma resposta certa.</p>}
          </div>
        );
      }
      case "codigo": {
        const lingua = /^```\s*([\w-]*)/.exec(b.md)?.[1] ?? "";
        const dentro = miolo(b.md);
        const montar = (l: string, t: string) => [`\`\`\`${l === "texto" ? "" : l}`, t, "```"].join("\n");
        return (
          <div className="space-y-2">
            <select value={lingua || "texto"} onChange={(e) => trocar(i, montar(e.target.value, dentro))} className="border border-rule bg-parchment px-2 py-1 text-xs">
              {[...new Set([...(lingua ? [lingua] : []), ...LINGUAGENS])].map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            <textarea value={dentro} rows={linhasDe(dentro, 3)} onChange={(e) => trocar(i, montar(lingua || "texto", e.target.value))} spellCheck={false} className={`${campo} font-mono text-sm`} />
            {(lingua === "python" || lingua === "php") && <p className="text-xs text-ink-soft">Na aula publicada, este código ganha o botão de testar no laboratório.</p>}
          </div>
        );
      }
      case "anexo": {
        const m = /^\[📎\s*([^\]]*)\]\(([^)\s]*)\)$/.exec(b.md);
        const [nome, alvo] = [m?.[1] ?? "", m?.[2] ?? "#"];
        return (
          <div className="flex flex-wrap items-end gap-2 text-sm">
            <label className="min-w-48 flex-1 text-xs">Nome do anexo (o que a pessoa vai baixar)<input value={nome} onChange={(e) => trocar(i, `[📎 ${e.target.value.replace(/[[\]\n]/g, " ")}](${alvo})`)} className={campo} /></label>
            {upload && (
              <label className="cursor-pointer border border-ink px-2 py-1.5 text-xs hover:border-oxblood">
                {alvo === "#" ? "Escolher o PDF" : "Trocar o PDF"}
                <input type="file" accept="application/pdf" className="sr-only" onChange={(e) => { void enviarPdf(i, e.target.files?.[0]); e.target.value = ""; }} />
              </label>
            )}
            <span className="w-full text-xs text-ink-soft">{alvo === "#" ? "Nenhum PDF escolhido (até 8 MB)." : alvo.startsWith("envio:") ? "PDF enviado, aguardando a publicação da aula." : `Publicado em ${alvo}`}</span>
          </div>
        );
      }
      case "interativo": {
        const lingua = (/^```\s*([\w-]*)/.exec(b.md)?.[1] ?? "") as TipoInterativo;
        const dentro = miolo(b.md);
        const info = eInterativo(lingua) ? MODELOS_INTERATIVOS[lingua] : null;
        const frases = lingua === "pronuncia" ? dentro.split("\n").filter((l) => l.trim() && !/^(lingua|língua|idioma)\s*:/i.test(l.trim())) : [];
        const escrever = (texto: string) => trocar(i, ["```" + lingua, texto, "```"].join("\n"));
        const formulario = eInterativo(lingua) && !avancado.has(b.id) ? <FormularioDoBloco key={`${b.id}-f`} tipo={lingua} spec={dentro} mudar={escrever} /> : null;
        return (
          <div className="space-y-2">
            <div className="grid gap-2 lg:grid-cols-2">
              <div className="min-w-0">
                {formulario ?? <textarea value={dentro} rows={linhasDe(dentro, 5)} onChange={(e) => escrever(e.target.value)} spellCheck={false} aria-label={`Dados do bloco ${info?.nome ?? lingua}`} className={`${campo} font-mono text-sm`} />}
                {eInterativo(lingua) && (formulario || avancado.has(b.id)) && (
                  <button type="button" onClick={() => setAvancado((a) => { const n = new Set(a); if (n.has(b.id)) n.delete(b.id); else n.add(b.id); return n; })} className="mt-2 cursor-pointer text-xs text-ink-soft underline">
                    {avancado.has(b.id) ? "← Voltar ao formulário" : "Modo avançado (editar como texto)"}
                  </button>
                )}
              </div>
              <div className="min-w-0 border border-rule bg-parchment p-2">
                <p className="text-xs text-ink-soft">Prévia (funciona como na aula)</p>
                {eInterativo(lingua) && <Interativo key={dentro} tipo={lingua} spec={dentro} />}
              </div>
            </div>
            {info && (!formulario || !eInterativo(lingua)) && <p className="text-xs text-ink-soft">{info.ajuda}</p>}
            {upload && frases.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs">
                {frases.map((f, k) => (
                  <button key={k} type="button" onClick={() => void gravar(i, k)} disabled={Boolean(gravando) && !(gravando?.bloco === i && gravando.linha === k)} className="cursor-pointer border border-ink px-2 py-1 hover:border-oxblood disabled:opacity-40">
                    {gravando?.bloco === i && gravando.linha === k ? "■ Parar" : `🎙 Gravar: ${f.split("|")[0].trim().slice(0, 24)}`}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      }
      default:
        return <textarea value={b.md} rows={linhasDe(b.md, 3)} onChange={(e) => trocar(i, e.target.value)} spellCheck={false} className={`${campo} font-mono text-sm`} />;
    }
  }

  return (
    <div className="border-2 border-ink bg-parchment-deep p-3 font-sans">
      <p className="mb-2 text-xs text-ink-soft">Cada caixa é um bloco da aula. Arraste pela alça ⋮⋮ ou use ↑ ↓ para mudar a ordem. O texto continua sendo Markdown: dá para voltar ao modo texto quando quiser.</p>
      {menuDeInsercao(0)}
      {blocos.map((b, i) => {
        const tipo = tipoDe(b.md);
        return (
          <div key={b.id}>
            <section
              data-bloco={i}
              aria-label={`${nomeDoBloco(b.md, tipo)} (${i + 1} de ${blocos.length})`}
              onDragOver={(e) => { if (arrastando.current !== null) e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); if (arrastando.current !== null) mover(arrastando.current, i); arrastando.current = null; }}
              className="border border-rule bg-parchment-deep p-2 focus-within:border-ink"
            >
              <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs">
                <span draggable onDragStart={() => { arrastando.current = i; }} onDragEnd={() => { arrastando.current = null; }} title="Arrastar" className="cursor-grab select-none px-1 text-ink-soft" aria-hidden>⋮⋮</span>
                {DE_TEXTO.includes(tipo) ? (
                  <select value={tipo} aria-label="Tipo do bloco" onChange={(e) => trocar(i, comMarcas(e.target.value as Tipo, textoPuro(b.md)))} className="border border-rule bg-parchment px-1 py-0.5">
                    {DE_TEXTO.map((t) => <option key={t} value={t}>{NOMES[t]}</option>)}
                  </select>
                ) : (
                  <span className="font-mono uppercase tracking-wider text-gold">{nomeDoBloco(b.md, tipo)}</span>
                )}
                <span className="ml-auto flex gap-1">
                  <button type="button" aria-label="Subir o bloco" disabled={i === 0} onClick={() => mover(i, i - 1)} className="cursor-pointer border border-rule px-1.5 disabled:opacity-30">↑</button>
                  <button type="button" aria-label="Descer o bloco" disabled={i === blocos.length - 1} onClick={() => mover(i, i + 1)} className="cursor-pointer border border-rule px-1.5 disabled:opacity-30">↓</button>
                  <button type="button" aria-label="Duplicar o bloco" onClick={() => { const n = [...blocos]; n.splice(i + 1, 0, { id: novoId(), md: b.md }); mudar(n); }} className="cursor-pointer border border-rule px-1.5">⧉</button>
                  <button type="button" aria-label="Apagar o bloco" onClick={() => mudar(blocos.filter((_, j) => j !== i))} className="cursor-pointer border border-rule px-1.5 hover:border-oxblood hover:text-oxblood">✕</button>
                </span>
              </div>
              {corpo(b, i)}
            </section>
            {menuDeInsercao(i + 1)}
          </div>
        );
      })}
      {blocos.length === 0 && <p className="py-6 text-center text-sm text-ink-soft">A aula ainda está vazia. Comece com ＋ bloco.</p>}
      <p role="status" className="mt-1 min-h-5 text-xs text-oxblood">{aviso}</p>
    </div>
  );
}

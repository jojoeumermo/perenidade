// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { areaSlugs, licenses } from "@/lib/areas";
import { sendFile, UploadError, uploadMessages } from "@/lib/upload";
import { can, cuidaDeTudo, disciplinasQueEnsina, escreveEm, type Me, rpc } from "@/lib/backend";
import { horaDoRascunho, useRascunho } from "@/lib/rascunho";
import { getItem, parse, setItem } from "@/lib/storage";
import tipos from "@/lib/tipos.json";
import { cleanSources, MarkdownEditor, SourcesField, type EditorLabels, type SourceDraft, type SourceLabels } from "../Editor";
import { useI18n } from "../I18n";
import { Markdown } from "../Markdown";
import { useTrackOptions } from "../useTrackOptions";
import { BuscaDePessoa, type PessoaAchada } from "./BuscaDePessoa";
import { Aviso, campo, elo, localDoPainel, papeis, useAcao, useLista } from "./comum";
import type { Membro } from "./Equipe";
import { FerramentasDoAutor } from "./FerramentasDoAutor";
import { GuiaDaAula } from "./GuiaDaAula";
import { EditorDePratica } from "./Pratica";

type TipoId = keyof typeof tipos;
interface Campo {
  nome: string;
  rotulo: string;
  tipo: string;
  obrigatorio?: boolean;
  max?: number;
  opcoes?: string[];
}
interface Tipo {
  rotulo: string;
  ajuda: string;
  titulo: string;
  papel?: string;
  disciplina: string;
  fonte: boolean;
  corpo: { rotulo: string; min: number; editor: boolean };
  campos: Campo[];
}

export const editorPt: EditorLabels = {
  bold: "Negrito",
  italic: "Itálico",
  heading: "Título de seção",
  subheading: "Subtítulo",
  quote: "Citação",
  list: "Lista",
  numbered: "Lista numerada",
  link: "Link",
  linkPrompt: "Endereço do link:",
  preview: "Pré-visualizar",
  write: "Voltar a escrever",
  empty: "*Nada para mostrar ainda.*",
  video: "Vídeo (endereço do YouTube, Vimeo ou PeerTube)",
  videoPrompt: "Endereço do vídeo (https://…). O vídeo fica onde está; a aula só aponta para ele.",
  math: "Conta passo a passo",
  image: "Imagem",
  imageAlt: "Descreva a imagem para quem não enxerga (o que aparece nela):",
  imageCredit: "Crédito e licença (autor, ano, de onde veio). Só envie imagem sua, em domínio público ou com licença livre:",
  sending: "Limpando os dados embutidos e enviando a imagem…",
  check: "Conferir ortografia e gramática",
  checking: "Conferindo…",
  checkNone: "Nenhum apontamento.",
  checkLive: "Conferir enquanto escrevo",
  checkNote: "O texto vai ao conferidor do instituto (LanguageTool, de código aberto) ao apertar o botão ou, se você ligar, alguns segundos depois de parar de digitar. Os apontamentos ficam sublinhados no texto.",
  checkFailed: "A conferência não respondeu. Tente de novo em um minuto.",
  checkStale: "O texto mudou: confira de novo.",
};

export const fontesPt: SourceLabels = {
  title: "Fontes",
  hint: "De onde vêm as informações: livro, artigo, documento, site confiável. Pelo menos uma.",
  name: "Título da obra ou da página",
  author: "Autor",
  url: "Link (se houver)",
  add: "Adicionar fonte",
  remove: "Remover fonte",
};

/** Uma questão do "Teste o que você aprendeu" que fecha a aula. */
export interface Questao {
  pergunta: string;
  opcoes: string[];
  resposta: number;
  explicacao: string;
}

const questaoVazia = (): Questao => ({ pergunta: "", opcoes: ["", "", ""], resposta: 0, explicacao: "" });
/** Questões prontas para enviar: só as que têm pergunta e pelo menos duas alternativas preenchidas. */
export function limparQuestoes(lista: Questao[]): Questao[] {
  return lista
    .map((q) => ({ pergunta: q.pergunta.trim(), opcoes: q.opcoes.map((o) => o.trim()), resposta: q.resposta, explicacao: q.explicacao.trim() }))
    .filter((q) => q.pergunta && q.opcoes.filter(Boolean).length >= 2 && q.opcoes[q.resposta]?.trim())
    .map((q) => {
      const cheias = q.opcoes.map((o, i) => [o, i] as const).filter(([o]) => o);
      return { ...q, opcoes: cheias.map(([o]) => o), resposta: cheias.findIndex(([, i]) => i === q.resposta) };
    });
}

/** Editor das questões de fim de aula: pergunta, alternativas (a certa marcada) e a explicação. */
export function QuestoesEditor({ valor, mudar }: { valor: Questao[]; mudar: (lista: Questao[]) => void }) {
  const trocar = (i: number, q: Partial<Questao>) => mudar(valor.map((item, j) => (j === i ? { ...item, ...q } : item)));
  return (
    <fieldset className="border border-rule bg-parchment-deep p-4">
      <legend className="px-1 font-semibold">Teste o que você aprendeu (opcional)</legend>
      <p className="text-ink-soft">De três a cinco questões de múltipla escolha. Entram no fim da aula e na prova da trilha. Marque a alternativa certa e explique por quê.</p>
      <ol className="mt-3 space-y-4">
        {valor.map((q, i) => (
          <li key={i} className="border-l-2 border-gold pl-3">
            <label className="block">
              Questão {i + 1}
              <input value={q.pergunta} onChange={(e) => trocar(i, { pergunta: e.target.value })} maxLength={300} className={campo} />
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {q.opcoes.map((opcao, j) => (
                <label key={j} className="flex items-center gap-2">
                  <input type="radio" name={`certa-${i}`} checked={q.resposta === j} onChange={() => trocar(i, { resposta: j })} aria-label={`Alternativa ${j + 1} é a certa`} />
                  <input value={opcao} onChange={(e) => trocar(i, { opcoes: q.opcoes.map((o, k) => (k === j ? e.target.value : o)) })} maxLength={300} placeholder={`Alternativa ${j + 1}`} aria-label={`Alternativa ${j + 1}`} className={`${campo} mt-0`} />
                </label>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              {q.opcoes.length < 6 && <button type="button" className={elo} onClick={() => trocar(i, { opcoes: [...q.opcoes, ""] })}>+ alternativa</button>}
              {q.opcoes.length > 2 && <button type="button" className={elo} onClick={() => trocar(i, { opcoes: q.opcoes.slice(0, -1), resposta: Math.min(q.resposta, q.opcoes.length - 2) })}>− alternativa</button>}
              <button type="button" className={`${elo} text-oxblood`} onClick={() => mudar(valor.filter((_, j) => j !== i))}>Remover a questão</button>
            </div>
            <label className="mt-2 block">
              Explicação (aparece depois de responder)
              <input value={q.explicacao} onChange={(e) => trocar(i, { explicacao: e.target.value })} maxLength={500} className={campo} />
            </label>
          </li>
        ))}
      </ol>
      {valor.length < 10 && (
        <button type="button" className={`mt-3 ${elo}`} onClick={() => mudar([...valor, questaoVazia()])}>
          + {valor.length === 0 ? "Adicionar a primeira questão" : "Adicionar questão"}
        </button>
      )}
    </fieldset>
  );
}

interface Rascunho {
  titulo: string;
  corpo: string;
  disciplina: string;
  valores: Record<string, string>;
  fontes: SourceDraft[];
  questoes: Questao[];
}

/** Cada tipo em cartão: ícone, nome curto e para que serve. */
const CARTOES_DE_TIPO: Partial<Record<TipoId, [string, string, string]>> = {
  aula: ["📖", "Aula de uma trilha", "Texto com blocos, jogos e testes, numa trilha da sua disciplina."],
  avulso: ["📎", "Material avulso", "Resumo, lista de exercícios, roteiro ou um PDF pronto, fora das trilhas."],
  temas: ["🗺️", "Próximas aulas", "Os temas que faltam numa trilha."],
  video: ["🎬", "Vídeo indicado", "Um vídeo bom de outro lugar, com o porquê."],
  pratica: ["🗣️", "Prática de idioma", "Exercícios curtos e lúdicos para uma aula de língua."],
  verbete: ["🔤", "Verbete do glossário", "Uma palavra explicada em linguagem simples."],
  checagem: ["✔️", "Checagem de fato", "O que é verdade e o que não é, com fonte."],
  debate: ["💬", "Resposta para debate", "Como responder a um argumento comum."],
  frase: ["❝", "Frase da página inicial", "Uma citação com autoria e fonte."],
  memorial: ["🕯️", "Nome para o Memorial", "Alguém da luta do povo para lembrar."],
  sugestao: ["💡", "Sugestão", "Uma ideia para o site ou para uma disciplina."],
  artigo: ["📰", "Matéria para o jornal", "Texto jornalístico (jornalismo)."],
  obra: ["📚", "Obra para o acervo", "A ficha de um livro (curadoria)."],
  traducao: ["🌍", "Tradução", "Uma aula em outro idioma."],
};
const GRUPOS_DE_TIPOS: [string, TipoId[]][] = [
  ["Para a sua disciplina", ["aula", "avulso", "temas", "video", "pratica"] as TipoId[]],
  ["Para o site", ["verbete", "checagem", "debate", "frase", "memorial", "sugestao"] as TipoId[]],
  ["Jornal, acervo e traduções", ["artigo", "obra", "traducao"] as TipoId[]],
];

const rotuloPequeno = "block font-mono text-[0.7rem] uppercase tracking-widest text-ink-soft";
const campoFino = "mt-1 w-full border border-rule bg-parchment px-3 py-2";
const semFontes = (fontes: SourceDraft[]) => fontes.every((f) => !f.titulo.trim() && !f.autor.trim() && !f.url.trim());

/** Formulário único para tudo o que entra no site. O que muda de um tipo para outro são os campos. */
export function Escrever({ me }: { me: Me }) {
  const { lang, t } = useI18n();
  const tracks = useTrackOptions(lang);
  const disponiveis = (Object.keys(tipos) as TipoId[]).filter((id) => {
    const tipo = tipos[id] as Tipo;
    return !tipo.papel || can(me, "coordenacao") || can(me, tipo.papel as "jornalismo");
  });
  // ?tipo=obra (o atalho "Adicionar uma obra" do Acervo por dentro) abre direto no formulário daquele tipo.
  const pedido = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("tipo");
  const [id, setId] = useState<TipoId>(() => (pedido && (disponiveis as string[]).includes(pedido) ? (pedido as TipoId) : disponiveis[0]));
  // Os tipos aparecem em cartões no alto; depois de escolher, fica só uma faixa com "Trocar o tipo".
  const [escolhendo, setEscolhendo] = useState(() => !(pedido && (disponiveis as string[]).includes(pedido)));
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [disciplina, setDisciplina] = useState("");
  const [valores, setValores] = useState<Record<string, string>>({});
  const [fontes, setFontes] = useState<SourceDraft[]>([{ titulo: "", autor: "", url: "" }]);
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [colegas, setColegas] = useState<PessoaAchada[]>([]);
  const { agir, aviso, setAviso, ocupado } = useAcao();
  const [detalhes, setDetalhes] = useState(false);
  const [lado, setLado] = useState(false);
  const [foco, setFoco] = useState(false);
  const [faixaDispensada, setFaixaDispensada] = useState(false);
  const palavras = corpo.split(/\s+/).filter(Boolean).length;
  // Modo foco: some o menu do painel e o guia, fica só a folha. Ctrl+Shift+F liga e desliga; Esc sai.
  useEffect(() => {
    document.documentElement.dataset.escritaFoco = foco ? "1" : "";
    return () => {
      document.documentElement.dataset.escritaFoco = "";
    };
  }, [foco]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setFoco((f) => !f);
      } else if (e.key === "Escape") setFoco(false);
    };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, []);
  const membros = useLista<Membro[]>("equipe_membros", {}, { quieta: true });

  // O rascunho: no navegador e no banco, um por tipo de contribuição. Fechou, atualizou, trocou de aparelho: volta.
  const estado: Rascunho = { titulo, corpo, disciplina, valores, fontes, questoes };
  const rascunho = useRascunho<Rascunho>(
    `escrever:${id}`,
    estado,
    (dados) => {
      setTitulo(dados.titulo ?? "");
      setCorpo(dados.corpo ?? "");
      setDisciplina(dados.disciplina ?? "");
      setValores(dados.valores ?? {});
      setFontes(dados.fontes?.length ? dados.fontes : [{ titulo: "", autor: "", url: "" }]);
      setQuestoes(dados.questoes ?? []);
    },
    { ativo: id !== "pratica", vazio: (d) => !d.titulo.trim() && !d.corpo.trim() && semFontes(d.fontes) && d.questoes.length === 0 && Object.values(d.valores).every((v) => !v) },
  );

  const tipo = tipos[id] as Tipo;
  // Cada educador escreve para a própria disciplina; para outra, só com o convite de quem ensina lá (o banco confere
  // de novo). A lista de disciplinas e trilhas já vem só com as permitidas, para ninguém perder trabalho.
  const restrito = id === "aula" || id === "avulso" || id === "temas" || id === "video";
  const trilhaPermitida = (track: (typeof tracks)[number]) =>
    !restrito || cuidaDeTudo(me) || disciplinasQueEnsina(me).includes(track.area) || Boolean(me.convites?.some((c) => c.disciplina === track.area && (!c.trilha || c.trilha === track.slug)));
  const tracksPermitidas = tracks.filter(trilhaPermitida);
  const areasPermitidas = areaSlugs.filter((area) => !restrito || escreveEm(me, area));
  const trilha = tracksPermitidas.find((track) => track.slug === valores.trilha) ?? tracksPermitidas[0];
  // A trilha se escolhe em dois passos: primeiro a disciplina, depois a trilha dela (a lista inteira era grande demais).
  const [areaDaTrilha, setAreaDaTrilha] = useState("");
  const areaEscolhida = areaDaTrilha || trilha?.area || "";
  // Trocar de trilha zera o tema do roteiro e a "nova versão"; o título só é apagado se veio do roteiro da trilha anterior.
  const trocarTrilha = (nova: string) => {
    const veioDoRoteiro = Boolean(trilha?.plan?.some((item) => item.title === titulo.trim()));
    setValores((antes) => {
      const resto = { ...antes };
      delete resto.substitui;
      return { ...resto, trilha: nova, slug: "" };
    });
    if (veioDoRoteiro) setTitulo("");
  };
  const mudar = (nome: string, valor: string) => setValores((antes) => ({ ...antes, [nome]: valor }));

  // Educadores só publicam nas disciplinas que lhes foram confiadas; o aviso evita trabalho perdido.
  const minhas = me.papeis.filter((p) => p.papel === "educacao" || p.papel === "educacao_secundaria").map((p) => p.disciplina);
  const alvo = tipo.disciplina === "trilha" ? trilha?.area : disciplina;
  const nomeDaArea = (slug?: string | null) => (slug ? (t.areas[slug as keyof typeof t.areas]?.[0] ?? slug) : "");
  const comQuestoes = id === "aula" || id === "avulso";
  // Quem dá aula pode chamar colegas: educadores, educadores secundários e mentores (não a própria pessoa).
  const ensina = (membro: Membro) => membro.papeis.some((p) => ["educacao", "educacao_secundaria", "mentoria"].includes(p.papel));
  const funcoesDe = (membro: Membro) => [...new Set(membro.papeis.map((p) => `${papeis[p.papel]}${p.disciplina ? ` de ${nomeDaArea(p.disciplina)}` : ""}`))].join(", ");
  const candidatos = (membros.dados ?? []).filter((m) => !m.eu && ensina(m) && !colegas.some((c) => c.id === m.id)).map((m) => ({ id: m.id, nome: m.nome, email: funcoesDe(m) }));

  /** Carrega o texto de uma aula publicada para escrever a nova versão (só de quem assinou, salvo a liderança e a revisão). */
  async function carregarPublicada(trilhaSlug: string, slug: string) {
    setAviso("");
    try {
      const resposta = await fetch(`/${lang}/trilhas/${trilhaSlug}/${slug}/texto`);
      if (!resposta.ok) throw new Error("texto");
      const linhas = (await resposta.text()).split("\n");
      const fim = linhas.lastIndexOf("---");
      const assinatura = linhas[fim + 1] ?? "";
      const minha = assinatura.includes(me.nome) || can(me, "coordenacao", "supervisao", "revisao");
      if (!minha) return setAviso(`Esta aula é assinada por ${assinatura.split(" · ")[0]}. Peça a essa pessoa, pelas Conversas, que faça a edição ou chame você para trabalhar junto.`);
      setTitulo(linhas[0] ?? "");
      setCorpo(linhas.slice(5, fim).join("\n").trim());
      setValores((antes) => ({ ...antes, trilha: trilhaSlug, slug, resumo: linhas[3] ?? "", substitui: slug }));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setAviso("Não deu para carregar o texto da aula agora.");
    }
  }

  async function enviar() {
    for (const c of tipo.campos) {
      if (c.tipo !== "trilha" && c.obrigatorio && !(valores[c.nome] ?? "").trim()) return setAviso(`Preencha: ${c.rotulo}.`);
    }
    if (titulo.trim().length < 3) return setAviso(`Preencha: ${tipo.titulo}.`);
    if (corpo.trim().length < tipo.corpo.min) return setAviso(`${tipo.corpo.rotulo}: escreva pelo menos ${tipo.corpo.min} caracteres.`);
    if (tipo.disciplina === "obrigatoria" && !disciplina) return setAviso("Escolha a disciplina.");
    const lista = cleanSources(fontes);
    if (tipo.fonte && lista.length === 0) return setAviso("Cite pelo menos uma fonte.");

    const { alvo: caminho, ...dados } = Object.fromEntries(tipo.campos.map((c) => [c.nome, c.tipo === "trilha" ? (trilha?.slug ?? "") : (valores[c.nome] ?? "").trim()]));
    const prontas = comQuestoes ? limparQuestoes(questoes) : [];
    const resposta = (await agir(
      "contribuir",
      { p: { tipo: id, titulo, corpo, disciplina: alvo || null, dados: { ...dados, ...(prontas.length > 0 ? { quiz: prontas } : {}), ...(valores.substitui ? { substitui: valores.substitui } : {}) }, fontes: lista, alvo: caminho ?? null } },
      "Recebido. Sua contribuição entrou na fila de revisão.",
    )) as { id?: string } | null;
    if (resposta?.id) {
      // Os colegas chamados ganham acesso para editar esta contribuição enquanto ela espera a revisão.
      const chamados: string[] = [];
      for (const colega of colegas) {
        try {
          await rpc("colaboracao_abrir", { p_id: resposta.id, p_usuario: colega.id });
          chamados.push(colega.nome);
        } catch {
          // Se não deu (limite, conta suspensa), a contribuição segue; a pessoa pode chamar de novo em Meus envios.
        }
      }
      if (chamados.length > 0) setAviso(chamados.length === 1 ? `Recebido. Sua contribuição entrou na fila de revisão, e ${chamados[0]} já recebeu o recado para trabalhar junto.` : `Recebido. Sua contribuição entrou na fila de revisão, e ${chamados.join(", ")} já receberam o recado para trabalhar junto.`);
      setTitulo("");
      setCorpo("");
      setFontes([{ titulo: "", autor: "", url: "" }]);
      setQuestoes([]);
      setColegas([]);
      setValores({ trilha: valores.trilha });
      rascunho.limpar();
    }
  }

  function campoDe(c: Campo) {
    const valor = valores[c.nome] ?? "";
    if (c.tipo === "trilha") {
      const daArea = tracksPermitidas.filter((track) => track.area === areaEscolhida);
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {valores.substitui && (
            <p className="border-l-4 border-oxblood bg-parchment-deep px-3 py-2 sm:col-span-2">
              Você está escrevendo a <strong>nova versão</strong> da aula publicada “{valores.substitui}”. Ela passa pela revisão como uma aula nova e, aprovada, substitui a atual.{" "}
              <button type="button" className={elo} onClick={() => { setValores((antes) => { const resto = { ...antes }; delete resto.substitui; return resto; }); setTitulo(""); setCorpo(""); }}>Desistir</button>
            </p>
          )}
          <select
            aria-label="Disciplina da trilha"
            value={areaEscolhida}
            onChange={(e) => {
              setAreaDaTrilha(e.target.value);
              const primeira = tracksPermitidas.find((track) => track.area === e.target.value);
              trocarTrilha(primeira?.slug ?? "");
            }}
            className={campoFino}
          >
            {areaSlugs.filter((area) => tracksPermitidas.some((track) => track.area === area)).map((area) => (
              <option key={area} value={area}>{t.areas[area][0]}</option>
            ))}
          </select>
          <select aria-label="Trilha" value={trilha?.slug ?? ""} onChange={(e) => trocarTrilha(e.target.value)} className={campoFino}>
            {daArea.map((track) => (
              <option key={track.slug} value={track.slug}>
                {track.title}{track.stage ? ` · ${track.stage === "medio" ? "médio" : track.stage === "superior" ? "superior" : "fundamental"}` : ""}
              </option>
            ))}
          </select>
          {id === "aula" && !valores.substitui && (trilha?.lessons?.length ?? 0) > 0 && (
            <details className="sm:col-span-2">
              <summary className="cursor-pointer text-sm underline hover:text-oxblood">Editar uma aula já publicada desta trilha</summary>
              <p className="mt-1 text-xs text-ink-soft">Só as suas: aula de outro educador, peça a ele pelas Conversas. A nova versão passa pela revisão antes de substituir a atual.</p>
              <ul className="mt-2 space-y-1 text-sm">
                {trilha!.lessons!.map((l) => (
                  <li key={l.slug}>
                    <button type="button" className={elo} onClick={() => void carregarPublicada(trilha!.slug, l.slug)}>{l.title}</button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      );
    }
    if (c.tipo === "plano") {
      return (
        <select
          value={valor}
          onChange={(e) => {
            mudar("slug", e.target.value);
            const escolhida = trilha?.planned.find((item) => item.slug === e.target.value);
            if (escolhida) setTitulo(escolhida.title);
          }}
          className={campoFino}
        >
          <option value="">Outro tema (entra no fim da trilha)</option>
          {trilha?.planned.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.title}
            </option>
          ))}
        </select>
      );
    }
    if (c.tipo === "licenca" || c.tipo === "select") {
      const opcoes = c.tipo === "licenca" ? [...licenses] : (c.opcoes ?? []);
      return (
        <select value={valor} onChange={(e) => mudar(c.nome, e.target.value)} className={campoFino}>
          <option value="">Escolha…</option>
          {opcoes.map((opcao) => (
            <option key={opcao} value={opcao}>{opcao}</option>
          ))}
        </select>
      );
    }
    if (c.tipo === "longo") return <textarea value={valor} onChange={(e) => mudar(c.nome, e.target.value)} maxLength={c.max} rows={4} className={campoFino} />;
    return (
      <input
        value={valor}
        onChange={(e) => mudar(c.nome, e.target.value)}
        maxLength={c.max ?? 300}
        type={c.tipo === "url" ? "url" : "text"}
        placeholder={c.tipo === "url" ? "https://…" : c.tipo === "caminho" ? "/trilhas/…" : ""}
        className={`${campoFino} ${c.tipo === "url" || c.tipo === "caminho" ? "font-mono" : ""}`}
      />
    );
  }

  const seletor = (
    <section aria-label="O que você quer publicar" className="font-sans">
      {escolhendo ? (
        <div className="space-y-4">
          <p className="font-serif text-2xl font-semibold">O que você quer publicar hoje?</p>
          {GRUPOS_DE_TIPOS.map(([grupo, ids]) => {
            const daqui = ids.filter((tipoId) => disponiveis.includes(tipoId));
            if (!daqui.length) return null;
            return (
              <div key={grupo}>
                <p className={rotuloPequeno}>{grupo}</p>
                <div className="mt-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {daqui.map((tipoId) => {
                    const [icone, curto, sobre] = CARTOES_DE_TIPO[tipoId] ?? ["📝", (tipos[tipoId] as Tipo).rotulo, ""];
                    return (
                      <button key={tipoId} type="button" aria-pressed={id === tipoId} onClick={() => { setId(tipoId); setEscolhendo(false); }} className={`flex cursor-pointer items-start gap-3 border-2 p-3 text-left hover:border-oxblood ${id === tipoId ? "border-oxblood bg-parchment-deep" : "border-ink/20 bg-parchment"}`}>
                        <span aria-hidden className="text-3xl leading-none">{icone}</span>
                        <span><span className="block font-bold">{curto}</span><span className="block text-xs text-ink-soft">{sobre}</span></span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="flex flex-wrap items-center gap-3 border-2 border-ink bg-parchment-deep px-3 py-2">
          <span aria-hidden className="text-2xl">{CARTOES_DE_TIPO[id]?.[0] ?? "📝"}</span>
          <span><span className={rotuloPequeno}>Você está escrevendo</span><span className="font-bold">{CARTOES_DE_TIPO[id]?.[1] ?? tipo.rotulo}</span></span>
          <button type="button" className={`${elo} ml-auto text-sm`} onClick={() => setEscolhendo(true)}>Trocar o tipo</button>
        </p>
      )}
    </section>
  );

  if (id === "pratica") {
    return (
      <div className="space-y-5">
        {seletor}
        <p className="border-l-2 border-gold pl-4 text-ink-soft">{tipo.ajuda}</p>
        <EditorDePratica me={me} />
      </div>
    );
  }

  // As etapas: o que já está pronto para mandar, na ordem em que a pessoa trabalha.
  const resumo = tipo.campos.find((c) => c.nome === "resumo");
  const outrosCampos = tipo.campos.filter((c) => c.tipo !== "trilha" && c.tipo !== "plano" && c.nome !== "resumo");
  const okTrilha = tipo.disciplina === "trilha" ? Boolean(trilha) : tipo.disciplina === "obrigatoria" ? Boolean(disciplina) : true;
  const okTexto = titulo.trim().length >= 3 && corpo.trim().length >= tipo.corpo.min;
  const okRevisar = okTexto && tipo.campos.every((c) => c.tipo === "trilha" || !c.obrigatorio || (valores[c.nome] ?? "").trim()) && (!tipo.fonte || cleanSources(fontes).length > 0);
  const etapas: [string, boolean][] = [["Tipo", true], [tipo.disciplina === "trilha" ? "Trilha" : "Disciplina", okTrilha], ["Escrever", okTexto], ["Revisar", okRevisar], ["Enviar", false]];
  const atual = etapas.findIndex(([, ok]) => !ok);
  const aulaDoRoteiro = id === "aula" ? (valores.slug ? (trilha?.planned.find((item) => item.slug === valores.slug)?.title ?? trilha?.lessons?.find((l) => l.slug === valores.slug)?.title ?? valores.slug) : "Outro tema") : "";
  const faixa = [tipo.rotulo, tipo.disciplina === "trilha" ? trilha?.title : nomeDaArea(disciplina), aulaDoRoteiro].filter(Boolean).join(" · ");
  const detalhesVisiveis = detalhes || !okTrilha;

  const formulario = (
    <form className="space-y-5 pb-4" onSubmit={(e) => e.preventDefault()}>
      {seletor}
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs" aria-label="Etapas">
        {etapas.map(([nome, ok], i) => (
          <li key={nome} className="flex items-center gap-2" aria-current={i === atual ? "step" : undefined}>
            {i > 0 && <span aria-hidden className="text-ink-soft">→</span>}
            <span className={ok ? "text-ok" : i === atual ? "font-semibold text-oxblood" : "text-ink-soft"}>{ok ? "✓ " : ""}{nome}</span>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-rule py-2">
        <button type="button" onClick={() => setDetalhes((d) => !d)} aria-expanded={detalhesVisiveis} className="cursor-pointer text-left hover:text-oxblood">
          <span className={rotuloPequeno}>Detalhes</span> <span className="font-medium">{faixa}</span> <span aria-hidden className="text-ink-soft">{detalhesVisiveis ? "▴" : "▾"}</span>
        </button>
        <span className="flex items-center gap-3 font-mono text-xs text-ink-soft">
          <span role="status">{rascunho.salvoEm ? `Salvo às ${horaDoRascunho(rascunho.salvoEm)}` : "Rascunho guardado sozinho"}</span>
          <Versoes chave={`escrever:${id}`} titulo={titulo} corpo={corpo} restaurar={(v) => { setTitulo(v.titulo); setCorpo(v.corpo); }} />
        </span>
      </div>

      {rascunho.restaurado && rascunho.salvoEm && !faixaDispensada && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-soft">
          <span>Recuperamos o rascunho guardado às {horaDoRascunho(rascunho.salvoEm)}.</span>
          <button type="button" className={elo} onClick={() => { setTitulo(""); setCorpo(""); setFontes([{ titulo: "", autor: "", url: "" }]); setQuestoes([]); setValores({ trilha: valores.trilha }); rascunho.limpar(); }}>
            Descartar e começar do zero
          </button>
          <button type="button" className={elo} aria-label="Fechar o aviso" onClick={() => setFaixaDispensada(true)}>✕</button>
        </p>
      )}

      {detalhesVisiveis && (
        <div className="space-y-4 border border-rule bg-parchment-deep p-4">
          <p className="border-l-2 border-gold pl-3 text-sm text-ink-soft">{tipo.ajuda}</p>
          {tipo.campos
            .filter((c) => c.tipo === "trilha" || c.tipo === "plano")
            .map((c) => (
              <label key={c.nome} className="block">
                <span className={rotuloPequeno}>{c.rotulo}</span>
                {campoDe(c)}
              </label>
            ))}
          {id === "temas" && trilha && (
            <div className="border-l-2 border-rule pl-4">
              <p>
                Roteiro atual: <strong>{trilha.ready}</strong> {trilha.ready === 1 ? "aula pronta" : "aulas prontas"} de <strong>{trilha.ready + trilha.planned.length}</strong>.
                {trilha.planned.length === 0 ? " A trilha está completa: os temas aprovados abrem a próxima etapa." : " Ainda em preparação:"}
              </p>
              {trilha.planned.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-ink-soft">
                  {trilha.planned.map((item) => (
                    <li key={item.slug}>{item.title}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {(tipo.disciplina === "obrigatoria" || tipo.disciplina === "opcional") && (
            <label className="block">
              <span className={rotuloPequeno}>Disciplina{tipo.disciplina === "opcional" ? " (opcional)" : ""}</span>
              <select value={disciplina} onChange={(e) => setDisciplina(e.target.value)} className={campoFino}>
                <option value="">Escolha…</option>
                {areasPermitidas.map((area) => (
                  <option key={area} value={area}>
                    {t.areas[area][0]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {okTrilha && <button type="button" className={elo} onClick={() => setDetalhes(false)}>Fechar os detalhes e escrever</button>}
        </div>
      )}
      {restrito && areasPermitidas.length === 0 && (
        <p className="border-l-4 border-oxblood bg-parchment-deep px-3 py-2 text-sm">
          Você ainda não tem disciplina para escrever. Quem ensina uma disciplina (ou a coordenação) pode convidar você para ajudar nela, em Disciplinas e trilhas › Convites.
        </p>
      )}
      {restrito && minhas.length > 0 && areasPermitidas.some((area) => !minhas.includes(area)) && !cuidaDeTudo(me) && (
        <p className="text-xs text-ink-soft">Além das suas disciplinas, aparecem as que você foi convidado a ajudar.</p>
      )}

      <div className={lado ? "grid gap-6 2xl:grid-cols-2" : ""}>
        <div className="folha-de-escrita mx-auto w-full max-w-[680px] border border-rule bg-parchment px-5 py-7 shadow-sm sm:px-8">
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            maxLength={160}
            aria-label={tipo.titulo}
            placeholder={tipo.titulo}
            className="w-full border-b border-transparent bg-transparent font-serif text-3xl font-semibold leading-tight outline-none placeholder:text-ink-soft/50 focus:border-rule sm:text-4xl"
          />
          {resumo && (
            <input
              value={valores.resumo ?? ""}
              onChange={(e) => mudar("resumo", e.target.value)}
              maxLength={resumo.max ?? 200}
              aria-label={resumo.rotulo}
              placeholder={resumo.rotulo}
              className="mt-2 w-full border-b border-transparent bg-transparent font-serif text-lg italic text-ink-soft outline-none placeholder:text-ink-soft/50 focus:border-rule"
            />
          )}
          {outrosCampos.length > 0 && (
            <div className="mt-5 space-y-3 font-sans text-sm">
              {outrosCampos.map((c) => (
                <label key={c.nome} className="block">
                  <span className={rotuloPequeno}>{c.rotulo}</span>
                  {campoDe(c)}
                </label>
              ))}
            </div>
          )}
          {id === "avulso" && (
            <div className="mt-5 border-2 border-dashed border-ink/40 bg-parchment-deep p-3 font-sans text-sm">
              <p className="font-semibold">📎 Tem o material pronto num arquivo?</p>
              <p className="text-ink-soft">Suba o PDF (resumo, lista de exercícios, apostila, mapa mental, até 8 MB) e escreva embaixo umas linhas dizendo o que é e para quem serve. O arquivo passa pela revisão junto com o texto.</p>
              <label className={`mt-2 inline-block cursor-pointer border-2 border-ink px-3 py-1.5 font-bold hover:border-oxblood ${enviandoArquivo ? "opacity-50" : ""}`}>
                {enviandoArquivo ? "Enviando…" : "Escolher o PDF"}
                <input
                  type="file"
                  accept="application/pdf"
                  className="sr-only"
                  disabled={enviandoArquivo}
                  onChange={async (e) => {
                    const arquivo = e.target.files?.[0];
                    e.target.value = "";
                    if (!arquivo) return;
                    if (arquivo.type !== "application/pdf") return setAviso("Escolha um arquivo PDF.");
                    setEnviandoArquivo(true);
                    try {
                      const caminho = await sendFile(arquivo, "pdf");
                      const nome = arquivo.name.replace(/\.pdf$/i, "").replace(/[[\]()]/g, "").slice(0, 80) || "Material";
                      setCorpo((antes) => `${antes.trim() ? `${antes.trim()}\n\n` : ""}[📎 Baixar: ${nome} (PDF)](envio:${caminho})\n\n`);
                      setAviso("PDF anexado ✓ Agora escreva umas linhas sobre ele.");
                    } catch (erro) {
                      setAviso(erro instanceof UploadError ? (uploadMessages[erro.message] ?? "Não deu para enviar o arquivo.") : "Não deu para enviar o arquivo.");
                    } finally {
                      setEnviandoArquivo(false);
                    }
                  }}
                />
              </label>
            </div>
          )}
          <div className="mt-6 font-serif text-[18px] leading-relaxed">
            <span id="rotulo-corpo" className="sr-only">{tipo.corpo.rotulo}</span>
            {tipo.corpo.editor ? (
              <MarkdownEditor id="painel-corpo" value={corpo} onChange={setCorpo} labels={editorPt} upload={can(me, "coordenacao", "curadoria", "educacao", "jornalismo", "design")} blocos />
            ) : (
              <textarea id="painel-corpo" aria-labelledby="rotulo-corpo" value={corpo} onChange={(e) => setCorpo(e.target.value)} rows={8} placeholder={tipo.corpo.rotulo} className="w-full border border-rule bg-parchment-deep px-3 py-2" />
            )}
          </div>
          <p className="mt-2 font-mono text-xs text-ink-soft">{palavras} {palavras === 1 ? "palavra" : "palavras"} · cerca de {Math.max(1, Math.round(palavras / 200))} min de leitura</p>
        </div>
        {lado && (
          <article className="mx-auto w-full max-w-[680px] border border-dashed border-rule bg-parchment-deep px-5 py-7 sm:px-8" aria-label="Pré-visualização">
            <p className={rotuloPequeno}>Como fica na aula</p>
            <h1 className="mt-2 font-serif text-3xl font-semibold" data-original={titulo ? "" : undefined}>{titulo || tipo.titulo}</h1>
            {valores.resumo && <p className="mt-2 font-serif text-lg italic text-ink-soft" data-original>{valores.resumo}</p>}
            <div className="mt-6" data-original={corpo ? "" : undefined}>
              <Markdown lang="pt">{corpo || "*Nada para mostrar ainda.*"}</Markdown>
            </div>
          </article>
        )}
      </div>

      {comQuestoes && tipo.corpo.editor && <FerramentasDoAutor key={trilha?.slug ?? ""} titulo={titulo} corpo={corpo} questoes={questoes.length} fontes={fontes.filter((f) => f.titulo.trim()).length} trilha={id === "aula" ? trilha : undefined} slug={valores.slug ?? ""} inserir={setCorpo} />}

      {comQuestoes && <QuestoesEditor valor={questoes} mudar={setQuestoes} />}

      {tipo.fonte && <SourcesField value={fontes} onChange={setFontes} labels={fontesPt} />}

      {comQuestoes && me.papeis.length > 0 && (
        <fieldset className="border border-rule bg-parchment-deep p-4">
          <legend className="px-1 font-semibold">Trabalhar junto (opcional)</legend>
          <p className="text-ink-soft">Chame outro educador ou educadora para esta aula: a pessoa recebe o recado na hora e pode editar o texto enquanto ele espera a revisão. Até cinco.</p>
          {colegas.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {colegas.map((pessoa) => (
                <li key={pessoa.id} className="flex items-center gap-2 border border-ink bg-parchment px-2 py-1">
                  <span>
                    <strong>{pessoa.nome}</strong> <span className="text-xs text-ink-soft">{pessoa.email}</span>
                  </span>
                  <button type="button" className={elo} aria-label={`Tirar ${pessoa.nome}`} onClick={() => setColegas(colegas.filter((c) => c.id !== pessoa.id))}>✕</button>
                </li>
              ))}
            </ul>
          )}
          {colegas.length < 5 && (
            <div className="relative mt-2 max-w-md">
              <BuscaDePessoa rotulo="Chamar colega" entre={candidatos} escolhida={null} escolher={(pessoa) => pessoa && setColegas([...colegas, pessoa])} />
            </div>
          )}
        </fieldset>
      )}

      <p className="text-ink-soft">
        Você assina como <strong>{me.nome}</strong>. Tudo passa pela revisão antes de ir ao ar: outro educador da disciplina, a revisão ou a coordenação põe no ar.
      </p>
      <Aviso texto={aviso} />

      {/* A barra de ação fica presa no rodapé enquanto a pessoa escreve. */}
      <div className="no-print sticky bottom-0 z-20 -mx-1 flex flex-wrap items-center gap-2 border-t-2 border-ink bg-parchment-deep/95 px-3 py-3 backdrop-blur">
        <button type="button" className="cursor-pointer border border-ink px-4 py-2 text-sm font-medium hover:border-oxblood hover:text-oxblood" onClick={() => { guardarVersao(`escrever:${id}`, titulo, corpo, true); setAviso("Rascunho salvo neste navegador e na sua conta. Ele também fica na lista de versões."); }}>
          Salvar rascunho
        </button>
        <button type="button" aria-pressed={lado} className="cursor-pointer border border-ink px-4 py-2 text-sm font-medium hover:border-oxblood hover:text-oxblood" onClick={() => setLado((l) => !l)}>
          {lado ? "Esconder a prévia" : "Pré-visualizar ao lado"}
        </button>
        <button type="button" aria-pressed={foco} title="Ctrl+Shift+F" className="cursor-pointer border border-ink px-4 py-2 text-sm font-medium hover:border-oxblood hover:text-oxblood" onClick={() => setFoco((f) => !f)}>
          {foco ? "Sair do modo foco" : "Modo foco"}
        </button>
        <button type="button" onClick={enviar} disabled={ocupado} className="ml-auto cursor-pointer bg-oxblood px-6 py-2.5 font-semibold text-parchment hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50">
          Enviar para revisão
        </button>
      </div>
    </form>
  );

  if (!comQuestoes || foco) return <div className={foco ? "mx-auto max-w-5xl" : ""}>{formulario}</div>;
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
      {formulario}
      <div className="xl:sticky xl:top-6 xl:self-start">
        <GuiaDaAula trilha={id === "aula" ? trilha : undefined} slug={valores.slug ?? ""} titulo={titulo} nomeDaArea={nomeDaArea(alvo)} tipo={id} temTexto={corpo.trim().length > 0} inserir={(texto) => setCorpo(texto)} comecarQuestoes={comQuestoes ? () => setQuestoes((q) => (q.length ? q : [questaoVazia(), questaoVazia(), questaoVazia()])) : undefined} />
      </div>
    </div>
  );
}

// ───────────── Versões do rascunho ─────────────

interface Versao {
  em: number;
  titulo: string;
  corpo: string;
}
const chaveDasVersoes = (chave: string) => `lucia:versoes:${chave}`;
const lerVersoes = (chave: string) => parse<Versao[]>(getItem(chaveDasVersoes(chave)), []);

/** Guarda uma foto do texto no navegador (até quinze, as mais novas primeiro). Sozinha, no máximo a cada três minutos. */
export function guardarVersao(chave: string, titulo: string, corpo: string, agora = false) {
  if (!corpo.trim() && !titulo.trim()) return;
  const lista = lerVersoes(chave);
  const ultima = lista[0];
  if (ultima && ultima.corpo === corpo && ultima.titulo === titulo) return;
  if (!agora && ultima && Date.now() - ultima.em < 3 * 60 * 1000) return;
  setItem(chaveDasVersoes(chave), JSON.stringify([{ em: Date.now(), titulo, corpo }, ...lista].slice(0, 15)));
}

function Versoes({ chave, titulo, corpo, restaurar }: { chave: string; titulo: string; corpo: string; restaurar: (v: Versao) => void }) {
  const [aberto, setAberto] = useState(false);
  const [lista, setLista] = useState<Versao[]>([]);
  // A foto automática: alguns segundos depois de a pessoa parar de escrever.
  useEffect(() => {
    const espera = setTimeout(() => guardarVersao(chave, titulo, corpo), 5000);
    return () => clearTimeout(espera);
  }, [chave, titulo, corpo]);
  return (
    <span className="relative">
      <button type="button" className="cursor-pointer underline hover:text-oxblood" aria-expanded={aberto} onClick={() => { setLista(lerVersoes(chave)); setAberto((a) => !a); }}>
        Versões
      </button>
      {aberto && (
        <div className="absolute right-0 top-6 z-30 w-72 border-2 border-ink bg-parchment p-2 font-sans text-xs shadow-lg">
          {lista.length === 0 ? (
            <p className="text-ink-soft">Ainda não há versões guardadas. Elas aparecem enquanto você escreve.</p>
          ) : (
            <ul className="max-h-72 space-y-1 overflow-y-auto">
              {lista.map((v) => (
                <li key={v.em} className="flex items-center justify-between gap-2 border-b border-rule py-1">
                  <span>
                    {new Date(v.em).toLocaleString(localDoPainel(), { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    <span className="block text-ink-soft">{v.titulo || "(sem título)"} · {v.corpo.split(/\s+/).filter(Boolean).length} palavras</span>
                  </span>
                  <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => { if (window.confirm("Trocar o texto atual por esta versão? O texto atual fica guardado na lista.")) { guardarVersao(chave, titulo, corpo, true); restaurar(v); setAberto(false); } }}>
                    Voltar a esta
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </span>
  );
}

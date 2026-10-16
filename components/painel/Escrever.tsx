// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { areaSlugs, licenses } from "@/lib/areas";
import { can, type Me, rpc } from "@/lib/backend";
import { horaDoRascunho, useRascunho } from "@/lib/rascunho";
import tipos from "@/lib/tipos.json";
import { cleanSources, MarkdownEditor, SourcesField, type EditorLabels, type SourceDraft, type SourceLabels } from "../Editor";
import { useI18n } from "../I18n";
import { useTrackOptions } from "../useTrackOptions";
import { BuscaDePessoa, type PessoaAchada } from "./BuscaDePessoa";
import { Aviso, botao, botaoClaro, campo, elo, papeis, rotulo, useAcao, useLista } from "./comum";
import type { Membro } from "./Equipe";
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
  checkNote: "O texto é enviado ao serviço aberto LanguageTool só quando você aperta o botão.",
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

const semFontes = (fontes: SourceDraft[]) => fontes.every((f) => !f.titulo.trim() && !f.autor.trim() && !f.url.trim());

/** Formulário único para tudo o que entra no site. O que muda de um tipo para outro são os campos. */
export function Escrever({ me }: { me: Me }) {
  const { lang, t } = useI18n();
  const tracks = useTrackOptions(lang);
  const disponiveis = (Object.keys(tipos) as TipoId[]).filter((id) => {
    const tipo = tipos[id] as Tipo;
    return !tipo.papel || can(me, "coordenacao") || can(me, tipo.papel as "jornalismo");
  });
  const [id, setId] = useState<TipoId>(disponiveis[0]);
  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [disciplina, setDisciplina] = useState("");
  const [valores, setValores] = useState<Record<string, string>>({});
  const [fontes, setFontes] = useState<SourceDraft[]>([{ titulo: "", autor: "", url: "" }]);
  const [questoes, setQuestoes] = useState<Questao[]>([]);
  const [colegas, setColegas] = useState<PessoaAchada[]>([]);
  const { agir, aviso, setAviso, ocupado } = useAcao();
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
  const trilha = tracks.find((track) => track.slug === valores.trilha) ?? tracks[0];
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
      { p: { tipo: id, titulo, corpo, disciplina: alvo || null, dados: prontas.length > 0 ? { ...dados, quiz: prontas } : dados, fontes: lista, alvo: caminho ?? null } },
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
      if (chamados.length > 0) setAviso(`Recebido. Sua contribuição entrou na fila de revisão, e ${chamados.join(", ")} já ${chamados.length === 1 ? "recebeu" : "receberam"} o recado para trabalhar junto.`);
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
      return (
        <select value={trilha?.slug ?? ""} onChange={(e) => setValores((antes) => ({ ...antes, trilha: e.target.value, slug: "" }))} className={campo}>
          {areaSlugs.map((area) => {
            const daArea = tracks.filter((track) => track.area === area);
            return daArea.length > 0 ? (
              <optgroup key={area} label={t.areas[area][0]}>
                {daArea.map((track) => (
                  <option key={track.slug} value={track.slug}>
                    {track.title}
                  </option>
                ))}
              </optgroup>
            ) : null;
          })}
        </select>
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
          className={campo}
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
        <select value={valor} onChange={(e) => mudar(c.nome, e.target.value)} className={campo}>
          <option value="">Escolha…</option>
          {opcoes.map((opcao) => (
            <option key={opcao}>{opcao}</option>
          ))}
        </select>
      );
    }
    if (c.tipo === "longo") return <textarea value={valor} onChange={(e) => mudar(c.nome, e.target.value)} maxLength={c.max} rows={4} className={campo} />;
    return (
      <input
        value={valor}
        onChange={(e) => mudar(c.nome, e.target.value)}
        maxLength={c.max ?? 300}
        type={c.tipo === "url" ? "url" : "text"}
        placeholder={c.tipo === "url" ? "https://…" : c.tipo === "caminho" ? "/trilhas/…" : ""}
        className={`${campo} ${c.tipo === "url" || c.tipo === "caminho" ? "font-mono" : ""}`}
      />
    );
  }

  const seletor = (
    <label className="block">
      O que você quer publicar
      <select value={id} onChange={(e) => setId(e.target.value as TipoId)} className={campo}>
        {disponiveis.map((tipoId) => (
          <option key={tipoId} value={tipoId}>
            {(tipos[tipoId] as Tipo).rotulo}
          </option>
        ))}
      </select>
    </label>
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

  const formulario = (
    <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
      {seletor}
      <p className="border-l-2 border-gold pl-4 text-ink-soft">{tipo.ajuda}</p>
      {rascunho.restaurado && rascunho.salvoEm && (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 border border-rule bg-parchment-deep px-4 py-2 text-ink-soft">
          <span>Recuperamos o rascunho guardado às {horaDoRascunho(rascunho.salvoEm)}. Continue de onde parou.</span>
          <button type="button" className={elo} onClick={() => { setTitulo(""); setCorpo(""); setFontes([{ titulo: "", autor: "", url: "" }]); setQuestoes([]); setValores({ trilha: valores.trilha }); rascunho.limpar(); }}>
            Descartar e começar do zero
          </button>
        </p>
      )}

      {tipo.campos
        .filter((c) => c.tipo === "trilha" || c.tipo === "plano")
        .map((c) => (
          <label key={c.nome} className="block">
            {c.rotulo}
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
      {minhas.length > 0 && tipo.disciplina !== "nao" && alvo && !minhas.includes(alvo) && !can(me, "coordenacao", "curadoria") && (
        <p className="text-ink-soft">
          Esta disciplina não está entre as suas ({minhas.map((slug) => nomeDaArea(slug)).join(", ")}). O envio entra na fila como contribuição pública.
        </p>
      )}

      {(tipo.disciplina === "obrigatoria" || tipo.disciplina === "opcional") && (
        <label className="block">
          Disciplina{tipo.disciplina === "opcional" ? " (opcional)" : ""}
          <select value={disciplina} onChange={(e) => setDisciplina(e.target.value)} className={campo}>
            <option value="">Escolha…</option>
            {areaSlugs.map((area) => (
              <option key={area} value={area}>
                {t.areas[area][0]}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="block">
        {tipo.titulo}
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={160} className={campo} />
      </label>

      {tipo.campos
        .filter((c) => c.tipo !== "trilha" && c.tipo !== "plano")
        .map((c) => (
          <label key={c.nome} className="block">
            {c.rotulo}
            {campoDe(c)}
          </label>
        ))}

      <div>
        <label htmlFor="painel-corpo">{tipo.corpo.rotulo}</label>
        <div className="mt-1">
          {tipo.corpo.editor ? (
            <MarkdownEditor id="painel-corpo" value={corpo} onChange={setCorpo} labels={editorPt} upload={can(me, "coordenacao", "curadoria", "educacao", "jornalismo", "design")} />
          ) : (
            <textarea id="painel-corpo" value={corpo} onChange={(e) => setCorpo(e.target.value)} rows={6} className="w-full border-2 border-ink bg-parchment-deep px-3 py-2" />
          )}
        </div>
        <p className="mt-1 font-mono text-xs text-ink-soft">
          {rascunho.salvoEm ? `Rascunho guardado às ${horaDoRascunho(rascunho.salvoEm)}, neste navegador e na sua conta.` : "O rascunho é guardado sozinho enquanto você escreve, neste navegador e na sua conta."}
        </p>
      </div>

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
            <div className="mt-2 max-w-md">
              <BuscaDePessoa rotulo="Chamar colega" entre={candidatos} escolhida={null} escolher={(pessoa) => pessoa && setColegas([...colegas, pessoa])} />
            </div>
          )}
        </fieldset>
      )}

      <p className="text-ink-soft">
        Você assina como <strong>{me.nome}</strong>. Tudo passa pela curadoria antes de ir ao ar.
      </p>
      <button type="button" onClick={enviar} disabled={ocupado} className={botao}>
        Enviar para revisão
      </button>
      <Aviso texto={aviso} />
    </form>
  );

  if (!comQuestoes) return formulario;
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
      {formulario}
      <div className="xl:sticky xl:top-6 xl:self-start">
        <GuiaDaAula trilha={id === "aula" ? trilha : undefined} slug={valores.slug ?? ""} titulo={titulo} nomeDaArea={nomeDaArea(alvo)} tipo={id} temTexto={corpo.trim().length > 0} inserir={(texto) => setCorpo(texto)} />
        <p className={`${rotulo} mt-4`}>Atalho</p>
        <p className="mt-1 text-xs text-ink-soft">
          <button type="button" className={botaoClaro} onClick={() => setQuestoes((q) => (q.length ? q : [questaoVazia(), questaoVazia(), questaoVazia()]))}>Começar as três questões</button>
        </p>
      </div>
    </div>
  );
}

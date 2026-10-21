// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { type ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { areaSlugs } from "@/lib/areas";
import { can, type Me } from "@/lib/backend";
import { EDITORES, FILMES } from "@/lib/estudio";
import { useI18n } from "../I18n";
import { useTrackOptions } from "../useTrackOptions";
import { Aviso, botao, botaoClaro, campo, data, elo, rotulo, useAcao, useLista } from "./comum";

interface Material {
  titulo: string;
  url: string;
  credito: string;
}
interface Exercicio {
  id: string;
  disciplina: string;
  aula: string;
  aula_titulo: string;
  titulo: string;
  objetivo: string;
  programa: "filmcraft" | "effectcraft" | "photocraft";
  materiais: Material[];
  passos: string;
  criterios: string;
  ativo: boolean;
  autor: string;
  entregas: number;
  sem_retorno: number;
}
interface Entrega {
  id: string;
  titulo: string;
  autor: string;
  credito: string;
  link: string;
  comentario: string;
  status: string;
  criado_em: string;
  retorno: string;
}

type Rascunho = Pick<Exercicio, "disciplina" | "aula" | "aula_titulo" | "titulo" | "objetivo" | "programa" | "materiais" | "passos" | "criterios"> & { id: string };
const vazio: Rascunho = { id: "", disciplina: "", aula: "", aula_titulo: "", titulo: "", objetivo: "", programa: "filmcraft", materiais: [], passos: "", criterios: "" };

/** Os três programas do Estúdio de prática, com a cor do ladrilho (como o ícone de um aplicativo). */
const PROGRAMAS: Record<Exercicio["programa"], { sigla: string; tom: string }> = {
  filmcraft: { sigla: "Fc", tom: "bg-oxblood text-parchment" },
  effectcraft: { sigla: "Ec", tom: "bg-gold text-ink" },
  photocraft: { sigla: "Pc", tom: "bg-ink text-parchment" },
};
const NOME_NA_GAVETA: Record<string, string> = { pendente: "esperando a mediação", aprovado: "publicada na Gaveta", aprovada: "publicada na Gaveta", recusado: "não publicada", recusada: "não publicada", retirado: "retirada" };

function Ladrilho({ programa, grande = false }: { programa: Exercicio["programa"]; grande?: boolean }) {
  const p = PROGRAMAS[programa] ?? PROGRAMAS.filmcraft;
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-xl font-sans font-black tracking-tight ${p.tom} ${grande ? "h-14 w-14 text-xl" : "h-10 w-10 text-sm"}`}>
      {p.sigla}
    </span>
  );
}

const passosDe = (texto: string) => texto.split("\n").map((linha) => linha.trim()).filter(Boolean);

/** O exercício como o aluno vê na aula: objetivo, programa, material, passo a passo e critérios. */
function ComoOAlunoVe({ x }: { x: Rascunho }) {
  const programa = EDITORES.find((e) => e.id === x.programa);
  const passos = passosDe(x.passos);
  return (
    <article className="rounded-lg border border-rule bg-parchment p-5">
      <p className={rotulo}>Exercício de prática · {programa?.nome ?? x.programa}</p>
      <h3 className="mt-1 font-serif text-2xl font-semibold leading-snug">{x.titulo || "Sem título"}</h3>
      {x.objetivo && <p className="mt-2 leading-relaxed" data-original>{x.objetivo}</p>}
      {x.materiais.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold">Material</p>
          <ul className="mt-1 space-y-1 text-sm">
            {x.materiais.map((m) => (
              <li key={m.url}>
                <a href={m.url} target="_blank" rel="noopener noreferrer" className={elo}>{m.titulo} ↗</a>
                {m.credito && <span className="block text-xs text-ink-soft" data-original>{m.credito}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {passos.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold">Passo a passo</p>
          <ol className="mt-2 space-y-2">
            {passos.map((passo, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-parchment">{i + 1}</span>
                <span data-original>{passo}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {x.criterios && (
        <div className="mt-4 rounded-md bg-parchment-deep p-3 text-sm">
          <p className="font-semibold">Como vai ser avaliado</p>
          <p className="mt-1 whitespace-pre-line text-ink-soft" data-original>{x.criterios}</p>
        </div>
      )}
      <p className="mt-4 text-xs text-ink-soft">A entrega é pela Gaveta Aberta: o link do vídeo ou da imagem exportada (YouTube não listado, PeerTube, Drive…).</p>
    </article>
  );
}

/** As entregas de um exercício (pela Gaveta Aberta) e o comentário de quem ensina, como uma caixa de entrada. */
function Entregas({ exercicio, depois }: { exercicio: Exercicio; depois: () => void }) {
  const lista = useLista<Entrega[]>("exercicio_entregas", { p_id: exercicio.id });
  const acao = useAcao(() => {
    lista.recarregar();
    depois();
  });
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [editando, setEditando] = useState<string[]>([]);
  const ordenadas = [...(lista.dados ?? [])].sort((a, b) => Number(Boolean(a.retorno)) - Number(Boolean(b.retorno)) || b.criado_em.localeCompare(a.criado_em));
  return (
    <div>
      <Aviso texto={lista.erro || acao.aviso} />
      {lista.dados?.length === 0 && (
        <div className="rounded-lg border border-dashed border-rule px-6 py-10 text-center">
          <p className="font-serif text-lg font-semibold">Nenhuma entrega ainda</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-soft">Quando alguém fizer o exercício e mandar pela Gaveta Aberta, a entrega aparece aqui para você comentar.</p>
        </div>
      )}
      <ul className="space-y-3">
        {ordenadas.map((g) => {
          const nome = g.autor || g.credito || "Anônimo";
          const escrevendo = !g.retorno || editando.includes(g.id);
          return (
            <li key={g.id} className={`rounded-lg border bg-parchment p-4 ${g.retorno ? "border-rule" : "border-gold"}`}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-[0.65rem] font-bold text-parchment">
                  {nome.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}
                </span>
                <span className="font-semibold">{nome}</span>
                <span className="text-ink-soft">· {data(g.criado_em)}</span>
                <span className="rounded-sm bg-parchment-deep px-1.5 py-0.5 text-xs text-ink-soft">{NOME_NA_GAVETA[g.status] ?? g.status}</span>
                {!g.retorno && <span className="ml-auto rounded-sm bg-gold/25 px-1.5 py-0.5 text-xs font-semibold">sem comentário</span>}
              </div>
              {g.titulo && <p className="mt-2 font-serif text-lg font-semibold leading-snug" data-original>{g.titulo}</p>}
              {g.comentario && <p className="mt-1 whitespace-pre-line text-sm leading-relaxed" data-original>{g.comentario}</p>}
              {g.link && (
                <a href={g.link} target="_blank" rel="noopener noreferrer nofollow" className={`${botaoClaro} mt-3 inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm`}>
                  Abrir a entrega ↗
                </a>
              )}
              {g.retorno && !editando.includes(g.id) && (
                <div className="mt-3 rounded-md border-l-4 border-ok bg-parchment-deep px-3 py-2 text-sm">
                  <p className="text-xs font-semibold text-ink-soft">Seu comentário</p>
                  <p className="mt-0.5 whitespace-pre-line">{g.retorno}</p>
                  <button type="button" className={`${elo} mt-1 text-xs`} onClick={() => { setEditando([...editando, g.id]); setTextos({ ...textos, [g.id]: g.retorno }); }}>Trocar o comentário</button>
                </div>
              )}
              {escrevendo && (
                <form
                  className="mt-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await acao.agir("exercicio_retorno", { p_gaveta: g.id, p_texto: textos[g.id] }, "Comentário enviado ✓ Quem entregou recebeu um recado.")) {
                      setTextos({ ...textos, [g.id]: "" });
                      setEditando(editando.filter((id) => id !== g.id));
                    }
                  }}
                >
                  <textarea value={textos[g.id] ?? ""} onChange={(e) => setTextos({ ...textos, [g.id]: e.target.value })} rows={3} maxLength={2000} aria-label={`Comentar a entrega de ${nome}`} placeholder="O que ficou bom, o que dá para melhorar e um próximo passo." className={`${campo} mt-0 rounded-md border bg-parchment-deep`} />
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <button type="submit" className={`${botao} rounded-md px-4 py-2 text-sm`} disabled={acao.ocupado || (textos[g.id] ?? "").trim().length < 5}>
                      Enviar o comentário
                    </button>
                    {g.retorno && <button type="button" className={`${elo} text-sm`} onClick={() => setEditando(editando.filter((id) => id !== g.id))}>Cancelar</button>}
                  </div>
                </form>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-ink-soft">Publicar a entrega na Gaveta Aberta (para todo mundo ver) continua com a mediação, como qualquer trabalho da Gaveta.</p>
    </div>
  );
}

/**
 * Exercícios de prática (painel): quem ensina a disciplina cria exercícios ligados às aulas, com o programa do Estúdio
 * de prática, o material (os filmes abertos da Blender Foundation ou outro link), o passo a passo e os critérios. A
 * lista fica à esquerda com os filtros; o exercício aberto mostra as entregas para comentar e como o aluno vê.
 */
export function Exercicios({ me }: { me: Me }) {
  const { t } = useI18n();
  const lista = useLista<Exercicio[]>("exercicios_meus");
  const acao = useAcao(lista.recarregar);
  const [estado, setEstado] = useState<"ativos" | "arquivados" | "todos">("ativos");
  const [disciplina, setDisciplina] = useState("");
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const [aba, setAba] = useState<"entregas" | "aluno">("entregas");
  const [editando, setEditando] = useState<Rascunho | null>(null);
  const nomeDaArea = (slug: string) => t.areas[slug as keyof typeof t.areas]?.[0] ?? slug;

  const todos = lista.dados ?? [];
  const termo = busca.trim().toLowerCase();
  const visiveis = todos.filter(
    (x) => (estado === "todos" || (estado === "ativos" ? x.ativo : !x.ativo)) && (!disciplina || x.disciplina === disciplina) && (!termo || `${x.titulo} ${x.aula_titulo}`.toLowerCase().includes(termo)),
  );
  const atual = todos.find((x) => x.id === aberto) ?? null;
  const semRetorno = todos.reduce((soma, x) => soma + x.sem_retorno, 0);
  const entregas = todos.reduce((soma, x) => soma + x.entregas, 0);
  const disciplinas = [...new Set(todos.map((x) => x.disciplina))];
  const proximo = todos.find((x) => x.sem_retorno > 0);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-rule pb-4">
        <dl className="flex flex-wrap gap-x-6 gap-y-2">
          <div>
            <dt className="text-xs text-ink-soft">Exercícios ativos</dt>
            <dd className="font-serif text-2xl font-semibold">{todos.filter((x) => x.ativo).length}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-soft">Entregas</dt>
            <dd className="font-serif text-2xl font-semibold">{entregas}</dd>
          </div>
          <div>
            <dt className="text-xs text-ink-soft">Esperando seu comentário</dt>
            <dd className={`font-serif text-2xl font-semibold ${semRetorno ? "text-oxblood" : ""}`}>{semRetorno}</dd>
          </div>
        </dl>
        <span className="ml-auto flex flex-wrap gap-2">
          {proximo && (
            <button type="button" className={`${botaoClaro} rounded-md px-4 py-2`} onClick={() => { setAberto(proximo.id); setAba("entregas"); }}>
              Comentar as entregas
            </button>
          )}
          <button type="button" className={`${botao} rounded-md px-4 py-2`} onClick={() => setEditando(vazio)}>
            + Novo exercício
          </button>
        </span>
      </div>

      <Aviso texto={lista.erro || acao.aviso} />

      <div className="mt-4 grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <section aria-label="Exercícios" className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex overflow-hidden rounded-md border border-rule text-sm" role="group" aria-label="Quais exercícios">
              {(["ativos", "arquivados", "todos"] as const).map((id) => (
                <button key={id} type="button" aria-pressed={estado === id} onClick={() => setEstado(id)} className={`cursor-pointer px-2.5 py-1 ${estado === id ? "bg-ink text-parchment" : "hover:bg-parchment-deep"}`}>
                  {id === "ativos" ? "Ativos" : id === "arquivados" ? "Arquivados" : "Todos"}
                </button>
              ))}
            </span>
            {disciplinas.length > 1 && (
              <select value={disciplina} onChange={(e) => setDisciplina(e.target.value)} aria-label="Disciplina" className="min-w-0 flex-1 cursor-pointer rounded-md border border-rule bg-transparent px-2 py-1 text-sm">
                <option value="">Todas as disciplinas</option>
                {disciplinas.map((d) => (
                  <option key={d} value={d}>{nomeDaArea(d)}</option>
                ))}
              </select>
            )}
          </div>
          {todos.length > 6 && <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar exercício ou aula" aria-label="Buscar exercício" className="mt-2 w-full rounded-md border border-rule bg-transparent px-3 py-1.5 text-sm focus:border-ink focus:outline-none" />}

          {lista.dados && todos.length === 0 && (
            <div className="mt-3 rounded-lg border border-dashed border-rule px-5 py-8 text-center">
              <p className="font-serif text-lg font-semibold">Nenhum exercício ainda</p>
              <p className="mt-1 text-sm text-ink-soft">Um exercício liga uma aula ao Estúdio de prática: a pessoa estuda, faz no programa e manda pela Gaveta.</p>
              <button type="button" className={`${botao} mt-3 rounded-md`} onClick={() => setEditando(vazio)}>Criar o primeiro</button>
            </div>
          )}
          <ul className="mt-3 space-y-1.5">
            {visiveis.map((x) => (
              <li key={x.id}>
                <button
                  type="button"
                  onClick={() => { setAberto(x.id); setAba(x.sem_retorno > 0 ? "entregas" : aba); }}
                  aria-current={aberto === x.id ? "true" : undefined}
                  className={`flex w-full cursor-pointer items-start gap-3 rounded-lg border p-3 text-left ${aberto === x.id ? "border-ink bg-parchment-deep" : "border-transparent hover:border-rule hover:bg-parchment-deep"} ${x.ativo ? "" : "opacity-60"}`}
                >
                  <Ladrilho programa={x.programa} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold leading-snug">{x.titulo}</span>
                    <span className="block truncate text-xs text-ink-soft">{nomeDaArea(x.disciplina)} · {x.aula_titulo || x.aula}</span>
                    <span className="mt-1 flex flex-wrap gap-1.5 text-xs">
                      <span className="text-ink-soft">{x.entregas} {x.entregas === 1 ? "entrega" : "entregas"}</span>
                      {x.sem_retorno > 0 && <span className="rounded-sm bg-gold/25 px-1.5 font-semibold">{x.sem_retorno} sem comentário</span>}
                      {!x.ativo && <span className="rounded-sm bg-rule px-1.5">arquivado</span>}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {lista.dados && todos.length > 0 && visiveis.length === 0 && <p className="mt-3 text-sm text-ink-soft">Nenhum exercício com esses filtros.</p>}
        </section>

        <section aria-label="Exercício aberto" className="min-w-0">
          {!atual ? (
            <div className="hidden h-full min-h-[18rem] flex-col items-center justify-center rounded-lg border border-dashed border-rule p-8 text-center lg:flex">
              <div className="flex gap-2">
                <Ladrilho programa="filmcraft" />
                <Ladrilho programa="effectcraft" />
                <Ladrilho programa="photocraft" />
              </div>
              <p className="mt-4 font-serif text-xl font-semibold">Escolha um exercício</p>
              <p className="mt-1 max-w-sm text-sm text-ink-soft">À esquerda, os seus exercícios. Abra um para comentar as entregas ou ver como ele aparece na aula.</p>
            </div>
          ) : (
            <div className="rounded-lg border border-rule bg-parchment-deep">
              <header className="flex flex-wrap items-start gap-4 border-b border-rule p-5">
                <Ladrilho programa={atual.programa} grande />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-ink-soft">{nomeDaArea(atual.disciplina)} · {EDITORES.find((e) => e.id === atual.programa)?.nome}</p>
                  <h2 className="font-serif text-2xl font-semibold leading-tight [text-wrap:balance]">{atual.titulo}</h2>
                  <a href={`/pt${atual.aula}`} target="_blank" rel="noopener noreferrer" className={`${elo} text-sm`}>{atual.aula_titulo || atual.aula} ↗</a>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={`${botaoClaro} rounded-md px-3 py-1.5 text-sm`} onClick={() => setEditando({ id: atual.id, disciplina: atual.disciplina, aula: atual.aula, aula_titulo: atual.aula_titulo, titulo: atual.titulo, objetivo: atual.objetivo, programa: atual.programa, materiais: atual.materiais, passos: atual.passos, criterios: atual.criterios })}>
                    Corrigir
                  </button>
                  <button type="button" className="cursor-pointer rounded-md px-3 py-1.5 text-sm text-ink-soft hover:bg-parchment hover:text-ink" disabled={acao.ocupado} onClick={() => void acao.agir("exercicio_arquivar", { p_id: atual.id, p_ativo: !atual.ativo }, atual.ativo ? "Arquivado: saiu da aula." : "De volta à aula ✓")}>
                    {atual.ativo ? "Arquivar" : "Reativar"}
                  </button>
                  <button type="button" className="cursor-pointer rounded-md px-2 py-1.5 text-sm text-ink-soft hover:bg-parchment hover:text-ink lg:hidden" onClick={() => setAberto(null)} aria-label="Fechar o exercício">×</button>
                </div>
              </header>
              <div role="tablist" aria-label="O que ver do exercício" className="flex gap-1 border-b border-rule px-4">
                {(
                  [
                    ["entregas", `Entregas (${atual.entregas})`],
                    ["aluno", "Como o aluno vê"],
                  ] as const
                ).map(([id, nome]) => (
                  <button key={id} type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)} className={`-mb-px cursor-pointer border-b-2 px-3 py-2.5 text-sm ${aba === id ? "border-ink font-semibold" : "border-transparent text-ink-soft hover:text-ink"}`}>
                    {nome}
                    {id === "entregas" && atual.sem_retorno > 0 && <span className="ml-1.5 rounded-full bg-oxblood px-1.5 text-[0.65rem] font-bold text-parchment">{atual.sem_retorno}</span>}
                  </button>
                ))}
              </div>
              <div className="p-5">{aba === "entregas" ? <Entregas key={atual.id} exercicio={atual} depois={lista.recarregar} /> : <ComoOAlunoVe x={atual} />}</div>
            </div>
          )}
        </section>
      </div>

      {editando && (
        <Assistente
          inicial={editando}
          me={me}
          fechar={() => setEditando(null)}
          salvar={async (f) => {
            const certo = await acao.agir("exercicio_salvar", { p: { ...f, id: f.id || null } }, f.id ? "Exercício corrigido ✓" : "Exercício criado ✓ Ele já aparece na aula.");
            if (certo) setEditando(null);
            return Boolean(certo);
          }}
          ocupado={acao.ocupado}
        />
      )}
    </div>
  );
}

const ETAPAS = ["Aula", "Proposta", "Material", "Passos", "Revisar"] as const;

/** Criar ou corrigir um exercício em cinco passos, numa gaveta lateral, com a prévia de como fica na aula no fim. */
function Assistente({ inicial, me, fechar, salvar, ocupado }: { inicial: Rascunho; me: Me; fechar: () => void; salvar: (f: Rascunho) => Promise<boolean>; ocupado: boolean }) {
  const { lang, t } = useI18n();
  const tracks = useTrackOptions(lang);
  const [f, setF] = useState(inicial);
  const [etapa, setEtapa] = useState(0);
  const [passos, setPassos] = useState<string[]>(() => {
    const lidos = passosDe(inicial.passos);
    return lidos.length ? lidos : ["", "", ""];
  });
  const [outro, setOutro] = useState({ titulo: "", url: "", credito: "" });
  const lider = can(me, "coordenacao", "curadoria");
  const minhas = lider ? [...areaSlugs] : [...new Set(me.papeis.filter((p) => p.papel === "educacao" || p.papel === "educacao_secundaria").map((p) => p.disciplina).filter(Boolean) as string[])];
  const trilhas = tracks.filter((tr) => tr.area === f.disciplina);
  const aulas = trilhas.flatMap((tr) => (tr.plan ?? (tr.lessons ?? []).map((l) => ({ slug: l.slug, title: l.title, ready: true }))).map((a) => ({ caminho: `/trilhas/${tr.slug}/${a.slug}`, titulo: `${tr.title} › ${a.title}` })));
  const temFilme = (url: string) => f.materiais.some((m) => m.url === url);
  const texto = passos.map((p) => p.trim()).filter(Boolean).join("\n");
  const pronto = { ...f, passos: texto };
  const certo = [Boolean(f.disciplina && f.aula), f.titulo.trim().length >= 3 && f.objetivo.trim().length >= 10, true, texto.length >= 10 && f.criterios.trim().length >= 5, true];
  const falta = ["Escolha a disciplina e a aula.", "O título precisa de 3 letras e o objetivo, de 10.", "", "Escreva os passos (pelo menos 10 letras no total) e os critérios.", ""];
  const tudoCerto = certo.every(Boolean);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [fechar]);

  const mudarPasso = (i: number, valor: string) => setPassos(passos.map((p, j) => (j === i ? valor.replace(/\n/g, " ") : p)));
  const moverPasso = (i: number, para: number) => {
    if (para < 0 || para >= passos.length) return;
    const nova = [...passos];
    [nova[i], nova[para]] = [nova[para], nova[i]];
    setPassos(nova);
  };

  let corpo: ReactNode;
  if (etapa === 0) {
    corpo = (
      <div className="space-y-4">
        <p className="text-ink-soft">Em que aula o exercício aparece? Ele fica no fim da aula, com o botão de abrir o programa.</p>
        <label className="block text-sm font-semibold">Disciplina
          <select value={f.disciplina} onChange={(e) => setF({ ...f, disciplina: e.target.value, aula: "", aula_titulo: "" })} className={campo}>
            <option value="">Escolha</option>
            {minhas.map((a) => (
              <option key={a} value={a}>{t.areas[a as keyof typeof t.areas]?.[0] ?? a}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">Aula
          <select value={f.aula} disabled={!f.disciplina} onChange={(e) => setF({ ...f, aula: e.target.value, aula_titulo: aulas.find((a) => a.caminho === e.target.value)?.titulo ?? "" })} className={campo}>
            <option value="">{f.disciplina ? (aulas.length ? "Escolha a aula" : "Esta disciplina ainda não tem aulas") : "Escolha a disciplina primeiro"}</option>
            {aulas.map((a) => (
              <option key={a.caminho} value={a.caminho}>{a.titulo}</option>
            ))}
          </select>
        </label>
      </div>
    );
  } else if (etapa === 1) {
    corpo = (
      <div className="space-y-4">
        <label className="block text-sm font-semibold">Título
          <input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} maxLength={140} placeholder="Ex.: Monte um trailer de 30 segundos" className={campo} />
        </label>
        <label className="block text-sm font-semibold">Objetivo
          <textarea value={f.objetivo} onChange={(e) => setF({ ...f, objetivo: e.target.value })} rows={3} maxLength={600} placeholder="O que a pessoa aprende fazendo este exercício." className={campo} />
        </label>
        <fieldset>
          <legend className="text-sm font-semibold">Programa</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {EDITORES.filter((e) => e.id in PROGRAMAS).map((e) => (
              <label key={e.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 ${f.programa === e.id ? "border-ink bg-parchment-deep" : "border-rule hover:border-ink-soft"}`}>
                <input type="radio" name="programa" className="sr-only" checked={f.programa === e.id} onChange={() => setF({ ...f, programa: e.id as Exercicio["programa"] })} />
                <Ladrilho programa={e.id as Exercicio["programa"]} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{e.nome}</span>
                  <span className="block text-xs text-ink-soft">estilo {e.estilo}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    );
  } else if (etapa === 2) {
    corpo = (
      <div className="space-y-4">
        <p className="text-ink-soft">O que a pessoa usa no exercício. Os filmes abertos da Blender Foundation têm licença livre; outro material precisa de licença livre também.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {FILMES.map((filme) => {
            const marcado = temFilme(filme.pagina);
            return (
              <label key={filme.pagina} className={`flex cursor-pointer flex-col rounded-lg border-2 p-3 ${marcado ? "border-ink bg-parchment-deep" : "border-rule hover:border-ink-soft"}`}>
                <input type="checkbox" className="sr-only" checked={marcado} onChange={(e) => setF({ ...f, materiais: e.target.checked ? [...f.materiais, { titulo: filme.titulo, url: filme.pagina, credito: filme.credito }] : f.materiais.filter((m) => m.url !== filme.pagina) })} />
                <span className="flex items-center justify-between gap-2">
                  <span className="font-serif text-lg font-semibold">{filme.titulo}</span>
                  <span aria-hidden className={`flex h-5 w-5 items-center justify-center rounded border-2 text-xs ${marcado ? "border-ink bg-ink text-parchment" : "border-rule"}`}>{marcado ? "✓" : ""}</span>
                </span>
                <span className="text-xs text-ink-soft">{filme.ano} · {filme.licenca}</span>
              </label>
            );
          })}
        </div>
        {f.materiais.filter((m) => !FILMES.some((filme) => filme.pagina === m.url)).length > 0 && (
          <ul className="space-y-1 text-sm">
            {f.materiais.filter((m) => !FILMES.some((filme) => filme.pagina === m.url)).map((m) => (
              <li key={m.url} className="flex items-center justify-between gap-2 rounded-md border border-rule px-3 py-2">
                <span className="min-w-0 truncate">{m.titulo}</span>
                <button type="button" className={elo} onClick={() => setF({ ...f, materiais: f.materiais.filter((x) => x.url !== m.url) })}>tirar</button>
              </li>
            ))}
          </ul>
        )}
        <fieldset className="rounded-lg border border-rule p-3">
          <legend className="px-1 text-sm font-semibold">Outro material</legend>
          <div className="grid gap-2">
            <input value={outro.titulo} onChange={(e) => setOutro({ ...outro, titulo: e.target.value })} placeholder="Nome" aria-label="Nome do material" className={`${campo} mt-0`} />
            <input value={outro.url} onChange={(e) => setOutro({ ...outro, url: e.target.value.trim() })} placeholder="https://… (com licença livre)" aria-label="Endereço do material" className={`${campo} mt-0`} />
            <input value={outro.credito} onChange={(e) => setOutro({ ...outro, credito: e.target.value })} placeholder="Crédito e licença" aria-label="Crédito do material" className={`${campo} mt-0`} />
            <button type="button" className={`${botaoClaro} justify-self-start rounded-md px-3 py-1.5 text-sm`} disabled={outro.titulo.trim().length < 2 || !/^https:\/\/\S+$/.test(outro.url) || f.materiais.length >= 8} onClick={() => { setF({ ...f, materiais: [...f.materiais, outro] }); setOutro({ titulo: "", url: "", credito: "" }); }}>
              + Acrescentar
            </button>
          </div>
        </fieldset>
      </div>
    );
  } else if (etapa === 3) {
    corpo = (
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold">Passo a passo</p>
          <p className="text-xs text-ink-soft">Um passo por linha, na ordem em que a pessoa faz.</p>
          <ol className="mt-2 space-y-2">
            {passos.map((passo, i) => (
              <li key={i} className="flex items-center gap-2">
                <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-parchment">{i + 1}</span>
                <input value={passo} onChange={(e) => mudarPasso(i, e.target.value)} maxLength={400} aria-label={`Passo ${i + 1}`} placeholder={i === 0 ? "Ex.: Baixe o filme e abra no programa." : "Próximo passo"} className="min-w-0 flex-1 rounded-md border border-rule bg-parchment-deep px-3 py-1.5 focus:border-ink focus:outline-none" />
                <span className="flex">
                  <button type="button" className="cursor-pointer rounded px-1.5 text-ink-soft hover:text-ink disabled:opacity-30" disabled={i === 0} onClick={() => moverPasso(i, i - 1)} aria-label={`Subir o passo ${i + 1}`}>▲</button>
                  <button type="button" className="cursor-pointer rounded px-1.5 text-ink-soft hover:text-ink disabled:opacity-30" disabled={i === passos.length - 1} onClick={() => moverPasso(i, i + 1)} aria-label={`Descer o passo ${i + 1}`}>▼</button>
                  <button type="button" className="cursor-pointer rounded px-1.5 text-ink-soft hover:text-oxblood disabled:opacity-30" disabled={passos.length <= 1} onClick={() => setPassos(passos.filter((_, j) => j !== i))} aria-label={`Tirar o passo ${i + 1}`}>×</button>
                </span>
              </li>
            ))}
          </ol>
          {passos.length < 20 && <button type="button" className={`${elo} mt-2 text-sm`} onClick={() => setPassos([...passos, ""])}>+ Acrescentar passo</button>}
        </div>
        <label className="block text-sm font-semibold">Critérios de avaliação
          <textarea value={f.criterios} onChange={(e) => setF({ ...f, criterios: e.target.value })} rows={4} maxLength={2000} placeholder="O que você vai olhar na entrega: ritmo, cortes, cor, legenda…" className={campo} />
        </label>
      </div>
    );
  } else {
    corpo = (
      <div className="space-y-3">
        <p className="text-ink-soft">É assim que o exercício aparece no fim da aula.</p>
        <ComoOAlunoVe x={pronto} />
        {!tudoCerto && <p className="text-sm text-oxblood">Falta: {falta.filter((_, i) => !certo[i]).join(" ")}</p>}
      </div>
    );
  }

  // No body: a área de conteúdo do painel tem transform (da animação de entrada), que prenderia o "fixed" dentro dela.
  return createPortal(
    <div className="fixed inset-0 z-[90] flex justify-end bg-[rgba(23,19,14,0.4)]" onPointerDown={(e) => e.target === e.currentTarget && fechar()}>
      <aside role="dialog" aria-modal="true" aria-label={f.id ? "Corrigir exercício" : "Novo exercício"} className="flex h-full w-full max-w-2xl flex-col border-l-2 border-ink bg-parchment text-ink shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3">
          <h2 className="font-serif text-xl font-semibold">{f.id ? "Corrigir exercício" : "Novo exercício"}</h2>
          <button type="button" onClick={fechar} aria-label="Fechar" className="cursor-pointer px-2 text-2xl leading-none text-ink-soft hover:text-ink">×</button>
        </div>
        <ol className="flex gap-1 border-b border-rule px-5 py-3" aria-label="Etapas">
          {ETAPAS.map((nome, i) => (
            <li key={nome} className="min-w-0 flex-1">
              <button type="button" onClick={() => setEtapa(i)} aria-current={etapa === i ? "step" : undefined} className="group w-full cursor-pointer text-left">
                <span className={`block h-1 rounded-full ${i < etapa ? (certo[i] ? "bg-ok" : "bg-oxblood") : i === etapa ? "bg-ink" : "bg-rule"}`} />
                <span className={`mt-1.5 block truncate text-xs ${etapa === i ? "font-semibold text-ink" : "text-ink-soft group-hover:text-ink"}`}>{i + 1}. {nome}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{corpo}</div>
        <div className="flex flex-wrap items-center gap-3 border-t border-rule px-5 py-3">
          {etapa > 0 && <button type="button" className={`${botaoClaro} rounded-md px-4 py-2`} onClick={() => setEtapa(etapa - 1)}>Voltar</button>}
          {!certo[etapa] && falta[etapa] && <span className="text-xs text-ink-soft">{falta[etapa]}</span>}
          <span className="ml-auto" />
          {etapa < ETAPAS.length - 1 ? (
            <button type="button" className={`${botao} rounded-md px-5 py-2`} disabled={!certo[etapa]} onClick={() => setEtapa(etapa + 1)}>Continuar</button>
          ) : (
            <button type="button" className={`${botao} rounded-md px-5 py-2`} disabled={ocupado || !tudoCerto} onClick={() => void salvar(pronto)}>
              {f.id ? "Guardar" : "Criar o exercício"}
            </button>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

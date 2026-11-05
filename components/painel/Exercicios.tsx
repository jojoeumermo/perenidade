// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Archive, ArchiveRestore, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, Clapperboard, ExternalLink, Image as ImageIcon, type LucideIcon, MessageSquareText, Pencil, Plus, Send, Sparkles, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { areaSlugs } from "@/lib/areas";
import { can, type Me } from "@/lib/backend";
import { EDITORES, FILMES } from "@/lib/estudio";
import { useI18n } from "../I18n";
import { useTrackOptions } from "../useTrackOptions";
import { Aviso, data, elo, useAcao, useLista } from "./comum";
import { Abas, Area, Botao, Busca, CabecalhoDeSecao, Campo, Cartao, Esqueleto, Estatistica, Estatisticas, Faixa, ItemDeLista, Lista, Selecao, Selo, useComandosDaSecao, Vazio } from "./ui";

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

/**
 * Os três programas do Estúdio de prática: a sigla do ladrilho (como o ícone de um aplicativo), o tom (cores do site, que
 * o painel converte em tokens; o texto do ladrilho é sempre papel, com contraste nos dois temas) e o ícone Lucide das
 * linhas da lista.
 */
const PROGRAMAS: Record<Exercicio["programa"], { sigla: string; tom: string; simbolo: LucideIcon }> = {
  filmcraft: { sigla: "Fc", tom: "bg-oxblood text-parchment", simbolo: Clapperboard },
  effectcraft: { sigla: "Ec", tom: "bg-gold text-parchment", simbolo: Sparkles },
  photocraft: { sigla: "Pc", tom: "bg-ink text-parchment", simbolo: ImageIcon },
};
const NOME_NA_GAVETA: Record<string, string> = { pendente: "esperando a mediação", aprovado: "publicada na Gaveta", aprovada: "publicada na Gaveta", recusado: "não publicada", recusada: "não publicada", retirado: "retirada" };

function Ladrilho({ programa, grande = false }: { programa: Exercicio["programa"]; grande?: boolean }) {
  const p = PROGRAMAS[programa] ?? PROGRAMAS.filmcraft;
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-[10px] font-sans font-black tracking-tight ${p.tom} ${grande ? "h-14 w-14 text-xl" : "h-10 w-10 text-sm"}`}>
      {p.sigla}
    </span>
  );
}

const passosDe = (texto: string) => texto.split("\n").map((linha) => linha.trim()).filter(Boolean);

/** O número do passo, num círculo de tinta. */
function NumeroDoPasso({ n }: { n: number }) {
  return (
    <span aria-hidden className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-parchment tabular-nums">
      {n}
    </span>
  );
}

/** O exercício como o aluno vê na aula: objetivo, programa, material, passo a passo e critérios. */
function ComoOAlunoVe({ x }: { x: Rascunho }) {
  const programa = EDITORES.find((e) => e.id === x.programa);
  const passos = passosDe(x.passos);
  return (
    <Cartao as="article" className="pn-secao">
      <div>
        <p className="pn-rotulo-mono">Exercício de prática · {programa?.nome ?? x.programa}</p>
        <h3 className="pn-cartao-titulo mt-1">{x.titulo || "Sem título"}</h3>
        {x.objetivo && (
          <p className="mt-2 leading-relaxed" data-original>
            {x.objetivo}
          </p>
        )}
      </div>
      {x.materiais.length > 0 && (
        <div>
          <p className="text-sm font-semibold">Material</p>
          <ul className="mt-1 space-y-1 text-sm">
            {x.materiais.map((m) => (
              <li key={m.url}>
                <a href={m.url} target="_blank" rel="noopener noreferrer" className={`${elo} inline-flex items-center gap-1`}>
                  {m.titulo}
                  <ExternalLink aria-hidden width={13} height={13} />
                </a>
                {m.credito && (
                  <span className="pn-ajuda block" data-original>
                    {m.credito}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {passos.length > 0 && (
        <div>
          <p className="text-sm font-semibold">Passo a passo</p>
          <ol className="mt-2 space-y-2">
            {passos.map((passo, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed">
                <NumeroDoPasso n={i + 1} />
                <span data-original>{passo}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {x.criterios && (
        <Faixa tom="info" titulo="Como vai ser avaliado" semSimbolo>
          <p className="whitespace-pre-line" data-original>
            {x.criterios}
          </p>
        </Faixa>
      )}
      <p className="pn-ajuda">A entrega é pela Gaveta Aberta: o link do vídeo ou da imagem exportada (YouTube não listado, PeerTube, Drive…).</p>
    </Cartao>
  );
}

/** As iniciais de quem entregou, num círculo de tinta. */
function Iniciais({ nome }: { nome: string }) {
  return (
    <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-[0.65rem] font-bold text-parchment">
      {nome
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join("")}
    </span>
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
    <div className="pn-secao">
      <Aviso texto={lista.erro || acao.aviso} />
      {lista.dados === null && !lista.erro && <Esqueleto forma="cartoes" linhas={2} rotulo="Carregando as entregas" />}
      {lista.dados?.length === 0 && <Vazio simbolo={MessageSquareText} titulo="Nenhuma entrega ainda" texto="Quando alguém fizer o exercício e mandar pela Gaveta Aberta, a entrega aparece aqui para você comentar." />}
      {ordenadas.length > 0 && (
        <ul className="grid gap-3" aria-label="Entregas">
          {ordenadas.map((g) => {
            const nome = g.autor || g.credito || "Anônimo";
            const escrevendo = !g.retorno || editando.includes(g.id);
            return (
              <li key={g.id}>
                <Cartao as="article" variante={g.retorno ? "padrao" : "destaque"} aria-label={`Entrega de ${nome}`} className="pn-secao">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                    <Iniciais nome={nome} />
                    <span className="font-semibold">{nome}</span>
                    <span className="pn-ajuda">· {data(g.criado_em)}</span>
                    <Selo>{NOME_NA_GAVETA[g.status] ?? g.status}</Selo>
                    {!g.retorno && (
                      <Selo tom="ouro" ponto className="ml-auto">
                        sem comentário
                      </Selo>
                    )}
                  </div>
                  {(g.titulo || g.comentario) && (
                    <div>
                      {g.titulo && (
                        <p className="pn-cartao-titulo" data-original>
                          {g.titulo}
                        </p>
                      )}
                      {g.comentario && (
                        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed" data-original>
                          {g.comentario}
                        </p>
                      )}
                    </div>
                  )}
                  {g.link && (
                    <a href={g.link} target="_blank" rel="noopener noreferrer nofollow" className="pn-botao pn-botao-pequeno justify-self-start">
                      Abrir a entrega ↗
                    </a>
                  )}
                  {g.retorno && !editando.includes(g.id) && (
                    <Faixa
                      tom="ok"
                      titulo="Seu comentário"
                      acao={
                        <Botao
                          variante="discreto"
                          pequeno
                          simbolo={Pencil}
                          onClick={() => {
                            setEditando([...editando, g.id]);
                            setTextos({ ...textos, [g.id]: g.retorno });
                          }}
                        >
                          Trocar o comentário
                        </Botao>
                      }
                    >
                      <p className="whitespace-pre-line">{g.retorno}</p>
                    </Faixa>
                  )}
                  {escrevendo && (
                    <form
                      className="grid gap-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (await acao.agir("exercicio_retorno", { p_gaveta: g.id, p_texto: textos[g.id] }, "Comentário enviado ✓ Quem entregou recebeu um recado.")) {
                          setTextos({ ...textos, [g.id]: "" });
                          setEditando(editando.filter((id) => id !== g.id));
                        }
                      }}
                    >
                      <textarea
                        value={textos[g.id] ?? ""}
                        onChange={(e) => setTextos({ ...textos, [g.id]: e.target.value })}
                        rows={3}
                        maxLength={2000}
                        aria-label={`Comentar a entrega de ${nome}`}
                        placeholder="O que ficou bom, o que dá para melhorar e um próximo passo."
                        className="pn-campo"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Botao type="submit" pequeno simbolo={Send} carregando={acao.ocupado} disabled={(textos[g.id] ?? "").trim().length < 5}>
                          Enviar o comentário
                        </Botao>
                        {g.retorno && (
                          <Botao variante="discreto" pequeno onClick={() => setEditando(editando.filter((id) => id !== g.id))}>
                            Cancelar
                          </Botao>
                        )}
                      </div>
                    </form>
                  )}
                </Cartao>
              </li>
            );
          })}
        </ul>
      )}
      <p className="pn-ajuda">Publicar a entrega na Gaveta Aberta (para todo mundo ver) continua com a mediação, como qualquer trabalho da Gaveta.</p>
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

  const corrigir = (x: Exercicio) => setEditando({ id: x.id, disciplina: x.disciplina, aula: x.aula, aula_titulo: x.aula_titulo, titulo: x.titulo, objetivo: x.objetivo, programa: x.programa, materiais: x.materiais, passos: x.passos, criterios: x.criterios });
  const arquivar = (x: Exercicio) => acao.agir("exercicio_arquivar", { p_id: x.id, p_ativo: !x.ativo }, x.ativo ? "Arquivado: saiu da aula." : "De volta à aula ✓");

  // Os comandos da paleta (Ctrl K): só o que a tela já faz.
  useComandosDaSecao(
    [
      { id: "novo", nome: "Novo exercício", simbolo: Plus, fazer: () => setEditando(vazio) },
      ...(proximo
        ? [
            {
              id: "comentar",
              nome: "Comentar as entregas",
              simbolo: MessageSquareText,
              fazer: () => {
                setAberto(proximo.id);
                setAba("entregas");
              },
            },
          ]
        : []),
      ...(atual
        ? [
            { id: "corrigir", nome: "Corrigir", simbolo: Pencil, fazer: () => corrigir(atual) },
            { id: "arquivar", nome: atual.ativo ? "Arquivar" : "Reativar", simbolo: atual.ativo ? Archive : ArchiveRestore, fazer: () => void arquivar(atual) },
          ]
        : []),
    ],
    [atual?.id, atual?.ativo, proximo?.id],
  );

  return (
    <div className="pn-tela">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <Estatisticas rotulo="Exercícios" className="min-w-0 flex-1">
          <Estatistica rotulo="Exercícios ativos" valor={todos.filter((x) => x.ativo).length} />
          <Estatistica rotulo="Entregas" valor={entregas} />
          <Estatistica rotulo="Esperando seu comentário" valor={semRetorno} tom={semRetorno ? "bordo" : "neutro"} />
        </Estatisticas>
        <span className="flex flex-wrap gap-2">
          {proximo && (
            <Botao
              simbolo={MessageSquareText}
              onClick={() => {
                setAberto(proximo.id);
                setAba("entregas");
              }}
            >
              Comentar as entregas
            </Botao>
          )}
          <Botao variante="principal" simbolo={Plus} onClick={() => setEditando(vazio)}>
            Novo exercício
          </Botao>
        </span>
      </div>

      <Aviso texto={lista.erro || acao.aviso} />

      <div className="grid gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <section aria-label="Exercícios" className="pn-secao min-w-0 content-start">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex flex-wrap gap-1" role="group" aria-label="Quais exercícios">
              {(["ativos", "arquivados", "todos"] as const).map((id) => (
                <Botao key={id} pequeno aria-pressed={estado === id} variante={estado === id ? "padrao" : "discreto"} onClick={() => setEstado(id)}>
                  {id === "ativos" ? "Ativos" : id === "arquivados" ? "Arquivados" : "Todos"}
                </Botao>
              ))}
            </span>
            {disciplinas.length > 1 && (
              <select value={disciplina} onChange={(e) => setDisciplina(e.target.value)} aria-label="Disciplina" className="pn-campo min-w-0 flex-1">
                <option value="">Todas as disciplinas</option>
                {disciplinas.map((d) => (
                  <option key={d} value={d}>
                    {nomeDaArea(d)}
                  </option>
                ))}
              </select>
            )}
          </div>
          {todos.length > 6 && <Busca rotulo="Buscar exercício" valor={busca} aoMudar={setBusca} placeholder="Buscar exercício ou aula" />}

          {lista.dados === null && !lista.erro && <Esqueleto forma="linhas" linhas={4} rotulo="Carregando os exercícios" />}
          {lista.dados && todos.length === 0 && (
            <Vazio
              titulo="Nenhum exercício ainda"
              texto="Um exercício liga uma aula ao Estúdio de prática: a pessoa estuda, faz no programa e manda pela Gaveta."
              acao={
                <Botao simbolo={Plus} onClick={() => setEditando(vazio)}>
                  Criar o primeiro
                </Botao>
              }
            />
          )}
          {visiveis.length > 0 && (
            <Lista rotulo="Exercícios">
              {visiveis.map((x) => (
                <ItemDeLista
                  key={x.id}
                  simbolo={(PROGRAMAS[x.programa] ?? PROGRAMAS.filmcraft).simbolo}
                  atual={aberto === x.id}
                  className={x.ativo ? undefined : "opacity-70"}
                  aoClicar={() => {
                    setAberto(x.id);
                    setAba(x.sem_retorno > 0 ? "entregas" : aba);
                  }}
                  titulo={x.titulo}
                  meta={
                    <>
                      {nomeDaArea(x.disciplina)} · {x.aula_titulo || x.aula} · {x.entregas} {x.entregas === 1 ? "entrega" : "entregas"}
                    </>
                  }
                  selo={
                    x.sem_retorno > 0 ? (
                      <Selo tom="ouro" ponto>
                        {x.sem_retorno} sem comentário
                      </Selo>
                    ) : !x.ativo ? (
                      <Selo>arquivado</Selo>
                    ) : undefined
                  }
                />
              ))}
            </Lista>
          )}
          {lista.dados && todos.length > 0 && visiveis.length === 0 && <p className="pn-ajuda">Nenhum exercício com esses filtros.</p>}
        </section>

        <section aria-label="Exercício aberto" className="min-w-0">
          {!atual ? (
            <div className="hidden lg:block">
              <Cartao as="div" variante="plano">
                <div className="flex justify-center gap-2 pt-4">
                  <Ladrilho programa="filmcraft" />
                  <Ladrilho programa="effectcraft" />
                  <Ladrilho programa="photocraft" />
                </div>
                <Vazio titulo="Escolha um exercício" texto="À esquerda, os seus exercícios. Abra um para comentar as entregas ou ver como ele aparece na aula." simbolo={ArrowLeft} />
              </Cartao>
            </div>
          ) : (
            <Cartao as="div" className="pn-secao">
              <div className="flex items-start gap-4">
                <Ladrilho programa={atual.programa} grande />
                <CabecalhoDeSecao
                  className="min-w-0 flex-1"
                  nivel={2}
                  rotulo={
                    <>
                      {nomeDaArea(atual.disciplina)} · {EDITORES.find((e) => e.id === atual.programa)?.nome}
                    </>
                  }
                  titulo={atual.titulo}
                  sobre={
                    <a href={`/pt${atual.aula}`} target="_blank" rel="noopener noreferrer" className={`${elo} inline-flex items-center gap-1`}>
                      {atual.aula_titulo || atual.aula}
                      <ExternalLink aria-hidden width={13} height={13} />
                    </a>
                  }
                  acoes={
                    <>
                      <Botao pequeno simbolo={Pencil} onClick={() => corrigir(atual)}>
                        Corrigir
                      </Botao>
                      <Botao variante="discreto" pequeno simbolo={atual.ativo ? Archive : ArchiveRestore} disabled={acao.ocupado} onClick={() => void arquivar(atual)}>
                        {atual.ativo ? "Arquivar" : "Reativar"}
                      </Botao>
                      <Botao variante="discreto" pequeno icone simbolo={X} className="lg:hidden" onClick={() => setAberto(null)} aria-label="Fechar o exercício" />
                    </>
                  }
                />
              </div>
              <Abas
                rotulo="O que ver do exercício"
                valor={aba}
                aoMudar={setAba}
                opcoes={[
                  { id: "entregas", nome: `Entregas (${atual.entregas})`, conta: atual.sem_retorno },
                  { id: "aluno", nome: "Como o aluno vê" },
                ]}
                painel={(id) => (id === "entregas" ? <Entregas key={atual.id} exercicio={atual} depois={lista.recarregar} /> : <ComoOAlunoVe x={atual} />)}
              />
            </Cartao>
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

  // A gaveta é um diálogo: ao abrir, o foco entra nela; ao fechar, volta para onde estava (o botão que a abriu).
  const gaveta = useRef<HTMLElement>(null);
  useEffect(() => {
    const antes = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    gaveta.current?.focus();
    return () => antes?.focus();
  }, []);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") return fechar();
      // Tab dá a volta dentro da gaveta (aria-modal): o foco não escapa para a tela de trás.
      const caixa = gaveta.current;
      if (e.key !== "Tab" || !caixa) return;
      const focaveis = [...caixa.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis[focaveis.length - 1];
      if (e.shiftKey && (document.activeElement === primeiro || document.activeElement === caixa)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primeiro.focus();
      }
    };
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
      <div className="pn-secao">
        <p className="pn-ajuda">Em que aula o exercício aparece? Ele fica no fim da aula, com o botão de abrir o programa.</p>
        <Selecao rotulo="Disciplina" value={f.disciplina} onChange={(e) => setF({ ...f, disciplina: e.target.value, aula: "", aula_titulo: "" })}>
          <option value="">Escolha</option>
          {minhas.map((a) => (
            <option key={a} value={a}>
              {t.areas[a as keyof typeof t.areas]?.[0] ?? a}
            </option>
          ))}
        </Selecao>
        <Selecao rotulo="Aula" value={f.aula} disabled={!f.disciplina} onChange={(e) => setF({ ...f, aula: e.target.value, aula_titulo: aulas.find((a) => a.caminho === e.target.value)?.titulo ?? "" })}>
          <option value="">{f.disciplina ? (aulas.length ? "Escolha a aula" : "Esta disciplina ainda não tem aulas") : "Escolha a disciplina primeiro"}</option>
          {aulas.map((a) => (
            <option key={a.caminho} value={a.caminho}>
              {a.titulo}
            </option>
          ))}
        </Selecao>
      </div>
    );
  } else if (etapa === 1) {
    corpo = (
      <div className="pn-secao">
        <Campo rotulo="Título" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} maxLength={140} placeholder="Ex.: Monte um trailer de 30 segundos" />
        <Area rotulo="Objetivo" value={f.objetivo} onChange={(e) => setF({ ...f, objetivo: e.target.value })} rows={3} maxLength={600} placeholder="O que a pessoa aprende fazendo este exercício." />
        <fieldset>
          <legend className="pn-rotulo">Programa</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {EDITORES.filter((e) => e.id in PROGRAMAS).map((e) => (
              <label key={e.id} className={`flex cursor-pointer items-center gap-3 rounded-[10px] border p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-oxblood ${f.programa === e.id ? "border-ink bg-parchment-deep" : "border-rule hover:border-ink-soft"}`}>
                <input type="radio" name="programa" className="sr-only" checked={f.programa === e.id} onChange={() => setF({ ...f, programa: e.id as Exercicio["programa"] })} />
                <Ladrilho programa={e.id as Exercicio["programa"]} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{e.nome}</span>
                  <span className="pn-ajuda block">estilo {e.estilo}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
    );
  } else if (etapa === 2) {
    const outros = f.materiais.filter((m) => !FILMES.some((filme) => filme.pagina === m.url));
    corpo = (
      <div className="pn-secao">
        <p className="pn-ajuda">O que a pessoa usa no exercício. Os filmes abertos da Blender Foundation têm licença livre; outro material precisa de licença livre também.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {FILMES.map((filme) => {
            const marcado = temFilme(filme.pagina);
            return (
              <label key={filme.pagina} className={`flex cursor-pointer flex-col rounded-[10px] border p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-oxblood ${marcado ? "border-ink bg-parchment-deep" : "border-rule hover:border-ink-soft"}`}>
                <input type="checkbox" className="sr-only" checked={marcado} onChange={(e) => setF({ ...f, materiais: e.target.checked ? [...f.materiais, { titulo: filme.titulo, url: filme.pagina, credito: filme.credito }] : f.materiais.filter((m) => m.url !== filme.pagina) })} />
                <span className="flex items-center justify-between gap-2">
                  <span className="font-serif text-lg font-semibold">{filme.titulo}</span>
                  <span aria-hidden className={`flex h-5 w-5 items-center justify-center rounded border ${marcado ? "border-ink bg-ink text-parchment" : "border-rule"}`}>
                    {marcado && <Check width={13} height={13} />}
                  </span>
                </span>
                <span className="pn-ajuda">
                  {filme.ano} · {filme.licenca}
                </span>
              </label>
            );
          })}
        </div>
        {outros.length > 0 && (
          <Lista rotulo="Outro material">
            {outros.map((m) => (
              <ItemDeLista
                key={m.url}
                titulo={m.titulo}
                acoes={
                  <Botao variante="discreto" pequeno onClick={() => setF({ ...f, materiais: f.materiais.filter((x) => x.url !== m.url) })}>
                    tirar
                  </Botao>
                }
              />
            ))}
          </Lista>
        )}
        <Cartao as="div" variante="plano" titulo="Outro material" nivelDoTitulo={3}>
          <div className="grid gap-2">
            <input value={outro.titulo} onChange={(e) => setOutro({ ...outro, titulo: e.target.value })} placeholder="Nome" aria-label="Nome do material" className="pn-campo" />
            <input value={outro.url} onChange={(e) => setOutro({ ...outro, url: e.target.value.trim() })} placeholder="https://… (com licença livre)" aria-label="Endereço do material" className="pn-campo" />
            <input value={outro.credito} onChange={(e) => setOutro({ ...outro, credito: e.target.value })} placeholder="Crédito e licença" aria-label="Crédito do material" className="pn-campo" />
            <Botao
              pequeno
              simbolo={Plus}
              className="justify-self-start"
              disabled={outro.titulo.trim().length < 2 || !/^https:\/\/\S+$/.test(outro.url) || f.materiais.length >= 8}
              onClick={() => {
                setF({ ...f, materiais: [...f.materiais, outro] });
                setOutro({ titulo: "", url: "", credito: "" });
              }}
            >
              Acrescentar
            </Botao>
          </div>
        </Cartao>
      </div>
    );
  } else if (etapa === 3) {
    corpo = (
      <div className="pn-secao">
        <div>
          <p className="pn-rotulo">Passo a passo</p>
          <p className="pn-ajuda">Um passo por linha, na ordem em que a pessoa faz.</p>
          <ol className="mt-2 space-y-2">
            {passos.map((passo, i) => (
              <li key={i} className="flex items-center gap-2">
                <NumeroDoPasso n={i + 1} />
                <input value={passo} onChange={(e) => mudarPasso(i, e.target.value)} maxLength={400} aria-label={`Passo ${i + 1}`} placeholder={i === 0 ? "Ex.: Baixe o filme e abra no programa." : "Próximo passo"} className="pn-campo min-w-0 flex-1" />
                <span className="flex">
                  <Botao variante="discreto" pequeno icone simbolo={ArrowUp} disabled={i === 0} onClick={() => moverPasso(i, i - 1)} aria-label={`Subir o passo ${i + 1}`} />
                  <Botao variante="discreto" pequeno icone simbolo={ArrowDown} disabled={i === passos.length - 1} onClick={() => moverPasso(i, i + 1)} aria-label={`Descer o passo ${i + 1}`} />
                  <Botao variante="discreto" pequeno icone perigo simbolo={X} disabled={passos.length <= 1} onClick={() => setPassos(passos.filter((_, j) => j !== i))} aria-label={`Tirar o passo ${i + 1}`} />
                </span>
              </li>
            ))}
          </ol>
          {passos.length < 20 && (
            <Botao variante="discreto" pequeno className="mt-2" onClick={() => setPassos([...passos, ""])}>
              + Acrescentar passo
            </Botao>
          )}
        </div>
        <Area rotulo="Critérios de avaliação" value={f.criterios} onChange={(e) => setF({ ...f, criterios: e.target.value })} rows={4} maxLength={2000} placeholder="O que você vai olhar na entrega: ritmo, cortes, cor, legenda…" />
      </div>
    );
  } else {
    corpo = (
      <div className="pn-secao">
        <p className="pn-ajuda">É assim que o exercício aparece no fim da aula.</p>
        <ComoOAlunoVe x={pronto} />
        {!tudoCerto && <Faixa tom="aviso">Falta: {falta.filter((_, i) => !certo[i]).join(" ")}</Faixa>}
      </div>
    );
  }

  // No body: a área de conteúdo do painel tem transform (da animação de entrada), que prenderia o "fixed" dentro dela.
  // "pn-portal" leva as cores e a letra do painel para fora dele.
  return createPortal(
    <div className="pn-portal fixed inset-0 z-[90] flex justify-end" style={{ background: "var(--pn-veu)" }} onPointerDown={(e) => e.target === e.currentTarget && fechar()}>
      <aside
        ref={gaveta}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={f.id ? "Corrigir exercício" : "Novo exercício"}
        className="flex h-full w-full max-w-2xl flex-col border-l outline-none"
        style={{ background: "var(--pn-fundo)", borderColor: "var(--pn-borda)", boxShadow: "var(--pn-sombra-flutuante)" }}
      >
        <div className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3">
          <h2 className="pn-cartao-titulo">{f.id ? "Corrigir exercício" : "Novo exercício"}</h2>
          <Botao variante="discreto" icone simbolo={X} onClick={fechar} aria-label="Fechar" />
        </div>
        <ol className="flex gap-1 border-b border-rule px-5 py-3" aria-label="Etapas">
          {ETAPAS.map((nome, i) => (
            <li key={nome} className="min-w-0 flex-1">
              <button type="button" onClick={() => setEtapa(i)} aria-current={etapa === i ? "step" : undefined} className="group w-full cursor-pointer rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood">
                <span className={`block h-1 rounded-full ${i < etapa ? (certo[i] ? "bg-ok" : "bg-oxblood") : i === etapa ? "bg-ink" : "bg-rule"}`} />
                <span className={`mt-1.5 block truncate font-mono text-[0.68rem] uppercase tracking-[0.14em] ${etapa === i ? "font-semibold text-ink" : "text-ink-soft group-hover:text-ink"}`}>
                  {i + 1}. {nome}
                </span>
              </button>
            </li>
          ))}
        </ol>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{corpo}</div>
        <div className="flex flex-wrap items-center gap-3 border-t border-rule px-5 py-3">
          {etapa > 0 && (
            <Botao simbolo={ArrowLeft} onClick={() => setEtapa(etapa - 1)}>
              Voltar
            </Botao>
          )}
          {!certo[etapa] && falta[etapa] && <span className="pn-ajuda">{falta[etapa]}</span>}
          <span className="ml-auto" />
          {etapa < ETAPAS.length - 1 ? (
            <Botao variante="principal" simboloFim={ArrowRight} disabled={!certo[etapa]} onClick={() => setEtapa(etapa + 1)}>
              Continuar
            </Botao>
          ) : (
            <Botao variante="principal" simbolo={Check} carregando={ocupado} disabled={!tudoCerto} onClick={() => void salvar(pronto)}>
              {f.id ? "Guardar" : "Criar o exercício"}
            </Botao>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

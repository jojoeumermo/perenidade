// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ABRIR_ACESSIBILIDADE } from "@/components/A11yWidget";
import { useGuardado } from "@/components/estudo/guardado";
import { Nivelamento, type TesteDeNivelamento } from "@/components/estudo/Nivelamento";
import Link from "@/components/Link";
import { SeloDePrivacidade } from "@/components/SeloDePrivacidade";
import { fill, localePath, type Locale } from "@/i18n/config";
import type pt from "@/i18n/escola/matricula/pt.json";
import { hasBackend } from "@/lib/backend";
import { contarEscola } from "@/lib/escola/banco";
import {
  ACESSOS,
  type Acesso,
  apagarEscola,
  gravarMatricula,
  inscrever,
  type Inscricao,
  lerInscricoes,
  lerMatricula,
  MAX_APELIDO,
  type Matricula,
  novaMatricula,
  OBJETIVOS,
  type Objetivo,
  TEMPOS,
  type Tempo,
  trancar,
} from "@/lib/escola/estudante";
import { type CursoDoAparelho, editarMatricula, limparApelido, PADROES_AO_PULAR, sugerirCursos, trilhasDoNivelamento } from "@/lib/escola/matricula";
import { lerNivelamentos } from "@/lib/meu-estudo";
import { setPrefs } from "@/lib/prefs";
import type { TextosDoEstudo } from "@/lib/textos-estudo";
import { PerguntaDeVida, type TextosDoFluxo, VoltarEPular } from "./PerguntaDeVida";
import { SugestaoDeCursos } from "./SugestaoDeCursos";
import "@/styles/escola-matricula.css";

type Comum = (typeof pt)["comum"];
type Etapa = "objetivo" | "tempo" | "acesso" | "nivelamento" | "testes" | "sugestao" | "apelido" | "feito";

interface Rascunho {
  etapa: Etapa;
  objetivo?: Objetivo;
  tempo?: Tempo;
  acesso?: Acesso;
  nivelamento: string[];
  escolhidos: string[] | null;
  apelido: string;
  /** Refazendo uma matrícula que já existe (o número fica). */
  refazendo: boolean;
  /** Na tela final: o número e se o +1 anônimo saiu. */
  numero?: string;
  contou?: boolean;
}

const NOVO: Rascunho = { etapa: "objetivo", nivelamento: [], escolhidos: null, apelido: "", refazendo: false };
/** O rascunho da matrícula fica na sessão da aba (some ao fechar): quem sai para ver um curso volta de onde estava. */
const CHAVE_DO_RASCUNHO = "lucia:escola-matricula-rascunho";
const ETAPAS: Etapa[] = ["objetivo", "tempo", "acesso", "nivelamento", "testes", "sugestao", "apelido", "feito"];

function lerRascunho(): Rascunho | null {
  try {
    const r = JSON.parse(sessionStorage.getItem(CHAVE_DO_RASCUNHO) ?? "null") as Partial<Rascunho> | null;
    if (!r || typeof r !== "object" || !ETAPAS.includes(r.etapa as Etapa) || r.etapa === "feito") return null;
    return {
      ...NOVO,
      etapa: r.etapa as Etapa,
      objetivo: OBJETIVOS.includes(r.objetivo as Objetivo) ? r.objetivo : undefined,
      tempo: TEMPOS.includes(r.tempo as Tempo) ? r.tempo : undefined,
      acesso: ACESSOS.includes(r.acesso as Acesso) ? r.acesso : undefined,
      nivelamento: Array.isArray(r.nivelamento) ? r.nivelamento.filter((x) => typeof x === "string") : [],
      escolhidos: Array.isArray(r.escolhidos) ? r.escolhidos.filter((x) => typeof x === "string") : null,
      apelido: typeof r.apelido === "string" ? limparApelido(r.apelido) : "",
      refazendo: r.refazendo === true,
    };
  } catch {
    return null;
  }
}
function guardarRascunho(r: Rascunho | null) {
  try {
    if (!r || r.etapa === "feito") sessionStorage.removeItem(CHAVE_DO_RASCUNHO);
    else sessionStorage.setItem(CHAVE_DO_RASCUNHO, JSON.stringify(r));
  } catch {
    // sem a sessão, o rascunho só não sobrevive a sair da página
  }
}

// Ícones simples, de traço, no mesmo desenho dos selos (aria-hidden: o texto do botão já diz tudo).
const traco = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const ICONES: Record<Objetivo, ReactNode> = {
  "terminar-a-escola": (
    <svg {...traco}>
      <path d="M3 6.5 12 3l9 3.5-9 3.5z" />
      <path d="M6.5 8v5.5c1.5 1.5 3.5 2.2 5.5 2.2s4-.7 5.5-2.2V8M21 6.5V12" />
    </svg>
  ),
  "trabalho-e-renda": (
    <svg {...traco}>
      <rect x="3" y="7" width="18" height="13" rx="1.5" />
      <path d="M9 7V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2M3 12.5h18" />
    </svg>
  ),
  "entender-o-mundo": (
    <svg {...traco}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z" />
    </svg>
  ),
  enem: (
    <svg {...traco}>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M15 3v4h4M9 12l2 2 4-4M9 17.5h6" />
    </svg>
  ),
  "ajudar-em-casa": (
    <svg {...traco}>
      <path d="M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5" />
      <path d="M10 20v-5h4v5" />
    </svg>
  ),
  outro: (
    <svg {...traco}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.2v.3" />
    </svg>
  ),
};

const botao = "inline-flex min-h-12 cursor-pointer items-center justify-center bg-ink px-6 py-3 font-sans text-base font-semibold text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";
const claro = "inline-flex min-h-12 cursor-pointer items-center justify-center border-2 border-ink px-5 py-2.5 font-sans font-semibold hover:border-oxblood hover:text-oxblood";
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const dataLonga = (dia: string, lang: string) => new Intl.DateTimeFormat(lang, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${dia}T00:00:00Z`));

/** O convite da economia de dados (o modo leve que já existe, no painel de acessibilidade), para quem disse que o pacote acaba. */
function ConviteLeve({ s }: { s: TextosDoFluxo["leve"] }) {
  const [pacoteLigado, setPacoteLigado] = useState(false);
  return (
    <div className="mt-6 border-l-4 border-gold bg-parchment-deep p-4 font-sans" data-convite-leve="">
      <p className="font-semibold">{s.titulo}</p>
      <p className="mt-1 text-sm text-ink-soft">{s.texto}</p>
      <button type="button" className="mt-3 min-h-11 cursor-pointer underline hover:text-oxblood" onClick={() => window.dispatchEvent(new Event(ABRIR_ACESSIBILIDADE))}>
        {s.botao}
      </button>
      {/* E4-17: o modo pacote de dados (lib/prefs.ts), que também liga o modo leve; fica só no aparelho. */}
      <p className="mt-3 text-sm text-ink-soft">{s.pacoteTexto}</p>
      <button
        type="button"
        className="mt-2 min-h-11 cursor-pointer underline hover:text-oxblood"
        onClick={() => {
          setPrefs({ pacote: true });
          setPacoteLigado(true);
        }}
      >
        {s.pacoteBotao}
      </button>
      <p className="mt-1 text-sm font-semibold" role="status">
        {pacoteLigado ? s.pacoteLigado : ""}
      </p>
    </div>
  );
}

/** Sua matrícula: número, respostas (com edição), cursos (trancar e voltar), refazer e apagar. */
function GerirMatricula({
  matricula,
  inscricoes,
  titulos,
  s,
  comum,
  lang,
  refazer,
  apagou,
  pedido,
}: {
  matricula: Matricula;
  inscricoes: Inscricao[];
  titulos: Map<string, string>;
  s: TextosDoFluxo;
  comum: Comum;
  lang: Locale;
  refazer: () => void;
  apagou: () => void;
  /** O curso escolhido no catálogo (?curso=), quando a pessoa já tem matrícula e ainda não está nele. */
  pedido: string | null;
}) {
  const g = s.gerir;
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState({ objetivo: matricula.objetivo, tempo: matricula.tempo, acesso: matricula.acesso, apelido: matricula.apelido ?? "" });
  const [aviso, setAviso] = useState("");
  const [apagando, setApagando] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);

  function guardar() {
    const ok = gravarMatricula(editarMatricula(matricula, rascunho));
    setAviso(ok ? g.salvo : comum.semGuardar);
    if (ok) setEditando(false);
  }

  const campo = "mt-1 block w-full min-h-11 border-2 border-ink bg-parchment px-3 py-2";
  return (
    <div className="mt-8 font-sans" data-gerir-matricula="">
      <section className="border-2 border-ink bg-parchment-deep p-5" aria-labelledby="sua-matricula">
        <h2 id="sua-matricula" ref={titulo} tabIndex={-1} className="font-serif text-3xl font-semibold outline-none">
          {g.titulo}
        </h2>
        <p className="mt-2 font-mono text-2xl tracking-wider" data-numero-da-matricula="">
          {fill(g.numero, { numero: matricula.numero })}
        </p>
        <p className="mt-1 text-ink-soft">{fill(g.desde, { data: dataLonga(matricula.criadaEm, lang) })}</p>
        <p className="mt-4 flex flex-wrap gap-3">
          <Link href={localePath(lang, "/escola/carteirinha")} className={botao}>
            {s.feito.carteirinha}
          </Link>
          <Link href={localePath(lang, "/escola/plano")} className={claro}>
            {s.feito.plano}
          </Link>
        </p>
        <SeloDePrivacidade tipo="aparelho" lang={lang} className="mt-4" />
      </section>

      {pedido && titulos.has(pedido) && !inscricoes.some((i) => i.curso === pedido && !i.trancadoEm) && (
        <section className="mt-6 border-l-4 border-gold bg-parchment-deep p-4" data-pedido={pedido}>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-oxblood">{s.sugestao.motivo.pedido}</p>
          <p className="mt-1 font-serif text-2xl font-semibold">{titulos.get(pedido)}</p>
          <button
            type="button"
            className={`${botao} mt-3`}
            onClick={() => {
              inscrever(pedido);
              contarEscola("escola_matricula", pedido, "semestre");
            }}
          >
            {s.sugestao.marcar}
          </button>
        </section>
      )}

      <section className="mt-8" aria-labelledby="suas-respostas">
        <h2 id="suas-respostas" className="font-serif text-2xl font-semibold">
          {g.respostas}
        </h2>
        {!editando ? (
          <>
            <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
              <dt className="text-ink-soft">{g.rotuloObjetivo}</dt>
              <dd className="font-semibold">{s.objetivo.opcoes[matricula.objetivo].titulo}</dd>
              <dt className="text-ink-soft">{g.rotuloTempo}</dt>
              <dd className="font-semibold">{s.tempo.opcoes[matricula.tempo].titulo}</dd>
              <dt className="text-ink-soft">{g.rotuloAcesso}</dt>
              <dd className="font-semibold">{s.acesso.opcoes[matricula.acesso].titulo}</dd>
              <dt className="text-ink-soft">{g.rotuloApelido}</dt>
              <dd className="font-semibold">{matricula.apelido ?? g.semApelido}</dd>
            </dl>
            <p className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className={claro}
                onClick={() => {
                  setRascunho({ objetivo: matricula.objetivo, tempo: matricula.tempo, acesso: matricula.acesso, apelido: matricula.apelido ?? "" });
                  setAviso("");
                  setEditando(true);
                }}
              >
                {g.editar}
              </button>
              <button type="button" className={claro} onClick={refazer}>
                {g.refazer}
              </button>
            </p>
            <p className="mt-2 max-w-2xl text-sm text-ink-soft">{g.refazerDica}</p>
          </>
        ) : (
          <form
            className="mt-3 grid max-w-xl gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              guardar();
            }}
          >
            <label>
              {g.rotuloObjetivo}
              <select className={campo} value={rascunho.objetivo} onChange={(e) => setRascunho({ ...rascunho, objetivo: e.target.value as Objetivo })}>
                {OBJETIVOS.map((o) => (
                  <option key={o} value={o}>
                    {s.objetivo.opcoes[o].titulo}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {g.rotuloTempo}
              <select className={campo} value={rascunho.tempo} onChange={(e) => setRascunho({ ...rascunho, tempo: e.target.value as Tempo })}>
                {TEMPOS.map((t) => (
                  <option key={t} value={t}>
                    {s.tempo.opcoes[t].titulo}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {g.rotuloAcesso}
              <select className={campo} value={rascunho.acesso} onChange={(e) => setRascunho({ ...rascunho, acesso: e.target.value as Acesso })}>
                {ACESSOS.map((a) => (
                  <option key={a} value={a}>
                    {s.acesso.opcoes[a].titulo}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {s.apelido.rotulo}
              <input className={campo} value={rascunho.apelido} maxLength={MAX_APELIDO} autoComplete="nickname" onChange={(e) => setRascunho({ ...rascunho, apelido: limparApelido(e.target.value) })} aria-describedby="dica-apelido-editar" />
              <span id="dica-apelido-editar" className="mt-1 block text-xs text-ink-soft">
                {s.apelido.dica}
              </span>
            </label>
            <p className="flex flex-wrap gap-3">
              <button type="submit" className={botao}>
                {s.apelido.guardar}
              </button>
              <button type="button" className={claro} onClick={() => setEditando(false)}>
                {g.cancelar}
              </button>
            </p>
          </form>
        )}
        <p role="status" className="mt-2 text-sm">
          {aviso}
        </p>
      </section>

      <section className="mt-8" aria-labelledby="seus-cursos">
        <h2 id="seus-cursos" className="font-serif text-2xl font-semibold">
          {g.cursos}
        </h2>
        {inscricoes.length === 0 ? (
          <p className="mt-2 text-ink-soft">
            {g.semCursos}{" "}
            <Link href={localePath(lang, "/cursos")} className="underline hover:text-oxblood">
              {g.verCursos}
            </Link>
          </p>
        ) : (
          <ul className="mt-3 grid gap-3">
            {inscricoes.map((i) => (
              <li key={i.curso} className="flex flex-wrap items-center justify-between gap-3 border border-rule p-4" data-inscricao={i.curso}>
                <span>
                  <Link href={localePath(lang, `/cursos/${i.curso}`)} className="font-serif text-xl font-semibold hover:text-oxblood">
                    {titulos.get(i.curso) ?? i.curso}
                  </Link>
                  <span className="block text-sm text-ink-soft">
                    {i.formadoEm
                      ? fill(g.formado, { data: dataLonga(i.formadoEm, lang) })
                      : i.trancadoEm
                        ? fill(g.trancado, { data: dataLonga(i.trancadoEm, lang) })
                        : fill(g.emAndamento, { data: dataLonga(i.entrouEm, lang) })}
                  </span>
                </span>
                {!i.formadoEm &&
                  (i.trancadoEm ? (
                    <button type="button" className={claro} onClick={() => inscrever(i.curso)}>
                      {g.destrancar}
                    </button>
                  ) : (
                    <button type="button" className={claro} onClick={() => trancar(i.curso)} title={g.trancarDica}>
                      {g.trancar}
                    </button>
                  ))}
              </li>
            ))}
          </ul>
        )}
        {inscricoes.some((i) => !i.trancadoEm && !i.formadoEm) && <p className="mt-2 text-sm text-ink-soft">{g.trancarDica}</p>}
      </section>

      <section className="mt-10 border-t border-rule pt-6" aria-labelledby="apagar-matricula">
        <h2 id="apagar-matricula" className="sr-only">
          {g.apagar}
        </h2>
        {!apagando ? (
          <button type="button" className="min-h-11 cursor-pointer text-oxblood underline" onClick={() => setApagando(true)}>
            {g.apagar}
          </button>
        ) : (
          <div role="alertdialog" aria-labelledby="apagar-pergunta" className="max-w-2xl border-2 border-oxblood p-4">
            <p id="apagar-pergunta">{g.apagarPergunta}</p>
            <p className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                className="inline-flex min-h-11 cursor-pointer items-center bg-oxblood px-5 font-semibold text-parchment"
                onClick={() => {
                  apagarEscola();
                  guardarRascunho(null);
                  setApagando(false);
                  apagou();
                }}
              >
                {g.apagarSim}
              </button>
              {/* O foco vai para o "Cancelar": o botão que apaga nunca é o primeiro a receber um Enter distraído. */}
              <button type="button" className={claro} onClick={() => setApagando(false)} autoFocus>
                {g.apagarNao}
              </button>
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * A matrícula sem cadastro (D1-9): uma pergunta por tela (o que te traz aqui, tempo por semana, internet), o
 * nivelamento opcional (o componente do site, com as trilhas dos cursos), a sugestão de 1 a 3 cursos, o apelido
 * opcional e "Fazer minha matrícula". Tudo fica no aparelho; o servidor só recebe um +1 anônimo por curso escolhido
 * (ou "escola", sem curso), uma vez por semestre. Quem já tem matrícula vê a matrícula: editar, refazer, trancar curso
 * e apagar. O HTML do servidor é neutro ("abrindo…"); o resto aparece depois de ler o aparelho.
 */
export function FluxoDaMatricula({
  s,
  comum,
  sNivelamento,
  cursos,
  testes,
  lang,
}: {
  s: TextosDoFluxo;
  comum: Comum;
  sNivelamento: TextosDoEstudo["nivelamento"];
  cursos: CursoDoAparelho[];
  testes: TesteDeNivelamento[];
  lang: Locale;
}) {
  const [matricula] = useGuardado<Matricula | null | undefined>(lerMatricula, undefined);
  const [inscricoes] = useGuardado<Inscricao[]>(lerInscricoes, []);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [pedido, setPedido] = useState<string | null>(null);
  const [focar, setFocar] = useState(false);
  const [erro, setErro] = useState("");
  const [apagada, setApagada] = useState(false);
  const titulos = useMemo(() => new Map(cursos.map((c) => [c.slug, c.titulo])), [cursos]);

  // Ao abrir: o ?curso= do catálogo e o rascunho desta aba (quem saiu para ver um curso volta de onde estava).
  useEffect(() => {
    const id = window.setTimeout(() => {
      const curso = new URLSearchParams(window.location.search).get("curso");
      if (curso && SLUG.test(curso) && curso.length <= 80) setPedido(curso);
      const guardado = lerRascunho();
      if (guardado) setRascunho(guardado);
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (rascunho) guardarRascunho(rascunho);
  }, [rascunho]);

  if (matricula === undefined)
    return (
      <p className="mt-8 min-h-96 font-sans text-sm text-ink-soft" aria-busy="true">
        {comum.carregando}
      </p>
    );

  // Sem rascunho: quem tem matrícula vê a matrícula; quem não tem começa.
  const r: Rascunho | null = rascunho ?? (matricula ? null : NOVO);
  if (!r && matricula)
    return (
      <GerirMatricula
        key={matricula.numero}
        matricula={matricula}
        inscricoes={inscricoes}
        titulos={titulos}
        s={s}
        comum={comum}
        lang={lang}
        pedido={pedido}
        apagou={() => {
          setApagada(true);
          setRascunho(null);
        }}
        refazer={() => {
          setFocar(true);
          setRascunho({ ...NOVO, objetivo: matricula.objetivo, tempo: matricula.tempo, acesso: matricula.acesso, nivelamento: matricula.nivelamento, apelido: matricula.apelido ?? "", refazendo: true });
        }}
      />
    );
  const atual = r ?? NOVO;

  const ir = (mudanca: Partial<Rascunho>) => {
    setFocar(true);
    setErro("");
    setRascunho({ ...atual, ...mudanca });
  };
  const objetivo = atual.objetivo ?? PADROES_AO_PULAR.objetivo;
  const tempo = atual.tempo ?? PADROES_AO_PULAR.tempo;
  const acesso = atual.acesso ?? PADROES_AO_PULAR.acesso;
  const sugestoes = sugerirCursos({ objetivo, tempo }, cursos, atual.nivelamento, pedido);
  const temSugestao = sugestoes.cursos.length > 0 || sugestoes.antes !== null;
  // O nivelamento oferece as trilhas dos cursos que combinam com o objetivo (sem nenhum, as de todos os cursos).
  const slugsDoObjetivo = new Set([...sugestoes.cursos.map((x) => x.slug), ...(sugestoes.antes ? [sugestoes.antes.slug] : [])]);
  const trilhasDoObjetivo = new Set(cursos.filter((c) => slugsDoObjetivo.has(c.slug)).flatMap((c) => c.modulos.flatMap((m) => m.aulas.map((a) => a.split("/")[0]))));
  const testesDoObjetivo = testes.filter((t) => trilhasDoObjetivo.has(t.trilha));
  const testesAgora = testesDoObjetivo.length ? testesDoObjetivo : testes;
  const escolhidos = atual.escolhidos ?? (sugestoes.cursos[0] ? [sugestoes.cursos[0].slug] : []);

  // A etapa depois do acesso: o nivelamento (se há perguntas), a sugestão (se há cursos) ou o apelido.
  const depoisDoAcesso: Etapa = testesAgora.length ? "nivelamento" : temSugestao ? "sugestao" : "apelido";
  const depoisDoNivelamento: Etapa = temSugestao ? "sugestao" : "apelido";
  const antesDoApelido: Etapa = temSugestao ? "sugestao" : testesAgora.length ? "nivelamento" : "acesso";

  function fazer() {
    const respostas = { objetivo, tempo, acesso, apelido: atual.apelido, nivelamento: atual.nivelamento };
    const existente = matricula && atual.refazendo ? matricula : null;
    const m = existente ? editarMatricula(existente, respostas) : novaMatricula(respostas);
    if (!gravarMatricula(m)) {
      setErro(comum.semGuardar);
      return;
    }
    const cursosValidos = escolhidos.filter((slug) => titulos.has(slug));
    for (const slug of cursosValidos) {
      inscrever(slug);
      contarEscola("escola_matricula", slug, "semestre");
    }
    if (!existente && cursosValidos.length === 0) contarEscola("escola_matricula", "escola", "semestre");
    const contou = hasBackend && (cursosValidos.length > 0 || !existente);
    guardarRascunho(null);
    ir({ etapa: "feito", numero: m.numero, contou });
  }

  const contador = (i: number) => fill(s.passo, { i, n: 3 });
  const lead = (
    <>
      <p role="status" className="font-sans text-sm">
        {apagada && atual.etapa === "objetivo" ? s.gerir.apagada : ""}
      </p>
      <p className="mt-6 max-w-2xl font-sans text-ink-soft">{s.lead}</p>
    </>
  );

  if (atual.etapa === "objetivo")
    return (
      <>
        {lead}
        <PerguntaDeVida
          id="objetivo"
          contador={contador(1)}
          pergunta={s.objetivo.pergunta}
          opcoes={OBJETIVOS.map((o) => ({ valor: o, ...s.objetivo.opcoes[o], icone: ICONES[o] }))}
          escolhido={atual.objetivo}
          escolher={(v) => ir({ objetivo: v as Objetivo, etapa: "tempo", escolhidos: null })}
          voltar={atual.refazendo ? () => setRascunho(null) : undefined}
          pular={() => ir({ objetivo: atual.objetivo ?? PADROES_AO_PULAR.objetivo, etapa: "tempo", escolhidos: null })}
          focar={focar}
          s={s}
          lang={lang}
        />
      </>
    );
  if (atual.etapa === "tempo")
    return (
      <>
        {lead}
        <PerguntaDeVida
          id="tempo"
          contador={contador(2)}
          pergunta={s.tempo.pergunta}
          dica={s.tempo.dica}
          opcoes={TEMPOS.map((t) => ({ valor: t, ...s.tempo.opcoes[t] }))}
          escolhido={atual.tempo}
          escolher={(v) => ir({ tempo: v as Tempo, etapa: "acesso" })}
          voltar={() => ir({ etapa: "objetivo" })}
          pular={() => ir({ tempo: atual.tempo ?? PADROES_AO_PULAR.tempo, etapa: "acesso" })}
          focar={focar}
          s={s}
          lang={lang}
        />
      </>
    );
  if (atual.etapa === "acesso")
    return (
      <>
        {lead}
        <PerguntaDeVida
          id="acesso"
          contador={contador(3)}
          pergunta={s.acesso.pergunta}
          dica={s.acesso.dica}
          opcoes={ACESSOS.map((a) => ({ valor: a, ...s.acesso.opcoes[a] }))}
          escolhido={atual.acesso}
          escolher={(v) => ir({ acesso: v as Acesso, etapa: depoisDoAcesso })}
          voltar={() => ir({ etapa: "tempo" })}
          pular={() => ir({ acesso: atual.acesso ?? PADROES_AO_PULAR.acesso, etapa: depoisDoAcesso })}
          focar={focar}
          s={s}
          lang={lang}
        />
      </>
    );
  if (atual.etapa === "nivelamento")
    return (
      <PerguntaDeVida
        id="nivelamento"
        pergunta={s.nivelamento.pergunta}
        dica={s.nivelamento.texto}
        opcoes={[
          { valor: "sim", titulo: s.nivelamento.sim, frase: "" },
          { valor: "nao", titulo: s.nivelamento.nao, frase: "" },
        ]}
        escolher={(v) => ir({ etapa: v === "sim" ? "testes" : depoisDoNivelamento })}
        voltar={() => ir({ etapa: "acesso" })}
        pular={() => ir({ etapa: depoisDoNivelamento })}
        focar={focar}
        s={s}
        lang={lang}
      />
    );
  if (atual.etapa === "testes")
    return (
      <section className="mt-8" aria-labelledby="pergunta-testes-titulo" data-pergunta="testes">
        <TituloQueFoca id="pergunta-testes-titulo" focar={focar}>
          {s.nivelamento.pergunta}
        </TituloQueFoca>
        <Nivelamento testes={testesAgora} s={sNivelamento} />
        <p className="mt-6">
          <button
            type="button"
            className={botao}
            onClick={() => {
              // O resultado guardado pelo nivelamento (lib/meu-estudo.ts) vira matricula.nivelamento.
              ir({ nivelamento: trilhasDoNivelamento(lerNivelamentos()), etapa: depoisDoNivelamento, escolhidos: null });
            }}
          >
            {s.nivelamento.seguir} →
          </button>
        </p>
        <VoltarEPular s={s} voltar={() => ir({ etapa: "nivelamento" })} />
      </section>
    );
  if (atual.etapa === "sugestao")
    return (
      <section className="mt-8" aria-labelledby="pergunta-sugestao-titulo" data-pergunta="sugestao">
        <TituloQueFoca id="pergunta-sugestao-titulo" focar={focar}>
          {s.sugestao.pergunta}
        </TituloQueFoca>
        <p className="mt-2 font-sans text-ink-soft">{s.sugestao.texto}</p>
        <SugestaoDeCursos
          sugestoes={sugestoes}
          cursos={cursos}
          escolhidos={escolhidos}
          alternar={(slug) => ir({ escolhidos: escolhidos.includes(slug) ? escolhidos.filter((x) => x !== slug) : [...escolhidos, slug] })}
          s={s.sugestao}
          lang={lang}
        />
        <p className="mt-6">
          <button type="button" className={botao} onClick={() => ir({ etapa: "apelido", escolhidos })}>
            {s.nivelamento.seguir} →
          </button>
        </p>
        <VoltarEPular s={s} voltar={() => ir({ etapa: testesAgora.length ? "nivelamento" : "acesso" })} />
      </section>
    );
  if (atual.etapa === "apelido")
    return (
      <section className="mt-8 font-sans" aria-labelledby="pergunta-apelido-titulo" data-pergunta="apelido">
        <TituloQueFoca id="pergunta-apelido-titulo" focar={focar}>
          {s.apelido.pergunta}
        </TituloQueFoca>
        {!temSugestao && <p className="mt-4 border border-rule bg-parchment-deep p-4">{s.sugestao.semCursos}</p>}
        <form
          className="mt-5 max-w-xl"
          onSubmit={(e) => {
            e.preventDefault();
            fazer();
          }}
        >
          <label htmlFor="apelido" className="block font-semibold">
            {s.apelido.rotulo}
          </label>
          <input
            id="apelido"
            value={atual.apelido}
            maxLength={MAX_APELIDO}
            autoComplete="nickname"
            onChange={(e) => setRascunho({ ...atual, apelido: limparApelido(e.target.value) })}
            aria-describedby="apelido-dica"
            className="mt-2 block w-full min-h-12 border-2 border-ink bg-parchment px-3 py-2 text-lg"
          />
          <p id="apelido-dica" className="mt-2 text-sm text-ink-soft">
            {s.apelido.dica}
          </p>
          <button type="submit" className={`${botao} mt-6 w-full sm:w-auto`}>
            {atual.refazendo ? s.apelido.guardar : s.apelido.fazer}
          </button>
          <p role="alert" className="mt-3 text-oxblood">
            {erro}
          </p>
        </form>
        <SeloDePrivacidade tipo="aparelho" lang={lang} className="mt-4" />
        <VoltarEPular s={s} voltar={() => ir({ etapa: antesDoApelido })} />
      </section>
    );

  // Tela final.
  return (
    <section className="mt-8 font-sans" aria-labelledby="matricula-feita" data-matricula-feita="">
      <div className="border-2 border-ink bg-parchment-deep p-6 shadow-[5px_5px_0_var(--sombra)]">
        <TituloQueFoca id="matricula-feita" focar={focar}>
          {s.feito.titulo}
        </TituloQueFoca>
        <p className="mt-3 text-lg">
          {fill(s.feito.numero, { numero: "" })}
          <strong className="font-mono text-2xl tracking-wider" data-numero-da-matricula="">
            {atual.numero}
          </strong>
        </p>
        <SeloDePrivacidade tipo="aparelho" lang={lang} className="mt-3" />
        {atual.contou && <p className="mt-2 text-sm text-ink-soft">{s.feito.contagem}</p>}
        <p className="mt-5 flex flex-wrap gap-3">
          <Link href={localePath(lang, "/escola/carteirinha")} className={botao}>
            {s.feito.carteirinha}
          </Link>
          <Link href={localePath(lang, "/escola/plano")} className={claro}>
            {s.feito.plano}
          </Link>
        </p>
      </div>
      <p className="mt-5 text-ink-soft">
        {s.feito.copia}{" "}
        <Link href={localePath(lang, "/meus-dados")} className="underline hover:text-oxblood">
          {s.feito.meusDados}
        </Link>
      </p>
      {acesso === "pacote-acaba" && <ConviteLeve s={s.leve} />}
      <p className="mt-6">
        <button type="button" className="min-h-11 cursor-pointer underline hover:text-oxblood" onClick={() => setRascunho(null)}>
          {s.gerir.titulo} →
        </button>
      </p>
    </section>
  );
}

/** Um título de etapa que recebe o foco quando a tela troca (o leitor de tela anuncia a pergunta nova). */
function TituloQueFoca({ id, focar, children }: { id: string; focar: boolean; children: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focar) ref.current?.focus();
  }, [focar, id]);
  return (
    <h2 id={id} ref={ref} tabIndex={-1} className="font-serif text-3xl font-semibold leading-tight outline-none sm:text-4xl">
      {children}
    </h2>
  );
}

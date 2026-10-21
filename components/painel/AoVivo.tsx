// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { type Aula } from "@/lib/aovivo";
import { areaSlugs } from "@/lib/areas";
import { can, type Me } from "@/lib/backend";
import { JITSI_DOMINIO, novaSalaJitsi } from "@/lib/jitsi";
import { useI18n } from "../I18n";
import { useTrackOptions } from "../useTrackOptions";
import { BuscaDePessoa, type PessoaAchada } from "./BuscaDePessoa";
import { Aviso, botao, botaoClaro, campo, dataHora, elo, localDoPainel, papeis, rotulo, useAcao, useLista } from "./comum";
import type { Membro } from "./Equipe";

/** "2026-10-20T19:00" no fuso do aparelho, para o campo de data e hora. */
const paraCampo = (iso: string) => {
  const d = new Date(iso);
  const dois = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:${dois(d.getMinutes())}`;
};
const daquiAUmaHora = () => {
  const d = new Date(Date.now() + 3600_000);
  d.setMinutes(0, 0, 0);
  return paraCampo(d.toISOString());
};
const hora = (iso: string) => new Date(iso).toLocaleTimeString(localDoPainel(), { hour: "2-digit", minute: "2-digit" });
const diaDe = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/** "em 2 d 4 h", "em 35 min", "agora": quanto falta para a aula começar. */
function falta(iso: string, agora: number) {
  const minutos = Math.round((new Date(iso).getTime() - agora) / 60000);
  if (minutos <= 0) return "agora";
  if (minutos < 60) return `em ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `em ${horas} h ${minutos % 60 ? `${minutos % 60} min` : ""}`.trim();
  return `em ${Math.floor(horas / 24)} d ${horas % 24 ? `${horas % 24} h` : ""}`.trim();
}

interface Form {
  titulo: string;
  descricao: string;
  disciplina: string;
  trilha: string;
  inicio: string;
  duracao: number;
  sala_externa: string;
  gravacao: string;
}

/**
 * Marcar aulas ao vivo, chamar colegas e abrir a sala, no jeito de uma sala de transmissão: o que está no ar em
 * destaque, a contagem para a próxima, a agenda por dia e o que já passou (com a gravação). A agenda pública mostra o
 * que for marcado aqui.
 */
export function AulasAoVivo({ me }: { me: Me }) {
  const { lang, t } = useI18n();
  const lista = useLista<Aula[]>("aulas_ao_vivo_minhas");
  const acao = useAcao(lista.recarregar);
  const [editando, setEditando] = useState<Aula | "nova" | null>(null);
  const [agora, setAgora] = useState(() => Date.now());
  const [passadasAbertas, setPassadasAbertas] = useState(false);
  const nomeDaArea = (slug: string | null) => (slug ? (t.areas[slug as keyof typeof t.areas]?.[0] ?? slug) : "");
  const abrirSala = (id: string) => `/${lang}/ao-vivo/sala?aula=${id}`;

  useEffect(() => {
    const relogio = window.setInterval(() => setAgora(Date.now()), 30000);
    return () => window.clearInterval(relogio);
  }, []);

  const aulas = lista.dados ?? [];
  const noAr = aulas.filter((a) => a.status === "ao_vivo");
  const marcadas = aulas.filter((a) => a.status === "agendada").sort((a, b) => a.inicio.localeCompare(b.inicio));
  const proxima = marcadas[0];
  const passadas = aulas.filter((a) => a.status === "encerrada" || a.status === "cancelada").sort((a, b) => b.inicio.localeCompare(a.inicio));
  const porDia = marcadas.reduce<{ dia: string; aulas: Aula[] }[]>((grupos, aula) => {
    const chave = diaDe(aula.inicio);
    const grupo = grupos.find((g) => g.dia === chave);
    if (grupo) grupo.aulas.push(aula);
    else grupos.push({ dia: chave, aulas: [aula] });
    return grupos;
  }, []);
  const hoje = diaDe(new Date(agora).toISOString());
  const amanha = diaDe(new Date(agora + 86400000).toISOString());
  const nomeDoDia = (aula: Aula) => {
    const chave = diaDe(aula.inicio);
    if (chave === hoje) return "Hoje";
    if (chave === amanha) return "Amanhã";
    return new Date(aula.inicio).toLocaleDateString(localDoPainel(), { weekday: "long", day: "numeric", month: "long" });
  };
  const copiar = (aula: Aula) => void navigator.clipboard.writeText(`${window.location.origin}${abrirSala(aula.id)}`).then(() => acao.setAviso("Endereço da sala copiado."), () => acao.setAviso(`${window.location.origin}${abrirSala(aula.id)}`));
  const comecar = (aula: Aula) => void acao.agir("aula_ao_vivo_estado", { p_id: aula.id, p_status: "ao_vivo" }, "Aula começada: quem marcou presença foi avisado.");
  const encerrar = (aula: Aula) => {
    if (window.confirm("Encerrar a aula?")) void acao.agir("aula_ao_vivo_estado", { p_id: aula.id, p_status: "encerrada" }, "Aula encerrada. Se gravou, ponha o endereço da gravação.");
  };
  const cancelar = (aula: Aula) => {
    if (window.confirm("Cancelar a aula? Quem marcou presença será avisado.")) void acao.agir("aula_ao_vivo_estado", { p_id: aula.id, p_status: "cancelada" }, "Aula cancelada.");
  };
  const apagar = (aula: Aula) => {
    if (window.confirm("Apagar a aula e o bate-papo dela?")) void acao.agir("aula_ao_vivo_apagar", { p_id: aula.id }, "Aula apagada.");
  };
  const quem = (aula: Aula) => `${aula.educador.nome}${aula.co_educadores.length ? ` com ${aula.co_educadores.map((c) => c.nome).join(", ")}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-soft">
          O que você marcar aqui entra na hora na <a href={`/${lang}/ao-vivo`} target="_blank" rel="noopener noreferrer" className={elo}>agenda pública</a>. Na data, abra a sala e aperte “Começar a aula”: quem marcou presença recebe um recado.
        </p>
        <button type="button" className={`${botao} rounded-md`} onClick={() => setEditando("nova")}>
          + Marcar uma aula
        </button>
      </div>

      <Aviso texto={lista.erro || acao.aviso} />

      {noAr.map((aula) => (
        <section key={aula.id} aria-label="No ar agora" className="relative overflow-hidden rounded-xl border border-[#c21f16]/50 bg-gradient-to-br from-[#2b1511] via-[#1d1410] to-[#17130e] p-6 text-[#f3ead8] shadow-[0_0_0_4px_rgba(194,31,22,0.08)]">
          <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-[#c21f16]/30 blur-3xl" />
          <p className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.25em] text-[#ff5a4f]">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff5a4f] opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#ff5a4f]" />
            </span>
            Ao vivo agora
          </p>
          <h2 className="mt-2 font-serif text-3xl font-semibold leading-tight [text-wrap:balance]">{aula.titulo}</h2>
          <p className="mt-1 text-sm text-[#cdbb91]">
            {nomeDaArea(aula.disciplina)} · {quem(aula)} · desde {hora(aula.iniciada_em ?? aula.inicio)}
          </p>
          <dl className="mt-4 flex flex-wrap gap-6 text-sm">
            <div>
              <dt className="text-xs text-[#cdbb91]">Marcaram presença</dt>
              <dd className="font-serif text-2xl font-semibold">{aula.inscritos}</dd>
            </div>
            {typeof aula.mensagens === "number" && (
              <div>
                <dt className="text-xs text-[#cdbb91]">Mensagens no bate-papo</dt>
                <dd className="font-serif text-2xl font-semibold">{aula.mensagens}</dd>
              </div>
            )}
          </dl>
          <div className="mt-5 flex flex-wrap gap-3">
            <a href={abrirSala(aula.id)} target="_blank" rel="noopener noreferrer" className="rounded-md bg-[#c21f16] px-5 py-2.5 font-semibold text-white hover:bg-[#a51912]">Entrar na sala ↗</a>
            <button type="button" className="cursor-pointer rounded-md border border-[#cdbb91]/50 px-4 py-2.5 hover:border-[#f3ead8]" onClick={() => copiar(aula)}>Copiar o endereço</button>
            <button type="button" className="cursor-pointer rounded-md px-4 py-2.5 text-[#cdbb91] hover:text-[#f3ead8]" disabled={acao.ocupado} onClick={() => encerrar(aula)}>Encerrar a aula</button>
          </div>
        </section>
      ))}

      {proxima && noAr.length === 0 && (
        <section aria-label="Próxima aula" className="grid gap-4 rounded-xl border-2 border-ink bg-parchment-deep p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
          <div className="rounded-lg bg-ink px-5 py-4 text-center text-parchment">
            <p className="font-mono text-[0.65rem] uppercase tracking-widest opacity-80">Próxima aula</p>
            <p className="mt-1 font-serif text-2xl font-semibold">{falta(proxima.inicio, agora)}</p>
          </div>
          <div className="min-w-0">
            <p className={rotulo}>{nomeDoDia(proxima)} · {hora(proxima.inicio)} · {proxima.duracao} min · {nomeDaArea(proxima.disciplina)}</p>
            <h2 className="font-serif text-2xl font-semibold leading-snug">{proxima.titulo}</h2>
            <p className="text-sm text-ink-soft">{quem(proxima)} · {proxima.inscritos} {proxima.inscritos === 1 ? "pessoa marcou presença" : "pessoas marcaram presença"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={abrirSala(proxima.id)} target="_blank" rel="noopener noreferrer" className={`${botaoClaro} rounded-md py-1.5`}>Abrir a sala ↗</a>
              <button type="button" className={`${botao} rounded-md py-1.5`} disabled={acao.ocupado} onClick={() => comecar(proxima)}>Começar agora</button>
            </div>
          </div>
        </section>
      )}

      {lista.dados && aulas.length === 0 && (
        <div className="rounded-xl border border-dashed border-rule px-6 py-12 text-center">
          <p aria-hidden className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#c21f16] text-xl text-white">●</p>
          <p className="mt-4 font-serif text-2xl font-semibold">Nenhuma aula marcada</p>
          <p className="mx-auto mt-1 max-w-md text-ink-soft">Uma aula ao vivo junta a turma na mesma hora: vídeo, tela compartilhada, bate-papo e perguntas. Dá para chamar colegas para dar junto.</p>
          <button type="button" className={`${botao} mt-4 rounded-md`} onClick={() => setEditando("nova")}>Marcar a primeira</button>
        </div>
      )}

      {porDia.length > 0 && (
        <section aria-labelledby="agenda-titulo">
          <h2 id="agenda-titulo" className={rotulo}>Agenda</h2>
          <div className="mt-3 space-y-5">
            {porDia.map((grupo) => (
              <div key={grupo.dia} className="grid gap-3 sm:grid-cols-[9rem_minmax(0,1fr)]">
                <p className="font-serif text-lg font-semibold first-letter:uppercase sm:pt-3">{nomeDoDia(grupo.aulas[0])}</p>
                <ul className="space-y-2">
                  {grupo.aulas.map((aula) => (
                    <li key={aula.id} className="flex gap-3 rounded-lg border border-rule bg-parchment-deep p-3">
                      <div className="w-16 shrink-0 border-r border-rule pr-3 text-right">
                        <p className="font-mono text-sm font-semibold">{hora(aula.inicio)}</p>
                        <p className="text-xs text-ink-soft">{aula.duracao} min</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-ink-soft">{nomeDaArea(aula.disciplina)}{aula.sala_externa ? ` · sala em ${aula.sala_externa.includes(JITSI_DOMINIO) ? "Jitsi" : "outro site"}` : ""}</p>
                        <p className="font-semibold leading-snug">{aula.titulo}</p>
                        <p className="text-xs text-ink-soft">{quem(aula)} · {aula.inscritos} {aula.inscritos === 1 ? "presença" : "presenças"}</p>
                        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                          <a href={abrirSala(aula.id)} target="_blank" rel="noopener noreferrer" className={elo}>Abrir a sala ↗</a>
                          <button type="button" className={elo} onClick={() => setEditando(aula)}>Alterar</button>
                          <button type="button" className={elo} disabled={acao.ocupado} onClick={() => comecar(aula)}>Começar agora</button>
                          <button type="button" className={elo} onClick={() => copiar(aula)}>Copiar o endereço</button>
                          <button type="button" className={`${elo} text-ink-soft`} disabled={acao.ocupado} onClick={() => cancelar(aula)}>Cancelar</button>
                          {can(me, "coordenacao") && <button type="button" className={`${elo} text-oxblood`} disabled={acao.ocupado} onClick={() => apagar(aula)}>Apagar</button>}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {passadas.length > 0 && (
        <section aria-labelledby="passadas-titulo" className="border-t border-rule pt-5">
          <button type="button" id="passadas-titulo" className="flex cursor-pointer items-center gap-2 font-semibold" aria-expanded={passadasAbertas} onClick={() => setPassadasAbertas(!passadasAbertas)}>
            <span aria-hidden className={`transition-transform ${passadasAbertas ? "rotate-90" : ""}`}>▸</span>
            Já aconteceram ({passadas.length})
            {passadas.some((a) => a.status === "encerrada" && !a.gravacao) && <span className="rounded-sm bg-gold/25 px-1.5 text-xs">{passadas.filter((a) => a.status === "encerrada" && !a.gravacao).length} sem gravação</span>}
          </button>
          {passadasAbertas && (
            <ul className="mt-3 divide-y divide-rule border-y border-rule">
              {passadas.map((aula) => (
                <li key={aula.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
                  <span className="w-28 shrink-0 font-mono text-xs text-ink-soft">{dataHora(aula.inicio)}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`font-semibold ${aula.status === "cancelada" ? "line-through opacity-60" : ""}`}>{aula.titulo}</span>
                    <span className="text-ink-soft"> · {aula.status === "cancelada" ? "cancelada" : `${aula.inscritos} ${aula.inscritos === 1 ? "presença" : "presenças"}`}</span>
                  </span>
                  <span className="flex flex-wrap gap-x-3">
                    {aula.status === "encerrada" && (aula.gravacao ? <a href={aula.gravacao} target="_blank" rel="noopener noreferrer" className={elo}>Gravação ↗</a> : <button type="button" className={elo} onClick={() => setEditando(aula)}>Pôr a gravação</button>)}
                    {(aula.status === "cancelada" || can(me, "coordenacao")) && <button type="button" className={`${elo} text-oxblood`} disabled={acao.ocupado} onClick={() => apagar(aula)}>Apagar</button>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {editando && <Marcar me={me} aula={editando === "nova" ? null : editando} fechar={() => setEditando(null)} depois={lista.recarregar} />}
    </div>
  );
}

/** Marcar ou alterar uma aula, numa gaveta lateral, com a prévia de como ela aparece na agenda pública. */
function Marcar({ me, aula, fechar, depois }: { me: Me; aula: Aula | null; fechar: () => void; depois: () => void }) {
  const { lang, t } = useI18n();
  const tracks = useTrackOptions(lang);
  const membros = useLista<Membro[]>("equipe_membros", {}, { quieta: true });
  const acao = useAcao(depois);
  const minhasDisciplinas = [...new Set(me.papeis.filter((p) => p.papel === "educacao" || p.papel === "educacao_secundaria").map((p) => p.disciplina).filter(Boolean))] as string[];
  const disciplinas = can(me, "coordenacao") || minhasDisciplinas.length === 0 ? [...areaSlugs] : minhasDisciplinas;
  const [form, setForm] = useState<Form>(() =>
    aula
      ? { titulo: aula.titulo, descricao: aula.descricao, disciplina: aula.disciplina, trilha: aula.trilha ?? "", inicio: paraCampo(aula.inicio), duracao: aula.duracao, sala_externa: aula.sala_externa, gravacao: aula.gravacao }
      : { titulo: "", descricao: "", disciplina: disciplinas[0] ?? "", trilha: "", inicio: daquiAUmaHora(), duracao: 60, sala_externa: "", gravacao: "" },
  );
  const [colegas, setColegas] = useState<PessoaAchada[]>(() => (aula ? aula.co_educadores.map((c) => ({ id: c.id, nome: c.nome, email: "" })) : []));
  const nomeDaArea = (slug: string | null) => (slug ? (t.areas[slug as keyof typeof t.areas]?.[0] ?? slug) : "");
  const ensina = (m: Membro) => m.papeis.some((p) => ["educacao", "educacao_secundaria", "mentoria", "coordenacao", "vice"].includes(p.papel));
  const funcoes = (m: Membro) => [...new Set(m.papeis.map((p) => `${papeis[p.papel]}${p.disciplina ? ` de ${nomeDaArea(p.disciplina)}` : ""}`))].join(", ");
  const candidatos = (membros.dados ?? []).filter((m) => !m.eu && ensina(m) && !colegas.some((c) => c.id === m.id)).map((m) => ({ id: m.id, nome: m.nome, email: funcoes(m) }));
  const mudar = <K extends keyof Form>(chave: K, valor: Form[K]) => setForm((f) => ({ ...f, [chave]: valor }));
  const trilhas = tracks.filter((x) => x.area === form.disciplina);
  const passou = aula && (aula.status === "encerrada" || aula.status === "cancelada");
  const inicio = new Date(form.inicio);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [fechar]);

  async function guardar() {
    if (Number.isNaN(inicio.getTime())) return acao.setAviso("Confira a data e a hora.");
    const ok = await acao.agir(
      "aula_ao_vivo_salvar",
      { p_id: aula?.id ?? null, p: { ...form, inicio: inicio.toISOString(), trilha: form.trilha || null, co_educadores: colegas.map((c) => c.id) } },
      aula ? "Aula alterada." : "Aula marcada: já aparece na agenda pública. Os colegas chamados receberam o recado.",
    );
    if (ok) fechar();
  }

  // No body: a área de conteúdo do painel tem transform (da animação de entrada), que prenderia o "fixed" dentro dela.
  return createPortal(
    <div className="fixed inset-0 z-[90] flex justify-end bg-[rgba(23,19,14,0.4)]" onPointerDown={(e) => e.target === e.currentTarget && fechar()}>
      <aside role="dialog" aria-modal="true" aria-label={aula ? "Alterar a aula" : "Marcar uma aula"} className="flex h-full w-full max-w-2xl flex-col border-l-2 border-ink bg-parchment text-ink shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3">
          <h2 className="font-serif text-xl font-semibold">{passou ? "Depois da aula" : aula ? "Alterar a aula" : "Marcar uma aula"}</h2>
          <button type="button" onClick={fechar} aria-label="Fechar" className="cursor-pointer px-2 text-2xl leading-none text-ink-soft hover:text-ink">×</button>
        </div>
        <form className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5" onSubmit={(e) => { e.preventDefault(); void guardar(); }}>
          <div className="rounded-lg border border-rule bg-parchment-deep p-4" aria-label="Como aparece na agenda pública">
            <p className="font-mono text-[0.6rem] uppercase tracking-widest text-ink-soft">Como aparece na agenda pública</p>
            <div className="mt-2 flex gap-3">
              <div className="w-14 shrink-0 rounded-md bg-ink py-2 text-center text-parchment">
                <p className="text-[0.6rem] uppercase">{Number.isNaN(inicio.getTime()) ? "—" : inicio.toLocaleDateString(localDoPainel(), { month: "short" })}</p>
                <p className="font-serif text-xl font-semibold leading-none">{Number.isNaN(inicio.getTime()) ? "" : inicio.getDate()}</p>
              </div>
              <div className="min-w-0">
                <p className="text-xs text-ink-soft">{nomeDaArea(form.disciplina)} · {Number.isNaN(inicio.getTime()) ? "" : hora(inicio.toISOString())} · {form.duracao} min</p>
                <p className="font-serif text-lg font-semibold leading-snug">{form.titulo || "Título da aula"}</p>
                {form.descricao && <p className="line-clamp-2 text-sm text-ink-soft">{form.descricao}</p>}
              </div>
            </div>
          </div>

          {!passou && (
            <>
              <label className="block font-semibold">
                Título
                <input value={form.titulo} onChange={(e) => mudar("titulo", e.target.value)} maxLength={140} required className={campo} />
              </label>
              <label className="block font-semibold">
                Sobre a aula
                <span className="block text-xs font-normal text-ink-soft">O que vai ser visto, para quem é, o que levar.</span>
                <textarea value={form.descricao} onChange={(e) => mudar("descricao", e.target.value)} rows={3} maxLength={2000} className={campo} />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block font-semibold">
                  Disciplina
                  <select value={form.disciplina} onChange={(e) => { mudar("disciplina", e.target.value); mudar("trilha", ""); }} className={campo}>
                    {disciplinas.map((area) => (
                      <option key={area} value={area}>{nomeDaArea(area)}</option>
                    ))}
                  </select>
                </label>
                <label className="block font-semibold">
                  Trilha (opcional)
                  <select value={form.trilha} onChange={(e) => mudar("trilha", e.target.value)} className={campo}>
                    <option value="">Nenhuma</option>
                    {trilhas.map((x) => (
                      <option key={x.slug} value={x.slug}>{x.title}</option>
                    ))}
                  </select>
                </label>
                <label className="block font-semibold">
                  Data e hora
                  <input type="datetime-local" value={form.inicio} onChange={(e) => mudar("inicio", e.target.value)} required className={campo} />
                </label>
                <div>
                  <p className="font-semibold">Duração</p>
                  <div className="mt-1 flex flex-wrap gap-1" role="group" aria-label="Duração">
                    {[30, 45, 60, 90, 120].map((min) => (
                      <button key={min} type="button" aria-pressed={form.duracao === min} onClick={() => mudar("duracao", min)} className={`cursor-pointer rounded-md border px-2.5 py-2 text-sm ${form.duracao === min ? "border-ink bg-ink text-parchment" : "border-rule hover:border-ink"}`}>
                        {min < 60 ? `${min} min` : `${min / 60} h${min % 60 ? " 30" : ""}`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <fieldset className="rounded-lg border border-rule p-4">
                <legend className="px-1 font-semibold">Dar a aula junto com (opcional)</legend>
                <p className="text-sm text-ink-soft">Quem for chamado recebe o recado na hora e também conduz a sala. Até oito.</p>
                {colegas.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {colegas.map((pessoa) => (
                      <li key={pessoa.id} className="flex items-center gap-2 rounded-full border border-ink bg-parchment-deep py-1 pl-3 pr-2 text-sm">
                        <strong>{pessoa.nome}</strong>
                        <button type="button" className="cursor-pointer text-ink-soft hover:text-oxblood" aria-label={`Tirar ${pessoa.nome}`} onClick={() => setColegas(colegas.filter((c) => c.id !== pessoa.id))}>✕</button>
                      </li>
                    ))}
                  </ul>
                )}
                {colegas.length < 8 && (
                  <div className="mt-2 max-w-md">
                    <BuscaDePessoa rotulo="Chamar colega" entre={candidatos} escolhida={null} escolher={(pessoa) => pessoa && setColegas([...colegas, pessoa])} />
                  </div>
                )}
              </fieldset>

              <div>
                <p className="font-semibold">Sala de vídeo</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <button type="button" aria-pressed={!form.sala_externa} onClick={() => mudar("sala_externa", "")} className={`cursor-pointer rounded-lg border-2 p-3 text-left ${!form.sala_externa ? "border-ink bg-parchment-deep" : "border-rule hover:border-ink-soft"}`}>
                    <span className="block text-sm font-semibold">Sala do site</span>
                    <span className="block text-xs text-ink-soft">O vídeo vai direto do seu navegador para cada pessoa. Boa para turma pequena.</span>
                  </button>
                  <button type="button" aria-pressed={Boolean(form.sala_externa)} onClick={() => !form.sala_externa && mudar("sala_externa", novaSalaJitsi())} className={`cursor-pointer rounded-lg border-2 p-3 text-left ${form.sala_externa ? "border-ink bg-parchment-deep" : "border-rule hover:border-ink-soft"}`}>
                    <span className="block text-sm font-semibold">Sala no Jitsi</span>
                    <span className="block text-xs text-ink-soft">Recomendada para turma grande. Abre dentro da página da aula, com nome sorteado.</span>
                  </button>
                </div>
                {form.sala_externa && (
                  <label className="mt-2 block text-sm">
                    Endereço da sala
                    <input value={form.sala_externa} onChange={(e) => mudar("sala_externa", e.target.value)} placeholder="https://" maxLength={500} className={`${campo} font-mono text-sm`} />
                    <span className="mt-1 block text-xs text-ink-soft">A sala em {JITSI_DOMINIO} abre dentro da página; outro endereço (Meet etc.) abre fora do site.</span>
                  </label>
                )}
              </div>
            </>
          )}

          {aula && aula.status !== "agendada" && (
            <label className="block font-semibold">
              Gravação
              <span className="block text-xs font-normal text-ink-soft">O endereço do vídeo, depois da aula (opcional). Aparece na agenda para quem não pôde vir.</span>
              <input value={form.gravacao} onChange={(e) => mudar("gravacao", e.target.value)} placeholder="https://… ou /pt/videoaulas…" maxLength={500} className={`${campo} font-mono text-sm`} />
            </label>
          )}

          <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-4">
            <button type="submit" className={`${botao} rounded-md`} disabled={acao.ocupado || form.titulo.trim().length < 3}>{aula ? "Guardar" : "Marcar a aula"}</button>
            <button type="button" className={elo} onClick={fechar}>Cancelar</button>
          </div>
          <Aviso texto={acao.aviso || membros.erro} />
        </form>
      </aside>
    </div>,
    document.body,
  );
}

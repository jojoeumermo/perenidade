// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { fill, htmlLang, localePath } from "@/i18n/config";
import { errorText } from "@/i18n/core";
import type { Dict } from "@/i18n/types";
import { areaSlugs } from "@/lib/areas";
import { type Aula, calendario } from "@/lib/aovivo";
import { BackendError, hasBackend, rpc, useMe } from "@/lib/backend";
import { useSinal } from "@/lib/tempo-real";
import { EstadoVazio } from "../EstadoVazio";
import { L, useI18n } from "../I18n";

export type LiveStrings = Dict["live"];

const botao = "cursor-pointer bg-ink px-5 py-2 font-sans text-sm font-semibold text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";
const claro = "cursor-pointer border-2 border-ink px-4 py-1.5 font-sans text-sm font-semibold hover:border-oxblood hover:text-oxblood disabled:cursor-not-allowed disabled:opacity-50";

export const estaAoVivo = (aula: Aula) => aula.status === "ao_vivo";
export const comecaEmBreve = (aula: Aula) => aula.status === "agendada" && new Date(aula.inicio).getTime() - Date.now() < 30 * 60_000;

function baixarCalendario(aula: Aula, endereco: string) {
  const blob = new Blob([calendario(aula, endereco)], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${aula.titulo.toLowerCase().replace(/[^a-z0-9]+/gi, "-").slice(0, 50)}.ics`;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

/** Um cartão da agenda: quando, quem, quantos, e o botão de entrar (ou de marcar presença). */
export function CartaoDeAula({ aula, s, recarregar, aberto = false }: { aula: Aula; s: LiveStrings; recarregar: () => void; aberto?: boolean }) {
  const { lang, t } = useI18n();
  const me = useMe();
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const quando = new Intl.DateTimeFormat(htmlLang[lang], { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  const nomeDaArea = t.areas[aula.disciplina as keyof typeof t.areas]?.[0] ?? aula.disciplina;
  const pessoas = [aula.educador.nome, ...aula.co_educadores.map((c) => c.nome)].filter(Boolean).join(", ");
  const endereco = typeof window === "undefined" ? "" : `${window.location.origin}${localePath(lang, `/ao-vivo/sala?aula=${aula.id}`)}`;
  const vivo = estaAoVivo(aula);

  async function marcar() {
    setOcupado(true);
    setAviso("");
    try {
      await rpc("aula_ao_vivo_inscrever", { p_id: aula.id, p_inscrever: !aula.inscrito });
      recarregar();
    } catch (erro) {
      setAviso(errorText(t, erro instanceof BackendError ? erro.code : "falha"));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <article className={`border-2 p-4 sm:p-5 ${vivo ? "border-[#c21f16] bg-parchment" : "border-rule bg-parchment-deep"}`}>
      <p className="flex flex-wrap items-center gap-2 font-mono text-xs uppercase tracking-widest text-gold">
        {vivo && <span className="flex items-center gap-1.5 bg-[#c21f16] px-1.5 py-0.5 text-white"><span aria-hidden className="painel-pulso inline-block h-2 w-2 rounded-full bg-white" />{s.liveNow}</span>}
        {aula.status === "encerrada" && <span className="bg-ink px-1.5 py-0.5 text-parchment">{s.recorded}</span>}
        <span>{nomeDaArea}</span>
        <span>· {fill(s.minutes, { n: aula.duracao })}</span>
      </p>
      <h3 className="mt-2 font-serif text-2xl font-semibold leading-tight">
        {aberto ? aula.titulo : <L href={`/ao-vivo/sala?aula=${aula.id}`} className="hover:text-oxblood">{aula.titulo}</L>}
      </h3>
      <p className="mt-1 font-sans text-sm text-ink-soft">
        <time dateTime={aula.inicio}>{quando.format(new Date(aula.inicio))}</time> · {fill(s.with, { names: pessoas })}
        {aula.inscritos > 0 && ` · ${fill(s.registered, { n: aula.inscritos })}`}
      </p>
      {aula.descricao && !aberto && <p className="mt-2 font-sans text-sm leading-relaxed">{aula.descricao}</p>}
      {!aberto && (
        <div className="mt-4 flex flex-wrap items-center gap-3 font-sans text-sm">
          {aula.status === "encerrada" && aula.gravacao ? (
            <a href={aula.gravacao} target={aula.gravacao.startsWith("/") ? undefined : "_blank"} rel="noopener noreferrer" className={botao}>{s.watchRecording}</a>
          ) : (
            <L href={`/ao-vivo/sala?aula=${aula.id}`} className={vivo || comecaEmBreve(aula) ? botao : claro}>{vivo ? s.enter : s.openRoom}</L>
          )}
          {aula.status === "agendada" && hasBackend && me.status === "in" && (
            <button type="button" className={claro} disabled={ocupado} onClick={() => void marcar()}>{aula.inscrito ? s.unregister : s.register}</button>
          )}
          {aula.status === "agendada" && <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => baixarCalendario(aula, endereco)}>{s.addToCalendar}</button>}
          {aviso && <span role="alert" className="text-oxblood">{aviso}</span>}
        </div>
      )}
    </article>
  );
}

/** A agenda pública das aulas ao vivo: o que está acontecendo agora, o que vem e as gravações recentes. */
export function Agenda({ s }: { s: LiveStrings }) {
  const { lang, t } = useI18n();
  const [aulas, setAulas] = useState<Aula[] | null>(null);
  const [erro, setErro] = useState("");
  const [disciplina, setDisciplina] = useState("");
  const [tick, setTick] = useState(0);
  const recarregar = () => setTick((n) => n + 1);
  useSinal(recarregar, ["aula_ao_vivo"]);

  useEffect(() => {
    if (!hasBackend) return;
    let cancelado = false;
    rpc<Aula[]>("aulas_ao_vivo_listar", { p_disciplina: disciplina || null })
      .then((lista) => {
        if (!cancelado) setAulas(lista);
      })
      .catch((e: unknown) => {
        if (!cancelado) setErro(errorText(t, e instanceof BackendError ? e.code : "falha"));
      });
    const relogio = window.setInterval(() => {
      if (document.visibilityState === "visible") recarregar();
    }, 60_000);
    return () => {
      cancelado = true;
      window.clearInterval(relogio);
    };
  }, [disciplina, tick, t]);

  if (!hasBackend) return <p className="mt-10 text-lg text-ink-soft">{s.offline}</p>;

  const agora = (aulas ?? []).filter(estaAoVivo);
  const proximas = (aulas ?? []).filter((a) => a.status === "agendada");
  const gravadas = (aulas ?? []).filter((a) => a.status === "encerrada");
  const dia = new Intl.DateTimeFormat(htmlLang[lang], { weekday: "long", day: "numeric", month: "long" });
  const porDia = proximas.reduce<Record<string, Aula[]>>((grupos, aula) => {
    const chave = dia.format(new Date(aula.inicio));
    (grupos[chave] ??= []).push(aula);
    return grupos;
  }, {});

  return (
    <div className="mt-8 font-sans text-sm">
      <label className="block max-w-xs">
        {s.filter}
        <select value={disciplina} onChange={(e) => setDisciplina(e.target.value)} className="mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2">
          <option value="">{s.all}</option>
          {areaSlugs.map((area) => (
            <option key={area} value={area}>{t.areas[area][0]}</option>
          ))}
        </select>
      </label>
      {erro && <p role="alert" className="mt-4 text-oxblood">{erro}</p>}
      {aulas === null && !erro && <p className="mt-6 font-mono text-xs text-ink-soft">{t.common.loading}</p>}
      {aulas && aulas.length === 0 && <EstadoVazio textos={t.lists.empty.aoVivo} acaoHref="/voluntarios" relacionadoHref="/videoaulas" />}
      {agora.length === 0 && proximas[0] && (
        <section className="mt-6 border-2 border-ink bg-parchment-deep p-4">
          <p className="jornal-editoria">{t.lists.nextLive}</p>
          <p className="mt-2 font-serif text-2xl font-semibold leading-tight">{proximas[0].titulo}</p>
          <p className="mt-1 text-ink-soft">{dia.format(new Date(proximas[0].inicio))} · {new Intl.DateTimeFormat(htmlLang[lang], { hour: "2-digit", minute: "2-digit" }).format(new Date(proximas[0].inicio))} · {t.areas[proximas[0].disciplina as keyof typeof t.areas]?.[0] ?? proximas[0].disciplina}</p>
        </section>
      )}

      {agora.length > 0 && (
        <section className="mt-8">
          <h2 className="jornal-secao"><span className="jornal-editoria">{s.liveNow}</span></h2>
          <div className="mt-4 grid gap-4">{agora.map((aula) => <CartaoDeAula key={aula.id} aula={aula} s={s} recarregar={recarregar} />)}</div>
        </section>
      )}
      {Object.entries(porDia).map(([nome, lista]) => (
        <section key={nome} className="mt-8">
          <h2 className="jornal-secao"><span className="jornal-editoria">{nome}</span></h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">{lista.map((aula) => <CartaoDeAula key={aula.id} aula={aula} s={s} recarregar={recarregar} />)}</div>
        </section>
      ))}
      {gravadas.length > 0 && (
        <section className="mt-8">
          <h2 className="jornal-secao"><span className="jornal-editoria">{s.recordings}</span></h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">{gravadas.map((aula) => <CartaoDeAula key={aula.id} aula={aula} s={s} recarregar={recarregar} />)}</div>
        </section>
      )}
      <p className="mt-10 border-t border-rule pt-5 text-ink-soft">{s.howItWorks}</p>
    </div>
  );
}

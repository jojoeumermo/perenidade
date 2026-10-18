// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { areaSlugs, groups, stageAreas, type Stage } from "@/lib/areas";
import { can, type Me } from "@/lib/backend";
import { useI18n } from "../I18n";
import { useTrackOptions } from "../useTrackOptions";
import { Abas, Aviso, botao, botaoClaro, campo, dataHora, elo, rotulo, useAcao, useLista } from "./comum";

interface Proposta {
  id: string;
  tipo: "disciplina" | "trilha" | "editar_disciplina" | "editar_trilha" | "remover_disciplina" | "remover_trilha";
  dados: Record<string, unknown>;
  status: "pendente" | "aprovada" | "recusada" | "aplicada" | "falhou";
  nota: string;
  criado_em: string;
  decidido_em: string | null;
  aplicada_em: string | null;
  autor: string;
  minha: boolean;
}
const TIPOS: Record<Proposta["tipo"], string> = { disciplina: "Nova disciplina", trilha: "Nova trilha", editar_disciplina: "Editar disciplina", editar_trilha: "Editar trilha", remover_disciplina: "Remover disciplina", remover_trilha: "Remover trilha" };
const SITUACOES: Record<Proposta["status"], string> = { pendente: "esperando decisão", aprovada: "aprovada: entra na próxima publicação (de hora em hora)", recusada: "recusada", aplicada: "no site", falhou: "a aplicação recusou (veja o motivo)" };
const IDIOMAS: [string, string][] = [["pt", "Português"], ["en", "Inglês"], ["es", "Espanhol"], ["ru", "Russo"], ["zh", "Chinês"]];
const slugDe = (t: string) => t.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

/**
 * Disciplinas e trilhas pelo painel, sem depender de ninguém: a coordenação e a coordenação pedagógica criam, editam e
 * removem (a mudança é aplicada aos arquivos do site pela rotina de publicação, de hora em hora, e o build confere);
 * qualquer voluntário sugere, e a sugestão espera a decisão.
 */
export function Curriculo({ me }: { me: Me }) {
  const { t, lang } = useI18n();
  const decide = can(me, "coordenacao", "vice");
  const tracks = useTrackOptions(lang);
  const propostas = useLista<Proposta[]>("curriculo_listar");
  const acao = useAcao(propostas.recarregar);
  const [aba, setAba] = useState<"mapa" | "nova" | "propostas">("mapa");
  const [form, setForm] = useState<{ tipo: Proposta["tipo"]; slug: string; grupo: string; etapas: Stage[]; nomes: Record<string, string>; descricoes: Record<string, string>; disciplina: string; titulo: string; etapa: Stage; ordem: number; resumo: string; aulas: string; intro: string }>({ tipo: "disciplina", slug: "", grupo: "humanidades", etapas: ["medio"], nomes: {}, descricoes: {}, disciplina: areaSlugs[0], titulo: "", etapa: "medio", ordem: 1, resumo: "", aulas: "", intro: "" });
  const nomeDaArea = (slug: string) => t.areas[slug as keyof typeof t.areas]?.[0] ?? slug;
  const pendentes = (propostas.dados ?? []).filter((p) => p.status === "pendente").length;
  const preparar = (parcial: Partial<typeof form>) => { setForm((f) => ({ ...f, ...parcial })); setAba("nova"); };

  async function enviar() {
    const dados: Record<string, unknown> = { slug: form.slug };
    if (form.tipo === "disciplina" || form.tipo === "editar_disciplina") Object.assign(dados, { grupo: form.grupo, etapas: form.etapas, nomes: form.nomes, descricoes: form.descricoes });
    if (form.tipo === "trilha" || form.tipo === "editar_trilha") Object.assign(dados, { disciplina: form.disciplina, titulo: form.titulo, etapa: form.etapa, ordem: form.ordem, resumo: form.resumo, intro: form.intro, aulas: form.aulas.split("\n").map((x) => x.trim()).filter(Boolean) });
    const r = await acao.agir("curriculo_propor", { p_tipo: form.tipo, p_dados: dados }, decide ? "Feito: entra no site na próxima publicação (de hora em hora). Se a aplicação encontrar um problema, aparece em Propostas." : "Sugestão enviada: a coordenação foi avisada.");
    if (r) setAba("propostas");
  }
  const disc = form.tipo === "disciplina" || form.tipo === "editar_disciplina";
  const trilhaForm = form.tipo === "trilha" || form.tipo === "editar_trilha";

  return (
    <div>
      <Abas atual={aba} escolher={setAba} opcoes={[{ id: "mapa" as const, nome: "Disciplinas e trilhas" }, { id: "nova" as const, nome: decide ? "Criar ou mudar" : "Sugerir" }, { id: "propostas" as const, nome: "Propostas", conta: decide ? pendentes : undefined }]} />
      <Aviso texto={propostas.erro || acao.aviso} />
      <div hidden={aba !== "mapa"}>
        <p className="text-ink-soft">{decide ? "Clique para editar ou remover. O que você criar ou mudar entra no site na próxima publicação automática (de hora em hora); nomes e trilhas novas saem em português e, nos outros idiomas, com o texto que você escrever (ou o português, até a tradução)." : "Veja o que existe e sugira o que falta: a coordenação decide."}</p>
        {groups.map((g) => (
          <section key={g.id} className="mt-6">
            <h2 className="jornal-secao"><span className="jornal-editoria">{t.groups[g.id]}</span></h2>
            <ul className="mt-3 grid gap-2 md:grid-cols-2">
              {g.areas.map((slug) => {
                const trilhas = tracks.filter((x) => x.area === slug);
                return (
                  <li key={slug} className="painel-cartao p-3">
                    <p className="flex items-start justify-between gap-2">
                      <span><strong>{nomeDaArea(slug)}</strong> <span className="font-mono text-xs text-ink-soft">{slug}</span><br /><span className="text-xs text-ink-soft">{(Object.keys(stageAreas) as Stage[]).filter((e) => (stageAreas[e] as readonly string[]).includes(slug)).join(", ") || "sem etapa"} · {trilhas.length} trilha(s)</span></span>
                      <span className="flex shrink-0 gap-2 text-xs">
                        <button type="button" className={elo} onClick={() => preparar({ tipo: "editar_disciplina", slug, nomes: { pt: nomeDaArea(slug) }, descricoes: { pt: t.areas[slug as keyof typeof t.areas]?.[1] ?? "" } })}>editar</button>
                        <button type="button" className={elo} onClick={() => preparar({ tipo: "trilha", disciplina: slug, slug: "", titulo: "", aulas: "" })}>+ trilha</button>
                        {trilhas.length === 0 && <button type="button" className={`${elo} text-oxblood`} onClick={() => { if (window.confirm(`Remover a disciplina ${nomeDaArea(slug)}?`)) void acao.agir("curriculo_propor", { p_tipo: "remover_disciplina", p_dados: { slug } }, decide ? "Remoção marcada: sai na próxima publicação." : "Sugestão enviada."); }}>remover</button>}
                      </span>
                    </p>
                    {trilhas.length > 0 && (
                      <ul className="mt-2 space-y-1 border-t border-rule pt-2 text-xs">
                        {trilhas.map((x) => (
                          <li key={x.slug} className="flex items-start justify-between gap-2">
                            <span>{x.title} <span className="text-ink-soft">· {x.stage ?? "?"} · {x.plan?.filter((p) => p.ready).length ?? 0}/{x.plan?.length ?? 0} aulas</span></span>
                            <span className="flex shrink-0 gap-2">
                              <button type="button" className={elo} onClick={() => preparar({ tipo: "editar_trilha", slug: x.slug, disciplina: x.area, titulo: x.title, resumo: x.summary ?? "", etapa: (x.stage ?? "medio") as Stage, aulas: (x.plan ?? []).map((p) => p.title).join("\n") })}>editar</button>
                              {(x.plan?.filter((p) => p.ready).length ?? 0) === 0 && <button type="button" className={`${elo} text-oxblood`} onClick={() => { if (window.confirm(`Remover a trilha “${x.title}”?`)) void acao.agir("curriculo_propor", { p_tipo: "remover_trilha", p_dados: { slug: x.slug } }, decide ? "Remoção marcada: sai na próxima publicação." : "Sugestão enviada."); }}>remover</button>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <div hidden={aba !== "nova"}>
        <section className="painel-cartao max-w-3xl p-5">
          <label className="block">O que fazer
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value as Proposta["tipo"] })} className={campo}>
              {(["disciplina", "trilha", "editar_disciplina", "editar_trilha"] as const).map((k) => <option key={k} value={k}>{TIPOS[k]}</option>)}
            </select>
          </label>
          {disc && (
            <>
              {form.tipo === "disciplina" ? (
                <label className="mt-3 block">Nome em português<input value={form.nomes.pt ?? ""} onChange={(e) => setForm({ ...form, nomes: { ...form.nomes, pt: e.target.value }, slug: slugDe(e.target.value) })} maxLength={60} className={campo} /></label>
              ) : (
                <p className="mt-3 font-mono text-xs text-ink-soft">{form.slug}</p>
              )}
              <label className="mt-2 block">Identificador (slug, só letras minúsculas, números e hífen)<input value={form.slug} disabled={form.tipo !== "disciplina"} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} maxLength={60} className={`${campo} font-mono`} /></label>
              {form.tipo === "disciplina" && (
                <>
                  <label className="mt-2 block">Grupo<select value={form.grupo} onChange={(e) => setForm({ ...form, grupo: e.target.value })} className={campo}>{groups.map((g) => <option key={g.id} value={g.id}>{t.groups[g.id]}</option>)}</select></label>
                  <fieldset className="mt-2"><legend className="text-sm">Etapas</legend>
                    {(["fundamental", "medio", "superior"] as Stage[]).map((e) => <label key={e} className="mr-4 inline-flex items-center gap-1"><input type="checkbox" checked={form.etapas.includes(e)} onChange={(ev) => setForm({ ...form, etapas: ev.target.checked ? [...form.etapas, e] : form.etapas.filter((x) => x !== e) })} />{t.stages[e]}</label>)}
                  </fieldset>
                </>
              )}
              <p className={`${rotulo} mt-4`}>Nome e descrição por idioma {form.tipo === "disciplina" ? "(o português é obrigatório; os outros podem ficar para depois)" : "(preencha só o que quer mudar)"}</p>
              {IDIOMAS.map(([k, nome]) => (
                <div key={k} className="mt-2 grid gap-2 sm:grid-cols-[8rem_1fr]">
                  <span className="pt-2 text-xs text-ink-soft">{nome}</span>
                  <span>
                    {(k !== "pt" || form.tipo !== "disciplina") && <input value={form.nomes[k] ?? ""} onChange={(e) => setForm({ ...form, nomes: { ...form.nomes, [k]: e.target.value } })} placeholder="Nome" maxLength={60} className={campo} />}
                    <input value={form.descricoes[k] ?? ""} onChange={(e) => setForm({ ...form, descricoes: { ...form.descricoes, [k]: e.target.value } })} placeholder="Descrição em uma frase" maxLength={300} className={campo} />
                  </span>
                </div>
              ))}
            </>
          )}
          {trilhaForm && (
            <>
              <label className="mt-3 block">Disciplina<select value={form.disciplina} onChange={(e) => setForm({ ...form, disciplina: e.target.value })} className={campo}>{areaSlugs.map((s) => <option key={s} value={s}>{nomeDaArea(s)}</option>)}</select></label>
              <label className="mt-2 block">Título da trilha<input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value, slug: form.tipo === "trilha" ? slugDe(e.target.value) : form.slug })} maxLength={120} className={campo} /></label>
              <label className="mt-2 block">Identificador (slug)<input value={form.slug} disabled={form.tipo === "editar_trilha"} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} maxLength={60} className={`${campo} font-mono`} /></label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="block">Etapa<select value={form.etapa} onChange={(e) => setForm({ ...form, etapa: e.target.value as Stage })} className={campo}>{(["fundamental", "medio", "superior"] as Stage[]).map((e) => <option key={e} value={e}>{t.stages[e]}</option>)}</select></label>
                <label className="block">Ordem dentro da etapa<input type="number" min={1} max={99} value={form.ordem} onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) || 1 })} className={campo} /></label>
              </div>
              <label className="mt-2 block">Resumo (uma frase)<input value={form.resumo} onChange={(e) => setForm({ ...form, resumo: e.target.value })} maxLength={220} className={campo} /></label>
              <label className="mt-2 block">Roteiro: uma aula por linha, na ordem{form.tipo === "editar_trilha" ? " (aulas já escritas nunca saem)" : ""}<textarea value={form.aulas} onChange={(e) => setForm({ ...form, aulas: e.target.value })} rows={8} className={campo} /></label>
              {form.tipo === "trilha" && <label className="mt-2 block">Apresentação da trilha (opcional, Markdown)<textarea value={form.intro} onChange={(e) => setForm({ ...form, intro: e.target.value })} rows={4} maxLength={4000} className={campo} /></label>}
            </>
          )}
          <p className="mt-4 flex gap-3">
            <button type="button" className={botao} disabled={acao.ocupado || !/^[a-z0-9][a-z0-9-]{1,59}$/.test(form.slug)} onClick={() => void enviar()}>{decide ? "Aplicar na próxima publicação" : "Enviar a sugestão"}</button>
            <button type="button" className={botaoClaro} onClick={() => setAba("mapa")}>Voltar</button>
          </p>
          <p className="mt-2 text-xs text-ink-soft">A mudança é escrita nos arquivos do site pela rotina de publicação, de hora em hora, e o build confere tudo antes de ir ao ar. Nada é apagado: uma disciplina só sai se não tiver trilhas, e uma trilha só sai se não tiver aulas escritas.</p>
        </section>
      </div>
      <div hidden={aba !== "propostas"}>
        {(propostas.dados ?? []).length === 0 && <p className="text-ink-soft">Nenhuma proposta ainda.</p>}
        <ul className="space-y-3">
          {(propostas.dados ?? []).map((p) => (
            <li key={p.id} className="painel-cartao p-4">
              <p className="font-mono text-[0.65rem] uppercase tracking-widest text-ink-soft">{TIPOS[p.tipo]} · {p.autor}{p.minha ? " (você)" : ""} · {dataHora(p.criado_em)}</p>
              <p className="mt-1 font-semibold">{String((p.dados.nomes as Record<string, string> | undefined)?.pt ?? p.dados.titulo ?? p.dados.slug)} <span className="font-mono text-xs text-ink-soft">{String(p.dados.slug)}</span></p>
              <p className={`text-sm ${p.status === "falhou" || p.status === "recusada" ? "text-oxblood" : "text-ink-soft"}`}>{SITUACOES[p.status]}{p.nota ? ` — ${p.nota}` : ""}</p>
              {Array.isArray(p.dados.aulas) && <p className="mt-1 text-xs text-ink-soft">{(p.dados.aulas as string[]).length} aula(s) no roteiro</p>}
              {decide && p.status === "pendente" && (
                <p className="mt-2 flex gap-2">
                  <button type="button" className={botao} disabled={acao.ocupado} onClick={() => acao.agir("curriculo_decidir", { p_id: p.id, p_aprovar: true }, "Aprovada: entra na próxima publicação.")}>Aprovar</button>
                  <button type="button" className={botaoClaro} disabled={acao.ocupado} onClick={() => { const nota = window.prompt("Motivo (vai para quem propôs):", "") ?? ""; void acao.agir("curriculo_decidir", { p_id: p.id, p_aprovar: false, p_nota: nota }, "Recusada."); }}>Recusar</button>
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

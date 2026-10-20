// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { areaSlugs, groups, stageAreas, type Stage } from "@/lib/areas";
import { can, disciplinasQueEnsina, escreveEm, type Me } from "@/lib/backend";
import { useI18n } from "../I18n";
import { useTrackOptions } from "../useTrackOptions";
import { Abas, Aviso, botao, botaoClaro, campo, dataHora, elo, rotulo, useAcao, useLista } from "./comum";
import type { Membro } from "./Equipe";

interface Convite {
  id: string;
  disciplina: string;
  trilha: string | null;
  nota: string;
  criado_em: string;
  convidado: string;
  convidado_id: string;
  por: string;
  meu: boolean;
  posso_revogar: boolean;
}

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
const IDIOMAS: [string, string][] = [["pt", "Português"], ["en", "Inglês"], ["es", "Espanhol"], ["ru", "Russo"], ["zh", "Chinês"], ["fr", "Francês"]];
const slugDe = (t: string) => t.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

/**
 * Disciplinas e trilhas pelo painel, sem depender de ninguém: a coordenação e a coordenação pedagógica criam, editam e
 * removem (a mudança é aplicada aos arquivos do site pela rotina de publicação, de hora em hora, e o build confere).
 * Cada educador vê só as disciplinas que ensina (e as que foi convidado a ajudar) e sugere mudanças nelas; quem ensina
 * uma disciplina convida colegas de outras para ajudar numa trilha ou na disciplina toda.
 */
export function Curriculo({ me }: { me: Me }) {
  const { t, lang } = useI18n();
  const decide = can(me, "coordenacao", "vice");
  const tracks = useTrackOptions(lang);
  const propostas = useLista<Proposta[]>("curriculo_listar");
  const convites = useLista<Convite[]>("disciplina_convites");
  const membros = useLista<Membro[]>("equipe_membros", {}, { quieta: true });
  const acao = useAcao(() => { propostas.recarregar(); convites.recarregar(); });
  const [aba, setAba] = useState<"mapa" | "nova" | "propostas" | "convites">("mapa");
  const [convite, setConvite] = useState({ disciplina: "", trilha: "", pessoa: "", nota: "" });
  // O que cada pessoa enxerga: a coordenação, tudo; os outros, as disciplinas em que escrevem.
  const minhas = disciplinasQueEnsina(me);
  const visivel = (slug: string) => decide || escreveEm(me, slug);
  const posso = (slug: string) => decide || escreveEm(me, slug);
  const convidaEm = decide ? [...areaSlugs] : minhas;
  // A situação de cada mudança, no próprio mapa: quem pediu vê que está andando, sem abrir Propostas.
  const andamento = (slug: string) => (propostas.dados ?? []).find((p) => String(p.dados.slug) === slug && (p.status === "pendente" || p.status === "aprovada" || p.status === "falhou"));
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
      <Abas atual={aba} escolher={setAba} opcoes={[{ id: "mapa" as const, nome: decide ? "Disciplinas e trilhas" : "Minhas disciplinas" }, { id: "nova" as const, nome: decide ? "Criar ou mudar" : "Sugerir" }, { id: "propostas" as const, nome: "Propostas", conta: decide ? pendentes : undefined }, { id: "convites" as const, nome: "Convites", conta: (convites.dados ?? []).filter((c) => c.meu).length || undefined }]} />
      <Aviso texto={propostas.erro || acao.aviso} />
      <div hidden={aba !== "mapa"}>
        <p className="text-ink-soft">{decide ? "Clique para editar ou remover. O que você criar ou mudar entra no site na próxima publicação automática (de hora em hora); nomes e trilhas novas saem em português e, nos outros idiomas, com o texto que você escrever (ou o português, até a tradução)." : "Aqui aparecem só as disciplinas que você ensina e as que foi convidado a ajudar. Sugira trilhas e mudanças: a coordenação decide, e a situação aparece aqui mesmo."}</p>
        {!decide && groups.every((g) => g.areas.every((slug) => !visivel(slug))) && (
          <p className="mt-4 border-l-4 border-oxblood bg-parchment-deep px-3 py-2">Você ainda não ensina nenhuma disciplina. Quem ensina uma pode convidar você para ajudar (aba Convites), ou peça à coordenação a função de educador.</p>
        )}
        {groups.filter((g) => g.areas.some(visivel)).map((g) => (
          <section key={g.id} className="mt-6">
            <h2 className="jornal-secao"><span className="jornal-editoria">{t.groups[g.id]}</span></h2>
            <ul className="mt-3 grid gap-2 md:grid-cols-2">
              {g.areas.filter(visivel).map((slug) => {
                const trilhas = tracks.filter((x) => x.area === slug);
                const situacao = andamento(slug);
                return (
                  <li key={slug} className="painel-cartao p-3">
                    <p className="flex items-start justify-between gap-2">
                      <span><strong>{nomeDaArea(slug)}</strong> <span className="font-mono text-xs text-ink-soft">{slug}</span><br /><span className="text-xs text-ink-soft">{(Object.keys(stageAreas) as Stage[]).filter((e) => (stageAreas[e] as readonly string[]).includes(slug)).join(", ") || "sem etapa"} · {trilhas.length} trilha(s){!decide && !minhas.includes(slug) ? " · você foi convidado" : ""}</span></span>
                      <span className="flex shrink-0 gap-2 text-xs">
                        {posso(slug) && <button type="button" className={elo} onClick={() => preparar({ tipo: "editar_disciplina", slug, nomes: { pt: nomeDaArea(slug) }, descricoes: { pt: t.areas[slug as keyof typeof t.areas]?.[1] ?? "" } })}>editar</button>}
                        {posso(slug) && <button type="button" className={elo} onClick={() => preparar({ tipo: "trilha", disciplina: slug, slug: "", titulo: "", aulas: "" })}>+ trilha</button>}
                        {decide && trilhas.length === 0 && <button type="button" className={`${elo} text-oxblood`} onClick={() => { if (window.confirm(`Remover a disciplina ${nomeDaArea(slug)}?`)) void acao.agir("curriculo_propor", { p_tipo: "remover_disciplina", p_dados: { slug } }, "Remoção marcada: sai na próxima publicação."); }}>remover</button>}
                      </span>
                    </p>
                    {situacao && <p className={`mt-1 text-xs ${situacao.status === "falhou" ? "text-oxblood" : "text-ink-soft"}`}>⏳ {TIPOS[situacao.tipo]}: {SITUACOES[situacao.status]}{situacao.nota ? ` — ${situacao.nota}` : ""}</p>}
                    {trilhas.length > 0 && (
                      <ul className="mt-2 space-y-1 border-t border-rule pt-2 text-xs">
                        {trilhas.map((x) => (
                          <li key={x.slug} className="flex items-start justify-between gap-2">
                            <span>{x.title} <span className="text-ink-soft">· {x.stage ?? "?"} · {x.plan?.filter((p) => p.ready).length ?? 0}/{x.plan?.length ?? 0} aulas</span>{andamento(x.slug) && <span className="block text-ink-soft">⏳ {SITUACOES[andamento(x.slug)!.status]}</span>}</span>
                            <span className="flex shrink-0 gap-2">
                              {posso(x.area) && <button type="button" className={elo} onClick={() => preparar({ tipo: "editar_trilha", slug: x.slug, disciplina: x.area, titulo: x.title, resumo: x.summary ?? "", etapa: (x.stage ?? "medio") as Stage, aulas: (x.plan ?? []).map((p) => p.title).join("\n") })}>editar</button>}
                              {decide && (x.plan?.filter((p) => p.ready).length ?? 0) === 0 && <button type="button" className={`${elo} text-oxblood`} onClick={() => { if (window.confirm(`Remover a trilha “${x.title}”?`)) void acao.agir("curriculo_propor", { p_tipo: "remover_trilha", p_dados: { slug: x.slug, disciplina: x.area } }, "Remoção marcada: sai na próxima publicação."); }}>remover</button>}
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
              <label className="mt-3 block">Disciplina<select value={form.disciplina} onChange={(e) => setForm({ ...form, disciplina: e.target.value })} className={campo}>{areaSlugs.filter(posso).map((s) => <option key={s} value={s}>{nomeDaArea(s)}</option>)}</select></label>
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
      <div hidden={aba !== "convites"}>
        <p className="max-w-3xl text-ink-soft">Cada educador cuida da própria disciplina. Para alguém de outra disciplina ajudar numa aula ou numa trilha da sua, convide aqui: a pessoa passa a ver a sua disciplina em Escrever e aqui, até o convite acabar. Quem convidou, quem ensina a disciplina e a coordenação encerram quando quiserem.</p>
        {convidaEm.length > 0 && (
          <section className="painel-cartao mt-4 max-w-3xl p-5">
            <h2 className="font-serif text-xl font-semibold">Convidar para ajudar</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">Disciplina<select value={convite.disciplina} onChange={(e) => setConvite({ ...convite, disciplina: e.target.value, trilha: "" })} className={campo}><option value="">Escolha…</option>{convidaEm.map((s) => <option key={s} value={s}>{nomeDaArea(s)}</option>)}</select></label>
              <label className="block">Trilha (opcional: vazio vale a disciplina toda)<select value={convite.trilha} onChange={(e) => setConvite({ ...convite, trilha: e.target.value })} className={campo}><option value="">A disciplina toda</option>{tracks.filter((x) => x.area === convite.disciplina).map((x) => <option key={x.slug} value={x.slug}>{x.title}</option>)}</select></label>
              <label className="block sm:col-span-2">Quem
                <select value={convite.pessoa} onChange={(e) => setConvite({ ...convite, pessoa: e.target.value })} className={campo}>
                  <option value="">Escolha a pessoa…</option>
                  {(membros.dados ?? []).filter((m) => !m.eu && !m.papeis.some((p) => (p.papel === "educacao" || p.papel === "educacao_secundaria") && p.disciplina === convite.disciplina)).map((m) => (
                    <option key={m.id} value={m.id}>{m.nome} — {[...new Set(m.papeis.map((p) => (p.disciplina && p.papel.startsWith("educacao") ? `educação de ${nomeDaArea(p.disciplina)}` : p.papel)))].join(", ")}</option>
                  ))}
                </select>
              </label>
              <label className="block sm:col-span-2">Para quê (aparece para a pessoa)<input value={convite.nota} onChange={(e) => setConvite({ ...convite, nota: e.target.value })} maxLength={500} placeholder="Ex.: a aula de estatística das revoltas" className={campo} /></label>
            </div>
            <button type="button" className={`mt-3 ${botao}`} disabled={acao.ocupado || !convite.disciplina || !convite.pessoa} onClick={async () => { const r = await acao.agir("disciplina_convidar", { p_usuario: convite.pessoa, p_disciplina: convite.disciplina, p_trilha: convite.trilha || null, p_nota: convite.nota }, "Convite enviado: a pessoa foi avisada."); if (r) setConvite({ disciplina: "", trilha: "", pessoa: "", nota: "" }); }}>Convidar</button>
          </section>
        )}
        <ul className="mt-6 max-w-3xl space-y-2">
          {(convites.dados ?? []).length === 0 && <li className="text-ink-soft">Nenhum convite ativo.</li>}
          {(convites.dados ?? []).map((c) => (
            <li key={c.id} className="painel-cartao flex flex-wrap items-start justify-between gap-2 p-3">
              <span>
                <strong>{c.meu ? "Você" : c.convidado}</strong> ajuda em <strong>{nomeDaArea(c.disciplina)}</strong>{c.trilha ? ` (trilha ${tracks.find((x) => x.slug === c.trilha)?.title ?? c.trilha})` : ""}
                <span className="block text-xs text-ink-soft">convite de {c.por || "?"} · {dataHora(c.criado_em)}{c.nota ? ` · ${c.nota}` : ""}</span>
              </span>
              {c.posso_revogar && <button type="button" className={elo} onClick={() => { if (window.confirm(c.meu ? "Deixar de ajudar nesta disciplina?" : "Encerrar este convite?")) void acao.agir("disciplina_convite_revogar", { p_id: c.id }, "Convite encerrado."); }}>{c.meu ? "Sair" : "Encerrar"}</button>}
            </li>
          ))}
        </ul>
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

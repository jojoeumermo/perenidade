// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { type Aula } from "@/lib/aovivo";
import { areaSlugs } from "@/lib/areas";
import { can, type Me } from "@/lib/backend";
import { JITSI_DOMINIO, novaSalaJitsi } from "@/lib/jitsi";
import { useI18n } from "../I18n";
import { useTrackOptions } from "../useTrackOptions";
import { BuscaDePessoa, type PessoaAchada } from "./BuscaDePessoa";
import { Abas, Aviso, botao, botaoClaro, campo, dataHora, elo, papeis, rotulo, useAcao, useLista } from "./comum";
import type { Membro } from "./Equipe";

const situacao: Record<Aula["status"], string> = { agendada: "marcada", ao_vivo: "ao vivo agora", encerrada: "encerrada", cancelada: "cancelada" };

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

/** Marcar aulas ao vivo, chamar colegas e abrir a sala. A agenda pública mostra o que for marcado aqui. */
export function AulasAoVivo({ me }: { me: Me }) {
  const { lang, t } = useI18n();
  const tracks = useTrackOptions(lang);
  const lista = useLista<Aula[]>("aulas_ao_vivo_minhas");
  const membros = useLista<Membro[]>("equipe_membros", {}, { quieta: true });
  const acao = useAcao(lista.recarregar);
  const [aba, setAba] = useState<"marcar" | "minhas">("minhas");
  const [editando, setEditando] = useState<string | null>(null);
  const minhasDisciplinas = [...new Set(me.papeis.filter((p) => p.papel === "educacao" || p.papel === "educacao_secundaria").map((p) => p.disciplina).filter(Boolean))] as string[];
  const disciplinas = can(me, "coordenacao") || minhasDisciplinas.length === 0 ? [...areaSlugs] : minhasDisciplinas;
  const vazio = (): Form => ({ titulo: "", descricao: "", disciplina: disciplinas[0] ?? "", trilha: "", inicio: daquiAUmaHora(), duracao: 60, sala_externa: "", gravacao: "" });
  const [form, setForm] = useState<Form>(vazio);
  const [colegas, setColegas] = useState<PessoaAchada[]>([]);
  const nomeDaArea = (slug: string | null) => (slug ? (t.areas[slug as keyof typeof t.areas]?.[0] ?? slug) : "");
  const ensina = (m: Membro) => m.papeis.some((p) => ["educacao", "educacao_secundaria", "mentoria", "coordenacao", "vice"].includes(p.papel));
  const funcoes = (m: Membro) => [...new Set(m.papeis.map((p) => `${papeis[p.papel]}${p.disciplina ? ` de ${nomeDaArea(p.disciplina)}` : ""}`))].join(", ");
  const candidatos = (membros.dados ?? []).filter((m) => !m.eu && ensina(m) && !colegas.some((c) => c.id === m.id)).map((m) => ({ id: m.id, nome: m.nome, email: funcoes(m) }));
  const mudar = <K extends keyof Form>(chave: K, valor: Form[K]) => setForm((f) => ({ ...f, [chave]: valor }));
  const abrirSala = (id: string) => `/${lang}/ao-vivo/sala?aula=${id}`;

  function editar(aula: Aula) {
    setForm({ titulo: aula.titulo, descricao: aula.descricao, disciplina: aula.disciplina, trilha: aula.trilha ?? "", inicio: paraCampo(aula.inicio), duracao: aula.duracao, sala_externa: aula.sala_externa, gravacao: aula.gravacao });
    setColegas(aula.co_educadores.map((c) => ({ id: c.id, nome: c.nome, email: "" })));
    setEditando(aula.id);
    setAba("marcar");
    window.scrollTo(0, 0);
  }

  async function guardar() {
    const inicio = new Date(form.inicio);
    if (Number.isNaN(inicio.getTime())) return acao.setAviso("Confira a data e a hora.");
    const ok = await acao.agir(
      "aula_ao_vivo_salvar",
      { p_id: editando, p: { ...form, inicio: inicio.toISOString(), trilha: form.trilha || null, co_educadores: colegas.map((c) => c.id) } },
      editando ? "Aula alterada." : "Aula marcada: já aparece na agenda pública. Os colegas chamados receberam o recado.",
    );
    if (ok) {
      setForm(vazio());
      setColegas([]);
      setEditando(null);
      setAba("minhas");
    }
  }

  const trilhas = tracks.filter((x) => x.area === form.disciplina);

  return (
    <div>
      <Abas atual={aba} escolher={setAba} opcoes={[{ id: "minhas", nome: "Minhas aulas", conta: lista.dados?.filter((a) => a.status === "ao_vivo").length }, { id: "marcar", nome: editando ? "Alterar a aula" : "Marcar uma aula" }]} />

      {aba === "marcar" && (
        <form className="max-w-3xl space-y-4" onSubmit={(e) => { e.preventDefault(); void guardar(); }}>
          <p className="text-ink-soft">
            A aula entra na agenda pública (<a href={`/${lang}/ao-vivo`} target="_blank" rel="noopener noreferrer" className={elo}>institutolucia.org/ao-vivo</a>) na hora. Na data, abra a sala, ligue a câmera ou a tela e aperte “Começar a aula”: quem marcou presença recebe um recado. O vídeo vai direto do seu navegador para cada pessoa; para turma grande, indique uma sala de fora.
          </p>
          <label className="block">
            Título
            <input value={form.titulo} onChange={(e) => mudar("titulo", e.target.value)} maxLength={140} required className={campo} />
          </label>
          <label className="block">
            Sobre a aula (o que vai ser visto, para quem é, o que levar)
            <textarea value={form.descricao} onChange={(e) => mudar("descricao", e.target.value)} rows={3} maxLength={2000} className={campo} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              Disciplina
              <select value={form.disciplina} onChange={(e) => { mudar("disciplina", e.target.value); mudar("trilha", ""); }} className={campo}>
                {disciplinas.map((area) => (
                  <option key={area} value={area}>{nomeDaArea(area)}</option>
                ))}
              </select>
            </label>
            <label className="block">
              Trilha (opcional)
              <select value={form.trilha} onChange={(e) => mudar("trilha", e.target.value)} className={campo}>
                <option value="">Nenhuma</option>
                {trilhas.map((x) => (
                  <option key={x.slug} value={x.slug}>{x.title}</option>
                ))}
              </select>
            </label>
            <label className="block">
              Data e hora
              <input type="datetime-local" value={form.inicio} onChange={(e) => mudar("inicio", e.target.value)} required className={campo} />
            </label>
            <label className="block">
              Duração (minutos)
              <input type="number" min={15} max={240} step={5} value={form.duracao} onChange={(e) => mudar("duracao", Number(e.target.value) || 60)} className={campo} />
            </label>
          </div>
          <fieldset className="border border-rule bg-parchment-deep p-4">
            <legend className="px-1 font-semibold">Dar a aula junto com (opcional)</legend>
            <p className="text-ink-soft">O educador de redes chama o de programação; a mentora entra para responder. Quem for chamado recebe o recado na hora e também conduz a sala. Até oito.</p>
            {colegas.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {colegas.map((pessoa) => (
                  <li key={pessoa.id} className="flex items-center gap-2 border border-ink bg-parchment px-2 py-1">
                    <strong>{pessoa.nome}</strong>
                    <button type="button" className={elo} aria-label={`Tirar ${pessoa.nome}`} onClick={() => setColegas(colegas.filter((c) => c.id !== pessoa.id))}>✕</button>
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
          <label className="block">
            Sala de vídeo (Jitsi; recomendada para turma grande)
            <span className="mt-1 flex gap-2">
              <input value={form.sala_externa} onChange={(e) => mudar("sala_externa", e.target.value)} placeholder="https://" maxLength={500} className={`${campo} mt-0 font-mono`} />
              {!form.sala_externa && <button type="button" className={botaoClaro} onClick={() => mudar("sala_externa", novaSalaJitsi())}>Criar sala no Jitsi</button>}
            </span>
            <span className="mt-1 block text-xs text-ink-soft">A sala em {JITSI_DOMINIO} abre dentro da página da aula, para quem ensina e para quem assiste; o nome é sorteado e não se adivinha. Outro endereço (Meet etc.) abre fora do site.</span>
          </label>
          {editando && (
            <label className="block">
              Gravação (endereço do vídeo, depois da aula; opcional)
              <input value={form.gravacao} onChange={(e) => mudar("gravacao", e.target.value)} placeholder="https://… ou /pt/videoaulas…" maxLength={500} className={`${campo} font-mono`} />
            </label>
          )}
          <div className="flex flex-wrap gap-3">
            <button type="submit" className={botao} disabled={acao.ocupado || form.titulo.trim().length < 3}>{editando ? "Guardar alterações" : "Marcar a aula"}</button>
            {editando && <button type="button" className={elo} onClick={() => { setEditando(null); setForm(vazio()); setColegas([]); }}>Cancelar</button>}
          </div>
          <Aviso texto={acao.aviso || membros.erro} />
        </form>
      )}

      {aba === "minhas" && (
        <div>
          <Aviso texto={lista.erro || acao.aviso} />
          {lista.dados?.length === 0 && (
            <p className="border border-rule bg-parchment-deep px-4 py-6 text-center text-ink-soft">
              Nenhuma aula marcada. <button type="button" className={elo} onClick={() => setAba("marcar")}>Marque a primeira.</button>
            </p>
          )}
          <ul className="divide-y divide-rule border-y border-rule">
            {lista.dados?.map((aula) => (
              <li key={aula.id} className="py-4">
                <p className={rotulo}>
                  {nomeDaArea(aula.disciplina)} · {dataHora(aula.inicio)} · {aula.duracao} min ·{" "}
                  <span className={aula.status === "ao_vivo" ? "text-[#c21f16]" : ""}>{situacao[aula.status]}</span>
                </p>
                <p className="mt-1 font-serif text-2xl font-semibold">{aula.titulo}</p>
                <p className="mt-1 text-ink-soft">
                  {aula.educador.nome}
                  {aula.co_educadores.length > 0 && ` com ${aula.co_educadores.map((c) => c.nome).join(", ")}`} · {aula.inscritos} {aula.inscritos === 1 ? "pessoa marcou presença" : "pessoas marcaram presença"}
                  {typeof aula.mensagens === "number" && aula.mensagens > 0 && ` · ${aula.mensagens} mensagens no bate-papo`}
                </p>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {aula.status !== "cancelada" && <a href={abrirSala(aula.id)} target="_blank" rel="noopener noreferrer" className={aula.status === "ao_vivo" ? `${botao} py-1.5` : botaoClaro}>{aula.status === "ao_vivo" ? "Entrar na sala" : "Abrir a sala ↗"}</a>}
                  {aula.status === "agendada" && <button type="button" className={elo} onClick={() => editar(aula)}>Alterar</button>}
                  {aula.status === "agendada" && <button type="button" className={elo} disabled={acao.ocupado} onClick={() => void acao.agir("aula_ao_vivo_estado", { p_id: aula.id, p_status: "ao_vivo" }, "Aula começada: quem marcou presença foi avisado.")}>Começar agora</button>}
                  {aula.status === "ao_vivo" && <button type="button" className={elo} disabled={acao.ocupado} onClick={() => { if (window.confirm("Encerrar a aula?")) void acao.agir("aula_ao_vivo_estado", { p_id: aula.id, p_status: "encerrada" }, "Aula encerrada."); }}>Encerrar</button>}
                  {aula.status === "encerrada" && <button type="button" className={elo} onClick={() => editar(aula)}>Pôr a gravação</button>}
                  {aula.status === "agendada" && <button type="button" className={elo} disabled={acao.ocupado} onClick={() => { if (window.confirm("Cancelar a aula? Quem marcou presença será avisado.")) void acao.agir("aula_ao_vivo_estado", { p_id: aula.id, p_status: "cancelada" }, "Aula cancelada."); }}>Cancelar</button>}
                  {(aula.status === "cancelada" || can(me, "coordenacao")) && <button type="button" className={`${elo} text-oxblood`} disabled={acao.ocupado} onClick={() => { if (window.confirm("Apagar a aula e o bate-papo dela?")) void acao.agir("aula_ao_vivo_apagar", { p_id: aula.id }, "Aula apagada."); }}>Apagar</button>}
                  <button type="button" className={elo} onClick={() => void navigator.clipboard.writeText(`${window.location.origin}${abrirSala(aula.id)}`).then(() => acao.setAviso("Endereço da sala copiado."))}>Copiar o endereço</button>
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

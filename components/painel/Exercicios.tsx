// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
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

const vazio = { id: "", disciplina: "", aula: "", aula_titulo: "", titulo: "", objetivo: "", programa: "filmcraft" as Exercicio["programa"], materiais: [] as Material[], passos: "", criterios: "" };

/** As entregas de um exercício (pela Gaveta Aberta) e o comentário de quem ensina. */
function Entregas({ exercicio }: { exercicio: Exercicio }) {
  const lista = useLista<Entrega[]>("exercicio_entregas", { p_id: exercicio.id });
  const acao = useAcao(lista.recarregar);
  const [textos, setTextos] = useState<Record<string, string>>({});
  return (
    <div className="mt-3 border-t border-rule pt-3">
      <Aviso texto={lista.erro || acao.aviso} />
      {lista.dados?.length === 0 && <p className="text-sm text-ink-soft">Nenhuma entrega ainda.</p>}
      <ul className="space-y-3">
        {lista.dados?.map((g) => (
          <li key={g.id} className="border border-rule p-3 text-sm">
            <p className="font-semibold">{g.autor || g.credito} <span className="font-normal text-ink-soft">· {data(g.criado_em)} · na Gaveta: {g.status}</span></p>
            {g.link && <a href={g.link} target="_blank" rel="noopener noreferrer nofollow" className={elo}>Ver o vídeo ↗</a>}
            <p className="mt-1 whitespace-pre-line" data-original>{g.comentario}</p>
            {g.retorno && <p className="mt-2 border-l-4 border-ok pl-2"><span className="text-ink-soft">Seu comentário: </span>{g.retorno}</p>}
            <label className="mt-2 block">{g.retorno ? "Trocar o comentário" : "Comentar a entrega"}
              <textarea value={textos[g.id] ?? ""} onChange={(e) => setTextos({ ...textos, [g.id]: e.target.value })} rows={2} maxLength={2000} className={campo} />
            </label>
            <button type="button" className={`mt-1 ${botaoClaro}`} disabled={acao.ocupado || (textos[g.id] ?? "").trim().length < 5} onClick={async () => { if (await acao.agir("exercicio_retorno", { p_gaveta: g.id, p_texto: textos[g.id] }, "Comentário enviado ✓ Quem entregou recebeu um recado.")) setTextos({ ...textos, [g.id]: "" }); }}>Enviar o comentário</button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-ink-soft">Publicar a entrega na Gaveta Aberta (para todo mundo ver) continua com a mediação, como qualquer trabalho da Gaveta.</p>
    </div>
  );
}

/**
 * Exercícios de prática (painel): quem ensina a disciplina cria exercícios ligados às aulas, com o programa do Estúdio
 * de prática, o material (os filmes abertos da Blender Foundation ou outro link), o passo a passo e os critérios.
 */
export function Exercicios({ me }: { me: Me }) {
  const { lang, t } = useI18n();
  const tracks = useTrackOptions(lang);
  const lista = useLista<Exercicio[]>("exercicios_meus");
  const acao = useAcao(lista.recarregar);
  const [f, setF] = useState(vazio);
  const [aberto, setAberto] = useState<string | null>(null);
  const [outro, setOutro] = useState({ titulo: "", url: "", credito: "" });
  const lider = can(me, "coordenacao", "curadoria");
  const minhas = lider ? [...areaSlugs] : [...new Set(me.papeis.filter((p) => p.papel === "educacao" || p.papel === "educacao_secundaria").map((p) => p.disciplina).filter(Boolean) as string[])];
  const trilhas = tracks.filter((tr) => tr.area === f.disciplina);
  const aulas = trilhas.flatMap((tr) => (tr.plan ?? (tr.lessons ?? []).map((l) => ({ slug: l.slug, title: l.title, ready: true }))).map((a) => ({ caminho: `/trilhas/${tr.slug}/${a.slug}`, titulo: `${tr.title} › ${a.title}` })));
  const temFilme = (url: string) => f.materiais.some((m) => m.url === url);
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
      <section>
        <h2 className="font-serif text-2xl font-semibold">Exercícios</h2>
        <Aviso texto={lista.erro} />
        {lista.dados?.length === 0 && <p className="text-ink-soft">Nenhum exercício ainda. Crie o primeiro ao lado.</p>}
        <ul className="mt-3 space-y-3">
          {lista.dados?.map((x) => (
            <li key={x.id} className={`painel-cartao p-4 ${x.ativo ? "" : "opacity-60"}`}>
              <p className={rotulo}>{t.areas[x.disciplina as keyof typeof t.areas]?.[0] ?? x.disciplina} · {EDITORES.find((e) => e.id === x.programa)?.nome} · {x.entregas} {x.entregas === 1 ? "entrega" : "entregas"}{x.sem_retorno > 0 ? ` (${x.sem_retorno} sem comentário)` : ""}</p>
              <p className="font-serif text-lg font-semibold">{x.titulo}</p>
              <p className="text-sm text-ink-soft">{x.aula_titulo || x.aula}</p>
              <p className="mt-2 flex flex-wrap gap-3 text-sm">
                <button type="button" className={elo} onClick={() => setAberto(aberto === x.id ? null : x.id)}>{aberto === x.id ? "Fechar as entregas" : "Ver as entregas"}</button>
                <button type="button" className={elo} onClick={() => setF({ id: x.id, disciplina: x.disciplina, aula: x.aula, aula_titulo: x.aula_titulo, titulo: x.titulo, objetivo: x.objetivo, programa: x.programa, materiais: x.materiais, passos: x.passos, criterios: x.criterios })}>Corrigir</button>
                <button type="button" className={elo} disabled={acao.ocupado} onClick={() => void acao.agir("exercicio_arquivar", { p_id: x.id, p_ativo: !x.ativo }, x.ativo ? "Arquivado: saiu da aula." : "De volta à aula ✓")}>{x.ativo ? "Arquivar" : "Reativar"}</button>
                <a href={`/pt${x.aula}`} target="_blank" rel="noopener noreferrer" className={elo}>Ver na aula ↗</a>
              </p>
              {aberto === x.id && <Entregas exercicio={x} />}
            </li>
          ))}
        </ul>
        <Aviso texto={acao.aviso} />
      </section>

      <section className="painel-cartao space-y-2 p-4 xl:sticky xl:top-4 xl:self-start">
        <h2 className="font-serif text-xl font-semibold">{f.id ? "Corrigir exercício" : "Novo exercício"}</h2>
        <label className="block text-sm">Disciplina<select value={f.disciplina} onChange={(e) => setF({ ...f, disciplina: e.target.value, aula: "", aula_titulo: "" })} className={campo}><option value="">Escolha</option>{minhas.map((a) => <option key={a} value={a}>{t.areas[a as keyof typeof t.areas]?.[0] ?? a}</option>)}</select></label>
        <label className="block text-sm">Aula<select value={f.aula} disabled={!f.disciplina} onChange={(e) => setF({ ...f, aula: e.target.value, aula_titulo: aulas.find((a) => a.caminho === e.target.value)?.titulo ?? "" })} className={campo}><option value="">Escolha a aula</option>{aulas.map((a) => <option key={a.caminho} value={a.caminho}>{a.titulo}</option>)}</select></label>
        <label className="block text-sm">Título<input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} maxLength={140} className={campo} /></label>
        <label className="block text-sm">Objetivo<textarea value={f.objetivo} onChange={(e) => setF({ ...f, objetivo: e.target.value })} rows={2} maxLength={600} className={campo} /></label>
        <label className="block text-sm">Programa<select value={f.programa} onChange={(e) => setF({ ...f, programa: e.target.value as Exercicio["programa"] })} className={campo}>{EDITORES.map((e) => <option key={e.id} value={e.id}>{e.nome} (estilo {e.estilo})</option>)}</select></label>
        <fieldset className="text-sm">
          <legend>Material</legend>
          {FILMES.map((filme) => (
            <label key={filme.pagina} className="flex items-center gap-2"><input type="checkbox" checked={temFilme(filme.pagina)} onChange={(e) => setF({ ...f, materiais: e.target.checked ? [...f.materiais, { titulo: filme.titulo, url: filme.pagina, credito: filme.credito }] : f.materiais.filter((m) => m.url !== filme.pagina) })} /> {filme.titulo} ({filme.licenca})</label>
          ))}
          {f.materiais.filter((m) => !FILMES.some((filme) => filme.pagina === m.url)).map((m) => (
            <p key={m.url} className="flex items-center gap-2">{m.titulo} <button type="button" className={elo} onClick={() => setF({ ...f, materiais: f.materiais.filter((x) => x.url !== m.url) })}>tirar</button></p>
          ))}
          <div className="mt-1 grid gap-1">
            <input value={outro.titulo} onChange={(e) => setOutro({ ...outro, titulo: e.target.value })} placeholder="Outro material: nome" aria-label="Nome do material" className={campo} />
            <input value={outro.url} onChange={(e) => setOutro({ ...outro, url: e.target.value.trim() })} placeholder="https://… (com licença livre)" aria-label="Endereço do material" className={campo} />
            <input value={outro.credito} onChange={(e) => setOutro({ ...outro, credito: e.target.value })} placeholder="Crédito e licença" aria-label="Crédito do material" className={campo} />
            <button type="button" className={elo} disabled={outro.titulo.trim().length < 2 || !/^https:\/\/\S+$/.test(outro.url) || f.materiais.length >= 8} onClick={() => { setF({ ...f, materiais: [...f.materiais, outro] }); setOutro({ titulo: "", url: "", credito: "" }); }}>+ Acrescentar material</button>
          </div>
        </fieldset>
        <label className="block text-sm">Passo a passo (um por linha)<textarea value={f.passos} onChange={(e) => setF({ ...f, passos: e.target.value })} rows={5} maxLength={4000} className={campo} /></label>
        <label className="block text-sm">Critérios de avaliação<textarea value={f.criterios} onChange={(e) => setF({ ...f, criterios: e.target.value })} rows={3} maxLength={2000} className={campo} /></label>
        <p className="flex flex-wrap gap-3">
          <button type="button" className={botao} disabled={acao.ocupado || !f.disciplina || !f.aula || f.titulo.trim().length < 3 || f.objetivo.trim().length < 10 || f.passos.trim().length < 10 || f.criterios.trim().length < 5} onClick={async () => { if (await acao.agir("exercicio_salvar", { p: { ...f, id: f.id || null } }, f.id ? "Exercício corrigido ✓" : "Exercício criado ✓ Ele já aparece na aula.")) setF(vazio); }}>{f.id ? "Guardar" : "Criar o exercício"}</button>
          {f.id && <button type="button" className={elo} onClick={() => setF(vazio)}>Cancelar</button>}
        </p>
        <p className="text-xs text-ink-soft">A entrega é pela Gaveta Aberta: o aluno manda o link do vídeo exportado (YouTube não listado, PeerTube, Drive…). Não há armazenamento de vídeo no instituto.</p>
      </section>
    </div>
  );
}

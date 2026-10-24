// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { groups } from "@/lib/areas";
import { type Role, rpc } from "@/lib/backend";
import { useI18n } from "../I18n";
import { Avatar } from "./Avatar";
import { Aviso, botao, botaoClaro, dataHora, elo, GRUPOS_DEPARTAMENTO, papeis, rotulo, textoDoErro, useAcao, useLista } from "./comum";

interface FotoPendente {
  id: string;
  nome: string;
  foto: string;
  atual: string;
  enviada_em: string;
  funcoes: string[];
}

/** As fotos de perfil que esperam a coordenação: só depois de aprovadas aparecem nos cartões de quem ensina. */
export function FotosParaAprovar() {
  const lista = useLista<FotoPendente[]>("fotos_pendentes");
  const acao = useAcao(lista.recarregar);
  return (
    <section>
      <h2 className="font-serif text-2xl font-semibold">Fotos de perfil para aprovar</h2>
      <p className="mt-1 max-w-3xl text-ink-soft">Cada pessoa da equipe pode pôr a própria foto. Ela aparece nos cartões de quem ensina, nas disciplinas e na página Quem somos, só depois de aprovada aqui. Aprove fotos de rosto, nítidas, sem outras pessoas e sem nada que identifique endereço ou escola.</p>
      <Aviso texto={lista.erro || acao.aviso} />
      {lista.dados?.length === 0 && <p className="mt-3 text-ink-soft">Nenhuma foto esperando.</p>}
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lista.dados?.map((f) => (
          <li key={f.id} className="painel-cartao p-4">
            <div className="flex items-center gap-4">
              <Avatar nome={f.nome} avatar={f.foto} className="h-24 w-24 border-2 border-ink" />
              <div className="min-w-0">
                <p className="font-semibold">{f.nome}</p>
                <p className="text-xs text-ink-soft">{f.funcoes.join(", ")}</p>
                <p className="text-xs text-ink-soft">enviada em {dataHora(f.enviada_em)}</p>
                <p className="mt-1 flex items-center gap-2 text-xs text-ink-soft">hoje: <Avatar nome={f.nome} avatar={f.atual} className="h-7 w-7" /></p>
              </div>
            </div>
            <p className="mt-3 flex gap-2">
              <button type="button" className={botao} disabled={acao.ocupado} onClick={() => acao.agir("foto_decidir", { p_usuario: f.id, p_aprovar: true }, `Foto de ${f.nome} aprovada.`)}>Aprovar</button>
              <button type="button" className={botaoClaro} disabled={acao.ocupado} onClick={() => acao.agir("foto_decidir", { p_usuario: f.id, p_aprovar: false }, "Recusada: a pessoa foi avisada.")}>Recusar</button>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface Aceite {
  id: string | null;
  nome: string;
  termo: string;
  versao: string;
  sha256: string;
  dados: Record<string, unknown>;
  aceito_em: string;
  conta_apagada: boolean;
  /** Aceite de antes do registro integral: só a data e a versão, sem o texto guardado. */
  antigo?: boolean;
}
const NOME_DO_TERMO: Record<string, string> = { voluntario: "Termo de voluntário (entrada no painel)", adesao: "Termo de adesão (horas e certificados)", saude: "Termo da vitrine Saúde Solidária" };

/**
 * Os termos assinados, para sempre: nem a coordenação apaga. Dá para abrir o texto exato que a pessoa leu e baixar a
 * lista inteira numa planilha (CSV), o respaldo jurídico do voluntariado. A coordenação, a coordenação pedagógica e a
 * supervisão veem esta lista.
 */
export function TermosAceitos() {
  const lista = useLista<Aceite[]>("termos_aceites_listar");
  const [aberto, setAberto] = useState<{ id: string; texto: string } | null>(null);
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("");
  const [erro, setErro] = useState("");
  const todos = lista.dados ?? [];
  const vistos = todos.filter((a) => (!tipo || a.termo === tipo) && `${a.nome} ${a.termo}`.toLowerCase().includes(busca.toLowerCase()));
  const pessoas = new Set(todos.filter((a) => a.termo === "voluntario").map((a) => a.nome)).size;

  function baixarPlanilha() {
    const linhas = [["nome", "termo", "versao", "aceito_em", "sha256", "registro", "conta_apagada"], ...vistos.map((a) => [a.nome, NOME_DO_TERMO[a.termo] ?? a.termo, a.versao, a.aceito_em, a.sha256, a.antigo ? "anterior ao registro integral" : "texto guardado", a.conta_apagada ? "sim" : "não"])];
    const csv = linhas.map((l) => l.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `termos-assinados-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section>
      <p className="max-w-3xl text-ink-soft">Cada aceite fica guardado com o texto inteiro que a pessoa leu, a versão, a data e uma impressão digital (SHA-256) do texto. Ninguém altera nem apaga, nem a coordenação; se a conta for apagada, o aceite continua. É a prova do voluntariado, sem vínculo de emprego (Lei nº 9.608/1998), e da licença do que foi publicado.</p>
      <Aviso texto={lista.erro || erro} />
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <p className="painel-cartao p-4"><span className="block font-mono text-[0.66rem] uppercase tracking-[0.18em] text-ink-soft">Aceites guardados</span><span className="font-serif text-3xl font-semibold">{todos.length}</span></p>
        <p className="painel-cartao p-4"><span className="block font-mono text-[0.66rem] uppercase tracking-[0.18em] text-ink-soft">Voluntários com termo</span><span className="font-serif text-3xl font-semibold">{pessoas}</span></p>
        <p className="painel-cartao p-4"><span className="block font-mono text-[0.66rem] uppercase tracking-[0.18em] text-ink-soft">Sem o texto (antigos)</span><span className="font-serif text-3xl font-semibold">{todos.filter((a) => a.antigo).length}</span></p>
      </div>
      <div className="mt-5 flex flex-wrap items-end gap-3">
        <label className="block min-w-60 flex-1 text-sm">Buscar pelo nome<input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} className="mt-1 w-full border-2 border-ink bg-folha px-3 py-2" /></label>
        <label className="block text-sm">
          Termo
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="mt-1 block border-2 border-ink bg-folha px-3 py-2">
            <option value="">Todos</option>
            {Object.entries(NOME_DO_TERMO).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
          </select>
        </label>
        <button type="button" className="botao botao-tinta botao-menor" onClick={baixarPlanilha} disabled={!vistos.length}>Baixar a lista (CSV)</button>
      </div>
      <ul className="mt-4 divide-y divide-rule border-y-2 border-ink">
        {vistos.map((a, i) => (
          <li key={a.id ?? `antigo-${a.termo}-${a.nome}-${i}`} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
            <span className="min-w-0">
              <span className={rotulo}>{NOME_DO_TERMO[a.termo] ?? a.termo} · versão {a.versao} · {dataHora(a.aceito_em)}</span>
              <span className="block font-semibold">{a.nome}{a.conta_apagada ? " (conta apagada)" : ""}</span>
              {a.dados?.menor === true && <span className="block text-xs text-oxblood">Menor de idade: responsável {String(a.dados.responsavel ?? "não informado")}</span>}
              {a.antigo ? <span className="block text-xs text-ink-soft">Aceite anterior ao registro integral: ficou guardada a data, não o texto.</span> : <span className="block break-all font-mono text-[0.65rem] text-ink-soft">{a.sha256}</span>}
            </span>
            {a.id && (
              <button
                type="button"
                className={elo}
                onClick={async () => {
                  try {
                    const r = await rpc<{ texto: string }>("termos_aceites_listar", { p_texto_de: a.id });
                    setAberto({ id: a.id as string, texto: r.texto });
                  } catch (falha) {
                    setErro(textoDoErro(falha));
                  }
                }}
              >
                Ler o texto aceito
              </button>
            )}
            {aberto?.id === a.id && a.id && <pre className="mt-2 w-full whitespace-pre-wrap border-2 border-ink bg-folha p-3 font-sans text-sm">{aberto.texto}</pre>}
          </li>
        ))}
      </ul>
      {lista.dados && vistos.length === 0 && <p className="mt-4 text-ink-soft">Nenhum termo encontrado.</p>}
    </section>
  );
}

interface PessoaDaEquipe {
  id: string;
  nome: string;
  papeis: Role[];
}

/**
 * Os departamentos: as funções (curadoria, tradução, design…) e, na educação, as áreas que reúnem disciplinas
 * (Tecnologia reúne informática, programação, modelagem 3D, edição de vídeo e de foto). Cada um com os representantes
 * (podem ser vários) e quem trabalha nele.
 */
export function Departamentos({ pessoas }: { pessoas: PessoaDaEquipe[] }) {
  const { t } = useI18n();
  const nomeDaArea = (slug: string) => t.areas[slug as keyof typeof t.areas]?.[0] ?? slug;
  const reps = (dep: string) => pessoas.filter((p) => p.papeis.some((r) => r.papel === "representante" && r.disciplina === dep));
  const areas = groups.map((g) => ({
    id: `grupo-${g.id}`,
    nome: GRUPOS_DEPARTAMENTO[`grupo-${g.id}`] ?? g.id,
    disciplinas: g.areas as readonly string[],
  }));
  // O Departamento de Comunicação reúne duas funções: o jornal, a rádio e o podcast (jornalismo) e o marketing.
  const funcoes: { id: string; nome: string; papeis: string[] }[] = [
    ...(["curadoria", "mediacao", "revisao", "traducao"] as const).map((f) => ({ id: f, nome: papeis[f], papeis: [f] })),
    { id: "jornalismo", nome: "Departamento de Comunicação (jornal, rádio, podcast e marketing)", papeis: ["jornalismo", "marketing"] },
    ...(["mentoria", "design", "desenvolvimento", "saude"] as const).map((f) => ({ id: f, nome: papeis[f], papeis: [f] })),
  ];
  return (
    <section>
      <h2 className="font-serif text-2xl font-semibold">Departamentos</h2>
      <p className="mt-1 max-w-3xl text-ink-soft">Departamento não é a disciplina: é tudo o que a área engloba. Na educação, cada área reúne as disciplinas dela; nas outras funções, o departamento é a própria função. Um departamento pode ter vários representantes (nomeie em Confiar função › Representante do departamento).</p>
      <h3 className="mt-6 font-mono text-xs uppercase tracking-widest text-ink-soft">Educação, por área</h3>
      <ul className="mt-2 grid gap-3 md:grid-cols-2">
        {areas.map((a) => {
          const educadores = pessoas.filter((p) => p.papeis.some((r) => (r.papel === "educacao" || r.papel === "educacao_secundaria") && r.disciplina && a.disciplinas.includes(r.disciplina)));
          return (
            <li key={a.id} className="painel-cartao p-4">
              <p className="font-semibold">{a.nome}</p>
              <p className="mt-1 text-xs text-ink-soft">{a.disciplinas.map(nomeDaArea).join(" · ")}</p>
              <p className="mt-2 text-sm"><strong>Representantes:</strong> {reps(a.id).map((p) => p.nome).join(", ") || "ninguém ainda"}</p>
              <p className="text-sm"><strong>Educadores:</strong> {educadores.length}</p>
            </li>
          );
        })}
      </ul>
      <h3 className="mt-6 font-mono text-xs uppercase tracking-widest text-ink-soft">Outras funções</h3>
      <ul className="mt-2 grid gap-3 md:grid-cols-3">
        {funcoes.map((f) => (
          <li key={f.id} className="painel-cartao p-4">
            <p className="font-semibold">{f.nome}</p>
            <p className="mt-1 text-sm"><strong>Representantes:</strong> {f.papeis.flatMap((id) => reps(id)).map((p) => p.nome).filter((n, i, l) => l.indexOf(n) === i).join(", ") || "ninguém ainda"}</p>
            <p className="text-sm"><strong>Pessoas:</strong> {pessoas.filter((p) => p.papeis.some((r) => f.papeis.includes(r.papel))).length}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

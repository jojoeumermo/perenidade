// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { can, type Me, porNivel, type Role, rpc } from "@/lib/backend";
import { L } from "../I18n";
import { localDoPainel } from "./comum";

// Os quadros da Mesa desenhados na prancheta "Painel moderno": o que está ao vivo agora, o que acabou de chegar no site,
// o rascunho para continuar, as horas do mês e uma dica do tutorial. Cada um some quando não tem nada a mostrar, e um
// banco antigo (sem a função) não quebra a Mesa.

/** O departamento de cada função e as seções dele, para o grupo "Meu departamento" no alto do menu. */
const DEPARTAMENTOS: { papeis: Role["papel"][]; nome: string; secoes: string[] }[] = [
  { papeis: ["coordenacao", "vice"], nome: "Coordenação", secoes: ["pessoas", "estatisticas", "avisos", "site", "seguranca", "registro"] },
  { papeis: ["supervisao"], nome: "Supervisão", secoes: ["supervisao", "interdicao", "registro", "avisos", "termos"] },
  { papeis: ["jornalismo", "marketing", "design", "porta_voz"], nome: "Comunicação", secoes: ["boletim", "podcast", "emissoras", "divulgacao", "estudio", "materiais"] },
  { papeis: ["educacao", "educacao_secundaria"], nome: "Educação", secoes: ["escrever", "videoaulas", "aovivo", "exercicios", "curriculo", "fila"] },
  { papeis: ["curadoria", "revisao"], nome: "Curadoria e revisão", secoes: ["fila", "triagem", "acervo-dentro", "traducoes", "materiais"] },
  { papeis: ["traducao"], nome: "Tradução", secoes: ["traducoes", "fila", "escrever"] },
  { papeis: ["mediacao"], nome: "Mediação", secoes: ["comunidade", "mural", "gaveta", "reforco"] },
  { papeis: ["mentoria"], nome: "Reforço", secoes: ["reforco", "aovivo", "escrever"] },
  { papeis: ["saude"], nome: "Saúde Solidária", secoes: ["saude"] },
  { papeis: ["desenvolvimento"], nome: "Desenvolvimento", secoes: ["erros", "tecnico"] },
];

/** O departamento principal da pessoa (o da função de maior nível) e as seções dele que ela enxerga. */
export function meuDepartamento(me: Me, visiveis: string[]): { nome: string; secoes: string[] } | null {
  for (const papel of porNivel(me.papeis)) {
    if (papel.papel === "representante" && papel.disciplina === "saude") return { nome: "Saúde Solidária", secoes: ["saude", "termos"].filter((id) => visiveis.includes(id)) };
    const d = DEPARTAMENTOS.find((x) => x.papeis.includes(papel.papel));
    if (!d) continue;
    const secoes = d.secoes.filter((id) => visiveis.includes(id));
    if (secoes.length >= 2) return { nome: d.nome, secoes };
  }
  return null;
}

const DICAS = [
  "Aperte Ctrl K em qualquer tela para achar uma seção pelo nome.",
  "Fixe as seções que você mais usa: elas ficam no alto do menu.",
  "O modo foco deixa no menu só o essencial. O botão fica embaixo, ao lado do recolher.",
  "Toda seção tem o botão “Como funciona esta seção”, com o passo a passo.",
  "O rascunho do que você escreve fica guardado sozinho, também no outro aparelho.",
  "Nas Conversas, confira o código de segurança com a pessoa para ter certeza de que é ela.",
  "Tarefas de 5 minutos também contam horas para o certificado.",
];

const ha = (iso: string) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "há 1 dia" : `há ${d} dias`;
};
const hora = (iso: string) => new Date(iso).toLocaleTimeString(localDoPainel(), { hour: "2-digit", minute: "2-digit" });

function useDado<T>(funcao: string | null, args: Record<string, unknown> = {}) {
  const [dado, setDado] = useState<T | null>(null);
  const chave = JSON.stringify(args);
  useEffect(() => {
    if (!funcao) return;
    let vivo = true;
    rpc<T>(funcao, JSON.parse(chave) as Record<string, unknown>)
      .then((r) => vivo && setDado(r))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [funcao, chave]);
  return dado;
}

interface Encontro {
  id: string;
  titulo: string;
  inicio: string;
  duracao: number;
  status: "agendada" | "ao_vivo" | "encerrada" | "cancelada";
}

/** A reunião ou a aula que está acontecendo agora (ou a próxima, se começa em menos de duas horas). */
export function AgoraAoVivo({ me, ir }: { me: Me; ir: (aba: string) => void }) {
  const voluntario = me.papeis.length > 0;
  const reunioes = useDado<Encontro[]>(voluntario ? "reunioes_listar" : null);
  const aulas = useDado<Encontro[]>(can(me, "coordenacao", "educacao", "mentoria") ? "aulas_ao_vivo_minhas" : null);
  // A hora de quando a Mesa abriu basta: a lista é refeita a cada visita.
  const [agora] = useState(() => Date.now());
  const lista = [
    ...(reunioes ?? []).map((r) => ({ ...r, onde: "reuniao" as const })),
    ...(aulas ?? []).map((a) => ({ ...a, onde: "aula" as const })),
  ].filter((e) => e.status === "ao_vivo" || (e.status === "agendada" && new Date(e.inicio).getTime() - agora < 2 * 3600_000 && new Date(e.inicio).getTime() > agora - 3600_000));
  const e = lista.find((x) => x.status === "ao_vivo") ?? lista.sort((a, b) => a.inicio.localeCompare(b.inicio))[0];
  if (!e) return null;
  const aoVivo = e.status === "ao_vivo";
  return (
    <section aria-label={aoVivo ? "Ao vivo agora" : "Daqui a pouco"} className="border-2 border-ink bg-[#1f1a14] p-4 text-[#f4ecd8] shadow-[4px_4px_0_var(--prelo)]">
      <p className="flex items-center gap-2 font-mono text-[0.66rem] uppercase tracking-[0.2em] text-[#ff8a80]">
        {aoVivo && <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#ff5a4f]" />}
        {aoVivo ? "Agora · ao vivo" : `Daqui a pouco · ${hora(e.inicio)}`}
      </p>
      <p className="mt-1.5 font-serif text-xl font-semibold leading-snug">{e.titulo}</p>
      <p className="mt-0.5 text-xs text-[#cdbb91]">{e.onde === "aula" ? "Aula ao vivo" : "Reunião da equipe"}</p>
      <button type="button" onClick={() => ir(e.onde === "aula" ? "aovivo" : "conversas")} className="mt-3 cursor-pointer border-2 border-[#f4ecd8] bg-[#c21f16] px-3 py-1.5 text-sm font-bold text-white hover:bg-[#a51810]">
        {aoVivo ? "Entrar na sala" : "Ver na agenda"}
      </button>
    </section>
  );
}

interface Atividade {
  itens: { id: string; titulo: string; criado_em: string; tipo: string }[];
}

/** O que acabou de chegar no site (só para quem acompanha a atividade). */
export function NoSiteAgora({ acompanha, ir }: { acompanha: boolean; ir: (aba: string) => void }) {
  const dados = useDado<Atividade>(acompanha ? "atividade_listar" : null);
  const itens = dados?.itens?.slice(0, 3) ?? [];
  if (!acompanha || itens.length === 0) return null;
  return (
    <section aria-label="No site agora" className="border-2 border-ink bg-folha p-4 shadow-[4px_4px_0_var(--sombra)]">
      <p className="font-mono text-[0.66rem] uppercase tracking-[0.2em] text-prelo-texto">No site agora</p>
      <ul className="mt-2 space-y-2">
        {itens.map((item) => (
          <li key={item.id} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-2 text-[0.85rem] leading-snug">
            <span className="font-mono text-xs text-ink-soft">{hora(item.criado_em)}</span>
            <span className="min-w-0">{item.titulo}</span>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => ir("atividade")} className="mt-3 cursor-pointer text-sm font-bold underline decoration-[#c21f16] underline-offset-4 hover:text-prelo-texto">
        Toda a atividade →
      </button>
    </section>
  );
}

/** O último rascunho do Escrever, para continuar de onde parou. */
export function Continuar() {
  const rascunhos = useDado<{ chave: string; titulo: string; atualizado_em: string }[]>("rascunhos_listar");
  const r = rascunhos?.find((x) => x.chave.startsWith("escrever:") && x.titulo.trim());
  if (!r) return null;
  const tipo = r.chave.slice("escrever:".length);
  return (
    <L href={`/painel?aba=escrever&tipo=${encodeURIComponent(tipo)}`} className="group block border-2 border-ink bg-folha p-4 text-ink shadow-[4px_4px_0_var(--sombra)] hover:text-ink hover:shadow-[4px_4px_0_var(--prelo)]">
      <span className="font-mono text-[0.66rem] uppercase tracking-[0.2em] text-prelo-texto">Continuar</span>
      <span className="mt-1 block font-serif text-lg font-semibold leading-snug group-hover:text-prelo-texto">{r.titulo}</span>
      <span className="mt-0.5 block text-xs text-ink-soft">Rascunho salvo {ha(r.atualizado_em)}</span>
    </L>
  );
}

/** As horas que já contam para o próximo certificado. */
export function SuasHoras({ me, ir }: { me: Me; ir: (aba: string) => void }) {
  const horas = useDado<{ livres: number; pendentes: number }>(me.papeis.length > 0 ? "horas_minhas" : null);
  if (!horas) return null;
  const livres = Math.round(Number(horas.livres) * 10) / 10;
  const pendentes = Math.round(Number(horas.pendentes) * 10) / 10;
  return (
    <button type="button" onClick={() => ir("horas")} className="group block w-full cursor-pointer border-2 border-ink bg-folha p-4 text-left shadow-[4px_4px_0_var(--sombra)] hover:shadow-[4px_4px_0_var(--prelo)]">
      <span className="font-mono text-[0.66rem] uppercase tracking-[0.2em] text-prelo-texto">Suas horas</span>
      <span className="mt-1 block font-serif text-lg font-semibold leading-snug group-hover:text-prelo-texto">
        {livres > 0 ? `${String(livres).replace(".", ",")} h para o próximo certificado` : "Cada tarefa feita no painel já conta horas"}
      </span>
      {pendentes > 0 && <span className="mt-0.5 block text-xs text-ink-soft">{String(pendentes).replace(".", ",")} h esperando a conferência</span>}
    </button>
  );
}

/** Uma dica do tutorial por dia. */
export function DicaDoTutorial({ abrir }: { abrir: () => void }) {
  const [dia] = useState(() => Math.floor(Date.now() / 86_400_000));
  return (
    <section aria-label="Dica do tutorial" className="border-2 border-dashed border-ink bg-parchment p-4 text-sm">
      <p className="font-mono text-[0.66rem] uppercase tracking-[0.2em] text-ink-soft">Dica do tutorial</p>
      <p className="mt-1.5 leading-snug">{DICAS[dia % DICAS.length]}</p>
      <button type="button" onClick={abrir} className="mt-2 cursor-pointer font-bold underline decoration-[#c21f16] underline-offset-4 hover:text-prelo-texto">
        Rever o passo a passo →
      </button>
    </section>
  );
}

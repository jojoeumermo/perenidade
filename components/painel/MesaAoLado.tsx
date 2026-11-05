// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { ArrowRight, BookOpenText, Clock3, type LucideIcon, PenLine, Radio } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { can, type Me, porNivel, type Role, rpc } from "@/lib/backend";
import { L } from "../I18n";
import { localDoPainel } from "./comum";
import { Botao, Cartao, Selo } from "./ui";

// Os quadros da Mesa desenhados na prancheta "Painel moderno": o que está ao vivo agora, o que acabou de chegar no site,
// o rascunho para continuar, as horas do mês e uma dica do tutorial. Cada um some quando não tem nada a mostrar, e um
// banco antigo (sem a função) não quebra a Mesa. Desenho só pelos componentes de ui/ e pelos tokens do tema.

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
  { papeis: ["saude"], nome: "Mural de Saúde", secoes: ["saude"] },
  { papeis: ["desenvolvimento"], nome: "Desenvolvimento", secoes: ["erros", "tecnico"] },
];

/** O departamento principal da pessoa (o da função de maior nível) e as seções dele que ela enxerga. */
export function meuDepartamento(me: Me, visiveis: string[]): { nome: string; secoes: string[] } | null {
  for (const papel of porNivel(me.papeis)) {
    if (papel.papel === "representante" && papel.disciplina === "saude") return { nome: "Mural de Saúde", secoes: ["departamentos", "saude", "termos"].filter((id) => visiveis.includes(id)) };
    const d = DEPARTAMENTOS.find((x) => x.papeis.includes(papel.papel));
    if (!d) continue;
    const secoes = ["departamentos", ...d.secoes].filter((id) => visiveis.includes(id));
    if (secoes.length >= 3) return { nome: d.nome, secoes };
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

/** O rótulo em mono, no alto de cada quadro (com um ícone pequeno à esquerda). */
function Rotulo({ simbolo: Simbolo, children }: { simbolo: LucideIcon; children: ReactNode }) {
  return (
    <p className="pn-rotulo-mono flex items-center gap-1.5">
      <Simbolo aria-hidden width={13} height={13} />
      {children}
    </p>
  );
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
    <Cartao
      variante="destaque"
      aria-label={aoVivo ? "Ao vivo agora" : "Daqui a pouco"}
      acoes={
        <Botao variante="principal" pequeno simboloFim={ArrowRight} onClick={() => ir(e.onde === "aula" ? "aovivo" : "conversas")}>
          {aoVivo ? "Entrar na sala" : "Ver na agenda"}
        </Botao>
      }
    >
      <div className="grid gap-1">
        <p>
          <Selo tom="bordo" ponto={aoVivo}>
            {aoVivo ? "Agora · ao vivo" : `Daqui a pouco · ${hora(e.inicio)}`}
          </Selo>
        </p>
        <p className="pn-cartao-titulo">{e.titulo}</p>
        <p className="pn-ajuda">{e.onde === "aula" ? "Aula ao vivo" : "Reunião da equipe"}</p>
      </div>
    </Cartao>
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
    <Cartao
      aria-label="No site agora"
      rodape={
        <Botao variante="discreto" pequeno simboloFim={ArrowRight} onClick={() => ir("atividade")}>
          Toda a atividade
        </Botao>
      }
    >
      <Rotulo simbolo={Radio}>No site agora</Rotulo>
      <ul className="mt-2 grid gap-2">
        {itens.map((item) => (
          <li key={item.id} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-2 text-[0.85rem] leading-snug">
            <span className="pn-rotulo-mono tabular-nums">{hora(item.criado_em)}</span>
            <span className="min-w-0">{item.titulo}</span>
          </li>
        ))}
      </ul>
    </Cartao>
  );
}

/** O último rascunho do Escrever, para continuar de onde parou. */
export function Continuar() {
  const rascunhos = useDado<{ chave: string; titulo: string; atualizado_em: string }[]>("rascunhos_listar");
  const r = rascunhos?.find((x) => x.chave.startsWith("escrever:") && x.titulo.trim());
  if (!r) return null;
  const tipo = r.chave.slice("escrever:".length);
  return (
    <L href={`/painel?aba=escrever&tipo=${encodeURIComponent(tipo)}`} className="pn-cartao pn-cartao-interativo grid gap-1 no-underline">
      <Rotulo simbolo={PenLine}>Continuar</Rotulo>
      <span className="pn-cartao-titulo">{r.titulo}</span>
      <span className="pn-ajuda">Rascunho salvo {ha(r.atualizado_em)}</span>
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
    <Cartao as="div" interativo onClick={() => ir("horas")} className="grid gap-1">
      <Rotulo simbolo={Clock3}>Suas horas</Rotulo>
      <span className="pn-cartao-titulo tabular-nums">{livres > 0 ? `${String(livres).replace(".", ",")} h para o próximo certificado` : "Cada tarefa feita no painel já conta horas"}</span>
      {pendentes > 0 && <span className="pn-ajuda tabular-nums">{String(pendentes).replace(".", ",")} h esperando a conferência</span>}
    </Cartao>
  );
}

/** Uma dica do tutorial por dia. */
export function DicaDoTutorial({ abrir }: { abrir: () => void }) {
  const [dia] = useState(() => Math.floor(Date.now() / 86_400_000));
  return (
    <Cartao
      variante="plano"
      aria-label="Dica do tutorial"
      rodape={
        <Botao variante="discreto" pequeno simboloFim={ArrowRight} onClick={abrir}>
          Rever o passo a passo
        </Botao>
      }
    >
      <Rotulo simbolo={BookOpenText}>Dica do tutorial</Rotulo>
      <p className="mt-1.5 leading-snug">{DICAS[dia % DICAS.length]}</p>
    </Cartao>
  );
}

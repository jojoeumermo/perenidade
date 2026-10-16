// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { areaSlugs, essential, stages } from "@/lib/areas";
import type { Me, Role } from "@/lib/backend";
import { L, useI18n } from "../I18n";
import { papeis, useLista } from "./comum";
import type { Membro } from "./Equipe";

/** O que falta em cada disciplina (arquivo estático do site, refeito a cada publicação). */
interface Trilha {
  slug: string;
  titulo: string;
  etapa: (typeof stages)[number];
  prontas: number;
  /** As próximas aulas do roteiro (no máximo três). */
  faltam: { slug: string; titulo: string }[];
  quantasFaltam: number;
  traduzidas: Record<"en" | "es" | "zh" | "ru", number>;
}
type Retrato = Record<string, { obras: number; avulsos: number; videos: number; trilhas: Trilha[] }>;

interface Sugestao {
  funcao: string;
  titulo: string;
  detalhe: string;
  /** Seção do painel que resolve, ou endereço do site para ler antes. */
  aba?: string;
  link?: string;
}

const idiomas = { en: "inglês", es: "espanhol", zh: "chinês", ru: "russo" } as const;
const ordem = (etapa: Trilha["etapa"]) => stages.indexOf(etapa);

let pedido: Promise<Retrato | null> | null = null;
function useRetrato(lang: string) {
  const [retrato, setRetrato] = useState<Retrato | null>(null);
  useEffect(() => {
    let cancelado = false;
    pedido ??= fetch(`/${lang}/tarefas.json`)
      .then((resposta) => (resposta.ok ? (resposta.json() as Promise<Retrato>) : null))
      .catch(() => null);
    void pedido.then((dados) => {
      if (!cancelado) setRetrato(dados);
    });
    return () => {
      cancelado = true;
    };
  }, [lang]);
  return retrato;
}

/** As disciplinas de uma função (educação, educação secundária, reforço); sem disciplina, todas. */
const disciplinasDe = (me: Me, papel: Role["papel"]) => me.papeis.filter((p) => p.papel === papel).map((p) => p.disciplina ?? "");

/**
 * "Por onde começar": olha o que falta no instituto e aponta, para cada função da pessoa, um trabalho concreto.
 * Não faz nada sozinho e não guarda nada: é uma lista de sugestões refeita cada vez que a Mesa abre.
 */
export function PorOndeComecar({ me, ir }: { me: Me; ir: (aba: string) => void }) {
  const { lang, t } = useI18n();
  const retrato = useRetrato(lang);
  const coordena = me.papeis.some((p) => p.papel === "coordenacao" || p.papel === "vice");
  const equipe = useLista<Membro[]>("equipe_membros");
  // Gira a escolha a cada dia, para a mesma sugestão não ficar parada na Mesa.
  const [hoje] = useState(() => Math.floor(Date.now() / 86_400_000));
  const nome = (area: string) => t.areas[area as keyof typeof t.areas]?.[0] ?? area;
  if (!retrato) return null;

  const tem = (papel: Role["papel"]) => me.papeis.some((p) => p.papel === papel);
  const trilhasDe = (area: string) => [...(retrato[area]?.trilhas ?? [])].sort((a, b) => ordem(a.etapa) - ordem(b.etapa));
  const todas = Object.entries(retrato).flatMap(([area, dados]) => dados.trilhas.map((trilha) => ({ ...trilha, area })));
  const completas = todas.filter((trilha) => trilha.prontas >= 4 && trilha.faltam.length === 0);
  const doDia = <T,>(lista: T[]) => (lista.length ? lista[hoje % lista.length] : undefined);
  const sugestoes: Sugestao[] = [];

  // Educação e educação secundária: a próxima aula do roteiro, ou os próximos temas quando a disciplina está completa.
  for (const papel of ["educacao", "educacao_secundaria"] as const) {
    for (const area of disciplinasDe(me, papel)) {
      if (!area || !retrato[area]) continue;
      const comFalta = trilhasDe(area).filter((trilha) => trilha.faltam.length > 0);
      for (const trilha of comFalta.slice(0, papel === "educacao" ? 2 : 1)) {
        sugestoes.push({
          funcao: papeis[papel],
          titulo: `Escreva “${trilha.faltam[0].titulo}”`,
          detalhe: `Próxima aula em preparação na trilha ${trilha.titulo} (${trilha.prontas} prontas, ${trilha.quantasFaltam} faltando). Em Escrever, escolha Aula e depois a aula do roteiro.`,
          aba: "escrever",
        });
      }
      if (comFalta.length === 0) {
        sugestoes.push({
          funcao: papeis[papel],
          titulo: `${nome(area)} está com todas as aulas escritas`,
          detalhe: "Proponha os próximos temas: em Escrever, escolha Próximas aulas de uma trilha. Aprovados, eles entram como “em preparação” e aumentam a meta.",
          aba: "escrever",
        });
      }
      if (papel === "educacao_secundaria") {
        const trilha = doDia(trilhasDe(area).filter((item) => item.prontas > 0));
        sugestoes.push({
          funcao: papeis[papel],
          titulo: `Publique um material avulso de ${nome(area)}`,
          detalhe: `${retrato[area].avulsos === 0 ? "A disciplina ainda não tem nenhum." : `Já são ${retrato[area].avulsos}.`} ${trilha ? `Uma lista de exercícios ou um resumo para quem estuda a trilha ${trilha.titulo} é um bom começo.` : "Uma aula avulsa, uma lista de exercícios ou um roteiro de estudo."}`,
          aba: "escrever",
        });
      }
    }
  }

  // Quem ensina também pode gravar: uma aula curta em vídeo para uma trilha que já tem aulas escritas.
  const ensina = [...disciplinasDe(me, "educacao"), ...disciplinasDe(me, "educacao_secundaria")].filter((area) => area && retrato[area]);
  const paraVideo = doDia(ensina.flatMap((area) => trilhasDe(area).filter((trilha) => trilha.prontas > 0)));
  if (paraVideo)
    sugestoes.push({
      funcao: tem("educacao") ? papeis.educacao : papeis.educacao_secundaria,
      titulo: `Grave uma aula em vídeo para a trilha ${paraVideo.titulo}`,
      detalhe: "Até 10 minutos, com a câmera ou a tela: um resumo, um exercício resolvido ou algo que fica melhor explicado falando. Em Aulas em vídeo, grave ou envie e escreva a transcrição.",
      aba: "videoaulas",
    });

  if (tem("traducao")) {
    // As trilhas com mais aulas prontas e menos traduzidas, em cada idioma.
    for (const [idioma, nomeDoIdioma] of Object.entries(idiomas) as [keyof typeof idiomas, string][]) {
      const alvo = todas.filter((trilha) => trilha.prontas >= 5).sort((a, b) => a.traduzidas[idioma] / a.prontas - b.traduzidas[idioma] / b.prontas || b.prontas - a.prontas)[0];
      if (alvo && alvo.traduzidas[idioma] < alvo.prontas) {
        sugestoes.push({
          funcao: papeis.traducao,
          titulo: `Traduza ${alvo.titulo} para o ${nomeDoIdioma}`,
          detalhe: `${alvo.traduzidas[idioma]} de ${alvo.prontas} aulas já estão em ${nomeDoIdioma}. Em Escrever, escolha Tradução e cole o endereço da aula.`,
          link: `/trilhas/${alvo.slug}`,
        });
      }
    }
  }

  if (tem("revisao")) {
    const trilha = doDia(completas);
    if (trilha)
      sugestoes.push({
        funcao: papeis.revisao,
        titulo: `Releia a trilha ${trilha.titulo}`,
        detalhe: "Confira datas, contas, exemplos e se cada fonte abre. Achou algo? Use “Sugira uma correção” no fim da aula.",
        link: `/trilhas/${trilha.slug}`,
      });
  }

  if (tem("curadoria") || tem("coordenacao") || tem("vice")) {
    const poucas = areaSlugs.filter((area) => retrato[area] && retrato[area].trilhas.length > 0).sort((a, b) => retrato[a].obras - retrato[b].obras).slice(0, 3);
    if (poucas.length)
      sugestoes.push({
        funcao: papeis.curadoria,
        titulo: "Disciplinas com poucas obras no acervo",
        detalhe: `${poucas.map((area) => `${nome(area)} (${retrato[area].obras})`).join(", ")}. Procure obras livres em Fontes abertas e envie a ficha em Escrever → Obra para o acervo.`,
        aba: "fontes",
      });
  }

  if (tem("design") || tem("marketing")) {
    const trilha = doDia(completas);
    if (trilha)
      sugestoes.push({
        funcao: tem("marketing") ? papeis.marketing : papeis.design,
        titulo: `Um cartaz ou post para a trilha ${trilha.titulo}`,
        detalhe: `Ela está completa (${trilha.prontas} aulas). Uma arte para imprimir ou para as redes ajuda a trilha a chegar em quem precisa. Envie em Materiais e arquivos.`,
        aba: "materiais",
      });
  }

  if (tem("marketing")) {
    const vazias = essential.filter((area) => retrato[area] && retrato[area].trilhas.reduce((soma, trilha) => soma + trilha.prontas, 0) === 0);
    const semAvulsos = areaSlugs.filter((area) => retrato[area] && retrato[area].trilhas.length > 0 && retrato[area].avulsos === 0).length;
    sugestoes.push({
      funcao: papeis.marketing,
      titulo: "Chamada de voluntariado",
      detalhe: vazias.length
        ? `Faltam educadores para começar ${vazias.map(nome).join(", ")}. Uma chamada nas redes, apontando para a página Voluntariado, ajuda a abrir essas disciplinas.`
        : `${semAvulsos} disciplinas ainda não têm nenhum material avulso: uma chamada para educadores secundários (quem tem algo a compartilhar, mesmo sem dar a disciplina inteira) faz diferença.`,
      link: "/voluntarios",
    });
  }

  if (tem("jornalismo")) {
    sugestoes.push({
      funcao: papeis.jornalismo,
      titulo: "Uma matéria a partir de uma aula",
      detalhe: `${doDia(completas) ? `A trilha ${doDia(completas)?.titulo} está completa: ela pode virar pauta para o jornal ou para um episódio do podcast.` : "Escolha uma aula recente e transforme em pauta."} Fatos conferidos e fontes à vista.`,
      aba: "escrever",
    });
  }

  if (tem("desenvolvimento")) {
    sugestoes.push({ funcao: papeis.desenvolvimento, titulo: "Pedidos de ajuda da equipe", detalhe: "Veja o canal de pedidos no Mural da equipe: é ali que as outras funções pedem ferramentas e consertos.", aba: "rede" });
  }

  if (coordena && equipe.dados) {
    const ensinadas = new Set(equipe.dados.flatMap((membro) => membro.papeis.filter((p) => p.papel === "educacao" || p.papel === "educacao_secundaria").map((p) => p.disciplina)));
    const semNinguem = essential.filter((area) => !ensinadas.has(area));
    if (semNinguem.length)
      sugestoes.push({
        funcao: papeis.coordenacao,
        titulo: "Disciplinas essenciais sem educador na equipe",
        detalhe: `${semNinguem.map(nome).join(", ")}. Um convite com a função já definida, ou uma chamada pelo marketing, resolve.`,
        aba: "pessoas",
      });
  }

  if (sugestoes.length === 0) return null;
  return (
    <section>
      <h2 className="jornal-secao">
        <span className="jornal-editoria">Por onde começar</span>
      </h2>
      <p className="mt-3 max-w-3xl text-ink-soft">Sugestões tiradas do que falta no instituto agora, uma ou duas por função. Nada aqui é obrigatório: é só um ponto de partida.</p>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {sugestoes.map((sugestao, i) => (
          <li key={`${sugestao.funcao}-${sugestao.titulo}`} style={{ animationDelay: `${i * 45}ms` }} className="painel-quadro painel-surge flex flex-col p-4">
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-gold">{sugestao.funcao}</span>
            <span className="mt-1 font-serif text-lg font-semibold leading-snug">{sugestao.titulo}</span>
            <span className="mt-1 flex-1 text-ink-soft">{sugestao.detalhe}</span>
            <span className="mt-3">
              {sugestao.aba ? (
                <button type="button" onClick={() => ir(sugestao.aba as string)} className="cursor-pointer font-semibold underline hover:text-oxblood">
                  Começar →
                </button>
              ) : (
                <L href={sugestao.link ?? "/"} className="font-semibold underline hover:text-oxblood">
                  Abrir no site →
                </L>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

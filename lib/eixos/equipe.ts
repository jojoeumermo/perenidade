// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A pesquisa dos 12 eixos da equipe (Etapa 8, B6): as partes puras, sem rede nem disco. A conta do teste é a de
// lib/eixos/pontuacao.ts; aqui ficam a ordem fixa dos 12 números que vão ao banco, a versão e o texto do aviso de
// consentimento. O que vai ao banco é só o vetor de 12 números (supabase/migracoes/2026-11-eixos-equipe.sql); a resposta
// de cada pergunta nunca sai do navegador. Base legal e limites: docs/eixos-equipe.md.

/** Mínimo de respostas para a coordenação ver algo (igual ao do banco). */
export const MINIMO_DA_PESQUISA = 5;

/** Versão do aviso abaixo: vai com o envio, como prova de qual texto a pessoa leu. Mudou o texto, mude a versão. */
export const VERSAO_DO_AVISO_EIXOS = "2026-11-1";

/** A ordem em que os 12 números seguem para o banco (a mesma de interno.eixos_equipe_ids e de content/eixos.json). */
export const ORDEM_DOS_EIXOS = ["propriedade", "planejamento", "comercio", "poder", "liberdades", "territorio", "soberania", "conflito", "diversidade", "religiao", "costumes", "tecnologia"] as const;

/** Os 12 números, na ordem fixa, prontos para o envio. Falta ou valor fora de 0 a 100 é erro: nada é completado em silêncio. */
export function vetorParaEnvio(pontos: Readonly<Record<string, number>>): number[] {
  return ORDEM_DOS_EIXOS.map((id) => {
    const v = pontos[id];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100) throw new Error(`ponto inválido: ${id}`);
    return Math.round(v);
  });
}

/** O aviso destacado que a pessoa lê antes de responder (LGPD, art. 11, I; finalidade determinada, art. 8º, § 4º). */
export const AVISO_DA_PESQUISA = {
  titulo: "Pesquisa anônima dos 12 eixos (opcional)",
  anonimo: "Esta pesquisa é anônima. A coordenação vê só a média e a distribuição da equipe, nunca a resposta de uma pessoa.",
  finalidade:
    "Para que serve: saber, em conjunto, como a equipe se distribui nos 12 eixos, para que o Instituto Lúcia entenda a diversidade de ideias dentro de casa e cuide para que nenhum lado domine a escolha de pautas. Nenhum outro uso será feito.",
  oQueGuarda:
    "O que fica guardado: só somas por eixo e a contagem de quantas pessoas caíram em cada uma de cinco faixas. Suas respostas às perguntas ficam apenas neste navegador e se perdem ao sair desta tela. Fica registrado que a sua conta já respondeu (para não responder duas vezes) e qual versão deste aviso você leu, sem nenhuma ligação com o resultado.",
  sensivel:
    "Opinião política é dado pessoal sensível (Lei 13.709/2018, art. 5º, II). Só tratamos com o seu consentimento específico e destacado (art. 11, I), para esta finalidade (art. 8º, § 4º). Dado agregado e anonimizado deixa de ser dado pessoal (art. 12).",
  limites:
    "Cuidados contra identificar alguém: a coordenação só vê o resultado quando 5 ou mais pessoas respondem, e o que ela vê só muda de 5 em 5 respostas. Depois de enviado, o número entra na soma e não dá mais para separá-lo: por isso não é possível retirar a resposta, mas é possível não responder e nada muda para você.",
  consentimento: "Li o aviso e concordo em enviar o resultado do meu teste, de forma anônima, para a soma da equipe.",
  opcional: "Responder é opcional. Quem não responde continua com o mesmo acesso ao painel; ninguém é cobrado nem fica sabendo.",
} as const;

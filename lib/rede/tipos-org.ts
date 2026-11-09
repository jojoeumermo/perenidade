// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os tipos da F4 (perfis e organizações) da Alumia (docs/plano-2026-11/PLANO-ALUMIA.md §5 F4): o que as funções rede_org_* e
// rede_perfil_extras devolvem. O BANCO ainda não existe: a etapa de back-end cria as funções com estes nomes e estas formas
// (os dublês e os dados de exemplo vivem em lib/rede/org/). Sem os atalhos "@/" de propósito (roda no Node nos testes).
//
// Regras de privacidade que os tipos já carregam (PLANO-ALUMIA §6; LGPD art. 5º, II e art. 11: filiação e opinião política são
// dado sensível):
//  - nenhuma lista de quem segue, votou, está na sala ou é de um núcleo: só agregados, e só a partir de 3 (`pessoas` nulo abaixo);
//  - o vínculo entre a organização e quem cuida da conta NUNCA vem (fica só em interno.rede_identidades);
//  - voto de consulta é secreto: volta só se EU já votei e, depois de fechada, a proporção de cada opção;
//  - a fila da plenária vem na ordem de chegada (criado_em) e ninguém reordena; o @ de quem perguntou só vem se a pessoa quis.

/** Os tipos de organização (o mesmo check do banco: rede_orgs.tipo). */
export const TIPOS_DE_ORG = ["partido", "mandato", "sindicato", "movimento", "coletivo", "gremio", "dce", "outro"] as const;
export type TipoDeOrg = (typeof TIPOS_DE_ORG)[number];

/** Uma contagem de PESSOAS já tratada pelo servidor: nula abaixo de 3 ("poucas pessoas"). Nunca acompanha nomes. */
export type Pessoas = number | null;

/** Um núcleo da organização (prancha: "Núcleo Zona Leste · terças, 19h · Entrar"). */
export interface NucleoDaOrg {
  id: string;
  nome: string;
  /** Cor da comunidade (1–5), a mesma em toda tela. */
  cor: 1 | 2 | 3 | 4 | 5;
  /** Quando se encontra, escrito por quem cuida ("terças, 19h"). */
  quando: string;
  /** Bairro ou cidade escritos pela organização (nunca GPS). */
  onde: string | null;
  /** Eu sou do núcleo? Só sobre mim; nunca a lista de membros. */
  sou: boolean;
  /** Pedi para entrar e espero resposta. */
  pedi: boolean;
}

/** Um voto da organização no "Como votamos" (prestação de contas). */
export interface VotacaoDaOrg {
  id: string;
  /** Data da votação (AAAA-MM-DD). */
  data: string;
  projeto: string;
  voto: "sim" | "nao" | "abstencao" | "obstrucao" | "ausente";
  porque: string;
  /** O resultado da casa ("aprovado por 31 a 18"). */
  resultado: string;
  /** Link da fonte pública (site da Câmara, ata, diário oficial). Obrigatório no banco: quem quiser confere. */
  fonte: string | null;
}

/** Uma opção de consulta à base. `proporcao` (0–1) só vem com a consulta fechada. */
export interface OpcaoDaConsulta {
  id: string;
  texto: string;
  proporcao: number | null;
}

/** Uma consulta à base (só quem é de um núcleo da organização vota; voto secreto; prazo e compromisso escritos antes). */
export interface ConsultaDaOrg {
  id: string;
  pergunta: string;
  /** Simples (uma opção) ou ranqueada (ordem de preferência, apurada por segundo turno instantâneo). */
  metodo: "simples" | "ranqueada";
  opcoes: OpcaoDaConsulta[];
  /** Fecha em (ISO). */
  prazo: string;
  /** O que a organização se compromete a fazer com o resultado, escrito ANTES de abrir. */
  compromisso: string;
  /** Quórum mínimo em pessoas (o número é da regra, não de quem votou). */
  quorum: number | null;
  situacao: "aberta" | "fechada";
  /** Quantas pessoas votaram, agregado e só a partir de 3; nulo abaixo. Só com a consulta fechada. */
  votantes: Pessoas;
  /** Atingiu o quórum? Só com a consulta fechada. */
  quorumAtingido: boolean | null;
  /** Eu posso votar (sou de um núcleo da organização)? */
  possoVotar: boolean;
  /** Eu já votei (o QUÊ eu votei nunca volta). */
  votei: boolean;
  /** Nomes dos núcleos que votam (nunca as pessoas). */
  nucleos: string[];
}

/** Uma pergunta da fila da plenária. A ordem é a de chegada; `handle` só vem se a pessoa escolheu mostrar. */
export interface PerguntaDaPlenaria {
  id: string;
  handle: string | null;
  texto: string;
  criadaEm: string;
  respondida: boolean;
}

/** Uma plenária aberta (ao vivo ou marcada). */
export interface PlenariaDaOrg {
  id: string;
  org: { handle: string; codinome: string };
  titulo: string;
  descricao: string;
  inicio: string;
  aoVivo: boolean;
  /** Link da sala (YouTube não listado ou Galène do instituto). Nulo enquanto não começou. */
  sala: string | null;
  /** Pessoas na sala, agregado e a partir de 3 (nulo abaixo). */
  naSala: Pessoas;
  /** Quantas perguntas esperam na fila (perguntas, não pessoas). */
  naFila: number;
  /** As primeiras da fila, em ordem de chegada. */
  fila: PerguntaDaPlenaria[];
  /** Eu já mandei pergunta para esta plenária? */
  pergunteiEu: boolean;
}

/** O perfil público de uma organização. */
export interface OrgPublica {
  handle: string;
  codinome: string;
  tipo: TipoDeOrg;
  bio: string;
  cidade: string | null;
  /** Data do selo (ISO); nulo = ainda sem selo. */
  verificadaEm: string | null;
  /** Qual documento público foi conferido ("CNPJ", "registro do partido", "diploma do mandato"); nunca o de uma pessoa. */
  documento: string | null;
  /** A palavra da capa em mosaico (A–Z, até 14 letras). */
  palavra: string;
  /** Eu sigo? Eu ligo o sininho? Só sobre mim. */
  sigo: boolean;
  sino: boolean;
  /** Eu posso agir como esta organização (sou gestor)? Só para mim; nunca diz quem mais é. */
  gerencio: boolean;
  /** Sem contagem de seguidores: a regra da casa continua (2026-11-rede-perfil.sql:14; PLANO-ALUMIA §4.6, "manter"). */
  nucleos: NucleoDaOrg[];
  votacoes: VotacaoDaOrg[];
  consultas: ConsultaDaOrg[];
  plenarias: PlenariaDaOrg[];
}

/** Uma plenária ao vivo para a coluna da direita ("Ao vivo agora"): só das organizações que a pessoa segue ou públicas. */
export type PlenariaAoVivo = Pick<PlenariaDaOrg, "id" | "org" | "titulo" | "descricao" | "inicio" | "aoVivo" | "sala" | "naSala" | "naFila">;

/** O que um gestor registra em "Como votamos". */
export type PedidoDeVotacao = Omit<VotacaoDaOrg, "id">;

/** O pedido do selo (fila do painel). Só documento público (CNPJ, registro de partido no TSE, diploma do mandato, ata). */
export interface PedidoDeSelo {
  /** O codinome da organização (o nome público: "Mandata Popular"). */
  codinome: string;
  /** O @nome da conta da organização (nova, criada sem senha por lib/rede/contas-extra.ts, ou uma já existente que a pessoa gere). */
  handle: string;
  tipo: TipoDeOrg;
  cidade: string;
  /** Tipo de documento público e onde conferir (número ou link). */
  documentoTipo: string;
  documento: string;
  /** Uma frase sobre a organização. */
  sobre: string;
  /** Quem cuida da conta declara ter 18 anos ou mais (a Alumia é só para maiores). */
  maior: boolean;
}

/** O pedido na fila do painel (só a equipe vê). */
export interface PedidoNaFila extends PedidoDeSelo {
  id: string;
  criadoEm: string;
  situacao: "esperando" | "aceito" | "recusado";
}

/** Os extras do perfil de pessoa (F4): status curto, pronomes, até 4 campos e até 6 destaques. */
export const STATUS_DO_PERFIL = ["greve", "ato", "estudando", "cuidando", "ferias"] as const;
export type StatusDoPerfil = (typeof STATUS_DO_PERFIL)[number];

export interface CampoDoPerfil {
  rotulo: string;
  valor: string;
}

export interface DestaqueDoPerfil {
  id: string;
  tipo: "post" | "ato";
  titulo: string;
  /** Para onde leva (endereço dentro da Alumia). */
  href: string;
}

export interface ExtrasDoPerfil {
  status: { tipo: StatusDoPerfil; texto: string; ate: string | null } | null;
  pronomes: string | null;
  campos: CampoDoPerfil[];
  destaques: DestaqueDoPerfil[];
}

/** O que a pessoa manda para editar os extras do próprio perfil. */
export interface PedidoDeExtras {
  status?: { tipo: StatusDoPerfil; texto: string; horas: number } | null;
  pronomes?: string | null;
  campos?: CampoDoPerfil[];
}

/** As abas do perfil de pessoa (filtros da linha `u:<handle>`). */
export const ABAS_DA_PESSOA = ["posts", "respostas", "midia"] as const;
export type AbaDaPessoa = (typeof ABAS_DA_PESSOA)[number];

/** As abas do perfil de organização (prancha Org-Perfil). */
export const ABAS_DA_ORG = ["posts", "atos", "contas", "consultas", "plenarias"] as const;
export type AbaDaOrg = (typeof ABAS_DA_ORG)[number];

/** Limites que a tela confere antes de mandar (o banco confere de novo). */
export const LIMITES = { campos: 4, destaques: 6, rotulo: 30, valor: 80, pronomes: 30, statusTexto: 60, pergunta: 280, sobre: 280, documento: 200 } as const;

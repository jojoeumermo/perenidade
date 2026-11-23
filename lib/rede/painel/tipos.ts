// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que o painel de controle da Alumia recebe do banco (supabase/migracoes/20261113-alumia-o7-painel.sql). Só tipos e
// constantes: quem pode o quê é decidido no banco, em cada função; nada aqui dá permissão a ninguém.

/** A versão do banco da Alumia que este código espera (public.rede_alumia_versao). Quem junta uma onda nova sobe o número aqui. */
export const VERSAO_ESPERADA_DO_BANCO = 18;
/** A versão das funções do painel que esta tela espera (o campo "painel" de alumia_painel_geral). */
export const VERSAO_ESPERADA_DO_PAINEL = 1;

export type PapelNoPainel = "coordenacao" | "admin";

export interface EuNoPainel {
  pode: boolean;
  papel?: PapelNoPainel;
}

export interface LinhaDoRegistro {
  id: number;
  quando: string;
  quem: string;
  papel: PapelNoPainel | "sistema";
  acao: string;
  alvo: string;
  motivo: string;
  alvo_tipo?: string;
  referencia?: string;
  detalhes?: Record<string, unknown>;
}

export interface VisaoGeral {
  papel: PapelNoPainel;
  numeros: {
    contas: number;
    aprovadas: number;
    fila: number;
    denuncias: number;
    denuncias_urgentes: number;
    posts_hoje: number;
    comunidades: number;
    organizacoes: number;
    selos_esperando: number;
    sancoes: number;
    redes_barradas: number;
    lixeira: number;
  };
  saude: {
    versao: number;
    painel: number;
    trava: boolean;
    trava_desde: string | null;
    agendador: boolean;
    redes_vistas: number;
    admin: boolean;
    mediadores: number;
    decisoes: Record<string, boolean>;
  };
  ultimas: LinhaDoRegistro[];
}

export type SituacaoDoCadastro = "em_analise" | "aprovada" | "recusada";

export interface Cadastro {
  id: string;
  codinome: string;
  handle: string | null;
  situacao: SituacaoDoCadastro;
  origem: string | null;
  motivo: string | null;
  pedido_em: string;
  vezes: number;
  conta_dias: number;
  decidido_em: string | null;
  motivo_decisao: string | null;
  decidido_por: string | null;
  suspensa: boolean;
  da_casa: boolean;
}

export interface Cadastros {
  contagem: Record<SituacaoDoCadastro, number>;
  itens: Cadastro[];
}

export interface PessoaNaBusca {
  id: string;
  codinome: string;
  handle: string | null;
  entrada: string;
  suspensa: boolean;
  da_casa: boolean;
  organizacao: boolean;
}

export interface Sancao {
  id: string;
  tipo: "suspensao" | "banimento" | "rede";
  motivo: string;
  por: string | null;
  de: string;
  ate: string | null;
  ativa: boolean;
  encerrada_em: string | null;
}

export interface FichaDaPessoa {
  id: string;
  codinome: string;
  handle: string | null;
  entrada: string;
  conta_dias: number;
  suspensa: boolean;
  suspensao: string;
  nivel: number;
  posts: number;
  posts_ocultos: number;
  procedentes_90: number;
  denuncias_abertas: number;
  fator: boolean;
  sessoes: number;
  redes: number;
  papeis: string[];
  admin: boolean;
  coordenacao: boolean;
  organizacao: boolean;
  eu: boolean;
  banimento_mediacao: boolean;
  sancoes: Sancao[];
}

export interface PreviaDaRede {
  redes: number;
  contas: number;
  da_casa: boolean;
}

export interface BanimentoDeRede {
  id: string;
  motivo: string;
  por: string | null;
  contas: number;
  barradas_agora: number;
  de: string;
  ate: string;
  ativo: boolean;
}

export interface PostNoPainel {
  id: string;
  tipo: string;
  titulo: string | null;
  trecho: string;
  comunidade: string | null;
  publico: string;
  criado_em: string;
  oculto: boolean;
  retido: boolean;
  travado: boolean;
  resposta: boolean;
  motivo: string | null;
  autor: string;
  autor_id: string | null;
  midias: number;
  denuncias: number;
  lixeira: { ate: string; motivo: string; em: string } | null;
}

export interface StoryNoPainel {
  id: string;
  autor: string;
  autor_id: string | null;
  texto: string | null;
  legenda: string | null;
  alt: string | null;
  fundo: string | null;
  cor: string | null;
  publico: string;
  midia: boolean;
  caminho: string | null;
  retido: boolean;
  criado_em: string;
  expira_em: string;
}

export interface MidiaNoPainel {
  id: string;
  post: string;
  caminho: string;
  alt: string | null;
  largura: number | null;
  altura: number | null;
  criado_em: string;
  autor: string;
  trecho: string;
  oculto: boolean;
  comunidade: string | null;
}

export interface AvisoFixado {
  id: string;
  texto: string;
  link: string | null;
  por: string | null;
  de: string;
  ate: string;
  ativo: boolean;
}

export interface DenunciaNaFila {
  id: string;
  protocolo: string;
  alvo_tipo: "post" | "perfil" | "comunidade";
  alvo: string;
  categoria: string;
  prioridade: number;
  situacao: "aberta" | "em_analise" | "resolvida" | "descartada";
  criado_em: string;
  texto: string | null;
  comunidade: string | null;
  titulo: string | null;
  trecho: string | null;
  nucleo: boolean;
  mesmas: number;
}

export interface DenunciaAberta {
  denuncia: DenunciaNaFila;
  alvo: {
    id?: string;
    titulo?: string | null;
    texto?: string | null;
    comunidade?: string | null;
    nucleo?: boolean;
    nome?: string;
    descricao?: string | null;
    bio?: string | null;
    oculto?: boolean;
    retido?: boolean;
    autor?: string;
    autor_id?: string | null;
    autor_nivel?: number;
    autor_procedentes_90?: number;
    criado_em?: string;
  } | null;
  historico: { acao: string; regra: string; motivo: string; criado_em: string }[];
}

export interface PapeisDaAlumia {
  papel: PapelNoPainel;
  admin: { id: string; nome: string; desde: string; por: string | null; suspensa: boolean } | null;
  coordenacao: string[];
  mediacao: { nome: string; na_alumia: boolean; suspensa: boolean }[];
}

export interface ComunidadeNoPainel {
  slug: string;
  nome: string;
  descricao: string | null;
  categoria: string;
  tipo: string;
  criada_em: string;
  membros: number;
  posts_30: number;
  denuncias: number;
  moderacao: { id: string; nome: string }[];
  encerrada: { em: string; motivo: string } | null;
}

export interface OrgNoPainel {
  id: string;
  codinome: string;
  handle: string | null;
  tipo: string;
  cidade: string | null;
  selo: string | null;
  documento_tipo: string | null;
  documento: string | null;
  criada_em: string;
  suspensa: boolean;
  pedido: { id: string; documento_tipo: string; documento: string; sobre: string | null; criado_em: string } | null;
}

export interface FuncoesDaAlumia {
  /** so_pelo_nome: ligar abre pedido de segunda pessoa; aguardando: há um pedido esperando confirmação. */
  recursos: { nome: string; decisao: boolean | null; em: string | null; por: string | null; so_pelo_nome?: boolean; aguardando?: boolean }[];
  trava: { ligada: boolean; desde: string | null; eu_passo: boolean; aprovadas: number; na_fila: number };
}

export interface RegistroDoPainel {
  itens: LinhaDoRegistro[];
  mais: boolean;
  acoes: string[];
}

/** Os nomes das ações do registro, para a tela e para a planilha exportada. O que não estiver aqui aparece pelo código. */
export const NOME_DA_ACAO: Record<string, string> = {
  cadastro_aprovado: "Cadastro aprovado",
  cadastro_recusado: "Cadastro recusado",
  cadastro_reaberto: "Cadastro reaberto",
  busca_pelo_nome: "Busca pelo nome da conta",
  conta_suspensa: "Conta suspensa",
  conta_banida: "Conta banida",
  sancao_desfeita: "Sanção desfeita",
  sessoes_encerradas: "Sessões encerradas",
  segundo_fator_retirado: "Segundo fator retirado",
  conta_apagada: "Conta apagada",
  rede_banida: "Rede barrada",
  rede_liberada: "Rede liberada",
  post_ocultar: "Post ocultado",
  post_mostrar: "Post de volta ao ar",
  post_apagar: "Post apagado (lixeira)",
  post_restaurar: "Post restaurado",
  story_reter: "Story retido",
  story_liberar: "Story liberado",
  story_apagar: "Story apagado",
  midia_apagada: "Imagem apagada",
  midia_aberta: "Arquivo aberto para moderar",
  tema_retido: "Assunto tirado de Em alta",
  tema_devolvido: "Assunto devolvido a Em alta",
  fediverso_ligado: "Fediverso inteiro ligado",
  fediverso_desligado: "Fediverso inteiro desligado",
  aviso_fixado: "Aviso fixado",
  aviso_retirado: "Aviso retirado",
  quebra_vidro: "Post de núcleo aberto por denúncia",
  denuncia_ocultar: "Denúncia: post retirado",
  denuncia_avisar: "Denúncia: aviso ao autor",
  denuncia_descartar: "Denúncia descartada",
  admin_nomeado: "Admin nomeado",
  admin_destituido: "Admin destituído",
  comunidade_criada: "Comunidade criada",
  comunidade_encerrada: "Comunidade encerrada",
  comunidade_reaberta: "Comunidade reaberta",
  moderacao_nomeada: "Moderação de comunidade nomeada",
  moderacao_retirada: "Moderação de comunidade retirada",
  selo_dado: "Selo dado",
  selo_recusado: "Selo recusado",
  selo_retirado: "Selo retirado",
  recurso_ligado: "Função ligada",
  recurso_desligado: "Função desligada",
  recurso_padrao: "Função de volta ao padrão",
  recurso_pedido: "Função: pedido de segunda pessoa",
  trava_ligada: "Trava da entrada ligada",
  trava_desligada: "Trava da entrada desligada",
  registro_exportado: "Registro exportado",
};

export const nomeDaAcao = (acao: string) => NOME_DA_ACAO[acao] ?? acao.replaceAll("_", " ");

/** Os erros que só o painel devolve, em português de tela. O resto cai no texto comum do painel interno. */
export const ERROS_DO_PAINEL: Record<string, string> = {
  sem_permissao: "Só a coordenação e o admin da Alumia, com o código do aplicativo autenticador confirmado nesta sessão.",
  alumia_entrada: "A trava da entrada está ligada: confirme o código do aplicativo autenticador nesta sessão para usar o painel.",
  voce_mesmo: "Ninguém age sobre a própria conta por aqui.",
  coordenacao_protegida: "Esta conta é da coordenação: nada do painel da Alumia age sobre ela.",
  tem_funcao: "Esta conta tem função na casa. Tire a função antes, no painel da equipe.",
  nao_encontrado: "Não encontrado. Pode já ter sido resolvido por outra pessoa: atualize a lista.",
  confirmacao_errada: "A confirmação escrita não confere.",
  confira_de_novo: "O número de contas atingidas mudou. Confira de novo antes de confirmar.",
  sem_rede: "Esta conta não tem nenhuma rede vista nos últimos 30 dias: não há o que barrar.",
  ja_tem_admin: "A Alumia já tem admin. Destitua antes de nomear outra pessoa.",
  conta_nao_aprovada: "A conta precisa estar aprovada na Alumia e sem suspensão.",
  ja_na_fila: "Este pedido já está na fila.",
  ja_decidida: "Esta denúncia já foi decidida.",
  abra_primeiro: "Abra a denúncia antes de decidir: o acesso ao post de núcleo precisa ficar registrado.",
  so_pela_denuncia: "Post de núcleo ou de espaço fechado só se modera a partir de uma denúncia.",
  na_lixeira: "Este post está na lixeira. Restaure antes.",
  avisos_demais: "Já há 3 avisos fixados. Tire um antes.",
  slug_em_uso: "Já existe uma comunidade com esse endereço.",
  ja_encerrada: "Esta comunidade já está encerrada.",
  nada_a_fazer: "Já está assim: nada mudou.",
  use_a_trava: "O recurso da entrada anda junto com a trava: use o quadro da trava.",
  conferencia_incompleta: "Marque todos os itens da lista de conferência.",
  confirme_segundo_fator: "Para ligar a trava, esta sessão precisa estar com o código do aplicativo autenticador e a sua conta aprovada na Alumia. Sem isso você ficaria do lado de fora.",
  muitos_pedidos: "Muitas ações em pouco tempo. Espere um minuto.",
  limite: "Muitas ações em pouco tempo. Espere um minuto.",
  ja_pedido: "Já há um pedido igual esperando a segunda pessoa (Segurança › Confirmações).",
  "invalido:finalidade": "Diga a finalidade: ordem judicial ou banimento.",
  "invalido:endereco": "Endereço de rede inválido. Use um endereço (203.0.113.7) ou uma faixa (203.0.113.0/24).",
  "invalido:faixa": "Faixa grande demais: no máximo /16 no IPv4 e /32 no IPv6.",
  "invalido:busca": "Busque por uma conta ou por um endereço.",
  "invalido:conta": "Conta inválida.",
  banco_desatualizado: "O banco ainda não tem as funções do painel: falta rodar o SQL 20261113-alumia-o7-painel.sql.",
};

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que o painel único de admin da Alumia recebe do banco (supabase/migracoes/20261122-alumia-admin.sql), os nomes das ações
// novas no registro e os erros novos em português de tela. Só tipos e textos: quem pode o quê é decidido no banco.
import { nomeDaAcao } from "../painel/tipos";

export interface RecursoNoAdmin {
  nome: string;
  so_pelo_nome: boolean;
  /** Liga direto com o segundo fator (os do lançamento e os que não pedem a segunda pessoa). */
  direto: boolean;
  decisao: boolean | null;
  em: string | null;
  por: string | null;
  aguardando: boolean;
}

export interface EstadoDoAdmin {
  trava: { ligada: boolean; desde: string | null; eu_passo: boolean };
  porta: { fechada: boolean; passe: boolean };
  fila: ContaDePessoas;
  aprovadas: ContaDePessoas;
  borda_ativos: number;
  fed_bloqueados: number;
  versao: number;
  recursos: RecursoNoAdmin[];
}

/** Número de pessoas: só a partir de 3 (abaixo disso, "n" vem nulo e "algum" diz se houve). */
export interface ContaDePessoas {
  n: number | null;
  algum: boolean;
}

export interface ResultadoDoBanimento {
  ok: true;
  email: boolean;
  email_sem_segredo: boolean;
  convites: ContaDePessoas;
  convidados: ContaDePessoas;
  rede_dias: number;
  sessoes: boolean;
}

export interface BloqueioNaBorda {
  id: string;
  criado_em: string;
  vence_em: string;
  removida_em?: string;
  quem: string;
  motivo: string;
}

export interface EstadoDaBorda {
  configurada: boolean;
  lista: { ativos: BloqueioNaBorda[]; recentes: BloqueioNaBorda[] } | null;
}

export interface ServidorBloqueado {
  dominio: string;
  motivo: string;
  desde: string;
  fixo: boolean;
}

const ACOES_DO_ADMIN: Record<string, string> = {
  conta_banida_tudo: "Conta banida com tudo (e-mail, aparelho, convites)",
  porta_fechada: "Porta de entrada fechada",
  porta_reaberta: "Porta de entrada reaberta",
  recurso_padrao: "Função voltou ao padrão",
  recurso_desligado: "Função desligada",
  recurso_pedido: "Pedido para ligar (segunda pessoa)",
  fed_servidor_bloqueado: "Servidor do Fediverso bloqueado",
  fed_servidor_desbloqueado: "Servidor do Fediverso desbloqueado",
  borda_bloqueio: "Bloqueio na borda (Cloudflare)",
  borda_desbloqueio: "Bloqueio na borda tirado antes da hora",
  borda_venceu: "Bloqueio na borda venceu e saiu",
};

/** O nome da ação no registro: as do painel único primeiro, depois as do painel de controle. */
export const nomeDaAcaoNoRegistro = (acao: string) => ACOES_DO_ADMIN[acao] ?? nomeDaAcao(acao);

/** Os erros que só o painel único devolve. */
export const ERROS_DO_ADMIN: Record<string, string> = {
  "invalido:motivo_com_endereco": "Não escreva endereço de rede (IP) nem o @ de uma conta no motivo: o motivo fica guardado.",
  confirme_segundo_fator: "Esta ação pede o código do aplicativo autenticador confirmado nesta sessão (e, para a trava, a sua conta aprovada na Alumia). Saia e entre de novo com o código.",
  perigo_sem_trava: "A trava da entrada está desligada: abrir a Alumia agora deixaria qualquer pessoa criar conta e entrar. Ligue a trava antes, ou escreva a frase para abrir assim mesmo.",
  use_ligar: "Este recurso só liga pelo nome e está desligado: use “Ligar” (ou “Pedir para ligar”), não “Voltar ao padrão”.",
  porta_fechada: "A porta de entrada está fechada.",
  sem_configuracao: "Falta configurar a Cloudflare no servidor (ALUMIA_CF_TOKEN e ALUMIA_CF_ZONA). O painel não muda variável do servidor.",
  ip_invalido: "Isso não é um endereço. Use um IPv4 (203.0.113.7), um IPv6, ou uma faixa (/24 ou /16 no IPv4; /64, /48 ou /32 no IPv6).",
  ip_reservado: "Esse endereço é interno ou reservado: bloqueá-lo na borda não adianta nada.",
  faixa_larga: "Faixa grande demais. No IPv4, /24 ou /16; no IPv6, /64, /48 ou /32.",
  "invalido:horas": "O prazo vai de 24 horas a 7 dias.",
  "invalido:regra": "A Cloudflare não devolveu o número da regra. Nada foi gravado.",
  "invalido:dominio": "Domínio inválido. Escreva só o endereço do servidor, como exemplo.social.",
  "invalido:selo": "O servidor mandou um resumo de e-mail inválido. Nada foi feito.",
  bloqueio_fixo: "Este servidor está bloqueado de forma fixa (lista da casa) e não sai por aqui.",
  cloudflare_sem_permissao: "A Cloudflare recusou o token: confira se ele tem a permissão de editar as regras de acesso desta zona.",
  cloudflare_recusou: "A Cloudflare recusou a regra. Confira o endereço e tente de novo.",
  cloudflare_fora_do_ar: "A Cloudflare não respondeu agora. Nada foi gravado; tente de novo em um minuto.",
  sem_conexao: "O servidor não respondeu agora.",
  sem_servico: "Sem banco nesta montagem.",
  alumia_so_leitura: "A Alumia está em modo só leitura: ninguém publica nem muda nada até a coordenação desligar o modo.",
};

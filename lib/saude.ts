// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A vitrine Saúde Solidária: um mural de contatos de profissionais de saúde voluntários. O instituto só mostra o contato
// que o profissional autorizou; não presta, agenda, intermedeia, acompanha nem garante atendimento, e não recebe dado
// de saúde de ninguém. Os avisos abaixo são RASCUNHO PARA REVISÃO JURÍDICA (texto-base da coordenação).

import { site } from "./site";

export interface Profissional {
  id: string;
  nome: string;
  profissao: string;
  conselho: string;
  uf: string;
  registro: string;
  abordagem: string;
  areas: string[];
  modalidade: "online" | "presencial" | "ambas" | null;
  cidade?: string;
  valor: "gratuito" | "social" | "ambos" | null;
  bio: string;
  contatos: { whatsapp?: string; instagram?: string; email?: string; site?: string };
  foto: string;
  /** Data em que a coordenação conferiu o registro no conselho (perfis do painel). */
  verificado_em?: string | null;
  /** Data da autorização da própria pessoa (perfis publicados pelo arquivo). */
  autorizado_em?: string | null;
}

/** Quantos dias um profissional novo fica no cartão da página inicial. Depois disso continua só na vitrine. */
export const DIAS_NA_INICIAL = 30;

/** O profissional entrou na vitrine há menos de DIAS_NA_INICIAL dias? Sem data, não vai para a inicial. */
export function novoNaVitrine(p: Pick<Profissional, "verificado_em" | "autorizado_em">, agora = Date.now()): boolean {
  const desde = Date.parse(p.autorizado_em ?? p.verificado_em ?? "");
  return Number.isFinite(desde) && agora - desde < DIAS_NA_INICIAL * 86_400_000 && agora >= desde;
}

/** O e-mail de contato do instituto (dúvida, denúncia, pedido de remoção). */
export const EMAIL_DE_CONTATO = site.newsletter;

export const AVISO_CURTO =
  "Profissionais de saúde voluntários. O Instituto Lúcia só divulga os contatos e não presta nem garante atendimentos. Não é serviço de emergência: SAMU 192, Bombeiros 193, CVV 188.";

export const AVISO_COMPLETO = [
  "Leia antes de entrar em contato. Esta seção funciona como um mural de contatos e só lista profissionais que aceitaram divulgar o próprio contato.",
  "O Instituto Lúcia não presta, organiza, agenda, acompanha nem garante atendimentos, e não participa de nenhuma conversa entre você e o profissional. Qualquer combinação, inclusive de valor, é feita diretamente com ele.",
  "Os textos de cada perfil são de autoria e responsabilidade do profissional. O conteúdo desta seção tem caráter informativo e não substitui consulta.",
  "Isto não é serviço de emergência. Em urgência, ligue 192 (SAMU) ou 193 (Bombeiros). Em crise emocional, ligue 188 (CVV, 24 horas).",
  "Não envie dados de saúde, exames ou documentos por este site: o instituto não os recebe nem guarda. Os links de contato levam a ferramentas de terceiros, que têm as próprias regras de privacidade.",
  "Antes de iniciar o atendimento, confira o registro do profissional no site do conselho.",
  `Dúvida, denúncia ou pedido de remoção: ${EMAIL_DE_CONTATO}.`,
];

export const CIENCIA = "Entendi que o Instituto Lúcia apenas divulga este contato e não presta nem garante o atendimento.";

/** Onde conferir o registro de cada conselho (consulta pública oficial). */
export const CONSULTA_DO_CONSELHO: Record<string, string> = {
  CRP: "https://cadastro.cfp.org.br/",
  CRM: "https://portal.cfm.org.br/busca-medicos",
};

export const nomeDaModalidade = { online: "Atendimento on-line", presencial: "Atendimento presencial", ambas: "On-line e presencial" } as const;
export const nomeDoValor = { gratuito: "Gratuito", social: "Valor social", ambos: "Gratuito ou valor social" } as const;

/** O primeiro nome, para o cartão e a mensagem. */
export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? "";
/** As iniciais do profissional, para o código do cartão. */
export const iniciais = (nome: string) =>
  nome
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/\s+/)
    .filter((p) => p.length > 2 || /^[A-Z]/.test(p))
    .map((p) => p[0]!.toUpperCase())
    .join("")
    .slice(0, 3);

/**
 * O código do cartão de encaminhamento: IL-<iniciais>-<AAMMDD>-<4 letras e números sorteados>. É gerado no aparelho e
 * não vai para lugar nenhum: serve só para o profissional contar quantas pessoas chegaram pela vitrine.
 */
export function codigoDoCartao(nome: string, quando = new Date()): string {
  const data = `${String(quando.getFullYear()).slice(2)}${String(quando.getMonth() + 1).padStart(2, "0")}${String(quando.getDate()).padStart(2, "0")}`;
  const letras = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const sorteio = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => letras[b % letras.length]).join("");
  return `IL-${iniciais(nome) || "SS"}-${data}-${sorteio}`;
}

/** O endereço do WhatsApp com a mensagem pronta (o código vai junto para o profissional anotar). */
export const linkDoWhatsapp = (numero: string, texto: string) => `https://wa.me/${numero.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;
export const linkDoInstagram = (usuario: string) => `https://www.instagram.com/${encodeURIComponent(usuario.replace(/^@/, ""))}/`;
export const registroCompleto = (p: Pick<Profissional, "conselho" | "registro" | "uf">) => `${p.conselho} ${p.registro}${p.uf && !p.registro.includes("/") ? `/${p.uf}` : ""}`.trim();

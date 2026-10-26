// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O Mural de Saúde: um mural de contatos de profissionais de saúde com registro ativo no conselho. O instituto só mostra
// o contato que o profissional autorizou; não presta, agenda, intermedeia, acompanha nem garante atendimento, e não
// recebe dado de saúde de ninguém. Os textos e as regras ficam em content/saude/regras.json (via lib/mural-saude.ts).

import { categoria, categoriaLigada, conferirCampos, REGRAS, TEXTOS } from "./mural-saude";
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
  estado?: string;
  /** Público atendido (chaves de "publicos" em content/saude/regras.json). */
  publico?: string[];
  idiomas?: string[];
  bio: string;
  contatos: { whatsapp?: string; instagram?: string; email?: string; site?: string };
  foto: string;
  /** Data em que a coordenação conferiu o registro no conselho (perfis do painel). */
  verificado_em?: string | null;
  /** Data da autorização da própria pessoa (perfis publicados pelo arquivo). */
  autorizado_em?: string | null;
  /** Perfis do arquivo: a versão do termo aceita (combinada com a coordenação). Sem a versão vigente, não aparece. */
  termo_versao?: string | null;
}

/**
 * Um perfil publicado pelo arquivo (content/saude/profissionais.json) só aparece se seguir as mesmas regras do painel:
 * categoria aberta, termo vigente aceito e nenhum texto que o filtro barre. O banco confere os perfis do painel.
 */
export function perfilDoArquivoVisivel(p: Profissional): boolean {
  return categoriaLigada(p.conselho) && p.termo_versao === REGRAS.termoVersao && conferirCampos({ nome: p.nome, abordagem: p.abordagem, areas: p.areas, cidade: p.cidade, bio: p.bio }) === null;
}

/** "Psicóloga", "Psicólogo"…: a palavra da profissão vem da categoria; o que não está na lista não aparece. */
export function profissaoValida(p: Pick<Profissional, "conselho" | "profissao">): string {
  const lista = categoria(p.conselho)?.profissoes ?? [];
  return lista.includes(p.profissao) ? p.profissao : (lista[lista.length - 1] ?? "");
}

/** O e-mail de contato do instituto (dúvida, denúncia, pedido de remoção). */
export const EMAIL_DE_CONTATO = site.newsletter;

export const AVISO_CURTO = TEXTOS.avisoCurto;
export const AVISO_COMPLETO: string[] = [...TEXTOS.avisoCompleto, `Dúvida, denúncia ou pedido de remoção: ${EMAIL_DE_CONTATO}.`];
export const CIENCIA = TEXTOS.ciencia;

/** Onde conferir o registro de cada conselho (consulta pública oficial). */
export const CONSULTA_DO_CONSELHO: Record<string, string> = Object.fromEntries(
  Object.values(REGRAS.categorias as Record<string, { conselho: string; consulta?: string }>).filter((c) => c.consulta).map((c) => [c.conselho, c.consulta!]),
);

export const nomeDaModalidade = { online: "Atendimento on-line", presencial: "Atendimento presencial", ambas: "On-line e presencial" } as const;
export const nomeDoPublico = REGRAS.publicos as Record<string, string>;

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
  return `IL-${iniciais(nome) || "MS"}-${data}-${sorteio}`;
}

/** O endereço do WhatsApp com a mensagem pronta (o código vai junto para o profissional anotar). */
export const linkDoWhatsapp = (numero: string, texto: string) => `https://wa.me/${numero.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;
export const linkDoInstagram = (usuario: string) => `https://www.instagram.com/${encodeURIComponent(usuario.replace(/^@/, ""))}/`;
export const registroCompleto = (p: Pick<Profissional, "conselho" | "registro" | "uf">) => `${p.conselho} ${p.registro}${p.uf && !p.registro.includes("/") ? `/${p.uf}` : ""}`.trim();

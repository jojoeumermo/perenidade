// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import dynamic from "next/dynamic";
import { ligado } from "@/lib/recursos";
import { carregarTextosDaProtecao, encher } from "@/lib/rede/textos-protecao";
import type { ContextoDoEncaixe, Encaixe, PedidoDePublicacao, ResultadoAntesDePublicar } from "../encaixes";
import { JANELA_DO_SEGUNDO_TOQUE_MS } from "@/lib/rede/modoato/antes-de-publicar";
import { analisarLink, linksDoTexto } from "./link-suspeito";

// O aviso fixado pela coordenação (painel de controle da Alumia): só chega ao navegador quando a linha de Início o desenha.
const AvisosFixados = dynamic(() => import("./AvisosFixados"), { ssr: false });
// Proteção contra ataque (onda 9, frente 9A).
const NoTopoDaProtecao = dynamic(() => import("./NoTopoDaProtecao"), { ssr: false });
const ProtegidoNoTopo = (ctx: ContextoDoEncaixe) => <NoTopoDaProtecao {...ctx} parte="protegido" />;
const MarcacoesNoTopo = (ctx: ContextoDoEncaixe) => <NoTopoDaProtecao {...ctx} parte="marcacoes" />;
const AnexoDeProtecao = dynamic(() => import("./AnexoDeProtecao"), { ssr: false });
const AcoesDeProtecaoNoCartao = dynamic(() => import("./AcoesDeProtecaoNoCartao"), { ssr: false });
const GuardaDeLinks = dynamic(() => import("./GuardaDeLinks"), { ssr: false });
const SecaoDaProtecao = dynamic(() => import("./SecaoDaProtecao"), { ssr: false });

const TITULO: Record<string, string> = {
  pt: "Proteção contra ataque", en: "Protection against attacks", es: "Protección contra ataques", fr: "Protection contre les attaques", ru: "Защита от атак", zh: "防攻击保护",
};

// Os textos já avisados, com a hora: o segundo toque em Publicar, com o mesmo texto e dentro da janela, envia (como o aviso de foto
// do modo ato, lib/rede/modoato/antes-de-publicar.ts).
const avisados = new Map<string, number>();

/**
 * Antes de publicar: um link do post que acende a lista aberta de link suspeito (./link-suspeito.ts) pede uma conferida. Para no
 * primeiro toque e mostra o aviso junto do Publicar; o segundo toque, com o mesmo texto, envia (a pessoa decide). Quem ler o post
 * vê o mesmo aviso antes de abrir.
 */
async function conferirLinks(pedido: PedidoDePublicacao, ctx: ContextoDoEncaixe): Promise<ResultadoAntesDePublicar> {
  const acesos = linksDoTexto(pedido.texto).map(analisarLink).filter((a) => a.suspeito);
  if (acesos.length === 0) return { ok: true };
  const agora = Date.now();
  for (const [k, quando] of avisados) if (agora - quando > JANELA_DO_SEGUNDO_TOQUE_MS) avisados.delete(k);
  const chave = `${pedido.texto.length}:${pedido.texto.slice(0, 200)}`;
  if (avisados.has(chave)) return { ok: true };
  avisados.set(chave, agora);
  const t = await carregarTextosDaProtecao(ctx.lang);
  // Cada motivo até o primeiro ponto ou dois-pontos, com a inicial minúscula: entra depois dos dois-pontos da frase, sem parênteses
  // em volta (o motivo do cadeado já tem os dele).
  const motivos = [...new Set(acesos.flatMap((a) => a.motivos))]
    .map((m) => t.link.motivos[m].replace(/(?:[.:](?:\s|$)|[：。]).*$/, ""))
    .map((m) => m.charAt(0).toLocaleLowerCase(ctx.lang) + m.slice(1))
    .join("; ");
  return { ok: false, bloqueia: true, aviso: encher(t.link.antesDePublicar, { motivos }) };
}

/**
 * Antes de publicar (onda 11, 11F): os links do post vão ao servidor do site, que os confere no Google Safe Browsing (só o link,
 * nunca o texto; ao Google, só prefixos de resumo: lib/rede/links-conferidos/safe-browsing.ts). Link marcado como perigoso
 * BLOQUEIA, toda vez, com a explicação: a pessoa tira o link e publica. Sem a chave no servidor, sem sessão ou sem rede, não para
 * nada (vale a lista aberta acima).
 */
async function conferirNoGoogle(pedido: PedidoDePublicacao, ctx: ContextoDoEncaixe): Promise<ResultadoAntesDePublicar> {
  const links = linksDoTexto(pedido.texto);
  if (links.length === 0) return { ok: true };
  const [{ conferirNoServidor }, { carregarTextosDosLinks, fraseDoBloqueio }] = await Promise.all([
    import("@/lib/rede/links-conferidos/cliente"),
    import("@/lib/rede/links-conferidos/textos"),
  ]);
  const r = await conferirNoServidor(links);
  if (!r?.conferido || r.perigosos.length === 0) return { ok: true };
  return { ok: false, bloqueia: true, aviso: fraseDoBloqueio(await carregarTextosDosLinks(ctx.lang), r.perigosos) };
}

/**
 * Encaixe da F8 (proteção contra ataque, moderação e transparência): o que esta frente pendura nas telas comuns. Daqui em diante o
 * arquivo é da F8 (PLANO-ALUMIA §9). A proteção contra ataque (onda 9, 9A) fica atrás da flag "alumia-2" (lib/recursos.ts), como
 * o resto da Alumia nova, e precisa do SQL 20261115-alumia-o9-protecao.sql: sem ele, as peças não acham as funções e não
 * desenham nada (o aviso de link suspeito não usa o banco e vale assim mesmo).
 */
const PROTECAO = ligado("alumia-2");

/**
 * As duas faixas da proteção no alto do Início ficam fora de topoDaLinha: components/rede/encaixes.tsx as põe no lugar certo da
 * ordem única (o modo protegido logo depois da barra do modo ato; as marcações esperando por último).
 */
export const topoDaProtecao = PROTECAO ? { protegido: ProtegidoNoTopo, marcacoes: MarcacoesNoTopo } : null;

export const encaixe: Encaixe = {
  topoDaLinha: [AvisosFixados],
  ...(PROTECAO
    ? {
        anexosDoCartao: [AnexoDeProtecao],
        acoesDoCartao: [AcoesDeProtecaoNoCartao],
        colunaDireita: [GuardaDeLinks],
        antesDePublicar: [conferirNoGoogle, conferirLinks],
        secoesDeAjustes: [{ chave: "protecao", titulo: ({ lang }: ContextoDoEncaixe) => TITULO[lang] ?? TITULO.pt, Componente: SecaoDaProtecao }],
      }
    : {}),
};

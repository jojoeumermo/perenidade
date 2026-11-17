// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que as rotas do RSS e do cartão (app/api/rede/{rss,embed}) dividem, só no servidor: ler o banco COMO VISITANTE (a chave pública
// no lugar do token de uma pessoa: a porta da entrada vale, e com a trava ligada a função recusa), os textos dos seis idiomas, os
// endereços de base e um guarda-volumes curto na memória (o mesmo pedido em menos de um minuto não volta ao banco). Nenhum endereço
// de quem pede é lido nem guardado. Sem "@/" de propósito (roda nos testes).
import en from "../../../i18n/rede/alcance/en.json";
import es from "../../../i18n/rede/alcance/es.json";
import fr from "../../../i18n/rede/alcance/fr.json";
import pt from "../../../i18n/rede/alcance/pt.json";
import ru from "../../../i18n/rede/alcance/ru.json";
import zh from "../../../i18n/rede/alcance/zh.json";
import { lerEstado } from "../../interdicao";
import { ALUMIA_URL } from "../alumia";
import { site } from "../../site";
import type { TextosDoAlcance } from "./textos";
import { idiomaOk, type CanalQueSai, type ItemQueSai } from "./regras";
import { exemploDeCanal, exemploDeItem } from "./exemplos";

const TEXTOS: Record<string, TextosDoAlcance> = { pt, en: en as TextosDoAlcance, es: es as TextosDoAlcance, fr: fr as TextosDoAlcance, ru: ru as TextosDoAlcance, zh: zh as TextosDoAlcance };

/** Os textos do idioma pedido (português quando não conhece). */
export const textosDoServidor = (lang: string | null): TextosDoAlcance => TEXTOS[idiomaOk(lang)] ?? pt;

/** As bases dos endereços absolutos: a da Alumia (se ligada) e a do site. */
export const basesDoServidor = () => ({ alumia: ALUMIA_URL, site: site.url });

const SUPA = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const CHAVE = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const PREVIA = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

/** Chama uma função do banco como visitante. Nulo quando ela recusa (trava, porta), não existe ou o banco não responde. */
async function comoVisitante<T>(funcao: string, argumentos: Record<string, unknown>): Promise<T | null> {
  if (!SUPA || !CHAVE) return null;
  try {
    const r = await fetch(`${SUPA}/rest/v1/rpc/${funcao}`, {
      method: "POST",
      headers: { apikey: CHAVE, Authorization: `Bearer ${CHAVE}`, "Content-Type": "application/json" },
      body: JSON.stringify(argumentos),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    return ((await r.json().catch(() => null)) as T | null) ?? null;
  } catch {
    return null;
  }
}

const guardados = new Map<string, { quando: number; valor: unknown }>();
const UM_MINUTO = 60_000;
async function guardado<T>(chave: string, buscar: () => Promise<T | null>): Promise<T | null> {
  const agora = Date.now();
  const g = guardados.get(chave);
  if (g && agora - g.quando < UM_MINUTO) return g.valor as T | null;
  const valor = await buscar();
  if (guardados.size > 2000) guardados.clear();
  guardados.set(chave, { quando: agora, valor });
  return valor;
}

/** O canal RSS (nulo = não existe, não sai ou a trava está ligada). Na prévia sem banco, o exemplo. */
export async function lerCanal(tipo: "perfil" | "comunidade", nome: string): Promise<CanalQueSai | null> {
  if (PREVIA && (!SUPA || !CHAVE)) return exemploDeCanal(tipo, nome);
  return guardado(`rss:${tipo}:${nome}`, () => comoVisitante<CanalQueSai>("rede_alc_rss", { p_tipo: tipo, p_nome: nome }));
}

/** O post do cartão (nulo = não existe, não sai ou a trava está ligada). Na prévia sem banco, o exemplo. */
export async function lerItem(id: string): Promise<ItemQueSai | null> {
  if (PREVIA && (!SUPA || !CHAVE)) return exemploDeItem(id);
  return guardado(`post:${id}`, () => comoVisitante<ItemQueSai>("rede_alc_post", { p_post: id }));
}

/**
 * A Alumia está interditada pela coordenação (a área "comunidade" do painel, ou o site inteiro)? O proxy só fecha os serviços do
 * /api com o site inteiro fora; o RSS e o cartão fecham também com a área da Alumia. Se o banco não responder, vale aberto, como no
 * proxy (o próprio RSS e o cartão dependem do banco: sem ele, já respondem 404).
 */
export async function alumiaInterditada(): Promise<boolean> {
  if (!SUPA || !CHAVE) return false;
  const estado = await guardado("interdicao", async () => lerEstado(await comoVisitante<unknown>("site", {})));
  return Boolean(estado && (estado.geral || estado.areas.includes("comunidade")));
}

/** Esquece o que estava guardado (os testes trocam a trava e o post no meio). */
export function esquecerGuardados(): void {
  guardados.clear();
}

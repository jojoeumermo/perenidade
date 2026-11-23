// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Item 103 (Prompt 4): o glossário ao toque, reaproveitando o glossário do site (content/glossario, servido estático por
// /api/rede/glossario/[lang]). As regras puras: achar a primeira aparição de cada termo num texto (palavra inteira, sem ligar para
// maiúscula nem acento; o termo mais comprido primeiro, como faz o site em components/Markdown.tsx) e buscar um termo. Nada vai a
// serviço de fora. Sem "@/" de propósito (roda nos testes).

export interface Termo {
  slug: string;
  termo: string;
  resumo: string;
}

export type Pedaco = { texto: string; termo?: Termo };

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const escapar = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Corta o texto em pedaços, marcando a PRIMEIRA aparição de cada termo (no máximo `maximo` termos por texto, para não virar um texto
 * só de links). A comparação ignora maiúsculas e acentos; o pedaço guarda o texto como estava.
 */
export function marcarTermos(texto: string, termos: readonly Termo[], maximo = 12): Pedaco[] {
  if (!texto || !termos.length) return [{ texto }];
  const porChave = new Map<string, Termo>();
  for (const t of termos) {
    const k = semAcento(t.termo.trim());
    if (k.length >= 3 && !porChave.has(k)) porChave.set(k, t);
  }
  const chaves = [...porChave.keys()].sort((a, b) => b.length - a.length);
  if (!chaves.length) return [{ texto }];
  const base = semAcento(texto);
  // Mesmo comprimento: NFD + tirar os acentos combinantes devolve uma letra por letra para o latim comum; quando não devolve, desiste.
  if (base.length !== texto.length) return [{ texto }];
  const padrao = new RegExp(`(?<![\\p{L}\\p{N}-])(${chaves.map(escapar).join("|")})(?![\\p{L}\\p{N}-])`, "gu");
  const usados = new Set<string>();
  const saida: Pedaco[] = [];
  let ultimo = 0;
  for (const m of base.matchAll(padrao)) {
    const k = m[1];
    if (usados.has(k) || usados.size >= maximo) continue;
    usados.add(k);
    const i = m.index ?? 0;
    if (i > ultimo) saida.push({ texto: texto.slice(ultimo, i) });
    saida.push({ texto: texto.slice(i, i + k.length), termo: porChave.get(k) });
    ultimo = i + k.length;
  }
  if (ultimo < texto.length) saida.push({ texto: texto.slice(ultimo) });
  return saida.length ? saida : [{ texto }];
}

/** Busca: o termo que começa com o que foi digitado vem antes do que só contém; até 30. */
export function buscarTermos(termos: readonly Termo[], q: string): Termo[] {
  const b = semAcento(q.trim());
  if (b.length < 2) return [];
  const comeca = termos.filter((t) => semAcento(t.termo).startsWith(b));
  const contem = termos.filter((t) => !semAcento(t.termo).startsWith(b) && (semAcento(t.termo).includes(b) || semAcento(t.resumo).includes(b)));
  return [...comeca, ...contem].slice(0, 30);
}

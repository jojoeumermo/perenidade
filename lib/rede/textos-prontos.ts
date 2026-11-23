// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A tradução em rascunho não vai para a tela (R1, A3.4). Cada pacote de textos da Alumia tem o português como texto final e os
// outros cinco idiomas com a marca "_rascunho" até a revisão de quem fala o idioma. Enquanto a marca estiver lá, quem escolheu
// outro idioma lê o português: uma frase meio traduzida numa rede de militantes pode dizer o contrário do que a regra diz (quem
// vê, o que sai da Alumia, o que o "Sair rápido" apaga). A marca nunca sai daqui: só sai do arquivo, depois da revisão.
// Sem "@/" de propósito: roda no Node nos testes (scripts/testar-r1-uso-telas.mjs).

/** O pacote ainda é rascunho? A marca é `"_rascunho": true` ou uma frase (qualquer valor que não seja falso ou vazio). */
export function eRascunho(pacote: unknown): boolean {
  if (!pacote || typeof pacote !== "object") return false;
  const marca = (pacote as { _rascunho?: unknown })._rascunho;
  return marca !== undefined && marca !== null && marca !== false && marca !== "";
}

/** O pacote do idioma, ou o português quando o do idioma é rascunho. */
export function prontoOuPortugues<T>(pacote: T, portugues: T): T {
  return eRascunho(pacote) ? portugues : pacote;
}

/** O pacote do idioma, ou o português (carregado só quando precisa) quando o do idioma é rascunho. */
export async function prontoOu<T>(pacote: T, portugues: () => Promise<T>): Promise<T> {
  return eRascunho(pacote) ? portugues() : pacote;
}

type Carregador = () => Promise<{ default: unknown }>;

/**
 * Carrega o pacote do idioma e, se ele for rascunho, carrega e devolve o português no lugar. O idioma desconhecido cai no
 * português direto. Quem chama converte o tipo (os pacotes de JSON não se tipam sozinhos).
 */
export async function carregarPronto(carregadores: Record<string, Carregador>, lang: string): Promise<unknown> {
  const pt = carregadores.pt;
  const carregar = carregadores[lang] ?? pt;
  const pacote = (await carregar()).default;
  if (carregar === pt || !eRascunho(pacote)) return pacote;
  return (await pt()).default;
}

/** O mesmo, para quem já tem o carregador do idioma na mão (o `CARREGAR[chave]` dos pacotes que guardam a promessa). */
export async function prontoDe(carregar: Carregador, pt: Carregador): Promise<unknown> {
  const pacote = (await carregar()).default;
  if (carregar === pt || !eRascunho(pacote)) return pacote;
  return (await pt()).default;
}

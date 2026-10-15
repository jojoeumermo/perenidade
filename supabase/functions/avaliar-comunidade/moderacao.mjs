// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A chamada ao serviço de moderação, separada da função para poder ser testada sem rede (scripts/testar-moderacao.mjs).
// Devolve o resultado cru ({ sinalizado, categorias, notas }) ou { erro }. Quem decide o que fazer com ele é o banco
// (interno.decidir_externa), e todo erro lá vira "leitura humana", nunca aprovação.
// A chave entra como argumento e só sai no cabeçalho do pedido: não vai para registro, erro nem resposta.

export const ENDERECO = "https://api.openai.com/v1/moderations";
export const MODELO = "omni-moderation-latest";
/** O banco aceita até 140 caracteres de título e 8000 de corpo; a folga cobre a quebra de linha entre os dois. */
const TAMANHO_MAXIMO = 8200;

/**
 * @param {string} texto
 * @param {string | undefined} chave
 * @param {{ buscar?: typeof fetch, prazo?: number }} [opcoes]
 * @returns {Promise<{ sinalizado: boolean, categorias: Record<string, boolean>, notas: Record<string, number> } | { erro: string }>}
 */
export async function moderar(texto, chave, { buscar = fetch, prazo = 8000 } = {}) {
  if (!chave) return { erro: "sem_chave" };
  if (typeof texto !== "string" || texto.trim() === "") return { erro: "sem_texto" };
  let resposta;
  try {
    resposta = await buscar(ENDERECO, {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODELO, input: texto.slice(0, TAMANHO_MAXIMO) }),
      signal: AbortSignal.timeout(prazo),
    });
  } catch (falha) {
    return { erro: falha?.name === "TimeoutError" || falha?.name === "AbortError" ? "tempo_esgotado" : "sem_conexao" };
  }
  if (resposta.status === 429) return { erro: "limite" };
  if (resposta.status === 401 || resposta.status === 403) return { erro: "chave_recusada" };
  if (!resposta.ok) return { erro: "indisponivel" };
  let corpo;
  try {
    corpo = await resposta.json();
  } catch {
    return { erro: "resposta_invalida" };
  }
  const resultado = corpo?.results?.[0];
  const objeto = (valor) => typeof valor === "object" && valor !== null && !Array.isArray(valor);
  if (!objeto(resultado) || typeof resultado.flagged !== "boolean" || !objeto(resultado.categories) || !objeto(resultado.category_scores)) return { erro: "resposta_invalida" };
  if (Object.keys(resultado.category_scores).length === 0 || Object.values(resultado.category_scores).some((nota) => typeof nota !== "number" || !Number.isFinite(nota))) return { erro: "resposta_invalida" };
  return { sinalizado: resultado.flagged, categorias: resultado.categories, notas: resultado.category_scores };
}

export const ENDERECO_LINKS = "https://safebrowsing.googleapis.com/v4/threatMatches:find";

/** Endereços de site num texto (com ou sem "http"), sem repetir, no máximo 20. */
export function enderecos(texto) {
  const achados = String(texto ?? "").match(/\b(?:https?:\/\/|www\.)[^\s<>"')\]]+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|br|info|io|xyz|top|site|online|ru|cn|me|tk|ml|ga|cf|gq|app|link|club|live|shop)(?:\/[^\s<>"')\]]*)?/gi) ?? [];
  return [...new Set(achados.map((item) => (/^https?:\/\//i.test(item) ? item : `http://${item}`).replace(/[.,;:!?]+$/, "")))].slice(0, 20);
}

/**
 * Links perigosos (Google Safe Browsing, uso não comercial): golpe, programa malicioso, página enganosa.
 * Devolve true se algum endereço do texto está na lista, false se nenhum está, e null se não deu para conferir.
 * Só os endereços saem daqui, nunca o texto da mensagem.
 * @param {string} texto
 * @param {string | undefined} chave
 * @param {{ buscar?: typeof fetch, prazo?: number }} [opcoes]
 * @returns {Promise<boolean | null>}
 */
export async function linksPerigosos(texto, chave, { buscar = fetch, prazo = 6000 } = {}) {
  const lista = enderecos(texto);
  if (lista.length === 0) return false;
  if (!chave) return null;
  try {
    const resposta = await buscar(`${ENDERECO_LINKS}?key=${encodeURIComponent(chave)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client: { clientId: "instituto-lucia", clientVersion: "1.0" },
        threatInfo: {
          threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
          platformTypes: ["ANY_PLATFORM"],
          threatEntryTypes: ["URL"],
          threatEntries: lista.map((url) => ({ url })),
        },
      }),
      signal: AbortSignal.timeout(prazo),
    });
    if (!resposta.ok) return null;
    const corpo = await resposta.json();
    return Array.isArray(corpo?.matches) && corpo.matches.length > 0;
  } catch {
    return null;
  }
}

/**
 * Junta ao resultado da moderação o que se sabe dos links. Link perigoso, ou link que não deu para conferir,
 * vira sinalização: a mensagem vai para a fila de revisão (o banco nunca publica nem barra só por isso).
 */
export function comLinks(resultado, perigoso) {
  if ("erro" in resultado || perigoso === false) return resultado;
  const nome = perigoso === true ? "link/perigoso" : "link/nao_conferido";
  return { sinalizado: true, categorias: { ...resultado.categorias, [nome]: true }, notas: { ...resultado.notas, [nome]: perigoso === true ? 1 : 0.6 } };
}

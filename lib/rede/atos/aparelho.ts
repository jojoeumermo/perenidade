// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O que os atos guardam NESTE aparelho (e só nele): a semente do cartão dourado e a cidade de "Perto". As chaves começam com
// "lucia:rede" e por isso o "Sair rápido" apaga as duas (lib/rede/saida.ts). Nada disso vai ao servidor guardado: a cidade só
// vai como filtro na hora de pedir os atos (LGPD art. 6º, III, necessidade: o servidor não precisa saber onde a pessoa mora).
// Todo acesso ao armazenamento está em try/catch (aba anônima ou bloqueada: funciona sem guardar).

export const CHAVE_DA_SEMENTE = "lucia:rede:atos:semente";
export const CHAVE_DA_CIDADE = "lucia:rede:atos:cidade";

function ler(chave: string): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravar(chave: string, valor: string | null): void {
  try {
    if (typeof localStorage === "undefined") return;
    if (valor === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, valor);
  } catch {
    // sem armazenamento: segue sem guardar
  }
}

let sementeDaAba: string | null = null;

/**
 * A semente que escolhe o cartão dourado: aleatória, nasce no aparelho e não sai dele. Assim a posição do "seu" cartão não diz
 * nada a quem olha a tela de outra pessoa (PLANO-ALUMIA §6.2).
 */
export function sementeDoAparelho(): string {
  const guardada = ler(CHAVE_DA_SEMENTE);
  if (guardada) return guardada;
  if (!sementeDaAba) {
    const bytes = new Uint8Array(12);
    globalThis.crypto?.getRandomValues?.(bytes);
    sementeDaAba = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("") || String(Math.random());
    gravar(CHAVE_DA_SEMENTE, sementeDaAba);
  }
  return sementeDaAba;
}

/** A cidade que a pessoa escreveu para "Perto" (até 80 caracteres), ou nula. */
export function cidadeGuardada(): string | null {
  const c = ler(CHAVE_DA_CIDADE)?.trim();
  return c ? c.slice(0, 80) : null;
}

export function guardarCidade(cidade: string | null): void {
  const c = cidade?.replace(/\s+/g, " ").trim().slice(0, 80) || null;
  gravar(CHAVE_DA_CIDADE, c);
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") window.dispatchEvent(new Event(EVENTO_DA_CIDADE));
}

/** O aviso, nesta aba, de que a cidade mudou (a coluna "Atos perto de você" escuta; outras abas ouvem o evento "storage"). */
export const EVENTO_DA_CIDADE = "lucia:rede:atos:cidade";

/** Chama `aoMudar` quando a cidade muda nesta aba ou em outra. Devolve o desligar. */
export function ouvirCidade(aoMudar: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const naOutraAba = (e: StorageEvent) => {
    if (e.key === null || e.key === CHAVE_DA_CIDADE) aoMudar();
  };
  window.addEventListener(EVENTO_DA_CIDADE, aoMudar);
  window.addEventListener("storage", naOutraAba);
  return () => {
    window.removeEventListener(EVENTO_DA_CIDADE, aoMudar);
    window.removeEventListener("storage", naOutraAba);
  };
}

// Palavras que ficam minúsculas no meio do nome de uma cidade ("Rio de Janeiro", "São João del-Rei", "Vila do Conde").
const MIUDAS = new Set(["de", "da", "do", "das", "dos", "e", "del", "la", "le", "les", "el", "y", "di", "du", "des"]);

/**
 * O nome da cidade como se escreve ("  são   paulo " → "São Paulo"; "RIO DE JANEIRO" → "Rio de Janeiro"). Só para mostrar e
 * guardar: o servidor compara sem caixa e sem acento de qualquer jeito. Escritas sem maiúsculas (chinês, japonês…) passam iguais.
 */
export function nomeDaCidade(cidade: string): string {
  const limpa = cidade.replace(/\s+/g, " ").trim().slice(0, 80);
  return limpa
    .split(" ")
    .map((palavra, i) => {
      const baixa = palavra.toLocaleLowerCase();
      if (i > 0 && MIUDAS.has(baixa)) return baixa;
      // cada parte de um nome com hífen também começa maiúscula ("Sant'ana", "Embu-Guaçu")
      return baixa.replace(/(^|[-'’])(\p{L})/gu, (_, sep: string, l: string) => sep + l.toLocaleUpperCase());
    })
    .join(" ");
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O lado do navegador dos posts restritos (P21): um chaveiro de grupo por aba, com a guarda no IndexedDB próprio
// ("lucia-alumia-grupos", que o "Sair rápido" e os três Esc apagam), e quem é a pessoa (o id da sessão, só para a cifra: nunca vai
// a lugar nenhum além das funções do banco que já a conhecem). Este arquivo é baixado só quando um post cifrado aparece ou quando
// alguém escreve num grupo cifrado (import dinâmico): o motor do MLS (OpenMLS em WebAssembly) não pesa na casca.
import { getClient } from "@/lib/backend";
import { chaveiroDosGrupos, esquecerChaveiroDosGrupos } from "@/lib/rede/grupos/navegador";
import { aoApagarTudoDoChat } from "@/lib/rede/chat/gaveta";
import { abrirDoGrupo, cifrarParaOGrupo, type ResultadoDaCifra } from "./grupo";

let ouvindo = false;
function chaveiroDaAba() {
  if (!ouvindo) {
    ouvindo = true;
    // No "Sair rápido" (e quando outra aba apaga o chat), as chaves abertas nesta aba somem da memória junto com o banco.
    aoApagarTudoDoChat(() => esquecerChaveiroDosGrupos());
  }
  return chaveiroDosGrupos();
}

/** O id da conta desta sessão, ou nulo (sem sessão). */
export async function quemSouEu(): Promise<string | null> {
  try {
    const { data } = await (await getClient()).auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

/** Cifra o texto para o grupo neste aparelho (P21). */
export async function cifrarNoAparelho(grupo: string, texto: string): Promise<ResultadoDaCifra> {
  const eu = await quemSouEu();
  if (!eu) return { ok: false, codigo: "falha" };
  return cifrarParaOGrupo(chaveiroDaAba(), grupo, eu, texto);
}

/** Abre um post cifrado neste aparelho (nulo: não dá). */
export async function abrirNoAparelho(post: { grupo?: string | null; corpo_grupo?: string | null; autor: { id: string | null } }): Promise<string | null> {
  return abrirDoGrupo(chaveiroDaAba(), post, await quemSouEu());
}

/**
 * Os avisos fortes ainda não vistos (onda R3): conta já conhecida que entrou no grupo com aparelho novo, certificado pela identidade
 * dela. A tela do compositor mostra até a pessoa marcar que viu. Nunca lança.
 */
export async function avisosNoAparelho(): Promise<{ trocada: boolean }[]> {
  try {
    const eu = await quemSouEu();
    if (!eu) return [];
    return (await chaveiroDaAba().avisos(eu)).filter((a) => a.forte && !a.visto).map((a) => ({ trocada: a.trocada }));
  } catch {
    return [];
  }
}

/** Marca os avisos como vistos. Nunca lança. */
export async function marcarAvisosVistos(): Promise<void> {
  try {
    const eu = await quemSouEu();
    if (eu) await chaveiroDaAba().avisosVistos(eu);
  } catch {
    // sem a guarda: o aviso volta na próxima vez, nada além disso
  }
}

/**
 * Deixa o aparelho pronto para receber os posts do grupo: publica os pacotes de chave desta pessoa (se faltarem), para quem
 * escrever já pôr este aparelho no grupo. A página do núcleo e a da comunidade fechada chamam ao abrir. Nunca lança.
 */
export async function prepararOAparelho(): Promise<void> {
  try {
    const eu = await quemSouEu();
    if (eu) await chaveiroDaAba().preparar(eu);
  } catch {
    // sem rede ou sem a função no banco: o compositor tenta de novo ao escrever
  }
}

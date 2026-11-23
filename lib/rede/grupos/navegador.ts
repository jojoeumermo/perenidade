// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lado do NAVEGADOR dos grupos cifrados da rede: o chaveiro desta aba, com a loja do motor de cada conta no OPFS
// ("core-crypto/grupos-<conta>") e os segredos de época cifrados no IndexedDB "lucia-alumia-grupos" (lib/rede/grupos/loja-do-navegador.ts),
// e o "Sair rápido" (lib/rede/grupos/apagar.ts).
import { chamar } from "../cliente";
import { apagarLojasDosGrupos, PREFIXO_DA_LOJA } from "./apagar";
import { type AbrirMotor, type ChaveiroDeGrupo, criarChaveiroDeGrupo } from "./chaveiro";
import { abrirLojaDoMotor, guardaNoNavegador } from "./loja-do-navegador";
import { fonteDaIdentidadeDoVoto } from "../voto/identidade";

/**
 * A identidade da conta para os grupos (onda R3: o certificado de cada folha): a do chat deste aparelho, pela mesma fonte do voto. Se
 * o chat existe aqui mas ainda não abriu nesta aba, abre (como a urna faz); se nunca foi ligado aqui, null ("sem_identidade").
 */
async function identidadeDaConta() {
  if (!fonteDaIdentidadeDoVoto()) await import("../chat/r2/navegador").then((n) => n.abrirIdentidadeDoVoto()).catch(() => undefined);
  return fonteDaIdentidadeDoVoto();
}

/** Abre a loja do motor desta conta no OPFS. */
export const abrirMotorNoNavegador: AbrirMotor = (usuario) => abrirLojaDoMotor(`${PREFIXO_DA_LOJA}${usuario}`);

let daAba: ChaveiroDeGrupo | null = null;

/**
 * O chaveiro dos grupos desta aba: um só, para os posts restritos e a voz (a loja do motor não abre duas vezes). Baixado só quando
 * um post cifrado aparece, alguém escreve num grupo cifrado ou entra numa sala de voz (import dinâmico de quem chama).
 */
export function chaveiroDosGrupos(): ChaveiroDeGrupo {
  daAba ??= criarChaveiroDeGrupo({ chamar: (f, a) => chamar(f, a), guarda: guardaNoNavegador("rede:"), abrirMotor: abrirMotorNoNavegador, identidade: identidadeDaConta });
  return daAba;
}

/** Esquece o chaveiro desta aba (as chaves abertas na memória). */
export function esquecerChaveiroDosGrupos(): void {
  daAba?.esquecer();
  daAba = null;
}

/** O "Sair rápido": apaga do aparelho tudo dos grupos e esquece o chaveiro desta aba (nunca lança). */
export async function apagarParesDeGrupo(limiteMs = 300): Promise<void> {
  esquecerChaveiroDosGrupos();
  await apagarLojasDosGrupos(limiteMs);
}

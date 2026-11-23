// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Quem pode assinar um binário dos apps da Alumia (onda R3, item 2.4): SÓ o fluxo de lançamento dos apps deste repositório
// público, rodando numa tag de versão, com a identidade OIDC do GitHub Actions (Sigstore "keyless": não há chave de assinatura
// para guardar nem para roubar). O certificado do Fulcio leva essa identidade; o registro no Rekor torna cada assinatura pública.
// O Rust do computador (nativo/nucleo/src/identidade.rs) e o verificador Java do Android usam exatamente estes valores.
// Sem "@/" de propósito: roda no Node (scripts/conferir-app.mjs e os testes).

export const REPOSITORIO = "jojoeumermo/perenidade";
export const FLUXO_DE_LANCAMENTO = ".github/workflows/apps-lancamento.yml";
export const EMISSOR_DO_GITHUB = "https://token.actions.githubusercontent.com";

export interface Identidade {
  /** O "subject alternative name" do certificado: o endereço do fluxo, com a tag. */
  uri: string;
  /** O emissor do token OIDC (a extensão 1.3.6.1.4.1.57264.1.8 do certificado). */
  emissor: string;
}

/** Versão no formato das tags de lançamento (v1.2.3, sem sufixo): o que vier fora disso não vira identidade. */
export function versaoValida(versao: string): boolean {
  return /^\d{1,4}\.\d{1,4}\.\d{1,6}$/.test(versao);
}

/** A identidade que assina a versão `versao` dos apps. */
export function identidadeDaVersao(versao: string): Identidade {
  if (!versaoValida(versao)) throw new Error("versao_invalida");
  return { uri: `https://github.com/${REPOSITORIO}/${FLUXO_DE_LANCAMENTO}@refs/tags/v${versao}`, emissor: EMISSOR_DO_GITHUB };
}

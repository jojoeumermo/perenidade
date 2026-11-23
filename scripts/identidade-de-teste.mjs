// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onda R3 (14): o chaveiro dos grupos da rede (lib/rede/grupos/chaveiro.ts) pede a identidade da conta (assina o certificado de cada
// folha e confere a de outra conta no registro público). Nos testes que não são do registro, um registro de mentira na memória: cada
// conta ganha uma identidade Ed25519 sorteada na primeira vez, e "conferir" diz se a identidade é a registrada. O registro de verdade
// (rede_kt) é provado em scripts/testar-r3-resto-folhas.mjs. A assinatura passa pelo caminho de verdade (assinarTextoDoVoto, que só
// assina o texto do voto e o da folha). Roda com ./scripts/carregar-ts.mjs.
import { assinarTextoDoVoto, novoParEd25519 } from "../lib/rede/chat/r2/certificados.ts";

export function registroDeTeste() {
  const registro = new Map();
  const par = (usuario) => {
    if (!registro.has(usuario)) registro.set(usuario, novoParEd25519());
    return registro.get(usuario);
  };
  return {
    /** A fonte da identidade de uma conta (o que lib/rede/chat/r2/navegador.ts entrega no navegador). */
    fonte(usuario) {
      const meu = par(usuario);
      return {
        minha: async () => ({ usuario, publica: meu.publica, assinar: async (t) => assinarTextoDoVoto(meu, t) }),
        conferir: async (outra, identidade) => {
          const p = registro.get(outra);
          return p && Buffer.from(p.publica).equals(Buffer.from(identidade)) ? "conferida" : "trocada";
        },
      };
    },
  };
}

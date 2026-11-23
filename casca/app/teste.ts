// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// SÓ NO PACOTE DE TESTE (montado com NEXT_PUBLIC_CASCA_TESTE=1): expõe à prova no emulador (scripts/testar-r3-android-aparelho.mjs,
// pelo protocolo de depuração do WebView) as mesmas funções que a casca usa, para provar no aparelho de verdade o cofre, a trava, o
// apagar tudo e o chat (o motor de cifra empacotado conversando com uma pessoa no Node). O pacote de lançamento não leva este
// arquivo: ele só é importado dentro de `if (process.env.NEXT_PUBLIC_CASCA_TESTE === "1")`, que a montagem resolve na hora, e o
// teste do manifesto confere que a casca de lançamento não tem o marcador "__alumiaTeste".
import type { CoreCrypto } from "@wireapp/core-crypto";
import { carregarMotor } from "@/lib/rede/cifra/motor";
import { cifrar, decifrar, ligarProteus, novasPreChaves } from "@/lib/rede/chat/r2/proteus";
import { novoParEd25519 } from "@/lib/rede/chat/r2/certificados";
import { gravarNaLoja, lerDaLoja } from "@/lib/rede/chat/r2/loja";
import { conferirSenha, definirSenhaDoApp, destravar, temSenhaDoApp } from "@/lib/rede/casca/trava";
import type { Casca } from "@/lib/rede/casca/plataforma";
import { appNativo, cofreNativo } from "./iniciar";

const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const deB64 = (t: string) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));

export function ligarTeste(casca: Casca): void {
  let cc: CoreCrypto | null = null;
  const aparelho = novoParEd25519();
  (window as unknown as Record<string, unknown>).__alumiaTeste = {
    casca,
    cofre: cofreNativo,
    app: appNativo,
    trava: { definirSenhaDoApp: (s: string) => definirSenhaDoApp(s, casca), conferirSenha: (s: string) => conferirSenha(s, casca), destravar: (s: string) => destravar(s, { casca, contador: cofreNativo }), temSenhaDoApp },
    // O chat no aparelho: o motor empacotado (/cifra/core-crypto-*.wasm, do próprio pacote), uma identidade Proteus e pré-chaves.
    async chatComecar() {
      const M = await carregarMotor();
      cc = await M.CoreCrypto.new(await M.Database.open("alumia-teste-aparelho", new M.DatabaseKey(crypto.getRandomValues(new Uint8Array(32)))));
      const impressao = await ligarProteus(cc);
      const [pre] = await novasPreChaves(cc, aparelho, 1);
      return { impressao, aparelho: b64(aparelho.publica), pre: { id: pre.id, pkb: b64(pre.pkb), assinatura: b64(pre.assinatura) }, versao: M.version() };
    },
    async chatAbrir(deAparelho: string, impressao: string, cifrado: string) {
      if (!cc) throw new Error("sem_motor");
      const aberto = await decifrar(cc, deB64(deAparelho), impressao, deB64(cifrado));
      return aberto ? new TextDecoder().decode(aberto) : null;
    },
    async chatCifrar(paraAparelho: string, texto: string) {
      if (!cc) throw new Error("sem_motor");
      return b64(await cifrar(cc, deB64(paraAparelho), new TextEncoder().encode(texto)));
    },
    // Uma "sincronia": grava o estado selado da conta muitas vezes seguidas (o que o chat faz a cada lote recebido).
    async sincronizar(conta: string, voltas: number) {
      for (let i = 0; i < voltas; i++) await gravarNaLoja(conta, { volta: i, enche: "x".repeat(4096) });
      return (await lerDaLoja<{ volta: number }>(conta))?.volta ?? -1;
    },
    lerDaLoja: (conta: string) => lerDaLoja(conta),
  };
}

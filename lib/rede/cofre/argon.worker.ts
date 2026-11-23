// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O Worker do Argon2id (lib/rede/cofre/argon.ts): a derivação de 64 MiB e 3 passadas roda aqui, fora da tela, para não travar um
// computador fraco. Recebe a senha (já em bytes; a cópia é zerada aqui), o sal e os valores; devolve só a chave.
import { derivarAqui } from "./argon-nucleo";

const escopo = self as unknown as {
  onmessage: ((e: MessageEvent<{ id: number; senha: Uint8Array; sal: Uint8Array; m: number; t: number }>) => void) | null;
  postMessage: (dado: unknown, transferir?: Transferable[]) => void;
};

escopo.onmessage = (e) => {
  const { id, senha, sal, m, t } = e.data ?? ({} as never);
  if (!(senha instanceof Uint8Array) || !(sal instanceof Uint8Array) || !Number.isInteger(m) || !Number.isInteger(t)) {
    escopo.postMessage({ id, erro: "invalido" });
    return;
  }
  derivarAqui(senha, sal, m, t).then(
    (chave) => escopo.postMessage({ id, chave }, [chave.buffer]),
    (erro: unknown) => escopo.postMessage({ id, erro: (erro as { code?: string })?.code === "sem_memoria" ? "sem_memoria" : "falha" }),
  );
};

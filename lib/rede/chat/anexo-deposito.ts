// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A ida e a volta do anexo cifrado do chat pelo depósito (app/api/alumia/anexo), do lado do aparelho. Prompt 4, itens 137 e 138.
// Como as caixas (lib/rede/caixas/transporte.ts): SEM a sessão da conta (`credentials: "omit"`, nenhum Authorization de conta,
// nenhuma referência de página), pela via atual (direta, Tor ou mixnet: lib/rede/caixas/vias.ts). Mandar gasta um passe anônimo
// (lib/rede/passes/cliente.ts); baixar e apagar só mostram o endereço, que só existe dentro da conversa cifrada.
// Sai daqui só o CIFRADO (com enchimento até o degrau de 64 KiB): o arquivo aberto e a chave nunca passam por este arquivo.
// Sem "@/" de propósito (os testes trocam as peças).
import { type CorpoDeAnexo, enderecoValido, MAIOR_CIFRADO, tamanhoDoDepositoOk, type DiasDoAnexo } from "./anexo-cifrado";

export interface PecasDoAparelho {
  fetch: typeof fetch;
  base: string;
  /** O cabeçalho do passe anônimo ("PrivateToken token=…"), gasto a cada envio. */
  passe(): Promise<string>;
}

const erro = (codigo: string) => Object.assign(new Error(codigo), { code: codigo });

async function pecasDeVerdade(): Promise<PecasDoAparelho> {
  const [{ viaAtual }, { transporte }, { gastarPasse }] = await Promise.all([import("../caixas/vias"), import("../caixas/transporte"), import("../passes/cliente")]);
  const via = viaAtual();
  return { fetch: via.fetch, base: via.base ?? transporte().base, passe: () => gastarPasse() };
}

const comum: RequestInit = { credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store" };

/** Manda o cifrado e devolve o endereço sorteado pelo depósito. Erros: "anexo_grande", "passe", "desligado", "rede". */
export async function depositarAnexo(cifrado: Uint8Array<ArrayBuffer>, dias: DiasDoAnexo, pecas?: PecasDoAparelho): Promise<string> {
  if (!tamanhoDoDepositoOk(cifrado.length) || cifrado.length > MAIOR_CIFRADO) throw erro("anexo_grande");
  const p = pecas ?? (await pecasDeVerdade());
  let r: Response;
  try {
    r = await p.fetch(`${p.base}/api/alumia/anexo?d=${dias}`, {
      ...comum,
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", Authorization: await p.passe() },
      body: cifrado,
    });
  } catch {
    throw erro("rede");
  }
  const corpo = (await r.json().catch(() => null)) as { endereco?: unknown; erro?: unknown } | null;
  if (r.ok && enderecoValido(corpo?.endereco)) return corpo.endereco;
  const codigo = typeof corpo?.erro === "string" ? corpo.erro : "";
  throw erro(codigo === "desligado" ? "anexo_desligado" : codigo === "passe" || codigo === "passe_usado" ? "passe" : codigo === "grande" || codigo === "tamanho" ? "anexo_grande" : "rede");
}

/** Baixa o cifrado do endereço; null se não existe mais (venceu, foi aberto uma vez, quem mandou apagou) ou veio de outro tamanho. */
export async function baixarAnexo(corpo: Pick<CorpoDeAnexo, "endereco" | "tamanho">, pecas?: PecasDoAparelho): Promise<Uint8Array<ArrayBuffer> | null> {
  if (!enderecoValido(corpo.endereco)) return null;
  const p = pecas ?? (await pecasDeVerdade());
  try {
    const r = await p.fetch(`${p.base}/api/alumia/anexo?e=${corpo.endereco}`, { ...comum, method: "GET" });
    if (!r.ok) return null;
    const b = new Uint8Array(await r.arrayBuffer());
    return b.length === corpo.tamanho ? b : null;
  } catch {
    return null;
  }
}

/** Pede ao depósito que apague (quem mandou apagou para todos, ou "ver uma vez" foi aberto). Nunca lança. */
export async function tirarAnexo(endereco: string, pecas?: PecasDoAparelho): Promise<void> {
  if (!enderecoValido(endereco)) return;
  try {
    const p = pecas ?? (await pecasDeVerdade());
    await p.fetch(`${p.base}/api/alumia/anexo?e=${endereco}`, { ...comum, method: "DELETE" });
  } catch {
    // a faxina do prazo apaga de todo jeito
  }
}

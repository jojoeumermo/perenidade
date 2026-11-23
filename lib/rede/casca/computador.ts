// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A casca do app do COMPUTADOR (Tauri 2; onda R3, item 1.2): a implementação, para o computador, da interface `Casca` de
// lib/rede/casca/plataforma.ts (frente android). Cada função chama um dos OITO comandos do app (desktop/src-tauri/src/lib.rs,
// lista fechada no build.rs e na capability):
//   embrulhar/desembrulhar → cofre_embrulhar/cofre_desembrulhar (chave no chaveiro do sistema, nativo/nucleo/src/cofre.rs);
//   fetchNativo            → rede_pedir (sem Origin, sem cookie, só os serviços do chat no endereço do Instituto);
//   notificar              → notificar ("Nova mensagem", o texto nem sai daqui);
//   apagarTudo             → app_apagar_tudo;
//   conferirAtualizacao    → atualizacao_conferir (o próprio executável contra o livro público);
//   abrirRede              → rede_abrir (no navegador do sistema, fora do app).
// Quem usa: a página que inicia a casca no computador chama `definirCasca(cascaDoComputador())`. O site NÃO importa este arquivo.
// Sem "@/" e sem importar o pacote do Tauri no topo: roda no Node nos testes com um `invoke` falso (scripts/testar-r3-desktop.mjs).

import type { Casca } from "./plataforma";

/** A interface Casca de lib/rede/casca/plataforma.ts, com o que o computador sempre tem (o fetch nativo). */
export type CascaDoComputador = Casca & { plataforma: "computador"; fetchNativo: typeof fetch };

export type Invocar = (comando: string, argumentos?: Record<string, unknown>) => Promise<unknown>;

/** O endereço do Instituto: o único para onde o fetch nativo vai (o nativo confere de novo). */
export const ORIGEM_DA_REDE = "https://institutolucia.org";
const CABECALHOS_QUE_VAO = new Set(["content-type", "authorization"]);

function paraBase64(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}
function deBase64(s: string): Uint8Array {
  const t = atob(s);
  const b = new Uint8Array(t.length);
  for (let i = 0; i < t.length; i++) b[i] = t.charCodeAt(i);
  return b;
}

/** O `invoke` do Tauri, sem importar o pacote (ele só lê window.__TAURI_INTERNALS__, que o app injeta). */
function invocarDoTauri(): Invocar {
  return (comando, argumentos) => {
    const t = (globalThis as { __TAURI_INTERNALS__?: { invoke: Invocar } }).__TAURI_INTERNALS__;
    if (!t) return Promise.reject(new Error("fora_do_app"));
    return t.invoke(comando, argumentos ?? {});
  };
}

/** O caminho (com a busca) de um pedido do chat, só se for para o endereço do Instituto; nulo para qualquer outro lugar. */
export function caminhoDoPedido(entrada: string | URL, base = ORIGEM_DA_REDE): string | null {
  let u: URL;
  try {
    u = new URL(entrada, base);
  } catch {
    return null;
  }
  if (u.origin !== ORIGEM_DA_REDE || u.username || u.password || u.hash) return null;
  return `${u.pathname}${u.search}`;
}

async function corpoEmBytes(corpo: BodyInit | null | undefined): Promise<Uint8Array | null> {
  if (corpo === null || corpo === undefined) return null;
  if (typeof corpo === "string") return new TextEncoder().encode(corpo);
  if (corpo instanceof Uint8Array) return corpo;
  if (corpo instanceof ArrayBuffer) return new Uint8Array(corpo);
  if (ArrayBuffer.isView(corpo)) return new Uint8Array(corpo.buffer, corpo.byteOffset, corpo.byteLength);
  if (typeof Blob !== "undefined" && corpo instanceof Blob) return new Uint8Array(await corpo.arrayBuffer());
  throw new TypeError("corpo_nao_suportado");
}

/** A casca do computador. `invocar` só muda nos testes. */
export function cascaDoComputador(invocar: Invocar = invocarDoTauri()): CascaDoComputador {
  const fetchNativo = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const pedido = typeof Request !== "undefined" && entrada instanceof Request ? entrada : null;
    const caminho = caminhoDoPedido(pedido ? pedido.url : (entrada as string | URL));
    if (!caminho) throw new TypeError("fora_do_instituto");
    const metodo = (init?.method ?? pedido?.method ?? "GET").toUpperCase();
    const cabecalhos: [string, string][] = [];
    new Headers(init?.headers ?? pedido?.headers ?? undefined).forEach((valor, nome) => {
      if (CABECALHOS_QUE_VAO.has(nome.toLowerCase())) cabecalhos.push([nome.toLowerCase(), valor]);
    });
    const bytes = await corpoEmBytes(init?.body ?? (pedido && metodo !== "GET" ? await pedido.arrayBuffer() : null));
    const r = (await invocar("rede_pedir", { metodo, caminho, cabecalhos, corpo: bytes ? paraBase64(bytes) : null })) as {
      status: number;
      corpo: string;
      tipo: string | null;
    };
    const corpoDaResposta = deBase64(r.corpo);
    return new Response(r.status === 204 || r.status === 304 ? null : (corpoDaResposta.slice().buffer as ArrayBuffer), {
      status: r.status,
      headers: r.tipo ? { "content-type": r.tipo } : {},
    });
  }) as typeof fetch;

  return {
    plataforma: "computador",
    async embrulhar(finalidade, dados) {
      return deBase64((await invocar("cofre_embrulhar", { finalidade, dados: paraBase64(dados) })) as string);
    },
    async desembrulhar(finalidade, embrulhado) {
      const r = (await invocar("cofre_desembrulhar", { finalidade, embrulhado: paraBase64(embrulhado) })) as string | null;
      return r === null ? null : deBase64(r);
    },
    fetchNativo,
    async notificar() {
      await invocar("notificar");
    },
    async apagarTudo() {
      await invocar("app_apagar_tudo");
    },
    aoIrParaOFundo(f) {
      if (typeof document === "undefined" || typeof window === "undefined") return () => undefined;
      const escondeu = () => {
        if (document.visibilityState === "hidden") f();
      };
      // No computador a janela pode ficar atrás de outra sem "esconder": perder o foco também trava.
      document.addEventListener("visibilitychange", escondeu);
      window.addEventListener("blur", f);
      return () => {
        document.removeEventListener("visibilitychange", escondeu);
        window.removeEventListener("blur", f);
      };
    },
    async conferirAtualizacao(versao) {
      const r = await invocar("atualizacao_conferir", { versao });
      return r === "no_log" || r === "sem_rede" ? r : "fora_do_log";
    },
    async abrirRede(caminho) {
      await invocar("rede_abrir", { caminho });
    },
  };
}

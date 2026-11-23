// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A casca do app de Android (onda R3, itens 1.2 e 2.3): a interface de lib/rede/casca/plataforma.ts sobre os plugins nativos
// próprios (android/app/src/main/java/org/institutolucia/app/):
//   AlumiaCofre — uma chave AES-256-GCM NÃO exportável no AndroidKeyStore (no StrongBox quando o aparelho tem; senão no TEE) que
//                 embrulha o que o chat guarda; a contagem das senhas erradas e o apagar tudo (clearApplicationUserData);
//   AlumiaApp   — notificação sem conteúdo, nome e ícone disfarçados, a rede social numa tela sem ponte (outro processo) e os avisos
//                 de ida para o fundo (a trava automática);
//   CapacitorHttp (do próprio Capacitor) — o fetch nativo das caixas, sem `Origin` e com os cabeçalhos fixos.
// Os plugins chegam INJETADOS (quem monta é casca/app/**, que importa o @capacitor/core): este arquivo não importa o Capacitor,
// para o site não levar nada dele e para os testes rodarem no Node com plugins falsos (scripts/testar-r3-android-casca.mjs).
// Bytes atravessam a ponte em base64 (a ponte do Capacitor só leva JSON).
import { CABECALHOS_DOS_APPS } from "../caixas/ritmo";
import { type Casca, caminhoDaRede } from "./plataforma";

/** O nível do cofre que guardou a chave: StrongBox (chip separado), TEE (área isolada do processador) ou só software (emulador velho). */
export type NivelDoCofre = "strongbox" | "tee" | "software";

/** O plugin AlumiaCofre (Java), como a ponte o expõe. */
export interface PluginCofre {
  embrulhar(o: { finalidade: string; dados: string }): Promise<{ embrulhado: string }>;
  desembrulhar(o: { finalidade: string; embrulhado: string }): Promise<{ dados: string | null }>;
  apagarTudo(): Promise<void>;
  /** Conta UMA tentativa como errada ANTES de conferir a senha (desligar o app no meio não zera nada). */
  contarSenhaErrada(): Promise<{ erros: number; limite: number }>;
  /** A senha certa: zera a contagem. */
  zerarSenhas(): Promise<void>;
  /** 0 = desligado (o padrão). Entre 3 e 50. */
  definirLimite(o: { limite: number }): Promise<{ limite: number }>;
  estado(): Promise<{ erros: number; limite: number; nivel: NivelDoCofre }>;
}

/** Os nomes que o app pode mostrar na tela inicial (o ícone muda junto). */
export const DISFARCES = ["padrao", "calculadora", "notas"] as const;
export type Disfarce = (typeof DISFARCES)[number];

/** O plugin AlumiaApp (Java). */
export interface PluginApp {
  disfarce(o: { nome: Disfarce }): Promise<{ nome: Disfarce }>;
  disfarceAtual(): Promise<{ nome: Disfarce }>;
  notificar(): Promise<void>;
  abrirRede(o: { caminho: string }): Promise<void>;
  addListener(evento: "fundo" | "frente", f: () => void): Promise<{ remove(): Promise<void> }>;
}

/** O CapacitorHttp (a parte que o fetch nativo usa). */
export interface PluginHttp {
  request(o: { url: string; method: string; headers: Record<string, string>; data?: unknown; responseType?: "text" }): Promise<{ status: number; data: unknown; headers: Record<string, string> }>;
}

const paraB64 = (b: Uint8Array): string => {
  let t = "";
  for (let i = 0; i < b.length; i += 0x8000) t += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(t);
};
const deB64 = (t: string): Uint8Array => {
  const s = atob(t);
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
};

/** Finalidades: curtas, sem espaço, para não virarem um canal de texto livre até o nativo. */
const finalidadeValida = (f: string) => /^[a-z0-9][a-z0-9:/._-]{0,63}$/.test(f);

// Os cabeçalhos que o fetch nativo manda: os mesmos em todo app (3.3: todos com o mesmo padrão), de um lugar só
// (CABECALHOS_DOS_APPS, lib/rede/caixas/ritmo.ts; o computador manda os mesmos pelo Rust, desktop/src-tauri/src/rede.rs).

/**
 * O fetch nativo: só para o endereço do servidor (`base`), só GET e POST, corpo JSON. Não leva `Origin`, `Referer` nem cookie (o
 * HTTP nativo não tem). Qualquer outro endereço é recusado aqui, antes de sair do aparelho.
 */
export function fetchPeloHttpNativo(http: PluginHttp, base: string): typeof fetch {
  const origem = new URL(base).origin;
  return (async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
    if (url.origin !== origem) throw Object.assign(new TypeError("endereco_fora"), { code: "endereco_fora" });
    const metodo = (init?.method ?? "GET").toUpperCase();
    if (metodo !== "GET" && metodo !== "POST") throw Object.assign(new TypeError("metodo"), { code: "metodo" });
    const cabecalhos: Record<string, string> = { ...CABECALHOS_DOS_APPS };
    new Headers(init?.headers).forEach((valor, nome) => {
      // Só o que as rotas das caixas usam: o tipo do corpo e o passe (Authorization: PrivateToken …) ou o token da conta.
      if (nome === "content-type" || nome === "authorization") cabecalhos[nome === "content-type" ? "Content-Type" : "Authorization"] = valor;
    });
    let data: unknown;
    if (metodo === "POST" && typeof init?.body === "string") data = cabecalhos["Content-Type"]?.startsWith("application/json") ? JSON.parse(init.body) : init.body;
    const r = await http.request({ url: url.href, method: metodo, headers: cabecalhos, data, responseType: "text" });
    const corpo = typeof r.data === "string" ? r.data : JSON.stringify(r.data ?? null);
    return new Response(r.status === 204 ? null : corpo, { status: r.status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
}

/** Monta a casca do Android com os plugins de verdade (no app) ou falsos (nos testes). */
export function criarCascaAndroid(p: { cofre: PluginCofre; app: PluginApp; http?: PluginHttp; base?: string }): Casca {
  return {
    plataforma: "android",
    async embrulhar(finalidade, dados) {
      if (!finalidadeValida(finalidade)) throw Object.assign(new Error("finalidade"), { code: "finalidade" });
      const { embrulhado } = await p.cofre.embrulhar({ finalidade, dados: paraB64(dados) });
      return deB64(embrulhado);
    },
    async desembrulhar(finalidade, embrulhado) {
      if (!finalidadeValida(finalidade)) return null;
      try {
        const { dados } = await p.cofre.desembrulhar({ finalidade, embrulhado: paraB64(embrulhado) });
        return typeof dados === "string" ? deB64(dados) : null;
      } catch {
        return null;
      }
    },
    fetchNativo: p.http && p.base ? fetchPeloHttpNativo(p.http, p.base) : undefined,
    notificar: () => p.app.notificar(),
    apagarTudo: () => p.cofre.apagarTudo(),
    aoIrParaOFundo(f) {
      let saida: { remove(): Promise<void> } | null = null;
      let desligado = false;
      p.app.addListener("fundo", f).then((s) => {
        if (desligado) void s.remove();
        else saida = s;
      });
      return () => {
        desligado = true;
        void saida?.remove();
      };
    },
    // A conferência no livro público (Rekor) pelo sigstore-java ainda não está no app (pendência, dita em docs/BUILD-REPRODUZIVEL.md). Até lá,
    // a casca NÃO finge que conferiu: quem chama recebe o erro e a tela diz que a conferência não foi feita.
    conferirAtualizacao: async () => {
      throw Object.assign(new Error("nao_implementado"), { code: "nao_implementado" });
    },
    async abrirRede(caminho) {
      const certo = caminhoDaRede(caminho);
      if (!certo) throw Object.assign(new Error("caminho"), { code: "caminho" });
      await p.app.abrirRede({ caminho: certo });
    },
  };
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O transporte da malha sem internet no app Android (onda R3, item 2.2): fala com o plugin nativo `AlumiaMalha` (Kotlin, frente
// android: Bluetooth LE com o UUID de serviço da Alumia + GATT, endereço aleatório do Android). O Kotlin SÓ MOVE BYTES: não lê,
// não guarda e não escolhe pacote; tudo o que decide (o que guardar, repassar, entregar) é o núcleo em TypeScript (no.ts).
//
// Sem import do Capacitor (o site não o importa: scripts/testar-app-loja.mjs): o plugin é lido de `globalThis.Capacitor.Plugins`,
// que só existe dentro do app. No site, `transporteAndroid()` devolve null e a tela diz "só no app".
//
// O contrato com o plugin (o Kotlin implementa; a frente android confere com este arquivo):
//   ligar(): Promise<void>                             começa a anunciar e procurar (só depois de a pessoa ativar, com o aviso)
//   desligar(): Promise<void>                          para tudo e esquece os pares
//   mandar({ par, dados }): Promise<void>              dados = o pacote de 3254 bytes em base64url
//   evento "encontro" { par }                          um aparelho da Alumia por perto (par = um número da conexão, não o endereço)
//   evento "pacote"   { par, dados }                   um pacote que chegou (base64url); qualquer tamanho: o núcleo confere
//   evento "fim"      { par }                          a conexão com esse par acabou
import { deB64Url, paraB64Url } from "../chat/r2/bytes";
import type { ParDaMalha, TransporteDaMalha } from "./no";

interface Ouvinte {
  remove(): Promise<void>;
}
export interface PluginAlumiaMalha {
  ligar(): Promise<void>;
  desligar(): Promise<void>;
  mandar(o: { par: string; dados: string }): Promise<void>;
  addListener(evento: "encontro" | "fim", f: (e: { par: string }) => void): Promise<Ouvinte>;
  addListener(evento: "pacote", f: (e: { par: string; dados: string }) => void): Promise<Ouvinte>;
}

/** O plugin, se este código roda dentro do app Android com ele; senão null. */
export function pluginDaMalha(): PluginAlumiaMalha | null {
  const c = (globalThis as { Capacitor?: { Plugins?: Record<string, unknown>; getPlatform?: () => string } }).Capacitor;
  if (!c || c.getPlatform?.() !== "android") return null;
  const p = c.Plugins?.AlumiaMalha as PluginAlumiaMalha | undefined;
  return p && typeof p.ligar === "function" && typeof p.mandar === "function" && typeof p.addListener === "function" ? p : null;
}

type AoReceber = (p: Uint8Array) => void | Promise<void>;

/** Quantos pacotes um par pode ter esperando antes de o núcleo começar a ouvir (o resto some). */
const ESPERA_MAXIMA = 128;

class ParNativo implements ParDaMalha {
  receptores: AoReceber[] = [];
  aberto = true;
  /** O que chegou antes de o núcleo ouvir (o outro lado pode mandar antes de este lado tratar o encontro). */
  private esperando: Uint8Array[] = [];
  private readonly plugin: PluginAlumiaMalha;
  private readonly id: string;
  constructor(plugin: PluginAlumiaMalha, id: string) {
    this.plugin = plugin;
    this.id = id;
  }
  async mandar(p: Uint8Array): Promise<void> {
    if (!this.aberto) throw new Error("fechado");
    await this.plugin.mandar({ par: this.id, dados: paraB64Url(p) });
  }
  /** Um pacote chegou deste par. */
  chegou(bytes: Uint8Array) {
    if (!this.aberto) return;
    if (!this.receptores.length) {
      if (this.esperando.length < ESPERA_MAXIMA) this.esperando.push(bytes);
      return;
    }
    for (const r of this.receptores) void Promise.resolve().then(() => r(Uint8Array.from(bytes))).catch(() => undefined);
  }
  aoReceber(f: AoReceber): () => void {
    this.receptores.push(f);
    const antes = this.esperando;
    this.esperando = [];
    for (const b of antes) this.chegou(b);
    return () => {
      this.receptores = this.receptores.filter((x) => x !== f);
    };
  }
  fechar(): void {
    this.aberto = false;
    this.receptores = [];
    this.esperando = [];
  }
}

/** O transporte sobre o plugin, ou null fora do app. O plugin só é ligado quando alguém chama `aoEncontrar`. */
export function transporteAndroid(plugin: PluginAlumiaMalha | null = pluginDaMalha()): TransporteDaMalha | null {
  if (!plugin) return null;
  return {
    aoEncontrar(f) {
      const pares = new Map<string, ParNativo>();
      const ouvintes: Promise<Ouvinte>[] = [];
      let ativo = true;
      ouvintes.push(
        plugin.addListener("encontro", ({ par }) => {
          if (!ativo || typeof par !== "string" || pares.has(par)) return;
          const p = new ParNativo(plugin, par);
          pares.set(par, p);
          void Promise.resolve()
            .then(() => f(p))
            .catch(() => undefined);
        }),
      );
      ouvintes.push(
        plugin.addListener("pacote", ({ par, dados }) => {
          const p = pares.get(par);
          if (!p || !p.aberto || typeof dados !== "string" || dados.length > 8192) return;
          let bytes: Uint8Array;
          try {
            bytes = deB64Url(dados);
          } catch {
            return;
          }
          p.chegou(bytes);
        }),
      );
      ouvintes.push(
        plugin.addListener("fim", ({ par }) => {
          pares.get(par)?.fechar();
          pares.delete(par);
        }),
      );
      void plugin.ligar().catch(() => undefined);
      return () => {
        ativo = false;
        for (const p of pares.values()) p.fechar();
        pares.clear();
        for (const o of ouvintes) void o.then((x) => x.remove()).catch(() => undefined);
        void plugin.desligar().catch(() => undefined);
      };
    },
  };
}

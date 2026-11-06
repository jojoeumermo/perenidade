// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Pedidos a outras instâncias do Fediverso, pelo servidor, sem abrir porta para dentro de casa (SSRF). A mesma trava da prévia de
// link (lib/rede/publicar/buscar-seguro.ts): o nome é resolvido no momento de conectar e a conexão só sai se TODOS os endereços forem
// públicos; só https na porta 443; tempo limite e tamanho máximo; o corpo é lido aos poucos. GET segue até 3 redirecionamentos (cada
// um conferido de novo); POST não segue nenhum. Sem "@/".
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import { ipPrivado, urlSegura } from "../publicar/previa";

export interface OpcoesDoPedido {
  metodo?: "GET" | "POST";
  cabecalhos?: Record<string, string>;
  corpo?: string;
  tempoMs?: number;
  maxBytes?: number;
  /** Só para teste: aceita http e qualquer porta, e troca a conferência do IP e a resolução de nomes. */
  teste?: { ipAceito?: (ip: string) => boolean; resolver?: (nome: string) => Promise<string[]> };
}

export interface RespostaDoPedido {
  status: number;
  url: URL;
  tipo: string;
  texto: string;
}

export const AGENTE = "Alumia/1.0 (+https://institutolucia.org; ActivityPub)";
const resolverPadrao = async (nome: string) => (await dns.promises.lookup(nome, { all: true, verbatim: true })).map((x) => x.address);

/** O endereço como a federação aceita chamar: https, porta 443, nome público (em teste, http e qualquer porta). Nulo se não serve. */
export function urlDoFediverso(texto: string, teste = false): URL | null {
  const u = urlSegura(texto, { qualquerPorta: teste });
  if (!u) return null;
  if (u.protocol !== "https:" && !teste) return null;
  return u;
}

function umPedido(url: URL, o: OpcoesDoPedido): Promise<{ status: number; local?: string; tipo: string; texto: string }> {
  const aceito = o.teste?.ipAceito ?? ((ip: string) => !ipPrivado(ip));
  const resolver = o.teste?.resolver ?? resolverPadrao;
  const max = o.maxBytes ?? 1024 * 1024;
  return new Promise((resolve, reject) => {
    const modulo = url.protocol === "https:" ? https : http;
    const pedido = modulo.request(
      url,
      {
        method: o.metodo ?? "GET",
        timeout: o.tempoMs ?? 8000,
        agent: false,
        headers: { "User-Agent": AGENTE, ...(o.corpo !== undefined ? { "Content-Length": String(Buffer.byteLength(o.corpo)) } : {}), ...o.cabecalhos },
        lookup: ((nome: string, opcoes: { all?: boolean } | undefined, cb: (e: Error | null, a?: unknown, f?: number) => void) => {
          resolver(nome).then(
            (ips) => {
              if (!ips.length || !ips.every(aceito)) return cb(new Error("destino_proibido"));
              const familia = (ip: string) => (ip.includes(":") ? 6 : 4);
              if (opcoes && opcoes.all) return cb(null, ips.map((address) => ({ address, family: familia(address) })));
              cb(null, ips[0], familia(ips[0]));
            },
            (e) => cb(e as Error),
          );
        }) as never,
      },
      (resposta) => {
        const status = resposta.statusCode ?? 0;
        if (status >= 300 && status < 400 && resposta.headers.location) {
          resposta.resume();
          resolve({ status, local: String(resposta.headers.location), tipo: "", texto: "" });
          return;
        }
        const tipo = String(resposta.headers["content-type"] ?? "").toLowerCase();
        const pedacos: Buffer[] = [];
        let total = 0;
        let acabou = false;
        resposta.on("data", (p: Buffer) => {
          total += p.length;
          if (total > max) {
            resposta.destroy();
            return;
          }
          pedacos.push(p);
        });
        const fim = () => {
          if (acabou) return;
          acabou = true;
          resolve({ status, tipo, texto: total > max ? "" : Buffer.concat(pedacos).toString("utf8") });
        };
        resposta.on("end", fim);
        resposta.on("close", fim);
        resposta.on("error", fim);
      },
    );
    pedido.on("timeout", () => pedido.destroy(new Error("tempo_esgotado")));
    pedido.on("error", reject);
    if (o.corpo !== undefined) pedido.write(o.corpo);
    pedido.end();
  });
}

/** Um pedido com tudo conferido. Nulo se o destino é proibido, falhou ou demorou demais (o status volta mesmo quando não é 2xx). */
export async function pedirAoFediverso(endereco: string, o: OpcoesDoPedido = {}): Promise<RespostaDoPedido | null> {
  let url = urlDoFediverso(endereco, Boolean(o.teste));
  const saltos = (o.metodo ?? "GET") === "GET" ? 3 : 0;
  for (let salto = 0; url && salto <= saltos; salto++) {
    let r;
    try {
      r = await umPedido(url, o);
    } catch {
      return null;
    }
    if (r.status >= 300 && r.status < 400 && r.local) {
      if (salto === saltos) return { status: r.status, url, tipo: "", texto: "" };
      try {
        url = urlDoFediverso(new URL(r.local, url).href, Boolean(o.teste));
      } catch {
        return null;
      }
      continue;
    }
    return { status: r.status, url, tipo: r.tipo, texto: r.texto };
  }
  return null;
}

/** Lê JSON de um corpo, ou nulo. */
export function lerJson(texto: string): Record<string, unknown> | null {
  try {
    const j = JSON.parse(texto) as unknown;
    return j && typeof j === "object" && !Array.isArray(j) ? (j as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Busca de uma página ou imagem de fora, pelo servidor, sem abrir porta para dentro de casa (SSRF). Diferente de um
// fetch comum: o nome do site é resolvido AQUI, no momento de conectar, e a conexão só sai se TODOS os endereços forem
// públicos (um nome pode apontar para 127.0.0.1 ou 169.254.169.254; conferir antes e deixar o fetch resolver de novo
// abriria uma brecha de troca no meio do caminho). Redirecionamentos são seguidos à mão (até 3), cada um conferido; há
// tempo limite e tamanho máximo, e o corpo é lido aos poucos (para nunca encher a memória).
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import { ipPrivado, urlSegura } from "./previa";

export interface OpcoesDeBusca {
  tempoMs?: number;
  maxBytes?: number;
  maxRedirecionamentos?: number;
  /** Tipos aceitos (começo do Content-Type). */
  tipos?: string[];
  /** Só para teste: decide se um IP é destino aceitável. Padrão: não ser privado. */
  ipAceito?: (ip: string) => boolean;
  /** Só para teste: troca a resolução de nomes. */
  resolver?: (nome: string) => Promise<string[]>;
  cabecalhos?: Record<string, string>;
  /** Só para teste: aceita qualquer porta (um servidor de teste não usa 80 nem 443). */
  qualquerPorta?: boolean;
}

export interface RespostaDeBusca {
  url: URL;
  tipo: string;
  corpo: Uint8Array;
  truncado: boolean;
}

const resolverPadrao = async (nome: string) => (await dns.promises.lookup(nome, { all: true, verbatim: true })).map((x) => x.address);

function umaBusca(url: URL, o: Required<Pick<OpcoesDeBusca, "tempoMs" | "maxBytes">> & OpcoesDeBusca): Promise<{ status: number; local?: string; tipo: string; corpo: Uint8Array; truncado: boolean }> {
  const aceito = o.ipAceito ?? ((ip: string) => !ipPrivado(ip));
  const resolver = o.resolver ?? resolverPadrao;
  return new Promise((resolve, reject) => {
    const modulo = url.protocol === "https:" ? https : http;
    const pedido = modulo.request(
      url,
      {
        method: "GET",
        timeout: o.tempoMs,
        // Sem agente compartilhado: nenhuma conexão antiga é reaproveitada, então toda busca passa pela conferência do lookup abaixo.
        agent: false,
        headers: { "User-Agent": "InstitutoLuciaPrevia/1.0 (+https://institutolucia.org)", Accept: "text/html,image/*;q=0.8", "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.5", ...o.cabecalhos },
        // O ponto da trava: o IP que vai ser usado é o que passou na conferência.
        lookup: ((nome: string, opcoesDeLookup: { all?: boolean } | undefined, cb: (e: Error | null, a?: unknown, f?: number) => void) => {
          resolver(nome).then(
            (ips) => {
              if (!ips.length || !ips.every(aceito)) return cb(new Error("destino_proibido"));
              const familia = (ip: string) => (ip.includes(":") ? 6 : 4);
              // O Node (famílias automáticas) pede a lista inteira; sem isso, um endereço só.
              if (opcoesDeLookup && opcoesDeLookup.all) return cb(null, ips.map((address) => ({ address, family: familia(address) })));
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
          resolve({ status, local: String(resposta.headers.location), tipo: "", corpo: new Uint8Array(), truncado: false });
          return;
        }
        const tipo = String(resposta.headers["content-type"] ?? "").toLowerCase();
        const pedacos: Buffer[] = [];
        let total = 0;
        let truncado = false;
        resposta.on("data", (p: Buffer) => {
          total += p.length;
          if (total > o.maxBytes) {
            truncado = true;
            pedacos.push(p.subarray(0, p.length - (total - o.maxBytes)));
            resposta.destroy();
            return;
          }
          pedacos.push(p);
        });
        const fim = () => resolve({ status, tipo, corpo: new Uint8Array(Buffer.concat(pedacos)), truncado });
        resposta.on("end", fim);
        resposta.on("close", fim);
        resposta.on("error", () => fim());
      },
    );
    pedido.on("timeout", () => pedido.destroy(new Error("tempo_esgotado")));
    pedido.on("error", reject);
    pedido.end();
  });
}

/** Busca com tudo conferido. Devolve nulo se o destino é proibido, a resposta não é do tipo pedido, falhou ou demorou demais. */
export async function buscarSeguro(endereco: string, opcoes: OpcoesDeBusca = {}): Promise<RespostaDeBusca | null> {
  const o = { tempoMs: 6000, maxBytes: 512 * 1024, maxRedirecionamentos: 3, ...opcoes };
  let url = urlSegura(endereco, { qualquerPorta: o.qualquerPorta });
  for (let salto = 0; url && salto <= o.maxRedirecionamentos; salto++) {
    let r;
    try {
      r = await umaBusca(url, o);
    } catch {
      return null;
    }
    if (r.status >= 300 && r.status < 400 && r.local) {
      try {
        url = urlSegura(new URL(r.local, url).href, { qualquerPorta: o.qualquerPorta });
      } catch {
        return null;
      }
      continue;
    }
    if (r.status < 200 || r.status >= 300) return null;
    if (o.tipos && !o.tipos.some((t) => r.tipo.startsWith(t))) return null;
    return { url, tipo: r.tipo, corpo: r.corpo, truncado: r.truncado };
  }
  return null;
}

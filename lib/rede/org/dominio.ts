// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A prova do domínio próprio de uma organização (onda 12, frente 12E), feita pelo SERVIDOR do site (app/api/rede/org/dominio). A
// organização prova de um dos dois jeitos:
//   1. registro TXT em `_alumia.<domínio>` com o texto `alumia-dominio=<desafio>`;
//   2. arquivo `https://<domínio>/.well-known/alumia-dominio.txt` com o mesmo texto.
// O navegador de ninguém busca nada no site da organização: só o servidor, e só com HTTPS na porta 443.
//
// Cuidados de quem busca um endereço que outra pessoa escolheu (falsificação de pedido pelo servidor):
//   - o nome passa pela mesma limpeza do banco (sem endereço numérico, sem nome reservado);
//   - cada endereço que o nome resolve é conferido ANTES de conectar, no próprio `lookup` da conexão (assim não dá para trocar o
//     endereço entre a conferência e a conexão); endereço de rede interna, de laço, reservado ou de documentação recusa tudo;
//   - redirecionamento não é seguido; só a resposta 200; no máximo 2 KB lidos; 5 s de prazo.
// Nada disso é guardado: nem o endereço que o nome resolveu, nem a resposta. Só "achou" e o jeito (txt ou arquivo).
//
// As ferramentas de rede entram por parâmetro: o teste (scripts/testar-alumia-o12-org.mjs) usa dublês. Sem "@/" de propósito.
import type { LookupAddress } from "node:dns";
import { dominioLimpo } from "./comunicacao";

export const CAMINHO_DO_ARQUIVO = "/.well-known/alumia-dominio.txt";
export const PREFIXO_DO_TXT = "_alumia.";
const MAX_BYTES = 2048;
const PRAZO_MS = 5000;

/** O texto que a organização põe no TXT e no arquivo. */
export function textoEsperado(desafio: string): string {
  return `alumia-dominio=${desafio}`;
}

/** O registro TXT tem o texto? (um registro pode vir partido em pedaços: junta antes). */
export function txtConfere(registros: readonly (readonly string[])[], desafio: string): boolean {
  const alvo = textoEsperado(desafio);
  return registros.some((partes) => partes.join("").trim() === alvo);
}

/** O arquivo tem o texto numa linha só dele (o resto do arquivo pode ter comentário). */
export function arquivoConfere(corpo: string, desafio: string): boolean {
  const alvo = textoEsperado(desafio);
  return corpo.split(/\r?\n/).some((linha) => linha.trim() === alvo);
}

/** Os 4 números de um IPv4 escrito em texto, ou nulo. */
function ipv4(ip: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  const n = m.slice(1).map(Number);
  return n.every((x) => x <= 255) ? n : null;
}

/** IPv4 que não é da internet aberta (privado, laço, ligação local, CGNAT, documentação, testes, multicast, reservado). */
function ipv4Reservado([a, b, c]: number[]): boolean {
  return (
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113)
  );
}

/** Os 8 grupos de 16 bits de um IPv6 em texto (com "::" e IPv4 no fim), ou nulo. */
function ipv6(ip: string): number[] | null {
  let s = ip.toLowerCase().replace(/%.*$/, "");
  const v4 = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(s);
  if (v4) {
    const n = ipv4(v4[1]);
    if (!n) return null;
    s = s.slice(0, -v4[1].length) + `${((n[0] << 8) | n[1]).toString(16)}:${((n[2] << 8) | n[3]).toString(16)}`;
  }
  const partes = s.split("::");
  if (partes.length > 2) return null;
  const ler = (t: string) => (t ? t.split(":") : []);
  const ini = ler(partes[0]);
  const fim = partes.length === 2 ? ler(partes[1]) : [];
  const faltam = 8 - ini.length - fim.length;
  if ((partes.length === 1 && faltam !== 0) || faltam < 0) return null;
  const todos = [...ini, ...Array(partes.length === 2 ? faltam : 0).fill("0"), ...fim];
  if (todos.length !== 8 || todos.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return todos.map((g) => parseInt(g, 16));
}

/**
 * O endereço não é da internet aberta? Também recusa o que não se consegue ler (na dúvida, não conecta). IPv6 com IPv4 dentro
 * (::ffff:, 64:ff9b::, 2002::) vale pelo IPv4 de dentro.
 */
export function enderecoReservado(ip: string): boolean {
  const v4 = ipv4(ip);
  if (v4) return ipv4Reservado(v4);
  const g = ipv6(ip);
  if (!g) return true;
  const dentro = (hi: number, lo: number) => ipv4Reservado([hi >> 8, hi & 255, lo >> 8, lo & 255]);
  if (g.every((x) => x === 0)) return true; // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true; // ::1
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return dentro(g[6], g[7]); // ::ffff:a.b.c.d
  if (g.slice(0, 6).every((x) => x === 0)) return true; // ::a.b.c.d (antigo)
  if (g[0] === 0x64 && g[1] === 0xff9b) return dentro(g[6], g[7]); // NAT64
  if (g[0] === 0x2002) return dentro(g[1], g[2]); // 6to4
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 (local único)
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 (ligação local)
  if ((g[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 (antigo)
  if ((g[0] & 0xff00) === 0xff00) return true; // multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentação
  if (g[0] === 0x2001 && g[1] < 0x0200) return true; // 2001::/23 (IANA: Teredo, testes e afins)
  if (g[0] === 0x0100 && g.slice(1, 4).every((x) => x === 0)) return true; // 100::/64 (descarte)
  return (g[0] & 0xe000) !== 0x2000; // fora de 2000::/3 não é endereço público hoje
}

/** As ferramentas de rede (as de verdade em `ferramentasDoServidor`; o teste passa dublês). */
export interface FerramentasDoDominio {
  /** Os registros TXT do nome (cada um em pedaços), ou lista vazia. */
  resolverTxt: (nome: string) => Promise<string[][]>;
  /** O corpo do arquivo do domínio (só 200, sem redirecionar, até 2 KB), ou nulo. */
  buscarArquivo: (dominio: string) => Promise<string | null>;
}

export type ResultadoDaProva = { ok: true; metodo: "txt" | "arquivo" } | { ok: false; motivo: "invalido" | "nao_achou" };

/** Confere o domínio: primeiro o TXT, depois o arquivo. Erro de rede conta como "não achou". */
export async function provarDominio(dominio: string, desafio: string, f: FerramentasDoDominio): Promise<ResultadoDaProva> {
  const d = dominioLimpo(dominio);
  if (!d || d !== dominio || !/^[0-9a-f]{32}$/.test(desafio)) return { ok: false, motivo: "invalido" };
  try {
    if (txtConfere(await f.resolverTxt(`${PREFIXO_DO_TXT}${d}`), desafio)) return { ok: true, metodo: "txt" };
  } catch {
    // sem TXT (ou o resolvedor falhou): tenta o arquivo
  }
  try {
    const corpo = await f.buscarArquivo(d);
    if (corpo !== null && arquivoConfere(corpo, desafio)) return { ok: true, metodo: "arquivo" };
  } catch {
    // sem arquivo
  }
  return { ok: false, motivo: "nao_achou" };
}

/** As ferramentas de verdade (só no servidor do site, em Node). */
export async function ferramentasDoServidor(): Promise<FerramentasDoDominio> {
  const dns = await import("node:dns");
  const https = await import("node:https");

  const resolverTxt = (nome: string) =>
    Promise.race([
      dns.promises.resolveTxt(nome),
      new Promise<string[][]>((_, rejeitar) => setTimeout(() => rejeitar(new Error("prazo")), PRAZO_MS)),
    ]);

  // O lookup da conexão: resolve e recusa se QUALQUER endereço for reservado (a conexão usa só o que passou aqui).
  type Volta = (erro: NodeJS.ErrnoException | null, endereco: string | LookupAddress[], familia?: number) => void;
  const lookupSeguro = (nome: string, opcoes: { all?: boolean } | number | undefined, volta: Volta) => {
    dns.lookup(nome, { all: true, verbatim: true }, (erro, enderecos) => {
      if (erro) return volta(erro, "");
      const lista = enderecos as LookupAddress[];
      if (lista.length === 0 || lista.some((a) => enderecoReservado(a.address))) {
        return volta(Object.assign(new Error("endereco_reservado"), { code: "ENOTFOUND" }), "");
      }
      if (typeof opcoes === "object" && opcoes?.all) return volta(null, lista);
      return volta(null, lista[0].address, lista[0].family);
    });
  };

  const buscarArquivo = (dominio: string) =>
    new Promise<string | null>((resolver) => {
      const pedido = https.request(
        {
          host: dominio,
          servername: dominio,
          port: 443,
          path: CAMINHO_DO_ARQUIVO,
          method: "GET",
          headers: { Accept: "text/plain", "User-Agent": "Alumia-Dominio/1" },
          lookup: lookupSeguro as never,
          timeout: PRAZO_MS,
          agent: false,
        },
        (r) => {
          if (r.statusCode !== 200) {
            r.resume();
            return resolver(null);
          }
          const pedacos: Buffer[] = [];
          let total = 0;
          r.on("data", (b: Buffer) => {
            total += b.length;
            if (total > MAX_BYTES) {
              pedido.destroy();
              return resolver(null);
            }
            pedacos.push(b);
          });
          r.on("end", () => resolver(Buffer.concat(pedacos).toString("utf8")));
          r.on("error", () => resolver(null));
        },
      );
      pedido.on("timeout", () => pedido.destroy(new Error("prazo")));
      pedido.on("error", () => resolver(null));
      pedido.end();
    });

  return { resolverTxt, buscarArquivo };
}

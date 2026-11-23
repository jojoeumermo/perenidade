// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A ficha de filiação cifrada (Prompt 4, item 99; supabase/migracoes/20261127-p4-coletiva.sql). A ficha é montada e cifrada NO
// APARELHO de quem se filia, pela biblioteca de cifra da segurança pessoal (lib/rede/seguranca-pessoal/selo.ts: HPKE com X-Wing e
// AES-256-GCM, com o rótulo próprio "filiacao"; nenhuma construção nova), para a chave de segurança de cada pessoa que gere a
// organização. A ficha vai sempre do mesmo tamanho (4096 bytes antes da cifra). O RECIBO (32 bytes sorteados) fica só com quem
// mandou: o banco guarda só o resumo (sha256) e, com o recibo, a pessoa desfaz a filiação.
// Sem os atalhos "@/" de propósito: o teste (scripts/testar-p4-coletiva.mjs) roda este arquivo direto no Node.
import { abrir, deBase64, destinosConferidos, paraBase64, preencher, selar, tirarPreenchimento, type Destino } from "../seguranca-pessoal/selo";

/** O tamanho da ficha antes da cifra (o servidor não sabe se a pessoa escreveu muito ou pouco). */
export const TAMANHO_DA_FICHA = 4096;

/** Os campos da ficha. Todos opcionais, menos o nome; cada organização pede o que precisa (a tela mostra o "sobre" dela). */
export const CAMPOS_DA_FICHA = ["nome", "nascimento", "cidade", "bairro", "contato", "trabalho", "observacao"] as const;
export type CampoDaFicha = (typeof CAMPOS_DA_FICHA)[number];
export type Ficha = Partial<Record<CampoDaFicha, string>> & { nome: string };

/** O maior tamanho de cada campo (em letras). */
export const MAXIMO_DO_CAMPO: Record<CampoDaFicha, number> = { nome: 120, nascimento: 10, cidade: 80, bairro: 80, contato: 120, trabalho: 120, observacao: 1000 };

/** A ficha conferida: só os campos conhecidos, sem espaço sobrando, dentro do tamanho. Sem nome: nulo. */
export function fichaLimpa(entrada: Record<string, unknown>): Ficha | null {
  const saida: Partial<Record<CampoDaFicha, string>> = {};
  for (const campo of CAMPOS_DA_FICHA) {
    const v = typeof entrada[campo] === "string" ? (entrada[campo] as string).replace(/[\u0000-\u001f\u007f]/g, " ").trim() : "";
    if (v) saida[campo] = v.slice(0, MAXIMO_DO_CAMPO[campo]);
  }
  if (!saida.nome || saida.nome.length < 2) return null;
  return saida as Ficha;
}

/** A ficha em bytes, já do tamanho fixo. */
export function fichaEmBytes(ficha: Ficha): Uint8Array {
  return preencher(new TextEncoder().encode(JSON.stringify(ficha)), TAMANHO_DA_FICHA);
}

/** O contrário: bytes abertos viram a ficha (nula se não for uma ficha). */
export function lerFicha(aberto: Uint8Array): Ficha | null {
  const dados = tirarPreenchimento(aberto);
  if (!dados) return null;
  try {
    const obj = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(dados)) as Record<string, unknown>;
    return obj && typeof obj === "object" ? fichaLimpa(obj) : null;
  } catch {
    return null;
  }
}

/** O pacote para rede_p4_filiacao_enviar e o recibo que fica com a pessoa. */
export interface FiliacaoPronta {
  pedido: { org: string; id: string; cifra: string; recibo: string; embrulhos: { conta: string; embrulho: string }[] };
  /** O recibo (base64), só para quem mandou: guardar para desfazer. Nunca vai ao banco. */
  recibo: string;
  /** Quantas pessoas da gestão vão poder ler (só para a tela dizer "nenhuma": aí não dá para mandar). */
  leitoras: number;
}

/** O resumo sha256 (para o banco guardar no lugar do recibo). */
export async function resumoDoRecibo(recibo: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", recibo as Uint8Array<ArrayBuffer>));
}

/**
 * Monta a filiação: confere as chaves que o banco entregou (assinadas pela identidade de cada conta), cifra a ficha uma vez e
 * embrulha a chave para cada leitora. Sem nenhuma chave que confira: erro "sem_destino".
 */
export async function prepararFiliacao(org: string, destinosDoBanco: unknown, ficha: Ficha, conferidos?: Destino[]): Promise<FiliacaoPronta> {
  const destinos = conferidos ?? destinosConferidos(destinosDoBanco);
  if (!destinos.length) throw new Error("sem_destino");
  const id = crypto.randomUUID();
  const selado = await selar("filiacao", id, destinos, fichaEmBytes(ficha));
  const recibo = crypto.getRandomValues(new Uint8Array(32));
  const resumo = await resumoDoRecibo(recibo);
  return {
    pedido: {
      org, id, cifra: paraBase64(selado.cifra), recibo: paraBase64(resumo),
      embrulhos: selado.embrulhos.map((e) => ({ conta: e.conta, embrulho: paraBase64(e.embrulho) })),
    },
    recibo: paraBase64(recibo),
    leitoras: destinos.length,
  };
}

/** Abre uma ficha com a privada da chave de segurança de quem gere. Qualquer coisa errada: nulo (nunca lança). */
export async function abrirFiliacao(id: string, conta: string, privada: Uint8Array, embrulho: string, cifra: string): Promise<Ficha | null> {
  const e = deBase64(embrulho);
  const c = deBase64(cifra);
  if (!e || !c) return null;
  const aberto = await abrir("filiacao", id, conta, privada, e, c);
  return aberto ? lerFicha(aberto) : null;
}

/** As fichas abertas viram uma planilha CSV (para a gestão guardar no próprio aparelho). Aspas dobradas; sem fórmula. */
export function fichasEmCsv(fichas: { dia: string; ficha: Ficha }[]): string {
  const cel = (v: string) => {
    const limpo = /^[=+\-@]/.test(v) ? `'${v}` : v;
    return `"${limpo.replace(/"/g, '""')}"`;
  };
  const linhas = [["dia", ...CAMPOS_DA_FICHA].map(cel).join(",")];
  for (const { dia, ficha } of fichas) linhas.push([dia, ...CAMPOS_DA_FICHA.map((c) => ficha[c] ?? "")].map(cel).join(","));
  return linhas.join("\r\n") + "\r\n";
}

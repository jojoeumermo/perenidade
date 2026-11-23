// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As caixas anônimas, o lado do aparelho (docs/rede/CHAT-PRIVADO.md, caixas anônimas). Uma caixa é um identificador de 32
// bytes, um passe de depósito e um passe de leitura, sorteados aqui (crypto.getRandomValues). O servidor recebe o identificador cru e
// os passes só no corpo do pedido, e guarda só os resumos. Nenhuma destas chamadas leva a sessão da conta (lib/rede/caixas/transporte.ts).
// Criar caixa gasta um passe anônimo (lib/rede/passes/cliente.ts); depositar, buscar, confirmar, trocar e apagar não.
// Sem "@/" de propósito.
import { gastarPasse } from "../passes/cliente";
import { deB64u, paraB64u, resumo, ROTULOS, sortear } from "./base";
import { tamanhoAceito } from "./tamanhos";
import type { Caixa, Pacote, ResultadoDoDeposito } from "./tipos";
import { erroDe, postAnonimo } from "./transporte";

/** Uma caixa nova: identificador, passe de depósito e passe de leitura, 32 bytes cada (256 bits). */
export function novaCaixa(multi: boolean): Caixa {
  return { id: sortear(32), pd: sortear(32), pl: sortear(32), multi };
}

/** A caixa de outra pessoa, para depositar (só o identificador e o passe de depósito chegam a quem escreve). */
export function caixaDeTerceiros(id: Uint8Array, pd: Uint8Array): Pick<Caixa, "id" | "pd"> {
  if (id.length !== 32 || pd.length !== 32) throw erroDe("invalido");
  return { id, pd };
}

/** O resumo do identificador (o que o banco guarda, e o que entra no compromisso da franquia). */
export const idDaCaixaNoBanco = (id: Uint8Array): Uint8Array => resumo(ROTULOS.caixa, id);
/** Os resumos dos passes (o que vai ao servidor ao criar ou trocar). */
export const resumoDoPasseDeDeposito = (pd: Uint8Array): Uint8Array => resumo(ROTULOS.passeDeposito, pd);
export const resumoDoPasseDeLeitura = (pl: Uint8Array): Uint8Array => resumo(ROTULOS.passeLeitura, pl);

type ItemDoResultado = { ok?: unknown; erro?: unknown; marca?: unknown; dia?: unknown };

const primeiro = (corpo: Record<string, unknown> | null): ItemDoResultado | null => {
  const lista = corpo?.resultados;
  return Array.isArray(lista) && lista.length === 1 && lista[0] && typeof lista[0] === "object" ? (lista[0] as ItemDoResultado) : null;
};

/** Cria a caixa no servidor (gasta um passe anônimo). Idempotente: criar de novo a mesma caixa responde ok. */
export async function criar(c: Caixa): Promise<void> {
  await criarPorResumo({ id: c.id, pdH: resumoDoPasseDeDeposito(c.pd), pl: c.pl, multi: c.multi });
}

/**
 * Cria a caixa com o RESUMO do passe de depósito (gasta um passe anônimo). Serve a quem lê uma caixa cujo passe de depósito é de outra
 * pessoa (a conversa a dois: quem escreve manda só o resumo do passe dele, e o passe cru nunca sai do aparelho de quem escreve).
 */
export async function criarPorResumo(c: { id: Uint8Array; pdH: Uint8Array; pl: Uint8Array; multi: boolean }): Promise<void> {
  if (c.id.length !== 32 || c.pdH.length !== 32 || c.pl.length !== 32) throw erroDe("invalido");
  const passe = await gastarPasse();
  const r = await postAnonimo(
    "/api/alumia/caixa/lote",
    { itens: [{ acao: "criar", id: paraB64u(c.id), pd_h: paraB64u(c.pdH), pl_h: paraB64u(resumoDoPasseDeLeitura(c.pl)), multi: c.multi }] },
    passe,
  );
  const item = primeiro(r.corpo);
  if (r.status === 200 && item?.ok === true) return;
  throw erroDe(typeof item?.erro === "string" ? item.erro : typeof r.corpo?.erro === "string" ? r.corpo.erro : "rede");
}

/**
 * Deposita um pacote (já cifrado, num dos tamanhos fixos) na caixa de alguém. `franquia` é o compromisso da mensagem (32 bytes,
 * lib/rede/caixas/franquia.ts); a resposta traz a marca do servidor e o dia, para quem escreveu guardar com a mensagem. `unico`: o
 * depósito de um commit de grupo (um só por caixa de época; o segundo recebe "ocupada"). Passe de depósito errado (bloqueio) responde
 * ok como o certo, de propósito.
 */
export async function depositar(c: Pick<Caixa, "id" | "pd">, envelope: Uint8Array, franquia?: Uint8Array, unico?: boolean): Promise<ResultadoDoDeposito> {
  if (!tamanhoAceito(envelope.length)) return { ok: false, erro: "tamanho" };
  if (franquia && franquia.length !== 32) throw erroDe("invalido");
  const r = await postAnonimo("/api/alumia/caixa/lote", {
    itens: [{ acao: "depositar", id: paraB64u(c.id), pd: paraB64u(c.pd), envelope: paraB64u(envelope), ...(franquia ? { franquia: paraB64u(franquia) } : {}), ...(unico ? { unico: true } : {}) }],
  });
  const item = primeiro(r.corpo);
  if (r.status === 200 && item?.ok === true) {
    const marca = deB64u(item.marca, 32);
    return { ok: true, ...(marca && typeof item.dia === "string" ? { marca, dia: item.dia } : {}) };
  }
  const erro = item?.erro;
  return { ok: false, erro: erro === "ocupada" || erro === "tamanho" || erro === "cheia" ? erro : "rede" };
}

/** Os pacotes da caixa depois de `cursor` (até 50 por vez, em ordem). Passe errado ou caixa que não existe: lista vazia. */
export async function buscar(c: Pick<Caixa, "id" | "pl">, cursor: number): Promise<Pacote[]> {
  const r = await postAnonimo("/api/alumia/caixa/buscar", { id: paraB64u(c.id), pl: paraB64u(c.pl), cursor: Math.max(0, Math.floor(cursor)) });
  if (r.status !== 200 || !Array.isArray(r.corpo?.pacotes)) throw erroDe("rede");
  const saida: Pacote[] = [];
  for (const bruto of r.corpo.pacotes as Record<string, unknown>[]) {
    const envelope = deB64u(bruto?.envelope);
    const ordem = Number(bruto?.ordem);
    if (!envelope || !Number.isInteger(ordem) || ordem <= cursor || typeof bruto?.dia !== "string") continue;
    saida.push({
      ordem,
      envelope,
      franquia: bruto.franquia == null ? null : deB64u(bruto.franquia, 32),
      marca: bruto.marca == null ? null : deB64u(bruto.marca, 32),
      unico: bruto.unico === true,
      dia: bruto.dia,
    });
  }
  return saida.sort((a, b) => a.ordem - b.ordem);
}

/** Confirma a leitura até `ate`: na caixa de um leitor só, os pacotes saem do servidor. */
export async function confirmar(c: Pick<Caixa, "id" | "pl">, ate: number): Promise<void> {
  const r = await postAnonimo("/api/alumia/caixa/confirmar", { id: paraB64u(c.id), pl: paraB64u(c.pl), ate: Math.max(0, Math.floor(ate)) });
  if (r.status !== 200) throw erroDe("rede");
}

/**
 * Troca o passe de depósito e/ou o de leitura (só os resumos dos novos vão ao servidor). `bloqueio`: o passe de depósito velho para
 * NA HORA (quem foi bloqueado continua ouvindo "ok" e nada chega); sem bloqueio, o velho vale mais 7 dias.
 * Quem chama guarda os passes novos na lista do aparelho ANTES de chamar (perder o passe novo é perder a caixa).
 */
export async function trocar(c: Caixa, novo: Partial<Pick<Caixa, "pd" | "pl">>, bloqueio: boolean): Promise<void> {
  if ((novo.pd && novo.pd.length !== 32) || (novo.pl && novo.pl.length !== 32)) throw erroDe("invalido");
  await trocarPorResumo(c, { pdH: novo.pd ? resumoDoPasseDeDeposito(novo.pd) : undefined, plH: novo.pl ? resumoDoPasseDeLeitura(novo.pl) : undefined }, bloqueio);
}

/** O mesmo, com os RESUMOS dos passes novos (o passe de depósito novo pode ser de outra pessoa, que entregou só o resumo). */
export async function trocarPorResumo(c: Pick<Caixa, "id" | "pl">, novo: { pdH?: Uint8Array; plH?: Uint8Array }, bloqueio: boolean): Promise<void> {
  if (!novo.pdH && !novo.plH) throw erroDe("invalido");
  if ((novo.pdH && novo.pdH.length !== 32) || (novo.plH && novo.plH.length !== 32)) throw erroDe("invalido");
  const r = await postAnonimo("/api/alumia/caixa/trocar", {
    id: paraB64u(c.id),
    pl: paraB64u(c.pl),
    ...(novo.pdH ? { pd_h: paraB64u(novo.pdH) } : {}),
    ...(novo.plH ? { pl_h: paraB64u(novo.plH) } : {}),
    bloqueio,
  });
  if (r.status === 200 && r.corpo?.ok === true) return;
  throw erroDe(typeof r.corpo?.erro === "string" ? r.corpo.erro : "rede");
}

/** Apaga a caixa e tudo o que há nela. */
export async function apagar(c: Pick<Caixa, "id" | "pl">): Promise<void> {
  const r = await postAnonimo("/api/alumia/caixa/apagar", { id: paraB64u(c.id), pl: paraB64u(c.pl) });
  if (r.status !== 200) throw erroDe("rede");
}

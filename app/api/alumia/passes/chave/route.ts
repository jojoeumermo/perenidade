// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A chave pública dos passes anônimos (Privacy Pass, tipo 0x0002 Blind RSA, lib/rede/passes/servidor.ts). SEM sessão de conta.
//   GET                      → {semana, id, publica, seq}  a chave desta semana (nasce na primeira chamada da semana, já no registro)
//   GET ?semana=<n>          → a da semana n, se for esta ou a anterior e já existir (quem confere passes da semana passada)
//   GET ?contexto=<32 bytes> → a chave de um contexto (o passe da urna), se já existir
// `seq` é a linha do registro público de transparência ('passes-rsa'), que o aparelho confere (lib/rede/passes/cliente.ts) antes de
// pedir passes, e que o servidor do chat separado lê para conferir passes só com a chave pública. `publica` é o SPKI do RFC 9578.
import { deB64u, paraB64u } from "@/lib/rede/caixas/base";
import { recusaDeSessao, responder, trazSessao } from "@/lib/rede/caixas/rota";
import { semanaDe } from "@/lib/rede/passes/comum";
import { bancoDoSite, chaveDoEmissor, segredoDosPasses } from "@/lib/rede/passes/servidor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(pedido: Request) {
  if (trazSessao(pedido)) return recusaDeSessao();
  const segredo = segredoDosPasses();
  if (!segredo) return responder({ ok: false, erro: "sem_servico" }, 503);
  const busca = new URL(pedido.url).searchParams;
  const hoje = semanaDe();
  const pedida = busca.get("semana");
  const contextoB64 = busca.get("contexto");
  const contexto = contextoB64 === null ? new Uint8Array(0) : deB64u(contextoB64, 32);
  const semana = contexto && contexto.length ? 0 : pedida === null ? hoje : /^\d{1,7}$/.test(pedida) ? Number(pedida) : -1;
  if (!contexto || (contexto.length === 0 && semana !== hoje && semana !== hoje - 1)) return responder({ ok: false, erro: "invalido" }, 400);
  try {
    // Só a chave desta semana nasce aqui; a da semana passada e a de um contexto só são lidas.
    const criar = contexto.length === 0 && semana === hoje;
    const chave = await chaveDoEmissor(semana, contexto, await bancoDoSite(), criar ? segredo : null, criar);
    if (!chave) return responder({ ok: false, erro: "nao_encontrada" }, 404);
    if (chave.seq === null) return responder({ ok: false, erro: "rede" }, 502);
    return responder({ semana: chave.semana, id: paraB64u(chave.id), publica: paraB64u(chave.publica), seq: chave.seq });
  } catch (e) {
    return (e as Error).message === "sem_servico" ? responder({ ok: false, erro: "sem_servico" }, 503) : responder({ ok: false, erro: "rede" }, 502);
  }
}

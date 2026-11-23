// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O diretório das chaves públicas do chat novo, o lado do aparelho.
//   - LER (sem sessão): os aparelhos, os certificados, a chave e a caixa de pedidos de uma conta, por codinome. O servidor vê que alguém
//     leu o diretório daquele codinome, não quem;
//   - REIVINDICAR (sem sessão, com passe anônimo): uma pré-chave Proteus (ou um pacote MLS) de cada aparelho da conta, entregue uma vez;
//   - PUBLICAR (com a sessão da conta, que é dona das chaves): aparelho, pré-chaves, pacotes MLS e a parte pública da conta.
// As assinaturas (certificado do aparelho pela identidade, chave da semana e pré-chaves pela chave do aparelho) são conferidas por
// quem usa, no aparelho (frente da conversa a dois): o diretório só transporta, e o servidor não troca chave sem o aparelho notar.
// Sem "@/" de propósito.
import { gastarPasse } from "../passes/cliente";
import { deB64u, paraB64, paraBytea, resumo, ROTULOS } from "./base";
import type { AparelhoPublico, ContaPublica, DiretorioDaConta, PreChaveEntregue } from "./tipos";
import { erroDe, postAnonimo, transporte } from "./transporte";

/** O codinome como o banco aceita (public.rede_codinome_definir): 3 a 30 letras, algarismos, espaço, ponto, apóstrofo, _ e -. */
export const CODINOME = /^[\p{L}0-9][\p{L}0-9 .'_-]{2,29}$/u;

/** As chaves públicas de uma conta, por codinome (nulo: sem conta, sem chat novo ou suspensa). */
export async function lerDiretorio(codinome: string): Promise<DiretorioDaConta | null> {
  if (!CODINOME.test(codinome)) return null;
  const r = await postAnonimo("/api/alumia/diretorio/ler", { codinome });
  if (r.status === 404) return null;
  if (r.status !== 200 || !r.corpo) throw erroDe(r.status === 429 ? "muitos_pedidos" : "rede");
  return lerConta(r.corpo.conta);
}

/** Interpreta a resposta do banco (public.rede_diretorio_ler); nulo se faltar algo ou vier fora do tamanho. */
export function lerConta(bruto: unknown): DiretorioDaConta | null {
  if (!bruto || typeof bruto !== "object") return null;
  const d = bruto as Record<string, unknown>;
  const identidade = deB64u(d.identidade, 32), pedidosXwing = deB64u(d.pedidos_xwing, 1216), pedidosAssinatura = deB64u(d.pedidos_assinatura, 64);
  const pedidosCaixa = deB64u(d.pedidos_caixa, 32), pedidosPd = deB64u(d.pedidos_pd, 32);
  const votoXwing = d.voto_xwing == null ? null : deB64u(d.voto_xwing, 1216);
  const votoAssinatura = d.voto_assinatura == null ? null : deB64u(d.voto_assinatura, 64);
  if (typeof d.usuario !== "string" || !/^[0-9a-f-]{36}$/.test(d.usuario) || !identidade || !pedidosXwing || !pedidosAssinatura || !pedidosCaixa || !pedidosPd) return null;
  if ((d.voto_xwing != null && !votoXwing) || (d.voto_assinatura != null && !votoAssinatura) || !Array.isArray(d.aparelhos)) return null;
  const aparelhos: AparelhoPublico[] = [];
  for (const x of d.aparelhos as Record<string, unknown>[]) {
    const aparelho = deB64u(x?.aparelho, 32), certificado = deB64u(x?.certificado, 64), proteusImpressao = deB64u(x?.proteus_impressao);
    const xwingSemana = deB64u(x?.xwing_semana, 1216), xwingAssinatura = deB64u(x?.xwing_assinatura, 64);
    const semana = Number(x?.semana);
    if (!aparelho || !certificado || !proteusImpressao || !xwingSemana || !xwingAssinatura || !Number.isInteger(semana) || semana <= 0) return null;
    aparelhos.push({ aparelho, certificado, proteusImpressao, xwingSemana, xwingAssinatura, semana, criadoDia: typeof x.criado_dia === "string" ? x.criado_dia : undefined });
  }
  return { usuario: d.usuario, versao: Number(d.versao) || 1, identidade, pedidosXwing, pedidosAssinatura, pedidosCaixa, pedidosPd, votoXwing, votoAssinatura, aparelhos };
}

/** Uma pré-chave Proteus (ou um pacote MLS) de cada aparelho da conta, entregue uma vez cada (gasta um passe anônimo). */
export async function reivindicar(codinome: string, tipo: "proteus" | "mls"): Promise<PreChaveEntregue[]> {
  if (!CODINOME.test(codinome)) throw erroDe("invalido");
  const passe = await gastarPasse();
  const r = await postAnonimo("/api/alumia/diretorio/reivindicar", { codinome, tipo }, passe);
  if (r.status === 404) throw erroDe("nao_encontrado");
  if (r.status !== 200 || !Array.isArray(r.corpo?.pre)) throw erroDe(typeof r.corpo?.erro === "string" ? r.corpo.erro : "rede");
  const saida: PreChaveEntregue[] = [];
  for (const x of r.corpo.pre as Record<string, unknown>[]) {
    const aparelho = deB64u(x?.aparelho, 32), pre = deB64u(x?.pre);
    if (!aparelho || !pre) continue;
    saida.push({
      aparelho,
      pre,
      assinatura: x.assinatura == null ? null : deB64u(x.assinatura, 64),
      ...(typeof x.id === "number" ? { id: x.id } : {}),
      ...(x.ref != null && deB64u(x.ref) ? { ref: deB64u(x.ref) as Uint8Array } : {}),
    });
  }
  return saida;
}

// ── Publicar (com a sessão da conta) ────────────────────────────────────────────────────────────────────────────────────────

/** Publica (ou atualiza) um aparelho meu. */
export async function publicarAparelho(a: AparelhoPublico): Promise<void> {
  await transporte().rpcComSessao("rede_diretorio_publicar", {
    p_aparelho: {
      aparelho: paraB64(a.aparelho), certificado: paraB64(a.certificado), proteus_impressao: paraB64(a.proteusImpressao),
      xwing_semana: paraB64(a.xwingSemana), xwing_assinatura: paraB64(a.xwingAssinatura), semana: a.semana,
    },
  });
}

/** As pré-chaves Proteus de um aparelho meu (cada uma assinada pela chave do aparelho). Até 200 comuns e uma "última". */
export async function publicarPreChaves(aparelho: Uint8Array, lista: { id: number; pkb: Uint8Array; assinatura: Uint8Array; ultima?: boolean }[]): Promise<void> {
  await transporte().rpcComSessao("rede_diretorio_pre_chaves", {
    p_aparelho: paraBytea(aparelho),
    p_lista: lista.map((x) => ({ id: x.id, pkb: paraB64(x.pkb), assinatura: paraB64(x.assinatura), ultima: x.ultima === true })),
  });
}

/** Os pacotes de chave MLS de um aparelho meu. Até 100. */
export async function publicarPacotesMls(aparelho: Uint8Array, lista: { ref: Uint8Array; pacote: Uint8Array }[]): Promise<void> {
  await transporte().rpcComSessao("rede_diretorio_pacotes_mls", { p_aparelho: paraBytea(aparelho), p_lista: lista.map((x) => ({ ref: paraB64(x.ref), pacote: paraB64(x.pacote) })) });
}

/**
 * A parte pública da conta: identidade, chave de pedidos e a caixa de pedidos (id e passe de depósito públicos de propósito; o passe de
 * LEITURA fica só nos aparelhos da pessoa, e ao servidor vai só o resumo dele). A caixa de pedidos é criada pelo banco aqui.
 */
export async function publicarConta(conta: ContaPublica, pedidosPl: Uint8Array): Promise<void> {
  if (pedidosPl.length !== 32) throw erroDe("invalido");
  await transporte().rpcComSessao("rede_diretorio_conta", {
    p: {
      identidade: paraB64(conta.identidade), pedidos_xwing: paraB64(conta.pedidosXwing), pedidos_assinatura: paraB64(conta.pedidosAssinatura),
      pedidos_caixa: paraB64(conta.pedidosCaixa), pedidos_pd: paraB64(conta.pedidosPd), pedidos_pl_h: paraB64(resumo(ROTULOS.passeLeitura, pedidosPl)),
      ...(conta.votoXwing && conta.votoAssinatura ? { voto_xwing: paraB64(conta.votoXwing), voto_assinatura: paraB64(conta.votoAssinatura) } : {}),
    },
  });
}

/** Tira um aparelho meu do diretório (com as pré-chaves e os pacotes dele). */
export async function tirarAparelho(aparelho: Uint8Array): Promise<void> {
  await transporte().rpcComSessao("rede_diretorio_tirar_aparelho", { p_aparelho: paraBytea(aparelho) });
}

/** Apaga tudo o que é meu no diretório do chat novo (a conta continua). */
export async function apagarDiretorio(): Promise<void> {
  await transporte().rpcComSessao("rede_diretorio_apagar", {});
}

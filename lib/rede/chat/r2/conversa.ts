// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A conversa a dois da onda R2 (itens 1.1, 1.2 e 1.5): mandar e receber. Documento:
// docs/rede/CHAT-PRIVADO.md. Junta as peças, sem cifra própria:
//   bloco (lib/rede/chat/r2/bloco.ts) → Proteus (proteus.ts) → camada pós-quântica do SPQR (onda R3: lib/rede/chat/r3/camada-pq.ts)
//   → envelope X-Wing (envelope.ts) → depósito na caixa anônima do
//   aparelho de destino (o transporte é da frente das caixas: lib/rede/caixas/cliente.ts; aqui ele entra como função).
//
// Vários aparelhos: cada mensagem é cifrada para CADA aparelho confiável da outra pessoa (certificado pela identidade dela, com a
// chave da semana assinada) e para cada outro aparelho meu (pela caixa de sincronia dele, envelope do tipo "sincronia"). Cada cópia
// tem o seu kf (franquia); o id, o contador e o `anterior` são os mesmos em todas.
//
// Ao receber: o envelope abre com a chave da semana deste aparelho (a atual ou uma das 5 anteriores); o aparelho que diz ter mandado
// tem de ser conhecido e confiável; o Proteus confere a sessão e a identidade; o compromisso da franquia tem de bater (senão a
// mensagem é recusada: quem manda não consegue escrever algo que depois não se denuncia); o tipo do envelope tem de combinar com
// quem mandou ("sincronia" só de aparelho meu); e a ordem (ordem.ts) diz repetida, fora de ordem ou cadeia quebrada.
import { copia, deB64Url, iguais, juntar, paraB64Url, resumo, texto, type Bytes } from "./bytes";
import { type Bloco, ler, montar, novoBloco, type Prazo, resumoDoBloco, semKf, type TipoDoBloco } from "./bloco";
import { type CertificadoDoAparelho, certificadoConfere, chaveDaSemanaConfere } from "./certificados";
import { abrir, selar, semanaAceita, semanaDe, SEMANAS_ACEITAS, type TipoDoEnvelope } from "./envelope";
import { type Aviso, type EstadoDeEnvio, type EstadoDoRemetente, julgar } from "./ordem";
import { cifrar, decifrar, type Motor } from "./proteus";
import { ROTULOS_DE_FORA } from "./rotulos";
import { compromisso as compromissoDaFranquia } from "../../franquia/protocolo";
import { abrirCamada, selarCamada } from "../r3/camada-pq";
import { candidatos, paraMandar, type PqDoAparelho } from "../r3/sessao-pq";

/**
 * Os resumos que o banco guarda no lugar dos segredos da caixa, iguais aos da frente das caixas (lib/rede/caixas/base.ts, `resumo`):
 * SHA-256(rótulo ‖ valor), sem separador (o rótulo é fixo e o valor tem sempre 32 bytes).
 */
const resumoDeCaixa = (rotulo: string, valor: Uint8Array): Bytes => {
  if (valor.length !== 32) throw new Error("caixa_invalida");
  return resumo(juntar(texto(rotulo), valor));
};
/** id_h: o resumo do identificador de uma caixa. */
export const resumoDaCaixa = (id: Uint8Array): Bytes => resumoDeCaixa(ROTULOS_DE_FORA.caixa, id);
/** pd_h: o resumo do passe de depósito. */
export const resumoDoPasse = (pd: Uint8Array): Bytes => resumoDeCaixa(ROTULOS_DE_FORA.passeDeposito, pd);
/**
 * O compromisso da franquia: HMAC-SHA-256(kf, "alumia/r2/franquia/v1" ‖ id_h ‖ bloco sem kf) (docs/rede/CHAT-PRIVADO.md, denúncia com prova), a MESMA conta da frente
 * da denúncia (lib/rede/franquia/protocolo.ts), que o servidor confere na denúncia com prova: a função é a de lá. (Até a junção, este
 * arquivo usava a forma com tamanhos na frente de cada campo, e a denúncia de uma mensagem do chat nunca conferiria.)
 */
export const compromisso = (kf: Uint8Array, idH: Uint8Array, blocoSemKf: Uint8Array): Bytes => {
  if (kf.length !== 32 || idH.length !== 32) throw new Error("franquia_invalida");
  return Uint8Array.from(compromissoDaFranquia(kf, idH, blocoSemKf));
};

/** Um aparelho como está no diretório (público). */
export interface AparelhoPublico {
  aparelho: Bytes;
  certificado: CertificadoDoAparelho;
  xwing: Bytes;
  semana: number;
  xwingAssinatura: Bytes;
}

/**
 * Os aparelhos confiáveis de uma conta: certificados pela identidade que ESTE aparelho já conhece dela (conferida no registro de
 * transparência e, se a pessoa quis, pelo código de segurança), com a chave X-Wing da semana assinada e numa semana aceita. Um
 * aparelho que o servidor inventou (sem o certificado da identidade) fica de fora.
 */
export function aparelhosConfiaveis(conta: string, identidade: Uint8Array, lista: readonly AparelhoPublico[], agora = Date.now()): AparelhoPublico[] {
  return lista.filter(
    (a) =>
      a.certificado.conta === conta &&
      iguais(a.certificado.aparelho, a.aparelho) &&
      certificadoConfere(identidade, a.certificado) &&
      semanaAceita(a.semana, agora) &&
      chaveDaSemanaConfere(a.aparelho, a.xwing, a.semana, a.xwingAssinatura),
  );
}

/** Para onde vai uma cópia: o aparelho e a caixa de entrada dele para esta conversa (ou a caixa de sincronia, se é aparelho meu). */
export interface Destino {
  aparelho: AparelhoPublico;
  caixa: { id: Bytes; pd: Bytes };
  tipo: TipoDoEnvelope;
}

export type Depositar = (caixa: { id: Bytes; pd: Bytes }, envelope: Bytes, franquia: Bytes) => Promise<{ ok: boolean }>;

export interface Eu {
  conta: string;
  /** A chave Ed25519 deste aparelho (só a pública aqui). */
  aparelho: Bytes;
  motor: Motor;
  /** A privada X-Wing deste aparelho para uma semana (null se não há ou já foi apagada). */
  chaveDaSemana: (semana: number) => Promise<Bytes | null>;
  /** O SPQR deste aparelho (onda R3, item 1.1): a camada pós-quântica por cima do Proteus, obrigatória em toda mensagem. */
  pq: PqDoAparelho;
}

export interface Envio {
  tipo: TipoDoBloco;
  conversa: Bytes;
  prazo: Prazo;
  corpo: Bytes;
}

/**
 * Manda um bloco para todos os destinos (a sessão Proteus com cada aparelho já tem de existir: sessaoPelaPreChave). Devolve o
 * novo estado de envio (contador e `anterior`), o id da mensagem, quantas cópias o servidor aceitou e quantas falharam aqui.
 *
 * O contador nunca se repete: `reservar` recebe o estado novo ANTES do primeiro depósito e tem de gravá-lo (como um registro
 * gravado antes de agir). Se a aba fechar no meio, ou uma cópia der erro, o próximo envio já sai com o contador seguinte; sem isso,
 * quem recebeu a primeira cópia julgaria a mensagem nova como "repetida" e a descartaria em silêncio. Uma cópia que dá erro (cifra,
 * envelope ou rede) não desfaz as outras nem impede as seguintes.
 *
 * Onda R3: cada cópia leva a camada pós-quântica do SPQR da sessão com aquele aparelho. Todas as cópias são fechadas primeiro (o estado
 * novo do SPQR de cada aparelho entra em `eu.pq`), depois `reservar` grava tudo de uma vez (contador e SPQR), e só então os depósitos
 * saem: o estado do SPQR que gerou um pacote depositado nunca volta atrás.
 */
export async function mandar(
  eu: Eu, destinos: readonly Destino[], estado: EstadoDeEnvio, envio: Envio, depositar: Depositar, reservar: (novo: EstadoDeEnvio) => Promise<void>,
): Promise<{ estado: EstadoDeEnvio; id: Bytes; entregues: number; falhas: number }> {
  const contador = estado.contador + 1;
  const base = novoBloco({ ...envio, contador, anterior: anteriorDe(estado) });
  const resumo = resumoDoBloco(montar(base));
  const novo: EstadoDeEnvio = { contador, ultimo: paraB64Url(resumo) };
  let entregues = 0;
  let falhas = 0;
  const prontos: { caixa: Destino["caixa"]; envelope: Bytes; c: Bytes }[] = [];
  for (const d of destinos) {
    const bloco = montar({ ...base, kf: novoBloco(base).kf });
    try {
      const idH = resumoDaCaixa(d.caixa.id);
      const c = compromisso(bloco.subarray(75, 107), idH, semKf(bloco));
      const proteus = await cifrar(eu.motor, d.aparelho.aparelho, bloco);
      const reg = paraMandar(eu.pq, d.aparelho.aparelho);
      const pq = await selarCamada(eu.pq.motor, reg.e, proteus, eu.aparelho);
      eu.pq.gravar(d.aparelho.aparelho, { e: pq.estado, a: reg.a });
      const envelope = await selar(d.aparelho.xwing, d.aparelho.semana, idH, c, { tipo: d.tipo, aparelho: eu.aparelho, inicio: reg.a ? copia(reg.a) : null, camada: pq.camada });
      prontos.push({ caixa: d.caixa, envelope, c });
    } catch {
      falhas++;
    } finally {
      bloco.fill(0);
    }
  }
  await reservar(novo);
  for (const p of prontos) {
    try {
      if ((await depositar(p.caixa, p.envelope, p.c)).ok) entregues++;
      else falhas++;
    } catch {
      falhas++;
    }
  }
  return { estado: novo, id: base.id, entregues, falhas };
}

const anteriorDe = (estado: EstadoDeEnvio): Bytes => deB64Url(estado.ultimo);

/** Quem este aparelho conhece como remetente possível nesta caixa. */
export interface RemetenteConhecido {
  conta: string;
  impressao: string;
  /** Aparelho meu (vale envelope de sincronia) ou da outra pessoa (vale envelope de mensagem). */
  meu: boolean;
}

export type Recebida =
  | { ok: true; bloco: Bloco; conteudo: Bytes; de: { conta: string; aparelho: Bytes; meu: boolean }; avisos: Aviso[]; estado: EstadoDoRemetente }
  | { ok: false; motivo: "nao_abre" | "aparelho_desconhecido" | "tipo_trocado" | "franquia_errada" | "conversa_errada" | "repetida"; aparelho?: Bytes };

/**
 * Abre um pacote que chegou numa caixa deste aparelho. `conversa`: a conversa da caixa (null na caixa de sincronia, que leva todas).
 * `estadoDe`: o estado de ordem do aparelho que mandou, nesta conversa. Nada é gravado aqui: quem chama grava o estado novo.
 */
export async function receber(
  eu: Eu,
  caixaId: Uint8Array,
  pacote: { envelope: Uint8Array; franquia: Uint8Array },
  conversa: Uint8Array | null,
  conhecido: (aparelho: Bytes) => RemetenteConhecido | null,
  estadoDe: (conversa: Bytes, aparelho: Bytes) => EstadoDoRemetente,
  agora = Date.now(),
): Promise<Recebida> {
  const idH = resumoDaCaixa(caixaId);
  let dentro = null;
  for (let s = semanaDe(agora) + 1; s >= semanaDe(agora) - SEMANAS_ACEITAS && !dentro; s--) {
    const privada = await eu.chaveDaSemana(s);
    if (privada) dentro = await abrir(privada, s, idH, pacote.franquia, pacote.envelope, agora);
  }
  if (!dentro) return { ok: false, motivo: "nao_abre" };
  const quem = conhecido(dentro.aparelho);
  if (!quem) return { ok: false, motivo: "aparelho_desconhecido", aparelho: dentro.aparelho };
  if ((dentro.tipo === "sincronia") !== quem.meu) return { ok: false, motivo: "tipo_trocado" };
  // A camada pós-quântica: o estado SPQR da sessão com quem mandou (ou, no começo, o B2A com a auth_key de dentro). Nada é gravado
  // aqui; o estado novo só entra em `eu.pq` se o Proteus abrir e o bloco for válido (no fim).
  let pq: { estado: Uint8Array; proteus: Uint8Array } | null = null;
  for (const st of candidatos(eu.pq, dentro.aparelho, dentro.inicio, eu.aparelho)) {
    pq = await abrirCamada(eu.pq.motor, st, dentro.camada, dentro.aparelho);
    if (pq) break;
  }
  if (!pq) return { ok: false, motivo: "nao_abre" };
  const aberto = await decifrar(eu.motor, dentro.aparelho, quem.impressao, pq.proteus);
  if (!aberto) return { ok: false, motivo: "nao_abre" };
  const bloco = ler(aberto);
  if (!bloco) return { ok: false, motivo: "nao_abre" };
  if (!iguais(compromisso(bloco.kf, idH, semKf(aberto)), pacote.franquia)) return { ok: false, motivo: "franquia_errada" };
  if (conversa && !iguais(conversa, bloco.conversa)) return { ok: false, motivo: "conversa_errada" };
  const juizo = julgar(estadoDe(bloco.conversa, dentro.aparelho), bloco.contador, bloco.anterior, resumoDoBloco(aberto));
  if (juizo.juizo === "repetida") return { ok: false, motivo: "repetida" };
  // Abriu: a sessão SPQR com este aparelho fica confirmada (a auth_key não vai mais nos pacotes daqui para lá).
  eu.pq.gravar(dentro.aparelho, { e: pq.estado, a: null });
  // `conteudo`: o bloco sem o kf, como entrou no compromisso (a prova da denúncia leva estes bytes exatos).
  return { ok: true, bloco, conteudo: semKf(aberto), de: { conta: quem.conta, aparelho: dentro.aparelho, meu: quem.meu }, avisos: juizo.avisos, estado: juizo.estado };
}

/** Sessão sem resposta da outra pessoa há 30 dias é refeita com pré-chave nova (a regra que substitui "100 mensagens ou 7 dias"). */
export const DIAS_SEM_RESPOSTA = 30;
export const precisaRefazerSessao = (ultimaRespostaEm: number | null, agora = Date.now()) => ultimaRespostaEm !== null && agora - ultimaRespostaEm > DIAS_SEM_RESPOSTA * 86_400_000;

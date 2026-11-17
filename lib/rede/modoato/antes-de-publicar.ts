// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A verificação do modo ato antes de publicar (frente 9C; entra no compositor pelo encaixe, components/rede/modoato/encaixe.tsx):
//   1. CPF, celular, e-mail ou endereço com número: para, com o aviso (o banco recusaria de qualquer jeito);
//   2. placa de carro ou telefone fixo: para UMA vez com o aviso; o segundo toque em publicar, com o mesmo texto, passa;
//   3. com o modo ato ligado e foto no post: para UMA vez pedindo para conferir e borrar rostos; o segundo toque passa.
// O compositor conta as fotos em `extras.imagens` (e as que não passaram pelo borrar em `extras.imagensSemBorrar`); sem esses
// campos, o passo 3 não tem o que ver e não para. Pura: a memória do "já avisei" e o relógio vêm de fora (os testes passam os seus).
import { acharDadosPessoais } from "./dados-pessoais";

export interface PedidoParaVerificar {
  texto: string;
  extras: Record<string, unknown>;
}

export interface TextosDaVerificacao {
  cpf: string;
  telefone: string;
  email: string;
  endereco: string;
  placa: string;
  fixo: string;
  foto: string;
}

export type ResultadoDaVerificacao = { ok: true } | { ok: false; aviso: string; bloqueia: true };

/** O que já foi avisado, e quando (a chave é o pedido resumido). */
export type MemoriaDosAvisos = Map<string, number>;

/** Por quanto tempo o segundo toque com o mesmo texto passa sem novo aviso. */
export const JANELA_DO_SEGUNDO_TOQUE_MS = 2 * 60 * 1000;

const numero = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const encher = (texto: string, trecho: string) => texto.replace("{trecho}", trecho);

/** Avisa uma vez por pedido: na primeira, guarda e para; nas seguintes (dentro da janela), deixa passar. */
function umaVez(memoria: MemoriaDosAvisos, chave: string, agora: number): boolean {
  for (const [k, quando] of memoria) if (agora - quando > JANELA_DO_SEGUNDO_TOQUE_MS) memoria.delete(k);
  // Já avisado há pouco: passa (e continua passando até a janela fechar, para os avisos seguintes não voltarem ao primeiro).
  if (memoria.has(chave)) return false;
  memoria.set(chave, agora);
  return true;
}

export function verificarAntesDePublicar(
  pedido: PedidoParaVerificar,
  opcoes: { t: TextosDaVerificacao; modoAto: boolean; memoria: MemoriaDosAvisos; agora?: number },
): ResultadoDaVerificacao {
  const { t, modoAto, memoria } = opcoes;
  const agora = opcoes.agora ?? Date.now();
  const texto = pedido.texto ?? "";
  const achados = acharDadosPessoais(texto);
  const duro = achados.find((a) => a.bloqueia);
  if (duro) return { ok: false, bloqueia: true, aviso: encher(t[duro.tipo as keyof TextosDaVerificacao], duro.trecho) };

  const imagens = numero(pedido.extras?.imagens);
  const semBorrar = "imagensSemBorrar" in (pedido.extras ?? {}) ? numero(pedido.extras.imagensSemBorrar) : imagens;
  const leve = achados.find((a) => !a.bloqueia);
  const chave = `${texto.length}:${texto.slice(0, 200)}:${imagens}`;
  if (leve && umaVez(memoria, `dado:${chave}`, agora)) return { ok: false, bloqueia: true, aviso: encher(t[leve.tipo as "placa" | "fixo"], leve.trecho) };
  if (modoAto && semBorrar > 0 && umaVez(memoria, `foto:${chave}`, agora)) return { ok: false, bloqueia: true, aviso: t.foto };
  return { ok: true };
}

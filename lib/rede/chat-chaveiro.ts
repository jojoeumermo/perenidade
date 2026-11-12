// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O chaveiro do chat privado da Alumia, neste aparelho. Documento: docs/rede/CHAT-PRIVADO.md.
//
// A cifra é a da biblioteca do Matrix (lib/rede/chat/olm.ts): cada mensagem vai por Olm (Double Ratchet) só para o aparelho
// confiável da outra pessoa, dentro de um envelope selado (lib/rede/chat/selado.ts, HPKE X-Wing) que só ela abre, com quem mandou
// DENTRO. O banco recebe só "para quem", o envelope e o dia, e apaga ao entregar. O histórico fica neste aparelho, cifrado
// (lib/rede/chat/historico.ts), com trava opcional por senha.
//
// Aqui fica o que é do chat: a identidade que este aparelho já conhece de cada pessoa ("confiar na primeira vez, avisar quando
// mudar"), o aperto de mão de cada conversa (a senha de entrega da caixa e a chave do envelope, trocadas por Olm), o que já
// chegou de cada autor (repetição, buraco e ordem trocada) e o "apagar tudo". As chamadas ao banco ficam em
// lib/rede/cliente-chat.ts. O servidor não é de confiança para nada além de entregar.
import { paraBase64 } from "./../sigilo";
import { compararIdentidade, textoCabe, type Visto } from "./chat-privado";
import { lerBloco, montarBloco, NADA_VISTO } from "./chat/c3";
import {
  anotarLojaAberta, aoApagarTudoDoChat, apagarDaGaveta, apagarLojasDaBiblioteca, apagarPrefixoDaGaveta, apagarTudoDoChat as apagarTudoNoAparelho, CONHECIDAS, CONTAS, guardarNaGaveta, lerDaGaveta,
  lerPrefixoDaGaveta, mudarNaGaveta, ORDEM, PREFIXO_DA_LOJA_OLM,
} from "./chat/gaveta";
import { apagarConversaDoHistorico, apagarDoHistorico, esquecerChavesDoHistorico, exigirHistoricoAberto, guardarNoHistorico, type MensagemGuardada, mensagensDoHistorico } from "./chat/historico";
import { abrirAparelho, type AparelhoOlm, cifrarParaAparelho, entregarABiblioteca, fecharAparelho, idMatrix, novoNomeDeAparelho, type RecadoAberto, sincronizar, type TransporteOlm } from "./chat/olm";
import {
  buracos, chaveDaOrdem, chaveDoPiso, comContadorUsado, julgar, juntarRegistros, type MarcaDeVersoes, ordemDaTela, type OrdemDaTela, type PisoDeOrdem, podeFechar, prefixoDaOrdem, proximoContador,
  type RegistroDeOrdem, versaoDaChave,
} from "./chat/ordem";
import { abrirEnvelope, novaSenhaDeEntrega, novoParDoEnvelope, selar } from "./chat/selado";
import { atualizarVista, carimbo, conferir, INICIO, type TransporteDoRegistro, type VistaDoRegistro } from "./chat/transparencia";
import { chat, PREVIA_DO_CHAT, type Prazo, type SituacaoDoChat } from "./cliente-chat";

/** Eu, neste aparelho: a conta, a versão da minha chave no servidor, e o aparelho da biblioteca (fora da prévia). */
export { destravarHistorico, fecharHistorico, historicoTravado, travarHistorico } from "./chat/historico";

export interface Eu {
  usuario: string;
  versao: number;
  /** "o" + a chave ed25519 do aparelho: é ela que entra no código de segurança. */
  identidade: { publica: string };
  /** "o" + a chave curve25519 do aparelho. */
  aparelho: { publica: string };
  olm: AparelhoOlm | null;
}

const EU_DA_PREVIA = (usuario: string, versao = 1): Eu => ({ usuario, versao, aparelho: { publica: "previa-aparelho-eu" }, identidade: { publica: "previa-identidade-eu" }, olm: null });

/** O que este aparelho guarda da conta (na gaveta). */
interface Guardado {
  usuario: string;
  dispositivo: string;
  ed25519: string;
  curve25519: string;
  /** Chave HMAC NÃO exportável: a senha da loja da biblioteca é calculada com ela, e só neste aparelho. */
  segredo: CryptoKey;
  /** A senha de entrega da minha caixa (o banco guarda só o resumo) e o par do meu envelope. */
  entrega?: { senha: string; resumo: string };
  envelope?: { publica: string; privada: string };
}

interface Conhecida {
  /** "<eu>:<outra pessoa>". */
  chave: string;
  identidade: string;
  /** A chave do aparelho da pessoa ("o" + curve25519). */
  publica?: string;
  verificado: boolean;
  /** O que a pessoa me mandou no aperto de mão: a senha da caixa dela e a chave do envelope dela. */
  entrega?: { senha: string; envelope: string };
  /** O resumo da MINHA senha de entrega que já mandei a ela (se a senha mudar, mando de novo). */
  mandei?: string;
}

const lerConta = (usuario: string) => lerDaGaveta<Guardado>(CONTAS, usuario);
const lerConhecida = (eu: string, outro: string) => lerDaGaveta<Conhecida>(CONHECIDAS, `${eu}:${outro}`);
const guardarConhecida = (dados: Conhecida) => guardarNaGaveta(CONHECIDAS, dados);
const mudarConhecida = (eu: string, outro: string, mudar: (c: Conhecida) => Conhecida) =>
  mudarNaGaveta<Conhecida>(CONHECIDAS, `${eu}:${outro}`, (atual) => (atual ? mudar(atual) : null));

const erroDoChat = (codigo: string) => Object.assign(new Error(codigo), { code: codigo });
const codigoDe = (erro: unknown) => (typeof erro === "object" && erro !== null && "code" in erro ? String((erro as { code: unknown }).code ?? "") : "");

/** Os erros em que o servidor com certeza NÃO guardou o envelope (o contador dele pode ser usado de novo). */
const RECUSA_CERTA = /^(dm_fechada|dm_sem_chave|muitos_pedidos|consentimento|nao_encontrado|sem_servico|sem_permissao|invalido:)/;

const nomeDaLoja = (usuario: string) => `${PREFIXO_DA_LOJA_OLM}${usuario}`;
const ehOlm = (chave: { certificado?: string } | null | undefined) => chave?.certificado === "olm1";
const tirarO = (s: string) => (s.startsWith("o") ? s.slice(1) : s);
const PRAZOS: Prazo[] = [1, 7, 30];

/** As conversas abertas nesta página e os aparelhos da biblioteca abertos (um por conta). */
const sessoesAbertas = new Map<string, Sessao>();
const aparelhosAbertos = new Map<string, Promise<AparelhoOlm>>();
let geracao = 0;
const nascidoEm = new WeakMap<Eu, number>();
const marcar = (eu: Eu): Eu => {
  nascidoEm.set(eu, geracao);
  return eu;
};
const vale = (eu: Eu) => nascidoEm.get(eu) === geracao;
function esquecerSessoes() {
  geracao++;
  sessoesAbertas.clear();
  const abertos = [...aparelhosAbertos.values()];
  aparelhosAbertos.clear();
  for (const a of abertos) void a.then(fecharAparelho, () => undefined);
  esquecerChavesDoHistorico();
}
aoApagarTudoDoChat(esquecerSessoes);

const transporte: TransporteOlm = {
  publicar: (p) => chat.olm.publicar(p),
  consultar: (u) => chat.olm.consultar(u),
  reivindicar: (p) => chat.olm.reivindicar(p),
  enviar: (t, m) => chat.olm.enviar(t, m),
  receber: () => chat.olm.receber(),
  confirmar: (ate) => chat.olm.confirmar(ate),
};

async function senhaDaLoja(segredo: CryptoKey, usuario: string): Promise<string> {
  const assinatura = await crypto.subtle.sign("HMAC", segredo, new TextEncoder().encode(`lucia:alumia:olm:loja:${usuario}`));
  return paraBase64(new Uint8Array(assinatura));
}

const confiavelPara = (eu: string) => async (outro: string) => {
  const conhecida = await lerConhecida(eu, outro);
  return conhecida ? tirarO(conhecida.identidade) : null;
};

function abrirAparelhoDaConta(guardado: Guardado): Promise<AparelhoOlm> {
  const aberto = aparelhosAbertos.get(guardado.usuario);
  if (aberto) return aberto;
  const nome = nomeDaLoja(guardado.usuario);
  anotarLojaAberta(nome);
  const novo = (async () =>
    abrirAparelho({ usuario: guardado.usuario, dispositivo: guardado.dispositivo, transporte, confiavel: confiavelPara(guardado.usuario), loja: { nome, senha: await senhaDaLoja(guardado.segredo, guardado.usuario) } }))();
  aparelhosAbertos.set(guardado.usuario, novo);
  novo.catch(() => aparelhosAbertos.delete(guardado.usuario));
  return novo;
}

/** Garante a minha senha de entrega e o par do meu envelope (cria e publica o resumo na primeira vez, ou quando `trocar`). */
async function garantirEntrega(usuario: string, trocar = false): Promise<Required<Pick<Guardado, "entrega" | "envelope">>> {
  const guardado = await lerConta(usuario);
  if (!guardado) throw erroDoChat("dm_apagado");
  if (guardado.entrega && guardado.envelope && !trocar) return { entrega: guardado.entrega, envelope: guardado.envelope };
  const entrega = await novaSenhaDeEntrega();
  const envelope = guardado.envelope && !trocar ? guardado.envelope : await novoParDoEnvelope();
  // Na troca, a senha antiga vale mais um pouco (mensagem no caminho), menos para quem foi bloqueado: aí só a nova.
  await chat.sel.publicarEntrega([entrega.resumo]);
  await guardarNaGaveta(CONTAS, { ...guardado, entrega, envelope } satisfies Guardado);
  return { entrega, envelope };
}

export async function esquecerNesteAparelho(usuario: string) {
  esquecerSessoes();
  await apagarDaGaveta(CONTAS, usuario);
  await apagarPrefixoDaGaveta(CONHECIDAS, `${usuario}:`);
  await apagarPrefixoDaGaveta(ORDEM, `${usuario}:`);
  await apagarConversaDoHistorico(usuario).catch(() => undefined);
  apagarLojasDaBiblioteca([nomeDaLoja(usuario)]);
}

/**
 * PÂNICO: apaga deste aparelho TUDO do chat, de todas as contas: o banco do chat, o histórico, as lojas da biblioteca, o que está
 * na memória. Termina em menos de meio segundo e nunca lança. É o que o "Sair rápido" da Alumia chama.
 */
export async function apagarTudoDoChat(): Promise<void> {
  if (PREVIA_DO_CHAT) {
    esquecerSessoes();
    return;
  }
  await apagarTudoNoAparelho();
}

export type EstadoDoAparelho = { estado: "pronto"; eu: Eu } | { estado: "sem_chave" } | { estado: "outro_aparelho"; tinhaChaveAqui: boolean };

export async function estadoDoAparelho(situacao: SituacaoDoChat): Promise<EstadoDoAparelho> {
  if (PREVIA_DO_CHAT) return { estado: "pronto", eu: EU_DA_PREVIA(situacao.eu, situacao.chave?.versao) };
  const guardado = await lerConta(situacao.eu);
  if (!situacao.chave) return { estado: "sem_chave" };
  const valido = guardado && "dispositivo" in guardado && ehOlm(situacao.chave) && situacao.chave.identidade === `o${guardado.ed25519}` && situacao.chave.publica === `o${guardado.curve25519}`;
  if (!guardado || !valido) return { estado: "outro_aparelho", tinhaChaveAqui: !!guardado };
  const quando = geracao;
  const olm = await abrirAparelhoDaConta(guardado);
  if (quando !== geracao || olm.identidade.ed25519 !== guardado.ed25519) throw erroDoChat("dm_apagado");
  await garantirEntrega(situacao.eu);
  return { estado: "pronto", eu: marcar({ usuario: situacao.eu, versao: situacao.chave.versao, identidade: { publica: `o${guardado.ed25519}` }, aparelho: { publica: `o${guardado.curve25519}` }, olm }) };
}

export async function ativarNesteAparelho(usuario: string): Promise<Eu> {
  if (PREVIA_DO_CHAT) return EU_DA_PREVIA(usuario);
  const quando = geracao;
  const antigo = aparelhosAbertos.get(usuario);
  aparelhosAbertos.delete(usuario);
  if (antigo) fecharAparelho(await antigo.catch(() => null));
  apagarLojasDaBiblioteca([nomeDaLoja(usuario)]);
  const segredo = await crypto.subtle.generateKey({ name: "HMAC", hash: "SHA-256", length: 256 }, false, ["sign"]);
  const dispositivo = novoNomeDeAparelho();
  const nome = nomeDaLoja(usuario);
  anotarLojaAberta(nome);
  const olm = await abrirAparelho({ usuario, dispositivo, transporte, confiavel: confiavelPara(usuario), loja: { nome, senha: await senhaDaLoja(segredo, usuario) } });
  if (quando !== geracao) {
    fecharAparelho(olm);
    throw erroDoChat("dm_apagado");
  }
  await guardarNaGaveta(CONTAS, { usuario, dispositivo, segredo, ed25519: olm.identidade.ed25519, curve25519: olm.identidade.curve25519 } satisfies Guardado, { criar: true });
  aparelhosAbertos.set(usuario, Promise.resolve(olm));
  await garantirEntrega(usuario, true);
  const situacao = await chat.situacao();
  if (!ehOlm(situacao.chave) || situacao.chave?.identidade !== `o${olm.identidade.ed25519}`) throw erroDoChat("dm_sem_chave");
  return marcar({ usuario, versao: situacao.chave.versao, identidade: { publica: `o${olm.identidade.ed25519}` }, aparelho: { publica: `o${olm.identidade.curve25519}` }, olm });
}

/** Uma conversa aberta neste aparelho e o que se sabe da outra pessoa. */
export interface Sessao {
  conversa: string;
  eu: Eu;
  outro: string;
  /** A versão da MINHA chave (a conta dos meus contadores). */
  versao: number;
  confiadas: Record<string, string>;
  chavesConfiadas: Record<string, string>;
  mudou: string | null;
  mudouChave: string | null;
  exigeComparar: boolean;
  chaveEstranha: boolean;
  /** A outra pessoa ainda não ativou o chat (na biblioteca) em aparelho nenhum. */
  semChaveDoOutro: boolean;
  /** A outra pessoa ainda não mandou o aperto de mão (a senha da caixa dela): dá para ler, ainda não para escrever. */
  aguardandoOutro: boolean;
  /**
   * O registro público das chaves não confirma a chave: "nao_confere" (o servidor mostra da outra pessoa uma chave que não é a
   * última do registro), "meu" (o registro diz que a MINHA chave é outra), "quebrado" (a corrente do registro não fecha). Nada
   * sai enquanto isso valer.
   */
  foraDoRegistro: "nao_confere" | "meu" | "quebrado" | null;
  /** O ponto do registro que este aparelho conferiu ("nº·começo do resumo"), para duas pessoas compararem. */
  carimbo: string | null;
  verificado: boolean;
}

/** Os recados Olm que chegaram fora do envelope (o aperto de mão de cada conversa): guarda o que veio de aparelho confiável. */
async function guardarRecados(eu: string, recados: RecadoAberto[]) {
  for (const r of recados) {
    if (r.tipo !== "alumia.entrega" || typeof r.conteudo.senha !== "string" || typeof r.conteudo.envelope !== "string") continue;
    const conhecida = await lerConhecida(eu, r.de);
    if (!conhecida?.publica || tirarO(conhecida.publica) !== r.curve25519) continue;
    await mudarConhecida(eu, r.de, (c) => ({ ...c, entrega: { senha: r.conteudo.senha as string, envelope: r.conteudo.envelope as string } }));
  }
}

const registro: TransporteDoRegistro = { ponta: () => chat.kt.ponta(), trecho: (desde) => chat.kt.trecho(desde) };
type VistaGuardada = VistaDoRegistro & { chave: string };

/** Traz o registro público até a ponta (conferindo a corrente) e guarda a vista neste aparelho. */
async function vistaDoRegistro(eu: string): Promise<VistaDoRegistro> {
  const chave = `${eu}:kt`;
  const guardada = (await lerDaGaveta<VistaGuardada>(ORDEM, chave)) ?? { ...INICIO, chave };
  const nova = await atualizarVista(guardada, registro);
  if (nova !== guardada) await guardarNaGaveta(ORDEM, { ...nova, chave } satisfies VistaGuardada);
  return nova;
}

/** Manda à outra pessoa, por Olm, a senha da minha caixa e a chave do meu envelope (se ainda não mandou esta senha). */
async function apertarAMao(eu: Eu, outro: string) {
  if (!eu.olm) return;
  const conhecida = await lerConhecida(eu.usuario, outro);
  const { entrega, envelope } = await garantirEntrega(eu.usuario);
  if (!conhecida || conhecida.mandei === entrega.resumo) return;
  const { dispositivo, cifrado } = await cifrarParaAparelho(eu.olm, outro, "alumia.entrega", { senha: entrega.senha, envelope: envelope.publica });
  await chat.olm.enviar("m.room.encrypted", { [idMatrix(outro)]: { [dispositivo]: cifrado } });
  await mudarConhecida(eu.usuario, outro, (c) => ({ ...c, mandei: entrega.resumo }));
}

/** Abre a conversa: confere a identidade e a chave do aparelho da outra pessoa e faz o aperto de mão. */
export async function abrirSessao(eu: Eu, conversa: string, outro: string, anterior?: Sessao | null): Promise<Sessao> {
  if (PREVIA_DO_CHAT) {
    return {
      conversa, eu, outro, versao: 1, confiadas: { [eu.usuario]: eu.identidade.publica, [outro]: `previa-identidade-${outro}` },
      chavesConfiadas: {}, mudou: null, mudouChave: null, exigeComparar: false, chaveEstranha: false, semChaveDoOutro: false, aguardandoOutro: false, foraDoRegistro: null, carimbo: null, verificado: anterior?.verificado ?? false,
    };
  }
  if (!vale(eu) || !eu.olm) throw erroDoChat("dm_apagado");
  const dados = await chat.chaves(conversa);
  const doOutro = dados.participantes.find((p) => p.usuario === outro && ehOlm(p)) ?? null;
  const conhecida = await lerConhecida(eu.usuario, outro);
  const sessao: Sessao = {
    conversa,
    eu,
    outro,
    versao: eu.versao,
    confiadas: { [eu.usuario]: eu.identidade.publica },
    chavesConfiadas: { [eu.usuario]: eu.aparelho.publica },
    mudou: null,
    mudouChave: null,
    exigeComparar: false,
    chaveEstranha: false,
    semChaveDoOutro: !doOutro,
    aguardandoOutro: true,
    foraDoRegistro: null,
    carimbo: null,
    verificado: !!conhecida?.verificado,
  };
  // O registro público: a minha chave e a da outra pessoa têm de ser as últimas de lá.
  if (doOutro) {
    try {
      const vista = await vistaDoRegistro(eu.usuario);
      sessao.carimbo = carimbo(vista);
      if ((await conferir(vista, eu.usuario, eu.identidade.publica, eu.versao)) !== "confere") sessao.foraDoRegistro = "meu";
      else if ((await conferir(vista, outro, doOutro.identidade, doOutro.versao)) !== "confere") sessao.foraDoRegistro = "nao_confere";
    } catch (e) {
      if (codigoDe(e) === "kt_quebrado" || String((e as Error)?.message) === "kt_quebrado") sessao.foraDoRegistro = "quebrado";
      else throw e;
    }
  }
  if (doOutro) {
    const comparacao = compararIdentidade(conhecida?.identidade, doOutro.identidade);
    if (comparacao === "nova") {
      await guardarConhecida({ chave: `${eu.usuario}:${outro}`, identidade: doOutro.identidade, publica: doOutro.publica, verificado: false });
      sessao.chavesConfiadas[outro] = doOutro.publica;
    } else if (comparacao === "mudou") {
      sessao.mudou = doOutro.identidade;
      sessao.mudouChave = doOutro.publica;
      sessao.exigeComparar = !!conhecida?.verificado;
      sessao.verificado = false;
      if (conhecida?.publica) sessao.chavesConfiadas[outro] = conhecida.publica;
    } else if (conhecida?.publica && conhecida.publica !== doOutro.publica) {
      sessao.mudou = doOutro.identidade;
      sessao.mudouChave = doOutro.publica;
      sessao.chaveEstranha = true;
      sessao.verificado = false;
      sessao.chavesConfiadas[outro] = conhecida.publica;
    } else {
      if (conhecida && !conhecida.publica) await guardarConhecida({ ...conhecida, publica: doOutro.publica });
      sessao.chavesConfiadas[outro] = doOutro.publica;
    }
    sessao.confiadas[outro] = conhecida?.identidade ?? doOutro.identidade;
  }
  await guardarRecados(eu.usuario, await sincronizar(eu.olm, [outro]));
  if (doOutro && !sessao.mudou && !sessao.foraDoRegistro) await apertarAMao(eu, outro);
  sessao.aguardandoOutro = !(await lerConhecida(eu.usuario, outro))?.entrega;
  if (!vale(eu)) throw erroDoChat("dm_apagado");
  sessoesAbertas.set(conversa, sessao);
  return sessao;
}

export async function confiarNaIdentidade(sessao: Sessao, identidade: string, verificado = false) {
  if (PREVIA_DO_CHAT) return;
  if (!vale(sessao.eu)) throw erroDoChat("dm_apagado");
  if (sessao.chaveEstranha) throw erroDoChat("dm_chave_estranha");
  const esperada = sessao.mudou ?? sessao.confiadas[sessao.outro];
  if (!esperada || identidade !== esperada) throw erroDoChat("dm_identidade_mudou");
  if (sessao.exigeComparar && !verificado) throw erroDoChat("dm_exige_comparar");
  const publica = sessao.mudou ? sessao.mudouChave : sessao.chavesConfiadas[sessao.outro];
  // Identidade nova: o aperto de mão antigo (do aparelho antigo da pessoa) não vale mais.
  const antes = await lerConhecida(sessao.eu.usuario, sessao.outro);
  const mesmaPessoa = antes && antes.identidade === identidade;
  await guardarConhecida({ chave: `${sessao.eu.usuario}:${sessao.outro}`, identidade, ...(publica ? { publica } : {}), verificado, ...(mesmaPessoa && antes?.entrega ? { entrega: antes.entrega, mandei: antes.mandei } : {}) });
  if (sessao.eu.olm) await guardarRecados(sessao.eu.usuario, await sincronizar(sessao.eu.olm, [sessao.outro]));
}

export interface MensagemAberta {
  /** O id NESTE aparelho (o banco não tem mais a mensagem). */
  id: string;
  autor: string;
  versao: number;
  criado_em: string;
  expira_em: string;
  texto: string | null;
  contador: number | null;
  visto: Visto | null;
  repetida: boolean;
  duvidosa: boolean;
  /** "Ver uma vez": a tela mostra e apaga. */
  umaVez: boolean;
}

let filaDaOrdem: Promise<unknown> = Promise.resolve();
function naFilaDaOrdem<T>(fazer: () => Promise<T>): Promise<T> {
  const vez = filaDaOrdem.then(fazer, fazer);
  filaDaOrdem = vez.catch(() => undefined);
  return vez;
}

/** Confere repetição contra o que este aparelho já viu, e guarda o que é novo. Marca as repetidas e as duvidosas em `abertas`. */
async function conferirOrdem(sessao: Sessao, abertas: MensagemAberta[], internos: Map<string, string>) {
  const eu = sessao.eu.usuario;
  const agora = Date.now();
  const registros = new Map<string, RegistroDeOrdem>();
  const pisos = new Map<string, number>();
  const mudados = new Set<string>();
  let marca: MarcaDeVersoes | null = null;
  for (const guardado of await lerPrefixoDaGaveta<RegistroDeOrdem | PisoDeOrdem | MarcaDeVersoes>(ORDEM, prefixoDaOrdem(eu, sessao.conversa))) {
    if ("topo" in guardado) marca = guardado;
    else if ("versao" in guardado) pisos.set(guardado.chave, guardado.versao);
    else registros.set(guardado.chave, guardado);
  }
  for (const [chave, registro] of [...registros]) {
    const versao = versaoDaChave(chave);
    if (versao === null || !podeFechar(registro, versao, Number.MAX_SAFE_INTEGER, marca?.lida, agora)) continue;
    const doPiso = `${chave.slice(0, chave.lastIndexOf(":"))}:piso`;
    if (versao > (pisos.get(doPiso) ?? 0)) {
      pisos.set(doPiso, versao);
      await guardarNaGaveta(ORDEM, { chave: doPiso, versao } satisfies PisoDeOrdem);
    }
    registros.delete(chave);
    await apagarDaGaveta(ORDEM, chave);
  }
  for (const m of [...abertas].sort((a, b) => a.criado_em.localeCompare(b.criado_em))) {
    const interno = internos.get(m.id);
    if (!interno || m.contador === null) continue;
    const chave = chaveDaOrdem(eu, sessao.conversa, m.autor, m.versao);
    const antes = registros.get(chave) ?? null;
    const piso = pisos.get(chaveDoPiso(eu, sessao.conversa, m.autor)) ?? 0;
    const r = julgar(antes, piso, chave, { servidor: interno, autor: m.autor, versao: m.versao, id: interno, contador: m.contador }, agora);
    if (r.juizo === "repetida") m.repetida = true;
    if (r.juizo === "fechada" || r.juizo === "duvidosa") m.duvidosa = true;
    if (r.registro && r.registro !== antes) {
      registros.set(chave, r.registro);
      mudados.add(chave);
    }
  }
  for (const chave of mudados) {
    const novo = registros.get(chave) as RegistroDeOrdem;
    await mudarNaGaveta<RegistroDeOrdem>(ORDEM, chave, (guardado) => juntarRegistros(guardado, novo));
  }
}

/** Um envelope por vez: dois leitores ao mesmo tempo entregariam a mesma mensagem Olm duas vezes à biblioteca. */
let filaDaCaixa: Promise<unknown> = Promise.resolve();

/**
 * Busca a minha caixa selada, abre cada envelope, confere que o aparelho que cifrou é o aparelho confiável de quem o envelope
 * diz ter mandado, e guarda no histórico deste aparelho. Depois avisa o banco, que apaga. Envelope de quem este aparelho ainda
 * não conhece fica na caixa até a conversa ser aberta (e a identidade, guardada).
 */
export function receberMensagens(eu: Eu): Promise<number> {
  const vez = filaDaCaixa.then(() => receberAgora(eu), () => receberAgora(eu));
  filaDaCaixa = vez.catch(() => undefined);
  return vez;
}
async function receberAgora(eu: Eu): Promise<number> {
  if (PREVIA_DO_CHAT || !eu.olm || !vale(eu)) return 0;
  const guardado = await lerConta(eu.usuario);
  if (!guardado?.envelope) return 0;
  // Histórico travado: não abre nada da caixa (a mensagem Olm aberta e não guardada se perderia).
  await exigirHistoricoAberto(eu.usuario);
  await guardarRecados(eu.usuario, await sincronizar(eu.olm));
  const caixa = await chat.sel.receber();
  let ate = 0;
  let novas = 0;
  for (const item of caixa) {
    const dentro = await abrirEnvelope(guardado.envelope.privada, item.envelope);
    if (dentro) {
      const conhecida = await lerConhecida(eu.usuario, dentro.de);
      // Ainda não sei quem é esta pessoa: deixa na caixa (para aqui, para não pular a ordem do Olm).
      if (!conhecida?.publica) break;
      const [recado] = await entregarABiblioteca(eu.olm, [{ sender: idMatrix(dentro.de), type: "m.room.encrypted", content: dentro.cifrado }]);
      if (recado && recado.de === dentro.de && recado.curve25519 === tirarO(conhecida.publica)) novas += await guardarRecebida(eu, recado);
    }
    ate = item.id;
  }
  if (ate > 0) await chat.sel.confirmar(ate);
  return novas;
}

async function guardarRecebida(eu: Eu, recado: RecadoAberto): Promise<number> {
  const c = recado.conteudo;
  if (recado.tipo === "alumia.apagar" && typeof c.conversa === "string" && typeof c.idInterno === "string") {
    const daConversa = await mensagensDoHistorico(eu.usuario, c.conversa, null, 10_000);
    await apagarDoHistorico(daConversa.filter((m) => m.autor === recado.de && m.idInterno === c.idInterno).map((m) => m.id));
    return 0;
  }
  if (recado.tipo !== "alumia.dm" || typeof c.conversa !== "string" || typeof c.b !== "string") return 0;
  const bytes = Uint8Array.from(atob(c.b), (x) => x.charCodeAt(0));
  const aberta = lerBloco(bytes);
  bytes.fill(0);
  if (!aberta) return 0;
  const agora = Date.now();
  const quando = typeof c.quando === "string" && !Number.isNaN(Date.parse(c.quando)) ? new Date(Math.min(Date.parse(c.quando), agora)).toISOString() : new Date(agora).toISOString();
  const dias = PRAZOS.includes(c.prazo as Prazo) ? (c.prazo as number) : 7;
  const minutos = typeof c.minutos === "number" && c.minutos >= 1 && c.minutos <= 1440 ? c.minutos : null;
  const expira = new Date(Date.parse(quando) + (minutos ? minutos * 60_000 : dias * 86_400_000)).toISOString();
  await guardarNoHistorico({
    id: crypto.randomUUID(), conta: eu.usuario, conversa: c.conversa, autor: recado.de, quando, expira, texto: aberta.texto, idInterno: aberta.id, contador: aberta.contador,
    visto: aberta.visto, versao: typeof c.versao === "number" ? c.versao : 1, umaVez: c.umaVez === true,
  });
  return 1;
}

/** As mensagens da conversa, do histórico deste aparelho (depois de buscar a caixa). `antes`: para carregar as mais antigas. */
export async function mensagensDaConversa(sessao: Sessao, antes: string | null = null): Promise<MensagemAberta[]> {
  if (PREVIA_DO_CHAT) {
    const lista = await chat.mensagens(sessao.conversa, antes);
    return lista.map((m) => ({ id: m.id, autor: m.autor, versao: m.versao, criado_em: m.criado_em, expira_em: m.expira_em, texto: m.corpo, contador: null, visto: null, repetida: false, duvidosa: false, umaVez: false }));
  }
  if (!vale(sessao.eu)) throw erroDoChat("dm_apagado");
  if (!antes) await receberMensagens(sessao.eu);
  const guardadas = await mensagensDoHistorico(sessao.eu.usuario, sessao.conversa, antes);
  const internos = new Map<string, string>();
  const abertas = guardadas.map((m: MensagemGuardada): MensagemAberta => {
    internos.set(m.id, m.idInterno);
    return { id: m.id, autor: m.autor, versao: m.versao, criado_em: m.quando, expira_em: m.expira, texto: m.texto, contador: m.contador, visto: m.visto, repetida: false, duvidosa: false, umaVez: m.umaVez };
  });
  await naFilaDaOrdem(() => conferirOrdem(sessao, abertas, internos));
  if (!vale(sessao.eu)) throw erroDoChat("dm_apagado");
  return abertas.map((m) => (m.repetida ? { ...m, texto: null } : m));
}

export function depoisDeBuraco(mensagens: readonly MensagemAberta[]): Set<string> {
  return buracos(mensagens.filter((m) => m.contador !== null && !m.repetida).map((m) => ({ servidor: m.id, autor: m.autor, versao: m.versao, contador: m.contador as number })));
}

export function ordemDaConversa(mensagens: readonly MensagemAberta[], eu: string): OrdemDaTela<MensagemAberta> {
  const semConferir = new Set(mensagens.filter((m) => m.repetida || m.texto === null).map((m) => m.id));
  const r = ordemDaTela(mensagens.map((m) => (semConferir.has(m.id) ? { ...m, contador: null } : m)), eu);
  const porId = new Map(mensagens.map((m) => [m.id, m]));
  return { ...r, ordenadas: r.ordenadas.map((m) => porId.get(m.id) as MensagemAberta) };
}

async function vistoDaOutra(sessao: Sessao): Promise<Visto> {
  let visto: Visto = NADA_VISTO;
  const prefixo = `${prefixoDaOrdem(sessao.eu.usuario, sessao.conversa)}${sessao.outro}:`;
  for (const guardado of await lerPrefixoDaGaveta<RegistroDeOrdem | PisoDeOrdem>(ORDEM, prefixo)) {
    const versao = versaoDaChave(guardado.chave);
    if (versao === null || !("maior" in guardado) || guardado.maior < 1) continue;
    if (versao > visto.versao) visto = { versao, contador: guardado.maior };
  }
  return visto;
}

/** Fecha um conteúdo por Olm para o aparelho da outra pessoa, sela e deixa na caixa dela (sem dizer ao banco quem mandou). */
async function mandarSelado(sessao: Sessao, tipo: string, conteudo: Record<string, unknown>) {
  const olm = sessao.eu.olm;
  const conhecida = await lerConhecida(sessao.eu.usuario, sessao.outro);
  if (!olm || !conhecida?.entrega) throw erroDoChat("dm_aguardando");
  const { cifrado } = await cifrarParaAparelho(olm, sessao.outro, tipo, conteudo);
  const envelope = await selar(conhecida.entrega.envelope, { de: sessao.eu.usuario, cifrado });
  await chat.sel.depositar(sessao.outro, conhecida.entrega.senha, envelope);
}

/** Opções de uma mensagem: prazo em dias (1, 7 ou 30), ou temporária em minutos (1 a 1440), e "ver uma vez". */
export interface OpcoesDaMensagem {
  prazoDias?: Prazo;
  minutos?: number | null;
  umaVez?: boolean;
}

/** Cifra no aparelho (Olm), sela e envia. Com a identidade ou a chave da outra pessoa mudada, nada sai. */
export async function enviarTexto(sessao: Sessao, texto: string, opcoes: OpcoesDaMensagem = {}): Promise<Sessao> {
  if (PREVIA_DO_CHAT) {
    await chat.enviar(sessao.conversa, 1, texto);
    return sessao;
  }
  if (!textoCabe(texto)) throw erroDoChat("texto_grande");
  if (!vale(sessao.eu)) throw erroDoChat("dm_apagado");
  if (sessao.mudou) throw erroDoChat(sessao.chaveEstranha ? "dm_chave_estranha" : sessao.exigeComparar ? "dm_exige_comparar" : "dm_sem_chave");
  if (sessao.semChaveDoOutro) throw erroDoChat("dm_sem_chave");
  if (sessao.foraDoRegistro) throw erroDoChat("dm_fora_do_registro");
  const prazo = opcoes.prazoDias && PRAZOS.includes(opcoes.prazoDias) ? opcoes.prazoDias : 7;
  const minutos = opcoes.minutos && opcoes.minutos >= 1 && opcoes.minutos <= 1440 ? Math.round(opcoes.minutos) : null;
  await naFilaDaOrdem(async () => {
    const daOrdem = chaveDaOrdem(sessao.eu.usuario, sessao.conversa, sessao.eu.usuario, sessao.versao);
    const reservado = await mudarNaGaveta<RegistroDeOrdem>(ORDEM, daOrdem, (registro) => comContadorUsado(registro, daOrdem, proximoContador(registro)));
    if (!reservado || !vale(sessao.eu)) throw erroDoChat("dm_apagado");
    const contador = reservado.maior;
    const visto = await vistoDaOutra(sessao);
    const bloco = montarBloco(texto.trim(), contador, visto);
    const aberta = lerBloco(bloco);
    let b = "";
    for (const x of bloco) b += String.fromCharCode(x);
    const quando = new Date().toISOString();
    try {
      await mandarSelado(sessao, "alumia.dm", { conversa: sessao.conversa, versao: sessao.versao, b: btoa(b), quando, prazo, ...(minutos ? { minutos } : {}), umaVez: !!opcoes.umaVez });
    } catch (erro) {
      if (RECUSA_CERTA.test(codigoDe(erro))) {
        await mudarNaGaveta<RegistroDeOrdem>(ORDEM, daOrdem, (registro) => (registro && registro.maior === contador ? { ...registro, maior: contador - 1 } : null));
      }
      throw erro;
    } finally {
      bloco.fill(0);
      b = "";
    }
    // A minha cópia: só neste aparelho. "Ver uma vez" não fica nem para quem mandou.
    if (aberta && !opcoes.umaVez) {
      const expira = new Date(Date.parse(quando) + (minutos ? minutos * 60_000 : prazo * 86_400_000)).toISOString();
      await guardarNoHistorico({ id: crypto.randomUUID(), conta: sessao.eu.usuario, conversa: sessao.conversa, autor: sessao.eu.usuario, quando, expira, texto: aberta.texto, idInterno: aberta.id, contador, visto, versao: sessao.versao, umaVez: false });
    }
  });
  return sessao;
}

/** Apaga uma mensagem minha: daqui, e manda à outra pessoa (selado) o pedido de apagar a cópia dela. */
export async function apagarMensagem(sessao: Sessao, id: string): Promise<void> {
  if (PREVIA_DO_CHAT) {
    await chat.apagarMensagem(id);
    return;
  }
  const minhas = await mensagensDoHistorico(sessao.eu.usuario, sessao.conversa, null, 10_000);
  const m = minhas.find((x) => x.id === id);
  if (!m) return;
  if (m.autor === sessao.eu.usuario) await mandarSelado(sessao, "alumia.apagar", { conversa: sessao.conversa, idInterno: m.idInterno }).catch(() => undefined);
  await apagarDoHistorico([id]);
}

/** Apaga a conversa deste aparelho (o histórico dela) e da lista no servidor. */
export async function apagarConversa(sessao: Sessao | null, eu: Eu, conversa: string): Promise<void> {
  if (!PREVIA_DO_CHAT) await apagarConversaDoHistorico(eu.usuario, conversa).catch(() => undefined);
  void sessao;
  await chat.apagar(conversa);
}

/**
 * Troca a senha de entrega da minha caixa (ao bloquear alguém): a pessoa bloqueada não deposita mais nada. As outras conversas
 * recebem a senha nova no próximo aperto de mão (ao abrir a conversa).
 */
export async function trocarSenhaDeEntrega(eu: Eu): Promise<void> {
  if (PREVIA_DO_CHAT || !vale(eu)) return;
  await garantirEntrega(eu.usuario, true);
}

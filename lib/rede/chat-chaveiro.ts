// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O chaveiro do chat privado da Alumia, neste aparelho. A cifra é a da biblioteca do Matrix (lib/rede/chat/olm.ts: Olm entre os
// aparelhos, Megolm nas mensagens); aqui fica o que é do chat: a identidade que este aparelho já conhece de cada pessoa
// ("confiar na primeira vez, avisar quando mudar"), o que já chegou de cada autor (repetição, buraco e ordem trocada), a maior
// versão da conversa já vista e o "apagar tudo". O que vai para o disco mora em lib/rede/chat/gaveta.ts (IndexedDB próprio) e,
// as sessões da biblioteca, na loja dela (outro IndexedDB, cifrado com uma senha que só uma chave NÃO exportável deste aparelho
// calcula). As chamadas ao banco ficam em lib/rede/cliente-chat.ts. Documento: docs/rede/CHAT-PRIVADO.md.
//
// O servidor não é de confiança para nada além de entregar: o aparelho não aceita versão menor que uma já vista, troca de versão
// pela própria conta dos dias, não reabre mensagem repetida e não entrega chave a aparelho cuja identidade mudou sem a pessoa
// conferir (a biblioteca só conhece, de cada pessoa, o aparelho com a identidade confiada).
import { paraBase64 } from "./../sigilo";
import { textoCabe, precisaDeVersaoNova, ROTACAO_DIAS, compararIdentidade, type Visto } from "./chat-privado";
import { lerBloco, montarBloco, NADA_VISTO } from "./chat/c3";
import {
  anotarLojaAberta, aoApagarTudoDoChat, apagarDaGaveta, apagarLojasDaBiblioteca, apagarPrefixoDaGaveta, apagarTudoDoChat as apagarTudoNoAparelho, CONHECIDAS, CONTAS, guardarNaGaveta, lerDaGaveta,
  lerPrefixoDaGaveta, mudarNaGaveta, ORDEM, PREFIXO_DA_LOJA_OLM,
} from "./chat/gaveta";
import { abrirAparelho, abrirBloco, type AparelhoOlm, cifrarBloco, eM1, fecharAparelho, novoNomeDeAparelho, sincronizar, type TransporteOlm } from "./chat/olm";
import {
  anotarVersao, buracos, chaveDaOrdem, chaveDasVersoes, chaveDoPiso, comContadorUsado, julgar, juntarRegistros, type MarcaDeVersoes, ordemDaTela, type OrdemDaTela, type PisoDeOrdem,
  podeFechar, prefixoDaOrdem, proximoContador, type RegistroDeOrdem, versaoDaChave, versaoVelhaAqui,
} from "./chat/ordem";
import { chat, PREVIA_DO_CHAT, type MensagemCifrada, type SituacaoDoChat } from "./cliente-chat";

/** Eu, neste aparelho: a conta, a versão da minha chave no servidor, e o aparelho da biblioteca (fora da prévia). */
export interface Eu {
  usuario: string;
  versao: number;
  /** "o" + a chave ed25519 do aparelho: é ela que entra no código de segurança. */
  identidade: { publica: string };
  /** "o" + a chave curve25519 do aparelho. */
  aparelho: { publica: string };
  olm: AparelhoOlm | null;
}

/**
 * Na prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim), o aparelho já vem "ativado" e as mensagens do dublê (lib/rede/chat-exemplos.ts) vão
 * e voltam em texto: nada sai da aba, então não há o que cifrar, e as telas do chat ficam testáveis sem banco.
 */
const EU_DA_PREVIA = (usuario: string, versao = 1): Eu => ({ usuario, versao, aparelho: { publica: "previa-aparelho-eu" }, identidade: { publica: "previa-identidade-eu" }, olm: null });

/** O que este aparelho guarda da conta (na gaveta): o nome do aparelho na biblioteca, as chaves públicas e o segredo da loja. */
interface Guardado {
  usuario: string;
  dispositivo: string;
  ed25519: string;
  curve25519: string;
  /** Chave HMAC NÃO exportável: a senha da loja da biblioteca é calculada com ela, e só neste aparelho. */
  segredo: CryptoKey;
}

interface Conhecida {
  /** "<eu>:<outra pessoa>". */
  chave: string;
  identidade: string;
  /** A chave do aparelho da pessoa ("o" + curve25519). Nasce junto com a identidade: chave nova com a identidade de sempre é alarme. */
  publica?: string;
  verificado: boolean;
}

const lerConta = (usuario: string) => lerDaGaveta<Guardado>(CONTAS, usuario);
const lerConhecida = (eu: string, outro: string) => lerDaGaveta<Conhecida>(CONHECIDAS, `${eu}:${outro}`);
const guardarConhecida = (dados: Conhecida) => guardarNaGaveta(CONHECIDAS, dados);

const erroDoChat = (codigo: string) => Object.assign(new Error(codigo), { code: codigo });
const codigoDe = (erro: unknown) => (typeof erro === "object" && erro !== null && "code" in erro ? String((erro as { code: unknown }).code ?? "") : "");

/** Os erros em que o servidor com certeza NÃO guardou a mensagem (o contador dela pode ser usado de novo). */
const RECUSA_CERTA = /^(versao_desatualizada|dm_fechada|dm_sem_chave|muitos_pedidos|consentimento|nao_encontrado|sem_servico|sem_permissao|invalido:)/;

const nomeDaLoja = (usuario: string) => `${PREFIXO_DA_LOJA_OLM}${usuario}`;
const ehOlm = (chave: { certificado?: string } | null | undefined) => chave?.certificado === "olm1";
const tirarO = (s: string) => (s.startsWith("o") ? s.slice(1) : s);

/** As conversas abertas nesta página e os aparelhos da biblioteca abertos (um por conta). */
const sessoesAbertas = new Map<string, Sessao>();
const aparelhosAbertos = new Map<string, Promise<AparelhoOlm>>();
/**
 * A "geração" do chaveiro: sobe a cada apagar. Um `Eu` criado antes do último apagar não vale mais, mesmo que uma tela ainda o
 * segure: nada abre, nada envia, nada é gravado com ele.
 */
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
}
// O "Sair rápido" (components/rede/chat/encaixe.tsx), nesta aba ou em outra, fecha a biblioteca e esquece tudo da memória.
aoApagarTudoDoChat(esquecerSessoes);

/** O banco, como a biblioteca o vê. */
const transporte: TransporteOlm = {
  publicar: (p) => chat.olm.publicar(p),
  consultar: (u) => chat.olm.consultar(u),
  reivindicar: (p) => chat.olm.reivindicar(p),
  enviar: (t, m) => chat.olm.enviar(t, m),
  receber: () => chat.olm.receber(),
  confirmar: (ate) => chat.olm.confirmar(ate),
};

/** A senha da loja da biblioteca: HMAC da chave não exportável deste aparelho. Ninguém a guarda; ela é calculada a cada abertura. */
async function senhaDaLoja(segredo: CryptoKey, usuario: string): Promise<string> {
  const assinatura = await crypto.subtle.sign("HMAC", segredo, new TextEncoder().encode(`lucia:alumia:olm:loja:${usuario}`));
  return paraBase64(new Uint8Array(assinatura));
}

/** Em quem o aparelho da biblioteca confia: a identidade (ed25519) que esta conta já guardou da pessoa. */
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

/** Apaga deste aparelho tudo o que o chat guardou da conta (depois de "apagar tudo do chat"). */
export async function esquecerNesteAparelho(usuario: string) {
  esquecerSessoes();
  await apagarDaGaveta(CONTAS, usuario);
  await apagarPrefixoDaGaveta(CONHECIDAS, `${usuario}:`);
  await apagarPrefixoDaGaveta(ORDEM, `${usuario}:`);
  apagarLojasDaBiblioteca([nomeDaLoja(usuario)]);
}

/**
 * PÂNICO: apaga deste aparelho TUDO do chat, de todas as contas: o banco IndexedDB do chat, as lojas da biblioteca, o que está na
 * memória e o que as telas abertas registraram (rascunho, mensagens abertas), nesta aba e nas outras. Não há fila de envio.
 * Termina em menos de meio segundo e nunca lança. É o que o "Sair rápido" da Alumia chama. Depois disso, o chat precisa ser
 * ativado de novo neste aparelho, e as verificações feitas com cada pessoa se perdem (é preciso comparar o código de novo).
 */
export async function apagarTudoDoChat(): Promise<void> {
  if (PREVIA_DO_CHAT) {
    esquecerSessoes();
    return;
  }
  await apagarTudoNoAparelho();
}

/** "outro_aparelho": o servidor mostra uma chave que não é a deste aparelho. `tinhaChaveAqui`: este aparelho TINHA a chave do chat. */
export type EstadoDoAparelho = { estado: "pronto"; eu: Eu } | { estado: "sem_chave" } | { estado: "outro_aparelho"; tinhaChaveAqui: boolean };

/** Este aparelho é o do chat desta conta? Se for, abre a biblioteca. */
export async function estadoDoAparelho(situacao: SituacaoDoChat): Promise<EstadoDoAparelho> {
  if (PREVIA_DO_CHAT) return { estado: "pronto", eu: EU_DA_PREVIA(situacao.eu, situacao.chave?.versao) };
  const guardado = await lerConta(situacao.eu);
  if (!situacao.chave) return { estado: "sem_chave" };
  const valido = guardado && "dispositivo" in guardado && ehOlm(situacao.chave) && situacao.chave.identidade === `o${guardado.ed25519}` && situacao.chave.publica === `o${guardado.curve25519}`;
  if (!guardado || !valido) return { estado: "outro_aparelho", tinhaChaveAqui: !!guardado };
  const quando = geracao;
  const olm = await abrirAparelhoDaConta(guardado);
  if (quando !== geracao || olm.identidade.ed25519 !== guardado.ed25519) throw erroDoChat("dm_apagado");
  return { estado: "pronto", eu: marcar({ usuario: situacao.eu, versao: situacao.chave.versao, identidade: { publica: `o${guardado.ed25519}` }, aparelho: { publica: `o${guardado.curve25519}` }, olm }) };
}

/** Ativa o chat neste aparelho (a biblioteca cria as chaves e publica só a parte pública). Num aparelho novo, o antigo deixa de abrir. */
export async function ativarNesteAparelho(usuario: string): Promise<Eu> {
  if (PREVIA_DO_CHAT) return EU_DA_PREVIA(usuario);
  const quando = geracao;
  // Uma loja antiga desta conta neste aparelho (ativação anterior) sai antes: o aparelho novo começa limpo.
  const antigo = aparelhosAbertos.get(usuario);
  aparelhosAbertos.delete(usuario);
  if (antigo) fecharAparelho(await antigo.catch(() => null));
  apagarLojasDaBiblioteca([nomeDaLoja(usuario)]);
  const segredo = await crypto.subtle.generateKey({ name: "HMAC", hash: "SHA-256", length: 256 }, false, ["sign"]);
  const dispositivo = novoNomeDeAparelho();
  const guardado: Omit<Guardado, "ed25519" | "curve25519"> = { usuario, dispositivo, segredo };
  const nome = nomeDaLoja(usuario);
  anotarLojaAberta(nome);
  const olm = await abrirAparelho({ usuario, dispositivo, transporte, confiavel: confiavelPara(usuario), loja: { nome, senha: await senhaDaLoja(segredo, usuario) } });
  // O "apagar tudo" passou enquanto a chave era publicada: nada é gravado (a pessoa ativa de novo quando voltar).
  if (quando !== geracao) {
    fecharAparelho(olm);
    throw erroDoChat("dm_apagado");
  }
  // Só a ativação cria o banco do chat neste aparelho (e solta a trava do "apagar tudo").
  await guardarNaGaveta(CONTAS, { ...guardado, ed25519: olm.identidade.ed25519, curve25519: olm.identidade.curve25519 } satisfies Guardado, { criar: true });
  aparelhosAbertos.set(usuario, Promise.resolve(olm));
  const situacao = await chat.situacao();
  if (!ehOlm(situacao.chave) || situacao.chave?.identidade !== `o${olm.identidade.ed25519}`) throw erroDoChat("dm_sem_chave");
  return marcar({ usuario, versao: situacao.chave.versao, identidade: { publica: `o${olm.identidade.ed25519}` }, aparelho: { publica: `o${olm.identidade.curve25519}` }, olm });
}

/** Uma conversa aberta neste aparelho e o que se sabe da outra pessoa. */
export interface Sessao {
  conversa: string;
  eu: Eu;
  outro: string;
  versao: number;
  /** Quando a versão atual da conversa foi criada, pela palavra do servidor. */
  versaoEm: string | null;
  /** Quando ESTE aparelho viu a versão atual pela primeira vez (hora do aparelho): a troca aos 7 dias não depende do servidor. */
  vistaEm: number;
  /** As identidades em que este aparelho confia (eu e a outra pessoa), com o "o" na frente. */
  confiadas: Record<string, string>;
  /** As chaves de aparelho que este aparelho conhece (a minha e, quando há, a da outra pessoa). */
  chavesConfiadas: Record<string, string>;
  /** A identidade (ou a chave do aparelho) da outra pessoa mudou desde a última vez: nada é entregue a ela até confirmar. */
  mudou: string | null;
  /** A chave de aparelho que veio junto com a identidade nova. */
  mudouChave: string | null;
  /** A identidade que mudou estava VERIFICADA: um clique não basta, é preciso comparar o código de novo. */
  exigeComparar: boolean;
  /** A chave do aparelho mudou e a identidade NÃO: no uso normal isso não acontece. Não há como aceitar. */
  chaveEstranha: boolean;
  /** A outra pessoa ainda não ativou o chat (na biblioteca) em aparelho nenhum. */
  semChaveDoOutro: boolean;
  /** Verificado neste aparelho. Cai sozinho quando a identidade muda. */
  verificado: boolean;
}

/**
 * Anota no aparelho a versão que o servidor diz ser a atual e devolve quando este aparelho a viu pela primeira vez. Versão
 * MENOR que uma já vista é recusada ("dm_versao_voltou").
 */
async function anotarAVersao(eu: string, conversa: string, versao: number): Promise<number> {
  const chave = chaveDasVersoes(eu, conversa);
  let voltou = false;
  const agora = Date.now();
  const marca = await mudarNaGaveta<MarcaDeVersoes>(ORDEM, chave, (guardada) => {
    const r = anotarVersao(guardada, chave, versao, agora);
    voltou = r.voltou;
    return r.marca === guardada ? null : r.marca;
  });
  if (voltou) throw erroDoChat("dm_versao_voltou");
  return (marca ?? (await lerDaGaveta<MarcaDeVersoes>(ORDEM, chave)))?.desde ?? agora;
}

/**
 * Abre a conversa: confere a identidade e a chave do aparelho da outra pessoa, traz os recados da biblioteca (as chaves das
 * sessões) e, se precisar, faz uma versão nova. `forcarSeAinda`: o banco recusou o envio nesta versão por velha; se ela ainda for
 * a atual, faz a nova sem olhar o relógio do aparelho.
 */
export async function abrirSessao(eu: Eu, conversa: string, outro: string, anterior?: Sessao | null, opcoes: { forcarSeAinda?: number } = {}): Promise<Sessao> {
  if (PREVIA_DO_CHAT) {
    return {
      conversa, eu, outro, versao: 1, versaoEm: null, vistaEm: 0, confiadas: { [eu.usuario]: eu.identidade.publica, [outro]: `previa-identidade-${outro}` },
      chavesConfiadas: {}, mudou: null, mudouChave: null, exigeComparar: false, chaveEstranha: false, semChaveDoOutro: false, verificado: anterior?.verificado ?? false,
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
    versao: dados.versao,
    versaoEm: dados.versao_em,
    vistaEm: Date.now(),
    confiadas: { [eu.usuario]: eu.identidade.publica },
    chavesConfiadas: { [eu.usuario]: eu.aparelho.publica },
    mudou: null,
    mudouChave: null,
    exigeComparar: false,
    chaveEstranha: false,
    semChaveDoOutro: !doOutro,
    verificado: !!conhecida?.verificado,
  };
  if (doOutro) {
    const comparacao = compararIdentidade(conhecida?.identidade, doOutro.identidade);
    if (comparacao === "nova") {
      await guardarConhecida({ chave: `${eu.usuario}:${outro}`, identidade: doOutro.identidade, publica: doOutro.publica, verificado: false });
      sessao.chavesConfiadas[outro] = doOutro.publica;
    } else if (comparacao === "mudou") {
      sessao.mudou = doOutro.identidade;
      sessao.mudouChave = doOutro.publica;
      // A marca de verificado valia para a identidade antiga: some da tela agora e só volta comparando o código de novo.
      sessao.exigeComparar = !!conhecida?.verificado;
      sessao.verificado = false;
      if (conhecida?.publica) sessao.chavesConfiadas[outro] = conhecida.publica;
    } else if (conhecida?.publica && conhecida.publica !== doOutro.publica) {
      // A identidade é a de sempre, mas a chave do aparelho é outra: retém tudo, sem botão de aceitar.
      sessao.mudou = doOutro.identidade;
      sessao.mudouChave = doOutro.publica;
      sessao.chaveEstranha = true;
      sessao.verificado = false;
      sessao.chavesConfiadas[outro] = conhecida.publica;
    } else {
      if (conhecida && !conhecida.publica) await guardarConhecida({ ...conhecida, publica: doOutro.publica });
      sessao.chavesConfiadas[outro] = doOutro.publica;
    }
    // Para abrir o que já veio, vale a identidade conhecida; a nova só depois de a pessoa confirmar.
    sessao.confiadas[outro] = conhecida?.identidade ?? doOutro.identidade;
  }
  // Os recados da biblioteca (chaves das sessões da outra pessoa). A outra pessoa conta como "mudada" para a biblioteca
  // consultar de novo a chave do aparelho dela (a confiança daqui pode ter mudado).
  await sincronizar(eu.olm, [outro]);
  sessao.vistaEm = await anotarAVersao(eu.usuario, conversa, dados.versao);
  const precisa = precisaDeVersaoNova(dados.versao, dados.atual_ok, dados.versao_em) || versaoVelhaAqui(sessao.vistaEm, ROTACAO_DIAS) || opcoes.forcarSeAinda === dados.versao;
  if (doOutro && !sessao.mudou && precisa) {
    const meu = dados.participantes.find((p) => p.usuario === eu.usuario);
    let feita = false;
    try {
      if (!meu || meu.identidade !== eu.identidade.publica) throw erroDoChat("outro_aparelho");
      await chat.novaVersao(conversa, dados.versao + 1, [meu, doOutro].map((p) => ({ para: p.usuario, chave_versao: p.versao, embrulho: "olm1" })));
      feita = true;
    } catch {
      // Outra pessoa fez a versão ao mesmo tempo (ou algo não confere): lê de novo o que está lá.
      const de = await chat.chaves(conversa);
      sessao.vistaEm = await anotarAVersao(eu.usuario, conversa, de.versao);
      sessao.versao = de.versao;
      sessao.versaoEm = de.versao_em;
    }
    if (feita) {
      sessao.vistaEm = await anotarAVersao(eu.usuario, conversa, dados.versao + 1);
      sessao.versao = dados.versao + 1;
      sessao.versaoEm = new Date().toISOString();
    }
  }
  if (!vale(eu)) throw erroDoChat("dm_apagado");
  sessoesAbertas.set(conversa, sessao);
  return sessao;
}

/**
 * A pessoa confirmou a identidade da outra. `identidade`: a identidade para a qual o código COMPARADO foi calculado; se não
 * for mais a que a sessão mostra, recusa. `verificado`: comparou o código de segurança. Se a identidade antiga estava
 * verificada, SÓ passa com `verificado`. Chave de aparelho trocada sem trocar a identidade não tem como ser aceita.
 */
export async function confiarNaIdentidade(sessao: Sessao, identidade: string, verificado = false) {
  if (PREVIA_DO_CHAT) return;
  if (!vale(sessao.eu)) throw erroDoChat("dm_apagado");
  if (sessao.chaveEstranha) throw erroDoChat("dm_chave_estranha");
  const esperada = sessao.mudou ?? sessao.confiadas[sessao.outro];
  if (!esperada || identidade !== esperada) throw erroDoChat("dm_identidade_mudou");
  if (sessao.exigeComparar && !verificado) throw erroDoChat("dm_exige_comparar");
  const publica = sessao.mudou ? sessao.mudouChave : sessao.chavesConfiadas[sessao.outro];
  await guardarConhecida({ chave: `${sessao.eu.usuario}:${sessao.outro}`, identidade, ...(publica ? { publica } : {}), verificado });
  // A biblioteca passa a conhecer o aparelho novo da pessoa (e só ele).
  if (sessao.eu.olm) await sincronizar(sessao.eu.olm, [sessao.outro]);
}

export interface MensagemAberta {
  id: string;
  autor: string;
  versao: number;
  criado_em: string;
  expira_em: string;
  /** null: este aparelho não tem a chave (escrita antes de trocar de aparelho, por exemplo), ou a mensagem é repetida. */
  texto: string | null;
  /** O contador de dentro do cifrado. */
  contador: number | null;
  /** Até onde quem escreveu já tinha recebido da outra pessoa. */
  visto: Visto | null;
  /** Este aparelho já tinha recebido esta mesma mensagem como outra: não é mostrada de novo. */
  repetida: boolean;
  /** Este aparelho não consegue saber se a mensagem é repetida (versão já fechada aqui): a tela mostra com aviso. */
  duvidosa: boolean;
}

/** Uma leitura por vez do que já chegou: duas ao mesmo tempo poderiam gravar uma por cima da outra. */
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
  // Registro de versão ANTIGA que passou da vida útil vira piso. A versão atual nunca fecha, e nada vence numa leitura em que
  // o relógio do aparelho andou para trás ou saltou dias.
  for (const [chave, registro] of [...registros]) {
    const versao = versaoDaChave(chave);
    if (versao === null || !podeFechar(registro, versao, sessao.versao, marca?.lida, agora)) continue;
    const doPiso = `${chave.slice(0, chave.lastIndexOf(":"))}:piso`;
    if (versao > (pisos.get(doPiso) ?? 0)) {
      pisos.set(doPiso, versao);
      await guardarNaGaveta(ORDEM, { chave: doPiso, versao } satisfies PisoDeOrdem);
    }
    registros.delete(chave);
    await apagarDaGaveta(ORDEM, chave);
  }
  if (marca && (agora < marca.lida || agora - marca.lida > 60_000)) {
    await mudarNaGaveta<MarcaDeVersoes>(ORDEM, marca.chave, (guardada) => (guardada ? { ...guardada, lida: agora } : null));
  }
  for (const m of [...abertas].sort((a, b) => a.criado_em.localeCompare(b.criado_em))) {
    const interno = internos.get(m.id);
    if (!interno) continue;
    const chave = chaveDaOrdem(eu, sessao.conversa, m.autor, m.versao);
    const antes = registros.get(chave) ?? null;
    const piso = pisos.get(chaveDoPiso(eu, sessao.conversa, m.autor)) ?? 0;
    const r = julgar(antes, piso, chave, { servidor: m.id, autor: m.autor, versao: m.versao, id: interno, contador: m.contador as number }, agora);
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

export async function abrirMensagens(sessao: Sessao, lista: MensagemCifrada[]): Promise<MensagemAberta[]> {
  if (PREVIA_DO_CHAT) return lista.map((m) => ({ id: m.id, autor: m.autor, versao: m.versao, criado_em: m.criado_em, expira_em: m.expira_em, texto: m.corpo, contador: null, visto: null, repetida: false, duvidosa: false }));
  const olm = sessao.eu.olm;
  if (!vale(sessao.eu) || !olm) throw erroDoChat("dm_apagado");
  await sincronizar(olm);
  // O servidor devolveu a mesma linha duas vezes (o mesmo id): fica só a primeira.
  const unicas = [...new Map([...lista].reverse().map((m) => [m.id, m])).values()].reverse();
  const internos = new Map<string, string>();
  const abertas: MensagemAberta[] = [];
  // Uma por vez: a biblioteca guarda o que já abriu, e a ordem de chegada importa para ela.
  for (const m of unicas) {
    const identidade = sessao.confiadas[m.autor] ? tirarO(sessao.confiadas[m.autor]) : null;
    const bloco = eM1(m.corpo) ? await abrirBloco(olm, m.corpo, sessao.conversa, m.autor, identidade) : null;
    const aberta = bloco ? lerBloco(bloco) : null;
    bloco?.fill(0);
    if (aberta) internos.set(m.id, aberta.id);
    abertas.push({ id: m.id, autor: m.autor, versao: m.versao, criado_em: m.criado_em, expira_em: m.expira_em, texto: aberta?.texto ?? null, contador: aberta?.contador ?? null, visto: aberta?.visto ?? null, repetida: false, duvidosa: false });
  }
  await naFilaDaOrdem(() => conferirOrdem(sessao, abertas, internos));
  if (!vale(sessao.eu)) throw erroDoChat("dm_apagado");
  // A repetida não é mostrada: nem o texto dela fica na memória da tela.
  return abertas.map((m) => (m.repetida ? { ...m, texto: null } : m));
}

/** As mensagens (ids) que vêm logo depois de um buraco na ordem: a tela mostra ali um aviso discreto de "pode faltar mensagem". */
export function depoisDeBuraco(mensagens: readonly MensagemAberta[]): Set<string> {
  return buracos(mensagens.filter((m) => m.contador !== null && !m.repetida).map((m) => ({ servidor: m.id, autor: m.autor, versao: m.versao, contador: m.contador as number })));
}

/**
 * As mensagens na ordem da tela (dentro de cada pessoa, a ordem em que ela escreveu; a hora do servidor só intercala as duas)
 * e os avisos: fora de ordem, e mensagens minhas que a outra pessoa ainda não tinha recebido.
 */
export function ordemDaConversa(mensagens: readonly MensagemAberta[], eu: string): OrdemDaTela<MensagemAberta> {
  const semConferir = new Set(mensagens.filter((m) => m.repetida || m.texto === null).map((m) => m.id));
  const r = ordemDaTela(mensagens.map((m) => (semConferir.has(m.id) ? { ...m, contador: null } : m)), eu);
  const porId = new Map(mensagens.map((m) => [m.id, m]));
  return { ...r, ordenadas: r.ordenadas.map((m) => porId.get(m.id) as MensagemAberta) };
}

/** Até onde este aparelho já recebeu da outra pessoa nesta conversa (vai dentro de cada mensagem que eu escrevo). */
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

/**
 * Cifra no aparelho (biblioteca do Matrix) e envia. Antes, confere de novo a idade da versão (a conversa pode estar aberta há
 * dias): se passou do prazo, abre a sessão de novo, o que faz a versão nova. Se nem assim a versão mudar e, pela conta deste
 * aparelho, ela está velha, NÃO envia ("dm_versao_presa"). Se o banco recusar por versão velha, abre de novo forçando a versão
 * nova e tenta uma vez mais. Com a identidade ou a chave da outra pessoa mudada, nada sai.
 */
export async function enviarTexto(sessao: Sessao, texto: string): Promise<Sessao> {
  if (PREVIA_DO_CHAT) {
    await chat.enviar(sessao.conversa, 1, texto);
    return sessao;
  }
  if (!textoCabe(texto)) throw erroDoChat("texto_grande");
  let atual = sessao;
  const retida = (s: Sessao) => (s.chaveEstranha ? "dm_chave_estranha" : s.exigeComparar ? "dm_exige_comparar" : "dm_sem_chave");
  if (!vale(atual.eu)) throw erroDoChat("dm_apagado");
  if (atual.mudou) throw erroDoChat(retida(atual));
  if (precisaDeVersaoNova(atual.versao, true, atual.versaoEm) || versaoVelhaAqui(atual.vistaEm, ROTACAO_DIAS)) {
    atual = await abrirSessao(atual.eu, atual.conversa, atual.outro, atual);
    if (!atual.mudou && versaoVelhaAqui(atual.vistaEm, ROTACAO_DIAS)) throw erroDoChat("dm_versao_presa");
  }
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const usada = atual;
    const olm = usada.eu.olm;
    if (usada.mudou) throw erroDoChat(retida(usada));
    if (!olm || usada.semChaveDoOutro || usada.versao < 1) throw erroDoChat("dm_sem_chave");
    try {
      await naFilaDaOrdem(async () => {
        const daOrdem = chaveDaOrdem(usada.eu.usuario, usada.conversa, usada.eu.usuario, usada.versao);
        // O contador é reservado ANTES de enviar, lendo e gravando numa transação só: duas abas nunca usam o mesmo.
        const reservado = await mudarNaGaveta<RegistroDeOrdem>(ORDEM, daOrdem, (registro) => comContadorUsado(registro, daOrdem, proximoContador(registro)));
        if (!reservado || !vale(usada.eu)) throw erroDoChat("dm_apagado");
        const contador = reservado.maior;
        const bloco = montarBloco(texto.trim(), contador, await vistoDaOutra(usada));
        let corpo: string;
        try {
          corpo = await cifrarBloco(olm, usada.conversa, usada.versao, usada.outro, bloco);
        } finally {
          bloco.fill(0);
        }
        try {
          await chat.enviar(usada.conversa, usada.versao, corpo);
        } catch (erro) {
          // Com recusa certa do servidor, a mensagem não existe: o contador volta, se ninguém reservou outro depois.
          if (RECUSA_CERTA.test(codigoDe(erro))) {
            await mudarNaGaveta<RegistroDeOrdem>(ORDEM, daOrdem, (registro) => (registro && registro.maior === contador ? { ...registro, maior: contador - 1 } : null));
          }
          throw erro;
        }
      });
      return usada;
    } catch (erro) {
      if (codigoDe(erro) !== "versao_desatualizada" || tentativa > 0) throw erro;
      atual = await abrirSessao(usada.eu, usada.conversa, usada.outro, usada, { forcarSeAinda: usada.versao });
    }
  }
  return atual;
}

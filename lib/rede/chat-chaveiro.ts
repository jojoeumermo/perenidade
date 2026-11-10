// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O chaveiro do chat privado da Alumia, neste aparelho: a chave do aparelho e a identidade (as duas NÃO exportáveis), a
// identidade e a chave do aparelho que este aparelho já conhece de cada pessoa ("confiar na primeira vez, avisar quando
// mudar"), o que já chegou de cada autor (para notar repetição, buraco e ordem trocada), a maior versão da chave já vista em
// cada conversa e, só na memória enquanto a página está aberta, as chaves das conversas. O que vai para o disco mora em
// lib/rede/chat/gaveta.ts (IndexedDB próprio, separado do chaveiro da equipe); a cifra, em lib/rede/chat-privado.ts; as
// chamadas, em lib/rede/cliente-chat.ts. Documento: docs/rede/CHAT-PRIVADO.md.
//
// O servidor não é de confiança para nada além de entregar: o aparelho não aceita versão da chave menor que uma já vista,
// troca de versão pela própria conta dos dias, não reabre mensagem repetida e não entrega chave a identidade nem a chave de
// aparelho que mudou sem a pessoa conferir.
import {
  abrirEmbrulho, abrirMensagem, type Autoria, certificarChave, cifrarMensagem, compararIdentidade, type Eu, formatoDe, type Identidade, novaChaveDoAparelho,
  novaIdentidadeDoChat, type ParDoAparelho, precisaDeVersaoNova, prepararNovaVersao, ROTACAO_DIAS, type Visto,
} from "./chat-privado";
import { NADA_VISTO } from "./chat/c3";
import { aoApagarTudoDoChat, apagarDaGaveta, apagarPrefixoDaGaveta, apagarTudoDoChat as apagarTudoNoAparelho, CONHECIDAS, CONTAS, guardarNaGaveta, lerDaGaveta, lerPrefixoDaGaveta, mudarNaGaveta, ORDEM } from "./chat/gaveta";
import {
  anotarVersao, buracos, chaveDaOrdem, chaveDasVersoes, chaveDoPiso, comContadorUsado, julgar, julgarAntiga, juntarRegistros, type MarcaDeVersoes, ordemDaTela, type OrdemDaTela, type PisoDeOrdem,
  podeFechar, prefixoDaOrdem, proximoContador, type RegistroDeOrdem, versaoDaChave, versaoVelhaAqui,
} from "./chat/ordem";
import { chat, PREVIA_DO_CHAT, type ChavesDaConversa, type MensagemCifrada, type SituacaoDoChat } from "./cliente-chat";

/**
 * Na prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim), o aparelho já vem "ativado" e as mensagens do dublê (lib/rede/chat-exemplos.ts) vão
 * e voltam em texto: nada sai da aba, então não há o que cifrar, e as telas do chat ficam testáveis sem banco. Fora da prévia,
 * nada disto existe no caminho.
 */
const EU_DA_PREVIA = (usuario: string, versao = 1): Eu =>
  ({ usuario, versao, aparelho: { publica: "previa-aparelho-eu" }, identidade: { publica: "previa-identidade-eu" } }) as unknown as Eu;

interface Guardado {
  usuario: string;
  aparelho: ParDoAparelho;
  identidade: Identidade;
}

interface Conhecida {
  /** "<eu>:<outra pessoa>". */
  chave: string;
  identidade: string;
  /** A chave do aparelho da pessoa. Neste chat ela nasce junto com a identidade: chave nova com a identidade de sempre é alarme. */
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

/** As conversas abertas nesta página (as chaves delas vivem só aqui, na memória). */
const sessoesAbertas = new Map<string, Sessao>();
/**
 * A "geração" do chaveiro: sobe a cada apagar. Um `Eu` (a chave do aparelho na memória) criado antes do último apagar não
 * vale mais, mesmo que uma tela ainda o segure: nada abre, nada envia, nada é gravado com ele.
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
  for (const sessao of sessoesAbertas.values()) sessao.chaves.clear();
  sessoesAbertas.clear();
}
// O "Sair rápido" (components/rede/chat/encaixe.tsx), nesta aba ou em outra, apaga também as chaves de conversa da memória.
aoApagarTudoDoChat(esquecerSessoes);

/** Apaga deste aparelho tudo o que o chat guardou da conta (depois de "apagar tudo do chat"). */
export async function esquecerNesteAparelho(usuario: string) {
  esquecerSessoes();
  await apagarDaGaveta(CONTAS, usuario);
  await apagarPrefixoDaGaveta(CONHECIDAS, `${usuario}:`);
  await apagarPrefixoDaGaveta(ORDEM, `${usuario}:`);
}

/**
 * PÂNICO: apaga deste aparelho TUDO do chat, de todas as contas: o banco IndexedDB inteiro (chave do aparelho, identidade,
 * identidades conhecidas, o que já chegou), as chaves de conversa na memória e o que as telas abertas registraram (rascunho,
 * mensagens abertas), nesta aba e nas outras. Não há fila de envio: nada fica guardado para mandar depois. Termina em menos de
 * meio segundo e nunca lança. É o que o "Sair rápido" da Alumia chama. Depois disso, o chat precisa ser ativado de novo neste
 * aparelho, e as verificações feitas com cada pessoa se perdem (é preciso comparar o código de novo).
 */
export async function apagarTudoDoChat(): Promise<void> {
  if (PREVIA_DO_CHAT) {
    // Na prévia nada foi gravado: só a memória da aba.
    esquecerSessoes();
    return;
  }
  await apagarTudoNoAparelho();
}

/** "outro_aparelho": o servidor mostra uma chave que não é a deste aparelho. `tinhaChaveAqui`: este aparelho TINHA a chave do chat. */
export type EstadoDoAparelho = { estado: "pronto"; eu: Eu } | { estado: "sem_chave" } | { estado: "outro_aparelho"; tinhaChaveAqui: boolean };

/** Este aparelho é o do chat desta conta? */
export async function estadoDoAparelho(situacao: SituacaoDoChat): Promise<EstadoDoAparelho> {
  if (PREVIA_DO_CHAT) return { estado: "pronto", eu: EU_DA_PREVIA(situacao.eu, situacao.chave?.versao) };
  const guardado = await lerConta(situacao.eu);
  if (!situacao.chave) return { estado: "sem_chave" };
  if (!guardado || guardado.aparelho.publica !== situacao.chave.publica || guardado.identidade.publica !== situacao.chave.identidade) return { estado: "outro_aparelho", tinhaChaveAqui: !!guardado };
  return { estado: "pronto", eu: marcar({ usuario: situacao.eu, aparelho: guardado.aparelho, identidade: guardado.identidade, versao: situacao.chave.versao }) };
}

/** Ativa o chat neste aparelho (cria a chave e a identidade, publica só a parte pública). Num aparelho novo, o antigo deixa de abrir. */
export async function ativarNesteAparelho(usuario: string): Promise<Eu> {
  if (PREVIA_DO_CHAT) return EU_DA_PREVIA(usuario);
  const quando = geracao;
  const aparelho = await novaChaveDoAparelho();
  const identidade = await novaIdentidadeDoChat();
  const certificado = await certificarChave(identidade, usuario, aparelho.publica);
  const r = await chat.publicarChave(identidade.publica, aparelho.publica, certificado);
  // O "apagar tudo" passou enquanto a chave era publicada: nada é gravado (a pessoa ativa de novo quando voltar).
  if (quando !== geracao) throw erroDoChat("dm_apagado");
  // Só a ativação cria o banco do chat neste aparelho (e solta a trava do "apagar tudo").
  await guardarNaGaveta(CONTAS, { usuario, aparelho, identidade } satisfies Guardado, { criar: true });
  return marcar({ usuario, aparelho, identidade, versao: r.versao });
}

/** Uma conversa aberta neste aparelho: as chaves de cada versão (só na memória) e o que se sabe da outra pessoa. */
export interface Sessao {
  conversa: string;
  eu: Eu;
  outro: string;
  versao: number;
  /** Quando a versão atual da chave foi criada, pela palavra do servidor. */
  versaoEm: string | null;
  /** Quando ESTE aparelho viu a versão atual pela primeira vez (hora do aparelho): a troca aos 7 dias não depende do servidor. */
  vistaEm: number;
  chaves: Map<number, CryptoKey>;
  /** As identidades em que este aparelho confia (eu e a outra pessoa). */
  confiadas: Record<string, string>;
  /** As chaves de aparelho que este aparelho conhece (a minha e, quando há, a da outra pessoa). */
  chavesConfiadas: Record<string, string>;
  /** A identidade (ou a chave do aparelho) da outra pessoa mudou desde a última vez: nada é entregue a ela até confirmar. */
  mudou: string | null;
  /** A chave de aparelho que veio junto com a identidade nova. */
  mudouChave: string | null;
  /** A identidade que mudou estava VERIFICADA: um clique não basta, é preciso comparar o código de novo. */
  exigeComparar: boolean;
  /**
   * A chave do aparelho mudou e a identidade NÃO. No uso normal isso não acontece (as duas nascem juntas): é o que faria quem
   * conseguiu fazer a identidade da pessoa assinar a chave dele. Não há como aceitar: só a pessoa ativando o chat de novo.
   */
  chaveEstranha: boolean;
  /** A outra pessoa ainda não ativou o chat em aparelho nenhum. */
  semChaveDoOutro: boolean;
  /** Verificado neste aparelho. Cai sozinho quando a identidade muda. */
  verificado: boolean;
}

/**
 * Anota no aparelho a versão que o servidor diz ser a atual e devolve quando este aparelho a viu pela primeira vez. Versão
 * MENOR que uma já vista é recusada ("dm_versao_voltou"): o servidor não consegue fazer o aparelho escrever numa chave antiga.
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

async function carregarChaves(sessao: Sessao, dados: ChavesDaConversa) {
  const vistaEm = await anotarAVersao(sessao.eu.usuario, sessao.conversa, dados.versao);
  for (const e of dados.embrulhos) {
    if (sessao.chaves.has(e.versao) || e.chave_versao !== sessao.eu.versao) continue;
    const k = await abrirEmbrulho(sessao.conversa, sessao.eu, e, sessao.confiadas, sessao.chavesConfiadas);
    if (k) sessao.chaves.set(e.versao, k);
  }
  sessao.versao = dados.versao;
  sessao.versaoEm = dados.versao_em;
  sessao.vistaEm = vistaEm;
}

/**
 * Abre a conversa: confere a identidade e a chave do aparelho da outra pessoa, desembrulha as chaves e, se precisar, faz uma
 * versão nova. `forcarSeAinda`: o banco recusou o envio nesta versão por velha; se ela ainda for a atual, faz a nova sem olhar
 * o relógio do aparelho (que pode estar atrasado).
 */
export async function abrirSessao(eu: Eu, conversa: string, outro: string, anterior?: Sessao | null, opcoes: { forcarSeAinda?: number } = {}): Promise<Sessao> {
  if (PREVIA_DO_CHAT) {
    return {
      conversa, eu, outro, versao: 1, versaoEm: null, vistaEm: 0, chaves: anterior?.chaves ?? new Map(), confiadas: { [eu.usuario]: eu.identidade.publica, [outro]: `previa-identidade-${outro}` },
      chavesConfiadas: {}, mudou: null, mudouChave: null, exigeComparar: false, chaveEstranha: false, semChaveDoOutro: false, verificado: anterior?.verificado ?? false,
    };
  }
  if (!vale(eu)) throw erroDoChat("dm_apagado");
  const dados = await chat.chaves(conversa);
  const doOutro = dados.participantes.find((p) => p.usuario === outro) ?? null;
  const conhecida = await lerConhecida(eu.usuario, outro);
  const sessao: Sessao = {
    conversa,
    eu,
    outro,
    versao: dados.versao,
    versaoEm: dados.versao_em,
    vistaEm: Date.now(),
    chaves: anterior?.chaves ?? new Map(),
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
      // A marca de verificado valia para a identidade antiga: some da tela agora e só volta comparando o código de novo. O
      // que está guardado fica como estava até lá, para a exigência valer também depois de recarregar a página.
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
      // Registro de antes de o aparelho guardar a chave: guarda agora a que está lá.
      if (conhecida && !conhecida.publica) await guardarConhecida({ ...conhecida, publica: doOutro.publica });
      sessao.chavesConfiadas[outro] = doOutro.publica;
    }
    // Para abrir o que já veio, vale a identidade conhecida; a nova só depois de a pessoa confirmar.
    sessao.confiadas[outro] = conhecida?.identidade ?? doOutro.identidade;
  }
  await carregarChaves(sessao, dados);
  // A troca de versão não depende só da palavra do servidor: vale também a idade contada por este aparelho.
  const precisa = precisaDeVersaoNova(dados.versao, dados.atual_ok, dados.versao_em) || versaoVelhaAqui(sessao.vistaEm, ROTACAO_DIAS) || opcoes.forcarSeAinda === dados.versao;
  if (doOutro && !sessao.mudou && precisa) {
    let feita: { chave: CryptoKey } | null = null;
    try {
      const nova = await prepararNovaVersao(conversa, dados.versao + 1, eu, dados.participantes, sessao.confiadas, sessao.chavesConfiadas);
      await chat.novaVersao(conversa, dados.versao + 1, nova.embrulhos);
      feita = nova;
    } catch {
      // Outra pessoa fez a versão ao mesmo tempo (ou algo não confere): lê de novo o que está lá.
      await carregarChaves(sessao, await chat.chaves(conversa));
    }
    if (feita) {
      sessao.vistaEm = await anotarAVersao(eu.usuario, conversa, dados.versao + 1);
      sessao.chaves.set(dados.versao + 1, feita.chave);
      sessao.versao = dados.versao + 1;
      sessao.versaoEm = new Date().toISOString();
    }
  }
  // O "apagar tudo" passou enquanto a conversa abria: esta sessão não chega a existir.
  if (!vale(eu)) {
    sessao.chaves.clear();
    throw erroDoChat("dm_apagado");
  }
  sessoesAbertas.set(conversa, sessao);
  return sessao;
}

/**
 * A pessoa confirmou a identidade da outra. `identidade`: a identidade para a qual o código COMPARADO foi calculado; se não
 * for mais a que a sessão mostra (o servidor trocou no meio), recusa. `verificado`: comparou o código de segurança (leu o QR
 * ou digitou os números que a outra pessoa disse). Se a identidade antiga estava verificada, SÓ passa com `verificado`. Chave
 * de aparelho trocada sem trocar a identidade não tem como ser aceita.
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
}

export interface MensagemAberta {
  id: string;
  autor: string;
  versao: number;
  criado_em: string;
  expira_em: string;
  /** null: este aparelho não tem a chave (escrita antes de trocar de aparelho, por exemplo), ou a mensagem é repetida. */
  texto: string | null;
  /** Só nas mensagens antigas (c2), que levam assinatura. Nas c3 é null. */
  autoria: Autoria | null;
  /** O contador de dentro do cifrado (só c3). */
  contador: number | null;
  /** Até onde quem escreveu já tinha recebido da outra pessoa (só c3). */
  visto: Visto | null;
  /** Este aparelho já tinha recebido esta mesma mensagem como outra: não é mostrada de novo. */
  repetida: boolean;
  /** Este aparelho não consegue saber se a mensagem é repetida (versão já fechada aqui, ou formato antigo fora de hora): a tela mostra com aviso. */
  duvidosa: boolean;
}

/** Uma leitura por vez do que já chegou: duas ao mesmo tempo poderiam gravar uma por cima da outra. */
let filaDaOrdem: Promise<unknown> = Promise.resolve();
function naFilaDaOrdem<T>(fazer: () => Promise<T>): Promise<T> {
  const vez = filaDaOrdem.then(fazer, fazer);
  filaDaOrdem = vez.catch(() => undefined);
  return vez;
}

/** O que foi tirado de dentro de cada mensagem, pelo id do servidor: o identificador (c3) ou o resumo do corpo (c2). */
type Internos = Map<string, { id: string } | { resumo: string }>;

/** Confere repetição contra o que este aparelho já viu, e guarda o que é novo. Marca as repetidas e as duvidosas em `abertas`. */
async function conferirOrdem(sessao: Sessao, abertas: MensagemAberta[], internos: Internos) {
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
  // o relógio do aparelho andou para trás ou saltou dias (rede hostil, relógio sem bateria).
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
  // A hora desta leitura, para a próxima desconfiar de salto (gravada no máximo uma vez por minuto).
  if (marca && (agora < marca.lida || agora - marca.lida > 60_000)) {
    await mudarNaGaveta<MarcaDeVersoes>(ORDEM, marca.chave, (guardada) => (guardada ? { ...guardada, lida: agora } : null));
  }
  for (const m of [...abertas].sort((a, b) => a.criado_em.localeCompare(b.criado_em))) {
    const interno = internos.get(m.id);
    if (!interno) continue;
    const chave = chaveDaOrdem(eu, sessao.conversa, m.autor, m.versao);
    const antes = registros.get(chave) ?? null;
    const piso = pisos.get(chaveDoPiso(eu, sessao.conversa, m.autor)) ?? 0;
    const r = "id" in interno
      ? julgar(antes, piso, chave, { servidor: m.id, autor: m.autor, versao: m.versao, id: interno.id, contador: m.contador as number }, agora)
      : julgarAntiga(antes, piso, chave, { servidor: m.id, versao: m.versao, resumo: interno.resumo }, agora);
    if (r.juizo === "repetida") m.repetida = true;
    if (r.juizo === "fechada" || r.juizo === "duvidosa") m.duvidosa = true;
    if (r.registro && r.registro !== antes) {
      registros.set(chave, r.registro);
      mudados.add(chave);
    }
  }
  // Grava juntando com o que estiver lá: outra aba pode ter gravado no meio (um contador reservado, uma mensagem vista).
  for (const chave of mudados) {
    const novo = registros.get(chave) as RegistroDeOrdem;
    await mudarNaGaveta<RegistroDeOrdem>(ORDEM, chave, (guardado) => juntarRegistros(guardado, novo));
  }
}

const resumoDe = async (texto: string) => {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto)));
  let saida = "";
  for (const b of bytes) saida += b.toString(16).padStart(2, "0");
  return saida;
};

export async function abrirMensagens(sessao: Sessao, lista: MensagemCifrada[]): Promise<MensagemAberta[]> {
  if (PREVIA_DO_CHAT) return lista.map((m) => ({ id: m.id, autor: m.autor, versao: m.versao, criado_em: m.criado_em, expira_em: m.expira_em, texto: m.corpo, autoria: null, contador: null, visto: null, repetida: false, duvidosa: false }));
  if (!vale(sessao.eu)) throw erroDoChat("dm_apagado");
  // O servidor devolveu a mesma linha duas vezes (o mesmo id): fica só a primeira.
  const unicas = [...new Map([...lista].reverse().map((m) => [m.id, m])).values()].reverse();
  const internos: Internos = new Map();
  const abertas = await Promise.all(
    unicas.map(async (m): Promise<MensagemAberta> => {
      const chave = sessao.chaves.get(m.versao);
      const aberta = chave ? await abrirMensagem(chave, m.corpo, sessao.conversa, m.autor, sessao.confiadas[m.autor] ?? null) : null;
      if (aberta?.id) internos.set(m.id, { id: aberta.id });
      else if (aberta && formatoDe(m.corpo) === "c2") internos.set(m.id, { resumo: await resumoDe(m.corpo) });
      return { id: m.id, autor: m.autor, versao: m.versao, criado_em: m.criado_em, expira_em: m.expira_em, texto: aberta?.texto ?? null, autoria: aberta?.autoria ?? null, contador: aberta?.contador ?? null, visto: aberta?.visto ?? null, repetida: false, duvidosa: false };
    }),
  );
  await naFilaDaOrdem(() => conferirOrdem(sessao, abertas, internos));
  // O "apagar tudo" passou no meio: nada do que foi aberto chega à tela.
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
 * e os avisos: fora de ordem, e mensagens minhas que a outra pessoa ainda não tinha recebido. Repetida e mensagem sem chave
 * não entram na conferência (ficam onde a hora do servidor as põe).
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
 * Cifra no aparelho e envia. Antes, confere de novo a idade da versão da chave (a conversa pode estar aberta há dias), pela
 * palavra do servidor E pela conta deste aparelho: se passou do prazo, abre a sessão de novo, o que faz a versão nova. Se nem
 * assim a versão mudar e, pela conta deste aparelho, ela está velha, NÃO envia ("dm_versao_presa"). Se o banco recusar por
 * versão velha, abre de novo forçando a versão nova (o relógio daqui pode estar atrasado) e tenta uma vez mais. Com a
 * identidade ou a chave da outra pessoa mudada, nada sai.
 */
export async function enviarTexto(sessao: Sessao, texto: string): Promise<Sessao> {
  if (PREVIA_DO_CHAT) {
    await chat.enviar(sessao.conversa, 1, texto);
    return sessao;
  }
  let atual = sessao;
  const retida = (s: Sessao) => (s.chaveEstranha ? "dm_chave_estranha" : s.exigeComparar ? "dm_exige_comparar" : "dm_sem_chave");
  if (!vale(atual.eu)) throw erroDoChat("dm_apagado");
  if (atual.mudou) throw erroDoChat(retida(atual));
  if (precisaDeVersaoNova(atual.versao, true, atual.versaoEm) || versaoVelhaAqui(atual.vistaEm, ROTACAO_DIAS)) {
    atual = await abrirSessao(atual.eu, atual.conversa, atual.outro, atual);
    // O servidor não deixou trocar (ou diz que a versão é nova) e, pela conta daqui, ela passou do prazo: não escreve nela.
    if (!atual.mudou && versaoVelhaAqui(atual.vistaEm, ROTACAO_DIAS)) throw erroDoChat("dm_versao_presa");
  }
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const usada = atual;
    const chave = usada.chaves.get(usada.versao);
    if (usada.mudou) throw erroDoChat(retida(usada));
    if (!chave) throw erroDoChat("dm_sem_chave");
    try {
      await naFilaDaOrdem(async () => {
        const daOrdem = chaveDaOrdem(usada.eu.usuario, usada.conversa, usada.eu.usuario, usada.versao);
        // O contador é reservado ANTES de enviar, lendo e gravando numa transação só: duas abas nunca usam o mesmo.
        const reservado = await mudarNaGaveta<RegistroDeOrdem>(ORDEM, daOrdem, (registro) => comContadorUsado(registro, daOrdem, proximoContador(registro)));
        if (!reservado || !vale(usada.eu)) throw erroDoChat("dm_apagado");
        const contador = reservado.maior;
        const corpo = await cifrarMensagem(chave, usada.versao, usada.eu, usada.conversa, texto, contador, await vistoDaOutra(usada));
        try {
          await chat.enviar(usada.conversa, usada.versao, corpo);
        } catch (erro) {
          // Com recusa certa do servidor, a mensagem não existe: o contador volta, se ninguém reservou outro depois. Sem
          // resposta clara (a rede caiu), ela pode ter chegado: o contador fica gasto.
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

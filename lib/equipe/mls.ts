// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O chat da equipe (painel) em MLS: um grupo MLS por conversa, no motor dos grupos (lib/rede/grupos/motor-de-grupo.ts, OpenMLS do
// @wireapp/core-crypto na suíte híbrida ML-KEM-768 + X25519). Banco: supabase/migracoes/20261124-r2-equipe.sql. Substitui o Megolm
// (lib/equipe-olm.ts, que saiu) e a cifra "c2".
//
// O que este arquivo garante:
//   - FOLHA CERTIFICADA: cada aparelho aprovado publica a folha dele com um certificado da IDENTIDADE da pessoa (lib/sigilo.ts):
//     "alumia/r2/mls/equipe/folha/v1|<conta>|<aparelho>|<nome da folha>|<impressão da chave de assinatura da folha>". Um colega só
//     põe no grupo (e só aceita na árvore) a folha cujo certificado confere com a identidade que ELE já conhece daquela pessoa: o
//     servidor não consegue pôr um aparelho falso, nem trocar a chave de um aparelho, sem "grupo_suspeito". A espera de 24 horas do
//     aparelho que se certifica sozinho fica no banco (só folha de aparelho que já vale sai no estado).
//   - ASSINATURA DE CADA MENSAGEM: o texto vai assinado pela identidade de quem escreveu ("s1", lib/sigilo.ts) por dentro da cifra,
//     amarrado à conversa, ao contexto e à época. A folha do MLS diz qual aparelho; a assinatura diz qual pessoa, mesmo para quem
//     lê o histórico depois.
//   - MENSAGEM "m1": "m1.<época>.<base64url(nonce ‖ cifrado)>", XChaCha20-Poly1305 (libsodium) com a chave de mensagens da época
//     (exporter do MLS + HKDF, lib/rede/grupos/epoca.ts), nonce sorteado de 24 bytes, o texto completado a um bloco de tamanho fixo
//     (lib/rede/chat/padding.ts) e, como dados amarrados, a conversa, a época e o contexto. O histórico abre em todo aparelho que
//     estava no grupo naquela época, e só nele: aparelho que entra depois não lê o que veio antes; quem sai não lê o que vem depois.
//   - ÉPOCA NOVA: a cada entrada e saída (o motor), quando alguém sai da conversa (a mínima do banco sobe) e, no lugar da regra
//     "100 mensagens ou 7 dias" do Megolm, quando a época tem 100 mensagens ou 7 dias (troca de chave da própria folha).
// Sem "@/": roda no Node nos testes (scripts/testar-r2-equipe.mjs).
import type { CoreCrypto } from "@wireapp/core-crypto";
import { preencher, tirarPreenchimento } from "../rede/chat/padding";
import { prepararAparelho, type AparelhoMls, type Motor } from "../rede/grupos/aparelho";
import { abrirSelado, selar } from "../rede/grupos/embrulho-da-epoca";
import { criarMotorDeGrupo, type GuardaDoGrupo, type TransporteDeGrupo } from "../rede/grupos/motor-de-grupo";
import { lerPacote } from "../rede/grupos/pacote";
import { ROTULOS } from "../rede/grupos/rotulos-do-motor";

export type ChamarOBanco = <T>(funcao: string, argumentos: Record<string, unknown>) => Promise<T>;

/** O que o banco diz da conversa (equipe_mls_estado), sem os commits. */
export interface EstadoDaConversa {
  epoca: number | null;
  minima: number;
  epocaDia: string | null;
  mensagens: number;
  membros: string[];
  folhas: { nome: string; usuario: string; aparelho: string; certificado: string }[];
  identidades: { usuario: string; nome: string; assina: string | null; versao: number }[];
}

export interface OpcoesDaEquipe {
  chamar: ChamarOBanco;
  /** O id deste aparelho no cadastro (chat_aparelhos). */
  aparelho: string;
  usuario: string;
  /** Assina com a identidade da pessoa (a privada nunca sai de lib/sigilo.ts). */
  assinar: (texto: string) => Promise<string>;
  /** Confere uma assinatura da identidade de alguém. */
  verificar: (publica: string, assinatura: string, texto: string) => Promise<boolean>;
  /** A identidade que ESTE aparelho conhece da pessoa (confiar na primeira vez, avisar quando mudar), ou null. */
  identidadeDe: (usuario: string) => string | null;
  guarda: GuardaDoGrupo;
  /** Abre a instância do motor deste aparelho (no navegador, a loja cifrada no OPFS; nos testes, a memória). */
  abrirMotor: () => Promise<{ M: Motor; cc: CoreCrypto }>;
}

const FORMATO_M1 = /^m1\.([1-9][0-9]{0,6})\.([A-Za-z0-9_-]+)$/;
/** Troca de época: a cada 100 mensagens ou 7 dias na mesma época. */
export const MENSAGENS_POR_EPOCA = 100;
export const DIAS_POR_EPOCA = 7;
/** Quantos pacotes de chave ficam publicados (repõe quando há menos de 5). */
const PACOTES = 10;

const encoder = new TextEncoder();
const erro = (codigo: string) => Object.assign(new Error(codigo), { code: codigo });
const codigoDe = (e: unknown) => String((e as { message?: unknown })?.message ?? e);
function paraB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const deB64 = (texto: string) => Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));
const paraB64Url = (bytes: Uint8Array) => paraB64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const deB64Url = (texto: string) => deB64(texto.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (texto.length % 4)) % 4));

/** O texto que a identidade assina para uma folha de um aparelho dela. */
export const textoDoCertificadoDaFolha = (usuario: string, aparelho: string, nome: string, impressao: string) =>
  `${ROTULOS.folhaDaEquipe}|${usuario}|${aparelho}|${nome}|${impressao}`;
/** Os dados amarrados a uma mensagem "m1". */
export const dadosDaMensagem = (conversa: string, epoca: number, contexto: string) => `${ROTULOS.mensagem}|${conversa}|e${epoca}|${contexto}`;
/** A época de um corpo "m1" (null se não é um). */
export function epocaDoM1(corpo: string): number | null {
  const m = FORMATO_M1.exec(corpo);
  return m ? Number(m[1]) : null;
}

export function criarMlsDaEquipe(o: OpcoesDaEquipe) {
  let aparelhoMls: Promise<AparelhoMls> | null = null;
  const aparelho = () => {
    aparelhoMls ??= o.abrirMotor().then(({ M, cc }) => prepararAparelho(M, cc, o.usuario));
    aparelhoMls.catch(() => {
      aparelhoMls = null;
    });
    return aparelhoMls;
  };
  /** O último estado lido de cada conversa (para a política conferir os certificados e a tela ler as identidades). */
  const ultimo = new Map<string, EstadoDaConversa>();
  /** Quando este aparelho acertou o grupo de cada conversa pela última vez (para não ir ao banco a cada mensagem que não abre). */
  const acertadoEm = new Map<string, number>();
  /** A época em que o grupo de cada conversa está neste aparelho (mensagem de época mais nova pede acertar já). */
  const epocaLocal = new Map<string, number>();
  const acertar = (conversa: string) =>
    naVez(conversa, async () => {
      const r = await motor.sincronizar(conversa);
      if (r) epocaLocal.set(conversa, Number(r.epoca));
      else await pedirParaEntrar(conversa);
      return r;
    });
  /** A época das boas-vindas mais novas que o banco mostrou a este aparelho, por conversa (0: nenhuma). */
  const boasvindasVistas = new Map<string, number>();
  /** Quando este aparelho pediu para entrar de novo em cada conversa (um pedido por minuto, no máximo). */
  const pedidoEm = new Map<string, number>();
  /**
   * O grupo da conversa existe, a folha deste aparelho está listada e ele não tem o grupo nem boas-vindas que sirvam (venceram em 30
   * dias, ou falharam): pede ao banco para entrar de novo. Os colegas tiram a folha e põem de novo (motor, "reentrar").
   */
  async function pedirParaEntrar(conversa: string): Promise<void> {
    const e = ultimo.get(conversa);
    const nome = await motor.nome();
    if (!e || e.epoca === null || !e.folhas.some((f) => f.nome === nome)) return;
    if (Date.now() - (pedidoEm.get(conversa) ?? 0) < 60_000) return;
    pedidoEm.set(conversa, Date.now());
    await o.chamar("equipe_mls_reentrar", { p_aparelho: o.aparelho, p_conversa: conversa, p_visto: boasvindasVistas.get(conversa) ?? 0 }).catch(() => undefined);
  }

  const ler = (r: Record<string, unknown>): EstadoDaConversa => ({
    epoca: (r.epoca as number | null) ?? null,
    minima: Number(r.minima ?? 0),
    epocaDia: (r.epoca_dia as string | null) ?? null,
    mensagens: Number(r.mensagens ?? 0),
    membros: (r.membros as string[]) ?? [],
    folhas: (r.folhas as EstadoDaConversa["folhas"]) ?? [],
    identidades: (r.identidades as EstadoDaConversa["identidades"]) ?? [],
  });

  const transporte: TransporteDeGrupo = {
    async estado(conversa, desde) {
      const r = await o.chamar<Record<string, unknown>>("equipe_mls_estado", { p_aparelho: o.aparelho, p_conversa: conversa, p_desde: desde });
      const e = ler(r);
      ultimo.set(conversa, e);
      const commits = (r.commits as { epoca: number; commit: string }[]) ?? [];
      const bv = r.boasvindas as { epoca: number; welcome: string } | null;
      boasvindasVistas.set(conversa, bv?.epoca ?? 0);
      return {
        epoca: e.epoca,
        membros: e.membros,
        folhas: e.folhas.map((f) => f.nome),
        commits: commits.map((c) => ({ epoca: c.epoca, corpo: deB64(c.commit) })),
        boasvindas: bv ? { epoca: bv.epoca, welcome: deB64(bv.welcome) } : null,
        reentrar: (r.reentrar as string[]) ?? [],
      };
    },
    async pacotes(conversa, faltam) {
      const r = await o.chamar<Record<string, string>>("equipe_mls_pacotes_pegar", { p_aparelho: o.aparelho, p_conversa: conversa, p_nomes: faltam });
      return Object.entries(r).map(([para, pacote]) => ({ para, pacote: deB64(pacote) }));
    },
    async gravarCommit(conversa, epoca, corpo, boasvindas) {
      try {
        await o.chamar("equipe_mls_commit", { p_aparelho: o.aparelho, p_conversa: conversa, p_epoca: epoca, p_commit: paraB64(corpo), p_boasvindas: boasvindas.map((b) => ({ para: b.para, welcome: paraB64(b.welcome) })) });
        return "ok";
      } catch (e) {
        if (codigoDe(e).includes("versao_ocupada")) return "ocupada";
        throw e;
      }
    },
  };

  // A conversa de cada folha que a política está conferindo: o motor confere uma conversa por vez.
  let conferindo: string | null = null;
  const motor = criarMotorDeGrupo({
    tipo: "equipe",
    aparelho,
    transporte,
    guarda: o.guarda,
    politica: {
      async aceitarFolha(f) {
        const estado = conferindo ? ultimo.get(conferindo) : undefined;
        const folha = estado?.folhas.find((x) => x.nome === f.nome);
        const identidade = o.identidadeDe(f.usuario);
        if (!folha || folha.usuario !== f.usuario || !identidade) return false;
        return o.verificar(identidade, folha.certificado, textoDoCertificadoDaFolha(f.usuario, folha.aparelho, f.nome, f.impressao));
      },
    },
  });

  /** Uma sincronização do grupo da conversa por vez (a política lê o estado daquela conversa). */
  let fila: Promise<unknown> = Promise.resolve();
  function naVez<T>(conversa: string, fazer: () => Promise<T>): Promise<T> {
    const vez = fila.then(async () => {
      conferindo = conversa;
      try {
        return await fazer();
      } finally {
        conferindo = null;
        acertadoEm.set(conversa, Date.now());
      }
    });
    fila = vez.catch(() => undefined);
    return vez;
  }

  /** Publica a folha deste aparelho (com o certificado) e repõe os pacotes de chave. */
  async function preparar(): Promise<void> {
    const nome = await motor.nome();
    const meu = await o.chamar<{ nome: string | null; pacotes: number }>("equipe_mls_meus_pacotes", { p_aparelho: o.aparelho });
    if (meu.nome === nome && meu.pacotes >= 5) return;
    const novos = await motor.gerarPacotes(meu.nome === nome ? PACOTES - meu.pacotes : PACOTES);
    const lido = lerPacote(novos[0]);
    if (!lido || lido.nome !== nome) throw erro("aparelho_invalido");
    const certificado = await o.assinar(textoDoCertificadoDaFolha(o.usuario, o.aparelho, nome, lido.impressao));
    await o.chamar("equipe_mls_publicar", { p_aparelho: o.aparelho, p_nome: nome, p_certificado: certificado, p_pacotes: novos.map(paraB64) });
  }

  /** Leva o grupo da conversa à época mais nova; troca de época se a mínima pede ou se a época ficou velha. */
  async function epocaParaEscrever(conversa: string): Promise<{ epoca: number; chave: Uint8Array }> {
    return naVez(conversa, async () => {
      let atual = await motor.sincronizar(conversa);
      if (!atual) {
        await pedirParaEntrar(conversa);
        throw erro("sem_chave");
      }
      const e = ultimo.get(conversa);
      const velha = e && (e.mensagens >= MENSAGENS_POR_EPOCA || (e.epocaDia !== null && Date.now() - Date.parse(`${e.epocaDia}T00:00:00Z`) > DIAS_POR_EPOCA * 86_400_000));
      if (e && (Number(atual.epoca) < e.minima || velha)) {
        await motor.renovar(conversa);
        atual = await motor.sincronizar(conversa);
        if (!atual) throw erro("sem_chave");
        if (Number(atual.epoca) < (ultimo.get(conversa)?.minima ?? 0)) throw erro("chave_desatualizada");
      }
      epocaLocal.set(conversa, Number(atual.epoca));
      return { epoca: Number(atual.epoca), chave: atual.segredos.conteudo };
    });
  }

  return {
    preparar,
    /** O último estado lido da conversa (identidades, membros), ou lê agora. */
    async estado(conversa: string, forcar = false): Promise<EstadoDaConversa> {
      if (forcar || !ultimo.has(conversa)) await transporte.estado(conversa, 2_147_483_647);
      return ultimo.get(conversa)!;
    },
    /** O que já foi lido da conversa, sem ir ao banco. */
    conhecido: (conversa: string) => ultimo.get(conversa) ?? null,

    /**
     * Cifra para a conversa na época atual. `assinar(epoca)` devolve o texto já assinado pela identidade para aquela época (a
     * época só é conhecida depois de acertar o grupo). Devolve o corpo "m1" que vai ao banco.
     */
    async cifrar(conversa: string, contexto: string, assinarNaEpoca: (epoca: number) => Promise<string>): Promise<string> {
      await preparar();
      const { epoca, chave } = await epocaParaEscrever(conversa);
      const bloco = preencher(encoder.encode(await assinarNaEpoca(epoca)));
      try {
        const selado = await selar(chave, bloco, encoder.encode(dadosDaMensagem(conversa, epoca, contexto)));
        return `m1.${epoca}.${paraB64Url(selado)}`;
      } finally {
        bloco.fill(0);
      }
    },

    /**
     * Abre um corpo "m1" (o texto ainda assinado, para conferir a autoria). null: não é "m1", foi mexido, é de outra conversa ou
     * contexto, ou este aparelho não estava no grupo naquela época.
     */
    async abrir(conversa: string, corpo: string, contexto: string): Promise<{ texto: string; epoca: number } | null> {
      const partes = FORMATO_M1.exec(corpo);
      if (!partes) return null;
      const epoca = Number(partes[1]);
      let s = await motor.segredosDe(conversa, epoca);
      if (!s && (epoca > (epocaLocal.get(conversa) ?? 0) || Date.now() - (acertadoEm.get(conversa) ?? 0) > 10_000)) {
        await acertar(conversa).catch(() => null);
        s = await motor.segredosDe(conversa, epoca);
      }
      if (!s) return null;
      const aberto = await abrirSelado(s.conteudo, deB64Url(partes[2]), encoder.encode(dadosDaMensagem(conversa, epoca, contexto)));
      if (!aberto) return null;
      try {
        return { texto: new TextDecoder("utf-8", { fatal: true }).decode(tirarPreenchimento(aberto)), epoca };
      } catch {
        return null;
      }
    },

    /** As conversas em que há aparelho aprovado de colega esperando entrar no grupo (para acertar sem esperar alguém escrever). */
    pendentes: () => o.chamar<string[]>("equipe_mls_pendentes", { p_aparelho: o.aparelho }),

    /** Acerta o grupo da conversa (põe aparelhos novos, tira quem saiu), sem escrever nada. */
    sincronizar: (conversa: string) => acertar(conversa),

    /** Esquece a conversa neste aparelho (o estado do MLS e os segredos guardados). */
    esquecer: (conversa: string) => motor.esquecer(conversa),
  };
}

export type MlsDaEquipe = ReturnType<typeof criarMlsDaEquipe>;

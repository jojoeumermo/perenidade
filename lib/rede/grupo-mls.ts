// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lado do APARELHO dos grupos cifrados da Alumia (núcleos e comunidades fechadas) em MLS (RFC 9420), pela biblioteca ts-mls,
// com a suíte híbrida MLS_256_XWING_AES256GCM_SHA512_Ed25519: a troca de chaves junta X25519 e ML-KEM-768 (quem quebrar só um dos
// dois, um computador quântico, por exemplo, não abre nada). O banco é supabase/migracoes/20261113-rede-grupos-mls.sql; o
// documento, docs/rede/POSTS-RESTRITOS.md.
//
// O que o MLS dá: cada entrada e saída do grupo é um "commit" que leva o grupo a uma época nova, com segredo novo. Quem saiu não
// lê o que vem depois; quem entrou não lê o que veio antes; e um aparelho tomado deixa de servir assim que o grupo avança (é a
// "segurança depois do comprometimento", que as sender keys do Signal em grupo não dão).
//
// Os posts: o segredo de cada época dá, pelo "exporter" do MLS (RFC 9420, seção 8.5), uma chave de 32 bytes só para posts
// daquele grupo naquela época. O post vai em AES-GCM-256 com essa chave, num bloco de tamanho fixo (o mesmo do chat), amarrado ao
// grupo, à época e a quem escreveu: "p2.<época>.<vetor>.<cifrado>". O aparelho guarda a chave de cada época que viu, para reler.
//
// O servidor decide quem é do grupo (os membros do núcleo ou da comunidade), mas não consegue pôr uma chave falsa no lugar de
// ninguém sem o aparelho notar: cada aparelho guarda, na primeira vez, a chave de assinatura de cada pessoa ("confiar na primeira
// vez") e recusa escrever num grupo em que alguém aparece com outra chave ("grupo_suspeito"). Cada conta tem UMA chave de
// assinatura neste aparelho, usada em todos os pacotes.
//
// `criarChaveiroDeGrupo` recebe como chamar o banco e onde guardar (no navegador, o IndexedDB próprio que o "Sair rápido" apaga;
// nos testes, a memória). Sem "@/".
import type * as MlsTipos from "ts-mls";
import { preencher, tirarPreenchimento } from "./chat/padding";

type Mls = typeof import("ts-mls");
let carregado: Promise<{ M: Mls; impl: MlsTipos.CiphersuiteImpl }> | null = null;
/** A suíte dos grupos: troca de chaves híbrida X-Wing (X25519 + ML-KEM-768), AES-256-GCM, SHA-512, assinatura Ed25519. */
export const SUITE = "MLS_256_XWING_AES256GCM_SHA512_Ed25519";
function biblioteca() {
  carregado ??= import("ts-mls").then(async (M) => ({ M, impl: await M.getCiphersuiteImpl(M.getCiphersuiteFromName(SUITE)) }));
  return carregado;
}

export type ChamarOBanco = <T>(funcao: string, argumentos: Record<string, unknown>) => Promise<T>;
/** Onde o aparelho guarda (chave → valor). No navegador, um IndexedDB próprio; nos testes, a memória. */
export interface GuardaDoGrupo {
  ler: <T>(chave: string) => Promise<T | null>;
  guardar: (chave: string, valor: unknown) => Promise<void>;
  apagar: (chave: string) => Promise<void>;
}

interface EstadoNoBanco {
  epoca: number | null;
  membros: string[];
  commits: { epoca: number; commit: string }[];
  info: { epoca: number; info: string } | null;
  boasvindas: { epoca: number; welcome: string } | null;
}

/** Minha chave de assinatura e meus pacotes guardados (a parte privada de cada um, para entrar por boas-vindas). */
interface MinhaConta {
  assinatura: { signKey: Uint8Array; publicKey: Uint8Array };
  pacotes: { publico: string; privado: MlsTipos.PrivateKeyPackage; criado: number }[];
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// base64 padrão (o banco aceita [A-Za-z0-9+/=]) e base64url sem "=" (no corpo do post), sem Buffer.
function paraB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function deB64(texto: string): Uint8Array {
  const s = atob(texto);
  const saida = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) saida[i] = s.charCodeAt(i);
  return saida;
}
const paraB64Url = (bytes: Uint8Array) => paraB64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const deB64Url = (texto: string) => deB64(texto.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (texto.length % 4)) % 4));
const iguais = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((x, i) => x === b[i]);

const FORMATO_P2 = /^p2\.([1-9][0-9]{0,8})\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]+)$/;
export const contextoDoPostMls = (grupo: string, epoca: number, autor: string) => `alumia-grupo:p2:${grupo}:e${epoca}:${autor}`;
/** A época de um post "p2" (null se não é um). */
export function epocaDoPost(corpo: string): number | null {
  const m = FORMATO_P2.exec(corpo);
  return m ? Number(m[1]) : null;
}

const erro = (codigo: string) => Object.assign(new Error(codigo), { code: codigo });
const codigoDe = (e: unknown) => String((e as { message?: unknown })?.message ?? e);

export function criarChaveiroDeGrupo({ chamar, guarda }: { chamar: ChamarOBanco; guarda: GuardaDoGrupo }) {
  /** Uma operação por grupo por vez (duas abas, dois posts ao mesmo tempo). */
  const filas = new Map<string, Promise<unknown>>();
  function naFila<T>(chave: string, fazer: () => Promise<T>): Promise<T> {
    const antes = filas.get(chave) ?? Promise.resolve();
    const vez = antes.then(fazer, fazer);
    filas.set(chave, vez.catch(() => undefined));
    return vez;
  }
  /** As chaves de post abertas nesta aba: grupo → época → chave. */
  const chaves = new Map<string, Map<number, CryptoKey>>();

  const kConta = (u: string) => `conta:${u}`;
  const kEstado = (u: string, g: string) => `estado:${u}:${g}`;
  const kChaves = (u: string, g: string) => `chaves:${u}:${g}`;
  const kConhecidas = (u: string) => `conhecidas:${u}`;

  async function minhaConta(usuario: string): Promise<MinhaConta> {
    const guardada = await guarda.ler<MinhaConta>(kConta(usuario));
    if (guardada) return guardada;
    const { impl } = await biblioteca();
    const par = await impl.signature.keygen();
    const conta: MinhaConta = { assinatura: { signKey: par.signKey, publicKey: par.publicKey }, pacotes: [] };
    await guarda.guardar(kConta(usuario), conta);
    return conta;
  }

  /** Garante pacotes de chave publicados (repõe quando há menos de 5 no banco). */
  async function preparar(usuario: string): Promise<void> {
    const conta = await minhaConta(usuario);
    const { pacotes } = await chamar<{ pacotes: number }>("rede_mls_meus_pacotes", {});
    if (pacotes >= 5) return;
    const { M, impl } = await biblioteca();
    const novos: MinhaConta["pacotes"] = [];
    for (let i = 0; i < 10; i++) {
      const kp = await M.generateKeyPackageWithKey({ credentialType: "basic", identity: encoder.encode(usuario) }, M.defaultCapabilities(), M.defaultLifetime, [], conta.assinatura, impl);
      novos.push({ publico: paraB64(M.encodeMlsMessage({ keyPackage: kp.publicPackage, wireformat: "mls_key_package", version: "mls10" })), privado: kp.privatePackage, criado: Date.now() });
    }
    await chamar("rede_mls_pacotes_publicar", { p_pacotes: novos.map((p) => p.publico) });
    // Fica a parte privada dos 40 mais novos (os outros já foram usados ou não serão mais).
    conta.pacotes = [...conta.pacotes, ...novos].slice(-40);
    await guarda.guardar(kConta(usuario), conta);
  }

  async function lerEstado(usuario: string, grupo: string): Promise<MlsTipos.ClientState | null> {
    const b64 = await guarda.ler<string>(kEstado(usuario, grupo));
    if (!b64) return null;
    const { M, impl } = await biblioteca();
    const lido = M.decodeGroupState(deB64(b64), 0);
    if (!lido) return null;
    const [estado] = lido;
    const clientConfig: MlsTipos.ClientConfig = {
      keyRetentionConfig: M.defaultKeyRetentionConfig,
      lifetimeConfig: M.defaultLifetimeConfig,
      keyPackageEqualityConfig: M.defaultKeyPackageEqualityConfig,
      paddingConfig: M.defaultPaddingConfig,
      authService: M.defaultAuthenticationService,
    };
    void impl;
    return { ...estado, clientConfig };
  }

  async function guardarEstado(usuario: string, grupo: string, estado: MlsTipos.ClientState | null) {
    if (!estado) return guarda.apagar(kEstado(usuario, grupo));
    const { M } = await biblioteca();
    await guarda.guardar(kEstado(usuario, grupo), paraB64(M.encodeGroupState(estado)));
    await anotarChaveDaEpoca(usuario, grupo, estado);
  }

  /** A chave de posts da época atual do estado (pelo exporter do MLS), guardada para reler depois. */
  async function anotarChaveDaEpoca(usuario: string, grupo: string, estado: MlsTipos.ClientState) {
    const { M, impl } = await biblioteca();
    const epoca = Number(estado.groupContext.epoch);
    const guardadas = (await guarda.ler<Record<string, string>>(kChaves(usuario, grupo))) ?? {};
    if (!guardadas[epoca]) {
      const bruta = await M.mlsExporter(estado.keySchedule.exporterSecret, "alumia:post:1", encoder.encode(grupo), 32, impl);
      guardadas[epoca] = paraB64(bruta);
      bruta.fill(0);
      await guarda.guardar(kChaves(usuario, grupo), guardadas);
    }
  }

  async function chaveDoPost(usuario: string, grupo: string, epoca: number): Promise<CryptoKey | null> {
    const abertas = chaves.get(grupo) ?? new Map<number, CryptoKey>();
    chaves.set(grupo, abertas);
    const ja = abertas.get(epoca);
    if (ja) return ja;
    const guardadas = (await guarda.ler<Record<string, string>>(kChaves(usuario, grupo))) ?? {};
    if (!guardadas[epoca]) return null;
    const bruta = deB64(guardadas[epoca]);
    const chave = await crypto.subtle.importKey("raw", bruta as Uint8Array<ArrayBuffer>, "AES-GCM", false, ["encrypt", "decrypt"]);
    bruta.fill(0);
    abertas.set(epoca, chave);
    return chave;
  }

  /** As pessoas (id) e a chave de assinatura de cada folha da árvore do grupo. */
  function folhas(estado: MlsTipos.ClientState): { indice: number; usuario: string; assinatura: Uint8Array }[] {
    const saida: { indice: number; usuario: string; assinatura: Uint8Array }[] = [];
    estado.ratchetTree.forEach((no, i) => {
      if (no?.nodeType !== "leaf") return;
      const leaf = no.leaf as unknown as { credential: { identity: Uint8Array }; signaturePublicKey: Uint8Array };
      saida.push({ indice: i / 2, usuario: decoder.decode(leaf.credential.identity), assinatura: leaf.signaturePublicKey });
    });
    return saida;
  }

  /**
   * Confere a árvore: cada folha é de alguém que o servidor diz ser do grupo (ou que está saindo agora), e a chave de assinatura
   * de cada pessoa é a que este aparelho guardou na primeira vez (guarda as novas). Devolve false se algo não confere.
   */
  async function arvoreConfere(usuario: string, estado: MlsTipos.ClientState, membros: string[], minha: Uint8Array): Promise<boolean> {
    const conhecidas = (await guarda.ler<Record<string, string>>(kConhecidas(usuario))) ?? {};
    let mudou = false;
    const vistas = new Set<string>();
    for (const f of folhas(estado)) {
      if (vistas.has(f.usuario)) return false; // a mesma pessoa duas vezes no grupo
      vistas.add(f.usuario);
      if (f.usuario === usuario) {
        if (!iguais(f.assinatura, minha)) return false;
        continue;
      }
      const conhecida = conhecidas[f.usuario];
      if (conhecida && conhecida !== paraB64(f.assinatura)) return false;
      if (!conhecida) {
        conhecidas[f.usuario] = paraB64(f.assinatura);
        mudou = true;
      }
    }
    if (mudou) await guarda.guardar(kConhecidas(usuario), conhecidas);
    return membros.includes(usuario);
  }

  /** Entra no grupo pelas boas-vindas, tentando cada pacote guardado (só o certo abre). */
  async function entrarPorBoasVindas(conta: MinhaConta, grupo: string, welcome: string): Promise<MlsTipos.ClientState | null> {
    const { M, impl } = await biblioteca();
    const lido = M.decodeMlsMessage(deB64(welcome), 0)?.[0];
    if (!lido || lido.wireformat !== "mls_welcome") return null;
    for (const p of [...conta.pacotes].reverse()) {
      const kp = M.decodeMlsMessage(deB64(p.publico), 0)?.[0];
      if (!kp || kp.wireformat !== "mls_key_package") continue;
      try {
        const estado = await M.joinGroup(lido.welcome, kp.keyPackage, p.privado, M.emptyPskIndex, impl);
        if (decoder.decode(estado.groupContext.groupId) !== grupo) return null;
        return estado;
      } catch {
        // não era este pacote
      }
    }
    return null;
  }

  /** Grava um commit no banco; devolve false se outra pessoa gravou a mesma época antes ("versao_ocupada"). */
  async function gravarCommit(grupo: string, novo: MlsTipos.ClientState, commit: Uint8Array, boasvindas: { para: string; welcome: string }[]): Promise<boolean> {
    const { M, impl } = await biblioteca();
    const info = await M.createGroupInfoWithExternalPubAndRatchetTree(novo, [], impl);
    try {
      await chamar("rede_mls_commit", {
        p_grupo: grupo,
        p_epoca: Number(novo.groupContext.epoch),
        p_commit: paraB64(commit),
        p_info: paraB64(M.encodeMlsMessage({ groupInfo: info, wireformat: "mls_group_info", version: "mls10" })),
        p_boasvindas: boasvindas,
      });
      return true;
    } catch (e) {
      if (codigoDe(e).includes("versao_ocupada")) return false;
      throw e;
    }
  }

  /**
   * Leva o grupo deste aparelho à época atual do banco e acerta quem está nele com quem o servidor diz ser membro. Devolve o
   * estado (ou null se esta pessoa não está no grupo e não conseguiu entrar).
   */
  async function sincronizar(usuario: string, grupo: string): Promise<MlsTipos.ClientState | null> {
    const { M, impl } = await biblioteca();
    const conta = await minhaConta(usuario);
    for (let volta = 0; volta < 6; volta++) {
      let estado = await lerEstado(usuario, grupo);
      const banco = await chamar<EstadoNoBanco>("rede_mls_estado", { p_grupo: grupo, p_desde: estado ? Number(estado.groupContext.epoch) : 0 });
      // 1. Sem estado aqui: entra pelas boas-vindas, ou sozinho pela GroupInfo, ou cria o grupo.
      if (!estado && banco.boasvindas && banco.epoca !== null) {
        estado = await entrarPorBoasVindas(conta, grupo, banco.boasvindas.welcome);
        if (estado) {
          await guardarEstado(usuario, grupo, estado);
          continue; // lê de novo, agora a partir da época das boas-vindas
        }
      }
      if (!estado && banco.info) {
        const info = M.decodeMlsMessage(deB64(banco.info.info), 0)?.[0];
        if (!info || info.wireformat !== "mls_group_info") throw erro("grupo_invalido");
        const kp = await M.generateKeyPackageWithKey({ credentialType: "basic", identity: encoder.encode(usuario) }, M.defaultCapabilities(), M.defaultLifetime, [], conta.assinatura, impl);
        const r = await M.joinGroupExternal(info.groupInfo, kp.publicPackage, kp.privatePackage, false, impl);
        if (decoder.decode(r.newState.groupContext.groupId) !== grupo) throw erro("grupo_invalido");
        if (!(await arvoreConfere(usuario, r.newState, banco.membros, conta.assinatura.publicKey))) throw erro("grupo_suspeito");
        const commit = M.encodeMlsMessage({ publicMessage: r.publicMessage, wireformat: "mls_public_message", version: "mls10" });
        if (await gravarCommit(grupo, r.newState, commit, [])) await guardarEstado(usuario, grupo, r.newState);
        continue;
      }
      if (!estado && banco.epoca === null) {
        const kp = await M.generateKeyPackageWithKey({ credentialType: "basic", identity: encoder.encode(usuario) }, M.defaultCapabilities(), M.defaultLifetime, [], conta.assinatura, impl);
        estado = await M.createGroup(encoder.encode(grupo), kp.publicPackage, kp.privatePackage, [], impl);
        // O grupo só existe no banco depois do primeiro commit (o de baixo, que põe os outros membros).
      }
      if (!estado) return null;
      // 2. Os commits que faltam, em ordem.
      let saiu = false;
      for (const c of banco.commits) {
        const atual = Number(estado.groupContext.epoch);
        if (c.epoca <= atual) continue;
        if (c.epoca !== atual + 1) break; // buraco no registro: abaixo, entra de novo
        const msg = M.decodeMlsMessage(deB64(c.commit), 0)?.[0];
        if (!msg || (msg.wireformat !== "mls_public_message" && msg.wireformat !== "mls_private_message")) throw erro("grupo_invalido");
        const r = await M.processMessage(msg, estado, M.emptyPskIndex, M.acceptAll, impl);
        estado = r.newState;
        if ((estado as unknown as { groupActiveState?: { kind: string } }).groupActiveState?.kind === "removedFromGroup") {
          saiu = true;
          break;
        }
        await guardarEstado(usuario, grupo, estado);
      }
      const atual = Number(estado.groupContext.epoch);
      if (saiu || (banco.epoca !== null && atual < banco.epoca && banco.commits.every((c) => c.epoca !== atual + 1))) {
        // Saí do grupo, ou fiquei para trás além do registro: esquece o estado e entra de novo (se ainda for membro).
        await guardarEstado(usuario, grupo, null);
        if (!banco.membros.includes(usuario)) return null;
        continue;
      }
      if (banco.epoca !== null && atual < banco.epoca) continue; // há mais commits (mais de 200)
      if (!(await arvoreConfere(usuario, estado, banco.membros, conta.assinatura.publicKey))) throw erro("grupo_suspeito");
      // 3. Quem entrou e quem saiu do núcleo ou da comunidade desde a última época.
      const naArvore = folhas(estado);
      const entrar = banco.membros.filter((m) => m !== usuario && !naArvore.some((f) => f.usuario === m));
      const sair = naArvore.filter((f) => f.usuario !== usuario && !banco.membros.includes(f.usuario));
      const pacotes = entrar.length ? await chamar<Record<string, string>>("rede_mls_pacotes_pegar", { p_grupo: grupo, p_usuarios: entrar }) : {};
      const propostas: MlsTipos.Proposal[] = sair.map((f) => ({ proposalType: "remove", remove: { removed: f.indice } }) as MlsTipos.Proposal);
      const postos: string[] = [];
      for (const [quem, b64] of Object.entries(pacotes)) {
        const kp = M.decodeMlsMessage(deB64(b64), 0)?.[0];
        if (!kp || kp.wireformat !== "mls_key_package" || decoder.decode((kp.keyPackage.leafNode.credential as unknown as { identity: Uint8Array }).identity) !== quem) continue;
        propostas.push({ proposalType: "add", add: { keyPackage: kp.keyPackage } } as MlsTipos.Proposal);
        postos.push(quem);
      }
      const novoGrupo = banco.epoca === null;
      if (!propostas.length && !novoGrupo) return estado;
      const r = await M.createCommit({ state: estado, cipherSuite: impl }, { extraProposals: propostas, ratchetTreeExtension: true });
      if (!(await arvoreConfere(usuario, r.newState, banco.membros, conta.assinatura.publicKey))) throw erro("grupo_suspeito");
      const welcome = r.welcome ? paraB64(M.encodeMlsMessage({ welcome: r.welcome, wireformat: "mls_welcome", version: "mls10" })) : null;
      const ok = await gravarCommit(grupo, r.newState, M.encodeMlsMessage(r.commit), welcome ? postos.map((para) => ({ para, welcome })) : []);
      r.consumed.forEach(M.zeroOutUint8Array);
      if (!ok) {
        // Outra pessoa avançou o grupo antes: lê o que ela fez e confere de novo.
        if (novoGrupo) await guardarEstado(usuario, grupo, null);
        continue;
      }
      await guardarEstado(usuario, grupo, r.newState);
      return r.newState;
    }
    throw erro("versao_ocupada");
  }

  return {
    /** Garante a chave de assinatura e os pacotes de chave desta pessoa (cria e publica na primeira vez). */
    preparar: (usuario: string) => preparar(usuario),

    /** Cifra um post para o grupo, na época atual (acertando antes quem entrou e quem saiu). */
    cifrar: (grupo: string, usuario: string, texto: string) =>
      naFila(`${usuario}:${grupo}`, async () => {
        await preparar(usuario);
        const estado = await sincronizar(usuario, grupo);
        if (!estado) throw erro("sem_chave");
        const epoca = Number(estado.groupContext.epoch);
        const chave = await chaveDoPost(usuario, grupo, epoca);
        if (!chave) throw erro("sem_chave");
        const bloco = preencher(encoder.encode(texto));
        const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
        try {
          const fechado = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(contextoDoPostMls(grupo, epoca, usuario)) }, chave, bloco as Uint8Array<ArrayBuffer>);
          return `p2.${epoca}.${paraB64Url(iv)}.${paraB64Url(new Uint8Array(fechado))}`;
        } finally {
          bloco.fill(0);
        }
      }),

    /** Abre um post do grupo (null se esta pessoa não estava no grupo naquela época, ou se o post foi mexido). */
    abrir: (grupo: string, usuario: string, autor: string, corpo: string) =>
      naFila(`${usuario}:${grupo}`, async () => {
        const partes = FORMATO_P2.exec(corpo);
        if (!partes) return null;
        const epoca = Number(partes[1]);
        let chave = await chaveDoPost(usuario, grupo, epoca);
        if (!chave) {
          await sincronizar(usuario, grupo).catch(() => null);
          chave = await chaveDoPost(usuario, grupo, epoca);
        }
        if (!chave) return null;
        try {
          const aberto = await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64Url(partes[2]) as Uint8Array<ArrayBuffer>, additionalData: encoder.encode(contextoDoPostMls(grupo, epoca, autor)) }, chave, deB64Url(partes[3]) as Uint8Array<ArrayBuffer>);
          return new TextDecoder("utf-8", { fatal: true }).decode(tirarPreenchimento(new Uint8Array(aberto)));
        } catch {
          return null;
        }
      }),

    /** Esquece as chaves da memória (o "Sair rápido" chama). */
    esquecer: () => chaves.clear(),
  };
}

export type ChaveiroDeGrupo = ReturnType<typeof criarChaveiroDeGrupo>;

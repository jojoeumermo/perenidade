// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O chaveiro dos grupos cifrados da REDE (núcleos e comunidades fechadas): posts restritos "p2" e a chave das salas de voz, em MLS
// pelo OpenMLS (@wireapp/core-crypto) na suíte híbrida ML-KEM-768 + X25519. O banco é supabase/migracoes/20261124-r2-grupos.sql; o
// documento, docs/rede/POSTS-RESTRITOS.md. A interface para as telas é a de antes (preparar, cifrar, abrir, chaveDeVoz, esquecer).
//
// Os posts: o segredo de cada época dá (epoca.ts) uma chave só para posts daquele grupo naquela época. O post vai em AES-GCM-256
// (WebCrypto) num bloco de tamanho fixo (o mesmo do chat), amarrado ao grupo, à época e a quem escreveu: "p2.<época>.<vetor>.<cifrado>".
// O aparelho guarda o segredo de cada época que viu, para reler; quem não estava no grupo naquela época não abre.
//
// A política: cada aparelho é uma folha com nome próprio ("<conta>:<aparelho>@alumia.invalid"). Onda R3 (14): cada folha leva um
// CERTIFICADO assinado pela identidade da conta (certificado.ts), publicado com os pacotes de chave; antes de pôr uma folha no grupo
// (e ao conferir a árvore), este aparelho confere o certificado E que a identidade dele é a que o registro público de chaves mostra
// para a conta (a fonte da identidade, lib/rede/voto/identidade.ts). Sem isso, o servidor podia inventar um aparelho-fantasma de uma
// conta listada; agora ele precisaria da identidade da pessoa. Depois de aceita, a chave de cada folha fica guardada ("confiar na
// primeira vez") e uma folha conhecida com outra chave derruba o grupo ("grupo_suspeito"). Conta já vista com um aparelho NOVO
// (certificado pela identidade dela) entra e deixa um AVISO FORTE ("avisos"), que a tela mostra no compositor até a pessoa marcar
// que viu: quem tem a identidade (a pessoa, ou quem tomou um aparelho dela) pode ligar aparelhos; o aviso diz isso. Regra de troca
// de chave equivalente à do Megolm que saiu: a própria folha é renovada (commit de troca de chave) quando faz 7 dias da última troca
// ou 100 posts na mesma época.
// Sem "@/": roda no Node nos testes.
import type { CoreCrypto } from "@wireapp/core-crypto";
import { preencher, tirarPreenchimento } from "../chat/padding";
import type { FonteDaIdentidade } from "../voto/identidade";
import { prepararAparelho, type AparelhoMls, type Motor } from "./aparelho";
import { certificadoDaFolhaConfere, lerCertificado, montarCertificado, textoDaFolha } from "./certificado";
import { chaveDaSala } from "./epoca";
import { criarMotorDeGrupo, type GuardaDoGrupo, idDoGrupo, type MotorDeGrupo, type TransporteDeGrupo } from "./motor-de-grupo";
import { lerPacote } from "./pacote";
import { ROTULOS } from "./rotulos-do-motor";

export type { GuardaDoGrupo };
export type ChamarOBanco = <T>(funcao: string, argumentos: Record<string, unknown>) => Promise<T>;
/** Abre a instância do motor desta conta (no navegador, a loja cifrada; nos testes, a memória). */
export type AbrirMotor = (usuario: string) => Promise<{ M: Motor; cc: CoreCrypto }>;
/** A identidade da conta (a do chat, a do registro público): assina o certificado da folha e confere a identidade de outra conta. */
export type IdentidadeDaConta = () => Promise<FonteDaIdentidade | null>;
/** Um aviso de aparelho novo de conta já vista. `trocada`: a identidade da conta também é outra (a registrada mudou). */
export interface AvisoDeAparelho {
  usuario: string;
  dia: string;
  forte: true;
  trocada: boolean;
  visto?: boolean;
}

const encoder = new TextEncoder();
const FORMATO_P2 = /^p2\.([1-9][0-9]{0,8})\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]+)$/;
/** Troca de chave da própria folha: a cada 7 dias ou 100 posts na mesma época. */
const RENOVAR_DIAS = 7;
const RENOVAR_POSTS = 100;
/** Quantos pacotes de chave ficam publicados (repõe quando há menos de 5). */
const PACOTES = 10;

export const contextoDoPostMls = (grupo: string, epoca: number, autor: string) => `${ROTULOS.post}|${grupo}|e${epoca}|${autor}`;
/** A época de um post "p2" (null se não é um). */
export function epocaDoPost(corpo: string): number | null {
  const m = FORMATO_P2.exec(corpo);
  return m ? Number(m[1]) : null;
}

function paraB64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
const deB64 = (texto: string) => Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));
const paraB64Url = (bytes: Uint8Array) => paraB64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const deB64Url = (texto: string) => deB64(texto.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (texto.length % 4)) % 4));
const erro = (codigo: string) => Object.assign(new Error(codigo), { code: codigo });
/** base64 (o do banco) → bytes, ou null se não for base64. */
function deB64Seguro(texto: string | undefined): Uint8Array | null {
  if (typeof texto !== "string" || !/^[A-Za-z0-9+/]+={0,2}$/.test(texto)) return null;
  try {
    return deB64(texto);
  } catch {
    return null;
  }
}
function iguais(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
const codigoDe = (e: unknown) => String((e as { message?: unknown })?.message ?? e);

async function chaveAes(bruta: Uint8Array): Promise<CryptoKey> {
  try {
    return await crypto.subtle.importKey("raw", bruta as Uint8Array<ArrayBuffer>, "AES-GCM", false, ["encrypt", "decrypt"]);
  } finally {
    bruta.fill(0);
  }
}

/** O que o banco disse por último de cada grupo a este aparelho (para pedir para entrar de novo). */
interface Visto {
  epoca: number | null;
  folhas: string[];
  boasvindas: number;
}

/** O transporte dos grupos da rede pelas funções do banco (20261124-r2-grupos.sql). `nome`: a folha deste aparelho. */
function transporteDoBanco(chamar: ChamarOBanco, nome: () => Promise<string>, vistos: Map<string, Visto>, certificados: Map<string, string>): TransporteDeGrupo {
  return {
    async estado(grupo, desde) {
      const r = await chamar<{ epoca: number | null; membros: string[]; folhas: string[]; certificados?: Record<string, string>; commits: { epoca: number; commit: string }[]; boasvindas: { epoca: number; welcome: string } | null; reentrar?: string[] }>("rede_mls_estado", { p_grupo: grupo, p_nome: await nome(), p_desde: desde });
      vistos.set(grupo, { epoca: r.epoca, folhas: r.folhas, boasvindas: r.boasvindas?.epoca ?? 0 });
      // O certificado de cada folha listada (onda R3): a política confere antes de pôr a folha no grupo e ao conferir a árvore.
      for (const [n, c] of Object.entries(r.certificados ?? {})) if (typeof c === "string") certificados.set(n, c);
      return {
        epoca: r.epoca,
        membros: r.membros,
        folhas: r.folhas,
        commits: r.commits.map((c) => ({ epoca: c.epoca, corpo: deB64(c.commit) })),
        boasvindas: r.boasvindas ? { epoca: r.boasvindas.epoca, welcome: deB64(r.boasvindas.welcome) } : null,
        reentrar: r.reentrar ?? [],
      };
    },
    async pacotes(grupo, faltam) {
      const r = await chamar<Record<string, string>>("rede_mls_pacotes_pegar", { p_grupo: grupo, p_nomes: faltam });
      return Object.entries(r).map(([para, pacote]) => ({ para, pacote: deB64(pacote) }));
    },
    async gravarCommit(grupo, epoca, corpo, boasvindas) {
      try {
        await chamar("rede_mls_commit", { p_grupo: grupo, p_epoca: epoca, p_commit: paraB64(corpo), p_boasvindas: boasvindas.map((b) => ({ para: b.para, welcome: paraB64(b.welcome) })) });
        return "ok";
      } catch (e) {
        if (codigoDe(e).includes("versao_ocupada")) return "ocupada";
        throw e;
      }
    },
  };
}

export function criarChaveiroDeGrupo({ chamar, guarda, abrirMotor, identidade }: { chamar: ChamarOBanco; guarda: GuardaDoGrupo; abrirMotor: AbrirMotor; identidade: IdentidadeDaConta }) {
  const aparelhos = new Map<string, Promise<AparelhoMls>>();
  const motores = new Map<string, MotorDeGrupo>();
  /** As chaves de post abertas nesta aba: grupo → época → chave. */
  const chaves = new Map<string, Map<number, CryptoKey>>();
  const kConhecidas = (u: string) => `conhecidas:${u}`;
  const kAvisos = (u: string) => `avisos:${u}`;
  /** A identidade com que cada conta já foi vista neste aparelho (para dizer no aviso se ela mudou). */
  const kIdentidades = (u: string) => `identidades:${u}`;
  /** O certificado de cada folha, como o banco deu por último (por conta desta aba). */
  const certificadosDe = new Map<string, Map<string, string>>();
  const certificados = (u: string) => {
    let m = certificadosDe.get(u);
    if (!m) certificadosDe.set(u, (m = new Map()));
    return m;
  };
  const kRenovado = (u: string, g: string) => `renovado:${u}:${g}`;
  /** O que o banco disse por último de cada grupo, por conta; e quando cada conta pediu para entrar de novo em cada grupo. */
  const vistos = new Map<string, Map<string, Visto>>();
  const pedidoEm = new Map<string, number>();
  const vistosDe = (u: string) => {
    let m = vistos.get(u);
    if (!m) vistos.set(u, (m = new Map()));
    return m;
  };

  function aparelhoDe(usuario: string): Promise<AparelhoMls> {
    let a = aparelhos.get(usuario);
    if (!a) {
      a = abrirMotor(usuario).then(({ M, cc }) => prepararAparelho(M, cc, usuario));
      a.catch(() => aparelhos.delete(usuario));
      aparelhos.set(usuario, a);
    }
    return a;
  }

  function motorDe(usuario: string): MotorDeGrupo {
    let m = motores.get(usuario);
    if (!m) {
      m = criarMotorDeGrupo({
        tipo: "grupo",
        aparelho: () => aparelhoDe(usuario),
        transporte: transporteDoBanco(chamar, async () => (await aparelhoDe(usuario)).eu.nome, vistosDe(usuario), certificados(usuario)),
        // Os segredos de época de cada conta com o nome dela na frente: outra conta no mesmo navegador não lê os desta.
        guarda: { ler: (k) => guarda.ler(`${usuario}:${k}`), guardar: (k, v) => guarda.guardar(`${usuario}:${k}`, v), apagar: (k) => guarda.apagar(`${usuario}:${k}`) },
        politica: {
          // 1. O certificado da folha (onda R3): a identidade da conta assinou esta folha com esta chave. Sem certificado, com
          //    certificado de outra conta, de outra folha ou de outra chave: recusada.
          // 2. Folha já aceita antes: vale a chave vista na primeira vez (outra chave é recusada).
          // 3. Folha nova: a identidade do certificado tem de ser a que o registro público mostra para a conta (conferida neste
          //    aparelho). Conta já vista com aparelho novo: entra com aviso forte.
          async aceitarFolha(f) {
            const cert = lerCertificado(deB64Seguro(certificados(usuario).get(f.nome)));
            if (!cert || !certificadoDaFolhaConfere(cert, f.usuario, f.nome, f.impressao)) return false;
            const conhecidas = (await guarda.ler<Record<string, string>>(kConhecidas(usuario))) ?? {};
            if (conhecidas[f.nome]) return conhecidas[f.nome] === f.impressao;
            const fonte = await identidade();
            if (!fonte) throw erro("sem_identidade");
            const noRegistro = await fonte.conferir(f.usuario, cert.identidade);
            // Registro fora do ar ou que não fecha: não decide agora (tenta na próxima vez). Identidade diferente da registrada: recusa.
            if (noRegistro === "nao_conferida") throw erro("sem_registro");
            if (noRegistro !== "conferida") return false;
            const identidades = (await guarda.ler<Record<string, string>>(kIdentidades(usuario))) ?? {};
            const idDaConta = paraB64(cert.identidade);
            const contaConhecida = Object.keys(conhecidas).some((n) => n.startsWith(`${f.usuario}:`));
            const trocada = identidades[f.usuario] !== undefined && identidades[f.usuario] !== idDaConta;
            conhecidas[f.nome] = f.impressao;
            identidades[f.usuario] = idDaConta;
            await guarda.guardar(kConhecidas(usuario), conhecidas);
            await guarda.guardar(kIdentidades(usuario), identidades);
            if (contaConhecida && f.usuario !== usuario) {
              const avisos = (await guarda.ler<AvisoDeAparelho[]>(kAvisos(usuario))) ?? [];
              avisos.push({ usuario: f.usuario, dia: new Date().toISOString().slice(0, 10), forte: true, trocada });
              await guarda.guardar(kAvisos(usuario), avisos.slice(-50));
            }
            return true;
          },
        },
      });
      motores.set(usuario, m);
    }
    return m;
  }

  /**
   * Acerta o grupo. Se o grupo existe, a folha deste aparelho está listada e ele ficou sem o grupo (as boas-vindas venceram em 30
   * dias, ou falharam), pede ao banco para entrar de novo (um pedido por minuto): o próximo membro que acertar a árvore tira a folha e
   * põe de novo, com boas-vindas novas.
   */
  async function sincronizar(usuario: string, grupo: string) {
    const r = await motorDe(usuario).sincronizar(grupo);
    if (r) return r;
    const visto = vistosDe(usuario).get(grupo);
    const nome = await motorDe(usuario).nome();
    const chave = `${usuario}:${grupo}`;
    if (visto && visto.epoca !== null && visto.folhas.includes(nome) && Date.now() - (pedidoEm.get(chave) ?? 0) > 60_000) {
      pedidoEm.set(chave, Date.now());
      await chamar("rede_mls_reentrar", { p_grupo: grupo, p_nome: nome, p_visto: visto.boasvindas }).catch(() => undefined);
    }
    return null;
  }

  /**
   * Garante a folha deste aparelho publicada, com o certificado assinado pela identidade da conta (onda R3), e pacotes de chave dela
   * (repõe quando há menos de 5 no banco). Sem a identidade neste aparelho (o chat ainda não foi ligado aqui): "sem_identidade".
   */
  async function preparar(usuario: string): Promise<void> {
    const nome = await motorDe(usuario).nome();
    const fonte = await identidade();
    const minha = fonte ? await fonte.minha() : null;
    if (!minha || minha.usuario !== usuario) throw erro("sem_identidade");
    const r = await chamar<{ pacotes: number; certificado?: string | null }>("rede_mls_meus_pacotes", { p_nome: nome });
    const atual = lerCertificado(deB64Seguro(r.certificado ?? undefined));
    const certificadoOk = !!atual && iguais(atual.identidade, minha.publica);
    if (r.pacotes >= 5 && certificadoOk) return;
    // Pelo menos um pacote novo: é dele que sai a impressão da chave da folha (a mesma em todos os pacotes desta folha).
    const novos = await motorDe(usuario).gerarPacotes(Math.max(1, PACOTES - r.pacotes));
    const lido = lerPacote(novos[0]);
    if (!lido || lido.nome !== nome) throw erro("sem_chave");
    const certificado = montarCertificado(minha.publica, await minha.assinar(textoDaFolha(usuario, nome, lido.impressao)));
    await chamar("rede_mls_publicar", { p_nome: nome, p_pacotes: novos.map(paraB64), p_certificado: paraB64(certificado) });
  }

  async function chaveDoPost(usuario: string, grupo: string, epoca: number): Promise<CryptoKey | null> {
    const abertas = chaves.get(grupo) ?? new Map<number, CryptoKey>();
    chaves.set(grupo, abertas);
    const ja = abertas.get(epoca);
    if (ja) return ja;
    const s = await motorDe(usuario).segredosDe(grupo, epoca);
    if (!s) return null;
    const chave = await chaveAes(s.conteudo.slice());
    abertas.set(epoca, chave);
    return chave;
  }

  /** Troca a chave da própria folha quando passou o prazo (7 dias ou 100 posts na época). Nunca impede o post. */
  async function talvezRenovar(usuario: string, grupo: string, epoca: number): Promise<number> {
    const r = (await guarda.ler<{ em: number; epoca: number; posts: number }>(kRenovado(usuario, grupo))) ?? { em: Date.now(), epoca, posts: 0 };
    const posts = r.epoca === epoca ? r.posts + 1 : 1;
    if (Date.now() - r.em > RENOVAR_DIAS * 86_400_000 || posts > RENOVAR_POSTS) {
      const nova = await motorDe(usuario).renovar(grupo).catch(() => null);
      if (nova !== null) {
        await guarda.guardar(kRenovado(usuario, grupo), { em: Date.now(), epoca: Number(nova), posts: 1 });
        return Number(nova);
      }
    }
    await guarda.guardar(kRenovado(usuario, grupo), { em: r.em, epoca, posts });
    return epoca;
  }

  return {
    /** Garante a chave de assinatura e os pacotes de chave desta pessoa (cria e publica na primeira vez). */
    preparar: (usuario: string) => preparar(usuario),

    /** Cifra um post para o grupo, na época atual (acertando antes quem entrou e quem saiu). */
    async cifrar(grupo: string, usuario: string, texto: string): Promise<string> {
      await preparar(usuario);
      const atual = await sincronizar(usuario, grupo);
      if (!atual) throw erro("sem_chave");
      const epoca = await talvezRenovar(usuario, grupo, Number(atual.epoca));
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
    },

    /** Abre um post do grupo (null se esta pessoa não estava no grupo naquela época, ou se o post foi mexido). */
    async abrir(grupo: string, usuario: string, autor: string, corpo: string): Promise<string | null> {
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
    },

    /**
     * A chave de uma sala de voz do grupo (lib/rede/voz/sala.ts): tirada da chave de voz da época (uma chave própria do exporter,
     * separada da dos posts) com o nome da sala. Sem `epoca`, acerta o grupo e usa a época atual. Serve para cifrar a combinação da
     * chamada entre os membros.
     */
    async chaveDeVoz(grupo: string, usuario: string, sala: string, epoca?: number): Promise<{ epoca: number; chave: CryptoKey } | null> {
      let e = epoca;
      if (e === undefined) {
        await preparar(usuario);
        const atual = await sincronizar(usuario, grupo);
        if (!atual) return null;
        e = Number(atual.epoca);
      }
      const s = await motorDe(usuario).segredosDe(grupo, e);
      if (!s?.voz) return null;
      return { epoca: e, chave: await chaveAes(chaveDaSala(s.voz, idDoGrupo("grupo", grupo), sala)) };
    },

    /** Os avisos de aparelho novo de contas que este aparelho já conhecia (os mais novos por último). */
    avisos: async (usuario: string) => (await guarda.ler<AvisoDeAparelho[]>(kAvisos(usuario))) ?? [],

    /** Marca os avisos como vistos (a tela para de mostrar; ficam guardados, até 50). */
    async avisosVistos(usuario: string): Promise<void> {
      const avisos = (await guarda.ler<AvisoDeAparelho[]>(kAvisos(usuario))) ?? [];
      await guarda.guardar(kAvisos(usuario), avisos.map((a) => ({ ...a, visto: true })));
    },

    /** Esquece as chaves da memória (o "Sair rápido" chama). */
    esquecer: () => chaves.clear(),
  };
}

export type ChaveiroDeGrupo = ReturnType<typeof criarChaveiroDeGrupo>;

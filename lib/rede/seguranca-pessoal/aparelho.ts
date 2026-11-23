// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O lado do aparelho da segurança pessoal (Prompt 4, itens 10 a 12; supabase/migracoes/20261127-p4-seguranca-pessoal.sql):
//   - a chave de segurança: criada aqui, a privada guardada só aqui (guarda.ts), a pública publicada assinada pela identidade;
//   - mandar ao plantão ou à assessoria: pede as chaves das assessoras, CONFERE a assinatura de cada uma e a identidade no registro
//     de transparência, cifra aqui e manda só a cifra (o banco não grava quem mandou);
//   - abrir o que chegou (assessora) e o aviso de sumiço entregue (contato de confiança): com a privada daqui;
//   - o interruptor de sumiço: o aviso vai cifrado para a chave do contato escolhido.
// O servidor nunca recebe privada nem texto aberto. Sem os atalhos "@/" de propósito: o teste roda este arquivo no Node com o banco.
import type { FonteDaIdentidade } from "../voto/identidade";
import * as S from "./selo";

export type Chamar = <T>(funcao: string, argumentos?: Record<string, unknown>) => Promise<T>;

export interface DependenciasDaSeguranca {
  chamar: Chamar;
  /** A identidade da conta neste aparelho (a do chat novo), como o voto usa. */
  fonte: () => FonteDaIdentidade | null | Promise<FonteDaIdentidade | null>;
  guarda: {
    ler(usuario: string): Promise<S.ParDeSeguranca | null>;
    guardar(usuario: string, par: S.ParDeSeguranca): Promise<void>;
  };
  /** O carimbo de tempo pelo servidor do site (app/api/alumia/carimbo). Nulo: sem serviço configurado. */
  carimbar?: (resumo: string) => Promise<{ carimbo: string; hora: string; servico: string } | null>;
  /** Um id novo (uuid v4 do Web Crypto). */
  novoId?: () => string;
}

export class ErroDaSeguranca extends Error {
  readonly codigo: string;
  constructor(codigo: string) {
    super(codigo);
    this.codigo = codigo;
  }
}

export interface Situacao {
  chave: string | null;
  identidade: boolean;
  assessora_de: { handle: string; nome: string }[];
  gestora_de: { handle: string; nome: string; pronta: boolean }[];
  plantoes: { handle: string; nome: string }[];
  sumico: { dias: number; apagar: boolean; destino: string | null; prazo: string } | null;
}

export interface ItemDaCaixa {
  id: string;
  org: string;
  finalidade: "registro" | "plantao";
  dia: string;
  apagar_em: string;
  tamanho: number;
}

export type Aberto =
  | { finalidade: "plantao"; pedido: S.PedidoDoPlantao }
  | { finalidade: "registro"; ficha: S.FichaDoRegistro; arquivo: Uint8Array };

export interface AvisoRecebido {
  id: string;
  dia: string;
  aviso: S.AvisoDoSumico | null;
}

export function criarSeguranca(d: DependenciasDaSeguranca) {
  const novoId = d.novoId ?? (() => crypto.randomUUID());

  async function eu() {
    const fonte = await d.fonte();
    const minha = await fonte?.minha().catch(() => null);
    if (!fonte || !minha) throw new ErroDaSeguranca("sem_identidade");
    return { fonte, minha };
  }

  /** A minha privada, conferida contra a publicada (se a do banco for outra, a daqui não abre o que chegou). */
  async function minhaPrivada(): Promise<{ usuario: string; par: S.ParDeSeguranca }> {
    const { minha } = await eu();
    const par = await d.guarda.ler(minha.usuario);
    if (!par) throw new ErroDaSeguranca("sem_chave_aqui");
    return { usuario: minha.usuario, par };
  }

  /** Só as destinatárias com assinatura que confere e identidade que o registro de transparência não diz que foi trocada. */
  async function conferidas(lista: unknown): Promise<S.Destino[]> {
    const { fonte } = await eu();
    const saida: S.Destino[] = [];
    for (const x of S.destinosConferidos(lista)) {
      const c = await fonte.conferir(x.conta, x.identidade).catch(() => "nao_conferida" as const);
      if (c !== "trocada") saida.push(x);
    }
    return saida;
  }

  async function mandar(org: string, finalidade: "registro" | "plantao", dados: Uint8Array) {
    const destinos = await conferidas(await d.chamar("rede_p4_seg_destinos", { p_org: org }));
    if (!destinos.length) throw new ErroDaSeguranca("sem_assessoria");
    const id = novoId();
    const { cifra, embrulhos } = await S.selar(finalidade, id, destinos, dados);
    await d.chamar("rede_p4_seg_enviar", {
      p: { id, org, finalidade, cifra: S.paraBase64(cifra), embrulhos: embrulhos.map((e) => ({ conta: e.conta, embrulho: S.paraBase64(e.embrulho) })) },
    });
    return { id, assessoras: destinos.length };
  }

  return {
    situacao: () => d.chamar<Situacao>("rede_p4_seg_situacao"),

    /** A minha chave: publicada? está neste aparelho? as duas são a mesma? */
    async minhaChave(publicadaB64: string | null): Promise<{ identidade: boolean; aqui: boolean; confere: boolean }> {
      const minha = await (await d.fonte())?.minha().catch(() => null);
      const local = minha ? await d.guarda.ler(minha.usuario) : null;
      const publicada = S.deBase64(publicadaB64);
      const confere = !!local && !!publicada && local.publica.length === publicada.length && local.publica.every((x, i) => x === publicada[i]);
      local?.privada.fill(0);
      return { identidade: !!minha, aqui: !!local, confere };
    },

    /** Cria a chave de segurança: guarda a privada AQUI primeiro e publica a pública assinada pela identidade (substitui a de antes). */
    async criarMinhaChave(): Promise<void> {
      const { minha } = await eu();
      const par = await S.novaChaveDeSeguranca();
      try {
        const assinatura = await minha.assinar(S.textoDaChave(minha.usuario, par.publica));
        if (!S.conferirChave(minha.publica, minha.usuario, par.publica, assinatura)) throw new ErroDaSeguranca("assinatura_invalida");
        await d.guarda.guardar(minha.usuario, par);
        await d.chamar("rede_p4_seg_chave_publicar", { p: { publica: S.paraBase64(par.publica), assinatura: S.paraBase64(assinatura) } });
      } finally {
        par.privada.fill(0);
      }
    },
    tirarMinhaChave: () => d.chamar("rede_p4_seg_chave_tirar"),

    // ── Item 11: o plantão jurídico ──
    async pedirPlantao(org: string, onde: string, ocorrido: S.Ocorrido, contato: { tipo: S.TipoDeContato; valor: string }) {
      let dados: Uint8Array;
      try {
        dados = S.pedidoDoPlantao(onde, ocorrido, contato);
      } catch {
        throw new ErroDaSeguranca("invalido");
      }
      return mandar(org, "plantao", dados);
    },

    // ── Item 10: o registro de abuso ──
    async registrar(org: string, arquivo: Uint8Array, tipo: "foto" | "video", formato: string, extras: { local?: string; contato?: string } = {}) {
      if (arquivo.length === 0 || arquivo.length > S.TAMANHOS.arquivo) throw new ErroDaSeguranca("grande_demais");
      const resumo = await S.resumoHex(arquivo);
      const c = d.carimbar ? await d.carimbar(resumo).catch(() => null) : null;
      let dados: Uint8Array;
      try {
        dados = S.pacoteDoRegistro({
          v: 1, tipo, formato, resumo, carimbo: c?.carimbo ?? null, carimbo_em: c?.hora ?? null, carimbo_servico: c?.servico ?? null,
          feito_em: new Date().toISOString(), local: extras.local, contato: extras.contato,
        }, arquivo);
      } catch (e) {
        throw new ErroDaSeguranca(e instanceof Error && e.message === "grande_demais" ? "grande_demais" : "invalido");
      }
      const r = await mandar(org, "registro", dados);
      return { ...r, resumo, carimbado: !!c };
    },

    // ── A caixa da assessora ──
    caixa: () => d.chamar<ItemDaCaixa[]>("rede_p4_seg_caixa"),
    async abrirDaCaixa(id: string): Promise<Aberto> {
      const r = await d.chamar<{ id: string; finalidade: "registro" | "plantao"; cifra: string; embrulho: string }>("rede_p4_seg_abrir", { p_id: id });
      const { usuario, par } = await minhaPrivada();
      try {
        const cifra = S.deBase64(r.cifra);
        const embrulho = S.deBase64(r.embrulho);
        const aberto = cifra && embrulho ? await S.abrir(r.finalidade, r.id, usuario, par.privada, embrulho, cifra) : null;
        if (!aberto) throw new ErroDaSeguranca("nao_abre");
        if (r.finalidade === "plantao") {
          const pedido = S.lerPedidoDoPlantao(aberto);
          if (!pedido) throw new ErroDaSeguranca("nao_abre");
          return { finalidade: "plantao", pedido };
        }
        const pacote = S.lerPacoteDoRegistro(aberto);
        if (!pacote) throw new ErroDaSeguranca("nao_abre");
        return { finalidade: "registro", ...pacote };
      } finally {
        par.privada.fill(0);
      }
    },
    apagarDaCaixa: (id: string) => d.chamar("rede_p4_seg_apagar", { p_id: id }),

    // ── A gestão da organização ──
    assessora: (org: string, handle: string, ligar: boolean) => d.chamar("rede_p4_seg_assessora", { p_org: org, p_handle: handle, p_ligar: ligar }),
    sairDaAssessoria: (org: string) => d.chamar("rede_p4_seg_assessora_sair", { p_org: org }),

    // ── Item 12: o interruptor de sumiço ──
    async ligarSumico(o: { dias: number; apagar: boolean; destino?: string | null; de?: string; texto?: string }) {
      const p: Record<string, unknown> = { dias: o.dias, apagar: o.apagar };
      const destino = (o.destino ?? "").trim().replace(/^@/, "");
      if (destino) {
        const lista = await conferidas([await d.chamar("rede_p4_sumico_destino", { p_handle: destino })]);
        if (!lista.length) throw new ErroDaSeguranca("sem_chave");
        let dados: Uint8Array;
        try {
          dados = S.avisoDoSumico(o.de ?? "", o.texto ?? "");
        } catch {
          throw new ErroDaSeguranca("invalido:texto");
        }
        const id = novoId();
        const { cifra, embrulhos } = await S.selar("sumico", id, lista, dados);
        Object.assign(p, { destino, id, cifra: S.paraBase64(cifra), embrulho: S.paraBase64(embrulhos[0].embrulho) });
      }
      return d.chamar("rede_p4_sumico_salvar", { p });
    },
    desligarSumico: () => d.chamar("rede_p4_sumico_tirar"),
    async recebidos(): Promise<AvisoRecebido[]> {
      const lista = await d.chamar<{ id: string; dia: string; cifra: string; embrulho: string }[]>("rede_p4_sumico_recebidos");
      if (!lista.length) return [];
      const { usuario, par } = await minhaPrivada();
      try {
        const saida: AvisoRecebido[] = [];
        for (const r of lista) {
          const cifra = S.deBase64(r.cifra);
          const embrulho = S.deBase64(r.embrulho);
          const aberto = cifra && embrulho ? await S.abrir("sumico", r.id, usuario, par.privada, embrulho, cifra) : null;
          saida.push({ id: r.id, dia: r.dia, aviso: aberto ? S.lerAvisoDoSumico(aberto) : null });
        }
        return saida;
      } finally {
        par.privada.fill(0);
      }
    },
    apagarRecebido: (id: string) => d.chamar("rede_p4_sumico_recebido_apagar", { p_id: id }),
  };
}

export type Seguranca = ReturnType<typeof criarSeguranca>;

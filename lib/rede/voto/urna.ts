// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O voto em limiar do lado do aparelho (supabase/migracoes/20261124-r2-voto.sql, lib/rede/voto/limiar.ts): o mesmo caminho para
// a consulta à base, a votação secreta da comunidade e a da equipe.
//   - guardiã: cria a chave de voto (a privada fica só aqui; a pública vai ao diretório, assinada pela identidade da conta);
//   - quem abre a votação: escolhe as guardiãs entre a coordenação, cria a chave aqui e publica (a semente some daqui);
//   - quem vota: lê o registro, CONFERE as assinaturas e as identidades, e cifra a escolha;
//   - fechada: cada guardiã abre a parte dela e repassa à abridora, cifrada para a chave da abridora QUE ESTÁ NO REGISTRO ASSINADO
//     (nunca a que o servidor disser na hora); a abridora refaz a chave, confere que dá a pública do registro, confere que não há
//     mais cédulas que pessoas, abre, embaralha e manda só as escolhas.
// O servidor nunca recebe semente, privada nem parte aberta.
// Sem os atalhos "@/" de propósito: o teste roda este arquivo direto no Node, com o banco de verdade.
import * as L from "./limiar";
import type { FonteDaIdentidade, IdentidadeConferida } from "./identidade";

export type Chamar = <T>(funcao: string, argumentos?: Record<string, unknown>) => Promise<T>;

export interface DependenciasDaUrna {
  chamar: Chamar;
  /** A identidade deste aparelho (a do chat novo). Pode abrir o chat na hora (por isso a promessa). */
  fonte: () => FonteDaIdentidade | null | Promise<FonteDaIdentidade | null>;
  guarda: {
    ler(usuario: string): Promise<{ publica: Uint8Array; privada: Uint8Array } | null>;
    guardar(usuario: string, par: { publica: Uint8Array; privada: Uint8Array }): Promise<void>;
  };
  /**
   * Onda R3 (15): a cédula vai pela urna ANÔNIMA (lib/rede/voto/urna-anonima.ts): passe da urna desta votação pego com a sessão,
   * depósito sem ela. Sem isto ligado, não se vota ("sem_servico"): não há mais caminho com a sessão.
   */
  depositar?: (tipo: L.TipoDaVotacao, alvo: string, cedula: string) => Promise<unknown>;
  /** Pega cedo (com a sessão) o passe da urna desta votação, se a conta vota nela. */
  prepararCedula?: (tipo: L.TipoDaVotacao, alvo: string) => Promise<boolean>;
  /** Este aparelho tem o passe desta votação, ainda não depositado? */
  temCedula?: (tipo: L.TipoDaVotacao, alvo: string) => Promise<boolean>;
}

/** Erro com código, que a tela traduz. */
export class ErroDaUrna extends Error {
  readonly codigo: string;
  constructor(codigo: string) {
    super(codigo);
    this.codigo = codigo;
  }
}

interface RegistroDoBanco {
  tipo: L.TipoDaVotacao;
  alvo: string;
  pk: string;
  n: number;
  k: number;
  criador: string;
  criador_identidade: string;
  assinatura: string;
  guardias: { indice: number; usuario: string; nome: string; voto: string; identidade: string; assinatura: string }[];
}
interface EstadoDoBanco {
  chave: RegistroDoBanco | null;
  situacao: "aberta" | "fechada" | "cancelada";
  possoCriar: boolean;
  possoGuardar?: boolean;
  apurada?: boolean;
  abridora?: number | null;
  entregues?: number | null;
  meuIndice?: number | null;
  entreguei?: boolean;
  cedulas?: boolean | null;
}

export interface EstadoDaUrna {
  tipo: L.TipoDaVotacao;
  alvo: string;
  situacao: "aberta" | "fechada" | "cancelada";
  possoCriar: boolean;
  /** Quem pergunta é da coordenação (pode ser guardiã desta votação). */
  possoGuardar: boolean;
  chave: L.ChaveDaVotacao | null;
  /** O registro confere por dentro (formato, assinatura de cada guardiã e de quem criou)? */
  conferencia: L.ConferenciaDaChave | null;
  /** O pior que o registro de transparência disse das identidades do registro (nulo sem fonte ligada). */
  identidades: IdentidadeConferida | null;
  impressao: string | null;
  guardias: { indice: number; usuario: string; nome: string }[];
  apurada: boolean;
  abridora: number | null;
  entregues: number | null;
  meuIndice: number | null;
  /** Esta guardiã já repassou a parte dela à abridora. */
  entreguei: boolean;
  /** Fechada com cédula cifrada esperando abrir. */
  cedulas: boolean;
}

const b = (texto: string): Uint8Array => {
  const x = L.deBase64(texto);
  if (!x) throw new ErroDaUrna("registro_torto");
  return x;
};

function doBanco(r: RegistroDoBanco): L.ChaveDaVotacao {
  return {
    tipo: r.tipo, alvo: r.alvo, publica: b(r.pk), n: r.n, k: r.k, criador: r.criador, criadorIdentidade: b(r.criador_identidade), assinatura: b(r.assinatura),
    guardias: r.guardias.map((g) => ({ indice: g.indice, usuario: g.usuario, voto: b(g.voto), identidade: b(g.identidade), assinatura: b(g.assinatura) })),
  };
}

const ORDEM: Record<IdentidadeConferida, number> = { conferida: 0, nao_conferida: 1, trocada: 2 };

export function criarUrna(d: DependenciasDaUrna) {
  async function conferirIdentidades(lista: { usuario: string; identidade: Uint8Array }[]): Promise<IdentidadeConferida | null> {
    const f = await d.fonte();
    if (!f) return null;
    let pior: IdentidadeConferida = "conferida";
    for (const x of lista) {
      const r = await f.conferir(x.usuario, x.identidade).catch((): IdentidadeConferida => "nao_conferida");
      if (ORDEM[r] > ORDEM[pior]) pior = r;
    }
    return pior;
  }

  async function minhaIdentidade() {
    const eu = await (await d.fonte())?.minha();
    if (!eu) throw new ErroDaUrna("sem_identidade");
    return eu;
  }

  async function estado(tipo: L.TipoDaVotacao, alvo: string): Promise<EstadoDaUrna> {
    const e = await d.chamar<EstadoDoBanco>("rede_voto_chave", { p_tipo: tipo, p_alvo: alvo });
    const base = {
      tipo, alvo, situacao: e.situacao, possoCriar: e.possoCriar === true, possoGuardar: e.possoGuardar === true, apurada: e.apurada === true, abridora: e.abridora ?? null,
      entregues: e.entregues ?? null, meuIndice: e.meuIndice ?? null, entreguei: e.entreguei === true, cedulas: e.cedulas === true,
    };
    if (!e.chave) return { ...base, chave: null, conferencia: null, identidades: null, impressao: null, guardias: [] };
    let chave: L.ChaveDaVotacao;
    try {
      chave = doBanco(e.chave);
    } catch {
      return { ...base, chave: null, conferencia: "formato", identidades: null, impressao: null, guardias: [] };
    }
    // O registro tem de ser desta votação: o servidor não troca o de uma pelo de outra.
    const conferencia = chave.tipo !== tipo || chave.alvo !== alvo ? "formato" : L.conferirChave(chave);
    return {
      ...base, chave, conferencia,
      identidades: conferencia === "ok" ? await conferirIdentidades(L.identidadesDaChave(chave)) : null,
      impressao: conferencia === "ok" ? L.impressaoDaChave(chave) : null,
      guardias: e.chave.guardias.map((g) => ({ indice: g.indice, usuario: g.usuario, nome: g.nome })),
    };
  }

  /**
   * O registro pronto para usar: confere por dentro E as identidades de quem criou e de cada guardiã são as do registro público das
   * chaves. Só a coerência interna não basta: um servidor ou banco ATIVO monta um registro inteiro com chaves dele (criador e
   * guardiãs inventados, tudo assinado por ele mesmo) e abriria todas as cédulas. Por isso, sem a identidade deste aparelho ligada
   * (não dá para conferir o registro), ou com alguma identidade que o registro não confirmou, nada é cifrado (a tela avisa e não
   * segue).
   */
  async function registroConfiavel(tipo: L.TipoDaVotacao, alvo: string): Promise<{ e: EstadoDaUrna; chave: L.ChaveDaVotacao }> {
    const e = await estado(tipo, alvo);
    if (!e.chave) throw new ErroDaUrna("sem_chave");
    if (e.conferencia !== "ok") throw new ErroDaUrna("chave_nao_confere");
    if (e.identidades === null) throw new ErroDaUrna("sem_identidade");
    if (e.identidades === "trocada") throw new ErroDaUrna("identidade_trocada");
    if (e.identidades !== "conferida") throw new ErroDaUrna("chave_nao_confere");
    return { e, chave: e.chave };
  }

  /** As guardiãs possíveis (a coordenação com chave publicada), cada uma com a assinatura conferida aqui. */
  async function guardiasPossiveis(tipo: L.TipoDaVotacao, alvo: string) {
    const lista = await d.chamar<{ usuario: string; nome: string; identidade: string; voto: string; assinatura: string; eu: boolean }[]>("rede_voto_guardias_possiveis", { p_tipo: tipo, p_alvo: alvo });
    return lista.map((g) => {
      const voto = L.deBase64(g.voto);
      const identidade = L.deBase64(g.identidade);
      const assinatura = L.deBase64(g.assinatura);
      const assinada = !!voto && !!identidade && !!assinatura && L.conferirGuardia(identidade, g.usuario, voto, assinatura);
      return { usuario: g.usuario, nome: g.nome, eu: g.eu, assinada, voto, identidade, assinatura };
    });
  }

  /** A cédula desta escolha, cifrada para a chave da votação depois de conferir o registro. */
  async function cedula(tipo: L.TipoDaVotacao, alvo: string, escolha: unknown): Promise<string> {
    const { chave } = await registroConfiavel(tipo, alvo);
    return L.cifrarCedula(chave, escolha);
  }

  return {
    estado,
    guardiasPossiveis,
    cedula,

    /** A minha chave de voto: está no diretório? está neste aparelho? as duas são a mesma? */
    async minhaChave(): Promise<{ identidade: boolean; diretorio: boolean; publicada: boolean; aqui: boolean; confere: boolean }> {
      const r = await d.chamar<{ diretorio: boolean; voto?: string | null; identidade?: string }>("rede_voto_minha_chave_ler");
      const eu = await (await d.fonte())?.minha().catch(() => null);
      const local = eu ? await d.guarda.ler(eu.usuario) : null;
      const publicada = typeof r.voto === "string" ? L.deBase64(r.voto) : null;
      const confere = !!local && !!publicada && local.publica.length === publicada.length && local.publica.every((x, i) => x === publicada[i]);
      local?.privada.fill(0);
      return { identidade: !!eu, diretorio: r.diretorio === true, publicada: !!publicada, aqui: !!local, confere };
    },

    /**
     * Cria a chave de voto desta conta: guarda a privada AQUI primeiro (se a publicação falhar, nada se perde) e publica a pública
     * assinada pela identidade. Substitui a de antes: votações em que já é guardiã continuam precisando da chave de antes.
     */
    async criarMinhaChave(): Promise<void> {
      const eu = await minhaIdentidade();
      const par = await L.novaChaveDeGuardia();
      try {
        const assinatura = await eu.assinar(L.textoDaGuardia(eu.usuario, par.publica));
        if (!L.conferirGuardia(eu.publica, eu.usuario, par.publica, assinatura)) throw new ErroDaUrna("assinatura_invalida");
        await d.guarda.guardar(eu.usuario, par);
        await d.chamar("rede_voto_minha_chave", { p: { voto: L.paraBase64(par.publica), assinatura: L.paraBase64(assinatura) } });
      } finally {
        par.privada.fill(0);
      }
    },

    /** Cria a chave da votação aqui, com as guardiãs escolhidas (contas) e K, e publica. Devolve a impressão da chave. */
    async publicarChave(tipo: L.TipoDaVotacao, alvo: string, escolhidas: string[], k: number): Promise<string> {
      const eu = await minhaIdentidade();
      const possiveis = await guardiasPossiveis(tipo, alvo);
      const guardias = escolhidas.map((u) => possiveis.find((g) => g.usuario === u));
      if (guardias.some((g) => !g || !g.assinada || !g.voto || !g.identidade || !g.assinatura)) throw new ErroDaUrna("guardia_sem_assinatura");
      const certas = guardias as { usuario: string; voto: Uint8Array; identidade: Uint8Array; assinatura: Uint8Array }[];
      const ident = await conferirIdentidades(certas.map((g) => ({ usuario: g.usuario, identidade: g.identidade })));
      if (ident === "trocada") throw new ErroDaUrna("identidade_trocada");
      const { chave, partes } = await L.criarChaveDaVotacao({
        tipo, alvo, k, guardias: certas.map((g) => ({ usuario: g.usuario, voto: g.voto, identidade: g.identidade, assinatura: g.assinatura })),
        criador: eu.usuario, criadorIdentidade: eu.publica, assinar: (t) => eu.assinar(t),
      });
      await d.chamar("rede_voto_chave_publicar", {
        p: {
          tipo, alvo, pk: L.paraBase64(chave.publica), k, assinatura: L.paraBase64(chave.assinatura), criador_identidade: L.paraBase64(chave.criadorIdentidade),
          guardias: chave.guardias.map((g) => ({ indice: g.indice, usuario: g.usuario, voto: L.paraBase64(g.voto), identidade: L.paraBase64(g.identidade), assinatura: L.paraBase64(g.assinatura) })),
          partes: partes.map((p) => L.paraBase64(p.cifrada)),
        },
      });
      return L.impressaoDaChave(chave);
    },

    /**
     * Vota: cifra aqui (depois de conferir o registro) e deposita pela urna anônima: o passe da urna desta votação (pego com a sessão,
     * de preferência cedo, em prepararCedula) e o depósito sem a sessão. O banco não liga a cédula a quem votou.
     */
    async votar(tipo: L.TipoDaVotacao, alvo: string, escolha: unknown): Promise<{ votei: true }> {
      if (!d.depositar) throw new ErroDaUrna("sem_servico");
      const selada = await cedula(tipo, alvo, escolha);
      await d.depositar(tipo, alvo, selada);
      return { votei: true };
    },
    /** Pega cedo o passe da urna desta votação (a tela chama ao abrir a votação). false: a conta não vota nela, ou sem rede. */
    async prepararCedula(tipo: L.TipoDaVotacao, alvo: string): Promise<boolean> {
      return d.prepararCedula ? d.prepararCedula(tipo, alvo).catch(() => false) : false;
    },
    /** Este aparelho pegou a cédula desta votação e ainda não depositou (o banco diz "já pegou" desde a emissão)? */
    async temCedula(tipo: L.TipoDaVotacao, alvo: string): Promise<boolean> {
      return d.temCedula ? d.temCedula(tipo, alvo).catch(() => false) : false;
    },

    /** A guardiã confere que a parte dela abre com a chave deste aparelho (logo depois de criada a votação). */
    async conferirMinhaParte(tipo: L.TipoDaVotacao, alvo: string): Promise<"ok" | "nao_abre" | "sem_chave_aqui"> {
      const eu = await minhaIdentidade();
      const { chave } = await registroConfiavel(tipo, alvo);
      const par = await d.guarda.ler(eu.usuario);
      if (!par) return "sem_chave_aqui";
      try {
        const minha = await d.chamar<{ indice: number; parte: string | null }>("rede_voto_minha_parte", { p_tipo: tipo, p_alvo: alvo });
        const cifrada = minha.parte ? L.deBase64(minha.parte) : null;
        const g = chave.guardias.find((x) => x.indice === minha.indice);
        if (!cifrada || !g || g.usuario !== eu.usuario) return "nao_abre";
        const parte = await L.abrirParte(par.privada, chave, minha.indice, cifrada);
        parte?.fill(0);
        return parte ? "ok" : "nao_abre";
      } finally {
        par.privada.fill(0);
      }
    },

    /** Fechada a votação: a guardiã abre a parte dela e a repassa à abridora (a chave da abridora vem do registro conferido). */
    async entregarParte(tipo: L.TipoDaVotacao, alvo: string): Promise<{ entregues: number; abridora: number; souAbridora: boolean }> {
      const eu = await minhaIdentidade();
      const { chave } = await registroConfiavel(tipo, alvo);
      const par = await d.guarda.ler(eu.usuario);
      if (!par) throw new ErroDaUrna("sem_chave_aqui");
      let parte: Uint8Array | null = null;
      try {
        const minha = await d.chamar<{ indice: number; parte: string | null }>("rede_voto_minha_parte", { p_tipo: tipo, p_alvo: alvo });
        const g = chave.guardias.find((x) => x.indice === minha.indice);
        const cifrada = minha.parte ? L.deBase64(minha.parte) : null;
        if (!cifrada || !g || g.usuario !== eu.usuario) throw new ErroDaUrna("parte_nao_abre");
        parte = await L.abrirParte(par.privada, chave, minha.indice, cifrada);
        if (!parte) throw new ErroDaUrna("parte_nao_abre");
        const ab = await d.chamar<{ abridora: number }>("rede_voto_abrir", { p_tipo: tipo, p_alvo: alvo });
        const abridora = chave.guardias.find((x) => x.indice === ab.abridora);
        if (!abridora) throw new ErroDaUrna("registro_torto");
        const repasse = await L.repassarParte(abridora.voto, chave, minha.indice, parte);
        const r = await d.chamar<{ entregues: number }>("rede_voto_parte_entregar", { p_tipo: tipo, p_alvo: alvo, p_parte: L.paraBase64(repasse) });
        return { entregues: r.entregues, abridora: ab.abridora, souAbridora: abridora.usuario === eu.usuario };
      } finally {
        par.privada.fill(0);
        parte?.fill(0);
      }
    },

    /**
     * A abridora apura: refaz a chave com as partes (confere que dá a pública do registro), confere que não há mais cédulas que
     * pessoas, abre as cédulas aqui, embaralha e manda as escolhas. "faltam" enquanto não chegaram K partes.
     */
    async apurar(tipo: L.TipoDaVotacao, alvo: string): Promise<{ apuradas: number; nulas: number } | { faltam: number }> {
      const eu = await minhaIdentidade();
      const { chave } = await registroConfiavel(tipo, alvo);
      const urna = await d.chamar<{ entregues: number; k: number; votantes?: number; partes?: { indice: number; parte: string }[]; cedulas?: string[] }>("rede_voto_urna", { p_tipo: tipo, p_alvo: alvo });
      if (!urna.partes || !urna.cedulas) return { faltam: Math.max(0, chave.k - urna.entregues) };
      if (typeof urna.votantes === "number" && urna.cedulas.length > urna.votantes) throw new ErroDaUrna("urna_inchada");
      const par = await d.guarda.ler(eu.usuario);
      if (!par) throw new ErroDaUrna("sem_chave_aqui");
      const partes: { indice: number; parte: Uint8Array }[] = [];
      let refeita: { privada: Uint8Array } | null = null;
      try {
        for (const p of urna.partes) {
          const cifrada = L.deBase64(p.parte);
          const aberta = cifrada ? await L.abrirRepasse(par.privada, chave, p.indice, cifrada) : null;
          if (aberta) partes.push({ indice: p.indice, parte: aberta });
        }
        refeita = await L.refazerChave(chave, partes);
        if (!refeita) throw new ErroDaUrna("partes_nao_conferem");
        const escolhas: unknown[] = [];
        for (const c of urna.cedulas) {
          const e = await L.abrirCedula(refeita.privada, chave, c);
          if (e !== null) escolhas.push(e);
        }
        return await d.chamar<{ apuradas: number; nulas: number }>("rede_voto_apurar", { p_tipo: tipo, p_alvo: alvo, p_escolhas: L.embaralhar(escolhas), p_quantas: urna.cedulas.length });
      } finally {
        par.privada.fill(0);
        for (const p of partes) p.parte.fill(0);
        refeita?.privada.fill(0);
      }
    },
  };
}

export type Urna = ReturnType<typeof criarUrna>;

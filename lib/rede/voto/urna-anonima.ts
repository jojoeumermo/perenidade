// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Onda R3, o que a R2 deixou (15): a urna anônima. Antes, a cédula cifrada ia ao banco com a sessão de quem votava, na mesma transação
// do "já votou": a ordem das transações ligava a pessoa à cédula. Agora:
//   - COM a sessão, cedo (ao abrir a votação), o aparelho pega UM passe cego da urna desta votação (lib/rede/passes/cliente.ts,
//     pegarPasseDaUrna: RSA cego, RFC 9578, com o contexto da votação). A emissão marca a conta como "já pegou a cédula";
//   - SEM a sessão, depois, a cédula vai por POST /api/alumia/urna/depositar {tipo, alvo, cedula} com o passe no cabeçalho
//     (Authorization: PrivateToken). A rota recusa pedido com sessão, confere o passe SÓ com a chave pública da urna daquela votação
//     (de outra votação, adulterado ou geral: recusado) e chama o banco com o serviço (public.rede_urna_depositar_anonimo), que gasta o
//     passe (repetido: recusado) e põe a cédula na urna em ordem sorteada.
// Este arquivo tem as duas pontas, sem os atalhos "@/" (o teste roda no Node): o tratador da rota, com as dependências injetadas, e o
// lado do aparelho (depositar com espera sorteada quando o passe acabou de ser pego). A cédula continua cifrada para a chave das
// guardiãs (lib/rede/voto/limiar.ts): ninguém aqui a abre.

/** Os tipos de votação com urna (os mesmos de lib/rede/passes/comum.ts). */
export type TipoDaUrnaAnonima = "consulta" | "decisao" | "equipe";
const TIPOS: readonly TipoDaUrnaAnonima[] = ["consulta", "decisao", "equipe"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** A cédula v2 (lib/rede/voto/limiar.ts): "v2." e 2230 letras de base64url. Só o formato: abrir, ninguém aqui abre. */
const CEDULA = /^v2\.[A-Za-z0-9_-]{2230}$/;
/** O corpo cabe com folga em 4 KB (a cédula tem 2233 letras). */
export const CORPO_DA_URNA = 4096;

/** O que o banco diz e a rota repassa à tela (o resto vira "falha"). */
const CODIGOS = new Set(["passe_usado", "encerrada", "sem_chave", "invalido:cedula", "cedula_repetida", "invalido:tipo"]);

export interface DependenciasDaRota {
  /** Pedido com algo de conta (cookie de sessão ou Authorization que não é passe)? */
  trazSessao(pedido: Request): boolean;
  lerCorpo(pedido: Request, teto: number): Promise<Record<string, unknown> | null>;
  responder(corpo: unknown, status?: number): Response;
  /** O contexto do passe da urna desta votação (32 bytes) ou nulo. */
  contextoDaUrna(tipo: TipoDaUrnaAnonima, alvo: string): Uint8Array | null;
  /** Confere o passe com a chave pública da urna deste contexto; devolve o resumo a gastar. */
  conferirPasse(cabecalho: string | null, opcoes: { contexto: Uint8Array }): Promise<{ ok: true; resumo: Uint8Array } | { ok: false; motivo: string }>;
  /** O banco, com o serviço. */
  depositar(args: { p_tipo: string; p_alvo: string; p_cedula: string; p_passe_resumo: string }): Promise<{ ok: true } | { ok: false; status: number; codigo: string }>;
  /** bytes → o texto que o PostgREST aceita como bytea ("\\x…"). */
  paraBytea(b: Uint8Array): string;
}

/** O tratador de POST /api/alumia/urna/depositar. */
export function tratarDeposito(d: DependenciasDaRota) {
  return async (pedido: Request): Promise<Response> => {
    if (d.trazSessao(pedido)) return d.responder({ ok: false, erro: "sem_sessao_aqui" }, 400);
    const corpo = await d.lerCorpo(pedido, CORPO_DA_URNA);
    const tipo = TIPOS.find((t) => t === corpo?.tipo) ?? null;
    const alvo = typeof corpo?.alvo === "string" && UUID.test(corpo.alvo) ? corpo.alvo : null;
    const cedula = typeof corpo?.cedula === "string" && CEDULA.test(corpo.cedula) ? corpo.cedula : null;
    if (!tipo || !alvo || !cedula) return d.responder({ ok: false, erro: "invalido" }, 400);
    const contexto = d.contextoDaUrna(tipo, alvo);
    if (!contexto) return d.responder({ ok: false, erro: "invalido" }, 400);
    const passe = await d.conferirPasse(pedido.headers.get("authorization"), { contexto });
    if (!passe.ok) return d.responder({ ok: false, erro: passe.motivo === "sem_servico" ? "sem_servico" : "passe" }, passe.motivo === "sem_servico" ? 503 : 401);
    const r = await d.depositar({ p_tipo: tipo, p_alvo: alvo, p_cedula: cedula, p_passe_resumo: d.paraBytea(passe.resumo) });
    if (!r.ok) {
      if (r.status === 0) return d.responder({ ok: false, erro: "sem_servico" }, 503);
      const erro = CODIGOS.has(r.codigo) ? r.codigo : "falha";
      return d.responder({ ok: false, erro }, erro === "passe_usado" || erro === "cedula_repetida" ? 409 : 400);
    }
    return d.responder({ ok: true });
  };
}

// ── O lado do aparelho ──────────────────────────────────────────────────────────────────────────────────────────────────────

export interface DependenciasDoAparelho {
  /** Carrega o que guarda os passes (o módulo dos passes, baixado só quando há votação). */
  carregar(): Promise<void>;
  /** Pega (com a sessão) o passe da urna desta votação, se este aparelho ainda não tem um. */
  pegarPasse(tipo: TipoDaUrnaAnonima, alvo: string): Promise<void>;
  /** O cabeçalho do passe guardado, ou nulo. */
  passe(tipo: TipoDaUrnaAnonima, alvo: string): string | null;
  /** Tira o passe guardado (depois do depósito aceito). */
  esquecerPasse(tipo: TipoDaUrnaAnonima, alvo: string): void;
  /** POST anônimo (sem cookie nem sessão), com o passe no cabeçalho. */
  postarSemSessao(caminho: string, corpo: unknown, passe: string): Promise<{ status: number; corpo: Record<string, unknown> | null }>;
  /** Quando este aparelho pegou o passe desta votação (ms), ou nulo se não sabe. */
  pegoEm(tipo: TipoDaUrnaAnonima, alvo: string): number | null;
  marcarPego(tipo: TipoDaUrnaAnonima, alvo: string, em: number): void;
  esperar(ms: number): Promise<void>;
  /** Um número sorteado em [0, maximo) por crypto.getRandomValues (nunca Math.random). */
  sortear(maximo: number): number;
  agora(): number;
}

/** Se o passe foi pego há menos que isso, o depósito espera um tempo sorteado (o banco não vê os dois juntos no relógio). */
export const ESPERA_MINIMA_MS = 60_000;
/** A espera sorteada: entre 8 e 40 segundos. */
export const ESPERA_SORTEADA = { de: 8_000, ate: 40_000 } as const;

export class ErroDoDeposito extends Error {
  readonly codigo: string;
  constructor(codigo: string) {
    super(codigo);
    this.codigo = codigo;
  }
}

export function criarUrnaAnonima(d: DependenciasDoAparelho) {
  return {
    /**
     * Este aparelho tem a cédula (o passe) desta votação, ainda não depositada? O banco diz "já pegou" desde a emissão; a tela usa
     * isto para deixar votar quem pegou aqui e ainda não depositou.
     */
    async temCedula(tipo: TipoDaUrnaAnonima, alvo: string): Promise<boolean> {
      try {
        await d.carregar();
        return d.passe(tipo, alvo) !== null;
      } catch {
        return false;
      }
    },
    /** Pega o passe CEDO (a tela chama ao abrir a votação). Sem permissão ou fora do prazo: nada (a tela mostra o motivo depois). */
    async prepararCedula(tipo: TipoDaUrnaAnonima, alvo: string): Promise<boolean> {
      try {
        await d.carregar();
        if (d.passe(tipo, alvo)) return true;
        await d.pegarPasse(tipo, alvo);
        if (d.pegoEm(tipo, alvo) === null) d.marcarPego(tipo, alvo, d.agora());
        return d.passe(tipo, alvo) !== null;
      } catch {
        return false;
      }
    },
    /**
     * Deposita a cédula cifrada pela via anônima. Sem passe aqui, pega agora (com a sessão) e espera um tempo sorteado antes de
     * depositar (sem a sessão). Depósito aceito: o passe sai deste aparelho. Passe já gasto: "passe_usado" (a cédula já entrou).
     */
    async depositar(tipo: TipoDaUrnaAnonima, alvo: string, cedula: string): Promise<{ ok: true }> {
      await d.carregar();
      if (!d.passe(tipo, alvo)) {
        await d.pegarPasse(tipo, alvo);
        d.marcarPego(tipo, alvo, d.agora());
      }
      const passe = d.passe(tipo, alvo);
      if (!passe) throw new ErroDoDeposito("sem_passes");
      const pego = d.pegoEm(tipo, alvo);
      if (pego === null || d.agora() - pego < ESPERA_MINIMA_MS) await d.esperar(ESPERA_SORTEADA.de + d.sortear(ESPERA_SORTEADA.ate - ESPERA_SORTEADA.de));
      const r = await d.postarSemSessao("/api/alumia/urna/depositar", { tipo, alvo, cedula }, passe);
      if (r.status === 200 && r.corpo?.ok === true) {
        d.esquecerPasse(tipo, alvo);
        return { ok: true };
      }
      const erro = typeof r.corpo?.erro === "string" ? r.corpo.erro : "falha";
      // Passe gasto (a cédula já entrou antes, ou o passe foi copiado): este aparelho não tem mais o que fazer com ele.
      if (erro === "passe_usado") d.esquecerPasse(tipo, alvo);
      throw new ErroDoDeposito(erro);
    },
  };
}
export type UrnaAnonima = ReturnType<typeof criarUrnaAnonima>;

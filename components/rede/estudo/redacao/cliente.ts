// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A roda de redação (onda 11, frente 11D; supabase/migracoes/20261117-alumia-o11-redacao.sql): tipos, regras que a tela confere
// antes do banco, as chamadas e o dublê da prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim: nada vai ao banco).
//   - A correção vai pelo servidor do site (app/api/alumia/redacao/corrigir), que grava o lacre; o resto vai direto ao banco.
//   - Depois que a mediação julga uma correção abusiva, a tela pede ao servidor o afastamento (app/api/alumia/redacao/afastar); a
//     resposta é só "feito" ou "sem_lacre", nunca a pessoa.
import { BackendError, getClient, hasBackend, localBackend } from "../../../../lib/backend";
import { chamar as chamarDeVerdade, type Chamar } from "../../../../lib/rede/cliente";

// ── Tipos (as formas que o banco devolve) ──

export interface Competencia {
  nota: number;
  comentario: string;
}

export interface Ficha {
  competencias: Competencia[];
  geral: string;
}

export interface CorrecaoRecebida extends Ficha {
  id: string;
  total: number;
  removida: boolean;
  denuncia: "aberta" | "abusiva" | "nao_abusiva" | null;
}

export type SituacaoDaRedacao = "na_roda" | "encerrada" | "devolvida";

export interface MinhaRedacao {
  id: string;
  semana: string;
  tema: string | null;
  titulo: string;
  texto: string;
  entregue_em: string;
  situacao: SituacaoDaRedacao;
  roda_ate: string;
  falta_corrigir: number | null;
  devolvida_em: string | null;
  apagar_em: string;
  /** Só depois da devolução; antes, nulo (a tela não sabe nem quantas leituras chegaram). */
  correcoes: CorrecaoRecebida[] | null;
}

export interface Leitura {
  id: string;
  prazo: string;
  semana: string;
  tema: string;
  motivadores: string;
  titulo: string;
  texto: string;
}

export interface Tema {
  semana: string;
  titulo: string;
  motivadores: string;
  ate: string;
}

export interface Roda {
  semana: string;
  tema: Tema | null;
  entreguei: boolean;
  afastada_ate: string | null;
  minhas: MinhaRedacao[];
  leituras: Leitura[];
  corrigi: { semana: string; feitas: number }[];
  /** Redações esperando leitura (fora a sua): só a partir de 3. */
  esperando: number | null;
  pode_tema: boolean;
  pode_mediar: boolean;
  denuncias_abertas: number | null;
}

export interface SemanaDaAgenda {
  semana: string;
  titulo: string | null;
  motivadores: string | null;
  editavel: boolean;
  redacoes: number | null;
}

export interface DenunciaNaFila {
  id: string;
  motivo: string;
  situacao: "aberta" | "abusiva" | "nao_abusiva";
  afastamento: "nao" | "pendente" | "feito" | "sem_lacre";
  criada_em: string;
  tema: string;
  titulo: string;
  texto: string;
  correcao: CorrecaoRecebida;
}

export type PedidoDeLeitura = Leitura | { nenhuma: true; dispensada: boolean };

// ── As regras que o banco confere (a tela usa as mesmas) ──

export const NOTAS = [0, 40, 80, 120, 160, 200] as const;
export const LIMITES_DA_REDACAO = {
  textoMin: 300,
  textoMax: 3600,
  tituloMax: 100,
  comentarioMin: 20,
  comentarioMax: 800,
  geralMax: 800,
  motivoMin: 10,
  motivoMax: 1000,
  temaMin: 10,
  temaMax: 200,
  motivadoresMax: 3000,
  /** Letras por linha da folha (a folha do ENEM tem por volta disso em letra de mão). */
  letrasPorLinha: 72,
  linhasMax: 30,
  linhasMin: 7,
} as const;

/** Linhas que o texto ocupa na folha de 30: cada parágrafo quebra em linhas de ~72 letras. */
export function linhasDaFolha(texto: string): number {
  if (!texto.trim()) return 0;
  return texto.split("\n").reduce((n, p) => n + Math.max(1, Math.ceil(p.length / LIMITES_DA_REDACAO.letrasPorLinha)), 0);
}

/** O que falta na redação para entregar (o mesmo nome do erro do banco) ou nulo. */
export function conferirRedacao(titulo: string, texto: string): "titulo" | "curta" | "longa" | null {
  const L = LIMITES_DA_REDACAO;
  if (titulo.trim().length > L.tituloMax) return "titulo";
  const t = texto.trim();
  if (t.length < L.textoMin) return "curta";
  if (t.length > L.textoMax || linhasDaFolha(t) > L.linhasMax + 4) return "longa";
  return null;
}

/** A ficha está pronta? Devolve a primeira competência incompleta (0 a 4), "geral", ou nulo. */
export function conferirFicha(f: { competencias: { nota: number | null; comentario: string }[]; geral: string }): number | "geral" | null {
  const L = LIMITES_DA_REDACAO;
  for (const [i, c] of f.competencias.entries()) {
    if (c.nota === null || !(NOTAS as readonly number[]).includes(c.nota)) return i;
    const n = c.comentario.trim().length;
    if (n < L.comentarioMin || n > L.comentarioMax) return i;
  }
  if (f.geral.trim().length > L.geralMax) return "geral";
  return null;
}

export const totalDaFicha = (competencias: { nota: number | null }[]): number => competencias.reduce((s, c) => s + (c.nota ?? 0), 0);

export const PREVIA_DA_REDACAO = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

// ── O servidor do site ──

async function token(): Promise<string> {
  const supabase = await getClient();
  const t = (await supabase.auth.getSession()).data.session?.access_token;
  if (!t) throw new BackendError("entre_primeiro");
  return t;
}

async function postar(caminho: string, corpo: unknown): Promise<Record<string, unknown>> {
  let r: Response;
  try {
    r = await fetch(caminho, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` },
      body: JSON.stringify(corpo),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    if (e instanceof BackendError) throw e;
    throw new BackendError("sem_conexao");
  }
  const dado = (await r.json().catch(() => null)) as Record<string, unknown> | null;
  if (!dado?.ok) throw new BackendError(typeof dado?.motivo === "string" ? dado.motivo : r.status === 404 ? "sem_servico" : "falha");
  return dado;
}

// ── As chamadas ──

export function criarClienteDaRedacao(c: Chamar, enviarCorrecao: (leitura: string, ficha: Ficha) => Promise<{ feitas: number }>, afastar: (denuncia: string) => Promise<"feito" | "sem_lacre" | "decidido">) {
  return {
    roda: () => c<Roda>("alumia_redacao_roda"),
    entregar: (titulo: string, texto: string) => c<MinhaRedacao>("alumia_redacao_entregar", { p_titulo: titulo.trim(), p_texto: texto.trim() }),
    apagar: (id: string) => c<{ apagada: true }>("alumia_redacao_apagar", { p_id: id }),
    pegar: () => c<PedidoDeLeitura>("alumia_redacao_pegar"),
    largar: (leitura: string) => c<{ largada: true }>("alumia_redacao_largar", { p_leitura: leitura }),
    corrigir: enviarCorrecao,
    denunciar: (correcao: string, motivo: string) => c<CorrecaoRecebida>("alumia_redacao_denunciar", { p_correcao: correcao, p_motivo: motivo.trim() }),
    temas: () => c<SemanaDaAgenda[]>("alumia_redacao_temas"),
    definirTema: (semana: string, titulo: string, motivadores: string) =>
      c<SemanaDaAgenda>("alumia_redacao_tema_definir", { p_semana: semana, p_titulo: titulo.trim(), p_motivadores: motivadores.trim() }),
    mediacao: () => c<DenunciaNaFila[]>("alumia_redacao_mediacao"),
    mediar: (denuncia: string, abusiva: boolean, nota: string) =>
      c<{ id: string; situacao: DenunciaNaFila["situacao"]; afastamento: DenunciaNaFila["afastamento"] }>("alumia_redacao_mediar", { p_denuncia: denuncia, p_abusiva: abusiva, p_nota: nota.trim() }),
    afastar,
  };
}

// ── O dublê da prévia: as mesmas formas, com exemplos. Nada vai ao banco. ──

const DIA = 86_400_000;
const iso = (dias: number) => new Date(Date.now() + dias * DIA).toISOString();
function segundaDestaSemana(): string {
  const hoje = new Date();
  const s = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() - ((hoje.getUTCDay() + 6) % 7)));
  return s.toISOString().slice(0, 10);
}
const somaDias = (dia: string, n: number) => new Date(new Date(`${dia}T12:00:00Z`).getTime() + n * DIA).toISOString().slice(0, 10);

const TEXTO_EXEMPLO =
  "No Brasil, a evasão escolar não é escolha individual: é o resultado de uma escola que não cabe na vida de quem precisa trabalhar " +
  "cedo. Segundo o Censo Escolar, a maior parte de quem deixa o ensino médio o faz entre o primeiro e o segundo ano, justamente quando " +
  "a renda da família aperta.\n\nEm primeiro lugar, a falta de transporte e de alimentação na escola pesa mais do que qualquer conteúdo. " +
  "Quem atravessa a cidade de ônibus lotado para chegar à aula das sete e volta sem ter comido não está \"desinteressado\": está cansado. " +
  "Além disso, o currículo raramente conversa com o bairro, o trabalho e a história de quem está na sala.\n\nPortanto, cabe ao Ministério " +
  "da Educação, em parceria com as secretarias estaduais, ampliar a bolsa de permanência para estudantes de baixa renda, garantir passe " +
  "livre estudantil e refeição completa no turno, e abrir o planejamento das escolas aos grêmios e às famílias, para que a escola seja " +
  "um lugar onde a juventude queira ficar.";

const comp = (nota: number, comentario: string): Competencia => ({ nota, comentario });

function exemplos(): Roda {
  const s = segundaDestaSemana();
  return {
    semana: s,
    tema: {
      semana: s,
      titulo: "Caminhos para enfrentar a evasão escolar no ensino médio brasileiro",
      motivadores:
        "Texto I — Dados do Censo Escolar mostram que a saída da escola se concentra entre o 1º e o 2º ano do ensino médio.\n" +
        "Texto II — \"Eu saí porque precisava ajudar em casa. Não foi falta de vontade.\" (relato de estudante, 17 anos)\n" +
        "Texto III — A permanência depende de transporte, alimentação e de uma escola que converse com a vida de quem estuda.",
      ate: new Date(`${somaDias(s, 7)}T03:00:00Z`).toISOString(),
    },
    entreguei: false,
    afastada_ate: null,
    minhas: [
      {
        id: "r-antiga", semana: somaDias(s, -7), tema: "O direito à moradia nas grandes cidades", titulo: "Casa é ponto de partida",
        texto: TEXTO_EXEMPLO.replace(/evasão escolar/g, "falta de moradia"), entregue_em: iso(-9), situacao: "devolvida", roda_ate: iso(7),
        falta_corrigir: null, devolvida_em: iso(-2), apagar_em: iso(28),
        correcoes: [
          {
            id: "c1", total: 760, removida: false, denuncia: null, geral: "Texto firme e bem organizado. A proposta pode detalhar quem financia.",
            competencias: [
              comp(160, "Poucos desvios: revise a crase em \"à moradia\" no segundo parágrafo e a vírgula antes do \"que\"."),
              comp(160, "Tema bem compreendido, com repertório do Estatuto da Cidade; falta amarrar o repertório ao argumento."),
              comp(160, "Argumentos em boa ordem, mas o segundo parágrafo repete a ideia do primeiro."),
              comp(120, "Use conectivos variados entre os parágrafos; \"além disso\" aparece três vezes."),
              comp(160, "Proposta com agente e ação; detalhe o meio e o efeito esperado para chegar aos 200."),
            ],
          },
          {
            id: "c2", total: 680, removida: false, denuncia: null, geral: "",
            competencias: [
              comp(120, "Alguns problemas de concordância (\"os dado mostra\") e pontuação nos períodos longos."),
              comp(160, "Desenvolve o tema sem fugir dele; a introdução poderia apresentar a tese de forma mais direta."),
              comp(120, "Os argumentos estão lá, mas faltam dados ou exemplos que os sustentem."),
              comp(120, "A coesão entre o segundo e o terceiro parágrafo é fraca; um conectivo de oposição ajudaria."),
              comp(160, "Boa proposta, respeita os direitos humanos; falta dizer como seria feita."),
            ],
          },
        ],
      },
    ],
    leituras: [],
    corrigi: [{ semana: s, feitas: 1 }, { semana: somaDias(s, -7), feitas: 2 }],
    esperando: 14,
    pode_tema: true,
    pode_mediar: true,
    denuncias_abertas: 1,
  };
}

function agendaDeExemplo(): SemanaDaAgenda[] {
  const s = segundaDestaSemana();
  return Array.from({ length: 10 }, (_, i) => {
    const semana = somaDias(s, 7 * (i - 1));
    const titulos = ["O direito à moradia nas grandes cidades", "Caminhos para enfrentar a evasão escolar no ensino médio brasileiro", "O trabalho por aplicativo e os direitos de quem entrega"];
    return { semana, titulo: titulos[i] ?? null, motivadores: titulos[i] ? "" : null, editavel: i >= 2, redacoes: i === 0 ? 37 : i === 1 ? 15 : null };
  });
}

function filaDeExemplo(): DenunciaNaFila[] {
  return [
    {
      id: "d1", motivo: "A leitura não comenta o texto: só diz que a redação é \"lixo militante\" e dá zero em tudo.", situacao: "aberta", afastamento: "nao",
      criada_em: iso(-0.2), tema: "O direito à moradia nas grandes cidades", titulo: "", texto: TEXTO_EXEMPLO,
      correcao: {
        id: "c9", total: 0, removida: false, denuncia: "aberta", geral: "Isso não é redação, é panfleto.",
        competencias: [0, 1, 2, 3, 4].map(() => comp(0, "Texto de militante, não vale a pena corrigir isso aqui.")),
      },
    },
  ];
}

function chamarDuble(): { c: Chamar; corrigir: (leitura: string, ficha: Ficha) => Promise<{ feitas: number }>; afastar: (d: string) => Promise<"feito"> } {
  const vazia = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("previa") === "vazia";
  const estado = exemplos();
  if (vazia) Object.assign(estado, { tema: null, minhas: [], leituras: [], esperando: null, corrigi: estado.corrigi.map((x) => ({ ...x, feitas: 0 })), denuncias_abertas: 0 });
  let fila = vazia ? [] : filaDeExemplo();
  let agenda = agendaDeExemplo();
  const espera = () => new Promise((r) => setTimeout(r, 160));
  const c: Chamar = async <T,>(funcao: string, a: Record<string, unknown> = {}): Promise<T> => {
    await espera();
    switch (funcao) {
      case "alumia_redacao_roda":
        return structuredClone(estado) as T;
      case "alumia_redacao_entregar": {
        if (!estado.tema) throw new BackendError("sem_tema");
        const m: MinhaRedacao = {
          id: `r-${Date.now()}`, semana: estado.semana, tema: estado.tema.titulo, titulo: String(a.p_titulo ?? ""), texto: String(a.p_texto ?? ""),
          entregue_em: new Date().toISOString(), situacao: "na_roda", roda_ate: iso(10), falta_corrigir: Math.max(0, 2 - estado.corrigi[0].feitas),
          devolvida_em: null, apagar_em: iso(17), correcoes: null,
        };
        estado.minhas.unshift(m);
        estado.entreguei = true;
        return structuredClone(m) as T;
      }
      case "alumia_redacao_apagar":
        estado.minhas = estado.minhas.filter((m) => m.id !== a.p_id);
        estado.entreguei = estado.minhas.some((m) => m.semana === estado.semana);
        return { apagada: true } as T;
      case "alumia_redacao_pegar": {
        if (estado.leituras.length >= 2) throw new BackendError("leituras_abertas");
        const l: Leitura = {
          id: `l-${Date.now()}`, prazo: iso(3), semana: estado.semana, tema: estado.tema?.titulo ?? "", motivadores: estado.tema?.motivadores ?? "",
          titulo: estado.leituras.length ? "" : "A escola que cabe na vida", texto: TEXTO_EXEMPLO,
        };
        estado.leituras.push(l);
        return structuredClone(l) as T;
      }
      case "alumia_redacao_largar":
        estado.leituras = estado.leituras.filter((l) => l.id !== a.p_leitura);
        return { largada: true } as T;
      case "alumia_redacao_denunciar": {
        const cor = estado.minhas.flatMap((m) => m.correcoes ?? []).find((x) => x.id === a.p_correcao);
        if (!cor) throw new BackendError("nao_encontrado");
        cor.denuncia = "aberta";
        return structuredClone(cor) as T;
      }
      case "alumia_redacao_temas":
        return structuredClone(agenda) as T;
      case "alumia_redacao_tema_definir": {
        agenda = agenda.map((x) => (x.semana === a.p_semana ? { ...x, titulo: String(a.p_titulo), motivadores: String(a.p_motivadores) } : x));
        return structuredClone(agenda.find((x) => x.semana === a.p_semana)) as T;
      }
      case "alumia_redacao_mediacao":
        return structuredClone(fila) as T;
      case "alumia_redacao_mediar": {
        const abusiva = a.p_abusiva === true;
        fila = fila.map((d) => (d.id === a.p_denuncia ? { ...d, situacao: abusiva ? "abusiva" : "nao_abusiva", afastamento: abusiva ? "pendente" : "nao" } : d));
        const d = fila.find((x) => x.id === a.p_denuncia);
        fila = fila.filter((x) => x.situacao === "aberta" || x.afastamento === "pendente");
        return { id: String(a.p_denuncia), situacao: d?.situacao, afastamento: d?.afastamento } as T;
      }
      default:
        throw new BackendError("falha");
    }
  };
  return {
    c,
    corrigir: async (leitura) => {
      await espera();
      estado.leituras = estado.leituras.filter((l) => l.id !== leitura);
      estado.corrigi[0].feitas += 1;
      return { feitas: estado.corrigi[0].feitas };
    },
    afastar: async (d) => {
      await espera();
      fila = fila.filter((x) => x.id !== d);
      return "feito";
    },
  };
}

function criar() {
  if (PREVIA_DA_REDACAO) {
    const d = chamarDuble();
    return criarClienteDaRedacao(d.c, d.corrigir, d.afastar);
  }
  const semServidor = !hasBackend || localBackend;
  return criarClienteDaRedacao(
    chamarDeVerdade,
    async (leitura, ficha) => {
      if (semServidor) throw new BackendError("sem_servico");
      const r = await postar("/api/alumia/redacao/corrigir", { leitura, ficha });
      return { feitas: Number(r.feitas) || 0 };
    },
    async (denuncia) => {
      if (semServidor) throw new BackendError("sem_servico");
      const r = await postar("/api/alumia/redacao/afastar", { denuncia });
      return r.afastamento === "feito" ? "feito" : r.afastamento === "decidido" ? "decidido" : "sem_lacre";
    },
  );
}

export const redacao = criar();

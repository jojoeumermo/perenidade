// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas do lote descoberta e estudo (Prompt 4, Parte E e Parte G; supabase/migracoes/20261127-p4-descoberta-estudo.sql). Tudo
// vai direto ao banco com a sessão da pessoa: o banco confere o interruptor, a conta e o limite em cada chamada. Nenhuma resposta
// traz o id de uma pessoa. Com NEXT_PUBLIC_ALUMIA_PREVIA=sim, um dublê na memória responde (nada vai a lugar nenhum). Sem "@/" de
// propósito (roda nos testes).
import { BackendError, getClient } from "../../backend";
import type { NotaDeFora } from "./fediverso-tema";
import type { LinhaCompartilhada } from "./linhas";
import { chamar, type Chamar } from "../cliente";

export const PREVIA_DE = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

export interface Inicio { cuido: boolean; educadora: boolean; turmas: { id: string; nome: string; cuido: boolean }[] }
export interface RegraDosAssuntos { horas: number; comunidades: number; pessoas: number; maximo: number }
export interface Assuntos { temas: { tag: string; faixa: "algumas" | "dezenas" }[]; regra: RegraDosAssuntos }
export interface Servidores { servidores: string[]; cuido?: boolean }
export interface Par { id: string; trilha: string; papel: "veterana" | "caloura"; codinome: string; handle: string | null }
export interface Mentorias { ofertas: { trilha: string; vagas: number }[]; pares: Par[]; veterana: boolean }
export type FaixaDoSimulado ="maioria_acertou" | "metade" | "maioria_errou";
export interface QuestaoDoSimulado { id: string; materia: string; enunciado: string; alternativas: string[]; certa?: number; explicacao?: string; faixa?: FaixaDoSimulado | null }
export interface Simulado { id: string; titulo: string; abre: string; fecha: string; fechado: boolean; respondi: boolean; resultado: boolean; questoes: QuestaoDoSimulado[] }
export interface Ficha { competencias: { nota: number; comentario: string }[]; geral: string }
export interface SemanaDaRedacao { semana: string; titulo: string; aberta: boolean; tem_ref: boolean }
export const NOTAS_DA_REDACAO = [0, 40, 80, 120, 160, 200] as const;
export const TIPOS_DE_EDITAL =["edital", "bolsa", "premio", "curso", "estagio"] as const;
export type TipoDeEdital = (typeof TIPOS_DE_EDITAL)[number];
export interface Edital { id: string; titulo: string; orgao: string; tipo: TipoDeEdital; link: string; prazo: string; resumo: string; situacao: "proposto" | "publicado" }
export interface MuralDeEditais { cuido: boolean; itens: Edital[]; fila: Edital[] }
export interface PedidoDeEdital { titulo: string; orgao: string; tipo: TipoDeEdital; link: string; prazo: string; resumo: string }

/** O cliente do lote sobre uma função que chama o banco (a de verdade ou o dublê). */
export function criarClienteDE(c: Chamar) {
  return {
    inicio: () => c<Inicio>("rede_p4_de_inicio"),
    // 45. Assuntos em movimento
    assuntos: () => c<Assuntos>("rede_p4_de_assuntos"),
    // 49. Servidores aprovados para os #temas do Fediverso
    servidores: () => c<Servidores>("rede_p4_de_servidores"),
    aprovarServidor: (dominio: string, sim: boolean) => c<Servidores>("rede_p4_de_servidor", { p_dominio: dominio, p_sim: sim }),
    // 51. Linhas compartilháveis
    publicarLinha: (nome: string, filtro: { tags?: string[]; comunidades?: string[] }) => c<LinhaCompartilhada>("rede_p4_de_linha_publicar", { p_nome: nome, p_filtro: filtro }),
    linha: (codigo: string) => c<LinhaCompartilhada>("rede_p4_de_linha", { p_codigo: codigo }),
    minhasLinhas: () => c<{ itens: LinhaCompartilhada[] }>("rede_p4_de_minhas_linhas"),
    tirarLinha: (codigo: string) => c<{ tirada: boolean }>("rede_p4_de_linha_tirar", { p_codigo: codigo }),
    // 68. Correção de referência da redação
    semanasDaRedacao: () => c<{ itens: SemanaDaRedacao[] }>("rede_p4_de_redacao_semanas"),
    referencia: (semana: string) => c<{ existe: boolean; liberada: boolean; ficha: Ficha | null }>("rede_p4_de_redacao_ref", { p_semana: semana }),
    salvarReferencia: (semana: string, ficha: Ficha) => c<{ semana: string; ficha: Ficha }>("rede_p4_de_redacao_ref_salvar", { p_semana: semana, p_ficha: ficha }),
    // 69. Simulado ao vivo da turma
    bancoDeQuestoes: (materia: string | null) => c<{ itens: { id: string; materia: string; tema: string; enunciado: string }[] }>("rede_p4_de_simulado_banco", { p_materia: materia }),
    abrirSimulado: (turma: string, titulo: string, questoes: string[], minutos: number) => c<{ id: string }>("rede_p4_de_simulado_abrir", { p_turma: turma, p_titulo: titulo, p_questoes: questoes, p_minutos: minutos }),
    simulados: (turma: string) => c<{ cuido: boolean; itens: Simulado[] }>("rede_p4_de_simulados", { p_turma: turma }),
    responderSimulado: (id: string, respostas: number[]) => c<{ respondi: boolean }>("rede_p4_de_simulado_responder", { p_id: id, p_respostas: respostas }),
    encerrarSimulado: (id: string) => c<{ fechado: boolean }>("rede_p4_de_simulado_encerrar", { p_id: id }),
    // 71. Mentoria entre pares
    mentorias: () => c<Mentorias>("rede_p4_de_mentorias"),
    oferecerMentoria: (trilha: string, vagas: number) => c<{ oferta: boolean }>("rede_p4_de_mentoria_oferecer", { p_trilha: trilha, p_vagas: vagas }),
    haMentoria: (trilha: string) => c<{ ha: boolean }>("rede_p4_de_mentoria_ha", { p_trilha: trilha }),
    pedirMentoria: (trilha: string) => c<{ par: Par | null }>("rede_p4_de_mentoria_pedir", { p_trilha: trilha }),
    encerrarMentoria: (id: string) => c<{ encerrada: boolean }>("rede_p4_de_mentoria_encerrar", { p_id: id }),
    // 102. Mural de editais e bolsas
    editais: (tipo: TipoDeEdital | null) => c<MuralDeEditais>("rede_p4_de_editais", { p_tipo: tipo }),
    proporEdital: (p: PedidoDeEdital) => c<{ id: string; situacao: "proposto" }>("rede_p4_de_edital_propor", { p }),
    decidirEdital: (id: string, publicar: boolean) => c<{ feito: boolean }>("rede_p4_de_edital_decidir", { p_id: id, p_publicar: publicar }),
  };
}

export type ClienteDE = ReturnType<typeof criarClienteDE>;

/** O dublê da prévia: exemplos inventados, na memória da aba. Nada sai do aparelho. */
export function dubleDE(): Chamar {
  const r = <T>(v: unknown) => Promise.resolve(structuredClone(v) as T);
  const servidores = new Set(["exemplo.social", "rede.exemplo.org"]);
  let referencia: Ficha | null = null;
  const QUESTOES = [
    { id: "00000000-0000-4000-8000-00000000000a", materia: "matematica", enunciado: "Quanto é 15% de 200?", alternativas: ["15", "20", "30", "35"], certa: 2, explicacao: "15% de 200 = 0,15 × 200 = 30." },
    { id: "00000000-0000-4000-8000-00000000000b", materia: "historia", enunciado: "Em que ano foi promulgada a Constituição brasileira em vigor?", alternativas: ["1946", "1967", "1988", "1990"], certa: 2, explicacao: "A Constituição em vigor é de 5 de outubro de 1988." },
    { id: "00000000-0000-4000-8000-00000000000c", materia: "portugues", enunciado: "Qual palavra está escrita corretamente?", alternativas: ["excessão", "exceção", "esceção", "excesão"], certa: 1, explicacao: "Escreve-se \"exceção\"." },
  ];
  const simulados: Simulado[] = [];
  const mentorias: Mentorias = { ofertas: [], pares: [], veterana: true };
  const emDias = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const editais: Edital[] = [
    { id: "e1", titulo: "Bolsa de iniciação científica (exemplo)", orgao: "Universidade de exemplo", tipo: "bolsa", link: "https://exemplo.org/edital", prazo: emDias(12), resumo: "Exemplo da prévia: nada aqui é real.", situacao: "publicado" },
    { id: "e2", titulo: "Curso livre de escrita (exemplo)", orgao: "Coletivo de exemplo", tipo: "curso", link: "https://exemplo.org/curso", prazo: emDias(30), resumo: "", situacao: "proposto" },
  ];
  const linhas = new Map<string, LinhaCompartilhada>([["0a1b2c3d4e5f", { codigo: "0a1b2c3d4e5f", nome: "Moradia e transporte", minha: false, tags: ["passelivre", "despejozero"], comunidades: [] }]]);
  return async <T>(funcao: string, a: Record<string, unknown> = {}): Promise<T> => {
    switch (funcao) {
      case "rede_p4_de_inicio":
        return r<T>({ cuido: true, educadora: true, turmas: [{ id: "00000000-0000-4000-8000-0000000000a1", nome: "Turma do cursinho", cuido: true }] });
      case "rede_p4_de_servidores":
        return r<T>({ servidores: [...servidores], cuido: true });
      case "rede_p4_de_servidor": {
        const d = String(a.p_dominio ?? "").toLowerCase();
        if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) throw new BackendError("invalido:dominio");
        if (a.p_sim) servidores.add(d);
        else servidores.delete(d);
        return r<T>({ servidores: [...servidores] });
      }
      case "rede_p4_de_linha_publicar": {
        const f = (a.p_filtro ?? {}) as { tags?: string[]; comunidades?: string[] };
        if (!f.tags?.length && !f.comunidades?.length) throw new BackendError("invalido:vazia");
        const l: LinhaCompartilhada = { codigo: `a1b2c3d4e5f${linhas.size}`, nome: String(a.p_nome ?? ""), minha: true, tags: f.tags ?? [], comunidades: (f.comunidades ?? []).map((slug) => ({ slug, nome: slug })) };
        linhas.set(l.codigo, l);
        return r<T>(l);
      }
      case "rede_p4_de_linha": {
        const l = linhas.get(String(a.p_codigo ?? ""));
        if (!l) throw new BackendError("nao_encontrada");
        return r<T>(l);
      }
      case "rede_p4_de_minhas_linhas":
        return r<T>({ itens: [...linhas.values()].filter((l) => l.minha) });
      case "rede_p4_de_linha_tirar":
        linhas.delete(String(a.p_codigo ?? ""));
        return r<T>({ tirada: true });
      case "rede_p4_de_mentorias":
        return r<T>(mentorias);
      case "rede_p4_de_mentoria_oferecer": {
        const trilha = String(a.p_trilha);
        mentorias.ofertas = mentorias.ofertas.filter((o) => o.trilha !== trilha);
        if (Number(a.p_vagas)) mentorias.ofertas.push({ trilha, vagas: Number(a.p_vagas) });
        return r<T>({ oferta: Boolean(Number(a.p_vagas)) });
      }
      case "rede_p4_de_mentoria_ha":
        return r<T>({ ha: true });
      case "rede_p4_de_mentoria_pedir": {
        const par: Par = { id: `p${mentorias.pares.length + 1}`, trilha: String(a.p_trilha), papel: "caloura", codinome: "Maré (exemplo)", handle: "mare" };
        mentorias.pares.unshift(par);
        return r<T>({ par });
      }
      case "rede_p4_de_mentoria_encerrar":
        mentorias.pares = mentorias.pares.filter((p) => p.id !== a.p_id);
        return r<T>({ encerrada: true });
      case "rede_p4_de_simulado_banco":
        return r<T>({ itens: QUESTOES.map((q) => ({ id: q.id, materia: q.materia, tema: "exemplo", enunciado: q.enunciado })) });
      case "rede_p4_de_simulados":
        return r<T>({ cuido: true, itens: simulados });
      case "rede_p4_de_simulado_abrir": {
        const ids = (a.p_questoes as string[]) ?? [];
        if (ids.length < 3) throw new BackendError("invalido:questoes");
        const s: Simulado = { id: `s${simulados.length + 1}`, titulo: String(a.p_titulo), abre: new Date().toISOString(), fecha: new Date(Date.now() + Number(a.p_minutos) * 60e3).toISOString(), fechado: false, respondi: false, resultado: false,
          questoes: QUESTOES.filter((q) => ids.includes(q.id)).map(({ id, materia, enunciado, alternativas }) => ({ id, materia, enunciado, alternativas })) };
        simulados.unshift(s);
        return r<T>({ id: s.id });
      }
      case "rede_p4_de_simulado_responder": {
        const s = simulados.find((x) => x.id === a.p_id);
        if (!s) throw new BackendError("nao_encontrado");
        if (s.fechado) throw new BackendError("encerrado");
        s.respondi = true;
        return r<T>({ respondi: true });
      }
      case "rede_p4_de_simulado_encerrar": {
        const s = simulados.find((x) => x.id === a.p_id);
        if (!s) throw new BackendError("sem_permissao");
        // Na prévia, como se 3 ou mais tivessem respondido.
        Object.assign(s, { fechado: true, resultado: true, questoes: s.questoes.map((q) => ({ ...q, ...QUESTOES.find((x) => x.id === q.id)!, faixa: "metade" as const })) });
        return r<T>({ fechado: true });
      }
      case "rede_p4_de_redacao_semanas":
        return r<T>({ itens: [{ semana: "2026-11-16", titulo: "Os desafios do transporte público nas cidades brasileiras", aberta: true, tem_ref: Boolean(referencia) }] });
      case "rede_p4_de_redacao_ref":
        return r<T>({ existe: Boolean(referencia), liberada: Boolean(referencia), ficha: referencia });
      case "rede_p4_de_redacao_ref_salvar": {
        const f = a.p_ficha as Ficha;
        if (f.competencias.length !== 5 || f.competencias.some((c) => c.comentario.trim().length < 20)) throw new BackendError("invalido:comentario");
        referencia = f;
        return r<T>({ semana: a.p_semana, ficha: f });
      }
      case "rede_p4_de_editais": {
        const tipo = a.p_tipo as string | null;
        return r<T>({ cuido: true, itens: editais.filter((e) => e.situacao === "publicado" && (!tipo || e.tipo === tipo)), fila: editais.filter((e) => e.situacao === "proposto") });
      }
      case "rede_p4_de_edital_propor": {
        const p = a.p as PedidoDeEdital;
        if (!/^https:\/\//.test(p.link)) throw new BackendError("invalido:link");
        if (!p.titulo || p.titulo.trim().length < 5) throw new BackendError("invalido:titulo");
        const e: Edital = { ...p, id: `e${editais.length + 1}`, situacao: "proposto" };
        editais.push(e);
        return r<T>({ id: e.id, situacao: "proposto" });
      }
      case "rede_p4_de_edital_decidir": {
        const i = editais.findIndex((e) => e.id === a.p_id);
        if (i < 0) throw new BackendError("nao_encontrado");
        if (a.p_publicar) editais[i] = { ...editais[i], situacao: "publicado" };
        else editais.splice(i, 1);
        return r<T>({ feito: true });
      }
      case "rede_p4_de_assuntos":
        return r<T>({ temas: [{ tag: "passelivre", faixa: "dezenas" }, { tag: "greve", faixa: "algumas" }, { tag: "enem2026", faixa: "algumas" }], regra: { horas: 72, comunidades: 3, pessoas: 3, maximo: 12 } });
      default:
        throw new BackendError("desligado");
    }
  };
}

export const de = criarClienteDE(PREVIA_DE ? dubleDE() : chamar);

/** As notas de um #tema do Fediverso, pelo servidor do site (nunca direto do aparelho). Na prévia, exemplos inventados. */
export async function notasDoTemaDeFora(tema: string): Promise<NotaDeFora[]> {
  if (PREVIA_DE) {
    return [
      { url: "https://exemplo.social/@coletivo/1", conta: "coletivo@exemplo.social", nome: "Coletivo de exemplo", texto: `Ato marcado para sábado. #${tema}`, aviso: "", criado_em: new Date().toISOString(), servidor: "exemplo.social" },
    ];
  }
  const supabase = await getClient();
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) throw new BackendError("entre_primeiro");
  let r: Response;
  try {
    r = await fetch(`/api/rede/fediverso-tema?tag=${encodeURIComponent(tema)}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new BackendError("sem_conexao");
  }
  const corpo = (await r.json().catch(() => null)) as { notas?: NotaDeFora[]; erro?: string } | null;
  if (!r.ok) throw new BackendError(corpo?.erro ?? "outro");
  return Array.isArray(corpo?.notas) ? corpo.notas : [];
}

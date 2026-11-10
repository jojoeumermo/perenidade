// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O DUBLÊ do B1 dos atos (tarefas, caronas, petição, meta e link) para a prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim): as funções de
// verdade (supabase/migracoes/20261110-alumia-b1-atos.sql) têm o mesmo contrato. Tudo na memória da aba; os codinomes são
// ilustrativos (não são pessoas). Segue as regras do banco: codinome só para quem organiza; carona sem quem; petição sem lista e
// total só a partir de 3. Sem "@/" de propósito.
import { LIMITES_DO_ATO, type Ato, type CaronaDoAto, type MeioDaCarona, type PeticaoDoAto, type QuadroDeTarefas } from "../tipos-atos";
import { pareceDadoPessoal } from "./quadros";

interface TarefaGuardada { id: string; item: string; quantos: number; quem: string[]; eu: boolean }
interface CaronaGuardada extends Omit<CaronaDoAto, "apagar"> { ato: string }
interface PeticaoGuardada { id: string; ato: string; alvo: string; texto: string; prazo: string | null; encerrada: boolean; assinaturas: number; assinei: boolean }

const CODINOMES = ["Lampião", "Mandacaru", "Ipê Roxo", "Carcará", "Jatobá"];

/** As funções do B1 no dublê. `achar` é o do dublê dos atos (recusa ato desconhecido). */
export function dubleDosQuadros(achar: (id: unknown) => { ato: Ato; confirmados: number }, agora = Date.now()) {
  const tarefas = new Map<string, TarefaGuardada[]>();
  const caronas: CaronaGuardada[] = [];
  const peticoes: PeticaoGuardada[] = [];
  let n = 0;
  const novoId = (p: string) => `previa-${p}-${++n}`;

  // Exemplos: o Passe Livre (de outra organização) e a Vigília (que "você" organiza na prévia) já têm tarefas e caronas.
  const semear = (ato: Ato) => {
    if (tarefas.has(ato.id)) return;
    const lista: TarefaGuardada[] = [
      { id: novoId("tarefa"), item: "Caixa de som e microfone", quantos: 1, quem: [CODINOMES[0]], eu: false },
      { id: novoId("tarefa"), item: "Faixas e cartazes", quantos: 4, quem: [CODINOMES[1], CODINOMES[2]], eu: false },
      { id: novoId("tarefa"), item: "Água e lanche para a vigília", quantos: 3, quem: [], eu: false },
      { id: novoId("tarefa"), item: "Kit de primeiros socorros", quantos: 1, quem: [], eu: false },
    ];
    tarefas.set(ato.id, lista);
    const inicio = Date.parse(ato.inicio);
    caronas.push(
      { id: novoId("carona"), ato: ato.id, tipo: "oferta", meio: "onibus", saida: "Terminal Itaquera, plataforma 3", vagas: 18, sai_em: new Date(inicio - 90 * 60_000).toISOString(), minha: false },
      { id: novoId("carona"), ato: ato.id, tipo: "oferta", meio: "carro", saida: "Metrô Vila Matilde, saída da Rua Joaquim Marra", vagas: 0, sai_em: new Date(inicio - 60 * 60_000).toISOString(), minha: false },
      { id: novoId("carona"), ato: ato.id, tipo: "pedido", meio: "carro", saida: "Praça do Forró, São Miguel", vagas: 2, sai_em: null, minha: false },
    );
  };

  const quadro = (ato: Ato): QuadroDeTarefas => {
    semear(ato);
    return {
      organiza: ato.meu,
      tarefas: (tarefas.get(ato.id) ?? []).map((t) => {
        const assumidas = t.quem.length + (t.eu ? 1 : 0);
        return {
          id: t.id, item: t.item, quantos: t.quantos, completa: assumidas >= t.quantos, eu: t.eu,
          assumidas: ato.meu ? assumidas : null,
          quem: ato.meu ? [...t.quem, ...(t.eu ? ["Você"] : [])] : null,
        };
      }),
    };
  };
  const acharTarefa = (id: unknown) => {
    for (const [ato, lista] of tarefas) {
      const t = lista.find((x) => x.id === id);
      if (t) return { t, ato: achar(ato).ato, lista };
    }
    throw new Error("nao_encontrado");
  };
  const listaDeCaronas = (ato: Ato): CaronaDoAto[] => {
    semear(ato);
    return caronas
      .filter((k) => k.ato === ato.id)
      .sort((a, b) => a.tipo.localeCompare(b.tipo))
      .map(({ ato: _a, ...k }) => ({ ...k, apagar: k.minha || ato.meu }));
  };
  const aberto = (ato: Ato) => {
    if (ato.situacao === "cancelado") throw new Error("ato_cancelado");
  };
  const peticaoJson = (p: PeticaoGuardada, ato: Ato): PeticaoDoAto => ({
    id: p.id, ato: p.ato, alvo: p.alvo, texto: p.texto, prazo: p.prazo,
    aberta: !p.encerrada && (!p.prazo || Date.parse(p.prazo) > Date.now()),
    // Na prévia, o "marco" é imediato (não há relógio de 15 min), mas a regra de 3 vale.
    total: p.assinaturas >= 3 ? p.assinaturas : null,
    assinei: p.assinei,
    organiza: ato.meu,
  });

  return {
    rede_ato_editar(a: { p_id?: string; p?: Record<string, unknown> }): Ato {
      const x = achar(a.p_id);
      if (!x.ato.meu) throw new Error("so_quem_organizou");
      const p = a.p ?? {};
      if ("meta" in p) {
        const m = p.meta === null || p.meta === "" ? null : Number(p.meta);
        if (m !== null && (!Number.isInteger(m) || m < LIMITES_DO_ATO.metaMin || m > LIMITES_DO_ATO.metaMax)) throw new Error("invalido:meta");
        x.ato = { ...x.ato, meta: m };
      }
      if ("link_apoio" in p) {
        const l = typeof p.link_apoio === "string" && p.link_apoio.trim() ? p.link_apoio.trim() : null;
        if (l && !/^https:\/\/[^\s<>"']{4,}$/.test(l)) throw new Error("invalido:link_apoio");
        x.ato = { ...x.ato, link_apoio: l };
      }
      return { ...x.ato, total: x.ato.meu ? x.confirmados : null };
    },
    rede_ato_tarefas(a: { p_ato?: string }): QuadroDeTarefas {
      return quadro(achar(a.p_ato).ato);
    },
    rede_ato_tarefa_criar(a: { p_ato?: string; p_item?: string; p_quantos?: number }): QuadroDeTarefas {
      const { ato } = achar(a.p_ato);
      if (!ato.meu) throw new Error("so_quem_organizou");
      aberto(ato);
      const item = (a.p_item ?? "").replace(/\s+/g, " ").trim();
      if (item.length < 2 || item.length > 80) throw new Error("invalido:item");
      if (pareceDadoPessoal(item)) throw new Error("dado_pessoal");
      const quantos = Number(a.p_quantos ?? 1);
      if (!Number.isInteger(quantos) || quantos < 1 || quantos > 50) throw new Error("invalido:quantos");
      semear(ato);
      const lista = tarefas.get(ato.id) ?? [];
      if (lista.length >= 30) throw new Error("invalido:tarefas");
      lista.push({ id: novoId("tarefa"), item, quantos, quem: [], eu: false });
      return quadro(ato);
    },
    rede_ato_tarefa_apagar(a: { p_tarefa?: string }): QuadroDeTarefas {
      const { t, ato, lista } = acharTarefa(a.p_tarefa);
      if (!ato.meu) throw new Error("so_quem_organizou");
      lista.splice(lista.indexOf(t), 1);
      return quadro(ato);
    },
    rede_ato_tarefa_assumir(a: { p_tarefa?: string; p_sim?: boolean }): QuadroDeTarefas {
      const { t, ato } = acharTarefa(a.p_tarefa);
      const sim = a.p_sim !== false;
      if (sim && !t.eu) {
        aberto(ato);
        if (t.quem.length >= t.quantos) throw new Error("tarefa_completa");
      }
      t.eu = sim;
      return quadro(ato);
    },
    rede_ato_caronas(a: { p_ato?: string }): CaronaDoAto[] {
      return listaDeCaronas(achar(a.p_ato).ato);
    },
    rede_ato_carona_criar(a: { p_ato?: string; p?: Record<string, unknown> }): CaronaDoAto[] {
      const { ato } = achar(a.p_ato);
      aberto(ato);
      const p = a.p ?? {};
      const tipo = p.tipo === "oferta" || p.tipo === "pedido" ? p.tipo : null;
      if (!tipo) throw new Error("invalido:tipo");
      const saida = typeof p.saida === "string" ? p.saida.replace(/\s+/g, " ").trim() : "";
      if (saida.length < 3 || saida.length > 100) throw new Error("invalido:saida");
      if (pareceDadoPessoal(saida)) throw new Error("dado_pessoal");
      const vagas = p.vagas === null || p.vagas === undefined || p.vagas === "" ? null : Number(p.vagas);
      if (vagas !== null && (!Number.isInteger(vagas) || vagas < 1 || vagas > 60)) throw new Error("invalido:vagas");
      if (caronas.filter((k) => k.ato === ato.id && k.minha).length >= 2) throw new Error("invalido:caronas");
      caronas.push({ id: novoId("carona"), ato: ato.id, tipo, meio: (typeof p.meio === "string" ? p.meio : "carro") as MeioDaCarona, saida, vagas, sai_em: typeof p.sai_em === "string" && p.sai_em ? p.sai_em : null, minha: true });
      return listaDeCaronas(ato);
    },
    rede_ato_carona_vagas(a: { p_id?: string; p_vagas?: number | null }): CaronaDoAto[] {
      const k = caronas.find((x) => x.id === a.p_id && x.minha);
      if (!k) throw new Error("nao_encontrado");
      const v = a.p_vagas ?? null;
      if (v !== null && (!Number.isInteger(v) || v < 0 || v > 60)) throw new Error("invalido:vagas");
      k.vagas = v;
      return listaDeCaronas(achar(k.ato).ato);
    },
    rede_ato_carona_apagar(a: { p_id?: string }): CaronaDoAto[] {
      const i = caronas.findIndex((x) => x.id === a.p_id);
      if (i < 0) throw new Error("nao_encontrado");
      const { ato } = achar(caronas[i].ato);
      if (!caronas[i].minha && !ato.meu) throw new Error("nao_encontrado");
      caronas.splice(i, 1);
      return listaDeCaronas(ato);
    },
    rede_peticao(a: { p_ato?: string }): PeticaoDoAto | null {
      const { ato } = achar(a.p_ato);
      // A Vigília já tem petição na prévia (para ver a tela de quem assina e de quem organiza).
      if (!peticoes.some((p) => p.ato === ato.id) && ato.id.endsWith("0d02")) {
        peticoes.push({ id: novoId("peticao"), ato: ato.id, alvo: "Prefeitura e Tribunal de Justiça", texto: "Pedimos a suspensão da reintegração de posse da ocupação Esperança até que as 230 famílias tenham moradia digna garantida.", prazo: new Date(agora + 20 * 86_400_000).toISOString(), encerrada: false, assinaturas: 41, assinei: false });
      }
      const p = peticoes.find((x) => x.ato === ato.id);
      return p ? peticaoJson(p, ato) : null;
    },
    rede_peticao_criar(a: { p_ato?: string; p?: Record<string, unknown> }): PeticaoDoAto {
      const { ato } = achar(a.p_ato);
      if (!ato.meu) throw new Error("so_quem_organizou");
      if (peticoes.some((x) => x.ato === ato.id)) throw new Error("peticao_existe");
      const p = a.p ?? {};
      const alvo = typeof p.alvo === "string" ? p.alvo.trim() : "";
      const texto = typeof p.texto === "string" ? p.texto.trim() : "";
      if (alvo.length < 3 || alvo.length > 120) throw new Error("invalido:alvo");
      if (texto.length < 20 || texto.length > 1500) throw new Error("invalido:texto");
      if (pareceDadoPessoal(`${alvo} ${texto}`)) throw new Error("dado_pessoal");
      const prazo = typeof p.prazo === "string" && p.prazo ? p.prazo : null;
      if (prazo && Date.parse(prazo) <= Date.now()) throw new Error("invalido:prazo");
      const nova = { id: novoId("peticao"), ato: ato.id, alvo, texto, prazo, encerrada: false, assinaturas: 0, assinei: false };
      peticoes.push(nova);
      return peticaoJson(nova, ato);
    },
    rede_peticao_assinar(a: { p_peticao?: string; p_sim?: boolean }): PeticaoDoAto {
      const p = peticoes.find((x) => x.id === a.p_peticao);
      if (!p) throw new Error("nao_encontrado");
      const { ato } = achar(p.ato);
      const sim = a.p_sim !== false;
      if (sim && !peticaoJson(p, ato).aberta) throw new Error("peticao_encerrada");
      if (sim !== p.assinei) p.assinaturas += sim ? 1 : -1;
      p.assinei = sim;
      return peticaoJson(p, ato);
    },
    rede_peticao_encerrar(a: { p_peticao?: string }): PeticaoDoAto {
      const p = peticoes.find((x) => x.id === a.p_peticao);
      if (!p) throw new Error("nao_encontrado");
      const { ato } = achar(p.ato);
      if (!ato.meu) throw new Error("so_quem_organizou");
      p.encerrada = true;
      return peticaoJson(p, ato);
    },
  };
}

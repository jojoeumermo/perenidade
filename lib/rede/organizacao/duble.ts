// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O dublê da prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim) do grupo "organização e ação coletiva": responde na memória da aba, com dados de
// exemplo, as mesmas formas que o banco devolve. Nada vai a lugar nenhum. As regras de verdade são as do banco
// (supabase/migracoes/20261127-p4-organizacao.sql, provadas em scripts/testar-p4-organizacao.mjs). Sem "@/" de propósito.
import { BackendError } from "../../backend";
import type { Chamar } from "../cliente";
import type { ApoioDireto, Cartao, CoisaDoInventario, Coluna, Consenso, EnqueteDeHorario, Meta, Orcamento, PedidoDoMural, PontoDeApoio, Posicao, TipoDoMural, TrocaDeHoras } from "./cliente";
import type { ApoioDaRota, Coordenada, LugarDoTermometro, ReuniaoRecorrente, RotaDoAto } from "./regras";

let contador = 0;
/** Um id para o exemplo (não é segurança: só a chave da lista na tela). */
function idDoExemplo(): string {
  const c = globalThis.crypto;
  contador += 1;
  return typeof c?.randomUUID === "function" ? c.randomUUID() : `00000000-0000-4000-8000-${String(contador).padStart(12, "0")}`;
}

const texto = (v: unknown, min: number, max: number, campo = "titulo") => {
  const t = String(v ?? "").trim();
  if (t.length < min || t.length > max) throw new BackendError(`invalido:${campo}`);
  if (/\d{4,5}[-\s]?\d{4}|@[a-z0-9-]+\.[a-z]/i.test(t)) throw new BackendError("dado_pessoal");
  return t;
};

export function dubleDaOrganizacao(): Chamar {
  const ORGS = [{ handle: "coletivo_exemplo", nome: "Coletivo de exemplo", gerencio: true }];
  const COMUNIDADES = [{ slug: "luta-moradia", nome: "Luta por moradia", modero: true }];
  const FUNCOES = [{ id: idDoExemplo(), nome: "Secretaria" }, { id: idDoExemplo(), nome: "Comunicação" }];
  const ATOS = [{ id: idDoExemplo(), titulo: "Ato pela moradia", inicio: new Date(Date.now() + 3 * 864e5).toISOString() }];
  const cartoes: Cartao[] = [
    { id: idDoExemplo(), titulo: "Pintar a faixa do ato", notas: "Tinta na sede.", coluna: "a_fazer", prazo: null, ato: ATOS[0], funcao: FUNCOES[0], eu: false, tem_quem: true, assumidas: 3, recorrencia: null, rodizio: [] },
    { id: idDoExemplo(), titulo: "Mandar o boletim da semana", notas: "", coluna: "fazendo", prazo: null, ato: null, funcao: FUNCOES[1], eu: false, tem_quem: false, assumidas: null, recorrencia: "semanal", rodizio: FUNCOES },
  ];
  const daqui = (dias: number, hora: number) => { const x = new Date(Date.now() + dias * 864e5); x.setHours(hora, 0, 0, 0); return x.toISOString(); };
  const enquetes: (EnqueteDeHorario & { _somas: number[]; _votos: number })[] = [
    { id: idDoExemplo(), titulo: "Reunião de planejamento", opcoes: [daqui(6, 19), daqui(7, 19), daqui(9, 10)], fecha_em: daqui(4, 12), fechada: false, votei: false, posso_fechar: true, resultado: null, _somas: [2, 3, 1], _votos: 4 },
  ];
  const semSomas = ({ _somas, _votos, ...e }: EnqueteDeHorario & { _somas: number[]; _votos: number }): EnqueteDeHorario => {
    if (!e.fechada) return { ...e, resultado: null };
    const totais = _somas.map((n) => (n >= 3 ? n : null));
    const max = Math.max(..._somas);
    return { ...e, resultado: { votantes: _votos >= 3 ? _votos : null, totais, melhor: max >= 3 ? _somas.indexOf(max) + 1 : null } };
  };
  const reunioes: ReuniaoRecorrente[] = [
    { id: idDoExemplo(), titulo: "Reunião da coordenação", frequencia: "semanal", dia_semana: 2, semana_do_mes: null, hora: "19:30", duracao_min: 90, local_tipo: "sindicato", local_texto: "Sede do sindicato", inicio: new Date().toISOString().slice(0, 10), fim: null, lembrete_min: 60 },
  ];
  const mural: PedidoDoMural[] = [
    { id: idDoExemplo(), tipo: "preciso", categoria: "mudanca", titulo: "Ajuda na mudança no sábado", texto: "Duas pessoas e um carrinho de mão.", criado_em: new Date().toISOString(), expira_em: new Date(Date.now() + 30 * 864e5).toISOString(), meu: false, autor: { codinome: "Girassol", handle: "girassol" } },
    { id: idDoExemplo(), tipo: "vaga", categoria: "outro", titulo: "Vaga na cooperativa de costura", texto: "Meio período.", link: "https://exemplo.org/vagas", criado_em: new Date().toISOString(), expira_em: new Date(Date.now() + 30 * 864e5).toISOString(), meu: false, autor: { codinome: "Girassol", handle: "girassol" } },
    { id: idDoExemplo(), tipo: "ofereco", categoria: "aula", titulo: "Aula de matemática para o ENEM", texto: "Sábados de manhã, online.", criado_em: new Date().toISOString(), expira_em: new Date(Date.now() + 30 * 864e5).toISOString(), meu: true, autor: { codinome: "Você", handle: "voce" } },
  ];
  const trocas: TrocaDeHoras[] = [
    { id: idDoExemplo(), servico: "Aula de matemática", minutos: 120, estado: "confirmada", dia: new Date().toISOString().slice(0, 10), papel: "dei", pode_responder: false, outra: { codinome: "Girassol", handle: "girassol" } },
    { id: idDoExemplo(), servico: "Conserto da bicicleta", minutos: 60, estado: "pendente", dia: new Date().toISOString().slice(0, 10), papel: "dei", pode_responder: true, outra: { codinome: "Ipê", handle: "ipe" } },
  ];

  const coisas: CoisaDoInventario[] = [
    { id: idDoExemplo(), nome: "Megafone", notas: "Pilhas na caixa azul.", quantidade: 2, emprestadas: 1, disponiveis: 1 },
    { id: idDoExemplo(), nome: "Faixa \"Moradia é direito\"", notas: "", quantidade: 1, emprestadas: 0, disponiveis: 1 },
  ];

  const pontos: PontoDeApoio[] = [
    { id: idDoExemplo(), tipo: "cozinha", nome: "Cozinha solidária do centro", endereco: "Praça da Sé", cidade: "São Paulo", horario: "Todo dia, 11h às 14h", aprovado: true },
    { id: idDoExemplo(), tipo: "biblioteca", nome: "Biblioteca Mário de Andrade", endereco: "Rua da Consolação, 94", cidade: "São Paulo", horario: "", aprovado: false },
  ];

  let rota: RotaDoAto | null = {
    pontos: [[-23.5505, -46.6333], [-23.5489, -46.6388], [-23.5475, -46.6361], [-23.5458, -46.6372]],
    apoios: [{ lat: -23.5498, lon: -46.635, tipo: "agua", nome: "Água na escadaria" }, { lat: -23.5462, lon: -46.6369, tipo: "dispersao", nome: "Dispersão na praça" }],
  };

  type ConsensoDoExemplo = Consenso & { _somas: Record<Posicao, number>; _votos: number };
  const consensos: ConsensoDoExemplo[] = [
    { id: idDoExemplo(), proposta: "Fazer a festa junina na praça, com a cozinha solidária.", fecha_em: daqui(2, 20), fechado: false, votei: false, posso_fechar: true, resultado: null, _somas: { concordo: 3, ressalva: 1, abstenho: 0, bloqueio: 0 }, _votos: 4 },
    { id: idDoExemplo(), proposta: "Comprar um megafone novo com a caixa geral.", fecha_em: daqui(-1, 20), fechado: true, votei: true, posso_fechar: true, resultado: null, _somas: { concordo: 4, ressalva: 0, abstenho: 1, bloqueio: 0 }, _votos: 5 },
  ];
  const semSomasDoConsenso = ({ _somas, _votos, ...x }: ConsensoDoExemplo): Consenso => {
    if (!x.fechado) return { ...x, resultado: null };
    const tres = (n: number) => (n >= 3 ? n : null);
    const totais = Object.fromEntries(Object.entries(_somas).map(([k, n]) => [k, tres(n)])) as Record<Posicao, number | null>;
    return { ...x, resultado: { votantes: tres(_votos), totais, houve_bloqueio: _votos >= 3 ? _somas.bloqueio > 0 : null, consenso: _votos >= 3 ? _somas.bloqueio === 0 && _somas.concordo + _somas.ressalva > 0 : null } };
  };

  const orcamentos: Orcamento[] = [
    {
      id: idDoExemplo(), titulo: "Orçamento do segundo semestre", centavos: 500000, propostas_ate: daqui(-3, 20), apoio_ate: daqui(4, 20), fase: "apoio", caixa: { id: "caixa-exemplo", nome: "Caixa geral" },
      consulta: null, apoiei: false, apoiadores: null, posso_conduzir: true,
      propostas: [
        { id: idDoExemplo(), titulo: "Caixa de som para os atos", descricao: "Uma caixa com bateria.", centavos: 150000, apoios: null },
        { id: idDoExemplo(), titulo: "Tinta para faixas", descricao: "", centavos: 30000, apoios: null },
      ],
    },
  ];
  const metas: Meta[] = [
    { id: idDoExemplo(), titulo: "Panfletar o bairro antes do ato", unidade: "panfletos", alvo: 500, prazo: null, encerrada: false, pessoas: 6, somei: false, soma: 320, atingida: false, posso_encerrar: true },
    { id: idDoExemplo(), titulo: "Assinaturas do abaixo-assinado", unidade: "assinaturas", alvo: 1000, prazo: null, encerrada: false, pessoas: null, somei: true, soma: null, atingida: null, posso_encerrar: true },
  ];
  const lugares: LugarDoTermometro[] = [
    { id: idDoExemplo(), tipo: "ubs", nome: "UBS Vila Nova", municipio: "sao paulo", uf: "SP", periodo: "2026-2", avaliei: false, resultado: { avaliacoes: 12, nota: 2.3, problemas: { falta_remedio: 9, demora: 7 } } },
    { id: idDoExemplo(), tipo: "onibus", nome: "Linha 875A", municipio: "sao paulo", uf: "SP", periodo: "2026-2", avaliei: true, resultado: null },
  ];
  let apoio: ApoioDireto | null = null;
  const achar = <T extends { id: string }>(lista: T[], id: unknown): T => {
    const x = lista.find((y) => y.id === id);
    if (!x) throw new BackendError("nao_encontrado");
    return x;
  };
  return async <T,>(funcao: string, a: Record<string, unknown> = {}): Promise<T> => {
    const p = (a.p ?? {}) as Record<string, unknown>;
    switch (funcao) {
      case "rede_p4_or_minhas":
        return { orgs: ORGS, comunidades: COMUNIDADES } as T;
      case "rede_p4_or_quadro":
        return { gerencio: true, cartoes, funcoes: FUNCOES, atos: ATOS } as T;
      case "rede_p4_or_cartao_criar": {
        const rodizio = Array.isArray(p.rodizio) ? FUNCOES.filter((f) => (p.rodizio as string[]).includes(f.id)) : [];
        const c: Cartao = {
          id: idDoExemplo(), titulo: texto(p.titulo, 3, 120), notas: texto(p.notas, 0, 500, "notas"), coluna: "a_fazer", prazo: (p.prazo as string) || null,
          ato: ATOS.find((x) => x.id === p.ato) ?? null, funcao: FUNCOES.find((x) => x.id === p.funcao) ?? rodizio[0] ?? null, eu: false, tem_quem: false, assumidas: null,
          recorrencia: (p.recorrencia as Cartao["recorrencia"]) || null, rodizio,
        };
        cartoes.push(c);
        return c as T;
      }
      case "rede_p4_or_cartao_mover": {
        const c = achar(cartoes, a.p_id);
        c.coluna = a.p_coluna as Coluna;
        return c as T;
      }
      case "rede_p4_or_cartao_assumir": {
        const c = achar(cartoes, a.p_id);
        c.eu = Boolean(a.p_sim);
        c.tem_quem = c.eu || (c.assumidas ?? 0) > 0;
        return c as T;
      }
      case "rede_p4_or_cartao_apagar":
        cartoes.splice(cartoes.indexOf(achar(cartoes, a.p_id)), 1);
        return { ok: true } as T;
      case "rede_p4_or_horarios":
        return { posso_criar: true, enquetes: enquetes.map(semSomas) } as T;
      case "rede_p4_or_horario_criar": {
        const opcoes = ((p.opcoes as string[]) ?? []).filter(Boolean);
        if (opcoes.length < 2) throw new BackendError("invalido:opcoes");
        if (!p.fecha_em) throw new BackendError("invalido:fecha_em");
        const e = { id: idDoExemplo(), titulo: texto(p.titulo, 3, 120), opcoes, fecha_em: String(p.fecha_em), fechada: false, votei: false, posso_fechar: true, resultado: null, _somas: opcoes.map(() => 0), _votos: 0 };
        enquetes.unshift(e);
        return semSomas(e) as T;
      }
      case "rede_p4_or_horario_votar": {
        const e = achar(enquetes, a.p_id);
        if (e.votei) throw new BackendError("ja_votou");
        e.votei = true;
        e._votos += 1;
        for (const i of new Set(a.p_opcoes as number[])) e._somas[i - 1] += 1;
        return semSomas(e) as T;
      }
      case "rede_p4_or_horario_fechar": {
        const e = achar(enquetes, a.p_id);
        e.fechada = true;
        return semSomas(e) as T;
      }
      case "rede_p4_or_reunioes":
        return { posso_criar: true, reunioes } as T;
      case "rede_p4_or_reuniao_criar": {
        const freq = String(p.frequencia) as ReuniaoRecorrente["frequencia"];
        if (!["semanal", "quinzenal", "mensal"].includes(freq)) throw new BackendError("invalido:frequencia");
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(p.hora))) throw new BackendError("invalido:hora");
        const r: ReuniaoRecorrente = {
          id: idDoExemplo(), titulo: texto(p.titulo, 3, 120), frequencia: freq, dia_semana: Number(p.dia_semana), semana_do_mes: freq === "mensal" ? Number(p.semana_do_mes) || 1 : null,
          hora: String(p.hora), duracao_min: Number(p.duracao_min) || 90, local_tipo: String(p.local_tipo || "outro"), local_texto: String(p.local_texto ?? "").slice(0, 140),
          inicio: String(p.inicio || new Date().toISOString().slice(0, 10)), fim: p.fim ? String(p.fim) : null, lembrete_min: Number(p.lembrete_min) || 0,
        };
        reunioes.push(r);
        return r as T;
      }
      case "rede_p4_or_reuniao_apagar":
        reunioes.splice(reunioes.indexOf(achar(reunioes, a.p_id)), 1);
        return { ok: true } as T;
      case "rede_p4_or_mural":
        return { posso_por: true, modero: true, itens: mural.filter((m) => !a.p_tipo || m.tipo === a.p_tipo) } as T;
      case "rede_p4_or_mural_por": {
        const m: PedidoDoMural = {
          id: idDoExemplo(), tipo: String(p.tipo) as TipoDoMural, categoria: String(p.categoria || "outro"), titulo: texto(p.titulo, 3, 100), texto: texto(p.texto, 0, 600, "texto"),
          link: (p.link as string) || null, criado_em: new Date().toISOString(), expira_em: new Date(Date.now() + 30 * 864e5).toISOString(), meu: true, autor: { codinome: "Você", handle: "voce" },
        };
        mural.unshift(m);
        return m as T;
      }
      case "rede_p4_or_mural_tirar":
        mural.splice(mural.indexOf(achar(mural, a.p_id)), 1);
        return { ok: true } as T;
      case "rede_p4_or_banco_de_tempo":
        return { saldo_min: trocas.reduce((s, x) => s + (x.estado !== "confirmada" ? 0 : x.papel === "dei" ? x.minutos : -x.minutos), 0), trocas } as T;
      case "rede_p4_or_hora_registrar": {
        if (![30, 60, 90, 120, 180, 240, 300, 360, 420, 480].includes(Number(p.minutos))) throw new BackendError("invalido:minutos");
        const x: TrocaDeHoras = { id: idDoExemplo(), servico: texto(p.servico, 3, 120, "servico"), minutos: Number(p.minutos), estado: "pendente", dia: new Date().toISOString().slice(0, 10), papel: "recebi", pode_responder: false, outra: { codinome: String(p.de).replace(/^@/, ""), handle: String(p.de).replace(/^@/, "") } };
        trocas.unshift(x);
        return x as T;
      }
      case "rede_p4_or_hora_responder": {
        const x = achar(trocas, a.p_id);
        x.estado = a.p_sim ? "confirmada" : "recusada";
        x.pode_responder = false;
        return x as T;
      }
      case "rede_p4_or_hora_apagar":
        trocas.splice(trocas.indexOf(achar(trocas, a.p_id)), 1);
        return { ok: true } as T;
      case "rede_p4_or_inventario":
        return { gerencio: true, coisas } as T;
      case "rede_p4_or_coisa_criar": {
        const q = Number(p.quantidade) || 1;
        if (q < 1 || q > 99) throw new BackendError("invalido:quantidade");
        const x: CoisaDoInventario = { id: idDoExemplo(), nome: texto(p.nome, 3, 80, "nome"), notas: texto(p.notas, 0, 200, "notas"), quantidade: q, emprestadas: 0, disponiveis: q };
        coisas.push(x);
        return x as T;
      }
      case "rede_p4_or_coisa_emprestar": {
        const x = achar(coisas, a.p_id);
        if (a.p_pegar ? x.emprestadas >= x.quantidade : x.emprestadas <= 0) throw new BackendError(a.p_pegar ? "esgotado" : "invalido:devolver");
        x.emprestadas += a.p_pegar ? 1 : -1;
        x.disponiveis = x.quantidade - x.emprestadas;
        return { ...x } as T;
      }
      case "rede_p4_or_coisa_apagar":
        coisas.splice(coisas.indexOf(achar(coisas, a.p_id)), 1);
        return { ok: true } as T;
      case "rede_p4_or_pontos":
        return { posso_propor: true, modero: true, pontos: pontos.filter((x) => x.aprovado), pendentes: pontos.filter((x) => !x.aprovado) } as T;
      case "rede_p4_or_ponto_propor": {
        if (!p.publico) throw new BackendError("invalido:publico");
        const x: PontoDeApoio = { id: idDoExemplo(), tipo: String(p.tipo || "outro"), nome: texto(p.nome, 3, 100, "nome"), endereco: String(p.endereco ?? "").slice(0, 160), cidade: String(p.cidade ?? "").slice(0, 80), horario: String(p.horario ?? "").slice(0, 120), aprovado: false };
        pontos.push(x);
        return x as T;
      }
      case "rede_p4_or_ponto_decidir": {
        const x = achar(pontos, a.p_id);
        if (a.p_aprovar) x.aprovado = true;
        else pontos.splice(pontos.indexOf(x), 1);
        return (a.p_aprovar ? x : { ok: true }) as T;
      }
      case "rede_p4_or_rota_atos":
        return [{ id: ATOS[0].id, titulo: ATOS[0].titulo, inicio: ATOS[0].inicio, cidade: "São Paulo", chamo: true, tem_rota: true }] as T;
      case "rede_p4_or_rota":
        return { ato: { id: ATOS[0].id, titulo: ATOS[0].titulo, inicio: ATOS[0].inicio, cidade: "São Paulo", ponto: "Praça da Sé", cancelado: false }, posso_desenhar: true, rota } as T;
      case "rede_p4_or_rota_salvar": {
        const pontos = ((p.pontos ?? []) as Coordenada[]);
        if (pontos.length < 2) throw new BackendError("invalido:pontos");
        rota = { pontos, apoios: (p.apoios ?? []) as ApoioDaRota[] };
        return { ato: { id: ATOS[0].id, titulo: ATOS[0].titulo, inicio: ATOS[0].inicio, cidade: "São Paulo", ponto: "Praça da Sé", cancelado: false }, posso_desenhar: true, rota } as T;
      }
      case "rede_p4_or_rota_apagar":
        rota = null;
        return { ok: true } as T;
      case "rede_p4_or_consensos":
        return { posso_criar: true, consensos: consensos.map(semSomasDoConsenso) } as T;
      case "rede_p4_or_consenso_criar": {
        const x = { id: idDoExemplo(), proposta: texto(p.proposta, 5, 500, "proposta"), fecha_em: String(p.fecha_em), fechado: false, votei: false, posso_fechar: true, resultado: null, _somas: { concordo: 0, ressalva: 0, abstenho: 0, bloqueio: 0 }, _votos: 0 };
        consensos.unshift(x);
        return semSomasDoConsenso(x) as T;
      }
      case "rede_p4_or_consenso_posicao": {
        const x = achar(consensos, a.p_id);
        if (x.votei) throw new BackendError("ja_votou");
        x.votei = true;
        x._votos += 1;
        x._somas[a.p_posicao as Posicao] += 1;
        return semSomasDoConsenso(x) as T;
      }
      case "rede_p4_or_consenso_fechar": {
        const x = achar(consensos, a.p_id);
        x.fechado = true;
        return semSomasDoConsenso(x) as T;
      }
      case "rede_p4_or_orcamentos":
        return { posso_criar: true, caixas: [{ id: "caixa-exemplo", nome: "Caixa geral" }], consultas: [], orcamentos } as T;
      case "rede_p4_or_orcamento_criar": {
        const x: Orcamento = { id: idDoExemplo(), titulo: texto(p.titulo, 3, 120), centavos: Number(p.centavos), propostas_ate: String(p.propostas_ate), apoio_ate: String(p.apoio_ate), fase: "propostas", caixa: null, consulta: null, apoiei: false, apoiadores: null, posso_conduzir: true, propostas: [] };
        if (!(x.centavos > 0)) throw new BackendError("invalido:centavos");
        orcamentos.unshift(x);
        return x as T;
      }
      case "rede_p4_or_orcamento_propor": {
        const x = achar(orcamentos, a.p_id);
        if (!(Number(p.centavos) > 0) || Number(p.centavos) > x.centavos) throw new BackendError("invalido:centavos");
        x.propostas.push({ id: idDoExemplo(), titulo: texto(p.titulo, 3, 120), descricao: texto(p.descricao, 0, 600, "descricao"), centavos: Number(p.centavos), apoios: null });
        return { ...x } as T;
      }
      case "rede_p4_or_orcamento_apoiar": {
        const x = achar(orcamentos, a.p_id);
        if (x.apoiei) throw new BackendError("ja_votou");
        x.apoiei = true;
        return { ...x } as T;
      }
      case "rede_p4_or_orcamento_consulta":
        return achar(orcamentos, a.p_id) as T;
      case "rede_p4_or_metas":
        return { posso_criar: true, metas } as T;
      case "rede_p4_or_meta_criar": {
        const alvo = Number(p.alvo);
        if (!(alvo >= 1)) throw new BackendError("invalido:alvo");
        const x: Meta = { id: idDoExemplo(), titulo: texto(p.titulo, 3, 120), unidade: texto(p.unidade, 2, 30, "unidade"), alvo, prazo: (p.prazo as string) || null, encerrada: false, pessoas: null, somei: false, soma: null, atingida: null, posso_encerrar: true };
        metas.unshift(x);
        return x as T;
      }
      case "rede_p4_or_meta_somar": {
        const x = achar(metas, a.p_id);
        const n = Number(a.p_quanto);
        if (!(n >= 1) || n > x.alvo) throw new BackendError("invalido:quanto");
        x.somei = true;
        if (x.soma !== null) x.soma += n;
        x.atingida = x.soma === null ? null : x.soma >= x.alvo;
        return { ...x } as T;
      }
      case "rede_p4_or_meta_encerrar": {
        const x = achar(metas, a.p_id);
        x.encerrada = true;
        return { ...x } as T;
      }
      case "rede_p4_or_lugares":
        return { municipio: String(a.p_municipio ?? ""), uf: String(a.p_uf ?? ""), lugares } as T;
      case "rede_p4_or_lugar_criar": {
        const x: LugarDoTermometro = { id: idDoExemplo(), tipo: String(p.tipo) as LugarDoTermometro["tipo"], nome: texto(p.nome, 3, 100, "nome"), municipio: String(p.municipio), uf: String(p.uf), periodo: "2026-2", avaliei: false, resultado: null };
        lugares.push(x);
        return x as T;
      }
      case "rede_p4_or_lugar_avaliar": {
        const x = achar(lugares, a.p_id);
        if (x.avaliei) throw new BackendError("ja_votou");
        x.avaliei = true;
        return { ...x } as T;
      }
      case "rede_p4_or_apoio_meu":
        return apoio as T;
      case "rede_p4_or_apoio_salvar": {
        const pix = String(p.pix ?? "").trim();
        if (pix && !/^[0-9a-f-]{36}$/i.test(pix)) throw new BackendError(/@|\d{3}\.?\d{3}|\d{4}-?\d{4}/.test(pix) ? "dado_pessoal" : "invalido:pix");
        apoio = pix || p.link ? { pix: pix.toLowerCase() || null, link: (p.link as string) || null, texto: String(p.texto ?? "") } : null;
        return apoio as T;
      }
      case "rede_p4_or_apoio_de":
        return { pix: "123e4567-e89b-42d3-a456-426614174000", link: "https://exemplo.org/vaquinha", texto: "Para o próximo zine", meu: false } as T;
      case "rede_p4_or_checagem_pedir":
        texto(a.p_motivo, 10, 500, "motivo");
        return { ok: true, ja_na_fila: false } as T;
      default:
        throw new BackendError("desligado");
    }
  };
}

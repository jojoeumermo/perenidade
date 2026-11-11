// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O dublê do B1 das organizações para a PRÉVIA (NEXT_PUBLIC_ALUMIA_PREVIA=sim): as mesmas respostas das funções do banco, numa
// memória que some ao recarregar. Tudo inventado (codinomes de exemplo, nenhuma pessoa real). Na prévia, "você" é de um núcleo,
// ocupa a Mesa e a Tesouraria e gerencia a organização, para dar para ver todas as telas. As regras de privacidade são as do
// banco: mosaico só a partir de 3, fila só para a mesa, caixa sem pessoas. Sem "@/" de propósito.
import type { Chamar } from "../cliente";
import type { AtaViva, CaixaDaOrg, CaixasDaOrg, EleicaoDaOrg, FuncaoDaOrg, FuncoesDaOrg, MosaicoDosSinais, OrgNoDiretorio, Posicao, Sinal } from "./b1";
import { HANDLE_DE_EXEMPLO } from "./exemplos";

const dia = (d: number) => new Date(Date.now() + d * 86400e3).toISOString().slice(0, 10);
const hora = (h: number) => new Date(Date.now() + h * 3600e3).toISOString();
let seq = 1;
const novoId = () => `ex-${Date.now().toString(36)}-${seq++}`;
const erro = (codigo: string) => Object.assign(new Error(codigo), { code: codigo });

interface FilaInterna { id: string; posicao: Posicao; codinome: string; eu: boolean }

export function chamarDubleB1(): Chamar {
  const funcoes: FuncaoDaOrg[] = [
    { id: "fn-tes", tipo: "tesouraria", nome: "Tesouraria", permissoes: ["caixa"], vagas: 2, ocupantes: [
      { mandato: "md-1", handle: "voce", codinome: "Você", fim: dia(180), origem: "eleicao", eu: true },
      { mandato: "md-2", handle: "girassol", codinome: "Girassol", fim: dia(180), origem: "nomeacao", eu: false },
    ] },
    { id: "fn-mesa", tipo: "coordenacao", nome: "Mesa", permissoes: ["mesa", "tear"], vagas: 1, ocupantes: [{ mandato: "md-3", handle: "voce", codinome: "Você", fim: dia(90), origem: "nomeacao", eu: true }] },
    { id: "fn-com", tipo: "comunicacao", nome: "Comunicação", permissoes: ["avisos"], vagas: 1, ocupantes: [] },
    { id: "fn-seg", tipo: "seguranca", nome: "Segurança dos atos", permissoes: [], vagas: 3, ocupantes: [{ mandato: "md-4", handle: "carcara", codinome: "Carcará", fim: dia(60), origem: "nomeacao", eu: false }] },
  ];
  const fx = (): FuncoesDaOrg => ({
    dentro: true, gerencio: true, funcoes: structuredClone(funcoes),
    minhas: funcoes.flatMap((f) => (f.ocupantes ?? []).filter((o) => o.eu).map((o) => ({ funcao: f.id, nome: f.nome, fim: o.fim, mandato: o.mandato, permissoes: f.permissoes }))),
  });

  const eleicoes: EleicaoDaOrg[] = [{
    id: "el-1", funcao: { id: "fn-com", nome: "Comunicação", tipo: "comunicacao" }, inscricoesAte: hora(30), prazo: hora(80), mandatoFim: dia(365), quorum: 10, situacao: "inscricoes",
    candidatos: [{ handle: "jacaranda", codinome: "Jacarandá", eu: false }], souCandidata: false, possoCandidatar: true, consulta: null, eleita: null,
  }];

  const sinaisDosOutros: Sinal[] = ["concordo", "concordo", "concordo", "duvida", "concordo", "bloqueio"];
  let meuSinal: Sinal | null = null;
  let fila: FilaInterna[] = [
    { id: "fl-1", posicao: "favor", codinome: "Ipê Roxo", eu: false },
    { id: "fl-2", posicao: "contra", codinome: "Carcará", eu: false },
    { id: "fl-3", posicao: "esclarecimento", codinome: "Girassol", eu: false },
  ];
  const ata: AtaViva = {
    id: "ata-1", titulo: "Assembleia de novembro", situacao: "aberta", abertaEm: hora(-1), fechadaEm: null, post: null,
    org: { handle: HANDLE_DE_EXEMPLO, codinome: "Mandata Popular" }, plenaria: null, souMesa: true, dentro: true, pontoAtual: "pt-1", falaSegundos: 120,
    fala: { desde: new Date(Date.now() - 40_000).toISOString(), posicao: "favor", quem: "Jacarandá", souEu: false },
    minha: null, naFila: 3, fila: null, sinais: { abertos: true, mosaico: null, meu: null, haBloqueio: true },
    pontos: [
      { id: "pt-1", ordem: 1, texto: "Tarifa zero: levar a pauta à audiência pública", carimbo: null, deliberacao: "", carimbadoEm: null, sinais: null },
      { id: "pt-2", ordem: 2, texto: "Fundo de greve dos professores", carimbo: null, deliberacao: "", carimbadoEm: null, sinais: null },
      { id: "pt-3", ordem: 3, texto: "Calendário de dezembro", carimbo: null, deliberacao: "", carimbadoEm: null, sinais: null },
    ],
  };
  const fechadas: AtaViva[] = [];
  const passo10 = (n: number, t: number) => Math.floor((n * 10) / t) / 10;
  const agregado = (): (MosaicoDosSinais & { haBloqueio: boolean }) | null => {
    const todos = [...sinaisDosOutros, ...(meuSinal ? [meuSinal] : [])];
    if (todos.length < 3) return null;
    const n = (s: Sinal) => todos.filter((x) => x === s).length;
    return { concordo: passo10(n("concordo"), todos.length), duvida: passo10(n("duvida"), todos.length), bloqueio: passo10(n("bloqueio"), todos.length), abstencao: passo10(n("abstencao"), todos.length), pessoas: todos.length, haBloqueio: n("bloqueio") > 0 };
  };
  const vistaDaAta = (): AtaViva => {
    if (ata.situacao === "fechada") return { ...structuredClone(ata), fila: null, sinais: null, minha: null, fala: null, naFila: null, souMesa: false };
    const minha = fila.findIndex((f) => f.eu);
    const ag = agregado();
    return {
      ...structuredClone(ata),
      minha: minha >= 0 ? { posicao: fila[minha].posicao, lugar: minha + 1 } : null,
      naFila: fila.length >= 3 ? fila.length : null,
      fila: fila.map((f) => ({ id: f.id, posicao: f.posicao, codinome: f.codinome, funcoes: f.codinome === "Girassol" ? ["Tesouraria"] : [] })),
      sinais: ata.sinais?.abertos ? { abertos: true, mosaico: ag ? { concordo: ag.concordo, duvida: ag.duvida, bloqueio: ag.bloqueio, abstencao: ag.abstencao, pessoas: ag.pessoas } : null, meu: meuSinal, haBloqueio: ag?.haBloqueio ?? false } : { abertos: false, mosaico: null, meu: null, haBloqueio: null },
    };
  };

  const caixas: CaixaDaOrg[] = [{
    id: "cx-1", nome: "Fundo de greve", tipo: "greve", pix: "12.345.678/0001-90", link: "https://exemplo.org/doar", nucleo: null, saldo: 0, entradas: 0, saidas: 0, esperando: 0,
    lancamentos: [
      { id: "lc-1", tipo: "entrada", centavos: 184000, descricao: "Rifa do fundo de greve", dia: dia(-9), carimbos: 2, conferidoEm: dia(-8), nota: false, meu: false, possoConferir: false },
      { id: "lc-2", tipo: "saida", centavos: 32050, descricao: "Tinta e pano para as faixas", dia: dia(-6), carimbos: 2, conferidoEm: dia(-5), nota: true, meu: false, possoConferir: false },
      { id: "lc-3", tipo: "entrada", centavos: 61500, descricao: "Festa junina do núcleo Leste", dia: dia(-2), carimbos: 1, conferidoEm: null, nota: false, meu: false, possoConferir: true },
    ],
  }];
  const recalcular = () => {
    for (const c of caixas) {
      const ok = c.lancamentos.filter((l) => l.carimbos === 2);
      c.entradas = ok.filter((l) => l.tipo === "entrada").reduce((s, l) => s + l.centavos, 0);
      c.saidas = ok.filter((l) => l.tipo === "saida").reduce((s, l) => s + l.centavos, 0);
      c.saldo = c.entradas - c.saidas;
      c.esperando = c.lancamentos.length - ok.length;
    }
  };
  recalcular();
  const cx = (): CaixasDaOrg => ({ dentro: true, tesouraria: true, gerencio: true, caixas: structuredClone(caixas) });

  const diretorio: OrgNoDiretorio[] = [
    { handle: "coletivo_lume", codinome: "Coletivo Lume", tipo: "coletivo", cidade: "São Paulo", palavra: "LUME", bio: "Coletivo de bairro da zona leste.", verificadaEm: dia(-30), nucleos: 4 },
    { handle: "gremio_esperanca", codinome: "Grêmio Esperança", tipo: "gremio", cidade: "Recife", palavra: "GREMIO", bio: "Grêmio da Escola Estadual Esperança.", verificadaEm: dia(-12), nucleos: 1 },
    { handle: HANDLE_DE_EXEMPLO, codinome: "Mandata Popular", tipo: "mandato", cidade: "São Paulo", palavra: "POVO", bio: "Mandato coletivo na Câmara Municipal.", verificadaEm: dia(-6), nucleos: 3 },
    { handle: "sind_educa", codinome: "Sindicato da Educação", tipo: "sindicato", cidade: "Belo Horizonte", palavra: "EDUCA", bio: "Trabalhadoras e trabalhadores da educação.", verificadaEm: dia(-90), nucleos: 12 },
  ];

  const resp: Record<string, (a: Record<string, unknown>) => unknown> = {
    rede_org_funcoes: () => fx(),
    rede_org_funcao_salvar: (a) => {
      const p = a.p as FuncaoDaOrg;
      if (p.id) Object.assign(funcoes.find((f) => f.id === p.id) ?? {}, { tipo: p.tipo, nome: p.nome, permissoes: p.permissoes, vagas: p.vagas });
      else {
        if (funcoes.some((f) => f.nome.toLowerCase() === String(p.nome).toLowerCase())) throw erro("funcao_existe");
        funcoes.push({ id: novoId(), tipo: p.tipo, nome: p.nome, permissoes: p.permissoes, vagas: p.vagas, ocupantes: [] });
      }
      return fx();
    },
    rede_org_funcao_apagar: (a) => (funcoes.splice(funcoes.findIndex((f) => f.id === a.p_id), 1), fx()),
    rede_org_mandato_dar: (a) => {
      const p = a.p as { funcao: string; handle: string; fim: string };
      const f = funcoes.find((x) => x.id === p.funcao);
      if (!f) throw erro("nao_encontrado");
      if ((f.ocupantes ?? []).length >= f.vagas) throw erro("sem_vaga");
      const h = p.handle.replace(/^@/, "").toLowerCase();
      f.ocupantes?.push({ mandato: novoId(), handle: h, codinome: h.charAt(0).toUpperCase() + h.slice(1), fim: p.fim, origem: "nomeacao", eu: false, pendente: true });
      return fx();
    },
    rede_org_mandato_aceitar: (a) => {
      for (const f of funcoes) for (const o of f.ocupantes ?? []) if (o.mandato === a.p_mandato) o.pendente = false;
      return fx();
    },
    rede_org_mandato_encerrar: (a) => {
      for (const f of funcoes) f.ocupantes = (f.ocupantes ?? []).filter((o) => o.mandato !== a.p_mandato);
      return fx();
    },
    rede_org_eleicoes: () => structuredClone(eleicoes),
    rede_org_eleicao_abrir: (a) => {
      const p = a.p as { funcao: string; inscricoesAte: string; prazo: string; mandatoFim: string; quorum: number | null };
      const f = funcoes.find((x) => x.id === p.funcao);
      if (!f) throw erro("nao_encontrado");
      if (eleicoes.some((e) => e.funcao.id === f.id && (e.situacao === "inscricoes" || e.situacao === "votacao"))) throw erro("eleicao_aberta");
      eleicoes.unshift({ id: novoId(), funcao: { id: f.id, nome: f.nome, tipo: f.tipo }, inscricoesAte: p.inscricoesAte, prazo: p.prazo, mandatoFim: p.mandatoFim, quorum: p.quorum, situacao: "inscricoes", candidatos: [], souCandidata: false, possoCandidatar: true, consulta: null, eleita: null });
      return structuredClone(eleicoes);
    },
    rede_org_eleicao_candidatar: (a) => {
      const e = eleicoes.find((x) => x.id === a.p_eleicao);
      if (!e) throw erro("nao_encontrado");
      e.candidatos = e.candidatos.filter((k) => !k.eu);
      if (a.p_sim) e.candidatos.push({ handle: "voce", codinome: "Você", eu: true });
      e.souCandidata = !!a.p_sim;
      return structuredClone(e);
    },
    rede_org_consulta_votar: () => ({ votei: true }),
    rede_org_atas: () => ({ mesa: true, dentro: true, atas: [vistaDaAta(), ...structuredClone(fechadas)] }),
    rede_org_ata: () => vistaDaAta(),
    rede_org_ata_abrir: () => vistaDaAta(),
    rede_org_ata_inscrever: (a) => {
      if (ata.situacao !== "aberta") throw erro("ata_fechada");
      const i = fila.findIndex((f) => f.eu);
      if (!a.p_posicao) fila = fila.filter((f) => !f.eu);
      else if (i >= 0) fila[i].posicao = a.p_posicao as Posicao;
      else fila.push({ id: novoId(), posicao: a.p_posicao as Posicao, codinome: "Você", eu: true });
      return vistaDaAta();
    },
    rede_org_ata_sinal: (a) => {
      if (!ata.sinais?.abertos) throw erro("sinais_fechados");
      meuSinal = (a.p_sinal as Sinal | null) ?? null;
      return vistaDaAta();
    },
    rede_org_ata_mesa: (a) => {
      const p = a.p as Record<string, string | number | undefined>;
      if (p.acao === "chamar") {
        const x = p.fala ? fila.find((f) => f.id === p.fala) : fila[0];
        if (!x) throw erro("fila_vazia");
        fila = fila.filter((f) => f.id !== x.id);
        ata.fala = { desde: new Date().toISOString(), posicao: x.posicao, quem: x.codinome, souEu: x.eu };
      } else if (p.acao === "encerrar_fala") ata.fala = null;
      else if (p.acao === "sinais_abrir") { ata.sinais = { abertos: true, mosaico: null, meu: null, haBloqueio: null }; meuSinal = null; }
      else if (p.acao === "sinais_fechar") {
        const ag = agregado();
        const pt = ata.pontos.find((x) => x.id === ata.pontoAtual);
        if (pt) pt.sinais = ag ? { concordo: ag.concordo, duvida: ag.duvida, bloqueio: ag.bloqueio, abstencao: ag.abstencao } : null;
        ata.sinais = { abertos: false, mosaico: null, meu: null, haBloqueio: null };
      } else if (p.acao === "ponto") { ata.pontoAtual = String(p.ponto); ata.fala = null; fila = []; }
      else if (p.acao === "tempo") ata.falaSegundos = Number(p.segundos);
      else if (p.acao === "carimbar") {
        const pt = ata.pontos.find((x) => x.id === (p.ponto ?? ata.pontoAtual));
        if (!pt) throw erro("invalido:ponto");
        if (ata.sinais?.abertos && pt.id === ata.pontoAtual) {
          const ag = agregado();
          pt.sinais = ag ? { concordo: ag.concordo, duvida: ag.duvida, bloqueio: ag.bloqueio, abstencao: ag.abstencao } : null;
        }
        pt.carimbo = p.carimbo as AtaViva["pontos"][number]["carimbo"];
        pt.deliberacao = String(p.deliberacao ?? "");
        pt.carimbadoEm = new Date().toISOString();
        fila = [];
        meuSinal = null;
        sinaisDosOutros.length = 0;
        ata.fala = null;
        ata.sinais = { abertos: false, mosaico: null, meu: null, haBloqueio: null };
        const prox = ata.pontos.find((x) => !x.carimbo);
        if (prox) ata.pontoAtual = prox.id;
      }
      return vistaDaAta();
    },
    rede_org_ata_fechar: (a) => {
      ata.situacao = "fechada";
      ata.fechadaEm = new Date().toISOString();
      if (a.p_publicar) ata.post = novoId();
      fila = [];
      meuSinal = null;
      const nomes = { aprovado: "APROVADO", retirado: "RETIRADO", vai_a_base: "VAI À BASE" } as const;
      const texto = `Ata: ${ata.titulo}\nMandata Popular.\n\n${ata.pontos.map((p) => `${p.ordem}. ${p.texto} — ${p.carimbo ? nomes[p.carimbo] : "SEM DELIBERAÇÃO"}${p.deliberacao ? `\n   ${p.deliberacao}` : ""}`).join("\n")}\n\nA ata registra as deliberações, não quem falou. A fila de fala e os sinais de consenso foram apagados ao fechar.`;
      return { ata: vistaDaAta(), texto };
    },
    rede_org_caixa: () => cx(),
    rede_org_caixa_criar: (a) => {
      const p = a.p as { nome: string; tipo: CaixaDaOrg["tipo"]; pix: string; link: string };
      caixas.push({ id: novoId(), nome: p.nome, tipo: p.tipo, pix: p.pix || null, link: p.link || null, nucleo: null, saldo: 0, entradas: 0, saidas: 0, esperando: 0, lancamentos: [] });
      return cx();
    },
    rede_org_caixa_lancar: (a) => {
      const p = a.p as { tipo: "entrada" | "saida"; centavos: string; descricao: string; dia: string; nota?: string };
      caixas.find((c) => c.id === a.p_caixa)?.lancamentos.unshift({ id: novoId(), tipo: p.tipo, centavos: Number(p.centavos), descricao: p.descricao, dia: p.dia, carimbos: 0, conferidoEm: null, nota: !!p.nota, meu: true, possoConferir: true });
      recalcular();
      return cx();
    },
    rede_org_caixa_conferir: (a) => {
      for (const c of caixas) for (const l of c.lancamentos) if (l.id === a.p_lancamento) {
        if (l.meu && l.carimbos === 1) throw erro("outra_pessoa");
        l.carimbos = Math.min(2, l.carimbos + 1) as 0 | 1 | 2;
        l.possoConferir = false;
        if (l.carimbos === 2) l.conferidoEm = dia(0);
      }
      recalcular();
      return cx();
    },
    rede_org_caixa_retirar: (a) => {
      for (const c of caixas) c.lancamentos = c.lancamentos.filter((l) => l.id !== a.p_lancamento);
      recalcular();
      return cx();
    },
    rede_org_caixa_nota: () => ({ mime: "image/svg+xml", url: `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#f4efe4"/><text x="20" y="40" font-family="monospace" font-size="16">NOTA FISCAL (exemplo)</text><rect x="20" y="60" width="200" height="18" fill="#999"/><text x="20" y="120" font-family="monospace" font-size="14">Tinta acrílica .... 210,50</text><text x="20" y="145" font-family="monospace" font-size="14">Pano algodão ...... 110,00</text><text x="20" y="190" font-family="monospace" font-size="16">TOTAL ........... 320,50</text></svg>')}` }),
    rede_org_nucleo_criar: () => ({ id: novoId(), convite: { codigo: "0123456789abcdef0123456789abcdef", validade: hora(24 * 7), usos: 10 } }),
    rede_org_nucleo_mapa: (a) => ({ mapa: !!a.p_sim, chama: "brasa" }),
    rede_org_mapa: () => [{ uf: "MG", cidades: ["Belo Horizonte"] }, { uf: "PE", cidades: ["Recife"] }, { uf: "SP", cidades: ["Campinas", "São Paulo"] }],
    rede_fix_convite_usar: () => ({ ok: true, tipo: "nucleo" }),
    rede_org_diretorio: (a) => {
      const p = (a.p ?? {}) as { tipo?: string; cidade?: string; busca?: string };
      const b = (p.busca ?? "").toLowerCase(), c = (p.cidade ?? "").toLowerCase();
      return { itens: diretorio.filter((o) => (!p.tipo || o.tipo === p.tipo) && (!c || (o.cidade ?? "").toLowerCase().includes(c)) && (!b || o.codinome.toLowerCase().includes(b) || o.handle.includes(b))), depois: null };
    },
    rede_org_atos: () => [],
  };

  return (async <T>(funcao: string, argumentos: Record<string, unknown> = {}) => {
    const f = resp[funcao];
    if (!f) throw erro("banco_desatualizado");
    await new Promise((r) => setTimeout(r, 120));
    return f(argumentos) as T;
  }) as Chamar;
}

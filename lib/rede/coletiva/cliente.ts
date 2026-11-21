// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As chamadas do lote ação coletiva (Prompt 4, Parte F; supabase/migracoes/20261127-p4-coletiva.sql). Tudo (menos o "mandei" da
// pressão, que vai pelo servidor do site) vai direto ao banco com
// a sessão da pessoa: o banco confere o interruptor, a conta, a comunidade, a organização e a mediação em cada chamada. Nenhuma
// resposta traz lista de pessoas (a exceção é o pouso, só para a gestão da organização) nem número abaixo de 3. Com
// NEXT_PUBLIC_ALUMIA_PREVIA=sim, um dublê na memória responde (nada vai a lugar nenhum). Sem "@/" de propósito.
import { BackendError } from "../../backend";
import { chamar, type Chamar } from "../cliente";

export const PREVIA_DA_COLETIVA = process.env.NEXT_PUBLIC_ALUMIA_PREVIA === "sim";

export interface OrgResumo { handle: string; nome: string; selo: boolean }
export interface Minhas { comunidades: { slug: string; nome: string; modero: boolean }[]; orgs: OrgResumo[] }

export interface Contato { tipo: "email" | "telefone" | "site"; valor: string }
export interface Pressao { id: string; alvo: string; cargo: string; assunto: string; mensagem: string; contatos: Contato[]; encerrada: boolean; total: number | null; eu_mandei: boolean }
export interface Pressoes { comunidade: string; modero: boolean; pressoes: Pressao[] }

export type SituacaoDaCarta = "presa" | "demitida" | "ameacada" | "outra";
export interface Carta { id: string; texto: string; assinatura: string; estado?: "pendente" | "aprovada" }
export interface CampanhaDeCartas { id: string; para: string; situacao: SituacaoDaCarta; sobre: string; entrega: string; encerrada: boolean; aprovadas: number | null; minhas: Carta[]; fila: Carta[] }
export interface Cartas { comunidade: string; modero: boolean; posso_escrever: boolean; campanhas: CampanhaDeCartas[] }

export type TipoDePergunta = "escolha" | "varias" | "escala" | "aberta";
export interface Pergunta { tipo: TipoDePergunta; texto: string; opcoes: string[] }
export interface PerguntaNoRelatorio { tipo: TipoDePergunta; texto: string; opcoes: { opcao: string; total: number | null }[] | null; escala: { valor: number; total: number | null }[] | null; abertas: string[] | null; abertas_total: number | null }
export interface Questionario { id: string; titulo: string; sobre: string; perguntas: Pergunta[]; aberto: boolean; ja_respondi: boolean; relatorio: { respostas: number | null; perguntas: PerguntaNoRelatorio[] } | null }
export interface Questionarios { comunidade: string; modero: boolean; posso_responder: boolean; questionarios: Questionario[] }

export type Frequencia = "semanal" | "quinzenal" | "mensal";
export interface Rodizio { id: string; tarefa: string; sobre: string; frequencia: Frequencia; comeca: string; ativo: boolean; estou: boolean; minhas_vezes: string[]; pessoas: number | null; tem_gente: boolean; proxima: string | null }
export interface Rodizios { comunidade: string; modero: boolean; posso_entrar: boolean; rodizios: Rodizio[] }

export const SELOS_DO_ATO = ["cadeira", "libras", "banheiro", "sombra"] as const;
export type SeloDoAto = (typeof SELOS_DO_ATO)[number];
export interface Ciranda { vagas: number; idades: string; cuidado: string; sobram: number | null; poucas: boolean; lotada: boolean; minhas: number; reservadas: number | null }
export interface FichaDoAto { id: string; titulo: string; inicio: string; fim: string | null; cidade: string; ponto: string; tipo: string; situacao: string; aberto_internet: boolean; organizo: boolean; selos: SeloDoAto[]; ciranda: Ciranda | null }
export interface AtoMeu { id: string; titulo: string; inicio: string; cidade: string }

export interface Release { id: string; titulo: string; texto: string; dia: string; link: string | null }
export interface Imprensa { email: string | null; telefone: string | null; sobre: string; cores: string[]; kit: string | null; releases: Release[] }
export type CategoriaDaVitrine = "alimentos" | "artesanato" | "roupas" | "servicos" | "cultura" | "outros";
export const CATEGORIAS: readonly CategoriaDaVitrine[] = ["alimentos", "artesanato", "roupas", "servicos", "cultura", "outros"];
export interface ItemDaVitrine { id: string; nome: string; sobre: string; categoria: CategoriaDaVitrine; cidade: string; link: string; org?: OrgResumo }
export interface PaginaDaOrg extends OrgResumo { gerencio: boolean; pix: string | null; imprensa?: Imprensa | null; vitrine?: ItemDaVitrine[]; links?: { titulo: string; url: string }[] }

export interface Frente { id: string; slug: string; nome: string; sobre: string; gerencio: boolean; orgs: OrgResumo[]; convidadas: OrgResumo[]; para_responder: OrgResumo[]; atos: { id: string; titulo: string; inicio: string; cidade: string; situacao: string }[] }

export interface Pouso { id: string; tipo: "oferta" | "pedido"; cidade: string; pessoas: number; de: string; ate: string; observacao: string; estado: "aberto" | "combinado"; org: OrgResumo; codinome?: string; handle?: string }
export interface Pousos { orgs: (OrgResumo & { sobre: string })[]; meus: Pouso[]; gestao: (OrgResumo & { ofertas: Pouso[]; pedidos: Pouso[] })[] }

export interface FiliacaoOrgs { orgs: (OrgResumo & { sobre: string })[]; gestao: (OrgResumo & { aberta: boolean; minha_chave: boolean; fichas: number })[] }
export interface FichaCifrada { id: string; dia: string; apagar_em: string; cifra: string; embrulho: string }

/** O id de um ato a partir do que a pessoa colou: o id puro ou um endereço da Alumia que termina nele. */
export function idDoAto(texto: string): string | null {
  const m = texto.trim().toLowerCase().match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?(?:[?#].*)?$/);
  return m ? m[1] : null;
}

/** A lista das pressões com a marca da própria pessoa ("mandei"), que o servidor do site confere (só as abertas). */
async function comAsMinhas(c: Chamar, lista: Pressoes): Promise<Pressoes> {
  const abertas = lista.pressoes.filter((p) => !p.encerrada).map((p) => p.id);
  const minhas = new Set(abertas.length ? await c<string[]>("rede_p4_pressao_minhas", { p_pressoes: abertas }) : []);
  return { ...lista, pressoes: lista.pressoes.map((p) => ({ ...p, eu_mandei: minhas.has(p.id) })) };
}

/** O cliente sobre uma função que chama o banco (a de verdade ou o dublê). */
export function criarClienteDaColetiva(c: Chamar) {
  return {
    minhas: () => c<Minhas>("rede_p4_ac_minhas"),
    // 89
    // O banco não sabe quem mandou (a marca é o HMAC do servidor do site): o "mandei" e "as minhas" vão pelo servidor do site
    // (lib/rede/voto/cliente.ts, VOTO_PELO_SERVIDOR), e a lista do banco ganha aqui a marca da própria pessoa.
    pressoes: async (comunidade: string) => comAsMinhas(c, await c<Pressoes>("rede_p4_pressoes", { p_comunidade: comunidade })),
    criarPressao: async (p: { comunidade: string; alvo: string; cargo: string; assunto: string; mensagem: string; contatos: Contato[] }) => comAsMinhas(c, await c<Pressoes>("rede_p4_pressao_criar", { p })),
    mandei: async (id: string, sim: boolean) => {
      const r = await c<{ eu: boolean; comunidade: string }>("rede_p4_pressao_mandei", { p_id: id, p_sim: sim });
      return comAsMinhas(c, await c<Pressoes>("rede_p4_pressoes", { p_comunidade: r.comunidade }));
    },
    encerrarPressao: async (id: string) => comAsMinhas(c, await c<Pressoes>("rede_p4_pressao_encerrar", { p_id: id })),
    // 92
    cartas: (comunidade: string) => c<Cartas>("rede_p4_cartas", { p_comunidade: comunidade }),
    abrirCampanhaDeCartas: (p: { comunidade: string; para: string; situacao: SituacaoDaCarta; sobre: string; entrega: string }) => c<Cartas>("rede_p4_carta_campanha", { p }),
    escreverCarta: (p: { campanha: string; texto: string; assinar: boolean }) => c<Cartas>("rede_p4_carta_escrever", { p }),
    apagarCarta: (id: string) => c<Cartas>("rede_p4_carta_apagar", { p_id: id }),
    decidirCarta: (id: string, aprovar: boolean) => c<Cartas>("rede_p4_carta_decidir", { p_id: id, p_aprovar: aprovar }),
    entregaDasCartas: (campanha: string) => c<{ para: string; cartas: Carta[] }>("rede_p4_carta_entrega", { p_campanha: campanha }),
    encerrarCartas: (campanha: string, apagar: boolean) => c<Cartas>("rede_p4_carta_encerrar", { p_campanha: campanha, p_apagar: apagar }),
    // 93
    questionarios: (comunidade: string) => c<Questionarios>("rede_p4_questionarios", { p_comunidade: comunidade }),
    criarQuestionario: (p: { comunidade: string; titulo: string; sobre: string; perguntas: Pergunta[] }) => c<Questionarios>("rede_p4_quest_criar", { p }),
    responder: (id: string, respostas: unknown[]) => c<Questionarios>("rede_p4_quest_responder", { p_id: id, p_respostas: respostas }),
    encerrarQuestionario: (id: string, apagar: boolean) => c<Questionarios>("rede_p4_quest_encerrar", { p_id: id, p_apagar: apagar }),
    // 122
    rodizios: (comunidade: string) => c<Rodizios>("rede_p4_rodizios", { p_comunidade: comunidade }),
    criarRodizio: (p: { comunidade: string; tarefa: string; sobre: string; frequencia: Frequencia; comeca: string }) => c<Rodizios>("rede_p4_rodizio_criar", { p }),
    entrarNoRodizio: (id: string, sim: boolean) => c<Rodizios>("rede_p4_rodizio_entrar", { p_id: id, p_sim: sim }),
    encerrarRodizio: (id: string, apagar: boolean) => c<Rodizios>("rede_p4_rodizio_encerrar", { p_id: id, p_apagar: apagar }),
    // 94 a 97
    meusAtos: () => c<AtoMeu[]>("rede_p4_ato_meus"),
    ato: (id: string) => c<FichaDoAto>("rede_p4_ato", { p_ato: id }),
    selos: (id: string, selos: SeloDoAto[]) => c<FichaDoAto>("rede_p4_ato_selos", { p_ato: id, p_selos: selos }),
    abrirCiranda: (id: string, p: { vagas: number; idades: string; cuidado: string }) => c<FichaDoAto>("rede_p4_ciranda_abrir", { p_ato: id, p }),
    fecharCiranda: (id: string) => c<FichaDoAto>("rede_p4_ciranda_fechar", { p_ato: id }),
    reservar: (id: string, criancas: number) => c<FichaDoAto>("rede_p4_ciranda_reservar", { p_ato: id, p_criancas: criancas }),
    // 100, 124 a 126
    org: (handle: string) => c<PaginaDaOrg>("rede_p4_org_pagina", { p_handle: handle }),
    definirPix: (handle: string, chave: string) => c<PaginaDaOrg>("rede_p4_pix_definir", { p_handle: handle, p_chave: chave }),
    conferirPix: (post: string) => c<{ alerta: boolean; org?: OrgResumo }>("rede_p4_pix_conferir", { p_post: post }),
    salvarImprensa: (handle: string, p: { email: string; telefone: string; sobre: string; cores: string[]; kit: string }) => c<PaginaDaOrg>("rede_p4_org_imprensa", { p_handle: handle, p }),
    publicarRelease: (handle: string, p: { titulo: string; texto: string; dia: string; link: string }) => c<PaginaDaOrg>("rede_p4_org_release", { p_handle: handle, p }),
    tirarRelease: (id: string) => c<PaginaDaOrg>("rede_p4_org_release_tirar", { p_id: id }),
    porNaVitrine: (handle: string, p: { nome: string; sobre: string; categoria: CategoriaDaVitrine; cidade: string; link: string }) => c<PaginaDaOrg>("rede_p4_vitrine_por", { p_handle: handle, p }),
    tirarDaVitrine: (id: string) => c<PaginaDaOrg>("rede_p4_vitrine_tirar", { p_id: id }),
    vitrine: (categoria: string, cidade: string) => c<ItemDaVitrine[]>("rede_p4_vitrine", { p_categoria: categoria, p_cidade: cidade }),
    salvarLinks: (handle: string, links: { titulo: string; url: string }[]) => c<PaginaDaOrg>("rede_p4_org_links", { p_handle: handle, p_links: links }),
    // 123
    frentes: () => c<{ slug: string; nome: string; orgs: number }[]>("rede_p4_frentes"),
    frente: (slug: string) => c<Frente>("rede_p4_frente", { p_slug: slug }),
    criarFrente: (p: { org: string; slug: string; nome: string; sobre: string }) => c<Frente>("rede_p4_frente_criar", { p }),
    convidarNaFrente: (frente: string, org: string) => c<Frente>("rede_p4_frente_convidar", { p_frente: frente, p_org: org }),
    responderFrente: (frente: string, org: string, aceitar: boolean) => c<Frente & { apagada?: boolean }>("rede_p4_frente_responder", { p_frente: frente, p_org: org, p_aceitar: aceitar }),
    atoNaFrente: (frente: string, ato: string, por: boolean) => c<Frente>("rede_p4_frente_ato", { p_frente: frente, p_ato: ato, p_por: por }),
    // 98
    pouso: () => c<Pousos>("rede_p4_pouso"),
    abrirPouso: (handle: string, abrir: boolean, sobre: string) => c<Pousos>("rede_p4_pouso_abrir", { p_handle: handle, p_abrir: abrir, p_sobre: sobre }),
    porPouso: (p: { org: string; tipo: "oferta" | "pedido"; cidade: string; pessoas: number; de: string; ate: string; observacao: string }) => c<Pousos>("rede_p4_pouso_por", { p }),
    mudarPouso: (id: string, acao: "tirar" | "combinado") => c<Pousos>("rede_p4_pouso_mudar", { p_id: id, p_acao: acao }),
    // 99
    filiacaoOrgs: () => c<FiliacaoOrgs>("rede_p4_filiacao_orgs"),
    abrirFiliacao: (handle: string, abrir: boolean, sobre: string) => c<FiliacaoOrgs>("rede_p4_filiacao_abrir", { p_handle: handle, p_abrir: abrir, p_sobre: sobre }),
    destinosDaFiliacao: (handle: string) => c<unknown>("rede_p4_filiacao_destinos", { p_handle: handle }),
    enviarFiliacao: (p: unknown) => c<{ ok: boolean; id: string }>("rede_p4_filiacao_enviar", { p }),
    cancelarFiliacao: (id: string, recibo: string) => c<{ ok: boolean }>("rede_p4_filiacao_cancelar", { p_id: id, p_recibo: recibo }),
    fichas: (handle: string) => c<FichaCifrada[]>("rede_p4_filiacoes", { p_handle: handle }),
    apagarFicha: (id: string) => c<{ ok: boolean }>("rede_p4_filiacao_apagar", { p_id: id }),
  };
}

/**
 * O dublê da prévia: uma comunidade que a pessoa modera, um ato que ela organiza e uma organização com selo que ela gere, com um
 * exemplo de cada coisa. As regras (total só a partir de 3, a mediação, a gestão) são as do banco, resumidas.
 */
export function dubleDaColetiva(): Chamar {
  const uuid = () => crypto.randomUUID();
  const hoje = new Date();
  const dia = (n: number) => new Date(hoje.getTime() + n * 86400e3).toISOString().slice(0, 10);
  const LUME: OrgResumo = { handle: "lume", nome: "Coletivo Lume", selo: true };
  const minhas: Minhas = { comunidades: [{ slug: "luta-moradia", nome: "Luta por moradia", modero: true }], orgs: [LUME] };
  const pressoes: Pressao[] = [{
    id: uuid(), alvo: "Deputada Fulana de Tal", cargo: "Deputada federal", assunto: "Vote contra o PL dos despejos",
    mensagem: "Excelentíssima deputada, pedimos que vote contra o projeto que facilita despejos sem alternativa de moradia.",
    contatos: [{ tipo: "email", valor: "dep.fulana@camara.leg.br" }, { tipo: "telefone", valor: "6132155000" }], encerrada: false, total: 12, eu_mandei: false,
  }];
  const campanhas: CampanhaDeCartas[] = [{ id: uuid(), para: "Rafael, preso na ocupação", situacao: "presa", sobre: "Preso durante a reintegração.", entrega: "Na visita de domingo.", encerrada: false, aprovadas: 7, minhas: [], fila: [{ id: uuid(), texto: "Rafael, estamos com você. A luta não para.", assinatura: "" }] }];
  const questionarios: Questionario[] = [{
    id: uuid(), titulo: "Como está o bairro", sobre: "Para a assembleia.", aberto: true, ja_respondi: false,
    perguntas: [{ tipo: "escolha", texto: "Você mora de aluguel?", opcoes: ["Sim", "Não"] }, { tipo: "escala", texto: "De 1 a 5, quanto o aluguel pesa?", opcoes: [] }, { tipo: "aberta", texto: "O que a gente devia fazer?", opcoes: [] }],
    relatorio: { respostas: 14, perguntas: [
      { tipo: "escolha", texto: "Você mora de aluguel?", opcoes: [{ opcao: "Sim", total: 11 }, { opcao: "Não", total: null }], escala: null, abertas: null, abertas_total: null },
      { tipo: "escala", texto: "De 1 a 5, quanto o aluguel pesa?", opcoes: null, escala: [1, 2, 3, 4, 5].map((v) => ({ valor: v, total: v >= 4 ? 5 : null })), abertas: null, abertas_total: null },
      { tipo: "aberta", texto: "O que a gente devia fazer?", opcoes: null, escala: null, abertas: ["Mutirão de cadastro.", "Ir à prefeitura."], abertas_total: 9 },
    ] },
  }];
  const rodizios: Rodizio[] = [{ id: uuid(), tarefa: "Limpeza da sede", sobre: "Sábado de manhã.", frequencia: "semanal", comeca: dia(0), ativo: true, estou: false, minhas_vezes: [], pessoas: 5, tem_gente: true, proxima: dia(0) }];
  const ATO = uuid();
  const ficha: FichaDoAto = { id: ATO, titulo: "Fica Esperança", inicio: new Date(hoje.getTime() + 3 * 86400e3).toISOString(), fim: null, cidade: "Recife", ponto: "Praça do Carmo", tipo: "ato", situacao: "confirmado", aberto_internet: true, organizo: true, selos: ["libras"], ciranda: { vagas: 8, idades: "2 a 10 anos", cuidado: "Educadoras do coletivo", sobram: 6, poucas: false, lotada: false, minhas: 0, reservadas: null } };
  const pagina: PaginaDaOrg = { ...LUME, gerencio: true, pix: "12.345.678/0001-90", imprensa: { email: "imprensa@lume.org", telefone: "8133334444", sobre: "Coletivo de moradia.", cores: ["#c0392b", "#111111"], kit: "https://exemplo.org/kit.zip", releases: [] }, vitrine: [{ id: uuid(), nome: "Cooperativa Raiz Forte", sobre: "Hortaliças sem veneno.", categoria: "alimentos", cidade: "Recife", link: "https://exemplo.org/raiz" }], links: [{ titulo: "Site", url: "https://exemplo.org" }] };
  const frente: Frente = { id: uuid(), slug: "frente-moradia", nome: "Frente pela Moradia", sobre: "Movimentos juntos pela moradia.", gerencio: true, orgs: [LUME, { handle: "raiz", nome: "Sindicato Raiz", selo: true }], convidadas: [], para_responder: [], atos: [{ id: ATO, titulo: "Fica Esperança", inicio: ficha.inicio, cidade: "Recife", situacao: "confirmado" }] };
  const pousos: Pousos = { orgs: [{ ...LUME, sobre: "Para o congresso de março." }], meus: [], gestao: [{ ...LUME, ofertas: [], pedidos: [] }] };
  const filiacao: FiliacaoOrgs = { orgs: [{ ...LUME, sobre: "Nome e cidade bastam." }], gestao: [{ ...LUME, aberta: true, minha_chave: false, fichas: 0 }] };
  return async <T,>(funcao: string, a: Record<string, unknown> = {}): Promise<T> => {
    const p = (a.p ?? {}) as Record<string, unknown>;
    switch (funcao) {
      case "rede_p4_ac_minhas": return minhas as T;
      case "rede_p4_pressoes": return { comunidade: "luta-moradia", modero: true, pressoes } as T;
      case "rede_p4_pressao_mandei": {
        const x = pressoes.find((y) => y.id === a.p_id);
        if (!x) throw new BackendError("nao_encontrado");
        if (x.eu_mandei !== a.p_sim) { x.eu_mandei = !!a.p_sim; x.total = (x.total ?? 0) + (a.p_sim ? 1 : -1); }
        return { eu: x.eu_mandei, comunidade: "luta-moradia" } as T;
      }
      case "rede_p4_pressao_minhas": return pressoes.filter((y) => y.eu_mandei && (a.p_pressoes as string[]).includes(y.id)).map((y) => y.id) as T;
      case "rede_p4_cartas": return { comunidade: "luta-moradia", modero: true, posso_escrever: true, campanhas } as T;
      case "rede_p4_carta_escrever": {
        const x = campanhas.find((y) => y.id === p.campanha);
        if (!x) throw new BackendError("nao_encontrado");
        if (String(p.texto ?? "").trim().length < 20) throw new BackendError("invalido:texto");
        x.minhas.push({ id: uuid(), texto: String(p.texto), assinatura: p.assinar ? "Codinome" : "", estado: "pendente" });
        return { comunidade: "luta-moradia", modero: true, posso_escrever: true, campanhas } as T;
      }
      case "rede_p4_questionarios": return { comunidade: "luta-moradia", modero: true, posso_responder: true, questionarios } as T;
      case "rede_p4_quest_responder": {
        const x = questionarios.find((y) => y.id === a.p_id);
        if (!x) throw new BackendError("nao_encontrado");
        if (x.ja_respondi) throw new BackendError("ja_respondeu");
        x.ja_respondi = true;
        return { comunidade: "luta-moradia", modero: true, posso_responder: true, questionarios } as T;
      }
      case "rede_p4_rodizios": return { comunidade: "luta-moradia", modero: true, posso_entrar: true, rodizios } as T;
      case "rede_p4_rodizio_entrar": {
        const x = rodizios.find((y) => y.id === a.p_id);
        if (!x) throw new BackendError("nao_encontrado");
        x.estou = !!a.p_sim;
        x.minhas_vezes = x.estou ? [dia(35), dia(70), dia(105)] : [];
        return { comunidade: "luta-moradia", modero: true, posso_entrar: true, rodizios } as T;
      }
      case "rede_p4_ato_meus": return [{ id: ATO, titulo: ficha.titulo, inicio: ficha.inicio, cidade: ficha.cidade }] as T;
      case "rede_p4_ato": if (a.p_ato !== ATO) throw new BackendError("nao_encontrado"); return ficha as T;
      case "rede_p4_ato_selos": ficha.selos = (a.p_selos as SeloDoAto[]) ?? []; return ficha as T;
      case "rede_p4_ciranda_reservar": {
        const n = Number(a.p_criancas ?? 0);
        if (ficha.ciranda) { const livre = 6 + ficha.ciranda.minhas - n; ficha.ciranda = { ...ficha.ciranda, minhas: n, sobram: livre >= 3 ? livre : null, poucas: livre > 0 && livre < 3, lotada: livre <= 0 }; }
        return ficha as T;
      }
      case "rede_p4_org_pagina": if (a.p_handle !== "lume") throw new BackendError("nao_encontrado"); return pagina as T;
      case "rede_p4_pix_conferir": return { alerta: false } as T;
      case "rede_p4_vitrine": return (pagina.vitrine ?? []).map((x) => ({ ...x, org: LUME })) as T;
      case "rede_p4_frentes": return [{ slug: frente.slug, nome: frente.nome, orgs: frente.orgs.length }] as T;
      case "rede_p4_frente": return frente as T;
      case "rede_p4_pouso": return pousos as T;
      case "rede_p4_pouso_por": {
        pousos.meus.push({ id: uuid(), tipo: p.tipo === "pedido" ? "pedido" : "oferta", cidade: String(p.cidade ?? ""), pessoas: Number(p.pessoas ?? 1), de: String(p.de ?? ""), ate: String(p.ate ?? ""), observacao: String(p.observacao ?? ""), estado: "aberto", org: LUME });
        return pousos as T;
      }
      case "rede_p4_filiacao_orgs": return filiacao as T;
      case "rede_p4_filiacao_destinos": return [] as T;
      default:
        throw new BackendError("desligado");
    }
  };
}

export const acaoColetiva = criarClienteDaColetiva(PREVIA_DA_COLETIVA ? dubleDaColetiva() : chamar);

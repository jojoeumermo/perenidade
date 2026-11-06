// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Vale o Escrito, pacote "visual": a parte PURA da página neon (sem React, sem disco, sem "@/"): monta o grafo da teia
// a partir das entradas, calcula as posições das visões que não precisam de D3 (órbita, grupos, fluxo, linha do tempo),
// a lista textual equivalente à teia (acessibilidade) e as operações de lookup usadas pelas rotas de ficha, de pessoa
// e de organização. Roda direto no Node nos testes (npm run testar:vale-o-escrito).
//
// Regras que este módulo respeita (ESPEC, seções 1 e 5): só entra na teia quem passou em regras.ts (quem lê os arquivos
// já descartou o resto); a situação jurídica acompanha cada pessoa em cada ligação; nunca existe nó de vítima, criança ou
// testemunha (a conferência é do dados.ts e do regras.ts, aqui só se confere de novo ao montar o nó).

import { mencionaPapelProibido } from "./regras";
import {
  SITUACOES,
  TIPOS_PRIMARIOS,
  type Confianca,
  type Dossie,
  type Entrada,
  type Ligacao,
  type NivelDeZoom,
  type Organizacao,
  type PessoaPublica,
  type Situacao,
  type TipoDeLigacao,
  type TipoDeNo,
} from "./tipos";

// ───────────────────────────── Dados que o servidor entrega ao cliente ─────────────────────────────

/** Um dossiê já no idioma da pessoa (o servidor escolhe o texto; o cliente não carrega os 6 idiomas). */
export interface DossieVisual {
  slug: string;
  ordem: number;
  cor: Dossie["cor"];
  titulo: string;
  descricao: string;
}

/** Tudo o que o observatório mostra. Serializável (vai do servidor para o componente de cliente). */
export interface DadosDoObservatorio {
  dossies: DossieVisual[];
  entradas: Entrada[];
  pessoas: PessoaPublica[];
  organizacoes: Organizacao[];
  ligacoes: Ligacao[];
}

/** O contrato do componente do mapa (components/vale-o-escrito/Mapa.tsx): o pacote "mapa" o substitui mantendo as props. */
export interface PropsDoMapa {
  entradas: Entrada[];
  dossies: DossieVisual[];
  selecionadoId: string | null;
  aoEscolher: (entradaId: string) => void;
  zoom: NivelDeZoom;
  aoMudarZoom: (nivel: NivelDeZoom) => void;
  /** Ramificações do ponto escolhido no mapa (pessoas, organizações e fontes do caso). Opcional: sem ela, o mapa não ramifica. */
  ramosDe?: (entradaId: string) => RamoDoCaso[];
  /** Escolhe um nó qualquer (pessoa, organização) a partir de uma ramificação do mapa. */
  aoSelecionarNo?: (chave: string) => void;
  /** Tipo de nó em destaque (legenda "destacar por tipo"): no mapa, só o tipo "entrada" mantém os pontos acesos. */
  destaque?: TipoDeNo | null;
  /** Qualidade baixa (aparelho lento): o mapa desliga o calor e a animação das ramificações. */
  qualidadeBaixa?: boolean;
  /** Textos próprios do mapa (chave "mapa" do i18n do Vale). Sem eles, o mapa fala português. */
  textosMapa?: Partial<Record<string, string>>;
  /** Textos já no idioma (os mesmos de i18n/vale-o-escrito/<idioma>.json). */
  textos: {
    carregando: string;
    mapaEmPreparacao: string;
    mapaTexto: string;
    semLugar: string;
    zoom: Record<NivelDeZoom, string>;
    situacao: Record<Situacao, string>;
  };
}

export const dadosVazios = (): DadosDoObservatorio => ({ dossies: [], entradas: [], pessoas: [], organizacoes: [], ligacoes: [] });

/** Junta os arquivos lidos (um por dossiê) num só conjunto, sem repetir pessoa nem organização que aparece em dois dossiês. */
export function juntarDossies(
  lidos: readonly { pessoas: PessoaPublica[]; organizacoes: Organizacao[]; ligacoes: Ligacao[]; entradas: Entrada[] }[],
  dossies: DossieVisual[],
): DadosDoObservatorio {
  const pessoas = new Map<string, PessoaPublica>();
  const orgs = new Map<string, Organizacao>();
  for (const l of lidos) {
    for (const p of l.pessoas) if (!pessoas.has(p.id)) pessoas.set(p.id, p);
    for (const o of l.organizacoes) if (!orgs.has(o.id)) orgs.set(o.id, o);
  }
  return {
    dossies,
    entradas: lidos.flatMap((l) => l.entradas),
    pessoas: [...pessoas.values()],
    organizacoes: [...orgs.values()],
    ligacoes: lidos.flatMap((l) => l.ligacoes),
  };
}

// ───────────────────────────── Consultas ─────────────────────────────

export const acharEntrada = (d: DadosDoObservatorio, id: string): Entrada | undefined => d.entradas.find((e) => e.id === id);
export const acharPessoa = (d: DadosDoObservatorio, id: string): PessoaPublica | undefined => d.pessoas.find((p) => p.id === id);
export const acharOrganizacao = (d: DadosDoObservatorio, id: string): Organizacao | undefined => d.organizacoes.find((o) => o.id === id);
export const acharDossie = (d: DadosDoObservatorio, slug: string): DossieVisual | undefined => d.dossies.find((x) => x.slug === slug);

/** Os casos em que a pessoa aparece, com a situação jurídica DELA em cada um. */
export function casosDaPessoa(d: DadosDoObservatorio, pessoaId: string): { entrada: Entrada; situacao: Situacao; papelNoCaso?: string }[] {
  const saida: { entrada: Entrada; situacao: Situacao; papelNoCaso?: string }[] = [];
  for (const e of d.entradas) {
    const p = e.pessoas.find((x) => x.pessoaId === pessoaId);
    if (p) saida.push({ entrada: e, situacao: p.situacao, papelNoCaso: p.papelNoCaso });
  }
  return saida;
}

export const casosDaOrganizacao = (d: DadosDoObservatorio, orgId: string): Entrada[] => d.entradas.filter((e) => e.organizacoes.includes(orgId));

/** Cada fonte da entrada com o número da ficha (1, 2, 3...): a ordem da lista é a ordem dos números. */
export const fontesNumeradas = (e: Entrada) => e.fontes.map((f, i) => ({ n: i + 1, fonte: f }));

/** A frase "Segundo X, Y e Z" com os veículos das fontes (sem repetir). Vai no alto da ficha, ao lado do resumo. */
export function veiculosDaEntrada(e: Entrada): string[] {
  const vistos = new Set<string>();
  for (const f of e.fontes) vistos.add(f.veiculo.trim());
  return [...vistos];
}

/** "A, B e C" (sem vírgula de Oxford, como no português). O idioma muda só o "e"; passe a palavra. */
export function listaComE(itens: readonly string[], e = "e"): string {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} ${e} ${itens[itens.length - 1]}`;
}

/** A situação é de condenação definitiva? (Só "condenado_transitado": CF, art. 5º, LVII.) */
export const condenacaoDefinitiva = (s: Situacao): boolean => s === "condenado_transitado";

/** O código de arquivo mostrado nas fichas: "VE-0007" a partir da posição na lista. Só um rótulo, nunca um identificador. */
export const codigoDeArquivo = (n: number): string => `VE-${String(n).padStart(4, "0")}`;

// ───────────────────────────── Datas ─────────────────────────────

/** AAAA, AAAA-MM ou AAAA-MM-DD → milissegundos (início do período). Data inválida vira NaN. */
export function dataParaMs(data: string): number {
  const [a, m = "01", d = "01"] = data.split("-");
  return Date.UTC(Number(a), Number(m) - 1, Number(d));
}

export const anoDe = (data: string): number => Number(data.slice(0, 4));

// ───────────────────────────── Grafo da teia ─────────────────────────────

export const chaveDe = (tipo: TipoDeNo, id: string): string => `${tipo}:${id}`;

export interface NoDaTeia {
  chave: string;
  tipo: TipoDeNo;
  id: string;
  rotulo: string;
  /** Dossiê (só nos nós de entrada; os outros ficam com o do primeiro caso em que aparecem). */
  dossie?: string;
  /** Situação jurídica do caso (nó de entrada). */
  situacao?: Situacao;
  /** Quantas ligações o nó tem. */
  grau: number;
}

export interface ArestaDaTeia {
  id: string;
  de: string;
  para: string;
  tipo: TipoDeLigacao;
  entradaId?: string;
  /** Verdadeiro quando a ligação vem da própria entrada (pessoa citada, organização citada, lugar), não de uma Ligacao. */
  implicita: boolean;
  rotulo?: string;
  /** Na ligação pessoa→caso: a situação jurídica da pessoa naquele caso (sempre visível). */
  situacao?: Situacao;
  /**
   * Confiança da ligação: "primaria" quando alguma fonte que a sustenta é processo, investigação oficial ou dado oficial;
   * "reportado" quando só a imprensa (ou relatório de organização) sustenta. Ponto cheio x ponto vazio no desenho.
   */
  confianca?: Confianca;
}

export interface Grafo {
  nos: NoDaTeia[];
  arestas: ArestaDaTeia[];
}

/** O nó de lugar: município (código IBGE) quando houver; senão a UF. Só país não vira nó. */
export function lugarDoNo(e: Entrada): { id: string; rotulo: string } | null {
  const l = e.lugar;
  if (l.municipioIbge) return { id: `${l.pais}-${l.municipioIbge}`, rotulo: l.nome ?? `${l.regiao ?? ""} ${l.municipioIbge}`.trim() };
  if (l.regiao) return { id: `${l.pais}-${l.regiao}`, rotulo: l.nome ?? l.regiao };
  return null;
}

/**
 * Monta a teia. `dossie` null = todos. Cada entrada vira um nó; pessoas e organizações citadas e o lugar viram nós ligados
 * a ela (ligação implícita, com a situação jurídica da pessoa no caso); as Ligacao do arquivo entram só quando os dois
 * pontas existem na teia. Pessoa com menção a vítima, criança ou testemunha NÃO vira nó (confere de novo).
 */
export function montarGrafo(d: DadosDoObservatorio, dossie: string | null = null): Grafo {
  const nos = new Map<string, NoDaTeia>();
  const arestas = new Map<string, ArestaDaTeia>();
  const entradas = dossie ? d.entradas.filter((e) => e.dossie === dossie) : d.entradas;
  const ids = new Set(entradas.map((e) => e.id));

  const pegar = (tipo: TipoDeNo, id: string, rotulo: string, extra: Partial<NoDaTeia> = {}): NoDaTeia => {
    const chave = chaveDe(tipo, id);
    let no = nos.get(chave);
    if (!no) {
      no = { chave, tipo, id, rotulo, grau: 0, ...extra };
      nos.set(chave, no);
    } else if (!no.dossie && extra.dossie) no.dossie = extra.dossie;
    return no;
  };
  const ligar = (a: ArestaDaTeia) => {
    if (arestas.has(a.id) || !nos.has(a.de) || !nos.has(a.para)) return;
    arestas.set(a.id, a);
    nos.get(a.de)!.grau++;
    nos.get(a.para)!.grau++;
  };

  for (const e of entradas) pegar("entrada", e.id, e.titulo, { dossie: e.dossie, situacao: e.situacao });
  const porId = new Map(entradas.map((e) => [e.id, e]));
  for (const e of entradas) {
    const chaveEntrada = chaveDe("entrada", e.id);
    for (const pp of e.pessoas) {
      const p = acharPessoa(d, pp.pessoaId);
      if (!p || mencionaPapelProibido(`${p.nome} ${p.papel} ${p.cargo ?? ""}`)) continue;
      pegar("pessoa", p.id, p.nome, { dossie: e.dossie });
      ligar({ id: `i:${p.id}:${e.id}`, de: chaveDe("pessoa", p.id), para: chaveEntrada, tipo: "citado_em", entradaId: e.id, implicita: true, situacao: pp.situacao, confianca: e.confianca });
    }
    for (const oid of e.organizacoes) {
      const o = acharOrganizacao(d, oid);
      if (!o) continue;
      pegar("organizacao", o.id, o.nome, { dossie: e.dossie });
      ligar({ id: `i:${o.id}:${e.id}`, de: chaveDe("organizacao", o.id), para: chaveEntrada, tipo: "citado_em", entradaId: e.id, implicita: true, confianca: e.confianca });
    }
    const lg = lugarDoNo(e);
    if (lg) {
      pegar("lugar", lg.id, lg.rotulo, { dossie: e.dossie });
      ligar({ id: `i:${lg.id}:${e.id}`, de: chaveEntrada, para: chaveDe("lugar", lg.id), tipo: "ocorreu_em", entradaId: e.id, implicita: true, confianca: e.confianca });
    }
  }
  for (const l of d.ligacoes) {
    if (!ids.has(l.entradaId)) continue;
    const de = chaveDe(l.de.tipo, l.de.id);
    const para = chaveDe(l.para.tipo, l.para.id);
    ligar({ id: `l:${l.id}`, de, para, tipo: l.tipo, entradaId: l.entradaId, implicita: false, rotulo: l.rotulo, confianca: confiancaDaLigacao(l, porId.get(l.entradaId)) });
  }
  return { nos: [...nos.values()], arestas: [...arestas.values()] };
}

/**
 * Confiança de uma Ligacao explícita: olha as fontes que a sustentam (pelo id na entrada ou pelo id do catálogo). Basta uma
 * primária (processo, investigação oficial, dado oficial) para "primaria"; fonte que não se acha conta como imprensa
 * (cuidado: na dúvida, o ponto fica vazio, nunca cheio).
 */
export function confiancaDaLigacao(l: Pick<Ligacao, "fonteIds">, e: Pick<Entrada, "fontes"> | undefined): Confianca {
  if (!e) return "reportado";
  const fontes = e.fontes.filter((f) => l.fonteIds.includes(f.id) || (f.catalogoId !== undefined && l.fonteIds.includes(f.catalogoId)));
  return fontes.some((f) => TIPOS_PRIMARIOS.includes(f.tipo)) ? "primaria" : "reportado";
}

/** Contagem de nós por tipo (a legenda "destacar por tipo"). */
export function contarPorTipo(g: Grafo): Record<TipoDeNo, number> {
  const c: Record<TipoDeNo, number> = { entrada: 0, pessoa: 0, organizacao: 0, lugar: 0 };
  for (const n of g.nos) c[n.tipo]++;
  return c;
}

/** A data mais recente da base (publicação ou atualização de alguma entrada): a barra "dados construídos em". */
export function dataDaBase(entradas: readonly Pick<Entrada, "publicadoEm" | "atualizadoEm">[]): string | null {
  let max = "";
  for (const e of entradas) for (const d of [e.publicadoEm, e.atualizadoEm]) if (d && d > max) max = d;
  return max || null;
}

/** Domínio de um link, sem "www." ("https://www.stf.jus.br/x" → "stf.jus.br"). Link estranho devolve "". */
export function dominioDe(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * A curva de uma ligação: quadrática, com o ponto de controle deslocado para um lado do segmento (o lado e a força saem
 * do id, então o mesmo desenho dá sempre a mesma curva), como um fio de teia. Devolve o "d" do <path> e o meio da curva
 * (onde vão o texto e o ponto de confiança).
 */
export function curvaDaAresta(p: Ponto, q: Ponto, id: string, curvatura = 0.22): { d: string; mx: number; my: number } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const lado = h & 1 ? 1 : -1;
  const forca = curvatura * (0.6 + ((h >>> 1) % 100) / 250);
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const cx = (p.x + q.x) / 2 - dy * forca * lado;
  const cy = (p.y + q.y) / 2 + dx * forca * lado;
  const f = (n: number) => Math.round(n * 10) / 10;
  return { d: `M${f(p.x)},${f(p.y)} Q${f(cx)},${f(cy)} ${f(q.x)},${f(q.y)}`, mx: 0.25 * p.x + 0.5 * cx + 0.25 * q.x, my: 0.25 * p.y + 0.5 * cy + 0.25 * q.y };
}

/** Uma ramificação do ponto no mapa: pessoa, organização (nó da teia) ou fonte (link) ligada ao caso. */
export interface RamoDoCaso {
  tipo: "pessoa" | "organizacao" | "fonte";
  /** Chave do nó (pessoa/organização) ou o link (fonte). */
  chave: string;
  rotulo: string;
  confianca?: Confianca;
}

/** As ramificações de um caso no mapa (mesma lógica da teia): pessoas e organizações ligadas a ele, e as fontes numeradas com domínio. */
export function ramosDoCaso(d: DadosDoObservatorio, g: Grafo, entradaId: string): RamoDoCaso[] {
  const e = acharEntrada(d, entradaId);
  if (!e) return [];
  const ramos: RamoDoCaso[] = [];
  for (const { aresta, outro } of vizinhos(g, chaveDe("entrada", entradaId))) {
    if (outro.tipo === "pessoa" || outro.tipo === "organizacao") ramos.push({ tipo: outro.tipo, chave: outro.chave, rotulo: outro.rotulo, confianca: aresta.confianca });
  }
  e.fontes.forEach((f, i) => {
    ramos.push({ tipo: "fonte", chave: f.url, rotulo: `${String(i + 1).padStart(2, "0")} · ${dominioDe(f.url) || f.veiculo}`, confianca: TIPOS_PRIMARIOS.includes(f.tipo) ? "primaria" : "reportado" });
  });
  return ramos;
}

/** Vizinhos de um nó (as arestas que o tocam, com o outro lado). */
export function vizinhos(g: Grafo, chave: string): { aresta: ArestaDaTeia; outro: NoDaTeia }[] {
  const porChave = new Map(g.nos.map((n) => [n.chave, n]));
  const saida: { aresta: ArestaDaTeia; outro: NoDaTeia }[] = [];
  for (const a of g.arestas) {
    if (a.de !== chave && a.para !== chave) continue;
    const outro = porChave.get(a.de === chave ? a.para : a.de);
    if (outro) saida.push({ aresta: a, outro });
  }
  return saida;
}

/** A lista textual equivalente à teia: cada nó com as ligações em palavras. Ordem: casos, pessoas, organizações, lugares. */
export function listaTextual(g: Grafo): { no: NoDaTeia; ligacoes: { aresta: ArestaDaTeia; outro: NoDaTeia }[] }[] {
  const ordem: Record<TipoDeNo, number> = { entrada: 0, pessoa: 1, organizacao: 2, lugar: 3 };
  return [...g.nos]
    .sort((a, b) => ordem[a.tipo] - ordem[b.tipo] || a.rotulo.localeCompare(b.rotulo))
    .map((no) => ({ no, ligacoes: vizinhos(g, no.chave) }));
}

// ───────────────────────────── Posições: teia (ponto de partida para o D3) ─────────────────────────────

export interface Ponto {
  x: number;
  y: number;
}

/** Posição inicial determinística (espiral de girassol) para a simulação de força: o mesmo grafo dá sempre o mesmo desenho. */
export function posicaoInicial(i: number, total: number, largura: number, altura: number): Ponto {
  const raio = Math.min(largura, altura) * 0.42 * Math.sqrt((i + 0.5) / Math.max(total, 1));
  const angulo = i * 2.399963229728653; // ângulo áureo
  return { x: largura / 2 + raio * Math.cos(angulo), y: altura / 2 + raio * Math.sin(angulo) };
}

// ───────────────────────────── Visão "Órbita" ─────────────────────────────

/** Distância em saltos a partir do centro (largura primeiro). Nó fora do alcance fica com -1. */
export function saltosAPartirDe(g: Grafo, centro: string): Map<string, number> {
  const dist = new Map<string, number>([[centro, 0]]);
  const fila = [centro];
  while (fila.length) {
    const atual = fila.shift()!;
    for (const a of g.arestas) {
      const outro = a.de === atual ? a.para : a.para === atual ? a.de : null;
      if (outro && !dist.has(outro)) {
        dist.set(outro, dist.get(atual)! + 1);
        fila.push(outro);
      }
    }
  }
  for (const n of g.nos) if (!dist.has(n.chave)) dist.set(n.chave, -1);
  return dist;
}

/** O nó mais ligado (empate: o primeiro por rótulo): o centro padrão da órbita. */
export function centroPadrao(g: Grafo): string | null {
  if (g.nos.length === 0) return null;
  return [...g.nos].sort((a, b) => b.grau - a.grau || a.rotulo.localeCompare(b.rotulo))[0].chave;
}

export interface NoOrbita extends Ponto {
  chave: string;
  anel: number;
}

/** Anéis concêntricos: o centro no meio, os ligados a ele no primeiro anel, e assim por diante; o que não chega vai ao último. */
export function layoutOrbita(g: Grafo, centro: string | null, largura: number, altura: number): { nos: NoOrbita[]; aneis: number[]; centro: string | null } {
  const alvo = centro && g.nos.some((n) => n.chave === centro) ? centro : centroPadrao(g);
  if (!alvo) return { nos: [], aneis: [], centro: null };
  const dist = saltosAPartirDe(g, alvo);
  const maxSalto = Math.max(0, ...[...dist.values()]);
  const temIsolado = [...dist.values()].some((v) => v < 0);
  const totalDeAneis = maxSalto + (temIsolado ? 1 : 0);
  const cx = largura / 2;
  const cy = altura / 2;
  const raioMax = Math.min(largura, altura) * 0.46;
  const passo = totalDeAneis > 0 ? raioMax / totalDeAneis : 0;
  const porAnel = new Map<number, string[]>();
  for (const n of g.nos) {
    const v = dist.get(n.chave)!;
    const anel = v < 0 ? maxSalto + 1 : v;
    porAnel.set(anel, [...(porAnel.get(anel) ?? []), n.chave]);
  }
  const nos: NoOrbita[] = [];
  for (const [anel, chaves] of porAnel) {
    chaves.forEach((chave, i) => {
      if (anel === 0) nos.push({ chave, anel, x: cx, y: cy });
      else {
        const ang = (2 * Math.PI * i) / chaves.length + anel * 0.6 - Math.PI / 2;
        nos.push({ chave, anel, x: cx + passo * anel * Math.cos(ang), y: cy + passo * anel * Math.sin(ang) });
      }
    });
  }
  return { nos, aneis: Array.from({ length: totalDeAneis }, (_, i) => passo * (i + 1)), centro: alvo };
}

// ───────────────────────────── Visão "Grupos" ─────────────────────────────

export interface GrupoDesenhado {
  slug: string;
  cx: number;
  cy: number;
  r: number;
  total: number;
}

/** Cada dossiê é um aglomerado; os nós de cada um ficam em espiral dentro dele. Nós sem dossiê vão para "outros". */
export function layoutGrupos(g: Grafo, dossies: readonly { slug: string }[], largura: number, altura: number): { grupos: GrupoDesenhado[]; nos: (NoOrbita & { grupo: string })[] } {
  const porGrupo = new Map<string, NoDaTeia[]>();
  for (const d of dossies) porGrupo.set(d.slug, []);
  for (const n of g.nos) {
    const chave = n.dossie && porGrupo.has(n.dossie) ? n.dossie : "outros";
    porGrupo.set(chave, [...(porGrupo.get(chave) ?? []), n]);
  }
  const usados = [...porGrupo.entries()].filter(([, v]) => v.length > 0);
  const colunas = Math.max(1, Math.ceil(Math.sqrt(usados.length * (largura / altura))));
  const linhas = Math.max(1, Math.ceil(usados.length / colunas));
  const celW = largura / colunas;
  const celH = altura / linhas;
  const grupos: GrupoDesenhado[] = [];
  const nos: (NoOrbita & { grupo: string })[] = [];
  usados.forEach(([slug, lista], idx) => {
    const cx = (idx % colunas) * celW + celW / 2;
    const cy = Math.floor(idx / colunas) * celH + celH / 2;
    const r = Math.min(celW, celH) * 0.42;
    grupos.push({ slug, cx, cy, r, total: lista.length });
    lista.forEach((n, i) => {
      const p = posicaoInicial(i, lista.length, r * 2.4, r * 2.4);
      nos.push({ chave: n.chave, anel: 0, grupo: slug, x: cx + (p.x - r * 1.2), y: cy + (p.y - r * 1.2) });
    });
  });
  return { grupos, nos };
}

// ───────────────────────────── Visão "Fluxo" ─────────────────────────────

export interface FluxoCaixa {
  chave: string;
  x: number;
  y: number;
  w: number;
  h: number;
  total: number;
}
export interface FluxoFaixa {
  de: string;
  para: string;
  total: number;
  /** Altura da faixa e o ponto de saída (y0) e de chegada (y1), no meio da faixa. */
  h: number;
  y0: number;
  y1: number;
}

/** Dossiê → situação jurídica: quantos casos de cada dossiê estão em cada situação. Os totais definem a altura das faixas. */
export function layoutFluxo(entradas: readonly Entrada[], dossies: readonly { slug: string }[], largura: number, altura: number) {
  const pad = 12;
  const util = altura - pad * 2;
  const total = Math.max(1, entradas.length);
  const porDossie = new Map<string, number>();
  const porSituacao = new Map<Situacao, number>();
  const pares = new Map<string, number>();
  for (const e of entradas) {
    porDossie.set(e.dossie, (porDossie.get(e.dossie) ?? 0) + 1);
    porSituacao.set(e.situacao, (porSituacao.get(e.situacao) ?? 0) + 1);
    const k = `${e.dossie}|${e.situacao}`;
    pares.set(k, (pares.get(k) ?? 0) + 1);
  }
  const esc = (n: number) => (n / total) * util * 0.86;
  const caixaW = 14;
  const esquerda: FluxoCaixa[] = [];
  const direita: FluxoCaixa[] = [];
  const espacamento = (qtd: number) => (qtd > 1 ? (util * 0.14) / (qtd - 1) : 0);
  const dossiesUsados = dossies.filter((d) => (porDossie.get(d.slug) ?? 0) > 0);
  const situacoesUsadas = SITUACOES.filter((s) => (porSituacao.get(s) ?? 0) > 0);
  let y = pad;
  for (const d of dossiesUsados) {
    const n = porDossie.get(d.slug)!;
    esquerda.push({ chave: d.slug, x: 0, y, w: caixaW, h: esc(n), total: n });
    y += esc(n) + espacamento(dossiesUsados.length);
  }
  y = pad;
  for (const s of situacoesUsadas) {
    const n = porSituacao.get(s)!;
    direita.push({ chave: s, x: largura - caixaW, y, w: caixaW, h: esc(n), total: n });
    y += esc(n) + espacamento(situacoesUsadas.length);
  }
  const usoEsq = new Map<string, number>();
  const usoDir = new Map<string, number>();
  const faixas: FluxoFaixa[] = [];
  for (const d of dossiesUsados) {
    for (const s of situacoesUsadas) {
      const n = pares.get(`${d.slug}|${s}`) ?? 0;
      if (!n) continue;
      const h = esc(n);
      const ce = esquerda.find((c) => c.chave === d.slug)!;
      const cd = direita.find((c) => c.chave === s)!;
      const e0 = usoEsq.get(d.slug) ?? 0;
      const d0 = usoDir.get(s) ?? 0;
      faixas.push({ de: d.slug, para: s, total: n, h, y0: ce.y + e0 + h / 2, y1: cd.y + d0 + h / 2 });
      usoEsq.set(d.slug, e0 + h);
      usoDir.set(s, d0 + h);
    }
  }
  return { esquerda, direita, faixas };
}

// ───────────────────────────── Visão "Linha do tempo" ─────────────────────────────

export interface MarcaDoTempo {
  entrada: Entrada;
  ms: number;
  x: number;
  y: number;
}

/** Eixo por data do fato; uma faixa horizontal por dossiê. Entradas do mesmo dossiê e data empilham para não se esconder. */
export function layoutLinha(entradas: readonly Entrada[], dossies: readonly { slug: string }[], largura: number, altura: number) {
  const validas = entradas.filter((e) => Number.isFinite(dataParaMs(e.dataDoFato)));
  if (validas.length === 0) return { marcas: [] as MarcaDoTempo[], anos: [] as { ano: number; x: number }[], faixas: [] as { slug: string; y: number }[] };
  const mss = validas.map((e) => dataParaMs(e.dataDoFato));
  let min = Math.min(...mss);
  let max = Math.max(...mss);
  if (min === max) {
    min -= 180 * 86400000;
    max += 180 * 86400000;
  }
  const margem = 40;
  const x = (ms: number) => margem + ((ms - min) / (max - min)) * (largura - margem * 2);
  const usados = dossies.filter((d) => validas.some((e) => e.dossie === d.slug));
  const alturaFaixa = (altura - 50) / Math.max(usados.length, 1);
  const faixas = usados.map((d, i) => ({ slug: d.slug, y: 20 + alturaFaixa * i + alturaFaixa / 2 }));
  const empilhado = new Map<string, number>();
  const marcas: MarcaDoTempo[] = [...validas]
    .sort((a, b) => dataParaMs(a.dataDoFato) - dataParaMs(b.dataDoFato) || a.id.localeCompare(b.id))
    .map((e) => {
      const ms = dataParaMs(e.dataDoFato);
      const px = x(ms);
      const base = faixas.find((f) => f.slug === e.dossie)!.y;
      const chave = `${e.dossie}|${Math.round(px / 14)}`;
      const n = empilhado.get(chave) ?? 0;
      empilhado.set(chave, n + 1);
      const lado = n % 2 === 0 ? -1 : 1;
      return { entrada: e, ms, x: px, y: base + lado * Math.ceil(n / 2) * 14 };
    });
  const primeiro = new Date(min).getUTCFullYear();
  const ultimo = new Date(max).getUTCFullYear();
  const passoAnos = Math.max(1, Math.ceil((ultimo - primeiro + 1) / 10));
  const anos: { ano: number; x: number }[] = [];
  for (let a = primeiro; a <= ultimo; a += passoAnos) anos.push({ ano: a, x: x(Date.UTC(a, 0, 1)) });
  return { marcas, anos, faixas };
}

// ───────────────────────────── Zoom nomeado (teia) ─────────────────────────────

export const NIVEIS_DA_TEIA = ["panorama", "dossie", "caso", "detalhe"] as const;
export type NivelDaTeia = (typeof NIVEIS_DA_TEIA)[number];

/** O nome do nível de zoom da teia, pela escala: panorama (tudo), dossiê, caso e detalhe (rótulos de tudo). */
export function nivelDaTeia(escala: number): NivelDaTeia {
  if (escala < 0.85) return "panorama";
  if (escala < 1.7) return "dossie";
  if (escala < 3.2) return "caso";
  return "detalhe";
}

/** Escala-alvo de cada nível (botões de zoom saltam de nível em nível). */
export const ESCALA_DO_NIVEL: Record<NivelDaTeia, number> = { panorama: 0.6, dossie: 1.2, caso: 2.4, detalhe: 4 };

export const ESCALA_MIN = 0.4;
export const ESCALA_MAX = 6;
export const limitarEscala = (k: number): number => Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, k));

/** O rótulo de um nó aparece neste nível? Casos a partir de "dossiê"; os demais só em "caso" ou mais perto. */
export function rotuloVisivel(tipo: TipoDeNo, nivel: NivelDaTeia, destacado: boolean): boolean {
  if (destacado) return true;
  if (nivel === "detalhe") return true;
  if (nivel === "caso") return true;
  if (nivel === "dossie") return tipo === "entrada";
  return false;
}

// ───────────────────────────── Atualização ao vivo ─────────────────────────────

/** Troca, acrescenta ou tira uma entrada do conjunto (Realtime). `entrada` null remove. Não mexe no original. */
export function aplicarEntradaAoVivo(d: DadosDoObservatorio, id: string, entrada: Entrada | null): DadosDoObservatorio {
  const resto = d.entradas.filter((e) => e.id !== id);
  return { ...d, entradas: entrada ? [...resto, entrada].sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm) || a.id.localeCompare(b.id)) : resto };
}

/** Contagem por situação (para o cabeçalho): números agregados, nunca de pessoas. */
export function contarPorSituacao(entradas: readonly Entrada[]): Record<Situacao, number> {
  const c = Object.fromEntries(SITUACOES.map((s) => [s, 0])) as Record<Situacao, number>;
  for (const e of entradas) c[e.situacao]++;
  return c;
}

/** Dossiê → cor neon (nome da classe de CSS). */
export const classeDaCor = (cor: Dossie["cor"] | undefined): string => `ve-cor-${cor ?? "amarelo"}`;

/** Data para mostrar, sem depender do Intl (servidor e navegador escrevem igual): AAAA-MM-DD vira DD/MM/AAAA (en e zh ficam em ISO). */
export function formatarData(data: string, lang: string): string {
  const [a, m, d] = data.split("-");
  if (!a) return data;
  if (lang === "en" || lang === "zh") return data;
  if (d && m) return `${d}/${m}/${a}`;
  if (m) return `${m}/${a}`;
  return a;
}

/** A posição de cada entrada na ordem de publicação (1, 2, 3...): vira o código de arquivo "VE-0001". Só um rótulo. */
export function indicesDeArquivo(entradas: readonly Entrada[]): Map<string, number> {
  const ordenadas = [...entradas].sort((a, b) => a.publicadoEm.localeCompare(b.publicadoEm) || a.id.localeCompare(b.id));
  return new Map(ordenadas.map((e, i) => [e.id, i + 1]));
}

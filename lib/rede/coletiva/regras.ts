// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As regras puras do lote ação coletiva (Prompt 4, Parte F), sem rede e sem tela, para o aparelho, as rotas do site e o teste
// (scripts/testar-p4-coletiva.mjs):
//   90  radar de projetos de lei: ler o número ("PL 1234/2024"), os endereços dos dados abertos da Câmara e do Senado (buscados SÓ
//       pelo servidor, com cache na borda) e o resumo da situação; a lista do que a pessoa segue fica SÓ no aparelho;
//   91  modelos de documento: pedido pela Lei de Acesso à Informação com o prazo contado, ofício, requerimento, denúncia à ouvidoria e
//       ao Ministério Público, montados no aparelho;
//   94  panfleto com QR do ato: o texto e o endereço da página do ato;
//   97  previsão do tempo do ato: os endereços do Open-Meteo (serviço aberto, pelo servidor) e a leitura da resposta.
// Sem os atalhos "@/" de propósito: o teste roda este arquivo direto no Node.

export const FLAG_DA_COLETIVA = "alumia-p4-coletiva" as const;
export const ROTA_DA_COLETIVA = "acao-coletiva" as const;

// ───────────────────────── 90 · Radar de projetos de lei ─────────────────────────

export type Casa = "camara" | "senado";
export interface Projeto {
  casa: Casa;
  sigla: string;
  numero: number;
  ano: number;
}

/** As siglas aceitas (projeto de lei, de lei complementar, de emenda à Constituição, medida provisória, de decreto legislativo). */
export const SIGLAS = ["PL", "PLP", "PEC", "MPV", "PDL"] as const;

/** "PL 1234/2024", "pl1234-2024", "PEC 45 de 2019": o projeto; fora do formato, nulo. */
export function lerProjeto(texto: string, casa: Casa): Projeto | null {
  const m = /^\s*([A-Za-z]{2,3})\s*\.?\s*(\d{1,5})\s*(?:\/|-|de|\s)\s*(\d{4})\s*$/i.exec(texto ?? "");
  if (!m) return null;
  const sigla = m[1].toUpperCase();
  const numero = Number(m[2]);
  const ano = Number(m[3]);
  if (!(SIGLAS as readonly string[]).includes(sigla) || numero < 1 || ano < 1946 || ano > 2100) return null;
  return { casa, sigla, numero, ano };
}

/** A chave do projeto (para o aparelho guardar e para a rota): "camara:PL:1234:2024". */
export const chaveDoProjeto = (p: Projeto) => `${p.casa}:${p.sigla}:${p.numero}:${p.ano}`;

/** O contrário da chave (nula se não for uma). */
export function projetoDaChave(chave: string): Projeto | null {
  const m = /^(camara|senado):([A-Z]{2,3}):(\d{1,5}):(\d{4})$/.exec(chave ?? "");
  if (!m || !(SIGLAS as readonly string[]).includes(m[2])) return null;
  return { casa: m[1] as Casa, sigla: m[2], numero: Number(m[3]), ano: Number(m[4]) };
}

/** A busca na Câmara (dados abertos, API v2): o id pelo tipo, número e ano. */
export const urlDaBuscaNaCamara = (p: Projeto) =>
  `https://dadosabertos.camara.leg.br/api/v2/proposicoes?siglaTipo=${p.sigla}&numero=${p.numero}&ano=${p.ano}&itens=1`;
/** O detalhe na Câmara (a situação atual em statusProposicao). */
export const urlDoDetalheNaCamara = (id: number) => `https://dadosabertos.camara.leg.br/api/v2/proposicoes/${id}`;
/** A busca no Senado (dados abertos, em JSON). */
export const urlDaBuscaNoSenado = (p: Projeto) =>
  `https://legis.senado.leg.br/dadosabertos/materia/pesquisa/lista.json?sigla=${p.sigla}&numero=${p.numero}&ano=${p.ano}`;

/** A situação de um projeto como a tela mostra. */
export interface Situacao {
  chave: string;
  titulo: string;
  ementa: string;
  situacao: string;
  orgao: string;
  /** Quando foi o último andamento (ISO): é o que o aparelho compara para dizer "andou". */
  quando: string;
  link: string;
}

const texto = (v: unknown, max = 600) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const linkSeguro = (v: unknown, dominios: string[]) => {
  try {
    const u = new URL(String(v));
    return u.protocol === "https:" && dominios.some((d) => u.hostname === d || u.hostname.endsWith(`.${d}`)) ? u.toString() : "";
  } catch {
    return "";
  }
};

/** O id da proposição na resposta da busca da Câmara (nulo sem resultado). */
export function idNaCamara(json: unknown): number | null {
  const d = (json as { dados?: { id?: unknown }[] } | null)?.dados;
  const id = Array.isArray(d) && d[0] ? Number(d[0].id) : NaN;
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** A situação a partir do detalhe da Câmara. */
export function situacaoDaCamara(p: Projeto, json: unknown): Situacao | null {
  const d = (json as { dados?: Record<string, unknown> } | null)?.dados;
  if (!d || typeof d !== "object") return null;
  const s = (d.statusProposicao ?? {}) as Record<string, unknown>;
  const id = Number(d.id);
  return {
    chave: chaveDoProjeto(p),
    titulo: `${p.sigla} ${p.numero}/${p.ano}`,
    ementa: texto(d.ementa),
    situacao: texto(s.descricaoSituacao) || texto(s.descricaoTramitacao),
    orgao: texto(s.siglaOrgao, 40),
    quando: texto(s.dataHora, 40),
    link: Number.isInteger(id) && id > 0 ? `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${id}` : "",
  };
}

/** A situação a partir da busca do Senado (o formato do serviço pode mudar: o que não vier, fica vazio). */
export function situacaoDoSenado(p: Projeto, json: unknown): Situacao | null {
  const lista = (json as { PesquisaBasicaMateria?: { Materias?: { Materia?: unknown } } } | null)?.PesquisaBasicaMateria?.Materias?.Materia;
  const m = (Array.isArray(lista) ? lista[0] : lista) as Record<string, unknown> | undefined;
  if (!m || typeof m !== "object") return null;
  const dados = (m.DadosBasicosMateria ?? m) as Record<string, unknown>;
  const situ = (m.SituacaoAtual ?? m.Situacao ?? {}) as Record<string, unknown>;
  const codigo = texto(m.Codigo ?? (m.IdentificacaoMateria as Record<string, unknown> | undefined)?.CodigoMateria, 20);
  return {
    chave: chaveDoProjeto(p),
    titulo: `${p.sigla} ${p.numero}/${p.ano}`,
    ementa: texto(dados.Ementa ?? dados.EmentaMateria),
    situacao: texto(situ.DescricaoSituacao ?? m.DescricaoSituacao),
    orgao: texto(situ.SiglaLocal ?? m.SiglaLocal, 40),
    quando: texto(situ.DataSituacao ?? m.DataUltimaAtualizacao ?? m.Data, 40),
    link: /^\d+$/.test(codigo) ? `https://www25.senado.leg.br/web/atividade/materias/-/materia/${codigo}` : linkSeguro(m.UrlDetalheMateria, ["senado.leg.br"]),
  };
}

/** A chave do radar no aparelho. Começa com "lucia:rede": o "Sair rápido" apaga junto com o resto da Rede. */
export const CHAVE_DO_RADAR = "lucia:rede:radar";
export interface Seguido {
  chave: string;
  /** O último andamento que a pessoa já viu. */
  visto: string;
}
export const MAXIMO_SEGUIDOS = 30;

/** A lista guardada no aparelho, conferida (o que não for projeto sai). */
export function lerSeguidos(cru: string | null): Seguido[] {
  try {
    const v = JSON.parse(cru ?? "[]") as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is Seguido => !!x && typeof x === "object" && projetoDaChave((x as Seguido).chave) !== null && typeof (x as Seguido).visto === "string")
      .slice(0, MAXIMO_SEGUIDOS);
  } catch {
    return [];
  }
}

/** O projeto andou desde a última vez que a pessoa viu? */
export const andou = (s: Seguido, atual: Pick<Situacao, "quando"> | null) => !!atual?.quando && atual.quando !== s.visto;

// ───────────────────────── 91 · Modelos de documento ─────────────────────────

export const MODELOS = ["lai", "oficio", "requerimento", "ouvidoria", "mp"] as const;
export type Modelo = (typeof MODELOS)[number];

export interface DadosDoDocumento {
  /** Quem assina (pessoa ou organização); pode ficar em branco para preencher à mão. */
  quem: string;
  /** Para quem vai (órgão, secretaria, promotoria). */
  para: string;
  /** O assunto, numa linha. */
  assunto: string;
  /** O pedido ou o relato, em texto corrido. */
  texto: string;
  cidade: string;
}

/** Soma dias corridos a uma data (AAAA-MM-DD), sem fuso. */
export function somarDias(dia: string, n: number): string {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

/** O prazo da LAI (Lei 12.527/2011, art. 11, §§ 1º e 2º): 20 dias corridos, prorrogáveis por mais 10, com justificativa. */
export function prazoDaLai(pedidoEm: string): { resposta: string; prorrogada: string } {
  return { resposta: somarDias(pedidoEm, 20), prorrogada: somarDias(pedidoEm, 30) };
}

/** A data por extenso, em português ("20 de novembro de 2026"). */
export function dataPorExtenso(dia: string): string {
  const meses = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const [a, m, d] = dia.split("-").map(Number);
  return `${d} de ${meses[m - 1]} de ${a}`;
}

const linha = (v: string, vazio: string) => (v.trim() ? v.trim() : vazio);

/**
 * O documento pronto, em texto, montado no aparelho (nada vai a lugar nenhum). Os campos em branco viram traços para preencher à
 * mão. `hoje` é a data do documento (AAAA-MM-DD).
 */
export function montarDocumento(modelo: Modelo, d: DadosDoDocumento, hoje: string): string {
  const quem = linha(d.quem, "______________________________");
  const para = linha(d.para, "______________________________");
  const assunto = linha(d.assunto, "______________________________");
  const corpo = linha(d.texto, "______________________________\n______________________________");
  const local = `${linha(d.cidade, "__________")}, ${dataPorExtenso(hoje)}.`;
  switch (modelo) {
    case "lai": {
      const p = prazoDaLai(hoje);
      return [
        `A(o) ${para}`, "", `Assunto: pedido de acesso à informação — ${assunto}`, "",
        `${quem}, com base no art. 5º, XXXIII, da Constituição Federal e na Lei nº 12.527/2011 (Lei de Acesso à Informação), solicita as seguintes informações:`,
        "", corpo, "",
        "Pede-se que a resposta venha em formato aberto, quando possível. Não é preciso dizer o motivo do pedido (art. 10, § 3º).",
        `O prazo de resposta é de 20 dias (art. 11, § 1º), até ${dataPorExtenso(p.resposta)}, prorrogável por mais 10 dias com justificativa (art. 11, § 2º), até ${dataPorExtenso(p.prorrogada)}. Em caso de negativa, cabe recurso em 10 dias (art. 15).`,
        "", local, "", quem,
      ].join("\n");
    }
    case "oficio":
      return [`Ofício nº ___/${hoje.slice(0, 4)}`, "", local, "", `A(o) ${para}`, "", `Assunto: ${assunto}`, "", "Prezadas e prezados,", "", corpo, "", "Atenciosamente,", "", quem].join("\n");
    case "requerimento":
      return [`Excelentíssima(o) Senhor(a) ${para}`, "", `${quem} vem, respeitosamente, requerer: ${assunto}.`, "", corpo, "", "Nestes termos, pede deferimento.", "", local, "", quem].join("\n");
    case "ouvidoria":
      return [`À Ouvidoria — ${para}`, "", `Assunto: denúncia — ${assunto}`, "",
        "Venho registrar a seguinte denúncia, pedindo que seja apurada e que me informem o número de protocolo e o andamento:", "", corpo, "",
        "A identificação de quem denuncia é informação pessoal protegida (Lei nº 13.460/2017, art. 10, § 7º). Muitas ouvidorias também aceitam denúncia sem nome: confira no canal de cada uma.",
        "", local, "", quem].join("\n");
    case "mp":
      return [`Ao Ministério Público — ${para}`, "", `Assunto: representação — ${assunto}`, "",
        `${quem} vem apresentar representação, para que o Ministério Público tome as providências cabíveis (Constituição Federal, art. 129), pelos fatos a seguir:`,
        "", corpo, "", "Pede-se o registro desta representação e a informação do número do procedimento.", "", local, "", quem].join("\n");
  }
}

// ───────────────────────── 94 · Panfleto com QR do ato ─────────────────────────

/** O endereço da página do ato (o QR do panfleto aponta para ele). */
export function linkDoAto(origem: string, lang: string, id: string): string {
  const base = origem.replace(/\/+$/, "");
  return `${base}/${encodeURIComponent(lang)}/alumia/ato/${encodeURIComponent(id)}`;
}

/** As linhas do panfleto: título, quando, onde e os selos de acessibilidade (os textos vêm da tela). */
export function linhasDoPanfleto(ato: { titulo: string; inicio: string; cidade: string; ponto: string }, quando: string, selos: string[]): string[] {
  return [ato.titulo.trim(), quando, `${ato.ponto} · ${ato.cidade}`, ...(selos.length ? [selos.join(" · ")] : [])].filter(Boolean);
}

type BibliotecaDoQr = typeof import("qrcode");

/**
 * O QR do panfleto em SVG, desenhado no aparelho pela biblioteca "qrcode" que o site já usa (nada vai a um gerador de fora).
 * Só aceita o endereço da página do ato no nosso próprio site (https ou o local de desenvolvimento).
 */
export async function qrDoPanfleto(link: string): Promise<string> {
  if (!/^(https:\/\/[^/\s]+|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)\/[a-z]{2}\/alumia\/ato\/[0-9a-f-]{36}$/.test(link)) throw new Error("invalido:link");
  const m = (await import("qrcode")) as BibliotecaDoQr & { default?: BibliotecaDoQr };
  const qr = m.default ?? m;
  return qr.toString(link, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#000000", light: "#ffffff" } });
}

// ───────────────────────── 100 · O aviso de Pix no cartão ─────────────────────────

/**
 * O post fala em Pix? Só então o cartão pergunta ao banco (rede_p4_pix_conferir, que confere de novo, do mesmo jeito: a palavra
 * "pix" inteira). Os outros posts nem chegam a perguntar.
 */
export const falaEmPix = (texto: string | null | undefined) => /(^|[^\p{L}\p{N}_])pix($|[^\p{L}\p{N}_])/iu.test(texto ?? "");

// ───────────────────────── 97 · Previsão do tempo do ato ─────────────────────────

/** A busca da cidade no Open-Meteo (geocodificação aberta, sem chave), só no Brasil. */
export const urlDaCidade = (cidade: string) =>
  `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade.trim().slice(0, 80))}&count=1&language=pt&countryCode=BR&format=json`;

/** A previsão diária de um ponto, para um dia (o Open-Meteo prevê até 16 dias). */
export const urlDaPrevisao = (lat: number, lon: number, dia: string) =>
  `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(2)}&longitude=${lon.toFixed(2)}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America%2FSao_Paulo&start_date=${dia}&end_date=${dia}`;

/** O dia do ato está dentro da previsão (hoje até 15 dias à frente)? */
export function diaPrevisivel(dia: string, hoje: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dia) && dia >= hoje && dia <= somarDias(hoje, 15);
}

/** As coordenadas da resposta da geocodificação (arredondadas a 2 casas: a cidade, não a rua). */
export function lerCidade(json: unknown): { lat: number; lon: number; nome: string } | null {
  const r = (json as { results?: { latitude?: unknown; longitude?: unknown; name?: unknown }[] } | null)?.results?.[0];
  const lat = Number(r?.latitude);
  const lon = Number(r?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100, nome: texto(r?.name, 80) };
}

export interface Previsao {
  dia: string;
  maxima: number | null;
  minima: number | null;
  chuva: number | null;
  /** O código WMO do tempo (0 céu limpo… 95 trovoada). */
  codigo: number | null;
  tipo: TipoDeTempo;
}
export type TipoDeTempo = "limpo" | "nuvens" | "neblina" | "garoa" | "chuva" | "temporal" | "desconhecido";

/** O tipo do tempo pelo código WMO. */
export function tipoDoTempo(codigo: number | null): TipoDeTempo {
  if (codigo === null || !Number.isFinite(codigo)) return "desconhecido";
  if (codigo === 0 || codigo === 1) return "limpo";
  if (codigo === 2 || codigo === 3) return "nuvens";
  if (codigo === 45 || codigo === 48) return "neblina";
  if (codigo >= 51 && codigo <= 57) return "garoa";
  if ((codigo >= 61 && codigo <= 67) || (codigo >= 80 && codigo <= 82)) return "chuva";
  if (codigo >= 95) return "temporal";
  return "desconhecido";
}

/** A previsão do dia na resposta do Open-Meteo (nula se não veio o dia). */
export function lerPrevisao(json: unknown, dia: string): Previsao | null {
  const d = (json as { daily?: Record<string, unknown[]> } | null)?.daily;
  if (!d || !Array.isArray(d.time)) return null;
  const i = d.time.indexOf(dia);
  if (i < 0) return null;
  const num = (k: string) => {
    const v = Array.isArray(d[k]) ? Number(d[k][i]) : NaN;
    return Number.isFinite(v) ? Math.round(v) : null;
  };
  const codigo = num("weather_code");
  return { dia, maxima: num("temperature_2m_max"), minima: num("temperature_2m_min"), chuva: num("precipitation_probability_max"), codigo, tipo: tipoDoTempo(codigo) };
}

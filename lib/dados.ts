// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os números do país que mais pesam na vida de quem trabalha, direto das fontes oficiais: Banco Central (SGS),
// IBGE e Câmara dos Deputados. Lidos no servidor e guardados por algumas horas. Se uma fonte não responder,
// o indicador some da página em vez de mostrar número velho ou inventado.
import { buscarJson } from "./externo";

export interface Indicador {
  id: "salario" | "ipca" | "selic" | "desocupacao" | "populacao" | "rendimento" | "informalidade" | "dolar" | "rotativo" | "endividamento" | "comprometimento" | "inadimplencia";
  valor: number;
  /** Data de referência, AAAA-MM-DD. */
  referencia: string;
  fonte: string;
  link: string;
}

export interface Votacao {
  id: string;
  data: string;
  descricao: string;
  aprovada: boolean | null;
  link: string;
}

/**
 * Série do Sistema Gerenciador de Séries do Banco Central: o último valor com data até hoje. Algumas séries
 * (salário mínimo, meta da Selic) já trazem os meses ou dias seguintes preenchidos; esses ficam de fora.
 */
async function serie(codigo: number): Promise<{ valor: number; referencia: string } | null> {
  const hoje = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const br = (iso: string) => iso.split("-").reverse().join("/");
  // Pede só o último ano e meio até hoje: a série mensal mais lenta (desemprego) sai com uns três meses de atraso.
  const inicio = new Date(Date.now() - 540 * 86400000).toISOString().slice(0, 10);
  const dados = await buscarJson<{ data?: string; valor?: string }[]>(
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${codigo}/dados?formato=json&dataInicial=${br(inicio)}&dataFinal=${br(hoje)}`,
    { guardar: 21600 },
  );
  // A fonte de fora pode responder com qualquer coisa (aviso de erro, página de manutenção): só lista entra, e só
  // itens que sejam objetos. Uma resposta torta já derrubou o build inteiro.
  const lidos = (Array.isArray(dados) ? dados : [])
    .filter((item) => item !== null && typeof item === "object")
    .map((item) => {
      const [dia, mes, ano] = (typeof item.data === "string" ? item.data : "").split("/");
      return { referencia: ano ? `${ano}-${mes}-${dia}` : "", valor: Number(item.valor) };
    })
    .filter((item) => item.referencia && item.referencia <= hoje && Number.isFinite(item.valor));
  return lidos.at(-1) ?? null;
}

const series: [Indicador["id"], number][] = [
  ["salario", 1619],
  ["ipca", 13522],
  ["selic", 432],
  ["desocupacao", 24369],
  ["dolar", 1],
  ["rotativo", 22022],
  ["endividamento", 29037],
  ["comprometimento", 29034],
  ["inadimplencia", 21112],
];

/**
 * O último valor de uma tabela do IBGE (SIDRA) para o Brasil. O período vem como AAAAMM (trimestre móvel que
 * termina naquele mês) ou AAAA0T (trimestre); `trimestral` diz qual dos dois.
 */
async function sidra(agregado: number, variavel: number, trimestral = false): Promise<{ valor: number; referencia: string } | null> {
  const dados = await buscarJson<{ resultados?: { series?: { serie?: Record<string, string> }[] }[] }[]>(
    `https://servicodados.ibge.gov.br/api/v3/agregados/${agregado}/periodos/-1/variaveis/${variavel}?localidades=N1%5Ball%5D`,
    { guardar: 86400 },
  );
  const bruta = Array.isArray(dados) ? dados[0]?.resultados?.[0]?.series?.[0]?.serie : undefined;
  const serie: Record<string, string> = bruta && typeof bruta === "object" && !Array.isArray(bruta) ? bruta : {};
  const periodo = Object.keys(serie).filter((k) => /^\d{6}$/.test(k)).sort().pop();
  const valor = periodo ? Number(serie[periodo]) : NaN;
  if (!periodo || !Number.isFinite(valor)) return null;
  const mes = trimestral ? Number(periodo.slice(4)) * 3 : Number(periodo.slice(4));
  if (mes < 1 || mes > 12) return null;
  return { valor, referencia: `${periodo.slice(0, 4)}-${String(mes).padStart(2, "0")}-01` };
}

export async function indicadores(): Promise<Indicador[]> {
  const lidos = await Promise.all(
    series.map(async ([id, codigo]) => {
      const lido = await serie(codigo);
      return lido ? { id, ...lido, fonte: "Banco Central do Brasil (SGS)", link: `https://www3.bcb.gov.br/sgspub/consultarvalores/telaCvsSelecionarSeries.paint?codigo=${codigo}` } : null;
    }),
  );
  const ibge = await buscarJson<{ resultados?: { series?: { serie?: Record<string, string> }[] }[] }[]>(
    "https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/-1/variaveis/9324?localidades=N1%5Ball%5D",
    { guardar: 86400 },
  );
  const bruta = Array.isArray(ibge) ? ibge[0]?.resultados?.[0]?.series?.[0]?.serie : undefined;
  const serieIbge: Record<string, string> = bruta && typeof bruta === "object" && !Array.isArray(bruta) ? bruta : {};
  const ano = Object.keys(serieIbge).filter((k) => /^\d{4}$/.test(k)).sort().pop();
  const populacao = ano ? Number(serieIbge[ano]) : NaN;
  const lista = lidos.filter((item): item is Indicador => item !== null);
  const [rendimento, informalidade] = await Promise.all([sidra(6390, 5933), sidra(8529, 12466, true)]);
  if (rendimento) lista.push({ id: "rendimento", ...rendimento, fonte: "IBGE, PNAD Contínua", link: "https://sidra.ibge.gov.br/tabela/6390" });
  if (informalidade) lista.push({ id: "informalidade", ...informalidade, fonte: "IBGE, PNAD Contínua", link: "https://sidra.ibge.gov.br/tabela/8529" });
  if (ano && Number.isFinite(populacao)) {
    lista.push({ id: "populacao", valor: populacao, referencia: `${ano}-07-01`, fonte: "IBGE, estimativa da população", link: "https://sidra.ibge.gov.br/tabela/6579" });
  }
  return lista;
}

/** As últimas votações no Plenário da Câmara, como a própria Câmara as descreve. */
export async function votacoesCamara(): Promise<Votacao[]> {
  const dados = await buscarJson<{ dados?: { id?: string; data?: string; descricao?: string; aprovacao?: number | null; uriEvento?: string }[] }>(
    "https://dadosabertos.camara.leg.br/api/v2/votacoes?idOrgao=180&ordem=DESC&ordenarPor=dataHoraRegistro&itens=8",
    { guardar: 3600 },
  );
  return (Array.isArray(dados?.dados) ? dados.dados : [])
    .filter((item) => item && typeof item === "object" && typeof item.id === "string" && typeof item.data === "string" && typeof item.descricao === "string")
    .map((item) => {
      const evento = /\/eventos\/(\d+)$/.exec(item.uriEvento ?? "")?.[1];
      return {
        id: item.id!,
        data: item.data!,
        descricao: item.descricao!.slice(0, 400),
        aprovada: item.aprovacao === 1 ? true : item.aprovacao === 0 ? false : null,
        link: evento ? `https://www.camara.leg.br/evento-legislativo/${evento}` : "https://www.camara.leg.br/busca-portal/votacoes",
      };
    });
}

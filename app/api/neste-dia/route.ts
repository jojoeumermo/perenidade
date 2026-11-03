// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Neste dia": fatos de luta do povo para a data de hoje (horário de Brasília), no idioma da página. Primeiro as datas
// escolhidas pela equipe (content/neste-dia.json, em português); depois, entre tudo o que a Wikipédia lista para o
// dia, os fatos de greve, revolução, independência, direitos e resistência (lib/neste-dia.ts). Texto da Wikipédia,
// licença CC BY-SA: a página mostra a fonte e o link de cada fato. Se a data tiver menos de três fatos, entram os dos
// dias mais próximos do mesmo mês, cada um com a sua data (campo "dia").
import curadoria from "@/content/neste-dia.json";
import { buscarJson, responder } from "@/lib/externo";
import { diasVizinhos, escolherFatos, juntarComVizinhos, type Feed, type FatoDoDia } from "@/lib/neste-dia";

const idiomas: Record<string, string> = { pt: "pt", en: "en", es: "es", ru: "ru", zh: "zh", fr: "fr" };
const QUANTOS = 3;
const dois = (n: number) => String(n).padStart(2, "0");

/** Os fatos de luta de um dia (mês e dia com dois dígitos): a lista da equipe (só em português) e a Wikipédia. */
async function fatosDoDia(lingua: string, mes: string, dia: string): Promise<{ feed: Feed | null; fatos: FatoDoDia[]; curados: FatoDoDia[] }> {
  const feed = await buscarJson<Feed>(`https://api.wikimedia.org/feed/v1/wikipedia/${lingua}/onthisday/all/${mes}/${dia}`, { guardar: 3600 });
  const curados: FatoDoDia[] = lingua === "pt" ? curadoria.fatos.filter((fato) => fato.dia === `${mes}-${dia}`).map(({ ano, texto, link }) => ({ ano, texto, link })) : [];
  return { feed, curados, fatos: escolherFatos(feed, lingua, curados, QUANTOS) };
}

export async function GET(pedido: Request) {
  const lingua = idiomas[new URL(pedido.url).searchParams.get("lang") ?? ""] ?? "pt";
  const [dia, mes, ano] = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date()).split("/");
  const hoje = await fatosDoDia(lingua, mes, dia);
  // Menos de três fatos de luta na data: completa com os dias mais próximos do mesmo mês, dois de cada vez (o dia de
  // antes e o de depois), cada fato com a sua data. Se ainda faltar, entram os fatos de hoje com nota mais baixa.
  const vizinhos: { dia: string; fatos: FatoDoDia[] }[] = [];
  let soma = hoje.fatos.length;
  // Wikipédia fora do ar (o feed de hoje não veio, ou uma rodada inteira sem resposta): não insiste nos outros dias,
  // senão cada rodada espera o prazo de 8 s da busca e a rota passa do tempo.
  const fila = hoje.feed ? diasVizinhos(Number(dia), Number(mes), Number(ano)) : [];
  for (let i = 0; soma < QUANTOS && i < fila.length; i += 2) {
    const rodada = await Promise.all(
      fila.slice(i, i + 2).map(async (outro) => {
        const resultado = await fatosDoDia(lingua, mes, dois(outro));
        return { dia: `${dois(outro)}/${mes}`, fatos: resultado.fatos, veio: resultado.feed !== null };
      }),
    );
    for (const item of rodada) {
      vizinhos.push({ dia: item.dia, fatos: item.fatos });
      soma += item.fatos.length;
    }
    if (!rodada.some((item) => item.veio)) break;
  }
  let fatos = juntarComVizinhos(hoje.fatos, vizinhos, QUANTOS);
  // Ainda faltando: os fatos de hoje com nota mais baixa entram depois dos de outros dias (que têm nota boa), sem data.
  if (fatos.length < QUANTOS) fatos = juntarComVizinhos(hoje.fatos, [...vizinhos, { dia: "", fatos: escolherFatos(hoje.feed, lingua, hoje.curados, QUANTOS * 2, 1) }], QUANTOS);
  return responder({ dia: `${dia}/${mes}`, fatos, fonte: `https://${lingua}.wikipedia.org/`, licenca: "CC BY-SA 4.0" }, fatos.length ? 3600 : 300);
}

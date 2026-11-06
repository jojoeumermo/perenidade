// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/Link";
import { FichaDoCaso } from "@/components/vale-o-escrito/Fichas";
import { localePath } from "@/i18n/config";
import { loadLang } from "@/i18n";
import { withLangs } from "@/lib/params";
import { paginaMeta } from "@/lib/seo";
import { dadosDoObservatorio } from "@/lib/vale-o-escrito/consulta";
import { lerTudo } from "@/lib/vale-o-escrito/dados";
import { textosDoObservatorio } from "@/lib/vale-o-escrito/textos";
import { acharEntrada, indicesDeArquivo, listaComE, veiculosDaEntrada } from "@/lib/vale-o-escrito/visual";

// Casos novos entram sem novo deploy quando o job de exportação atualiza os arquivos; o que não existe dá 404.
export const dynamicParams = true;

export function generateStaticParams() {
  return withLangs(lerTudo().flatMap((d) => d.entradas.map((e) => ({ id: e.id }))));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string; id: string }> }): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { id } = await params;
  const entrada = acharEntrada(dadosDoObservatorio(lang), id);
  if (!entrada) return {};
  const s = textosDoObservatorio(lang);
  // Descrição com a situação jurídica e a fonte ("segundo [veículo]") sempre à vista, antes do resumo.
  const quem = `${s.situacao[entrada.situacao]}. ${s.visual.ficha.segundo.replace("{veiculos}", listaComE(veiculosDaEntrada(entrada)))}.`;
  return paginaMeta(lang, `/vale-o-escrito/caso/${entrada.id}`, `${entrada.titulo} · ${s.meta.titulo.split(":")[0]}`, `${quem} ${entrada.resumo}`.slice(0, 200));
}

/** A ficha de um caso, numa página própria (link que se compartilha): situação jurídica, resumo com "segundo [fonte]", fontes numeradas e os dois pedidos. */
export default async function CasoPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang } = await loadLang(params);
  const { id } = await params;
  const dados = dadosDoObservatorio(lang);
  const entrada = acharEntrada(dados, id);
  if (!entrada) notFound();
  const s = textosDoObservatorio(lang);
  return (
    <div className="ve-folha">
      <div className="ve-pagina">
        <Link className="ve-pagina-voltar" href={localePath(lang, "/vale-o-escrito")}>
          ← {s.visual.ficha.voltar}
        </Link>
        <FichaDoCaso entrada={entrada} dados={dados} s={s} lang={lang} indice={indicesDeArquivo(dados.entradas).get(entrada.id) ?? 0} nivelDoTitulo={1} />
      </div>
    </div>
  );
}

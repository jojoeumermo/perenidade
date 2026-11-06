// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/Link";
import { FichaDeAgente } from "@/components/vale-o-escrito/Fichas";
import { localePath } from "@/i18n/config";
import { loadLang } from "@/i18n";
import { withLangs } from "@/lib/params";
import { paginaMeta } from "@/lib/seo";
import { dadosDoObservatorio } from "@/lib/vale-o-escrito/consulta";
import { lerTudo } from "@/lib/vale-o-escrito/dados";
import { textosDoObservatorio } from "@/lib/vale-o-escrito/textos";
import { acharOrganizacao, casosDaOrganizacao, listaComE, veiculosDaEntrada } from "@/lib/vale-o-escrito/visual";

export const dynamicParams = true;

export function generateStaticParams() {
  const ids = new Set(lerTudo().flatMap((d) => d.organizacoes.map((o) => o.id)));
  return withLangs([...ids].map((id) => ({ id })));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string; id: string }> }): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { id } = await params;
  const dados = dadosDoObservatorio(lang);
  const org = acharOrganizacao(dados, id);
  if (!org) return {};
  const s = textosDoObservatorio(lang);
  const frase = casosDaOrganizacao(dados, id)
    .map((e) => `${e.titulo}: ${s.visual.ficha.segundo.replace("{veiculos}", listaComE(veiculosDaEntrada(e)))}`)
    .join("; ");
  return paginaMeta(lang, `/vale-o-escrito/organizacao/${org.id}`, `${org.nome} · ${s.meta.titulo.split(":")[0]}`, frase.slice(0, 200) || s.meta.descricao);
}

export default async function OrganizacaoPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang } = await loadLang(params);
  const { id } = await params;
  const dados = dadosDoObservatorio(lang);
  const org = acharOrganizacao(dados, id);
  if (!org || casosDaOrganizacao(dados, id).length === 0) notFound();
  const s = textosDoObservatorio(lang);
  return (
    <div className="ve-folha">
      <div className="ve-pagina">
        <Link className="ve-pagina-voltar" href={localePath(lang, "/vale-o-escrito")}>
          ← {s.visual.ficha.voltar}
        </Link>
        <FichaDeAgente tipo="organizacao" agente={org} dados={dados} s={s} lang={lang} nivelDoTitulo={1} />
      </div>
    </div>
  );
}

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
import { acharPessoa, casosDaPessoa, listaComE, veiculosDaEntrada } from "@/lib/vale-o-escrito/visual";

// Os casos aprovados no banco entram sem novo deploy: a página é refeita a cada 5 minutos (lib/vale-o-escrito/banco.ts).
export const revalidate = 300;

// Pessoa pública no caso (marca publicaNoCaso, com fonte): só existe aqui quem passou em regras.ts. Nunca vítima, criança nem testemunha.
export const dynamicParams = true;

export function generateStaticParams() {
  const ids = new Set(lerTudo().flatMap((d) => d.pessoas.map((p) => p.id)));
  return withLangs([...ids].map((id) => ({ id })));
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string; id: string }> }): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { id } = await params;
  const dados = await dadosDoObservatorio(lang);
  const pessoa = acharPessoa(dados, id);
  if (!pessoa) return {};
  const s = textosDoObservatorio(lang);
  const casos = casosDaPessoa(dados, id);
  // Sempre a situação jurídica e a fonte juntas ao nome: nome sozinho, sem "segundo [fonte]", não sai.
  const frase = casos
    .map((c) => `${s.situacao[c.situacao]} (${s.visual.ficha.segundo.replace("{veiculos}", listaComE(veiculosDaEntrada(c.entrada)))})`)
    .join("; ");
  return paginaMeta(lang, `/vale-o-escrito/pessoa/${pessoa.id}`, `${pessoa.nome} · ${s.meta.titulo.split(":")[0]}`, frase.slice(0, 200) || s.meta.descricao);
}

export default async function PessoaPage({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang } = await loadLang(params);
  const { id } = await params;
  const dados = await dadosDoObservatorio(lang);
  const pessoa = acharPessoa(dados, id);
  // Pessoa sem nenhum caso publicado não tem página: o nome só aparece ligado a um caso com fonte.
  if (!pessoa || casosDaPessoa(dados, id).length === 0) notFound();
  const s = textosDoObservatorio(lang);
  return (
    <div className="ve-folha">
      <div className="ve-pagina">
        <Link className="ve-pagina-voltar" href={localePath(lang, "/vale-o-escrito")}>
          ← {s.visual.ficha.voltar}
        </Link>
        <FichaDeAgente tipo="pessoa" agente={pessoa} dados={dados} s={s} lang={lang} nivelDoTitulo={1} />
      </div>
    </div>
  );
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/components/Link";
import { CabecaDoVale } from "@/components/vale-o-escrito/Cabeca";
import { FormularioCorrecao } from "@/components/vale-o-escrito/FormularioCorrecao";
import { localePath } from "@/i18n/config";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { CODIGO_DE_FICHA } from "@/lib/vale-o-escrito/formularios";
import { textosDoObservatorio } from "@/lib/vale-o-escrito/textos";
import { TIPOS_DE_CORRECAO, type TipoDeCorrecao } from "@/lib/vale-o-escrito/tipos";

type Props = { params: Promise<{ lang: string; id: string }>; searchParams?: Promise<{ tipo?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDoObservatorio(lang);
  return paginaMeta(lang, "/vale-o-escrito/correcao", s.correcao.titulo, s.correcao.lead);
}

/**
 * Correção e direito de resposta de UMA ficha (o link "Pedir correção ou direito de resposta" de cada ficha aponta para
 * cá). O código da ficha vem do endereço e fica preenchido. Não lê disco: a conferência de que a ficha existe é do banco
 * e da curadoria, para o pedido valer mesmo para uma ficha ainda não exportada para os arquivos.
 */
export default async function CorrecaoDaFicha({ params, searchParams }: Props) {
  const { lang } = await loadLang(params);
  const { id } = await params;
  const ficha = decodeURIComponent(id).toLowerCase();
  if (!CODIGO_DE_FICHA.test(ficha)) notFound();
  const pedido = (await searchParams)?.tipo;
  const tipoInicial = (TIPOS_DE_CORRECAO as readonly string[]).includes(pedido ?? "") ? (pedido as TipoDeCorrecao) : undefined;
  const s = textosDoObservatorio(lang);
  return (
    <div className="ve-pagina ve-doc">
      <CabecaDoVale olho={s.entrada.titulo} titulo={s.correcao.titulo} voltar={{ href: localePath(lang, "/vale-o-escrito"), texto: s.navegacao.inicio }}>
        {s.correcao.lead}
      </CabecaDoVale>
      <FormularioCorrecao s={{ correcao: s.correcao, erros: s.erros }} fichaInicial={ficha} tipoInicial={tipoInicial} />
      <p className="mt-8 font-sans text-sm">
        <Link className="underline" href={localePath(lang, "/vale-o-escrito/sobre")}>
          {s.navegacao.sobre}
        </Link>
      </p>
    </div>
  );
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { Atkinson_Hyperlegible, Bricolage_Grotesque } from "next/font/google";
import { notFound } from "next/navigation";
import { PortaDaEscola } from "@/components/escola/PortaDaEscola";
import { loadLang } from "@/i18n";
import { textosDaFormacaoBase } from "@/i18n/escola/formacao-base";
import { ligado } from "@/lib/recursos";
import "@/styles/escola-formacao.css";

// As letras das pranchas da Escola (07/11): Bricolage Grotesque nos títulos (com o eixo de largura, usado em 80) e
// Atkinson Hyperlegible no texto (Braille Institute; as duas sob a SIL Open Font License 1.1). Sem pré-carregar: o
// arquivo só vem quando a Escola mostra um texto com a família.
const titulo = Bricolage_Grotesque({ variable: "--font-escola-titulo", subsets: ["latin", "latin-ext"], axes: ["wdth", "opsz"], preload: false });
const texto = Atkinson_Hyperlegible({ variable: "--font-escola-texto", subsets: ["latin", "latin-ext"], weight: ["400", "700"], preload: false });

/**
 * A moldura de todas as páginas da Escola Revolucionária Lúcia Maria (/escola e abaixo). Desde a Escola de Formação
 * (PLANO-ESCOLA.md, F1), a porta só deixa entrar MILITANTE, conferido no banco (components/escola/PortaDaEscola.tsx):
 * o militante vê a casca escura (coluna lateral, barra de baixo no celular, modo discreto); o resto vê a porta vermelha.
 * O chamado de militantes e o manifesto continuam abertos a todos, sem a casca.
 * Desligada (recurso "escola", que só liga pelo nome), nenhuma página daqui existe.
 *
 * Os textos que vão para a porta são só de interface (públicos). Nada de militante passa pelo servidor aqui: o que é
 * só de militante vem das funções do banco, depois da sessão.
 */
export default async function EscolaLayout({ children, params }: LayoutProps<"/[lang]/escola">) {
  if (!ligado("escola")) notFound();
  const { lang } = await loadLang(params);
  const t = textosDaFormacaoBase(lang);
  return (
    <div data-escola="" className={`${titulo.variable} ${texto.variable}`}>
      <PortaDaEscola lang={lang} t={{ porta: t.porta, casca: t.casca }}>
        {children}
      </PortaDaEscola>
    </div>
  );
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import "@/styles/vale-o-escrito.css";
import type { ReactNode } from "react";
import { BotaoDeSom, type TextosDoSom } from "./BotaoDeSom";
import { FundoVivo } from "./FundoVivo";
import { NavDoVale } from "./NavDoVale";

// Enquanto o Vale o Escrito está aberto, a casca do site (faixa de avisos, cabeçalho, barra e abas do celular, rodapé, o
// "voltar ao topo" e o gesto de voltar do aplicativo) sai de cena, como na Alumia (components/rede/MolduraDaAlumia.tsx): o
// Vale é uma página independente, com a própria barra e um único botão "Voltar ao site". A saída rápida do modo seguro e
// o widget de acessibilidade continuam (não estão nesta lista). As regras ficam aqui, num <style> da própria moldura,
// porque o CSS do Vale (styles/vale-o-escrito.css) só tem seletores com escopo ".ve".
// O "Pular para o conteúdo" do site (o link para #conteudo, do layout raiz) também sai: a moldura tem o seu, que pula a
// barra do Vale; com os dois, o teclado ouviria o mesmo texto duas vezes seguidas. Valor sem aspas (com o "#" escapado),
// para nada no <style> depender de como o React escapa aspas no texto.
const SEM_O_SITE = [".cabecalho-site", ".faixa-de-avisos", ".fio-das-fitas", ".festa", ".barra-do-celular", ".abas-do-celular", ".rodape-do-site", ".voltar-ao-topo", ".app-gesto-voltar", "a[href=\\#conteudo]"]
  .map((seletor) => `body:has(.ve-moldura) ${seletor}`)
  .join(", ");
const ESTILO = [
  `${SEM_O_SITE} { display: none !important; }`,
  // Fundo preto até na rolagem elástica do celular, e sem o recuo que o aplicativo deixa para as abas (que saíram).
  "html:has(.ve-moldura), body:has(.ve-moldura) { background: #070707 !important; color-scheme: dark; }",
  "body:has(.ve-moldura) { --altura-topo: 0px; }",
  "body:has(.ve-moldura) main#conteudo { padding-bottom: 0 !important; }",
].join("\n");

export interface TextosDaMoldura {
  voltarAoSite: string;
  voltarAoSiteAria: string;
  pularParaConteudo: string;
  sobretitulo: string;
  menu: string;
  som: TextosDoSom;
  nav: { href: string; texto: string }[];
}

/**
 * A moldura de todas as rotas do Vale o Escrito (app/[lang]/vale-o-escrito/layout.tsx): tela cheia preta, a rede viva ao
 * fundo, a barra própria (marca, navegação do Vale, som) e o botão fixo "Voltar ao site". Componente de servidor, sem
 * leitura de disco: recebe os textos de um idioma e as classes das letras (lib/vale-o-escrito/fontes.ts).
 */
export function MolduraDoVale({ lang, s, classesDasLetras, children }: { lang: string; s: TextosDaMoldura; classesDasLetras: string; children: ReactNode }) {
  const site = `/${lang}`;
  return (
    <div className={`ve ve-moldura ${classesDasLetras}`} data-vale-o-escrito="">
      <style>{ESTILO}</style>
      <a className="ve-pular" href="#ve-conteudo">
        {s.pularParaConteudo}
      </a>
      <FundoVivo />
      <header className="ve-barra">
        <a className="ve-voltar-ao-site" href={site} aria-label={s.voltarAoSiteAria}>
          <span aria-hidden="true">←</span>
          <span>{s.voltarAoSite}</span>
        </a>
        <a className="ve-logo" href={s.nav[0]?.href ?? site}>
          {/* O sinal do Vale: três nós e duas ligações, desenho próprio. */}
          <svg className="ve-logo-sinal" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 18 L12 6 L19 15" />
            <circle cx="5" cy="18" r="2.4" />
            <circle cx="12" cy="6" r="2.4" />
            <circle cx="19" cy="15" r="2.4" />
          </svg>
          <span className="ve-logo-texto">
            Vale o Escrito<b aria-hidden="true">_</b>
          </span>
          <span className="ve-logo-sub" aria-hidden="true">
            {s.sobretitulo}
          </span>
        </a>
        <NavDoVale rotulo={s.menu} itens={s.nav.map((n, i) => ({ ...n, n: String(i + 1).padStart(2, "0") }))} />
        <BotaoDeSom s={s.som} />
      </header>
      <div id="ve-conteudo" className="ve-conteudo" tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}

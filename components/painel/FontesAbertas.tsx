// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { getClient } from "@/lib/backend";
import { ArrowUpRight, Library, Search } from "lucide-react";
import { Botao, Campo, Faixa, ItemDeLista, Lista, Selecao, Vazio } from "./ui";

interface Achado {
  fonte: string;
  titulo: string;
  detalhe: string;
  licenca: string;
  link: string;
}

type Tipo = "obras" | "verbetes" | "estudos";

/** Bibliotecas e catálogos abertos para consultar direto no site deles (não têm busca que o painel possa usar). */
const atalhos: { nome: string; sobre: string; link: (busca: string) => string }[] = [
  { nome: "Domínio Público (MEC)", sobre: "obras em domínio público ou cedidas pelos autores", link: () => "https://www.dominiopublico.gov.br/pesquisa/PesquisaObraForm.jsp" },
  { nome: "Arquivo Marxista na Internet", sobre: "clássicos do marxismo em português", link: () => "https://www.marxists.org/portugues/index.htm" },
  { nome: "SciELO", sobre: "revistas científicas abertas da América Latina", link: (busca) => `https://search.scielo.org/?q=${encodeURIComponent(busca)}&lang=pt` },
  { nome: "BNDigital", sobre: "Biblioteca Nacional: jornais, livros, mapas e imagens antigas", link: () => "https://bndigital.bn.gov.br/" },
  { nome: "Brasiliana Guita e José Mindlin (USP)", sobre: "livros raros brasileiros digitalizados", link: () => "https://digital.bbm.usp.br/" },
  { nome: "OpenStax", sobre: "livros didáticos abertos (em inglês)", link: () => "https://openstax.org/subjects" },
  { nome: "Anna's Archive", sobre: "catálogo de bibliotecas digitais; para achar edições, autores e referências. Indique nas fontes só o que for livre ou em domínio público", link: (busca) => `https://annas-archive.org/search?q=${encodeURIComponent(busca)}` },
];

/**
 * Pesquisa em acervos e enciclopédias abertos para quem escreve fichas, verbetes, aulas e linhas do tempo: Internet
 * Archive, Open Library, Project Gutenberg e MEC Livros (obras); Wikipédia, Wikidata, Wikisource, Commons e
 * Wikcionário (verbetes, datas, imagens e palavras); OpenAlex, Crossref e Wikilivros (estudos e livros didáticos
 * abertos). O resultado é ponto de partida: quem escreve confere na fonte, cita e envia pela fila.
 */
export function FontesAbertas() {
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<Tipo>("obras");
  const [achados, setAchados] = useState<Achado[] | null>(null);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function pesquisar() {
    if (busca.trim().length < 3) return;
    setOcupado(true);
    setAviso("");
    try {
      // A pesquisa é só da equipe: vai com o token da sessão, que o servidor confere no banco.
      const { data } = await (await getClient()).auth.getSession();
      const token = data.session?.access_token;
      const resposta = await fetch(`/api/fontes?tipo=${tipo}&q=${encodeURIComponent(busca.trim())}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (resposta.status === 401) {
        setAchados(null);
        setAviso("A pesquisa nas fontes abertas é só para quem tem função no painel. Saia e entre de novo se acabou de receber a função.");
        return;
      }
      const dados = await resposta.json();
      setAchados(dados.achados ?? []);
      if (!dados.achados?.length) setAviso("Nada encontrado nessas fontes. Tente outras palavras, ou o nome original da obra.");
    } catch {
      setAviso("As fontes não responderam agora. Tente de novo em instantes.");
    } finally {
      setOcupado(false);
    }
  }

  const grupos = [...new Set((achados ?? []).map((achado) => achado.fonte))];
  return (
    <div className="pn-tela">
      <p className="pn-sobre" style={{ marginTop: 0 }}>
        Para preencher fichas do acervo, verbetes do glossário e datas da linha do tempo com fonte à vista. Nada daqui vai ao ar sozinho: abra o link, confira a licença e os dados na própria
        fonte, e cite-a ao escrever. Obra com direitos de autor entra só como ficha de referência; no Brasil, o domínio público vale 70 anos depois da morte do autor.
      </p>
      <form
        className="pn-cartao flex flex-wrap items-end gap-3"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          void pesquisar();
        }}
      >
        <div className="min-w-60 flex-1">
          <Campo rotulo="O que procurar" simbolo={Search} value={busca} onChange={(e) => setBusca(e.target.value)} maxLength={100} placeholder="Ex.: Manifesto Comunista, Rosa Luxemburgo, mais-valia" />
        </div>
        <div className="min-w-0 max-w-full">
          <Selecao rotulo="Onde" value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
            <option value="obras">Obras (Internet Archive, Open Library, Gutenberg, MEC Livros)</option>
            <option value="verbetes">Verbetes, datas e palavras (Wikipédia, Wikidata, Wikisource, Commons, Wikcionário)</option>
            <option value="estudos">Estudos e didáticos abertos (artigos e livros acadêmicos, Wikilivros)</option>
          </Selecao>
        </div>
        <Botao type="submit" variante="principal" simbolo={Search} carregando={ocupado} disabled={ocupado || busca.trim().length < 3}>
          {ocupado ? "Pesquisando…" : "Pesquisar"}
        </Botao>
      </form>
      {aviso && achados?.length !== 0 && <Faixa tom="aviso">{aviso}</Faixa>}
      <details className="pn-cartao max-w-3xl">
        <summary className="cursor-pointer font-semibold">Outras bibliotecas abertas, para procurar direto no site delas</summary>
        <ul className="mt-2 space-y-1">
          {atalhos.map((atalho) => (
            <li key={atalho.nome}>
              <a href={atalho.link(busca.trim())} target="_blank" rel="noopener noreferrer nofollow" className="pn-elo inline-flex items-center gap-1">
                {atalho.nome}
                <ArrowUpRight aria-hidden width={13} height={13} />
              </a>
              <span className="text-ink-soft">: {atalho.sobre}</span>
            </li>
          ))}
        </ul>
        <p className="pn-ajuda mt-2">Obra do MEC Livros com direitos entra no acervo só como ficha, com o link para o empréstimo (conta gov.br).</p>
      </details>
      {achados?.length === 0 && aviso && <Vazio simbolo={Library} titulo={aviso} />}
      {grupos.map((fonte) => (
        <section key={fonte} className="pn-secao">
          <h3 className="pn-rotulo-mono">{fonte}</h3>
          <Lista rotulo={fonte}>
            {achados!
              .filter((achado) => achado.fonte === fonte)
              .map((achado) => (
                <ItemDeLista
                  key={achado.link}
                  titulo={
                    <a href={achado.link} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-oxblood">
                      {achado.titulo}
                    </a>
                  }
                  meta={
                    <>
                      {achado.detalhe && <>{achado.detalhe} · </>}
                      Licença: {achado.licenca}
                    </>
                  }
                />
              ))}
          </Lista>
        </section>
      ))}
    </div>
  );
}
// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { Aviso, botao, campo, rotulo } from "./comum";

interface Achado {
  fonte: string;
  titulo: string;
  detalhe: string;
  licenca: string;
  link: string;
}

/**
 * Pesquisa em acervos e enciclopédias abertos para quem escreve fichas, verbetes e linhas do tempo: Internet
 * Archive, Open Library e Project Gutenberg (obras); Wikipédia, Wikidata, Wikisource e Commons (verbetes,
 * datas e imagens). O resultado é ponto de partida: quem escreve confere na fonte, cita e envia pela fila.
 */
export function FontesAbertas() {
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<"obras" | "verbetes">("obras");
  const [achados, setAchados] = useState<Achado[] | null>(null);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  async function pesquisar() {
    if (busca.trim().length < 3) return;
    setOcupado(true);
    setAviso("");
    try {
      const dados = await (await fetch(`/api/fontes?tipo=${tipo}&q=${encodeURIComponent(busca.trim())}`)).json();
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
    <div>
      <p className="max-w-3xl text-ink-soft">
        Para preencher fichas do acervo, verbetes do glossário e datas da linha do tempo com fonte à vista. Nada daqui vai ao ar sozinho: abra o link, confira a licença e os dados na própria
        fonte, e cite-a ao escrever. Obra com direitos de autor entra só como ficha de referência; no Brasil, o domínio público vale 70 anos depois da morte do autor.
      </p>
      <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void pesquisar(); }}>
        <label className="block min-w-60 flex-1">
          O que procurar
          <input value={busca} onChange={(e) => setBusca(e.target.value)} maxLength={100} placeholder="Ex.: Manifesto Comunista, Rosa Luxemburgo, mais-valia" className={campo} />
        </label>
        <label className="block">
          Onde
          <select value={tipo} onChange={(e) => setTipo(e.target.value as "obras" | "verbetes")} className={campo}>
            <option value="obras">Obras (Internet Archive, Open Library, Gutenberg)</option>
            <option value="verbetes">Verbetes e datas (Wikipédia, Wikidata, Wikisource, Commons)</option>
          </select>
        </label>
        <button type="submit" className={botao} disabled={ocupado || busca.trim().length < 3}>{ocupado ? "Pesquisando…" : "Pesquisar"}</button>
      </form>
      <Aviso texto={aviso} />
      {grupos.map((fonte) => (
        <section key={fonte} className="mt-5">
          <h3 className={rotulo}>{fonte}</h3>
          <ul className="mt-2 divide-y divide-rule border-y border-rule">
            {achados!
              .filter((achado) => achado.fonte === fonte)
              .map((achado) => (
                <li key={achado.link} className="py-2">
                  <a href={achado.link} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold underline hover:text-oxblood">{achado.titulo}</a>
                  {achado.detalhe && <span className="block text-ink-soft">{achado.detalhe}</span>}
                  <span className="block text-xs text-ink-soft">Licença: {achado.licenca}</span>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

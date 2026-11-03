// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { SaveOffline } from "@/components/Offline";
import type { Dict } from "@/i18n/types";
import type { TextosDaLeveza } from "@/i18n/escola/leveza";
import { formatarTamanho, preencherTexto as preencher } from "@/lib/escola/leveza";

/** "Levar esta aula": texto puro, EPUB da trilha, trilha guardada para ler sem internet e os endereços do espelho. */
export function LevarEstaAula({
  s,
  lang,
  textoBytes,
  caminhos,
  paginasDaTrilha,
  trilhas,
  espelhos,
}: {
  s: TextosDaLeveza["levar"];
  lang: string;
  textoBytes: number;
  caminhos: { texto: string; epub: string };
  paginasDaTrilha: string[];
  trilhas: Dict["tracks"];
  espelhos: string[];
}) {
  return (
    <div className="lev-levar">
      <h3 className="lev-subtitulo">{s.titulo}</h3>
      <ul className="lev-lista">
        <li>
          <a href={caminhos.texto} download className="lev-link">
            {preencher(s.texto, { tamanho: formatarTamanho(textoBytes, lang) })}
          </a>
        </li>
        <li>
          <a href={caminhos.epub} download className="lev-link">
            {s.livro}
          </a>
          <span className="lev-nota"> · {s.livroDica}</span>
        </li>
        <li>
          <SaveOffline paths={paginasDaTrilha} s={trilhas} />
        </li>
      </ul>
      {espelhos.length > 0 && (
        <div className="lev-espelho">
          <h3 className="lev-subtitulo">{s.espelhoTitulo}</h3>
          <ul className="lev-lista">
            {espelhos.map((url) => (
              <li key={url}>
                <a href={url} rel="noopener" className="lev-link">
                  {url.replace(/^https:\/\//, "").replace(/\/$/, "")}
                </a>
              </li>
            ))}
          </ul>
          <p className="lev-nota">{s.espelhoDica}</p>
        </div>
      )}
    </div>
  );
}

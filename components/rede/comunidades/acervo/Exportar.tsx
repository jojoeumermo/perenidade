// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { preencher } from "@/lib/rede/preencher";
import { baixarArquivo, exportarComunidade } from "./cliente";
import { exportacaoEmHtml } from "./regras";
import { erroDoAcervo, type TextosDoAcervo } from "./textos";

/**
 * Exportar a comunidade (L2-55), só para a moderação dela: regras, wiki, coleções e os posts públicos, em JSON (para levar a outro
 * lugar) ou HTML (para ler e guardar). O banco monta as páginas; o arquivo nasce no aparelho de quem pediu. De pessoa, só o
 * codinome de quem escreveu cada post.
 */
export function Exportar({ slug, lang, t }: { slug: string; lang: string; t: TextosDoAcervo }) {
  const [estado, setEstado] = useState<{ fase: "parado" } | { fase: "montando"; n: number } | { fase: "pronto"; n: number; fechada: boolean } | { fase: "erro"; texto: string }>({ fase: "parado" });

  async function exportar(formato: "json" | "html") {
    setEstado({ fase: "montando", n: 0 });
    try {
      const e = await exportarComunidade(slug, (n) => setEstado({ fase: "montando", n }));
      const dia = new Date().toISOString().slice(0, 10);
      if (formato === "json") baixarArquivo(`${slug}-${dia}.json`, JSON.stringify(e, null, 2), "application/json");
      else {
        const x = t.exportar;
        const html = exportacaoEmHtml(e, { titulo: x.arquivoTitulo, exportadoEm: x.exportadoEm, regra: x.arquivoRegra, regras: x.regras, wiki: x.wiki, colecoes: x.colecoes, posts: x.posts, semPosts: x.semPosts, respostaA: x.respostaA }, lang);
        baixarArquivo(`${slug}-${dia}.html`, html, "text/html");
      }
      setEstado({ fase: "pronto", n: e.posts.length, fechada: e.comunidade.tipo === "fechada" });
    } catch (falha) {
      setEstado({ fase: "erro", texto: erroDoAcervo(t, falha) });
    }
  }

  const ocupado = estado.fase === "montando";
  return (
    <section aria-labelledby="acv-exportar" aria-busy={ocupado}>
      <h2 id="acv-exportar" className="acv-cond" style={{ fontSize: "2rem" }}>{t.exportar.titulo}</h2>
      <p className="acv-intro">{t.exportar.intro}</p>
      <p className="acv-regra">{t.exportar.regra}</p>
      <div className="acv-botoes">
        <button type="button" className="acv-botao" data-cheio="" disabled={ocupado} onClick={() => void exportar("html")}>{t.exportar.html}</button>
        <button type="button" className="acv-botao" disabled={ocupado} onClick={() => void exportar("json")}>{t.exportar.json}</button>
      </div>
      <p className="acv-regra">{t.exportar.registro}</p>
      <div role="status">
        {estado.fase === "montando" && <p className="acv-aviso">{preencher(t.exportar.montando, { n: estado.n.toLocaleString(lang) })}</p>}
        {estado.fase === "pronto" && (
          <p className="acv-aviso">
            {preencher(t.exportar.pronto, { n: estado.n.toLocaleString(lang) })}
            {estado.fechada && <> {t.exportar.fechada}</>}
          </p>
        )}
      </div>
      {estado.fase === "erro" && <p role="alert" className="acv-aviso">{estado.texto}</p>}
    </section>
  );
}

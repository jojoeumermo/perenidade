// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Item 72: a estante de fontes com citação pronta (ABNT), só neste aparelho (lib/rede/descoberta-estudo/fontes.ts).
import { useEffect, useId, useState } from "react";
import { confirmar } from "@/components/perguntar";
import type { TipoDeReferencia } from "@/lib/ferramentas/rodada";
import { citacao, emOrdem, guardarFonte, lerFontes, partesDaReferencia, referenciaHtml, referenciaTexto, tirarFonte, TIPOS_DE_FONTE, type Fonte } from "@/lib/rede/descoberta-estudo/fontes";
import { Botao } from "../ui/Botao";
import { Bloco, Mensagem, por, type PropsDaParte } from "./comum";

const CAMPOS: Record<TipoDeReferencia, readonly string[]> = {
  livro: ["titulo", "subtitulo", "edicao", "local", "editora", "ano"],
  artigo: ["titulo", "subtitulo", "revista", "local", "volume", "numero", "paginas", "ano", "url"],
  site: ["titulo", "subtitulo", "local", "ano", "url"],
  trabalho: ["titulo", "subtitulo", "ano", "tipoTrabalho", "curso", "instituicao", "local", "anoDefesa"],
};

export default function Fontes({ t }: PropsDaParte) {
  const id = useId();
  const k = t.fontes;
  const [lista, setLista] = useState<Fonte[] | null>(null);
  const [tipo, setTipo] = useState<TipoDeReferencia>("livro");
  const [autores, setAutores] = useState("");
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [paginas, setPaginas] = useState<Record<string, string>>({});
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);
  useEffect(() => {
    const x = window.setTimeout(() => setLista(lerFontes()), 0);
    return () => window.clearTimeout(x);
  }, []);
  const copiar = async (texto: string, html?: string) => {
    try {
      const Item = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
      if (html && Item) await navigator.clipboard.write([new Item({ "text/plain": new Blob([texto], { type: "text/plain" }), "text/html": new Blob([html], { type: "text/html" }) })]);
      else await navigator.clipboard.writeText(texto);
      setMensagem({ texto: k.copiado, erro: false });
    } catch {
      setMensagem({ texto: k.copieAMao, erro: true });
    }
  };
  const guardar = () => {
    const r = guardarFonte({ tipo, autores: autores.split(/\n|;/), campos: { titulo: "", ...campos }, ...(campos.url ? { acesso: new Date().toISOString() } : {}) });
    if (r === "titulo") return setMensagem({ texto: k.semTitulo, erro: true });
    if (r === "muitas") return setMensagem({ texto: k.muitas, erro: true });
    setLista(r);
    setCampos({});
    setAutores("");
    setMensagem({ texto: k.guardada, erro: false });
  };
  if (!lista) return <p role="status" className="de-miudo">{t.carregando}</p>;
  const ordem = emOrdem(lista);
  return (
    <div className="de-colunas">
      <Bloco titulo={k.titulo} ajuda={k.ajuda}>
        {ordem.length === 0 ? <p className="de-miudo">{k.vazia}</p> : (
          <>
            <ul className="de-lista">
              {ordem.map((f) => (
                <li key={f.id} className="de-item">
                  <p className="de-referencia">{partesDaReferencia(f).map((p, i) => (p.negrito ? <strong key={i}>{p.t}</strong> : <span key={i}>{p.t}</span>))}</p>
                  <div className="de-duas">
                    <label className="de-campo" htmlFor={`${id}-p-${f.id}`}>
                      <span>{k.pagina}</span>
                      <input id={`${id}-p-${f.id}`} className="al2-campo" value={paginas[f.id] ?? ""} maxLength={20} onChange={(e) => setPaginas({ ...paginas, [f.id]: e.target.value })} />
                    </label>
                    <p className="de-texto"><code className="de-codigo">{citacao(f, paginas[f.id] ?? "")}</code></p>
                  </div>
                  <div className="de-acoes">
                    <Botao variante="contorno" onClick={() => void copiar(citacao(f, paginas[f.id] ?? ""))}>{k.copiarCitacao}</Botao>
                    <Botao variante="contorno" onClick={() => void copiar(referenciaTexto(f), referenciaHtml(f))}>{k.copiarReferencia}</Botao>
                    <Botao variante="fantasma" onClick={async () => { if (await confirmar(k.tirarConfirmar, { perigo: true })) setLista(tirarFonte(f.id)); }}>{k.tirar}</Botao>
                  </div>
                </li>
              ))}
            </ul>
            <Botao variante="claro" onClick={() => void copiar(ordem.map(referenciaTexto).join("\n\n"), ordem.map((f) => `<p>${referenciaHtml(f)}</p>`).join(""))}>{por(k.copiarTudo, { n: ordem.length })}</Botao>
          </>
        )}
        <Mensagem mensagem={mensagem} />
      </Bloco>
      <div className="de-form">
        <h3 className="de-form-titulo">{k.nova}</h3>
        <label className="de-campo" htmlFor={`${id}-tipo`}>
          <span>{k.tipo}</span>
          <select id={`${id}-tipo`} className="al2-campo" value={tipo} onChange={(e) => { setTipo(e.target.value as TipoDeReferencia); setCampos({}); }}>
            {TIPOS_DE_FONTE.map((x) => <option key={x} value={x}>{k.tipos[x]}</option>)}
          </select>
        </label>
        <label className="de-campo" htmlFor={`${id}-autores`}>
          <span>{k.autores}</span>
          <textarea id={`${id}-autores`} className="al2-campo" value={autores} maxLength={600} rows={2} onChange={(e) => setAutores(e.target.value)} />
        </label>
        {CAMPOS[tipo].map((c) => (
          <label key={c} className="de-campo" htmlFor={`${id}-${c}`}>
            <span>{(k.campos as Record<string, string>)[c]}</span>
            <input id={`${id}-${c}`} className="al2-campo" value={campos[c] ?? ""} maxLength={400} onChange={(e) => setCampos({ ...campos, [c]: e.target.value })} />
          </label>
        ))}
        <Botao onClick={guardar}>{k.guardar}</Botao>
        <p className="de-miudo">{k.norma}</p>
        <p className="de-miudo">{k.aparelho}</p>
      </div>
    </div>
  );
}

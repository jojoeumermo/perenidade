// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Item 50: os endereços de RSS e Atom de uma comunidade aberta e de um #tema, para colar em qualquer leitor. Só sai o que já é aberto
// à internet (o banco decide); nada restrito entra. A tela só monta o endereço: não pede nada a ninguém.
import { useId, useState } from "react";
import { site } from "@/lib/site";
import { SLUG_OK } from "@/lib/rede/alcance/regras";
import { temaOk } from "@/lib/rede/descoberta-estudo/fediverso-tema";
import { enderecoDoFeed, type Letra } from "@/lib/rede/descoberta-estudo/feeds";
import { Botao } from "../ui/Botao";
import { Bloco, Mensagem, por, type PropsDaParte } from "./comum";

export default function Feeds({ t, lang }: PropsDaParte) {
  const idTipo = useId();
  const idNome = useId();
  const f = t.feeds;
  const [letra, setLetra] = useState<"t" | "c">("t");
  const [nome, setNome] = useState("");
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);
  const limpo = letra === "t" ? temaOk(nome) : SLUG_OK.test(nome.trim().toLowerCase()) ? nome.trim().toLowerCase() : null;
  const enderecos = limpo ? (["rss", "atom"] as const).map((formato) => ({ formato, url: enderecoDoFeed(site.url, formato, letra as Letra, limpo, lang) })) : [];
  const copiar = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setMensagem({ texto: f.copiado, erro: false });
    } catch {
      setMensagem({ texto: f.copieAMao, erro: true });
    }
  };
  return (
    <div className="de-colunas">
      <Bloco titulo={f.titulo} ajuda={f.ajuda}>
        <div className="de-form">
          <label className="de-campo" htmlFor={idTipo}>
            <span>{f.de}</span>
            <select id={idTipo} className="al2-campo" value={letra} onChange={(e) => setLetra(e.target.value as "t" | "c")}>
              <option value="t">{f.tema}</option>
              <option value="c">{f.comunidade}</option>
            </select>
          </label>
          <label className="de-campo" htmlFor={idNome}>
            <span>{letra === "t" ? f.qualTema : f.qualComunidade}</span>
            <input id={idNome} className="al2-campo" value={nome} maxLength={60} placeholder={letra === "t" ? "#greve" : "nome-da-comunidade"} onChange={(e) => setNome(e.target.value)} />
          </label>
          {nome && !limpo && <p className="de-erro" role="alert">{letra === "t" ? t.fediverso.temaTorto : f.slugTorto}</p>}
        </div>
        {enderecos.length > 0 && (
          <ul className="de-lista">
            {enderecos.map((e) => (
              <li key={e.formato} className="de-item">
                <strong>{e.formato === "rss" ? "RSS" : "Atom"}</strong>
                <code className="de-codigo">{e.url}</code>
                <div className="de-acoes">
                  <Botao variante="contorno" onClick={() => void copiar(e.url)}>{por(f.copiar, { formato: e.formato === "rss" ? "RSS" : "Atom" })}</Botao>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Mensagem mensagem={mensagem} />
      </Bloco>
      <div className="de-form">
        <h3 className="de-form-titulo">{f.oQueSai}</h3>
        <p className="de-miudo">{f.regra}</p>
        <p className="de-miudo">{f.semConta}</p>
      </div>
    </div>
  );
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// 65. Apoio direto a quem produz: a própria pessoa põe no perfil uma chave Pix aleatória ou um link https. Sem custódia, sem taxa e
// sem saber quem apoiou. ApoioNoPerfil mostra no perfil (encaixe abasDoPerfil), só quando a pessoa pôs; copiar a chave fica no aparelho.
import "./organizacao.css";
import { useId, useState, type FormEvent } from "react";
import { mostrarParaCopiar } from "@/components/perguntar";
import type { ContextoDoEncaixe } from "../encaixes";
import { organizacao, type ApoioDireto } from "@/lib/rede/organizacao/cliente";
import { chavePixAleatoria, linkSeguro } from "@/lib/rede/organizacao/regras";
import { Botao } from "../ui/Botao";
import type { PropsDaAbaSolta } from "./TelaDaOrganizacao";
import { fraseDoErro, useTextosDaOrganizacao } from "./textos";
import { useCarga } from "./usar";

export function AbaApoio({ t }: PropsDaAbaSolta) {
  const { dado, erro, carregando, trocar } = useCarga<ApoioDireto | null>("apoio-meu", () => organizacao.apoioMeu());
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);
  const id = useId();
  const a = t.apoio;

  async function enviar(p: { pix: string; link: string; texto?: string }) {
    try {
      const novo = await organizacao.salvarApoio(p);
      trocar(novo);
      setMensagem({ texto: novo ? a.salvo : a.tirado, erro: false });
    } catch (x) {
      setMensagem({ texto: fraseDoErro(t, x), erro: true });
    }
  }

  function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void enviar({ pix: String(f.get("pix") ?? ""), link: String(f.get("link") ?? ""), texto: String(f.get("texto") ?? "") });
  }

  return (
    <section className="or-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="or-subtitulo">{a.titulo}</h2>
      <p className="or-miudo">{a.sobre}</p>
      {mensagem && <p className={mensagem.erro ? "or-erro" : "or-ok"} role={mensagem.erro ? "alert" : "status"}>{mensagem.texto}</p>}
      {erro ? <p className="or-erro" role="alert">{fraseDoErro(t, erro)}</p> : null}
      {carregando ? <p className="or-miudo" role="status">{t.comum.carregando}</p> : (
        <form key={JSON.stringify(dado)} className="or-form" onSubmit={salvar} aria-label={a.titulo}>
          <label>{a.pix} {t.comum.opcional}<input type="text" name="pix" defaultValue={dado?.pix ?? ""} maxLength={36} autoComplete="off" spellCheck={false} placeholder="123e4567-e89b-42d3-a456-426614174000" /></label>
          <label>{a.link} {t.comum.opcional}<input type="url" name="link" defaultValue={dado?.link ?? ""} maxLength={300} placeholder="https://" /></label>
          <label>{a.texto} {t.comum.opcional}<input type="text" name="texto" defaultValue={dado?.texto ?? ""} maxLength={140} /></label>
          <div className="or-acoes">
            <Botao type="submit">{a.salvar}</Botao>
            {dado && <Botao type="button" variante="fantasma" onClick={() => void enviar({ pix: "", link: "" })}>{a.tirar}</Botao>}
          </div>
        </form>
      )}
    </section>
  );
}

/** No perfil: a chave e o link de apoio da pessoa, só quando ela pôs (nada aparece se não pôs). Nada é gravado ao abrir ou copiar. */
export function ApoioNoPerfil({ lang, situacao, handle }: ContextoDoEncaixe & { handle: string }) {
  const t = useTextosDaOrganizacao(lang);
  const logado = situacao.logado && !situacao.suspenso;
  const { dado } = useCarga<ApoioDireto | null>(logado ? `apoio-de-${handle}` : null, () => organizacao.apoioDe(handle));
  if (!t || !dado) return null;
  const pix = chavePixAleatoria(dado.pix);
  const link = linkSeguro(dado.link);
  if (!pix && !link) return null;
  return (
    <aside className="or-cartao" aria-label={t.apoio.noPerfil} style={{ marginBlock: "0.75rem" }}>
      <p className="or-etiqueta">{t.apoio.noPerfil}</p>
      {dado.texto && <p>{dado.texto}</p>}
      <div className="or-acoes">
        {pix && <Botao variante="contorno" tamanho="p" onClick={() => void mostrarParaCopiar(t.apoio.pix, pix)}>{t.apoio.copiarPix}</Botao>}
        {link && <a className="or-link" style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }} href={link} target="_blank" rel="noopener noreferrer nofollow">{t.apoio.abrirLink}</a>}
      </div>
      <p className="or-miudo">{t.apoio.semTaxa}</p>
    </aside>
  );
}

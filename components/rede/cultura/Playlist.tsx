// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Item 42: a playlist coletiva da comunidade, só links. O título e a imagem vêm da prévia que o NOSSO servidor faz
// (app/api/rede/previa, a mesma do compositor; a imagem passa pelo proxy assinado): o aparelho nunca fala com o serviço de música.
// Nada de player embutido; o link abre fora da Alumia sem levar a página de origem. Na prévia de dados de exemplo, nem a prévia do
// servidor é pedida.
import { useId, useState } from "react";
import { confirmar } from "@/components/perguntar";
import { gerarPrevia } from "@/components/rede/publicar/api";
import { PREVIA_DA_CULTURA, cultura } from "@/lib/rede/cultura/cliente";
import { imagemDaPrevia, linkDaPlaylist } from "@/lib/rede/cultura/regras";
import { preencher } from "@/lib/rede/preencher";
import { Botao } from "../ui/Botao";
import { EstadoDaAlumia } from "../ui/Estado";
import { Mensagem, fraseDoErro, useAcao, useLeitura, type PropsDaParte } from "./comum";

export default function Playlist({ t, comunidade }: PropsDaParte) {
  const campo = useId();
  const slug = comunidade ?? "";
  const leitura = useLeitura(slug ? `playlist:${slug}` : null, () => cultura.playlist(slug));
  const acao = useAcao(t, leitura.recarregar);
  const [url, setUrl] = useState("");
  const [titulo, setTitulo] = useState("");
  const [nota, setNota] = useState("");
  const [imagem, setImagem] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [semPrevia, setSemPrevia] = useState(false);
  const p = leitura.dado;

  if (leitura.erro) {
    return (
      <EstadoDaAlumia erro texto={fraseDoErro(t, leitura.erro)}>
        <Botao variante="contorno" onClick={leitura.recarregar}>{t.tentar}</Botao>
      </EstadoDaAlumia>
    );
  }
  if (!p) return <p role="status" className="cu-miudo">{t.carregando}</p>;

  const buscar = async () => {
    const link = linkDaPlaylist(url);
    if (!link) return acao.avisar(t.playlist.nova.urlRuim);
    setBuscando(true);
    setSemPrevia(false);
    const previa = PREVIA_DA_CULTURA ? null : await gerarPrevia(link.url);
    setBuscando(false);
    if (!previa) {
      setSemPrevia(true);
      setImagem(null);
      return;
    }
    if (!titulo.trim() && previa.titulo) setTitulo(previa.titulo.slice(0, 140));
    setImagem(imagemDaPrevia(previa.imagem));
  };

  const por = () => {
    const link = linkDaPlaylist(url);
    if (!link) return acao.avisar(t.playlist.nova.urlRuim);
    void acao.fazer(async () => {
      await cultura.porFaixa(slug, link.url, titulo.trim(), imagemDaPrevia(imagem), nota.trim());
      setUrl("");
      setTitulo("");
      setNota("");
      setImagem(null);
      setSemPrevia(false);
      return t.playlist.nova.feito;
    });
  };

  return (
    <div className="cu-colunas">
      <div className="cu-bloco">
        <h2 className="cu-subtitulo al-cond">{t.playlist.titulo}</h2>
        <p className="cu-miudo">{t.playlist.ajuda}</p>
        {!p.posso && <p className="cu-miudo" role="note">{t.comunidade.soLer}</p>}
        <Mensagem mensagem={acao.mensagem} />
        {p.itens.length === 0 ? (
          <p className="cu-miudo">{t.playlist.vazia}</p>
        ) : (
          <ul className="cu-lista">
            {p.itens.map((f) => (
              <li key={f.id} className="cu-item">
                {imagemDaPrevia(f.imagem) && (
                  // A imagem vem do proxy assinado do nosso servidor (o banco não aceita outra); sem texto alternativo próprio.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="cu-faixa-imagem" src={imagemDaPrevia(f.imagem) ?? ""} alt="" loading="lazy" referrerPolicy="no-referrer" />
                )}
                <strong className="cu-item-titulo">{f.titulo}</strong>
                <p className="cu-miudo">{f.dominio}</p>
                {f.nota && <p className="cu-texto">{f.nota}</p>}
                <div className="cu-acoes">
                  <a className="al-botao al-botao-contorno al-botao-p" href={f.url} target="_blank" rel="noopener noreferrer nofollow">
                    {preencher(t.playlist.abrir, { dominio: f.dominio })}
                  </a>
                  {(f.minha || p.modero) && (
                    <Botao
                      variante="fantasma"
                      tamanho="p"
                      disabled={acao.ocupado}
                      onClick={() =>
                        void acao.fazer(async () => {
                          if (!(await confirmar(t.playlist.perguntaTirar, { sim: t.playlist.tirar }))) return null;
                          await cultura.tirarFaixa(f.id);
                          return t.playlist.tirado;
                        })
                      }
                    >
                      {t.playlist.tirar}
                    </Botao>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {p.posso && (
        <form
          className="cu-form cu-lado"
          aria-labelledby={`${campo}-nova`}
          onSubmit={(e) => {
            e.preventDefault();
            por();
          }}
        >
          <h3 id={`${campo}-nova`} className="cu-form-titulo">{t.playlist.nova.titulo}</h3>
          <label className="cu-campo">
            <span>{t.playlist.nova.url}</span>
            <input
              className="al2-campo"
              type="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setImagem(null);
                setSemPrevia(false);
              }}
              inputMode="url"
              autoComplete="off"
              maxLength={500}
              required
            />
          </label>
          <Botao variante="contorno" disabled={buscando || !url.trim()} onClick={() => void buscar()}>
            {buscando ? t.playlist.nova.buscando : t.playlist.nova.buscar}
          </Botao>
          {semPrevia && <p className="cu-miudo" role="status">{t.playlist.nova.semPrevia}</p>}
          {imagem && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="cu-faixa-imagem" src={imagem} alt="" referrerPolicy="no-referrer" />
          )}
          <label className="cu-campo">
            <span>{t.playlist.nova.nome}</span>
            <input className="al2-campo" value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={140} />
          </label>
          <label className="cu-campo">
            <span>{t.playlist.nova.nota}</span>
            <input className="al2-campo" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} />
          </label>
          <Botao type="submit" disabled={acao.ocupado}>{t.playlist.nova.por}</Botao>
        </form>
      )}
    </div>
  );
}

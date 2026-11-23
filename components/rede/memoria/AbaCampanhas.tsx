// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// 115. Página de campanha: a mediação junta atos, posts, documentos, vitórias e memórias de uma luta numa linha do tempo. Post e ato
// entram só pelo código: a linha mostra o título que a mediação deu e leva ao post, que só abre para quem já pode vê-lo (o banco
// também tira da linha o que a pessoa não vê). Nenhum texto de post é copiado para cá.
import { useId, useState, type FormEvent } from "react";
import Link from "@/components/Link";
import { confirmar } from "@/components/perguntar";
import { linkOk } from "@/lib/rede/memoria/regras";
import {
  TIPOS_DO_ITEM, idDoPost, memoriaDaLuta, type ArquivoVivo, type CampanhaComLinha, type ItemDaLinha, type ListaDeCampanhas, type Mural, type TipoDoItem,
} from "@/lib/rede/memoria/cliente";
import { preencher } from "@/lib/rede/preencher";
import { Botao } from "../ui/Botao";
import { dataCurta, fraseDoErroDaMemoria, type TextosDaMemoria } from "./textos";
import { useCarga } from "./usar";

function FormDoItem({ t, campanha, aoPor }: { t: TextosDaMemoria; campanha: CampanhaComLinha; aoPor: (c: CampanhaComLinha) => void }) {
  const [tipo, setTipo] = useState<TipoDoItem>("ato");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const vit = useCarga<Mural>(tipo === "vitoria" ? `v:${campanha.comunidade}` : null, () => memoriaDaLuta.mural(campanha.comunidade));
  const mem = useCarga<ArquivoVivo>(tipo === "memoria" ? `m:${campanha.comunidade}` : null, () => memoriaDaLuta.arquivo(campanha.comunidade));

  async function por(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const titulo = String(f.get("titulo") ?? "");
    const quando = String(f.get("quando") ?? "") || undefined;
    const pedido: Parameters<typeof memoriaDaLuta.porNaCampanha>[0] = { campanha: campanha.id, tipo, titulo, quando };
    if (tipo === "post" || tipo === "ato") {
      const post = idDoPost(String(f.get("post") ?? ""));
      if (!post) return setErro(t.erros.nao_encontrado);
      pedido.post = post;
    } else if (tipo === "documento") {
      const link = String(f.get("link") ?? "").trim();
      if (!linkOk(link)) return setErro(t.erros.invalido);
      pedido.link = link;
    } else if (tipo === "vitoria") pedido.vitoria = String(f.get("vitoria") ?? "");
    else pedido.memoria = String(f.get("memoria") ?? "");
    setOcupado(true);
    try {
      aoPor(await memoriaDaLuta.porNaCampanha(pedido));
      setErro(null);
      form.reset();
      setTipo("ato");
    } catch (x) {
      setErro(fraseDoErroDaMemoria(t, x));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <form className="ml-form" onSubmit={por} aria-label={t.campanhas.por}>
      <label>{t.campanhas.tipo}
        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoDoItem)}>
          {TIPOS_DO_ITEM.map((x) => <option key={x} value={x}>{t.campanhas.tipos[x]}</option>)}
        </select>
      </label>
      <label>{t.comum.titulo}<input type="text" name="titulo" required minLength={3} maxLength={140} /></label>
      {(tipo === "post" || tipo === "ato") && (
        <label>{t.campanhas.post}<input type="text" name="post" required autoComplete="off" /><span className="ml-miudo">{t.campanhas.postAjuda}</span></label>
      )}
      {tipo === "documento" && <label>{t.campanhas.link}<input type="url" name="link" required inputMode="url" maxLength={500} placeholder="https://" /></label>}
      {tipo === "vitoria" && (vit.dado && vit.dado.vitorias.length === 0 ? <p className="ml-miudo">{t.campanhas.semVitoria}</p> : (
        <label>{t.campanhas.qualVitoria}
          <select name="vitoria" required>{(vit.dado?.vitorias ?? []).map((v) => <option key={v.id} value={v.id}>{v.titulo}</option>)}</select>
        </label>
      ))}
      {tipo === "memoria" && (mem.dado && mem.dado.memorias.length === 0 ? <p className="ml-miudo">{t.campanhas.semMemoria}</p> : (
        <label>{t.campanhas.qualMemoria}
          <select name="memoria" required>{(mem.dado?.memorias ?? []).map((m) => <option key={m.id} value={m.id}>{m.titulo}</option>)}</select>
        </label>
      ))}
      <label>{t.comum.data} {t.comum.opcional}<input type="date" name="quando" required={tipo === "documento"} /><span className="ml-miudo">{t.campanhas.dataAjuda}</span></label>
      {erro && <p className="ml-erro" role="alert">{erro}</p>}
      <div className="ml-acoes"><Botao type="submit" disabled={ocupado}>{t.campanhas.por}</Botao></div>
    </form>
  );
}

function LinhaDoTempo({ t, lang, id, aoVoltar }: { t: TextosDaMemoria; lang: string; id: string; aoVoltar: () => void }) {
  const { dado, erro, trocar } = useCarga<CampanhaComLinha>(`c:${id}`, () => memoriaDaLuta.campanha(id));
  const [falha, setFalha] = useState<string | null>(null);
  const hid = useId();

  async function fazer(acao: () => Promise<CampanhaComLinha>, pergunta: string | null) {
    if (pergunta && !(await confirmar(pergunta, { perigo: true }))) return;
    try {
      trocar(await acao());
      setFalha(null);
    } catch (x) {
      setFalha(fraseDoErroDaMemoria(t, x));
    }
  }

  const abrir = (i: ItemDaLinha) =>
    i.tipo === "post" && i.post ? <Link className="ml-link" href={`/${lang}/alumia/p/${i.post}`}>{t.campanhas.abrirItem}</Link>
      : i.tipo === "ato" && i.post ? <Link className="ml-link" href={`/${lang}/alumia/ato/${i.post}`}>{t.campanhas.abrirItem}</Link>
        : i.tipo === "documento" && i.link && linkOk(i.link) ? <a className="ml-link" href={i.link} target="_blank" rel="noopener noreferrer nofollow">{t.campanhas.abrirItem}</a>
          : null;

  return (
    <div className="ml-bloco">
      <div className="ml-acoes"><Botao variante="fantasma" tamanho="p" onClick={aoVoltar}>← {t.campanhas.voltar}</Botao></div>
      {erro ? <p className="ml-erro" role="alert">{fraseDoErroDaMemoria(t, erro)}</p> : null}
      {!dado && !erro && <p className="ml-miudo" role="status">{t.comum.carregando}</p>}
      {dado && (
        <>
          <p className="ml-etiqueta">{dado.comunidade_nome}{dado.encerrada ? ` · ${t.campanhas.encerrada}` : ""}</p>
          <h2 id={hid} className="ml-subtitulo">{dado.titulo}</h2>
          {dado.sobre && <p className="ml-chamada">{dado.sobre}</p>}
          {falha && <p className="ml-erro" role="alert">{falha}</p>}
          {dado.linha.length === 0 ? <p className="ml-miudo">{t.campanhas.linhaVazia}</p> : (
            <ol className="ml-linha" aria-label={preencher(t.campanhas.linhaRotulo, { titulo: dado.titulo })}>
              {dado.linha.map((i) => (
                <li key={i.id} data-tipo={i.tipo}>
                  <p className="ml-etiqueta">{dataCurta(lang, i.quando)} · {t.campanhas.tipos[i.tipo]}</p>
                  <strong>{i.titulo}</strong>
                  <div className="ml-acoes">
                    {abrir(i)}
                    {dado.modero && <Botao variante="fantasma" tamanho="p" onClick={() => fazer(() => memoriaDaLuta.tirarDaCampanha(i.id), preencher(t.campanhas.tirarPergunta, { titulo: i.titulo }))}>{t.comum.tirar}</Botao>}
                  </div>
                </li>
              ))}
            </ol>
          )}
          {dado.modero && !dado.encerrada && <FormDoItem t={t} campanha={dado} aoPor={trocar} />}
          {dado.modero && (
            <div className="ml-acoes">
              <Botao variante="contorno" tamanho="p" onClick={() => fazer(() => memoriaDaLuta.encerrarCampanha(dado.id, !dado.encerrada), null)}>
                {dado.encerrada ? t.campanhas.reabrir : t.campanhas.encerrar}
              </Botao>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function AbaCampanhas({ t, lang }: { t: TextosDaMemoria; lang: string }) {
  const { dado, erro, carregando, recarregar } = useCarga<ListaDeCampanhas>("campanhas", () => memoriaDaLuta.campanhas(null));
  const [aberta, setAberta] = useState<string | null>(null);
  const [criar, setCriar] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const id = useId();

  async function abrirCampanha(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setOcupado(true);
    try {
      const c = await memoriaDaLuta.abrirCampanha({ comunidade: String(f.get("comunidade") ?? ""), titulo: String(f.get("titulo") ?? ""), sobre: String(f.get("sobre") ?? "") });
      setMensagem({ texto: t.campanhas.aberta, erro: false });
      setCriar(false);
      recarregar();
      setAberta(c.id);
    } catch (x) {
      setMensagem({ texto: fraseDoErroDaMemoria(t, x), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  if (aberta) return <LinhaDoTempo t={t} lang={lang} id={aberta} aoVoltar={() => { setAberta(null); recarregar(); }} />;

  return (
    <section className="ml-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="ml-subtitulo">{t.abas.campanhas}</h2>
      <p className="ml-miudo">{t.campanhas.sobre}</p>
      {mensagem && <p className={mensagem.erro ? "ml-erro" : "ml-ok"} role={mensagem.erro ? "alert" : "status"}>{mensagem.texto}</p>}
      {erro ? <p className="ml-erro" role="alert">{fraseDoErroDaMemoria(t, erro)}</p> : null}
      {carregando && !dado ? <p className="ml-miudo" role="status">{t.comum.carregando}</p> : null}
      {dado && dado.posso_abrir.length > 0 && (
        criar ? (
          <form className="ml-form" onSubmit={abrirCampanha} aria-label={t.campanhas.abrir}>
            <label>{t.comum.comunidade}
              <select name="comunidade" required defaultValue={dado.posso_abrir[0]?.slug}>{dado.posso_abrir.map((c) => <option key={c.slug} value={c.slug}>{c.nome}</option>)}</select>
            </label>
            <label>{t.comum.titulo}<input type="text" name="titulo" required minLength={3} maxLength={120} /></label>
            <label>{t.campanhas.sobreCampo} {t.comum.opcional}<textarea name="sobre" maxLength={1000} /></label>
            <div className="ml-acoes">
              <Botao type="submit" disabled={ocupado}>{t.campanhas.abrir}</Botao>
              <Botao type="button" variante="fantasma" onClick={() => setCriar(false)}>{t.comum.cancelar}</Botao>
            </div>
          </form>
        ) : (
          <div className="ml-acoes"><Botao variante="contorno" onClick={() => setCriar(true)}>{t.campanhas.abrir}</Botao></div>
        )
      )}
      {dado && dado.campanhas.length === 0 && <p className="ml-miudo">{t.campanhas.vazio}</p>}
      {dado && dado.campanhas.length > 0 && (
        <ul className="ml-lista">
          {dado.campanhas.map((c) => (
            <li key={c.id} className="ml-cartao">
              <p className="ml-etiqueta">{c.comunidade_nome}{c.encerrada ? ` · ${t.campanhas.encerrada}` : ""}</p>
              <h3>{c.titulo}</h3>
              {c.sobre && <p>{c.sobre}</p>}
              <div className="ml-acoes"><Botao variante="contorno" tamanho="p" onClick={() => setAberta(c.id)}>{t.campanhas.ver}</Botao></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

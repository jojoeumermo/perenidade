// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// 44. Arquivo vivo da luta: as memórias de uma comunidade. Cada memória tem o próprio consentimento (sem ele, nada entra), passa pela
// mediação antes de aparecer e sai na hora quando alguém que aparece nela pede ("Eu apareço aqui: quero sair"), sem ficar registrado
// quem pediu. A tela não mostra quem enviou: só "sua" para a própria pessoa. Por aqui entra só texto (as fotos, com o desfoque de
// rostos do álbum do ato, ficam para depois; o banco já está pronto para elas).
import { useId, useState, type FormEvent } from "react";
import { confirmar } from "@/components/perguntar";
import { CONSENTIMENTOS, memoriaDaLuta, type ArquivoVivo, type ComunidadeMinha, type Consentimento, type Memoria } from "@/lib/rede/memoria/cliente";
import { preencher } from "@/lib/rede/preencher";
import { Botao } from "../ui/Botao";
import { dataCurta, fraseDoErroDaMemoria, type TextosDaMemoria } from "./textos";
import { useCarga } from "./usar";

export function AbaArquivo({ t, lang }: { t: TextosDaMemoria; lang: string }) {
  const minhas = useCarga<ComunidadeMinha[]>("minhas", () => memoriaDaLuta.minhas());
  const [slug, setSlug] = useState<string>("");
  const escolhida = slug || minhas.dado?.[0]?.slug || "";
  const arq = useCarga<ArquivoVivo>(escolhida ? `arquivo:${escolhida}` : null, () => memoriaDaLuta.arquivo(escolhida));
  const [abrir, setAbrir] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const id = useId();

  const falhou = (x: unknown) => setMensagem({ texto: fraseDoErroDaMemoria(t, x), erro: true });

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const consentimento = String(f.get("consentimento") ?? "") as Consentimento;
    if (!CONSENTIMENTOS.includes(consentimento)) return setMensagem({ texto: t.memoria.consentimentoAjuda, erro: true });
    setOcupado(true);
    try {
      await memoriaDaLuta.enviarMemoria({ comunidade: escolhida, titulo: String(f.get("titulo") ?? ""), texto: String(f.get("texto") ?? ""), quando: String(f.get("quando") ?? ""), consentimento });
      setMensagem({ texto: t.memoria.enviada, erro: false });
      setAbrir(false);
      arq.recarregar();
    } catch (x) {
      falhou(x);
    } finally {
      setOcupado(false);
    }
  }

  async function fazer(acao: () => Promise<unknown>, pergunta: string | null, ok: string | null, perigo = true) {
    if (pergunta && !(await confirmar(pergunta, { perigo }))) return;
    setOcupado(true);
    try {
      await acao();
      if (ok) setMensagem({ texto: ok, erro: false });
      arq.recarregar();
    } catch (x) {
      falhou(x);
    } finally {
      setOcupado(false);
    }
  }

  const estado = (m: Memoria) =>
    m.estado === "retirada" ? (m.retirada_por === "aparece" ? t.memoria.saiuAPedido : t.memoria.saiuPelaMediacao) : t.memoria.estados[m.estado];

  const cartao = (m: Memoria, fila = false) => (
    <li key={m.id} className="ml-cartao" data-estado={m.estado}>
      <p className="ml-etiqueta">{[dataCurta(lang, m.quando), t.memoria.consentimentos[m.consentimento]].filter(Boolean).join(" · ")}</p>
      <h3>{m.titulo}</h3>
      {m.texto && <p>{m.texto}</p>}
      {m.estado !== "publicada" && <p className="ml-miudo">{estado(m)}</p>}
      <div className="ml-acoes">
        {fila && m.posso_decidir && (
          <>
            <Botao tamanho="p" disabled={ocupado} onClick={() => fazer(() => memoriaDaLuta.decidirMemoria(m.id, true), null, null)}>{t.memoria.publicar}</Botao>
            <Botao variante="fantasma" tamanho="p" disabled={ocupado} onClick={() => fazer(() => memoriaDaLuta.decidirMemoria(m.id, false), preencher(t.memoria.recusarPergunta, { titulo: m.titulo }), null)}>{t.memoria.recusar}</Botao>
          </>
        )}
        {!fila && m.estado === "publicada" && (
          <Botao variante="contorno" tamanho="p" disabled={ocupado} onClick={() => fazer(() => memoriaDaLuta.sairDaMemoria(m.id, "aparece"), preencher(t.memoria.sairPergunta, { titulo: m.titulo }), t.memoria.sairFeito)}>{t.memoria.sair}</Botao>
        )}
        {!fila && m.estado === "publicada" && m.posso_decidir && (
          <Botao variante="fantasma" tamanho="p" disabled={ocupado} onClick={() => fazer(() => memoriaDaLuta.sairDaMemoria(m.id, "mediacao"), preencher(t.memoria.sairPergunta, { titulo: m.titulo }), t.memoria.sairFeito)}>{t.memoria.tirarMediacao}</Botao>
        )}
        {!fila && m.minha && (
          <Botao variante="fantasma" tamanho="p" disabled={ocupado} onClick={() => fazer(() => memoriaDaLuta.apagarMemoria(m.id), preencher(t.memoria.apagarPergunta, { titulo: m.titulo }), null)}>{t.memoria.apagar}</Botao>
        )}
      </div>
    </li>
  );

  return (
    <section className="ml-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="ml-subtitulo">{t.abas.memoria}</h2>
      <p className="ml-miudo">{t.memoria.sobre}</p>
      {minhas.erro ? <p className="ml-erro" role="alert">{fraseDoErroDaMemoria(t, minhas.erro)}</p> : null}
      {minhas.dado && minhas.dado.length === 0 && <p className="ml-miudo">{t.comum.deNenhuma}</p>}
      {minhas.dado && minhas.dado.length > 0 && (
        <div className="ml-form" style={{ borderStyle: "none", padding: 0 }}>
          <label>{t.comum.comunidade}
            <select value={escolhida} onChange={(e) => { setSlug(e.target.value); setMensagem(null); }}>
              {minhas.dado.map((c) => <option key={c.slug} value={c.slug}>{c.nome}</option>)}
            </select>
          </label>
        </div>
      )}
      {mensagem && <p className={mensagem.erro ? "ml-erro" : "ml-ok"} role={mensagem.erro ? "alert" : "status"}>{mensagem.texto}</p>}
      {arq.erro ? <p className="ml-erro" role="alert">{fraseDoErroDaMemoria(t, arq.erro)}</p> : null}
      {arq.carregando && !arq.dado ? <p className="ml-miudo" role="status">{t.comum.carregando}</p> : null}
      {arq.dado && arq.dado.posso_enviar && (
        abrir ? (
          <form className="ml-form" onSubmit={enviar} aria-label={t.memoria.enviar}>
            <label>{t.comum.titulo}<input type="text" name="titulo" required minLength={3} maxLength={120} /></label>
            <label>{t.comum.texto}<textarea name="texto" maxLength={2000} /></label>
            <label>{t.comum.data} {t.comum.opcional}<input type="date" name="quando" max={new Date().toISOString().slice(0, 10)} /></label>
            <fieldset>
              <legend>{t.memoria.consentimento}</legend>
              {CONSENTIMENTOS.map((c) => (
                <label key={c} className="ml-opcao"><input type="radio" name="consentimento" value={c} required /> {t.memoria.consentimentos[c]}</label>
              ))}
              <span className="ml-miudo">{t.memoria.consentimentoAjuda}</span>
            </fieldset>
            <div className="ml-acoes">
              <Botao type="submit" disabled={ocupado}>{t.memoria.enviar}</Botao>
              <Botao type="button" variante="fantasma" onClick={() => setAbrir(false)}>{t.comum.cancelar}</Botao>
            </div>
          </form>
        ) : (
          <div className="ml-acoes"><Botao variante="contorno" onClick={() => setAbrir(true)}>{t.memoria.enviar}</Botao></div>
        )
      )}
      {arq.dado && arq.dado.modero && (
        <div className="ml-bloco">
          <h3 className="ml-subtitulo" style={{ fontSize: "1.15rem" }}>{t.memoria.fila}</h3>
          {arq.dado.fila.length === 0 ? <p className="ml-miudo">{t.memoria.filaVazia}</p> : <ul className="ml-lista">{arq.dado.fila.map((m) => cartao(m, true))}</ul>}
        </div>
      )}
      {arq.dado && arq.dado.minhas.length > 0 && (
        <div className="ml-bloco">
          <h3 className="ml-subtitulo" style={{ fontSize: "1.15rem" }}>{t.memoria.minhas}</h3>
          <ul className="ml-lista">{arq.dado.minhas.map((m) => cartao(m))}</ul>
        </div>
      )}
      {arq.dado && (arq.dado.memorias.length === 0 ? <p className="ml-miudo">{t.memoria.vazio}</p> : <ul className="ml-lista">{arq.dado.memorias.map((m) => cartao(m))}</ul>)}
    </section>
  );
}

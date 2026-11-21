// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// "Falar com a moderação" (R1): o canal direto entre a pessoa e a mediação de UMA comunidade, que não é denúncia.
// Antes de escrever, a tela diz quem lê, sem enfeite: quem modera a comunidade e a equipe de cuidado; não é cifrado de ponta a
// ponta (fica no servidor, e quem administra o banco lê); a resposta sai como "Mediação"; encerrada, some em 90 dias. Quem
// escreve escolhe se mostra o codinome (o padrão é não mostrar). Atrás do interruptor "alumia-falar-moderacao" do painel único:
// desligado, este componente nem aparece (quem o pendura mostra o formulário de denúncia no lugar). O banco confere tudo de novo.
import { useCallback, useEffect, useId, useState } from "react";
import { clienteModmail, codigoDoModmail, LIMITE_DO_TEXTO, type ConversaComAMediacao, type ConversaInteira } from "./cliente-modmail";
import { encher, useTextosDoUso, type TextosDoUso } from "./textos";
import "./uso.css";

type T = TextosDoUso;

const dataCurta = (lang: string, iso: string) => {
  try {
    return new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : lang, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
};

const erroDe = (t: T, e: unknown) => {
  const c = codigoDoModmail(e) as keyof T["falar"]["erros"];
  return t.falar.erros[c] ?? t.falar.erros.falha;
};

/** O lado da pessoa: o aviso de quem lê, o formulário e as conversas dela com a mediação desta comunidade. */
export function FalarComAModeracao({ lang, comunidade, previa }: { lang: string; comunidade: string; previa: boolean }) {
  const t = useTextosDoUso(lang);
  const id = useId();
  const cliente = clienteModmail(previa);
  const [texto, setTexto] = useState("");
  const [comCodinome, setComCodinome] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [nota, setNota] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [lista, setLista] = useState<ConversaComAMediacao[] | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);

  const ler = useCallback(() => {
    cliente.minhas().then(
      (x) => setLista(x.filter((c) => previa || c.comunidade === comunidade)),
      () => setLista([]),
    );
  }, [cliente, comunidade, previa]);
  useEffect(() => {
    const espera = setTimeout(ler, 0);
    return () => clearTimeout(espera);
  }, [ler]);

  if (!t) return null;

  async function enviar() {
    if (!t) return;
    setOcupado(true);
    setNota(null);
    try {
      const nova = await cliente.abrir(comunidade, texto, comCodinome);
      setTexto("");
      setNota({ texto: t.falar.enviado });
      setLista((l) => [nova, ...(l ?? []).filter((x) => x.id !== nova.id)]);
    } catch (e) {
      setNota({ texto: erroDe(t, e), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  if (aberta)
    return (
      <ConversaNaTela
        lang={lang}
        t={t}
        idConversa={aberta}
        previa={previa}
        aoVoltar={() => {
          setAberta(null);
          ler();
        }}
      />
    );

  const tamanho = texto.trim().length;
  return (
    <section className="al-uso-bloco" aria-labelledby={`${id}-t`}>
      <h3 id={`${id}-t`} className="al-uso-titulo">{t.falar.titulo}</h3>
      <p className="al-uso-texto">{t.falar.chamada}</p>
      <p className="al-uso-rotulo" style={{ marginTop: "0.75rem" }}>{t.falar.quemLe}</p>
      <ul className="al-uso-lista">
        {t.falar.quemLeItens.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <p className="al-uso-miudo">{t.falar.naoUse}</p>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void enviar();
        }}
      >
        <label className="al-uso-campo">
          <span>{t.falar.rotuloTexto}</span>
          <textarea value={texto} maxLength={LIMITE_DO_TEXTO} onChange={(e) => setTexto(e.target.value)} aria-describedby={`${id}-conta`} />
        </label>
        <p id={`${id}-conta`} className="al-uso-miudo">{encher(t.falar.contador, { n: tamanho })}</p>
        <label className="al-uso-marcar">
          <input type="checkbox" checked={comCodinome} onChange={(e) => setComCodinome(e.target.checked)} />
          <span>
            {t.falar.codinome}
            <small>{t.falar.codinomeAjuda}</small>
          </span>
        </label>
        <div className="al-uso-acoes">
          <button type="submit" className="al-botao al-botao-primario al-botao-m" disabled={ocupado || tamanho === 0 || tamanho > LIMITE_DO_TEXTO} aria-busy={ocupado || undefined}>
            {ocupado ? t.falar.enviando : t.falar.enviar}
          </button>
        </div>
        {nota ? (
          <p role={nota.erro ? "alert" : "status"} className={nota.erro ? "al-uso-erro" : "al-uso-nota"}>
            {nota.texto}
          </p>
        ) : null}
      </form>
      <h4 className="al-uso-rotulo" style={{ marginTop: "1rem" }}>{t.falar.minhas}</h4>
      {lista === null ? null : lista.length === 0 ? (
        <p className="al-uso-miudo">{t.falar.nenhuma}</p>
      ) : (
        <ListaDeConversas lang={lang} t={t} lista={lista} lado="pessoa" aoAbrir={setAberta} />
      )}
    </section>
  );
}

/** A lista: cada conversa pelo número, a situação e se há resposta nova. Na mediação, o codinome só quando a pessoa mostrou. */
export function ListaDeConversas({ lang, t, lista, lado, aoAbrir }: { lang: string; t: T; lista: ConversaComAMediacao[]; lado: "pessoa" | "mediacao"; aoAbrir: (id: string) => void }) {
  return (
    <div className="al-falar-conversas">
      {lista.map((c) => (
        <button key={c.id} type="button" className="al-falar-item" onClick={() => aoAbrir(c.id)}>
          <span>
            <b>{encher(t.falar.conversaN, { n: c.numero })}</b>
            {lado === "mediacao" ? <span className="al-uso-miudo" style={{ display: "block", marginTop: 0 }}>{c.codinome ?? t.caixa.semNome}</span> : null}
            <span className="al-uso-miudo" style={{ display: "block", marginTop: 0 }}>{dataCurta(lang, c.atualizada_em)}</span>
          </span>
          <span style={{ display: "inline-flex", gap: "0.375rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {c.nova ? <span className="al-falar-etiqueta" data-tom="nova">{t.falar.nova}</span> : null}
            <span className="al-falar-etiqueta">{c.situacao === "aberta" ? t.falar.aberta : t.falar.encerrada}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

/** Uma conversa aberta (para a pessoa ou para a mediação): as mensagens, responder e encerrar. */
export function ConversaNaTela({ lang, t, idConversa, previa, aoVoltar }: { lang: string; t: T; idConversa: string; previa: boolean; aoVoltar: () => void }) {
  const cliente = clienteModmail(previa);
  const id = useId();
  const [conversa, setConversa] = useState<ConversaInteira | null>(null);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [nota, setNota] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [encerrando, setEncerrando] = useState(false);

  const ler = useCallback(() => {
    cliente.conversa(idConversa).then(setConversa, (e) => setNota({ texto: erroDe(t, e), erro: true }));
  }, [cliente, idConversa, t]);
  useEffect(() => {
    const espera = setTimeout(ler, 0);
    return () => clearTimeout(espera);
  }, [ler]);

  async function fazer(acao: () => Promise<unknown>) {
    setOcupado(true);
    setNota(null);
    try {
      await acao();
      setTexto("");
      setEncerrando(false);
      ler();
    } catch (e) {
      setNota({ texto: erroDe(t, e), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  const de = (m: ConversaInteira["mensagens"][number]) => (m.minha ? t.falar.voce : m.de === "mediacao" ? t.falar.mediacao : t.falar.pessoa);
  const tamanho = texto.trim().length;
  return (
    <section className="al-uso-bloco" aria-labelledby={`${id}-t`} aria-busy={!conversa}>
      <button type="button" className="al-uso-link" onClick={aoVoltar}>
        ← {t.falar.voltar}
      </button>
      <h3 id={`${id}-t`} className="al-uso-titulo">
        {conversa ? encher(t.falar.conversaN, { n: conversa.numero }) : t.falar.titulo}
      </h3>
      {conversa?.lado === "mediacao" ? <p className="al-uso-miudo">{conversa.codinome ?? t.caixa.semNome}</p> : null}
      {conversa ? (
        <>
          <ol className="al-falar-mensagens">
            {conversa.mensagens.map((m, i) => (
              <li key={i} className="al-falar-mensagem" data-minha={m.minha || undefined}>
                <span className="al-falar-mensagem-de">
                  {de(m)} · {dataCurta(lang, m.em)}
                </span>
                <span className="al-falar-mensagem-texto">{m.texto}</span>
              </li>
            ))}
          </ol>
          {conversa.situacao === "aberta" ? (
            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                void fazer(() => cliente.escrever(conversa.id, texto));
              }}
            >
              <label className="al-uso-campo">
                <span>{t.falar.responder}</span>
                <textarea value={texto} maxLength={LIMITE_DO_TEXTO} onChange={(e) => setTexto(e.target.value)} />
              </label>
              <div className="al-uso-acoes">
                <button type="submit" className="al-botao al-botao-primario al-botao-m" disabled={ocupado || tamanho === 0 || tamanho > LIMITE_DO_TEXTO} aria-busy={ocupado || undefined}>
                  {t.falar.responder}
                </button>
                {encerrando ? (
                  <button type="button" className="al-botao al-botao-contorno al-botao-m" disabled={ocupado} onClick={() => void fazer(() => cliente.encerrar(conversa.id))}>
                    {t.falar.encerrar}
                  </button>
                ) : (
                  <button type="button" className="al-botao al-botao-fantasma al-botao-m" onClick={() => setEncerrando(true)}>
                    {t.falar.encerrar}
                  </button>
                )}
              </div>
              {encerrando ? <p className="al-uso-miudo">{t.falar.encerrarAviso}</p> : null}
            </form>
          ) : (
            <p className="al-uso-miudo">{t.falar.encerradaNota}</p>
          )}
        </>
      ) : null}
      {nota ? (
        <p role={nota.erro ? "alert" : "status"} className={nota.erro ? "al-uso-erro" : "al-uso-nota"}>
          {nota.texto}
        </p>
      ) : null}
    </section>
  );
}

/** A caixa da mediação de uma comunidade (vai na aba Sobre, só para quem modera). Cada conversa pelo número. */
export function CaixaDaMediacao({ lang, comunidade, previa }: { lang: string; comunidade: string; previa: boolean }) {
  const t = useTextosDoUso(lang);
  const id = useId();
  const cliente = clienteModmail(previa);
  const [lista, setLista] = useState<ConversaComAMediacao[] | null>(null);
  const [erro, setErro] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);
  const ler = useCallback(() => {
    setErro("");
    cliente.caixa(comunidade).then(setLista, (e) => {
      setLista([]);
      setErro(String(codigoDoModmail(e)));
    });
  }, [cliente, comunidade]);
  useEffect(() => {
    const espera = setTimeout(ler, 0);
    return () => clearTimeout(espera);
  }, [ler]);
  if (!t) return null;
  if (aberta)
    return (
      <ConversaNaTela
        lang={lang}
        t={t}
        idConversa={aberta}
        previa={previa}
        aoVoltar={() => {
          setAberta(null);
          ler();
        }}
      />
    );
  const abertas = (lista ?? []).filter((c) => c.situacao === "aberta");
  const fechadas = (lista ?? []).filter((c) => c.situacao !== "aberta");
  return (
    <section className="al-uso-bloco" aria-labelledby={`${id}-t`} aria-busy={lista === null}>
      <h3 id={`${id}-t`} className="al-uso-titulo">{t.caixa.titulo}</h3>
      <p className="al-uso-texto">{t.caixa.explica}</p>
      <p className="al-uso-miudo">{t.falar.quemLeItens[1]}</p>
      {erro ? <p className="al-uso-erro" role="alert">{t.falar.erros[erro as keyof T["falar"]["erros"]] ?? t.falar.erros.falha}</p> : null}
      {lista && lista.length === 0 && !erro ? <p className="al-uso-miudo">{t.caixa.vazia}</p> : null}
      {abertas.length > 0 ? (
        <>
          <h4 className="al-uso-rotulo" style={{ marginTop: "0.75rem" }}>{t.caixa.abertas}</h4>
          <ListaDeConversas lang={lang} t={t} lista={abertas} lado="mediacao" aoAbrir={setAberta} />
        </>
      ) : null}
      {fechadas.length > 0 ? (
        <>
          <h4 className="al-uso-rotulo" style={{ marginTop: "0.75rem" }}>{t.caixa.anteriores}</h4>
          <ListaDeConversas lang={lang} t={t} lista={fechadas} lado="mediacao" aoAbrir={setAberta} />
        </>
      ) : null}
      <div className="al-uso-acoes">
        <button type="button" className="al-botao al-botao-contorno al-botao-m" onClick={ler}>
          {t.caixa.recarregar}
        </button>
      </div>
    </section>
  );
}

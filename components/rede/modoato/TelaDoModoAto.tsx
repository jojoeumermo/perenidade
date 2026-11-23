// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useId, useState, type FormEvent } from "react";
import Link from "@/components/Link";
import { BackendError } from "@/lib/backend";
import { ligado as recursoLigado } from "@/lib/recursos";
import { modoAto, type OrgComAssessoria, type SituacaoDoModoAto } from "@/lib/rede/modoato/cliente";
import { encher, type TextosDoModoAto } from "@/lib/rede/modoato/textos";
import { EsqueletoDosAjustes } from "../Esqueletos";
import { Icone } from "../publicar/alumia2/icones";
import type { PropsDaTelaDoPacote } from "../registro";
import { useTextosDaSeguranca } from "../seguranca/base";
import { Panico } from "../seguranca/Panico";
import { SemInternet } from "./SemInternet";
import { Botao } from "../ui/Botao";
import { Faixa } from "../ui/Faixa";
import { KitDeBolso } from "../uso/KitDeBolso";
import { daquiA, escolherAssessoria, horaCurta, trocar, useMarcaDoModoAto, useModoAto, useTextosDoModoAto } from "./usar";
import "./modoato.css";

type T = TextosDoModoAto;

/** O "Fui detido" aparece com o interruptor do site ligado; quem libera o envio é o banco (o painel). */
const DETIDO_NO_SITE = recursoLigado("alumia-fui-detido");

const codigo = (e: unknown) => (e instanceof BackendError ? e.code : "");

function textoDoErro(t: T, e: unknown): string {
  const c = codigo(e);
  if (c === "sem_servico") return t.erros.semServico;
  if (c === "desligado") return t.erros.desligado;
  if (c === "muitos_pedidos") return t.erros.muitos;
  if (c === "nao_encontrado") return t.contatos.naoEncontrado;
  if (c === "limite_de_contatos") return t.contatos.limite;
  if (c === "invalido:texto") return t.assessoria.invalido;
  return t.erros.falha;
}

/** Os ladrilhos do alto de um cartão (as cores das lutas, como na faixa tecida). */
function Ladrilhos({ cores }: { cores: readonly string[] }) {
  return (
    <span className="ma-ladrilhos" aria-hidden>
      {cores.map((c, i) => (
        <span key={i} data-cor={c} />
      ))}
    </span>
  );
}

/** Uma nota curta que a tela lê em voz alta ao aparecer. */
function Nota({ nota }: { nota: { texto: string; erro?: boolean } | null }) {
  if (!nota) return null;
  return (
    <p className={nota.erro ? "ma-nota ma-nota-erro" : "ma-nota"} role={nota.erro ? "alert" : "status"}>
      {nota.texto}
    </p>
  );
}

/**
 * O modo ato (/alumia/modo-ato): a chave do aparelho, o "Estou bem", o guia sem sinal, o pânico, o "Fui detido" (atrás do
 * interruptor), os recados que chegaram, os contatos de segurança e o plantão jurídico das organizações. A chave, o pânico e o
 * guia funcionam mesmo quando o banco não responde. Computador primeiro: dois cartões lado a lado quando a coluna passa de 780 px.
 */
export default function TelaDoModoAto({ lang, situacao }: PropsDaTelaDoPacote) {
  const t = useTextosDoModoAto(lang);
  const ts = useTextosDaSeguranca(lang);
  const estado = useModoAto();
  useMarcaDoModoAto(estado.ligado);
  const id = useId();
  const [sit, setSit] = useState<SituacaoDoModoAto | null>(null);
  const [erroGeral, setErroGeral] = useState<unknown>(null);

  const buscar = useCallback(() => {
    modoAto.situacao().then(
      (s) => {
        setSit(s);
        setErroGeral(null);
      },
      (e: unknown) => setErroGeral(e ?? new Error("falha")),
    );
  }, []);
  useEffect(() => {
    if (situacao.logado) buscar();
  }, [buscar, situacao.logado]);
  const ler = () => {
    setErroGeral(null);
    buscar();
  };

  // O guia "Sem sinal?" fica guardado no aparelho assim que a pessoa abre o modo ato (o service worker do site guarda a página).
  useEffect(() => {
    try {
      const sw = navigator.serviceWorker?.controller;
      if (sw && navigator.onLine) sw.postMessage({ tipo: "casca", lang, extras: [`/${lang}/alumia/modo-ato/sem-sinal`] });
    } catch {
      // sem service worker: o guia fica guardado quando for aberto
    }
  }, [lang]);

  if (!t || !ts) return <EsqueletoDosAjustes rotulo={t?.carregando ?? ""} quantos={3} />;

  return (
    <article className="ma-pagina" aria-labelledby={`${id}-titulo`} data-ligado={estado.ligado || undefined}>
      <header className="ma-cabeca">
        <Faixa className="ma-faixa" />
        <h1 id={`${id}-titulo`} className="ma-titulo al-cond">{t.titulo}</h1>
        <p className="ma-chamada">{t.chamada}</p>
      </header>

      <Chave t={t} lang={lang} ligado={estado.ligado} desde={estado.desde} />

      <div className="ma-grade">
        <EstouBem t={t} sit={sit} />
        <SemSinal t={t} lang={lang} />
        <SemInternet t={t} />
      </div>

      {/* R1 (A4.1): o kit de bolso, montado e guardado só neste aparelho, para abrir sem internet no guia "Sem sinal?". */}
      {situacao.logado && <KitDeBolso lang={lang} />}

      <div className="ma-panico">
        <Panico t={ts} />
      </div>

      {sit && DETIDO_NO_SITE && sit.detido_ligado && <Detido t={t} sit={sit} org={estado.org} />}

      {!sit && erroGeral ? (
        <div className="ma-cartao ma-erro-geral">
          <p className="ma-nota ma-nota-erro" role="alert">{textoDoErro(t, erroGeral)}</p>
          {codigo(erroGeral) !== "sem_servico" && <Botao variante="claro" tamanho="m" onClick={ler}>{t.erros.tentar}</Botao>}
        </div>
      ) : null}

      {sit && (
        <>
          <Recados t={t} lang={lang} sit={sit} aoMudar={setSit} />
          <Contatos t={t} sit={sit} aoMudar={setSit} />
          {sit.minhas_orgs.length > 0 && <Assessoria t={t} orgs={sit.minhas_orgs} aoMudar={setSit} />}
        </>
      )}
    </article>
  );
}

/** A chave do aparelho: liga e desliga o modo ato, e diz o que muda. */
function Chave({ t, lang, ligado, desde }: { t: T; lang: string; ligado: boolean; desde: number | null }) {
  const id = useId();
  return (
    <section className="ma-cartao ma-chave" aria-labelledby={`${id}-t`} data-ligado={ligado || undefined}>
      <div className="ma-cartao-topo">
        <Ladrilhos cores={["v", "d", "1", "v", "4", "2"]} />
        <span className="ma-carimbo al-cond" data-ligado={ligado || undefined}>
          {ligado ? encher(t.chave.ligado, { hora: desde ? horaCurta(lang, desde) : "" }) : t.chave.desligado}
        </span>
      </div>
      <p className="ma-rotulo al-cond">{t.chave.rotulo}</p>
      <h2 id={`${id}-t`} className="ma-cartao-titulo al-cond">{t.chave.titulo}</h2>
      <ul className="ma-itens">
        {t.chave.itens.map((item, i) => (
          <li key={i}>
            <span className="ma-item-ladrilho" data-cor={["v", "d", "1", "4"][i % 4]} aria-hidden />
            {item}
          </li>
        ))}
      </ul>
      <p className="ma-miudo">{t.chave.soAqui}</p>
      <div className="ma-acoes">
        <Botao variante={ligado ? "contorno" : "primario"} tamanho="g" pressionado={ligado} onClick={() => trocar(!ligado)}>
          {ligado ? t.chave.desligar : t.chave.ligar}
        </Botao>
      </div>
    </section>
  );
}

/** "Estou bem": um toque avisa os contatos que aceitaram. */
function EstouBem({ t, sit }: { t: T; sit: SituacaoDoModoAto | null }) {
  const id = useId();
  const [ocupado, setOcupado] = useState(false);
  const [nota, setNota] = useState<{ texto: string; erro?: boolean } | null>(null);
  const aceitos = sit ? sit.contatos.filter((c) => c.aceito).length : 0;

  async function avisar() {
    setOcupado(true);
    setNota(null);
    try {
      const r = await modoAto.estouBem();
      setNota({ texto: encher(r.avisados === 1 ? t.estouBem.feitoUm : t.estouBem.feito, { n: r.avisados }) });
    } catch (e) {
      setNota({ texto: codigo(e) === "sem_contatos" ? t.estouBem.semContatos : textoDoErro(t, e), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section id="estou-bem" className="ma-cartao ma-estou-bem" aria-labelledby={`${id}-t`}>
      <div className="ma-cartao-topo">
        <Ladrilhos cores={["d", "d", "1", "d", "3", "d"]} />
      </div>
      <p className="ma-rotulo al-cond">{t.estouBem.rotulo}</p>
      <h2 id={`${id}-t`} className="ma-cartao-titulo al-cond">{t.estouBem.titulo}</h2>
      <p className="ma-texto">{t.estouBem.texto}</p>
      {sit && aceitos === 0 && !nota && <p className="ma-miudo">{t.estouBem.semContatos}</p>}
      <div className="ma-acoes" aria-live="polite">
        <Botao variante="dourado" tamanho="g" disabled={ocupado || !sit || aceitos === 0} aria-busy={ocupado || undefined} onClick={() => void avisar()}>
          {ocupado ? t.estouBem.enviando : t.estouBem.botao}
        </Botao>
        <Nota nota={nota} />
      </div>
    </section>
  );
}

/** O caminho para o guia "Sem sinal?" (página estática que fica guardada no aparelho). */
function SemSinal({ t, lang }: { t: T; lang: string }) {
  const id = useId();
  return (
    <section className="ma-cartao ma-sem-sinal" aria-labelledby={`${id}-t`}>
      <div className="ma-cartao-topo">
        <span className="ma-sinal" aria-hidden>
          <span />
          <span />
          <span />
          <span />
        </span>
      </div>
      <p className="ma-rotulo al-cond">{t.guia.secoes[1].titulo}</p>
      <h2 id={`${id}-t`} className="ma-cartao-titulo al-cond">{t.semSinal.titulo}</h2>
      <p className="ma-texto">{t.semSinal.texto}</p>
      <div className="ma-acoes">
        <Link href={`/${lang}/alumia/modo-ato/sem-sinal`} className="al-botao al-botao-claro al-botao-g">
          {t.semSinal.abrir}
        </Link>
      </div>
    </section>
  );
}

/** "Fui detido": escolher a assessoria (fica no aparelho), confirmar e mandar. Embaixo, os direitos. */
function Detido({ t, sit, org }: { t: T; sit: SituacaoDoModoAto; org: string | null }) {
  const id = useId();
  const [orgs, setOrgs] = useState<OrgComAssessoria[]>([]);
  const [passo, setPasso] = useState<"inicio" | "confirmar" | "enviando">("inicio");
  const [nota, setNota] = useState<{ texto: string; erro?: boolean } | null>(null);
  useEffect(() => {
    let vivo = true;
    modoAto.assessorias().then((x) => vivo && setOrgs(x), () => undefined);
    return () => {
      vivo = false;
    };
  }, []);
  const escolhida = orgs.find((o) => o.handle === org) ?? null;
  const aceitos = sit.contatos.filter((c) => c.aceito).length;

  async function mandar() {
    setPasso("enviando");
    setNota(null);
    try {
      const r = await modoAto.fuiDetido(escolhida?.handle ?? null);
      setNota({ texto: [encher(r.avisados === 1 ? t.detido.feitoUm : t.detido.feito, { n: r.avisados }), r.assessoria ? t.detido.feitoOrg : "", t.detido.panico].filter(Boolean).join(" ") });
    } catch (e) {
      setNota({ texto: codigo(e) === "sem_contatos" ? t.detido.semContatos : textoDoErro(t, e), erro: true });
    }
    setPasso("inicio");
  }

  return (
    <section className="ma-cartao ma-detido" aria-labelledby={`${id}-t`}>
      <div className="ma-detido-corpo">
        <div className="ma-detido-acao">
          <div className="ma-cartao-topo">
            <span className="ma-carimbo ma-carimbo-vermelho al-cond">{t.detido.rotulo}</span>
          </div>
          <h2 id={`${id}-t`} className="ma-cartao-titulo ma-cartao-titulo-g al-cond">{t.detido.titulo}</h2>
          <p className="ma-texto">{t.detido.texto}</p>
          <label className="ma-campo">
            <span className="ma-campo-rotulo">{t.detido.org}</span>
            <select value={escolhida?.handle ?? ""} onChange={(e) => escolherAssessoria(e.target.value || null)} disabled={passo === "enviando"}>
              <option value="">{t.detido.semOrg}</option>
              {orgs.map((o) => (
                <option key={o.handle} value={o.handle}>{o.nome}</option>
              ))}
            </select>
          </label>
          {escolhida?.texto && <p className="ma-plantao">{escolhida.texto}</p>}
          {aceitos === 0 && !escolhida && <p className="ma-miudo">{t.detido.semContatos}</p>}
          <div className="ma-acoes" aria-live="polite">
            {passo === "confirmar" ? (
              <div className="ma-confirma" role="group" aria-labelledby={`${id}-c`}>
                <p id={`${id}-c`} className="ma-confirma-titulo al-cond">{t.detido.confirmar}</p>
                <div className="ma-acoes">
                  <Botao variante="primario" tamanho="g" onClick={() => void mandar()} autoFocus>{t.detido.sim}</Botao>
                  <Botao variante="fantasma" tamanho="m" onClick={() => setPasso("inicio")}>{t.detido.nao}</Botao>
                </div>
              </div>
            ) : (
              <Botao
                variante="primario"
                tamanho="g"
                className="ma-botao-detido"
                disabled={passo === "enviando" || (aceitos === 0 && !escolhida)}
                aria-busy={passo === "enviando" || undefined}
                icone={<Icone nome="alerta" className="h-5 w-5" grosso />}
                onClick={() => setPasso("confirmar")}
              >
                {passo === "enviando" ? t.detido.enviando : t.detido.botao}
              </Botao>
            )}
            <Nota nota={nota} />
          </div>
        </div>
        <div className="ma-direitos">
          <h3 className="ma-subtitulo al-cond">{t.detido.direitosTitulo}</h3>
          <ol className="ma-lista-numerada">
            {t.detido.direitos.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/** Os recados que chegaram (só os que ainda valem). No "fui detido", o que fazer agora. */
function Recados({ t, lang, sit, aoMudar }: { t: T; lang: string; sit: SituacaoDoModoAto; aoMudar: (s: SituacaoDoModoAto) => void }) {
  const id = useId();
  const [nota, setNota] = useState<{ texto: string; erro?: boolean } | null>(null);
  const temDetido = sit.recados.some((r) => r.tipo === "detido");
  async function apagar(rid: string) {
    setNota(null);
    try {
      aoMudar(await modoAto.apagarRecado(rid));
    } catch (e) {
      setNota({ texto: textoDoErro(t, e), erro: true });
    }
  }
  return (
    <section className="ma-cartao ma-recados" aria-labelledby={`${id}-t`}>
      <p className="ma-rotulo al-cond">{t.recados.rotulo}</p>
      <h2 id={`${id}-t`} className="ma-cartao-titulo al-cond">{t.recados.titulo}</h2>
      {sit.recados.length === 0 ? (
        <p className="ma-miudo">{t.recados.vazio}</p>
      ) : (
        <ul className="ma-lista">
          {sit.recados.map((r) => (
            <li key={r.id} className="ma-recado" data-tipo={r.tipo}>
              <span className="ma-recado-marca" aria-hidden>
                <Icone nome={r.tipo === "detido" ? "alerta" : "visto"} className="h-5 w-5" grosso />
              </span>
              <div className="min-w-0 flex-1">
                <p className="ma-recado-titulo">{encher(r.tipo === "detido" ? t.recados.detido : t.recados.estouBem, { nome: r.handle ? `${r.nome} (@${r.handle})` : r.nome })}</p>
                <p className="ma-miudo">
                  {encher(t.recados.quando, { hora: horaCurta(lang, r.criado_em), quando: daquiA(lang, r.expira_em) })}
                  {r.via_org ? ` ${encher(t.recados.viaOrg, { org: r.via_org })}` : ""}
                </p>
              </div>
              <Botao variante="fantasma" tamanho="m" onClick={() => void apagar(r.id)}>{t.recados.apagar}</Botao>
            </li>
          ))}
        </ul>
      )}
      {temDetido && (
        <div className="ma-o-que-fazer">
          <h3 className="ma-subtitulo al-cond">{t.recados.oQueFazer}</h3>
          <ol className="ma-lista-numerada">
            {t.recados.passos.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ol>
        </div>
      )}
      <Nota nota={nota} />
    </section>
  );
}

/** Os contatos de segurança: pedir, ver quem aceitou, tirar; responder a quem pediu; deixar de receber. */
function Contatos({ t, sit, aoMudar }: { t: T; sit: SituacaoDoModoAto; aoMudar: (s: SituacaoDoModoAto) => void }) {
  const id = useId();
  const [handle, setHandle] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [nota, setNota] = useState<{ texto: string; erro?: boolean } | null>(null);

  async function fazer(acao: () => Promise<SituacaoDoModoAto>, ok?: string) {
    setOcupado(true);
    setNota(null);
    try {
      aoMudar(await acao());
      if (ok) setNota({ texto: ok });
      return true;
    } catch (e) {
      setNota({ texto: textoDoErro(t, e), erro: true });
      return false;
    } finally {
      setOcupado(false);
    }
  }
  async function pedir(e: FormEvent) {
    e.preventDefault();
    const h = handle.trim();
    if (!h) return;
    if (await fazer(() => modoAto.pedirContato(h), t.contatos.pedido)) setHandle("");
  }
  const cheio = sit.contatos.length >= 10;

  return (
    <section className="ma-cartao ma-contatos" aria-labelledby={`${id}-t`}>
      <p className="ma-rotulo al-cond">{t.contatos.rotulo}</p>
      <h2 id={`${id}-t`} className="ma-cartao-titulo al-cond">{t.contatos.titulo}</h2>
      <p className="ma-texto">{t.contatos.texto}</p>

      <form className="ma-pedir" onSubmit={(e) => void pedir(e)}>
        <label className="ma-campo ma-campo-linha">
          <span className="ma-campo-rotulo">{t.contatos.campo}</span>
          <span className="ma-arroba">
            <span aria-hidden>@</span>
            <input value={handle} onChange={(e) => setHandle(e.target.value)} maxLength={21} autoComplete="off" spellCheck={false} disabled={ocupado || cheio} />
          </span>
        </label>
        <Botao type="submit" variante="claro" tamanho="m" disabled={ocupado || cheio || !handle.trim()}>{t.contatos.pedir}</Botao>
      </form>
      {cheio && <p className="ma-miudo">{t.contatos.limite}</p>}
      <Nota nota={nota} />

      {sit.contatos.length === 0 ? (
        <p className="ma-miudo">{t.contatos.vazio}</p>
      ) : (
        <ul className="ma-lista">
          {sit.contatos.map((c) => (
            <li key={c.handle ?? c.nome} className="ma-pessoa">
              <span className="ma-pessoa-nome">
                <strong>{c.nome}</strong>
                {c.handle && <span className="ma-cinza"> @{c.handle}</span>}
              </span>
              <span className="ma-selo al-cond" data-aceito={c.aceito || undefined}>{c.aceito ? t.contatos.aceito : t.contatos.aguardando}</span>
              {c.handle && <Botao variante="fantasma" tamanho="m" disabled={ocupado} onClick={() => void fazer(() => modoAto.tirar(c.handle!))}>{t.contatos.tirar}</Botao>}
            </li>
          ))}
        </ul>
      )}

      {sit.pedidos.length > 0 && (
        <div className="ma-bloco">
          <h3 className="ma-subtitulo al-cond">{t.contatos.pedidosTitulo}</h3>
          <ul className="ma-lista">
            {sit.pedidos.map((p) => (
              <li key={p.handle ?? p.nome} className="ma-pessoa">
                <span className="ma-pessoa-nome">
                  <strong>{p.nome}</strong>
                  {p.handle && <span className="ma-cinza"> @{p.handle}</span>}
                </span>
                {p.handle && (
                  <span className="ma-acoes">
                    <Botao variante="dourado" tamanho="m" disabled={ocupado} onClick={() => void fazer(() => modoAto.responder(p.handle!, true))}>{t.contatos.aceitar}</Botao>
                    <Botao variante="fantasma" tamanho="m" disabled={ocupado} onClick={() => void fazer(() => modoAto.responder(p.handle!, false))}>{t.contatos.recusar}</Botao>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {sit.sou_contato_de.length > 0 && (
        <div className="ma-bloco">
          <h3 className="ma-subtitulo al-cond">{t.contatos.souTitulo}</h3>
          <ul className="ma-lista">
            {sit.sou_contato_de.map((p) => (
              <li key={p.handle ?? p.nome} className="ma-pessoa">
                <span className="ma-pessoa-nome">
                  <strong>{p.nome}</strong>
                  {p.handle && <span className="ma-cinza"> @{p.handle}</span>}
                </span>
                {p.handle && <Botao variante="fantasma" tamanho="m" disabled={ocupado} onClick={() => void fazer(() => modoAto.tirar(p.handle!))}>{t.contatos.sair}</Botao>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** O plantão jurídico das organizações com selo que a pessoa gere. */
function Assessoria({ t, orgs, aoMudar }: { t: T; orgs: OrgComAssessoria[]; aoMudar: (s: SituacaoDoModoAto) => void }) {
  const id = useId();
  return (
    <section className="ma-cartao ma-assessoria" aria-labelledby={`${id}-t`}>
      <p className="ma-rotulo al-cond">{t.assessoria.rotulo}</p>
      <h2 id={`${id}-t`} className="ma-cartao-titulo al-cond">{t.assessoria.titulo}</h2>
      <p className="ma-texto">{t.assessoria.texto}</p>
      {orgs.map((o) => (
        <FormularioDaAssessoria key={o.handle} t={t} org={o} aoMudar={aoMudar} />
      ))}
    </section>
  );
}

function FormularioDaAssessoria({ t, org, aoMudar }: { t: T; org: OrgComAssessoria; aoMudar: (s: SituacaoDoModoAto) => void }) {
  const id = useId();
  const [texto, setTexto] = useState(org.texto ?? "");
  const [ocupado, setOcupado] = useState(false);
  const [nota, setNota] = useState<{ texto: string; erro?: boolean } | null>(null);
  async function guardar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setNota(null);
    try {
      aoMudar(await modoAto.guardarAssessoria(org.handle, texto));
      setNota({ texto: t.assessoria.guardado });
    } catch (erro) {
      setNota({ texto: textoDoErro(t, erro), erro: true });
    } finally {
      setOcupado(false);
    }
  }
  return (
    <form className="ma-bloco ma-form" onSubmit={(e) => void guardar(e)}>
      <label className="ma-campo" htmlFor={`${id}-texto`}>
        <span className="ma-campo-rotulo">{encher(t.assessoria.campo, { org: org.nome })}</span>
      </label>
      <textarea id={`${id}-texto`} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={400} rows={3} aria-describedby={`${id}-ajuda`} disabled={ocupado} />
      <p id={`${id}-ajuda`} className="ma-miudo">{t.assessoria.ajuda} · {texto.trim().length}/400</p>
      <div className="ma-acoes">
        <Botao type="submit" variante="claro" tamanho="m" disabled={ocupado}>{t.assessoria.guardar}</Botao>
        <Nota nota={nota} />
      </div>
    </form>
  );
}

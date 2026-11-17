// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A aba Comunicação do perfil da organização (onda 12, frente 12E): a fila (escrever pela organização, outra pessoa aprova), os
// modelos, chamar o núcleo com teto, o boletim e, para quem gerencia, o domínio próprio. Só para quem fala pela organização ou
// media um núcleo dela: para os outros o banco devolve nulo e a aba não desenha nada.
//
// Privacidade (LGPD art. 5º, II e art. 11): a fila não mostra quem escreveu (só "você escreveu" para a própria pessoa); o boletim
// mostra o número de quem assina só a partir de 3; chamar o núcleo devolve o número de avisadas só a partir de 3.
import { useCallback, useEffect, useId, useState } from "react";
import { clienteDaComunicacao } from "@/lib/rede/cliente-org-comunicacao";
import { dataCurta } from "@/lib/rede/org/contagem";
import {
  LIMITES_DA_COMUNICACAO, PUBLICOS_DA_ORG, dominioLimpo, problemaDoTexto, restamLetras, separarFila,
  type ComunicacaoDaOrg, type DominioDaComunicacao, type ItemDaFila, type PublicoDaOrg,
} from "@/lib/rede/org/comunicacao";
import { preencher } from "@/lib/rede/preencher";
import { fraseDaComunicacao, useTextosDaComunicacao, type TextosDaComunicacao } from "@/lib/rede/textos-org-comunicacao";
import { Botao } from "../../ui/Botao";
import "../b1/b1.css";
import "./comunicacao.css";

type Fazer = <T>(acao: () => Promise<T>, depois?: (r: T) => void, feito?: string | ((r: T) => string)) => Promise<void>;

export function AbaComunicacao({ handle, lang }: { handle: string; lang: string }) {
  const t = useTextosDaComunicacao(lang);
  const id = useId();
  const [c, setC] = useState<ComunicacaoDaOrg | null | undefined>(undefined);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const ler = useCallback(async () => setC(await clienteDaComunicacao().painel(handle)), [handle]);
  useEffect(() => {
    let vivo = true;
    clienteDaComunicacao()
      .painel(handle)
      .then((r) => vivo && setC(r))
      .catch((e) => {
        if (!vivo) return;
        setC(null);
        if (t) setErro(fraseDaComunicacao(t, e));
      });
    return () => {
      vivo = false;
    };
  }, [handle, t]);

  if (!t) return null;
  if (c === undefined) return <p className="al-painel-vazio" aria-busy="true">{t.carregando}</p>;
  if (c === null) return erro ? <p className="al-perfil-erro" role="alert">{erro}</p> : null;

  const fazer: Fazer = async (acao, depois, feito) => {
    setOcupado(true);
    setErro("");
    setOk("");
    try {
      const r = await acao();
      depois?.(r);
      await ler();
      if (feito) setOk(typeof feito === "function" ? feito(r) : feito);
    } catch (e) {
      setErro(fraseDaComunicacao(t, e));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="o12-com" aria-labelledby={`${id}-t`}>
      <header className="o12-com-topo">
        <h2 id={`${id}-t`} className="al-cond">{t.titulo}</h2>
        <p className="al-perfil-nota">{c.comunico ? t.intro : t.soNucleo}</p>
      </header>
      <p className="o12-com-retorno" role="status" aria-live="polite">{ok}</p>
      {erro ? <p className="al-perfil-erro" role="alert">{erro}</p> : null}

      <div className="o12-com-grade">
        {c.comunico ? (
          <div className="o12-com-coluna">
            <Fila c={c} t={t} lang={lang} handle={handle} ocupado={ocupado} fazer={fazer} />
            <Modelos c={c} t={t} handle={handle} ocupado={ocupado} fazer={fazer} />
          </div>
        ) : null}
        <div className="o12-com-coluna">
          <ChamarNucleo c={c} t={t} lang={lang} ocupado={ocupado} fazer={fazer} />
          {c.comunico && c.boletim ? <Boletim c={c} t={t} lang={lang} handle={handle} ocupado={ocupado} fazer={fazer} /> : null}
          {c.gerencio ? <Dominio c={c} t={t} lang={lang} handle={handle} ocupado={ocupado} fazer={fazer} /> : null}
        </div>
      </div>
    </div>
  );
}

interface Parte { c: ComunicacaoDaOrg; t: TextosDaComunicacao; ocupado: boolean; fazer: Fazer }

function EscolherPublico({ valor, aoMudar, t, rotulo }: { valor: PublicoDaOrg; aoMudar: (p: PublicoDaOrg) => void; t: TextosDaComunicacao; rotulo: string }) {
  return (
    <label>
      {rotulo}
      <select className="al-entrada" value={valor} onChange={(e) => aoMudar(e.target.value as PublicoDaOrg)}>
        {PUBLICOS_DA_ORG.map((p) => <option key={p} value={p}>{t.publicos[p]}</option>)}
      </select>
    </label>
  );
}

function Fila({ c, t, lang, handle, ocupado, fazer }: Parte & { lang: string; handle: string }) {
  const id = useId();
  const [texto, setTexto] = useState("");
  const [publico, setPublico] = useState<PublicoDaOrg>("membros");
  const [modelo, setModelo] = useState("");
  const [aberto, setAberto] = useState(false);
  const [recusando, setRecusando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const { esperando, decididos } = separarFila(c.fila);
  const problema = problemaDoTexto(texto);
  const cli = clienteDaComunicacao();

  return (
    <section className="b1-bloco o12-fila" aria-labelledby={`${id}-f`}>
      <h3 id={`${id}-f`} className="b1-titulo al-cond">{t.fila.titulo}</h3>
      {esperando.length === 0 ? <p className="al-painel-vazio">{t.fila.vazia}</p> : (
        <ul className="b1-lista">
          {esperando.map((i) => (
            <li key={i.id} className="o12-item" data-meu={i.meu ? "" : undefined}>
              <ItemTopo i={i} t={t} lang={lang} />
              <p className="o12-item-texto">{i.texto}</p>
              {i.boletim ? (
                <details className="o12-boletim-itens">
                  <summary>{t.fila.postsDoBoletim} ({i.boletim.length})</summary>
                  <ul>{i.boletim.map((b) => <li key={b.id}>{b.texto}</li>)}</ul>
                </details>
              ) : null}
              <p className="al-perfil-nota">{i.meu ? `${t.fila.meu} · ${t.fila.esperaOutra}` : t.fila.outra}</p>
              {recusando === i.id ? (
                <form className="b1-form" onSubmit={(e) => { e.preventDefault(); void fazer(() => cli.decidir(i.id, false, motivo), () => { setRecusando(null); setMotivo(""); }, t.fila.recusado); }}>
                  <label>
                    {t.fila.motivo}
                    <input className="al-entrada" value={motivo} maxLength={300} onChange={(e) => setMotivo(e.target.value)} autoFocus />
                  </label>
                  <div className="b1-botoes">
                    <Botao type="submit" variante="contorno" tamanho="p" disabled={ocupado}>{t.fila.confirmarRecusa}</Botao>
                    <Botao variante="fantasma" tamanho="p" onClick={() => setRecusando(null)}>{t.fila.cancelar}</Botao>
                  </div>
                </form>
              ) : (
                <div className="b1-botoes">
                  {i.possoDecidir ? (
                    <>
                      <Botao variante="primario" tamanho="p" pilula disabled={ocupado} onClick={() => void fazer(() => cli.decidir(i.id, true), undefined, t.fila.aprovado)}>{t.fila.aprovar}</Botao>
                      <Botao variante="contorno" tamanho="p" pilula disabled={ocupado} onClick={() => setRecusando(i.id)}>{t.fila.recusar}</Botao>
                    </>
                  ) : null}
                  {i.meu ? <Botao variante="fantasma" tamanho="p" className="b1-perigo" disabled={ocupado} onClick={() => void fazer(() => cli.retirar(i.id))}>{t.fila.retirar}</Botao> : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <details className="b1-novo" open={aberto} onToggle={(e) => setAberto((e.currentTarget as HTMLDetailsElement).open)}>
        <summary>{t.escrever.abrir}</summary>
        <form
          className="b1-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (problema) return;
            void fazer(() => cli.escrever(handle, { texto: texto.trim(), publico }), () => { setTexto(""); setModelo(""); setAberto(false); }, t.escrever.feito);
          }}
        >
          {c.modelos.length > 0 ? (
            <label>
              {t.escrever.modelo}
              <select
                className="al-entrada"
                value={modelo}
                onChange={(e) => {
                  setModelo(e.target.value);
                  const m = c.modelos.find((x) => x.id === e.target.value);
                  if (m) { setTexto(m.texto); setPublico(m.publico); }
                }}
              >
                <option value="">{t.escrever.semModelo}</option>
                {c.modelos.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
            </label>
          ) : null}
          <label>
            {t.escrever.texto}
            <textarea className="al-entrada o12-area" rows={5} value={texto} onChange={(e) => setTexto(e.target.value)} aria-invalid={problema === "longo" || undefined} aria-describedby={`${id}-n`} />
            <small id={`${id}-n`} className={problema === "longo" ? "b1-problema" : undefined}>{preencher(t.escrever.restam, { n: restamLetras(texto) })}</small>
          </label>
          <EscolherPublico valor={publico} aoMudar={setPublico} t={t} rotulo={t.escrever.publico} />
          <p className="al-perfil-nota">{t.escrever.nota}</p>
          <div className="b1-botoes"><Botao type="submit" pilula disabled={ocupado || problema !== null}>{t.escrever.enviar}</Botao></div>
        </form>
      </details>

      {decididos.length > 0 ? (
        <details className="o12-decididos">
          <summary className="b1-mini">{t.fila.decididos} ({decididos.length})</summary>
          <ul className="b1-lista">
            {decididos.map((i) => (
              <li key={i.id} className="o12-item o12-item-feito">
                <ItemTopo i={i} t={t} lang={lang} />
                <p className="o12-item-texto">{i.texto}</p>
                {i.motivo ? <p className="al-perfil-nota">{t.fila.motivo}: {i.motivo}</p> : null}
                {i.retido ? <p className="al-perfil-nota b1-problema">{t.fila.retido}</p> : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function ItemTopo({ i, t, lang }: { i: ItemDaFila; t: TextosDaComunicacao; lang: string }) {
  return (
    <span className="o12-item-topo">
      <span className="b1-carimbo o12-carimbo" data-situacao={i.situacao}>{t.fila.situacoes[i.situacao]}</span>
      {i.tipo === "boletim" ? <span className="b1-selo-situacao">{t.fila.boletim}</span> : null}
      <small>{t.publicos[i.publico]} · {dataCurta(i.decididoDia ?? i.criadoEm, lang)}</small>
    </span>
  );
}

function Modelos({ c, t, handle, ocupado, fazer }: Parte & { handle: string }) {
  const id = useId();
  const [nome, setNome] = useState("");
  const [texto, setTexto] = useState("");
  const [publico, setPublico] = useState<PublicoDaOrg>("membros");
  const cli = clienteDaComunicacao();
  return (
    <section className="b1-bloco" aria-labelledby={`${id}-m`}>
      <h3 id={`${id}-m`} className="b1-titulo al-cond">{t.modelos.titulo}</h3>
      {c.modelos.length === 0 ? <p className="al-painel-vazio">{t.modelos.vazio}</p> : (
        <ul className="b1-lista">
          {c.modelos.map((m) => (
            <li key={m.id} className="o12-modelo">
              <span><strong>{m.nome}</strong> <small>{t.publicos[m.publico]}</small></span>
              <p className="o12-item-texto">{m.texto}</p>
              <Botao variante="fantasma" tamanho="p" className="b1-perigo" disabled={ocupado} onClick={() => window.confirm(preencher(t.modelos.apagarConfirma, { nome: m.nome })) && void fazer(() => cli.apagarModelo(handle, m.id))}>{t.modelos.apagar}</Botao>
            </li>
          ))}
        </ul>
      )}
      {c.modelos.length < LIMITES_DA_COMUNICACAO.modelos ? (
        <details className="b1-novo">
          <summary>{t.modelos.abrir}</summary>
          <form className="b1-form" onSubmit={(e) => { e.preventDefault(); void fazer(() => cli.salvarModelo(handle, { nome: nome.trim(), texto: texto.trim(), publico }), () => { setNome(""); setTexto(""); }, t.modelos.feito); }}>
            <label>{t.modelos.nome}<input className="al-entrada" value={nome} maxLength={LIMITES_DA_COMUNICACAO.modeloNome} onChange={(e) => setNome(e.target.value)} required minLength={2} /></label>
            <label>{t.modelos.texto}<textarea className="al-entrada o12-area" rows={3} value={texto} maxLength={LIMITES_DA_COMUNICACAO.texto} onChange={(e) => setTexto(e.target.value)} required /></label>
            <EscolherPublico valor={publico} aoMudar={setPublico} t={t} rotulo={t.escrever.publico} />
            <div className="b1-botoes"><Botao type="submit" variante="contorno" pilula disabled={ocupado || nome.trim().length < 2 || problemaDoTexto(texto) !== null}>{t.modelos.salvar}</Botao></div>
          </form>
        </details>
      ) : null}
    </section>
  );
}

function ChamarNucleo({ c, t, lang, ocupado, fazer }: Parte & { lang: string }) {
  const id = useId();
  const [nucleo, setNucleo] = useState(c.nucleos.find((n) => n.restam > 0)?.id ?? c.nucleos[0]?.id ?? "");
  const [texto, setTexto] = useState("");
  const escolhido = c.nucleos.find((n) => n.id === nucleo) ?? null;
  const cli = clienteDaComunicacao();
  return (
    <section className="b1-bloco o12-nucleo" aria-labelledby={`${id}-n`}>
      <h3 id={`${id}-n`} className="b1-titulo al-cond">{t.nucleo.titulo}</h3>
      <p className="al-perfil-nota">{t.nucleo.ajuda}</p>
      {c.nucleos.length === 0 ? <p className="al-painel-vazio">{t.nucleo.vazio}</p> : (
        <>
          <ul className="o12-teto" aria-label={t.nucleo.titulo}>
            {c.nucleos.map((n) => (
              <li key={n.id} data-acabou={n.restam === 0 ? "" : undefined}>
                <span className="o12-teto-nome">{n.nome}</span>
                <span className="o12-teto-ladrilhos" aria-hidden="true">
                  {Array.from({ length: LIMITES_DA_COMUNICACAO.chamadasPorSemana }, (_, i) => <i key={i} data-cheio={i < n.restam ? "" : undefined} />)}
                </span>
                <small>{n.restam > 0 ? preencher(t.nucleo.restam, { n: n.restam }) : n.volta ? preencher(t.nucleo.acabou, { data: dataCurta(n.volta, lang) }) : preencher(t.nucleo.restam, { n: 0 })}</small>
              </li>
            ))}
          </ul>
          <form
            className="b1-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!escolhido || problemaDoTexto(texto) || !window.confirm(preencher(t.nucleo.confirma, { nome: escolhido.nome }))) return;
              void fazer(() => cli.chamarNucleo(escolhido.id, texto.trim()), () => setTexto(""),
                (r) => (r.retido ? t.nucleo.retido : r.avisadas === null ? t.nucleo.feitoPoucas : preencher(t.nucleo.feito, { n: r.avisadas })));
            }}
          >
            <label>
              {t.nucleo.nucleo}
              <select className="al-entrada" value={nucleo} onChange={(e) => setNucleo(e.target.value)}>
                {c.nucleos.map((n) => <option key={n.id} value={n.id} disabled={n.restam === 0}>{n.nome}</option>)}
              </select>
            </label>
            <label>{t.nucleo.texto}<textarea className="al-entrada o12-area" rows={3} value={texto} maxLength={LIMITES_DA_COMUNICACAO.texto} onChange={(e) => setTexto(e.target.value)} /></label>
            <div className="b1-botoes"><Botao type="submit" variante="dourado" pilula disabled={ocupado || !escolhido || escolhido.restam === 0 || problemaDoTexto(texto) !== null}>{t.nucleo.chamar}</Botao></div>
          </form>
        </>
      )}
    </section>
  );
}

/** O post cabe no boletim deste público (a mesma regra do banco): "internet" cabe em todos; os outros só no boletim do mesmo público. */
function cabeNoBoletim(doPost: string | null | undefined, doBoletim: PublicoDaOrg): boolean {
  const p = doPost ?? "membros";
  return p === "internet" || p === doBoletim;
}

function Boletim({ c, t, lang, handle, ocupado, fazer }: Parte & { lang: string; handle: string }) {
  const id = useId();
  const b = c.boletim!;
  const [texto, setTexto] = useState("");
  const [publico, setPublico] = useState<PublicoDaOrg>("membros");
  const [posts, setPosts] = useState<string[]>([]);
  const cli = clienteDaComunicacao();
  const cabem = b.posts.filter((p) => cabeNoBoletim(p.publico, publico));
  const mudarPublico = (novo: PublicoDaOrg) => {
    setPublico(novo);
    setPosts((x) => x.filter((id) => cabeNoBoletim(b.posts.find((p) => p.id === id)?.publico, novo)));
  };
  const esperando = c.fila.some((i) => i.tipo === "boletim" && i.situacao === "esperando");
  const numero = b.assinantes === null ? t.boletim.poucas : b.porEmail === null ? preencher(t.boletim.assinantesSemEmail, { n: b.assinantes }) : preencher(t.boletim.assinantes, { n: b.assinantes, e: b.porEmail });
  return (
    <section className="b1-bloco o12-boletim" aria-labelledby={`${id}-b`}>
      <h3 id={`${id}-b`} className="b1-titulo al-cond">{t.boletim.titulo}</h3>
      <p className="al-perfil-nota">{t.boletim.ajuda}</p>
      <p className="o12-boletim-numero"><strong>{numero}</strong>{b.ultimo ? ` ${preencher(t.boletim.ultimo, { data: dataCurta(b.ultimo, lang) })}` : ""}</p>
      {b.proximo ? <p className="al-perfil-nota">{preencher(t.boletim.proximo, { data: dataCurta(b.proximo, lang) })}</p> : esperando ? <p className="al-perfil-nota">{t.erros.boletim_esperando}</p> : (
        <details className="b1-novo">
          <summary>{t.boletim.abrir}</summary>
          <form className="b1-form" onSubmit={(e) => { e.preventDefault(); void fazer(() => cli.proporBoletim(handle, { texto: texto.trim(), posts, publico }), () => { setTexto(""); setPosts([]); }, t.escrever.feito); }}>
            <label>{t.boletim.abertura}<textarea className="al-entrada o12-area" rows={3} value={texto} maxLength={LIMITES_DA_COMUNICACAO.texto} onChange={(e) => setTexto(e.target.value)} /></label>
            <EscolherPublico valor={publico} aoMudar={mudarPublico} t={t} rotulo={t.escrever.publico} />
            <fieldset className="b1-marcar">
              <legend>{t.boletim.posts}</legend>
              {cabem.length === 0 ? <p className="al-painel-vazio">{t.boletim.semPosts}</p> : cabem.map((p) => (
                <label key={p.id} className="o12-boletim-post">
                  <input type="checkbox" checked={posts.includes(p.id)} disabled={!posts.includes(p.id) && posts.length >= LIMITES_DA_COMUNICACAO.boletimPosts}
                    onChange={(e) => setPosts((x) => (e.target.checked ? [...x, p.id] : x.filter((y) => y !== p.id)))} />
                  <span>{p.texto}<small>{dataCurta(p.criadoEm, lang)}</small></span>
                </label>
              ))}
            </fieldset>
            <p className="al-perfil-nota">{t.boletim.email}</p>
            <div className="b1-botoes"><Botao type="submit" pilula disabled={ocupado || posts.length === 0 || problemaDoTexto(texto) !== null}>{t.boletim.propor}</Botao></div>
          </form>
        </details>
      )}
    </section>
  );
}

function Copiavel({ rotulo, valor, t }: { rotulo: string; valor: string; t: TextosDaComunicacao }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="o12-copiavel">
      <span className="b1-mini">{rotulo}</span>
      <code>{valor}</code>
      <Botao variante="fantasma" tamanho="p" onClick={() => void navigator.clipboard?.writeText(valor).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1500); }, () => undefined)}>
        {copiado ? t.dominio.copiado : t.dominio.copiar}
      </Botao>
    </div>
  );
}

function Dominio({ c, t, lang, handle, ocupado, fazer }: Parte & { lang: string; handle: string }) {
  const id = useId();
  const d: DominioDaComunicacao | null = c.dominio;
  const [campo, setCampo] = useState("");
  const [trocar, setTrocar] = useState(false);
  const [aviso, setAviso] = useState("");
  const limpo = dominioLimpo(campo);
  const cli = clienteDaComunicacao();
  return (
    <section className="b1-bloco o12-dominio" aria-labelledby={`${id}-d`}>
      <h3 id={`${id}-d`} className="b1-titulo al-cond">{t.dominio.titulo}</h3>
      <p className="al-perfil-nota">{c.selo ? t.dominio.ajuda : t.dominio.semSelo}</p>
      {c.selo && d ? (
        <div className="o12-dominio-atual" data-situacao={d.situacao}>
          <span className="o12-dominio-nome">{d.dominio}</span>
          <span className="b1-carimbo o12-carimbo" data-situacao={d.situacao === "verificado" ? "aprovado" : "esperando"}>{d.situacao === "verificado" ? t.dominio.verificado : t.dominio.esperando}</span>
          {d.conferidoEm ? <small>{preencher(t.dominio.conferidoEm, { data: dataCurta(d.conferidoEm, lang) })}</small> : null}
        </div>
      ) : null}
      {c.selo && d && d.situacao === "esperando" ? (
        <div className="o12-dominio-como">
          <p>{t.dominio.como}</p>
          <div className="o12-dominio-jeitos">
            <div>
              <h4 className="b1-subtitulo">{t.dominio.txt}</h4>
              <Copiavel rotulo={t.dominio.nome} valor={d.txtNome} t={t} />
              <Copiavel rotulo={t.dominio.valor} valor={d.txtValor} t={t} />
            </div>
            <div>
              <h4 className="b1-subtitulo">{t.dominio.arquivo}</h4>
              <Copiavel rotulo={t.dominio.endereco} valor={d.arquivo} t={t} />
              <Copiavel rotulo={t.dominio.conteudo} valor={d.arquivoTexto} t={t} />
            </div>
          </div>
        </div>
      ) : null}
      {aviso ? <p className="al-perfil-nota" role="status">{aviso}</p> : null}
      {c.selo ? (
        <div className="b1-botoes">
          {d ? (
            <Botao variante={d.situacao === "esperando" ? "primario" : "contorno"} pilula disabled={ocupado}
              onClick={() => { setAviso(""); void fazer(() => cli.conferirDominio(handle), (r) => setAviso(r.ok ? t.dominio.achou : t.dominio.naoAchou)); }}>
              {t.dominio.conferir}
            </Botao>
          ) : null}
          {d && !trocar ? <Botao variante="fantasma" tamanho="p" onClick={() => setTrocar(true)}>{t.dominio.trocar}</Botao> : null}
          {d ? <Botao variante="fantasma" tamanho="p" className="b1-perigo" disabled={ocupado} onClick={() => window.confirm(t.dominio.tirarConfirma) && void fazer(() => cli.tirarDominio(handle))}>{t.dominio.tirar}</Botao> : null}
        </div>
      ) : null}
      {c.selo && (!d || trocar) ? (
        <form className="b1-form b1-form-linha" onSubmit={(e) => { e.preventDefault(); if (limpo) void fazer(() => cli.pedirDominio(handle, limpo), () => { setCampo(""); setTrocar(false); }); }}>
          <label>
            {t.dominio.campo}
            <input className="al-entrada" value={campo} placeholder={t.dominio.exemplo} inputMode="url" autoCapitalize="off" spellCheck={false} onChange={(e) => setCampo(e.target.value)} aria-invalid={campo.trim() !== "" && !limpo ? true : undefined} />
          </label>
          <Botao type="submit" pilula disabled={ocupado || !limpo}>{t.dominio.pedir}</Botao>
        </form>
      ) : null}
    </section>
  );
}

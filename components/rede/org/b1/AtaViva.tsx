// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A Ata Viva (ALUMIA-FUNCOES-E-IDEIAS §2.1, ideias 4 e 5; Onda A da F4): a assembleia com a pauta em faixa tecida, a inscrição de
// fala (a favor, contra, esclarecimento) em que a pessoa vê só a própria posição e o lugar e a mesa vê a fila por codinome, o
// cronômetro-lampião que treme nos últimos 15 s, os sinais de consenso (concordo, dúvida, bloqueio, abstenção) em mosaico de 10
// casas que só aparece a partir de 3 sinais, o aviso à mesa "há bloqueio, abra a fala", o carimbo por deliberação (APROVADO,
// RETIRADO, VAI À BASE, que pode virar fio no Tear) e a ata pronta em post ou PDF. A fila e os sinais somem quando a ata fecha.
//
// Viva: a tela lê de novo a cada 4 s só com a aba visível (rede_org_ata). Privacidade (LGPD art. 5º, II e art. 11): o banco só
// manda a fila para a mesa; a pessoa recebe a própria posição; o mosaico vem nulo abaixo de 3 e nunca diz quem deu qual sinal.
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { clienteOrgB1, type AcaoDaMesa } from "@/lib/rede/cliente-org-b1";
import { CARIMBOS, mosaicoDosSinais, ordinalDaFila, POSICOES, SINAIS, segundosRestantes, tremeOLampiao, type AtaViva, type AtasDaOrg, type CarimboDaAta, type Sinal } from "@/lib/rede/org/b1";
import { dataCurta, haQuanto } from "@/lib/rede/org/contagem";
import { preencher } from "@/lib/rede/preencher";
import { fraseDoErro, useTextosDaOrgB1, type TextosDaOrgB1 } from "@/lib/rede/textos-org-b1";
import { Botao } from "../../ui/Botao";
import { Lampiao } from "../../ui/Lampiao";
import { useAgora, useLerDeNovo } from "./usar";
import "./b1.css";

/** As atas da organização (aba Plenárias): a aberta, ao vivo, e as fechadas; a mesa abre uma nova. */
export function AtasDaOrganizacao({ handle, lang, plenarias = [] }: { handle: string; lang: string; plenarias?: { id: string; titulo: string }[] }) {
  const t = useTextosDaOrgB1(lang);
  const id = useId();
  const [dado, setDado] = useState<AtasDaOrg | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [nova, setNova] = useState({ titulo: "", pontos: "", tempo: "120", plenaria: "" });
  const [ocupado, setOcupado] = useState(false);
  const cli = clienteOrgB1();

  const ler = useCallback(() => clienteOrgB1().atas(handle).then(setDado), [handle]);
  useEffect(() => {
    let vivo = true;
    clienteOrgB1()
      .atas(handle)
      .then((r) => vivo && setDado(r))
      .catch((e) => vivo && t && setErro(fraseDoErro(t, e)));
    return () => {
      vivo = false;
    };
  }, [handle, t]);

  if (!t || !dado) return erro ? <p className="al-perfil-erro" role="alert">{erro}</p> : null;
  const ta = t.ata;
  const atual = aberta ? dado.atas.find((a) => a.id === aberta) : null;

  if (atual) {
    return (
      <AtaAoVivo
        inicial={atual}
        t={t}
        lang={lang}
        aoVoltar={() => {
          setAberta(null);
          void ler();
        }}
      />
    );
  }

  async function abrir() {
    setOcupado(true);
    setErro("");
    try {
      const a = await cli.abrirAta(handle, {
        titulo: nova.titulo.trim(),
        pontos: nova.pontos.split("\n").map((x) => x.trim()).filter(Boolean),
        falaSegundos: Number(nova.tempo) || 120,
        plenaria: nova.plenaria || null,
      });
      await ler();
      setNova({ titulo: "", pontos: "", tempo: "120", plenaria: "" });
      setAberta(a.id);
    } catch (e) {
      setErro(fraseDoErro(t!, e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="b1-bloco b1-atas" aria-labelledby={`${id}-t`}>
      <h3 id={`${id}-t`} className="al-cond b1-titulo">{ta.titulo}</h3>
      <p className="al-perfil-nota">{ta.ajuda}</p>
      {dado.atas.length === 0 ? <p className="al-painel-vazio">{ta.vazio}</p> : (
        <ul className="b1-lista">
          {dado.atas.map((a) => (
            <li key={a.id} className="b1-ata-linha" data-situacao={a.situacao}>
              <span className="b1-ata-nome">
                <strong>{a.titulo}</strong>
                <small>{a.situacao === "aberta" ? ta.aberta : preencher(ta.fechada, { data: dataCurta(a.fechadaEm ?? a.abertaEm, lang) })}</small>
              </span>
              <FaixaDaPauta pontos={a.pontos} atual={a.pontoAtual} t={t} compacta />
              <Botao variante={a.situacao === "aberta" ? "primario" : "contorno"} tamanho="p" onClick={() => setAberta(a.id)} aria-label={`${ta.abrirAta}: ${a.titulo}`}>
                {ta.abrirAta}
              </Botao>
            </li>
          ))}
        </ul>
      )}
      {dado.mesa ? (
        <details className="b1-novo">
          <summary>{ta.nova}</summary>
          <form className="b1-form" onSubmit={(e) => { e.preventDefault(); void abrir(); }}>
            <label><span>{ta.nomeDaAta}</span><input className="al-entrada" required minLength={3} maxLength={120} value={nova.titulo} onChange={(e) => setNova({ ...nova, titulo: e.target.value })} /></label>
            <label><span>{ta.pontos}</span><textarea className="al-entrada" required rows={4} value={nova.pontos} onChange={(e) => setNova({ ...nova, pontos: e.target.value })} /></label>
            <label><span>{ta.tempo}</span><input className="al-entrada" type="number" min={30} max={900} step={10} value={nova.tempo} onChange={(e) => setNova({ ...nova, tempo: e.target.value })} /></label>
            {plenarias.length > 0 ? (
              <label><span>{t.plenaria.aoVivo}</span>
                <select className="al-entrada" value={nova.plenaria} onChange={(e) => setNova({ ...nova, plenaria: e.target.value })}>
                  <option value="">—</option>
                  {plenarias.map((p) => <option key={p.id} value={p.id}>{p.titulo}</option>)}
                </select>
              </label>
            ) : null}
            <Botao type="submit" disabled={ocupado || nova.titulo.trim().length < 3 || !nova.pontos.trim()}>{ta.abrirNova}</Botao>
          </form>
        </details>
      ) : null}
      {erro ? <p className="al-perfil-erro" role="alert">{erro}</p> : null}
    </section>
  );
}

/** A pauta como faixa tecida: cada ponto é um trecho; os carimbados ficam tecidos com a cor do carimbo, o em curso pulsa. */
function FaixaDaPauta({ pontos, atual, t, compacta = false }: { pontos: AtaViva["pontos"]; atual: string | null; t: TextosDaOrgB1; compacta?: boolean }) {
  return (
    <ol className="b1-faixa" data-compacta={compacta ? "" : undefined} aria-label={t.ata.pauta}>
      {pontos.map((p) => (
        <li key={p.id} data-carimbo={p.carimbo ?? undefined} aria-current={p.id === atual ? "step" : undefined}>
          {compacta ? (
            <span className="sr-only">{`${preencher(t.ata.ponto, { n: p.ordem })}: ${p.texto} · ${p.carimbo ? t.ata.carimbos[p.carimbo] : t.ata.semCarimbo}`}</span>
          ) : (
            <>
              <span className="b1-faixa-n" aria-hidden>{p.ordem}</span>
              <span className="b1-faixa-texto">
                {p.texto}
                {p.id === atual ? <small> · {t.ata.emCurso}</small> : null}
              </span>
              {p.carimbo ? <span className="b1-carimbo" data-carimbo={p.carimbo}>{t.ata.carimbos[p.carimbo]}</span> : <span className="b1-faixa-semcarimbo">{t.ata.semCarimbo}</span>}
              {p.deliberacao ? <span className="b1-faixa-delib">{p.deliberacao}</span> : null}
              {p.sinais ? <MosaicoDeSinais m={p.sinais} t={t} pequeno /> : null}
            </>
          )}
        </li>
      ))}
    </ol>
  );
}

/** O mosaico de 10 casas (cada uma = 10 %). Com rótulo para o leitor de tela; a cor tem também padrão (e-ink, alto contraste). */
function MosaicoDeSinais({ m, t, pequeno = false }: { m: NonNullable<AtaViva["pontos"][number]["sinais"]>; t: TextosDaOrgB1; pequeno?: boolean }) {
  const casas = mosaicoDosSinais(m);
  if (!casas) return null;
  const texto = SINAIS.map((s) => `${t.ata.sinal[s]} ${Math.round((m[s] ?? 0) * 100)}%`).join(", ");
  return (
    <span className="b1-mosaico" data-pequeno={pequeno ? "" : undefined} role="img" aria-label={preencher(t.ata.mosaico, { texto })}>
      {casas.map((c, i) => <span key={i} data-sinal={c} style={{ ["--i" as string]: i }} />)}
    </span>
  );
}

/** O cronômetro-lampião: a chama encolhe com o tempo e treme nos últimos 15 s. Avisa o leitor de tela uma vez, aos 15 s. */
function CronometroLampiao({ desde, total, t }: { desde: string; total: number; t: TextosDaOrgB1 }) {
  const agora = useAgora(true);
  const restam = segundosRestantes(desde, total, agora);
  const fracao = Math.max(0, Math.min(1, restam / total));
  const treme = tremeOLampiao(restam);
  return (
    <div className="b1-cronometro" data-treme={treme ? "" : undefined} data-acabou={restam <= 0 ? "" : undefined} style={{ ["--fracao" as string]: fracao }}>
      <span className="b1-cronometro-luz" aria-hidden><Lampiao tamanho={44} /></span>
      <span className="b1-cronometro-texto" role="timer" aria-label={t.ata.lampiao}>
        {restam > 0 ? preencher(t.ata.restam, { s: restam }) : t.ata.acabou}
      </span>
      {/* O texto fica fixo nos 15 s finais: o leitor de tela anuncia uma vez quando aparece, sem contar cada segundo. */}
      <span className="sr-only" aria-live="polite">{treme ? preencher(t.ata.restam, { s: 15 }) : ""}</span>
    </div>
  );
}

function AtaAoVivo({ inicial, t, lang, aoVoltar }: { inicial: AtaViva; t: TextosDaOrgB1; lang: string; aoVoltar: () => void }) {
  const ta = t.ata;
  const id = useId();
  const [a, setA] = useState<AtaViva>(inicial);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [texto, setTexto] = useState<string | null>(null);
  const [publico, setPublico] = useState<"nao" | "membros" | "seguidores" | "internet">("membros");
  const [carimbo, setCarimbo] = useState<{ carimbo: CarimboDaAta; deliberacao: string; funcao: string; prazo: string }>({ carimbo: "aprovado", deliberacao: "", funcao: "", prazo: "" });
  const [tempo, setTempo] = useState(String(inicial.falaSegundos));
  const [funcoes, setFuncoes] = useState<{ id: string; nome: string }[]>([]);
  const titulo = useRef<HTMLHeadingElement>(null);
  const cli = clienteOrgB1();
  const viva = a.situacao === "aberta";

  useEffect(() => {
    titulo.current?.focus();
  }, []);
  useEffect(() => {
    if (!a.souMesa) return;
    clienteOrgB1().funcoes(a.org.handle).then((f) => setFuncoes((f?.funcoes ?? []).map((x) => ({ id: x.id, nome: x.nome })))).catch(() => undefined);
  }, [a.souMesa, a.org.handle]);

  const { ultima, pausado } = useLerDeNovo(viva ? async () => {
    const r = await clienteOrgB1().ata(a.id);
    if (r) setA(r);
  } : null, 4000);
  const agora = useAgora(viva);

  async function fazer(f: () => Promise<AtaViva>) {
    setOcupado(true);
    setErro("");
    try {
      setA(await f());
    } catch (e) {
      setErro(fraseDoErro(t, e));
    } finally {
      setOcupado(false);
    }
  }
  const mesa = (p: AcaoDaMesa) => fazer(() => cli.mesa(a.id, p));

  async function fechar() {
    if (!window.confirm(ta.fecharConfirma)) return;
    setOcupado(true);
    setErro("");
    try {
      const r = await cli.fecharAta(a.id, publico === "nao" ? null : publico);
      setA(r.ata);
      setTexto(r.texto);
    } catch (e) {
      setErro(fraseDoErro(t, e));
    } finally {
      setOcupado(false);
    }
  }

  const ponto = a.pontos.find((p) => p.id === a.pontoAtual) ?? null;
  const hoje = new Date().toISOString().slice(0, 10);
  const textoDaAta = texto ?? textoLocal(a, t);

  return (
    <section className="b1-bloco b1-ata" aria-labelledby={`${id}-t`} data-situacao={a.situacao}>
      <div className="b1-ata-topo">
        <Botao variante="fantasma" tamanho="p" onClick={aoVoltar}>← {ta.voltar}</Botao>
        {viva ? (
          <span className="b1-ao-vivo" aria-live="off">
            <span aria-hidden className="b1-ponto-vivo" />
            {pausado ? t.plenaria.pausada : ultima ? haQuanto(t.plenaria, agora - ultima) : ta.aberta}
          </span>
        ) : null}
      </div>
      <h3 id={`${id}-t`} ref={titulo} tabIndex={-1} className="al-cond b1-titulo">{ta.titulo} · {a.titulo}</h3>
      <FaixaDaPauta pontos={a.pontos} atual={a.pontoAtual} t={t} />

      {viva && ponto ? (
        <div className="b1-ata-grade">
          <div className="b1-ata-palco">
            <h4 className="b1-subtitulo">{preencher(ta.ponto, { n: ponto.ordem })}: {ponto.texto}</h4>
            {a.fala ? (
              <div className="b1-fala" data-posicao={a.fala.posicao} data-eu={a.fala.souEu ? "" : undefined}>
                <p className="b1-fala-quem">
                  {a.fala.quem ? preencher(ta.falaQuem, { quem: a.fala.quem, posicao: ta.posicoes[a.fala.posicao] }) : preencher(ta.fala, { posicao: ta.posicoes[a.fala.posicao] })}
                </p>
                {a.fala.souEu ? <p className="b1-suavez" role="status">{ta.suaVez}</p> : null}
                <CronometroLampiao desde={a.fala.desde} total={a.falaSegundos} t={t} />
              </div>
            ) : <p className="al-perfil-nota">{ta.semFala}</p>}

            <fieldset className="b1-inscricao" disabled={ocupado}>
              <legend>{ta.inscrever}</legend>
              <p className="al-perfil-nota">{ta.inscreverAjuda}</p>
              {a.minha ? (
                <p className="b1-minha" role="status" data-posicao={a.minha.posicao}>
                  {preencher(ta.minha, { lugar: ordinalDaFila(a.minha.lugar, lang), posicao: ta.posicoes[a.minha.posicao] })}
                </p>
              ) : null}
              <div className="b1-botoes">
                {POSICOES.map((p) => (
                  <Botao key={p} variante={a.minha?.posicao === p ? "claro" : "contorno"} pressionado={a.minha?.posicao === p} onClick={() => void fazer(() => cli.inscrever(a.id, p))} data-posicao={p}>
                    {a.minha && a.minha.posicao !== p ? preencher(ta.trocar, { posicao: ta.posicoes[p] }) : ta.posicoes[p]}
                  </Botao>
                ))}
                {a.minha ? <Botao variante="fantasma" onClick={() => void fazer(() => cli.inscrever(a.id, null))}>{ta.sairDaFila}</Botao> : null}
              </div>
              <p className="al-perfil-nota">{a.naFila ? preencher(ta.naFila, { n: a.naFila }) : ta.filaPequena}</p>
            </fieldset>

            <fieldset className="b1-sinais" disabled={ocupado || !a.sinais?.abertos}>
              <legend>{ta.sinais}</legend>
              {a.sinais?.abertos ? (
                <>
                  <p className="al-perfil-nota">{ta.sinaisAjuda}</p>
                  <div className="b1-botoes b1-botoes-sinais">
                    {SINAIS.map((s) => (
                      <button key={s} type="button" className="b1-sinal" data-sinal={s} aria-pressed={a.sinais?.meu === s} onClick={() => void fazer(() => cli.sinal(a.id, a.sinais?.meu === s ? null : (s as Sinal)))}>
                        <span aria-hidden className="b1-sinal-casa" />
                        {ta.sinal[s]}
                      </button>
                    ))}
                  </div>
                  {a.sinais.meu ? <p className="al-perfil-nota" role="status">{preencher(ta.meuSinal, { sinal: ta.sinal[a.sinais.meu] })}</p> : null}
                  {a.sinais.mosaico ? (
                    <div className="b1-mosaico-grande">
                      <MosaicoDeSinais m={a.sinais.mosaico} t={t} />
                      {a.sinais.mosaico.pessoas ? <small>{preencher(ta.pessoas, { n: a.sinais.mosaico.pessoas })}</small> : null}
                    </div>
                  ) : <p className="al-perfil-nota">{ta.poucosSinais}</p>}
                </>
              ) : <p className="al-perfil-nota">{ta.sinaisFechados}</p>}
            </fieldset>
          </div>

          {a.souMesa ? (
            <aside className="b1-mesa" aria-labelledby={`${id}-mesa`}>
              <h4 id={`${id}-mesa`} className="b1-subtitulo">{ta.mesa}</h4>
              {a.sinais?.haBloqueio ? <p className="b1-bloqueio" role="alert">{ta.haBloqueio}</p> : null}
              <h5 className="b1-mini">{ta.filaDaMesa}</h5>
              {a.fila && a.fila.length > 0 ? (
                <ol className="b1-fila">
                  {a.fila.map((f) => (
                    <li key={f.id} data-posicao={f.posicao}>
                      <span><b>{f.codinome}</b>{f.funcoes.length ? <small> · {f.funcoes.join(", ")}</small> : null}</span>
                      <span className="b1-fila-pos">{ta.posicoes[f.posicao]}</span>
                      <Botao variante="fantasma" tamanho="p" disabled={ocupado} onClick={() => void mesa({ acao: "chamar", fala: f.id })} aria-label={preencher(ta.chamarEsta, { quem: f.codinome })}>▶</Botao>
                    </li>
                  ))}
                </ol>
              ) : <p className="al-perfil-nota">{ta.filaVazia}</p>}
              <div className="b1-botoes">
                <Botao tamanho="p" disabled={ocupado || !a.fila?.length} onClick={() => void mesa({ acao: "chamar" })}>{ta.chamar}</Botao>
                <Botao tamanho="p" variante="contorno" disabled={ocupado || !a.fala} onClick={() => void mesa({ acao: "encerrar_fala" })}>{ta.encerrarFala}</Botao>
                {a.sinais?.abertos ? (
                  <Botao tamanho="p" variante="contorno" disabled={ocupado} onClick={() => void mesa({ acao: "sinais_fechar" })}>{ta.fecharSinais}</Botao>
                ) : (
                  <Botao tamanho="p" variante="claro" disabled={ocupado} onClick={() => void mesa({ acao: "sinais_abrir" })}>{ta.abrirSinais}</Botao>
                )}
              </div>
              <form className="b1-form b1-form-linha" onSubmit={(e) => { e.preventDefault(); void mesa({ acao: "tempo", segundos: Number(tempo) }); }}>
                <label><span>{ta.tempo}</span><input className="al-entrada" type="number" min={30} max={900} step={10} value={tempo} onChange={(e) => setTempo(e.target.value)} /></label>
                <Botao type="submit" tamanho="p" variante="contorno" disabled={ocupado}>{ta.mudarTempo}</Botao>
              </form>
              <label className="b1-form"><span>{ta.irAoPonto}</span>
                <select className="al-entrada" value={a.pontoAtual ?? ""} disabled={ocupado} onChange={(e) => void mesa({ acao: "ponto", ponto: e.target.value })}>
                  {a.pontos.map((p) => <option key={p.id} value={p.id}>{p.ordem}. {p.texto}</option>)}
                </select>
              </label>
              <form className="b1-form b1-carimbar" onSubmit={(e) => {
                e.preventDefault();
                void mesa({ acao: "carimbar", carimbo: carimbo.carimbo, deliberacao: carimbo.deliberacao.trim(), ...(carimbo.carimbo === "aprovado" && carimbo.funcao && carimbo.prazo ? { funcao: carimbo.funcao, prazo: carimbo.prazo } : {}) }).then(() => setCarimbo({ carimbo: "aprovado", deliberacao: "", funcao: "", prazo: "" }));
              }}>
                <fieldset className="b1-carimbos">
                  <legend>{ta.carimbar}</legend>
                  {CARIMBOS.map((c) => (
                    <label key={c} className="b1-carimbo-opcao" data-carimbo={c}>
                      <input type="radio" name={`${id}-carimbo`} checked={carimbo.carimbo === c} onChange={() => setCarimbo({ ...carimbo, carimbo: c })} />
                      <span className="b1-carimbo" data-carimbo={c}>{ta.carimbos[c]}</span>
                    </label>
                  ))}
                </fieldset>
                <label><span>{ta.deliberacao}</span><textarea className="al-entrada" rows={2} maxLength={500} value={carimbo.deliberacao} onChange={(e) => setCarimbo({ ...carimbo, deliberacao: e.target.value })} /></label>
                {carimbo.carimbo === "aprovado" && funcoes.length > 0 ? (
                  <fieldset className="b1-fio">
                    <legend>{ta.virarFio}</legend>
                    <label><span>{ta.funcaoDoFio}</span>
                      <select className="al-entrada" value={carimbo.funcao} onChange={(e) => setCarimbo({ ...carimbo, funcao: e.target.value })}>
                        <option value="">{ta.nenhumaFuncao}</option>
                        {funcoes.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                      </select>
                    </label>
                    {carimbo.funcao ? <label><span>{ta.prazoDoFio}</span><input className="al-entrada" type="date" min={hoje} required value={carimbo.prazo} onChange={(e) => setCarimbo({ ...carimbo, prazo: e.target.value })} /></label> : null}
                  </fieldset>
                ) : null}
                <Botao type="submit" tamanho="p" variante="dourado" disabled={ocupado}>{ta.carimbar}</Botao>
              </form>
              <div className="b1-fechar">
                <label className="b1-form"><span>{ta.publicar}</span>
                  <select className="al-entrada" value={publico} onChange={(e) => setPublico(e.target.value as typeof publico)}>
                    {(["nao", "membros", "seguidores", "internet"] as const).map((p) => <option key={p} value={p}>{ta.publicos[p]}</option>)}
                  </select>
                </label>
                <Botao variante="primario" disabled={ocupado} onClick={() => void fechar()}>{ta.fechar}</Botao>
              </div>
            </aside>
          ) : null}
        </div>
      ) : null}

      {!viva ? (
        <div className="b1-ata-pronta">
          <h4 className="b1-subtitulo">{ta.pronta}</h4>
          {a.post ? <p className="al-ok" role="status">{ta.publicada}</p> : null}
          <pre className="b1-ata-texto" tabIndex={0}>{textoDaAta}</pre>
          <Botao variante="contorno" onClick={() => imprimirAta(a.titulo, textoDaAta)}>{ta.pdf}</Botao>
          <p className="al-perfil-nota">{ta.registra}</p>
        </div>
      ) : null}
      {erro ? <p className="al-perfil-erro" role="alert">{erro}</p> : null}
    </section>
  );
}

/** O texto da ata montado na tela (para ata fechada lida depois): o mesmo formato do banco (interno.alumia_ata_texto). */
function textoLocal(a: AtaViva, t: TextosDaOrgB1): string {
  const linhas = a.pontos.map((p) => `${p.ordem}. ${p.texto} — ${p.carimbo ? t.ata.carimbos[p.carimbo] : t.ata.semCarimbo.toUpperCase()}${p.deliberacao ? `\n   ${p.deliberacao}` : ""}`);
  return `${t.ata.titulo}: ${a.titulo}\n${a.org.codinome || a.org.handle}\n\n${linhas.join("\n")}\n\n${t.ata.registra}`;
}

/** "Baixar em PDF": abre a impressão do navegador só com a ata (escolher "Salvar como PDF"). Sem biblioteca, sem servidor. */
function imprimirAta(titulo: string, texto: string) {
  const quadro = document.createElement("iframe");
  quadro.setAttribute("aria-hidden", "true");
  quadro.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(quadro);
  const doc = quadro.contentDocument;
  if (!doc) return;
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>body{font:14px/1.5 Georgia,serif;margin:2cm;color:#000}h1{font-size:20px}pre{white-space:pre-wrap;font:inherit}</style></head><body><h1>${esc(titulo)}</h1><pre>${esc(texto)}</pre></body></html>`);
  doc.close();
  quadro.contentWindow?.focus();
  quadro.contentWindow?.print();
  setTimeout(() => quadro.remove(), 60_000);
}

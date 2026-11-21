// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os avisos de local no estilo do Waze (/alumia/mapa/avisos), Prompt 4, item 4. A pessoa escolhe o município e anda com as setas
// até a quadra dela num desenho de quadrados de cerca de 200 m (a Alumia não usa o GPS: a política de permissões fecha a posição do
// aparelho, e o navegador mandaria dados a terceiros para achá-la). Só a célula escolhida e a categoria saem do aparelho
// (pedidoDeAviso). Os avisos aparecem sem autor e sem número de relatos, sempre com o rótulo "relato de usuárias, não verificado".
// As áreas seguidas ficam no aparelho. Nenhum push, nenhum serviço de fora, nenhum desenho de mapa baixado de outro lugar.
import "./avisos.css";
import { useCallback, useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { BackendError } from "@/lib/backend";
import {
  CATEGORIAS, LADO_DA_AREA, MOTIVOS_DA_TRAVA, alternarSeguida, andar, areaDe, avisosDaCelula, celulaDoMunicipio, chaveDaArea, chaveDaCelula,
  distanciaERumo, guardarSeguidas, lerSeguidas, meioDaArea, pedidoDeAviso, travada, type Area, type AvisoDeLocal, type Categoria, type Celula,
  type MotivoDaTrava, type Vizinhanca,
} from "@/lib/rede/mapa/avisos";
import { avisosDeLocal } from "@/lib/rede/mapa/cliente-avisos";
import { acharMunicipio, carregarIndice } from "@/lib/rede/mapa/indice";
import { UFS, nomeNaChave, type UF } from "@/lib/rede/mapa/lugar";
import { preencher } from "@/lib/rede/preencher";
import { confirmar } from "@/components/perguntar";
import { FaixaDaPrevia, useTextosAlumia3 } from "../conversa/base3";
import type { PropsDaTelaDoPacote } from "../registro";
import { Botao } from "../ui/Botao";
import { EstadoDaAlumia } from "../ui/Estado";
import { Faixa } from "../ui/Faixa";
import { criarUsoDeTextos, horaCurta } from "./comum";
import type pt from "../../../i18n/rede/avisos-de-local/pt.json";
import { carregarPronto } from "@/lib/rede/textos-prontos";

type T = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../../i18n/rede/avisos-de-local/pt.json"),
  en: () => import("../../../i18n/rede/avisos-de-local/en.json"),
  es: () => import("../../../i18n/rede/avisos-de-local/es.json"),
  fr: () => import("../../../i18n/rede/avisos-de-local/fr.json"),
  ru: () => import("../../../i18n/rede/avisos-de-local/ru.json"),
  zh: () => import("../../../i18n/rede/avisos-de-local/zh.json"),
};
const useTextos = criarUsoDeTextos(async (lang: string) => (await carregarPronto(CARREGAR, lang)) as T);

/** Quantos quadrados de cada lado do escolhido o desenho mostra (7 x 7, cerca de 1,4 km). */
const RAIO = 3;
const HORAS_DA_TRAVA = [1, 3, 6, 12, 24, 48, 72] as const;

/** A frase de um erro do banco: o código inteiro, depois o prefixo antes de ":", depois o genérico. */
function fraseDoErro(t: T, e: unknown): string {
  const codigo = e instanceof BackendError ? e.code : e instanceof Error ? e.message : "";
  const erros = t.erros as Record<string, string>;
  return erros[codigo] ?? erros[codigo.split(":")[0]] ?? t.erros.outro;
}

function guarda(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Uma linha da lista: categoria, estado, rótulo, distância, horários e as ações. */
function LinhaDoAviso({ t, lang, aviso, de, modera, ocupado, aoAindaLa, aoApagar }: {
  t: T; lang: string; aviso: AvisoDeLocal; de: Celula; modera: boolean; ocupado: boolean; aoAindaLa: () => void; aoApagar: () => void;
}) {
  const { metros, rumo } = distanciaERumo(de, aviso);
  return (
    <li className="av-aviso" data-categoria={aviso.categoria} data-confirmado={aviso.confirmado ? "sim" : "nao"}>
      <div className="av-aviso-cabeca">
        <span className="av-marca" aria-hidden />
        <strong className="av-aviso-nome">{t.categorias[aviso.categoria]}</strong>
        <span className="av-estado al-cond">{aviso.confirmado ? t.estado.confirmado : t.estado.semConfirmacao}</span>
      </div>
      <p className="av-rotulo-miudo">{t.rotulo}</p>
      <p className="av-miudo">
        {rumo === "aqui" ? t.lista.aqui : preencher(t.lista.distancia, { metros, rumo: t.rumos[rumo] })}
        {" · "}
        {preencher(t.lista.desde, { hora: horaCurta(lang, aviso.criado_em) })}
        {" · "}
        {preencher(t.lista.ate, { hora: horaCurta(lang, aviso.expira_em) })}
      </p>
      <div className="av-acoes">
        {aviso.renovado ? (
          <span className="av-miudo">{t.lista.renovado}</span>
        ) : (
          <Botao variante="contorno" tamanho="p" disabled={ocupado} onClick={aoAindaLa}>{t.lista.aindaLa}</Botao>
        )}
        {modera && <Botao variante="fantasma" tamanho="p" disabled={ocupado} onClick={aoApagar}>{t.lista.apagar}</Botao>}
      </div>
    </li>
  );
}

export default function TelaDosAvisosDeLocal({ lang }: PropsDaTelaDoPacote) {
  const t = useTextos(lang);
  const t3 = useTextosAlumia3(lang);
  const id = useId();

  // As áreas seguidas: lidas do aparelho (a tela só monta no navegador; o servidor nunca as vê). A célula escolhida fica só na
  // memória desta aba (nunca no armazenamento do aparelho nem no servidor); começa pela primeira área seguida, se houver.
  const [seguidas, setSeguidas] = useState<Area[]>(() => lerSeguidas(guarda()));
  const [celula, setCelula] = useState<Celula | null>(() => (seguidas.length ? meioDaArea(seguidas[0]) : null));
  const [leitura, setLeitura] = useState<{ chave: string; vez: number; viz: Vizinhanca | null; erro: string | null } | null>(null);
  const [vez, setVez] = useState(0);
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [categoria, setCategoria] = useState<Categoria | null>(null);
  const [municipio, setMunicipio] = useState("");
  const [uf, setUf] = useState<UF | "">("");
  const [horas, setHoras] = useState<number>(6);
  const [motivo, setMotivo] = useState<MotivoDaTrava>("abuso");

  const area = celula ? areaDe(celula) : null;
  const chave = area ? chaveDaArea(area) : "";

  useEffect(() => {
    if (!area) return;
    let vivo = true;
    const k = chave, n = vez;
    avisosDeLocal.ver(area).then(
      (v) => vivo && setLeitura({ chave: k, vez: n, viz: v, erro: null }),
      (e: unknown) => vivo && setLeitura((l) => ({ chave: k, vez: n, viz: l?.viz ?? null, erro: e instanceof BackendError ? e.code : "outro" })),
    );
    return () => {
      vivo = false;
    };
    // A área (e não a célula) decide a leitura: andar dentro da mesma área não pede nada de novo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, vez]);

  // A última leitura vale para o desenho até a próxima chegar; o erro e o "carregando" são só os da área de agora.
  const viz = leitura?.viz ?? null;
  const carregando = !leitura || leitura.chave !== chave || leitura.vez !== vez;
  const erroDaLeitura = !carregando ? leitura?.erro ?? null : null;

  const recarregar = useCallback(() => setVez((v) => v + 1), []);

  const ordenados = useMemo(() => {
    if (!viz || !celula) return [];
    return [...viz.avisos].sort((a, b) => distanciaERumo(celula, a).metros - distanciaERumo(celula, b).metros || Number(b.confirmado) - Number(a.confirmado));
  }, [viz, celula]);

  if (!t) return <p role="status" className="av-pagina av-miudo">…</p>;

  const fazer = async (acao: () => Promise<string | null>) => {
    setOcupado(true);
    setMensagem(null);
    try {
      const ok = await acao();
      if (ok) setMensagem({ texto: ok, erro: false });
      recarregar();
    } catch (e) {
      setMensagem({ texto: fraseDoErro(t, e), erro: true });
    } finally {
      setOcupado(false);
    }
  };

  const irAoMunicipio = async () => {
    setMensagem(null);
    const nome = nomeNaChave(municipio);
    if (nome.length < 2) return;
    const indice = await carregarIndice();
    const achado = acharMunicipio(indice, nome, uf || null);
    if (achado.tipo === "municipio") {
      const c = celulaDoMunicipio(achado.municipio);
      if (c) {
        setCelula(c);
        setMensagem({ texto: t.lugar.partida, erro: false });
        return;
      }
    }
    setMensagem({ texto: achado.tipo === "varios" ? t.lugar.varios : t.lugar.naoAchei, erro: true });
  };

  const mover = (dla: number, dlo: number) => setCelula((c) => (c ? andar(c, dla, dlo) : c));
  const teclas = (e: KeyboardEvent<HTMLDivElement>) => {
    const passo = e.shiftKey ? LADO_DA_AREA : 1;
    const mapa: Record<string, [number, number]> = { ArrowUp: [passo, 0], ArrowDown: [-passo, 0], ArrowRight: [0, passo], ArrowLeft: [0, -passo] };
    const m = mapa[e.key];
    if (!m) return;
    e.preventDefault();
    mover(m[0], m[1]);
  };

  const seguida = area ? seguidas.some((a) => chaveDaArea(a) === chave) : false;
  const alternar = () => {
    if (!area) return;
    const novas = alternarSeguida(seguidas, area);
    setSeguidas(novas);
    guardarSeguidas(guarda(), novas);
  };

  const areaTravada = !!(viz && area && travada(viz, area));
  const travaDaArea = viz && area ? viz.travadas.find((x) => x.ala === area.ala && x.alo === area.alo) : undefined;

  const avisar = () => {
    if (!celula || !categoria) return;
    // O pedido sai daqui já arredondado: os dois inteiros da célula e a categoria (pedidoDeAviso confere antes).
    pedidoDeAviso(celula, categoria);
    void fazer(async () => {
      if (!(await confirmar(preencher(t.avisar.pergunta, { categoria: t.categorias[categoria] }), { sim: t.avisar.enviar }))) return null;
      const r = await avisosDeLocal.avisar(celula, categoria);
      setCategoria(null);
      return r.novo ? t.avisar.novo : t.avisar.confirmou;
    });
  };

  // O desenho: 7 x 7 quadrados, o norte em cima. Cada quadrado é um botão que escolhe a célula.
  const linhas: Celula[][] = [];
  if (celula) {
    for (let dla = RAIO; dla >= -RAIO; dla--) {
      const linha: Celula[] = [];
      for (let dlo = -RAIO; dlo <= RAIO; dlo++) linha.push({ la: celula.la + dla, lo: celula.lo + dlo });
      linhas.push(linha);
    }
  }

  return (
    <article className="av-pagina" aria-labelledby={`${id}-titulo`}>
      {t3 && <FaixaDaPrevia t={t3} />}
      <header className="av-cabeca">
        <Faixa className="av-faixa" />
        <p className="av-carimbo al-cond">{t.carimbo}</p>
        <h1 id={`${id}-titulo`} className="av-titulo al-cond">{t.titulo}</h1>
        <p className="av-chamada">{t.chamada}</p>
        <p className="av-rotulo" role="note">{t.rotulo}</p>
      </header>

      <section className="av-privacidade" aria-label={t.rotulo}>
        <p>{t.anonimato}</p>
        <p>{t.semPush}</p>
        <p>{t.soMembros}</p>
      </section>

      <div className="av-colunas">
        <div className="av-principal">
          <section className="av-bloco" aria-labelledby={`${id}-onde`}>
            <h2 id={`${id}-onde`} className="av-subtitulo al-cond">{t.lugar.titulo}</h2>
            <p className="av-miudo">{t.lugar.ajuda}</p>
            <form
              className="av-municipio"
              onSubmit={(e) => {
                e.preventDefault();
                void irAoMunicipio();
              }}
            >
              <label className="av-campo">
                <span>{t.lugar.municipio}</span>
                <input className="al2-campo" value={municipio} onChange={(e) => setMunicipio(e.target.value)} autoComplete="off" maxLength={80} />
              </label>
              <label className="av-campo av-campo-uf">
                <span>{t.lugar.uf}</span>
                <select className="al2-campo" value={uf} onChange={(e) => setUf(e.target.value as UF | "")}>
                  <option value="">—</option>
                  {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </label>
              <Botao type="submit" variante="contorno">{t.lugar.ir}</Botao>
            </form>

            {seguidas.length > 0 && (
              <div className="av-seguidas">
                <p className="av-rotulo-campo">{t.lugar.seguidas}</p>
                <div className="av-acoes">
                  {seguidas.map((a, i) => (
                    <Botao key={chaveDaArea(a)} variante="fantasma" tamanho="p" pressionado={chaveDaArea(a) === chave} onClick={() => setCelula(meioDaArea(a))}>
                      {preencher(t.lugar.irParaSeguida, { n: i + 1 })}
                    </Botao>
                  ))}
                </div>
                <p className="av-miudo">{t.lugar.seguidasAjuda}</p>
              </div>
            )}

            {mensagem && <p className={mensagem.erro ? "av-erro" : "av-ok"} role={mensagem.erro ? "alert" : "status"}>{mensagem.texto}</p>}

            {!celula ? (
              <p className="av-miudo">{t.lugar.semLugar}</p>
            ) : (
              <>
                <div className="av-desenho-caixa">
                  <div className="av-setas" role="group" aria-label={t.lugar.titulo}>
                    <Botao variante="contorno" tamanho="p" className="av-seta" data-rumo="n" onClick={() => mover(1, 0)} aria-label={t.lugar.norte}>↑</Botao>
                    <Botao variante="contorno" tamanho="p" className="av-seta" data-rumo="o" onClick={() => mover(0, -1)} aria-label={t.lugar.oeste}>←</Botao>
                    <Botao variante="contorno" tamanho="p" className="av-seta" data-rumo="l" onClick={() => mover(0, 1)} aria-label={t.lugar.leste}>→</Botao>
                    <Botao variante="contorno" tamanho="p" className="av-seta" data-rumo="s" onClick={() => mover(-1, 0)} aria-label={t.lugar.sul}>↓</Botao>
                  </div>
                  <div
                    className="av-desenho"
                    role="grid"
                    aria-label={t.lugar.desenho}
                    tabIndex={0}
                    onKeyDown={teclas}
                  >
                    {linhas.map((linha) => (
                      <div role="row" className="av-linha" key={linha[0].la}>
                        {linha.map((c) => {
                          const daqui = viz ? avisosDaCelula(viz, c) : [];
                          const meio = c.la === celula.la && c.lo === celula.lo;
                          const confirmado = daqui.some((a) => a.confirmado);
                          const nomes = daqui.map((a) => t.categorias[a.categoria]).join(", ");
                          return (
                            <button
                              key={chaveDaCelula(c)}
                              type="button"
                              role="gridcell"
                              tabIndex={-1}
                              className="av-quadrado"
                              data-meio={meio ? "sim" : undefined}
                              data-aviso={daqui.length ? (confirmado ? "confirmado" : "sim") : undefined}
                              data-categoria={daqui[0]?.categoria}
                              aria-selected={meio}
                              aria-label={[meio ? t.lugar.escolhido : "", nomes].filter(Boolean).join(": ") || undefined}
                              title={nomes || undefined}
                              onClick={() => setCelula(c)}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <div className="av-pulos">
                    <Botao variante="fantasma" tamanho="p" onClick={() => mover(LADO_DA_AREA, 0)}>{t.lugar.pularNorte}</Botao>
                    <Botao variante="fantasma" tamanho="p" onClick={() => mover(-LADO_DA_AREA, 0)}>{t.lugar.pularSul}</Botao>
                    <Botao variante="fantasma" tamanho="p" onClick={() => mover(0, -LADO_DA_AREA)}>{t.lugar.pularOeste}</Botao>
                    <Botao variante="fantasma" tamanho="p" onClick={() => mover(0, LADO_DA_AREA)}>{t.lugar.pularLeste}</Botao>
                  </div>
                  <p className="av-legenda av-miudo">
                    <span className="av-legenda-meio" aria-hidden /> {t.lugar.escolhido}
                    <span className="av-legenda-aviso" aria-hidden /> {t.lugar.comAvisos}
                  </p>
                </div>
                <Botao variante="contorno" tamanho="p" pressionado={seguida} onClick={alternar}>
                  {seguida ? t.lugar.deixarDeSeguir : t.lugar.seguir}
                </Botao>
              </>
            )}
          </section>

          {celula && (
            <section className="av-bloco" aria-labelledby={`${id}-avisar`}>
              <h2 id={`${id}-avisar`} className="av-subtitulo al-cond">{t.avisar.titulo}</h2>
              {areaTravada ? (
                <p className="av-erro" role="status">{t.avisar.travada}</p>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    avisar();
                  }}
                >
                  <p className="av-miudo">{t.avisar.texto}</p>
                  <fieldset className="av-categorias">
                    <legend className="av-rotulo-campo">{t.avisar.categoria}</legend>
                    {CATEGORIAS.map((c) => (
                      <label key={c} className="av-categoria" data-categoria={c}>
                        <input type="radio" name={`${id}-categoria`} value={c} checked={categoria === c} onChange={() => setCategoria(c)} />
                        <span className="av-marca" aria-hidden />
                        <span>{t.categorias[c]}</span>
                      </label>
                    ))}
                  </fieldset>
                  <Botao type="submit" variante="primario" disabled={!categoria || ocupado}>{ocupado ? t.avisar.enviando : t.avisar.enviar}</Botao>
                </form>
              )}
            </section>
          )}
        </div>

        {celula && (
          <div className="av-lado">
            <section className="av-bloco" aria-labelledby={`${id}-lista`} aria-busy={carregando}>
              <h2 id={`${id}-lista`} className="av-subtitulo al-cond">{t.lista.titulo}</h2>
              {erroDaLeitura ? (
                <EstadoDaAlumia erro texto={fraseDoErro(t, new BackendError(erroDaLeitura))}>
                  <Botao variante="contorno" onClick={recarregar}>{t.tentar}</Botao>
                </EstadoDaAlumia>
              ) : !viz ? (
                <p role="status" className="av-miudo">{t.carregando}</p>
              ) : ordenados.length === 0 ? (
                <p className="av-miudo">{t.lista.vazia}</p>
              ) : (
                <ul className="av-lista">
                  {ordenados.map((a) => (
                    <LinhaDoAviso
                      key={a.id}
                      t={t}
                      lang={lang}
                      aviso={a}
                      de={celula}
                      modera={viz.modera}
                      ocupado={ocupado}
                      aoAindaLa={() => void fazer(async () => (await avisosDeLocal.aindaLa(a.id), t.lista.aindaLaFeito))}
                      aoApagar={() =>
                        void fazer(async () => {
                          if (!(await confirmar(t.lista.perguntaApagar, { perigo: true, sim: t.lista.apagar }))) return null;
                          await avisosDeLocal.apagar(a.id);
                          return t.lista.apagado;
                        })
                      }
                    />
                  ))}
                </ul>
              )}
            </section>

            {viz?.modera && area && (
              <section className="av-bloco av-moderacao" aria-labelledby={`${id}-moderacao`}>
                <h2 id={`${id}-moderacao`} className="av-subtitulo al-cond">{t.moderacao.titulo}</h2>
                <p className="av-miudo">{t.moderacao.texto}</p>
                {travaDaArea ? (
                  <>
                    <p className="av-erro" role="status">{preencher(t.moderacao.travadaAte, { hora: horaCurta(lang, travaDaArea.ate) })}</p>
                    <Botao variante="contorno" disabled={ocupado} onClick={() => void fazer(async () => (await avisosDeLocal.destravar(area), t.moderacao.feito))}>
                      {t.moderacao.destravar}
                    </Botao>
                  </>
                ) : (
                  <form
                    className="av-trava"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void fazer(async () => (await avisosDeLocal.travar(area, horas, motivo), t.moderacao.feito));
                    }}
                  >
                    <label className="av-campo">
                      <span>{t.moderacao.horas}</span>
                      <select className="al2-campo" value={horas} onChange={(e) => setHoras(Number(e.target.value))}>
                        {HORAS_DA_TRAVA.map((h) => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </label>
                    <label className="av-campo">
                      <span>{t.moderacao.motivo}</span>
                      <select className="al2-campo" value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoDaTrava)}>
                        {MOTIVOS_DA_TRAVA.map((m) => <option key={m} value={m}>{t.moderacao.motivos[m]}</option>)}
                      </select>
                    </label>
                    <Botao type="submit" variante="contorno" disabled={ocupado}>{t.moderacao.travar}</Botao>
                  </form>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

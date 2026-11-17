// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// As minhas conquistas (/alumia/conquistas, frente 11E): as medalhas, cada uma com o interruptor "Mostrar no perfil" (todas nascem
// escondidas), as trilhas terminadas (sugeridas pelas aulas concluídas NESTE aparelho, que só vão ao banco quando a pessoa toca) e
// a faixa de ajuda com a regra escrita, desligada por padrão. Nada de placar: o progresso só aparece aqui, para a dona.
import "./conquistas.css";
import { useCallback, useEffect, useId, useState } from "react";
import { EsqueletoDaLinha } from "../../Esqueletos";
import { Confirmar, Torradas, useTorrada } from "../../conversa/base3";
import type { PropsDaTelaDoPacote } from "../../registro";
import { Botao, LinkBotao } from "../../ui/Botao";
import { conquistas } from "./cliente";
import { Emblema, nomeDaMedalha } from "./Emblema";
import { FAIXAS, faltamPara, trilhaOk, trilhasDoAparelho, type Faixa, type MinhaMedalha, type MinhasConquistas } from "./regras";
import { por, textoDoErro, type TextosDasConquistas } from "./textos";
import { useNomesDasTrilhas, type NomesDasTrilhas } from "./usarNomesDasTrilhas";
import { useTextosDasConquistas } from "./usarTextos";

function concluidasNoAparelho(): string[] {
  try {
    const bruto = window.localStorage.getItem("lucia:concluidas");
    const lista: unknown = bruto ? JSON.parse(bruto) : [];
    return Array.isArray(lista) ? lista.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export default function TelaConquistas({ lang, situacao }: PropsDaTelaDoPacote) {
  const t = useTextosDasConquistas(lang);
  const trilhas = useNomesDasTrilhas(lang);
  const [dado, setDado] = useState<MinhasConquistas | null>(null);
  const [erro, setErro] = useState("");
  const [rodada, setRodada] = useState(0);
  const torradas = useTorrada();
  const avisar = torradas.mostrar;

  useEffect(() => {
    if (!t) return;
    let vivo = true;
    conquistas
      .minhas()
      .then((d) => vivo && (setDado(d), setErro("")))
      .catch((e) => vivo && setErro(textoDoErro(t.erros, e)));
    return () => {
      vivo = false;
    };
  }, [t, rodada]);

  const recarregar = useCallback(() => setRodada((n) => n + 1), []);
  const aoErro = useCallback((e: unknown) => t && avisar({ texto: textoDoErro(t.erros, e), erro: true }), [t, avisar]);
  const aoOk = useCallback((texto: string) => avisar({ texto }), [avisar]);

  if (!t) return <EsqueletoDaLinha rotulo="" quantos={3} />;
  if (!situacao.logado) return <div className="cq cq-vazio-tela"><p>{t.erros.nao_encontrado}</p></div>;
  if (!dado && !erro) return <EsqueletoDaLinha rotulo={t.carregando} quantos={3} />;
  if (!dado) {
    return (
      <div className="cq cq-vazio-tela" role="alert">
        <p>{erro}</p>
        <Botao variante="contorno" onClick={recarregar}>{t.tentar}</Botao>
      </div>
    );
  }

  return (
    <div className="cq">
      <header className="cq-alto">
        <p className="cq-carimbo al-cond">{t.tela.carimbo}</p>
        <h1 className="cq-titulo al-cond">{t.tela.titulo}</h1>
        <p className="cq-lead">{t.tela.lead}</p>
        <div className="cq-alto-acoes">
          <LinkBotao variante="contorno" tamanho="m" href={`/${lang}/alumia/aprovados`}>{t.tela.verMural}</LinkBotao>
        </div>
      </header>
      <div className="cq-duas">
        <div className="cq" style={{ padding: 0 }}>
          <Medalhas t={t} trilhas={trilhas} medalhas={dado.medalhas} aoMudar={recarregar} aoErro={aoErro} aoOk={aoOk} />
          <Trilhas t={t} trilhas={trilhas} medalhas={dado.medalhas} aoMudar={recarregar} aoErro={aoErro} />
        </div>
        <FaixaDeAjuda t={t} faixa={dado.faixa} aoMudar={recarregar} aoErro={aoErro} aoOk={aoOk} />
      </div>
      <Torradas estado={torradas} />
    </div>
  );
}

interface PropsDeAcao {
  t: TextosDasConquistas;
  aoMudar: () => void;
  aoErro: (e: unknown) => void;
}

function Chave({ ligada, rotulo, ocupado, aoTrocar }: { ligada: boolean; rotulo: string; ocupado: boolean; aoTrocar: () => void }) {
  return (
    <button type="button" className="cq-chave" aria-pressed={ligada} disabled={ocupado} onClick={aoTrocar}>
      <span className="cq-chave-trilho" aria-hidden="true" />
      {rotulo}
    </button>
  );
}

function Medalhas({ t, trilhas, medalhas, aoMudar, aoErro, aoOk }: PropsDeAcao & { trilhas: NomesDasTrilhas; medalhas: MinhaMedalha[]; aoOk: (texto: string) => void }) {
  const id = useId();
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [apagando, setApagando] = useState<MinhaMedalha | null>(null);
  const chave = (m: MinhaMedalha) => `${m.medalha}:${m.alvo}`;

  async function trocar(m: MinhaMedalha) {
    setOcupada(chave(m));
    try {
      await conquistas.mostrar(m.medalha, m.alvo, !m.mostrar);
      aoMudar();
    } catch (e) {
      aoErro(e);
    } finally {
      setOcupada(null);
    }
  }

  return (
    <section className="cq-secao" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="cq-subtitulo al-cond">{t.tela.medalhasTitulo}</h2>
      {medalhas.length === 0 ? (
        <p className="cq-vazio">{t.tela.vazio}</p>
      ) : (
        <ul className="cq-medalhas">
          {medalhas.map((m) => {
            const falta = faltamPara(m.medalha, m.progresso);
            return (
              <li key={chave(m)} className="cq-medalha" data-mostrar={m.mostrar ? "sim" : undefined}>
                <Emblema medalha={m.medalha} nivel={m.nivel} />
                <div>
                  <p className="cq-medalha-rotulo al-cond">{t.medalhas[m.medalha].rotulo}</p>
                  {m.medalha === "trilha" && !trilhas.pronta ? (
                    <p className="cq-medalha-nome"><span className="cq-esqueleto" aria-hidden /></p>
                  ) : (
                    <p className="cq-medalha-nome">{nomeDaMedalha(t, m.medalha, m.alvo, m.nivel, trilhas.nome)}</p>
                  )}
                  {m.medalha === "trilha" ? (
                    <p className="cq-medalha-info">{t.medalhas.trilha.como}</p>
                  ) : (
                    <p className="cq-medalha-info">
                      {por(t.tela.nivel, { n: m.nivel })} · {por(t.tela.feitos, { n: m.progresso })} {falta === null ? t.tela.topo : por(t.tela.faltam, { n: falta })}
                    </p>
                  )}
                  <div className="cq-medalha-acoes">
                    {m.nivel > 0 && <Chave ligada={m.mostrar} rotulo={t.tela.mostrar} ocupado={ocupada === chave(m)} aoTrocar={() => void trocar(m)} />}
                    <span className="cq-estado" data-mostrar={m.mostrar ? "sim" : undefined}>{m.mostrar ? t.tela.noPerfil : t.tela.escondida}</span>
                    <button type="button" className="cq-link cq-link-perigo" onClick={() => setApagando(m)}>{t.tela.apagar}</button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Confirmar
        aberto={apagando !== null}
        titulo={t.tela.apagarTitulo}
        texto={t.tela.apagarTexto}
        sim={t.tela.apagarSim}
        nao={t.tela.nao}
        aoFechar={() => setApagando(null)}
        aoSim={() => {
          const m = apagando;
          if (!m) return;
          conquistas
            .apagar(m.medalha, m.alvo)
            .then(() => (aoOk(t.ok.apagada), aoMudar()))
            .catch(aoErro);
        }}
      />
    </section>
  );
}

function Trilhas({ t, trilhas, medalhas, aoMudar, aoErro }: PropsDeAcao & { trilhas: NomesDasTrilhas; medalhas: MinhaMedalha[] }) {
  const id = useId();
  const [sugeridas, setSugeridas] = useState<string[]>([]);
  const [outra, setOutra] = useState("");
  const [ocupada, setOcupada] = useState<string | null>(null);
  useEffect(() => {
    const relogio = window.setTimeout(() => setSugeridas(trilhasDoAparelho(concluidasNoAparelho())), 0);
    return () => window.clearTimeout(relogio);
  }, []);
  const marcadas = new Set(medalhas.filter((m) => m.medalha === "trilha").map((m) => m.alvo));
  const lista = [...new Set([...sugeridas, ...marcadas])].sort((a, b) => trilhas.nome(a).localeCompare(trilhas.nome(b)));
  // "Outra trilha" é uma escolha entre as trilhas do site que existem (e ainda não estão marcadas).
  const outras = trilhas.lista.filter((x) => !marcadas.has(x.slug));

  async function trocar(trilha: string, ligar: boolean) {
    setOcupada(trilha);
    try {
      await conquistas.trilha(trilha, ligar);
      aoMudar();
      if (ligar) setOutra("");
    } catch (e) {
      aoErro(e);
    } finally {
      setOcupada(null);
    }
  }
  const outraLimpa = outra.trim().toLowerCase();

  return (
    <section className="cq-secao" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="cq-subtitulo al-cond">{t.trilhas.titulo}</h2>
      <p className="cq-nota">{t.trilhas.lead}</p>
      {lista.length === 0 ? (
        <p className="cq-vazio" style={{ marginTop: "0.6rem" }}>{t.trilhas.nenhuma}</p>
      ) : (
        <ul className="cq-ladrilhos" aria-label={t.trilhas.sugestoes}>
          {lista.map((trilha) => {
            const marcada = marcadas.has(trilha);
            return (
              <li key={trilha}>
                <button type="button" className="cq-ladrilho" aria-pressed={marcada} disabled={ocupada === trilha} onClick={() => void trocar(trilha, !marcada)}>
                  <Emblema medalha="trilha" nivel={marcada ? 1 : 0} pequeno />
                  <span className="cq-ladrilho-nome">{trilhas.pronta ? trilhas.nome(trilha) : <span className="cq-esqueleto" aria-hidden />}</span>
                  <span className="cq-ladrilho-acao">{marcada ? t.trilhas.marcada : t.trilhas.terminei}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {/* "Outra trilha" é uma escolha da lista do site: enquanto ela chega, esqueleto; sem lista (ou sem nenhuma a marcar), nada. */}
      {!trilhas.pronta && <div className="cq-outra"><span className="cq-esqueleto cq-esqueleto-campo" aria-hidden /></div>}
      {trilhas.pronta && outras.length > 0 && (
      <form
        className="cq-outra"
        onSubmit={(e) => {
          e.preventDefault();
          if (trilhaOk(outraLimpa)) void trocar(outraLimpa, true);
          else aoErro(new Error("invalido:trilha"));
        }}
      >
        <div className="cq-campo">
          <label htmlFor={`${id}-outra`}>{t.trilhas.outra}</label>
          <select id={`${id}-outra`} value={outra} onChange={(e) => setOutra(e.target.value)}>
            <option value="">{t.trilhas.escolher}</option>
            {outras.map((x) => (
              <option key={x.slug} value={x.slug}>{x.titulo}</option>
            ))}
          </select>
        </div>
        <Botao type="submit" variante="contorno" disabled={!outraLimpa || ocupada !== null}>{t.trilhas.marcar}</Botao>
      </form>
      )}
    </section>
  );
}

function FaixaDeAjuda({ t, faixa, aoMudar, aoErro, aoOk }: PropsDeAcao & { faixa: MinhasConquistas["faixa"]; aoOk: (texto: string) => void }) {
  const id = useId();
  const [ocupado, setOcupado] = useState(false);
  async function trocar() {
    setOcupado(true);
    try {
      await conquistas.faixa(!faixa.mostrar);
      aoOk(t.ok.salvo);
      aoMudar();
    } catch (e) {
      aoErro(e);
    } finally {
      setOcupado(false);
    }
  }
  return (
    <section className="cq-secao" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="cq-subtitulo al-cond">{t.faixa.titulo}</h2>
      <p className="cq-nota" style={{ color: "var(--al-texto-2)", fontSize: "0.92rem" }}>{t.faixa.lead}</p>
      <p className="cq-nota" style={{ marginTop: "0.8rem", fontWeight: 700 }}>{t.faixa.regra}</p>
      <ol className="cq-faixas">
        {FAIXAS.map((f, i) => (
          <li key={f} className="cq-faixa" data-minha={faixa.faixa === f ? "sim" : undefined}>
            <span className="cq-faixa-marca" aria-hidden="true">
              {[0, 1, 2].map((k) => <i key={k} data-aceso={k <= i ? "" : undefined} />)}
            </span>
            <span className="cq-faixa-nome">{t.faixas[f].nome}</span>
            <span className="cq-faixa-texto">{t.faixas[f].texto}</span>
          </li>
        ))}
      </ol>
      <div className="cq-hoje">
        <span className="cq-hoje-rotulo">{t.faixa.suaHoje}</span>
        {faixa.faixa ? <span className="cq-selo al-cond">{t.faixas[faixa.faixa as Faixa].nome}</span> : <span className="cq-nota" style={{ margin: 0 }}>{t.faixa.nenhumaAinda}</span>}
      </div>
      <div className="cq-acoes">
        <Chave ligada={faixa.mostrar} rotulo={t.faixa.ligar} ocupado={ocupado} aoTrocar={() => void trocar()} />
      </div>
      <p className="cq-nota">{faixa.mostrar ? t.faixa.ligada : t.faixa.desligada}</p>
    </section>
  );
}

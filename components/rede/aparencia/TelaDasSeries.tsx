// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { b1 } from "@/lib/rede/cliente-b1";
import { preencher } from "@/lib/rede/preencher";
import type { SerieAgendada } from "@/lib/rede/tipos-b1";
import { erroDaB1, quandoCurto, useTextosB1 } from "../b1/base";
import { Confirmar, FaixaDaPrevia, previa, Torradas, useTextosAlumia3, useTorrada } from "../conversa/base3";
import { EsqueletoDaLinha } from "../Esqueletos";
import { Icone } from "../publicar/alumia2/icones";
import type { PropsDaTelaDoPacote } from "../registro";
import { Botao } from "../ui/Botao";
import { EstadoDaAlumia } from "../ui/Estado";
import { useTextosDoAcabamento } from "./base";

const DIA = 86_400_000;

/** As séries de exemplo da prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim): nada disto vai ao banco. */
function seriesDaPrevia(): SerieAgendada[] {
  const em = (dias: number, hora: number) => {
    const d = new Date(Date.now() + dias * DIA);
    d.setHours(hora, 0, 0, 0);
    return d.toISOString();
  };
  return [
    { serie: "previa-1", id: "previa-a1", quando: em(2, 19), repetir: "semanal", ate: em(86, 19), vez: 3, total: 12, texto: "Assembleia do núcleo toda terça, 19h, na sede. Pauta aberta: quem chega propõe. #passelivre" },
    { serie: "previa-2", id: "previa-a2", quando: em(9, 10), repetir: "quinzenal", ate: em(170, 10), vez: 1, total: null, texto: "Mutirão de panfletagem no terminal. Quem puder leva água e protetor. Ponto de encontro: catraca 3." },
    { serie: "previa-3", id: "previa-a3", quando: em(21, 18), repetir: "mensal", ate: null, vez: 5, total: 12, texto: "Prestação de contas do caixa do coletivo: entra quanto, sai quanto, com recibo. Aberta a todo mundo." },
  ];
}

/**
 * Posts que se repetem (/alumia/series): o que a pessoa agendou para sair toda semana, a cada 15 dias ou todo mês
 * (rede_alumia_series), com a próxima data, em que vez está, até quando vai e o botão de parar. A lista é só dela. Parar pede
 * confirmação (as próximas não saem; o que já foi publicado fica) e a linha some com o aviso.
 */
export default function TelaDasSeries({ lang, s, situacao, aoEscrever }: PropsDaTelaDoPacote) {
  const t = useTextosDoAcabamento(lang);
  const tb = useTextosB1(lang);
  const t3 = useTextosAlumia3(lang);
  const torradas = useTorrada();
  const [itens, setItens] = useState<SerieAgendada[]>([]);
  const [estado, setEstado] = useState<"carregando" | "ok" | "erro">("carregando");
  const [erro, setErro] = useState("");
  const [parando, setParando] = useState<SerieAgendada | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const botaoDeParar = useRef<HTMLElement | null>(null);
  const membro = situacao.logado && situacao.membro;

  // `vez` muda no "Tentar de novo" (que já põe a tela em "carregando" antes de pedir de novo).
  const [vez, setVez] = useState(0);
  useEffect(() => {
    if (!membro) return;
    let vivo = true;
    (previa() ? Promise.resolve({ itens: seriesDaPrevia() }) : b1.series())
      .then((r) => {
        if (!vivo) return;
        setItens(r.itens ?? []);
        setEstado("ok");
      })
      .catch((e) => {
        if (!vivo) return;
        setErro(tb ? erroDaB1(s, tb, e) : s.estados.erro);
        setEstado("erro");
      });
    return () => {
      vivo = false;
    };
  }, [membro, s, tb, vez]);
  const carregar = () => {
    setEstado("carregando");
    setVez((n) => n + 1);
  };

  async function parar(serie: SerieAgendada) {
    if (!tb) return;
    setOcupada(serie.serie);
    try {
      if (!previa()) await b1.pararSerie(serie.serie);
      setItens((atual) => atual.filter((x) => x.serie !== serie.serie));
      torradas.mostrar({ texto: tb.serie.parada });
    } catch (e) {
      torradas.mostrar({ texto: erroDaB1(s, tb, e), erro: true });
    } finally {
      setOcupada(null);
    }
  }

  if (!t || !tb || !t3) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />;
  const x = t.series;
  return (
    <section className="ac-tela" aria-labelledby="ac-series-titulo">
      <FaixaDaPrevia t={t3} />
      <header className="ac-cabeca">
        <h1 id="ac-series-titulo" className="al-cond ac-titulo">{x.titulo}</h1>
        <p className="ac-lead">{x.lead}</p>
        <p className="ac-dica">{tb.serie.dica}</p>
      </header>

      {!membro ? (
        <EstadoDaAlumia icone="cadeado" texto={x.entre} />
      ) : estado === "carregando" ? (
        <div role="status" aria-label={s.estados.carregando}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="ac-esqueleto" aria-hidden>
              <span />
              <span />
              <span />
            </div>
          ))}
        </div>
      ) : estado === "erro" ? (
        <EstadoDaAlumia erro titulo={x.erroTitulo} texto={erro || s.estados.erro}>
          <Botao variante="claro" onClick={() => carregar()}>{x.tentar}</Botao>
        </EstadoDaAlumia>
      ) : itens.length === 0 ? (
        <EstadoDaAlumia mosaico titulo={x.vazioTitulo} texto={x.vazio}>
          <Botao variante="primario" icone={<Icone nome="escrever" className="h-5 w-5" />} onClick={() => aoEscrever()}>{x.escrever}</Botao>
        </EstadoDaAlumia>
      ) : (
        <ol className="ac-itens" aria-label={x.titulo}>
          {itens.map((serie) => (
            <li key={serie.serie} className="ac-item">
              <div className="ac-item-corpo">
                <span className="ac-selo al-cond">
                  <Icone nome="repetir" />
                  {tb.serie[serie.repetir]}
                </span>
                <p className="ac-item-texto">{serie.texto?.trim() || x.semTexto}</p>
                <p className="ac-item-meta">
                  <strong>{preencher(tb.serie.proxima, { quando: quandoCurto(lang, serie.quando) })}</strong>
                  <span>{serie.total ? preencher(x.deVezes, { n: serie.vez, total: serie.total }) : preencher(tb.serie.vez, { n: serie.vez })}</span>
                  {serie.ate && <span>{preencher(x.ate, { quando: new Intl.DateTimeFormat(lang, { dateStyle: "medium" }).format(new Date(serie.ate)) })}</span>}
                </p>
              </div>
              <Botao
                variante="contorno"
                tamanho="p"
                disabled={ocupada === serie.serie}
                onClick={(e) => {
                  botaoDeParar.current = e.currentTarget;
                  setParando(serie);
                }}
              >
                {tb.serie.parar}
              </Botao>
            </li>
          ))}
        </ol>
      )}

      <Confirmar
        aberto={parando !== null}
        titulo={x.confirmarTitulo}
        texto={x.confirmarTexto}
        sim={tb.serie.parar}
        nao={x.manter}
        aoSim={() => {
          const serie = parando;
          setParando(null);
          if (serie) void parar(serie);
        }}
        aoFechar={() => setParando(null)}
        voltarPara={botaoDeParar}
      />
      <Torradas estado={torradas} />
    </section>
  );
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O "Perto" (/alumia/perto; Prompt 4, itens 2, 7 e 8), atrás de "alumia-p4-perto":
//   - pedir ajuda (7): com confirmação, a posição exata vai cifrada ao círculo;
//   - volta para casa (8): o cronômetro só neste aparelho; o último aviso e o envio ficam com a vigia da casca (VigiaDoPerto);
//   - compartilhar onde estou (2): por 15 min, 1 h, 8 h ou até parar, exata ou só o bairro, só com o círculo;
//   - quem compartilha comigo: só a última posição de cada pessoa, enquanto vale;
//   - o círculo: os contatos de segurança do modo ato que aceitaram, e a conversa do chat de cada um.
// Nenhum número abaixo de 3 sobre outras pessoas aparece: os números aqui são só do próprio círculo da pessoa (que ela mesma escolheu).
import "./perto.css";
import { useEffect, useId, useState, type ReactNode } from "react";
import Link from "@/components/Link";
import { confirmar } from "@/components/perguntar";
import { previaLigada } from "@/lib/rede/publicar/alumia2";
import { abrirConversa, compartilhar, exemploDaPrevia, mandarUmaVez, pedirAjuda, pedirLocalizacao, volta } from "@/lib/rede/perto/cliente";
import { PRAZOS, type Prazo, type Precisao } from "@/lib/rede/perto/posicao";
import { faseDaVolta, MAIOR_VOLTA_MIN, MENOR_VOLTA_MIN, MINUTOS_DA_VOLTA } from "@/lib/rede/perto/volta";
import type { PropsDaTelaDoPacote } from "../registro";
import { useAcao } from "./acao";
import { PedidosDeLocalizacao } from "./Pedidos";
import { UmaPosicao } from "./Recebidas";
import { horaNoIdioma, por, tempoCurto, textoDoErro, type TextosDoPerto } from "./textos";
import { useAgora, useCirculo, useCompartilhar, useRecebidas, useVolta } from "./usar";
import { useTextosDoPerto } from "./usarTextos";

type T = TextosDoPerto;

function Bloco({ id, titulo, texto, children, perigo }: { id: string; titulo: string; texto?: string; children: ReactNode; perigo?: boolean }) {
  return (
    <section className={`pt-bloco${perigo ? " pt-bloco-perigo" : ""}`} aria-labelledby={id} data-bloco={id}>
      <h2 id={id} className="al-cond">{titulo}</h2>
      {texto && <p className="pt-texto">{texto}</p>}
      {children}
    </section>
  );
}

// ───── Pedir ajuda (7) ─────
function PedirAjuda({ t, prontas }: { t: T; prontas: string[] }) {
  const { ocupado, fazer, avisos } = useAcao(t);
  const pedir = () =>
    fazer(async () => {
      if (!prontas.length) throw Object.assign(new Error("sem_circulo"), { code: "sem_circulo" });
      if (!(await confirmar(por(t.sos.confirmar, { n: prontas.length }), { perigo: true, sim: t.sos.sim }))) return;
      const r = await pedirAjuda(prontas);
      return por(r.semPosicao ? t.sos.enviadoSemPosicao : t.sos.enviado, { n: r.entregues });
    });
  return (
    <Bloco id="pt-sos" titulo={t.sos.titulo} texto={t.sos.texto} perigo>
      <button type="button" className="al-botao al-botao-primario al-botao-g pt-sos" disabled={ocupado} onClick={() => void pedir()}>
        {t.sos.botao}
      </button>
      {!prontas.length && <p className="pt-nota">{t.sos.ninguem}</p>}
      {avisos}
    </Bloco>
  );
}

// ───── Volta para casa (8) ─────
function VoltaParaCasa({ t, prontas }: { t: T; prontas: string[] }) {
  const v = useVolta();
  const agora = useAgora(1000);
  const [minutos, setMinutos] = useState(40);
  const [outro, setOutro] = useState("");
  const { ocupado, fazer, avisos } = useAcao(t);
  const idOutro = useId();
  const fase = v ? faseDaVolta(v, agora) : null;
  const cheguei = (estouBem: boolean) =>
    fazer(async () => {
      const r = await volta.cheguei(estouBem);
      return r ? por(t.volta.estouBem, { n: r.avisados }) : t.volta.parou;
    });
  return (
    <Bloco id="pt-volta" titulo={t.volta.titulo} texto={t.volta.texto}>
      {!v ? (
        <div className="pt-form">
          <fieldset className="pt-opcoes">
            <legend>{t.compartilhar.prazo}</legend>
            <div className="pt-pilulas">
              {MINUTOS_DA_VOLTA.map((m) => (
                <label key={m} className="pt-pilula">
                  <input type="radio" name="pt-volta-min" checked={!outro && minutos === m} onChange={() => (setMinutos(m), setOutro(""))} />
                  <span>{por(t.volta.minutos, { n: m })}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="pt-campo" htmlFor={idOutro}>
            <span>{t.volta.outro}</span>
            <input id={idOutro} type="number" inputMode="numeric" min={MENOR_VOLTA_MIN} max={MAIOR_VOLTA_MIN} value={outro} onChange={(e) => setOutro(e.target.value)} />
          </label>
          <div className="pt-acoes">
            <button
              type="button"
              className="al-botao al-botao-claro al-botao-m"
              disabled={ocupado}
              onClick={() =>
                void fazer(async () => {
                  const n = outro ? Math.round(Number(outro)) : minutos;
                  volta.comecar(Math.min(MAIOR_VOLTA_MIN, Math.max(MENOR_VOLTA_MIN, Number.isFinite(n) ? n : 40)));
                })
              }
            >
              {t.volta.comecar}
            </button>
          </div>
          {!prontas.length && <p className="pt-nota">{t.sos.ninguem}</p>}
        </div>
      ) : (
        <div className="pt-form" aria-live="polite">
          {fase?.fase === "contando" ? (
            <p className="pt-grande" role="timer">{por(t.volta.contando, { tempo: tempoCurto(fase.faltaMs) })}</p>
          ) : (
            <p className="pt-grande pt-alerta" role="alert">{por(t.volta.ultimo, { tempo: tempoCurto(fase?.fase === "ultimo_aviso" ? fase.faltaMs : 0) })}</p>
          )}
          <div className="pt-acoes">
            <button type="button" className="al-botao al-botao-claro al-botao-m" disabled={ocupado} onClick={() => void cheguei(false)}>{t.volta.cheguei}</button>
            <button type="button" className="al-botao al-botao-contorno al-botao-m" disabled={ocupado} onClick={() => void cheguei(true)}>{t.volta.chegueiEstouBem}</button>
            <button type="button" className="al-botao al-botao-fantasma al-botao-m" disabled={ocupado} onClick={() => volta.mais(15)}>{t.volta.mais}</button>
            <button type="button" className="al-botao al-botao-fantasma al-botao-m" disabled={ocupado} onClick={() => volta.trocar(null)}>{t.volta.cancelar}</button>
          </div>
        </div>
      )}
      <p className="pt-nota">{t.volta.limite}</p>
      {avisos}
    </Bloco>
  );
}

// ───── Compartilhar (2) ─────
function Compartilhar({ t, lang, prontas }: { t: T; lang: string; prontas: string[] }) {
  const estado = useCompartilhar();
  const [prazo, setPrazo] = useState<Prazo>(60);
  const [precisao, setPrecisao] = useState<Precisao>("bairro");
  const { ocupado, fazer, avisos } = useAcao(t);
  const comecar = () =>
    fazer(async () => {
      if (!prontas.length) throw Object.assign(new Error("sem_circulo"), { code: "sem_circulo" });
      if (!(await confirmar(por(t.compartilhar.confirmar, { n: prontas.length }), { sim: t.compartilhar.sim }))) return;
      await compartilhar.comecar({ conversas: prontas, prazo, precisao });
    });
  // Ponto de encontro: a posição de agora, uma vez só (vale 1 h em quem recebe e não se renova).
  const umaVez = () =>
    fazer(async () => {
      if (!prontas.length) throw Object.assign(new Error("sem_circulo"), { code: "sem_circulo" });
      if (!(await confirmar(por(t.compartilhar.umaVezConfirmar, { n: prontas.length }), { sim: t.compartilhar.umaVezSim }))) return;
      const r = await mandarUmaVez(prontas, precisao);
      return por(t.compartilhar.umaVezFeito, { n: r.entregues });
    });
  return (
    <Bloco id="pt-compartilhar" titulo={t.compartilhar.titulo} texto={t.compartilhar.texto}>
      {!estado.ligado ? (
        <div className="pt-form">
          <fieldset className="pt-opcoes">
            <legend>{t.compartilhar.prazo}</legend>
            <div className="pt-pilulas">
              {PRAZOS.map((p) => (
                <label key={String(p)} className="pt-pilula">
                  <input type="radio" name="pt-prazo" checked={prazo === p} onChange={() => setPrazo(p)} />
                  <span>{t.compartilhar.prazos[String(p) as keyof T["compartilhar"]["prazos"]]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="pt-opcoes">
            <legend>{t.compartilhar.precisao}</legend>
            <div className="pt-pilulas">
              {(["bairro", "exata"] as const).map((p) => (
                <label key={p} className="pt-pilula">
                  <input type="radio" name="pt-precisao" checked={precisao === p} onChange={() => setPrecisao(p)} />
                  <span>{t.compartilhar[p]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="pt-acoes">
            <button type="button" className="al-botao al-botao-claro al-botao-m" disabled={ocupado} onClick={() => void comecar()}>{t.compartilhar.comecar}</button>
            <button type="button" className="al-botao al-botao-contorno al-botao-m" disabled={ocupado} onClick={() => void umaVez()}>{t.compartilhar.umaVez}</button>
          </div>
        </div>
      ) : (
        <div className="pt-form" aria-live="polite">
          <p className="pt-grande">
            {estado.prazo === "parar"
              ? por(t.compartilhar.ligadoParar, { n: estado.conversas.length })
              : por(t.compartilhar.ligado, { n: estado.conversas.length, hora: horaNoIdioma(lang, estado.comecou + estado.prazo * 60_000) })}
          </p>
          {estado.ultimaEm && <p className="pt-nota">{por(t.compartilhar.ultima, { hora: horaNoIdioma(lang, estado.ultimaEm) })}</p>}
          {estado.erro && <p className="pt-nota" role="status">{t.compartilhar.naoSaiu}</p>}
          <div className="pt-acoes">
            <button type="button" className="al-botao al-botao-primario al-botao-m" disabled={ocupado} onClick={() => void fazer(() => compartilhar.parar())}>{t.compartilhar.parar}</button>
          </div>
        </div>
      )}
      {avisos}
    </Bloco>
  );
}

// ───── Quem compartilha comigo ─────
function Recebidas({ t, lang }: { t: T; lang: string }) {
  const { posicoes, nomes } = useRecebidas();
  return (
    <Bloco id="pt-recebidas" titulo={t.recebidas.titulo}>
      {posicoes.length === 0 ? (
        <p className="pt-texto">{t.recebidas.vazio}</p>
      ) : (
        <ul className="pt-lista">
          {posicoes.map((p) => (
            <UmaPosicao key={`${p.origem}|${p.autor}`} t={t} lang={lang} p={p} nome={nomes[p.origem] ? `@${nomes[p.origem]}` : t.recebidas.alguem} />
          ))}
        </ul>
      )}
    </Bloco>
  );
}

// ───── O círculo ─────
function Circulo({ t, lang, circulo, aoMudar }: { t: T; lang: string; circulo: ReturnType<typeof useCirculo>["circulo"]; aoMudar: () => void }) {
  const { ocupado, fazer, avisos } = useAcao(t);
  return (
    <Bloco id="pt-circulo" titulo={t.circulo.titulo} texto={t.circulo.texto}>
      {circulo && circulo.length === 0 ? (
        <p className="pt-texto">{t.circulo.vazio}</p>
      ) : (
        <ul className="pt-lista">
          {(circulo ?? []).map((p) => (
            <li key={p.handle} className="pt-pessoa">
              <span className="pt-pessoa-nome">@{p.handle}</span>
              <span className="pt-nota">{p.pronta ? t.circulo.pronta : p.conversa ? t.circulo.aguardando : t.circulo.semConversa}</span>
              {p.pronta && p.conversa && (
                <button
                  type="button"
                  className="al-botao al-botao-fantasma al-botao-m"
                  disabled={ocupado}
                  onClick={() =>
                    void fazer(async () => {
                      if (!(await confirmar(por(t.pedido.confirmar, { nome: p.handle }), { sim: t.pedido.sim }))) return;
                      await pedirLocalizacao(p.conversa!);
                      return t.pedido.enviado;
                    })
                  }
                >
                  {t.pedido.pedir}
                </button>
              )}
              {!p.conversa && (
                <button
                  type="button"
                  className="al-botao al-botao-contorno al-botao-m"
                  disabled={ocupado}
                  onClick={() =>
                    void fazer(async () => {
                      await abrirConversa(p.handle);
                      aoMudar();
                      return t.circulo.pedido;
                    })
                  }
                >
                  {t.circulo.abrirConversa}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p>
        <Link className="pt-link" href={`/${lang}/alumia/modo-ato`}>{t.circulo.irModoAto}</Link>
      </p>
      {avisos}
    </Bloco>
  );
}

export default function TelaDoPerto({ lang }: PropsDaTelaDoPacote) {
  const t = useTextosDoPerto(lang);
  const { circulo, erro, recarregar } = useCirculo();
  useEffect(() => {
    if (previaLigada()) void exemploDaPrevia();
  }, []);
  if (!t) return <p className="pt-pagina" role="status">…</p>;
  const prontas = (circulo ?? []).filter((p) => p.pronta && p.conversa).map((p) => p.conversa!);
  return (
    <div className="pt-pagina">
      <header className="pt-cabeca">
        <h1 className="al-cond">{t.titulo}</h1>
        <p className="pt-chamada">{t.chamada}</p>
        <p className="pt-limite">{t.limite}</p>
      </header>
      {circulo === null ? (
        <p role="status" aria-busy="true">{t.carregando}</p>
      ) : (
        <>
          {erro ? <p role="alert" className="pt-erro">{textoDoErro(t.erros, erro)}</p> : null}
          <PedidosDeLocalizacao t={t} />
          <PedirAjuda t={t} prontas={prontas} />
          <VoltaParaCasa t={t} prontas={prontas} />
          <Compartilhar t={t} lang={lang} prontas={prontas} />
          <Recebidas t={t} lang={lang} />
          <Circulo t={t} lang={lang} circulo={circulo} aoMudar={recarregar} />
        </>
      )}
    </div>
  );
}

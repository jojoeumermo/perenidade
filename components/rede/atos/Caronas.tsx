// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { Botao } from "../ui/Botao";
import { frase } from "./usar";
import { useAnuncio, useQuadro } from "./usarQuadro";
import { codigoDoErro } from "@/lib/rede/atos/erros";
import { combinarCarona, conversaDaCaronaPronta, ouvirConversaDaCarona } from "@/lib/rede/atos/combinar";
import { conferirCarona } from "@/lib/rede/atos/quadros";
import { diaEHora, hora } from "@/lib/rede/atos/tempo";
import { atos as cliente } from "@/lib/rede/cliente-atos";
import { preencherAto, type TextosDosAtos } from "@/lib/rede/textos-atos";
import { LIMITES_DO_ATO, MEIOS_DA_CARONA, type Ato, type CaronaDoAto, type MeioDaCarona, type TipoDeCarona } from "@/lib/rede/tipos-atos";
import "./quadros.css";

/** Um traço por meio (sem emoji: no e-ink e no alto contraste o desenho continua legível). */
const DESENHO: Record<MeioDaCarona, string> = {
  carro: "M4 15l1.6-4.6A2 2 0 0 1 7.5 9h9a2 2 0 0 1 1.9 1.4L20 15v3h-2.2M4 15v3h2.2M4 15h16M8 18a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 0 1 3.2 0zm11.2 0a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 0 1 3.2 0z",
  onibus: "M6 4h12a2 2 0 0 1 2 2v11H4V6a2 2 0 0 1 2-2zM4 11h16M8 17v2.5M16 17v2.5M7.5 14h.01M16.5 14h.01",
  van: "M3 16V8a2 2 0 0 1 2-2h9l5 4.5V16H3zM3 12h16M7 18.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm10 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z",
  bicicleta: "M6 17.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7zm12 0a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7zM6 14l4-6h4l4 6M10 8l2 6h-6M13 5h2",
  a_pe: "M13 4.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zM9 21l2-6 2 2v4M11 15l-1-5 3-1 2 4 3 1M10 10l-3 2",
  outro: "M5 12h.01M12 12h.01M19 12h.01",
};

function DesenhoDoMeio({ meio }: { meio: MeioDaCarona }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" width={26} height={26} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={DESENHO[meio]} />
    </svg>
  );
}

/** A hora de saída: a hora escolhida no dia do ato; se passar do começo do ato, é a véspera (o servidor aceita até 24 h antes). */
function saidaDoAto(inicio: string, hhmm: string): string | null {
  if (!/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const d = new Date(inicio);
  const [h, m] = hhmm.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  if (d.getTime() > Date.parse(inicio)) d.setDate(d.getDate() - 1);
  return d.toISOString();
}

/**
 * Caronas e ônibus para o ato (PLANO-ALUMIA §4.2): ofertas e pedidos com o meio, o ponto de saída PÚBLICO, a hora e as vagas.
 * Nunca quem publicou (o servidor não manda), nunca telefone nem endereço com número (o servidor recusa, e a tela avisa antes).
 * O contato é só pelo chat privado: "Combinar pelo chat" usa o encaixe da Faixa 2 (lib/rede/atos/combinar.ts). Só para quem
 * entrou na Alumia: a lista de caronas não é para a internet aberta.
 */
export function Caronas({ ato, t, lang, logado }: { ato: Ato; t: TextosDosAtos; lang: string; logado: boolean }) {
  const carregar = useCallback(() => cliente.caronas(ato.id), [ato.id]);
  const { estado, trocar } = useQuadro<CaronaDoAto[]>(carregar, ato.id, logado);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState<TipoDeCarona | null>(null);
  const [anuncio, anunciar] = useAnuncio();
  const chatPronto = useSyncExternalStore(ouvirConversaDaCarona, conversaDaCaronaPronta, () => false);
  const idTitulo = useId();
  const idEmBreve = useId();
  const fechado = ato.situacao === "cancelado";

  const agir = async (k: CaronaDoAto, f: () => Promise<CaronaDoAto[]>, frasePronta: string) => {
    if (ocupado) return;
    setOcupado(k.id);
    setErro(null);
    try {
      trocar(await f());
      anunciar(frasePronta);
    } catch (e) {
      setErro(frase(t, e));
    } finally {
      setOcupado(null);
    }
  };
  const combinar = async (k: CaronaDoAto) => {
    setErro(null);
    try {
      await combinarCarona({ id: k.id, ato: ato.id });
    } catch (e) {
      setErro(String((e as Error)?.message).includes("sem_chat") ? t.caronas.combinarEmBreve : frase(t, e));
    }
  };

  const lista = estado.fase === "pronto" ? estado.dados : [];
  const grupos: { tipo: TipoDeCarona; titulo: string; vazio: string }[] = [
    { tipo: "oferta", titulo: t.caronas.ofertas, vazio: t.caronas.vazioOfertas },
    { tipo: "pedido", titulo: t.caronas.pedidos, vazio: t.caronas.vazioPedidos },
  ];
  const minhas = lista.filter((k) => k.minha).length;

  return (
    <section className="al-q al-q-caronas" aria-labelledby={idTitulo} aria-busy={estado.fase === "carregando" || undefined}>
      <header className="al-q-cabeca">
        <h2 id={idTitulo} className="al-cond al-q-titulo">
          {t.caronas.titulo}
        </h2>
        <p className="al-q-explica">{t.caronas.explica}</p>
      </header>
      {estado.fase === "desligado" ? <p className="al-q-ajuda">{t.caronas.entrar}</p> : null}
      {estado.fase === "carregando" ? <p className="al-q-ajuda">{t.tela.carregando}</p> : null}
      {estado.fase === "erro" ? (
        <p className="al-q-ajuda" role="alert">
          {codigoDoErro(estado.erro) === "generico" ? t.tela.erro : frase(t, estado.erro)}
        </p>
      ) : null}
      {estado.fase === "pronto" ? (
        <div className="al-q-colunas">
          {grupos.map((g) => {
            const daqui = lista.filter((k) => k.tipo === g.tipo);
            return (
              <div key={g.tipo} className="al-q-coluna">
                <h3 className="al-q-subtitulo">{g.titulo}</h3>
                {daqui.length === 0 ? (
                  <p className="al-q-ajuda">{g.vazio}</p>
                ) : (
                  <ul className="al-q-caronas-lista" role="list">
                    {daqui.map((k, i) => {
                      const vagas = k.vagas === null ? t.caronas.semVagas : k.vagas === 0 ? t.caronas.lotada : k.vagas === 1 ? t.caronas.vagasUma : preencherAto(t.caronas.vagasN, { n: k.vagas });
                      return (
                        <li key={k.id} className="al-q-carona" data-lotada={k.vagas === 0 ? "sim" : undefined} data-minha={k.minha ? "sim" : undefined} style={{ ["--al-q-i" as string]: i }}>
                          <span className="al-q-meio" title={t.caronas.meios[k.meio]}>
                            <DesenhoDoMeio meio={k.meio} />
                            <span className="sr-only">{t.caronas.meios[k.meio]}</span>
                          </span>
                          <div className="al-q-corpo">
                            <p className="al-q-item">{k.saida}</p>
                            <p className="al-q-linha">
                              <span aria-hidden>{t.caronas.meios[k.meio]} · </span>
                              {k.sai_em ? (
                                <>
                                  <time dateTime={k.sai_em} title={diaEHora(k.sai_em, lang)}>
                                    {preencherAto(t.caronas.saiAs, { hora: hora(k.sai_em, lang) })}
                                  </time>
                                  {" · "}
                                </>
                              ) : null}
                              <span className="al-q-vagas">{vagas}</span>
                              {k.minha ? <span className="al-q-minha"> · {t.caronas.minha}</span> : null}
                            </p>
                          </div>
                          <div className="al-q-botoes">
                            {!k.minha ? (
                              <Botao
                                tamanho="p"
                                variante="contorno"
                                disabled={!chatPronto}
                                aria-describedby={!chatPronto ? idEmBreve : undefined}
                                title={chatPronto ? t.caronas.combinarAjuda : t.caronas.combinarEmBreve}
                                onClick={() => void combinar(k)}
                              >
                                {t.caronas.combinar}
                              </Botao>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="al-q-passo"
                                  aria-label={t.caronas.menos}
                                  disabled={ocupado === k.id || k.vagas === 0}
                                  onClick={() => void agir(k, () => cliente.caronaVagas(k.id, Math.max(0, (k.vagas ?? 1) - 1)), t.caronas.menos)}
                                >
                                  <span aria-hidden>−</span>
                                </button>
                                <button
                                  type="button"
                                  className="al-q-passo"
                                  aria-label={t.caronas.mais}
                                  disabled={ocupado === k.id || (k.vagas ?? 0) >= LIMITES_DO_ATO.vagasMax}
                                  onClick={() => void agir(k, () => cliente.caronaVagas(k.id, (k.vagas ?? 0) + 1), t.caronas.mais)}
                                >
                                  <span aria-hidden>+</span>
                                </button>
                              </>
                            )}
                            {k.apagar ? (
                              <Botao tamanho="p" variante="fantasma" disabled={ocupado === k.id} onClick={() => void agir(k, () => cliente.caronaApagar(k.id), t.caronas.tirada)}>
                                {t.caronas.tirar}
                              </Botao>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
      {!chatPronto && estado.fase === "pronto" && lista.some((k) => !k.minha) ? (
        <p id={idEmBreve} className="al-q-ajuda">
          {t.caronas.combinarEmBreve}
        </p>
      ) : null}
      {estado.fase === "pronto" && !fechado ? (
        form ? (
          <NovaCarona
            ato={ato}
            t={t}
            tipo={form}
            aoFechar={() => setForm(null)}
            aoPublicar={async (p) => {
              trocar(await cliente.caronaCriar(ato.id, p));
              anunciar(t.caronas.publicada);
              setForm(null);
            }}
          />
        ) : minhas < 2 ? (
          <div className="al-q-acoes">
            <Botao variante="contorno" onClick={() => setForm("oferta")}>
              {t.caronas.oferecer}
            </Botao>
            <Botao variante="contorno" onClick={() => setForm("pedido")}>
              {t.caronas.pedir}
            </Botao>
          </div>
        ) : (
          <p className="al-q-ajuda">{t.caronas.limite}</p>
        )
      ) : null}
      {erro ? (
        <p role="alert" className="al-ato-erro">
          {erro}
        </p>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {anuncio}
      </p>
    </section>
  );
}

function NovaCarona({
  ato,
  t,
  tipo: tipoInicial,
  aoFechar,
  aoPublicar,
}: {
  ato: Ato;
  t: TextosDosAtos;
  tipo: TipoDeCarona;
  aoFechar: () => void;
  aoPublicar: (p: { tipo: TipoDeCarona; meio: MeioDaCarona; saida: string; vagas: number | null; sai_em: string | null }) => Promise<void>;
}) {
  const [tipo, setTipo] = useState<TipoDeCarona>(tipoInicial);
  const [meio, setMeio] = useState<MeioDaCarona>("carro");
  const [saida, setSaida] = useState("");
  const [vagas, setVagas] = useState("");
  const [horaSaida, setHoraSaida] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const campo = useRef<HTMLInputElement>(null);
  const id = useId();
  useEffect(() => {
    campo.current?.focus();
  }, []);
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const n = vagas.trim() ? Math.trunc(Number(vagas)) : null;
    const p = conferirCarona(saida, n);
    if (p.saida || p.vagas) {
      setErro(p.saida === "dado_pessoal" ? t.caronas.dado : p.vagas ? t.erros.meta : t.erros.texto);
      campo.current?.focus();
      return;
    }
    setOcupado(true);
    setErro(null);
    try {
      await aoPublicar({ tipo, meio, saida: saida.replace(/\s+/g, " ").trim(), vagas: n, sai_em: horaSaida ? saidaDoAto(ato.inicio, horaSaida) : null });
    } catch (e) {
      setErro(codigoDoErro(e) === "dado_pessoal" ? t.caronas.dado : codigoDoErro(e) === "limite_do_quadro" ? t.caronas.limite : frase(t, e));
    } finally {
      setOcupado(false);
    }
  };
  return (
    <form
      className="al-q-form"
      onSubmit={(e) => void enviar(e)}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !ocupado) {
          e.preventDefault();
          aoFechar();
        }
      }}
      noValidate
    >
      <fieldset className="al-q-escolha">
        <legend>{t.caronas.tipo}</legend>
        {(["oferta", "pedido"] as const).map((x) => (
          <label key={x} className="al-q-opcao">
            <input type="radio" name={`${id}-tipo`} value={x} checked={tipo === x} onChange={() => setTipo(x)} />
            <span>{x === "oferta" ? t.caronas.tipoOferta : t.caronas.tipoPedido}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="al-q-escolha al-q-meios">
        <legend>{t.caronas.meio}</legend>
        {MEIOS_DA_CARONA.map((m) => (
          <label key={m} className="al-q-opcao al-q-opcao-meio">
            <input type="radio" name={`${id}-meio`} value={m} checked={meio === m} onChange={() => setMeio(m)} />
            <span>
              <DesenhoDoMeio meio={m} />
              {t.caronas.meios[m]}
            </span>
          </label>
        ))}
      </fieldset>
      <label className="al-q-campo">
        <span>{t.caronas.saida}</span>
        <input
          ref={campo}
          className="al-ato-form-campo"
          value={saida}
          onChange={(e) => {
            setSaida(e.target.value);
            if (erro) setErro(null);
          }}
          placeholder={t.caronas.saidaExemplo}
          maxLength={LIMITES_DO_ATO.saidaMax}
          autoComplete="off"
          aria-invalid={erro ? true : undefined}
          aria-describedby={`${id}-ajuda${erro ? ` ${id}-erro` : ""}`}
        />
        <small id={`${id}-ajuda`} className="al-q-ajuda">
          {t.caronas.saidaAjuda}
        </small>
      </label>
      <div className="al-q-form-linha">
        <label className="al-q-campo al-q-campo-numero">
          <span>{t.caronas.vagas}</span>
          <input className="al-ato-form-campo" type="number" inputMode="numeric" min={1} max={LIMITES_DO_ATO.vagasMax} value={vagas} onChange={(e) => setVagas(e.target.value)} />
        </label>
        <label className="al-q-campo">
          <span>{t.caronas.hora}</span>
          <input className="al-ato-form-campo" type="time" value={horaSaida} onChange={(e) => setHoraSaida(e.target.value)} />
        </label>
      </div>
      {erro ? (
        <p id={`${id}-erro`} role="alert" className="al-ato-erro">
          {erro}
        </p>
      ) : null}
      <div className="al-q-acoes">
        <Botao type="submit" variante="primario" disabled={ocupado} aria-busy={ocupado || undefined}>
          {t.caronas.publicar}
        </Botao>
        <Botao variante="fantasma" onClick={aoFechar} disabled={ocupado}>
          {t.caronas.deixar}
        </Botao>
      </div>
    </form>
  );
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Confirmar } from "../../conversa/base3";
import { Botao } from "../../ui/Botao";
import { EstadoDaAlumia } from "../../ui/Estado";
import { baixar, encher, Nota, textoDoErro } from "../turma/comum";
import { agenda } from "./cliente";
import { datasDoSite, diasEntre, fonteValida, icsDasDatas, LIMITES_DA_AGENDA, porExame, type AgendaDeProvas, type DadosDaData, type DataDaAgenda } from "./regras";
import type { TextosDaAgenda } from "./textos";

type T = TextosDaAgenda;
type Avisar = (x: { texto: string; erro?: boolean }) => void;

const localDe = (lang: string) => (lang === "zh" ? "zh-CN" : lang === "pt" ? "pt-BR" : lang);
const dataUtc = (dia: string) => {
  const [a, m, d] = dia.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d, 12));
};

/**
 * A aba Provas: as datas agrupadas por prova, cada uma com a placa do dia, a etapa, a hora (de Brasília), a fonte oficial e quando
 * foi conferida. "Me avisar" assina a data (aviso 7 dias e 1 dia antes); "Pôr na agenda" faz o .ics no aparelho. Para a
 * coordenação e a mediação, o cartão de cuidar das datas (escrever, trocar, tirar e trazer as do ENEM do site).
 */
export function AbaDasProvas({ t, lang, avisar }: { t: T; lang: string; avisar: Avisar }) {
  const id = useId();
  const [dados, setDados] = useState<AgendaDeProvas | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [vez, setVez] = useState(0);
  const [filtro, setFiltro] = useState<string | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [editando, setEditando] = useState<DataDaAgenda | null>(null);
  const [tirando, setTirando] = useState<DataDaAgenda | null>(null);
  const cuidar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vivo = true;
    agenda.datas().then(
      (r) => {
        if (!vivo) return;
        setDados(r);
        setErro(null);
      },
      (e: unknown) => vivo && setErro(e ?? new Error("falha")),
    );
    return () => {
      vivo = false;
    };
  }, [vez]);

  if (erro && !dados) {
    return (
      <EstadoDaAlumia erro texto={textoDoErro(t.erros, erro)}>
        <Botao variante="claro" onClick={() => setVez((n) => n + 1)}>{t.tentar}</Botao>
      </EstadoDaAlumia>
    );
  }
  if (!dados) {
    return (
      <div className="es-esqueleto" role="status" aria-label={t.carregando}>
        <span />
      </div>
    );
  }

  const exames = [...new Set(dados.itens.map((d) => d.exame))];
  const visiveis = dados.itens.filter((d) => !filtro || d.exame === filtro);
  const assinadas = dados.itens.filter((d) => d.assinada && diasEntre(dados.hoje, d.dia) >= 0);
  const url = typeof window !== "undefined" ? `${window.location.origin}/${lang}/alumia/agenda` : "";

  async function assinar(d: DataDaAgenda) {
    setOcupada(d.id);
    try {
      setDados(await agenda.assinar([d.id], !d.assinada));
      avisar({ texto: d.assinada ? t.provas.deixou : encher(t.provas.assinou, { etapa: d.etapa }) });
    } catch (e) {
      avisar({ texto: textoDoErro(t.erros, e), erro: true });
    } finally {
      setOcupada(null);
    }
  }

  return (
    <div className="es-colunas">
      <section className="es-principal" aria-labelledby={`${id}-t`}>
        <h2 id={`${id}-t`} className="sr-only">{t.abas.provas}</h2>
        {exames.length > 1 && (
          <div className="es-filtros" role="group" aria-label={t.provas.filtrar}>
            <button type="button" className="es-filtro" aria-pressed={filtro === null} onClick={() => setFiltro(null)}>{t.provas.todas}</button>
            {exames.map((x) => (
              <button key={x} type="button" className="es-filtro" aria-pressed={filtro === x} onClick={() => setFiltro(x)}>{x}</button>
            ))}
          </div>
        )}
        {visiveis.length === 0 ? (
          <EstadoDaAlumia icone="calendario" titulo={t.provas.vazioTitulo} texto={dados.pode_cuidar ? t.provas.vazioCuida : t.provas.vazio} />
        ) : (
          porExame(visiveis).map((g, i) => (
            <section key={g.exame} className="es-grupo" aria-labelledby={`${id}-g${i}`}>
              <h3 id={`${id}-g${i}`} className="es-grupo-titulo al-cond">
                <span className="es-item-ladrilho" data-cor={["v", "d", "1", "2", "4"][i % 5]} aria-hidden />
                {g.exame}
              </h3>
              <ul className="es-datas" role="list">
                {g.datas.map((d) => (
                  <li key={d.id}>
                    <LinhaDaData
                      t={t}
                      lang={lang}
                      d={d}
                      hoje={dados.hoje}
                      ocupada={ocupada === d.id}
                      podeCuidar={dados.pode_cuidar}
                      aoAssinar={() => assinar(d)}
                      aoBaixar={() => baixar(`${d.exame}-${d.dia}.ics`.replace(/[^\w.-]+/g, "-"), icsDasDatas([d], url))}
                      aoEditar={() => {
                        setEditando(d);
                        cuidar.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      aoTirar={() => setTirando(d)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </section>

      <aside className="es-lado" aria-label={t.provas.lado}>
        <section className="es-cartao es-regra" aria-labelledby={`${id}-suas`}>
          <h2 id={`${id}-suas`} className="es-cartao-titulo al-cond">{t.provas.suasTitulo}</h2>
          <p className="es-texto">{assinadas.length === 0 ? t.provas.suasNenhuma : encher(assinadas.length === 1 ? t.provas.suasUma : t.provas.suas, { n: assinadas.length })}</p>
          {assinadas.length > 0 && (
            <Botao variante="claro" tamanho="m" onClick={() => baixar("alumia-provas.ics", icsDasDatas(assinadas, url))}>{t.provas.baixarTodas}</Botao>
          )}
          <ul className="es-itens" role="list">
            {t.provas.regra.map((item, i) => (
              <li key={i}>
                <span className="es-item-ladrilho" data-cor={["d", "v", "1", "4"][i % 4]} aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
        {dados.pode_cuidar && (
          <div ref={cuidar} className="es-lado" style={{ scrollMarginTop: "5rem" }}>
            <CuidarDasDatas
              key={editando?.id ?? "nova"}
              t={t}
              hoje={dados.hoje}
              editando={editando}
              aoFechar={() => setEditando(null)}
              aoMudar={() => setVez((n) => n + 1)}
              avisar={avisar}
            />
          </div>
        )}
      </aside>
      <Confirmar
        aberto={tirando !== null}
        titulo={t.cuidar.tirarTitulo}
        texto={tirando ? encher(t.cuidar.tirarTexto, { etapa: tirando.etapa, exame: tirando.exame }) : ""}
        sim={t.cuidar.tirarSim}
        nao={t.cuidar.cancelar}
        aoFechar={() => setTirando(null)}
        aoSim={async () => {
          if (!tirando) return;
          try {
            await agenda.apagar(tirando.id);
            avisar({ texto: t.cuidar.tirada });
            setVez((n) => n + 1);
          } catch (e) {
            avisar({ texto: textoDoErro(t.erros, e), erro: true });
          }
        }}
      />
    </div>
  );
}

function LinhaDaData({ t, lang, d, hoje, ocupada, podeCuidar, aoAssinar, aoBaixar, aoEditar, aoTirar }: {
  t: T;
  lang: string;
  d: DataDaAgenda;
  hoje: string;
  ocupada: boolean;
  podeCuidar: boolean;
  aoAssinar: () => void;
  aoBaixar: () => void;
  aoEditar: () => void;
  aoTirar: () => void;
}) {
  const faltam = diasEntre(hoje, d.dia);
  const passou = faltam < 0;
  const quando = dataUtc(d.dia);
  const dia = new Intl.DateTimeFormat(localDe(lang), { day: "numeric", timeZone: "UTC" }).format(quando);
  const mes = new Intl.DateTimeFormat(localDe(lang), { month: "short", timeZone: "UTC" }).format(quando).replace(".", "");
  const semana = new Intl.DateTimeFormat(localDe(lang), { weekday: "long", timeZone: "UTC" }).format(quando);
  const completo = new Intl.DateTimeFormat(localDe(lang), { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(quando);
  const conferida = new Intl.DateTimeFormat(localDe(lang), { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(dataUtc(d.conferido_em));
  const falta = passou ? t.provas.passou : faltam === 0 ? t.provas.hoje : faltam === 1 ? t.provas.amanha : encher(t.provas.faltam, { n: faltam });
  return (
    <article className="es-data" data-passou={passou || undefined} data-perto={(!passou && faltam <= 7) || undefined} data-assinada={d.assinada || undefined} aria-label={`${d.etapa}, ${completo}`}>
      <span className="es-placa" aria-hidden>
        <span className="es-placa-dia">{dia}</span>
        <span className="es-placa-mes">{mes}</span>
      </span>
      <div className="es-data-corpo">
        <p className="es-data-etapa">{d.etapa}</p>
        <p className="es-data-linha">
          <span className="es-falta">{falta}</span>
          <span>{semana}{d.hora ? ` · ${encher(t.provas.hora, { hora: d.hora })}` : ""}</span>
        </p>
        <p className="es-data-linha">
          <span>{d.orgao}</span>
          <a href={d.fonte} target="_blank" rel="noopener noreferrer nofollow">{t.provas.fonte}</a>
          <span>{encher(t.provas.conferida, { dia: conferida })}</span>
        </p>
      </div>
      <div className="es-data-acoes">
        {!passou && (
          <Botao variante={d.assinada ? "claro" : "contorno"} tamanho="m" pressionado={d.assinada} disabled={ocupada} onClick={aoAssinar}>
            {d.assinada ? t.provas.avisando : t.provas.avisar}
          </Botao>
        )}
        {!passou && <Botao variante="fantasma" tamanho="m" onClick={aoBaixar}>{t.provas.agenda}</Botao>}
        {podeCuidar && <Botao variante="fantasma" tamanho="m" onClick={aoEditar}>{t.cuidar.editar}</Botao>}
        {podeCuidar && <Botao variante="fantasma" tamanho="m" onClick={aoTirar}>{t.cuidar.tirar}</Botao>}
      </div>
    </article>
  );
}

const vazio = (hoje: string): DadosDaData => ({ exame: "", etapa: "", dia: "", hora: "", orgao: "", fonte: "", conferido_em: hoje });

/** Escrever, trocar e trazer as datas (só coordenação, vice-coordenação e mediação; o banco confere de novo). */
function CuidarDasDatas({ t, hoje, editando, aoFechar, aoMudar, avisar }: {
  t: T;
  hoje: string;
  editando: DataDaAgenda | null;
  aoFechar: () => void;
  aoMudar: () => void;
  avisar: Avisar;
}) {
  const id = useId();
  // A tela troca a chave do cartão a cada data aberta para trocar: o formulário nasce com ela.
  const [form, setForm] = useState<DadosDaData>(() => editando
    ? { exame: editando.exame, etapa: editando.etapa, dia: editando.dia, hora: editando.hora ?? "", orgao: editando.orgao, fonte: editando.fonte, conferido_em: editando.conferido_em }
    : vazio(hoje));
  const [nota, setNota] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const doSite = datasDoSite(hoje);

  const muda = (campo: keyof DadosDaData) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!fonteValida(form.fonte)) {
      setNota({ texto: t.erros["invalido:fonte"], erro: true });
      return;
    }
    setOcupado(true);
    setNota(null);
    try {
      await agenda.salvar(editando?.id ?? null, { ...form, exame: form.exame.trim(), etapa: form.etapa.trim(), orgao: form.orgao.trim(), fonte: form.fonte.trim() });
      avisar({ texto: editando ? t.cuidar.trocada : t.cuidar.salva });
      setForm(vazio(hoje));
      aoFechar();
      aoMudar();
    } catch (erro) {
      setNota({ texto: textoDoErro(t.erros, erro), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  async function trazer() {
    setOcupado(true);
    setNota(null);
    try {
      for (const d of doSite) await agenda.salvar(null, d);
      avisar({ texto: encher(t.cuidar.trazidas, { n: doSite.length }) });
      aoMudar();
    } catch (erro) {
      setNota({ texto: textoDoErro(t.erros, erro), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="es-cartao es-comecar" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="es-cartao-titulo al-cond">{editando ? t.cuidar.tituloTrocar : t.cuidar.titulo}</h2>
      <p className="es-texto">{t.cuidar.texto}</p>
      <form className="es-form" onSubmit={salvar}>
        <label className="es-campo" htmlFor={`${id}-ex`}>
          <span>{t.cuidar.exame}</span>
          <input id={`${id}-ex`} value={form.exame} onChange={muda("exame")} minLength={LIMITES_DA_AGENDA.exameMin} maxLength={LIMITES_DA_AGENDA.exame} required placeholder={t.cuidar.exameExemplo} />
        </label>
        <label className="es-campo" htmlFor={`${id}-et`}>
          <span>{t.cuidar.etapa}</span>
          <input id={`${id}-et`} value={form.etapa} onChange={muda("etapa")} minLength={LIMITES_DA_AGENDA.etapaMin} maxLength={LIMITES_DA_AGENDA.etapa} required placeholder={t.cuidar.etapaExemplo} />
        </label>
        <div className="es-campos es-campos-2">
          <label className="es-campo" htmlFor={`${id}-dia`}>
            <span>{t.cuidar.dia}</span>
            <input id={`${id}-dia`} type="date" value={form.dia} onChange={muda("dia")} required />
          </label>
          <label className="es-campo" htmlFor={`${id}-hora`}>
            <span>{t.cuidar.hora}</span>
            <input id={`${id}-hora`} type="time" value={form.hora} onChange={muda("hora")} />
          </label>
        </div>
        <label className="es-campo" htmlFor={`${id}-org`}>
          <span>{t.cuidar.orgao}</span>
          <input id={`${id}-org`} value={form.orgao} onChange={muda("orgao")} minLength={LIMITES_DA_AGENDA.orgaoMin} maxLength={LIMITES_DA_AGENDA.orgao} required placeholder="Inep" />
        </label>
        <label className="es-campo" htmlFor={`${id}-fonte`}>
          <span>{t.cuidar.fonteCampo}</span>
          <input id={`${id}-fonte`} type="url" inputMode="url" value={form.fonte} onChange={muda("fonte")} maxLength={LIMITES_DA_AGENDA.fonte} required placeholder="https://www.gov.br/inep/…" />
        </label>
        <label className="es-campo" htmlFor={`${id}-conf`}>
          <span>{t.cuidar.conferida}</span>
          <input id={`${id}-conf`} type="date" value={form.conferido_em} max={hoje} onChange={muda("conferido_em")} required />
        </label>
        <p className="es-miudo">{t.cuidar.regraDaFonte}</p>
        <Nota nota={nota} />
        <div className="es-acoes">
          <Botao type="submit" variante="primario" tamanho="m" disabled={ocupado}>{editando ? t.cuidar.salvarTroca : t.cuidar.salvar}</Botao>
          {editando && <Botao variante="fantasma" tamanho="m" onClick={aoFechar}>{t.cuidar.cancelar}</Botao>}
        </div>
      </form>
      {/* Trazer as datas do ENEM que o site tem e a agenda ainda não: só quando há o que trazer (sem nenhuma, a frase solta no pé do
          formulário contradizia a lista de cima, que já tem as do ENEM). */}
      {!editando && doSite.length > 0 && (
        <div className="es-bloco">
          <p className="es-texto">{doSite.length === 1 ? t.cuidar.doSite1 : encher(t.cuidar.doSite, { n: doSite.length })}</p>
          <Botao variante="contorno" tamanho="m" disabled={ocupado} onClick={trazer}>{t.cuidar.trazer}</Botao>
        </div>
      )}
    </section>
  );
}

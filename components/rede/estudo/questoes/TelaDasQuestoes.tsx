// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { TextosDaRede } from "@/lib/rede/textos";
import { preencher } from "@/lib/rede/preencher";
import type { Situacao } from "@/lib/rede/tipos";
import type { PropsDaTelaDoPacote } from "../../registro";
import { TextoFormatado, TrechoFormatado } from "../../texto/TextoFormatado";
import { CartaoDaQuestao, guardaDoAparelho } from "./CartaoDaQuestao";
import { questoes } from "./cliente";
import { EscreverQuestao } from "./EscreverQuestao";
import { apagarAcertos, letra, lerAcertos, resumoDosAcertos, type AcertosNoAparelho } from "./regras";
import { erroDasQuestoes, useTextosDasQuestoes, type TextosDasQuestoes } from "./textos";
import type { Materias, Questao, QuestaoCompleta, QuestaoDenunciada } from "./tipos";
import "./questoes.css";

type Parte = "praticar" | "acertos" | "minhas" | "escrever" | "denunciadas";
const PARTES: Parte[] = ["praticar", "acertos", "minhas", "escrever", "denunciadas"];

/** A parte escolhida fica só na aba do navegador (sessionStorage), nunca no banco. */
function lembrar<T extends string>(chave: string, valor?: T): T | null {
  try {
    if (valor !== undefined) sessionStorage.setItem(chave, valor);
    return (sessionStorage.getItem(chave) as T | null) ?? null;
  } catch {
    return valor ?? null;
  }
}

/**
 * O banco de questões da Alumia (/alumia/questoes; frente 11A, L2-45): praticar por matéria e tema, os próprios acertos (só neste
 * aparelho), as próprias questões, escrever uma questão e, para a mediação, as denunciadas. Nenhuma lista de quem respondeu, nenhum
 * placar, nenhuma contagem de pessoas: os números são de questões.
 */
export default function TelaDasQuestoes({ lang, s, situacao }: PropsDaTelaDoPacote) {
  const t = useTextosDasQuestoes(lang);
  const [parte, setParteCrua] = useState<Parte>(() => {
    const p = lembrar<Parte>("qst-parte");
    return p && PARTES.includes(p) ? p : "praticar";
  });
  const [materias, setMaterias] = useState<Materias | null>(null);
  const [erro, setErro] = useState("");
  // Os acertos do aparelho (a tela só existe no navegador: o registro a carrega sem servidor).
  const [acertos, setAcertos] = useState<AcertosNoAparelho>(() => lerAcertos(guardaDoAparelho()));
  const [editando, setEditando] = useState<QuestaoCompleta | null>(null);
  const [materia, setMateriaCrua] = useState<string | null>(() => lembrar<string>("qst-materia"));
  const [aviso, setAviso] = useState("");

  const recarregar = useCallback(() => {
    questoes
      .materias()
      .then(setMaterias)
      .catch((e) => t && setErro(erroDasQuestoes(t, s, e)));
  }, [t, s]);

  useEffect(() => {
    if (t) recarregar();
  }, [t, recarregar]);

  function setParte(p: Parte) {
    setParteCrua(p);
    setAviso("");
    if (p !== "escrever") setEditando(null);
    lembrar("qst-parte", p);
  }
  function setMateria(m: string | null) {
    setMateriaCrua(m);
    lembrar("qst-materia", m ?? "");
  }

  if (!t) return <p role="status" className="qst-vazio">{s.estados.carregando}</p>;
  const partes = PARTES.filter((p) => p !== "denunciadas" || materias?.modera);
  const atual = partes.includes(parte) ? parte : "praticar";
  const resumo = resumoDosAcertos(acertos);

  return (
    <div className="qst" data-logado={situacao?.logado ? "sim" : undefined}>
      <header className="qst-topo">
        <h1 className="qst-cond qst-titulo">{t.titulo}</h1>
        <p className="qst-intro">{t.intro}</p>
        <p className="qst-regra">{t.regra}</p>
      </header>

      <nav aria-label={t.abas.rotulo}>
        <ul className="qst-partes">
          {partes.map((p) => (
            <li key={p}>
              <button type="button" className="qst-parte" aria-current={atual === p ? "true" : undefined} onClick={() => setParte(p)}>
                <span className="qst-cond">{t.abas[p]}</span>
                {p === "acertos" && resumo.feitas > 0 && <small>{preencher(t.acertos.resumo, { certas: resumo.certas, feitas: resumo.feitas })}</small>}
                {p === "minhas" && materias && materias.minhas > 0 && <small>{materias.minhas}</small>}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {erro && (
        <p className="qst-erro" role="alert">
          {erro}
        </p>
      )}
      {aviso && (
        <p className="qst-nota" role="status">
          {aviso}
        </p>
      )}

      {atual === "praticar" && materias && (
        <Praticar lang={lang} s={s} t={t} materias={materias} materia={materia} setMateria={setMateria} acertos={acertos} setAcertos={setAcertos} aoEscrever={() => setParte("escrever")} />
      )}
      {atual === "acertos" && <MeusAcertos t={t} acertos={acertos} aoApagar={() => setAcertos({})} />}
      {atual === "minhas" && (
        <MinhasQuestoes
          lang={lang}
          s={s}
          t={t}
          aoEditar={(q) => {
            setEditando(q);
            setParteCrua("escrever");
          }}
          aoMudar={recarregar}
        />
      )}
      {atual === "escrever" && (
        <EscreverQuestao
          key={editando?.id ?? "nova"}
          lang={lang}
          s={s}
          t={t}
          editando={editando}
          materiaInicial={materia}
          aoTerminar={(id, mensagem) => {
            setEditando(null);
            recarregar();
            setParte(id ? "minhas" : "praticar");
            setAviso(mensagem);
          }}
        />
      )}
      {atual === "denunciadas" && <Denunciadas lang={lang} s={s} t={t} aoMudar={recarregar} />}
    </div>
  );
}

function Praticar({
  lang,
  s,
  t,
  materias,
  materia,
  setMateria,
  acertos,
  setAcertos,
  aoEscrever,
}: {
  lang: string;
  s: TextosDaRede;
  t: TextosDasQuestoes;
  materias: Materias;
  materia: string | null;
  setMateria: (m: string | null) => void;
  acertos: AcertosNoAparelho;
  setAcertos: (a: AcertosNoAparelho) => void;
  aoEscrever: () => void;
}) {
  const [tema, setTema] = useState<string | null>(null);
  // O que veio do banco, marcado com a matéria e o tema pedidos: trocar de matéria ou tema mostra "carregando" até a resposta nova.
  const [carga, setCarga] = useState<{ chave: string; temas: { tema: string; questoes: number }[]; itens: Questao[]; proximo: string | null } | null>(null);
  const [erro, setErro] = useState("");
  const aberta = materia && materias.materias.some((m) => m.materia === materia) ? materia : null;
  const chave = `${aberta}|${tema ?? ""}`;
  const atual = carga?.chave === chave ? carga : null;
  const lista = atual?.itens ?? null;
  const proximo = atual?.proximo ?? null;
  const temas = atual?.temas ?? carga?.temas ?? [];

  useEffect(() => {
    if (!aberta) return;
    let vivo = true;
    Promise.all([questoes.temas(aberta), questoes.lista(aberta, tema)])
      .then(([tm, l]) => vivo && setCarga({ chave: `${aberta}|${tema ?? ""}`, temas: tm.temas, itens: l.itens, proximo: l.proximo }))
      .catch((e) => vivo && setErro(erroDasQuestoes(t, s, e)));
    return () => {
      vivo = false;
    };
  }, [aberta, tema, t, s]);

  async function mais() {
    if (!aberta || !proximo || !atual) return;
    try {
      const l = await questoes.lista(aberta, tema, proximo);
      setCarga({ ...atual, itens: [...atual.itens, ...l.itens], proximo: l.proximo });
    } catch (e) {
      setErro(erroDasQuestoes(t, s, e));
    }
  }

  if (!aberta) {
    if (materias.materias.length === 0) {
      return (
        <div className="qst-vazio">
          <p>{t.materia.nenhuma}</p>
          <button type="button" className="qst-botao" onClick={aoEscrever}>
            {t.abas.escrever}
          </button>
        </div>
      );
    }
    return (
      <section aria-labelledby="qst-materias">
        <h2 id="qst-materias" className="qst-cond qst-subtitulo">
          {t.materia.escolha}
        </h2>
        <ul className="qst-materias">
          {materias.materias.map((m) => (
            <li key={m.materia}>
              <button type="button" className="qst-materia" onClick={() => setMateria(m.materia)}>
                <span className="qst-cond">{(t.materias as Record<string, string>)[m.materia] ?? m.materia}</span>
                <small>{m.questoes === 1 ? t.materia.umaQuestao : preencher(t.materia.questoes, { n: m.questoes })}</small>
              </button>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <section aria-labelledby="qst-lista">
      <div className="qst-cabeca">
        <h2 id="qst-lista" className="qst-cond qst-subtitulo">
          {(t.materias as Record<string, string>)[aberta] ?? aberta}
        </h2>
        <button
          type="button"
          className="qst-botao qst-botao-contorno"
          onClick={() => {
            setTema(null);
            setMateria(null);
          }}
        >
          ← {t.materia.voltar}
        </button>
      </div>
      {temas.length > 1 && (
        <div className="qst-temas" role="group" aria-label={t.materia.temas}>
          <button type="button" className="qst-tema-botao" aria-pressed={tema === null} onClick={() => setTema(null)}>
            {t.materia.todosOsTemas}
          </button>
          {temas.map((x) => (
            <button key={x.tema} type="button" className="qst-tema-botao" aria-pressed={tema === x.tema} onClick={() => setTema(x.tema)}>
              {x.tema} <small>{x.questoes}</small>
            </button>
          ))}
        </div>
      )}
      {erro && (
        <p className="qst-erro" role="alert">
          {erro}
        </p>
      )}
      {lista === null ? (
        <p role="status" className="qst-vazio">
          {t.carregando}
        </p>
      ) : (
        <ol className="qst-lista">
          {lista.map((q) => (
            <li key={q.id}>
              <CartaoDaQuestao q={q} lang={lang} s={s} t={t} acertos={acertos} aoMudarAcertos={setAcertos} />
            </li>
          ))}
        </ol>
      )}
      {proximo ? (
        <button type="button" className="qst-botao qst-botao-contorno qst-mais" onClick={mais}>
          {t.mais}
        </button>
      ) : (
        lista && lista.length > 0 && <p className="qst-discreto qst-fim">{t.fim}</p>
      )}
    </section>
  );
}

function MeusAcertos({ t, acertos, aoApagar }: { t: TextosDasQuestoes; acertos: AcertosNoAparelho; aoApagar: () => void }) {
  const [feito, setFeito] = useState(false);
  const r = resumoDosAcertos(acertos);
  return (
    <section className="qst-acertos" aria-labelledby="qst-acertos-titulo">
      <h2 id="qst-acertos-titulo" className="qst-cond qst-subtitulo">
        {t.acertos.titulo}
      </h2>
      <p className="qst-discreto">{t.acertos.nota}</p>
      {feito && (
        <p className="qst-nota" role="status">
          {t.acertos.apagados}
        </p>
      )}
      {r.feitas === 0 ? (
        !feito && <p className="qst-vazio">{t.acertos.nada}</p>
      ) : (
        <>
          <p className="qst-placar-proprio">
            <span className="qst-cond">{preencher(t.acertos.resumo, { certas: r.certas, feitas: r.feitas })}</span>
          </p>
          <h3 className="qst-cond">{t.acertos.porMateria}</h3>
          <ul className="qst-por-materia">
            {r.porMateria.map((m) => (
              <li key={m.materia}>
                <span>{(t.materias as Record<string, string>)[m.materia] ?? m.materia}</span>
                <span className="qst-barra" aria-hidden="true">
                  <span style={{ width: `${Math.round((m.certas / m.feitas) * 100)}%` }} />
                </span>
                <span>{preencher(t.acertos.resumo, { certas: m.certas, feitas: m.feitas })}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="qst-botao qst-botao-contorno"
            onClick={() => {
              if (!window.confirm(t.acertos.confirmar)) return;
              apagarAcertos(guardaDoAparelho());
              aoApagar();
              setFeito(true);
            }}
          >
            {t.acertos.apagar}
          </button>
        </>
      )}
    </section>
  );
}

function MinhasQuestoes({ lang, s, t, aoEditar, aoMudar }: { lang: string; s: TextosDaRede; t: TextosDasQuestoes; aoEditar: (q: QuestaoCompleta) => void; aoMudar: () => void }) {
  const [itens, setItens] = useState<QuestaoCompleta[] | null>(null);
  const [erro, setErro] = useState("");
  const [nota, setNota] = useState("");
  useEffect(() => {
    let vivo = true;
    questoes
      .minhas()
      .then((r) => vivo && setItens(r.itens))
      .catch((e) => vivo && setErro(erroDasQuestoes(t, s, e)));
    return () => {
      vivo = false;
    };
  }, [t, s]);

  async function apagar(id: string) {
    if (!window.confirm(t.minhas.confirmarApagar)) return;
    try {
      await questoes.apagar(id);
      setItens((x) => (x ?? []).filter((q) => q.id !== id));
      setNota(t.minhas.apagada);
      aoMudar();
    } catch (e) {
      setErro(erroDasQuestoes(t, s, e));
    }
  }

  return (
    <section aria-labelledby="qst-minhas">
      <h2 id="qst-minhas" className="qst-cond qst-subtitulo">
        {t.minhas.titulo}
      </h2>
      {erro && (
        <p className="qst-erro" role="alert">
          {erro}
        </p>
      )}
      {nota && (
        <p className="qst-nota" role="status">
          {nota}
        </p>
      )}
      {itens === null ? (
        <p role="status" className="qst-vazio">
          {t.carregando}
        </p>
      ) : itens.length === 0 ? (
        <p className="qst-vazio">{t.minhas.nada}</p>
      ) : (
        <ul className="qst-lista">
          {itens.map((q) => (
            <li key={q.id}>
              <ResumoDaQuestao q={q} lang={lang} t={t}>
                {q.retirada && <span className="qst-pilula qst-pilula-alerta">{t.minhas.retirada}</span>}
                <button type="button" className="qst-botao qst-botao-contorno" onClick={() => aoEditar(q)}>
                  {t.minhas.editar}
                </button>
                <button type="button" className="qst-botao qst-botao-contorno" onClick={() => apagar(q.id)}>
                  {t.minhas.apagar}
                </button>
              </ResumoDaQuestao>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** A questão inteira, já com a certa marcada (para quem escreveu e para a mediação). */
function ResumoDaQuestao({ q, lang, t, children }: { q: QuestaoCompleta; lang: string; t: TextosDasQuestoes; children?: ReactNode }) {
  return (
    <article className="qst-cartao qst-cartao-resumo">
      <header className="qst-cartao-cabeca">
        <span className="qst-carimbo">{(t.materias as Record<string, string>)[q.materia] ?? q.materia}</span>
        <span className="qst-tema">{q.tema}</span>
      </header>
      <TextoFormatado texto={q.enunciado} lang={lang} className="qst-enunciado" />
      <ol className="qst-alternativas-resumo">
        {q.alternativas.map((a, i) => (
          <li key={i} data-certa={q.certa === i || undefined}>
            <span className="qst-letra" aria-hidden="true">
              {letra(i)}
            </span>
            <span>
              <TrechoFormatado texto={a} lang={lang} />
            </span>
          </li>
        ))}
      </ol>
      <p className="qst-discreto">{preencher(t.minhas.certa, { letra: letra(q.certa) })}</p>
      <details className="qst-detalhes">
        <summary>{t.questao.explicacao}</summary>
        <TextoFormatado texto={q.explicacao} lang={lang} />
      </details>
      <div className="qst-acoes">{children}</div>
    </article>
  );
}

function Denunciadas({ lang, s, t, aoMudar }: { lang: string; s: TextosDaRede; t: TextosDasQuestoes; aoMudar: () => void }) {
  const [itens, setItens] = useState<QuestaoDenunciada[] | null>(null);
  const [erro, setErro] = useState("");
  const [nota, setNota] = useState("");
  useEffect(() => {
    let vivo = true;
    questoes
      .denunciadas()
      .then((r) => vivo && setItens(r.itens))
      .catch((e) => vivo && setErro(erroDasQuestoes(t, s, e)));
    return () => {
      vivo = false;
    };
  }, [t, s]);

  async function mediar(id: string, retirar: boolean) {
    try {
      await questoes.mediar(id, retirar);
      setItens((x) => (x ?? []).filter((q) => q.id !== id));
      setNota(retirar ? t.mediacao.retirada : t.mediacao.mantida);
      aoMudar();
    } catch (e) {
      setErro(erroDasQuestoes(t, s, e));
    }
  }

  return (
    <section aria-labelledby="qst-denunciadas">
      <h2 id="qst-denunciadas" className="qst-cond qst-subtitulo">
        {t.mediacao.titulo}
      </h2>
      <p className="qst-discreto">{t.mediacao.nota}</p>
      {erro && (
        <p className="qst-erro" role="alert">
          {erro}
        </p>
      )}
      {nota && (
        <p className="qst-nota" role="status">
          {nota}
        </p>
      )}
      {itens === null ? (
        <p role="status" className="qst-vazio">
          {t.carregando}
        </p>
      ) : itens.length === 0 ? (
        <p className="qst-vazio">{t.mediacao.nada}</p>
      ) : (
        <ul className="qst-lista">
          {itens.map((q) => (
            <li key={q.id}>
              <ResumoDaQuestao q={q} lang={lang} t={t}>
                <span className="qst-pilula qst-pilula-alerta">{q.denuncias >= 3 ? preencher(t.mediacao.denuncias, { n: q.denuncias }) : t.mediacao.poucas}</span>
                {q.motivos.map((m) => (
                  <span key={m} className="qst-pilula">
                    {(t.denuncia.motivos as Record<string, string>)[m] ?? m}
                  </span>
                ))}
                <button type="button" className="qst-botao" onClick={() => mediar(q.id, true)}>
                  {t.mediacao.retirar}
                </button>
                <button type="button" className="qst-botao qst-botao-contorno" onClick={() => mediar(q.id, false)}>
                  {t.mediacao.manter}
                </button>
              </ResumoDaQuestao>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

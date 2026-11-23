// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O desafio do dia (/alumia/desafio), Prompt 4, item 121: cinco perguntas do glossário do Instituto (os mesmos verbetes dos jogos do
// site), sorteadas com a data como semente, iguais para todo mundo no dia. A pontuação de hoje fica só neste aparelho (uma chave,
// sobrescrita a cada dia); nada vai ao servidor, nada de sequência de dias, nada de ranking (seção "Fora da Alumia" do prompt).
import "./memoria.css";
import { useEffect, useMemo, useState } from "react";
import type { PropsDaTelaDoPacote } from "../registro";
import { Botao } from "../ui/Botao";
import { Faixa } from "../ui/Faixa";
import { apagarPontuacao, chaveDoDia, gravarPontuacao, lerPontuacao, perguntasDoDia, type VerbeteDoDesafio } from "@/lib/rede/memoria/regras";
import { preencher } from "@/lib/rede/preencher";
import { useTextosDaMemoria } from "./textos";

function guarda(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export default function TelaDoDesafio({ lang }: PropsDaTelaDoPacote) {
  const t = useTextosDaMemoria(lang);
  const [dia] = useState(() => chaveDoDia());
  const [verbetes, setVerbetes] = useState<VerbeteDoDesafio[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [feita, setFeita] = useState(() => lerPontuacao(guarda(), dia));
  const [jogando, setJogando] = useState(false);
  const [i, setI] = useState(0);
  const [escolha, setEscolha] = useState<number | null>(null);
  const [acertos, setAcertos] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const [rodada, setRodada] = useState<number | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch("/api/rede/desafio", { credentials: "omit" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("falha"))))
      .then((d: { verbetes?: VerbeteDoDesafio[] }) => vivo && setVerbetes(Array.isArray(d?.verbetes) ? d.verbetes : []))
      .catch(() => vivo && setFalhou(true));
    return () => {
      vivo = false;
    };
  }, []);

  const perguntas = useMemo(() => (verbetes ? perguntasDoDia(verbetes, dia) : []), [verbetes, dia]);
  const atual = perguntas[i];
  // "Jogar de novo" não conta: a pontuação guardada é sempre a primeira do dia.
  const contando = !feita;

  if (!t) return <div className="ml-pagina" aria-busy="true" />;

  function responder(k: number) {
    if (escolha !== null || !atual) return;
    setEscolha(k);
    if (k === atual.certa) setAcertos((a) => a + 1);
  }

  function seguir() {
    if (i + 1 < perguntas.length) {
      setI(i + 1);
      setEscolha(null);
      return;
    }
    if (contando) {
      gravarPontuacao(guarda(), dia, acertos, perguntas.length);
      setFeita({ acertos, total: perguntas.length });
    } else setRodada(acertos);
    setJogando(false);
  }

  function comecar() {
    setI(0);
    setEscolha(null);
    setAcertos(0);
    setAviso(null);
    setRodada(null);
    setJogando(true);
  }

  return (
    <div className="ml-pagina">
      <header className="ml-cabeca">
        <Faixa className="ml-faixa" altura={8} />
        <h1 className="ml-titulo al-cond">{t.desafio.titulo}</h1>
        <p className="ml-chamada">{t.desafio.sobre}</p>
        <p className="ml-miudo" role="note">{t.desafio.privacidade}</p>
      </header>
      {falhou && <p className="ml-erro" role="alert">{t.desafio.semPerguntas}</p>}
      {!falhou && !verbetes && <p className="ml-miudo" role="status">{t.comum.carregando}</p>}
      {verbetes && perguntas.length === 0 && <p className="ml-erro" role="alert">{t.desafio.semPerguntas}</p>}
      {aviso && <p className="ml-ok" role="status">{aviso}</p>}
      {perguntas.length > 0 && !jogando && (
        <div className="ml-bloco">
          {feita ? (
            <>
              <p className="ml-ok" role="status">{preencher(t.desafio.jaFez, { acertos: feita.acertos, total: feita.total })} {t.desafio.volteAmanha}</p>
              {rodada !== null && <p className="ml-miudo">{preencher(t.desafio.resultado, { acertos: rodada, total: perguntas.length })}</p>}
              <div className="ml-acoes">
                <Botao variante="contorno" onClick={comecar}>{t.desafio.denovo}</Botao>
                <Botao variante="fantasma" onClick={() => { apagarPontuacao(guarda()); setFeita(null); setAviso(t.desafio.apagada); }}>{t.desafio.apagar}</Botao>
              </div>
            </>
          ) : (
            <div className="ml-acoes"><Botao onClick={comecar}>{t.desafio.titulo}</Botao></div>
          )}
        </div>
      )}
      {jogando && atual && (
        <section className="ml-pergunta" aria-live="polite">
          <p className="ml-etiqueta">{preencher(t.desafio.pergunta, { n: i + 1, total: perguntas.length })}</p>
          <blockquote>{atual.enunciado}</blockquote>
          <p className="ml-miudo">{t.desafio.qualTermo}</p>
          <div className="ml-opcoes" role="group" aria-label={t.desafio.qualTermo}>
            {atual.opcoes.map((o, k) => (
              <button key={o} type="button" disabled={escolha !== null} onClick={() => responder(k)}
                data-estado={escolha === null ? undefined : k === atual.certa ? "certa" : k === escolha ? "errada" : undefined}>
                {o}
              </button>
            ))}
          </div>
          {escolha !== null && (
            <>
              <p className={escolha === atual.certa ? "ml-ok" : "ml-erro"} role="status">{escolha === atual.certa ? t.desafio.certo : preencher(t.desafio.errado, { termo: atual.termo })}</p>
              <div className="ml-acoes"><Botao onClick={seguir}>{i + 1 < perguntas.length ? t.desafio.proxima : t.desafio.ver}</Botao></div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

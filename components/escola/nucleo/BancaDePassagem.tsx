// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useId, useState } from "react";
import type { TextosDaTelaDoNucleo } from "@/i18n/escola/nucleo";
import type { EscolaEuDentro } from "@/lib/escola/contratos";
import { type Acompanhado, type BancaListada, chamarDoNucleo, deCampoParaIso } from "@/lib/escola/nucleo";
import { preencher } from "@/lib/escola/textos";
import { diaEHora } from "../hoje/tempo";

type T = TextosDaTelaDoNucleo;

/** Registrar o que a banca decidiu: o balanço coletivo, sem nota, e "degrau aberto" ou "combinar de novo". */
function Decidir({ banca, t, depois }: { banca: BancaListada; t: T; depois: () => void }) {
  const id = useId();
  const [balanco, setBalanco] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function decidir(situacao: "aprovada" | "refazer") {
    setOcupado(true);
    const r = await chamarDoNucleo("escola_banca_decidir", { p_id: banca.id, p_situacao: situacao, p_balanco: balanco });
    setOcupado(false);
    if (!r.ok) return setAviso(t.erros[r.motivo]);
    setAviso(t.banca.decidida);
    depois();
  }
  const curto = balanco.trim().length < 10;
  return (
    <div className="en-form">
      <label htmlFor={id} className="en-rotulo">
        {t.banca.balancoRotulo}
      </label>
      <textarea id={id} className="en-campo" rows={4} maxLength={2000} value={balanco} onChange={(e) => setBalanco(e.target.value)} />
      <div className="en-acoes">
        <button type="button" className="ef-botao-ouro" disabled={ocupado || curto} onClick={() => decidir("aprovada")}>
          {t.banca.aprovar}
        </button>
        <button type="button" className="ef-botao-vazado" disabled={ocupado || curto} onClick={() => decidir("refazer")}>
          {t.banca.refazer}
        </button>
      </div>
      <p role="status" className="en-aviso">
        {aviso}
      </p>
    </div>
  );
}

/** Marcar a banca de quem eu acompanho (o degrau é o de hoje da pessoa; a data é opcional). */
function Marcar({ pessoa, t, depois }: { pessoa: Acompanhado; t: T; depois: () => void }) {
  const id = useId();
  const [quando, setQuando] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function marcar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    const r = await chamarDoNucleo("escola_banca_marcar", { p: { militante: pessoa.usuario, degrau: pessoa.degrau, quando: quando ? deCampoParaIso(quando) : null } });
    setOcupado(false);
    if (!r.ok) return setAviso(t.erros[r.motivo]);
    setAviso(t.banca.marcada);
    depois();
  }
  return (
    <form onSubmit={marcar} className="en-form">
      <label htmlFor={id} className="en-rotulo">
        {t.banca.marcarQuando}
      </label>
      <input id={id} type="datetime-local" className="en-campo" value={quando} onChange={(e) => setQuando(e.target.value)} />
      <div className="en-acoes">
        <button type="submit" className="ef-botao-vazado" disabled={ocupado}>
          {preencher(t.banca.marcar, { n: pessoa.degrau })}
        </button>
      </div>
      <p role="status" className="en-aviso">
        {aviso}
      </p>
    </form>
  );
}

function Banca({ b, lang, t }: { b: BancaListada; lang: string; t: T }) {
  return (
    <>
      <p className="en-banca-linha">
        <strong>{preencher(t.banca.degrau, { n: b.degrau })}</strong> · <span className="en-situacao" data-situacao={b.situacao}>{t.banca.situacao[b.situacao]}</span>
        {" · "}
        {preencher(t.banca.quando, { quando: b.quando ? diaEHora(lang, b.quando) : t.banca.semData })}
      </p>
      {b.balanco && (
        <div className="en-balanco">
          <h4 className="en-rotulo">{t.banca.balanco}</h4>
          <p data-original="">{b.balanco}</p>
        </div>
      )}
    </>
  );
}

/**
 * Quem acompanha você e a banca de passagem de degrau (PLANO-ESCOLA.md, F4 e seção 3, item 6): quem acompanha (só alguém
 * do Degrau 3, indicado pela coordenação), as bancas da pessoa com o balanço coletivo (sem nota) e, para quem acompanha
 * alguém, marcar a banca e registrar o balanço. A banca aprovada sobe o degrau no banco.
 */
export function BancaDePassagem({ lang, eu, t }: { lang: string; eu: EscolaEuDentro; t: T }) {
  const [bancas, setBancas] = useState<BancaListada[] | null>(null);
  const [acompanho, setAcompanho] = useState<Acompanhado[]>([]);
  const [vez, setVez] = useState(0);
  const recarregar = useCallback(() => setVez((v) => v + 1), []);
  useEffect(() => {
    let vivo = true;
    Promise.all([chamarDoNucleo("escola_bancas_listar"), chamarDoNucleo("escola_acompanho")]).then(([b, a]) => {
      if (!vivo) return;
      setBancas(b.ok ? b.dados : []);
      setAcompanho(a.ok ? a.dados : []);
    });
    return () => {
      vivo = false;
    };
  }, [vez]);

  const minhas = (bancas ?? []).filter((b) => b.minha);
  const nome = eu.acompanha ? (eu.acompanha.codinome ?? t.banca.alguem) : null;
  return (
    <section aria-labelledby="en-banca-t" className="en-bloco en-lado-cartao" aria-busy={bancas === null}>
      <h2 id="en-banca-t" className="ef-t en-h2">
        {t.banca.titulo}
      </h2>
      <p>{nome ? preencher(t.banca.acompanha, { nome }) : t.banca.semAcompanha}</p>

      <h3 className="ef-t en-h3">{t.banca.minhas}</h3>
      {bancas === null ? (
        <p className="en-vazio">{t.tela.carregando}</p>
      ) : minhas.length === 0 ? (
        <p className="en-vazio">{t.banca.semMinhas}</p>
      ) : (
        <ul className="en-bancas">
          {minhas.map((b) => (
            <li key={b.id}>
              <Banca b={b} lang={lang} t={t} />
            </li>
          ))}
        </ul>
      )}

      {acompanho.length > 0 && (
        <>
          <h3 className="ef-t en-h3">{t.banca.acompanho}</h3>
          <ul className="en-bancas">
            {acompanho.map((p) => {
              const marcada = (bancas ?? []).find((b) => !b.minha && b.decido && b.situacao === "marcada" && b.usuario === p.usuario);
              return (
                <li key={p.usuario}>
                  <p className="en-banca-linha">
                    <strong>{p.codinome ?? t.pauta.alguem}</strong> · {preencher(t.banca.degrau, { n: p.degrau })}
                  </p>
                  {marcada ? (
                    <>
                      <Banca b={marcada} lang={lang} t={t} />
                      <h4 className="en-rotulo">{t.banca.decidirTitulo}</h4>
                      <Decidir banca={marcada} t={t} depois={recarregar} />
                    </>
                  ) : p.banca_marcada ? null : (
                    <Marcar pessoa={p} t={t} depois={recarregar} />
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O aceite dos termos dentro da Alumia: quem entrou antes desta versão (ou nunca aceitou os termos da Alumia) vê o cartão no alto
// da linha de Início e na página dos termos, e só some depois de aceitar. O aceite do cadastro é gravado pelo banco junto do
// consentimento do pedido de entrada; este cartão é o reaceite (alumia_termos_aceitar).
import { useEffect, useId, useState } from "react";
import { quando, Rico } from "./base";
import { lei, type TermosEu } from "./cliente";
import { por } from "./textos";
import { useTextosDaLei } from "./usarTextos";
import { dataDaVersao } from "./versao";

/** O estado do aceite de quem está na Alumia; nulo enquanto não sabe (ou sem sessão, ou banco sem a migração). */
export function useTermos(ligado = true): [TermosEu | null, (t: TermosEu) => void] {
  const [termos, setTermos] = useState<TermosEu | null>(null);
  useEffect(() => {
    if (!ligado) return;
    let vivo = true;
    lei.termos().then(
      (r) => vivo && setTermos(r),
      () => undefined,
    );
    return () => {
      vivo = false;
    };
  }, [ligado]);
  return [termos, setTermos];
}

export function Reaceite({ lang, naPagina = false, logado = true }: { lang: string; naPagina?: boolean; logado?: boolean }) {
  const t = useTextosDaLei(lang);
  const [termos, setTermos] = useTermos(logado);
  const [marcado, setMarcado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(false);
  const id = useId();

  if (!t || !termos || !termos.logado) return null;
  const r = t.reaceite;
  if (termos.aceita) {
    if (!naPagina) return null;
    return <p id="aceite" className="le-ok le-reaceite-na-pagina">{por(r.aceito, { quando: quando(lang, termos.aceita_em, false) })}</p>;
  }

  const aceitar = async () => {
    setEnviando(true);
    setErro(false);
    try {
      setTermos(await lei.aceitar(termos.vigente));
    } catch {
      setErro(true);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section id={naPagina ? "aceite" : undefined} className={`le-reaceite${naPagina ? " le-reaceite-na-pagina" : ""}`} aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="al-cond">{termos.anterior ? r.tituloMudou : r.tituloNovo}</h2>
      <p>
        {/* Na própria página dos termos, o texto não manda para a mesma página. */}
        <Rico lang={lang} texto={por(naPagina ? r.textoNaPagina : r.texto, { data: dataDaVersao(lang) })} />
      </p>
      {termos.anterior && termos.mudou && <p><strong>{por(r.mudou, { mudou: termos.mudou })}</strong></p>}
      <label>
        <input type="checkbox" checked={marcado} onChange={(e) => setMarcado(e.target.checked)} />
        <span>{r.caixa}</span>
      </label>
      <div className="le-acoes">
        <button type="button" className="al-botao al-botao-primario al-botao-m" disabled={!marcado || enviando} onClick={aceitar}>
          {enviando ? t.comum.enviando : r.aceitar}
        </button>
      </div>
      {erro && <p role="alert">{t.comum.erro}</p>}
      <p className="le-pequeno">
        <Rico lang={lang} texto={r.naoQuer} />
      </p>
    </section>
  );
}

/** Para o encaixe topoDaLinha (no alto do Início). */
export function ReaceiteNoInicio({ lang, situacao }: { lang: string; situacao: { logado: boolean } }) {
  return <Reaceite lang={lang} logado={situacao.logado} />;
}

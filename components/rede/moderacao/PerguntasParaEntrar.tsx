// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "./o9.css";
import { useEffect, useState } from "react";
import { LIMITES, moderacaoDaComunidade } from "@/lib/rede/comunidade-moderacao";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { SituacaoNaComunidade } from "@/lib/rede/tipos-comunidades";
import { mensagemDeErro, useTextosMod } from "./base";

/**
 * Pedir para entrar numa comunidade restrita que faz perguntas: lê as perguntas, a pessoa responde e o pedido vai junto
 * (alumia_com_pedir). Sem perguntas, o pedido sai na hora, como antes. As respostas vão só para a moderação daquele lugar e somem
 * quando o pedido é decidido. Usado por AcoesDaComunidade; quem junta troca o "Pedir para entrar" da página da comunidade da
 * Alumia por este componente (ou abre ele quando o banco responder "responda_perguntas").
 */
export function PerguntasParaEntrar({
  slug,
  lang,
  s,
  aoPedir,
  aoCancelar,
}: {
  slug: string;
  lang: string;
  s: Pick<TextosDaRede, "erros">;
  aoPedir: (situacao: SituacaoNaComunidade) => void;
  aoCancelar: () => void;
}) {
  const sm = useTextosMod(lang);
  const [perguntas, setPerguntas] = useState<string[] | null>(null);
  const [respostas, setRespostas] = useState<string[]>([]);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    moderacaoDaComunidade.perguntas(slug).then(
      (r) => {
        if (!vivo) return;
        setPerguntas(r.perguntas);
        setRespostas(r.perguntas.map(() => ""));
      },
      () => vivo && setPerguntas([]),
    );
    return () => {
      vivo = false;
    };
  }, [slug]);

  async function pedir() {
    if (ocupado || !sm) return;
    setOcupado(true);
    setErro("");
    try {
      const r = await moderacaoDaComunidade.pedir(slug, respostas.map((x) => x.trim()));
      aoPedir(r.situacao === "membro" ? "membro" : r.situacao === "pendente" ? "pendente" : null);
    } catch (e) {
      setErro(mensagemDeErro(s, sm, e));
    } finally {
      setOcupado(false);
    }
  }

  if (!sm || perguntas === null) return <p className="m9-nota" role="status">{sm?.carregando ?? "…"}</p>;
  const t = sm.o9.responder;
  const completo = respostas.every((x) => x.trim().length > 0);
  return (
    <form
      className="m9 m9-secao"
      aria-label={t.titulo}
      onSubmit={(e) => {
        e.preventDefault();
        void pedir();
      }}
    >
      {perguntas.length > 0 && (
        <>
          <h3 className="m9-secao-titulo m9-cond">{t.titulo}</h3>
          <p className="m9-lead">{t.ajuda}</p>
          <div className="m9-campos">
            {perguntas.map((q, i) => (
              <label key={i} className="m9-campo">
                {q}
                <textarea value={respostas[i] ?? ""} maxLength={LIMITES.resposta} rows={2} required onChange={(e) => setRespostas((l) => l.map((x, j) => (j === i ? e.target.value : x)))} />
              </label>
            ))}
          </div>
        </>
      )}
      <div className="m9-acoes">
        <button type="submit" className="al-botao al-botao-primario al-botao-m" disabled={ocupado || !completo}>{ocupado ? t.enviando : t.enviar}</button>
        <button type="button" className="al-botao al-botao-fantasma al-botao-m" onClick={aoCancelar}>{t.cancelar}</button>
      </div>
      {erro && <p className="m9-erro" role="alert">{erro}</p>}
    </form>
  );
}

export default PerguntasParaEntrar;

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { baixarPdf, enderecoDaLicenca, type Trabalho } from "@/lib/gaveta";
import { safeLink } from "@/lib/text";
import { useI18n } from "../I18n";
import { Aviso, botao, botaoClaro, campo, dataHora, elo, rotulo, useAcao, useLista } from "./comum";

const tipos: Record<string, string> = { tcc: "TCC", monografia: "Monografia", dissertacao: "Dissertação ou tese", artigo: "Artigo", projeto: "Projeto", relatorio: "Relatório", apostila: "Apostila ou resumo", codigo: "Código", apresentacao: "Apresentação", outro: "Outro" };
const situacoes: Record<string, string> = { pendente: "esperando decisão", aprovado: "publicado", recusado: "recusado", retirado: "retirado por quem publicou" };

/** A prévia do PDF para quem decide: abre numa aba nova, a partir do depósito fechado. */
function Previa({ caminho }: { caminho: string }) {
  const [erro, setErro] = useState("");
  return (
    <>
      <button
        type="button"
        className={elo}
        onClick={async () => {
          setErro("");
          // A aba abre antes do download terminar, senão o navegador a trata como janela indesejada.
          const aba = window.open("", "_blank");
          try {
            const endereco = await baixarPdf(caminho);
            if (aba) aba.location.href = endereco;
            else window.location.href = endereco;
          } catch {
            aba?.close();
            setErro("O arquivo não abriu.");
          }
        }}
      >
        Ver o PDF
      </button>
      {erro && <span className="text-oxblood"> {erro}</span>}
    </>
  );
}

/**
 * Gaveta Aberta: a fila do que estudantes publicaram. Quem decide confere se é mesmo trabalho de estudante, se o
 * arquivo não expõe dados de ninguém (nem nos metadados) e se o comentário está de acordo com as regras.
 */
export function GavetaFila() {
  const { t } = useI18n();
  const lista = useLista<Trabalho[]>("gaveta_fila");
  const [notas, setNotas] = useState<Record<string, string>>({});
  const acao = useAcao(lista.recarregar);
  const [mostrar, setMostrar] = useState<"pendente" | "decididos">("pendente");
  const visiveis = lista.dados?.filter((item) => (mostrar === "pendente" ? item.status === "pendente" : item.status !== "pendente")) ?? [];
  const nomeDaArea = (slug: string) => t.areas[slug as keyof typeof t.areas]?.[0] ?? slug;
  return (
    <div>
      <p className="max-w-3xl text-ink-soft">
        Antes de aprovar: é trabalho de estudante, de quem publicou? O link ou o PDF abre e é o trabalho descrito? O arquivo não expõe dados de outras pessoas (entrevistados, endereços, documentos), nem nas
        propriedades do PDF? O comentário segue as regras de convivência? O nome completo do termo é só para o registro do aceite e nunca aparece no site.
      </p>
      <div className="mt-4 flex gap-3">
        {(["pendente", "decididos"] as const).map((id) => (
          <button key={id} type="button" aria-pressed={mostrar === id} onClick={() => setMostrar(id)} className={`cursor-pointer border px-3 py-1 ${mostrar === id ? "border-ink bg-ink text-parchment" : "border-rule bg-parchment-deep hover:border-ink"}`}>
            {id === "pendente" ? `Esperando (${lista.dados?.filter((item) => item.status === "pendente").length ?? 0})` : "Decididos nos últimos 60 dias"}
          </button>
        ))}
      </div>
      <Aviso texto={lista.erro || acao.aviso} />
      {lista.dados && visiveis.length === 0 && <p className="mt-3 border border-rule bg-parchment-deep px-4 py-5 text-ink-soft">Nada aqui.</p>}
      <ul className="mt-3 space-y-4">
        {visiveis.map((item) => (
          <li key={item.id} className={`border bg-parchment-deep p-4 ${item.status === "pendente" ? "border-2 border-ink" : "border-rule"}`}>
            <p className={rotulo}>
              {tipos[item.tipo] ?? item.tipo} · {nomeDaArea(item.disciplina)} · {item.licenca} · {situacoes[item.status ?? ""] ?? item.status} · enviado em {item.criado_em ? dataHora(item.criado_em) : "?"}
            </p>
            <p className="mt-1 font-serif text-xl font-semibold">{item.titulo}</p>
            <p className="text-ink-soft">{[item.curso, item.instituicao, item.ano ? String(item.ano) : ""].filter(Boolean).join(" · ")}</p>
            <p className="mt-1">Crédito público: <strong>{item.credito}</strong> · conta: {item.autor || "apagada"}</p>
            <p className="mt-2 whitespace-pre-line" data-original>{item.comentario}</p>
            <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
              {item.link && safeLink(item.link) && <a href={item.link} target="_blank" rel="noopener noreferrer" className={elo}>Abrir o link: {item.link}</a>}
              {item.arquivo && <Previa caminho={item.arquivo} />}
              <a href={enderecoDaLicenca[item.licenca]} target="_blank" rel="noopener noreferrer" className={elo}>A licença escolhida</a>
            </p>
            <p className="mt-2 text-xs text-ink-soft">
              Termo versão {item.termo_versao} aceito por <strong>{item.termo_nome}</strong> em {item.termo_em ? dataHora(item.termo_em) : "?"}.
            </p>
            {item.status !== "pendente" && (item.decidido_por || item.nota) && <p className="mt-1 text-ink-soft">Decidido por {item.decidido_por || "?"}{item.nota && `: ${item.nota}`}</p>}
            {item.status !== "retirado" && (
              <div className="mt-3 border-t border-rule pt-3">
                <label className="block">
                  Nota para quem publicou {item.status === "pendente" ? "(obrigatória para recusar)" : ""}
                  <input value={notas[item.id] ?? ""} onChange={(e) => setNotas({ ...notas, [item.id]: e.target.value })} maxLength={1000} className={campo} />
                </label>
                <p className="mt-2 flex flex-wrap gap-3">
                  {item.status !== "aprovado" && (
                    <button type="button" className={botao} disabled={acao.ocupado} onClick={() => acao.agir("gaveta_decidir", { p_id: item.id, p_aprovar: true, p_nota: notas[item.id] ?? "" }, "Publicado na Gaveta.")}>
                      Publicar
                    </button>
                  )}
                  {item.status !== "recusado" && (
                    <button type="button" className={botaoClaro} disabled={acao.ocupado || (notas[item.id] ?? "").trim().length < 5} onClick={() => acao.agir("gaveta_decidir", { p_id: item.id, p_aprovar: false, p_nota: notas[item.id] ?? "" }, item.status === "aprovado" ? "Tirado do ar." : "Recusado.")}>
                      {item.status === "aprovado" ? "Tirar do ar" : "Recusar"}
                    </button>
                  )}
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

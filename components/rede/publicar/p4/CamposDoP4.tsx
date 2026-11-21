// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId } from "react";
import { preencher } from "@/lib/rede/preencher";
import { fonteDoCampo, LIMITE_DO_RESUMO, type EscolhasDoP4 } from "@/lib/rede/publicar/p4-compositor";
import { Pilulas } from "../alumia2/Pilulas";
import type { TextosDoP4 } from "./textos";
import "./p4.css";

/**
 * "Mais do post" no Escrever (prompt 4, atrás de "alumia-p4-compositor"), embaixo dos anexos:
 *   - no texto longo: a versão curta (item 117, até 280, escrita pela autora), a capa (item 26, uma das imagens anexadas) e a dica
 *     dos capítulos ("## " abre um; o índice e a leitura em páginas são feitos na tela de quem lê);
 *   - no post de abertura: "Mande a sua" (item 29, o post vira um convite; o total só aparece a partir de 3 pessoas);
 *   - em todo post de abertura: a fonte (item 118, um link sem rastreio ou um caso do Vale o Escrito), que dá a marca "com fonte".
 * Nada daqui aparece na resposta, no ato nem no post cifrado (quem chama não desenha). O banco confere tudo de novo
 * (interno.rede_p4c_separar).
 */
export function CamposDoP4({
  t,
  escolhas,
  aoMudar,
  longo,
  convitePode,
  imagens,
}: {
  t: TextosDoP4;
  escolhas: EscolhasDoP4;
  aoMudar: (e: EscolhasDoP4) => void;
  /** É texto longo (discussão ou dúvida)? */
  longo: boolean;
  /** Cabe o convite "Mande a sua" (post curto de abertura, fora do fio e da enquete)? */
  convitePode: boolean;
  /** Quantas imagens estão anexadas (a capa é uma delas). */
  imagens: number;
}) {
  const id = useId();
  const mudar = (parte: Partial<EscolhasDoP4>) => aoMudar({ ...escolhas, ...parte });
  const fonteRuim = escolhas.fonte.trim() !== "" && !fonteDoCampo(escolhas.fonte);
  // A capa que caiu fora (a imagem foi tirada) volta para "sem capa" na tela; o pedido também não a leva (camposDoP4).
  const capa = escolhas.capa !== null && escolhas.capa < imagens ? String(escolhas.capa) : "";
  const preenchidas = Boolean(escolhas.resumo.trim() || capa || escolhas.convite || escolhas.fonte.trim());
  return (
    <details className="al2-anexo p4c-mais" open={preenchidas || undefined} data-p4c="campos">
      <summary className="p4c-resumo-da-caixa cursor-pointer font-bold">{t.campos.titulo}</summary>
      <div className="mt-3 space-y-4">
        {longo && (
          <>
            <label className="block">
              <span className="al2-rotulo">{t.campos.resumo}</span>
              <textarea
                className="al2-campo min-h-24 resize-y"
                rows={3}
                maxLength={LIMITE_DO_RESUMO}
                value={escolhas.resumo}
                aria-describedby={`${id}-resumo`}
                onChange={(e) => mudar({ resumo: e.target.value })}
              />
              <span id={`${id}-resumo`} className="mt-1 flex justify-between gap-3 text-xs text-[var(--al-texto-3)]">
                <span>{t.campos.resumoDica}</span>
                <span aria-hidden className="shrink-0 tabular-nums">{preencher(t.campos.resumoContador, { n: escolhas.resumo.length })}</span>
              </span>
            </label>
            {imagens > 0 && (
              <div>
                <span className="al2-rotulo" id={`${id}-capa`}>{t.campos.capa}</span>
                <Pilulas
                  rotulo={t.campos.capa}
                  className="flex flex-wrap gap-2"
                  classeItem="al2-tipo !min-h-11 !px-3 text-sm"
                  opcoes={[{ valor: "", conteudo: t.campos.semCapa }, ...Array.from({ length: imagens }, (_, i) => ({ valor: String(i), conteudo: preencher(t.campos.capaN, { n: i + 1 }) }))]}
                  escolhido={capa}
                  aoMudar={(v) => mudar({ capa: v === "" ? null : Number(v) })}
                />
                <p className="mt-1 text-xs text-[var(--al-texto-3)]">{t.campos.capaAjuda}</p>
              </div>
            )}
            <p className="al2-nota">{t.campos.capitulos}</p>
          </>
        )}
        {convitePode && (
          <label className="al2-opcao-b1">
            <input type="checkbox" role="switch" className="al2-caixinha" checked={escolhas.convite} onChange={(e) => mudar({ convite: e.target.checked })} aria-describedby={`${id}-convite`} />
            <span className="min-w-0">
              <span className="block font-bold">{t.campos.convite}</span>
              <span id={`${id}-convite`} className="block text-xs text-[var(--al-texto-3)]">{t.campos.conviteDica}</span>
            </span>
          </label>
        )}
        <label className="block">
          <span className="al2-rotulo">{t.campos.fonte}</span>
          <input
            className="al2-campo min-h-11"
            type="text"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            maxLength={500}
            value={escolhas.fonte}
            aria-invalid={fonteRuim || undefined}
            aria-describedby={`${id}-fonte`}
            onChange={(e) => mudar({ fonte: e.target.value })}
          />
          <span id={`${id}-fonte`} className={`mt-1 block text-xs ${fonteRuim ? "text-[var(--al-vermelho)]" : "text-[var(--al-texto-3)]"}`} role={fonteRuim ? "alert" : undefined}>
            {fonteRuim ? t.campos.fonteRuim : t.campos.fonteDica}
          </span>
        </label>
      </div>
    </details>
  );
}

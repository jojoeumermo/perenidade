// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import type { TextosDoPercurso } from "@/i18n/escola/percurso";
import { emPrevia, lerDaEscola } from "@/lib/escola/acesso";
import type { PublicoDasConquistas, TagDaEscola } from "@/lib/escola/contratos";
import { SelosDaEscola } from "./SelosDaEscola";

/**
 * A tag de revolucionária(o) e a frente de atuação no perfil da Alumia (P5, B3 e B5; supabase/migracoes/20261126-p5-escola.sql).
 * Padrão: desligada. Só liga depois de escolhido o público das conquistas (a tela de consentimento da F5 vem antes), e aparece
 * para esse mesmo público. A tag é de quem está na Frente, conferido no banco; ninguém consegue tirar do banco uma lista de quem
 * tem a tag. Nada daqui fica no aparelho.
 */
export function TagNaAlumia({ publico, t, tSelos }: { publico: PublicoDasConquistas; t: TextosDoPercurso["alumia"]; tSelos: TextosDoPercurso["selos"] }) {
  const [tag, setTag] = useState<TagDaEscola | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let vivo = true;
    // Na prévia de desenvolvimento, nada vai à rede: um estado de exemplo, só na memória.
    const pedido = emPrevia()
      ? Promise.resolve({ ok: true as const, dados: { mostrar: false, publico, na_frente: true, frente: "cultura" } satisfies TagDaEscola })
      : lerDaEscola("escola_tag_minha", {});
    pedido.then((r) => {
      if (!vivo) return;
      if (r.ok) setTag(r.dados);
      else setAviso({ texto: t.erros[r.motivo], erro: true });
    });
    return () => {
      vivo = false;
    };
  }, [publico, t]);

  // O banco desliga a tag quando o público volta para "ninguém": a tela acompanha sem ir de novo à rede.
  const mostrar = Boolean(tag?.mostrar) && publico !== "ninguem";

  async function mudar(ligar: boolean) {
    setOcupado(true);
    setAviso(null);
    const r = emPrevia() ? ({ ok: true } as const) : await lerDaEscola("escola_tag_definir", { p_mostrar: ligar });
    setOcupado(false);
    if (!r.ok) {
      setAviso({ texto: t.erros[r.motivo], erro: true });
      return;
    }
    setTag((x) => (x ? { ...x, mostrar: ligar } : x));
    setAviso({ texto: t.tag.salvo });
  }

  if (!tag) return aviso ? <p className="ep-aviso" data-erro="" role="alert">{aviso.texto}</p> : null;
  const previa = [{ tipo: "revolucionario" as const }, ...(tag.frente ? [{ tipo: "frente" as const, frente: tag.frente }] : [])];
  return (
    <div className="ep-tag" data-tag-da-escola="">
      <h3>{t.tag.titulo}</h3>
      <p>{t.tag.texto}</p>
      <label className="ep-publico">
        <input type="checkbox" checked={mostrar} disabled={ocupado || publico === "ninguem"} onChange={(e) => void mudar(e.target.checked)} />
        <span>
          <strong>{t.tag.ligar}</strong>
          {publico === "ninguem" && <span>{t.tag.semPublico}</span>}
          {publico !== "ninguem" && !tag.na_frente && <span>{t.tag.semFrente}</span>}
        </span>
      </label>
      {tag.na_frente && <SelosDaEscola selos={previa} t={tSelos} rotulo={t.tag.titulo} />}
      <p className="ep-nota">{t.tag.privacidade}</p>
      <div role="status" aria-live="polite">
        {aviso && (
          <p className="ep-aviso" data-erro={aviso.erro ? "" : undefined}>
            {aviso.texto}
          </p>
        )}
      </div>
    </div>
  );
}

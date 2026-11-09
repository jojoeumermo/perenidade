// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Mosaico } from "../mosaico/Mosaico";
import type { ContextoDoEncaixe } from "../encaixes";
import { useTextosDosAtos } from "./usar";
import { CAMPOS_VAZIOS, conferirAto, type CamposDoAto } from "@/lib/rede/atos/formulario";
import { doCampoLocal, paraCampoLocal } from "@/lib/rede/atos/tempo";
import { normalizarPalavra } from "@/lib/rede/mosaico";
import { preencherAto } from "@/lib/rede/textos-atos";
import { LIMITES_DO_ATO, type DadosDoAto } from "@/lib/rede/tipos-atos";
import "./atos.css";

type Campo = keyof CamposDoAto;

/**
 * O formulário do tipo "Ato" no compositor (prancha celular-escrever-ato): "Nome do ato (vira a palavra do mosaico)", Quando,
 * Onde, Cidade (é ela que põe o ato em "Perto"; nada de GPS), Chamado e a prévia do mosaico APAGADO com a palavra que vai sair.
 * A cada mudança entrega ao compositor o que conferiu (lib/rede/atos/formulario.ts, os mesmos limites do banco); os problemas
 * só aparecem depois que a pessoa sai do campo, para não gritar enquanto ela escreve.
 */
export function FormularioDoAto({ lang, aoMudar }: ContextoDoEncaixe & { aoMudar: (dados: Record<string, unknown>) => void }) {
  const t = useTextosDosAtos(lang);
  const id = useId();
  const [c, setC] = useState<CamposDoAto>(CAMPOS_VAZIOS);
  const [tocado, setTocado] = useState<Partial<Record<Campo, boolean>>>({});
  const aoMudarRef = useRef(aoMudar);
  useEffect(() => {
    aoMudarRef.current = aoMudar;
  }, [aoMudar]);

  const dados: DadosDoAto = conferirAto(c);
  useEffect(() => {
    aoMudarRef.current({ ...conferirAto(c) });
  }, [c]);

  if (!t) return <div className="al-ato-form" aria-busy="true" />;

  const mudar = (campo: Campo, valor: string | null) => setC((x) => ({ ...x, [campo]: valor }));
  const sair = (campo: Campo) => setTocado((x) => ({ ...x, [campo]: true }));
  const problema = (campo: Exclude<Campo, never>) => {
    const p = tocado[campo] ? dados.problemas[campo] : undefined;
    return p ? t.formulario.problemas[p] : null;
  };
  const props = (campo: Campo) => {
    const p = problema(campo);
    return {
      id: `${id}-${campo}`,
      "aria-invalid": p ? true : undefined,
      "aria-describedby": p ? `${id}-${campo}-p` : undefined,
      onBlur: () => sair(campo),
    } as const;
  };
  const aviso = (campo: Campo) => {
    const p = problema(campo);
    return p ? (
      <p id={`${id}-${campo}-p`} className="al-ato-form-problema">
        {p}
      </p>
    ) : null;
  };
  const palavra = normalizarPalavra(c.titulo) || normalizarPalavra(t.formulario.nomeExemplo);

  return (
    <div className="al-ato-form">
      <div className="al-ato-form-grupo">
        <label htmlFor={`${id}-titulo`} className="al-ato-form-rotulo">
          {t.formulario.nome}
        </label>
        <input
          {...props("titulo")}
          className="al-ato-form-campo al-ato-form-nome"
          value={c.titulo}
          onChange={(e) => mudar("titulo", e.target.value)}
          placeholder={t.formulario.nomeExemplo}
          maxLength={LIMITES_DO_ATO.tituloMax}
          autoComplete="off"
          enterKeyHint="next"
        />
        {aviso("titulo")}
      </div>

      <div className="al-ato-form-dupla">
        <div className="al-ato-form-grupo">
          <label htmlFor={`${id}-quando`} className="al-ato-form-rotulo">
            {t.formulario.quando}
          </label>
          <input
            {...props("quando")}
            type="datetime-local"
            className="al-ato-form-campo"
            value={paraCampoLocal(c.quando)}
            onChange={(e) => mudar("quando", doCampoLocal(e.target.value))}
          />
          {aviso("quando")}
        </div>
        <div className="al-ato-form-grupo">
          <label htmlFor={`${id}-onde`} className="al-ato-form-rotulo">
            {t.formulario.onde}
          </label>
          <input
            {...props("onde")}
            className="al-ato-form-campo"
            value={c.onde}
            onChange={(e) => mudar("onde", e.target.value)}
            placeholder={t.formulario.ondeExemplo}
            maxLength={LIMITES_DO_ATO.ondeMax}
            autoComplete="off"
          />
          {aviso("onde")}
        </div>
      </div>

      <div className="al-ato-form-grupo">
        <label htmlFor={`${id}-cidade`} className="al-ato-form-rotulo">
          {t.formulario.cidade}
        </label>
        <input
          {...props("cidade")}
          className="al-ato-form-campo"
          value={c.cidade}
          onChange={(e) => mudar("cidade", e.target.value)}
          placeholder={t.formulario.cidadeExemplo}
          maxLength={LIMITES_DO_ATO.cidadeMax}
          autoComplete="off"
        />
        {aviso("cidade")}
      </div>

      <div className="al-ato-form-grupo">
        <label htmlFor={`${id}-descricao`} className="al-ato-form-rotulo">
          {t.formulario.chamado}
        </label>
        <textarea
          {...props("descricao")}
          className="al-ato-form-campo al-ato-form-chamado"
          value={c.descricao}
          onChange={(e) => mudar("descricao", e.target.value)}
          placeholder={t.formulario.chamadoExemplo}
          maxLength={LIMITES_DO_ATO.descricaoMax}
        />
        {aviso("descricao")}
        {c.descricao.length > LIMITES_DO_ATO.descricaoMax - 80 ? (
          <p className="al-ato-form-conta" aria-live="polite">
            {preencherAto(t.formulario.restam, { n: LIMITES_DO_ATO.descricaoMax - c.descricao.length })}
          </p>
        ) : null}
      </div>

      <div className="al-ato-form-previa">
        <Mosaico palavra={palavra} semente={`previa-${palavra}`} proporcao={null} rotulo={preencherAto(t.formulario.previaRotulo, { palavra })} />
      </div>
      <p className="al-ato-form-previa-texto">{t.formulario.previa}</p>
    </div>
  );
}

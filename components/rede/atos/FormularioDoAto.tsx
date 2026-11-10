// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Mosaico } from "../mosaico/Mosaico";
import { CampoDeQuando } from "../ui/CampoDeQuando";
import type { ContextoDoEncaixe } from "../encaixes";
import { useTelaLarga, useTextosDosAtos } from "./usar";
import { CAMPOS_VAZIOS, conferirAto, type CamposDoAto } from "@/lib/rede/atos/formulario";
import { dataLonga, doCampoLocal, paraCampoLocal } from "@/lib/rede/atos/tempo";
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
  const largo = useTelaLarga();
  const id = useId();
  const [c, setC] = useState<CamposDoAto>(CAMPOS_VAZIOS);
  const [tocado, setTocado] = useState<Partial<Record<Campo, boolean>>>({});
  const aoMudarRef = useRef(aoMudar);
  // A pessoa escreveu a cidade à mão: a sugestão tirada do Onde para de mexer nela.
  const cidadeMexida = useRef(false);
  useEffect(() => {
    aoMudarRef.current = aoMudar;
  }, [aoMudar]);

  const dados: DadosDoAto = conferirAto(c);
  useEffect(() => {
    aoMudarRef.current({ ...conferirAto(c) });
  }, [c]);

  if (!t) return <div className="al-ato-form" aria-busy="true" />;

  const mudar = (campo: Campo, valor: string | null) => setC((x) => ({ ...x, [campo]: valor }));
  const mudarOnde = (valor: string) =>
    setC((x) => {
      if (cidadeMexida.current) return { ...x, onde: valor };
      const i = valor.lastIndexOf(",");
      const sugerida = i > 0 ? valor.slice(i + 1).trim() : "";
      return { ...x, onde: valor, cidade: sugerida.slice(0, LIMITES_DO_ATO.cidadeMax) };
    });
  const sair = (campo: Campo) => setTocado((x) => ({ ...x, [campo]: true }));
  const problema = (campo: Exclude<Campo, never>) => {
    const p = tocado[campo] ? dados.problemas[campo] : undefined;
    return p ? t.formulario.problemas[p] : null;
  };
  const props = (campo: Campo, extra?: string) => {
    const p = problema(campo);
    const descricao = [p ? `${id}-${campo}-p` : null, extra ?? null].filter(Boolean).join(" ");
    return {
      id: `${id}-${campo}`,
      "aria-invalid": p ? true : undefined,
      "aria-describedby": descricao || undefined,
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
          {/* O resumo como a prancha ("ter 19/11 · 6h") no lugar do "mm/dd/yyyy" do campo nativo; o leitor de tela ouve a data longa. */}
          <CampoDeQuando
            {...props("quando", c.quando ? `${id}-quando-legivel` : undefined)}
            className="al-ato-form-campo"
            valor={paraCampoLocal(c.quando)}
            aoMudar={(v) => mudar("quando", doCampoLocal(v))}
            lang={lang}
            vazio={t.formulario.escolherQuando}
          />
          {c.quando ? (
            <p id={`${id}-quando-legivel`} className="sr-only">
              {dataLonga(c.quando, lang)}
            </p>
          ) : null}
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
            onChange={(e) => mudarOnde(e.target.value)}
            placeholder={t.formulario.ondeExemplo}
            maxLength={LIMITES_DO_ATO.ondeMax}
            autoComplete="off"
          />
          {aviso("onde")}
          {/* A cidade mora junto do Onde (é ela que põe o ato em "Perto"; nada de GPS): curta, embaixo do ponto, e já sugerida pelo
              que vem depois da última vírgula ("Ocupação Esperança, Itaquera" → Itaquera) enquanto a pessoa não mexe nela. */}
          <span className="al-ato-form-cidade">
            <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11zM12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />
            </svg>
            <span aria-hidden className="al-ato-form-cidade-rotulo">
              {t.formulario.cidadeCurta}
            </span>
            <input
              {...props("cidade")}
              aria-label={t.formulario.cidade}
              className="al-ato-form-cidade-campo"
              value={c.cidade}
              onChange={(e) => {
                cidadeMexida.current = true;
                mudar("cidade", e.target.value);
              }}
              placeholder={t.formulario.cidadeExemplo}
              maxLength={LIMITES_DO_ATO.cidadeMax}
              autoComplete="address-level2"
            />
          </span>
          {aviso("cidade")}
        </div>
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
        {/* No celular a palavra quebra nos espaços (31 cartões de largura, como o cartão do ato), para sair grande e legível. */}
        <Mosaico palavra={palavra} semente={`previa-${palavra}`} proporcao={null} quebrar={largo ? undefined : 31} rotulo={preencherAto(t.formulario.previaRotulo, { palavra })} />
      </div>
      <p className="al-ato-form-previa-texto">{t.formulario.previa}</p>
    </div>
  );
}

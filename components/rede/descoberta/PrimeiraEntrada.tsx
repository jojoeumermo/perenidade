// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import Link from "@/components/Link";
import { localePath } from "@/i18n/config";
import { chamar, rede } from "@/lib/rede/cliente";
import { redeDescoberta } from "@/lib/rede/cliente-descoberta";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDaDescoberta } from "@/lib/rede/textos-descoberta";
import type { Situacao } from "@/lib/rede/tipos";
import { PASSOS, type EstadoDaEntrada, type Passo } from "@/lib/rede/tipos-descoberta";
import { textoDoErro } from "../erros";
import { PassoEscolhas } from "./PassoEscolhas";

/** Por onde a pessoa recomeça, conforme o que o banco já sabe dela. */
function passoInicial(estado: EstadoDaEntrada): Passo {
  switch (estado.passo) {
    case "codinome":
      return "codinome";
    case "escolhas":
      return "escolhas";
    case "guia":
      return "guia";
    default:
      return "regras";
  }
}

const botaoPrimario = "min-h-11 cursor-pointer rounded-full bg-[#c21f16] px-5 font-bold text-white hover:bg-[#1f1a14] disabled:cursor-not-allowed disabled:opacity-50";
const botaoSecundario = "min-h-11 cursor-pointer rounded-full border-[1.5px] border-ink px-5 font-bold hover:bg-parchment-deep disabled:opacity-50";

/**
 * A primeira entrada guiada (R4 29): regras → consentimento destacado para dado sensível (LGPD art. 11, I, com a versão das regras)
 * → idade 18+ → codinome → 3 lutas + 3 trilhas → guia de segurança de 4 cartões. Só o guia pode ser pulado. O banco guarda o que
 * importa (rede_aderir grava o consentimento e a idade; as escolhas e o guia ficam em rede_desc_entrada): quem volta recomeça
 * do passo em que parou. Quem declara menos de 18 anos não entra na Rede e nada é gravado.
 */
export function PrimeiraEntrada({
  lang,
  s,
  d,
  estado,
  situacao,
  aoConcluir,
}: {
  lang: string;
  s: TextosDaRede;
  d: TextosDaDescoberta;
  estado: EstadoDaEntrada;
  situacao: Situacao;
  aoConcluir: (nova: Situacao) => void;
}) {
  const t = d.entrada;
  const [passo, setPasso] = useState<Passo>(passoInicial(estado));
  const [leu, setLeu] = useState(false);
  const [consente, setConsente] = useState(false);
  const [maior, setMaior] = useState(false);
  const [menor, setMenor] = useState(false);
  const [nome, setNome] = useState(estado.codinome ?? situacao.codinome ?? "");
  const [cartao, setCartao] = useState(0);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [atual, setAtual] = useState(estado);

  const indice = PASSOS.indexOf(passo);
  const cartoes = t.guia.cartoes;

  async function rodar(tarefa: () => Promise<void>) {
    setErro("");
    setOcupado(true);
    try {
      await tarefa();
    } catch (x) {
      setErro(textoDoErro(s, x) || t.erro);
    } finally {
      setOcupado(false);
    }
  }

  /** Fim do passo "idade": é aqui que o consentimento e os 18 anos são gravados, de uma vez, com a versão das regras. */
  const aderir = () =>
    rodar(async () => {
      const nova = await rede.aderir(true, estado.regras_versao);
      if (nova.codinome_ok) setPasso("escolhas");
      else setPasso("codinome");
    });

  const definirCodinome = () =>
    rodar(async () => {
      await chamar("rede_codinome_definir", { p_codinome: nome.trim() });
      setPasso("escolhas");
    });

  const terminar = (pulado: boolean) =>
    rodar(async () => {
      await redeDescoberta.guia(pulado);
      aoConcluir(await rede.situacao());
    });

  if (estado.passo === "suspensa") {
    return (
      <p role="alert" className="px-[18px] py-6 font-sans text-oxblood">
        {s.erros.conta_suspensa}
      </p>
    );
  }

  return (
    <section className="border-b border-rule px-[18px] py-6 font-sans" aria-labelledby="rede-primeira-entrada">
      <h2 id="rede-primeira-entrada" className="font-serif text-2xl font-semibold">
        {t.titulo}
      </h2>
      <ol className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs" aria-label={preencher(t.passo, { n: indice + 1, total: PASSOS.length })}>
        {PASSOS.map((p, i) => (
          <li key={p} aria-current={p === passo ? "step" : undefined} className={p === passo ? "font-bold underline" : i < indice ? "text-ink" : "text-ink-soft"}>
            {i + 1}. {t.passos[p]}
          </li>
        ))}
      </ol>
      <p className="sr-only" role="status">
        {preencher(t.passo, { n: indice + 1, total: PASSOS.length })}
      </p>

      <div className="mt-4">
        {passo === "regras" && (
          <div className="space-y-3">
            <h3 className="font-serif text-xl font-semibold">{t.regras.titulo}</h3>
            <ul className="list-disc space-y-1 pl-5">
              {t.regras.pontos.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            <Link href={localePath(lang, "/conduta")} className="inline-block text-sm underline">
              {t.regras.completas}
            </Link>
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={leu} onChange={(x) => setLeu(x.target.checked)} className="mt-1 h-5 w-5" />
              <span>{t.regras.titulo}</span>
            </label>
            <button type="button" disabled={!leu} onClick={() => setPasso("consentimento")} className={botaoPrimario}>
              {t.continuar}
            </button>
          </div>
        )}

        {passo === "consentimento" && (
          <div className="space-y-3">
            <h3 className="font-serif text-xl font-semibold">{t.consentimento.titulo}</h3>
            <div className="space-y-2 rounded-xl border-[1.5px] border-ink bg-parchment-deep p-3">
              <p>{t.consentimento.texto}</p>
              <p className="text-sm">{t.consentimento.finalidade}</p>
              <p className="text-sm">{t.consentimento.revogar}</p>
            </div>
            <label className="flex items-start gap-2 font-bold">
              <input type="checkbox" checked={consente} onChange={(x) => setConsente(x.target.checked)} className="mt-1 h-5 w-5" />
              <span>{t.consentimento.caixa}</span>
            </label>
            <p className="text-sm text-ink-soft">{t.consentimento.base}</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => setPasso("regras")} className={botaoSecundario}>
                {t.voltar}
              </button>
              <button type="button" disabled={!consente} onClick={() => setPasso("idade")} className={botaoPrimario}>
                {t.continuar}
              </button>
            </div>
          </div>
        )}

        {passo === "idade" && (
          <div className="space-y-3">
            <h3 className="font-serif text-xl font-semibold">{t.idade.titulo}</h3>
            <p>{t.idade.texto}</p>
            {menor ? (
              <p role="status" className="rounded-xl border-[1.5px] border-ink bg-parchment-deep p-3 text-sm">
                {t.idade.negada}
              </p>
            ) : (
              <>
                <label className="flex items-start gap-2">
                  <input type="checkbox" checked={maior} onChange={(x) => setMaior(x.target.checked)} className="mt-1 h-5 w-5" />
                  <span>{t.idade.caixa}</span>
                </label>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => setPasso("consentimento")} className={botaoSecundario}>
                    {t.voltar}
                  </button>
                  <button type="button" disabled={!maior || !consente || ocupado} onClick={() => void aderir()} className={botaoPrimario}>
                    {t.continuar}
                  </button>
                  <button type="button" onClick={() => setMenor(true)} className={botaoSecundario}>
                    {t.idade.menor}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {passo === "codinome" && (
          <form
            className="space-y-3"
            onSubmit={(ev) => {
              ev.preventDefault();
              void definirCodinome();
            }}
          >
            <h3 className="font-serif text-xl font-semibold">{t.codinome.titulo}</h3>
            <p>{t.codinome.texto}</p>
            <p className="text-sm text-ink-soft">{s.codinome.aviso}</p>
            <label className="block">
              <span className="text-sm font-bold">{t.codinome.rotulo}</span>
              <input value={nome} onChange={(x) => setNome(x.target.value)} maxLength={30} className="mt-1 block min-h-11 w-full rounded-md border border-rule bg-folha px-2" />
            </label>
            <button type="submit" disabled={nome.trim().length < 3 || ocupado} className={botaoPrimario}>
              {t.codinome.salvar}
            </button>
          </form>
        )}

        {passo === "escolhas" && (
          <PassoEscolhas
            lang={lang}
            s={s}
            d={d}
            inicial={atual}
            aoSalvar={(novo) => {
              setAtual(novo);
              setPasso("guia");
            }}
          />
        )}

        {passo === "guia" && (
          <div className="space-y-3">
            <h3 className="font-serif text-xl font-semibold">{t.guia.titulo}</h3>
            <p className="text-sm text-ink-soft">{preencher(t.guia.cartao, { n: cartao + 1, total: cartoes.length })}</p>
            <div className="rounded-xl bg-[#1f1a14] p-4 text-[#f4ecd8] shadow-[5px_5px_0_#c21f16]" role="group" aria-label={cartoes[cartao].titulo}>
              <p className="font-serif text-lg font-semibold">{cartoes[cartao].titulo}</p>
              <p className="mt-2">{cartoes[cartao].texto}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {cartao < cartoes.length - 1 ? (
                <button type="button" onClick={() => setCartao((n) => n + 1)} className={botaoPrimario}>
                  {t.guia.proximo}
                </button>
              ) : (
                <button type="button" disabled={ocupado} onClick={() => void terminar(false)} className={botaoPrimario}>
                  {t.guia.concluir}
                </button>
              )}
              {/* Só o guia pode ser pulado. */}
              <button type="button" disabled={ocupado} onClick={() => void terminar(true)} className={botaoSecundario}>
                {t.guia.pular}
              </button>
            </div>
          </div>
        )}
      </div>

      {erro && (
        <p role="alert" className="mt-3 text-oxblood">
          {erro}
        </p>
      )}
    </section>
  );
}

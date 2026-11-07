// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import Link from "@/components/Link";
import { localePath } from "@/i18n/config";
import { chamar, rede } from "@/lib/rede/cliente";
import { redeDescoberta } from "@/lib/rede/cliente-descoberta";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDaDescoberta } from "@/lib/rede/textos-descoberta";
import type { Situacao } from "@/lib/rede/tipos";
import type { EstadoDaEntrada } from "@/lib/rede/tipos-descoberta";
import { textoDoErro } from "../erros";
import { PassoEscolhas } from "./PassoEscolhas";
import { CHAVE_ADIOU } from "./PortaDaEntrada";

type Fase = "essencial" | "codinome" | "depois" | "guia";

/** Por onde a pessoa recomeça, conforme o que o banco já sabe dela. */
function faseInicial(estado: EstadoDaEntrada): Fase {
  if (estado.passo === "codinome") return "codinome";
  if (estado.passo === "escolhas") return "depois";
  if (estado.passo === "guia") return "guia";
  return "essencial";
}

const botaoPrimario = "alumia-botao min-h-11 cursor-pointer rounded-full bg-[#c21f16] px-5 font-bold text-white hover:bg-[#1f1a14] disabled:cursor-not-allowed disabled:opacity-50";
const botaoSecundario = "min-h-11 cursor-pointer rounded-full border-[1.5px] border-ink px-5 font-bold hover:bg-parchment-deep disabled:opacity-50";
const caixa = "mt-0.5 h-5 w-5 shrink-0 accent-[#c21f16]";

/**
 * A primeira entrada, curta (T18). Uma tela só com o essencial, tudo obrigatório e gravado de uma vez em rede_aderir:
 * o codinome, o consentimento destacado para dado sensível (LGPD, art. 11, I, com a versão das regras; finalidade e revogação à
 * vista, art. 9º e art. 18), a declaração de 18 anos ou mais (LGPD, art. 14; ECA Digital, Lei 15.211/2025) e o aceite das regras.
 * Quem declara menos de 18 anos não entra e nada é gravado. Depois, OPCIONAL: 3 lutas + 3 trilhas e os quatro cuidados de
 * segurança na mesma tela, com "Agora não" (rede_desc_entrada_adiar). Quem volta recomeça de onde parou (o banco sabe).
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
  const c = s.entradaCurta;
  const [fase, setFase] = useState<Fase>(faseInicial(estado));
  const [leu, setLeu] = useState(false);
  const [consente, setConsente] = useState(false);
  const [maior, setMaior] = useState(false);
  const [menor, setMenor] = useState(false);
  const [nome, setNome] = useState(estado.codinome ?? situacao.codinome ?? "");
  const [montando, setMontando] = useState(false);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [atual, setAtual] = useState(estado);

  const precisaCodinome = !situacao.codinome_ok;
  const nomeOk = !precisaCodinome || nome.trim().length >= 3;

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

  /** O essencial de uma vez: consentimento + 18 anos (rede_aderir, com a versão das regras) e o codinome. */
  const entrar = () =>
    rodar(async () => {
      const nova = await rede.aderir(true, estado.regras_versao);
      if (!nova.codinome_ok) await chamar("rede_codinome_definir", { p_codinome: nome.trim() });
      setFase("depois");
    });

  const definirCodinome = () =>
    rodar(async () => {
      await chamar("rede_codinome_definir", { p_codinome: nome.trim() });
      setFase("depois");
    });

  const terminar = (pulado: boolean) =>
    rodar(async () => {
      await redeDescoberta.guia(pulado);
      aoConcluir(await rede.situacao());
    });

  /** "Agora não": lutas, trilhas e guia ficam para depois. Sem a migração nova no banco, pula o guia e lembra neste aparelho. */
  const adiar = () =>
    rodar(async () => {
      try {
        await redeDescoberta.adiar();
      } catch {
        await redeDescoberta.guia(true);
        try {
          window.localStorage.setItem(CHAVE_ADIOU, "1");
        } catch {
          // sem armazenamento: a pergunta volta na próxima visita, sem perder nada
        }
      }
      aoConcluir(await rede.situacao());
    });

  if (estado.passo === "suspensa") {
    return (
      <p role="alert" className="px-[18px] py-6 font-sans text-oxblood">
        {s.erros.conta_suspensa}
      </p>
    );
  }

  const etapa = fase === "essencial" || fase === "codinome" ? 1 : 2;

  return (
    <section className="alumia-entrada mx-3 my-4 rounded-[20px] border-[1.5px] border-ink bg-folha px-[18px] py-5 font-sans sm:mx-4" aria-labelledby="rede-primeira-entrada">
      <ol className="flex gap-2 text-xs font-bold uppercase tracking-wider" aria-label={c.titulo}>
        {[c.passo1, c.passo2].map((rotulo, i) => (
          <li key={rotulo} aria-current={etapa === i + 1 ? "step" : undefined} className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 ${etapa === i + 1 ? "bg-[#1f1a14] text-[#f4ecd8]" : "text-ink-soft"}`}>
            <span aria-hidden className={`grid h-5 w-5 place-items-center rounded-full ${etapa === i + 1 ? "bg-[#c21f16] text-white" : "border border-current"}`}>{i + 1}</span>
            {rotulo}
          </li>
        ))}
      </ol>

      {fase === "essencial" && (
        <form
          className="mt-4 space-y-4"
          onSubmit={(ev) => {
            ev.preventDefault();
            void entrar();
          }}
        >
          <h2 id="rede-primeira-entrada" className="font-serif text-2xl font-extrabold leading-tight">
            {c.titulo}
          </h2>
          <ul className="space-y-1 text-[0.95rem]">
            {s.entrada.pitch.map((linha) => (
              <li key={linha} className="flex gap-2">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c21f16]" />
                {linha}
              </li>
            ))}
          </ul>

          {precisaCodinome && (
            <label className="block">
              <span className="font-bold">{c.codinome}</span>
              <input
                value={nome}
                onChange={(x) => setNome(x.target.value)}
                maxLength={30}
                autoComplete="off"
                aria-describedby="rede-codinome-ajuda"
                className="mt-1 block min-h-11 w-full rounded-xl border-[1.5px] border-ink bg-parchment px-3 text-lg"
              />
              <span id="rede-codinome-ajuda" className="mt-1 block text-sm text-ink-soft">{c.codinomeAjuda}</span>
            </label>
          )}

          {/* O consentimento para dado sensível fica destacado e separado das outras caixas (LGPD, art. 11, I). */}
          <fieldset className="rounded-xl border-[1.5px] border-ink bg-parchment-deep p-3">
            <legend className="px-1 text-sm font-bold uppercase tracking-wider">{c.consentimentoTitulo}</legend>
            <p className="text-sm">{t.consentimento.texto}</p>
            <details className="mt-1 text-sm">
              <summary className="cursor-pointer underline">{c.saibaMais}</summary>
              <p className="mt-1">{t.consentimento.finalidade}</p>
              <p className="mt-1">{t.consentimento.revogar}</p>
              <p className="mt-1 text-ink-soft">{t.consentimento.base}</p>
            </details>
            <label className="mt-2 flex items-start gap-2 font-bold">
              <input type="checkbox" checked={consente} onChange={(x) => setConsente(x.target.checked)} className={caixa} />
              <span>{t.consentimento.caixa}</span>
            </label>
          </fieldset>

          {menor ? (
            <p role="status" className="rounded-xl border-[1.5px] border-ink bg-parchment-deep p-3 text-sm">
              {t.idade.negada}
            </p>
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={maior} onChange={(x) => setMaior(x.target.checked)} className={caixa} />
                <span>{t.idade.caixa}</span>
              </label>
              {/* Quem não tem 18 anos precisa de uma saída honesta: nada é gravado e o resto do site fica aberto. */}
              <button type="button" onClick={() => setMenor(true)} className="min-h-11 cursor-pointer text-sm underline">
                {t.idade.menor}
              </button>
            </div>
          )}

          <div>
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={leu} onChange={(x) => setLeu(x.target.checked)} className={caixa} />
              <span>{c.regras}</span>
            </label>
            <details className="ml-7 mt-1 text-sm">
              <summary className="cursor-pointer underline">{c.verRegras}</summary>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {t.regras.pontos.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <Link href={localePath(lang, "/conduta")} className="mt-1 inline-block underline">
                {t.regras.completas}
              </Link>
            </details>
          </div>

          {!menor && (
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" disabled={!leu || !consente || !maior || !nomeOk || ocupado} className={botaoPrimario}>
                {c.entrar}
              </button>
              {(!leu || !consente || !maior || !nomeOk) && <p className="text-sm text-ink-soft">{c.falta}</p>}
            </div>
          )}
        </form>
      )}

      {fase === "codinome" && (
        <form
          className="mt-4 space-y-3"
          onSubmit={(ev) => {
            ev.preventDefault();
            void definirCodinome();
          }}
        >
          <h2 id="rede-primeira-entrada" className="font-serif text-2xl font-extrabold">{t.codinome.titulo}</h2>
          <p>{t.codinome.texto}</p>
          <label className="block">
            <span className="font-bold">{c.codinome}</span>
            <input value={nome} onChange={(x) => setNome(x.target.value)} maxLength={30} autoComplete="off" className="mt-1 block min-h-11 w-full rounded-xl border-[1.5px] border-ink bg-parchment px-3 text-lg" />
            <span className="mt-1 block text-sm text-ink-soft">{c.codinomeAjuda}</span>
          </label>
          <button type="submit" disabled={nome.trim().length < 3 || ocupado} className={botaoPrimario}>
            {t.codinome.salvar}
          </button>
        </form>
      )}

      {fase === "depois" && (
        <div className="mt-4 space-y-4">
          <h2 id="rede-primeira-entrada" className="font-serif text-2xl font-extrabold">{c.prontoTitulo}</h2>
          <p>{c.prontoTexto}</p>
          {montando ? (
            <PassoEscolhas
              lang={lang}
              s={s}
              d={d}
              inicial={atual}
              aoSalvar={(novo) => {
                setAtual(novo);
                // Os cuidados estão nesta mesma tela: escolher conta como guia visto.
                void terminar(false);
              }}
            />
          ) : (
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => setMontando(true)} className={botaoPrimario}>
                {c.montar}
              </button>
              <button type="button" disabled={ocupado} onClick={() => void adiar()} className={botaoSecundario}>
                {c.depois}
              </button>
            </div>
          )}
          <Cuidados titulo={c.cuidados} cartoes={t.guia.cartoes} />
          {montando && (
            <button type="button" disabled={ocupado} onClick={() => void adiar()} className={botaoSecundario}>
              {c.depois}
            </button>
          )}
        </div>
      )}

      {fase === "guia" && (
        <div className="mt-4 space-y-3">
          <h2 id="rede-primeira-entrada" className="font-serif text-2xl font-extrabold">{t.guia.titulo}</h2>
          <Cuidados titulo={c.cuidados} cartoes={t.guia.cartoes} />
          <div className="flex flex-wrap gap-3">
            <button type="button" disabled={ocupado} onClick={() => void terminar(false)} className={botaoPrimario}>
              {t.guia.concluir}
            </button>
            {/* O guia pode ser pulado. */}
            <button type="button" disabled={ocupado} onClick={() => void terminar(true)} className={botaoSecundario}>
              {t.guia.pular}
            </button>
          </div>
        </div>
      )}

      {erro && (
        <p role="alert" className="mt-3 text-oxblood">
          {erro}
        </p>
      )}
    </section>
  );
}

/** Os quatro cuidados de segurança, todos à vista e curtos (antes era um cartão por vez). */
function Cuidados({ titulo, cartoes }: { titulo: string; cartoes: { titulo: string; texto: string }[] }) {
  return (
    <section aria-label={titulo}>
      <h3 className="text-sm font-bold uppercase tracking-wider">{titulo}</h3>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {cartoes.map((k) => (
          <li key={k.titulo} className="rounded-xl bg-[#1f1a14] p-3 text-sm text-[#f4ecd8]">
            <p className="font-serif text-base font-semibold text-[#f0a020]">{k.titulo}</p>
            <p className="mt-1 opacity-90">{k.texto}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

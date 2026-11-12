// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import Link from "@/components/Link";
import { localePath } from "@/i18n/config";
import { chamar, rede } from "@/lib/rede/cliente";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { Situacao } from "@/lib/rede/tipos";
import { textoDoErro } from "./erros";
import { useAlumia2 } from "./publicar/alumia2/contexto";
import { Icone } from "./publicar/alumia2/icones";
import { Botao, LinkBotao } from "./ui/Botao";

/**
 * A primeira entrada: regras, idade (18+), consentimento destacado para dado sensível (LGPD art. 11, I) e o codinome. Quem
 * não tem conta vê o convite a entrar na conta (as dúvidas das disciplinas continuam abertas); quem declara ter menos de 18 anos
 * não entra na Rede, mas o resto do site segue aberto (a mensagem diz isso). Os outros passos da primeira entrada (escolher
 * comunidades, guia de segurança) são do pacote descoberta.
 */
export function Entrada({ s, lang, situacao, aoEntrar }: { s: TextosDaRede; lang: string; situacao: Situacao; aoEntrar: (nova: Situacao) => void }) {
  const [maior, setMaior] = useState(false);
  const [menor, setMenor] = useState(false);
  const [consente, setConsente] = useState(false);
  const [nome, setNome] = useState(situacao.codinome ?? "");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const e = s.entrada;
  const al2 = useAlumia2();

  if (!situacao.logado && al2) {
    // Na Alumia nova, o convite das pranchas: cartão de superfície, título condensado, "Criar conta" vermelho cheio e "Já tenho
    // conta" claro, em pílula; sem faixa listrada (a faixa tecida já está no alto da página) e sem sombra dura.
    return (
      <section className="al2-convite-entrar" aria-labelledby="rede-entrada">
        <h2 id="rede-entrada" className="al-cond">{e.titulo}</h2>
        <ul>
          {e.pitch.map((linha) => (
            <li key={linha}>{linha}</li>
          ))}
        </ul>
        <div className="al2-convite-entrar-acoes">
          <LinkBotao href={`${localePath(lang, "/entrar")}?criar&volta=/alumia`} variante="primario" pilula className="al2-aperta">
            {e.criarConta}
          </LinkBotao>
          <LinkBotao href={`${localePath(lang, "/entrar")}?volta=/alumia`} variante="claro" pilula className="al2-aperta">
            {e.jaTenhoConta}
          </LinkBotao>
        </div>
        <p className="al2-convite-entrar-nota">{e.lerSemConta}</p>
        <span className="sr-only">{e.entreNaConta}</span>
      </section>
    );
  }

  if (!situacao.logado) {
    return (
      // O caminho claro de quem chega (T32, item 4): o que é a Alumia em três linhas, "Criar conta" e "Já tenho conta". As duas
      // voltam para cá depois (?volta=), onde a primeira entrada curta pede só codinome, consentimento, 18+ e regras.
      <section className="alumia-convite mx-3 my-4 overflow-hidden rounded-[20px] bg-[#1f1a14] font-sans text-[#f4ecd8] sm:mx-4" aria-labelledby="rede-entrada">
        <div className="alumia-convite-faixa h-2" aria-hidden />
        <div className="px-[18px] py-5">
          <h2 id="rede-entrada" className="font-serif text-2xl font-extrabold text-white">{e.titulo}</h2>
          <ul className="mt-3 space-y-1.5">
            {e.pitch.map((linha) => (
              <li key={linha} className="flex gap-2">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#f0a020]" />
                {linha}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href={`${localePath(lang, "/entrar")}?criar&volta=/alumia`} className="alumia-botao inline-flex min-h-11 items-center rounded-full bg-[#c21f16] px-5 font-bold text-white hover:bg-white hover:text-[#1f1a14]">
              {e.criarConta}
            </Link>
            <Link href={`${localePath(lang, "/entrar")}?volta=/alumia`} className="inline-flex min-h-11 items-center rounded-full border-[1.5px] border-[#f4ecd8] px-5 font-bold hover:bg-white hover:text-[#1f1a14]">
              {e.jaTenhoConta}
            </Link>
          </div>
          <p className="mt-3 text-sm opacity-80">{e.lerSemConta}</p>
          <span className="sr-only">{e.entreNaConta}</span>
        </div>
      </section>
    );
  }

  async function entrar() {
    setErro("");
    setOcupado(true);
    try {
      let atual = await rede.aderir(true, situacao.regras_versao);
      // O codinome é confirmado na hora: "ninguém aparece com o nome de verdade".
      if (!atual.codinome_ok && nome.trim()) {
        await chamar("rede_codinome_definir", { p_codinome: nome.trim() });
        atual = await rede.situacao();
      }
      aoEntrar(atual);
    } catch (falha) {
      setErro(textoDoErro(s, falha));
    } finally {
      setOcupado(false);
    }
  }

  const precisaCodinome = !situacao.codinome_ok;
  const bloqueado = !maior || !consente || ocupado || (precisaCodinome && nome.trim().length < 3);
  if (al2) {
    // Na Alumia nova: título condensado, campo e caixinhas da casa, "Entrar" vermelho em pílula e a saída honesta em contorno.
    return (
      <section className="al2-convite-entrar" aria-labelledby="rede-entrada">
        <h2 id="rede-entrada" className="al-cond">{e.titulo}</h2>
        <p className="mt-3 text-[var(--al-texto-2)]">{e.texto}</p>
        <p className="mt-2 text-sm text-[var(--al-texto-3)]">{s.codinome.aviso}</p>
        <Link href={localePath(lang, "/conduta")} className="mt-2 inline-block text-sm font-bold underline underline-offset-2">{e.regras}</Link>
        {menor ? (
          <div role="status" className="al2-aviso-erro mt-4">
            <Icone nome="alerta" />
            <p>{e.idadeNegada}</p>
          </div>
        ) : (
          <form
            className="mt-4 space-y-3"
            onSubmit={(ev) => {
              ev.preventDefault();
              void entrar();
            }}
          >
            <label className="flex items-start gap-2.5">
              <input type="checkbox" checked={maior} onChange={(x) => setMaior(x.target.checked)} className="al2-caixinha mt-1 h-5 w-5" />
              <span>{e.maior}</span>
            </label>
            <label className="flex items-start gap-2.5">
              <input type="checkbox" checked={consente} onChange={(x) => setConsente(x.target.checked)} className="al2-caixinha mt-1 h-5 w-5" />
              <span className="text-sm text-[var(--al-texto-2)]">{e.consentimento}</span>
            </label>
            {precisaCodinome && (
              <label className="block">
                <span className="al2-rotulo">{e.codinome}</span>
                <input value={nome} onChange={(x) => setNome(x.target.value)} maxLength={30} className="al2-campo" />
              </label>
            )}
            <div className="al2-convite-entrar-acoes">
              <Botao type="submit" variante="primario" pilula className="al2-aperta" disabled={bloqueado}>
                {e.aderir}
              </Botao>
              {/* Quem não tem 18 anos precisa de uma saída honesta: nada é gravado, e o resto do site fica aberto. */}
              <Botao variante="contorno" pilula className="al2-aperta" onClick={() => setMenor(true)}>
                {e.menor}
              </Botao>
            </div>
          </form>
        )}
        {erro && (
          <div role="alert" className="al2-aviso-erro mt-3">
            <Icone nome="alerta" />
            <p>{erro}</p>
          </div>
        )}
      </section>
    );
  }
  return (
    <section className="px-[18px] py-6 font-sans" aria-labelledby="rede-entrada">
      <h2 id="rede-entrada" className="font-serif text-2xl font-semibold">{e.titulo}</h2>
      <p className="mt-2 text-ink-soft">{e.texto}</p>
      <p className="mt-2 text-sm text-ink-soft">{s.codinome.aviso}</p>
      <Link href={localePath(lang, "/conduta")} className="mt-2 inline-block text-sm underline">{e.regras}</Link>

      {menor ? (
        <p role="status" className="mt-4 rounded-xl border-[1.5px] border-ink bg-parchment-deep p-3 text-sm">{e.idadeNegada}</p>
      ) : (
        <form
          className="mt-4 space-y-3"
          onSubmit={(ev) => {
            ev.preventDefault();
            void entrar();
          }}
        >
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={maior} onChange={(x) => setMaior(x.target.checked)} className="mt-1 h-5 w-5" />
            <span>{e.maior}</span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={consente} onChange={(x) => setConsente(x.target.checked)} className="mt-1 h-5 w-5" />
            <span className="text-sm">{e.consentimento}</span>
          </label>
          {precisaCodinome && (
            <label className="block">
              <span className="text-sm font-bold">{e.codinome}</span>
              <input value={nome} onChange={(x) => setNome(x.target.value)} maxLength={30} className="mt-1 block min-h-11 w-full rounded-md border border-rule bg-folha px-2" />
            </label>
          )}
          <div className="flex flex-wrap gap-3">
            <button type="submit" disabled={bloqueado} className="min-h-11 cursor-pointer rounded-full bg-[#c21f16] px-5 font-bold text-white hover:bg-[#1f1a14] disabled:cursor-not-allowed disabled:opacity-50">
              {e.aderir}
            </button>
            {/* Quem não tem 18 anos precisa de uma saída honesta: nada é gravado, e o resto do site fica aberto. */}
            <button type="button" onClick={() => setMenor(true)} className="min-h-11 cursor-pointer rounded-full border-[1.5px] border-ink px-5 font-bold hover:bg-parchment-deep">
              {e.menor}
            </button>
          </div>
        </form>
      )}
      {erro && <p role="alert" className="mt-3 text-oxblood">{erro}</p>}
    </section>
  );
}

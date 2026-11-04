// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import Link from "@/components/Link";
import { localePath } from "@/i18n/config";
import { chamar, rede } from "@/lib/rede/cliente";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { Situacao } from "@/lib/rede/tipos";
import { textoDoErro } from "./erros";

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

  if (!situacao.logado) {
    return (
      <section className="px-[18px] py-6 font-sans" aria-labelledby="rede-entrada">
        <h2 id="rede-entrada" className="font-serif text-2xl font-semibold">{e.titulo}</h2>
        <p className="mt-2 text-ink-soft">{e.entreNaConta}</p>
        <Link href={localePath(lang, "/entrar")} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[#c21f16] px-5 font-bold text-white hover:bg-[#1f1a14]">
          {e.entrar}
        </Link>
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
            <button type="submit" disabled={!maior || !consente || ocupado || (precisaCodinome && nome.trim().length < 3)} className="min-h-11 cursor-pointer rounded-full bg-[#c21f16] px-5 font-bold text-white hover:bg-[#1f1a14] disabled:cursor-not-allowed disabled:opacity-50">
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

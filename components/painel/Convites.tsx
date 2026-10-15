// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { areaSlugs } from "@/lib/areas";
import { leads, rpc, type Me, type Role } from "@/lib/backend";
import { useI18n } from "../I18n";
import { Aviso, botao, botaoClaro, campo, dataHora, elo, papeis, rotulo, textoDoErro, useAcao, useLista } from "./comum";

interface Convite {
  id: string;
  email: string;
  papel: Role["papel"] | null;
  disciplina: string | null;
  usos: number;
  usos_max: number;
  nota: string;
  criado_em: string;
  expira_em: string;
  de: string;
  valido: boolean;
}

/**
 * Não existe cadastro aberto: toda conta nasce de um convite feito aqui. O endereço aparece uma única vez,
 * logo depois de criado; o banco guarda só um resumo dele, que não serve para entrar.
 */
export function Convites({ me }: { me: Me }) {
  const { lang, t } = useI18n();
  const lider = leads(me);
  const lista = useLista<Convite[]>("convites_listar");
  const acao = useAcao(lista.recarregar);
  const [tipo, setTipo] = useState<"pessoal" | "comunidade">("pessoal");
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<Role["papel"] | "">("");
  const [disciplina, setDisciplina] = useState("");
  const [usos, setUsos] = useState(20);
  const [dias, setDias] = useState(7);
  const [nota, setNota] = useState("");
  const [link, setLink] = useState("");
  /** O convite pessoal saiu sozinho por e-mail. */
  const [enviado, setEnviado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  // A coordenação não se convida (muda de mãos em Segurança e sucessão); vice e curadoria, só o coordenador convida.
  const funcoes = (Object.keys(papeis) as Role["papel"][]).filter((p) => p !== "coordenacao" && (lider || (p !== "vice" && p !== "curadoria")));
  const porDisciplina = papel === "educacao" || papel === "educacao_secundaria" || papel === "mentoria";
  const nomeDaArea = (slug: string | null) => (slug ? (t.areas[slug as keyof typeof t.areas]?.[0] ?? slug) : "");

  async function criar() {
    setOcupado(true);
    setErro("");
    setLink("");
    setCopiado(false);
    try {
      const p = tipo === "pessoal" ? { email, papel, disciplina: porDisciplina ? disciplina : "", dias, nota } : { usos, dias, nota };
      const resposta = await rpc<{ codigo: string; email_enviado?: boolean }>("convite_criar", { p });
      setLink(`${window.location.origin}/${lang}/entrar?convite=${resposta.codigo}`);
      setEnviado(Boolean(resposta.email_enviado));
      setEmail("");
      setNota("");
      lista.recarregar();
    } catch (falha) {
      setErro(textoDoErro(falha));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section>
      <h2 className="font-serif text-2xl font-semibold">Convites</h2>
      <p className="mt-1 max-w-2xl text-ink-soft">
        Ninguém se cadastra sozinho: a conta só é criada por quem abre um convite. Mande o endereço por um canal seguro. Ele vale até a data marcada e pode ser cancelado a qualquer momento.
      </p>
      <form className="mt-4 max-w-2xl space-y-3 border border-rule bg-parchment-deep p-4" onSubmit={(e) => { e.preventDefault(); void criar(); }}>
        <fieldset className="flex flex-wrap gap-x-6 gap-y-2">
          <legend className="sr-only">Tipo de convite</legend>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="radio" name="tipo-convite" checked={tipo === "pessoal"} onChange={() => setTipo("pessoal")} /> Para uma pessoa (com ou sem função)
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="radio" name="tipo-convite" checked={tipo === "comunidade"} onChange={() => setTipo("comunidade")} /> Para um grupo da comunidade (sem função)
          </label>
        </fieldset>
        {tipo === "pessoal" ? (
          <>
            <label className="block">
              E-mail da pessoa
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={campo} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                Função
                <select value={papel} onChange={(e) => setPapel(e.target.value as Role["papel"] | "")} className={campo}>
                  <option value="">Nenhuma (só participa da comunidade)</option>
                  {funcoes.map((p) => (
                    <option key={p} value={p}>{papeis[p]}</option>
                  ))}
                </select>
              </label>
              {porDisciplina && (
                <label className="block">
                  Disciplina
                  <select required value={disciplina} onChange={(e) => setDisciplina(e.target.value)} className={campo}>
                    <option value="">Escolha…</option>
                    {areaSlugs.map((slug) => (
                      <option key={slug} value={slug}>{nomeDaArea(slug)}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </>
        ) : (
          <label className="block max-w-xs">
            Para quantas pessoas (até 200)
            <input type="number" min={2} max={200} required value={usos} onChange={(e) => setUsos(Number(e.target.value))} className={campo} />
          </label>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            Vale por quantos dias (1 a 30)
            <input type="number" min={1} max={30} required value={dias} onChange={(e) => setDias(Number(e.target.value))} className={campo} />
          </label>
          <label className="block">
            Lembrete para a equipe (opcional)
            <input value={nota} maxLength={120} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: grupo do cursinho popular" className={campo} />
          </label>
        </div>
        <button type="submit" disabled={ocupado} className={botao}>Criar convite</button>
        <Aviso texto={erro} />
      </form>
      {link && (
        <div role="status" className="mt-4 max-w-2xl border-2 border-ink bg-parchment p-4">
          {enviado && <p className="mb-2">O convite entrou na fila de e-mails e sai sozinho para a pessoa (veja em Controles do site se o envio está funcionando). O endereço abaixo é para o caso de você querer mandar também por outro caminho.</p>}
          <p className="font-semibold">Copie agora: este endereço não será mostrado de novo.</p>
          <p className="mt-2 break-all font-mono text-sm">{link}</p>
          <button type="button" className={`${botaoClaro} mt-3`} onClick={() => { void navigator.clipboard.writeText(link).then(() => setCopiado(true)); }}>
            {copiado ? "Copiado" : "Copiar endereço"}
          </button>
        </div>
      )}
      <Aviso texto={lista.erro || acao.aviso} />
      {lista.dados && lista.dados.length > 0 && (
        <ul className="mt-4 space-y-2">
          {lista.dados.map((convite) => (
            <li key={convite.id} className={`border border-rule p-3 ${convite.valido ? "bg-parchment-deep" : "opacity-60"}`}>
              <p className={rotulo}>
                {convite.email || "Comunidade"} · {convite.papel ? `${papeis[convite.papel]}${convite.disciplina ? ` de ${nomeDaArea(convite.disciplina)}` : ""}` : "sem função"} · usado {convite.usos} de {convite.usos_max}
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                {convite.nota && `${convite.nota} · `}criado por {convite.de || "coordenação"} em {dataHora(convite.criado_em)} · {convite.valido ? `vale até ${dataHora(convite.expira_em)}` : "não vale mais"}
              </p>
              {convite.valido && (
                <button type="button" className={`${elo} mt-1 text-sm`} disabled={acao.ocupado} onClick={() => void acao.agir("convite_revogar", { p_id: convite.id }, "Convite cancelado.")}>
                  Cancelar convite
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { site } from "@/lib/site";
import { Aviso, botao, campo, data, elo, useAcao, useLista } from "./comum";

/**
 * Quem pediu o boletim do jornal. O endereço só entra na lista depois de a pessoa clicar no link de confirmação; a edição
 * sai daqui mesmo, por e-mail automático, para quem confirmou, cada um com o próprio link de saída.
 */
export function Boletim() {
  const lista = useLista<{ email: string; criado_em: string; confirmado?: boolean }[]>("boletim_listar");
  const acao = useAcao(lista.recarregar);
  const envio = useAcao();
  const [copiado, setCopiado] = useState(false);
  const [assunto, setAssunto] = useState("");
  const [texto, setTexto] = useState("");
  const confirmados = lista.dados?.filter((item) => item.confirmado !== false).map((item) => item.email) ?? [];
  const esperando = (lista.dados?.length ?? 0) - confirmados.length;

  return (
    <section>
      <p className="max-w-3xl text-ink-soft">
        {confirmados.length} endereço(s) confirmado(s){esperando > 0 ? `, e ${esperando} esperando a pessoa clicar no link de confirmação` : ""}. Quem pede o boletim recebe um e-mail para confirmar; sem o clique, o endereço não recebe nada e sai da lista em uma semana.
      </p>

      <div className="mt-5 max-w-3xl border border-rule bg-parchment-deep p-4">
        <h2 className="font-serif text-xl font-semibold">Enviar uma edição</h2>
        <p className="mt-1 text-ink-soft">
          Vai por e-mail automático para os {confirmados.length} endereço(s) confirmado(s), cada um com o link para sair da lista. Ninguém vê o endereço de ninguém. No máximo uma edição a cada seis horas.
        </p>
        <label className="mt-3 block">
          Assunto
          <input value={assunto} onChange={(e) => setAssunto(e.target.value)} maxLength={150} className={campo} />
        </label>
        <label className="mt-3 block">
          Texto (endereços https viram links)
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={10} maxLength={15000} className={campo} />
        </label>
        <button
          type="button"
          className={`${botao} mt-3`}
          disabled={envio.ocupado || confirmados.length === 0 || assunto.trim().length < 5 || texto.trim().length < 50}
          onClick={async () => {
            if (!window.confirm(`Enviar "${assunto.trim()}" para ${confirmados.length} endereço(s)? Não dá para desfazer.`)) return;
            const r = (await envio.agir("boletim_enviar", { p_assunto: assunto, p_texto: texto }, "")) as { emails?: number } | null;
            if (r) {
              envio.setAviso(`Edição na fila de envio: ${r.emails ?? 0} e-mail(s). Eles saem em até dez minutos.`);
              setAssunto("");
              setTexto("");
            }
          }}
        >
          Enviar a edição
        </button>
        <Aviso texto={envio.aviso} />
      </div>

      <p className="mt-5 text-ink-soft">Se precisar mandar pelo e-mail do jornal ({site.newsletter}), use sempre a lista em <strong>cópia oculta</strong> (Cco).</p>
      <button type="button" className={`${botao} mt-2`} disabled={confirmados.length === 0} onClick={() => { void navigator.clipboard.writeText(confirmados.join(", ")).then(() => setCopiado(true)); }}>
        {copiado ? "Lista copiada" : "Copiar os endereços confirmados"}
      </button>
      <Aviso texto={lista.erro || acao.aviso} />
      <ul className="mt-2 divide-y divide-rule border-y border-rule">
        {lista.dados?.map((item) => (
          <li key={item.email} className="flex flex-wrap items-baseline justify-between gap-3 py-2">
            <span>
              {item.email} <span className="text-ink-soft">· desde {data(item.criado_em)}{item.confirmado === false ? " · ainda não confirmou" : ""}</span>
            </span>
            <button type="button" className={elo} disabled={acao.ocupado} onClick={() => acao.agir("boletim_remover", { p_email: item.email }, "Endereço retirado.")}>
              Retirar
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

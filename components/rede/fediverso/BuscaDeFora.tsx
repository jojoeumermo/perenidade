// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import Link from "@/components/Link";
import { deFora } from "@/lib/rede/fediverso/tela/cliente";
import { deForaVale } from "@/lib/rede/fediverso/tela/linha";
import { textoDoErroDeFora, useTextosDoFediverso } from "@/lib/rede/fediverso/tela/textos";
import { contaDoHandle, contaValida, eContaDaqui, enderecoDoPerfilRemoto, type AchadoNaBusca, type ContaDaqui } from "@/lib/rede/fediverso/tela/tipos";
import { enderecos } from "@/lib/rede/tipos";
import { useAlumia2 } from "../publicar/alumia2/contexto";
import { Avatar16 } from "../ui/Avatar16";
import { SeloDoServidor } from "./SeloDoServidor";

type Estado = { conta: string; achado: AchadoNaBusca | ContaDaqui | null; erro: string | null };

/**
 * Na busca da Alumia: quando o que a pessoa escreveu é um endereço do Fediverso (@nome@servidor), mostra a conta de fora num
 * resumo (rosto em mosaico pelo @, nome, @ e selo do servidor) que leva ao perfil dela aqui dentro. Quem procura lá fora é o
 * servidor da Alumia (o navegador de quem busca não toca o outro servidor) e nenhuma foto de fora é pedida. Qualquer outro texto:
 * nada. Só dentro da casca nova, com "fediverso-total" ligado (e com sessão) ou na prévia, em que vem a conta de exemplo, sem pedido.
 */
export default function BuscaDeFora({ q, lang }: { q: string; lang: string }) {
  const al2 = useAlumia2();
  const tf = useTextosDoFediverso(lang);
  const lida = contaValida(q);
  const conta = al2 && lida && deForaVale(al2.previa) ? `@${lida.nome}@${lida.servidor}` : "";
  const [estado, setEstado] = useState<Estado | null>(null);

  useEffect(() => {
    if (!conta) return;
    let vivo = true;
    deFora.buscar(conta).then((r) => vivo && setEstado({ conta, achado: r.ok ? r.dado : null, erro: r.ok ? null : r.erro }));
    return () => {
      vivo = false;
    };
  }, [conta]);

  if (!conta || !tf) return null;
  const atual = estado?.conta === conta ? estado : null;
  // Sem sessão a busca lá fora não é feita: a busca daqui segue como sempre, sem aviso a mais.
  if (atual?.erro === "entre_primeiro") return null;
  const achado = atual?.achado ?? null;
  const daFora = achado && !eContaDaqui(achado) ? achado : null;
  const daFicha = daFora ? (contaDoHandle(daFora.handle) ?? conta) : conta;
  const servidor = contaValida(daFicha)?.servidor ?? "";
  const nome = (daFora?.nome ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const resumo = (daFora?.resumo ?? "").replace(/\s+/g, " ").trim().slice(0, 240);

  return (
    <section className="border-b border-[var(--al-superficie-2)] px-[18px] py-3 font-sans" aria-labelledby="busca-de-fora" aria-busy={!atual}>
      <h2 id="busca-de-fora" className="font-serif text-lg font-semibold">{tf.busca.titulo}</h2>
      {!atual ? (
        <p role="status" className="mt-2 text-sm text-[var(--al-texto-3)]">
          {tf.busca.procurar}…
        </p>
      ) : atual.erro ? (
        <p role="status" className="mt-2 text-sm text-[var(--al-texto-2)]">
          {atual.erro === "nao_encontrado" ? tf.busca.naoAchou : textoDoErroDeFora(tf, atual.erro)}
        </p>
      ) : achado && eContaDaqui(achado) ? (
        <Link href={enderecos.perfil(lang, achado.handle)} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--al-superficie-2)] px-3 font-bold hover:border-[var(--al-texto-3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--al-dourado)]">
          <Avatar16 handle={achado.handle} tamanho={28} />
          {tf.perfil.contaDaqui}
        </Link>
      ) : daFora ? (
        <Link
          href={enderecoDoPerfilRemoto(lang, daFicha)}
          className="mt-2 flex min-h-11 items-start gap-3 rounded-xl border border-[var(--al-superficie-2)] bg-[var(--al-superficie)] p-3 hover:border-[var(--al-texto-3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--al-dourado)]"
        >
          <Avatar16 handle={daFicha} tamanho={40} className="shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
              <span className="min-w-0 font-extrabold text-[var(--al-texto)] [overflow-wrap:anywhere]">{nome || daFicha}</span>
              {servidor && <SeloDoServidor servidor={servidor} rotulo={tf.cartao.doFediverso} />}
            </span>
            <span className="block truncate text-sm text-[var(--al-texto-3)]">{daFicha}</span>
            {resumo && <span className="mt-1 line-clamp-2 block text-sm text-[var(--al-texto-2)] [overflow-wrap:anywhere]">{resumo}</span>}
          </span>
        </Link>
      ) : null}
    </section>
  );
}

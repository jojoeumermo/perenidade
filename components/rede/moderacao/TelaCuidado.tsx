// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import Link from "@/components/Link";
import type { PropsDaTelaDoPacote } from "../registro";
import { redeMod } from "@/lib/rede/cliente-moderacao";
import { preencher } from "@/lib/rede/preencher";
import { enderecosModeracao, type MeuNivel, type RegraDeNivel } from "@/lib/rede/tipos-moderacao";
import { useTextosMod } from "./base";

/** O que falta para o próximo nível, em texto corrido. */
function faltam(m: MeuNivel, sm: NonNullable<ReturnType<typeof useTextosMod>>): string | null {
  const p = m.proximo;
  if (!p) return null;
  const itens: string[] = [];
  if (m.dados.dias < p.dias) itens.push(preencher(sm.cuidado.faltamDias, { n: p.dias - m.dados.dias }));
  if (m.dados.participacoes < p.participacoes) itens.push(preencher(sm.cuidado.faltamParticipacoes, { n: p.participacoes - m.dados.participacoes }));
  if (m.dados.posts < p.posts) itens.push(preencher(sm.cuidado.faltamPosts, { n: p.posts - m.dados.posts }));
  if (m.proximo_sem_procedente === false) itens.push(preencher(sm.cuidado.faltamSemProcedente, { n: p.sem_procedente }));
  return itens.length ? preencher(sm.cuidado.faltam, { nome: (sm.cuidado.nomes as Record<string, string>)[String(p.nivel)], itens: itens.join("; ") }) : null;
}

/**
 * "Como a Rede cuida" (/comunidade/cuidado): página pública com as regras escritas: denúncia com protocolo, prioridade da fila,
 * registro, recurso de 30 dias, modo lento, silenciar, rótulo de desinformação, a lei e a tabela dos níveis de confiança (lida do banco,
 * então é sempre a que vale). Quem entrou vê também o próprio nível e o que falta para o próximo.
 */
export default function TelaCuidado({ lang, s, situacao }: PropsDaTelaDoPacote) {
  const sm = useTextosMod(lang);
  const [niveis, setNiveis] = useState<RegraDeNivel[] | null>(null);
  const [meu, setMeu] = useState<MeuNivel | null>(null);

  useEffect(() => {
    let vivo = true;
    redeMod.niveis().then((x) => vivo && setNiveis(x)).catch(() => vivo && setNiveis([]));
    if (situacao.logado) redeMod.meuNivel().then((x) => vivo && setMeu(x)).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [situacao.logado]);

  if (!sm) return <p className="px-[18px] py-8 font-sans" role="status">{s.estados.carregando}</p>;
  const c = sm.cuidado;
  const blocos: [string, string][] = [
    [c.denunciaTitulo, c.denunciaTexto],
    [c.filaTitulo, c.filaTexto],
    [c.decisaoTitulo, c.decisaoTexto],
    [c.recursoTitulo, c.recursoTexto],
    [c.lentoTitulo, c.lentoTexto],
    [c.silencioTitulo, c.silencioTexto],
    [c.desinfoTitulo, c.desinfoTexto],
    [c.leiTitulo, c.leiTexto],
  ];
  const nomes = c.nomes as Record<string, string>;
  const falta = meu ? faltam(meu, sm) : null;
  return (
    <div className="font-sans">
      <h1 className="border-b border-rule px-[18px] py-3 font-serif text-2xl font-semibold">{c.titulo}</h1>
      <p className="px-[18px] py-3 text-ink-soft">{c.lead}</p>
      <div className="space-y-4 px-[18px] pb-4">
        {blocos.map(([titulo, texto]) => (
          <section key={titulo}>
            <h2 className="font-serif text-lg font-semibold">{titulo}</h2>
            <p>{texto}</p>
          </section>
        ))}
        <section aria-labelledby="niveis-titulo">
          <h2 id="niveis-titulo" className="font-serif text-lg font-semibold">{c.niveisTitulo}</h2>
          <p>{c.niveisTexto}</p>
          <p className="mt-1 text-sm text-ink-soft">{c.niveisSemLeitura}</p>
          {meu && (
            <p className="mt-2 rounded-lg border border-rule bg-folha p-3" role="status">
              {preencher(c.meuNivel, { nivel: meu.nivel, nome: nomes[String(meu.nivel)] ?? meu.nome })}
              {falta && <span className="block text-sm">{falta}</span>}
            </p>
          )}
          {niveis && niveis.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-ink">
                    <th className="py-1 pr-2">{c.nivel}</th>
                    <th className="py-1 pr-2">{c.diasDeConta}</th>
                    <th className="py-1 pr-2">{c.participacoes}</th>
                    <th className="py-1 pr-2">{c.posts}</th>
                    <th className="py-1 pr-2">{c.semProcedente}</th>
                    <th className="py-1 pr-2">{c.links}</th>
                    <th className="py-1 pr-2">{c.imagens}</th>
                    <th className="py-1">{c.postsDia}</th>
                  </tr>
                </thead>
                <tbody>
                  {niveis.map((n) => (
                    <tr key={n.nivel} className="border-b border-rule">
                      <th scope="row" className="py-1 pr-2">{n.nivel} · {nomes[String(n.nivel)] ?? n.nome}</th>
                      {n.automatico ? (
                        <>
                          <td className="py-1 pr-2">{n.dias}</td>
                          <td className="py-1 pr-2">{n.participacoes}</td>
                          <td className="py-1 pr-2">{n.posts}</td>
                          <td className="py-1 pr-2">{n.sem_procedente}</td>
                        </>
                      ) : (
                        <td colSpan={4} className="py-1 pr-2">{c.designado}</td>
                      )}
                      <td className="py-1 pr-2">{n.links}</td>
                      <td className="py-1 pr-2">{n.imagens}</td>
                      <td className="py-1">{n.posts_dia}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        {situacao.logado && <Link href={enderecosModeracao.denuncias(lang)} className="inline-block min-h-11 py-2 font-bold underline">{c.verDenuncias}</Link>}
      </div>
    </div>
  );
}

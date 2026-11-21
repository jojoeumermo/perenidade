// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Os avisos de segurança da conta (A8 do Prompt 5): entrada nova, aplicativo autenticador novo, entrada aprovada. Moravam na tela de
// avisos, misturados com as notificações; agora moram aqui, na Segurança (supabase/migracoes/20261126-p5-avisos.sql). O mesmo
// texto no mesmo dia vem uma vez, com quantas vezes. Ao abrir, os não lidos ganham "Novo" e passam a lidos (o emblema do menu zera).
// Só os da própria pessoa; o aviso nunca guardou endereço de rede.
import { useEffect, useMemo, useState } from "react";
import { avisos } from "@/lib/rede/cliente-avisos";
import type { AvisoDeSeguranca } from "@/lib/rede/tipos-avisos";
import { Icone } from "../publicar/alumia2/icones";
import { previa } from "../conversa/base3";
import type { T } from "./base";

const preencher = (texto: string, valores: Record<string, string | number>) => texto.replace(/\{(\w+)\}/g, (x, k: string) => (k in valores ? String(valores[k]) : x));

export function AvisosDeSeguranca({ t, lang }: { t: T; lang: string }) {
  const a = t.avisos;
  // Na prévia (sem banco), a lista começa vazia.
  const [itens, setItens] = useState<AvisoDeSeguranca[] | null>(() => (previa() ? [] : null));
  const [erro, setErro] = useState(false);
  const quando = useMemo(() => new Intl.DateTimeFormat(lang, { dateStyle: "short", timeStyle: "short" }), [lang]);

  useEffect(() => {
    if (previa()) return;
    let vivo = true;
    avisos.seguranca().then(
      (r) => {
        if (!vivo) return;
        setItens(r.itens);
        // Viu, leu: o emblema do menu zera; o "Novo" fica nesta visita.
        if (r.nao_lidos > 0) void avisos.segurancaLer().catch(() => undefined);
      },
      () => vivo && setErro(true),
    );
    return () => {
      vivo = false;
    };
  }, []);

  return (
    <section className="sg-bloco" aria-labelledby="sg-avisos-t">
      <h2 id="sg-avisos-t" className="sg-titulo al-cond">{a.titulo}</h2>
      <p className="sg-texto">{a.texto}</p>
      {erro ? (
        <p role="alert" className="sg-nota sg-nota-erro">{a.falha}</p>
      ) : itens === null ? (
        <p className="sg-cinza" role="status">{a.carregando}</p>
      ) : itens.length === 0 ? (
        <p className="sg-cinza">{a.vazio}</p>
      ) : (
        <ol className="sg-avisos" aria-label={a.titulo}>
          {itens.map((i) => (
            <li key={i.id} className="sg-aviso" data-novo={!i.lido || undefined}>
              <Icone nome="escudo" className="sg-aviso-icone h-5 w-5 shrink-0" />
              <span className="min-w-0">
                {!i.lido && <span className="sg-aviso-novo">{a.novo}</span>}
                <span className="sg-aviso-texto">{i.texto}</span>
                <span className="sg-aviso-quando">
                  <time dateTime={i.criado_em}>{quando.format(new Date(i.criado_em))}</time>
                  {i.vezes > 1 ? ` · ${preencher(a.vezes, { n: i.vezes })}` : null}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

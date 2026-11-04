// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState } from "react";
import { BackendError } from "@/lib/backend";
import { consertos } from "@/lib/rede/cliente-consertos";
import { agruparConvite, type ConviteDaLista } from "@/lib/rede/tipos-consertos";
import { preencher, useConsertos } from "./contexto";

/**
 * Os convites de um núcleo fechado, para quem cuida dele: gerar (validade e número de usos), ver o estado e revogar. O código sai
 * uma única vez, na hora de gerar; depois ninguém o vê, nem o banco (guarda só o hash). `antigoAte` avisa que o código antigo em
 * texto ainda vale até aquela data.
 */
export function Convites({ alvo, antigoAte, lang, mudou }: { alvo: string; antigoAte?: string | null; lang: string; mudou?: () => void }) {
  const x = useConsertos();
  const [lista, setLista] = useState<ConviteDaLista[] | null>(null);
  const [dias, setDias] = useState(7);
  const [usos, setUsos] = useState(5);
  const [codigo, setCodigo] = useState("");
  const [recado, setRecado] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const data = (iso: string) => new Date(iso).toLocaleDateString(lang);

  const carregar = useCallback(() => {
    consertos.convites(alvo).then(setLista).catch(() => setLista([]));
  }, [alvo]);
  useEffect(() => {
    carregar();
  }, [carregar]);

  const campo = "w-20 rounded-md border border-rule bg-parchment px-2 py-1 text-sm";
  const botao = "cursor-pointer rounded-full px-3 py-1.5 font-sans text-xs font-bold disabled:opacity-50";
  const valem = (lista ?? []).filter((c) => !c.revogado && !c.vencido).length;

  return (
    <div className="mt-2 ml-12 space-y-2 rounded-md bg-parchment-deep p-2.5 font-sans text-xs">
      <p className="font-semibold">
        {x.conviteTitulo} · {preencher(x.conviteAtivos, { n: valem })}
      </p>
      {antigoAte && <p className="text-oxblood">{preencher(x.conviteAntigo, { data: data(antigoAte) })}</p>}
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setOcupado(true);
          setRecado("");
          try {
            const r = await consertos.conviteCriar(alvo, { dias, usos });
            setCodigo(r.codigo);
            carregar();
            mudou?.();
          } catch (falha) {
            setRecado(falha instanceof BackendError ? falha.code : "erro");
          } finally {
            setOcupado(false);
          }
        }}
      >
        <label>
          {x.conviteDias}
          <input type="number" min={1} max={30} value={dias} onChange={(e) => setDias(Number(e.target.value))} className={`${campo} ml-1`} />
        </label>
        <label>
          {x.conviteUsos}
          <input type="number" min={1} max={200} value={usos} onChange={(e) => setUsos(Number(e.target.value))} className={`${campo} ml-1`} />
        </label>
        <button type="submit" disabled={ocupado} className={`${botao} bg-ink text-parchment`}>
          {x.conviteGerar}
        </button>
      </form>
      {codigo && (
        <div className="rounded-md border border-ink bg-folha p-2" role="status">
          <p>{x.conviteCodigo}</p>
          <code className="mt-1 block select-all break-all font-mono text-sm">{agruparConvite(codigo)}</code>
          <button
            type="button"
            className={`${botao} mt-1.5 border border-ink`}
            onClick={() => navigator.clipboard.writeText(agruparConvite(codigo)).then(() => setRecado(x.conviteCopiado), () => undefined)}
          >
            {x.conviteCopiar}
          </button>
        </div>
      )}
      {recado && <p role="status">{recado}</p>}
      <ul className="space-y-1">
        {(lista ?? []).slice(0, 8).map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2">
            <span className={c.revogado || c.vencido ? "text-ink-soft line-through" : ""}>{preencher(x.conviteLinha, { data: data(c.validade), usos: c.usos, max: c.usos_max })}</span>
            {c.revogado ? (
              <span className="text-ink-soft">{x.conviteEstadoRevogado}</span>
            ) : c.vencido ? (
              <span className="text-ink-soft">{x.conviteEstadoVencido}</span>
            ) : (
              <button
                type="button"
                className={`${botao} border border-ink`}
                onClick={async () => {
                  await consertos.conviteRevogar(c.id).catch(() => undefined);
                  carregar();
                  mudou?.();
                }}
              >
                {x.conviteRevogar}
              </button>
            )}
          </li>
        ))}
      </ul>
      <p className="text-ink-soft">{x.conviteSemCodigo}</p>
    </div>
  );
}

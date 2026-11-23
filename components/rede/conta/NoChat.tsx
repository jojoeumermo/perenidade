// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O que o lote "conta" põe no chat, sem mexer no cifrado nem no protocolo (só na tela, e só com "alumia-p4-conta" ligado):
//   79  ReleiaNoChat: o aviso "releia antes de enviar" embaixo do campo, quando o texto parece agressivo (conta só no aparelho);
//   109 useEscondidasDaViagem: as conversas que o modo viagem esconde da lista (lib/rede/conta/cofres.ts).
import { useEffect, useState } from "react";
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";
import { escondidasPelaViagem } from "@/lib/rede/conta/cofres";
import { pareceAgressivo } from "@/lib/rede/conta/regras";
import { preencher } from "@/lib/rede/preencher";
import { guarda, useTextosDaConta } from "./textos";

export function ReleiaNoChat({ lang, texto }: { lang: string; texto: string }) {
  const ligado = rotaNovaLigada("conta");
  const t = useTextosDaConta(lang);
  if (!ligado || !t) return null;
  const motivos = pareceAgressivo(texto);
  if (motivos.length === 0) return null;
  const nomes = t.releia.motivos as Record<string, string>;
  return <p className="mt-1 text-xs" role="status" data-releia>{preencher(t.releia.aviso, { motivos: motivos.map((m) => nomes[m] ?? m).join("; ") })}</p>;
}

/** As conversas (dentre estas) que o modo viagem esconde agora. Desligado: nenhuma. */
export function useEscondidasDaViagem(ids: readonly string[]): Set<string> {
  const ligado = rotaNovaLigada("conta");
  const [escondidas, setEscondidas] = useState<Set<string>>(new Set());
  const chave = ids.join(",");
  useEffect(() => {
    if (!ligado || !chave) return;
    let vivo = true;
    escondidasPelaViagem(guarda, chave.split(",")).then((s) => vivo && setEscondidas(s), () => undefined);
    return () => {
      vivo = false;
    };
  }, [ligado, chave]);
  return ligado ? escondidas : new Set();
}

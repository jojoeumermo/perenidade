// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A sala de voz na página do núcleo e da comunidade fechada (pedido P22, docs/rede/VOZ.md), só para quem é membro (a página só
// monta isto para membro; a rota das credenciais confere de novo no banco). Fechada até a pessoa abrir: só então o código da sala
// (SalaDeVoz, a biblioteca do MLS e o WebRTC) e os textos do chat são baixados. Fechar desmonta a sala, e a sala sai sozinha.
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { TextosDoChat } from "@/lib/rede/textos-chat";
import { Icone } from "../publicar/alumia2/icones";
import { useTextosDoRestrito } from "../publicar/restrito/textos";
import "../publicar/restrito/restrito.css";

const SalaDeVoz = dynamic(() => import("./SalaDeVoz").then((m) => m.SalaDeVoz), { ssr: false });

export function SalaDoGrupo({ lang, grupo, sala = "geral", previa = false }: { lang: string; grupo: string; sala?: string; previa?: boolean }) {
  const t = useTextosDoRestrito(lang);
  const [aberta, setAberta] = useState(false);
  const [dados, setDados] = useState<{ voz: TextosDoChat["voz"]; eu: string } | null>(null);

  useEffect(() => {
    if (!aberta || dados) return;
    let vivo = true;
    Promise.all([
      import("@/lib/rede/textos-chat").then((m) => m.carregarTextosDoChat(lang)),
      // Na prévia não há sessão: a sala mostra o "Entrar" e, no toque, diz que é preciso entrar na conta.
      previa ? Promise.resolve("") : import("../publicar/restrito/aparelho").then((m) => m.quemSouEu()),
    ]).then(
      ([tc, eu]) => vivo && setDados({ voz: tc.voz, eu: eu ?? "" }),
      () => undefined,
    );
    return () => {
      vivo = false;
    };
  }, [aberta, dados, lang, previa]);

  if (!t) return null;
  return (
    <section className="al-voz-grupo" aria-label={t.voz.abrir}>
      <button type="button" className="al-voz-grupo-abrir" aria-expanded={aberta} onClick={() => setAberta((x) => !x)}>
        <Icone nome="microfone" className="h-5 w-5" />
        {aberta ? t.voz.fechar : t.voz.abrir}
      </button>
      {aberta && (
        <div className="al-voz-grupo-corpo">
          {dados ? <SalaDeVoz t={dados.voz} eu={dados.eu} grupo={grupo} sala={sala} /> : <p role="status">{t.voz.carregando}</p>}
        </div>
      )}
    </section>
  );
}

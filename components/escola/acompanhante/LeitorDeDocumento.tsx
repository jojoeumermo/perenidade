// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId, useRef, useState } from "react";
import { errorText } from "@/i18n/core";
import { useI18n } from "@/components/I18n";
import { imageForAssistant } from "@/lib/upload";
import { Conversa, type Textos } from "./Conversa";
import { type ImagemRiscada, Tarja } from "./Tarja";

/**
 * "Entender um documento" (R1-57). Primeiro o aviso ("Cubra CPF, RG, números de conta e dados de outras pessoas") e o
 * pedido de não mandar documento de outras pessoas, inclusive de crianças; só depois do "Li o aviso" dá para escolher
 * a foto. A foto é reduzida e perde o EXIF no aparelho (imageForAssistant), vai para a tarja, e o que segue para o
 * assistente é a imagem riscada (as tarjas gravadas nos pixels), só quando a pessoa aperta o botão.
 */
export function LeitorDeDocumento({ s }: { s: Textos }) {
  const { t } = useI18n();
  const id = useId();
  const arquivo = useRef<HTMLInputElement>(null);
  const [entendeu, setEntendeu] = useState(false);
  const [foto, setFoto] = useState<ImagemRiscada | null>(null);
  const [riscada, setRiscada] = useState<{ imagem: ImagemRiscada | null; tarjas: number } | null>(null);
  const [preparando, setPreparando] = useState(false);
  const [erro, setErro] = useState("");
  const [versao, setVersao] = useState(0);
  const d = s.documento;

  async function escolher(lista: FileList | null) {
    const escolhido = lista?.[0];
    if (!escolhido) return;
    setErro("");
    setPreparando(true);
    setRiscada(null);
    try {
      setFoto(await imageForAssistant(escolhido));
      setVersao((v) => v + 1);
    } catch {
      setFoto(null);
      setErro(errorText(t, "imagem"));
    } finally {
      setPreparando(false);
      // O nome do arquivo não fica em lugar nenhum: o campo é limpo.
      if (arquivo.current) arquivo.current.value = "";
    }
  }

  return (
    <div data-leitor-de-documento>
      <section className="border-2 border-oxblood p-4" aria-labelledby={`${id}-aviso`}>
        <h2 id={`${id}-aviso`} className="font-serif text-2xl font-semibold">
          {d.avisoTitulo}
        </h2>
        <p className="mt-2 font-semibold">{d.aviso}</p>
        <p className="mt-2">{d.outrasPessoas}</p>
        <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3">
          <input type="checkbox" checked={entendeu} onChange={(e) => setEntendeu(e.target.checked)} className="h-5 w-5 shrink-0" data-entendi-documento />
          <span>{d.entendi}</span>
        </label>
      </section>

      {entendeu && (
        <section className="mt-6">
          <label className="acompanhante-botao-claro cursor-pointer focus-within:outline focus-within:outline-2">
            {foto ? d.trocar : d.escolher}
            <input ref={arquivo} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(e) => void escolher(e.target.files)} />
          </label>
          <div role="status" aria-live="polite">
            {preparando && <p className="mt-2 text-ink-soft">{d.preparando}</p>}
            {erro && <p className="mt-2 text-oxblood">{erro}</p>}
          </div>
          {foto && <Tarja s={s.tarja} foto={foto} aoMudar={(imagem, tarjas) => setRiscada({ imagem, tarjas })} />}
          {foto && riscada && riscada.tarjas === 0 && <p className="mt-2 text-sm text-ink-soft">{d.semTarja}</p>}
        </section>
      )}

      {entendeu && foto && (
        <section className="mt-6">
          <Conversa
            key={versao}
            s={s}
            modo="documento"
            imagem={riscada?.imagem ?? null}
            itens={["foto", "pergunta"]}
            campo={{ rotulo: d.pergunta, max: 600, min: 3, linhas: 2 }}
            botao={d.botao}
            semTextoBasta
            umaVez
            semServidor="aviso"
            avisoDaResposta={d.naoJuridica}
          />
        </section>
      )}
      <p className="mt-6 border-l-4 border-gold pl-3 text-sm">{d.naoJuridica}</p>
    </div>
  );
}

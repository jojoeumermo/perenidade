// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { rpc } from "@/lib/backend";
import { botao, botaoClaro, textoDoErro } from "./comum";

/**
 * O termo de voluntário: aparece por cima do painel para quem tem função e ainda não aceitou. Quem aceita segue;
 * quem recusa lê por que o painel não abre e sai. O aceite fica registrado no banco, com data.
 */
export function TermoDeVoluntario({ aceitou, sair }: { aceitou: () => void; sair: () => void }) {
  const [recusou, setRecusou] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  async function aceitar() {
    setOcupado(true);
    try {
      await rpc("termo_voluntario_aceitar");
      aceitou();
    } catch (erro) {
      setAviso(textoDoErro(erro));
      setOcupado(false);
    }
  }
  return (
    <div role="dialog" aria-modal aria-labelledby="termo-titulo" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4">
      <div className="max-h-[90dvh] w-full max-w-xl overflow-y-auto border-4 border-[#c21f16] bg-parchment p-6 text-ink shadow-2xl">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-oxblood">Antes de começar</p>
        <h2 id="termo-titulo" className="mt-1 font-serif text-2xl font-semibold">Você é voluntário do Instituto Lúcia</h2>
        {recusou ? (
          <>
            <p className="mt-4">Tudo bem. O painel é o lugar de trabalho da equipe, e só abre para quem aceita o termo de voluntário. A sua conta continua existindo: quando quiser, entre de novo e aceite.</p>
            <p className="mt-2 text-ink-soft">Se mudou de ideia sobre participar, pode pedir para sair da equipe falando com a coordenação.</p>
            <button type="button" className={`mt-5 ${botao}`} onClick={sair}>Sair do painel</button>
          </>
        ) : (
          <>
            <ul className="mt-4 list-disc space-y-2 pl-5">
              <li>O trabalho aqui é <strong>voluntário e gratuito</strong>: ninguém recebe nem paga nada, e nada do que fazemos é vendido.</li>
              <li>O que você publica sai com o seu nome e com <strong>licença livre</strong> (Creative Commons BY-SA), para qualquer pessoa estudar, copiar e melhorar.</li>
              <li>Você escreve com <strong>fonte à vista</strong>, sem copiar texto alheio e sem links para material pirata.</li>
              <li>As conversas da equipe são de <strong>trabalho</strong> e cifradas; o que é dito ali fica ali.</li>
              <li>Você trata colegas e estudantes com respeito. Assédio, preconceito e desinformação tiram a pessoa da equipe.</li>
              <li>As horas podem virar <strong>certificado</strong>, se você assinar o termo de adesão em “Horas e certificados”.</li>
            </ul>
            <p className="mt-4 text-ink-soft">Ao aceitar, fica registrado que você leu este termo hoje. Ele pode ser lido de novo em “Minha conta”.</p>
            {aviso && <p role="alert" className="mt-3 text-oxblood">{aviso}</p>}
            <p className="mt-5 flex flex-wrap gap-3">
              <button type="button" className={botao} disabled={ocupado} onClick={() => void aceitar()}>Aceito e quero continuar</button>
              <button type="button" className={botaoClaro} disabled={ocupado} onClick={() => setRecusou(true)}>Não aceito</button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

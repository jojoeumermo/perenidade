// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { rpc } from "@/lib/backend";
import { TERMO_VOLUNTARIO, textoDoTermo } from "@/lib/termos";
import { botao, botaoClaro, textoDoErro } from "./comum";

/**
 * O termo de voluntário: aparece por cima do painel para quem tem função e ainda não aceitou a versão vigente. Quem
 * aceita segue; quem recusa lê por que o painel não abre e sai. O aceite fica guardado para sempre no banco, com o texto
 * exato, a versão, a data e a declaração de idade (menor de 18 só com a autorização do responsável).
 */
export function TermoDeVoluntario({ aceitou, sair }: { aceitou: () => void; sair: () => void }) {
  const [recusou, setRecusou] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [idade, setIdade] = useState<"" | "maior" | "menor">("");
  const [responsavel, setResponsavel] = useState("");
  const [autoriza, setAutoriza] = useState(false);
  const [li, setLi] = useState(false);
  const pronto = li && (idade === "maior" || (idade === "menor" && responsavel.trim().length >= 5 && autoriza));

  async function aceitar() {
    setOcupado(true);
    try {
      const declaracao = idade === "maior" ? "Declaro ter 18 anos ou mais." : `Declaro ter menos de 18 anos. Responsável legal que leu e autoriza: ${responsavel.trim()}.`;
      await rpc("termo_registrar", {
        p_termo: "voluntario",
        p_versao: TERMO_VOLUNTARIO.versao,
        p_texto: textoDoTermo(TERMO_VOLUNTARIO, [declaracao]),
        p_dados: idade === "maior" ? { maior_de_idade: true } : { menor: true, responsavel: responsavel.trim(), responsavel_autoriza: true },
      });
      await rpc("termo_voluntario_aceitar");
      aceitou();
    } catch (erro) {
      setAviso(textoDoErro(erro));
      setOcupado(false);
    }
  }
  return (
    <div role="dialog" aria-modal aria-labelledby="termo-titulo" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4">
      <div className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto border-4 border-[#c21f16] bg-parchment p-6 text-ink shadow-2xl">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.25em] text-oxblood">Antes de começar · versão {TERMO_VOLUNTARIO.versao}</p>
        <h2 id="termo-titulo" className="mt-1 font-serif text-2xl font-semibold">Você é voluntário do Instituto Lúcia</h2>
        {recusou ? (
          <>
            <p className="mt-4">Tudo bem. O painel é o lugar de trabalho da equipe, e só abre para quem aceita o termo de voluntário. A sua conta continua existindo: quando quiser, entre de novo e aceite.</p>
            <p className="mt-2 text-ink-soft">Se mudou de ideia sobre participar, pode pedir para sair da equipe falando com a coordenação.</p>
            <button type="button" className={`mt-5 ${botao}`} onClick={sair}>Sair do painel</button>
          </>
        ) : (
          <>
            <p className="mt-3 border-l-4 border-oxblood bg-parchment-deep px-3 py-2 text-sm">
              Em resumo: <strong>é voluntário e de graça, sem promessa de pagamento</strong>; você faz no seu tempo, sem chefe e sem horário; o que você publica fica livre para todos e continua no site se você sair.
            </p>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-[0.95rem]">
              {TERMO_VOLUNTARIO.clausulas.map((c) => <li key={c}>{c}</li>)}
            </ol>
            <fieldset className="mt-5 border-2 border-ink p-3">
              <legend className="px-1 font-semibold">Sua idade</legend>
              <label className="flex items-center gap-2"><input type="radio" name="idade" checked={idade === "maior"} onChange={() => setIdade("maior")} />Tenho 18 anos ou mais</label>
              <label className="mt-1 flex items-center gap-2"><input type="radio" name="idade" checked={idade === "menor"} onChange={() => setIdade("menor")} />Tenho menos de 18 anos</label>
              {idade === "menor" && (
                <div className="mt-3 space-y-2 border-t border-rule pt-3 text-sm">
                  <p>Para participar, o seu responsável legal (mãe, pai ou quem tem a sua guarda) precisa ler este termo com você e autorizar.</p>
                  <label className="block">Nome completo do responsável<input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} maxLength={120} className="mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2" /></label>
                  <label className="flex items-start gap-2"><input type="checkbox" checked={autoriza} onChange={(e) => setAutoriza(e.target.checked)} className="mt-1" />Meu responsável leu este termo comigo e autoriza a minha participação e a licença do que eu publicar.</label>
                </div>
              )}
            </fieldset>
            <label className="mt-3 flex items-start gap-2"><input type="checkbox" checked={li} onChange={(e) => setLi(e.target.checked)} className="mt-1" />Li o termo inteiro e entendi que sou voluntário, sem remuneração nem vínculo de emprego.</label>
            <p className="mt-3 text-sm text-ink-soft">O aceite fica registrado com a data e o texto exato deste termo, e pode ser lido de novo em Minha conta › Privacidade.</p>
            {aviso && <p role="alert" className="mt-3 text-oxblood">{aviso}</p>}
            <p className="mt-5 flex flex-wrap gap-3">
              <button type="button" className={botao} disabled={ocupado || !pronto} onClick={() => void aceitar()}>Aceito e quero continuar</button>
              <button type="button" className={botaoClaro} disabled={ocupado} onClick={() => setRecusou(true)}>Não aceito</button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

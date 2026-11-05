// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { rpc } from "@/lib/backend";
import { TERMO_VOLUNTARIO, textoDoTermo } from "@/lib/termos";
import { FileSignature, LogOut } from "lucide-react";
import { textoDoErro } from "./comum";
import { Botao, Cartao, Faixa, Marca } from "./ui";

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
  // Continua bloqueando a tela inteira (véu do tema por cima de tudo) até a pessoa aceitar ou sair; por dentro, um Cartao.
  return (
    <div role="dialog" aria-modal aria-labelledby="termo-titulo" className="painel fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "var(--pn-veu)" }}>
      <Cartao as="div" variante="destaque" className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto" style={{ boxShadow: "var(--pn-sombra-flutuante)" }}>
        <p className="pn-rotulo-mono flex items-center gap-1.5">
          <FileSignature aria-hidden width={13} height={13} />
          Antes de começar · versão {TERMO_VOLUNTARIO.versao}
        </p>
        <h2 id="termo-titulo" className="pn-dialogo-titulo mt-1">Você é voluntário do Instituto Lúcia</h2>
        {recusou ? (
          <>
            <p className="mt-4">Tudo bem. O painel é o lugar de trabalho da equipe, e só abre para quem aceita o termo de voluntário. A sua conta continua existindo: quando quiser, entre de novo e aceite.</p>
            <p className="pn-ajuda mt-2">Se mudou de ideia sobre participar, pode pedir para sair da equipe falando com a coordenação.</p>
            <p className="mt-5">
              <Botao variante="principal" simbolo={LogOut} onClick={sair}>Sair do painel</Botao>
            </p>
          </>
        ) : (
          <>
            <Faixa tom="bordo" semSimbolo className="mt-3">
              <p className="text-sm">
                Em resumo: <strong>é voluntário e de graça, sem promessa de pagamento</strong>; você faz no seu tempo, sem chefe e sem horário; o que você publica fica livre para todos e continua no site se você sair.
              </p>
            </Faixa>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-[0.95rem]">
              {TERMO_VOLUNTARIO.clausulas.map((c) => <li key={c}>{c}</li>)}
            </ol>
            <fieldset className="mt-5 rounded-[var(--pn-raio)] border border-rule p-3">
              <legend className="pn-rotulo px-1">Sua idade</legend>
              <label className="pn-marca"><input type="radio" name="idade" checked={idade === "maior"} onChange={() => setIdade("maior")} />Tenho 18 anos ou mais</label>
              <label className="pn-marca mt-1"><input type="radio" name="idade" checked={idade === "menor"} onChange={() => setIdade("menor")} />Tenho menos de 18 anos</label>
              {idade === "menor" && (
                <div className="mt-3 grid gap-2 border-t border-rule pt-3 text-sm">
                  <p>Para participar, o seu responsável legal (mãe, pai ou quem tem a sua guarda) precisa ler este termo com você e autorizar.</p>
                  <label className="pn-campo-bloco">
                    <span className="pn-rotulo">Nome completo do responsável</span>
                    <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} maxLength={120} className="pn-campo" />
                  </label>
                  <Marca rotulo="Meu responsável leu este termo comigo e autoriza a minha participação e a licença do que eu publicar." checked={autoriza} onChange={(e) => setAutoriza(e.target.checked)} />
                </div>
              )}
            </fieldset>
            <div className="mt-3">
              <Marca rotulo="Li o termo inteiro e entendi que sou voluntário, sem remuneração nem vínculo de emprego." checked={li} onChange={(e) => setLi(e.target.checked)} />
            </div>
            <p className="pn-ajuda mt-3">Se você já tinha aceitado e o painel pede de novo, é porque o texto que você leu naquela vez não ficou guardado. Agora fica: leia e aceite mais uma vez, e nada do que você já fez muda.</p>
            <p className="pn-ajuda mt-3">O aceite fica registrado com a data e o texto exato deste termo, e pode ser lido de novo em Minha conta › Privacidade.</p>
            {aviso && <Faixa tom="erro" className="mt-3">{aviso}</Faixa>}
            <p className="mt-5 flex flex-wrap gap-2">
              <Botao variante="principal" carregando={ocupado} disabled={!pronto} onClick={() => void aceitar()}>Aceito e quero continuar</Botao>
              <Botao disabled={ocupado} onClick={() => setRecusou(true)}>Não aceito</Botao>
            </p>
          </>
        )}
      </Cartao>
    </div>
  );
}
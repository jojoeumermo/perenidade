// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId, useState } from "react";
import { useModoSeguro } from "@/components/SaidaRapida";
import { desligarModoSeguro, ligarModoSeguro } from "@/lib/modo-seguro";
import { contaSegura } from "@/lib/rede/seguranca/cliente";
import { sairDeTudo } from "@/lib/rede/saida";
import { ENCAIXES } from "../encaixes";
import { Icone } from "../publicar/alumia2/icones";
import { Botao } from "../ui/Botao";
import { Ladrilhos, type T } from "./base";

/**
 * O botão de pânico: com uma confirmação curta, desconecta todos os aparelhos da conta (este também), apaga deste aparelho o que o
 * site e a Alumia guardaram e abre uma página neutra de fora (lib/rede/saida.ts, sairDeTudo). Esconder o perfil é opcional e
 * começa desmarcado. Ao lado, o atalho Esc Esc Esc da saída do site (lib/modo-seguro.ts), que vale para esta aba.
 */
export function Panico({ t }: { t: T }) {
  const [aberto, setAberto] = useState(false);
  const [esconder, setEsconder] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const atalho = useModoSeguro();
  const id = useId();

  async function sair() {
    setSaindo(true);
    await sairDeTudo(() => contaSegura.panico(esconder), ENCAIXES.aoSairRapido);
  }

  return (
    <section className="sg-bloco sg-panico" aria-labelledby={`${id}-t`}>
      <div className="sg-panico-alto">
        <span className="sg-carimbo al-cond">{t.panico.carimbo}</span>
        <Ladrilhos cores={[1, 1, 2, 1, 3, 1]} />
      </div>
      <h2 id={`${id}-t`} className="sg-titulo sg-titulo-g al-cond">{t.panico.titulo}</h2>
      <p className="sg-texto">{t.panico.texto}</p>

      {!aberto ? (
        <Botao variante="primario" tamanho="g" className="sg-panico-botao" icone={<Icone nome="sair" className="h-5 w-5" grosso />} onClick={() => setAberto(true)}>
          {t.panico.botao}
        </Botao>
      ) : (
        <div className="sg-confirma sg-confirma-panico" role="group" aria-labelledby={`${id}-c`}>
          <p id={`${id}-c`} className="sg-confirma-titulo al-cond">{t.panico.confirmarTitulo}</p>
          <label className="sg-marcar">
            <input type="checkbox" checked={esconder} onChange={(e) => setEsconder(e.target.checked)} disabled={saindo} aria-describedby={`${id}-a`} />
            <span>
              <strong>{t.panico.esconder}</strong>
              <span id={`${id}-a`} className="sg-cinza">{t.panico.esconderAjuda}</span>
            </span>
          </label>
          <div className="sg-acoes">
            <Botao variante="primario" tamanho="g" disabled={saindo} aria-busy={saindo || undefined} onClick={() => void sair()} autoFocus>
              {saindo ? t.panico.saindo : t.panico.confirmar}
            </Botao>
            <Botao variante="fantasma" tamanho="m" disabled={saindo} onClick={() => setAberto(false)}>{t.panico.cancelar}</Botao>
          </div>
        </div>
      )}

      <div className="sg-atalho">
        <div>
          <p className="sg-atalho-titulo">
            <span className="sg-teclas" aria-hidden><kbd>Esc</kbd><kbd>Esc</kbd><kbd>Esc</kbd></span>
            <span className="sr-only">{t.panico.atalhoTitulo}</span>
            {atalho && <span className="sg-marca sg-marca-este al-cond">{t.panico.atalhoLigado}</span>}
          </p>
          <p className="sg-cinza">{t.panico.atalhoTexto}</p>
        </div>
        <Botao variante="contorno" tamanho="p" pressionado={atalho} onClick={() => (atalho ? desligarModoSeguro() : ligarModoSeguro())}>
          {atalho ? t.panico.atalhoDesligar : t.panico.atalhoLigar}
        </Botao>
      </div>
    </section>
  );
}

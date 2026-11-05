// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { useLista } from "../comum";
import { MoldeConfiguracao } from "../moldes";
import { Botao, Campo, Esqueleto, Faixa } from "../ui";
import { erroDaSala } from "./regras";
import { useControle } from "./usarControle";

interface Canais {
  sala: string;
}

/**
 * Sala da equipe: o endereço da sala de reunião de vídeo da equipe (public.equipe_sala_salvar, só a coordenação). Quem é da
 * equipe vê o botão de entrar nas Conversas e reuniões. A sala só abre se a pessoa clicar: o painel não carrega vídeo de terceiros sozinho.
 */
export function SalaDaEquipe() {
  const lista = useLista<Canais>("equipe_canais", {}, { quieta: true });
  const { executar, ocupado } = useControle(lista.recarregar);
  const [edicao, setEdicao] = useState<string | null>(null);
  const guardado = lista.dados;
  if (!guardado) {
    return lista.erro ? (
      <Faixa
        tom="erro"
        acao={
          <Botao pequeno onClick={lista.recarregar}>
            Tentar de novo
          </Botao>
        }
      >
        {lista.erro}
      </Faixa>
    ) : (
      <Esqueleto />
    );
  }
  const valor = edicao ?? guardado.sala;
  const erro = erroDaSala(valor);
  const sujo = valor.trim() !== guardado.sala;
  async function salvar() {
    if (erro) return;
    const r = await executar("equipe_sala_salvar", { p_url: valor.trim() }, valor.trim() ? "Sala guardada." : "Sala tirada.");
    if (r) setEdicao(null);
  }
  return (
    <MoldeConfiguracao
      sujo={sujo && !erro}
      salvando={ocupado}
      aoSalvar={() => void salvar()}
      aoDescartar={() => setEdicao(null)}
      grupos={[
        {
          id: "sala-equipe",
          titulo: "Sala da equipe",
          sobre: "Endereço https da sala de vídeo fixa da equipe. Em branco, o botão de entrar some.",
          campos: (
            <div style={{ maxWidth: "40rem" }}>
              <Campo rotulo="Endereço da sala" type="url" inputMode="url" value={valor} onChange={(e) => setEdicao(e.target.value)} placeholder="https://meet.exemplo.org/sala-da-equipe" erro={erro} ajuda="Até 300 letras. Use uma sala que só a equipe conhece." />
            </div>
          ),
        },
      ]}
    />
  );
}

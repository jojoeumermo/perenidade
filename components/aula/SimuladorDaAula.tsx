// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode, useState } from "react";
import { lerSimulador, type Simulador } from "@/lib/simuladores-aula";

// O bloco ```simulador da aula (Etapa 5, B17; guia em docs/simuladores-nas-aulas.md). Este arquivo é só a casca: o
// simulador de verdade (circuito, laboratórios de eletricidade, visualizador de execução) vem por dynamic import e só é
// baixado quando a pessoa clica em "Abrir o simulador". A aula que não tem o bloco não carrega nada a mais, e a que tem
// carrega só esta casca pequena até o clique.
// O texto dos simuladores está em português (como os laboratórios de /laboratorios); o bloco é marcado com lang="pt-BR".

const espera = () => <p className="my-4 font-sans text-sm text-ink-soft">Carregando o simulador…</p>;
const CircuitoSimples = dynamic(() => import("./simuladores/CircuitoSimples").then((m) => m.CircuitoSimples), { ssr: false, loading: espera });
const Visualizador = dynamic(() => import("./simuladores/VisualizadorDeExecucao").then((m) => m.VisualizadorDeExecucao), { ssr: false, loading: espera });
// Os laboratórios que já existem em /laboratorios/eletrica: reaproveitados, não copiados.
const Lampadas = dynamic(() => import("../labs/eletrica/Circuitos").then((m) => m.Circuitos), { ssr: false, loading: espera });
const Instalacao = dynamic(() => import("../labs/eletrica/Instalacao").then((m) => m.Instalacao), { ssr: false, loading: espera });

const NOMES: Record<Simulador["tipo"], { nome: string; dica: string }> = {
  circuito: { nome: "Circuito simples", dica: "Mude a tensão, a resistência e o disjuntor e veja a conta de Ohm na hora." },
  lampadas: { nome: "Circuito de lâmpadas", dica: "Três lâmpadas em série ou em paralelo: queime uma e veja o que acontece com as outras." },
  instalacao: { nome: "Treino de instalação", dica: "Ligue os fios do ponto de luz e da tomada e veja se o disjuntor aguenta." },
  "execucao-python": { nome: "Execução passo a passo (Python)", dica: "Veja o programa rodar uma linha por vez, com as variáveis e a pilha." },
  "execucao-js": { nome: "Execução passo a passo (JavaScript)", dica: "Veja o programa rodar uma linha por vez, com as variáveis e a pilha." },
};

/** Se o simulador quebrar (navegador antigo, bloco mal escrito), a aula continua e mostra o aviso no lugar. */
class Reserva extends Component<{ children: ReactNode }, { erro: boolean }> {
  state = { erro: false };
  static getDerivedStateFromError() {
    return { erro: true };
  }
  render() {
    return this.state.erro ? <p className="font-sans text-sm">Não consegui abrir o simulador neste aparelho. O resto da aula continua valendo.</p> : this.props.children;
  }
}

export function SimuladorDaAula({ spec }: { spec: string }) {
  const [aberto, setAberto] = useState(false);
  const leitura = lerSimulador(spec);
  if (!leitura.ok) {
    return (
      <aside lang="pt-BR" className="no-print my-6 border-l-2 border-oxblood bg-parchment-deep p-4 font-sans text-sm">
        {leitura.erro}
      </aside>
    );
  }
  const s = leitura.simulador;
  const info = NOMES[s.tipo];
  return (
    <aside lang="pt-BR" className="bloco bloco-simulador no-print my-6 border-2 border-ink bg-parchment p-4 font-sans text-sm" aria-label={`Simulador: ${s.titulo || info.nome}`}>
      <p className="bloco-rotulo">Simulador</p>
      <p className="bloco-titulo">{s.titulo || info.nome}</p>
      {!aberto ? (
        <>
          <p className="mt-1 text-ink-soft">{info.dica} Roda no seu aparelho; nada é enviado.</p>
          <button type="button" onClick={() => setAberto(true)} className="mt-3 cursor-pointer border-2 border-ink bg-parchment px-3 py-2 font-bold text-ink hover:border-oxblood hover:text-oxblood">
            Abrir o simulador
          </button>
        </>
      ) : (
        <div className="mt-3">
          <Reserva>
            {s.tipo === "circuito" && <CircuitoSimples simulador={s} />}
            {s.tipo === "lampadas" && <Lampadas />}
            {s.tipo === "instalacao" && <Instalacao />}
            {s.tipo.startsWith("execucao") && <Visualizador simulador={s} />}
          </Reserva>
        </div>
      )}
    </aside>
  );
}

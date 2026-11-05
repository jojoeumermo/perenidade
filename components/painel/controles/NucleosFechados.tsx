// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useLista } from "../comum";
import { MoldeTabela } from "../moldes";
import { Botao, type ColumnDef, confirmar, Esqueleto, Faixa } from "../ui";
import { useControle } from "./usarControle";

interface Nucleo {
  nucleo: string;
  nome: string;
  cidade: string;
  uf: string;
  acompanha: string;
  aberto: boolean;
  pessoas: number;
}

/**
 * Núcleos fechados da Rede: abre o espaço da Rede de um núcleo de estudo ativo (public.rede_com_nucleo_abrir, coordenação ou
 * quem acompanha o núcleo). Quem acompanha vira a mediação do espaço, que só quem é do núcleo enxerga. A lista vem de
 * public.rede_nucleos_fechados_listar: mostra só quantas pessoas há, nunca quem são.
 */
export function NucleosFechados() {
  const lista = useLista<Nucleo[]>("rede_nucleos_fechados_listar", {}, { quieta: true });
  const { executar, ocupado } = useControle(lista.recarregar);
  if (!lista.dados) {
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
  async function abrir(n: Nucleo) {
    const certo = await confirmar({
      titulo: `Abrir o espaço fechado de "${n.nome}"?`,
      texto: n.acompanha ? `${n.acompanha}, que acompanha o núcleo, passa a ser a mediação do espaço, se já tiver conta na Rede.` : "O núcleo não tem quem acompanhe: a coordenação cuida do espaço até alguém assumir.",
      confirmar: "Abrir espaço",
    });
    if (certo) await executar("rede_com_nucleo_abrir", { p_nucleo: n.nucleo }, "Espaço do núcleo aberto na Rede.");
  }
  const colunas: ColumnDef<Nucleo>[] = [
    { accessorKey: "nome", header: "Núcleo" },
    { id: "lugar", header: "Cidade", accessorFn: (n) => `${n.cidade} (${n.uf})` },
    { accessorKey: "acompanha", header: "Acompanha", cell: ({ getValue }) => String(getValue() || "ninguém") },
    { id: "situacao", header: "Espaço na Rede", accessorFn: (n) => (n.aberto ? `Aberto · ${n.pessoas} ${n.pessoas === 1 ? "pessoa" : "pessoas"}` : "Ainda fechado") },
    {
      id: "acoes",
      header: () => <span className="sr-only">Ações</span>,
      enableSorting: false,
      cell: ({ row }) =>
        row.original.aberto ? null : (
          <Botao pequeno disabled={ocupado} onClick={() => void abrir(row.original)}>
            Abrir espaço
          </Botao>
        ),
    },
  ];
  return <MoldeTabela dados={lista.dados} colunas={colunas} legenda="Núcleos de estudo e o espaço de cada um na Rede" porPagina={20} barra={<p className="pn-ajuda">Só aparecem os núcleos ativos do mapa. Cadastrar ou mudar núcleo é na seção Núcleos.</p>} />;
}

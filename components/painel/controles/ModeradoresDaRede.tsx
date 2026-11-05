// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { rpc } from "@/lib/backend";
import { textoDoErro, useLista } from "../comum";
import { MoldeTabela } from "../moldes";
import { Botao, Campo, type ColumnDef, confirmar, Esqueleto, Faixa, notificar, Selecao, Selo } from "../ui";
import { useControle } from "./usarControle";

interface Comunidade {
  slug: string;
  nome: string;
  categoria: string;
  tipo: string;
}
interface Moderador {
  comunidade: string;
  usuario: string;
  nome: string;
}
interface Estado {
  comunidades: Comunidade[];
  moderadores: Moderador[];
}
interface Pessoa {
  id: string;
  nome: string;
  suspenso: boolean;
}

const CATEGORIAS: Record<string, string> = { lutas: "Lutas", disciplinas: "Disciplinas", instituto: "Instituto" };

/**
 * Moderadores de comunidade da Rede Lúcia: a mediação nomeia pessoas da equipe para ocultar posts de uma comunidade
 * (public.rede_moderador_definir; a lista vem de public.rede_moderadores_listar). Quem modera só vê e oculta posts daquela
 * comunidade. A busca de pessoa usa public.pessoas_buscar (só quem gere cargos), que mostra apenas o nome público da equipe.
 */
export function ModeradoresDaRede() {
  const lista = useLista<Estado>("rede_moderadores_listar", {}, { quieta: true });
  const { executar, ocupado } = useControle(lista.recarregar);
  const [comunidade, setComunidade] = useState("");
  const [busca, setBusca] = useState("");
  const [achadas, setAchadas] = useState<Pessoa[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const dados = lista.dados;
  if (!dados) {
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
  const nomeDa = (slug: string) => dados.comunidades.find((c) => c.slug === slug)?.nome ?? slug;
  const ativa = comunidade || dados.comunidades[0]?.slug || "";
  const jaModeram = new Set(dados.moderadores.filter((m) => m.comunidade === ativa).map((m) => m.usuario));

  async function procurar() {
    if (busca.trim().length < 2) {
      notificar.info("Escreva pelo menos 2 letras do nome.");
      return;
    }
    setBuscando(true);
    try {
      setAchadas(await rpc<Pessoa[]>("pessoas_buscar", { p_busca: busca.trim() }));
    } catch (erro) {
      notificar.erro(textoDoErro(erro));
    } finally {
      setBuscando(false);
    }
  }
  async function nomear(p: Pessoa) {
    const certo = await confirmar({ titulo: `Nomear ${p.nome} moderação de "${nomeDa(ativa)}"?`, texto: "Quem modera pode ocultar posts desta comunidade. Dá para tirar a qualquer hora.", confirmar: "Nomear" });
    if (certo) await executar("rede_moderador_definir", { p_comunidade: ativa, p_usuario: p.id, p_sim: true }, "Moderação nomeada.");
  }
  async function tirar(m: Moderador) {
    const certo = await confirmar({ titulo: `Tirar ${m.nome} da moderação de "${nomeDa(m.comunidade)}"?`, texto: "A pessoa deixa de poder ocultar posts desta comunidade.", confirmar: "Tirar", perigo: true });
    if (certo) await executar("rede_moderador_definir", { p_comunidade: m.comunidade, p_usuario: m.usuario, p_sim: false }, "Moderação retirada.");
  }

  const colunas: ColumnDef<Moderador>[] = [
    { accessorKey: "nome", header: "Pessoa" },
    { id: "comunidade", header: "Comunidade", accessorFn: (m) => nomeDa(m.comunidade) },
    {
      id: "acoes",
      header: () => <span className="sr-only">Ações</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <Botao pequeno perigo disabled={ocupado} onClick={() => void tirar(row.original)}>
          Tirar
        </Botao>
      ),
    },
  ];

  return (
    <div style={{ display: "grid", gap: "1.25rem" }}>
      <section className="pn-cartao" aria-labelledby="mod-nomear" style={{ display: "grid", gap: "0.8rem" }}>
        <h3 id="mod-nomear" className="pn-cartao-titulo">
          Nomear moderação
        </h3>
        <Selecao rotulo="Comunidade" value={ativa} onChange={(e) => setComunidade(e.target.value)}>
          {Object.entries(CATEGORIAS).map(([cat, nome]) => {
            const itens = dados.comunidades.filter((c) => c.categoria === cat);
            return itens.length ? (
              <optgroup key={cat} label={nome}>
                {itens.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.nome}
                  </option>
                ))}
              </optgroup>
            ) : null;
          })}
        </Selecao>
        <form
          className="pn-barra-ferramentas"
          style={{ alignItems: "flex-end" }}
          onSubmit={(e) => {
            e.preventDefault();
            void procurar();
          }}
        >
          <div style={{ flex: 1, minWidth: "12rem" }}>
            <Campo rotulo="Procurar pessoa da equipe" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome (2 letras ou mais)" />
          </div>
          <Botao type="submit" disabled={buscando || !ativa}>
            {buscando ? "Procurando…" : "Procurar"}
          </Botao>
        </form>
        {achadas && (
          <ul className="pn-fila-lista" aria-label="Pessoas encontradas">
            {achadas.length === 0 && <li className="pn-ajuda">Ninguém encontrado com esse nome.</li>}
            {achadas.map((p) => (
              <li key={p.id} className="pn-barra-ferramentas" style={{ padding: "0.3rem 0" }}>
                <span style={{ flex: 1 }}>
                  {p.nome}
                  {p.suspenso && <Selo className="ml-2">suspensa</Selo>}
                </span>
                {jaModeram.has(p.id) ? <span className="pn-ajuda">já modera esta comunidade</span> : (
                  <Botao pequeno disabled={ocupado || p.suspenso} onClick={() => void nomear(p)}>
                    Nomear
                  </Botao>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <MoldeTabela dados={dados.moderadores} colunas={colunas} legenda="Moderadores nomeados por comunidade" porPagina={20} />
    </div>
  );
}

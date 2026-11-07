// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useMemo, useState } from "react";
import { NOME_REDE } from "@/lib/rede/alumia";
import { useLista } from "./comum";
import { MoldeTabela } from "./moldes";
import { Botao, type ColumnDef, Faixa, Selo, Vazio } from "./ui";

interface Linha {
  slug: string;
  nome: string;
  categoria: "lutas" | "disciplinas" | "instituto";
  tipo: "aberta" | "restrita" | "fechada";
  posts: number;
  posts_7d: number;
  moderacao: number;
}

type Filtro = "faltam" | "todas";
const CATEGORIA: Record<Linha["categoria"], string> = { lutas: "Luta", disciplinas: "Disciplina", instituto: "Instituto" };
/** A meta do roteiro (docs/rede/SEMEAR.md): cada comunidade-semente com ao menos 2 pessoas moderando. */
const MODERACAO_MINIMA = 2;

/**
 * "Alumia: semeadura" (T32, item 2b): o roteiro de docs/rede/SEMEAR.md em números, para a coordenação. Por comunidade, quantos
 * posts reais existem (no total e na semana) e se há 2 pessoas moderando. Só contagens: nenhum nome, nenhum texto, e nada aqui
 * publica (a regra de ouro: nenhum post é inventado nem gravado em nome de pessoa). O banco confere o papel de coordenação.
 */
export function RedeSemeadura() {
  const lista = useLista<{ itens: Linha[] }>("rede_painel_semeadura");
  const [filtro, setFiltro] = useState<Filtro>("faltam");
  const itens = useMemo(() => lista.dados?.itens ?? [], [lista.dados]);
  const faltam = (l: Linha) => l.moderacao < MODERACAO_MINIMA || l.posts === 0;
  const vistos = filtro === "faltam" ? itens.filter(faltam) : itens;
  const lutas = itens.filter((l) => l.categoria === "lutas");
  const comConversa = (ls: Linha[]) => ls.filter((l) => l.posts > 0).length;
  const disciplinasComConversa = comConversa(itens.filter((l) => l.categoria === "disciplinas"));

  const colunas: ColumnDef<Linha>[] = [
    { accessorKey: "nome", header: "Comunidade" },
    { id: "categoria", accessorFn: (l) => CATEGORIA[l.categoria], header: "Grupo" },
    { accessorKey: "posts", header: "Posts reais", cell: ({ row }) => <span className="font-mono">{row.original.posts}</span> },
    { accessorKey: "posts_7d", header: "Na semana", cell: ({ row }) => <span className="font-mono">{row.original.posts_7d}</span> },
    {
      accessorKey: "moderacao",
      header: "Moderação",
      cell: ({ row }) => <Selo tom={row.original.moderacao >= MODERACAO_MINIMA ? "ok" : "bordo"}>{row.original.moderacao >= MODERACAO_MINIMA ? `${row.original.moderacao} pessoas` : `${row.original.moderacao} de ${MODERACAO_MINIMA}`}</Selo>,
    },
  ];

  return (
    <div className="pn-tela">
      <p className="pn-sobre">
        O roteiro da semeadura da {NOME_REDE} (docs/rede/SEMEAR.md) em números. Meta da semana 1: ao menos uma conversa real em cada luta e em 10 disciplinas, e 2 pessoas moderando cada comunidade-semente
        (defina em “Rede: propostas de comunidade” ou pela função de moderação). Nada aqui publica: quem posta é gente real, com o próprio codinome.
      </p>
      {lista.erro && (
        <Faixa tom="erro" acao={<Botao pequeno onClick={lista.recarregar}>Tentar de novo</Botao>}>
          {lista.erro}
        </Faixa>
      )}
      {lista.dados && (
        <Faixa tom="info">
          Lutas com conversa: {comConversa(lutas)} de {lutas.length}. Disciplinas com conversa: {disciplinasComConversa} (meta: 10). Comunidades sem as 2 pessoas moderando: {itens.filter((l) => l.moderacao < MODERACAO_MINIMA).length}.
        </Faixa>
      )}
      <MoldeTabela<Linha>
        dados={vistos}
        colunas={colunas}
        legenda="Semeadura por comunidade"
        carregando={!lista.dados && !lista.erro}
        densa
        vazio={<Vazio titulo={filtro === "faltam" ? "Tudo semeado: toda comunidade tem conversa e 2 pessoas moderando." : "Nenhuma comunidade."} />}
        barra={
          <div role="group" aria-label="Filtro" className="flex flex-wrap gap-1">
            {(
              [
                ["faltam", "Só as que faltam"],
                ["todas", "Todas"],
              ] as const
            ).map(([id, nome]) => (
              <Botao key={id} pequeno variante={filtro === id ? "padrao" : "discreto"} aria-pressed={filtro === id} onClick={() => setFiltro(id)}>
                {nome}
              </Botao>
            ))}
          </div>
        }
      />
    </div>
  );
}

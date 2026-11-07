// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O banco dos jogos em grupo (T23), estático: /api/jogos-em-grupo/debates (os cartões de debate) e
// /api/jogos-em-grupo/<área> (as questões de escolha dos exercícios daquela disciplina). Gerado na montagem; só quem cria
// uma sala baixa o arquivo da disciplina escolhida, na hora de começar a partida (quem só joga recebe as perguntas pela
// sala). Nada da pessoa vai junto: é um arquivo igual para todo mundo.
import { notFound } from "next/navigation";
import { disciplinasDosJogos, questoesPorDisciplina, temasDeDebate } from "@/lib/jogos/banco-em-grupo";

export const dynamicParams = false;
export const dynamic = "force-static";

export function generateStaticParams() {
  return [{ banco: "debates" }, ...disciplinasDosJogos().map((d) => ({ banco: d.area }))];
}

const CACHE = { "Cache-Control": "public, max-age=3600, s-maxage=86400" };

export async function GET(_pedido: Request, { params }: { params: Promise<{ banco: string }> }) {
  const { banco } = await params;
  if (banco === "debates") return Response.json({ temas: temasDeDebate() }, { headers: CACHE });
  const questoes = questoesPorDisciplina().get(banco);
  if (!questoes?.length) notFound();
  return Response.json({ questoes }, { headers: CACHE });
}

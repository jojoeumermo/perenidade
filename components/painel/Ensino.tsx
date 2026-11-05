// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useState } from "react";
import { rpc } from "@/lib/backend";
import { fraseDaAula } from "@/lib/operacao";
import { useI18n } from "../I18n";
import { useTrackOptions } from "../useTrackOptions";
import { dia, textoDoErro, useLista } from "./comum";
import { Abas, Area, Botao, Campo, Selecao, Tabela, Vazio, notificar, type ColumnDef } from "./ui";

interface Minhas {
  todas: boolean;
  disciplinas: string[];
}
interface AulaResultado {
  alvo: string;
  poucos: boolean;
  testes?: number;
  acertos?: number;
  pct?: number;
  dificil?: boolean;
  recente_pct?: number | null;
  anterior_pct?: number | null;
}
interface Lacuna {
  id: string;
  disciplina: string;
  titulo: string;
  descricao: string;
  aula: string;
  prioridade: "baixa" | "media" | "alta";
  status: "aberta" | "em_andamento" | "coberta" | "descartada";
  atualizado_em: string;
}

const STATUS: Record<Lacuna["status"], string> = { aberta: "Aberta", em_andamento: "Em andamento", coberta: "Coberta", descartada: "Descartada" };
const PRIORIDADE: Record<Lacuna["prioridade"], string> = { alta: "Alta", media: "Média", baixa: "Baixa" };

/** Escolha da disciplina (trilha): só as que a pessoa pode ver. Coordenação e curadoria enxergam todas. */
function useDisciplinas() {
  const { lang } = useI18n();
  const trilhas = useTrackOptions(lang);
  const [minhas, setMinhas] = useState<Minhas | null>(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    let vivo = true;
    rpc<Minhas>("aulas_resultado_minhas")
      .then((r) => vivo && setMinhas(r))
      .catch((e) => vivo && setErro(textoDoErro(e)));
    return () => {
      vivo = false;
    };
  }, []);
  const opcoes = useMemo(() => {
    if (!minhas) return [];
    const nome = (slug: string) => trilhas.find((t) => t.slug === slug)?.title ?? slug;
    const slugs = minhas.todas ? trilhas.map((t) => t.slug) : minhas.disciplinas;
    return slugs.map((slug) => ({ slug, nome: nome(slug), aulas: trilhas.find((t) => t.slug === slug)?.plan ?? [] }));
  }, [minhas, trilhas]);
  return { opcoes, erro, pronto: minhas !== null };
}

/**
 * Ensino (Etapa 8, backend-2): o resultado das aulas e as lacunas da disciplina, para quem ensina. O resultado soma
 * contagens anônimas (quem faz o teste não é identificado) e esconde aula com menos de 5 testes.
 */
export function Ensino() {
  const [aba, setAba] = useState<"resultado" | "lacunas">("resultado");
  const disc = useDisciplinas();
  const [slug, setSlug] = useState("");
  const atual = slug || disc.opcoes[0]?.slug || "";
  return (
    <div className="space-y-4">
      {disc.erro && <p role="alert" className="text-oxblood">{disc.erro}</p>}
      {disc.pronto && disc.opcoes.length === 0 && <Vazio titulo="Nenhuma disciplina para você" texto="Esta tela mostra as disciplinas em que você tem a função de educação. Peça à coordenação para ligar uma." />}
      {disc.opcoes.length > 0 && (
        <>
          <Selecao rotulo="Disciplina" value={atual} onChange={(e) => setSlug(e.target.value)}>
            {disc.opcoes.map((o) => <option key={o.slug} value={o.slug}>{o.nome}</option>)}
          </Selecao>
          <Abas
            rotulo="Ensino"
            valor={aba}
            aoMudar={setAba}
            opcoes={[{ id: "resultado", nome: "Resultado das aulas" }, { id: "lacunas", nome: "Lacunas da disciplina" }]}
            painel={(id) => (id === "resultado" ? <Resultado trilha={atual} aulas={disc.opcoes.find((o) => o.slug === atual)?.aulas ?? []} /> : <Lacunas disciplina={atual} />)}
          />
        </>
      )}
    </div>
  );
}

function Resultado({ trilha, aulas }: { trilha: string; aulas: { slug: string; title: string; ready: boolean }[] }) {
  const r = useLista<{ minimo: number; dias: number; aulas: AulaResultado[] }>("aulas_resultado_ensino", { p_trilha: trilha, p_dias: 90 }, { quieta: true });
  const titulo = (alvo: string) => aulas.find((a) => `${trilha}/${a.slug}` === alvo)?.title ?? alvo.slice(trilha.length + 1);
  return (
    <section aria-labelledby="ens-resultado" className="max-w-3xl space-y-3">
      <h2 id="ens-resultado" className="pn-secao-titulo">Resultado das aulas, últimos {r.dados?.dias ?? 90} dias</h2>
      <p className="pn-ajuda">Quantas vezes o teste do fim de cada aula foi terminado e quantas com 70% ou mais. São somas anônimas: não dá para saber quem fez. Aula com menos de {r.dados?.minimo ?? 5} testes aparece sem número.</p>
      {r.erro && <p role="alert" className="text-oxblood">{r.erro}</p>}
      {r.dados && r.dados.aulas.length === 0 && <Vazio titulo="Sem testes ainda" texto="Quando alguém terminar o teste de uma aula desta disciplina, ela aparece aqui." />}
      <ul className="space-y-2">
        {r.dados?.aulas.map((a) => (
          <li key={a.alvo}>
            <strong>{titulo(a.alvo)}:</strong> <span className={a.dificil ? "text-oxblood" : ""}>{fraseDaAula(a)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Lacunas({ disciplina }: { disciplina: string }) {
  const lista = useLista<Lacuna[]>("lacunas_listar", { p_disciplina: disciplina }, { quieta: true });
  const [edita, setEdita] = useState<Partial<Lacuna> | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function salvar() {
    if (!edita) return;
    setOcupado(true);
    try {
      await rpc("lacunas_salvar", { p: { ...edita, disciplina } });
      notificar.ok("Lacuna guardada.");
      setEdita(null);
      lista.recarregar();
    } catch (e) {
      notificar.erro(textoDoErro(e));
    } finally {
      setOcupado(false);
    }
  }

  const colunas: ColumnDef<Lacuna>[] = [
    { accessorKey: "titulo", header: "Lacuna" },
    { accessorKey: "prioridade", header: "Prioridade", cell: (c) => PRIORIDADE[c.row.original.prioridade] },
    { accessorKey: "status", header: "Situação", cell: (c) => STATUS[c.row.original.status] },
    { accessorKey: "atualizado_em", header: "Mexida em", cell: (c) => dia(c.row.original.atualizado_em) },
  ];

  return (
    <section aria-labelledby="ens-lacunas" className="space-y-3">
      <h2 id="ens-lacunas" className="pn-secao-titulo">Lacunas da disciplina</h2>
      <p className="pn-ajuda">O que ainda falta cobrir (um tema, uma aula, exercícios). Fica no banco, visível a quem ensina a disciplina, à curadoria e à coordenação.</p>
      {lista.erro && <p role="alert" className="text-oxblood">{lista.erro}</p>}
      <Botao variante="principal" onClick={() => setEdita({ titulo: "", descricao: "", aula: "", prioridade: "media", status: "aberta" })}>Anotar uma lacuna</Botao>
      {lista.dados && (
        <Tabela
          dados={lista.dados}
          colunas={colunas}
          legenda="Lacunas da disciplina"
          busca
          porPagina={15}
          aoClicarLinha={(l) => setEdita(l)}
          vazio={<Vazio titulo="Nenhuma lacuna anotada" texto="Quando você achar um buraco na disciplina, anote aqui." />}
        />
      )}
      {edita && (
        <div className="max-w-2xl space-y-3 rounded-md border border-rule p-4">
          <Campo rotulo="O que falta" value={edita.titulo ?? ""} maxLength={160} onChange={(e) => setEdita({ ...edita, titulo: e.target.value })} />
          <Area rotulo="Detalhe (opcional)" rows={3} maxLength={1500} value={edita.descricao ?? ""} onChange={(e) => setEdita({ ...edita, descricao: e.target.value })} />
          <Campo rotulo="Aula relacionada (opcional)" ajuda="Por exemplo, trilha/aula" value={edita.aula ?? ""} maxLength={120} onChange={(e) => setEdita({ ...edita, aula: e.target.value })} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Selecao rotulo="Prioridade" value={edita.prioridade ?? "media"} onChange={(e) => setEdita({ ...edita, prioridade: e.target.value as Lacuna["prioridade"] })}>
              {(Object.keys(PRIORIDADE) as Lacuna["prioridade"][]).map((p) => <option key={p} value={p}>{PRIORIDADE[p]}</option>)}
            </Selecao>
            <Selecao rotulo="Situação" value={edita.status ?? "aberta"} onChange={(e) => setEdita({ ...edita, status: e.target.value as Lacuna["status"] })}>
              {(Object.keys(STATUS) as Lacuna["status"][]).map((s) => <option key={s} value={s}>{STATUS[s]}</option>)}
            </Selecao>
          </div>
          <div className="flex gap-2">
            <Botao variante="principal" disabled={ocupado || (edita.titulo ?? "").trim().length < 3} onClick={() => void salvar()}>Guardar</Botao>
            <Botao onClick={() => setEdita(null)}>Cancelar</Botao>
          </div>
        </div>
      )}
    </section>
  );
}

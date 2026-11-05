// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { rpc } from "@/lib/backend";
import { fraseDaAula } from "@/lib/operacao";
import { textoDoErro, useLista } from "./comum";
import { RefreshCw } from "lucide-react";
import { Botao, CabecalhoDeSecao, Cartao, Faixa, Marca, Selecao, notificar } from "./ui";

interface Exemplo {
  exemplo: boolean;
  tela: string;
  dados: unknown;
}

const TELAS: { id: string; nome: string }[] = [
  { id: "resumo_diario", nome: "Resumo diário por e-mail" },
  { id: "imprensa", nome: "Caixa de imprensa" },
  { id: "lacunas", nome: "Lacunas da disciplina" },
  { id: "resultado_aulas", nome: "Resultado das aulas" },
  { id: "operacao", nome: "Operação do site" },
];

/**
 * Prévia com dados de exemplo (Etapa 8, backend-2) e o resumo diário opcional. Os exemplos vêm do banco (previa_exemplo),
 * todos inventados e marcados como exemplo: servem para aprender a tela e para a coordenação ver o texto do e-mail antes de
 * alguém ligar. Nada aqui lê dado real, e o resumo real (só contagens) só chega a quem ligou a opção.
 */
export function Previa() {
  const [tela, setTela] = useState("resumo_diario");
  return (
    <div className="max-w-3xl space-y-8">
      <ResumoDiario />
      <section aria-labelledby="previa-exemplo" className="space-y-3">
        <CabecalhoDeSecao nivel={2} id="previa-exemplo" titulo="Ver uma tela com dados de exemplo" />
        <Selecao rotulo="Tela" value={tela} onChange={(e) => setTela(e.target.value)}>
          {TELAS.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </Selecao>
        <Exemplo tela={tela} />
      </section>
    </div>
  );
}

function ResumoDiario() {
  const estado = useLista<{ ativo: boolean; ultimo: string | null }>("resumo_diario_estado", {}, { quieta: true });
  const [ocupado, setOcupado] = useState(false);
  async function definir(ativo: boolean) {
    setOcupado(true);
    try {
      await rpc("resumo_diario_definir", { p_ativo: ativo });
      notificar.ok(ativo ? "Ligado. O resumo chega só nos dias em que houver algo para você." : "Desligado.");
      estado.recarregar();
    } catch (e) {
      notificar.erro(textoDoErro(e));
    } finally {
      setOcupado(false);
    }
  }
  return (
    <section aria-labelledby="resumo-diario" className="space-y-3">
      <CabecalhoDeSecao nivel={2} id="resumo-diario" titulo="Resumo diário por e-mail" />
      <p className="pn-ajuda">Opcional e desligado até você ligar. De manhã, um e-mail curto com só contagens do que espera por você (revisões, pedidos de imprensa, lacunas importantes, aviso do token do Instagram para a coordenação). Sem nome de ninguém e sem conteúdo. Não chega em dia sem novidade. Você desliga aqui, quando quiser.</p>
      {estado.erro && <Faixa tom="erro" acao={<Botao pequeno onClick={estado.recarregar}>Tentar de novo</Botao>}>{estado.erro}</Faixa>}
      {estado.dados && (
        <Marca rotulo="Quero receber o resumo diário" checked={estado.dados.ativo} disabled={ocupado} onChange={(e) => void definir(e.target.checked)} />
      )}
    </section>
  );
}

function Exemplo({ tela }: { tela: string }) {
  const r = useLista<Exemplo>("previa_exemplo", { p_tela: tela }, { quieta: true });
  if (r.erro) return <Faixa tom="erro" acao={<Botao pequeno onClick={r.recarregar}>Tentar de novo</Botao>}>{r.erro}</Faixa>;
  if (!r.dados) return null;
  const d = r.dados.dados as never;
  return (
    <Cartao as="div" variante="plano" className="grid gap-2">
      <Faixa tom="bordo" titulo="EXEMPLO: nada abaixo é real." />
      {tela === "resumo_diario" && (
        <div>
          <p className="font-semibold">{(d as { assunto: string }).assunto}</p>
          <p className="whitespace-pre-wrap">{(d as { texto: string }).texto}</p>
        </div>
      )}
      {tela === "imprensa" && (
        <ul className="space-y-2">
          {(d as { nome: string; veiculo: string; assunto: string; mensagem: string; status: string }[]).map((p) => (
            <li key={p.assunto}><strong>{p.assunto}</strong> ({p.status}) · {p.nome}, {p.veiculo}<br />{p.mensagem}</li>
          ))}
        </ul>
      )}
      {tela === "lacunas" && (
        <ul className="space-y-1">
          {(d as { titulo: string; prioridade: string; status: string }[]).map((l) => (
            <li key={l.titulo}>{l.titulo} · prioridade {l.prioridade} · {l.status.replace("_", " ")}</li>
          ))}
        </ul>
      )}
      {tela === "resultado_aulas" && (
        <ul className="space-y-1">
          {(d as { alvo: string; poucos: boolean; testes?: number; pct?: number; dificil?: boolean; recente_pct?: number; anterior_pct?: number }[]).map((a) => (
            <li key={a.alvo}><strong>{a.alvo}:</strong> {fraseDaAula(a)}</li>
          ))}
        </ul>
      )}
      {tela === "operacao" && (
        <ul className="space-y-1">
          <li>Publicação: pronta, há {(d as { publicacao: { ha_minutos: number } }).publicacao.ha_minutos} min.</li>
          <li>Cópia do banco: deu certo, há {(d as { backup: { ha_dias: number } }).backup.ha_dias} dias.</li>
          <li>Token do Instagram: vence em {(d as { instagram: { dias: number } }).instagram.dias} dias (aviso).</li>
        </ul>
      )}
      <p>
        <Botao variante="discreto" pequeno simbolo={RefreshCw} onClick={() => r.recarregar()}>Atualizar o exemplo</Botao>
      </p>
    </Cartao>
  );
}

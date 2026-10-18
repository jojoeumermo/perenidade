// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { type Confirmavel, type ConfigDoApoio, type Custo, type Faixa, nomeDoMes, type NumerosDoSite, reais, type Relatorio, textoParaBenfeitoria } from "@/lib/apoio";
import { CampoData } from "./Campos";
import { Abas, Aviso, botao, botaoClaro, campo, dataHora, elo, rotulo, useAcao, useLista } from "./comum";

interface Painel {
  publicado: ConfigDoApoio;
  rascunho: ConfigDoApoio;
  publicado_em: string | null;
  pode_desfazer: boolean;
  regras: { segunda_pessoa: boolean };
  coordenacao: number;
  eu: string;
  pedidos: { id: string; nome: string; mensagem: string; criado_em: string }[];
  mural: { id: string; nome: string; mensagem: string; visivel: boolean; consentimento: string; criado_em: string }[];
  lancamentos: { id: string; mes: string; tipo: "entrada" | "saida"; categoria: string; valor: number; descricao: string; comprovante: string }[];
  relatorios: (Relatorio & { id: string; status: string; proposta: { dados: Relatorio["dados"]; nota: string; motivo: string } | null; pedido_por: string | null; pedido_nome: string | null })[];
  texto: { numeros: Record<string, number | string>; em: string } | null;
  voluntarios: number;
}

const ACONFIRMAR = <span className="ml-2 border border-gold px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-gold">a confirmar pela coordenação</span>;

/** Apoio e transparência (só coordenação): a página de Apoie, o mural, as contas do mês e o texto para a Benfeitoria. */
export function Apoio() {
  const dados = useLista<Painel>("apoio_painel");
  const [aba, setAba] = useState<"pagina" | "mural" | "contas" | "benfeitoria">("pagina");
  const d = dados.dados;
  if (!d) return <Aviso texto={dados.erro || "Carregando…"} />;
  return (
    <div>
      <Abas
        atual={aba}
        escolher={setAba}
        opcoes={[
          { id: "pagina" as const, nome: "Página de Apoie" },
          { id: "mural" as const, nome: "Mural", conta: d.pedidos.length },
          { id: "contas" as const, nome: "Contas do mês", conta: d.relatorios.filter((r) => r.proposta).length },
          { id: "benfeitoria" as const, nome: "Texto para a Benfeitoria" },
        ]}
      />
      {aba === "pagina" && <EditorDaPagina key={`${d.publicado_em}-${d.pode_desfazer}`} d={d} recarregar={dados.recarregar} />}
      {aba === "mural" && <Mural d={d} recarregar={dados.recarregar} />}
      {aba === "contas" && <ContasDoMes d={d} recarregar={dados.recarregar} />}
      {aba === "benfeitoria" && <TextoDaCampanha d={d} recarregar={dados.recarregar} />}
    </div>
  );
}

function TextoConfirmavel({ titulo, ajuda, valor, mudar, linhas = 3 }: { titulo: string; ajuda: string; valor: Confirmavel; mudar: (v: Confirmavel) => void; linhas?: number }) {
  return (
    <div className="painel-cartao p-4">
      <p className="font-semibold">{titulo}{!valor.confirmado && ACONFIRMAR}</p>
      <p className="text-xs text-ink-soft">{ajuda}</p>
      <textarea value={valor.texto} onChange={(e) => mudar({ ...valor, texto: e.target.value })} rows={linhas} maxLength={1500} className={campo} aria-label={titulo} />
      <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
        <input type="checkbox" checked={valor.confirmado} disabled={!valor.texto.trim()} onChange={(e) => mudar({ ...valor, confirmado: e.target.checked })} />
        Conferido: pode aparecer na página pública
      </label>
    </div>
  );
}

function EditorDaPagina({ d, recarregar }: { d: Painel; recarregar: () => void }) {
  const [c, setC] = useState<ConfigDoApoio>(d.rascunho);
  const acao = useAcao(recarregar);
  const mudou = JSON.stringify(c) !== JSON.stringify(d.rascunho);
  const rascunhoDiferente = JSON.stringify(d.rascunho) !== JSON.stringify(d.publicado);
  const faixa = (i: number, f: Partial<Faixa>) => setC({ ...c, faixas: c.faixas.map((x, j) => (j === i ? { ...x, ...f } : x)) });
  const custo = (i: number, f: Partial<Custo>) => setC({ ...c, custos: c.custos.map((x, j) => (j === i ? { ...x, ...f } : x)) });
  const num = (v: string) => (v === "" ? 0 : Number(v));
  const guardar = () => acao.agir("apoio_rascunho_salvar", { p: c }, "Rascunho guardado ✓ Veja a prévia antes de publicar.");
  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-soft">
        Tudo aqui vai primeiro para um rascunho. A página pública só muda quando você publica, e dá para desfazer a última publicação.
        {d.publicado_em ? ` Última publicação: ${dataHora(d.publicado_em)}.` : " A página mostra os valores iniciais da campanha."} Os textos ficam como você escrever, em todos os idiomas.
      </p>

      <section className="painel-cartao p-4">
        <h3 className="font-serif text-xl font-semibold">Campanha</h3>
        <label className="mt-2 block text-sm">Link da campanha<input value={c.link} onChange={(e) => setC({ ...c, link: e.target.value.trim() })} className={campo} /></label>
        <div className="mt-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={c.campanha !== null} onChange={(e) => setC({ ...c, campanha: e.target.checked ? { mensal: 0, apoiadores: 0, em: new Date().toISOString().slice(0, 10) } : null })} />
            Informar os números da campanha (copiados da Benfeitoria, à mão)
          </label>
          {c.campanha && (
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              <label className="block text-sm">Arrecadado por mês (R$)<input type="number" min={0} step="0.01" value={c.campanha.mensal} onChange={(e) => setC({ ...c, campanha: { ...c.campanha!, mensal: num(e.target.value) } })} className={campo} /></label>
              <label className="block text-sm">Número de apoios<input type="number" min={0} step={1} value={c.campanha.apoiadores} onChange={(e) => setC({ ...c, campanha: { ...c.campanha!, apoiadores: num(e.target.value) } })} className={campo} /></label>
              <CampoData rotulo="Data da informação" valor={c.campanha.em} mudar={(v) => setC({ ...c, campanha: { ...c.campanha!, em: v } })} className="text-sm" />
            </div>
          )}
          <p className="mt-1 text-xs text-ink-soft">A página mostra a data e avisa que não é um número ao vivo. Sem números, as metas aparecem só com o valor a alcançar.</p>
        </div>
      </section>

      <section className="painel-cartao p-4">
        <h3 className="font-serif text-xl font-semibold">Faixas</h3>
        <p className="text-xs text-ink-soft">Sem descrição, vale o texto padrão: “Apoio solidário, sem benefício exclusivo. Se quiser, seu nome aparece no mural.” Nunca prometa benefício que não existe.</p>
        <ul className="mt-2 space-y-2">
          {c.faixas.map((f, i) => (
            <li key={i} className="grid gap-2 sm:grid-cols-[7rem_10rem_1fr_auto] sm:items-end">
              <label className="block text-sm">R$ por mês<input type="number" min={1} step="1" value={f.valor} onChange={(e) => faixa(i, { valor: num(e.target.value) })} className={campo} /></label>
              <label className="block text-sm">Nome<input value={f.nome} onChange={(e) => faixa(i, { nome: e.target.value })} maxLength={40} className={campo} /></label>
              <label className="block text-sm">Descrição (opcional)<input value={f.descricao} onChange={(e) => faixa(i, { descricao: e.target.value })} maxLength={200} className={campo} /></label>
              <button type="button" className={`${elo} pb-3 text-sm`} disabled={c.faixas.length <= 1} onClick={() => setC({ ...c, faixas: c.faixas.filter((_, j) => j !== i) })}>Tirar</button>
            </li>
          ))}
        </ul>
        {c.faixas.length < 8 && <button type="button" className={`${elo} mt-2 text-sm`} onClick={() => setC({ ...c, faixas: [...c.faixas, { valor: 10, nome: "", descricao: "" }] })}>+ Faixa</button>}
      </section>

      <section className="painel-cartao p-4">
        <h3 className="font-serif text-xl font-semibold">Metas</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm">Meta 1 (R$ por mês)<input type="number" min={1} value={c.metas.meta1.alvo} onChange={(e) => setC({ ...c, metas: { ...c.metas, meta1: { ...c.metas.meta1, alvo: num(e.target.value) } } })} className={campo} /></label>
            <label className="block text-sm">O que a Meta 1 cobre<input value={c.metas.meta1.texto} onChange={(e) => setC({ ...c, metas: { ...c.metas, meta1: { ...c.metas.meta1, texto: e.target.value } } })} maxLength={140} className={campo} /></label>
          </div>
          <div>
            <label className="flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={c.metas.meta2 !== null} onChange={(e) => setC({ ...c, metas: { ...c.metas, meta2: e.target.checked ? { alvo: 1000, texto: "" } : null } })} /> Meta 2</label>
            {c.metas.meta2 && (
              <>
                <label className="block text-sm">Meta 2 (R$ por mês)<input type="number" min={1} value={c.metas.meta2.alvo} onChange={(e) => setC({ ...c, metas: { ...c.metas, meta2: { ...c.metas.meta2!, alvo: num(e.target.value) } } })} className={campo} /></label>
                <label className="block text-sm">O que a Meta 2 cobre<input value={c.metas.meta2.texto} onChange={(e) => setC({ ...c, metas: { ...c.metas, meta2: { ...c.metas.meta2!, texto: e.target.value } } })} maxLength={140} className={campo} /></label>
              </>
            )}
          </div>
        </div>
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm"><input type="checkbox" checked={c.metas.intermediaria !== null} onChange={(e) => setC({ ...c, metas: { ...c.metas, intermediaria: e.target.checked ? { texto: "Primeiros 10 apoios", alvo: 10, unidade: "apoiadores" } : null } })} /> Meta do começo (por exemplo, “primeiros 10 apoios”)</label>
        {c.metas.intermediaria && (
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <label className="block text-sm">Texto<input value={c.metas.intermediaria.texto} onChange={(e) => setC({ ...c, metas: { ...c.metas, intermediaria: { ...c.metas.intermediaria!, texto: e.target.value } } })} maxLength={140} className={campo} /></label>
            <label className="block text-sm">Alvo<input type="number" min={1} value={c.metas.intermediaria.alvo} onChange={(e) => setC({ ...c, metas: { ...c.metas, intermediaria: { ...c.metas.intermediaria!, alvo: num(e.target.value) } } })} className={campo} /></label>
            <label className="block text-sm">Conta<select value={c.metas.intermediaria.unidade} onChange={(e) => setC({ ...c, metas: { ...c.metas, intermediaria: { ...c.metas.intermediaria!, unidade: e.target.value as "apoiadores" | "reais" } } })} className={campo}><option value="apoiadores">número de apoios</option><option value="reais">reais por mês</option></select></label>
          </div>
        )}
      </section>

      <section className="painel-cartao p-4">
        <h3 className="font-serif text-xl font-semibold">Custos recorrentes (“Para onde vai”)</h3>
        <p className="text-xs text-ink-soft">Valor mensal real. Sem nenhum custo aqui, a página mostra só a explicação de cada gasto, sem números.</p>
        <ul className="mt-2 space-y-2">
          {c.custos.map((x, i) => (
            <li key={i} className="grid gap-2 sm:grid-cols-[1fr_8rem_auto_1fr_auto] sm:items-end">
              <label className="block text-sm">Categoria<input value={x.categoria} onChange={(e) => custo(i, { categoria: e.target.value })} maxLength={60} className={campo} /></label>
              <label className="block text-sm">R$ por mês<input type="number" min={0} step="0.01" value={x.valor ?? ""} onChange={(e) => custo(i, { valor: e.target.value === "" ? null : Number(e.target.value) })} className={campo} /></label>
              <label className="flex cursor-pointer items-center gap-1 pb-3 text-sm"><input type="checkbox" checked={x.dolar} onChange={(e) => custo(i, { dolar: e.target.checked })} /> parte em dólar</label>
              <label className="block text-sm">Explicação (opcional)<input value={x.descricao} onChange={(e) => custo(i, { descricao: e.target.value })} maxLength={200} className={campo} /></label>
              <button type="button" className={`${elo} pb-3 text-sm`} onClick={() => setC({ ...c, custos: c.custos.filter((_, j) => j !== i) })}>Tirar</button>
            </li>
          ))}
        </ul>
        {c.custos.length < 20 && <button type="button" className={`${elo} mt-2 text-sm`} onClick={() => setC({ ...c, custos: [...c.custos, { categoria: "", valor: null, dolar: false, descricao: "" }] })}>+ Custo</button>}
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        <TextoConfirmavel titulo="Quem é responsável" ajuda="Nome e papel exatamente como constam na campanha, e como o dinheiro é administrado." valor={c.responsavel} mudar={(v) => setC({ ...c, responsavel: v })} linhas={5} />
        <TextoConfirmavel titulo="Taxa da plataforma" ajuda="Quanto do apoio chega ao projeto. Só aparece (nas perguntas) depois de conferido." valor={c.taxa} mudar={(v) => setC({ ...c, taxa: v })} />
        <TextoConfirmavel titulo="Como cancelar, passo a passo" ajuda="O caminho dentro da Benfeitoria. Até ser conferido, a página diz só que o cancelamento é feito lá." valor={c.cancelamento} mudar={(v) => setC({ ...c, cancelamento: v })} />
      </div>

      <section className="painel-cartao p-4">
        <h3 className="font-serif text-xl font-semibold">Perguntas a mais</h3>
        <p className="text-xs text-ink-soft">As perguntas padrão já estão na página (traduzidas). Aqui entram as que a coordenação quiser acrescentar.</p>
        <ul className="mt-2 space-y-2">
          {c.faq.map((x, i) => (
            <li key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
              <label className="block text-sm">Pergunta<input value={x.p} onChange={(e) => setC({ ...c, faq: c.faq.map((y, j) => (j === i ? { ...y, p: e.target.value } : y)) })} maxLength={200} className={campo} /></label>
              <label className="block text-sm">Resposta<textarea value={x.r} onChange={(e) => setC({ ...c, faq: c.faq.map((y, j) => (j === i ? { ...y, r: e.target.value } : y)) })} rows={2} maxLength={1500} className={campo} /></label>
              <button type="button" className={`${elo} pb-3 text-sm`} onClick={() => setC({ ...c, faq: c.faq.filter((_, j) => j !== i) })}>Tirar</button>
            </li>
          ))}
        </ul>
        {c.faq.length < 20 && <button type="button" className={`${elo} mt-2 text-sm`} onClick={() => setC({ ...c, faq: [...c.faq, { p: "", r: "" }] })}>+ Pergunta</button>}
      </section>

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-3 border-t-2 border-ink bg-parchment py-3">
        <button type="button" className={botao} disabled={acao.ocupado || !mudou} onClick={() => void guardar()}>Guardar rascunho</button>
        <a href="/pt/apoie?previa=1" target="_blank" rel="noopener" className={botaoClaro}>Ver a prévia ↗</a>
        <button type="button" className={botaoClaro} disabled={acao.ocupado || mudou || !rascunhoDiferente} title={mudou ? "Guarde o rascunho antes" : undefined} onClick={() => { if (window.confirm("Publicar o rascunho na página de Apoie?")) void acao.agir("apoio_publicar", {}, "Publicado ✓ A página de Apoie já mostra a versão nova."); }}>Publicar</button>
        {d.pode_desfazer && <button type="button" className={elo} disabled={acao.ocupado} onClick={() => { if (window.confirm("Voltar a página ao que era antes da última publicação?")) void acao.agir("apoio_desfazer", {}, "Desfeito: a página voltou à versão anterior."); }}>Desfazer a última publicação</button>}
        {mudou && <span className="text-sm text-oxblood">Há mudanças não guardadas.</span>}
        <Aviso texto={acao.aviso} />
      </div>
    </div>
  );
}

function Mural({ d, recarregar }: { d: Painel; recarregar: () => void }) {
  const acao = useAcao(recarregar);
  const [novo, setNovo] = useState({ nome: "", mensagem: "", consentimento: "" });
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section>
        <h3 className="font-serif text-xl font-semibold">Pedidos para aparecer</h3>
        <p className="text-sm text-ink-soft">Confira o nome na lista de apoiadores da Benfeitoria antes de aprovar. Nada além do nome e da mensagem é guardado.</p>
        <ul className="mt-3 space-y-2">
          {d.pedidos.map((x) => (
            <li key={x.id} className="painel-cartao p-3">
              <p className="font-semibold">{x.nome}</p>
              {x.mensagem && <p className="text-sm italic">“{x.mensagem}”</p>}
              <p className="text-xs text-ink-soft">pedido em {dataHora(x.criado_em)}</p>
              <p className="mt-2 flex gap-3">
                <button type="button" className={botao} disabled={acao.ocupado} onClick={() => void acao.agir("apoio_mural_decidir", { p_id: x.id, p_aprovar: true }, "Aprovado: o nome está no mural ✓")}>Aprovar</button>
                <button type="button" className={botaoClaro} disabled={acao.ocupado} onClick={() => void acao.agir("apoio_mural_decidir", { p_id: x.id, p_aprovar: false }, "Recusado.")}>Recusar</button>
              </p>
            </li>
          ))}
          {d.pedidos.length === 0 && <li className="text-ink-soft">Nenhum pedido esperando.</li>}
        </ul>
        <div className="painel-cartao mt-4 space-y-2 p-4">
          <p className="font-semibold">Acrescentar um nome</p>
          <input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Nome ou apelido" aria-label="Nome" maxLength={80} className={campo} />
          <input value={novo.mensagem} onChange={(e) => setNovo({ ...novo, mensagem: e.target.value })} placeholder="Mensagem (opcional)" aria-label="Mensagem" maxLength={200} className={campo} />
          <input value={novo.consentimento} onChange={(e) => setNovo({ ...novo, consentimento: e.target.value })} placeholder="Como a pessoa autorizou (ex.: mensagem no Instagram em 12/10)" aria-label="Consentimento" maxLength={200} className={campo} />
          <button type="button" className={botao} disabled={acao.ocupado || novo.nome.trim().length < 2 || novo.consentimento.trim().length < 5} onClick={async () => { if (await acao.agir("apoio_mural_adicionar", { p_nome: novo.nome, p_mensagem: novo.mensagem, p_consentimento: novo.consentimento }, "Nome acrescentado ✓")) setNovo({ nome: "", mensagem: "", consentimento: "" }); }}>Acrescentar</button>
        </div>
      </section>
      <section>
        <h3 className="font-serif text-xl font-semibold">No mural</h3>
        <p className="text-sm text-ink-soft">Esconder tira da página sem apagar. Retirar apaga de vez (quando a pessoa pede).</p>
        <ul className="mt-3 divide-y divide-rule border-y border-rule">
          {d.mural.map((x) => (
            <li key={x.id} className="py-2">
              <p><strong className={x.visivel ? "" : "text-ink-soft line-through"}>{x.nome}</strong>{x.mensagem && <span className="text-ink-soft"> · “{x.mensagem}”</span>}</p>
              <p className="text-xs text-ink-soft">{x.consentimento}</p>
              <p className="mt-1 flex gap-3 text-sm">
                <button type="button" className={elo} disabled={acao.ocupado} onClick={() => void acao.agir("apoio_mural_visivel", { p_id: x.id, p_visivel: !x.visivel }, x.visivel ? "Escondido do mural." : "De volta ao mural.")}>{x.visivel ? "Esconder" : "Mostrar"}</button>
                <button type="button" className={elo} disabled={acao.ocupado} onClick={() => { if (window.confirm(`Retirar ${x.nome} do mural de vez?`)) void acao.agir("apoiador_remover", { p_id: x.id }, "Nome retirado."); }}>Retirar</button>
              </p>
            </li>
          ))}
          {d.mural.length === 0 && <li className="py-2 text-ink-soft">O mural ainda não tem nomes: a página mostra “Quem já ajuda sem dinheiro”.</li>}
        </ul>
        <Aviso texto={acao.aviso} />
      </section>
    </div>
  );
}

const mesAtual = () => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}`; };
const mesPassado = () => { const h = new Date(); h.setDate(1); h.setMonth(h.getMonth() - 1); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}`; };

function ContasDoMes({ d, recarregar }: { d: Painel; recarregar: () => void }) {
  const acao = useAcao(recarregar);
  const vazio = { id: "", mes: mesPassado(), tipo: "saida" as "entrada" | "saida", categoria: "", valor: "", descricao: "", comprovante: "" };
  const [l, setL] = useState(vazio);
  const [pedido, setPedido] = useState({ mes: mesPassado(), nota: "", motivo: "" });
  const meses = [...new Set(d.lancamentos.map((x) => x.mes.slice(0, 7)))];
  const jaPublicado = d.relatorios.some((r) => r.mes.slice(0, 7) === pedido.mes && r.publicado_em);
  const segunda = d.regras.segunda_pessoa;
  return (
    <div className="space-y-6">
      <section className="painel-cartao p-4">
        <h3 className="font-serif text-xl font-semibold">{l.id ? "Corrigir lançamento" : "Novo lançamento"}</h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">Mês<input type="month" max={mesAtual()} value={l.mes} onChange={(e) => setL({ ...l, mes: e.target.value })} className={campo} /></label>
          <label className="block text-sm">Tipo<select value={l.tipo} onChange={(e) => setL({ ...l, tipo: e.target.value as "entrada" | "saida" })} className={campo}><option value="entrada">Entrada</option><option value="saida">Saída</option></select></label>
          <label className="block text-sm">Valor (R$)<input type="number" min={0.01} step="0.01" value={l.valor} onChange={(e) => setL({ ...l, valor: e.target.value })} className={campo} /></label>
          <label className="block text-sm">Categoria<input value={l.categoria} onChange={(e) => setL({ ...l, categoria: e.target.value })} list="apoio-categorias" maxLength={60} placeholder={l.tipo === "entrada" ? "Benfeitoria" : "Hospedagem"} className={campo} /></label>
          <label className="block text-sm sm:col-span-2">Descrição (sai no relatório só como total da categoria)<input value={l.descricao} onChange={(e) => setL({ ...l, descricao: e.target.value })} maxLength={300} className={campo} /></label>
          <label className="block text-sm sm:col-span-3">Onde está o comprovante (fica só no painel)<input value={l.comprovante} onChange={(e) => setL({ ...l, comprovante: e.target.value })} maxLength={300} placeholder="Ex.: pasta Financeiro/2026-09/fatura-hospedagem.pdf" className={campo} /></label>
        </div>
        <datalist id="apoio-categorias">{[...new Set(d.lancamentos.map((x) => x.categoria))].map((x) => <option key={x} value={x} />)}</datalist>
        <p className="mt-3 flex gap-3">
          <button type="button" className={botao} disabled={acao.ocupado || l.categoria.trim().length < 2 || !(Number(l.valor) > 0)} onClick={async () => { if (await acao.agir("apoio_lancamento_salvar", { p: { ...l, id: l.id || null, valor: Number(l.valor) } }, "Lançamento guardado ✓")) setL({ ...vazio, mes: l.mes, tipo: l.tipo }); }}>{l.id ? "Guardar a correção" : "Lançar"}</button>
          {l.id && <button type="button" className={elo} onClick={() => setL(vazio)}>Cancelar</button>}
        </p>
      </section>

      <section>
        <h3 className="font-serif text-xl font-semibold">Lançamentos</h3>
        {meses.length === 0 && <p className="text-ink-soft">Nenhum lançamento ainda.</p>}
        {meses.map((m) => {
          const doMes = d.lancamentos.filter((x) => x.mes.startsWith(m));
          const saldo = doMes.reduce((s, x) => s + (x.tipo === "entrada" ? 1 : -1) * Number(x.valor), 0);
          return (
            <details key={m} className="painel-cartao mt-2 p-3" open={m === meses[0]}>
              <summary className="cursor-pointer font-semibold capitalize">{nomeDoMes(m)} · saldo {reais(saldo)}</summary>
              <table className="mt-2 w-full text-left text-sm">
                <tbody className="divide-y divide-rule">
                  {doMes.map((x) => (
                    <tr key={x.id}>
                      <td className="py-1">{x.tipo === "entrada" ? "↘ entrada" : "↗ saída"}</td>
                      <td>{x.categoria}{x.descricao && <span className="text-ink-soft"> · {x.descricao}</span>}{x.comprovante && <span className="block text-xs text-ink-soft">comprovante: {x.comprovante}</span>}</td>
                      <td className="text-right">{reais(Number(x.valor))}</td>
                      <td className="text-right"><button type="button" className={elo} onClick={() => setL({ ...x, mes: x.mes.slice(0, 7), valor: String(x.valor) })}>Corrigir</button> <button type="button" className={elo} disabled={acao.ocupado} onClick={() => { if (window.confirm("Apagar este lançamento?")) void acao.agir("apoio_lancamento_remover", { p_id: x.id }, "Lançamento apagado."); }}>Apagar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          );
        })}
      </section>

      <section className="painel-cartao p-4">
        <h3 className="font-serif text-xl font-semibold">Publicar o relatório do mês</h3>
        <p className="text-sm text-ink-soft">
          O relatório soma os lançamentos do mês por categoria. {segunda ? "Outra pessoa da coordenação confirma antes de sair (regra ligada)." : "Sai na hora (a regra da segunda pessoa está desligada)."} Correção de relatório já publicado guarda a versão anterior, que fica visível na prestação de contas.
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">Mês<input type="month" max={mesPassado()} value={pedido.mes} onChange={(e) => setPedido({ ...pedido, mes: e.target.value })} className={campo} /></label>
          <label className="block text-sm sm:col-span-2">Nota da coordenação (pública)<input value={pedido.nota} onChange={(e) => setPedido({ ...pedido, nota: e.target.value })} maxLength={2000} className={campo} /></label>
          {jaPublicado && <label className="block text-sm sm:col-span-3">Motivo da correção (público, obrigatório)<input value={pedido.motivo} onChange={(e) => setPedido({ ...pedido, motivo: e.target.value })} maxLength={300} className={campo} /></label>}
        </div>
        <button type="button" className={`mt-3 ${botao}`} disabled={acao.ocupado || (jaPublicado && pedido.motivo.trim().length < 5)} onClick={() => void acao.agir("apoio_relatorio_pedir", { p_mes: pedido.mes, p_nota: pedido.nota, p_motivo: pedido.motivo }, segunda ? "Pedido feito: outra pessoa da coordenação recebeu o aviso para confirmar." : "Relatório publicado ✓")}>{jaPublicado ? "Pedir a correção" : "Pedir a publicação"}</button>
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={segunda} disabled={acao.ocupado} onChange={(e) => void acao.agir("apoio_regras_salvar", { p: { segunda_pessoa: e.target.checked } }, "Regra guardada ✓")} />
          Exigir a confirmação de uma segunda pessoa da coordenação {d.coordenacao < 2 && <span className="text-oxblood">(hoje a coordenação tem {d.coordenacao} pessoa)</span>}
        </label>
      </section>

      <section>
        <h3 className="font-serif text-xl font-semibold">Relatórios</h3>
        <ul className="mt-2 space-y-2">
          {d.relatorios.map((r) => (
            <li key={r.id} className={`painel-cartao p-3 ${r.proposta ? "border-2 border-gold" : ""}`}>
              <p className="font-semibold capitalize">{nomeDoMes(r.mes)} {r.publicado_em ? <span className="text-sm font-normal text-ok">· publicado em {dataHora(r.publicado_em)}</span> : <span className="text-sm font-normal text-gold">· ainda não publicado</span>}</p>
              {r.publicado_em && <p className="text-sm">Entradas {reais(Number(r.dados.total_entradas))} · saídas {reais(Number(r.dados.total_saidas))} · saldo {reais(Number(r.dados.saldo))}{r.historico && r.historico.length > 0 ? ` · ${r.historico.length} correção(ões)` : ""}</p>}
              {r.proposta && (
                <div className="mt-2 border-t border-rule pt-2 text-sm">
                  <p className={rotulo}>{r.publicado_em ? "Correção esperando confirmação" : "Esperando confirmação"} · pedido por {r.pedido_nome ?? "alguém"}</p>
                  <p>Entradas {reais(Number(r.proposta.dados.total_entradas))} · saídas {reais(Number(r.proposta.dados.total_saidas))} · saldo {reais(Number(r.proposta.dados.saldo))}</p>
                  {r.proposta.nota && <p className="text-ink-soft">Nota: {r.proposta.nota}</p>}
                  {r.proposta.motivo && <p className="text-ink-soft">Motivo: {r.proposta.motivo}</p>}
                  <p className="mt-2 flex gap-3">
                    <button type="button" className={botao} disabled={acao.ocupado || (segunda && r.pedido_por === d.eu)} title={segunda && r.pedido_por === d.eu ? "Quem pediu não confirma o próprio relatório" : undefined} onClick={() => void acao.agir("apoio_relatorio_confirmar", { p_id: r.id }, "Confirmado e publicado ✓")}>Confirmar e publicar</button>
                    <button type="button" className={elo} disabled={acao.ocupado} onClick={() => void acao.agir("apoio_relatorio_descartar", { p_id: r.id }, "Pedido descartado.")}>Descartar o pedido</button>
                  </p>
                </div>
              )}
            </li>
          ))}
          {d.relatorios.length === 0 && <li className="text-ink-soft">Nenhum relatório ainda.</li>}
        </ul>
        <p className="mt-2 text-sm"><a href="/pt/apoie/contas" target="_blank" rel="noopener" className={elo}>Ver a prestação de contas pública ↗</a></p>
        <Aviso texto={acao.aviso} />
      </section>
    </div>
  );
}

function TextoDaCampanha({ d, recarregar }: { d: Painel; recarregar: () => void }) {
  const acao = useAcao(recarregar);
  const [numeros, setNumeros] = useState<NumerosDoSite | null>(null);
  const [copiado, setCopiado] = useState("");
  useEffect(() => {
    let vivo = true;
    fetch("/pt/apoio-numeros.json").then((r) => (r.ok ? r.json() : null)).then((n: NumerosDoSite | null) => vivo && setNumeros(n)).catch(() => null);
    return () => { vivo = false; };
  }, []);
  if (!numeros) return <p className="text-ink-soft">Lendo os números do site…</p>;
  const ultimo = d.relatorios.find((r) => r.publicado_em) ?? null;
  const atuais: Record<string, number | string> = { ...numeros, voluntarios: d.voluntarios, relatorio: ultimo?.mes ?? "" };
  const textos = textoParaBenfeitoria({ ...numeros, voluntarios: d.voluntarios }, d.publicado, ultimo);
  const velho = d.texto && Object.entries(atuais).some(([k, v]) => String(d.texto!.numeros[k] ?? "") !== String(v));
  async function copiar(qual: "descricao" | "atualizacao") {
    try {
      await navigator.clipboard.writeText(textos[qual]);
      setCopiado(qual);
      await acao.agir("apoio_texto_copiado", { p_numeros: atuais }, "Copiado ✓ Cole na Benfeitoria. O painel avisa quando os números mudarem.");
    } catch {
      setCopiado("");
    }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">O painel não mexe na Benfeitoria: ele monta o texto com os números reais do site e do último relatório, e você cola lá.</p>
      {velho && <p className="border-2 border-gold p-3 text-sm" role="status">Os números mudaram desde a última cópia ({dataHora(d.texto!.em)}): o texto colado na campanha pode estar desatualizado.</p>}
      {!d.texto && <p className="text-sm text-ink-soft">Nenhum texto foi copiado ainda.</p>}
      {(["descricao", "atualizacao"] as const).map((qual) => (
        <section key={qual} className="painel-cartao p-4">
          <h3 className="font-serif text-xl font-semibold">{qual === "descricao" ? "Descrição da campanha" : "Atualização do mês"}</h3>
          <textarea readOnly value={textos[qual]} rows={qual === "descricao" ? 10 : 7} className={campo} aria-label={qual === "descricao" ? "Descrição da campanha" : "Atualização do mês"} />
          <button type="button" className={`mt-2 ${botaoClaro}`} onClick={() => void copiar(qual)}>{copiado === qual ? "Copiado ✓" : "Copiar"}</button>
        </section>
      ))}
      <Aviso texto={acao.aviso} />
    </div>
  );
}

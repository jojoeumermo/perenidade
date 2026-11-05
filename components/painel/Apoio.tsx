// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { ArrowDownRight, ArrowUpRight, Copy, ExternalLink, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { type Confirmavel, type ConfigDoApoio, type Custo, type Faixa as FaixaDoApoio, nomeDoMes, type NumerosDoSite, reais, type Relatorio, textoParaBenfeitoria } from "@/lib/apoio";
import { CampoData } from "./Campos";
import { dataHora, useAcao, useLista } from "./comum";
import { MoldeConfiguracao } from "./moldes";
import { Abas, Area, Botao, Campo, Cartao, confirmarFrase, Esqueleto, Faixa, ItemDeLista, Lista, Marca, Selecao, Selo, Vazio } from "./ui";

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

const ACONFIRMAR = (
  <Selo tom="ouro" className="ml-2">
    a confirmar pela coordenação
  </Selo>
);

/** O recado de uma ação (sucesso ou erro do banco), numa faixa que o leitor de tela anuncia com calma. */
const Recado = ({ texto }: { texto: string }) => <div aria-live="polite">{texto && <Faixa tom="info">{texto}</Faixa>}</div>;

type AbaDoApoio = "pagina" | "mural" | "contas" | "benfeitoria";

/** Apoio e transparência (só coordenação): a página de Apoie, o mural, as contas do mês e o texto para a Benfeitoria. */
export function Apoio() {
  const dados = useLista<Painel>("apoio_painel");
  const [aba, setAba] = useState<AbaDoApoio>("pagina");
  const d = dados.dados;
  if (!d) {
    return dados.erro ? (
      <Faixa
        tom="erro"
        acao={
          <Botao pequeno onClick={dados.recarregar}>
            Tentar de novo
          </Botao>
        }
      >
        {dados.erro}
      </Faixa>
    ) : (
      <Esqueleto forma="cartoes" linhas={4} rotulo="Carregando…" />
    );
  }
  return (
    <Abas<AbaDoApoio>
      rotulo="Apoio e transparência"
      valor={aba}
      aoMudar={setAba}
      opcoes={[
        { id: "pagina", nome: "Página de Apoie" },
        { id: "mural", nome: "Mural", conta: d.pedidos.length },
        { id: "contas", nome: "Contas do mês", conta: d.relatorios.filter((r) => r.proposta).length },
        { id: "benfeitoria", nome: "Texto para a Benfeitoria" },
      ]}
      painel={(id) =>
        id === "pagina" ? (
          <EditorDaPagina key={`${d.publicado_em}-${d.pode_desfazer}`} d={d} recarregar={dados.recarregar} />
        ) : id === "mural" ? (
          <Mural d={d} recarregar={dados.recarregar} />
        ) : id === "contas" ? (
          <ContasDoMes d={d} recarregar={dados.recarregar} />
        ) : (
          <TextoDaCampanha d={d} recarregar={dados.recarregar} />
        )
      }
    />
  );
}

function TextoConfirmavel({ titulo, ajuda, valor, mudar, linhas = 3 }: { titulo: string; ajuda: string; valor: Confirmavel; mudar: (v: Confirmavel) => void; linhas?: number }) {
  return (
    <Cartao as="div" variante={valor.confirmado ? "padrao" : "destaque"}>
      <div className="pn-secao">
        <div>
          <p className="font-semibold">
            {titulo}
            {!valor.confirmado && ACONFIRMAR}
          </p>
          <p className="pn-ajuda">{ajuda}</p>
        </div>
        <textarea value={valor.texto} onChange={(e) => mudar({ ...valor, texto: e.target.value })} rows={linhas} maxLength={1500} className="pn-campo" aria-label={titulo} />
        <Marca rotulo="Conferido: pode aparecer na página pública" checked={valor.confirmado} disabled={!valor.texto.trim()} onChange={(e) => mudar({ ...valor, confirmado: e.target.checked })} />
      </div>
    </Cartao>
  );
}

/** Uma linha que se repete (faixa, custo, pergunta): os campos e o "Tirar" alinhado embaixo. */
const BotaoTirar = ({ desligado, tirar }: { desligado?: boolean; tirar: () => void }) => (
  <Botao variante="discreto" pequeno simbolo={X} disabled={desligado} onClick={tirar}>
    Tirar
  </Botao>
);

/**
 * A página de Apoie no molde Configuração: os grupos em cartões e o rodapé preso que guarda o rascunho (ou descarta). A
 * publicação (com a prévia e o desfazer) fica num cartão à parte, no alto, porque é outro passo.
 */
function EditorDaPagina({ d, recarregar }: { d: Painel; recarregar: () => void }) {
  const [c, setC] = useState<ConfigDoApoio>(d.rascunho);
  const acao = useAcao(recarregar);
  const mudou = JSON.stringify(c) !== JSON.stringify(d.rascunho);
  const rascunhoDiferente = JSON.stringify(d.rascunho) !== JSON.stringify(d.publicado);
  const faixa = (i: number, f: Partial<FaixaDoApoio>) => setC({ ...c, faixas: c.faixas.map((x, j) => (j === i ? { ...x, ...f } : x)) });
  const custo = (i: number, f: Partial<Custo>) => setC({ ...c, custos: c.custos.map((x, j) => (j === i ? { ...x, ...f } : x)) });
  const num = (v: string) => (v === "" ? 0 : Number(v));
  const guardar = () => acao.agir("apoio_rascunho_salvar", { p: c }, "Rascunho guardado ✓ Veja a prévia antes de publicar.");
  return (
    <div className="pn-tela">
      <p className="pn-sobre">
        Tudo aqui vai primeiro para um rascunho. A página pública só muda quando você publica, e dá para desfazer a última publicação.
        {d.publicado_em ? ` Última publicação: ${dataHora(d.publicado_em)}.` : " A página mostra os valores iniciais da campanha."} Os textos ficam como você escrever, em todos os idiomas.
      </p>

      <Cartao as="div" variante={rascunhoDiferente ? "destaque" : "padrao"}>
        <div className="flex flex-wrap items-center gap-2">
          <a href="/pt/apoie?previa=1" target="_blank" rel="noopener" className="pn-botao">
            Ver a prévia
            <ExternalLink aria-hidden />
          </a>
          <Botao
            variante="principal"
            disabled={acao.ocupado || mudou || !rascunhoDiferente}
            title={mudou ? "Guarde o rascunho antes" : undefined}
            onClick={async () => {
              if (await confirmarFrase("Publicar o rascunho na página de Apoie?")) void acao.agir("apoio_publicar", {}, "Publicado ✓ A página de Apoie já mostra a versão nova.");
            }}
          >
            Publicar
          </Botao>
          {d.pode_desfazer && (
            <Botao
              variante="discreto"
              disabled={acao.ocupado}
              onClick={async () => {
                if (await confirmarFrase("Voltar a página ao que era antes da última publicação?")) void acao.agir("apoio_desfazer", {}, "Desfeito: a página voltou à versão anterior.");
              }}
            >
              Desfazer a última publicação
            </Botao>
          )}
        </div>
      </Cartao>
      <Recado texto={acao.aviso} />

      <MoldeConfiguracao
        sujo={mudou}
        salvando={acao.ocupado}
        rotuloSalvar="Guardar rascunho"
        aoSalvar={() => void guardar()}
        aoDescartar={() => setC(d.rascunho)}
        grupos={[
          {
            id: "campanha",
            titulo: "Campanha",
            campos: (
              <>
                <Campo rotulo="Link da campanha" value={c.link} onChange={(e) => setC({ ...c, link: e.target.value.trim() })} />
                <Marca rotulo="Informar os números da campanha (copiados da Benfeitoria, à mão)" checked={c.campanha !== null} onChange={(e) => setC({ ...c, campanha: e.target.checked ? { mensal: 0, apoiadores: 0, em: new Date().toISOString().slice(0, 10) } : null })} />
                {c.campanha && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Campo rotulo="Arrecadado por mês (R$)" type="number" min={0} step="0.01" value={c.campanha.mensal} onChange={(e) => setC({ ...c, campanha: { ...c.campanha!, mensal: num(e.target.value) } })} />
                    <Campo rotulo="Número de apoios" type="number" min={0} step={1} value={c.campanha.apoiadores} onChange={(e) => setC({ ...c, campanha: { ...c.campanha!, apoiadores: num(e.target.value) } })} />
                    <CampoData rotulo="Data da informação" valor={c.campanha.em} mudar={(v) => setC({ ...c, campanha: { ...c.campanha!, em: v } })} className="text-sm" />
                  </div>
                )}
                <p className="pn-ajuda">A página mostra a data e avisa que não é um número ao vivo. Sem números, as metas aparecem só com o valor a alcançar.</p>
              </>
            ),
          },
          {
            id: "faixas",
            titulo: "Faixas",
            sobre: "Sem descrição, vale o texto padrão: “Apoio solidário, sem benefício exclusivo. Se quiser, seu nome aparece no mural.” Nunca prometa benefício que não existe.",
            campos: (
              <>
                <ul className="space-y-2">
                  {c.faixas.map((f, i) => (
                    <li key={i} className="grid gap-2 sm:grid-cols-[7rem_10rem_1fr_auto] sm:items-end">
                      <Campo rotulo="R$ por mês" type="number" min={1} step="1" value={f.valor} onChange={(e) => faixa(i, { valor: num(e.target.value) })} />
                      <Campo rotulo="Nome" value={f.nome} onChange={(e) => faixa(i, { nome: e.target.value })} maxLength={40} />
                      <Campo rotulo="Descrição (opcional)" value={f.descricao} onChange={(e) => faixa(i, { descricao: e.target.value })} maxLength={200} />
                      <BotaoTirar desligado={c.faixas.length <= 1} tirar={() => setC({ ...c, faixas: c.faixas.filter((_, j) => j !== i) })} />
                    </li>
                  ))}
                </ul>
                {c.faixas.length < 8 && (
                  <div>
                    <Botao variante="discreto" pequeno simbolo={Plus} onClick={() => setC({ ...c, faixas: [...c.faixas, { valor: 10, nome: "", descricao: "" }] })}>
                      Faixa
                    </Botao>
                  </div>
                )}
              </>
            ),
          },
          {
            id: "metas",
            titulo: "Metas",
            campos: (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="pn-secao" style={{ alignContent: "start" }}>
                    <Campo rotulo="Meta 1 (R$ por mês)" type="number" min={1} value={c.metas.meta1.alvo} onChange={(e) => setC({ ...c, metas: { ...c.metas, meta1: { ...c.metas.meta1, alvo: num(e.target.value) } } })} />
                    <Campo rotulo="O que a Meta 1 cobre" value={c.metas.meta1.texto} onChange={(e) => setC({ ...c, metas: { ...c.metas, meta1: { ...c.metas.meta1, texto: e.target.value } } })} maxLength={140} />
                  </div>
                  <div className="pn-secao" style={{ alignContent: "start" }}>
                    <Marca rotulo="Meta 2" checked={c.metas.meta2 !== null} onChange={(e) => setC({ ...c, metas: { ...c.metas, meta2: e.target.checked ? { alvo: 1000, texto: "" } : null } })} />
                    {c.metas.meta2 && (
                      <>
                        <Campo rotulo="Meta 2 (R$ por mês)" type="number" min={1} value={c.metas.meta2.alvo} onChange={(e) => setC({ ...c, metas: { ...c.metas, meta2: { ...c.metas.meta2!, alvo: num(e.target.value) } } })} />
                        <Campo rotulo="O que a Meta 2 cobre" value={c.metas.meta2.texto} onChange={(e) => setC({ ...c, metas: { ...c.metas, meta2: { ...c.metas.meta2!, texto: e.target.value } } })} maxLength={140} />
                      </>
                    )}
                  </div>
                </div>
                <Marca rotulo="Meta do começo (por exemplo, “primeiros 10 apoios”)" checked={c.metas.intermediaria !== null} onChange={(e) => setC({ ...c, metas: { ...c.metas, intermediaria: e.target.checked ? { texto: "Primeiros 10 apoios", alvo: 10, unidade: "apoiadores" } : null } })} />
                {c.metas.intermediaria && (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Campo rotulo="Texto" value={c.metas.intermediaria.texto} onChange={(e) => setC({ ...c, metas: { ...c.metas, intermediaria: { ...c.metas.intermediaria!, texto: e.target.value } } })} maxLength={140} />
                    <Campo rotulo="Alvo" type="number" min={1} value={c.metas.intermediaria.alvo} onChange={(e) => setC({ ...c, metas: { ...c.metas, intermediaria: { ...c.metas.intermediaria!, alvo: num(e.target.value) } } })} />
                    <Selecao rotulo="Conta" value={c.metas.intermediaria.unidade} onChange={(e) => setC({ ...c, metas: { ...c.metas, intermediaria: { ...c.metas.intermediaria!, unidade: e.target.value as "apoiadores" | "reais" } } })}>
                      <option value="apoiadores">número de apoios</option>
                      <option value="reais">reais por mês</option>
                    </Selecao>
                  </div>
                )}
              </>
            ),
          },
          {
            id: "custos",
            titulo: "Custos recorrentes (“Para onde vai”)",
            sobre: "Valor mensal real. Sem nenhum custo aqui, a página mostra só a explicação de cada gasto, sem números.",
            campos: (
              <>
                <ul className="space-y-2">
                  {c.custos.map((x, i) => (
                    <li key={i} className="grid gap-2 sm:grid-cols-[1fr_8rem_auto_1fr_auto] sm:items-end">
                      <Campo rotulo="Categoria" value={x.categoria} onChange={(e) => custo(i, { categoria: e.target.value })} maxLength={60} />
                      <Campo rotulo="R$ por mês" type="number" min={0} step="0.01" value={x.valor ?? ""} onChange={(e) => custo(i, { valor: e.target.value === "" ? null : Number(e.target.value) })} />
                      <div className="sm:pb-2">
                        <Marca rotulo="parte em dólar" checked={x.dolar} onChange={(e) => custo(i, { dolar: e.target.checked })} />
                      </div>
                      <Campo rotulo="Explicação (opcional)" value={x.descricao} onChange={(e) => custo(i, { descricao: e.target.value })} maxLength={200} />
                      <BotaoTirar tirar={() => setC({ ...c, custos: c.custos.filter((_, j) => j !== i) })} />
                    </li>
                  ))}
                </ul>
                {c.custos.length < 20 && (
                  <div>
                    <Botao variante="discreto" pequeno simbolo={Plus} onClick={() => setC({ ...c, custos: [...c.custos, { categoria: "", valor: null, dolar: false, descricao: "" }] })}>
                      Custo
                    </Botao>
                  </div>
                )}
              </>
            ),
          },
          {
            id: "confirmaveis",
            titulo: "Responsável, taxa e cancelamento",
            campos: (
              <div className="grid gap-3 lg:grid-cols-3">
                <TextoConfirmavel titulo="Quem é responsável" ajuda="Nome e papel exatamente como constam na campanha, e como o dinheiro é administrado." valor={c.responsavel} mudar={(v) => setC({ ...c, responsavel: v })} linhas={5} />
                <TextoConfirmavel titulo="Taxa da plataforma" ajuda="Quanto do apoio chega ao projeto. Só aparece (nas perguntas) depois de conferido." valor={c.taxa} mudar={(v) => setC({ ...c, taxa: v })} />
                <TextoConfirmavel titulo="Como cancelar, passo a passo" ajuda="O caminho dentro da Benfeitoria. Até ser conferido, a página diz só que o cancelamento é feito lá." valor={c.cancelamento} mudar={(v) => setC({ ...c, cancelamento: v })} />
              </div>
            ),
          },
          {
            id: "perguntas",
            titulo: "Perguntas a mais",
            sobre: "As perguntas padrão já estão na página (traduzidas). Aqui entram as que a coordenação quiser acrescentar.",
            campos: (
              <>
                <ul className="space-y-2">
                  {c.faq.map((x, i) => (
                    <li key={i} className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                      <Campo rotulo="Pergunta" value={x.p} onChange={(e) => setC({ ...c, faq: c.faq.map((y, j) => (j === i ? { ...y, p: e.target.value } : y)) })} maxLength={200} />
                      <Area rotulo="Resposta" value={x.r} onChange={(e) => setC({ ...c, faq: c.faq.map((y, j) => (j === i ? { ...y, r: e.target.value } : y)) })} rows={2} maxLength={1500} />
                      <BotaoTirar tirar={() => setC({ ...c, faq: c.faq.filter((_, j) => j !== i) })} />
                    </li>
                  ))}
                </ul>
                {c.faq.length < 20 && (
                  <div>
                    <Botao variante="discreto" pequeno simbolo={Plus} onClick={() => setC({ ...c, faq: [...c.faq, { p: "", r: "" }] })}>
                      Pergunta
                    </Botao>
                  </div>
                )}
              </>
            ),
          },
        ]}
      />
    </div>
  );
}

function Mural({ d, recarregar }: { d: Painel; recarregar: () => void }) {
  const acao = useAcao(recarregar);
  const [novo, setNovo] = useState({ nome: "", mensagem: "", consentimento: "" });
  return (
    <div className="pn-tela">
      <Recado texto={acao.aviso} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="pn-secao" style={{ alignContent: "start" }}>
          <Cartao titulo="Pedidos para aparecer" nivelDoTitulo={3} sobre="Confira o nome na lista de apoiadores da Benfeitoria antes de aprovar. Nada além do nome e da mensagem é guardado.">
            {d.pedidos.length === 0 ? (
              <Vazio titulo="Nenhum pedido esperando." />
            ) : (
              <Lista rotulo="Pedidos para aparecer" plana>
                {d.pedidos.map((x) => (
                  <ItemDeLista
                    key={x.id}
                    titulo={<strong>{x.nome}</strong>}
                    meta={
                      <>
                        {x.mensagem && <span className="italic">“{x.mensagem}” · </span>}
                        pedido em {dataHora(x.criado_em)}
                      </>
                    }
                    acoes={
                      <>
                        <Botao pequeno variante="principal" disabled={acao.ocupado} onClick={() => void acao.agir("apoio_mural_decidir", { p_id: x.id, p_aprovar: true }, "Aprovado: o nome está no mural ✓")}>
                          Aprovar
                        </Botao>
                        <Botao pequeno disabled={acao.ocupado} onClick={() => void acao.agir("apoio_mural_decidir", { p_id: x.id, p_aprovar: false }, "Recusado.")}>
                          Recusar
                        </Botao>
                      </>
                    }
                  />
                ))}
              </Lista>
            )}
          </Cartao>
          <Cartao titulo="Acrescentar um nome" nivelDoTitulo={3}>
            <div className="pn-secao">
              <Campo rotulo="Nome" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Nome ou apelido" maxLength={80} />
              <Campo rotulo="Mensagem" value={novo.mensagem} onChange={(e) => setNovo({ ...novo, mensagem: e.target.value })} placeholder="Mensagem (opcional)" maxLength={200} />
              <Campo rotulo="Consentimento" value={novo.consentimento} onChange={(e) => setNovo({ ...novo, consentimento: e.target.value })} placeholder="Como a pessoa autorizou (ex.: mensagem no Instagram em 12/10)" maxLength={200} />
              <div>
                <Botao
                  disabled={acao.ocupado || novo.nome.trim().length < 2 || novo.consentimento.trim().length < 5}
                  onClick={async () => {
                    if (await acao.agir("apoio_mural_adicionar", { p_nome: novo.nome, p_mensagem: novo.mensagem, p_consentimento: novo.consentimento }, "Nome acrescentado ✓")) setNovo({ nome: "", mensagem: "", consentimento: "" });
                  }}
                >
                  Acrescentar
                </Botao>
              </div>
            </div>
          </Cartao>
        </div>
        <Cartao titulo="No mural" nivelDoTitulo={3} sobre="Esconder tira da página sem apagar. Retirar apaga de vez (quando a pessoa pede).">
          {d.mural.length === 0 ? (
            <Vazio titulo="O mural ainda não tem nomes: a página mostra “Quem já ajuda sem dinheiro”." />
          ) : (
            <Lista rotulo="No mural" plana>
              {d.mural.map((x) => (
                <ItemDeLista
                  key={x.id}
                  titulo={
                    <>
                      <strong className={x.visivel ? "" : "text-ink-soft line-through"}>{x.nome}</strong>
                      {x.mensagem && <span className="text-ink-soft"> · “{x.mensagem}”</span>}
                    </>
                  }
                  meta={x.consentimento}
                  acoes={
                    <>
                      <Botao pequeno variante="discreto" disabled={acao.ocupado} onClick={() => void acao.agir("apoio_mural_visivel", { p_id: x.id, p_visivel: !x.visivel }, x.visivel ? "Escondido do mural." : "De volta ao mural.")}>
                        {x.visivel ? "Esconder" : "Mostrar"}
                      </Botao>
                      <Botao
                        pequeno
                        variante="discreto"
                        perigo
                        disabled={acao.ocupado}
                        onClick={async () => {
                          if (await confirmarFrase(`Retirar ${x.nome} do mural de vez?`)) void acao.agir("apoiador_remover", { p_id: x.id }, "Nome retirado.");
                        }}
                      >
                        Retirar
                      </Botao>
                    </>
                  }
                />
              ))}
            </Lista>
          )}
        </Cartao>
      </div>
    </div>
  );
}

const mesAtual = () => {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}`;
};
const mesPassado = () => {
  const h = new Date();
  h.setDate(1);
  h.setMonth(h.getMonth() - 1);
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}`;
};

function ContasDoMes({ d, recarregar }: { d: Painel; recarregar: () => void }) {
  const acao = useAcao(recarregar);
  const vazio = { id: "", mes: mesPassado(), tipo: "saida" as "entrada" | "saida", categoria: "", valor: "", descricao: "", comprovante: "" };
  const [l, setL] = useState(vazio);
  const [pedido, setPedido] = useState({ mes: mesPassado(), nota: "", motivo: "" });
  const meses = [...new Set(d.lancamentos.map((x) => x.mes.slice(0, 7)))];
  const jaPublicado = d.relatorios.some((r) => r.mes.slice(0, 7) === pedido.mes && r.publicado_em);
  const segunda = d.regras.segunda_pessoa;
  return (
    <div className="pn-tela">
      <Recado texto={acao.aviso} />
      <Cartao titulo={l.id ? "Corrigir lançamento" : "Novo lançamento"} nivelDoTitulo={3} variante={l.id ? "destaque" : "padrao"}>
        <div className="pn-secao">
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo rotulo="Mês" type="month" max={mesAtual()} value={l.mes} onChange={(e) => setL({ ...l, mes: e.target.value })} />
            <Selecao rotulo="Tipo" value={l.tipo} onChange={(e) => setL({ ...l, tipo: e.target.value as "entrada" | "saida" })}>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </Selecao>
            <Campo rotulo="Valor (R$)" type="number" min={0.01} step="0.01" value={l.valor} onChange={(e) => setL({ ...l, valor: e.target.value })} />
            <Campo rotulo="Categoria" value={l.categoria} onChange={(e) => setL({ ...l, categoria: e.target.value })} list="apoio-categorias" maxLength={60} placeholder={l.tipo === "entrada" ? "Benfeitoria" : "Hospedagem"} />
            <div className="sm:col-span-2">
              <Campo rotulo="Descrição (sai no relatório só como total da categoria)" value={l.descricao} onChange={(e) => setL({ ...l, descricao: e.target.value })} maxLength={300} />
            </div>
            <div className="sm:col-span-3">
              <Campo rotulo="Onde está o comprovante (fica só no painel)" value={l.comprovante} onChange={(e) => setL({ ...l, comprovante: e.target.value })} maxLength={300} placeholder="Ex.: pasta Financeiro/2026-09/fatura-hospedagem.pdf" />
            </div>
          </div>
          <datalist id="apoio-categorias">
            {[...new Set(d.lancamentos.map((x) => x.categoria))].map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
          <p className="flex gap-2">
            <Botao
              variante="principal"
              disabled={acao.ocupado || l.categoria.trim().length < 2 || !(Number(l.valor) > 0)}
              onClick={async () => {
                if (await acao.agir("apoio_lancamento_salvar", { p: { ...l, id: l.id || null, valor: Number(l.valor) } }, "Lançamento guardado ✓")) setL({ ...vazio, mes: l.mes, tipo: l.tipo });
              }}
            >
              {l.id ? "Guardar a correção" : "Lançar"}
            </Botao>
            {l.id && (
              <Botao variante="discreto" onClick={() => setL(vazio)}>
                Cancelar
              </Botao>
            )}
          </p>
        </div>
      </Cartao>

      <Cartao titulo="Lançamentos" nivelDoTitulo={3}>
        {meses.length === 0 && <Vazio titulo="Nenhum lançamento ainda." />}
        <div className="pn-secao">
          {meses.map((m) => {
            const doMes = d.lancamentos.filter((x) => x.mes.startsWith(m));
            const saldo = doMes.reduce((s, x) => s + (x.tipo === "entrada" ? 1 : -1) * Number(x.valor), 0);
            return (
              <details key={m} open={m === meses[0]}>
                <summary className="cursor-pointer font-semibold capitalize">
                  {nomeDoMes(m)} · saldo <span className="tabular-nums">{reais(saldo)}</span>
                </summary>
                <Lista rotulo={nomeDoMes(m)} plana className="mt-2">
                  {doMes.map((x) => (
                    <ItemDeLista
                      key={x.id}
                      simbolo={x.tipo === "entrada" ? ArrowDownRight : ArrowUpRight}
                      titulo={
                        <>
                          {x.categoria}
                          {x.descricao && <span className="text-ink-soft"> · {x.descricao}</span>}
                        </>
                      }
                      meta={x.comprovante ? `comprovante: ${x.comprovante}` : undefined}
                      selo={
                        <span className="flex items-center gap-2">
                          <Selo tom={x.tipo === "entrada" ? "ok" : "neutro"}>{x.tipo === "entrada" ? "entrada" : "saída"}</Selo>
                          <span className="tabular-nums">{reais(Number(x.valor))}</span>
                        </span>
                      }
                      acoes={
                        <>
                          <Botao pequeno variante="discreto" onClick={() => setL({ ...x, mes: x.mes.slice(0, 7), valor: String(x.valor) })}>
                            Corrigir
                          </Botao>
                          <Botao
                            pequeno
                            variante="discreto"
                            perigo
                            disabled={acao.ocupado}
                            onClick={async () => {
                              if (await confirmarFrase("Apagar este lançamento?")) void acao.agir("apoio_lancamento_remover", { p_id: x.id }, "Lançamento apagado.");
                            }}
                          >
                            Apagar
                          </Botao>
                        </>
                      }
                    />
                  ))}
                </Lista>
              </details>
            );
          })}
        </div>
      </Cartao>

      <Cartao
        titulo="Publicar o relatório do mês"
        nivelDoTitulo={3}
        sobre={`O relatório soma os lançamentos do mês por categoria. ${segunda ? "Outra pessoa da coordenação confirma antes de sair (regra ligada)." : "Sai na hora (a regra da segunda pessoa está desligada)."} Correção de relatório já publicado guarda a versão anterior, que fica visível na prestação de contas.`}
      >
        <div className="pn-secao">
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo rotulo="Mês" type="month" max={mesPassado()} value={pedido.mes} onChange={(e) => setPedido({ ...pedido, mes: e.target.value })} />
            <div className="sm:col-span-2">
              <Campo rotulo="Nota da coordenação (pública)" value={pedido.nota} onChange={(e) => setPedido({ ...pedido, nota: e.target.value })} maxLength={2000} />
            </div>
            {jaPublicado && (
              <div className="sm:col-span-3">
                <Campo rotulo="Motivo da correção (público, obrigatório)" value={pedido.motivo} onChange={(e) => setPedido({ ...pedido, motivo: e.target.value })} maxLength={300} />
              </div>
            )}
          </div>
          <div>
            <Botao disabled={acao.ocupado || (jaPublicado && pedido.motivo.trim().length < 5)} onClick={() => void acao.agir("apoio_relatorio_pedir", { p_mes: pedido.mes, p_nota: pedido.nota, p_motivo: pedido.motivo }, segunda ? "Pedido feito: outra pessoa da coordenação recebeu o aviso para confirmar." : "Relatório publicado ✓")}>
              {jaPublicado ? "Pedir a correção" : "Pedir a publicação"}
            </Botao>
          </div>
          <label className="pn-marca">
            <input type="checkbox" checked={segunda} disabled={acao.ocupado} onChange={(e) => void acao.agir("apoio_regras_salvar", { p: { segunda_pessoa: e.target.checked } }, "Regra guardada ✓")} />
            <span>
              Exigir a confirmação de uma segunda pessoa da coordenação{" "}
              {d.coordenacao < 2 && (
                <Selo tom="aviso" ponto>
                  (hoje a coordenação tem {d.coordenacao} pessoa)
                </Selo>
              )}
            </span>
          </label>
        </div>
      </Cartao>

      <Cartao
        titulo="Relatórios"
        nivelDoTitulo={3}
        acoes={
          <a href="/pt/apoie/contas" target="_blank" rel="noopener" className="pn-elo inline-flex items-center gap-1 text-sm">
            Ver a prestação de contas pública
            <ExternalLink aria-hidden className="h-3.5 w-3.5" />
          </a>
        }
      >
        {d.relatorios.length === 0 && <Vazio titulo="Nenhum relatório ainda." />}
        <div className="pn-secao">
          {d.relatorios.map((r) => (
            <Cartao key={r.id} as="article" variante={r.proposta ? "destaque" : "plano"}>
              <div className="pn-secao">
                <p className="flex flex-wrap items-center gap-2 font-semibold capitalize">
                  {nomeDoMes(r.mes)}
                  {r.publicado_em ? (
                    <Selo tom="ok" ponto>
                      publicado em {dataHora(r.publicado_em)}
                    </Selo>
                  ) : (
                    <Selo tom="ouro">ainda não publicado</Selo>
                  )}
                </p>
                {r.publicado_em && (
                  <p className="text-sm tabular-nums">
                    Entradas {reais(Number(r.dados.total_entradas))} · saídas {reais(Number(r.dados.total_saidas))} · saldo {reais(Number(r.dados.saldo))}
                    {r.historico && r.historico.length > 0 ? ` · ${r.historico.length} correção(ões)` : ""}
                  </p>
                )}
                {r.proposta && (
                  <div className="pn-secao border-t border-rule pt-2 text-sm">
                    <p className="pn-rotulo-mono">
                      {r.publicado_em ? "Correção esperando confirmação" : "Esperando confirmação"} · pedido por {r.pedido_nome ?? "alguém"}
                    </p>
                    <p className="tabular-nums">
                      Entradas {reais(Number(r.proposta.dados.total_entradas))} · saídas {reais(Number(r.proposta.dados.total_saidas))} · saldo {reais(Number(r.proposta.dados.saldo))}
                    </p>
                    {r.proposta.nota && <p className="text-ink-soft">Nota: {r.proposta.nota}</p>}
                    {r.proposta.motivo && <p className="text-ink-soft">Motivo: {r.proposta.motivo}</p>}
                    <p className="flex gap-2">
                      <Botao
                        disabled={acao.ocupado || (segunda && r.pedido_por === d.eu)}
                        title={segunda && r.pedido_por === d.eu ? "Quem pediu não confirma o próprio relatório" : undefined}
                        onClick={() => void acao.agir("apoio_relatorio_confirmar", { p_id: r.id }, "Confirmado e publicado ✓")}
                      >
                        Confirmar e publicar
                      </Botao>
                      <Botao variante="discreto" disabled={acao.ocupado} onClick={() => void acao.agir("apoio_relatorio_descartar", { p_id: r.id }, "Pedido descartado.")}>
                        Descartar o pedido
                      </Botao>
                    </p>
                  </div>
                )}
              </div>
            </Cartao>
          ))}
        </div>
      </Cartao>
    </div>
  );
}

function TextoDaCampanha({ d, recarregar }: { d: Painel; recarregar: () => void }) {
  const acao = useAcao(recarregar);
  const [numeros, setNumeros] = useState<NumerosDoSite | null>(null);
  const [copiado, setCopiado] = useState("");
  useEffect(() => {
    let vivo = true;
    fetch("/pt/apoio-numeros.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((n: NumerosDoSite | null) => vivo && setNumeros(n))
      .catch(() => null);
    return () => {
      vivo = false;
    };
  }, []);
  if (!numeros) return <Esqueleto linhas={4} rotulo="Lendo os números do site…" />;
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
    <div className="pn-tela">
      <p className="pn-sobre">O painel não mexe na Benfeitoria: ele monta o texto com os números reais do site e do último relatório, e você cola lá.</p>
      {velho && <Faixa tom="aviso">Os números mudaram desde a última cópia ({dataHora(d.texto!.em)}): o texto colado na campanha pode estar desatualizado.</Faixa>}
      {!d.texto && <p className="pn-ajuda">Nenhum texto foi copiado ainda.</p>}
      {(["descricao", "atualizacao"] as const).map((qual) => (
        <Cartao
          key={qual}
          titulo={qual === "descricao" ? "Descrição da campanha" : "Atualização do mês"}
          nivelDoTitulo={3}
          acoes={
            <Botao simbolo={Copy} onClick={() => void copiar(qual)}>
              {copiado === qual ? "Copiado ✓" : "Copiar"}
            </Botao>
          }
        >
          <textarea readOnly value={textos[qual]} rows={qual === "descricao" ? 10 : 7} className="pn-campo w-full" aria-label={qual === "descricao" ? "Descrição da campanha" : "Atualização do mês"} />
        </Cartao>
      ))}
      <Recado texto={acao.aviso} />
    </div>
  );
}

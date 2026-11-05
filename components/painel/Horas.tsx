// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Award, Ban, Check, ChevronDown, ChevronUp, Clock, Eye, FilePlus, FileSignature, ListChecks, MessageSquareReply, PenLine, Plus, Save, Scale, Send, Stamp, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { can, leads, type Me, rpc } from "@/lib/backend";
import { TERMO_ADESAO, textoDoTermo } from "@/lib/termos";
import { BuscaDePessoa } from "./BuscaDePessoa";
import { type Certificado, Folha, Impresso } from "./Certificado";
import { Aviso, data, dataHora, dia, PAINEL_MUDOU, useAcao, useLista } from "./comum";
import { Abas, Area, Botao, CabecalhoDeSecao, Campo, Cartao, type ColumnDef, confirmar, Esqueleto, Estatistica, Estatisticas, Faixa, ItemDeLista, Lista, Selecao, Selo, Tabela, type TomDoSelo, Vazio } from "./ui";

export const VERSAO_DO_TERMO = TERMO_ADESAO.versao;
export const TERMO: string[] = TERMO_ADESAO.clausulas;

interface Termo {
  nome_completo: string;
  versao: string;
  aceito_em: string;
  /** O aceite é de antes de o texto ser guardado: pede o aceite de novo para o texto ficar guardado. */
  sem_texto?: boolean;
}

interface Hora {
  id: string;
  dia: string;
  horas: number;
  atividade: string;
  status: "pendente" | "confirmada" | "recusada";
  origem: "manual" | "plataforma";
  certificado: boolean;
}

interface Pedido {
  id: string;
  inicio: string;
  fim: string;
  mensagem: string;
  status: "pendente" | "atendido" | "recusado" | "cancelado";
  nota: string;
  criado_em: string;
  decidido_em: string | null;
}

interface Minhas {
  confirmadas: number;
  /** Confirmadas e ainda fora de certificado. */
  livres: number;
  /** Das livres, as que a plataforma contou. */
  plataforma: number;
  pendentes: number;
  primeiro_livre: string | null;
  lista: Hora[];
  pedido: Pedido | null;
}

interface PedidoDaFila extends Pedido {
  usuario: string;
  nome: string;
  nome_completo: string | null;
  livres: number;
  pendentes: number;
  resumo: string;
  horas: Omit<Hora, "certificado">[];
}

interface Peso {
  chave: string;
  nome: string;
  padrao: number;
  horas: number;
}

interface HoraDaFila {
  id: string;
  usuario: string;
  nome: string;
  dia: string;
  horas: number;
  atividade: string;
}

interface Pessoa {
  id: string;
  nome: string;
  email: string;
  papeis: { papel: string; disciplina?: string | null }[];
}

/** O que o coordenador leva de um pedido para o formulário de abertura. "vez" refaz o formulário a cada pedido escolhido. */
interface Preenchido {
  usuario: string;
  nome: string;
  inicio: string;
  fim: string;
  atividades: string;
  vez: number;
}

const situacao: Record<string, string> = { pendente: "aguardando conferência", confirmada: "confirmada", recusada: "não confirmada", aberto: "aguardando assinaturas", emitido: "emitido", cancelado: "cancelado" };
/** Como cada linha de horas aparece: as que a plataforma contou dizem isso, em vez de "confirmada". */
const estadoDa = (hora: Pick<Hora, "status" | "origem">) =>
  hora.origem === "plataforma" ? (hora.status === "recusada" ? "desconsiderada pela coordenação" : "contada pela plataforma") : situacao[hora.status];
/** O que a pessoa declara ao assinar. A assinatura fica presa à conta dela, com data e hora. */
const DECLARACAO = "Ao assinar, você declara que acompanhou este trabalho e confirma o período, as horas e as atividades descritas. A assinatura fica registrada com a sua conta, a data e a hora, e não pode ser desfeita. Assinar?";
const horasPt = (valor: number) => `${String(valor).replace(".", ",")} h`;
const hojeAqui = () => new Date().toLocaleDateString("sv-SE");

type AbaDeHoras = "minhas" | "certificado" | "certificados" | "pedidos" | "conferir" | "abrir" | "valores" | "termo";

export function Horas({ me }: { me: Me }) {
  const termo = useLista<Termo | null>("termo_meu");
  const minhas = useLista<Minhas>("horas_minhas");
  const certificados = useLista<Certificado[]>("certificados_listar");
  const acao = useAcao(() => {
    termo.recarregar();
    minhas.recarregar();
    certificados.recarregar();
  });
  const [nome, setNome] = useState("");
  const [nova, setNova] = useState({ dia: hojeAqui(), horas: "1", atividade: "" });
  const [ver, setVer] = useState<Certificado | null>(null);
  const [preenchido, setPreenchido] = useState<Preenchido | null>(null);
  const coordena = can(me, "coordenacao");
  const [aba, setAba] = useState<AbaDeHoras>(coordena ? "pedidos" : "minhas");

  if (ver) return <Impresso certificado={ver} fechar={() => setVer(null)} />;

  const aceito = termo.dados?.versao === VERSAO_DO_TERMO && !termo.dados?.sem_texto;
  const antigo = Boolean(termo.dados) && !aceito;
  const m = minhas.dados;
  const assinar = (certificados.dados ?? []).filter((c) => c.status === "aberto" && c.testemunhas.some((a) => a.id === me.id && !a.confirmou_em && a.papel !== "coordenacao")).length;
  const prepararCertificado = (pedido: PedidoDaFila) => {
    setPreenchido({ usuario: pedido.usuario, nome: pedido.nome_completo || pedido.nome, inicio: pedido.inicio, fim: pedido.fim, atividades: pedido.resumo, vez: Date.now() });
    setAba("abrir");
  };

  const opcoes: { id: AbaDeHoras; nome: string; conta?: number }[] = [
    ...(aceito ? [{ id: "minhas" as const, nome: "Minhas horas" }, { id: "certificado" as const, nome: "Pedir certificado" }] : []),
    { id: "certificados", nome: "Certificados", conta: assinar },
    ...(coordena ? [{ id: "pedidos" as const, nome: "Pedidos" }, { id: "conferir" as const, nome: "Horas para conferir" }] : []),
    ...(leads(me) ? [{ id: "abrir" as const, nome: "Abrir certificado" }] : []),
    ...(aceito || leads(me) ? [{ id: "valores" as const, nome: "Quanto vale cada trabalho" }] : []),
    { id: "termo", nome: "Termo de adesão" },
  ];
  const atual: AbaDeHoras = opcoes.some((opcao) => opcao.id === aba) ? aba : aceito ? "minhas" : "termo";

  // O histórico das minhas horas, em tabela (ordem por coluna; a busca não faz falta aqui).
  const colunasDoHistorico: ColumnDef<Hora>[] = [
    { id: "dia", header: "Dia", accessorFn: (h) => h.dia, cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{dia(row.original.dia)}</span> },
    { id: "horas", header: "Horas", accessorFn: (h) => Number(h.horas), cell: ({ row }) => <span className="whitespace-nowrap font-mono tabular-nums">{horasPt(Number(row.original.horas))}</span> },
    { id: "atividade", header: "O que você fez", accessorFn: (h) => h.atividade },
    {
      id: "situacao",
      header: "Situação",
      accessorFn: (h) => estadoDa(h),
      cell: ({ row: { original: hora } }) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <Selo tom={tomDa(hora)} ponto>
            {estadoDa(hora)}
          </Selo>
          {hora.certificado && <Selo tom="ouro">em certificado</Selo>}
          {hora.status === "pendente" && (
            <Botao variante="discreto" pequeno perigo simbolo={Trash2} onClick={() => acao.agir("horas_remover", { p_id: hora.id }, "Registro apagado.")}>
              apagar
            </Botao>
          )}
        </span>
      ),
    },
  ];

  return (
    <div className="pn-tela">
      {!aceito && (
        <Cartao variante="destaque" className="max-w-3xl">
          <CabecalhoDeSecao
            rotulo="Primeiro passo"
            simbolo={FileSignature}
            titulo={termo.dados?.sem_texto && termo.dados.versao === VERSAO_DO_TERMO ? "Leia e aceite de novo, para o texto ficar guardado" : antigo ? "O termo mudou: aceite de novo" : "Aceite o termo de adesão"}
          />
          <p className="mt-2 text-ink-soft">
            {termo.dados?.sem_texto && termo.dados.versao === VERSAO_DO_TERMO
              ? "O seu aceite é de antes de o painel guardar o texto que você leu. Leia de novo e aceite: assim o texto exato fica registrado para sempre, em Minha conta. As horas que você já tem continuam valendo."
              : antigo
                ? "O termo ganhou cláusulas que deixam claro o voluntariado: sem pagamento nem promessa de compensação, sem horário nem subordinação, licença livre e irrevogável do que você publica e as leis do Brasil. As horas que você já tem continuam valendo."
                : "As horas só começam a contar depois do aceite. É ele que transforma o seu trabalho em horas de voluntariado (Lei nº 9.608/1998)."}{" "}
            Leia o termo na aba <strong>Termo de adesão</strong> e confirme aqui.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-60 flex-1">
              <Campo rotulo="Seu nome completo, como deve sair no certificado" value={nome || (antigo ? (termo.dados?.nome_completo ?? "") : "")} onChange={(e) => setNome(e.target.value)} maxLength={120} autoComplete="name" />
            </div>
            <Botao
              variante="principal"
              simbolo={Check}
              disabled={(nome || termo.dados?.nome_completo || "").trim().length < 5}
              carregando={acao.ocupado}
              onClick={async () => {
                const completo = nome || termo.dados?.nome_completo || "";
                // O texto exato do termo fica guardado para sempre (interno.termos_aceites), junto com o nome completo.
                await rpc("termo_registrar", { p_termo: "adesao", p_versao: VERSAO_DO_TERMO, p_texto: textoDoTermo(TERMO_ADESAO, [`Nome completo: ${completo}`]), p_dados: { nome_completo: completo } }).catch(() => null);
                await acao.agir("termo_aceitar", { p_nome_completo: completo, p_versao: VERSAO_DO_TERMO }, "Aceite registrado.");
              }}
            >
              Li e aceito o termo
            </Botao>
          </div>
        </Cartao>
      )}

      <Abas rotulo="Horas e certificados" opcoes={opcoes} valor={atual} aoMudar={setAba} />

      {atual === "minhas" && !m && !minhas.erro && <Esqueleto forma="cartoes" linhas={3} />}
      {atual === "minhas" && m && (
        <section className="space-y-6">
          <Estatisticas rotulo="Minhas horas" className="max-w-3xl">
            <Estatistica rotulo="Prontas para certificado" valor={horasPt(Number(m.livres))} detalhe="já confirmadas e ainda fora de certificado" tom={Number(m.livres) > 0 ? "ok" : "neutro"} />
            <Estatistica rotulo="Contadas pela plataforma" valor={horasPt(Number(m.plataforma))} detalhe="das prontas, as que o painel contou sozinho" />
            <Estatistica rotulo="Esperando conferência" valor={horasPt(Number(m.pendentes))} detalhe="registradas à mão; a coordenação confere" tom={Number(m.pendentes) > 0 ? "aviso" : "neutro"} />
          </Estatisticas>

          <Cartao variante="plano" className="max-w-3xl" titulo="Como as horas são contadas" nivelDoTitulo={3}>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Você termina um trabalho no painel (uma aula aprovada, um parecer, um reforço respondido…).</li>
              <li>
                A plataforma soma sozinha as horas que esse tipo de trabalho vale, no dia em que ele terminou. Veja os valores em{" "}
                <button type="button" className="pn-elo" onClick={() => setAba("valores")}>
                  Quanto vale cada trabalho
                </button>
                .
              </li>
              <li>O que você faz fora do painel (uma reunião, uma gravação feita em casa), registre logo abaixo: conta depois que a coordenação conferir.</li>
              <li>
                Quando quiser, peça o certificado de um período em{" "}
                <button type="button" className="pn-elo" onClick={() => setAba("certificado")}>
                  Pedir certificado
                </button>
                .
              </li>
            </ol>
            <p className="mt-2 text-ink-soft">
              Cada trabalho conta uma vez e nenhum dia passa de 12 horas somando tudo. Confirmadas desde o começo: <strong className="text-ink">{horasPt(Number(m.confirmadas))}</strong>.
            </p>
          </Cartao>

          <Cartao className="max-w-3xl" titulo="Registrar horas feitas fora do painel" nivelDoTitulo={3}>
            <form
              className="mt-3 grid gap-3 sm:grid-cols-[auto_auto_1fr_auto] sm:items-end"
              onSubmit={async (e) => {
                e.preventDefault();
                if (await acao.agir("horas_registrar", { p_dia: nova.dia, p_horas: Number(nova.horas.replace(",", ".")), p_atividade: nova.atividade }, "Horas registradas. Elas contam depois de conferidas.")) setNova({ ...nova, atividade: "" });
              }}
            >
              <Campo rotulo="Dia" type="date" value={nova.dia} max={hojeAqui()} onChange={(e) => setNova({ ...nova, dia: e.target.value })} required />
              <Campo rotulo="Horas" value={nova.horas} onChange={(e) => setNova({ ...nova, horas: e.target.value })} inputMode="decimal" required maxLength={4} className="w-24" />
              <Campo rotulo="O que você fez" value={nova.atividade} onChange={(e) => setNova({ ...nova, atividade: e.target.value })} required minLength={5} maxLength={300} />
              <Botao type="submit" simbolo={Plus} carregando={acao.ocupado}>
                Registrar
              </Botao>
            </form>
          </Cartao>

          <section aria-labelledby="horas-historico" className="space-y-3">
            <CabecalhoDeSecao id="horas-historico" titulo="Histórico" simbolo={Clock} />
            <Tabela dados={m.lista} colunas={colunasDoHistorico} legenda="Histórico das minhas horas" porPagina={25} densa vazio={<Vazio simbolo={Clock} titulo="Nenhuma hora ainda. Assim que um trabalho seu for aprovado ou concluído no painel, ele aparece aqui." />} />
          </section>
        </section>
      )}

      {atual === "certificado" && m && <PedirCertificado minhas={m} depois={minhas.recarregar} />}

      {atual === "certificados" && (
        <section className="space-y-4">
          <Faixa tom="info">
            Todo certificado leva três assinaturas eletrônicas (um educador, a coordenação pedagógica e, por último, o coordenador) e um código que qualquer pessoa confere na página Conferir certificado. A aceitação como horas complementares depende de cada faculdade: pergunte na coordenação do seu curso antes de contar com ele.
          </Faixa>
          {!certificados.dados && !certificados.erro && <Esqueleto forma="cartoes" linhas={2} />}
          {certificados.dados?.length === 0 && <Vazio simbolo={Award} titulo="Nenhum certificado ainda." />}
          <ul className="space-y-4">
            {certificados.dados?.map((certificado) => {
              const minha = certificado.testemunhas.find((assinatura) => assinatura.id === me.id && !assinatura.confirmou_em && assinatura.papel !== "coordenacao");
              const faltam = certificado.testemunhas.filter((assinatura) => assinatura.papel !== "coordenacao" && !assinatura.confirmou_em).length;
              return (
                <li key={certificado.id}>
                  <Cartao
                    as="article"
                    variante={minha && certificado.status === "aberto" ? "destaque" : "padrao"}
                    titulo={certificado.nome}
                    nivelDoTitulo={3}
                    acoes={
                      <Selo tom={certificado.status === "emitido" ? "ok" : certificado.status === "cancelado" ? "neutro" : "aviso"} ponto>
                        {situacao[certificado.status]}
                      </Selo>
                    }
                  >
                    <p className="pn-rotulo-mono mt-1">
                      {dia(certificado.inicio)} a {dia(certificado.fim)} · {horasPt(Number(certificado.horas))}
                    </p>
                    <p className="mt-2 whitespace-pre-line" data-original>
                      {certificado.atividades}
                    </p>
                    {certificado.testemunhas.length > 0 && (
                      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
                        <span className="text-ink-soft">Assinaturas:</span>
                        {certificado.testemunhas.map((assinatura) => (
                          <Selo key={`${assinatura.id}${assinatura.papel ?? ""}`} tom={assinatura.confirmou_em ? "ok" : "neutro"}>
                            {assinatura.nome} ({assinatura.confirmou_em ? "assinou" : "falta assinar"})
                          </Selo>
                        ))}
                      </p>
                    )}
                    <p className="mt-3 flex flex-wrap gap-2">
                      {minha && certificado.status === "aberto" && (
                        <Botao
                          variante="principal"
                          simbolo={PenLine}
                          carregando={acao.ocupado}
                          onClick={async () => {
                            if (await confirmar({ titulo: "Assinar este certificado?", texto: DECLARACAO.replace(" Assinar?", ""), confirmar: "Assinar" })) void acao.agir("certificado_testemunhar", { p_id: certificado.id }, "Assinatura registrada.");
                          }}
                        >
                          Assinar eletronicamente
                        </Botao>
                      )}
                      {leads(me) && certificado.status === "aberto" && (
                        <Botao
                          variante="principal"
                          simbolo={Stamp}
                          disabled={faltam > 0}
                          carregando={acao.ocupado}
                          title={faltam > 0 ? "A sua assinatura é a última: faltam as outras duas." : undefined}
                          onClick={async () => {
                            if (await confirmar({ titulo: "Assinar este certificado?", texto: DECLARACAO.replace(" Assinar?", ""), confirmar: "Assinar" })) void acao.agir("certificado_emitir", { p_id: certificado.id }, "Certificado assinado e emitido.");
                          }}
                        >
                          Assinar e emitir
                        </Botao>
                      )}
                      {certificado.status !== "cancelado" && (
                        <Botao simbolo={Eye} onClick={() => setVer(certificado)}>
                          {certificado.status === "emitido" ? "Ver e salvar em PDF" : "Ver a prévia"}
                        </Botao>
                      )}
                      {leads(me) && certificado.status !== "cancelado" && (
                        <Botao variante="discreto" perigo simbolo={Ban} onClick={() => acao.agir("certificado_cancelar", { p_id: certificado.id }, "Certificado cancelado. As horas voltaram a ficar livres.")}>
                          Cancelar
                        </Botao>
                      )}
                    </p>
                  </Cartao>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {atual === "pedidos" && coordena && <Pedidos me={me} preparar={prepararCertificado} />}
      {atual === "conferir" && coordena && <Conferir />}
      {atual === "abrir" && leads(me) && <Abrir key={`abrir-${preenchido?.vez ?? 0}`} me={me} inicial={preenchido} depois={certificados.recarregar} />}
      {atual === "valores" && <TabelaDeHoras edita={leads(me)} />}

      {atual === "termo" && (
        <Cartao aria-labelledby="termo-adesao-titulo" className="max-w-3xl">
          <CabecalhoDeSecao id="termo-adesao-titulo" titulo="Termo de adesão ao trabalho voluntário" simbolo={FileSignature} />
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-lg" style={{ fontFamily: "var(--pn-fonte-titulo)" }}>
            {TERMO.map((clausula) => (
              <li key={clausula}>{clausula}</li>
            ))}
          </ol>
          {aceito && (
            <Faixa tom="ok" className="mt-3">
              Aceito por {termo.dados?.nome_completo} em {dia(termo.dados?.aceito_em ?? "")}.
            </Faixa>
          )}
        </Cartao>
      )}

      <Aviso texto={termo.erro || minhas.erro || certificados.erro || acao.aviso} />
    </div>
  );
}

/** O tom do selo de cada linha de horas (a palavra vem de estadoDa: a cor só acompanha). */
const tomDa = (hora: Pick<Hora, "status" | "origem">): TomDoSelo => (hora.status === "recusada" ? "neutro" : hora.status === "pendente" ? "aviso" : "ok");

/** O voluntário pede o certificado de um período, acompanha o pedido e lê a resposta da coordenação. */
function PedirCertificado({ minhas, depois }: { minhas: Minhas; depois: () => void }) {
  const acao = useAcao(depois);
  const [form, setForm] = useState({ inicio: minhas.primeiro_livre ?? hojeAqui(), fim: hojeAqui(), mensagem: "" });
  const pedido = minhas.pedido;
  const temHoras = Number(minhas.livres) + Number(minhas.pendentes) > 0;

  if (pedido?.status === "pendente")
    return (
      <Cartao className="max-w-3xl">
        <p className="pn-rotulo-mono">Pedido de certificado · enviado em {data(pedido.criado_em)}</p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xl font-semibold" style={{ fontFamily: "var(--pn-fonte-titulo)" }}>
          De {dia(pedido.inicio)} a {dia(pedido.fim)}
        </p>
        <p className="mt-1 text-ink-soft">
          A coordenação e a coordenação pedagógica foram avisadas. Quando o coordenador abrir o processo, chega um aviso aqui no painel e o certificado aparece em Certificados, esperando as assinaturas.
        </p>
        {pedido.mensagem && <p className="mt-2 border-l-2 border-rule pl-3">{pedido.mensagem}</p>}
        <p className="mt-3">
          <Botao variante="discreto" perigo simbolo={X} disabled={acao.ocupado} onClick={() => acao.agir("certificado_pedido_cancelar", { p_id: pedido.id }, "Pedido cancelado.")}>
            Cancelar o pedido
          </Botao>
        </p>
        <Aviso texto={acao.aviso} />
      </Cartao>
    );

  return (
    <Cartao className="max-w-3xl" titulo="Pedir certificado" nivelDoTitulo={3}>
      {pedido?.status === "recusado" && (
        <Faixa tom="aviso" className="mt-2">
          Seu pedido de {dia(pedido.inicio)} a {dia(pedido.fim)} não foi atendido agora. Nota da coordenação: {pedido.nota}
        </Faixa>
      )}
      {pedido?.status === "atendido" && (
        <Faixa tom="ok" className="mt-2">
          Seu pedido de {dia(pedido.inicio)} a {dia(pedido.fim)} foi atendido{pedido.decidido_em ? ` em ${data(pedido.decidido_em)}` : ""}: o certificado está em Certificados, logo abaixo.
        </Faixa>
      )}
      <p className="mt-2 text-ink-soft">
        Entram as horas livres do período: as que a plataforma contou e as registradas à mão já conferidas. As que ainda esperam conferência, a coordenação confere antes de abrir o processo.
      </p>
      <form
        className="mt-3 grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          void acao.agir("certificado_pedir", { p_inicio: form.inicio, p_fim: form.fim, p_mensagem: form.mensagem }, "Pedido enviado. A coordenação foi avisada.");
        }}
      >
        <Campo rotulo="De" type="date" value={form.inicio} max={form.fim} onChange={(e) => setForm({ ...form, inicio: e.target.value })} required />
        <Campo rotulo="Até" type="date" value={form.fim} min={form.inicio} max={hojeAqui()} onChange={(e) => setForm({ ...form, fim: e.target.value })} required />
        <div className="sm:col-span-2">
          <Area rotulo="Recado para a coordenação (opcional)" value={form.mensagem} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} rows={2} maxLength={1000} placeholder="Para que é o certificado, se precisa dele até alguma data…" />
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <Botao type="submit" variante="principal" simbolo={Send} disabled={!temHoras} carregando={acao.ocupado}>
            Pedir certificado
          </Botao>
          {!temHoras && <span className="text-ink-soft">Ainda não há horas livres para pedir.</span>}
        </div>
      </form>
      <Aviso texto={acao.aviso} />
    </Cartao>
  );
}

/** Quanto vale cada tipo de trabalho. Todo mundo da equipe vê; só o coordenador muda. */
function TabelaDeHoras({ edita }: { edita: boolean }) {
  const pesos = useLista<Peso[]>("horas_pesos");
  const acao = useAcao(pesos.recarregar);
  const [mudancas, setMudancas] = useState<Record<string, string>>({});
  const prontas = Object.entries(mudancas).filter(([, valor]) => valor.trim() !== "");
  return (
    <section aria-labelledby="valores-titulo" className="max-w-3xl space-y-3">
      <CabecalhoDeSecao id="valores-titulo" titulo="Quanto vale cada trabalho" simbolo={Scale} />
      <p className="text-ink-soft">
        Quando alguém termina um trabalho no painel, a plataforma soma na conta da pessoa as horas que esse tipo de trabalho vale. Exemplo: se “Aula escrita e aprovada” vale 4 h, cada aula aprovada rende 4 horas de voluntariado. Cada trabalho conta uma vez, no dia em que terminou.
      </p>
      <Faixa tom="info">
        {edita
          ? "Para mudar, digite o novo valor e clique em Salvar. A mudança vale só para o que for contado daqui em diante: o que já foi contado fica como está. Zero desliga a contagem daquele tipo."
          : "Quem define os valores é o coordenador."}
      </Faixa>
      {!pesos.dados && !pesos.erro && <Esqueleto forma="tabela" linhas={6} />}
      {pesos.dados && (
        // Tabela simples (sem ordem nem páginas): os campos de valor ficam dentro das linhas.
        <div className="pn-tabela-caixa">
          <table className="pn-tabela pn-tabela-densa">
            <caption className="sr-only">Quanto vale cada trabalho</caption>
            <tbody>
              {pesos.dados.map((peso) => (
                <tr key={peso.chave}>
                  <td>{peso.nome}</td>
                  <td className="text-right font-mono tabular-nums">
                    {edita ? (
                      <input
                        aria-label={`Horas por ${peso.nome.toLowerCase()}`}
                        inputMode="decimal"
                        maxLength={4}
                        value={mudancas[peso.chave] ?? String(peso.horas).replace(".", ",")}
                        onChange={(e) => setMudancas({ ...mudancas, [peso.chave]: e.target.value })}
                        className="pn-campo w-20 text-right"
                      />
                    ) : (
                      horasPt(Number(peso.horas))
                    )}
                  </td>
                  {edita && <td className="w-28 text-sm text-ink-soft">{Number(peso.horas) !== Number(peso.padrao) ? `padrão: ${horasPt(Number(peso.padrao))}` : ""}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edita && (
        <Botao
          variante="principal"
          simbolo={Save}
          disabled={prontas.length === 0}
          carregando={acao.ocupado}
          onClick={async () => {
            const p = Object.fromEntries(prontas.map(([chave, valor]) => [chave, Number(valor.replace(",", "."))]));
            if (await acao.agir("horas_pesos_salvar", { p }, "Tabela salva.")) setMudancas({});
          }}
        >
          Salvar
        </Botao>
      )}
      <Aviso texto={pesos.erro || acao.aviso} />
    </section>
  );
}

/** Os pedidos de certificado em aberto. A vice confere e acerta as horas; o coordenador abre o processo ou responde. */
function Pedidos({ me, preparar }: { me: Me; preparar: (pedido: PedidoDaFila) => void }) {
  const fila = useLista<PedidoDaFila[]>("certificado_pedidos");
  const { recarregar } = fila;
  // Toda ação do painel avisa: assim, as horas conferidas logo abaixo já mudam os totais do pedido.
  useEffect(() => {
    window.addEventListener(PAINEL_MUDOU, recarregar);
    return () => window.removeEventListener(PAINEL_MUDOU, recarregar);
  }, [recarregar]);
  const acao = useAcao();
  const [mostra, setMostra] = useState<string | null>(null);
  const [resposta, setResposta] = useState<{ id: string; nota: string } | null>(null);
  const lidera = leads(me);
  return (
    <section aria-labelledby="pedidos-certificado" className="space-y-3">
      <CabecalhoDeSecao id="pedidos-certificado" titulo="Pedidos de certificado" simbolo={Award} />
      <Aviso texto={fila.erro || acao.aviso} />
      {!fila.dados && !fila.erro && <Esqueleto forma="cartoes" linhas={2} />}
      {fila.dados?.length === 0 && <Vazio simbolo={Award} titulo="Nenhum pedido em aberto." />}
      <ul className="space-y-4">
        {fila.dados?.map((pedido) => {
          const livres = Number(pedido.livres);
          const pendentes = Number(pedido.pendentes);
          return (
            <li key={pedido.id}>
              <Cartao as="article" titulo={pedido.nome_completo || pedido.nome} nivelDoTitulo={3}>
                <p className="pn-rotulo-mono mt-1">
                  Pedido de {dataHora(pedido.criado_em)} · {dia(pedido.inicio)} a {dia(pedido.fim)}
                </p>
                <p className="mt-2 flex flex-wrap items-center gap-1.5">
                  <Selo tom={livres > 0 ? "ok" : "neutro"}>
                    <strong>{horasPt(livres)}</strong> livres para o certificado
                  </Selo>
                  {pendentes > 0 && (
                    <Selo tom="aviso">
                      <strong>{horasPt(pendentes)}</strong> esperando conferência, em Horas para conferir
                    </Selo>
                  )}
                </p>
                {pedido.mensagem && <p className="mt-2 border-l-2 border-rule pl-3">{pedido.mensagem}</p>}
                {pedido.resumo && <p className="mt-2 text-ink-soft">O que a plataforma registrou: {pedido.resumo}</p>}
                <p className="mt-2">
                  <Botao variante="discreto" pequeno simbolo={mostra === pedido.id ? ChevronUp : ChevronDown} aria-expanded={mostra === pedido.id} onClick={() => setMostra(mostra === pedido.id ? null : pedido.id)}>
                    {mostra === pedido.id ? "Esconder as horas do período" : `Ver as horas do período (${pedido.horas.length})`}
                  </Botao>
                </p>
                {mostra === pedido.id && (
                  <Lista rotulo={`Horas do período de ${pedido.nome_completo || pedido.nome}`} className="mt-2">
                    {pedido.horas.map((hora) => (
                      <ItemDeLista
                        key={hora.id}
                        titulo={
                          <span className={hora.status === "recusada" ? "text-ink-soft line-through" : ""}>
                            {dia(hora.dia)} · {horasPt(Number(hora.horas))} · {hora.atividade}
                          </span>
                        }
                        selo={<Selo tom={tomDa(hora)}>{estadoDa(hora)}</Selo>}
                        acoes={
                          hora.origem === "plataforma" && (
                            <Botao
                              variante="discreto"
                              pequeno
                              disabled={acao.ocupado}
                              onClick={() =>
                                acao.agir(
                                  "horas_considerar",
                                  { p_id: hora.id, p_considerar: hora.status === "recusada" },
                                  hora.status === "recusada" ? "A linha voltou a contar." : "Linha desconsiderada: ela não entra no certificado.",
                                )
                              }
                            >
                              {hora.status === "recusada" ? "considerar de novo" : "desconsiderar"}
                            </Botao>
                          )
                        }
                      />
                    ))}
                  </Lista>
                )}
                {lidera ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Botao variante="principal" simbolo={FilePlus} disabled={livres <= 0} title={livres <= 0 ? "Confira primeiro as horas que esperam conferência." : undefined} onClick={() => preparar(pedido)}>
                      Preparar o certificado
                    </Botao>
                    <Botao simbolo={MessageSquareReply} onClick={() => setResposta({ id: pedido.id, nota: "" })}>
                      Responder sem abrir
                    </Botao>
                  </div>
                ) : (
                  <p className="pn-ajuda mt-3">Quem abre o processo é o coordenador. Você pode conferir as horas e desconsiderar o que a plataforma contou a mais.</p>
                )}
                {resposta?.id === pedido.id && (
                  <form
                    className="mt-3 space-y-3"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (await acao.agir("certificado_pedido_recusar", { p_id: pedido.id, p_nota: resposta.nota }, "Resposta enviada. A pessoa lê a nota no painel.")) setResposta(null);
                    }}
                  >
                    <Area rotulo="Nota para quem pediu (aparece para a pessoa no painel)" value={resposta.nota} onChange={(e) => setResposta({ ...resposta, nota: e.target.value })} rows={2} required minLength={5} maxLength={1000} />
                    <div className="flex flex-wrap gap-2">
                      <Botao type="submit" simbolo={Send} disabled={resposta.nota.trim().length < 5} carregando={acao.ocupado}>
                        Enviar a resposta
                      </Botao>
                      <Botao variante="discreto" onClick={() => setResposta(null)}>
                        Desistir
                      </Botao>
                    </div>
                  </form>
                )}
              </Cartao>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Coordenação e coordenação pedagógica conferem as horas registradas pelos outros. */
function Conferir() {
  const fila = useLista<HoraDaFila[]>("horas_fila");
  const acao = useAcao(fila.recarregar);
  const colunas: ColumnDef<HoraDaFila>[] = [
    { id: "nome", header: "Pessoa", accessorFn: (h) => h.nome, cell: ({ getValue }) => <strong>{String(getValue())}</strong> },
    { id: "dia", header: "Dia", accessorFn: (h) => h.dia, cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{dia(row.original.dia)}</span> },
    { id: "horas", header: "Horas", accessorFn: (h) => Number(h.horas), cell: ({ row }) => <span className="whitespace-nowrap font-mono tabular-nums">{horasPt(Number(row.original.horas))}</span> },
    { id: "atividade", header: "O que fez", accessorFn: (h) => h.atividade },
    {
      id: "acoes",
      header: "",
      enableSorting: false,
      cell: ({ row: { original: hora } }) => (
        <span className="flex justify-end gap-1">
          <Botao pequeno simbolo={Check} disabled={acao.ocupado} onClick={() => acao.agir("horas_conferir", { p_id: hora.id, p_confirmar: true }, "Horas confirmadas.")}>
            Confirmar
          </Botao>
          <Botao variante="discreto" pequeno perigo simbolo={X} disabled={acao.ocupado} onClick={() => acao.agir("horas_conferir", { p_id: hora.id, p_confirmar: false }, "Horas não confirmadas.")}>
            Não confirmar
          </Botao>
        </span>
      ),
    },
  ];
  return (
    <section aria-labelledby="horas-conferir" className="space-y-3">
      <CabecalhoDeSecao id="horas-conferir" titulo="Horas para conferir" simbolo={ListChecks} />
      <Aviso texto={fila.erro || acao.aviso} />
      {!fila.dados && !fila.erro ? (
        <Esqueleto forma="tabela" linhas={5} />
      ) : (
        fila.dados && <Tabela dados={fila.dados} colunas={colunas} legenda="Horas para conferir" porPagina={25} densa vazio={<Vazio simbolo={ListChecks} titulo="Nada aguardando." />} />
      )}
    </section>
  );
}

/** Só o coordenador: abre o processo de um certificado e indica quem assina com ele. Pode vir preenchido de um pedido. */
function Abrir({ me, inicial, depois }: { me: Me; inicial: Preenchido | null; depois: () => void }) {
  const pessoas = useLista<Pessoa[]>("voluntarios_listar");
  const acao = useAcao(depois);
  const [form, setForm] = useState({ usuario: inicial?.usuario ?? "", educador: "", vice: "", inicio: inicial?.inicio ?? "", fim: inicial?.fim ?? hojeAqui(), atividades: inicial?.atividades ?? "" });
  const equipe = pessoas.dados?.filter((pessoa) => pessoa.papeis.length > 0) ?? [];
  const tem = (pessoa: Pessoa, papel: string) => pessoa.papeis.some((item) => item.papel === papel);
  const educadores = equipe.filter((pessoa) => pessoa.id !== form.usuario && tem(pessoa, "educacao") && !tem(pessoa, "coordenacao"));
  const vices = equipe.filter((pessoa) => pessoa.id !== form.usuario && pessoa.id !== form.educador && tem(pessoa, "vice"));
  const [previa, setPrevia] = useState(false);
  const nomeDe = (id: string) => equipe.find((pessoa) => pessoa.id === id)?.nome ?? "";
  const educador = equipe.find((pessoa) => pessoa.id === form.educador);
  const vice = form.vice ? nomeDe(form.vice) : vices.length === 1 ? vices[0].nome : "";
  /** A folha como ela sairia agora, montada com o que está no formulário. Nada disto é guardado. */
  const rascunho: Certificado = {
    id: "previa",
    codigo: "",
    usuario: form.usuario || null,
    nome: nomeDe(form.usuario),
    horas: 0,
    inicio: form.inicio,
    fim: form.fim,
    atividades: form.atividades.trim(),
    testemunhas: [
      { id: "educador", nome: educador?.nome || "Educador(a) que assina", papel: "educacao", disciplina: educador?.papeis.find((item) => item.papel === "educacao")?.disciplina ?? null, confirmou_em: null },
      { id: "vice", nome: vice || "Coordenação pedagógica que assina", papel: "vice", confirmou_em: null },
      { id: "coordenacao", nome: me.nome, papel: "coordenacao", confirmou_em: null },
    ],
    status: "aberto",
    emitido_em: new Date().toISOString(),
    impressao: "",
  };

  return (
    <section id="abrir-certificado" aria-labelledby="abrir-certificado-titulo" className="space-y-3">
      <CabecalhoDeSecao
        id="abrir-certificado-titulo"
        titulo="Abrir um certificado"
        simbolo={FilePlus}
        sobre="Entram no certificado as horas livres da pessoa dentro do período: as que a plataforma contou e as registradas à mão já confirmadas. Ele é assinado por um educador, pelo vice-coordenador e por você: cada um assina na própria conta, e a sua assinatura, a última, é a emissão. Ninguém assina o próprio certificado. O CPF não é guardado: quem salva o PDF digita na hora."
      />
      {inicial && form.usuario === inicial.usuario && (
        <Faixa tom="ok" className="max-w-3xl">
          Preenchido com o pedido de {inicial.nome}: período e atividades vieram do que a plataforma registrou. Revise o texto, escolha o educador que assina e abra o processo.
        </Faixa>
      )}
      <Cartao as="div" className="max-w-3xl">
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await acao.agir("certificado_abrir", { p: form }, "Processo aberto. Quem assina já foi avisado.")) setForm({ ...form, usuario: "", educador: "", vice: "", atividades: "" });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="pn-campo-bloco">
              <span className="pn-rotulo">Quem recebe</span>
              <BuscaDePessoa rotulo="Quem recebe o certificado" entre={equipe} escolhida={equipe.find((pessoa) => pessoa.id === form.usuario) ?? null} escolher={(pessoa) => setForm({ ...form, usuario: pessoa?.id ?? "", educador: "", vice: "" })} />
            </div>
            <Campo rotulo="De" type="date" value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} required />
            <Campo rotulo="Até" type="date" value={form.fim} onChange={(e) => setForm({ ...form, fim: e.target.value })} required />
          </div>
          <div>
            <Area rotulo="Atividades realizadas (sai no certificado)" value={form.atividades} onChange={(e) => setForm({ ...form, atividades: e.target.value })} rows={3} required minLength={10} maxLength={700} />
            <span className="block text-right font-mono text-xs text-ink-soft tabular-nums">{form.atividades.length}/700</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="pn-campo-bloco">
              <span className="pn-rotulo">Educador(a) que assina</span>
              <BuscaDePessoa rotulo="Educador ou educadora que assina" entre={educadores} escolhida={educadores.find((pessoa) => pessoa.id === form.educador) ?? null} escolher={(pessoa) => setForm({ ...form, educador: pessoa?.id ?? "", vice: "" })} />
            </div>
            <Selecao rotulo="Coordenação pedagógica que assina" value={form.vice} onChange={(e) => setForm({ ...form, vice: e.target.value })}>
              <option value="">{vices.length === 1 ? vices[0].nome : vices.length === 0 ? "Ninguém disponível" : "Quem entrou por último"}</option>
              {vices.length > 1 &&
                vices.map((pessoa) => (
                  <option key={pessoa.id} value={pessoa.id}>
                    {pessoa.nome}
                  </option>
                ))}
            </Selecao>
          </div>
          {pessoas.dados && form.usuario && (educadores.length === 0 || vices.length === 0) && (
            <Faixa tom="aviso">
              {educadores.length === 0 ? "Não há outro educador na equipe para assinar. " : ""}
              {vices.length === 0 ? "Não há ninguém da coordenação pedagógica disponível para assinar: nomeie em Voluntários e convites." : ""}
            </Faixa>
          )}
          <div className="flex flex-wrap gap-2">
            <Botao type="submit" variante="principal" simbolo={FilePlus} disabled={!form.usuario || !form.educador || vices.length === 0} carregando={acao.ocupado}>
              Abrir processo
            </Botao>
            <Botao simbolo={Eye} aria-expanded={previa} onClick={() => setPrevia(!previa)}>
              {previa ? "Fechar a prévia" : "Ver prévia"}
            </Botao>
          </div>
          <Aviso texto={pessoas.erro || acao.aviso} />
        </form>
      </Cartao>
      {previa && (
        <div className="mt-2">
          <p className="mb-3 max-w-3xl text-ink-soft">
            A folha abaixo acompanha o que você preenche: nome, período, atividades, quem assina e a data de hoje. As horas entram sozinhas na abertura (são as livres da pessoa no período), e o número e a
            impressão digital nascem junto. Nada desta prévia é guardado.
          </p>
          <Folha certificado={rascunho} rascunho />
        </div>
      )}
    </section>
  );
}

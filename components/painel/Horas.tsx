// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { can, leads, type Me } from "@/lib/backend";
import { BuscaDePessoa } from "./BuscaDePessoa";
import { type Certificado, Folha, Impresso } from "./Certificado";
import { Aviso, botao, botaoClaro, campo, data, dataHora, dia, elo, PAINEL_MUDOU, rotulo, useAcao, useLista } from "./comum";

export const VERSAO_DO_TERMO = "2026-10-14";

export const TERMO: string[] = [
  "O Instituto Lúcia é uma iniciativa educacional gratuita e sem fins lucrativos, mantida por trabalho voluntário.",
  "Participo por vontade própria e sem remuneração, nas atividades combinadas com a coordenação: escrita e revisão de aulas, curadoria, tradução, jornal, aula de reforço, design ou desenvolvimento.",
  "Nos termos da Lei nº 9.608, de 18 de fevereiro de 1998, o serviço voluntário não gera vínculo empregatício nem obrigação de natureza trabalhista, previdenciária ou afim.",
  "Não há horário fixo nem meta obrigatória. A plataforma conta sozinha as horas do trabalho que faço no painel (aula aprovada, parecer, tradução, aula de reforço, episódio publicado e os demais tipos da tabela de horas definida pela coordenação). O que eu fizer fora do painel, registro com a descrição do que fiz, e essas horas só contam para certificado depois de conferidas pela coordenação.",
  "Posso deixar o voluntariado a qualquer momento, e o instituto pode encerrar a minha participação, sem ônus para nenhuma das partes.",
  "O que eu escrever para o site é publicado sob a licença de conteúdo do instituto, com o crédito que eu escolher.",
  "Comprometo-me a não inventar informações, a citar as fontes do que escrevo e a guardar sigilo sobre dados pessoais a que tiver acesso no painel.",
];

interface Termo {
  nome_completo: string;
  versao: string;
  aceito_em: string;
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

  if (ver) return <Impresso certificado={ver} fechar={() => setVer(null)} />;

  const aceito = termo.dados?.versao === VERSAO_DO_TERMO;
  const antigo = Boolean(termo.dados) && !aceito;
  const m = minhas.dados;
  const prepararCertificado = (pedido: PedidoDaFila) => {
    setPreenchido({ usuario: pedido.usuario, nome: pedido.nome_completo || pedido.nome, inicio: pedido.inicio, fim: pedido.fim, atividades: pedido.resumo, vez: Date.now() });
    requestAnimationFrame(() => document.getElementById("abrir-certificado")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <div className="space-y-10">
      <p className="max-w-3xl border-l-2 border-gold pl-4 text-ink-soft">
        A plataforma conta sozinha as horas do trabalho feito no painel. Quando quiser o certificado, peça aqui mesmo: a coordenação é avisada. Todo certificado leva três assinaturas eletrônicas (um educador, o vice-coordenador e o coordenador) e um código que qualquer pessoa confere na página Conferir certificado. A aceitação como horas complementares depende de cada faculdade: pergunte na coordenação do seu curso antes de contar com ele.
      </p>

      <section>
        <h2 className="font-serif text-2xl font-semibold">Termo de adesão ao trabalho voluntário</h2>
        {antigo && (
          <p className="mt-3 max-w-3xl border-l-2 border-oxblood pl-4">
            O termo mudou: agora a plataforma conta sozinha as horas do trabalho feito no painel (cláusula 4). Leia e aceite de novo para continuar registrando horas e pedir certificado. As horas que você já tem continuam valendo.
          </p>
        )}
        <ol className="mt-3 max-w-3xl list-decimal space-y-2 pl-5 font-serif text-lg">
          {TERMO.map((clausula) => (
            <li key={clausula}>{clausula}</li>
          ))}
        </ol>
        {aceito ? (
          <p className="mt-3 border-l-2 border-ok pl-4">
            Aceito por {termo.dados?.nome_completo} em {dia(termo.dados?.aceito_em ?? "")}.
          </p>
        ) : (
          <div className="mt-3 flex max-w-3xl flex-wrap items-end gap-3">
            <label className="block min-w-60 flex-1">
              Seu nome completo, como deve sair no certificado
              <input value={nome || (antigo ? (termo.dados?.nome_completo ?? "") : "")} onChange={(e) => setNome(e.target.value)} maxLength={120} autoComplete="name" className={campo} />
            </label>
            <button
              type="button"
              className={botao}
              disabled={acao.ocupado || (nome || termo.dados?.nome_completo || "").trim().length < 5}
              onClick={() => acao.agir("termo_aceitar", { p_nome_completo: nome || termo.dados?.nome_completo || "", p_versao: VERSAO_DO_TERMO }, "Aceite registrado.")}
            >
              Li e aceito o termo
            </button>
          </div>
        )}
      </section>

      {aceito && m && (
        <section>
          <h2 className="font-serif text-2xl font-semibold">Minhas horas</h2>
          <div className="mt-3 grid max-w-3xl gap-3 sm:grid-cols-3">
            {(
              [
                ["Livres para certificado", m.livres, "confirmadas e fora de certificado"],
                ["Contadas pela plataforma", m.plataforma, "entre as livres"],
                ["Esperando conferência", m.pendentes, "registradas à mão"],
              ] as const
            ).map(([titulo, valor, nota]) => (
              <div key={titulo} className="painel-cartao p-4">
                <span className="block text-ink-soft">{titulo}</span>
                <span className="mt-1 block font-serif text-3xl font-semibold leading-tight">{horasPt(Number(valor))}</span>
                <span className="block text-sm text-ink-soft">{nota}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 max-w-3xl text-ink-soft">
            Confirmadas desde o começo: <strong className="text-ink">{horasPt(Number(m.confirmadas))}</strong>. A plataforma conta sozinha o que você faz aqui no painel, pela tabela de horas logo abaixo: cada trabalho conta uma vez, no dia em que terminou, e nenhum dia passa de 12 horas somando tudo. O que você fizer fora do painel, registre à mão.
          </p>

          <PedirCertificado minhas={m} depois={minhas.recarregar} />

          <h3 className="mt-8 font-serif text-xl font-semibold">Registrar horas feitas fora do painel</h3>
          <form
            className="mt-3 grid max-w-3xl gap-3 sm:grid-cols-[auto_auto_1fr_auto] sm:items-end"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await acao.agir("horas_registrar", { p_dia: nova.dia, p_horas: Number(nova.horas.replace(",", ".")), p_atividade: nova.atividade }, "Horas registradas. Elas contam depois de conferidas.")) setNova({ ...nova, atividade: "" });
            }}
          >
            <label className="block">
              Dia
              <input type="date" value={nova.dia} max={hojeAqui()} onChange={(e) => setNova({ ...nova, dia: e.target.value })} required className={campo} />
            </label>
            <label className="block">
              Horas
              <input value={nova.horas} onChange={(e) => setNova({ ...nova, horas: e.target.value })} inputMode="decimal" required maxLength={4} className={`${campo} w-24`} />
            </label>
            <label className="block">
              O que você fez
              <input value={nova.atividade} onChange={(e) => setNova({ ...nova, atividade: e.target.value })} required minLength={5} maxLength={300} className={campo} />
            </label>
            <button type="submit" className={botao} disabled={acao.ocupado}>
              Registrar
            </button>
          </form>
          <ul className="mt-4 divide-y divide-rule border-y border-rule">
            {m.lista.length === 0 && <li className="py-2 text-ink-soft">Nenhuma hora ainda. Assim que um trabalho seu for aprovado ou concluído no painel, ele aparece aqui.</li>}
            {m.lista.map((hora) => (
              <li key={hora.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span>
                  {dia(hora.dia)} · {horasPt(Number(hora.horas))} · {hora.atividade}
                </span>
                <span className={hora.origem === "plataforma" && hora.status !== "recusada" ? "text-ok" : "text-ink-soft"}>
                  {estadoDa(hora)}
                  {hora.certificado && " · em certificado"}{" "}
                  {hora.status === "pendente" && (
                    <button type="button" className={elo} onClick={() => acao.agir("horas_remover", { p_id: hora.id }, "Registro apagado.")}>
                      apagar
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(aceito || leads(me)) && <TabelaDeHoras edita={leads(me)} />}

      {can(me, "coordenacao") && <Pedidos me={me} preparar={prepararCertificado} />}
      {can(me, "coordenacao") && <Conferir />}

      <section>
        <h2 className="font-serif text-2xl font-semibold">Certificados</h2>
        {certificados.dados?.length === 0 && <p className="mt-2 text-ink-soft">Nenhum certificado ainda.</p>}
        <ul className="mt-3 space-y-4">
          {certificados.dados?.map((certificado) => {
            const minha = certificado.testemunhas.find((assinatura) => assinatura.id === me.id && !assinatura.confirmou_em && assinatura.papel !== "coordenacao");
            const faltam = certificado.testemunhas.filter((assinatura) => assinatura.papel !== "coordenacao" && !assinatura.confirmou_em).length;
            return (
              <li key={certificado.id} className="border border-rule bg-parchment-deep p-4">
                <p className={rotulo}>
                  {situacao[certificado.status]} · {dia(certificado.inicio)} a {dia(certificado.fim)} · {horasPt(Number(certificado.horas))}
                </p>
                <p className="mt-1 font-serif text-xl font-semibold">{certificado.nome}</p>
                <p className="mt-1 whitespace-pre-line">{certificado.atividades}</p>
                {certificado.testemunhas.length > 0 && (
                  <p className="mt-1 text-ink-soft">
                    Assinaturas: {certificado.testemunhas.map((assinatura) => `${assinatura.nome} (${assinatura.confirmou_em ? "assinou" : "falta assinar"})`).join(", ")}
                  </p>
                )}
                <p className="mt-3 flex flex-wrap gap-3">
                  {minha && certificado.status === "aberto" && (
                    <button
                      type="button"
                      className={botao}
                      disabled={acao.ocupado}
                      onClick={() => {
                        if (window.confirm(DECLARACAO)) void acao.agir("certificado_testemunhar", { p_id: certificado.id }, "Assinatura registrada.");
                      }}
                    >
                      Assinar eletronicamente
                    </button>
                  )}
                  {leads(me) && certificado.status === "aberto" && (
                    <button
                      type="button"
                      className={botao}
                      disabled={acao.ocupado || faltam > 0}
                      title={faltam > 0 ? "A sua assinatura é a última: faltam as outras duas." : undefined}
                      onClick={() => {
                        if (window.confirm(DECLARACAO)) void acao.agir("certificado_emitir", { p_id: certificado.id }, "Certificado assinado e emitido.");
                      }}
                    >
                      Assinar e emitir
                    </button>
                  )}
                  {certificado.status !== "cancelado" && (
                    <button type="button" className={botaoClaro} onClick={() => setVer(certificado)}>
                      {certificado.status === "emitido" ? "Ver e salvar em PDF" : "Ver a prévia"}
                    </button>
                  )}
                  {leads(me) && certificado.status !== "cancelado" && (
                    <button type="button" className={elo} onClick={() => acao.agir("certificado_cancelar", { p_id: certificado.id }, "Certificado cancelado. As horas voltaram a ficar livres.")}>
                      Cancelar
                    </button>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      {leads(me) && <Abrir key={`abrir-${preenchido?.vez ?? 0}`} me={me} inicial={preenchido} depois={certificados.recarregar} />}
      <Aviso texto={termo.erro || minhas.erro || certificados.erro || acao.aviso} />
    </div>
  );
}

/** O voluntário pede o certificado de um período, acompanha o pedido e lê a resposta da coordenação. */
function PedirCertificado({ minhas, depois }: { minhas: Minhas; depois: () => void }) {
  const acao = useAcao(depois);
  const [form, setForm] = useState({ inicio: minhas.primeiro_livre ?? hojeAqui(), fim: hojeAqui(), mensagem: "" });
  const pedido = minhas.pedido;
  const temHoras = Number(minhas.livres) + Number(minhas.pendentes) > 0;

  if (pedido?.status === "pendente")
    return (
      <div className="painel-cartao mt-6 max-w-3xl p-5">
        <p className={rotulo}>Pedido de certificado · enviado em {data(pedido.criado_em)}</p>
        <p className="mt-1 font-serif text-xl font-semibold">
          De {dia(pedido.inicio)} a {dia(pedido.fim)}
        </p>
        <p className="mt-1 text-ink-soft">
          A coordenação e a vice-coordenação foram avisadas. Quando o coordenador abrir o processo, chega um aviso aqui no painel e o certificado aparece em Certificados, esperando as assinaturas.
        </p>
        {pedido.mensagem && <p className="mt-2 border-l-2 border-rule pl-3">{pedido.mensagem}</p>}
        <p className="mt-3">
          <button type="button" className={elo} disabled={acao.ocupado} onClick={() => acao.agir("certificado_pedido_cancelar", { p_id: pedido.id }, "Pedido cancelado.")}>
            Cancelar o pedido
          </button>
        </p>
        <Aviso texto={acao.aviso} />
      </div>
    );

  return (
    <div className="painel-cartao mt-6 max-w-3xl p-5">
      <h3 className="font-serif text-xl font-semibold">Pedir certificado</h3>
      {pedido?.status === "recusado" && (
        <p className="mt-2 border-l-2 border-oxblood pl-3">
          Seu pedido de {dia(pedido.inicio)} a {dia(pedido.fim)} não foi atendido agora. Nota da coordenação: {pedido.nota}
        </p>
      )}
      {pedido?.status === "atendido" && (
        <p className="mt-2 border-l-2 border-ok pl-3">
          Seu pedido de {dia(pedido.inicio)} a {dia(pedido.fim)} foi atendido{pedido.decidido_em ? ` em ${data(pedido.decidido_em)}` : ""}: o certificado está em Certificados, logo abaixo.
        </p>
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
        <label className="block">
          De
          <input type="date" value={form.inicio} max={form.fim} onChange={(e) => setForm({ ...form, inicio: e.target.value })} required className={campo} />
        </label>
        <label className="block">
          Até
          <input type="date" value={form.fim} min={form.inicio} max={hojeAqui()} onChange={(e) => setForm({ ...form, fim: e.target.value })} required className={campo} />
        </label>
        <label className="block sm:col-span-2">
          Recado para a coordenação (opcional)
          <textarea value={form.mensagem} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} rows={2} maxLength={1000} placeholder="Para que é o certificado, se precisa dele até alguma data…" className={campo} />
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" className={botao} disabled={acao.ocupado || !temHoras}>
            Pedir certificado
          </button>
          {!temHoras && <span className="text-ink-soft">Ainda não há horas livres para pedir.</span>}
        </div>
      </form>
      <Aviso texto={acao.aviso} />
    </div>
  );
}

/** Quanto vale cada tipo de trabalho. Todo mundo da equipe vê; só o coordenador muda. */
function TabelaDeHoras({ edita }: { edita: boolean }) {
  const pesos = useLista<Peso[]>("horas_pesos");
  const acao = useAcao(pesos.recarregar);
  const [mudancas, setMudancas] = useState<Record<string, string>>({});
  const prontas = Object.entries(mudancas).filter(([, valor]) => valor.trim() !== "");
  return (
    <details className="max-w-3xl border-y-2 border-ink py-3">
      <summary className="cursor-pointer font-serif text-xl font-semibold">Tabela de horas: quanto vale cada trabalho</summary>
      <p className="mt-2 text-ink-soft">
        {edita
          ? "Ajuste e salve. Vale para o trabalho contado daqui em diante: o que já foi contado fica como está. Zero desliga o tipo."
          : "Quem define a tabela é o coordenador. Cada trabalho conta uma vez, no dia em que terminou."}
      </p>
      <table className="mt-2 w-full">
        <tbody className="divide-y divide-rule">
          {pesos.dados?.map((peso) => (
            <tr key={peso.chave}>
              <td className="py-1.5 pr-3">{peso.nome}</td>
              <td className="py-1.5 text-right font-mono">
                {edita ? (
                  <input
                    aria-label={`Horas por ${peso.nome.toLowerCase()}`}
                    inputMode="decimal"
                    maxLength={4}
                    value={mudancas[peso.chave] ?? String(peso.horas).replace(".", ",")}
                    onChange={(e) => setMudancas({ ...mudancas, [peso.chave]: e.target.value })}
                    className="painel-campo w-20 border-2 border-ink bg-parchment px-2 py-1 text-right"
                  />
                ) : (
                  horasPt(Number(peso.horas))
                )}
              </td>
              {edita && <td className="w-28 py-1.5 pl-3 text-sm text-ink-soft">{Number(peso.horas) !== Number(peso.padrao) ? `padrão: ${horasPt(Number(peso.padrao))}` : ""}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {edita && (
        <button
          type="button"
          className={`${botao} mt-3`}
          disabled={acao.ocupado || prontas.length === 0}
          onClick={async () => {
            const p = Object.fromEntries(prontas.map(([chave, valor]) => [chave, Number(valor.replace(",", "."))]));
            if (await acao.agir("horas_pesos_salvar", { p }, "Tabela salva.")) setMudancas({});
          }}
        >
          Salvar a tabela
        </button>
      )}
      <Aviso texto={pesos.erro || acao.aviso} />
    </details>
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
    <section>
      <h2 className="font-serif text-2xl font-semibold">Pedidos de certificado</h2>
      <Aviso texto={fila.erro || acao.aviso} />
      {fila.dados?.length === 0 && <p className="text-ink-soft">Nenhum pedido em aberto.</p>}
      <ul className="mt-2 space-y-4">
        {fila.dados?.map((pedido) => {
          const livres = Number(pedido.livres);
          const pendentes = Number(pedido.pendentes);
          return (
            <li key={pedido.id} className="painel-cartao p-5">
              <p className={rotulo}>
                Pedido de {dataHora(pedido.criado_em)} · {dia(pedido.inicio)} a {dia(pedido.fim)}
              </p>
              <p className="mt-1 font-serif text-xl font-semibold">{pedido.nome_completo || pedido.nome}</p>
              <p className="mt-1">
                <strong>{horasPt(livres)}</strong> livres para o certificado
                {pendentes > 0 && (
                  <>
                    {" "}
                    · <strong className="text-oxblood">{horasPt(pendentes)}</strong> esperando conferência, em Horas para conferir
                  </>
                )}
              </p>
              {pedido.mensagem && <p className="mt-2 border-l-2 border-rule pl-3">{pedido.mensagem}</p>}
              {pedido.resumo && <p className="mt-2 text-ink-soft">O que a plataforma registrou: {pedido.resumo}</p>}
              <p className="mt-2">
                <button type="button" className={elo} aria-expanded={mostra === pedido.id} onClick={() => setMostra(mostra === pedido.id ? null : pedido.id)}>
                  {mostra === pedido.id ? "Esconder as horas do período" : `Ver as horas do período (${pedido.horas.length})`}
                </button>
              </p>
              {mostra === pedido.id && (
                <ul className="mt-2 divide-y divide-rule border-y border-rule">
                  {pedido.horas.map((hora) => (
                    <li key={hora.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                      <span className={hora.status === "recusada" ? "text-ink-soft line-through" : ""}>
                        {dia(hora.dia)} · {horasPt(Number(hora.horas))} · {hora.atividade}
                      </span>
                      <span className="text-ink-soft">
                        {estadoDa(hora)}{" "}
                        {hora.origem === "plataforma" && (
                          <button
                            type="button"
                            className={elo}
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
                          </button>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {lidera ? (
                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" className={botao} disabled={livres <= 0} title={livres <= 0 ? "Confira primeiro as horas que esperam conferência." : undefined} onClick={() => preparar(pedido)}>
                    Preparar o certificado
                  </button>
                  <button type="button" className={botaoClaro} onClick={() => setResposta({ id: pedido.id, nota: "" })}>
                    Responder sem abrir
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-ink-soft">Quem abre o processo é o coordenador. Você pode conferir as horas e desconsiderar o que a plataforma contou a mais.</p>
              )}
              {resposta?.id === pedido.id && (
                <form
                  className="mt-3 space-y-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (await acao.agir("certificado_pedido_recusar", { p_id: pedido.id, p_nota: resposta.nota }, "Resposta enviada. A pessoa lê a nota no painel.")) setResposta(null);
                  }}
                >
                  <label className="block">
                    Nota para quem pediu (aparece para a pessoa no painel)
                    <textarea value={resposta.nota} onChange={(e) => setResposta({ ...resposta, nota: e.target.value })} rows={2} required minLength={5} maxLength={1000} className={campo} />
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button type="submit" className={botao} disabled={acao.ocupado || resposta.nota.trim().length < 5}>
                      Enviar a resposta
                    </button>
                    <button type="button" className={elo} onClick={() => setResposta(null)}>
                      Desistir
                    </button>
                  </div>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Coordenação e vice-coordenação conferem as horas registradas pelos outros. */
function Conferir() {
  const fila = useLista<HoraDaFila[]>("horas_fila");
  const acao = useAcao(fila.recarregar);
  return (
    <section>
      <h2 className="font-serif text-2xl font-semibold">Horas para conferir</h2>
      <Aviso texto={fila.erro || acao.aviso} />
      {fila.dados?.length === 0 && <p className="text-ink-soft">Nada aguardando.</p>}
      <ul className="mt-2 divide-y divide-rule border-y border-rule">
        {fila.dados?.map((hora) => (
          <li key={hora.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
            <span>
              <strong>{hora.nome}</strong> · {dia(hora.dia)} · {horasPt(Number(hora.horas))} · {hora.atividade}
            </span>
            <span className="flex gap-3">
              <button type="button" className={elo} disabled={acao.ocupado} onClick={() => acao.agir("horas_conferir", { p_id: hora.id, p_confirmar: true }, "Horas confirmadas.")}>
                Confirmar
              </button>
              <button type="button" className={elo} disabled={acao.ocupado} onClick={() => acao.agir("horas_conferir", { p_id: hora.id, p_confirmar: false }, "Horas não confirmadas.")}>
                Não confirmar
              </button>
            </span>
          </li>
        ))}
      </ul>
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
      { id: "vice", nome: vice || "Vice-coordenador que assina", papel: "vice", confirmou_em: null },
      { id: "coordenacao", nome: me.nome, papel: "coordenacao", confirmou_em: null },
    ],
    status: "aberto",
    emitido_em: new Date().toISOString(),
    impressao: "",
  };

  return (
    <section id="abrir-certificado" className="scroll-mt-24">
      <h2 className="font-serif text-2xl font-semibold">Abrir um certificado</h2>
      {inicial && form.usuario === inicial.usuario && (
        <p className="mt-2 max-w-3xl border-l-2 border-ok pl-4">
          Preenchido com o pedido de {inicial.nome}: período e atividades vieram do que a plataforma registrou. Revise o texto, escolha o educador que assina e abra o processo.
        </p>
      )}
      <p className="mt-1 max-w-3xl text-ink-soft">
        Entram no certificado as horas livres da pessoa dentro do período: as que a plataforma contou e as registradas à mão já confirmadas. Ele é assinado por um educador, pelo vice-coordenador e por você: cada um assina na própria conta, e a sua assinatura, a última, é a emissão. Ninguém assina o próprio certificado. O CPF não é guardado: quem salva o PDF digita na hora.
      </p>
      <form
        className="mt-3 max-w-3xl space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await acao.agir("certificado_abrir", { p: form }, "Processo aberto. Quem assina já foi avisado.")) setForm({ ...form, usuario: "", educador: "", vice: "", atividades: "" });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            Quem recebe
            <BuscaDePessoa rotulo="Quem recebe o certificado" entre={equipe} escolhida={equipe.find((pessoa) => pessoa.id === form.usuario) ?? null} escolher={(pessoa) => setForm({ ...form, usuario: pessoa?.id ?? "", educador: "", vice: "" })} />
          </div>
          <label className="block">
            De
            <input type="date" value={form.inicio} onChange={(e) => setForm({ ...form, inicio: e.target.value })} required className={campo} />
          </label>
          <label className="block">
            Até
            <input type="date" value={form.fim} onChange={(e) => setForm({ ...form, fim: e.target.value })} required className={campo} />
          </label>
        </div>
        <label className="block">
          Atividades realizadas (sai no certificado)
          <textarea value={form.atividades} onChange={(e) => setForm({ ...form, atividades: e.target.value })} rows={3} required minLength={10} maxLength={700} className={campo} />
          <span className="block text-right font-mono text-xs text-ink-soft">{form.atividades.length}/700</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            Educador(a) que assina
            <BuscaDePessoa rotulo="Educador ou educadora que assina" entre={educadores} escolhida={educadores.find((pessoa) => pessoa.id === form.educador) ?? null} escolher={(pessoa) => setForm({ ...form, educador: pessoa?.id ?? "", vice: "" })} />
          </div>
          <label className="block">
            Vice-coordenador que assina
            <select value={form.vice} onChange={(e) => setForm({ ...form, vice: e.target.value })} className={campo}>
              <option value="">{vices.length === 1 ? vices[0].nome : vices.length === 0 ? "Ninguém disponível" : "Quem entrou por último"}</option>
              {vices.length > 1 &&
                vices.map((pessoa) => (
                  <option key={pessoa.id} value={pessoa.id}>
                    {pessoa.nome}
                  </option>
                ))}
            </select>
          </label>
        </div>
        {pessoas.dados && form.usuario && (educadores.length === 0 || vices.length === 0) && (
          <p className="border-l-2 border-oxblood pl-3 text-oxblood">
            {educadores.length === 0 ? "Não há outro educador na equipe para assinar. " : ""}
            {vices.length === 0 ? "Não há vice-coordenador disponível para assinar: nomeie um em Voluntários e convites." : ""}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="submit" className={botao} disabled={acao.ocupado || !form.usuario || !form.educador || vices.length === 0}>
            Abrir processo
          </button>
          <button type="button" className={botaoClaro} aria-expanded={previa} onClick={() => setPrevia(!previa)}>
            {previa ? "Fechar a prévia" : "Ver prévia"}
          </button>
        </div>
        <Aviso texto={pessoas.erro || acao.aviso} />
      </form>
      {previa && (
        <div className="mt-5">
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

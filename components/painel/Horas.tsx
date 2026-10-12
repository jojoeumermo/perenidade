// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { can, leads, type Me } from "@/lib/backend";
import { type Certificado, Impresso } from "./Certificado";
import { Aviso, botao, botaoClaro, campo, dia, elo, rotulo, useAcao, useLista } from "./comum";

export const VERSAO_DO_TERMO = "2026-10";

export const TERMO: string[] = [
  "O Instituto Lúcia é uma iniciativa educacional gratuita e sem fins lucrativos, mantida por trabalho voluntário.",
  "Participo por vontade própria e sem remuneração, nas atividades combinadas com a coordenação: escrita e revisão de aulas, curadoria, tradução, jornal, aula de reforço, design ou desenvolvimento.",
  "Nos termos da Lei nº 9.608, de 18 de fevereiro de 1998, o serviço voluntário não gera vínculo empregatício nem obrigação de natureza trabalhista, previdenciária ou afim.",
  "Não há horário fixo nem meta obrigatória. Registro no painel as horas que de fato dediquei, com a descrição do que fiz. As horas só contam para certificado depois de conferidas pela coordenação.",
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
  certificado: boolean;
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
  papeis: { papel: string }[];
}

const situacao: Record<string, string> = { pendente: "aguardando conferência", confirmada: "confirmada", recusada: "não confirmada", aberto: "aguardando assinaturas", emitido: "emitido", cancelado: "cancelado" };
/** O que a pessoa declara ao assinar. A assinatura fica presa à conta dela, com data e hora. */
const DECLARACAO = "Ao assinar, você declara que acompanhou este trabalho e confirma o período, as horas e as atividades descritas. A assinatura fica registrada com a sua conta, a data e a hora, e não pode ser desfeita. Assinar?";
const horasPt = (valor: number) => `${String(valor).replace(".", ",")} h`;

export function Horas({ me }: { me: Me }) {
  const termo = useLista<Termo | null>("termo_meu");
  const minhas = useLista<{ confirmadas: number; lista: Hora[] }>("horas_minhas");
  const certificados = useLista<Certificado[]>("certificados_listar");
  const acao = useAcao(() => {
    termo.recarregar();
    minhas.recarregar();
    certificados.recarregar();
  });
  const [nome, setNome] = useState("");
  const [nova, setNova] = useState({ dia: new Date().toLocaleDateString("sv-SE"), horas: "1", atividade: "" });
  const [ver, setVer] = useState<Certificado | null>(null);

  if (ver) return <Impresso certificado={ver} fechar={() => setVer(null)} />;

  const aceito = termo.dados?.versao === VERSAO_DO_TERMO;
  return (
    <div className="space-y-10">
      <p className="max-w-3xl border-l-2 border-gold pl-4 text-ink-soft">
        Todo certificado leva três assinaturas eletrônicas (um educador, o vice-líder e o líder comunitário) e um código que qualquer pessoa confere na página Conferir certificado. A aceitação como horas complementares depende de cada faculdade: pergunte na coordenação do seu curso antes de contar com ele.
      </p>

      <section>
        <h2 className="font-serif text-2xl font-semibold">Termo de adesão ao trabalho voluntário</h2>
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
              <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} autoComplete="name" className={campo} />
            </label>
            <button type="button" className={botao} disabled={acao.ocupado || nome.trim().length < 5} onClick={() => acao.agir("termo_aceitar", { p_nome_completo: nome, p_versao: VERSAO_DO_TERMO }, "Aceite registrado.")}>
              Li e aceito o termo
            </button>
          </div>
        )}
      </section>

      {aceito && (
        <section>
          <h2 className="font-serif text-2xl font-semibold">Minhas horas</h2>
          <p className="mt-1 text-ink-soft">
            Confirmadas até hoje: <strong className="text-ink">{horasPt(Number(minhas.dados?.confirmadas ?? 0))}</strong>
          </p>
          <form
            className="mt-3 grid max-w-3xl gap-3 sm:grid-cols-[auto_auto_1fr_auto] sm:items-end"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await acao.agir("horas_registrar", { p_dia: nova.dia, p_horas: Number(nova.horas.replace(",", ".")), p_atividade: nova.atividade }, "Horas registradas. Elas contam depois de conferidas.")) setNova({ ...nova, atividade: "" });
            }}
          >
            <label className="block">
              Dia
              <input type="date" value={nova.dia} onChange={(e) => setNova({ ...nova, dia: e.target.value })} required className={campo} />
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
            {minhas.dados?.lista.map((hora) => (
              <li key={hora.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <span>
                  {dia(hora.dia)} · {horasPt(Number(hora.horas))} · {hora.atividade}
                </span>
                <span className="text-ink-soft">
                  {situacao[hora.status]}
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

      {leads(me) && <Abrir depois={certificados.recarregar} />}
      <Aviso texto={termo.erro || minhas.erro || certificados.erro || acao.aviso} />
    </div>
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

/** Só o líder: abre o processo de um certificado e indica quem assina com ele. */
function Abrir({ depois }: { depois: () => void }) {
  const pessoas = useLista<Pessoa[]>("voluntarios_listar");
  const acao = useAcao(depois);
  const [form, setForm] = useState({ usuario: "", educador: "", vice: "", inicio: "", fim: new Date().toLocaleDateString("sv-SE"), atividades: "" });
  const equipe = pessoas.dados?.filter((pessoa) => pessoa.papeis.length > 0) ?? [];
  const tem = (pessoa: Pessoa, papel: string) => pessoa.papeis.some((item) => item.papel === papel);
  const educadores = equipe.filter((pessoa) => pessoa.id !== form.usuario && tem(pessoa, "educacao") && !tem(pessoa, "coordenacao"));
  const vices = equipe.filter((pessoa) => pessoa.id !== form.usuario && pessoa.id !== form.educador && tem(pessoa, "vice"));

  return (
    <section>
      <h2 className="font-serif text-2xl font-semibold">Abrir um certificado</h2>
      <p className="mt-1 max-w-3xl text-ink-soft">
        Entram no certificado as horas já confirmadas da pessoa dentro do período. Ele é assinado por um educador, pelo vice-líder e por você: cada um assina na própria conta, e a sua assinatura, a última, é a emissão. Ninguém assina o próprio certificado. O CPF não é guardado: quem salva o PDF digita na hora.
      </p>
      <form
        className="mt-3 max-w-3xl space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await acao.agir("certificado_abrir", { p: form }, "Processo aberto. Quem assina já foi avisado.")) setForm({ ...form, usuario: "", educador: "", vice: "", atividades: "" });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            Quem recebe
            <select value={form.usuario} onChange={(e) => setForm({ ...form, usuario: e.target.value, educador: "", vice: "" })} required className={campo}>
              <option value="">Escolha…</option>
              {equipe.map((pessoa) => (
                <option key={pessoa.id} value={pessoa.id}>
                  {pessoa.nome}
                </option>
              ))}
            </select>
          </label>
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
          <label className="block">
            Educador(a) que assina
            <select value={form.educador} onChange={(e) => setForm({ ...form, educador: e.target.value, vice: "" })} required className={campo}>
              <option value="">Escolha…</option>
              {educadores.map((pessoa) => (
                <option key={pessoa.id} value={pessoa.id}>
                  {pessoa.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Vice-líder que assina
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
            {vices.length === 0 ? "Não há vice-líder disponível para assinar: nomeie um em Voluntários e convites." : ""}
          </p>
        )}
        <button type="submit" className={botao} disabled={acao.ocupado || !form.usuario || !form.educador || vices.length === 0}>
          Abrir processo
        </button>
        <Aviso texto={pessoas.erro || acao.aviso} />
      </form>
    </section>
  );
}

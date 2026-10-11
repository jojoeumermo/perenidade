// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { can, leads, type Me } from "@/lib/backend";
import { site } from "@/lib/site";
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

interface Testemunha {
  id: string;
  nome: string;
  confirmou_em: string | null;
}

interface Certificado {
  id: string;
  codigo: string;
  usuario: string | null;
  nome: string;
  horas: number;
  inicio: string;
  fim: string;
  atividades: string;
  testemunhas: Testemunha[];
  status: "aberto" | "emitido" | "cancelado";
  emitido_em: string | null;
}

interface Pessoa {
  id: string;
  nome: string;
  email: string;
  papeis: { papel: string }[];
}

const situacao: Record<string, string> = { pendente: "aguardando conferência", confirmada: "confirmada", recusada: "não confirmada", aberto: "aguardando testemunhas", emitido: "emitido", cancelado: "cancelado" };
const horasPt = (valor: number) => `${String(valor).replace(".", ",")} h`;
const codigoBonito = (codigo: string) => codigo.replace(/(.{4})(?=.)/g, "$1-");

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
        Versão de teste. O certificado traz um código que qualquer pessoa confere na página Conferir certificado. A aceitação como horas complementares depende de cada faculdade: pergunte na coordenação do seu curso antes de contar com ele.
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
            const falta = certificado.testemunhas.find((testemunha) => testemunha.id === me.id && !testemunha.confirmou_em);
            return (
              <li key={certificado.id} className="border border-rule bg-parchment-deep p-4">
                <p className={rotulo}>
                  {situacao[certificado.status]} · {dia(certificado.inicio)} a {dia(certificado.fim)} · {horasPt(Number(certificado.horas))}
                </p>
                <p className="mt-1 font-serif text-xl font-semibold">{certificado.nome}</p>
                <p className="mt-1 whitespace-pre-line">{certificado.atividades}</p>
                {certificado.testemunhas.length > 0 && (
                  <p className="mt-1 text-ink-soft">
                    Testemunhas: {certificado.testemunhas.map((testemunha) => `${testemunha.nome} (${testemunha.confirmou_em ? "confirmou" : "falta confirmar"})`).join(", ")}
                  </p>
                )}
                <p className="mt-3 flex flex-wrap gap-3">
                  {falta && certificado.status === "aberto" && (
                    <button type="button" className={botao} disabled={acao.ocupado} onClick={() => acao.agir("certificado_testemunhar", { p_id: certificado.id }, "Testemunho registrado.")}>
                      Confirmo que acompanhei este trabalho
                    </button>
                  )}
                  {leads(me) && certificado.status === "aberto" && (
                    <button type="button" className={botao} disabled={acao.ocupado || certificado.testemunhas.some((testemunha) => !testemunha.confirmou_em)} onClick={() => acao.agir("certificado_emitir", { p_id: certificado.id }, "Certificado emitido.")}>
                      Emitir
                    </button>
                  )}
                  {certificado.status === "emitido" && (
                    <button type="button" className={botaoClaro} onClick={() => setVer(certificado)}>
                      Ver e imprimir
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

/** Só a coordenação: abre o processo de um certificado, com as testemunhas que acompanharam o trabalho. */
function Abrir({ depois }: { depois: () => void }) {
  const pessoas = useLista<Pessoa[]>("voluntarios_listar");
  const acao = useAcao(depois);
  const [form, setForm] = useState({ usuario: "", inicio: "", fim: new Date().toLocaleDateString("sv-SE"), atividades: "" });
  const [testemunhas, setTestemunhas] = useState<string[]>([]);
  const equipe = pessoas.dados?.filter((pessoa) => pessoa.papeis.length > 0) ?? [];
  const aptas = equipe.filter((pessoa) => pessoa.id !== form.usuario && pessoa.papeis.some((papel) => ["educacao", "curadoria", "vice"].includes(papel.papel)));

  return (
    <section>
      <h2 className="font-serif text-2xl font-semibold">Abrir um certificado</h2>
      <p className="mt-1 max-w-3xl text-ink-soft">
        Entram no certificado as horas já confirmadas da pessoa dentro do período. Cada testemunha precisa confirmar pelo próprio painel antes da emissão. O CPF não é guardado: quem imprime digita na hora.
      </p>
      <form
        className="mt-3 max-w-3xl space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await acao.agir("certificado_abrir", { p: { ...form, testemunhas } }, "Processo aberto. As testemunhas foram avisadas.")) {
            setForm({ ...form, usuario: "", atividades: "" });
            setTestemunhas([]);
          }
        }}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            Quem recebe
            <select value={form.usuario} onChange={(e) => { setForm({ ...form, usuario: e.target.value }); setTestemunhas([]); }} required className={campo}>
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
          <textarea value={form.atividades} onChange={(e) => setForm({ ...form, atividades: e.target.value })} rows={3} required minLength={10} maxLength={3000} className={campo} />
        </label>
        <fieldset>
          <legend>Testemunhas (educadores, curadoria ou vice-coordenação)</legend>
          <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
            {aptas.map((pessoa) => (
              <label key={pessoa.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={testemunhas.includes(pessoa.id)}
                  onChange={(e) => setTestemunhas(e.target.checked ? [...testemunhas, pessoa.id].slice(0, 5) : testemunhas.filter((id) => id !== pessoa.id))}
                />
                {pessoa.nome}
              </label>
            ))}
            {aptas.length === 0 && <span className="text-ink-soft">Ninguém apto ainda.</span>}
          </div>
        </fieldset>
        <button type="submit" className={botao} disabled={acao.ocupado || !form.usuario}>
          Abrir processo
        </button>
        <Aviso texto={pessoas.erro || acao.aviso} />
      </form>
    </section>
  );
}

/** A folha que vai para a faculdade. Só o certificado sai na impressão. */
function Impresso({ certificado, fechar }: { certificado: Certificado; fechar: () => void }) {
  const [cpf, setCpf] = useState("");
  const [assina, setAssina] = useState("");
  const endereco = `${site.url}/pt/certificado?codigo=${certificado.codigo}`;
  return (
    <div>
      <div className="no-print mb-6 flex flex-wrap items-end gap-3">
        <label className="block">
          CPF de quem recebe (não é guardado)
          <input value={cpf} onChange={(e) => setCpf(e.target.value)} maxLength={14} inputMode="numeric" placeholder="000.000.000-00" className={campo} />
        </label>
        <label className="block min-w-60 flex-1">
          Nome de quem assina pela coordenação do projeto
          <input value={assina} onChange={(e) => setAssina(e.target.value)} maxLength={120} className={campo} />
        </label>
        <button type="button" className={botao} onClick={() => window.print()}>
          Imprimir ou salvar em PDF
        </button>
        <button type="button" className={botaoClaro} onClick={fechar}>
          Voltar
        </button>
      </div>
      <article className="mx-auto max-w-3xl border-4 border-double border-ink bg-parchment px-8 py-10 text-center font-serif text-ink print:border-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/emblema.png" alt="" width={96} height={96} className="mx-auto h-24 w-24" />
        <p className="mt-3 font-mono text-xs uppercase tracking-[0.3em]">{site.name}</p>
        <h2 className="mt-4 text-4xl font-semibold">Certificado de trabalho voluntário</h2>
        <p className="mt-8 text-xl leading-relaxed">
          Certificamos que <strong>{certificado.nome}</strong>
          {cpf.trim() && <>, CPF {cpf.trim()},</>} atuou como voluntária(o) no {site.name}, projeto educacional gratuito e sem fins lucrativos, no período de <strong>{dia(certificado.inicio)}</strong> a{" "}
          <strong>{dia(certificado.fim)}</strong>, cumprindo carga horária total de <strong>{horasPt(Number(certificado.horas)).replace(" h", " horas")}</strong>.
        </p>
        <p className="mt-6 text-left text-lg">
          <strong>Atividades realizadas:</strong>
        </p>
        <p className="mt-1 whitespace-pre-line text-left text-lg">{certificado.atividades}</p>
        <p className="mt-6 text-left text-base">
          O trabalho foi prestado sem remuneração, nos termos da Lei nº 9.608/1998, mediante termo de adesão aceito pela pessoa voluntária.
        </p>
        <div className="mt-14 grid gap-10 text-base sm:grid-cols-2">
          <div>
            <p className="border-t border-ink pt-2">{assina.trim() || " "}</p>
            <p className="text-sm">Coordenação do projeto</p>
          </div>
          {certificado.testemunhas.map((testemunha) => (
            <div key={testemunha.id}>
              <p className="border-t border-ink pt-2">{testemunha.nome}</p>
              <p className="text-sm">Testemunha · confirmou em {dia(testemunha.confirmou_em ?? "")}</p>
            </div>
          ))}
        </div>
        <p className="mt-10 font-mono text-xs">
          Emitido em {dia(certificado.emitido_em ?? "")} · código {codigoBonito(certificado.codigo)}
        </p>
        <p className="mt-1 break-all font-mono text-xs">Confira a autenticidade em {endereco}</p>
      </article>
    </div>
  );
}

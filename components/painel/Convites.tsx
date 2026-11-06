// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Ban, Check, Copy, Link2, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { leads, rpc, type Me, type Role } from "@/lib/backend";
import { useI18n } from "../I18n";
import { Aviso, dataHora, papelAposentado, papeis, textoDoErro, useAcao, useLista } from "./comum";
import { EscolhaDeFuncoes, type FuncaoEscolhida, nomeDaFuncao } from "./EscolhaDeFuncoes";
import { NOMES_DOS_DEPARTAMENTOS_DO_INSTITUTO } from "./departamentos-do-instituto";
import { Abas, Botao, Busca, CabecalhoDeSecao, Campo, Cartao, Esqueleto, ItemDeLista, Lista, Selo, type TomDoSelo, Vazio } from "./ui";

interface Convite {
  id: string;
  email: string;
  papel: Role["papel"] | null;
  disciplina: string | null;
  usos: number;
  usos_max: number;
  nota: string;
  criado_em: string;
  expira_em: string;
  de: string;
  valido: boolean;
  /** Desde novembro de 2026 (supabase/migracoes/20261106-pessoas-painel.sql): situação, funções a mais, departamentos e quem usou. */
  situacao?: Situacao;
  revogado?: boolean;
  extras?: FuncaoEscolhida[];
  departamentos?: string[];
  usado_por?: string[];
}
type Situacao = "valendo" | "usado" | "vencido" | "cancelado";
type Filtro = "valendo" | "usado" | "encerrado" | "todos";

/** A situação do convite (o banco de antes da migração só mandava "valido"). */
const situacaoDe = (c: Convite, agora: number): Situacao =>
  c.situacao ?? (c.valido ? "valendo" : c.usos >= c.usos_max ? "usado" : new Date(c.expira_em).getTime() <= agora ? "vencido" : "cancelado");
const SELO_DA_SITUACAO: Record<Situacao, [string, TomDoSelo]> = { valendo: ["esperando", "aviso"], usado: ["usado", "ok"], vencido: ["vencido", "neutro"], cancelado: ["cancelado", "neutro"] };
const grupoDe = (s: Situacao): Exclude<Filtro, "todos"> => (s === "valendo" ? "valendo" : s === "usado" ? "usado" : "encerrado");
const EXPLICACAO: Record<Filtro, string> = {
  valendo: "Os que ainda esperam alguém abrir, o que vence antes no topo.",
  usado: "Os que já viraram conta, o mais novo no topo.",
  encerrado: "Os que venceram sem uso ou foram cancelados. Para chamar a pessoa de novo, faça outro convite.",
  todos: "Todos os convites, o mais novo no topo.",
};

/**
 * Não existe cadastro aberto: toda conta nasce de um convite feito aqui. O endereço aparece uma única vez,
 * logo depois de criado; o banco guarda só um resumo dele, que não serve para entrar.
 */
export function Convites({ me }: { me: Me }) {
  const { lang, t } = useI18n();
  const lider = leads(me);
  const lista = useLista<Convite[]>("convites_listar");
  const acao = useAcao(lista.recarregar);
  const [tipo, setTipo] = useState<"pessoal" | "comunidade">("pessoal");
  const [email, setEmail] = useState("");
  // Várias funções e departamentos num convite só (T28): a primeira função vai como a principal, as outras como extras.
  const [escolhidas, setEscolhidas] = useState<FuncaoEscolhida[]>([]);
  const [deps, setDeps] = useState<string[]>([]);
  const [usos, setUsos] = useState(20);
  const [dias, setDias] = useState(7);
  const [nota, setNota] = useState("");
  const [link, setLink] = useState("");
  /** O convite pessoal saiu sozinho por e-mail. */
  const [enviado, setEnviado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>("valendo");
  const [busca, setBusca] = useState("");
  const [agora] = useState(() => Date.now());
  // A coordenação não se convida (muda de mãos em Segurança e sucessão); vice e curadoria, só o coordenador convida.
  // O representante se nomeia depois, em Confiar função (o convite não traz departamento a representar).
  const funcoes = (Object.keys(papeis) as Role["papel"][]).filter((p) => p !== "coordenacao" && p !== "representante" && !papelAposentado(p) && (lider || (p !== "vice" && p !== "supervisao" && p !== "curadoria")));
  const nomeDaArea = (slug: string) => t.areas[slug as keyof typeof t.areas]?.[0] ?? slug;
  const nomeDoConvite = (c: Convite) => {
    const todas: FuncaoEscolhida[] = [...(c.papel ? [{ papel: c.papel, disciplina: c.disciplina }] : []), ...(c.extras ?? [])];
    return todas.length ? todas.map((f) => nomeDaFuncao(f, nomeDaArea)).join(" + ") : "sem função";
  };

  // A lista organizada (T29): separada pela situação, os que esperam primeiro (o que vence antes no topo), com busca.
  const organizados = useMemo(() => {
    const todos = (lista.dados ?? []).map((c) => ({ ...c, sit: situacaoDe(c, agora) }));
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    const achados = termo ? todos.filter((c) => `${c.email} ${c.nota} ${c.de} ${(c.usado_por ?? []).join(" ")}`.toLocaleLowerCase("pt-BR").includes(termo)) : todos;
    const contagem: Record<Filtro, number> = { valendo: 0, usado: 0, encerrado: 0, todos: achados.length };
    for (const c of achados) contagem[grupoDe(c.sit)]++;
    const visiveis = achados
      .filter((c) => filtro === "todos" || grupoDe(c.sit) === filtro)
      .sort((a, b) => (filtro === "valendo" ? new Date(a.expira_em).getTime() - new Date(b.expira_em).getTime() : new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()));
    return { contagem, visiveis };
  }, [lista.dados, busca, filtro, agora]);
  const diasAte = (iso: string) => Math.ceil((new Date(iso).getTime() - agora) / 86_400_000);

  async function criar() {
    setOcupado(true);
    setErro("");
    setLink("");
    setCopiado(false);
    try {
      const [principal, ...extras] = escolhidas;
      const p = tipo === "pessoal" ? { email, papel: principal?.papel ?? "", disciplina: principal?.disciplina ?? "", extras, departamentos: deps, dias, nota } : { usos, dias, nota };
      const resposta = await rpc<{ codigo: string; email_enviado?: boolean }>("convite_criar", { p });
      setLink(`${window.location.origin}/${lang}/entrar?convite=${resposta.codigo}`);
      setEnviado(Boolean(resposta.email_enviado));
      setEmail("");
      setNota("");
      setEscolhidas([]);
      setDeps([]);
      lista.recarregar();
    } catch (falha) {
      setErro(textoDoErro(falha));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section aria-labelledby="convites-titulo" className="space-y-4">
      <CabecalhoDeSecao
        id="convites-titulo"
        titulo="Convites"
        simbolo={Send}
        sobre="Ninguém se cadastra sozinho: a conta só é criada por quem abre um convite. Mande o endereço por um canal seguro. Ele vale até a data marcada e pode ser cancelado a qualquer momento."
      />
      <Cartao as="div" className="max-w-3xl">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void criar();
          }}
        >
          <fieldset className="flex flex-wrap gap-x-6 gap-y-2">
            <legend className="sr-only">Tipo de convite</legend>
            <label className="pn-marca">
              <input type="radio" name="tipo-convite" checked={tipo === "pessoal"} onChange={() => setTipo("pessoal")} /> <span>Para uma pessoa (com ou sem função)</span>
            </label>
            <label className="pn-marca">
              <input type="radio" name="tipo-convite" checked={tipo === "comunidade"} onChange={() => setTipo("comunidade")} /> <span>Para um grupo da comunidade (sem função)</span>
            </label>
          </fieldset>
          {tipo === "pessoal" ? (
            <>
              <Campo rotulo="E-mail da pessoa" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              <EscolhaDeFuncoes concediveis={funcoes} escolhidas={escolhidas} aoMudar={setEscolhidas} departamentos={deps} aoMudarDepartamentos={setDeps} podeSensivel />
              <p className="pn-ajuda">Sem nenhuma função, a pessoa só participa da comunidade. O e-mail do convite diz as funções, nunca os departamentos.</p>
            </>
          ) : (
            <div className="max-w-xs">
              <Campo rotulo="Para quantas pessoas (até 200)" type="number" min={2} max={200} required value={usos} onChange={(e) => setUsos(Number(e.target.value))} />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Vale por quantos dias (1 a 30)" type="number" min={1} max={30} required value={dias} onChange={(e) => setDias(Number(e.target.value))} />
            <Campo rotulo="Lembrete para a equipe (opcional)" value={nota} maxLength={120} onChange={(e) => setNota(e.target.value)} placeholder="Ex.: grupo do cursinho popular" />
          </div>
          <Botao type="submit" variante="principal" simbolo={Link2} carregando={ocupado}>
            Criar convite
          </Botao>
          <Aviso texto={erro} />
        </form>
      </Cartao>
      {link && (
        <Cartao as="div" variante="destaque" role="status" className="max-w-2xl">
          {enviado && <p className="mb-2">O convite entrou na fila de e-mails e sai sozinho para a pessoa (veja em Controles do site se o envio está funcionando). O endereço abaixo é para o caso de você querer mandar também por outro caminho.</p>}
          <p className="font-semibold">Copie agora: este endereço não será mostrado de novo.</p>
          <p className="mt-2 break-all rounded-md border border-rule bg-parchment-deep p-2 font-mono text-sm">{link}</p>
          <Botao
            className="mt-3"
            simbolo={copiado ? Check : Copy}
            onClick={() => {
              void navigator.clipboard.writeText(link).then(() => setCopiado(true));
            }}
          >
            {copiado ? "Copiado" : "Copiar endereço"}
          </Botao>
        </Cartao>
      )}
      <Aviso texto={lista.erro || acao.aviso} />
      {!lista.dados && !lista.erro && <Esqueleto forma="fila" linhas={3} rotulo="Carregando os convites" />}
      {lista.dados && lista.dados.length > 0 && (
        <section aria-labelledby="convites-lista" className="space-y-3">
          <h3 id="convites-lista" className="font-semibold">
            Convites feitos
          </h3>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <Abas
              rotulo="Mostrar os convites"
              valor={filtro}
              aoMudar={setFiltro}
              opcoes={[
                { id: "valendo", nome: "Esperando", conta: organizados.contagem.valendo },
                { id: "usado", nome: "Usados" },
                { id: "encerrado", nome: "Vencidos e cancelados" },
                { id: "todos", nome: "Todos" },
              ]}
            />
            <Busca rotulo="Procurar convite por e-mail, lembrete ou nome" valor={busca} aoMudar={setBusca} placeholder="Procurar por e-mail, lembrete ou nome…" className="w-full sm:w-72" />
          </div>
          <p className="pn-ajuda">
            {EXPLICACAO[filtro]} {organizados.contagem.valendo} esperando · {organizados.contagem.usado} usados · {organizados.contagem.encerrado} vencidos ou cancelados.
          </p>
          {organizados.visiveis.length === 0 ? (
            <Vazio titulo={busca ? "Nenhum convite com essa busca." : filtro === "valendo" ? "Nenhum convite esperando." : "Nenhum convite aqui."} />
          ) : (
            <Lista rotulo="Convites">
              {organizados.visiveis.map((convite) => {
                const [rotulo, tom] = SELO_DA_SITUACAO[convite.sit];
                const faltam = diasAte(convite.expira_em);
                const venceLogo = convite.sit === "valendo" && faltam <= 2;
                return (
                  <ItemDeLista
                    key={convite.id}
                    className={convite.sit === "valendo" ? undefined : "opacity-75"}
                    titulo={
                      <>
                        <span className="break-all">{convite.email || "Comunidade"}</span> · {nomeDoConvite(convite)}
                      </>
                    }
                    meta={
                      <>
                        {convite.nota && `${convite.nota} · `}criado por {convite.de || "coordenação"} em {dataHora(convite.criado_em)}
                        {convite.sit === "valendo" && ` · vale até ${dataHora(convite.expira_em)}${venceLogo ? " (vence logo)" : ""}`}
                        {convite.sit === "vencido" && ` · venceu em ${dataHora(convite.expira_em)}`}
                        {(convite.usado_por?.length ?? 0) > 0 && ` · conta de ${convite.usado_por?.join(", ")}`}
                        {(convite.departamentos?.length ?? 0) > 0 && ` · departamentos: ${convite.departamentos?.map((d) => NOMES_DOS_DEPARTAMENTOS_DO_INSTITUTO[d] ?? d).join(", ")}`}
                        {convite.usos_max > 1 && ` · usado ${convite.usos} de ${convite.usos_max}`}
                      </>
                    }
                    selo={<Selo tom={venceLogo ? "erro" : tom}>{venceLogo ? "vence logo" : rotulo}</Selo>}
                    acoes={
                      convite.sit === "valendo" && (
                        <Botao variante="discreto" pequeno perigo simbolo={Ban} disabled={acao.ocupado} aria-label={`Cancelar o convite de ${convite.email || "comunidade"}`} onClick={() => void acao.agir("convite_revogar", { p_id: convite.id }, "Convite cancelado.")}>
                          Cancelar
                        </Botao>
                      )
                    }
                  />
                );
              })}
            </Lista>
          )}
        </section>
      )}
    </section>
  );
}

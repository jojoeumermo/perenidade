// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Check, ClipboardCopy, Copy, KeyRound, Mail, Plus, RotateCcw, Save, ShieldAlert, UserCheck, WandSparkles, X } from "lucide-react";
import { useState } from "react";
import { can, leads, type Me, nivelDe, nivelDoPapel, porNivel, type Role, rpc } from "@/lib/backend";
import { useI18n } from "../I18n";
import { Aviso, data, dataHora, nomeDoDepartamento, oQueFaz, PAINEL_MUDOU, papelAposentado, papeis, textoDoErro, useAcao, useLista } from "./comum";
import { Abas, Area, Botao, CabecalhoDeSecao, Campo, Cartao, Esqueleto, Faixa, Vazio } from "./ui";
import { BuscaDePessoa, type PessoaAchada } from "./BuscaDePessoa";
import { Convites } from "./Convites";
import { Departamentos, FotosParaAprovar, TermosAceitos } from "./PessoasExtras";
import { ListaDePessoas } from "./ListaDePessoas";
import { EscolhaDeFuncoes, type FuncaoEscolhida } from "./EscolhaDeFuncoes";
import { NOMES_DOS_DEPARTAMENTOS_DO_INSTITUTO } from "./departamentos-do-instituto";
import { TrocarEmail } from "./TrocarEmail";

interface Candidatura {
  id: string;
  papel: Role["papel"];
  disciplina: string | null;
  mensagem: string;
  status: string;
  criado_em: string;
  nome: string;
  email: string;
}

/** Candidatura feita pelo formulário público, por quem ainda não tinha conta (ou não estava logado). */
interface Inscricao {
  id: string;
  nome: string;
  email: string;
  papel: Role["papel"];
  disciplina: string | null;
  mensagem: string;
  status: string;
  criado_em: string;
  tem_conta: boolean;
  /** O Instagram que a pessoa informou (sem o @), quando informou. */
  instagram?: string | null;
}

interface Pessoa {
  id: string;
  nome: string;
  bio?: string;
  /** Vazio para quem não é da coordenação (a supervisão não vê e-mails). */
  email: string;
  suspenso: boolean;
  /** Quem suspendeu: coordenação, supervisão, mediação (banimento) ou o próprio banco (isca). */
  suspensao?: string;
  /** A coordenação redefiniu a senha e a pessoa ainda não escolheu outra. */
  trocar_senha?: boolean;
  visto_em: string;
  criado_em?: string;
  /** O nível da pessoa na hierarquia de cargos (o maior entre os papéis dela). */
  nivel: number;
  papeis: Role[];
  /** Os departamentos de participação (Parcerias, RH…). Revolucionários só vem para a coordenação. */
  departamentos?: string[];
}

/** Sem letras que se confundem (l, 1, O, 0): a senha vai ser lida em voz alta ou copiada à mão. */
const LETRAS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Uma senha forte gerada neste navegador: 20 caracteres em quatro blocos, fácil de ditar. Nada sai daqui antes de guardar. */
function senhaForte(): string {
  const numeros = crypto.getRandomValues(new Uint32Array(20));
  const letras = Array.from(numeros, (n) => LETRAS[n % LETRAS.length]).join("");
  return letras.match(/.{5}/g)?.join("-") ?? letras;
}

const suspensoPor: Record<string, string> = { coordenacao: "pela coordenação", supervisao: "pela supervisão", mediacao: "por banimento da mediação", sistema: "pelo banco, depois de uma função-isca" };

/**
 * A ficha de uma pessoa da equipe, aberta pela coordenação: acertar nome e apresentação, redefinir a senha de quem
 * esqueceu, trocar o e-mail a pedido da pessoa (só a coordenação comunitária) e suspender ou reativar. Nada disso aparece
 * na própria ficha de quem está vendo.
 */
function Ficha({ pessoa, me, depois, estreita = false }: { pessoa: Pessoa; me: Me; depois: () => void; estreita?: boolean }) {
  const lider = leads(me);
  const [nome, setNome] = useState(pessoa.nome);
  const [bio, setBio] = useState(pessoa.bio ?? "");
  const [motivo, setMotivo] = useState("");
  const [senha, setSenha] = useState("");
  /** A senha que acabou de ser guardada: aparece uma vez só, para ser entregue por um canal seguro. */
  const [entregar, setEntregar] = useState("");
  const acao = useAcao(depois);
  const eu = pessoa.id === me.id;
  const coordenacao = pessoa.papeis.some((papel) => papel.papel === "coordenacao");
  const vice = pessoa.papeis.some((papel) => papel.papel === "vice");
  // O banco recusa o mesmo: ninguém mexe na coordenação por aqui, e a vice-coordenação não mexe em outra vice.
  const alcanca = !eu && !coordenacao && (lider || !vice);
  if (eu) return <p className="mt-2 text-ink-soft">Esta é a sua conta: nome, senha e proteção ficam em Minha conta.</p>;
  if (!alcanca) return <p className="mt-2 text-ink-soft">{coordenacao ? "A conta da coordenação não se edita nem se suspende por aqui." : "Só a coordenação mexe na conta de outra vice-coordenação."}</p>;

  async function redefinir() {
    const nova = senha.trim();
    if (await acao.agir("usuario_senha_redefinir", { p_usuario: pessoa.id, p_senha: nova }, "Senha redefinida. A pessoa saiu de todos os aparelhos e vai escolher outra no próximo acesso.")) {
      setEntregar(nova);
      setSenha("");
    }
  }

  return (
    <div className={`mt-3 grid gap-5 border-t border-rule pt-4 ${estreita ? "" : lider ? "lg:grid-cols-2 xl:grid-cols-4" : "lg:grid-cols-3"}`}>
      <section className="space-y-2">
        <h3 className="font-semibold">Nome e apresentação</h3>
        <p className="pn-ajuda">Para acertar um nome ofensivo, um dado pessoal exposto ou o pedido de quem não consegue entrar.{lider ? " O e-mail se troca logo abaixo." : " O e-mail só a coordenação comunitária troca."}</p>
        <Campo rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} />
        <Area rotulo="Apresentação" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={3} />
        <Botao pequeno simbolo={Save} disabled={nome.trim().length < 2 || (nome === pessoa.nome && bio === (pessoa.bio ?? ""))} carregando={acao.ocupado} onClick={() => acao.agir("usuario_editar", { p_usuario: pessoa.id, p_nome: nome.trim(), p_bio: bio.trim() }, "Guardado. A pessoa recebeu um recado.")}>
          Guardar
        </Botao>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Redefinir a senha</h3>
        <p className="pn-ajuda">Para quem esqueceu a própria. A pessoa sai de todos os aparelhos e, ao entrar com a senha nova, escolhe outra antes de o painel abrir.</p>
        {entregar ? (
          <Cartao as="div" variante="destaque" role="status">
            <p>Senha nova de {pessoa.nome} (aparece só agora):</p>
            <p className="mt-1 select-all break-all font-mono text-base">{entregar}</p>
            <p className="pn-ajuda mt-1">Entregue por um canal seguro (pessoalmente, ligação ou mensagem que some), nunca por e-mail nem no mural.</p>
            <p className="mt-2 flex flex-wrap gap-2">
              <Botao pequeno simbolo={Copy} onClick={() => void navigator.clipboard?.writeText(entregar)}>
                Copiar
              </Botao>
              <Botao pequeno variante="discreto" simbolo={Check} onClick={() => setEntregar("")}>
                Já entreguei
              </Botao>
            </p>
          </Cartao>
        ) : (
          <>
            <Campo rotulo="Senha nova (pelo menos 12 caracteres)" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="off" spellCheck={false} maxLength={72} className="font-mono" />
            <p className="flex flex-wrap gap-2">
              <Botao pequeno simbolo={WandSparkles} onClick={() => setSenha(senhaForte())}>
                Gerar uma senha forte
              </Botao>
              <Botao pequeno simbolo={KeyRound} disabled={senha.trim().length < 12} carregando={acao.ocupado} onClick={() => void redefinir()}>
                Redefinir
              </Botao>
            </p>
          </>
        )}
        {pessoa.trocar_senha && !entregar && <p className="pn-ajuda">A pessoa ainda não escolheu a própria senha depois da última redefinição.</p>}
      </section>

      {lider && <TrocarEmail pessoa={pessoa} depois={depois} />}

      <section className="space-y-2">
        <h3 className="font-semibold">{pessoa.suspenso ? "Conta suspensa" : "Suspender a conta"}</h3>
        <p className="pn-ajuda">
          {pessoa.suspenso ? `Suspensa ${suspensoPor[pessoa.suspensao ?? ""] ?? ""}: lê, mas não envia. Reativar também desfaz um banimento.` : "A conta continua existindo e lendo, mas não envia nada, nem pelo painel."}
        </p>
        {!pessoa.suspenso && <Campo rotulo="Motivo (vai para o registro)" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} />}
        <Botao
          pequeno
          perigo={!pessoa.suspenso}
          simbolo={pessoa.suspenso ? RotateCcw : ShieldAlert}
          carregando={acao.ocupado}
          onClick={() => acao.agir("usuario_suspender", { p_usuario: pessoa.id, p_suspenso: !pessoa.suspenso, p_motivo: motivo.trim() }, pessoa.suspenso ? "Conta reativada." : "Conta suspensa.")}
        >
          {pessoa.suspenso ? "Reativar a conta" : "Suspender a conta"}
        </Botao>
      </section>
      <div className="lg:col-span-full">
        <Aviso texto={acao.aviso} />
      </div>
    </div>
  );
}


interface Lance {
  id: number;
  papel: Role["papel"];
  disciplina: string | null;
  concedido_por: string;
  concedido_em: string;
  removido_por: string | null;
  removido_em: string | null;
}

/**
 * Coordenação, vice-coordenação e supervisão: confiar e retirar papéis (uma pessoa acumula quantos forem confiados).
 * Coordenação e vice também aceitam pedidos de voluntariado, convidam e suspendem contas.
 * A hierarquia é a do banco: ninguém confia papel de nível igual ou maior que o próprio, nem mexe em quem está no mesmo
 * nível ou acima. A tela só esconde o que o banco recusaria; a regra de verdade é conferida lá.
 */
export function Pessoas({ me }: { me: Me }) {
  const { t } = useI18n();
  const lider = leads(me);
  const coordena = can(me, "coordenacao");
  const meuNivel = me.nivel ?? nivelDe(me.papeis);
  // A coordenação não se concede por aqui (muda de mãos em Segurança e sucessão); vice e supervisão, só a coordenação nomeia;
  // curadoria e mediação ficam com coordenação e vice.
  const concediveis = (Object.keys(papeis) as Role["papel"][]).filter(
    (papel) => papel !== "coordenacao" && !papelAposentado(papel) && nivelDoPapel(papel) < meuNivel && (!["vice", "supervisao"].includes(papel) || lider) && (!["curadoria", "mediacao"].includes(papel) || coordena),
  );
  /** Posso mexer nos cargos desta pessoa? Nunca nos meus; a coordenação em todos; os outros, só em quem está abaixo. */
  const podeMexer = (pessoa: { id: string; nivel: number }) => pessoa.id !== me.id && (lider || pessoa.nivel < meuNivel);
  const podeTirar = (pessoa: Pessoa, papel: Role) => podeMexer(pessoa) && (!["coordenacao", "vice", "supervisao"].includes(papel.papel) || lider);
  const pedidos = useLista<Candidatura[]>(coordena ? "candidaturas_listar" : "candidaturas_minhas");
  const pessoas = useLista<Pessoa[]>("voluntarios_listar");
  const inscricoes = useLista<Inscricao[]>(coordena ? "inscricoes_listar" : "candidaturas_minhas");
  const { lang } = useI18n();
  /** O convite recém-gerado para quem foi aceito: aparece uma vez só, para a coordenação mandar por e-mail. */
  const [aceite, setAceite] = useState<{ nome: string; email: string; link: string } | null>(null);
  const [avisoInscricao, setAvisoInscricao] = useState("");
  const novas = inscricoes.dados?.filter((item) => item.status === "pendente") ?? [];

  async function decidirInscricao(item: Inscricao, aceitar: boolean) {
    setAvisoInscricao("");
    try {
      const resposta = await rpc<{ codigo: string | null; email: string; nome: string }>("inscricao_decidir", { p_id: item.id, p_aceitar: aceitar });
      if (aceitar && resposta.codigo) setAceite({ nome: item.nome, email: item.email, link: `${window.location.origin}/${lang}/entrar?convite=${resposta.codigo}` });
      setAvisoInscricao(!aceitar ? "Candidatura recusada. O aviso por e-mail entrou na fila de envio." : resposta.codigo ? "Candidatura aceita. O convite entrou na fila de e-mails e sai sozinho para a pessoa; o link também está abaixo, se precisar mandar por outro caminho (veja em Controles do site se o envio está funcionando)." : "Candidatura aceita: a pessoa já tinha conta e recebeu a função na hora. O aviso por e-mail entrou na fila de envio.");
      inscricoes.recarregar();
      pessoas.recarregar();
      window.dispatchEvent(new Event(PAINEL_MUDOU));
    } catch (erro) {
      setAvisoInscricao(textoDoErro(erro));
    }
  }
  const acao = useAcao(() => {
    pedidos.recarregar();
    pessoas.recarregar();
  });
  // Várias funções, várias disciplinas e vários departamentos de uma vez (T28): tudo vai numa ação só
  // (public.papeis_conceder_varios), com as regras de nível de sempre conferidas no banco.
  const [escolhidas, setEscolhidas] = useState<FuncaoEscolhida[]>([]);
  const [deps, setDeps] = useState<string[]>([]);
  const nadaEscolhido = escolhidas.length === 0 && deps.length === 0;
  const limparEscolha = () => {
    setEscolhidas([]);
    setDeps([]);
  };
  const resumoDoEscolhido = [escolhidas.length === 1 ? "1 função" : escolhidas.length > 1 ? `${escolhidas.length} funções` : "", deps.length === 1 ? "1 departamento" : deps.length > 1 ? `${deps.length} departamentos` : ""].filter(Boolean).join(" e ");
  /** Quem vai receber a função: escolhida na busca, não numa lista com todo mundo. */
  const [quem, setQuem] = useState<PessoaAchada | null>(null);
  /** Pessoas escolhidas na tabela para receber a mesma função de uma vez. */
  const [lote, setLote] = useState<string[]>([]);
  const [aba, setAba] = useState<"equipe" | "funcao" | "convites" | "pedidos" | "departamentos" | "fotos" | "termos">("equipe");
  const aprova = can(me, "coordenacao", "vice");
  const nomeDaArea = (slug: string | null) => (slug ? (t.areas[slug as keyof typeof t.areas]?.[0] ?? nomeDoDepartamento(slug)) : "todo o site");
  const pendentes = coordena ? (pedidos.dados?.filter((pedido) => pedido.status === "pendente") ?? []) : [];
  // Quem foi escolhido na busca já vem com o nível: a tela avisa antes de o banco recusar.
  const alvoForaDoAlcance = quem !== null && quem.nivel !== undefined && !podeMexer({ id: quem.id, nivel: quem.nivel });

  return (
    // As abas só escolhem o que aparece: as partes ficam montadas (hidden), para o convite recém-criado não sumir ao trocar de aba.
    <div className="pn-tela">
      <Abas
        rotulo="Voluntários e convites"
        valor={aba}
        aoMudar={setAba}
        opcoes={[
          { id: "equipe", nome: "Pessoas" },
          { id: "funcao", nome: "Confiar função" },
          { id: "departamentos", nome: "Departamentos" },
          ...(coordena ? [{ id: "convites" as const, nome: "Convites" }, { id: "pedidos" as const, nome: "Candidaturas", conta: pendentes.length + novas.length }] : []),
          ...(aprova ? [{ id: "fotos" as const, nome: "Fotos" }, { id: "termos" as const, nome: "Termos aceitos" }] : []),
        ]}
      />
      {aba === "departamentos" && <Departamentos pessoas={pessoas.dados ?? []} />}
      {aprova && aba === "fotos" && <FotosParaAprovar />}
      {aprova && aba === "termos" && <TermosAceitos />}
      {coordena && (
        <div hidden={aba !== "convites"}>
          <Convites me={me} />
        </div>
      )}
      <section hidden={aba !== "pedidos"} aria-labelledby="candidaturas-formulario" className="space-y-3">
        <CabecalhoDeSecao
          id="candidaturas-formulario"
          titulo="Candidaturas pelo formulário"
          sobre={
            <>
              Quem preencheu o formulário de voluntariado no site, com nome e e-mail. Com o envio de e-mails ligado (Controles do site), a pessoa recebe um e-mail dizendo que o pedido chegou, e a coordenação recebe outro avisando do pedido. Ao aceitar, quem ainda não tem conta
              ganha um convite pessoal, que só serve para aquele e-mail e já traz a função, e ele vai sozinho por e-mail. Quem já tem conta recebe a função na hora. Ao recusar, a pessoa também é avisada por e-mail.
            </>
          }
        />
        <Aviso texto={inscricoes.erro || avisoInscricao} />
        {aceite && (
          <Cartao as="div" variante="destaque" role="status" titulo={`Convite de ${aceite.nome}`} nivelDoTitulo={3}>
            <p className="mt-1 text-ink-soft">Este endereço aparece uma vez só e vale por 14 dias. Mande para {aceite.email}.</p>
            <p className="mt-2 select-all break-all rounded-md border border-rule bg-parchment-deep p-2 font-mono text-xs">{aceite.link}</p>
            <p className="mt-3 flex flex-wrap items-center gap-2">
              <Botao simbolo={ClipboardCopy} onClick={() => void navigator.clipboard?.writeText(aceite.link)}>
                Copiar o endereço
              </Botao>
              <a
                className="pn-botao pn-botao-discreto"
                href={`mailto:${aceite.email}?subject=${encodeURIComponent("Sua candidatura ao Instituto Lúcia foi aceita")}&body=${encodeURIComponent(`Olá, ${aceite.nome}.\n\nSua candidatura a voluntário no Instituto Lúcia foi aceita. Para criar a sua conta, já com a função combinada, abra este endereço (ele vale por 14 dias e só serve para este e-mail):\n\n${aceite.link}\n\nAté breve.`)}`}
              >
                <Mail aria-hidden />
                Abrir no programa de e-mail
              </a>
              <Botao variante="discreto" simbolo={Check} onClick={() => setAceite(null)}>
                Já mandei
              </Botao>
            </p>
          </Cartao>
        )}
        {!inscricoes.dados && !inscricoes.erro && <Esqueleto forma="cartoes" linhas={2} />}
        {inscricoes.dados && novas.length === 0 && <Vazio titulo="Nenhuma candidatura aguardando." />}
        <ul className="space-y-4">
          {novas.map((item) => (
            <li key={item.id}>
              <Cartao
                as="article"
                titulo={item.nome}
                nivelDoTitulo={3}
                rodape={
                  <span className="flex gap-2">
                    <Botao pequeno simbolo={UserCheck} onClick={() => void decidirInscricao(item, true)}>
                      Aceitar
                    </Botao>
                    <Botao pequeno variante="discreto" perigo simbolo={X} onClick={() => void decidirInscricao(item, false)}>
                      Recusar
                    </Botao>
                  </span>
                }
              >
              <p className="pn-rotulo-mono mt-1">
                {papeis[item.papel]} · {nomeDaArea(item.disciplina)} · {data(item.criado_em)}
              </p>
              <p className="font-mono text-xs text-ink-soft">
                {item.email}
                {item.instagram && (
                  <>
                    {" · "}
                    <a href={`https://www.instagram.com/${item.instagram}/`} target="_blank" rel="noopener noreferrer" className="underline hover:text-oxblood">@{item.instagram}</a>
                  </>
                )}
                {" · "}{item.tem_conta ? "já tem conta no site" : "ainda sem conta"}
              </p>
              <p className="mt-2 whitespace-pre-line" data-original>{item.mensagem}</p>
              </Cartao>
            </li>
          ))}
        </ul>
      </section>

      <section hidden={aba !== "pedidos"} aria-labelledby="pedidos-painel" className="space-y-3">
        <CabecalhoDeSecao id="pedidos-painel" titulo="Pedidos feitos pelo painel" />
        <Aviso texto={pedidos.erro} />
        {pedidos.dados && pendentes.length === 0 && <Vazio titulo="Nenhum pedido aguardando." />}
        <ul className="space-y-4">
          {pendentes.map((pedido) => (
            <li key={pedido.id}>
              <Cartao
                as="article"
                titulo={pedido.nome}
                nivelDoTitulo={3}
                rodape={
                  <span className="flex gap-2">
                    <Botao pequeno simbolo={UserCheck} disabled={acao.ocupado} onClick={() => acao.agir("candidatura_decidir", { p_id: pedido.id, p_aceitar: true }, "Pedido aceito.")}>
                      Aceitar
                    </Botao>
                    <Botao pequeno variante="discreto" perigo simbolo={X} disabled={acao.ocupado} onClick={() => acao.agir("candidatura_decidir", { p_id: pedido.id, p_aceitar: false }, "Pedido recusado.")}>
                      Recusar
                    </Botao>
                  </span>
                }
              >
                <p className="pn-rotulo-mono mt-1">
                  {papeis[pedido.papel]} · {nomeDaArea(pedido.disciplina)} · {data(pedido.criado_em)}
                </p>
                <p className="font-mono text-xs text-ink-soft">{pedido.email}</p>
                <p className="mt-2">{pedido.mensagem}</p>
              </Cartao>
            </li>
          ))}
        </ul>
      </section>

      <section hidden={aba !== "funcao"} aria-labelledby="confiar-funcao" className="space-y-3">
        <CabecalhoDeSecao
          id="confiar-funcao"
          titulo="Confiar funções"
          sobre={<>Procure a pessoa pelo nome{coordena ? " ou pelo e-mail" : ""}. Ela precisa ter entrado no site pelo menos uma vez para aparecer na busca. Junte quantas funções, disciplinas e departamentos quiser e confie tudo de uma vez: o novo se soma ao que a pessoa já tem, e ela recebe um recado só.</>}
        />
        <Cartao as="div">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <div className="pn-campo-bloco">
            <span className="pn-rotulo">Pessoa</span>
            <BuscaDePessoa escolhida={quem} escolher={setQuem} reserva={pessoas.dados ?? []} />
            <p className="pn-ajuda mt-1">Ou marque várias pessoas na lista de Pessoas e use “Dar função a estas”.</p>
          </div>
          <EscolhaDeFuncoes concediveis={concediveis} escolhidas={escolhidas} aoMudar={setEscolhidas} departamentos={deps} aoMudarDepartamentos={setDeps} podeSensivel={coordena} />
        </div>
        {lote.length > 0 && (
          <Faixa tom="bordo" className="mt-3" titulo={`Para ${lote.length} ${lote.length === 1 ? "pessoa" : "pessoas"} de uma vez:`}>
            <p className="text-sm">{(pessoas.dados ?? []).filter((p) => lote.includes(p.id)).map((p) => p.nome).join(", ")}</p>
            <p className="mt-2 flex flex-wrap gap-2">
              <Botao
                variante="principal"
                pequeno
                disabled={nadaEscolhido}
                carregando={acao.ocupado}
                onClick={async () => {
                  const alvos = (pessoas.dados ?? []).filter((p) => lote.includes(p.id) && podeMexer(p));
                  let feitos = 0;
                  for (const alvo of alvos) {
                    if ((await acao.agir("papeis_conceder_varios", { p_usuario: alvo.id, p_itens: escolhidas, p_departamentos: deps }, "")) !== null) feitos++;
                  }
                  acao.setAviso(`${resumoDoEscolhido} para ${feitos} de ${lote.length} ${lote.length === 1 ? "pessoa" : "pessoas"}${alvos.length < lote.length ? " (as outras estão no seu nível ou acima)" : ""}.`);
                  setLote([]);
                  limparEscolha();
                }}
              >
                Confiar a {lote.length === 1 ? "esta pessoa" : `estas ${lote.length} pessoas`}
              </Botao>
              <Botao variante="discreto" pequeno simbolo={X} onClick={() => setLote([])}>
                Desfazer a seleção
              </Botao>
            </p>
          </Faixa>
        )}
        {alvoForaDoAlcance && <Aviso texto={`${quem?.nome} está no seu nível ou acima na hierarquia: só quem está acima confia ou retira funções dessa pessoa.`} />}
        <Botao
          variante={lote.length > 0 ? "padrao" : "principal"}
          className="mt-3"
          simbolo={UserCheck}
          disabled={!quem || alvoForaDoAlcance || nadaEscolhido}
          carregando={acao.ocupado}
          onClick={async () => {
            if (quem && (await acao.agir("papeis_conceder_varios", { p_usuario: quem.id, p_itens: escolhidas, p_departamentos: deps }, `${resumoDoEscolhido} para ${quem.nome}.`))) {
              setQuem(null);
              limparEscolha();
            }
          }}
        >
          {nadaEscolhido ? "Confiar" : `Confiar ${resumoDoEscolhido.toLocaleLowerCase("pt-BR")}`}
        </Botao>
        </Cartao>
        {[...new Set(escolhidas.map((e) => e.papel))].map((papel) => (
          <Faixa key={papel} tom="info" titulo={`${papeis[papel]}:`}>
            {oQueFaz[papel]}
          </Faixa>
        ))}
        <p className="pn-ajuda">
          Hierarquia dos cargos: coordenação, coordenação pedagógica, supervisão e, abaixo, os papéis de trabalho. Cada pessoa só confia papéis de nível menor que o próprio, e só a quem está abaixo dela.
          {coordena && " Para criar a conta de alguém da equipe com e-mail e senha definidos por você, use o painel do serviço de contas (o passo a passo está no guia de manutenção). Depois que a pessoa entrar uma vez, ela aparece aqui para receber a função."}
        </p>
      </section>

      <section hidden={aba !== "equipe"}>
        <Aviso texto={pessoas.erro} />
        {!pessoas.dados && !pessoas.erro && <Esqueleto forma="tabela" linhas={8} rotulo="Carregando" />}
        <ListaDePessoas
          pessoas={pessoas.dados ?? []}
          eu={me.id}
          candidaturas={pendentes.length + novas.length}
          verCandidaturas={() => coordena && setAba("pedidos")}
          nomeDaArea={nomeDaArea}
          emLote={(ids) => {
            setLote(ids);
            setQuem(null);
            setAba("funcao");
          }}
          ficha={(item) => {
            const pessoa = item as Pessoa;
            return (
              <div className="space-y-4">
                <section>
                  <p className="pn-rotulo-mono">Funções</p>
                  {/* Todos os papéis, o de maior nível primeiro. O "tirar" só aparece onde o banco deixaria retirar. */}
                  <ul className="pn-lista mt-1.5" aria-label={`Funções de ${pessoa.nome}`}>
                    {pessoa.papeis.length === 0 && <li className="pn-item pn-ajuda">Sem função: participa da comunidade.</li>}
                    {porNivel(pessoa.papeis).map((papel) => (
                      <li key={papel.id} className="pn-item justify-between text-sm">
                        <span className="min-w-0">
                          {papeis[papel.papel]} · {nomeDaArea(papel.disciplina)}
                        </span>
                        {podeTirar(pessoa, papel) && (
                          <Botao variante="discreto" pequeno perigo aria-label={`Retirar de ${pessoa.nome} a função ${papeis[papel.papel]}`} disabled={acao.ocupado} onClick={() => acao.agir("papel_remover", { p_id: papel.id }, "Função retirada.")}>
                            Tirar
                          </Botao>
                        )}
                      </li>
                    ))}
                  </ul>
                  {(pessoa.departamentos?.length ?? 0) > 0 && (
                    <>
                      <p className="pn-rotulo-mono mt-3">Departamentos de participação</p>
                      <ul className="pn-lista mt-1.5" aria-label={`Departamentos de ${pessoa.nome}`}>
                        {pessoa.departamentos?.map((dep) => (
                          <li key={dep} className="pn-item justify-between text-sm">
                            <span className="min-w-0">{NOMES_DOS_DEPARTAMENTOS_DO_INSTITUTO[dep] ?? dep}</span>
                            {podeMexer(pessoa) && (dep !== "revolucionarios" || coordena) && (
                              <Botao variante="discreto" pequeno perigo aria-label={`Tirar ${pessoa.nome} do departamento ${NOMES_DOS_DEPARTAMENTOS_DO_INSTITUTO[dep] ?? dep}`} disabled={acao.ocupado} onClick={() => acao.agir("departamento_membro_remover", { p_departamento: dep, p_usuario: pessoa.id }, "Tirada do departamento.")}>
                                Tirar
                              </Botao>
                            )}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                  {podeMexer(pessoa) && (
                    <Botao
                      variante="discreto"
                      pequeno
                      className="mt-2"
                      simbolo={Plus}
                      onClick={() => {
                        setLote([]);
                        setQuem({ id: pessoa.id, nome: pessoa.nome, email: pessoa.email || papeis[porNivel(pessoa.papeis)[0]?.papel] || "", nivel: pessoa.nivel });
                        setAba("funcao");
                      }}
                    >
                      Dar funções ou departamentos
                    </Botao>
                  )}
                </section>
                {coordena && (
                  <section>
                    <p className="pn-rotulo-mono">Conta</p>
                    <Ficha pessoa={pessoa} me={me} depois={pessoas.recarregar} estreita />
                  </section>
                )}
                {coordena && (
                  <section>
                    <p className="pn-rotulo-mono">Histórico</p>
                    <Lances usuario={pessoa.id} nomeDaArea={nomeDaArea} />
                  </section>
                )}
              </div>
            );
          }}
        />
      </section>
      <Aviso texto={acao.aviso} />
    </div>
  );
}

/** Quem confiou e quem retirou cada função desta pessoa, com data (na ficha, para a coordenação). */
function Lances({ usuario, nomeDaArea }: { usuario: string; nomeDaArea: (slug: string | null) => string }) {
  const lista = useLista<Lance[]>("papeis_historico_listar", { p_usuario: usuario });
  if (lista.erro) return <Aviso texto={lista.erro} />;
  if (!lista.dados) return <Esqueleto linhas={2} rotulo="Carregando…" />;
  if (lista.dados.length === 0) return <p className="pn-ajuda mt-1">Nenhuma função confiada até hoje.</p>;
  return (
    <ul className="mt-1 space-y-1 text-sm">
      {lista.dados.map((lance) => (
        <li key={lance.id}>
          <strong className="text-ink">{papeis[lance.papel] ?? lance.papel}</strong>
          {lance.disciplina && ` de ${nomeDaArea(lance.disciplina)}`} · confiada por {lance.concedido_por || "—"} em {dataHora(lance.concedido_em)}
          {lance.removido_em && ` · retirada por ${lance.removido_por || "—"} em ${dataHora(lance.removido_em)}`}
        </li>
      ))}
    </ul>
  );
}

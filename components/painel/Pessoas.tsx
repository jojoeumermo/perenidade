// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { areaSlugs } from "@/lib/areas";
import { can, leads, type Me, nivelDe, nivelDoPapel, porNivel, type Role, rpc } from "@/lib/backend";
import { useI18n } from "../I18n";
import { Abas, Aviso, botao, botaoClaro, campo, data, dataHora, elo, GRUPOS_DEPARTAMENTO, nomeDoDepartamento, oQueFaz, PAINEL_MUDOU, papeis, rotulo, textoDoErro, useAcao, useLista } from "./comum";
import { BuscaDePessoa, type PessoaAchada } from "./BuscaDePessoa";
import { Convites } from "./Convites";
import { Departamentos, FotosParaAprovar, TermosAceitos } from "./PessoasExtras";

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
  /** O nível da pessoa na hierarquia de cargos (o maior entre os papéis dela). */
  nivel: number;
  papeis: Role[];
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
 * esqueceu e suspender ou reativar. O e-mail não muda por aqui, e nada disso aparece na própria ficha de quem está vendo.
 */
function Ficha({ pessoa, me, depois }: { pessoa: Pessoa; me: Me; depois: () => void }) {
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
    <div className="mt-3 grid gap-5 border-t border-rule pt-4 lg:grid-cols-3">
      <section>
        <h3 className="font-semibold">Nome e apresentação</h3>
        <p className="text-xs text-ink-soft">Para acertar um nome ofensivo, um dado pessoal exposto ou o pedido de quem não consegue entrar. O e-mail não muda por aqui.</p>
        <label className="mt-2 block">
          Nome
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} className={campo} />
        </label>
        <label className="mt-2 block">
          Apresentação
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={3} className={campo} />
        </label>
        <button type="button" className={`mt-2 ${botaoClaro}`} disabled={acao.ocupado || nome.trim().length < 2 || (nome === pessoa.nome && bio === (pessoa.bio ?? ""))} onClick={() => acao.agir("usuario_editar", { p_usuario: pessoa.id, p_nome: nome.trim(), p_bio: bio.trim() }, "Guardado. A pessoa recebeu um recado.")}>
          Guardar
        </button>
      </section>

      <section>
        <h3 className="font-semibold">Redefinir a senha</h3>
        <p className="text-xs text-ink-soft">Para quem esqueceu a própria. A pessoa sai de todos os aparelhos e, ao entrar com a senha nova, escolhe outra antes de o painel abrir.</p>
        {entregar ? (
          <div role="status" className="mt-2 border-2 border-ink bg-parchment p-3">
            <p>Senha nova de {pessoa.nome} (aparece só agora):</p>
            <p className="mt-1 select-all break-all font-mono text-base">{entregar}</p>
            <p className="mt-1 text-xs text-ink-soft">Entregue por um canal seguro (pessoalmente, ligação ou mensagem que some), nunca por e-mail nem no mural.</p>
            <p className="mt-2 flex gap-4">
              <button type="button" className={elo} onClick={() => void navigator.clipboard?.writeText(entregar)}>Copiar</button>
              <button type="button" className={elo} onClick={() => setEntregar("")}>Já entreguei</button>
            </p>
          </div>
        ) : (
          <>
            <label className="mt-2 block">
              Senha nova (pelo menos 12 caracteres)
              <input value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="off" spellCheck={false} maxLength={72} className={`${campo} font-mono`} />
            </label>
            <p className="mt-2 flex flex-wrap gap-3">
              <button type="button" className={botaoClaro} onClick={() => setSenha(senhaForte())}>Gerar uma senha forte</button>
              <button type="button" className={botao} disabled={acao.ocupado || senha.trim().length < 12} onClick={() => void redefinir()}>Redefinir</button>
            </p>
          </>
        )}
        {pessoa.trocar_senha && !entregar && <p className="mt-2 text-xs text-ink-soft">A pessoa ainda não escolheu a própria senha depois da última redefinição.</p>}
      </section>

      <section>
        <h3 className="font-semibold">{pessoa.suspenso ? "Conta suspensa" : "Suspender a conta"}</h3>
        <p className="text-xs text-ink-soft">
          {pessoa.suspenso ? `Suspensa ${suspensoPor[pessoa.suspensao ?? ""] ?? ""}: lê, mas não envia. Reativar também desfaz um banimento.` : "A conta continua existindo e lendo, mas não envia nada, nem pelo painel."}
        </p>
        {!pessoa.suspenso && (
          <label className="mt-2 block">
            Motivo (vai para o registro)
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} className={campo} />
          </label>
        )}
        <button
          type="button"
          className={`mt-2 ${pessoa.suspenso ? botaoClaro : "cursor-pointer bg-oxblood px-5 py-2 font-medium text-parchment disabled:cursor-not-allowed disabled:opacity-50"}`}
          disabled={acao.ocupado}
          onClick={() => acao.agir("usuario_suspender", { p_usuario: pessoa.id, p_suspenso: !pessoa.suspenso, p_motivo: motivo.trim() }, pessoa.suspenso ? "Conta reativada." : "Conta suspensa.")}
        >
          {pessoa.suspenso ? "Reativar a conta" : "Suspender a conta"}
        </button>
      </section>
      <div className="lg:col-span-3">
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
    (papel) => papel !== "coordenacao" && nivelDoPapel(papel) < meuNivel && (!["vice", "supervisao"].includes(papel) || lider) && (!["curadoria", "mediacao"].includes(papel) || coordena),
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
  const [novo, setNovo] = useState<{ papel: Role["papel"]; disciplina: string }>({ papel: concediveis.includes("educacao") ? "educacao" : (concediveis[0] ?? "educacao"), disciplina: "" });
  // Educação, educação secundária e reforço são por disciplina; o representante, pelo departamento: o banco recusa sem eles.
  const porDisciplina = novo.papel === "educacao" || novo.papel === "educacao_secundaria" || novo.papel === "mentoria" || novo.papel === "representante";
  // Profissional de saúde não tem disciplina: o cargo vale só para a vitrine Saúde Solidária.
  const semDisciplina = novo.papel === "saude";
  /** Quem vai receber a função: escolhida na busca, não numa lista com todo mundo. */
  const [quem, setQuem] = useState<PessoaAchada | null>(null);
  const [filtro, setFiltro] = useState("");
  const [aba, setAba] = useState<"equipe" | "funcao" | "convites" | "pedidos" | "departamentos" | "fotos" | "termos">("equipe");
  const aprova = can(me, "coordenacao", "vice");
  /** A ficha aberta: uma de cada vez, para a lista continuar curta. */
  const [aberta, setAberta] = useState<string | null>(null);
  const nomeDaArea = (slug: string | null) => (slug ? (t.areas[slug as keyof typeof t.areas]?.[0] ?? nomeDoDepartamento(slug)) : "todo o site");
  const pendentes = coordena ? (pedidos.dados?.filter((pedido) => pedido.status === "pendente") ?? []) : [];
  const visiveis = pessoas.dados?.filter((pessoa) => `${pessoa.nome} ${pessoa.email}`.toLowerCase().includes(filtro.toLowerCase())) ?? [];
  const [grupo, setGrupo] = useState<"equipe" | "comunidade">("equipe");
  const daEquipe = visiveis.filter((pessoa) => pessoa.papeis.length > 0);
  const daComunidade = visiveis.filter((pessoa) => pessoa.papeis.length === 0);
  // Quem foi escolhido na busca já vem com o nível: a tela avisa antes de o banco recusar.
  const alvoForaDoAlcance = quem !== null && quem.nivel !== undefined && !podeMexer({ id: quem.id, nivel: quem.nivel });

  return (
    <div>
      <Abas
        atual={aba}
        escolher={setAba}
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
      <section hidden={aba !== "pedidos"} className="mb-10">
        <h2 className="font-serif text-2xl font-semibold">Candidaturas pelo formulário</h2>
        <p className="mt-1 max-w-3xl text-ink-soft">
          Quem preencheu o formulário de voluntariado no site, com nome e e-mail. Com o envio de e-mails ligado (Controles do site), a pessoa recebe um e-mail dizendo que o pedido chegou, e a coordenação recebe outro avisando do pedido. Ao aceitar, quem ainda não tem conta
          ganha um convite pessoal, que só serve para aquele e-mail e já traz a função, e ele vai sozinho por e-mail. Quem já tem conta recebe a função na hora. Ao recusar, a pessoa também é avisada por e-mail.
        </p>
        <Aviso texto={inscricoes.erro || avisoInscricao} />
        {aceite && (
          <div role="status" className="mt-3 border-2 border-ink bg-parchment p-4">
            <p className="font-serif text-xl font-semibold">Convite de {aceite.nome}</p>
            <p className="mt-1 text-ink-soft">Este endereço aparece uma vez só e vale por 14 dias. Mande para {aceite.email}.</p>
            <p className="mt-2 select-all break-all font-mono text-xs">{aceite.link}</p>
            <p className="mt-3 flex flex-wrap gap-4">
              <button type="button" className={botaoClaro} onClick={() => void navigator.clipboard?.writeText(aceite.link)}>Copiar o endereço</button>
              <a
                className={elo}
                href={`mailto:${aceite.email}?subject=${encodeURIComponent("Sua candidatura ao Instituto Lúcia foi aceita")}&body=${encodeURIComponent(`Olá, ${aceite.nome}.\n\nSua candidatura a voluntário no Instituto Lúcia foi aceita. Para criar a sua conta, já com a função combinada, abra este endereço (ele vale por 14 dias e só serve para este e-mail):\n\n${aceite.link}\n\nAté breve.`)}`}
              >
                Abrir no programa de e-mail
              </a>
              <button type="button" className={elo} onClick={() => setAceite(null)}>Já mandei</button>
            </p>
          </div>
        )}
        {novas.length === 0 && <p className="mt-2 text-ink-soft">Nenhuma candidatura aguardando.</p>}
        <ul className="mt-3 space-y-4">
          {novas.map((item) => (
            <li key={item.id} className="border border-rule bg-parchment-deep p-4">
              <p className={rotulo}>
                {papeis[item.papel]} · {nomeDaArea(item.disciplina)} · {data(item.criado_em)}
              </p>
              <p className="mt-1 font-serif text-xl font-semibold">{item.nome}</p>
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
              <div className="mt-3 flex gap-3">
                <button type="button" className={botao} onClick={() => void decidirInscricao(item, true)}>Aceitar</button>
                <button type="button" className={botaoClaro} onClick={() => void decidirInscricao(item, false)}>Recusar</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section hidden={aba !== "pedidos"}>
        <h2 className="font-serif text-2xl font-semibold">Pedidos feitos pelo painel</h2>
        <Aviso texto={pedidos.erro} />
        {pendentes.length === 0 && <p className="mt-2 text-ink-soft">Nenhum pedido aguardando.</p>}
        <ul className="mt-3 space-y-4">
          {pendentes.map((pedido) => (
            <li key={pedido.id} className="border border-rule bg-parchment-deep p-4">
              <p className={rotulo}>
                {papeis[pedido.papel]} · {nomeDaArea(pedido.disciplina)} · {data(pedido.criado_em)}
              </p>
              <p className="mt-1 font-serif text-xl font-semibold">{pedido.nome}</p>
              <p className="font-mono text-xs text-ink-soft">{pedido.email}</p>
              <p className="mt-2">{pedido.mensagem}</p>
              <div className="mt-3 flex gap-3">
                <button type="button" className={botao} disabled={acao.ocupado} onClick={() => acao.agir("candidatura_decidir", { p_id: pedido.id, p_aceitar: true }, "Pedido aceito.")}>Aceitar</button>
                <button type="button" className={botaoClaro} disabled={acao.ocupado} onClick={() => acao.agir("candidatura_decidir", { p_id: pedido.id, p_aceitar: false }, "Pedido recusado.")}>Recusar</button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section hidden={aba !== "funcao"}>
        <h2 className="font-serif text-2xl font-semibold">Confiar uma função</h2>
        <p className="mt-1 text-ink-soft">
          Procure a pessoa pelo nome{coordena ? " ou pelo e-mail" : ""}. Ela precisa ter entrado no site pelo menos uma vez para aparecer na busca. Uma pessoa pode acumular funções: a nova se soma às que ela já tem.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <span className="block">Pessoa</span>
            <BuscaDePessoa escolhida={quem} escolher={setQuem} reserva={pessoas.dados ?? []} />
          </div>
          <label className="block">
            Função
            <select value={novo.papel} onChange={(e) => setNovo({ ...novo, papel: e.target.value as Role["papel"] })} className={campo}>
              {concediveis.map((papel) => (
                <option key={papel} value={papel}>
                  {papeis[papel]}
                </option>
              ))}
            </select>
          </label>
          {semDisciplina ? (
            <p className="self-end pb-2 text-sm text-ink-soft">Sem disciplina: o cargo vale para a vitrine Saúde Solidária. Se a pessoa também ensina, confie a função de educação separadamente.</p>
          ) : (
          <label className="block">
            {novo.papel === "representante" ? "Departamento" : porDisciplina ? "Disciplina" : "Disciplina (opcional)"}
            <select value={novo.disciplina} onChange={(e) => setNovo({ ...novo, disciplina: e.target.value })} className={campo}>
              {novo.papel === "representante" ? (
                <>
                  <option value="">Escolha o departamento…</option>
                  <optgroup label="Educação, por área (reúne as disciplinas dela)">
                    {Object.entries(GRUPOS_DEPARTAMENTO).map(([dep, nome]) => (
                      <option key={dep} value={dep}>{nome}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Funções">
                    {(["educacao", "curadoria", "mediacao", "revisao", "traducao", "jornalismo", "mentoria", "design", "desenvolvimento", "saude"] as const).map((dep) => (
                      <option key={dep} value={dep}>{papeis[dep]}</option>
                    ))}
                  </optgroup>
                </>
              ) : (
                <>
                  <option value="">Todo o site</option>
                  {areaSlugs.map((area) => (
                    <option key={area} value={area}>
                      {t.areas[area][0]}
                    </option>
                  ))}
                </>
              )}
            </select>
          </label>
          )}
        </div>
        {alvoForaDoAlcance && <Aviso texto={`${quem?.nome} está no seu nível ou acima na hierarquia: só quem está acima confia ou retira funções dessa pessoa.`} />}
        <button
          type="button"
          className={`mt-3 ${botao}`}
          disabled={acao.ocupado || !quem || alvoForaDoAlcance || (porDisciplina && !novo.disciplina)}
          onClick={async () => {
            if (quem && (await acao.agir("papel_conceder", { p_usuario: quem.id, p_papel: novo.papel, p_disciplina: semDisciplina ? null : novo.disciplina || null }, `Função confiada a ${quem.nome}.`))) setQuem(null);
          }}
        >
          Confiar função
        </button>
        <p className="mt-2 text-ink-soft">
          <strong>{papeis[novo.papel]}:</strong> {oQueFaz[novo.papel]}
        </p>
        <p className="mt-2 text-ink-soft">
          Hierarquia dos cargos: coordenação, coordenação pedagógica, supervisão e, abaixo, os papéis de trabalho. Cada pessoa só confia papéis de nível menor que o próprio, e só a quem está abaixo dela.
          {coordena && " Para criar a conta de alguém da equipe com e-mail e senha definidos por você, use o painel do serviço de contas (o passo a passo está no guia de manutenção). Depois que a pessoa entrar uma vez, ela aparece aqui para receber a função."}
        </p>
      </section>

      <section hidden={aba !== "equipe"}>
        <Aviso texto={pessoas.erro} />
        <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder={coordena ? "Filtrar por nome ou e-mail" : "Filtrar por nome"} aria-label="Filtrar pessoas" className={campo} />
        {/* A equipe (quem tem alguma função) fica separada de quem só participa da comunidade. */}
        <p className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Quem mostrar">
          {([["equipe", `Voluntários da equipe (${daEquipe.length})`], ["comunidade", `Só comunidade (${daComunidade.length})`]] as const).map(([valor, rotulo]) => (
            <button key={valor} type="button" aria-pressed={grupo === valor} onClick={() => setGrupo(valor)} className={`cursor-pointer border-2 px-3 py-1.5 font-sans text-sm ${grupo === valor ? "border-ink bg-ink text-parchment" : "border-rule hover:border-ink"}`}>
              {rotulo}
            </button>
          ))}
        </p>
        <ul className="mt-3 divide-y divide-rule border-y border-rule">
          {(grupo === "equipe" ? daEquipe : daComunidade).map((pessoa) => (
            <li key={pessoa.id} className="py-3">
              <p className="font-serif text-xl font-semibold">
                {pessoa.nome} {pessoa.id === me.id && <span className="font-sans text-sm text-ink-soft">(você)</span>} {pessoa.suspenso && <span className="font-sans text-sm text-oxblood">(suspensa)</span>}
              </p>
              <p className="font-mono text-xs text-ink-soft">
                {pessoa.email ? `${pessoa.email} · ` : ""}último acesso em {data(pessoa.visto_em)}
              </p>
              {/* Todos os papéis, como etiquetas, o de maior nível primeiro. O ✕ só aparece onde o banco deixaria retirar. */}
              <ul className="mt-1 flex flex-wrap gap-2" aria-label={`Funções de ${pessoa.nome}`}>
                {pessoa.papeis.length === 0 && <li className="text-ink-soft">Sem função: participa da comunidade.</li>}
                {porNivel(pessoa.papeis).map((papel) => (
                  <li key={papel.id} className="border border-rule bg-parchment-deep px-2 py-1">
                    {papeis[papel.papel]} · {nomeDaArea(papel.disciplina)}
                    {podeTirar(pessoa, papel) && (
                      <button type="button" title="Retirar função" aria-label={`Retirar de ${pessoa.nome} a função ${papeis[papel.papel]}`} className="ml-1 cursor-pointer px-1 hover:text-oxblood" onClick={() => acao.agir("papel_remover", { p_id: papel.id }, "Função retirada.")}>
                        ✕
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-1 flex flex-wrap gap-4">
                {podeMexer(pessoa) && (
                  <button type="button" className={elo} onClick={() => { setQuem({ id: pessoa.id, nome: pessoa.nome, email: pessoa.email || papeis[porNivel(pessoa.papeis)[0]?.papel] || "", nivel: pessoa.nivel }); setAba("funcao"); }}>
                    Confiar mais uma função
                  </button>
                )}
                {coordena && (
                  <button type="button" className={elo} aria-expanded={aberta === pessoa.id} onClick={() => setAberta(aberta === pessoa.id ? null : pessoa.id)}>
                    {aberta === pessoa.id ? "Fechar a ficha" : pessoa.id === me.id ? "Sua conta" : "Abrir a ficha: nome, senha, suspensão"}
                  </button>
                )}
              </p>
              {coordena && aberta === pessoa.id && <Ficha pessoa={pessoa} me={me} depois={pessoas.recarregar} />}
              {coordena && <HistoricoDeCargos usuario={pessoa.id} nomeDaArea={nomeDaArea} />}
            </li>
          ))}
        </ul>
      </section>
      <Aviso texto={acao.aviso} />
    </div>
  );
}

/** Quem confiou e quem retirou cada função desta pessoa, com data. Só carrega quando a coordenação abre. */
function HistoricoDeCargos({ usuario, nomeDaArea }: { usuario: string; nomeDaArea: (slug: string | null) => string }) {
  const [aberto, setAberto] = useState(false);
  return (
    <details className="mt-1 text-xs text-ink-soft" onToggle={(e) => setAberto(e.currentTarget.open)}>
      <summary className="cursor-pointer hover:text-ink">Histórico de funções</summary>
      {aberto && <Lances usuario={usuario} nomeDaArea={nomeDaArea} />}
    </details>
  );
}

function Lances({ usuario, nomeDaArea }: { usuario: string; nomeDaArea: (slug: string | null) => string }) {
  const lista = useLista<Lance[]>("papeis_historico_listar", { p_usuario: usuario });
  if (lista.erro) return <Aviso texto={lista.erro} />;
  if (!lista.dados) return <p className="mt-1 font-mono">Carregando…</p>;
  if (lista.dados.length === 0) return <p className="mt-1">Nenhuma função confiada até hoje.</p>;
  return (
    <ul className="mt-1 space-y-0.5">
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

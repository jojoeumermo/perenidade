// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Botao } from "@/components/rede/ui/Botao";
import { rpc } from "@/lib/backend";
import type { ResultadoDoBanimento } from "@/lib/rede/admin/tipos";
import type { BanimentoDeRede, FichaDaPessoa, PessoaNaBusca, PreviaDaRede, Sancao } from "@/lib/rede/painel/tipos";
import { notificar } from "../ui";
import { chamarRota, numeroDePessoas, useNoPainelUnico } from "./admin/cliente";
import { papeis as nomesDosPapeis } from "../comum";
import { Campo, dias, Estado, Etiqueta, falta, Fita, motivoDe, Nota, quando, Quadro, textoDoErroDaAlumia, Titulo, useDado, useJanela, usePainelDaAlumia } from "./pecas";

// Onda 12 (12D): a fila do histórico de voluntariado (o banco confere o papel); só chega ao navegador quando a parte abre.
const FilaDoVoluntariado = dynamic(() => import("@/components/rede/perfil/secoes/Cuidar").then((m) => m.FilaDoVoluntariado), { ssr: false });

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const NOME_DA_ENTRADA: Record<string, string> = { aprovada: "aprovada", em_analise: "na fila", recusada: "recusada", sem_pedido: "sem pedido", suspensa: "suspensa", sem_conta: "sem conta" };
const NOME_DA_SANCAO: Record<Sancao["tipo"], string> = { suspensao: "Suspensão", banimento: "Banimento", rede: "Rede barrada" };
const NIVEIS = ["novo", "básico", "membro", "regular", "líder"];

/** Busca de pessoa pelo codinome ou pelo @ (2 letras ou mais). Serve às telas que precisam escolher uma conta. */
export function BuscaDePessoa({ aoEscolher, escolhida, rotulo = "Codinome ou @", pelaConta = false }: { aoEscolher: (p: PessoaNaBusca) => void; escolhida?: string | null; rotulo?: string; pelaConta?: boolean }) {
  const { papel, foco } = usePainelDaAlumia();
  const inicial = pelaConta && foco && !UUID.test(foco) && foco !== "redes" ? foco : "";
  const [texto, setTexto] = useState(inicial);
  const [peloNome, setPeloNome] = useState(false);
  const [estado, setEstado] = useState<{ itens: PessoaNaBusca[] | null; erro: string; ocupado: boolean }>({ itens: null, erro: "", ocupado: false });

  async function buscar(valor: string, nome: boolean) {
    if (valor.trim().replace(/^@/, "").length < 2) return;
    setEstado((e) => ({ ...e, erro: "", ocupado: true }));
    try {
      const itens = await rpc<PessoaNaBusca[]>("alumia_painel_pessoas", { p_busca: valor.trim(), p_pelo_nome: nome });
      setEstado({ itens, erro: "", ocupado: false });
      if (itens.length === 1) aoEscolher(itens[0]);
    } catch (erro) {
      setEstado({ itens: null, erro: textoDoErroDaAlumia(erro), ocupado: false });
    }
  }
  // Veio de outra aba com um @ (Cadastros › Ver a ficha): já busca.
  useEffect(() => {
    if (!inicial) return;
    const vez = setTimeout(() => void buscar(inicial, false), 0);
    return () => clearTimeout(vez);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só na chegada
  }, []);

  return (
    <div className="ap-tela" style={{ gap: "0.75rem" }}>
      <form
        className="ap-filtros"
        onSubmit={(e) => {
          e.preventDefault();
          void buscar(texto, peloNome);
        }}
      >
        <Campo rotulo={peloNome ? "Nome da conta" : rotulo} largo>
          <input className="ap-entrada" value={texto} maxLength={60} onChange={(e) => setTexto(e.target.value)} placeholder={peloNome ? "nome escrito na conta" : "@faisca"} />
        </Campo>
        <Botao type="submit" variante="claro" disabled={estado.ocupado || texto.trim().replace(/^@/, "").length < 2}>
          {estado.ocupado ? "Buscando…" : "Buscar"}
        </Botao>
      </form>
      {pelaConta && papel === "coordenacao" ? (
        <label className="ap-marcar">
          <input type="checkbox" checked={peloNome} onChange={(e) => setPeloNome(e.target.checked)} />
          <span>
            Buscar pelo nome da conta, que pode ser o nome civil.{" "}
            <span className="ap-miudo">Só a coordenação; cada busca assim fica no registro. O codinome existe para a moderação não precisar saber quem é quem.</span>
          </span>
        </label>
      ) : null}
      {estado.erro ? (
        <p role="alert" className="ap-janela-erro">
          {estado.erro}
        </p>
      ) : null}
      {estado.itens ? (
        estado.itens.length === 0 ? (
          <Nota>Ninguém com esse {peloNome ? "nome" : "codinome ou @"}.{peloNome ? "" : " Conta que ainda não escolheu codinome não aparece aqui: ache pelo nome da conta (só a coordenação)."}</Nota>
        ) : (
          <div className="ap-lista">
            {estado.itens.map((p) => (
              <button key={p.id} type="button" className="ap-escolher" aria-current={p.id === escolhida} onClick={() => aoEscolher(p)}>
                <span className="ap-linha-cabeca">
                  <span className="ap-forte">{p.codinome}</span>
                  {p.handle ? <span className="ap-miudo">@{p.handle}</span> : null}
                </span>
                <span className="ap-etiquetas">
                  <Etiqueta tom={p.entrada === "aprovada" ? "papel" : p.entrada === "suspensa" ? "vermelho" : undefined}>{NOME_DA_ENTRADA[p.entrada] ?? p.entrada}</Etiqueta>
                  {p.da_casa ? <Etiqueta tom="dourado">função na casa</Etiqueta> : null}
                  {p.organizacao ? <Etiqueta>organização</Etiqueta> : null}
                </span>
              </button>
            ))}
            {estado.itens.length === 30 ? <p className="ap-miudo">Mostrando os 30 primeiros. Escreva mais letras para afinar.</p> : null}
          </div>
        )
      ) : null}
    </div>
  );
}

function Ficha({ id }: { id: string }) {
  const { papel, geral, ir } = usePainelDaAlumia();
  const leitura = useDado<FichaDaPessoa>("alumia_painel_pessoa", { p_id: id });
  const { pedir, janela } = useJanela();
  const [erroDaRede, setErroDaRede] = useState("");
  const noPainelUnico = useNoPainelUnico();
  const f = leitura.dados;
  if (!f) return <Estado leitura={leitura} />;

  const protegida = f.eu || f.coordenacao;
  const daCasa = f.papeis.length > 0 || f.admin;
  const ativas = f.sancoes.filter((s) => s.ativa);
  const nome = <strong>{f.codinome}</strong>;

  const suspender = () =>
    pedir({
      titulo: "Suspender por prazo",
      texto: <p>{nome} fica sem escrever e sem entrar na Alumia até o prazo acabar. As sessões caem na hora. A conta volta sozinha no fim do prazo.</p>,
      campos: [
        { tipo: "dias", rotulo: "Por quantos dias", min: 1, max: 365, valor: 7, atalhos: [1, 3, 7, 30, 90] },
        { tipo: "motivo", aviso: "A pessoa lê este motivo no aviso que recebe." },
      ],
      confirmar: "Suspender",
      perigo: true,
      fazer: (v) => rpc("alumia_painel_sancionar", { p_id: f.id, p_tipo: "suspensao", p_dias: v.dias, p_motivo: motivoDe(v) }),
      sucesso: "Conta suspensa. A pessoa foi avisada.",
      depois: leitura.recarregar,
    });
  const banir = () =>
    pedir({
      titulo: "Banir a conta",
      texto: <p>{nome} é banida da Alumia sem prazo. As sessões caem na hora. Dá para desfazer depois, nesta mesma ficha.</p>,
      campos: [{ tipo: "motivo", aviso: "A pessoa lê este motivo no aviso que recebe." }],
      confirmar: "Banir",
      perigo: true,
      fazer: (v) => rpc("alumia_painel_sancionar", { p_id: f.id, p_tipo: "banimento", p_dias: null, p_motivo: motivoDe(v) }),
      sucesso: "Conta banida. A pessoa foi avisada.",
      depois: leitura.recarregar,
    });
  const desfazer = (s: Sancao) =>
    pedir({
      titulo: s.tipo === "banimento" ? "Desfazer o banimento" : "Desfazer a suspensão",
      texto: <p>{nome} volta a usar a Alumia, a não ser que outra decisão (da mediação ou da equipe) ainda segure a conta.</p>,
      campos: [{ tipo: "motivo" }],
      confirmar: "Desfazer",
      fazer: (v) => rpc("alumia_painel_sancao_desfazer", { p_sancao: s.id, p_motivo: motivoDe(v) }),
      sucesso: "Sanção desfeita.",
      depois: leitura.recarregar,
    });
  const encerrarSessoes = () =>
    pedir({
      titulo: "Encerrar as sessões",
      texto: <p>{nome} sai de todos os aparelhos e precisa entrar de novo com a senha (e o código, se tiver). Use quando a conta parecer estar em mãos erradas.</p>,
      campos: [{ tipo: "motivo" }],
      confirmar: "Encerrar as sessões",
      fazer: (v) => rpc("alumia_painel_sessoes_encerrar", { p_id: f.id, p_motivo: motivoDe(v) }),
      sucesso: "Sessões encerradas.",
      depois: leitura.recarregar,
    });
  const tirarFator = () =>
    pedir({
      titulo: "Tirar o segundo fator",
      texto: (
        <>
          <p>O aplicativo autenticador de {nome} é retirado e as sessões caem. Na próxima entrada a pessoa cadastra o aplicativo de novo.</p>
          <p>Confirme por outro caminho que o pedido veio mesmo da pessoa: quem tiver a senha dela e chegar antes cadastra o próprio aplicativo.</p>
        </>
      ),
      campos: [{ tipo: "motivo" }, { tipo: "frase", frase: "TIRAR O SEGUNDO FATOR" }],
      confirmar: "Tirar o segundo fator",
      perigo: true,
      fazer: (v) => rpc("alumia_painel_fator_tirar", { p_id: f.id, p_motivo: motivoDe(v) }),
      sucesso: "Segundo fator retirado. A pessoa foi avisada.",
      depois: leitura.recarregar,
    });
  const apagar = () =>
    pedir({
      titulo: "Apagar a conta",
      texto: (
        <>
          <p>A conta de {nome} e tudo o que é pessoal dela saem do banco. Não tem volta e não há cópia.</p>
          <p>Se a ideia é só tirar a pessoa da rede, banir resolve e pode ser desfeito.</p>
        </>
      ),
      campos: [{ tipo: "motivo" }, { tipo: "frase", frase: f.codinome, rotulo: "Para confirmar, escreva o codinome da conta exatamente:" }],
      confirmar: "Apagar de vez",
      perigo: true,
      fazer: (v) => rpc("alumia_painel_conta_apagar", { p_id: f.id, p_motivo: motivoDe(v), p_confirma: String(v.frase).trim() }),
      sucesso: "Conta apagada.",
      depois: () => ir("pessoas"),
    });
  const nomearAdmin = () =>
    pedir({
      titulo: "Nomear admin da Alumia",
      texto: <p>{nome} passa a poder tudo o que a coordenação pode na Alumia, menos nomear ou destituir o admin e menos agir sobre quem é da coordenação. Só existe um admin de cada vez.</p>,
      campos: [{ tipo: "motivo" }, { tipo: "frase", frase: "NOMEAR ADMIN" }],
      confirmar: "Nomear",
      perigo: true,
      fazer: (v) => rpc("alumia_painel_admin_nomear", { p_id: f.id, p_motivo: motivoDe(v) }),
      sucesso: "Admin nomeado. A pessoa foi avisada.",
      depois: leitura.recarregar,
    });
  /**
   * Painel único (só a coordenação com o código): banir a conta e o que vem dela, de uma vez. O e-mail vira um resumo no servidor
   * (app/api/alumia/admin/banir); os convites abertos dela caem; quem ela convidou volta à triagem; e, se a coordenação quiser, a
   * rede e o aparelho ficam barrados pela impressão com prazo, mostrando antes quantas contas seriam atingidas.
   */
  async function banirComTudo() {
    if (!f) return;
    const codinome = f.codinome;
    setErroDaRede("");
    let previa: PreviaDaRede = { redes: 0, contas: 0, da_casa: false };
    try {
      previa = await rpc<PreviaDaRede>("alumia_painel_rede_previa", { p_id: id });
    } catch {
      // Sem a prévia (conta sem rede vista), o banimento segue sem barrar rede.
    }
    const temRede = previa.redes > 0;
    pedir({
      titulo: "Banir com tudo",
      texto: (
        <>
          <p>{nome} é banida da Alumia sem prazo, e junto vão:</p>
          <ul className="ap-lista" style={{ listStyle: "disc", paddingLeft: "1.2rem" }}>
            <li>o e-mail: a mesma pessoa não cria conta de novo com ele (a Alumia guarda só um resumo embaralhado, nunca o e-mail);</li>
            <li>as sessões, em todos os aparelhos;</li>
            <li>os convites que ela abriu e ninguém usou;</li>
            <li>quem ela convidou e já tinha sido aprovado volta para a triagem;</li>
            <li>
              {temRede ? (
                <>
                  se você escolher dias abaixo, a rede e o aparelho dela por um prazo, pelo resumo embaralhado do endereço (nunca o endereço). Isso atinge <strong className="ap-frase">{previa.contas} {previa.contas === 1 ? "conta" : "contas"}</strong> (contando esta).
                </>
              ) : (
                "a rede e o aparelho: esta conta não tem rede vista nos últimos 30 dias, então não há o que barrar por aí."
              )}
            </li>
          </ul>
          <p>Dá para desfazer o banimento da conta nesta ficha; o resumo do e-mail fica.</p>
        </>
      ),
      campos: [
        ...(temRede ? [{ tipo: "dias" as const, nome: "rede", rotulo: "Barrar a rede e o aparelho por quantos dias (0 = não barrar)", min: 0, max: 90, valor: 0, atalhos: [0, 3, 7, 30] }] : []),
        { tipo: "motivo" as const, aviso: "A pessoa lê este motivo no aviso que recebe." },
        { tipo: "frase" as const, frase: codinome, rotulo: "Para confirmar, escreva o codinome da conta exatamente:" },
      ],
      confirmar: "Banir com tudo",
      perigo: true,
      fazer: async (v) => {
        const r = await chamarRota<ResultadoDoBanimento>("/api/alumia/admin/banir", {
          id,
          motivo: motivoDe(v),
          confirma: String(v.frase).trim(),
          rede_dias: temRede ? Number(v.rede) || 0 : 0,
          rede_contas: temRede && Number(v.rede) > 0 ? previa.contas : null,
        });
        const partes = [
          r.email ? "e-mail barrado" : r.email_sem_segredo ? "e-mail NÃO barrado (falta ALUMIA_EMAIL_SEGREDO no servidor)" : "e-mail não barrado",
          numeroDePessoas(r.convites, "convite cancelado", "convites cancelados"),
          numeroDePessoas(r.convidados, "pessoa de volta à triagem", "pessoas de volta à triagem"),
          r.rede_dias > 0 ? `rede barrada por ${dias(r.rede_dias)}` : "rede não barrada",
          r.sessoes ? "sessões encerradas" : "sessões marcadas para cair (o serviço de contas não deixou apagar agora)",
        ];
        notificar.info(`Banida. ${partes.join("; ")}.`);
      },
      sucesso: "Conta banida com tudo. A pessoa foi avisada.",
      depois: leitura.recarregar,
    });
  }
  /** Banir a rede: primeiro o banco diz quantas contas seriam atingidas; a janela mostra o número e só então confirma. */
  async function barrarRede() {
    setErroDaRede("");
    let previa: PreviaDaRede;
    try {
      previa = await rpc<PreviaDaRede>("alumia_painel_rede_previa", { p_id: id });
    } catch (erro) {
      setErroDaRede(textoDoErroDaAlumia(erro));
      return;
    }
    if (previa.redes === 0) {
      setErroDaRede("Esta conta não tem nenhuma rede vista nos últimos 30 dias: não há o que barrar.");
      return;
    }
    pedir({
      titulo: "Barrar a rede desta conta",
      texto: (
        <>
          <p>
            {nome} entrou de <strong>{previa.redes}</strong> {previa.redes === 1 ? "rede" : "redes"} nos últimos 30 dias. Barrar {previa.redes === 1 ? "essa rede" : "essas redes"} atinge{" "}
            <strong className="ap-frase">
              {previa.contas} {previa.contas === 1 ? "conta" : "contas"}
            </strong>{" "}
            (contando esta): {previa.contas === 1 ? "ela fica suspensa" : "todas ficam suspensas"} até o prazo, e ninguém pede conta nova nem entra a partir dali.
          </p>
          <p>
            Rede não é pessoa. Operadora de celular e wi-fi de escola, ocupação ou sindicato põem muita gente no mesmo endereço, e o endereço de casa muda sozinho. Por isso o prazo é curto e quem tem função na casa nunca é barrado. Quem barra é um resumo embaralhado do endereço; o endereço em si não fica guardado em lugar nenhum, nem para a coordenação.
          </p>
        </>
      ),
      campos: [
        { tipo: "dias", rotulo: "Por quantos dias", min: 1, max: 90, valor: 7, atalhos: [1, 3, 7, 30] },
        { tipo: "motivo" },
        { tipo: "lista", rotulo: "Confira antes", itens: [`Li o número: ${previa.contas} ${previa.contas === 1 ? "conta atingida" : "contas atingidas"}.`, "Suspender ou banir só esta conta não resolve."] },
      ],
      confirmar: `Barrar por rede (${previa.contas})`,
      perigo: true,
      fazer: (v) => rpc("alumia_painel_rede_banir", { p_id: id, p_dias: v.dias, p_motivo: motivoDe(v), p_contas: previa.contas }),
      sucesso: "Rede barrada.",
      depois: leitura.recarregar,
    });
  }

  return (
    <div className="ap-tela">
      <Quadro
        titulo={f.codinome}
        lado={
          <span className="ap-etiquetas">
            {f.handle ? <Etiqueta>@{f.handle}</Etiqueta> : null}
            <Etiqueta tom={f.suspensa ? "vermelho" : f.entrada === "aprovada" ? "papel" : undefined}>{f.suspensa ? "suspensa" : (NOME_DA_ENTRADA[f.entrada] ?? f.entrada)}</Etiqueta>
            {f.coordenacao ? <Etiqueta tom="dourado">coordenação</Etiqueta> : null}
            {f.admin ? <Etiqueta tom="dourado">admin da Alumia</Etiqueta> : null}
            {f.papeis.filter((p) => p !== "coordenacao").map((p) => (
              <Etiqueta key={p} tom="dourado">
                {nomesDosPapeis[p as keyof typeof nomesDosPapeis] ?? p}
              </Etiqueta>
            ))}
            {f.organizacao ? <Etiqueta>organização</Etiqueta> : null}
          </span>
        }
      >
        <dl className="ap-dados">
          <div className="ap-dado">
            <dt>Conta existe há</dt>
            <dd>{dias(f.conta_dias)}</dd>
          </div>
          <div className="ap-dado">
            <dt>Nível de confiança</dt>
            <dd>
              {f.nivel} · {NIVEIS[f.nivel] ?? ""}
            </dd>
          </div>
          <div className="ap-dado">
            <dt>Posts no ar</dt>
            <dd>{f.posts}</dd>
          </div>
          <div className="ap-dado">
            <dt>Posts ocultos</dt>
            <dd>{f.posts_ocultos}</dd>
          </div>
          <div className="ap-dado">
            <dt>Decisões contra, 90 dias</dt>
            <dd>{f.procedentes_90}</dd>
          </div>
          <div className="ap-dado">
            <dt>Denúncias abertas</dt>
            <dd>{f.denuncias_abertas}</dd>
          </div>
          <div className="ap-dado">
            <dt>Segundo fator</dt>
            <dd>{f.fator ? "cadastrado" : "não tem"}</dd>
          </div>
          <div className="ap-dado">
            <dt>Sessões abertas</dt>
            <dd>{f.sessoes}</dd>
          </div>
          <div className="ap-dado">
            <dt>Redes vistas, 30 dias</dt>
            <dd>{f.redes}</dd>
          </div>
        </dl>
        <p className="ap-miudo">A ficha é só o que a moderação precisa para decidir. Não mostra e-mail, nome civil, endereço de rede, quem a pessoa segue nem o que ela leu. “Redes vistas” conta os resumos embaralhados das redes de onde a conta entrou, guardados 30 dias junto dela para poder barrar a volta: quem tiver o banco e o segredo do servidor ao mesmo tempo consegue chegar ao endereço.</p>
        <div className="ap-linha-acoes" style={{ justifyContent: "flex-start" }}>
          {f.handle ? (
            <Botao variante="contorno" tamanho="p" onClick={() => ir("conteudo", `@${f.handle}`)}>
              Ver os posts
            </Botao>
          ) : null}
        </div>
      </Quadro>

      {f.suspensa || f.sancoes.length > 0 ? (
        <Quadro titulo="Sanções">
          {f.banimento_mediacao ? <Nota>Há um banimento da mediação em vigor sobre esta conta (painel interno, Alumia › banimentos). Ele não se desfaz por aqui.</Nota> : null}
          {f.suspensa && ativas.length === 0 && !f.banimento_mediacao ? <Nota>A conta está suspensa por uma decisão de fora deste painel ({f.suspensao || "equipe"}). Ela se desfaz no painel da equipe.</Nota> : null}
          <ul className="ap-lista">
            {f.sancoes.map((s) => (
              <li key={s.id} className="ap-linha">
                <span className="ap-linha-texto">
                  <span className="ap-linha-cabeca">
                    <Etiqueta tom={s.ativa ? "vermelho" : undefined}>{NOME_DA_SANCAO[s.tipo]}</Etiqueta>
                    <span className="ap-miudo">
                      {quando(s.de)}
                      {s.por ? ` · por ${s.por}` : ""} · {s.ativa ? (s.ate ? `acaba ${falta(s.ate)}` : "sem prazo") : `encerrada em ${quando(s.encerrada_em)}`}
                    </span>
                  </span>
                  <span className="ap-quebra">{s.motivo}</span>
                </span>
                <span className="ap-linha-acoes">
                  {s.ativa && s.tipo !== "rede" && !protegida ? (
                    <Botao variante="contorno" tamanho="p" onClick={() => desfazer(s)}>
                      Desfazer
                    </Botao>
                  ) : null}
                  {s.ativa && s.tipo === "rede" ? (
                    <Botao variante="contorno" tamanho="p" onClick={() => ir("pessoas", "redes")}>
                      Ver redes barradas
                    </Botao>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </Quadro>
      ) : null}

      <Quadro titulo="Ações" tom="perigo">
        {protegida ? (
          <Nota>{f.eu ? "Esta é a sua conta: ninguém age sobre si por aqui." : "Esta conta é da coordenação: nada do painel da Alumia age sobre ela. A coordenação se cuida no painel da equipe."}</Nota>
        ) : (
          <>
            {noPainelUnico && !daCasa ? (
              <div className="ap-linha-acoes" style={{ justifyContent: "flex-start" }}>
                <Botao variante="primario" onClick={() => void banirComTudo()}>
                  Banir com tudo (e-mail, aparelho, convites)…
                </Botao>
              </div>
            ) : null}
            <div className="ap-fita">
              <Botao variante="contorno" onClick={suspender}>
                Suspender por prazo
              </Botao>
              <Botao variante="contorno" onClick={banir}>
                Banir
              </Botao>
              <Botao variante="contorno" onClick={encerrarSessoes}>
                Encerrar as sessões
              </Botao>
              <Botao variante="contorno" disabled={daCasa} title={daCasa ? "Não vale para quem tem função na casa." : undefined} onClick={() => void barrarRede()}>
                Barrar a rede
              </Botao>
              <Botao variante="contorno" disabled={daCasa || !f.fator} title={daCasa ? "Não vale para quem tem função na casa." : !f.fator ? "Esta conta não tem segundo fator cadastrado." : undefined} onClick={tirarFator}>
                Tirar o segundo fator
              </Botao>
              <Botao variante="contorno" className="ap-destrutivo" disabled={daCasa} title={daCasa ? "Não vale para quem tem função na casa." : undefined} onClick={apagar}>
                Apagar a conta
              </Botao>
            </div>
            {daCasa ? (
              <p className="ap-miudo">Barrar a rede, tirar o segundo fator e apagar a conta não valem para quem tem função na casa: isso fica com o painel da equipe.</p>
            ) : !f.fator ? (
              <p className="ap-miudo">“Tirar o segundo fator” está apagado porque esta conta não tem segundo fator cadastrado.</p>
            ) : null}
            {erroDaRede ? (
              <p role="alert" className="ap-janela-erro">
                {erroDaRede}
              </p>
            ) : null}
            {daCasa ? <Nota>Esta conta tem função na casa: barrar a rede, tirar o segundo fator e apagar a conta ficam para o painel da equipe, depois de tirar a função.</Nota> : null}
            {papel === "coordenacao" && !geral?.saude.admin && !f.suspensa && f.entrada === "aprovada" ? (
              <div className="ap-linha-acoes" style={{ justifyContent: "flex-start" }}>
                <Botao variante="dourado" onClick={nomearAdmin}>
                  Nomear admin da Alumia
                </Botao>
              </div>
            ) : null}
          </>
        )}
      </Quadro>
      {janela}
    </div>
  );
}

function RedesBarradas() {
  const leitura = useDado<BanimentoDeRede[]>("alumia_painel_redes");
  const { pedir, janela } = useJanela();
  const itens = leitura.dados ?? [];
  const liberar = (b: BanimentoDeRede) =>
    pedir({
      titulo: "Liberar a rede",
      texto: (
        <p>
          O banimento por rede acaba agora e as <strong>{b.barradas_agora}</strong> contas que ele segura voltam, a não ser que outra decisão ainda as segure.
        </p>
      ),
      campos: [{ tipo: "motivo" }],
      confirmar: "Liberar",
      fazer: (v) => rpc("alumia_painel_rede_desfazer", { p_id: b.id, p_motivo: motivoDe(v) }),
      sucesso: "Rede liberada.",
      depois: leitura.recarregar,
    });
  return (
    <>
      <Nota>
        O “banir por IP” compara um resumo embaralhado do endereço (feito com um segredo que só o servidor tem), guardado por 30 dias. O endereço em si não é guardado em lugar nenhum, nem para a coordenação. Cada banimento tem prazo de até 90 dias, porque endereço muda e muita gente divide o mesmo, e barra só quem continua entrando da mesma rede: quem troca de rede (os dados do celular, por exemplo) sai da barreira. Para barrar a pessoa, use a suspensão ou o banimento da conta. Para barrar uma rede, abra a ficha de uma conta que entrou por ela.
      </Nota>
      <Estado leitura={leitura} eVazio={Boolean(leitura.dados) && itens.length === 0} vazio="Nenhuma rede barrada, nem agora nem antes." />
      {itens.length > 0 ? (
        <Quadro>
          <ul className="ap-lista">
            {itens.map((b) => (
              <li key={b.id} className="ap-linha">
                <span className="ap-linha-texto">
                  <span className="ap-linha-cabeca">
                    <Etiqueta tom={b.ativo ? "vermelho" : undefined}>{b.ativo ? `em vigor · acaba ${falta(b.ate)}` : "encerrado"}</Etiqueta>
                    <span className="ap-miudo">
                      {quando(b.de)} até {quando(b.ate)}
                      {b.por ? ` · por ${b.por}` : ""}
                    </span>
                  </span>
                  <span className="ap-quebra">{b.motivo}</span>
                  <span className="ap-miudo">
                    {b.contas} {b.contas === 1 ? "conta atingida" : "contas atingidas"} na hora da decisão{b.ativo ? ` · ${b.barradas_agora} barradas agora` : ""}
                  </span>
                </span>
                <span className="ap-linha-acoes">
                  {b.ativo ? (
                    <Botao variante="contorno" tamanho="p" onClick={() => liberar(b)}>
                      Liberar
                    </Botao>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </Quadro>
      ) : null}
      {janela}
    </>
  );
}

/**
 * Pessoas: buscar pelo codinome ou pelo @, abrir a ficha de moderação e agir (suspender por prazo, banir, desfazer, encerrar
 * sessões, tirar o segundo fator, barrar a rede, apagar a conta). E a lista das redes barradas.
 */
export function Pessoas() {
  const { foco, geral } = usePainelDaAlumia();
  // No painel único, o título é o nome do menu.
  const noPainelUnico = useNoPainelUnico();
  const [parte, setParte] = useState<"buscar" | "redes" | "voluntariado">(foco === "redes" ? "redes" : foco === "voluntariado" ? "voluntariado" : "buscar");
  const [aberta, setAberta] = useState<string | null>(foco && UUID.test(foco) ? foco : null);
  return (
    <div className="ap-tela">
      <Titulo nome={noPainelUnico ? "Contas: suspender e banir" : "Pessoas"} sobre="Busque pelo codinome ou pelo @ e abra a ficha de moderação. Toda sanção pede motivo, avisa a pessoa e fica no registro." />
      <Fita
        rotulo="Parte"
        atual={parte}
        escolher={setParte}
        opcoes={[
          { id: "buscar", nome: "Buscar pessoa" },
          { id: "redes", nome: "Redes barradas", conta: geral?.numeros.redes_barradas },
          { id: "voluntariado", nome: "Voluntariado" },
        ]}
      />
      {parte === "redes" ? (
        <RedesBarradas />
      ) : parte === "voluntariado" ? (
        <Quadro>
          <FilaDoVoluntariado lang="pt" />
        </Quadro>
      ) : (
        <div className="ap-lado">
          <Quadro>
            <BuscaDePessoa pelaConta escolhida={aberta} aoEscolher={(p) => setAberta(p.id)} />
          </Quadro>
          {aberta ? <Ficha key={aberta} id={aberta} /> : <Nota>Escolha uma conta na busca para abrir a ficha.</Nota>}
        </div>
      )}
    </div>
  );
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { leads, rpc, type Me } from "@/lib/backend";
import { BuscaDePessoa } from "./BuscaDePessoa";
import { data, dataHora, papeis, textoDoErro, useAcao, useLista } from "./comum";
import { MoldeConfiguracao, MoldeTabela } from "./moldes";
import { Abas, Area, Botao, Campo, Cartao, type ColumnDef, Faixa, Marca, Selecao, Selo, Vazio } from "./ui";

/** O recado de uma ação (sucesso ou erro do banco), numa faixa que o leitor de tela anuncia com calma. */
const Recado = ({ texto }: { texto: string }) => <div aria-live="polite">{texto && <Faixa tom="info">{texto}</Faixa>}</div>;

// ───────────── Aviso de abertura ─────────────

interface Abertura {
  definido: boolean;
  ativo?: boolean;
  titulo?: string;
  texto?: string;
  imagem?: string;
  credito?: string;
  link?: string;
  link_texto?: string;
  assinatura?: string;
  ate?: string;
}

const vazio = { ativo: false, titulo: "", texto: "", imagem: "", credito: "", link: "", link_texto: "", assinatura: "", ate: "" };

/**
 * O quadro que abre junto com o site. Enquanto nada for guardado aqui, vale o aviso que está nos arquivos do site. Molde
 * Configuração: o que está valendo aparece numa faixa no alto; "Descartar" volta ao que foi guardado.
 */
export function AvisoDeAbertura() {
  const [form, setForm] = useState(vazio);
  // O que está guardado no banco (para saber se há mudança, voltar atrás e mostrar o que está no ar).
  const [salvo, setSalvo] = useState(vazio);
  const [definido, setDefinido] = useState<boolean | null>(null);
  const titulo = useRef<HTMLInputElement>(null);
  const acao = useAcao(() => {
    setDefinido(true);
    setSalvo(form);
  });

  useEffect(() => {
    let cancelado = false;
    rpc<Abertura>("abertura")
      .then((atual) => {
        if (cancelado) return;
        setDefinido(Boolean(atual?.definido));
        if (atual?.definido) {
          const lido = { ...vazio, ...atual, ativo: Boolean(atual.ativo) };
          setForm(lido);
          setSalvo(lido);
        }
      })
      .catch(() => {
        if (!cancelado) setDefinido(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const mudar = (campoDoForm: keyof typeof vazio) => (e: { target: { value: string } }) => setForm({ ...form, [campoDoForm]: e.target.value });
  const incompleto = form.ativo && (form.titulo.trim().length < 3 || form.texto.trim().length < 10);
  const sujo = JSON.stringify(form) !== JSON.stringify(salvo);
  // Antes o botão ficava apagado sem dizer por quê; agora, depois de uma tentativa, o campo que falta diz o que pede.
  const [tentou, setTentou] = useState(false);

  return (
    <div className="pn-tela" style={{ maxWidth: "48rem" }}>
      <p className="pn-sobre">
        Um quadro pequeno que abre no meio da tela na primeira visita, com um botão para fechar. Quem fecha não vê de novo até o texto mudar.
        {definido === false && " Hoje vale o aviso guardado nos arquivos do site; ao guardar aqui, este passa a valer."}
      </p>
      {definido && salvo.ativo && (
        <Faixa tom="bordo" titulo={salvo.titulo}>
          <p className="whitespace-pre-line">{salvo.texto}</p>
          {salvo.assinatura && <p className="pn-ajuda">{salvo.assinatura}</p>}
        </Faixa>
      )}
      <Faixa tom="aviso" titulo="Antes de usar para apoio a candidatura, leia:">
        <ul className="list-disc space-y-1 pl-5">
          <li>A lei eleitoral (Lei 9.504/1997, art. 57-D) proíbe o anonimato: assine com o nome de quem responde pela manifestação.</li>
          <li>Pessoa jurídica não pode fazer propaganda eleitoral em site próprio, nem de graça (art. 57-C). Se o instituto virar associação com CNPJ, este quadro não pode mais pedir voto.</li>
          <li>Não pague para impulsionar. Não publique conteúdo novo de campanha no dia da votação.</li>
          <li>Fale do que você defende. Não atribua crime nem xingue adversário: ofensa em propaganda eleitoral é crime (Código Eleitoral, arts. 324 a 326).</li>
        </ul>
      </Faixa>
      <MoldeConfiguracao
        sujo={sujo}
        salvando={acao.ocupado}
        rotuloSalvar="Guardar aviso"
        aoDescartar={() => setForm(salvo)}
        aoSalvar={() => {
          // Ligado, o aviso precisa de título (3 letras) e texto (10): sem eles, o foco vai para o título.
          setTentou(incompleto);
          if (incompleto) titulo.current?.focus();
          else void acao.agir("abertura_salvar", { p: form }, "Aviso guardado. Os visitantes passam a ver em até seis horas (é o tempo que o navegador de cada um guarda a versão anterior).");
        }}
        grupos={[
          {
            id: "texto",
            titulo: "Aviso de abertura",
            campos: (
              <>
                <Marca rotulo="Mostrar o aviso" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
                <Campo ref={titulo} rotulo="Título" value={form.titulo} onChange={mudar("titulo")} maxLength={80} erro={tentou && form.ativo && form.titulo.trim().length < 3 ? "Com o aviso ligado, o título precisa de pelo menos 3 letras." : undefined} />
                <Area rotulo="Texto" value={form.texto} onChange={mudar("texto")} rows={5} maxLength={700} erro={tentou && form.ativo && form.texto.trim().length < 10 ? "Com o aviso ligado, o texto precisa de pelo menos 10 letras." : undefined} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo rotulo="Imagem (caminho dentro do site, por exemplo /imagens/aviso.webp)" value={form.imagem} onChange={mudar("imagem")} maxLength={200} placeholder="/imagens/…" />
                  <Campo rotulo="Crédito da imagem (autor e licença)" value={form.credito} onChange={mudar("credito")} maxLength={200} />
                  <Campo rotulo="Link do botão (opcional)" value={form.link} onChange={mudar("link")} maxLength={300} placeholder="/pt/materiais ou https://…" />
                  <Campo rotulo="Texto do botão" value={form.link_texto} onChange={mudar("link_texto")} maxLength={40} />
                  <Campo rotulo="Quem assina" value={form.assinatura} onChange={mudar("assinatura")} maxLength={120} />
                  <Campo rotulo="Mostrar até (opcional)" type="date" value={form.ate} onChange={mudar("ate")} />
                </div>
                <Recado texto={acao.aviso} />
              </>
            ),
          },
        ]}
      />
    </div>
  );
}

// ───────────── Segurança e sucessão ─────────────

interface Pessoa {
  id: string;
  nome: string;
  email: string;
  suspenso: boolean;
  visto_em: string;
}

interface Seguranca {
  exigir_2fa: boolean;
  segundo_fator: boolean;
  sem_segundo_fator: string[] | null;
}

interface Sucessao {
  lideranca: { id: string; nome: string; visto_em: string }[];
  ordem: { id: string; nome: string; visto_em: string }[];
}

type AbaDaSeguranca = "fator" | "sucessao" | "passar";

/**
 * Segurança e sucessão em três abas: a exigência do segundo fator (o estado em faixa), a ordem de sucessão (molde
 * Configuração: mexe na lista e guarda de uma vez) e, para a coordenação, passar o posto.
 */
export function SegurancaSucessao({ me }: { me: Me }) {
  const lider = leads(me);
  const seguranca = useLista<Seguranca>("seguranca_ver");
  const sucessao = useLista<Sucessao>("sucessao_ver");
  const pessoas = useLista<Pessoa[]>("voluntarios_listar");
  const acao = useAcao(() => {
    seguranca.recarregar();
    sucessao.recarregar();
  });
  const [ordem, setOrdem] = useState<string[] | null>(null);
  const [nova, setNova] = useState("");
  const [herdeiro, setHerdeiro] = useState("");
  const [confirma, setConfirma] = useState(false);
  const [aba, setAba] = useState<AbaDaSeguranca>("fator");

  const atual = ordem ?? sucessao.dados?.ordem.map((pessoa) => pessoa.id) ?? [];
  const nomeDe = (id: string) => pessoas.dados?.find((pessoa) => pessoa.id === id)?.nome ?? sucessao.dados?.ordem.find((pessoa) => pessoa.id === id)?.nome ?? "…";
  const candidatos = pessoas.dados?.filter((pessoa) => !pessoa.suspenso && pessoa.id !== me.id && !atual.includes(pessoa.id)) ?? [];
  const ativas = pessoas.dados?.filter((pessoa) => !pessoa.suspenso && pessoa.id !== me.id) ?? [];
  const mover = (indice: number, passo: number) => {
    const lista = [...atual];
    const destino = indice + passo;
    if (destino < 0 || destino >= lista.length) return;
    [lista[indice], lista[destino]] = [lista[destino], lista[indice]];
    setOrdem(lista);
  };
  const ligada = Boolean(seguranca.dados?.exigir_2fa);

  const fator = (
    <div className="pn-tela">
      <Faixa tom={ligada ? "ok" : "aviso"} titulo="Segundo fator obrigatório">
        <p>
          Situação: <strong>{ligada ? "ligada" : "desligada"}</strong>
        </p>
      </Faixa>
      <Cartao sobre="Com esta exigência ligada, coordenação, coordenação pedagógica, supervisão, curadoria e mediação só usam o painel depois de digitar o código do aplicativo autenticador. Senha ou link de e-mail roubado, sozinho, não abre nada.">
        <div className="pn-secao">
          {seguranca.dados?.sem_segundo_fator && seguranca.dados.sem_segundo_fator.length > 0 && <Faixa tom="aviso">Ainda sem aplicativo autenticador: {seguranca.dados.sem_segundo_fator.join(", ")}. Avise essas pessoas antes de ligar.</Faixa>}
          {lider && (
            <div>
              <Botao variante={ligada ? "padrao" : "principal"} perigo={ligada} disabled={acao.ocupado} onClick={() => acao.agir("seguranca_configurar", { p_exigir_2fa: !seguranca.dados?.exigir_2fa }, seguranca.dados?.exigir_2fa ? "Exigência desligada." : "Exigência ligada.")}>
                {seguranca.dados?.exigir_2fa ? "Desligar a exigência" : "Ligar a exigência"}
              </Botao>
            </div>
          )}
          <p className="pn-ajuda">Só é possível ligar depois de cadastrar e confirmar o seu próprio aplicativo (em Minha conta, Segundo fator). Assim ninguém se tranca do lado de fora.</p>
        </div>
      </Cartao>
    </div>
  );

  const sucessaoTela = (
    <div className="pn-tela">
      {sucessao.dados?.lideranca.map((pessoa) => (
        <Faixa key={pessoa.id} tom="info">
          Coordenação hoje: <strong>{pessoa.nome}</strong> <span className="text-ink-soft">· último acesso em {data(pessoa.visto_em)}</span>
        </Faixa>
      ))}
      <MoldeConfiguracao
        sujo={lider && ordem !== null}
        salvando={acao.ocupado}
        rotuloSalvar="Guardar ordem"
        aoDescartar={lider ? () => setOrdem(null) : undefined}
        aoSalvar={async () => {
          if (await acao.agir("sucessao_definir", { p_usuarios: atual }, "Ordem de sucessão guardada.")) setOrdem(null);
        }}
        grupos={[
          {
            id: "ordem",
            titulo: "Ordem de sucessão",
            sobre: "Se a coordenação ficar mais de 90 dias sem entrar no painel, ela passa sozinha para a primeira pessoa desta lista que tenha entrado nos últimos 30 dias. Quem saiu continua na equipe, como vice-coordenação.",
            campos: (
              <>
                {atual.length === 0 ? (
                  <Vazio titulo="Ninguém na lista: hoje, se a coordenação sumir, o posto fica vago." />
                ) : (
                  <ol aria-label="Ordem de sucessão" className="pn-lista pn-lista-plana">
                    {atual.map((id, indice) => (
                      <li key={id} className="pn-item">
                        <span className="pn-rotulo-mono tabular-nums" style={{ minWidth: "1.5rem" }}>
                          {indice + 1}.
                        </span>
                        <span className="pn-item-texto">
                          <span className="pn-item-titulo">{nomeDe(id)}</span>
                        </span>
                        {lider && (
                          <span className="pn-item-acoes">
                            <Botao icone pequeno simbolo={ArrowUp} aria-label={`Subir ${nomeDe(id)}`} dica={`Subir ${nomeDe(id)}`} disabled={indice === 0} onClick={() => mover(indice, -1)} />
                            <Botao icone pequeno simbolo={ArrowDown} aria-label={`Descer ${nomeDe(id)}`} dica={`Descer ${nomeDe(id)}`} disabled={indice === atual.length - 1} onClick={() => mover(indice, 1)} />
                            <Botao variante="discreto" pequeno simbolo={X} onClick={() => setOrdem(atual.filter((item) => item !== id))}>
                              Tirar
                            </Botao>
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
                {lider && (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-60 flex-1">
                      <span className="pn-rotulo">Acrescentar à lista</span>
                      <BuscaDePessoa rotulo="Acrescentar à lista" entre={candidatos} escolhida={candidatos.find((pessoa) => pessoa.id === nova) ?? null} escolher={(pessoa) => setNova(pessoa?.id ?? "")} />
                    </div>
                    <Botao
                      disabled={!nova || atual.length >= 10}
                      onClick={() => {
                        setOrdem([...atual, nova]);
                        setNova("");
                      }}
                    >
                      Acrescentar
                    </Botao>
                  </div>
                )}
                <Faixa tom="aviso">Atenção: esta lista só passa o comando do painel. As contas do domínio, da hospedagem e do banco continuam no nome de quem as criou; guarde o acesso de emergência a elas em um cofre de senhas com herdeiro definido.</Faixa>
              </>
            ),
          },
        ]}
      />
    </div>
  );

  const passar = (
    <Cartao variante="alerta" titulo="Passar a coordenação" sobre="Você entrega o posto e passa a ser coordenação pedagógica. Só a nova coordenação pode devolver.">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-60 flex-1">
          <span className="pn-rotulo">Para quem</span>
          <BuscaDePessoa
            rotulo="Para quem passar a coordenação"
            entre={ativas}
            escolhida={ativas.find((pessoa) => pessoa.id === herdeiro) ?? null}
            escolher={(pessoa) => {
              setHerdeiro(pessoa?.id ?? "");
              setConfirma(false);
            }}
          />
        </div>
        {confirma ? (
          <Botao
            perigo
            disabled={acao.ocupado}
            onClick={async () => {
              if (await acao.agir("lideranca_passar", { p_usuario: herdeiro }, "Coordenação passada.")) window.location.reload();
            }}
          >
            Confirmar: passar a coordenação
          </Botao>
        ) : (
          <Botao disabled={!herdeiro} onClick={() => setConfirma(true)}>
            Passar a coordenação
          </Botao>
        )}
      </div>
    </Cartao>
  );

  const erro = seguranca.erro || sucessao.erro;
  return (
    <div className="pn-tela" style={{ maxWidth: "48rem" }}>
      <Abas<AbaDaSeguranca>
        rotulo="Segurança e sucessão"
        valor={aba}
        aoMudar={setAba}
        opcoes={(
          [
            { id: "fator", nome: "Segundo fator" },
            { id: "sucessao", nome: "Sucessão" },
            { id: "passar", nome: "Passar a coordenação" },
          ] as { id: AbaDaSeguranca; nome: string }[]
        ).filter((opcao) => lider || opcao.id !== "passar")}
        painel={(id) => (id === "fator" ? fator : id === "sucessao" ? sucessaoTela : lider ? passar : null)}
      />
      {erro && (
        <Faixa
          tom="erro"
          acao={
            <Botao
              pequeno
              onClick={() => {
                seguranca.recarregar();
                sucessao.recarregar();
              }}
            >
              Tentar de novo
            </Botao>
          }
        >
          {erro}
        </Faixa>
      )}
      <Recado texto={acao.aviso} />
    </div>
  );
}

// ───────────── Registro de atividades ─────────────

interface Registro {
  id: number;
  nome: string;
  acao: string;
  alvo: string;
  alvo_nome: string;
  detalhes: Record<string, unknown>;
  criado_em: string;
}

const acoes: Record<string, string> = {
  acesso_emails_da_equipe: "abriu a lista da equipe com os e-mails",
  acesso_termos_aceitos: "abriu a lista de termos assinados",
  acesso_termo_aceito: "leu o termo assinado de",
  acesso_saude_registro: "abriu o registro da vitrine de saúde de",
  acesso_saude_fila: "abriu a fila da vitrine de saúde",
  panico: "apertou o botão de pânico:",
  departamento_salvo: "mudou a página do departamento",
  votacao_aberta: "abriu a votação",
  votacao_encerrada: "encerrou a votação",
  papel_confiado: "confiou uma função a",
  papel_retirado: "retirou uma função de",
  pedido_aceito: "aceitou o pedido de voluntariado de",
  pedido_recusado: "recusou o pedido de voluntariado de",
  conta_suspensa: "suspendeu a conta de",
  conta_reativada: "reativou a conta de",
  lideranca_passada: "passou a coordenação para",
  lideranca_promovida: "coordenação definida direto no banco para",
  sucessao_definida: "definiu a ordem de sucessão",
  sucessao_automatica: "sucessão automática: a coordenação passou para",
  seguranca_configurada: "mudou a exigência de segundo fator",
  aparelho_novo: "conta aberta em aparelho novo:",
  armadilha: "ALERTA: função-isca chamada",
  contribuicao_aprovada: "aprovou a contribuição",
  contribuicao_recusada: "recusou a contribuição",
  anuncio_aprovado: "aprovou um anúncio do mural",
  anuncio_recusado: "recusou um anúncio do mural",
  radio_configurada: "mudou a rádio",
  comunidade_ocultar: "ocultou uma mensagem da comunidade",
  comunidade_bloqueada: "teve uma mensagem barrada pela avaliação automática da comunidade",
  comunidade_avaliacao_externa: "segunda avaliação da comunidade ligada ou desligada direto no banco",
  comunidade_editada: "editou uma mensagem da comunidade",
  anuncio_editado: "editou o texto de um anúncio do mural",
  triagem_liberada: "liberou na triagem",
  triagem_barrada: "barrou na triagem",
  conta_banida: "baniu a conta de",
  banimento_encerrado: "desfez o banimento de",
  inscricao_aceita: "aceitou a candidatura de",
  inscricao_recusada: "recusou a candidatura de",
  comunidade_mostrar: "liberou uma mensagem da comunidade",
  comunidade_trancar: "trancou uma conversa",
  comunidade_destrancar: "destrancou uma conversa",
  filtro_incluido: "acrescentou ao filtro:",
  filtro_retirado: "tirou do filtro:",
  abertura_salva: "mudou o aviso de abertura",
  reforco_assumido: "assumiu um pedido de reforço",
  reforco_concluido: "concluiu um pedido de reforço",
  assistente_configurado: "mudou o assistente de reforço (ligado e limites)",
  sala_da_equipe: "mudou o endereço da sala da equipe",
  material_publicado: "publicou um material",
  material_guardado: "guardou um material",
  material_removido: "removeu um material",
  termo_aceito: "aceitou o termo de adesão",
  horas_confirmadas: "confirmou horas",
  horas_recusadas: "recusou horas",
  certificado_aberto: "abriu um certificado para",
  certificado_testemunhado: "assinou um certificado",
  certificado_emitido: "emitiu um certificado para",
  certificado_cancelado: "cancelou um certificado",
  arquivo_bloqueado: "bloqueou um arquivo",
  boletim_lido: "abriu a lista do boletim",
  colaboracao_aberta: "chamou um colega para trabalhar junto em uma contribuição",
  colaboracao_fechada: "encerrou um trabalho em conjunto",
  contribuicao_editada: "editou a contribuição de outra pessoa",
  convite_criado: "criou um convite",
  convite_revogado: "cancelou um convite",
  convite_aceito: "entrou com um convite",
  equipe_apagada: "apagou todas as conversas da equipe",
  equipe_chave_definida: "definiu a chave da equipe",
  equipe_sala: "mudou o endereço da sala de voz e vídeo",
  site_configurado: "mudou os controles do site",
  canais_configurados: "trocou os endereços dos canais do WhatsApp e do Telegram",
  comunidade_modo_seguranca: "ligou ou desligou o modo de segurança da Comunidade",
  site_pausa: "pausou ou retomou os envios do público",
  usuario_editado: "acertou o nome ou a apresentação de",
  senha_redefinida: "redefiniu a senha de",
  senha_trocada: "escolheu uma senha nova depois da redefinição",
  equipe_mensagem_apagada: "apagou uma publicação do mural da equipe escrita por",
  divulgacao_criada: "pôs no calendário de divulgação:",
  divulgacao_editada: "mexeu no item de divulgação",
  divulgacao_situacao: "mudou a situação do item de divulgação",
  divulgacao_comentada: "comentou o item de divulgação",
  divulgacao_devolvida: "devolveu para rascunho o item de divulgação",
  divulgacao_apagada: "apagou do calendário de divulgação:",
  divulgacao_instagram: "mudou o endereço do Instagram do instituto",
  interdicao: "mudou a interdição do site",
  gaveta_aprovada: "publicou na Gaveta Aberta:",
  gaveta_recusada: "recusou na Gaveta Aberta:",
  expurgo: "fez um expurgo das áreas abertas",
  pedido_supervisao_criado: "pediu à coordenação (supervisão):",
  pedido_supervisao_aprovado: "aprovou um pedido da supervisão",
  pedido_supervisao_recusado: "recusou um pedido da supervisão",
  isca: "endereço-isca pedido por alguém de fora:",
  apoiador_salvo: "incluiu ou editou um nome no mural de apoiadores",
  apoiador_removido: "retirou um nome do mural de apoiadores",
  radio_canal_salvo: "criou ou editou um canal da rádio",
  radio_canal_removido: "removeu um canal da rádio",
  radio_faixa_salva: "incluiu ou editou uma faixa da rádio",
  radio_faixa_removida: "removeu uma faixa da rádio",
  denuncia_resolvida: "resolveu uma denúncia",
  anotacao_aprovada: "aprovou uma anotação de leitura",
  anotacao_oculta: "ocultou uma anotação de leitura",
  anuncio_removido: "apagou um anúncio do mural",
};

/** Os detalhes guardados viram texto de gente: sem identificadores internos, com sim e não no lugar de true e false. */
const nomesDosDetalhes: Record<string, string> = {
  faixa: "faixa", pausa: "pausa", motivo: "recado", papel: "função", disciplina: "disciplina", tipo: "tipo", origem: "origem", agente: "programa", exigir_2fa: "segundo fator obrigatório",
  justificativa: "motivo", campos: "o que mudou", sessoes_encerradas: "saiu dos aparelhos", situacao: "situação", formato: "formato", canal: "canal", ligado: "ligado", definido: "definido",
};
function detalhesLegiveis(detalhes: Record<string, unknown> | null): string {
  return Object.entries(detalhes ?? {})
    .filter(([, valor]) => valor !== "" && valor !== null && !(typeof valor === "string" && /^[0-9a-f-]{36}$/.test(valor)))
    .map(([chave, valor]) => `${nomesDosDetalhes[chave] ?? chave}: ${typeof valor === "boolean" ? (valor ? "sim" : "não") : typeof valor === "string" ? ((chave === "papel" && (papeis as Record<string, string>)[valor]) || valor) : JSON.stringify(valor)}`)
    .join(" · ");
}


interface Linha {
  id: number;
  criado_em: string;
  tabela: string;
  acao: string;
  titulo: string;
  campos: string[];
  via: string;
  nome: string;
  alvo_nome: string;
}

const coisas: Record<string, string> = { contribuicoes: "a contribuição", arquivos: "o arquivo", materiais: "o material", papeis: "a função" };
const verbos: Record<string, string> = { insercao: "incluiu", edicao: "editou", exclusao: "excluiu", aprovacao: "aprovou", recusa: "recusou", publicacao: "publicou" };
/** Mudança sem conta por trás: de onde ela veio. */
const origens: Record<string, string> = { service_role: "A rotina de publicação", banco: "Alguém direto no banco", anon: "Alguém sem conta", authenticated: "Uma conta que já foi apagada" };
/** Do que a linha fala: o título entre aspas ou, nas funções, o nome da função e de quem a recebeu ou perdeu. */
const assunto = (linha: Linha) =>
  linha.tabela === "papeis" ? [(papeis as Record<string, string>)[linha.titulo] ?? linha.titulo, linha.alvo_nome].filter(Boolean).join(" · ") : `“${linha.titulo}”`;

/** As colunas comuns às duas trilhas: quando (ordena pela data guardada) e quem. */
const colunaQuando = <T extends { criado_em: string }>(): ColumnDef<T> => ({ id: "quando", header: "Quando", accessorFn: (l) => l.criado_em, cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{dataHora(row.original.criado_em)}</span> });

/** Os botões das páginas do servidor (100 linhas por vez), com a escolha do que mostrar à esquerda. */
function Paginas({ pagina, setPagina, cheia, filtro }: { pagina: number; setPagina: (p: number) => void; cheia: boolean; filtro: ReactNode }) {
  return (
    <>
      <div className="min-w-60" style={{ marginRight: "auto" }}>
        {filtro}
      </div>
      <Botao variante="discreto" simbolo={ArrowLeft} disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>
        Mais recentes
      </Botao>
      <Botao variante="discreto" simboloFim={ArrowRight} disabled={!cheia} onClick={() => setPagina(pagina + 1)}>
        Mais antigos
      </Botao>
    </>
  );
}

/**
 * O livro do acervo: cada inclusão, edição, aprovação, recusa, publicação e exclusão no que vai para o site, e cada
 * função dada ou tirada. Quem escreve é o próprio banco, e nenhuma linha pode ser editada nem apagada antes do prazo.
 */
function LivroDoAcervo() {
  const [pagina, setPagina] = useState(0);
  const [tabela, setTabela] = useState("");
  const lista = useLista<Linha[]>("audit_logs_listar", { p_pagina: pagina, p_tabela: tabela || null });
  const colunas: ColumnDef<Linha>[] = [
    colunaQuando<Linha>(),
    { id: "quem", header: "Quem", accessorFn: (l) => l.nome || origens[l.via] || "Alguém", cell: ({ getValue }) => <strong>{String(getValue())}</strong> },
    {
      id: "o-que",
      header: "O quê",
      accessorFn: (l) => `${verbos[l.acao] ?? l.acao} ${coisas[l.tabela] ?? l.tabela} ${assunto(l)}`,
      cell: ({ row, getValue }) => (
        <>
          {String(getValue())}
          {row.original.acao === "edicao" && row.original.campos.length > 0 && <span className="text-ink-soft"> · mudou: {row.original.campos.join(", ")}</span>}
        </>
      ),
    },
  ];
  return (
    <div className="pn-tela">
      {lista.erro && (
        <Faixa
          tom="erro"
          acao={
            <Botao pequeno onClick={lista.recarregar}>
              Tentar de novo
            </Botao>
          }
        >
          {lista.erro}
        </Faixa>
      )}
      <MoldeTabela
        legenda="Livro do acervo"
        dados={lista.dados ?? []}
        colunas={colunas}
        carregando={lista.dados === null && !lista.erro}
        porPagina={100}
        densa
        vazio={<Vazio titulo="Nada registrado." />}
        barra={
          <Paginas
            pagina={pagina}
            setPagina={setPagina}
            cheia={(lista.dados?.length ?? 0) >= 100}
            filtro={
              <Selecao
                rotulo="Mostrar"
                value={tabela}
                onChange={(e) => {
                  setTabela(e.target.value);
                  setPagina(0);
                }}
              >
                <option value="">Tudo</option>
                <option value="contribuicoes">Só contribuições (aulas, obras, matérias)</option>
                <option value="arquivos">Só arquivos enviados</option>
                <option value="materiais">Só materiais</option>
                <option value="papeis">Só funções dadas e tiradas</option>
              </Selecao>
            }
          />
        }
      />
    </div>
  );
}

type AbaDoRegistro = "decisoes" | "livro";

/** As duas trilhas do que acontece no instituto: as decisões tomadas pelo painel e o livro que o banco escreve sozinho. */
export function RegistroDeAtividades() {
  const [aba, setAba] = useState<AbaDoRegistro>("decisoes");
  return (
    <Abas<AbaDoRegistro>
      rotulo="Registro de atividades"
      opcoes={[
        { id: "decisoes", nome: "Decisões no painel" },
        { id: "livro", nome: "Livro do acervo" },
      ]}
      valor={aba}
      aoMudar={setAba}
      painel={(id) => (id === "decisoes" ? <Decisoes /> : <LivroDoAcervo />)}
    />
  );
}

/** Quem fez o quê no painel. Guarda por pouco mais de um ano; não registra endereço de rede de ninguém. */
function Decisoes() {
  const [pagina, setPagina] = useState(0);
  const [filtro, setFiltro] = useState("");
  const [estado, setEstado] = useState<{ lista: Registro[] | null; erro: string }>({ lista: null, erro: "" });

  useEffect(() => {
    let cancelado = false;
    rpc<Registro[]>("auditoria_listar", { p_pagina: pagina, p_acao: filtro || null })
      .then((lista) => {
        if (!cancelado) setEstado({ lista, erro: "" });
      })
      .catch((erro: unknown) => {
        if (!cancelado) setEstado({ lista: [], erro: textoDoErro(erro) });
      });
    return () => {
      cancelado = true;
    };
  }, [pagina, filtro]);

  const colunas: ColumnDef<Registro>[] = [
    colunaQuando<Registro>(),
    { id: "quem", header: "Quem", accessorFn: (r) => r.nome || "Alguém sem conta", cell: ({ getValue }) => <strong>{String(getValue())}</strong> },
    {
      id: "o-que",
      header: "O quê",
      accessorFn: (r) => `${acoes[r.acao] ?? r.acao} ${r.alvo_nome || (/^[0-9a-f-]{36}$/.test(r.alvo) ? "" : r.alvo)}`,
      // O alerta de função-isca vem num selo de erro (a palavra "ALERTA" já está no texto; a cor só acompanha).
      cell: ({ row, getValue }) =>
        row.original.acao === "armadilha" ? (
          <Selo tom="erro" ponto>
            {String(getValue())}
          </Selo>
        ) : (
          String(getValue())
        ),
    },
    { id: "detalhes", header: "Detalhes", enableSorting: false, accessorFn: (r) => detalhesLegiveis(r.detalhes), cell: ({ getValue }) => <span className="text-ink-soft">{String(getValue())}</span> },
  ];

  return (
    <div className="pn-tela">
      {estado.erro && <Faixa tom="erro">{estado.erro}</Faixa>}
      <MoldeTabela
        legenda="Decisões no painel"
        dados={estado.lista ?? []}
        colunas={colunas}
        carregando={estado.lista === null}
        porPagina={100}
        densa
        vazio={<Vazio titulo="Nada registrado." />}
        barra={
          <Paginas
            pagina={pagina}
            setPagina={setPagina}
            cheia={(estado.lista?.length ?? 0) >= 100}
            filtro={
              <Selecao
                rotulo="Mostrar"
                value={filtro}
                onChange={(e) => {
                  setFiltro(e.target.value);
                  setPagina(0);
                }}
              >
                <option value="">Tudo</option>
                <option value="armadilha">Só alertas de função-isca</option>
                <option value="aparelho_novo">Só acessos de aparelho novo</option>
                <option value="papel_confiado">Só funções confiadas</option>
                <option value="papel_retirado">Só funções retiradas</option>
                <option value="conta_suspensa">Só contas suspensas</option>
                <option value="interdicao">Só interdições</option>
                <option value="expurgo">Só expurgos</option>
                <option value="senha_redefinida">Só senhas redefinidas</option>
                <option value="usuario_editado">Só contas editadas pela coordenação</option>
                <option value="site_configurado">Só mudanças nos controles do site</option>
                <option value="convite_criado">Só convites criados</option>
                <option value="isca">Só endereços-isca</option>
              </Selecao>
            }
          />
        }
      />
    </div>
  );
}

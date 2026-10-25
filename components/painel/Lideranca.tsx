// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { leads, rpc, type Me } from "@/lib/backend";
import { BuscaDePessoa } from "./BuscaDePessoa";
import { Abas, Aviso, botao, botaoClaro, campo, data, dataHora, elo, papeis, rotulo, textoDoErro, useAcao, useLista } from "./comum";

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

/** O quadro que abre junto com o site. Enquanto nada for guardado aqui, vale o aviso que está nos arquivos do site. */
export function AvisoDeAbertura() {
  const [form, setForm] = useState(vazio);
  const [definido, setDefinido] = useState<boolean | null>(null);
  const acao = useAcao(() => setDefinido(true));

  useEffect(() => {
    let cancelado = false;
    rpc<Abertura>("abertura")
      .then((atual) => {
        if (cancelado) return;
        setDefinido(Boolean(atual?.definido));
        if (atual?.definido) setForm({ ...vazio, ...atual, ativo: Boolean(atual.ativo) });
      })
      .catch(() => {
        if (!cancelado) setDefinido(false);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const mudar = (campoDoForm: keyof typeof vazio) => (e: { target: { value: string } }) => setForm({ ...form, [campoDoForm]: e.target.value });

  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-ink-soft">
        Um quadro pequeno que abre no meio da tela na primeira visita, com um botão para fechar. Quem fecha não vê de novo até o texto mudar.
        {definido === false && " Hoje vale o aviso guardado nos arquivos do site; ao guardar aqui, este passa a valer."}
      </p>
      <div className="border-l-2 border-oxblood pl-4 text-ink-soft">
        <p className="font-medium text-ink">Antes de usar para apoio a candidatura, leia:</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>A lei eleitoral (Lei 9.504/1997, art. 57-D) proíbe o anonimato: assine com o nome de quem responde pela manifestação.</li>
          <li>Pessoa jurídica não pode fazer propaganda eleitoral em site próprio, nem de graça (art. 57-C). Se o instituto virar associação com CNPJ, este quadro não pode mais pedir voto.</li>
          <li>Não pague para impulsionar. Não publique conteúdo novo de campanha no dia da votação.</li>
          <li>Fale do que você defende. Não atribua crime nem xingue adversário: ofensa em propaganda eleitoral é crime (Código Eleitoral, arts. 324 a 326).</li>
        </ul>
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} className="h-4 w-4" />
        Mostrar o aviso
      </label>
      <label className="block">
        Título
        <input value={form.titulo} onChange={mudar("titulo")} maxLength={80} className={campo} />
      </label>
      <label className="block">
        Texto
        <textarea value={form.texto} onChange={mudar("texto")} rows={5} maxLength={700} className={campo} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          Imagem (caminho dentro do site, por exemplo /imagens/aviso.webp)
          <input value={form.imagem} onChange={mudar("imagem")} maxLength={200} placeholder="/imagens/…" className={campo} />
        </label>
        <label className="block">
          Crédito da imagem (autor e licença)
          <input value={form.credito} onChange={mudar("credito")} maxLength={200} className={campo} />
        </label>
        <label className="block">
          Link do botão (opcional)
          <input value={form.link} onChange={mudar("link")} maxLength={300} placeholder="/pt/materiais ou https://…" className={campo} />
        </label>
        <label className="block">
          Texto do botão
          <input value={form.link_texto} onChange={mudar("link_texto")} maxLength={40} className={campo} />
        </label>
        <label className="block">
          Quem assina
          <input value={form.assinatura} onChange={mudar("assinatura")} maxLength={120} className={campo} />
        </label>
        <label className="block">
          Mostrar até (opcional)
          <input type="date" value={form.ate} onChange={mudar("ate")} className={campo} />
        </label>
      </div>
      <button type="button" className={botao} disabled={acao.ocupado || (form.ativo && (form.titulo.trim().length < 3 || form.texto.trim().length < 10))} onClick={() => acao.agir("abertura_salvar", { p: form }, "Aviso guardado. Os visitantes passam a ver em até seis horas (é o tempo que o navegador de cada um guarda a versão anterior).")}>
        Guardar aviso
      </button>
      <Aviso texto={acao.aviso} />
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
  const [aba, setAba] = useState<"fator" | "sucessao" | "passar">("fator");

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

  return (
    <div className="max-w-3xl">
      <Abas
        atual={aba}
        escolher={setAba}
        opcoes={[
          { id: "fator" as const, nome: "Segundo fator" },
          { id: "sucessao" as const, nome: "Sucessão" },
          { id: "passar" as const, nome: "Passar a coordenação" },
        ].filter((opcao) => lider || opcao.id !== "passar")}
      />
      <section hidden={aba !== "fator"}>
        <h2 className="font-serif text-2xl font-semibold">Segundo fator obrigatório</h2>
        <p className="mt-1 text-ink-soft">
          Com esta exigência ligada, coordenação, coordenação pedagógica, supervisão, curadoria e mediação só usam o painel depois de digitar o código do aplicativo autenticador. Senha ou link de e-mail roubado, sozinho, não abre nada.
        </p>
        <p className="mt-2">
          Situação: <strong>{seguranca.dados?.exigir_2fa ? "ligada" : "desligada"}</strong>
        </p>
        {seguranca.dados?.sem_segundo_fator && seguranca.dados.sem_segundo_fator.length > 0 && (
          <p className="mt-1 text-oxblood">Ainda sem aplicativo autenticador: {seguranca.dados.sem_segundo_fator.join(", ")}. Avise essas pessoas antes de ligar.</p>
        )}
        {lider && (
          <button
            type="button"
            className={`mt-3 ${botaoClaro}`}
            disabled={acao.ocupado}
            onClick={() => acao.agir("seguranca_configurar", { p_exigir_2fa: !seguranca.dados?.exigir_2fa }, seguranca.dados?.exigir_2fa ? "Exigência desligada." : "Exigência ligada.")}
          >
            {seguranca.dados?.exigir_2fa ? "Desligar a exigência" : "Ligar a exigência"}
          </button>
        )}
        <p className="mt-2 text-ink-soft">Só é possível ligar depois de cadastrar e confirmar o seu próprio aplicativo (em Minha conta, Segundo fator). Assim ninguém se tranca do lado de fora.</p>
      </section>

      <section hidden={aba !== "sucessao"}>
        <h2 className="font-serif text-2xl font-semibold">Ordem de sucessão</h2>
        <p className="mt-1 text-ink-soft">
          Se a coordenação ficar mais de 90 dias sem entrar no painel, ela passa sozinha para a primeira pessoa desta lista que tenha entrado nos últimos 30 dias. Quem saiu continua na equipe, como vice-coordenação.
        </p>
        {sucessao.dados?.lideranca.map((pessoa) => (
          <p key={pessoa.id} className="mt-2">
            Coordenação hoje: <strong>{pessoa.nome}</strong> <span className="text-ink-soft">· último acesso em {data(pessoa.visto_em)}</span>
          </p>
        ))}
        <ol className="mt-3 divide-y divide-rule border-y border-rule">
          {atual.map((id, indice) => (
            <li key={id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {indice + 1}. {nomeDe(id)}
              </span>
              {lider && (
                <span className="flex gap-3">
                  <button type="button" className={elo} aria-label={`Subir ${nomeDe(id)}`} disabled={indice === 0} onClick={() => mover(indice, -1)}>↑</button>
                  <button type="button" className={elo} aria-label={`Descer ${nomeDe(id)}`} disabled={indice === atual.length - 1} onClick={() => mover(indice, 1)}>↓</button>
                  <button type="button" className={elo} onClick={() => setOrdem(atual.filter((item) => item !== id))}>Tirar</button>
                </span>
              )}
            </li>
          ))}
        </ol>
        {atual.length === 0 && <p className="mt-2 text-ink-soft">Ninguém na lista: hoje, se a coordenação sumir, o posto fica vago.</p>}
        {lider && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-60 flex-1">
              Acrescentar à lista
              <BuscaDePessoa rotulo="Acrescentar à lista" entre={candidatos} escolhida={candidatos.find((pessoa) => pessoa.id === nova) ?? null} escolher={(pessoa) => setNova(pessoa?.id ?? "")} />
            </div>
            <button type="button" className={botaoClaro} disabled={!nova || atual.length >= 10} onClick={() => { setOrdem([...atual, nova]); setNova(""); }}>
              Acrescentar
            </button>
            <button type="button" className={botao} disabled={acao.ocupado || ordem === null} onClick={async () => { if (await acao.agir("sucessao_definir", { p_usuarios: atual }, "Ordem de sucessão guardada.")) setOrdem(null); }}>
              Guardar ordem
            </button>
          </div>
        )}
        <p className="mt-3 text-ink-soft">
          Atenção: esta lista só passa o comando do painel. As contas do domínio, da hospedagem e do banco continuam no nome de quem as criou; guarde o acesso de emergência a elas em um cofre de senhas com herdeiro definido.
        </p>
      </section>

      {lider && (
        <section hidden={aba !== "passar"}>
          <h2 className="font-serif text-2xl font-semibold">Passar a coordenação</h2>
          <p className="mt-1 text-ink-soft">Você entrega o posto e passa a ser coordenação pedagógica. Só a nova coordenação pode devolver.</p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <div className="min-w-60 flex-1">
              Para quem
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
              <button type="button" className="cursor-pointer bg-oxblood px-5 py-2.5 font-medium text-parchment" disabled={acao.ocupado} onClick={async () => { if (await acao.agir("lideranca_passar", { p_usuario: herdeiro }, "Coordenação passada.")) window.location.reload(); }}>
                Confirmar: passar a coordenação
              </button>
            ) : (
              <button type="button" className={botaoClaro} disabled={!herdeiro} onClick={() => setConfirma(true)}>
                Passar a coordenação
              </button>
            )}
          </div>
        </section>
      )}

      <Aviso texto={seguranca.erro || sucessao.erro || acao.aviso} />
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

/**
 * O livro do acervo: cada inclusão, edição, aprovação, recusa, publicação e exclusão no que vai para o site, e cada
 * função dada ou tirada. Quem escreve é o próprio banco, e nenhuma linha pode ser editada nem apagada antes do prazo.
 */
function LivroDoAcervo() {
  const [pagina, setPagina] = useState(0);
  const [tabela, setTabela] = useState("");
  const lista = useLista<Linha[]>("audit_logs_listar", { p_pagina: pagina, p_tabela: tabela || null });
  return (
    <div>
      <label className="block max-w-sm">
        Mostrar
        <select value={tabela} onChange={(e) => { setTabela(e.target.value); setPagina(0); }} className={campo}>
          <option value="">Tudo</option>
          <option value="contribuicoes">Só contribuições (aulas, obras, matérias)</option>
          <option value="arquivos">Só arquivos enviados</option>
          <option value="materiais">Só materiais</option>
          <option value="papeis">Só funções dadas e tiradas</option>
        </select>
      </label>
      {lista.erro && <p role="status" className="mt-2 text-oxblood">{lista.erro}</p>}
      <ul className="mt-2 divide-y divide-rule border-y border-rule">
        {lista.dados?.map((linha) => (
          <li key={linha.id} className="py-2">
            <span className={rotulo}>{dataHora(linha.criado_em)}</span>
            <p>
              <strong>{linha.nome || origens[linha.via] || "Alguém"}</strong> {verbos[linha.acao] ?? linha.acao} {coisas[linha.tabela] ?? linha.tabela} {assunto(linha)}
              {linha.acao === "edicao" && linha.campos.length > 0 && <span className="text-ink-soft"> · mudou: {linha.campos.join(", ")}</span>}
            </p>
          </li>
        ))}
      </ul>
      {lista.dados?.length === 0 && <p className="mt-2 text-ink-soft">Nada registrado.</p>}
      <div className="mt-3 flex gap-4">
        <button type="button" className={elo} disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>← Mais recentes</button>
        <button type="button" className={elo} disabled={(lista.dados?.length ?? 0) < 100} onClick={() => setPagina(pagina + 1)}>Mais antigos →</button>
      </div>
    </div>
  );
}

/** As duas trilhas do que acontece no instituto: as decisões tomadas pelo painel e o livro que o banco escreve sozinho. */
export function RegistroDeAtividades() {
  const [aba, setAba] = useState<"decisoes" | "livro">("decisoes");
  return (
    <div>
      <Abas opcoes={[{ id: "decisoes", nome: "Decisões no painel" }, { id: "livro", nome: "Livro do acervo" }]} atual={aba} escolher={setAba} />
      {aba === "decisoes" ? <Decisoes /> : <LivroDoAcervo />}
    </div>
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

  return (
    <div>
      <label className="block max-w-sm">
        Mostrar
        <select value={filtro} onChange={(e) => { setFiltro(e.target.value); setPagina(0); }} className={campo}>
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
        </select>
      </label>
      <Aviso texto={estado.erro} />
      <ul className="mt-2 divide-y divide-rule border-y border-rule">
        {estado.lista?.map((item) => (
          <li key={item.id} className={`py-2 ${item.acao === "armadilha" ? "text-oxblood" : ""}`}>
            <span className={rotulo}>{dataHora(item.criado_em)}</span>
            <p>
              <strong>{item.nome || "Alguém sem conta"}</strong> {acoes[item.acao] ?? item.acao} {item.alvo_nome || (/^[0-9a-f-]{36}$/.test(item.alvo) ? "" : item.alvo)}
              {detalhesLegiveis(item.detalhes) && <span className="text-ink-soft"> · {detalhesLegiveis(item.detalhes)}</span>}
            </p>
          </li>
        ))}
      </ul>
      {estado.lista?.length === 0 && <p className="mt-2 text-ink-soft">Nada registrado.</p>}
      <div className="mt-3 flex gap-4">
        <button type="button" className={elo} disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>← Mais recentes</button>
        <button type="button" className={elo} disabled={(estado.lista?.length ?? 0) < 100} onClick={() => setPagina(pagina + 1)}>Mais antigos →</button>
      </div>
    </div>
  );
}

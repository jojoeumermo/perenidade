// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState } from "react";
import { BackendError, rpc, type Role } from "@/lib/backend";
import { PAINEL_REMOTO, transmitir } from "@/lib/tempo-real";

// O painel é a mesa de trabalho da equipe e existe só em português.

export const campo = "painel-campo mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";
export const botao = "painel-botao cursor-pointer bg-ink px-5 py-2.5 font-semibold text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";
export const botaoClaro = "painel-botao cursor-pointer border-2 border-ink px-5 py-2 font-semibold hover:border-oxblood hover:text-oxblood disabled:cursor-not-allowed disabled:opacity-50";
export const elo = "cursor-pointer underline hover:text-oxblood";
export const rotulo = "font-mono text-xs uppercase tracking-widest text-gold";

export const papeis: Record<Role["papel"], string> = {
  coordenacao: "Coordenação comunitária",
  vice: "Coordenação pedagógica",
  supervisao: "Supervisão",
  curadoria: "Curadoria",
  mediacao: "Mediação",
  educacao: "Educação",
  educacao_secundaria: "Educação secundária",
  revisao: "Revisão",
  traducao: "Tradução",
  jornalismo: "Comunicação: jornal, rádio e podcast",
  mentoria: "Aula de reforço",
  design: "Design",
  marketing: "Comunicação: marketing e divulgação",
  desenvolvimento: "Desenvolvimento",
  representante: "Representante do departamento",
  porta_voz: "Porta-voz",
  saude: "Profissional de saúde",
};

/** O que cada papel enxerga e faz no painel. É a regra do banco, escrita para gente. */
export const oQueFaz: Record<Role["papel"], string> = {
  coordenacao: "Coordenação comunitária: palavra final em tudo. Confia e retira papéis, nomeia a coordenação pedagógica e a supervisão, define a sucessão, edita contas e redefine senhas, publica materiais e emite certificados. É a única que vê nome completo e e-mail.",
  vice: "Cuida do lado pedagógico: ouve os interesses dos estudantes, pedidos de disciplinas novas e as estatísticas, acompanha educadores e curadoria, decide o que vai ao ar e assina os certificados com o educador e a coordenação. Pode haver mais de uma pessoa. Não mexe na coordenação, na sucessão nem na segurança.",
  supervisao:
    "Faz o painel andar quando a coordenação e a vice-coordenação estão ausentes: acompanha a equipe (sem ver e-mails), suspende contas em emergência com motivo, cuida do mural da equipe, lê o registro, pausa os envios do público e liga o modo de segurança da Comunidade. Interdição e expurgo, só como pedido que a coordenação aprova. Também confia e retira os papéis de trabalho de quem está abaixo na hierarquia e nomeia representantes de departamento.",
  curadoria: "Aprova ou recusa contribuições, cuida da comunidade, das denúncias e do filtro de palavras.",
  mediacao: "Acompanha a Comunidade, decide os casos que pedem leitura humana e oculta, edita ou libera mensagens; aprova, edita ou recusa anúncios do Mural dos Trabalhadores, faz a triagem das contribuições antes de elas chegarem à fila de revisão e, quando alguém passa do limite, bane a conta (e, em caso extremo, a origem de rede). Não aprova conteúdo de ensino nem mexe na equipe.",
  educacao: "Escreve e dá parecer na disciplina confiada, cuida da comunidade e atende pedidos de reforço da disciplina.",
  educacao_secundaria: "Contribui com a disciplina confiada em paralelo às trilhas: aulas avulsas, listas de exercícios, resumos e materiais de apoio, que aparecem numa aba própria da disciplina. Tem os mesmos poderes do educador: também pode escrever aulas das trilhas, dar parecer na fila da disciplina e atender reforço.",
  revisao: "Lê a fila inteira e dá parecer; não aprova.",
  traducao: "Vê as aulas que ainda não têm tradução e o que outros tradutores já enviaram, e envia traduções; não vê a fila dos outros.",
  jornalismo: "Departamento de Comunicação. Escreve para o jornal (toda matéria passa pela revisão antes de sair), cuida da Rádio Lúcia (canais, faixas, transmissão ao vivo e sugestão de novas emissoras) e faz o podcast: pauta, roteiro, gravação, edição e publicação, com aprovação da supervisão do podcast. Pode cuidar dos três ou só de um.",
  mentoria: "Atende pedidos de reforço da disciplina confiada e responde por e-mail.",
  design: "Prepara materiais gráficos e atende pedidos de ajuda das outras funções.",
  marketing: "Departamento de Comunicação. Divulga o instituto: posts e artes para as redes sociais, cartazes de chamada, campanhas de voluntariado e de apoio, cortes do podcast. Monta o calendário de posts e stories do Instagram e usa o kit da marca e os materiais do painel, como o design. O acesso ao Instagram é dado pela coordenação pela própria Meta; o site nunca guarda senha de rede social.",
  desenvolvimento: "Cuida do código: vê o estado técnico do site (publicação, avaliação automática, faxina, sinais de varredura) e atende pedidos de ajuda das outras funções.",
  representante: "Primeira entrada e organizador de um departamento, nomeado pela coordenação, coordenação pedagógica ou supervisão: administra o grupo do departamento nas conversas, combina e delega tarefas, sem ser chefe. Não dá nem tira funções. O departamento é tudo o que a área engloba: o de Tecnologia, por exemplo, reúne informática, programação, modelagem 3D, edição de vídeo e de foto. Um departamento pode ter mais de um representante.",
  saude: "Profissional de saúde com registro ativo que aparece no Mural de Saúde: preenche o próprio perfil (registro no conselho, abordagem, contato), aceita o termo da vitrine e aprova o texto antes de ir ao ar. A coordenação confere o registro no conselho a cada seis meses. Não vê o resto do painel nem dado de ninguém.",
  porta_voz: "Um título, não uma função de trabalho: soma-se ao que a pessoa já faz (mediação, tradução, aulas…). O porta-voz leva a palavra do instituto a escolas, sindicatos, movimentos e eventos, em qualquer cidade, e traz de volta o que ouviu. Nomeado pela coordenação, coordenação pedagógica ou supervisão.",
};

/** Os grupos de disciplinas que também são departamentos (representante de "grupo-tecnologia" etc.). */
export const GRUPOS_DEPARTAMENTO: Record<string, string> = {
  "grupo-percursos": "Percursos (alfabetização e ENEM)",
  "grupo-linguagens": "Linguagens e artes",
  "grupo-ciencias": "Ciências da natureza e matemática",
  "grupo-tecnologia": "Tecnologia",
  "grupo-humanidades": "Humanidades",
  "grupo-teoria": "Teoria política",
  "grupo-lutas": "Lutas do povo",
  "grupo-oficios": "Ofícios",
  "grupo-hobbies": "Hobbies",
};
/** O nome de um departamento: uma função (educação, curadoria…) ou um grupo de disciplinas. */
export const nomeDoDepartamento = (valor: string | null | undefined) => (valor ? (GRUPOS_DEPARTAMENTO[valor] ?? papeis[valor as keyof typeof papeis] ?? valor) : "");

export const situacoes: Record<string, string> = {
  pendente: "aguardando revisão",
  aprovada: "aprovada, vai ao ar na próxima publicação",
  recusada: "não aprovada",
  publicada: "no ar",
  resolvida: "resolvida",
  aceita: "aceita",
};

const erros: Record<string, string> = {
  entre_primeiro: "Entre na sua conta para continuar.",
  sem_permissao: "Você não tem permissão para isso.",
  saude_declaracoes: "Marque as duas declarações para aceitar o termo do mural.",
  saude_aviso_primeiro: "Leia o aviso sobre o posicionamento do Instituto antes de aceitar o termo.",
  muitos_pedidos: "Muitos pedidos em pouco tempo. Tente de novo mais tarde.",
  fixadas_demais: "Já há três publicações fixadas neste canal. Solte uma antes de fixar outra.",
  falta_fonte: "Cite pelo menos uma fonte.",
  conta_suspensa: "Esta conta está suspensa.",
  nao_encontrado: "Não encontrado.",
  privado_fechado: "As conversas privadas são só para trabalho: com a coordenação, vice e supervisão, ou com quem está colaborando com você numa contribuição em andamento. O resto é nos grupos de departamento.",

  ja_decidida: "Esta contribuição já foi decidida.",
  trecho_mudou: "O trecho já mudou no texto; a sugestão não cabe mais. Ajuste à mão, se quiser, e recuse.",
  "invalido:trecho": "Esse trecho não está no texto. Copie o trecho exato (ou selecione no texto e use o botão).",
  ja_pediu: "Você já fez esse pedido e ele está em análise.",
  limite_anuncios: "Cada pessoa pode ter até três anúncios no mural.",
  ultima_coordenacao: "O instituto precisa de uma pessoa na coordenação.",
  senha_errada: "A senha não confere. Escreva a senha que você usa para entrar.",
  limite_pedidos: "Você já tem três pedidos em aberto.",
  confirme_segundo_fator: "Confirme primeiro o seu próprio código do aplicativo autenticador.",
  falta_termo: "Falta o aceite do termo de adesão ao trabalho voluntário.",
  sem_horas: "Não há horas confirmadas nesse período.",
  falta_assinatura: "Ainda faltam as assinaturas do educador e da coordenação pedagógica.",
  falta_vice: "É preciso alguém da coordenação pedagógica para assinar o certificado.",
  falta_educador: "O que vem de fora só vai ao ar depois do parecer favorável de um educador, e quem põe no ar é a revisão (ou a liderança).",
  topico_trancado: "Esta conversa está trancada.",
  falta_apoio: "Faltam apoios da equipe: são precisos dois antes de aprovar.",
  chave_desatualizada: "A chave desta conversa acabou de ser trocada. Envie de novo.",
  versao_ocupada: "A chave desta conversa acabou de ser trocada. Envie de novo.",
  aparelho_desconhecido: "Este aparelho foi removido das suas conversas. Recarregue a página para criar uma chave nova.",
  aparelho_pendente: "Este aparelho ainda não foi aprovado: aprove-o de um aparelho seu que já funciona.",
  identidade_existe: "A sua conta já tem uma identidade: este aparelho precisa ser aprovado por um aparelho que já funciona.",
  identidade_diferente: "Esta cópia de recuperação é de outra identidade, não da atual da sua conta.",
  sem_copia: "Não existe cópia de recuperação guardada para a sua conta.",
  ja_visto: "Este arquivo era para ver uma vez só, e já foi aberto.",
  arquivo_recusado: "Este tipo de arquivo não entra nas conversas. Vale foto (JPG, PNG, WebP, GIF), vídeo (MP4, WebM, MOV), áudio, PDF e DOCX.",
  arquivo_grande: "O arquivo passa de 12 MB.",
  anexos_demais: "No máximo seis arquivos por mensagem.",
  so_admins: "Neste grupo, só os administradores mandam mensagem.",
  ultimo_admin: "O grupo precisa de pelo menos um administrador. Promova alguém antes.",
  arquivo_nao_abre: "Não foi possível abrir este arquivo: a chave não bate ou o conteúdo foi alterado.",
  limite_fixadas: "Uma conversa só pode ter cinco mensagens fixadas. Desafixe uma antes.",
  fora_do_prazo: "Uma mensagem só pode ser editada até 15 minutos depois de enviada.",
  departamento_fixo: "Do grupo do seu departamento não dá para sair: ele acompanha a sua função.",
  mensagem_longa: "Mensagem longa demais. Divida em duas.",
  sem_cifra: "Este navegador não tem a cifra que as conversas usam. Atualize o navegador ou use outro.",
  conteudo_recusado: "O texto tem palavras que o filtro não aceita.",
  acesso_bloqueado: "Os envios desta origem foram bloqueados pela mediação.",
  email_nao_confirmado: "Já existe uma conta com esse e-mail, mas o e-mail ainda não foi confirmado. Peça para a pessoa confirmar e aceite de novo.",
  sem_links: "Só texto: sem endereços, imagens ou arquivos.",
  envios_pausados: "Os envios do público estão pausados pela coordenação.",
  boletim_recente: "Já saiu uma edição do boletim nas últimas seis horas. Espere um pouco para mandar outra.",
  sem_email: "A sua conta não tem um e-mail válido para receber o teste.",
  traducao_reservada: "Outra pessoa já reservou esta aula neste idioma.",
  traducao_a_caminho: "Já há uma tradução desta aula neste idioma esperando revisão ou publicação.",
  traducao_reservas_demais: "Você já tem cinco aulas reservadas. Envie ou libere alguma antes de reservar outra.",
  "sem_permissao:aprovar": "“Pronto para sair” é aprovação: quem marca é a coordenação ou a supervisão.",
  arquivo_nao_publicado: "O arquivo ainda não está no site: o material vai ao ar quando a publicação o puser lá.",
  candidatura_dia_da_votacao: "Hoje é o dia da votação: material de candidatura não pode ser publicado como novidade.",
  "invalido:credito_autor": "Diga quem fez o material.",
  "invalido:credito_origem": "Diga de onde veio o material.",
  "invalido:licenca": "Escolha a licença.",
  "invalido:responsavel": "O responsável precisa ser alguém da equipe.",
  "invalido:edicao": "A edição precisa de assunto (5 letras ou mais) e de texto (50 letras ou mais).",
  "invalido:imagem": "Imagem só do próprio site (/arquivos ou /imagens).",
  "invalido:descricao": "Falta a descrição de uma imagem.",
  "invalido:url": "Um endereço não é https nem do próprio site.",
  "invalido:blocos": "Algum bloco da edição está grande demais ou com tipo desconhecido.",
  sem_segundo_fator: "Ligue o aplicativo autenticador antes de gerar os códigos.",
  "invalido:dias": "O prazo precisa ficar entre 7 e 365 dias.",
  limite_colaboradores: "Cada contribuição pode ter até cinco pessoas trabalhando junto.",
  mudou_enquanto_editava: "Outra pessoa guardou alterações enquanto você editava. Copie o que escreveu, abra a versão nova e aplique de novo.",
  sem_pgcrypto: "O banco ainda não tem a extensão de senhas (pgcrypto). Rode o supabase/install.sql de novo no SQL Editor.",
  area_interditada: "Esta parte do site está interditada agora.",
  pedido_vencido: "Este pedido venceu (passou de 72 horas sem decisão). A supervisão pode fazer outro.",
  sem_conexao: "Sem conexão com o serviço.",
  chat_fechado: "As conversas estão fechadas pela coordenação por enquanto.",
  silenciado: "A coordenação silenciou a sua conta nas conversas por enquanto. Fale com ela pelo painel.",
  banco_desatualizado: "Esta parte do painel ainda não está disponível. Tente mais tarde ou avise a coordenação.",
  tarefa_ocupada: "Outra pessoa pegou esta tarefa agora há pouco. Escolha outra: há mais na fila.",
  tarefas_demais: "Você já tem o máximo de tarefas reservadas ao mesmo tempo. Entregue ou libere uma antes.",
  sem_mentor: "Ainda não há mentores disponíveis. Pergunte no grupo do seu departamento, nas Conversas.",
  "invalido:entrega": "A entrega está vazia ou faltando o campo principal da tarefa.",
  "invalido:ano": "O ano precisa ser só números (por exemplo, 1949).",
  "invalido:mutirao": "O mutirão precisa de tema, meta e datas (a de fim depois da de início).",
  "invalido:projeto": "O projeto precisa de nome (3 letras ou mais).",
  "invalido:nota": "Para devolver, escreva um comentário curto dizendo o que ajustar.",
  "invalido:minutos": "O tempo da tarefa é 5, 15 ou 30 minutos.",
  "invalido:max_por_ciclo": "Tarefas novas por rodada: de 1 a 500.",
  "invalido:max_reservas": "Reservas por pessoa: de 1 a 20.",
  "invalido:numero": "Algum número está fora do formato.",
  falha: "Algo deu errado. Tente de novo.",
};

export function textoDoErro(erro: unknown): string {
  const codigo = erro instanceof BackendError ? erro.code : "falha";
  const [tipo, qual] = codigo.split(":");
  if (erros[codigo]) return erros[codigo];
  if (tipo === "invalido") return `Confira o campo: ${qual}.`;
  return erros[tipo] ?? erros.falha;
}

/** O idioma da página (o painel pode estar em inglês, espanhol, russo ou chinês): datas e horas seguem ele. */
export const localDoPainel = () => (typeof document !== "undefined" && document.documentElement.lang) || "pt-BR";
export const data = (iso: string) => new Date(iso).toLocaleDateString(localDoPainel());
export const dataHora = (iso: string) => new Date(iso).toLocaleString(localDoPainel(), { dateStyle: "short", timeStyle: "short" });
/** Datas sem hora (AAAA-MM-DD) não podem passar pelo fuso: viram o dia anterior no Brasil. Ao meio-dia, não viram. */
export const dia = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(localDoPainel()) : "");
/** A mesma data sempre em dd/mm/aaaa, para documentos em português (a folha do certificado). */
export const diaBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/**
 * Carrega uma lista do serviço e devolve um jeito de recarregar. A lista também se refaz sozinha quando outro painel
 * avisa, pelo canal de tempo real, que alguma ação deu certo (mensagem nova, decisão tomada, aula marcada…).
 * Com "quieta", a lista não reage aos avisos: é para o que não muda por ação dos outros (preferências, a própria conta).
 */
export function useLista<T>(funcao: string, argumentos: Record<string, unknown> = {}, { quieta = false }: { quieta?: boolean } = {}) {
  const [estado, setEstado] = useState<{ dados: T | null; erro: string }>({ dados: null, erro: "" });
  const [volta, setVolta] = useState(0);
  const chave = JSON.stringify(argumentos);

  useEffect(() => {
    let cancelado = false;
    rpc<T>(funcao, JSON.parse(chave) as Record<string, unknown>)
      .then((dados) => {
        if (!cancelado) setEstado({ dados, erro: "" });
      })
      .catch((erro: unknown) => {
        if (!cancelado) setEstado({ dados: null, erro: textoDoErro(erro) });
      });
    return () => {
      cancelado = true;
    };
  }, [funcao, chave, volta]);

  // Aviso de outro painel: refaz a lista, com uma pequena espera para juntar avisos que chegam em rajada.
  useEffect(() => {
    if (quieta) return;
    let relogio = 0;
    const refazer = () => {
      if (document.visibilityState !== "visible") return;
      window.clearTimeout(relogio);
      relogio = window.setTimeout(() => setVolta((v) => v + 1), 400 + Math.random() * 600);
    };
    window.addEventListener(PAINEL_REMOTO, refazer);
    return () => {
      window.removeEventListener(PAINEL_REMOTO, refazer);
      window.clearTimeout(relogio);
    };
  }, [quieta]);

  return { ...estado, recarregar: useCallback(() => setVolta((v) => v + 1), []) };
}

/** Evento disparado depois de toda ação que deu certo no painel. */
export const PAINEL_MUDOU = "painel-mudou";

/** Executa uma ação e mostra o resultado em uma linha de aviso. */
export function useAcao(depois?: () => void) {
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function agir(funcao: string, argumentos: Record<string, unknown>, sucesso = "Feito.") {
    setOcupado(true);
    setAviso("");
    try {
      const resposta = await rpc<unknown>(funcao, argumentos);
      setAviso(sucesso);
      depois?.();
      // Avisa o menu do painel para refazer as contagens (a fila diminui assim que alguém decide)…
      window.dispatchEvent(new Event(PAINEL_MUDOU));
      // …e os outros painéis abertos, pelo canal de tempo real (só o nome da ação, nunca o conteúdo).
      transmitir(funcao);
      return resposta;
    } catch (erro) {
      setAviso(textoDoErro(erro));
      return null;
    } finally {
      setOcupado(false);
    }
  }
  return { agir, aviso, setAviso, ocupado };
}

export function Aviso({ texto }: { texto: string }) {
  return (
    <p role="status" className={`min-h-5 text-oxblood ${texto ? "painel-aviso" : ""}`}>
      {texto}
    </p>
  );
}

/** Divisões dentro de uma seção do painel, para aparecer uma coisa de cada vez. */
export function Abas<T extends string>({ opcoes, atual, escolher }: { opcoes: { id: T; nome: string; conta?: number }[]; atual: T; escolher: (id: T) => void }) {
  return (
    <div role="tablist" className="mb-6 flex flex-wrap gap-x-6 gap-y-1 border-b-2 border-ink">
      {opcoes.map((opcao) => (
        <button
          key={opcao.id}
          type="button"
          role="tab"
          aria-selected={atual === opcao.id}
          onClick={() => escolher(opcao.id)}
          className={`painel-aba -mb-0.5 cursor-pointer border-b-4 pb-2 ${atual === opcao.id ? "border-[#c21f16] font-semibold text-ink" : "border-transparent text-ink-soft hover:border-rule hover:text-ink"}`}
        >
          {opcao.nome}
          {Boolean(opcao.conta) && <span className="ml-1.5 bg-oxblood px-1.5 py-0.5 font-mono text-[0.7rem] font-semibold text-parchment">{opcao.conta}</span>}
        </button>
      ))}
    </div>
  );
}

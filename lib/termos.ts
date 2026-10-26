// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os termos que a equipe aceita no painel. Cada aceite guarda no banco o texto exato daqui (interno.termos_aceites),
// com a versão e o SHA-256, para sempre. Mudou o texto? Troque a versão aqui E no banco (interno.termo_voluntario_vigente
// ou interno.saude_termo_vigente): todo mundo aceita de novo, e os aceites antigos continuam guardados.
//
// Textos com base na Lei nº 9.608/1998 (serviço voluntário), na Lei nº 9.610/1998 (direitos autorais), na LGPD (Lei nº
// 13.709/2018) e no Código Civil. Ainda sem revisão de advogado: a revisão jurídica pode mudar a redação.
import regrasDoMural from "@/content/saude/regras.json";

export interface Termo {
  id: "voluntario" | "adesao" | "saude";
  versao: string;
  titulo: string;
  clausulas: string[];
}

/** O texto que fica guardado no aceite: título, versão e as cláusulas numeradas. */
export const textoDoTermo = (termo: Termo, extra: string[] = []) =>
  [`${termo.titulo} (versão ${termo.versao})`, "", ...termo.clausulas.map((c, i) => `${i + 1}. ${c}`), ...(extra.length ? ["", ...extra] : [])].join("\n");

/** O termo que aparece por cima do painel para toda pessoa com função, antes de qualquer outra coisa. */
export const TERMO_VOLUNTARIO: Termo = {
  id: "voluntario",
  versao: "2026-10-20",
  titulo: "Termo de voluntário do Instituto Lúcia",
  clausulas: [
    "Sou voluntário. Participo do Instituto Lúcia por vontade própria, de graça, como serviço voluntário nos termos da Lei nº 9.608/1998. Isso não cria vínculo de emprego nem obrigação trabalhista, previdenciária ou afim, para nenhum dos lados.",
    "Não há pagamento, agora nem depois. Ninguém me prometeu salário, bolsa, participação, porcentagem ou qualquer compensação futura, nem se o instituto crescer, receber apoio ou se formalizar. O apoio financeiro que o instituto recebe paga servidor, domínio e materiais, nunca pessoas da equipe.",
    "Tenho autonomia. Não há horário, jornada, meta nem prazo obrigatório: eu decido quando e como contribuo. Não há chefia nem advertência. A revisão do que vai ao ar é editorial (conferir fonte, clareza, correção), não controle do meu trabalho.",
    "Posso sair quando quiser, sem aviso e sem custo. O instituto também pode encerrar a minha participação a qualquer momento.",
    "O que eu publico é livre. Continuo autor e sou creditado como eu escolher. Ao enviar um conteúdo para o site, concedo ao Instituto Lúcia e a qualquer pessoa uma licença gratuita, mundial, por prazo indeterminado e irrevogável, nos termos da Creative Commons Atribuição-CompartilhaIgual 4.0 (CC BY-SA 4.0), para guardar, copiar, adaptar, traduzir e republicar esse conteúdo. Código que eu escrever para o site segue a licença do repositório (AGPL-3.0 ou posterior). Sair do instituto não obriga a retirar o que já foi publicado. Se o instituto vier a se formalizar como associação, esta licença vale também para ela.",
    "Só envio o que é meu ou o que tem licença livre, com a fonte à vista. Não copio texto, imagem ou vídeo de terceiros sem permissão nem ponho link para material pirata. Se alguém mostrar que um conteúdo viola direito autoral, ele sai do ar enquanto o caso é conferido.",
    "O conteúdo é educativo, oferecido como está, sem garantia de resultado. Cuido para não ensinar nada perigoso sem o aviso devido e não falo em nome de empresas ou marcas que eu citar.",
    "Guardo sigilo sobre os dados pessoais a que eu tiver acesso no painel (Lei Geral de Proteção de Dados) e uso as conversas da equipe só para o trabalho.",
    "Trato colegas e estudantes com respeito. Assédio, preconceito e desinformação tiram a pessoa da equipe.",
    "Declaro a minha idade na hora do aceite. Quem tem menos de 18 anos só participa com a autorização expressa do responsável legal, que lê este termo junto e autoriza a participação e a licença do que for publicado.",
    "Este termo segue só as leis do Brasil, também para quem colabora de outro país. Qualquer desacordo é resolvido no foro do domicílio da coordenação do Instituto Lúcia, no Brasil.",
    "O meu aceite fica registrado no painel com a data, a versão e o texto exato deste termo, e pode ser lido de novo em Minha conta.",
  ],
};

/** O termo de adesão de "Horas e certificados": o mesmo voluntariado, com nome completo, para as horas virarem certificado. */
export const TERMO_ADESAO: Termo = {
  id: "adesao",
  versao: "2026-10-20",
  titulo: "Termo de adesão ao serviço voluntário do Instituto Lúcia",
  clausulas: [
    "O Instituto Lúcia é uma iniciativa educacional gratuita e sem fins lucrativos, mantida por trabalho voluntário.",
    "Participo por vontade própria e sem remuneração, nas atividades que eu escolher: escrita e revisão de aulas, curadoria, tradução, jornal, aula de reforço, design, desenvolvimento ou outra combinada com a coordenação.",
    "Nos termos da Lei nº 9.608, de 18 de fevereiro de 1998, o serviço voluntário não gera vínculo empregatício nem obrigação de natureza trabalhista, previdenciária ou afim. Nenhuma compensação futura foi prometida ou será devida, em nenhuma hipótese.",
    "Não há horário fixo, jornada, meta nem subordinação: decido quando e como contribuo. A plataforma conta sozinha as horas do trabalho que faço no painel (aula aprovada, parecer, tradução, aula de reforço, episódio publicado e os demais tipos da tabela de horas definida pela coordenação). O que eu fizer fora do painel, registro com a descrição do que fiz, e essas horas só contam para certificado depois de conferidas pela coordenação.",
    "Posso deixar o voluntariado a qualquer momento, e o instituto pode encerrar a minha participação, sem ônus para nenhuma das partes.",
    "O que eu escrever para o site é publicado sob licença livre (CC BY-SA 4.0 para conteúdo; a licença do repositório para código), concedida de forma gratuita, por prazo indeterminado e irrevogável, com o crédito que eu escolher. A saída do voluntariado não obriga a retirar o que foi publicado.",
    "Comprometo-me a não inventar informações, a citar as fontes do que escrevo, a respeitar direitos autorais de terceiros e a guardar sigilo sobre dados pessoais a que tiver acesso no painel.",
    "Declaro ter 18 anos ou mais; se não tiver, o meu responsável legal autoriza esta adesão.",
    "Aplicam-se exclusivamente as leis da República Federativa do Brasil, também a quem colabora do exterior, com foro no domicílio da coordenação do Instituto Lúcia, no Brasil.",
  ],
};

/**
 * O termo do Mural de Saúde. RASCUNHO PARA REVISÃO DE ADVOGADO: não tratar como definitivo. O mural é um mural de
 * contatos; o instituto não presta, intermedeia nem garante atendimento. A versão vem de content/saude/regras.json
 * (termoVersao), a mesma que o banco exige: mudou a versão, todo perfil sai do ar até um novo aceite.
 */
export const TERMO_SAUDE: Termo = {
  id: "saude",
  versao: regrasDoMural.termoVersao,
  titulo: "Termo de adesão e ciência de responsabilidades — Mural de Saúde (Instituto Lúcia)",
  clausulas: [
    "Objeto. Aceito que o Instituto Lúcia divulgue, no Mural de Saúde de institutolucia.org, o meu nome completo ou nome social, a palavra da minha profissão, o meu registro no conselho, a abordagem, as áreas de atuação, o público, a modalidade, a cidade, os idiomas, o texto \"Sobre meu trabalho\", a foto (se eu autorizar) e a forma de contato que eu indicar.",
    "Natureza da divulgação. O mural funciona como um mural de contatos: o instituto apenas exibe o contato que autorizei. Não presta, organiza, intermedeia, agenda, acompanha nem garante atendimentos, não participa da relação entre mim e o paciente e não oferece canal de comunicação entre nós. Não há vínculo de emprego, sociedade, parceria ou representação entre mim e o instituto. O instituto não indica, não avalia e não classifica profissionais: os perfis aparecem em ordem alfabética.",
    "Independência política. O Instituto Lúcia tem posicionamento político declarado, e o mural é mantido de forma independente dessas posições. Participar do mural não significa que eu apoie as posições políticas do instituto, nem o contrário. Eu não falo em nome do instituto, e o instituto não fala em meu nome.",
    "Nome e imagem fora de política. O meu nome e a minha imagem nunca entram em material político, divulgação de campanha ou redes sociais do instituto. Eles aparecem só no mural, enquanto eu quiser.",
    "Minhas declarações. Declaro que: (a) meu registro está ativo e sem restrição ao exercício; (b) cumpro as normas do meu conselho, inclusive de ética, sigilo, registro documental, publicidade e atendimento a distância; (c) as informações que forneci são verdadeiras e vou atualizar qualquer mudança; (d) o texto do meu perfil foi aprovado por mim e é de minha autoria e responsabilidade.",
    "Publicidade. Sou responsável pelo conteúdo do meu perfil perante o meu conselho. Não uso o preço como forma de propaganda (nem gratuidade, valor social, desconto, pacote ou sorteio), não prometo resultados, não me comparo a colegas, não divulgo depoimentos nem antes e depois, não associo a profissão a práticas não reconhecidas nem a títulos ou vertentes religiosas e só uso títulos que eu tenha. O mural confere o texto automaticamente, mas essa conferência não tira a minha responsabilidade.",
    "Responsabilidade. Respondo pessoalmente pelos atendimentos que prestar e pelo conteúdo que divulgar. O instituto não presta serviço de saúde, não garante qualidade nem resultado de atendimento e não responde pelos meus atos profissionais. Comprometo-me a isentar o instituto de reclamações decorrentes dos meus atendimentos e do meu perfil, nos limites da lei, e a avisá-lo de qualquer reclamação, sanção ou mudança no meu registro. [Revisão jurídica: alcance e validade desta cláusula.]",
    "Condições do atendimento. As condições do atendimento são tratadas diretamente entre mim e a pessoa atendida. O instituto não recebe, repassa nem cobra quantia alguma, e a divulgação não me obriga a atender ninguém.",
    "Dados. Não peço que pacientes enviem dados de saúde ou documentos pelo site do instituto. Os dados dos atendimentos ficam sob minha responsabilidade, conforme a LGPD e as normas do meu conselho. Autorizo o tratamento dos meus dados profissionais pelo instituto para esta divulgação, nos termos da Política de privacidade.",
    "Foto. Autorizo ou não o uso da minha foto, conforme marcar no perfil, e posso revogar a qualquer momento. A foto é profissional e nunca mostra paciente, teste psicológico ou caso atendido.",
    "Emergências. O mural não é serviço de urgência, e o instituto mostra o aviso com SAMU (192), Bombeiros (193) e CVV (188).",
    "Conferência, ocultação e remoção. Autorizo a conferência do meu registro a cada seis meses. O instituto pode ocultar, suspender ou remover meu perfil a qualquer momento, sem aviso, em caso de dúvida, denúncia, sanção ou conteúdo que viole as normas do meu conselho. Posso pedir a remoção quando quiser, e o perfil sai do ar na hora.",
    "Aceite eletrônico. Li e aceito este termo, e reconheço o registro eletrônico do aceite (data, hora, versão e o texto exato, com impressão digital SHA-256) como prova da minha concordância. Aplicam-se as leis do Brasil.",
  ],
};

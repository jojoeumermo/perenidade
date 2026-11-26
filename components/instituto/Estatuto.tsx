// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { site } from "@/lib/site";

/**
 * A carta de funcionamento (o estatuto, 13 artigos) do Instituto. Um só texto para a página do site e para a tela do app:
 * quem mudar um artigo muda nos dois. O desenho do bloco é o da página do site.
 */
export function Estatuto() {
  const secao = "jornal-secao mt-14";
  return (
      <section aria-labelledby="estatuto" className="mt-16">
        <h2 id="estatuto" className={secao}><span className="jornal-editoria">Estatuto</span></h2>
        <p className="mt-4 border-l-4 border-gold bg-parchment-deep px-4 py-3 font-sans text-sm">
          Carta de funcionamento do Instituto Lúcia, versão de 20 de outubro de 2026. O instituto ainda não é uma associação registrada (não tem CNPJ): este texto não foi registrado em cartório e está em revisão. Se o instituto se formalizar, ele será a base do estatuto social, revisado por advogado.
        </p>
        <ol className="mt-8 space-y-6 text-lg leading-relaxed">
          <li><strong>Art. 1º — Nome e natureza.</strong> O {site.name} é um projeto educacional de educação popular, gratuito, sem fins lucrativos, sem anúncios e sem personalidade jurídica, mantido por trabalho voluntário, no endereço institutolucia.org.</li>
          <li><strong>Art. 2º — Finalidades.</strong> Oferecer gratuitamente aulas, trilhas de estudo, um acervo de obras e documentos, um jornal, rádio e podcasts, ferramentas de prática e espaços de convivência; preservar a memória das lutas do povo; e divulgar, como mural de contatos, iniciativas de trabalho e de saúde solidárias.</li>
          <li><strong>Art. 3º — Princípios.</strong> Os valores desta página: conhecimento livre, gratuidade, privacidade, fonte à vista, lado declarado com rigor, respeito a quem cria, cada pessoa no seu tempo, voluntariado com autonomia e acessibilidade.</li>
          <li><strong>Art. 4º — Quem participa.</strong> Qualquer pessoa estuda sem cadastro. A conta é opcional e serve para participar da Comunidade. A equipe é formada por voluntárias e voluntários que recebem funções no painel. Profissionais de saúde com registro ativo podem ter o contato divulgado no Mural de Saúde, com termo próprio e de forma independente das posições do instituto.</li>
          <li><strong>Art. 5º — Voluntariado.</strong> O trabalho na equipe é voluntário, sem remuneração e sem vínculo de emprego (Lei nº 9.608/1998), com autonomia de horário e de forma. Cada pessoa aceita o termo de voluntário ao entrar no painel; o aceite fica registrado para sempre. Quem tem menos de 18 anos participa só com a autorização do responsável legal.</li>
          <li><strong>Art. 6º — Organização.</strong> A coordenação comunitária tem a palavra final; a coordenação pedagógica cuida do ensino e do currículo; a supervisão faz o painel andar na ausência das duas. As funções de trabalho (educação, curadoria, revisão, tradução, mediação, jornalismo, design, marketing, desenvolvimento, aula de reforço e outras) se agrupam em departamentos, cada um com um ou mais representantes. Quem dá e tira funções segue a hierarquia registrada no painel.</li>
          <li><strong>Art. 7º — Decisões.</strong> Nada vai ao ar sem revisão. Cada educador cuida da própria disciplina e pode convidar colegas para ajudar. Disciplinas e trilhas são criadas e mudadas pela coordenação e pela coordenação pedagógica; qualquer voluntário propõe. Toda decisão fica no registro de atividades do painel.</li>
          <li><strong>Art. 8º — Conteúdo e licenças.</strong> O que o instituto publica sai sob a licença Creative Commons Atribuição-CompartilhaIgual 4.0; o código do site, sob a GNU AGPL 3.0 ou posterior. As licenças são irrevogáveis: o que foi publicado continua livre mesmo se quem escreveu sair. O acervo só indica fontes legítimas e retira o que violar direito autoral.</li>
          <li><strong>Art. 9º — Recursos.</strong> O instituto se mantém com apoio voluntário de quem pode ajudar, por financiamento coletivo. O dinheiro paga servidor, domínio e materiais, nunca pessoas da equipe, e as contas são publicadas na página Apoie.</li>
          <li><strong>Art. 10 — Dados pessoais.</strong> O tratamento de dados segue a Lei Geral de Proteção de Dados e está descrito na Política de privacidade. Para estudar, nenhum dado é pedido.</li>
          <li><strong>Art. 11 — Continuidade.</strong> Uma ordem de sucessão, registrada no painel, garante que o instituto continue se a coordenação se afastar.</li>
          <li><strong>Art. 12 — Mudanças nesta carta.</strong> Esta carta muda por decisão da coordenação, com a data da nova versão nesta página e o histórico público no repositório do site.</li>
          <li><strong>Art. 13 — Encerramento.</strong> Se o projeto acabar, o conteúdo continua livre pelas licenças, e o código continua aberto.</li>
        </ol>
      </section>
  );
}

/** A seção Acessibilidade da página do instituto; "href" é o endereço da página "Achei um erro". */
export function Acessibilidade({ href }: { href: string }) {
  return (
      <section aria-labelledby="acessibilidade" className="mt-16 border-t-2 border-ink pt-8 font-sans">
        <h2 id="acessibilidade" className="font-serif text-2xl font-semibold">Acessibilidade</h2>
        <p className="mt-2 max-w-3xl text-ink-soft">Seguindo a Lei Brasileira de Inclusão (Lei nº 13.146/2015, art. 63) e as diretrizes de acessibilidade da web (WCAG), o site funciona com leitor de tela e só com o teclado, tem botão de acessibilidade (tamanho do texto, alto contraste, texto espaçado, modo foco, leitura em voz alta e modo leve para internet lenta) e tradutor para Libras (VLibras). Encontrou uma barreira? Conte em <Link href={href} className="underline hover:text-oxblood">Achei um erro</Link> ou escreva para {site.newsletter}.</p>
      </section>
  );
}

// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { Cartaz } from "@/components/Cartaz";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";
import { paginaMeta } from "@/lib/seo";
import { site } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/[lang]/instituto">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/instituto", t.nav.institute, t.instituto.description);
}

const VALORES: [string, string][] = [
  ["Conhecimento livre", "O saber foi produzido por gerações de trabalhadoras e trabalhadores. Aqui ele não é mercadoria: nada é vendido, e tudo o que o instituto escreve pode ser copiado."],
  ["Gratuidade, sem lucro", "Ninguém paga para estudar e ninguém lucra. Sem anúncios. O apoio de quem pode ajudar paga servidor, domínio e materiais, com as contas abertas."],
  ["Privacidade", "Para estudar não há cadastro, e o que a pessoa faz nas aulas fica no aparelho dela. O instituto não vende dados e não usa rastreadores."],
  ["Fonte à vista", "Cada aula mostra em que se apoia, para quem lê poder conferir. Fato vem com fonte; erro encontrado é corrigido, e o histórico guarda as versões."],
  ["Lado declarado, com rigor", "O instituto é de esquerda e está do lado de quem trabalha e luta. Isso não autoriza distorcer ninguém: o ensino é rigoroso e cita o que cada autor disse."],
  ["Respeito a quem cria", "Só entra o que é livre para circular. Obra protegida aparece como referência, com link para a editora ou uma biblioteca."],
  ["Cada pessoa no seu tempo", "Sem ranking, sem pressa, sem pontuação para viciar. Estudar não é competição."],
  ["Voluntariado com autonomia", "Quem faz o instituto é voluntário: escolhe quando e como contribui, sem chefe, sem horário e sem salário."],
  ["Acessível a todos", "Leitor de tela, teclado, contraste, letra grande, tradução para Libras e páginas leves para celular simples e internet fraca."],
];

/** Propósito, missão, visão, valores e a carta de funcionamento (o estatuto, enquanto o instituto não é associação registrada). */
export default async function Instituto({ params }: PageProps<"/[lang]/instituto">) {
  const { lang, t } = await loadLang(params);
  const to = (path: string) => localePath(lang, path);
  const secao = "jornal-secao mt-14";
  return (
    <div className="mx-auto max-w-5xl px-4 py-12" lang="pt-BR">
      <Cartaz eyebrow="Quem somos, por escrito" title="O Instituto" slogan="Sem preço e sem cadeado" tone="vermelho">
        O propósito, a missão, a visão, os valores e as regras de funcionamento do Instituto Lúcia, num lugar só.
      </Cartaz>
      <Untranslated lang={lang} t={t} show={lang !== "pt"} />

      <section aria-labelledby="proposito" className="mt-12 grid gap-8 md:grid-cols-[14rem_1fr]">
        <h2 id="proposito" className="font-mono text-xs uppercase tracking-[0.25em] text-oxblood">Propósito</h2>
        <p className="font-serif text-3xl leading-snug md:text-4xl">Que o conhecimento acumulado pela humanidade volte a quem o produziu: <em className="text-oxblood">livre, gratuito e copiado por todos.</em></p>
      </section>

      <section aria-labelledby="missao" className="mt-12 grid gap-8 border-t-2 border-ink pt-8 md:grid-cols-[14rem_1fr]">
        <h2 id="missao" className="font-mono text-xs uppercase tracking-[0.25em] text-oxblood">Missão</h2>
        <p className="text-xl leading-relaxed">Manter, com trabalho voluntário, uma escola, uma biblioteca e um arquivo digitais, gratuitos e sem anúncios, em seis idiomas: aulas curtas que mostram as fontes, um acervo que leva às fontes legítimas das obras e ferramentas que funcionam no aparelho de quem estuda, sem exigir cadastro e sem vender dados.</p>
      </section>

      <section aria-labelledby="visao" className="mt-12 grid gap-8 border-t-2 border-ink pt-8 md:grid-cols-[14rem_1fr]">
        <h2 id="visao" className="font-mono text-xs uppercase tracking-[0.25em] text-oxblood">Visão</h2>
        <p className="text-xl leading-relaxed">Uma biblioteca de Alexandria ao contrário: que não dependa de poucas cópias, porque tudo nela pode ser copiado, e que sirva em casa, na sala de aula, no movimento e no trabalho, para quem quer aprender qualquer coisa, da alfabetização ao ensino superior e aos ofícios.</p>
      </section>

      <section aria-labelledby="valores" className="mt-14">
        <h2 id="valores" className={secao}><span className="jornal-editoria">Valores</span></h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VALORES.map(([nome, texto], i) => (
            <li key={nome} className="border-2 border-ink bg-parchment-deep p-5 shadow-[4px_4px_0_0_var(--color-ink)]">
              <p className="font-mono text-xs text-oxblood">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-1 font-serif text-2xl font-semibold">{nome}</h3>
              <p className="mt-2 font-sans text-sm text-ink-soft">{texto}</p>
            </li>
          ))}
        </ul>
      </section>

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

      <section aria-labelledby="acessibilidade" className="mt-16 border-t-2 border-ink pt-8 font-sans">
        <h2 id="acessibilidade" className="font-serif text-2xl font-semibold">Acessibilidade</h2>
        <p className="mt-2 max-w-3xl text-ink-soft">Seguindo a Lei Brasileira de Inclusão (Lei nº 13.146/2015, art. 63) e as diretrizes de acessibilidade da web (WCAG), o site funciona com leitor de tela e só com o teclado, tem botão de acessibilidade (tamanho do texto, alto contraste, texto espaçado, modo foco, leitura em voz alta e modo leve para internet lenta) e tradutor para Libras (VLibras). Encontrou uma barreira? Conte em <Link href={to("/relatar-erro")} className="underline hover:text-oxblood">Achei um erro</Link> ou escreva para {site.newsletter}.</p>
      </section>

      <p className="mt-12 font-sans text-sm">
        <Link href={to("/sobre")} className="underline hover:text-oxblood">Manifesto</Link> · <Link href={to("/termos")} className="underline hover:text-oxblood">Termos de uso</Link> · <Link href={to("/privacidade")} className="underline hover:text-oxblood">Política de privacidade</Link> · <Link href={to("/apoie")} className="underline hover:text-oxblood">Apoie e prestação de contas</Link>
      </p>
    </div>
  );
}

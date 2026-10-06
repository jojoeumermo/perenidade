import Link from "next/link";
import { PageHeading } from "@/components/PageHeading";
import { repoUrl } from "@/lib/site";

export const metadata = {
  title: "Sobre e licenças",
  description: "Por que a Perenidade existe, como ela funciona e sob quais licenças o conteúdo é publicado.",
};

const external = { target: "_blank", rel: "noopener noreferrer", className: "underline hover:text-oxblood" };

export default function Sobre() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeading eyebrow="Manifesto" title="Por que Perenidade" />

      <div className="prose-lesson mt-8">
        <p>
          A Biblioteca de Alexandria não desapareceu em um único incêndio. Ela definhou por séculos de descuido, cortes e
          conflitos, e o que se perdeu, perdeu-se porque existia em poucas cópias. A Perenidade nasce para o contrário:
          conhecimento livre, gratuito e copiado por todos.
        </p>
        <p>
          Aqui ninguém paga e ninguém precisa de conta para aprender. O conteúdo vive em um repositório aberto, é revisado
          pela comunidade e cada mudança fica no histórico.
        </p>

        <h2 id="como-funciona">Como funciona</h2>
        <ul>
          <li>
            <strong>Trilhas e aulas</strong> são textos escritos por voluntários, guardados como arquivos simples.
          </li>
          <li>
            <strong>O acervo</strong> é um índice: título, autor, sinopse e um link para a fonte legítima da obra. Nenhum
            arquivo de terceiros é hospedado aqui.
          </li>
          <li>
            <strong>A moderação</strong> é pública. Toda contribuição passa pela{" "}
            <Link href="/moderacao">fila de moderação</Link> antes de entrar.
          </li>
          <li>
            <strong>O histórico</strong> guarda todas as versões. Veja o <Link href="/historico">histórico do acervo</Link>.
          </li>
        </ul>

        <h2 id="licencas">Licenças</h2>
        <p>
          As aulas escritas pela comunidade são publicadas sob a licença{" "}
          <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.pt-br" {...external}>
            Creative Commons Atribuição-CompartilhaIgual 4.0 (CC BY-SA 4.0)
          </a>
          : qualquer pessoa pode copiar, adaptar e redistribuir, desde que dê crédito e mantenha a mesma licença.
        </p>
        <p>
          As obras do acervo pertencem aos seus autores e seguem a licença indicada em cada ficha. O código do site é
          aberto, sob a licença MIT, e está no <a href={repoUrl} {...external}>GitHub</a>.
        </p>

        <h2 id="privacidade">Privacidade</h2>
        <p>
          O site não tem cadastro, não usa cookies de rastreamento e não coleta dados pessoais. As aulas que você conclui,
          o tema escolhido e os rascunhos de contribuição ficam guardados apenas no seu navegador. A única exceção é a{" "}
          <Link href="/moderacao">fila de moderação</Link>, que consulta o GitHub direto do seu navegador para listar as
          contribuições em aberto.
        </p>

        <h2 id="direitos-autorais">Direitos autorais</h2>
        <p>
          Só entram aqui obras em domínio público, com licença aberta ou escritas pela própria comunidade. Se algo estiver
          errado, <Link href="/denunciar">denuncie</Link>: o item sai do ar enquanto é analisado.
        </p>
      </div>
    </div>
  );
}

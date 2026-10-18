// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import type { TrackOption } from "../useTrackOptions";
import { botaoClaro, rotulo } from "./comum";

/** As disciplinas de idioma, em que a aula ganha a prática lúdica. */
export const IDIOMAS = ["ingles", "ingles-infantil", "espanhol", "frances", "chines", "russo"];

const etapa: Record<string, string> = {
  fundamental: "ensino fundamental: frases curtas, um conceito por vez, exemplos do dia a dia e muita repetição guiada",
  medio: "ensino médio: já dá para encadear ideias e cobrar vocabulário técnico, sempre apresentado antes de ser usado",
  superior: "ensino superior: aprofunde, discuta autores e controvérsias, mas sem perder quem chega sem base",
};

/** O esqueleto que o botão "Usar o esqueleto" põe no editor. */
export function esqueleto(titulo: string, idioma: boolean) {
  return [
    `Abertura: em um parágrafo, diga do que trata **${titulo || "esta aula"}** e por que isso importa para quem estuda e trabalha.`,
    "",
    "## Primeira ideia",
    "",
    "Explique como para alguém que nunca ouviu falar. Um exemplo concreto vale mais que uma definição.",
    "",
    "```verificar",
    "Pergunta curta sobre o que acabou de ser dito?",
    "- Alternativa errada",
    "+ Alternativa certa",
    "- Outra errada",
    "> Releia o parágrafo acima: a resposta está lá.",
    "```",
    "",
    "## Segunda ideia",
    "",
    "Ligue com a primeira. Se houver conta, fórmula ou passo a passo, mostre cada passo.",
    "",
    "## Na vida real",
    "",
    "Onde isso aparece no trabalho, na cidade, na luta de quem estuda aqui.",
    "",
    idioma ? "## Vocabulário\n\n| Palavra | Tradução | Como se fala |\n| --- | --- | --- |\n| … | … | … |\n" : "",
    "## Resumo",
    "",
    "- Uma frase por ideia.",
    "- No máximo cinco.",
    "",
    "## Para praticar",
    "",
    "Uma tarefa que dá para fazer sem computador, em dez minutos.",
  ]
    .filter((linha) => linha !== "")
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

function Bloco({ titulo, aberto = false, children }: { titulo: string; aberto?: boolean; children: React.ReactNode }) {
  return (
    <details open={aberto} className="group border-b border-rule py-3 last:border-b-0">
      <summary className="flex cursor-pointer items-center justify-between gap-3 font-semibold hover:text-oxblood">
        {titulo}
        <span aria-hidden className="font-mono text-xs text-ink-soft transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-ink-soft">{children}</div>
    </details>
  );
}

const codigo = (texto: string) => <code className="rounded-none bg-parchment px-1 font-mono text-[0.8rem] text-ink">{texto}</code>;

/**
 * O guia de produção de uma aula: do que ela trata (pela posição no roteiro), como estruturar, como formatar,
 * como fazer os testes e que perguntas fazer. É orientação, não obrigação: quem ensina sabe o seu ofício.
 */
export function GuiaDaAula({ trilha, slug, titulo, nomeDaArea, tipo, temTexto, inserir }: { trilha?: TrackOption; slug: string; titulo: string; nomeDaArea: string; tipo: "aula" | "avulso"; temTexto: boolean; inserir: (texto: string) => void }) {
  const [aberto, setAberto] = useState(true);
  const plano = trilha?.plan ?? [];
  const posicao = slug ? plano.findIndex((item) => item.slug === slug) : -1;
  const anterior = posicao > 0 ? plano[posicao - 1] : null;
  const seguinte = posicao >= 0 ? plano[posicao + 1] : null;
  const resumoDe = (s: string | undefined) => trilha?.lessons?.find((l) => l.slug === s)?.summary ?? "";
  const idioma = Boolean(trilha?.area && IDIOMAS.includes(trilha.area));
  const nivel = trilha?.stage ? etapa[trilha.stage] : "";

  return (
    <aside className="painel-cartao p-4" aria-label="Guia de produção da aula">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={rotulo}>Guia de produção</p>
          <p className="mt-1 font-serif text-lg font-semibold leading-tight">Como produzir esta aula</p>
        </div>
        <button type="button" className="cursor-pointer text-xs underline hover:text-oxblood" onClick={() => setAberto((a) => !a)} aria-expanded={aberto}>
          {aberto ? "Esconder" : "Mostrar"}
        </button>
      </div>
      {aberto && (
        <div className="mt-2">
          <p className="text-xs text-ink-soft">Orientação, não obrigação: você conhece o seu ofício. Isto é o que ajuda a aula a casar com o resto da trilha.</p>
          <Bloco titulo="Do que se trata" aberto>
            {trilha ? (
              <>
                <p>
                  <strong className="text-ink">{titulo || (posicao >= 0 ? plano[posicao].title : "A aula")}</strong> em <strong className="text-ink">{trilha.title}</strong> ({nomeDaArea}
                  {trilha.stage ? `, ${trilha.stage === "medio" ? "ensino médio" : trilha.stage === "superior" ? "ensino superior" : "ensino fundamental"}` : ""}).
                  {trilha.summary && ` A trilha promete: “${trilha.summary}”`}
                </p>
                {posicao >= 0 ? (
                  <p>
                    É a aula <strong className="text-ink">{posicao + 1} de {plano.length}</strong> do roteiro.
                    {anterior ? (
                      <>
                        {" "}Vem depois de <em>{anterior.title}</em>
                        {anterior.ready ? ` (já escrita${resumoDe(anterior.slug) ? `: “${resumoDe(anterior.slug)}”` : ""})` : " (ainda em preparação)"}: pode contar com isso como sabido.
                      </>
                    ) : (
                      " É a primeira: não suponha nada."
                    )}
                    {seguinte && (
                      <>
                        {" "}Depois vem <em>{seguinte.title}</em>: deixe o terreno preparado, sem adiantar o conteúdo.
                      </>
                    )}
                  </p>
                ) : (
                  <p>Tema fora do roteiro: a aula entra no fim da trilha. Diga logo na abertura o que a pessoa precisa saber antes.</p>
                )}
                {plano.length > 0 && (
                  <p>
                    A trilha tem <strong className="text-ink">{plano.filter((item) => item.ready).length} de {plano.length}</strong> aulas escritas.
                    {plano.some((item) => !item.ready) && (
                      <>
                        {" "}Ainda faltam: {plano.filter((item) => !item.ready).slice(0, 6).map((item) => item.title).join("; ")}
                        {plano.filter((item) => !item.ready).length > 6 ? ` e mais ${plano.filter((item) => !item.ready).length - 6}` : ""}.
                      </>
                    )}
                  </p>
                )}
                {nivel && <p>Tom para o {nivel}.</p>}
                {tipo === "avulso" && <p>Material avulso: fica na aba própria da disciplina, fora da ordem das trilhas. Diga para que serve e para quem é.</p>}
              </>
            ) : (
              <p>Escolha a trilha e a aula do roteiro: o guia mostra onde ela se encaixa, o que vem antes e o que vem depois.</p>
            )}
          </Bloco>
          <Bloco titulo="Como estruturar">
            <ol className="list-decimal space-y-1 pl-5">
              <li><strong className="text-ink">Abertura</strong> (1 parágrafo): do que trata e por que importa para quem trabalha e estuda.</li>
              <li><strong className="text-ink">De três a cinco seções</strong>, cada uma com um título {codigo("## Assim")}, uma ideia só e um exemplo concreto.</li>
              <li><strong className="text-ink">Uma pergunta rápida</strong> no meio ({codigo("```verificar")}) para firmar a atenção.</li>
              <li><strong className="text-ink">Resumo</strong> em lista: uma frase por ideia, no máximo cinco.</li>
              <li><strong className="text-ink">Para praticar</strong>: uma tarefa que dá para fazer sem computador.</li>
            </ol>
            <p>Tamanho bom: de 600 a 1.500 palavras (5 a 8 minutos de leitura). Frases curtas, uma ideia por frase. Palavra difícil é explicada na hora em que aparece.</p>
          </Bloco>
          <Bloco titulo="Atalhos" aberto>
            <p>Cada botão põe um trecho pronto no fim do texto, para você só preencher.</p>
            <p className="flex flex-wrap gap-2">
              {!temTexto && <button type="button" className={botaoClaro} onClick={() => inserir(esqueleto(titulo, idioma))}>Usar o esqueleto</button>}
              <button type="button" className={botaoClaro} onClick={() => inserir("\n```verificar\nPergunta curta sobre o que acabou de ser dito?\n- Alternativa errada\n+ Alternativa certa\n- Outra errada\n> Releia o parágrafo acima: a resposta está lá.\n```\n")}>Pergunta rápida</button>
              <button type="button" className={botaoClaro} onClick={() => inserir("\n```conta\n2x + 3 = 11\n2x = 11 - 3\n2x = 8\nx = 4\n```\n")}>Conta passo a passo</button>
              <button type="button" className={botaoClaro} onClick={() => inserir("\n## Na vida real\n\nOnde isso aparece no trabalho, na cidade, na luta de quem estuda aqui.\n")}>Seção “Na vida real”</button>
              <button type="button" className={botaoClaro} onClick={() => inserir("\n## Resumo\n\n- Uma frase por ideia.\n- No máximo cinco.\n\n## Para praticar\n\nUma tarefa que dá para fazer sem computador, em dez minutos.\n")}>Resumo e prática</button>
              <button type="button" className={botaoClaro} onClick={() => inserir("\n> “Citação curta, com a fonte logo abaixo.”\n> — Autor, *Obra* (ano)\n")}>Citação com fonte</button>
              {idioma && <button type="button" className={botaoClaro} onClick={() => inserir("\n## Vocabulário\n\n| Palavra | Tradução | Como se fala |\n| --- | --- | --- |\n| … | … | … |\n")}>Tabela de vocabulário</button>}
            </p>
            <p className="text-xs">As três a cinco questões do fim vão no campo “Teste o que você aprendeu”, abaixo do texto.</p>
          </Bloco>
          <Bloco titulo="Formatação do texto">
            <ul className="list-disc space-y-1 pl-5">
              <li>Títulos de seção com {codigo("## Título")}; subtítulos com {codigo("### Subtítulo")}. Nada de título no começo: o título da aula já está no campo acima.</li>
              <li>{codigo("**negrito**")} para o termo que a pessoa precisa guardar; {codigo("*itálico*")} para ênfase e palavras estrangeiras.</li>
              <li>Listas com {codigo("- ")} ou {codigo("1. ")}; citação com {codigo("> ")}; tabela com barras {codigo("| a | b |")}.</li>
              <li>Fórmulas entre {codigo("$$ … $$")} (um cifrão sozinho continua sendo dinheiro). Conta passo a passo com o bloco {codigo("```conta")}.</li>
              <li>Código de programa em {codigo("```python")} ou {codigo("```php")}: o site põe o botão “Testar este código”.</li>
              <li>Vídeo pelo botão ▶ da barra (só o endereço; o vídeo fica onde está). Imagem pelo botão ▣: só sua, em domínio público ou com licença livre, com descrição para quem não enxerga.</li>
              <li>Sem HTML, sem imagem de outro site, links só {codigo("https://")}. Pauta musical com {codigo("```pauta")} e teclado com {codigo("```teclado")}, nas aulas de música.</li>
            </ul>
          </Bloco>
          <Bloco titulo="Testes e perguntas">
            <p>
              <strong className="text-ink">No meio do texto</strong>, a pergunta rápida: três alternativas, a certa marcada com {codigo("+")}, as erradas com {codigo("-")}, e uma pista com {codigo(">")} para quem errar reler. Não dá nota, firma a atenção.
            </p>
            <pre className="overflow-x-auto whitespace-pre-wrap border border-rule bg-parchment p-3 font-mono text-xs text-ink">{"```verificar\nQuanto vale o 7 em 3,75?\n- sete unidades\n+ sete décimos\n- sete centésimos\n> Releia o trecho sobre as casas depois da vírgula.\n```"}</pre>
            <p>
              <strong className="text-ink">No fim</strong>, de três a cinco questões no campo “Teste o que você aprendeu”, abaixo do texto. Elas entram na aula e na prova da trilha. Perguntas que funcionam:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li><em>Lembrar</em>: “O que é…?”, “Como se chama…?”. Uma por aula basta.</li>
              <li><em>Aplicar</em>: um caso concreto em que a pessoa precisa usar o que leu (“Um trabalhador recebe… quanto…?”).</li>
              <li><em>Distinguir</em>: duas coisas parecidas que a aula separou (“Qual a diferença entre… e…?”).</li>
              <li><em>Pegadinha honesta</em>: a alternativa errada é o erro mais comum, e a explicação diz por que ele é comum.</li>
            </ul>
            <p>Alternativas do mesmo tamanho e do mesmo tipo; nada de “todas as anteriores”; a explicação ensina, não só diz “errado”.</p>
          </Bloco>
          <Bloco titulo="Fontes e linguagem">
            <ul className="list-disc space-y-1 pl-5">
              <li>Pelo menos uma fonte, de preferência a primária: o livro, a lei, o dado oficial, o documento. Número sem fonte não vai ao ar.</li>
              <li>Pessoas vivas, partidos e empresas: só fatos documentados, linguagem sóbria.</li>
              <li>Fale com quem estuda no ônibus: direto, sem rodeio, sem “como todos sabem”.</li>
              <li>O texto passa pela revisão antes de ir ao ar: escreva, releia uma vez em voz alta, envie.</li>
            </ul>
          </Bloco>
          {idioma && (
            <Bloco titulo="Aulas de idioma: a prática lúdica">
              <p>
                Depois de escrever a aula, monte a <strong className="text-ink">prática lúdica</strong> dela em “O que você quer publicar → Prática de idioma”: escolha múltipla, pares, lacunas, ordenar palavras, ouvir e escrever, falar e cartões de memória. É o que o site mostra como jogo no fim da aula.
              </p>
              <p>Boa medida: de 8 a 15 exercícios, misturando os tipos, com o vocabulário desta aula e das anteriores.</p>
            </Bloco>
          )}
        </div>
      )}
    </aside>
  );
}

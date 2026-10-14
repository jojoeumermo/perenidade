// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { PENDENCIAS_DO_EPISODIO } from "@/lib/podcast";
import { termo, TERMO_TITULO } from "@/lib/podcast-termo";
import { botaoClaro, rotulo } from "../comum";

/** O roteiro padrão de um episódio: abertura, blocos, chamada para a ação e encerramento. */
export const GABARITO = `## Abertura (até 1 min)
- Vinheta de abertura.
- Quem fala e o tema em uma frase: "Neste episódio, …"
- Por que isso importa para quem está ouvindo agora.

## Bloco 1 · Contexto (5 a 8 min)
- O que aconteceu, onde, quando e com quem.
- Uma obra do acervo para quem quer ler mais (use "Citar obra").

## Bloco 2 · O centro da conversa (10 a 15 min)
- A ideia principal, explicada como para alguém que nunca ouviu falar.
- Pergunta para o convidado: …
- Pergunta para o convidado: …

## Bloco 3 · Hoje (5 min)
- O que isso tem a ver com a vida de quem trabalha e estuda hoje.
- Pergunta da comunidade (Pergunte ao podcast): …

## Chamada para a ação (1 min)
- Uma tarefa simples: ler um capítulo, fazer a aula X, votar na próxima pauta.

## Encerramento (1 min)
- Agradecimento ao convidado.
- "As fontes, as obras citadas e a transcrição estão na página do episódio, em institutolucia.org/podcasts."
- Vinheta de encerramento.
`;

/** O que cada item da lista de conferência quer dizer (o texto mora em lib/podcast, para o link de revisão também usar). */
export const PENDENCIAS = PENDENCIAS_DO_EPISODIO;

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="border-l-4 border-ink pl-5">
      <h2 className="font-serif text-2xl font-semibold">{titulo}</h2>
      <div className="mt-3 space-y-3 text-base leading-relaxed">{children}</div>
    </section>
  );
}

function imprimirTermo() {
  const janela = window.open("", "_blank", "noopener=no,width=800,height=900");
  if (!janela) return;
  const p = termo("").map((x) => `<p>${x}</p>`).join("");
  janela.document.write(`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>${TERMO_TITULO}</title><body style="font:16px/1.6 Georgia,serif;max-width:40rem;margin:3rem auto;padding:0 1rem"><h1 style="font-size:1.4rem">${TERMO_TITULO}</h1>${p}<p style="margin-top:3rem">( ) Autorizo também o uso da minha imagem.</p><p style="margin-top:3rem">Local e data: ____________________________</p><p style="margin-top:3rem">Assinatura: ____________________________</p><p>Documento (opcional): ____________________</p></body></html>`);
  janela.document.close();
  janela.print();
}

/** O guia de quem faz o podcast: alinha quem chega sem ninguém precisar explicar tudo de novo. */
export function Guia() {
  return (
    <div className="max-w-3xl space-y-10">
      <Bloco titulo="Guia editorial">
        <p>
          <strong>Para quem falamos.</strong> Para quem trabalha e estuda, muitas vezes ouvindo no ônibus ou fazendo outra coisa. Fale como numa boa aula: frases curtas, um assunto de cada vez, exemplos da vida
          real. Palavra difícil vem explicada na hora (e entra no glossário do site).
        </p>
        <p>
          <strong>Linha.</strong> O instituto é de educação popular, de esquerda, e não esconde isso. Não somos de partido nem devemos nada a governo. Defendemos os trabalhadores, a soberania dos povos e o conhecimento
          livre; combatemos o racismo, o machismo, a LGBTfobia, o capacitismo e todo discurso de ódio. Firmeza nas ideias, respeito com as pessoas: critique posições, não ataque quem pensa diferente.
        </p>
        <p>
          <strong>Como citar.</strong> Toda afirmação de fato tem fonte, dita no ar quando ajuda (“segundo o IBGE, em 2023…”) e sempre listada nas notas. Prefira fontes primárias (o documento, a lei, o dado oficial,
          o livro) e o acervo do instituto. Citação de livro: autor, obra e, se der, o capítulo. Número sem fonte não vai ao ar.
        </p>
        <p>
          <strong>Padrão de checagem.</strong> Antes de enviar para aprovação: (1) cada número e cada data conferidos em duas fontes ou na fonte primária; (2) citações conferidas palavra por palavra; (3) use o botão
          “Checar afirmação” do roteiro, que procura nas checagens do site e no guia de fontes; (4) o que não deu para confirmar sai do roteiro ou vai ao ar como dúvida, dita como dúvida.
        </p>
        <p>
          <strong>O que evitar.</strong> Boato, print sem fonte e “dizem que”; expor dado pessoal de qualquer pessoa (inclusive de quem manda pergunta); música e vinheta sem licença; propaganda de produto, de candidato ou
          de partido; termos que ridicularizem grupos; prometer o que o instituto não faz.
        </p>
        <p>
          <strong>Convidados.</strong> Todo convidado aceita o termo de cessão de voz antes de ir ao ar (pelo link do convidado ou em papel, anexado à ficha). Combine o tema antes e, se a pessoa pedir, mande a
          versão editada para ela ouvir.
        </p>
      </Bloco>

      <Bloco titulo="Guia de gravação">
        <p>
          <strong>Ambiente.</strong> Cômodo pequeno e com coisas (roupas, livros, cortina, sofá): parede vazia faz eco. Desligue ventilador, ar-condicionado e geladeira por perto. Celulares no modo avião.
        </p>
        <p>
          <strong>Microfone.</strong> A um palmo da boca, um pouco de lado (os “p” e “b” não estouram). Fone de ouvido sempre, para o som não voltar para o microfone. Um fone de celular com microfone já resolve; o
          microfone do notebook pega teclado e ventilador.
        </p>
        <p>
          <strong>Nível.</strong> Falando normalmente, o medidor fica quase todo no verde, sem chegar ao vermelho (no Audacity, o pico entre -12 e -6 dB). Teste antes: o site tem o teste de microfone em
          /podcasts/microfone, que também vale para o convidado.
        </p>
        <p>
          <strong>A distância.</strong> Abra a sala (Jitsi, Meet ou Zoom) e guarde o link no episódio. Peça para cada pessoa gravar a própria voz no próprio aparelho do começo ao fim (“gravação dupla”): o som fica
          muito melhor que o da chamada, que serve só de reserva. Depois, envie as faixas como “faixa de convidado”.
        </p>
        <p>
          <strong>Edição (Audacity, de graça).</strong> Corte silêncios longos e erros; Efeitos → Redução de ruído (pegue o perfil num trecho só de ruído); Efeitos → Compressor; por fim, Efeitos → Normalização de
          volume (loudness) com alvo de -16 LUFS e pico máximo de -1 dB. Exporte em MP3, 96 a 128 kbps (mono para conversa). Um episódio de uma hora fica com uns 45 MB, dentro do limite de 50 MB do depósito.
        </p>
        <p>
          <strong>Cópia de fora.</strong> O depósito do site guarda só os episódios mais recentes. Para o episódio continuar tocando para sempre, suba o MP3 final no Internet Archive (archive.org, de graça e sem limite
          de audição) e cole o link do arquivo em “Cópia de fora”, na aba Publicação. Guarde lá também o bruto, como cópia de segurança.
        </p>
      </Bloco>

      <Bloco titulo="Gabarito de episódio">
        <p>O roteiro padrão. No editor de roteiro, o botão “Usar gabarito” coloca este texto para você completar.</p>
        <pre className="overflow-x-auto whitespace-pre-wrap border border-rule bg-parchment-deep p-4 font-mono text-xs">{GABARITO}</pre>
      </Bloco>

      <Bloco titulo="Lista de conferência antes de publicar">
        <p>O episódio só vai ao ar com tudo marcado. Parte é conferida pelo próprio sistema; parte, por quem edita:</p>
        <ul className="list-disc space-y-1 pl-5">
          {Object.values(PENDENCIAS).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>Música e vinheta só da biblioteca de áudios (com a licença registrada) ou de acervos livres: YouTube Audio Library, Free Music Archive, Pixabay Music. Anote a licença de cada faixa.</p>
      </Bloco>

      <Bloco titulo="Termo de cessão de voz">
        <p>O convidado pode aceitar pelo link pessoal (na ficha do convidado) ou assinar em papel. Para o papel, imprima o modelo e anexe a foto ou o PDF assinado na ficha.</p>
        <p className={rotulo}>{TERMO_TITULO}</p>
        <div className="space-y-2 text-sm text-ink-soft">
          {termo("").map((x) => (
            <p key={x}>{x}</p>
          ))}
        </div>
        <button type="button" onClick={imprimirTermo} className={botaoClaro}>Imprimir o termo</button>
      </Bloco>

      <Bloco titulo="Transcrição automática">
        <p>
          O botão “Transcrever” da aba Publicação usa o Whisper (de código aberto) por um serviço com cota gratuita, quando a coordenação ligar a função no servidor (veja docs/podcast-setup.md). Sem ela, gere a
          transcrição no computador com o programa Buzz (de graça, roda o Whisper sem internet) e importe o arquivo .srt ou .vtt: as legendas viram a transcrição clicável do site e a legenda dos cortes.
        </p>
      </Bloco>
    </div>
  );
}

// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { Mascote, NotaParaOAdulto } from "./comum";

/** Histórias curtas, com tom calmo: o que fazer na internet e a regra de ouro, "conte a um adulto de confiança". */
const CASOS: { historia: string; pergunta: string; opcoes: { texto: string; boa: boolean; explica: string }[] }[] = [
  {
    historia: "A Bia está jogando no tablet e aparece uma mensagem: \"Qual é o seu endereço? Vou te mandar um presente!\"",
    pergunta: "O que a Bia deve fazer?",
    opcoes: [
      { texto: "Mandar o endereço, porque presente é bom", boa: false, explica: "Endereço, escola, telefone e nome completo são segredos de família. Quem a gente não conhece não precisa saber." },
      { texto: "Não responder e mostrar a mensagem para um adulto", boa: true, explica: "Isso! Quando um estranho pede dados, a gente não responde e conta para um adulto de confiança." },
    ],
  },
  {
    historia: "O Davi recebeu uma foto engraçada de um colega da escola, mas a foto deixa outro colega com vergonha.",
    pergunta: "O que é legal fazer?",
    opcoes: [
      { texto: "Mandar para todo mundo da turma", boa: false, explica: "Espalhar uma foto que deixa alguém triste machuca de verdade. Na internet também a gente cuida dos outros." },
      { texto: "Não passar adiante e conversar com um adulto", boa: true, explica: "Isso! Quem não espalha ajuda a parar a brincadeira que machuca." },
    ],
  },
  {
    historia: "Apareceu na tela: \"Você ganhou um celular! Clique aqui e digite a senha do seu pai.\"",
    pergunta: "Isso parece…",
    opcoes: [
      { texto: "Um prêmio de verdade", boa: false, explica: "Prêmio que pede senha é truque para enganar. Ninguém de verdade pede senha assim." },
      { texto: "Um golpe: melhor fechar e avisar um adulto", boa: true, explica: "Isso! Senha é segredo, e mensagem que promete prêmio fácil costuma ser golpe." },
    ],
  },
  {
    historia: "A Luna tem uma senha para entrar no jogo. Uma amiga pede: \"Me conta a sua senha? Eu não conto pra ninguém!\"",
    pergunta: "A Luna deve…",
    opcoes: [
      { texto: "Contar, porque é amiga", boa: false, explica: "Senha é só sua e da sua família, mesmo com amigos. Amizade não precisa de senha." },
      { texto: "Dizer que senha é segredo, com carinho", boa: true, explica: "Isso! Dá para ser amiga e guardar a senha ao mesmo tempo." },
    ],
  },
  {
    historia: "O Theo viu um vídeo que deixou ele assustado e com medo de dormir.",
    pergunta: "O que o Theo pode fazer?",
    opcoes: [
      { texto: "Guardar segredo e ficar com medo sozinho", boa: false, explica: "Ninguém precisa ficar com medo sozinho. Os adultos estão aqui para ajudar." },
      { texto: "Contar para um adulto de confiança como se sentiu", boa: true, explica: "Isso! Falar do que sentiu ajuda a passar o medo, e o adulto pode cuidar para não acontecer de novo." },
    ],
  },
  {
    historia: "No jogo on-line, alguém xingou a Maria e mandou ela sair.",
    pergunta: "O que a Maria pode fazer?",
    opcoes: [
      { texto: "Xingar de volta, bem mais forte", boa: false, explica: "Responder com xingamento costuma piorar a briga. Tem jeitos melhores de se proteger." },
      { texto: "Sair da conversa, bloquear e contar para um adulto", boa: true, explica: "Isso! Bloquear, sair e contar é se proteger com força e calma." },
    ],
  },
];

export function SegurancaDigital() {
  const [i, setI] = useState(0);
  const [escolha, setEscolha] = useState<number | null>(null);
  const caso = CASOS[i];
  const fim = i >= CASOS.length;
  return (
    <div>
      {fim ? (
        <div className="rounded-3xl border-4 border-ink bg-white p-8 text-center">
          <Mascote humor="festa" tamanho={110} />
          <p className="mt-3 text-3xl font-bold">Você aprendeu a se proteger na internet!</p>
          <p className="mt-3 text-2xl">A regra de ouro: <strong>se algo estranho acontecer, conte a um adulto de confiança.</strong></p>
          <button type="button" onClick={() => { setI(0); setEscolha(null); }} className="mt-5 min-h-14 cursor-pointer rounded-full border-4 border-ink bg-ink px-8 text-2xl font-bold text-white">Ver de novo</button>
        </div>
      ) : (
        <div className="rounded-3xl border-4 border-ink bg-white p-6">
          <p className="font-sans text-sm text-ink-soft">História {i + 1} de {CASOS.length}</p>
          <p className="mt-2 text-2xl leading-relaxed">{caso.historia}</p>
          <p className="mt-4 text-2xl font-bold">{caso.pergunta}</p>
          <div className="mt-4 grid gap-3">
            {caso.opcoes.map((o, k) => (
              <button key={k} type="button" onClick={() => setEscolha(k)} className={`min-h-16 cursor-pointer rounded-2xl border-4 border-ink px-4 text-left text-xl font-bold ${escolha === k ? (o.boa ? "bg-[#9FD8A0]" : "bg-[#FFE0C2]") : "bg-white hover:bg-[#FFF4D6]"}`}>{o.texto}</button>
            ))}
          </div>
          {escolha !== null && (
            <div className="mt-5 flex items-start gap-4 rounded-2xl bg-[#FFF4D6] p-4">
              <Mascote tamanho={60} humor={caso.opcoes[escolha].boa ? "festa" : "pensando"} />
              <div>
                <p className="text-xl">{caso.opcoes[escolha].explica}</p>
                {caso.opcoes[escolha].boa ? (
                  <button type="button" onClick={() => { setI(i + 1); setEscolha(null); }} className="mt-3 min-h-12 cursor-pointer rounded-full border-4 border-ink bg-ink px-6 text-xl font-bold text-white">Próxima história →</button>
                ) : (
                  <p className="mt-2 text-lg">Escolha a outra resposta para ver o que acontece.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      <NotaParaOAdulto idade="8 a 12 anos" objetivo="Reconhecer situações de risco na internet e saber o que fazer." aprende="Não passar dados pessoais nem senhas, desconfiar de prêmios fáceis, não espalhar o que machuca e contar a um adulto de confiança." nota="Converse sem assustar e deixe claro que a criança nunca vai ser punida por contar algo que viu. Em caso de violência ou abuso, denuncie no Disque 100 (gratuito, 24 horas) ou procure o Conselho Tutelar da sua cidade." />
    </div>
  );
}

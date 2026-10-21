// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { falar, Mascote, NotaParaOAdulto, temVoz } from "./comum";

/**
 * Parlendas da tradição oral brasileira (folclore, sem autor: domínio público; há variações de região para região) e
 * fábulas atribuídas a Esopo (Grécia antiga, domínio público), recontadas aqui com palavras nossas.
 */
const HISTORIAS: { id: string; titulo: string; tipo: "parlenda" | "fábula"; fonte: string; texto: string; pergunta?: string }[] = [
  { id: "domingo", titulo: "Hoje é domingo", tipo: "parlenda", fonte: "Parlenda da tradição oral brasileira (domínio público).", texto: "Hoje é domingo, pede cachimbo. O cachimbo é de barro, bate no jarro. O jarro é de ouro, bate no touro. O touro é valente, bate na gente. A gente é fraco, cai no buraco. O buraco é fundo, acabou-se o mundo!" },
  { id: "feijao", titulo: "Um, dois, feijão com arroz", tipo: "parlenda", fonte: "Parlenda da tradição oral brasileira (domínio público).", texto: "Um, dois, feijão com arroz. Três, quatro, feijão no prato. Cinco, seis, falar inglês. Sete, oito, comer biscoito. Nove, dez, comer pastéis." },
  { id: "cotia", titulo: "Corre cotia", tipo: "parlenda", fonte: "Parlenda da tradição oral brasileira (domínio público).", texto: "Corre cotia, na casa da tia. Corre cipó, na casa da avó. Lencinho na mão, caiu no chão. Moça bonita do meu coração!" },
  { id: "batatinha", titulo: "Batatinha quando nasce", tipo: "parlenda", fonte: "Quadrinha da tradição oral brasileira (domínio público).", texto: "Batatinha quando nasce, espalha a rama pelo chão. A menina quando dorme, põe a mão no coração." },
  { id: "raposa", titulo: "A raposa e as uvas", tipo: "fábula", fonte: "Fábula atribuída a Esopo (Grécia antiga, domínio público), recontada pelo Instituto Lúcia.", texto: "Uma raposa com muita fome viu um cacho de uvas bem lá no alto de uma parreira. Pulou uma vez, pulou duas, pulou três. Não alcançou. Então ela virou as costas e disse: — Ah, essas uvas estão verdes mesmo. Nem queria! Mas a verdade é que ela queria, e muito.", pergunta: "Por que a raposa disse que as uvas estavam verdes? Já aconteceu com você de fingir que não queria uma coisa?" },
  { id: "cigarra", titulo: "A cigarra e a formiga", tipo: "fábula", fonte: "Fábula atribuída a Esopo (Grécia antiga, domínio público), recontada pelo Instituto Lúcia.", texto: "Durante o verão, a cigarra cantava o dia inteiro, e a formiga trabalhava guardando comida. Quando o inverno chegou, a cigarra ficou com frio e com fome e foi bater na porta da formiga. A formiga abriu a porta e as duas dividiram a comida. Depois, combinaram: no próximo verão, a formiga ia aprender a cantar, e a cigarra ia ajudar a guardar comida.", pergunta: "O trabalho da cigarra, cantar, também é importante? Como as duas podem se ajudar?" },
  { id: "leao", titulo: "O leão e o ratinho", tipo: "fábula", fonte: "Fábula atribuída a Esopo (Grécia antiga, domínio público), recontada pelo Instituto Lúcia.", texto: "Um ratinho acordou um leão sem querer. O leão ia pegar o ratinho, mas o ratinho pediu: — Me solta, um dia eu posso te ajudar! O leão riu e soltou. Dias depois, o leão ficou preso numa rede de caçador. O ratinho ouviu o rugido, veio correndo e roeu a rede até o leão ficar livre.", pergunta: "Quem é pequeno também pode ajudar quem é grande? Como?" },
];

export function Historias() {
  const [escolhida, setEscolhida] = useState(HISTORIAS[0]);
  const [lendo, setLendo] = useState(-1);
  const [aviso, setAviso] = useState("");
  const palavras = [...escolhida.texto.matchAll(/\S+/g)].map((m) => ({ texto: m[0], inicio: m.index ?? 0 }));

  function ler() {
    const ok = falar(escolhida.texto, () => setLendo(-1), (inicio) => {
      const i = palavras.findIndex((p, k) => inicio >= p.inicio && (k === palavras.length - 1 || inicio < palavras[k + 1].inicio));
      if (i >= 0) setLendo(i);
    });
    setAviso(ok ? "" : temVoz() ? "O som está desligado: peça a um adulto para ligar lá em cima." : "Este aparelho não lê em voz alta. Peça a um adulto para ler com você!");
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {HISTORIAS.map((h) => (
          <button key={h.id} type="button" onClick={() => { setEscolhida(h); setLendo(-1); if (typeof window !== "undefined") window.speechSynthesis?.cancel(); }} className={`min-h-12 cursor-pointer rounded-full border-4 border-ink px-4 text-lg font-bold ${escolhida.id === h.id ? "bg-ink text-white" : "bg-white"}`}>
            {h.tipo === "fábula" ? "📖" : "🎵"} {h.titulo}
          </button>
        ))}
      </div>
      <article className="mt-6 rounded-3xl border-4 border-ink bg-white p-6">
        <div className="flex items-center gap-4">
          <Mascote tamanho={64} humor={lendo >= 0 ? "festa" : "feliz"} />
          <h2 className="text-3xl font-bold">{escolhida.titulo}</h2>
        </div>
        <p className="mt-5 text-3xl leading-relaxed" lang="pt-BR">
          {palavras.map((p, i) => (
            <span key={i} className={i === lendo ? "rounded bg-[#F6C945]" : ""}>{p.texto} </span>
          ))}
        </p>
        <p className="mt-6 flex flex-wrap gap-3">
          <button type="button" onClick={ler} className="min-h-14 cursor-pointer rounded-full border-4 border-ink bg-ink px-8 text-2xl font-bold text-white">🔊 Ler para mim</button>
          {lendo >= 0 && <button type="button" onClick={() => { window.speechSynthesis?.cancel(); setLendo(-1); }} className="min-h-14 cursor-pointer rounded-full border-4 border-ink bg-white px-6 text-xl font-bold">⏹ Parar</button>}
        </p>
        {aviso && <p className="mt-3 text-lg">{aviso}</p>}
        {escolhida.pergunta && <p className="mt-6 rounded-2xl bg-[#FFF4D6] p-4 text-xl">💭 {escolhida.pergunta}</p>}
        <p className="mt-4 font-sans text-xs text-ink-soft">{escolhida.fonte}</p>
      </article>
      <NotaParaOAdulto idade="4 a 7 anos" objetivo="Ouvir, repetir e brincar com textos da tradição oral; conversar sobre as fábulas." aprende="Ritmo e rima, memória, vocabulário e as primeiras conversas sobre escolhas e convivência." nota="Parlendas são para falar em voz alta, bater palma e repetir. Nas fábulas, a pergunta do fim é um começo de conversa: não existe resposta errada." />
    </div>
  );
}

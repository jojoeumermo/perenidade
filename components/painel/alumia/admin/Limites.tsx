// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Quadro } from "../pecas";

/** As proteções da rede que nem o painel de admin fura, ditas na tela, em palavras simples. */
const LIMITES: { titulo: string; porque: string }[] = [
  {
    titulo: "Não lê conversa nem post cifrado.",
    porque: "A chave fica só no aparelho de quem conversa: o banco guarda só o texto cifrado. Para ler, alguém teria de trocar o código do site, e isso fica visível. A exceção é o trecho que alguém do grupo mande, por vontade própria, numa denúncia. Apagar um post cifrado dá; ler, não.",
  },
  { titulo: "Não vê em quem cada pessoa votou.", porque: "O voto é secreto de verdade: o banco guarda o voto separado de quem votou." },
  {
    titulo: "Não puxa lista de membros, nem de quem segue quem, nem de quem curtiu ou viu.",
    porque: "Uma lista dessas, se vazasse ou fosse tomada à força, entregaria a rede inteira. A busca acha uma conta por vez, pelo codinome ou pelo @.",
  },
  { titulo: "Mostra números só a partir de 3.", porque: "Abaixo disso, um número já aponta para uma pessoa. A tela diz “menos de 3”." },
  {
    titulo: "Age sobre uma conta ou um post de cada vez.",
    porque: "Não existe “banir todos que…” nem “apagar tudo de…”: assim um engano, ou uma conta da coordenação nas mãos erradas, não derruba muita gente de uma vez.",
  },
  {
    titulo: "Não guarda endereço de rede (IP) em claro.",
    porque: "O bloqueio na borda vai do servidor direto à Cloudflare, com prazo; a Alumia guarda só o número da regra e a hora de vencer. Mas, para poder barrar a volta de quem foi banida, a Alumia guarda por 30 dias, junto da conta, um resumo embaralhado da rede de onde ela entrou (“Redes vistas”). Quem tiver o banco e o segredo do servidor ao mesmo tempo consegue descobrir o endereço.",
  },
  {
    titulo: "Guarda o e-mail de quem foi banida só como um resumo embaralhado.",
    porque: "Serve para a mesma pessoa não criar conta de novo com o mesmo e-mail. Sem o segredo do servidor, o resumo não volta ao e-mail.",
  },
  {
    titulo: "Quem convidou quem fica guardado só 60 dias, e ninguém lista.",
    porque: "Serve só para, ao banir quem convidou, devolver os convidados à triagem. Depois de 60 dias o laço some sozinho.",
  },
  { titulo: "Não muda variável do servidor.", porque: "NEXT_PUBLIC_RECURSOS e as chaves (Cloudflare, segredos) moram no servidor e só mudam com publicação nova. O painel avisa quando uma delas manda." },
];

export function Limites() {
  return (
    <Quadro titulo="O que este painel não faz e por quê" tom="dourado">
      <p className="ap-sobre">Plenos poderes sobre a Alumia, menos o que protege quem está nela. Estas regras valem para todo mundo, até para a coordenação: estão no banco, não na tela.</p>
      <ul className="ap-lista">
        {LIMITES.map((l) => (
          <li key={l.titulo} className="ap-linha">
            <span className="ap-linha-texto">
              <span className="ap-forte">{l.titulo}</span>
              <span className="ap-miudo">{l.porque}</span>
            </span>
          </li>
        ))}
      </ul>
    </Quadro>
  );
}

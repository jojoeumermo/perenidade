// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// Registro dos jogos próprios, parte 2 (Etapa 5). A página Jogos lê JOGOS_PROPRIOS_2. Os componentes só são baixados quando
// a pessoa abre o jogo: `carregar` é um import() dinâmico e este arquivo não importa React nem lê disco.
import { OBRAS } from "./dados/quem-construiu";
import { FONTES_ZONEAMENTO } from "./dados/zoneamento";
import { FONTES_ENERGIA } from "./dados/energia";
import { FONTES_SAUDE } from "./dados/saude";
import { FONTES_DISJUNTORES } from "./dados/disjuntores";
import { FONTES_PONTO } from "./dados/ponto";
import { FONTES_BUG } from "./dados/bug";
import { FONTES_REDUNDANCIA } from "./dados/redundancia";
import type { Fonte, JogoProprio } from "./tipos";

const sem_repetir = (lista: Fonte[]): Fonte[] => lista.filter((f, i) => lista.findIndex((g) => g.url === f.url) === i);

export const JOGOS_PROPRIOS_2: JogoProprio[] = [
  {
    id: "quem-construiu-a-cidade",
    titulo: "Quem construiu a cidade?",
    resumo: "Cinco obras famosas e a pergunta que os livros esquecem: quem as ergueu de verdade?",
    publico: "todos",
    minutos: 6,
    tema: "História do trabalho",
    carregar: () => import("./QuemConstruiu"),
    fontes: OBRAS.map((o) => o.fonte),
  },
  {
    id: "zoneamento-popular",
    titulo: "Zoneamento popular",
    resumo: "Desenhe o uso dos lotes de um bairro com ocupação antiga, seguindo as diretrizes do Estatuto da Cidade.",
    publico: "adultos",
    minutos: 10,
    tema: "Direito à cidade",
    carregar: () => import("./ZoneamentoPopular"),
    fontes: FONTES_ZONEAMENTO,
  },
  {
    id: "transicao-energetica-justa",
    titulo: "Transição energética justa",
    resumo: "Cinco decisões sobre energia limpa, e quatro medidores para não deixar ninguém para trás.",
    publico: "jovens",
    minutos: 10,
    tema: "Energia e trabalho",
    carregar: () => import("./TransicaoEnergetica"),
    fontes: sem_repetir(FONTES_ENERGIA),
  },
  {
    id: "mapa-da-saude-popular",
    titulo: "Mapa da saúde popular",
    resumo: "Você é agente comunitário de saúde: escolha quais casas visitar primeiro e como guardar o sigilo.",
    publico: "adultos",
    minutos: 8,
    tema: "Saúde e SUS",
    carregar: () => import("./MapaDaSaude"),
    fontes: FONTES_SAUDE,
  },
  {
    id: "quadro-de-disjuntores",
    titulo: "Quadro de disjuntores",
    resumo: "Simule a casa: escolha o fio e o disjuntor de cada circuito, erre à vontade e veja o que aconteceria.",
    publico: "adultos",
    minutos: 12,
    tema: "Eletricidade",
    carregar: () => import("./QuadroDeDisjuntores"),
    fontes: FONTES_DISJUNTORES,
  },
  {
    id: "ajuste-o-ponto",
    titulo: "Ajuste o ponto",
    resumo: "Escolha a agulha certa para cada tecido e descubra, pelo sintoma, como ajustar a tensão do fio.",
    publico: "todos",
    minutos: 8,
    tema: "Costura",
    carregar: () => import("./AjusteOPonto"),
    fontes: FONTES_PONTO,
  },
  {
    id: "o-bug-na-memoria",
    titulo: "O bug na memória",
    resumo: "Leia o código, acompanhe o que a memória guarda e ache a linha que tem o erro.",
    publico: "jovens",
    minutos: 10,
    tema: "Programação",
    carregar: () => import("./BugNaMemoria"),
    fontes: FONTES_BUG,
  },
  {
    id: "redundancia-de-servidores",
    titulo: "Redundância de servidores",
    resumo: "Quantos servidores um serviço precisa para quase nunca sair do ar? Teste, derrube e calcule.",
    publico: "jovens",
    minutos: 8,
    tema: "Redes e sistemas",
    carregar: () => import("./RedundanciaDeServidores"),
    fontes: FONTES_REDUNDANCIA,
  },
].map((j) => ({ ...j, fontes: sem_repetir(j.fontes as Fonte[]) })) as JogoProprio[];

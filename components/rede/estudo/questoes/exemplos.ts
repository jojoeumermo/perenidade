// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O DUBLÊ do banco de questões, só para a prévia (NEXT_PUBLIC_ALUMIA_PREVIA=sim): questões de exemplo na memória da aba, com a mesma
// regra do banco (a lista sem a certa e sem a explicação; responder não guarda nada). Nada sai do aparelho.
import { BackendError } from "@/lib/backend";
import { MATERIAS, problemasDaQuestao, type QuestaoParaEnviar } from "./regras";
import type { Questao, QuestaoCompleta } from "./tipos";

const DIA = 86_400_000;
const agora = Date.now();
const quando = (dias: number) => new Date(agora - dias * DIA).toISOString();

interface NaMemoria extends QuestaoCompleta {
  denuncias: string[];
}

const BANCO: NaMemoria[] = [
  {
    id: "00000000-0000-4000-8000-00000000e001",
    materia: "matematica",
    tema: "Função do 2º grau",
    enunciado:
      "Uma ocupação vai cercar uma horta retangular com **40 m** de tela, aproveitando um muro em um dos lados. A área da horta, em função da largura $$x$$, é\n\n$$\nA(x) = x\\,(40 - 2x)\n$$\n\nQual largura deixa a horta com a **maior área**?",
    alternativas: ["5 m", "8 m", "10 m", "15 m", "20 m"],
    certa: 2,
    explicacao:
      "A área é uma parábola com a boca para baixo: $$A(x) = -2x^2 + 40x$$. O vértice fica em\n\n$$\nx_v = -\\frac{b}{2a} = -\\frac{40}{2 \\cdot (-2)} = 10\n$$\n\nCom **10 m** de largura, o comprimento é 20 m e a área chega a 200 m².",
    minha: false,
    criado_em: quando(1),
    editada: false,
    retirada: false,
    denuncias: [],
  },
  {
    id: "00000000-0000-4000-8000-00000000e002",
    materia: "programacao",
    tema: "Laços de repetição",
    enunciado: "O que este programa mostra na tela?\n\n```python\ntotal = 0\nfor n in range(1, 5):\n    total += n\nprint(total)\n```",
    alternativas: ["`10`", "`15`", "`4`", "`0`"],
    certa: 0,
    explicacao: "`range(1, 5)` vai de 1 a **4** (o 5 fica de fora). A soma é $$1 + 2 + 3 + 4 = 10$$.",
    minha: false,
    criado_em: quando(3),
    editada: false,
    retirada: false,
    denuncias: [],
  },
  {
    id: "00000000-0000-4000-8000-00000000e003",
    materia: "historia",
    tema: "Brasil República",
    enunciado: "A Revolta da Vacina (1904), no Rio de Janeiro, foi uma reação popular que juntou a obrigatoriedade da vacina a outro fator. Qual?",
    alternativas: [
      "A reforma urbana que derrubou cortiços e expulsou a população pobre do centro",
      "A abolição da escravidão, assinada naquele ano",
      "A chegada da família real portuguesa ao Brasil",
      "O fim do voto de cabresto nas eleições federais",
    ],
    certa: 0,
    explicacao: "A vacinação obrigatória veio junto do **bota-abaixo** de Pereira Passos: cortiços derrubados e famílias pobres empurradas para os morros e subúrbios, sem casa nem explicação.",
    minha: true,
    criado_em: quando(6),
    editada: false,
    retirada: false,
    denuncias: [],
  },
  {
    id: "00000000-0000-4000-8000-00000000e004",
    materia: "matematica",
    tema: "Porcentagem",
    enunciado: "A passagem de ônibus subiu de R$ 4,40 para R$ 4,84. De quanto foi o aumento?",
    alternativas: ["4%", "8%", "10%", "44%"],
    certa: 2,
    explicacao: "O aumento foi de R$ 0,44. Em relação ao preço antigo: $$\\frac{0{,}44}{4{,}40} = 0{,}10$$, ou seja, **10%**.",
    minha: false,
    criado_em: quando(9),
    editada: true,
    retirada: false,
    denuncias: ["errada"],
  },
];

let seq = 0;
const novoId = () => `00000000-0000-4000-8000-${String(0xe100 + ++seq).padStart(12, "0")}`;
const publica = (q: NaMemoria): Questao => ({ id: q.id, materia: q.materia, tema: q.tema, enunciado: q.enunciado, alternativas: q.alternativas, minha: q.minha, criado_em: q.criado_em, editada: q.editada });
const completa = (q: NaMemoria): QuestaoCompleta => ({ ...publica(q), certa: q.certa, explicacao: q.explicacao, retirada: q.retirada });
const achar = (id: unknown) => {
  const q = BANCO.find((x) => x.id === id && (!x.retirada || x.minha));
  if (!q) throw new BackendError("nao_encontrado");
  return q;
};
const normal = (t: unknown) => String(t ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

/** Responde como o banco responderia, a partir da memória. */
export async function duble<T>(funcao: string, a: Record<string, unknown>): Promise<T> {
  await new Promise((r) => setTimeout(r, 120));
  const vivas = BANCO.filter((q) => !q.retirada);
  switch (funcao) {
    case "rede_questoes_materias":
      return {
        materias: MATERIAS.map((m) => ({ materia: m, questoes: vivas.filter((q) => q.materia === m).length })).filter((m) => m.questoes > 0),
        minhas: BANCO.filter((q) => q.minha).length,
        modera: true,
      } as T;
    case "rede_questoes_temas": {
      const temas = new Map<string, { tema: string; questoes: number }>();
      for (const q of vivas.filter((x) => x.materia === a.p_materia)) {
        const t = temas.get(normal(q.tema)) ?? { tema: q.tema, questoes: 0 };
        t.questoes++;
        temas.set(normal(q.tema), t);
      }
      return { materia: a.p_materia, temas: [...temas.values()].sort((x, y) => x.tema.localeCompare(y.tema)) } as T;
    }
    case "rede_questoes":
      return {
        itens: vivas
          .filter((q) => q.materia === a.p_materia && (!a.p_tema || normal(q.tema) === normal(a.p_tema)))
          .sort((x, y) => y.criado_em.localeCompare(x.criado_em))
          .map(publica),
        proximo: null,
      } as T;
    case "rede_questao":
      return publica(achar(a.p_id)) as T;
    case "rede_questao_responder": {
      const q = achar(a.p_id);
      const e = Number(a.p_escolha);
      if (!Number.isInteger(e) || e < 0 || e >= q.alternativas.length) throw new BackendError("invalido:escolha");
      return { id: q.id, acertou: e === q.certa, certa: q.certa, explicacao: q.explicacao } as T;
    }
    case "rede_questoes_minhas":
      return { itens: BANCO.filter((q) => q.minha).map(completa) } as T;
    case "rede_questao_salvar": {
      const pedido: QuestaoParaEnviar = {
        materia: String(a.p_materia),
        tema: String(a.p_tema ?? ""),
        enunciado: String(a.p_enunciado ?? ""),
        alternativas: (a.p_alternativas as string[]) ?? [],
        certa: Number(a.p_certa),
        explicacao: String(a.p_explicacao ?? ""),
      };
      const problema = problemasDaQuestao(pedido)[0];
      if (problema) throw new BackendError(`invalido:${problema}`);
      if (a.p_id) {
        const q = BANCO.find((x) => x.id === a.p_id && x.minha);
        if (!q) throw new BackendError("nao_encontrado");
        Object.assign(q, pedido, { editada: true });
        return { id: q.id, criada: false } as T;
      }
      const id = novoId();
      BANCO.unshift({ id, ...pedido, minha: true, criado_em: new Date().toISOString(), editada: false, retirada: false, denuncias: [] });
      return { id, criada: true } as T;
    }
    case "rede_questao_apagar": {
      const i = BANCO.findIndex((x) => x.id === a.p_id && x.minha);
      if (i < 0) throw new BackendError("nao_encontrado");
      BANCO.splice(i, 1);
      return { apagada: true } as T;
    }
    case "rede_questao_denunciar": {
      const q = achar(a.p_id);
      if (q.minha) throw new BackendError("invalido:propria");
      q.denuncias.push(String(a.p_motivo));
      return { denunciada: true } as T;
    }
    case "rede_questoes_denunciadas":
      return {
        itens: BANCO.filter((q) => q.denuncias.length > 0).map((q) => ({ ...completa(q), denuncias: q.denuncias.length, motivos: [...new Set(q.denuncias)] })),
      } as T;
    case "rede_questao_mediar": {
      const q = BANCO.find((x) => x.id === a.p_id);
      if (!q) throw new BackendError("nao_encontrado");
      q.retirada = a.p_retirar !== false;
      q.denuncias = [];
      return { id: q.id, retirada: q.retirada } as T;
    }
  }
  throw new BackendError("falha");
}

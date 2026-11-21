// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Ligar e desligar a malha sem internet neste aparelho (onda R3, item 2.2; documento público: docs/rede/SEM-INTERNET.md).
//
// - Desligada por padrão, e desligada de novo a cada vez que o app abre: nada fica gravado dizendo "ligue sozinho". Só liga quando
//   a pessoa ativa na tela do modo ato, depois de ler o aviso ("celulares próximos percebem que há um aparelho participando"):
//   `ligarMalha` exige o aviso aceito.
// - Só no app Android (o transporte é o Bluetooth do plugin nativo: android.ts). No site, `ligarMalha` devolve "so_no_app".
// - Desligar apaga o que o aparelho guardava (no.ts) e para o Bluetooth.
// - O que o aparelho reconhece: os atos com presença confirmada vêm de atos.ts (buscados com internet, só na memória); as caixas da
//   conversa a dois vêm de quem liga o chat: `definirDestino` (a junção liga o serviço do chat aqui com `destinoComAtos`; sem isso,
//   o aparelho reconhece só o farol e repassa o resto).
// Sem "@/" de propósito: roda no Node nos testes (scripts/testar-r3-malha-ativacao.mjs).
import { destinoComAtos } from "./atos";
import { entregador, type DestinoDaEntrega } from "./entrega";
import { NoDaMalha, type TransporteDaMalha } from "./no";
import { montarCobertura } from "./pacote";
import { transporteAndroid } from "./android";

export type EstadoDaMalha = "desligada" | "ligada" | "so_no_app";

/** Sem o chat ligado: nenhuma caixa; o farol dos atos guardados (atos.ts) continua. */
const SO_REPASSA: DestinoDaEntrega = destinoComAtos({ caixas: () => [], mensagem: async () => false });

let destino: DestinoDaEntrega = SO_REPASSA;
/** Uma entrega só por destino: ela guarda o último farol aceito de cada ato (não volta a um estado velho). */
let entregarAgora = entregador(destino);
let no: NoDaMalha | null = null;
let fazerTransporte: () => TransporteDaMalha | null = () => transporteAndroid();
const ouvintes = new Set<(e: EstadoDaMalha) => void>();

const avisar = () => {
  const e = estadoDaMalha();
  for (const f of ouvintes) f(e);
};

/** O estado agora: "so_no_app" quando não há transporte (o site). */
export function estadoDaMalha(): EstadoDaMalha {
  if (no?.ligado) return "ligada";
  return fazerTransporte() ? "desligada" : "so_no_app";
}

/** Liga, se a pessoa aceitou o aviso. Sem o aviso aceito, não liga (erro "aviso_obrigatorio"). */
export function ligarMalha(aviso: { celularesProximosPercebem: true }): EstadoDaMalha {
  if (aviso?.celularesProximosPercebem !== true) throw new Error("aviso_obrigatorio");
  if (no?.ligado) return "ligada";
  const t = fazerTransporte();
  if (!t) return "so_no_app";
  no = new NoDaMalha(t, (p) => entregarAgora(p), { cobertura: () => montarCobertura() });
  no.ligar();
  avisar();
  return "ligada";
}

/** Desliga e apaga o que estava guardado. */
export function desligarMalha(): void {
  no?.desligar();
  no = null;
  avisar();
}

/** O nó ligado (para o chat guardar o que manda: estou-bem.ts, comMalha), ou null. */
export const noDaMalha = (): NoDaMalha | null => (no?.ligado ? no : null);

/** O que este aparelho reconhece. A entrega guarda o último farol aceito por ato: troque o destino só ao mudar de conta. */
export function definirDestino(d: DestinoDaEntrega | null): void {
  destino = d ?? SO_REPASSA;
  entregarAgora = entregador(destino);
}

/** Para ouvir as mudanças (a tela). Devolve o "parar". */
export function aoMudarMalha(f: (e: EstadoDaMalha) => void): () => void {
  ouvintes.add(f);
  return () => ouvintes.delete(f);
}

/** Só para os testes: troca o transporte (aparelhos simulados) e volta tudo ao começo. */
export function _paraTestes(t: (() => TransporteDaMalha | null) | null): void {
  desligarMalha();
  definirDestino(null);
  fazerTransporte = t ?? (() => transporteAndroid());
}

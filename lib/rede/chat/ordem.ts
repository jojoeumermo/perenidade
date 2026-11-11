// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Repetição e ordem das mensagens "c3" do chat privado da Alumia. Cada mensagem leva, DENTRO do cifrado, um identificador
// sorteado, um contador por autor e versão da chave e "até onde eu já tinha recebido da outra pessoa" (lib/rede/chat/c3.ts).
// O servidor não vê nada disso e não consegue fabricar outros. Com eles o aparelho nota:
//   - REPETIÇÃO: a mesma mensagem (o mesmo identificador) chegando de novo como se fosse outra. Ela não é mostrada de novo.
//   - BURACO: falta um contador entre duas mensagens que chegaram. Pode ser mensagem apagada por quem escreveu, mensagem
//     vencida, ou mensagem retida no caminho: o aparelho não sabe qual, então só avisa, de forma discreta.
//   - ORDEM TROCADA: a tela põe as mensagens de cada pessoa na ordem do CONTADOR, não na da hora do servidor, e avisa quando
//     as duas discordam. Avisa também quando uma resposta aparece antes da mensagem que quem respondeu já tinha recebido.
//   - MENSAGEM MINHA QUE AINDA NÃO TINHA CHEGADO: se a última mensagem da outra pessoa diz que ela só tinha recebido até
//     certo ponto, as minhas que vêm depois desse ponto ganham um aviso (o servidor pode estar segurando).
//
// O que fica guardado no aparelho (lib/rede/chat/gaveta.ts), por conversa: por autor e versão, o maior contador visto e a lista
// "identificador → mensagem no servidor"; e uma marca com a maior versão da chave já vista e quando. Nada do texto. Depois de
// VIDA_DO_REGISTRO_DIAS a lista de uma versão ANTIGA é apagada e fica só um piso ("versões até aqui já fecharam"): o aparelho
// deixa de saber se uma mensagem dessa versão é repetida, e passa a mostrá-la com aviso. A versão atual nunca fecha.
//
// O relógio do aparelho não é de confiança (rede hostil, relógio sem bateria): nada vence numa leitura em que a hora andou
// para trás ou saltou dias desde a leitura anterior, NEM nas leituras seguintes: o salto fica anotado na marca ("suspeita") e
// só deixa de valer depois de uma vida inteira de registro contada, sem outro salto, a partir dele.
//
// Funções puras, sem navegador: rodam no Node nos testes (scripts/testar-rede-chat.mjs).

/** O que o aparelho guarda de um autor numa versão da chave de uma conversa. */
export interface RegistroDeOrdem {
  /** "<eu>:<conversa>:<autor>:<versão>". */
  chave: string;
  /** Quando este aparelho viu a primeira mensagem desta versão (milissegundos). */
  desde: number;
  /** O maior contador visto (ou reservado para envio, quando o autor sou eu). */
  maior: number;
  /** Identificador de dentro do cifrado → id da mensagem no servidor. Mensagem antiga ("c2"): "c2:<resumo do corpo>". */
  vistas: Record<string, string>;
}

/** O piso de um autor numa conversa: as versões até `versao` já fecharam neste aparelho. */
export interface PisoDeOrdem {
  /** "<eu>:<conversa>:<autor>:piso". */
  chave: string;
  versao: number;
}

/** A marca das versões da chave de uma conversa, neste aparelho. */
export interface MarcaDeVersoes {
  /** "<eu>:<conversa>:!:versoes". */
  chave: string;
  /** A maior versão da chave que este aparelho já viu nesta conversa. O servidor não consegue fazê-lo voltar a uma menor. */
  topo: number;
  /** Quando este aparelho viu a versão `topo` pela primeira vez (hora do aparelho, milissegundos). */
  desde: number;
  /** A hora do aparelho na última leitura da conversa (para desconfiar de salto no relógio). */
  lida: number;
  /**
   * A hora do aparelho (já a nova) na última leitura em que o relógio voltou ou saltou dias. Depois de um salto não dá para
   * saber a idade de nenhum registro: todos contam como vistos nesta hora. Ausente: nunca houve salto.
   */
  suspeita?: number;
}

/** Uma mensagem c3 já aberta, com o que interessa para a ordem. */
export interface Recebida {
  /** O id da mensagem no servidor. */
  servidor: string;
  autor: string;
  versao: number;
  /** O identificador de dentro do cifrado. */
  id: string;
  contador: number;
}

/**
 * "nova": primeira vez; "vista": a mesma mensagem lida de novo; "repetida": o mesmo conteúdo voltando como outra mensagem;
 * "fechada": de uma versão que este aparelho já fechou (não dá para saber se é repetida: a tela mostra com aviso);
 * "duvidosa": mensagem no formato antigo chegando depois de mensagens novas do mesmo autor na mesma versão (idem).
 */
export type Juizo = "nova" | "vista" | "repetida" | "fechada" | "duvidosa";

/** Versão dura 7 dias (8 no banco) e mensagem dura até 30: depois de 45 dias, nada legítimo dessa versão chega mais. */
export const VIDA_DO_REGISTRO_DIAS = 45;
/** Salto no relógio, entre duas leituras da mesma conversa, a partir do qual a leitura não vence nada. */
export const SALTO_SUSPEITO_DIAS = 2;
const DIA = 86_400_000;

export const prefixoDaOrdem = (eu: string, conversa: string) => `${eu}:${conversa}:`;
export const chaveDaOrdem = (eu: string, conversa: string, autor: string, versao: number) => `${eu}:${conversa}:${autor}:${versao}`;
export const chaveDoPiso = (eu: string, conversa: string, autor: string) => `${eu}:${conversa}:${autor}:piso`;
/** "!" nunca é o id de uma pessoa: a marca não se confunde com o registro de um autor. */
export const chaveDasVersoes = (eu: string, conversa: string) => `${eu}:${conversa}:!:versoes`;

/**
 * Julga uma mensagem aberta contra o que o aparelho já viu e devolve o registro atualizado (o mesmo objeto se nada mudou).
 * `piso`: a maior versão já fechada deste autor nesta conversa (0 se nenhuma).
 */
export function julgar(registro: RegistroDeOrdem | null, piso: number, chave: string, m: Recebida, agora = Date.now()): { juizo: Juizo; registro: RegistroDeOrdem | null } {
  if (!registro) {
    // Versão que este aparelho já fechou: não há mais como saber se é nova ou repetida.
    if (m.versao <= piso) return { juizo: "fechada", registro: null };
    return { juizo: "nova", registro: { chave, desde: agora, maior: m.contador, vistas: { [m.id]: m.servidor } } };
  }
  const antes = registro.vistas[m.id];
  if (antes === m.servidor) return { juizo: "vista", registro };
  if (antes !== undefined) return { juizo: "repetida", registro };
  return { juizo: "nova", registro: { ...registro, maior: Math.max(registro.maior, m.contador), vistas: { ...registro.vistas, [m.id]: m.servidor } } };
}

/**
 * Julga uma mensagem ANTIGA ("c2"), que não tem identificador nem contador: vale o resumo (SHA-256) do corpo. O mesmo corpo
 * voltando como outra mensagem é repetida. Uma c2 que este aparelho nunca viu, chegando numa versão em que o autor já mandou
 * mensagem nova (c3), é duvidosa: o formato antigo não se usa mais depois do novo.
 */
export function julgarAntiga(registro: RegistroDeOrdem | null, piso: number, chave: string, m: { servidor: string; versao: number; resumo: string }, agora = Date.now()): { juizo: Juizo; registro: RegistroDeOrdem | null } {
  const certa = `c2:${m.resumo}`;
  const emDuvida = `c2?:${m.resumo}`;
  if (!registro) {
    if (m.versao <= piso) return { juizo: "fechada", registro: null };
    return { juizo: "nova", registro: { chave, desde: agora, maior: 0, vistas: { [certa]: m.servidor } } };
  }
  if (registro.vistas[certa] === m.servidor) return { juizo: "vista", registro };
  if (registro.vistas[emDuvida] === m.servidor) return { juizo: "duvidosa", registro };
  if (registro.vistas[certa] !== undefined || registro.vistas[emDuvida] !== undefined) return { juizo: "repetida", registro };
  const duvidosa = registro.maior >= 1;
  return { juizo: duvidosa ? "duvidosa" : "nova", registro: { ...registro, vistas: { ...registro.vistas, [duvidosa ? emDuvida : certa]: m.servidor } } };
}

/** O contador da próxima mensagem que EU escrevo nesta versão. */
export const proximoContador = (registro: RegistroDeOrdem | null) => (registro?.maior ?? 0) + 1;

/** O registro depois de eu usar um contador (para nunca usar o mesmo duas vezes). */
export function comContadorUsado(registro: RegistroDeOrdem | null, chave: string, contador: number, agora = Date.now()): RegistroDeOrdem {
  if (!registro) return { chave, desde: agora, maior: contador, vistas: {} };
  return { ...registro, maior: Math.max(registro.maior, contador) };
}

/** Junta o que está guardado com o que esta leitura viu (outra aba pode ter gravado no meio): nunca perde contador nem mensagem vista. */
export function juntarRegistros(guardado: RegistroDeOrdem | null, novo: RegistroDeOrdem): RegistroDeOrdem {
  if (!guardado) return novo;
  return { chave: novo.chave, desde: Math.min(guardado.desde, novo.desde), maior: Math.max(guardado.maior, novo.maior), vistas: { ...guardado.vistas, ...novo.vistas } };
}

/** Este registro já passou da vida útil? (pode virar piso, se for de versão antiga e o relógio for de confiança) */
export const registroVencido = (registro: RegistroDeOrdem, agora = Date.now()) => agora - registro.desde > VIDA_DO_REGISTRO_DIAS * DIA;

/** O relógio voltou ou saltou dias entre a leitura anterior (`lida`) e esta? */
export const relogioSaltou = (lida: number, agora = Date.now()) => agora < lida || agora - lida > SALTO_SUSPEITO_DIAS * DIA;

/**
 * Dá para confiar no relógio nesta leitura? Só se a hora não andou para trás nem saltou dias desde a leitura anterior (na
 * primeira leitura, `lida` desconhecida, não dá) E se não há salto anotado que ainda valha: depois de um salto (`suspeita`),
 * o relógio só volta a ser de confiança quando uma vida inteira de registro passou desde ele, sem outro salto. Sem isso, a
 * SEGUNDA leitura depois do salto já confiaria no relógio mexido (a hora da primeira foi gravada como "lida").
 */
export function relogioConfiavel(lida: number | null | undefined, agora = Date.now(), suspeita?: number | null): boolean {
  if (typeof lida !== "number" || relogioSaltou(lida, agora)) return false;
  if (typeof suspeita !== "number") return true;
  return agora >= suspeita && agora - suspeita > VIDA_DO_REGISTRO_DIAS * DIA;
}

/**
 * A marca depois de uma leitura da conversa: guarda a hora dela (no máximo uma vez por minuto) e, se o relógio voltou ou
 * saltou dias, anota a suspeita. Devolve a MESMA marca se nada muda.
 */
export function marcaDaLeitura(marca: MarcaDeVersoes, agora = Date.now()): MarcaDeVersoes {
  if (relogioSaltou(marca.lida, agora)) return { ...marca, lida: agora, suspeita: agora };
  return agora - marca.lida > 60_000 ? { ...marca, lida: agora } : marca;
}

/**
 * Este registro pode virar piso agora? Só o de versão MENOR que a atual da conversa (a atual nunca fecha, e o contador de quem
 * escreve nunca recomeça), já vencido, e numa leitura em que o relógio é de confiança (sem salto agora e sem salto anotado).
 */
export function podeFechar(registro: RegistroDeOrdem, versaoDoRegistro: number, versaoAtual: number, lida: number | null | undefined, agora = Date.now(), suspeita?: number | null): boolean {
  return versaoDoRegistro < versaoAtual && relogioConfiavel(lida, agora, suspeita) && registroVencido(registro, agora);
}

/** A versão de uma chave de registro ("<eu>:<conversa>:<autor>:<versão>"); null para o piso e para a marca das versões. */
export function versaoDaChave(chave: string): number | null {
  const ultima = chave.slice(chave.lastIndexOf(":") + 1);
  return /^[0-9]+$/.test(ultima) ? Number(ultima) : null;
}

/**
 * Anota a versão da chave que o servidor diz ser a atual. `voltou`: ela é MENOR que uma que este aparelho já viu (o servidor
 * tenta fazer o aparelho escrever numa chave antiga): a marca não muda e a conversa não abre.
 */
export function anotarVersao(marca: MarcaDeVersoes | null, chave: string, versao: number, agora = Date.now()): { marca: MarcaDeVersoes; voltou: boolean } {
  if (!marca) return { marca: { chave, topo: versao, desde: agora, lida: agora }, voltou: false };
  if (versao < marca.topo) return { marca, voltou: true };
  if (versao > marca.topo) return { marca: { ...marca, topo: versao, desde: agora }, voltou: false };
  return { marca, voltou: false };
}

/** Pela hora DESTE aparelho, a versão atual já passou de `dias`? (não depende do que o servidor diz sobre a idade dela) */
export const versaoVelhaAqui = (desde: number, dias: number, agora = Date.now()) => agora - desde > dias * DIA;

/**
 * Onde há buraco: os ids (do servidor) das mensagens que vêm logo DEPOIS de um contador que falta, por autor e versão. Só
 * conta buraco ENTRE mensagens que chegaram: o começo (mensagens antigas que já venceram) não é buraco.
 */
export function buracos(lista: readonly Pick<Recebida, "servidor" | "autor" | "versao" | "contador">[]): Set<string> {
  const grupos = new Map<string, Pick<Recebida, "servidor" | "contador">[]>();
  for (const m of lista) {
    const chave = `${m.autor}:${m.versao}`;
    const grupo = grupos.get(chave) ?? [];
    grupo.push(m);
    grupos.set(chave, grupo);
  }
  const depoisDoBuraco = new Set<string>();
  for (const grupo of grupos.values()) {
    grupo.sort((a, b) => a.contador - b.contador);
    for (let i = 1; i < grupo.length; i++) if (grupo[i].contador > grupo[i - 1].contador + 1) depoisDoBuraco.add(grupo[i].servidor);
  }
  return depoisDoBuraco;
}

/** O que a tela precisa de cada mensagem para pôr em ordem. `contador` nulo: mensagem que não entra na conferência (antiga, repetida, sem chave). */
export interface NaTela {
  id: string;
  autor: string;
  versao: number;
  criado_em: string;
  contador: number | null;
  visto: { versao: number; contador: number } | null;
}

/** A ordem da tela e os avisos dela (ids do servidor). */
export interface OrdemDaTela<T> {
  ordenadas: T[];
  /** A hora do servidor discorda da ordem em que a pessoa escreveu, ou a resposta veio antes do que ela responde. */
  foraDeOrdem: Set<string>;
  /** Mensagens MINHAS que a outra pessoa ainda não tinha recebido quando escreveu a última mensagem dela. */
  semConfirmar: Set<string>;
}

const depois = (a: { versao: number; contador: number }, b: { versao: number; contador: number }) => a.versao > b.versao || (a.versao === b.versao && a.contador > b.contador);

/**
 * Põe as mensagens na ordem da tela. A hora do servidor só decide como as duas pessoas se intercalam; DENTRO de cada pessoa
 * vale a ordem em que ela escreveu (versão da chave, depois contador), que o servidor não consegue mexer. Onde a hora do
 * servidor discorda disso, a mensagem ganha aviso. `eu`: o id de quem olha.
 */
export function ordemDaTela<T extends NaTela>(lista: readonly T[], eu: string): OrdemDaTela<T> {
  const ordenadas = [...lista].sort((a, b) => a.criado_em.localeCompare(b.criado_em) || a.id.localeCompare(b.id));
  const foraDeOrdem = new Set<string>();
  const semConfirmar = new Set<string>();
  // Dentro de cada pessoa: os lugares que as mensagens dela ocupam são preenchidos de novo, na ordem em que ela escreveu.
  const lugares = new Map<string, number[]>();
  ordenadas.forEach((m, i) => {
    if (m.contador === null) return;
    lugares.set(m.autor, [...(lugares.get(m.autor) ?? []), i]);
  });
  for (const indices of lugares.values()) {
    const pelaHora = indices.map((i) => ordenadas[i]);
    const peloContador = [...pelaHora].sort((a, b) => a.versao - b.versao || (a.contador as number) - (b.contador as number));
    peloContador.forEach((m, k) => {
      if (m !== pelaHora[k]) foraDeOrdem.add(m.id);
      ordenadas[indices[k]] = m;
    });
  }
  // Resposta antes da pergunta: a mensagem diz que quem escreveu já tinha recebido certa mensagem da outra pessoa, e essa
  // mensagem aparece DEPOIS dela.
  const lugarDe = new Map<string, number>();
  ordenadas.forEach((m, i) => {
    if (m.contador !== null) lugarDe.set(`${m.autor}:${m.versao}:${m.contador}`, i);
  });
  ordenadas.forEach((m, i) => {
    if (m.contador === null || !m.visto || m.visto.versao < 1) return;
    for (const [chave, lugar] of lugarDe) {
      if (lugar > i && !chave.startsWith(`${m.autor}:`) && chave.endsWith(`:${m.visto.versao}:${m.visto.contador}`)) foraDeOrdem.add(m.id);
    }
  });
  // As minhas que a outra pessoa ainda não tinha recebido quando escreveu a ÚLTIMA mensagem dela (some sozinho na próxima).
  let ultimaDaOutra = -1;
  ordenadas.forEach((m, i) => {
    if (m.autor !== eu && m.contador !== null && m.visto) ultimaDaOutra = i;
  });
  const vistoPorEla = ultimaDaOutra >= 0 ? ordenadas[ultimaDaOutra].visto : null;
  if (vistoPorEla && vistoPorEla.versao >= 1) {
    ordenadas.forEach((m, i) => {
      if (i < ultimaDaOutra && m.autor === eu && m.contador !== null && depois({ versao: m.versao, contador: m.contador }, vistoPorEla)) semConfirmar.add(m.id);
    });
  }
  return { ordenadas, foraDeOrdem, semConfirmar };
}

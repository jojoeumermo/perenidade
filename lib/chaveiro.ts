// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O chaveiro deste aparelho: o par de chaves dele (guardado no próprio navegador, em IndexedDB, sem poder ser exportado), a
// identidade da conta (criada no primeiro aparelho e repassada, embrulhada, aos aparelhos aprovados), as identidades que este
// aparelho já conhece dos colegas (para notar quando uma muda) e as chaves das conversas, abertas só na memória enquanto a
// página está aberta. Também repassa chaves para aparelhos de colegas que ainda não as receberam, mas só para aparelhos
// certificados pela identidade da pessoa: o servidor não consegue fazer este aparelho entregar chaves a um aparelho falso.
//
// Desde a R2 (11/2026) as mensagens vão em MLS (lib/equipe/mls.ts, OpenMLS do @wireapp/core-crypto na suíte híbrida ML-KEM-768 +
// X25519): um grupo por conversa, com cada aparelho aprovado como folha certificada pela identidade da pessoa; a mensagem "m1" vai
// assinada pela identidade de quem escreveu, por dentro da cifra. A identidade repassada a um aparelho aprovado vai em HPKE ("h1",
// lib/sigilo.ts). O Megolm ("e1") e a cifra "c2" saíram, com as conversas cifradas do beta (20261124-r2-equipe.sql).
// A assinatura (identidade) e o resto da cifra moram em lib/sigilo.ts.
import { BackendError, rpc } from "./backend";
import {
  abrirCopia, abrirPedido, abrirTexto, assinarTexto, type Autoria, certificarAparelho, contextoDaIdentidade, type Copia, deBase64, desembrulharBytes, embrulharBytes,
  exportarIdentidade, type Identidade, importarIdentidade, novaIdentidade, novoAparelho, novoCodigo, paraBase64, type Selado, selarCopia, selarPedido, VALIDADE_DO_PEDIDO_MS,
} from "./sigilo";
import { assinar, verificar } from "./sigilo";
import { criarMlsDaEquipe, type EstadoDaConversa, type MlsDaEquipe } from "./equipe/mls";
import { apagarLojasDoMegolm } from "./equipe/limpeza";
import { abrirMensagem, assinarMensagem, chaveDasFichas, contextoDaMensagem, ficha, fichaDoEnvio, type FinalidadeDaFicha, type Lugar, type MensagemAberta } from "./equipe/autoria";

export type Estado = "aprovado" | "pendente";

interface Guardado {
  usuario: string;
  id: string;
  privada: CryptoKey;
  publica: string;
  estado: Estado;
  /** A identidade da conta, quando este aparelho já a recebeu. */
  identidade?: Identidade;
  /** Enquanto pendente: o código mostrado na tela, que quem aprova digita. */
  codigo?: string;
  /** Quando o código foi feito (o pedido vale 10 minutos; o aparelho troca o código antes de vencer). */
  codigoEm?: number;
}

/** Uma identidade de colega que este aparelho já viu. A regra é "confiar na primeira vez, avisar quando mudar". */
export interface Conhecida {
  /** "<eu>:<colega>": cada conta deste navegador guarda as próprias. */
  chave: string;
  eu: string;
  outro: string;
  assina: string;
  /** A pessoa comparou o código de segurança pessoalmente e marcou. */
  verificado: boolean;
  desde: string;
  /** A identidade mudou (sem verificação): aviso na conversa até a pessoa dispensar. */
  mudou_em?: string;
  anterior?: string;
  /** A identidade mudou depois de verificada: as chaves ficam retidas até a pessoa confirmar a nova. */
  pendente?: string;
}

interface Registro {
  id: string;
  estado: Estado;
  certificado: string | null;
  identidade_embrulho: string | null;
  aprovado_publica: string | null;
  identidade: { assina: string | null; versao: number } | null;
}

/** Um aviso que a conversa mostra no fluxo: a identidade de alguém mudou. */
export interface Alerta {
  usuario: string;
  nome: string;
  /** "mudou": avisa e segue. "retida": a pessoa estava verificada; nada é entregue até confirmar. */
  tipo: "mudou" | "retida";
}

/** Um texto aberto: o que foi escrito e se a assinatura confere com a identidade conhecida do autor. */
export interface Aberto {
  texto: string;
  autoria: Autoria;
}

const BANCO = "lucia-sigilo";
const GAVETA = "aparelhos";
const CONHECIDAS = "identidades";

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(BANCO, 2);
    pedido.onupgradeneeded = () => {
      const banco = pedido.result;
      if (!banco.objectStoreNames.contains(GAVETA)) banco.createObjectStore(GAVETA, { keyPath: "usuario" });
      if (!banco.objectStoreNames.contains(CONHECIDAS)) banco.createObjectStore(CONHECIDAS, { keyPath: "chave" });
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

async function naGaveta<T>(gaveta: string, modo: IDBTransactionMode, agir: (gaveta: IDBObjectStore) => IDBRequest): Promise<T> {
  const banco = await abrirBanco();
  try {
    return await new Promise<T>((resolve, reject) => {
      const pedido = agir(banco.transaction(gaveta, modo).objectStore(gaveta));
      pedido.onsuccess = () => resolve(pedido.result as T);
      pedido.onerror = () => reject(pedido.error);
    });
  } finally {
    banco.close();
  }
}

/** Sem IndexedDB (alguns modos privados), tudo vive só enquanto a aba está aberta. */
const naMemoria = new Map<string, Guardado>();
const conhecidasNaMemoria = new Map<string, Conhecida>();

async function lerGuardado(usuario: string): Promise<Guardado | null> {
  try {
    return (await naGaveta<Guardado | undefined>(GAVETA, "readonly", (gaveta) => gaveta.get(usuario))) ?? null;
  } catch {
    return naMemoria.get(usuario) ?? null;
  }
}

async function guardar(dados: Guardado) {
  naMemoria.set(dados.usuario, dados);
  try {
    await naGaveta(GAVETA, "readwrite", (gaveta) => gaveta.put(dados));
  } catch {
    // fica só na memória
  }
}

async function esquecer(usuario: string) {
  naMemoria.delete(usuario);
  try {
    await naGaveta(GAVETA, "readwrite", (gaveta) => gaveta.delete(usuario));
  } catch {
    // nada guardado
  }
}

async function lerConhecidas(eu: string): Promise<Conhecida[]> {
  try {
    const todas = await naGaveta<Conhecida[]>(CONHECIDAS, "readonly", (gaveta) => gaveta.getAll());
    return todas.filter((item) => item.eu === eu);
  } catch {
    return [...conhecidasNaMemoria.values()].filter((item) => item.eu === eu);
  }
}

async function guardarConhecida(dados: Conhecida) {
  conhecidasNaMemoria.set(dados.chave, dados);
  try {
    await naGaveta(CONHECIDAS, "readwrite", (gaveta) => gaveta.put(dados));
  } catch {
    // fica só na memória
  }
}

/** Um nome curto para a pessoa reconhecer o aparelho na lista ("Chrome no Android"). Nada que identifique a máquina. */
function rotulo(): string {
  const agente = navigator.userAgent;
  const navegador = /Edg\//.test(agente) ? "Edge" : /OPR\//.test(agente) ? "Opera" : /Firefox\//.test(agente) ? "Firefox" : /Chrome\//.test(agente) ? "Chrome" : /Safari\//.test(agente) ? "Safari" : "Navegador";
  const sistema = /Android/.test(agente) ? "Android" : /iPhone|iPad/.test(agente) ? "iPhone" : /Windows/.test(agente) ? "Windows" : /Mac OS/.test(agente) ? "Mac" : /Linux/.test(agente) ? "Linux" : "";
  return sistema ? `${navegador} no ${sistema}` : navegador;
}

/** Duas abas abertas ao mesmo tempo não criam dois aparelhos. */
function comTrava<T>(fazer: () => Promise<T>): Promise<T> {
  const travas = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  return travas ? (travas.request("lucia-sigilo", fazer) as Promise<T>) : fazer();
}

const codigo = (erro: unknown) => (erro && typeof erro === "object" && "code" in erro ? String((erro as { code: unknown }).code) : "");

export class Chaveiro {
  readonly usuario: string;
  readonly aparelho: string;
  readonly publica: string;
  estado: Estado;
  /** O código que o aparelho pendente mostra; quem aprova digita (ou lê o QR). */
  codigoDePedido: string | null;
  /** Os aparelhos antigos que a migração aprovou junto com este: a tela avisa a pessoa. */
  migrados: { id: string; rotulo: string }[] = [];
  private readonly privada: CryptoKey;
  private identidade: Identidade | null;
  private readonly estadoDe = new Map<string, { identidades: EstadoDaConversa["identidades"]; em: number }>();
  private readonly carregando = new Map<string, Promise<void>>();
  private conhecidas = new Map<string, Conhecida>();
  /** Avisos por conversa (identidade de alguém mudou), refeitos a cada carga. */
  private readonly alertas = new Map<string, Alerta[]>();
  private ouvintes = new Set<() => void>();
  /** O MLS deste aparelho (aberto quando o aparelho está aprovado e tem a identidade). */
  private mls: MlsDaEquipe | null = null;
  /** A chave das fichas de dono (tirada da identidade; lib/equipe/autoria.ts), feita uma vez por chaveiro. */
  private chaveDeFichas: Promise<Uint8Array> | null = null;

  private constructor(guardado: Guardado, conhecidas: Conhecida[]) {
    this.usuario = guardado.usuario;
    this.aparelho = guardado.id;
    this.publica = guardado.publica;
    this.privada = guardado.privada;
    this.estado = guardado.estado;
    this.identidade = guardado.identidade ?? null;
    this.codigoDePedido = guardado.codigo ?? null;
    for (const item of conhecidas) this.conhecidas.set(item.outro, item);
  }

  /** A parte pública da identidade desta conta (null enquanto o aparelho está pendente). */
  get identidadePublica(): string | null {
    return this.identidade?.publica ?? null;
  }

  /** Avisa a tela quando algo muda (aprovação, identidade de colega). */
  ouvir(ouvinte: () => void): () => void {
    this.ouvintes.add(ouvinte);
    return () => this.ouvintes.delete(ouvinte);
  }
  private avisar() {
    for (const ouvinte of this.ouvintes) ouvinte();
  }

  /** O chaveiro do aparelho para esta conta: reaproveita o par guardado ou cria e registra um novo. */
  static abrir(usuario: string): Promise<Chaveiro> {
    if (typeof crypto === "undefined" || !crypto.subtle) return Promise.reject(new BackendError("sem_cifra"));
    return comTrava(async () => {
      const conhecidas = await lerConhecidas(usuario);
      let guardado = await lerGuardado(usuario);
      if (guardado) {
        try {
          // Confirma que o aparelho continua registrado. Se foi removido de outro aparelho, volta como aparelho novo
          // (a pessoa é avisada) e precisa ser aprovado de novo.
          const registro = await rpc<Registro>("chat_aparelho_registrar", { p_publica: guardado.publica, p_rotulo: rotulo() });
          guardado = await Chaveiro.acertar(guardado, registro);
        } catch (erro) {
          // O banco não conhece mais este aparelho: removido de outro aparelho, tirado por ficar seis meses sem uso, ou pendente
          // que ninguém aprovou em um dia (a limpeza diária apaga). Como esta chamada não leva pedido nem identidade, o banco
          // responde "invalido:pedido" (ele leria um aparelho novo sem pedido); "invalido:publica" é a chave de outra conta.
          // Nos dois casos o aparelho recomeça como novo, com pedido. Antes só o segundo era tratado, e as Conversas e o Mural
          // da equipe paravam com "Confira o campo: pedido.".
          const motivo = codigo(erro);
          if (motivo !== "invalido:publica" && motivo !== "invalido:pedido") throw erro;
          await esquecer(usuario);
          guardado = null;
        }
      }
      if (!guardado) {
        // Aparelho novo: entra pendente, com o pedido selado pelo código. Se a conta ainda não tem identidade, vira o primeiro.
        const par = await novoAparelho();
        const codigoNovo = novoCodigo();
        const codigoEm = Date.now();
        const registro = await rpc<Registro>("chat_aparelho_registrar", { p_publica: par.publica, p_rotulo: rotulo(), p_pedido: await selarPedido(codigoNovo, usuario, par.publica, codigoEm) });
        guardado = await Chaveiro.acertar({ usuario, id: registro.id, privada: par.privada, publica: par.publica, estado: "pendente", codigo: codigoNovo, codigoEm }, registro);
      }
      await guardar(guardado);
      // As chaves do Megolm de antes da R2 (a loja da biblioteca do Matrix deste aparelho) saem do navegador.
      await apagarLojasDoMegolm(guardado.id);
      return new Chaveiro(guardado, conhecidas);
    });
  }

  /** Põe o que o banco disse em dia com o que este aparelho guarda: identidade recebida, migração, pedido novo. */
  private static async acertar(guardado: Guardado, registro: Registro): Promise<Guardado> {
    guardado = { ...guardado, id: registro.id, estado: registro.estado };
    if (registro.estado === "aprovado") {
      guardado.codigo = undefined;
      guardado.codigoEm = undefined;
      if (!guardado.identidade && registro.identidade_embrulho && registro.aprovado_publica && registro.identidade?.assina) {
        const secreta = await desembrulharBytes(registro.identidade_embrulho, guardado.privada, registro.aprovado_publica, contextoDaIdentidade(guardado.usuario, registro.id), guardado.publica);
        if (secreta) {
          try {
            guardado.identidade = await importarIdentidade(secreta, registro.identidade.assina);
          } finally {
            secreta.fill(0);
          }
        }
      }
      return guardado;
    }
    // Pendente numa conta que ainda não tem identidade: este aparelho cria a identidade (é o primeiro, ou é a migração dos
    // aparelhos de antes da identidade existir) e aprova os outros aparelhos antigos da conta.
    if (!registro.identidade?.assina) {
      const identidade = await novaIdentidade();
      const certificado = await certificarAparelho(identidade, guardado.usuario, guardado.publica);
      const resposta = await rpc<{ outros: { id: string; publica: string; rotulo: string }[] }>("chat_identidade_definir", { p_aparelho: registro.id, p_assina: identidade.publica, p_certificado: certificado });
      guardado = { ...guardado, estado: "aprovado", identidade, codigo: undefined };
      const secreta = await exportarIdentidade(identidade);
      try {
        for (const outro of resposta.outros) {
          await rpc("chat_aparelho_aprovar", {
            p_id: outro.id,
            p_por: registro.id,
            p_certificado: await certificarAparelho(identidade, guardado.usuario, outro.publica),
            p_identidade_embrulho: await embrulharBytes(secreta, guardado.privada, outro.publica, contextoDaIdentidade(guardado.usuario, outro.id), guardado.publica),
          }).catch(() => undefined);
        }
      } finally {
        secreta.fill(0);
      }
      migrados.set(guardado.usuario, resposta.outros.map((outro) => ({ id: outro.id, rotulo: outro.rotulo })));
      return guardado;
    }
    // Pendente sem pedido no banco (ficou de fora da migração), ou com o pedido perto de vencer (vale 10 minutos): deixa um
    // pedido novo, com outro código.
    if (!guardado.codigo || !guardado.codigoEm || Date.now() - guardado.codigoEm > VALIDADE_DO_PEDIDO_MS - 60_000) {
      guardado.codigo = novoCodigo();
      guardado.codigoEm = Date.now();
      await rpc("chat_aparelho_pedir", { p_id: registro.id, p_pedido: await selarPedido(guardado.codigo, guardado.usuario, guardado.publica, guardado.codigoEm) }).catch(() => undefined);
    }
    return guardado;
  }

  /** O aparelho pendente pergunta se já foi aprovado. Devolve o estado novo. */
  async atualizarEstado(): Promise<Estado> {
    if (this.estado === "aprovado") return "aprovado";
    const guardado = await lerGuardado(this.usuario);
    if (!guardado) return this.estado;
    const registro = await rpc<Registro>("chat_aparelho_estado", { p_id: this.aparelho });
    const acertado = await Chaveiro.acertar(guardado, registro);
    await guardar(acertado);
    this.estado = acertado.estado;
    this.identidade = acertado.identidade ?? null;
    const codigoMudou = this.codigoDePedido !== (acertado.codigo ?? null);
    this.codigoDePedido = acertado.codigo ?? null;
    if (this.estado === "aprovado" || codigoMudou) this.avisar();
    return this.estado;
  }

  /**
   * Aprova um aparelho pendente desta conta: abre o pedido dele com o código digitado (ou lido do QR), confere que a chave
   * pública é a que o banco mostra, certifica e repassa a identidade. Devolve false se o código não serve.
   */
  async aprovar(aparelho: string, codigoDigitado: string, publicaLida?: string): Promise<boolean> {
    if (!this.identidade) throw new BackendError("aparelho_pendente");
    const lista = await rpc<{ id: string; estado: Estado; publica: string; pedido: Selado | null }[]>("chat_aparelhos_meus");
    const alvo = lista.find((item) => item.id === aparelho && item.estado === "pendente");
    if (!alvo?.pedido) throw new BackendError("nao_encontrado");
    const publica = await abrirPedido(codigoDigitado.replace(/\D/g, ""), this.usuario, alvo.pedido);
    // O código abre só o pedido feito com ele; e a chave que o pedido traz precisa ser a que o banco mostra (e a do QR, se houver).
    if (!publica || publica !== alvo.publica || (publicaLida && publicaLida !== publica)) return false;
    const secreta = await exportarIdentidade(this.identidade);
    try {
      await rpc("chat_aparelho_aprovar", {
        p_id: aparelho,
        p_por: this.aparelho,
        p_certificado: await certificarAparelho(this.identidade, this.usuario, publica),
        p_identidade_embrulho: await embrulharBytes(secreta, this.privada, publica, contextoDaIdentidade(this.usuario, aparelho), this.publica),
      });
    } finally {
      secreta.fill(0);
    }
    return true;
  }

  /** Um aparelho pendente recebe a identidade pela cópia de recuperação. Devolve false se a chave de recuperação não abre a cópia. */
  async recuperar(chaveDeRecuperacao: string): Promise<boolean> {
    const guardada = await rpc<{ copia: Selado } | null>("chat_recuperacao_ler");
    if (!guardada) throw new BackendError("sem_copia");
    const copia = await abrirCopia(chaveDeRecuperacao, this.usuario, guardada.copia);
    if (!copia) return false;
    const secreta = deBase64(copia.identidade.secreta);
    let identidade: Identidade;
    try {
      identidade = await importarIdentidade(secreta, copia.identidade.publica);
    } finally {
      secreta.fill(0);
    }
    // O aparelho que se certifica sozinho pela cópia fica na espera de 24 horas (20261121-equipe-chat-espera.sql): "pendente" até lá.
    const registro = await rpc<Registro>("chat_aparelho_recuperar", { p_id: this.aparelho, p_assina: identidade.publica, p_certificado: await certificarAparelho(identidade, this.usuario, this.publica) });
    const estado: Estado = registro?.estado === "pendente" ? "pendente" : "aprovado";
    // A cópia não traz chave de conversa (desde a R2, nem pode): o aparelho recuperado é aparelho novo no MLS e lê daí em diante.
    this.identidade = identidade;
    this.estado = estado;
    this.codigoDePedido = null;
    const guardado = await lerGuardado(this.usuario);
    if (guardado) await guardar({ ...guardado, estado, identidade, codigo: undefined });
    this.avisar();
    return true;
  }

  /**
   * Guarda no banco a cópia de recuperação: só a identidade, cifrada pela chave de recuperação. Nenhuma chave de conversa vai junto:
   * a cópia não ressuscita chave velha (o aparelho recuperado entra no MLS como aparelho novo).
   */
  async guardarCopia(chaveDeRecuperacao: string): Promise<void> {
    if (!this.identidade) throw new BackendError("aparelho_pendente");
    const secreta = await exportarIdentidade(this.identidade);
    const chaves: Copia["chaves"] = [];
    try {
      const copia: Copia = { identidade: { secreta: paraBase64(secreta), publica: this.identidade.publica }, chaves, quando: new Date().toISOString() };
      await rpc("chat_recuperacao_guardar", { p_copia: await selarCopia(chaveDeRecuperacao, this.usuario, copia) });
    } finally {
      secreta.fill(0);
    }
  }

  // ── Identidades dos colegas ──

  /** As identidades que este aparelho conhece, para a tela de verificação. */
  listarConhecidas(): Conhecida[] {
    return [...this.conhecidas.values()];
  }

  conhecida(outro: string): Conhecida | null {
    return this.conhecidas.get(outro) ?? null;
  }

  /** Marca (ou desmarca) uma pessoa como verificada, depois de comparar o código de segurança pessoalmente. */
  async marcarVerificada(outro: string, verificado: boolean): Promise<void> {
    const atual = this.conhecidas.get(outro);
    if (!atual) return;
    const nova = { ...atual, verificado, mudou_em: undefined, anterior: undefined };
    this.conhecidas.set(outro, nova);
    await guardarConhecida(nova);
    this.avisar();
  }

  /** A pessoa viu o aviso de que a identidade de alguém mudou. */
  async dispensarAviso(outro: string): Promise<void> {
    const atual = this.conhecidas.get(outro);
    if (!atual?.mudou_em) return;
    const nova = { ...atual, mudou_em: undefined, anterior: undefined };
    this.conhecidas.set(outro, nova);
    await guardarConhecida(nova);
    this.refazerAlertas();
    this.avisar();
  }

  /** Depois de conferir com a pessoa, aceita a identidade nova de alguém que estava verificado (a verificação é desfeita). */
  async confirmarNova(outro: string): Promise<void> {
    const atual = this.conhecidas.get(outro);
    if (!atual?.pendente) return;
    const nova: Conhecida = { ...atual, assina: atual.pendente, verificado: false, pendente: undefined, mudou_em: undefined, anterior: undefined, desde: new Date().toISOString() };
    this.conhecidas.set(outro, nova);
    await guardarConhecida(nova);
    this.refazerAlertas();
    this.avisar();
  }

  /**
   * A identidade que este aparelho aceita para alguém: a conhecida, ou a que o banco diz na primeira vez. Com a conhecida
   * diferente da do banco: sem verificação, troca e avisa; com verificação, retém até a pessoa confirmar.
   */
  private async aceitarIdentidade(usuario: string, assina: string | null): Promise<string | null> {
    if (usuario === this.usuario) return this.identidade?.publica ?? null;
    if (!assina) return null;
    const atual = this.conhecidas.get(usuario);
    if (!atual) {
      const nova: Conhecida = { chave: `${this.usuario}:${usuario}`, eu: this.usuario, outro: usuario, assina, verificado: false, desde: new Date().toISOString() };
      this.conhecidas.set(usuario, nova);
      await guardarConhecida(nova);
      return assina;
    }
    if (atual.assina === assina) {
      if (atual.pendente) {
        // Voltou a identidade de sempre (o banco mostrava outra por engano): nada a reter.
        const nova = { ...atual, pendente: undefined };
        this.conhecidas.set(usuario, nova);
        await guardarConhecida(nova);
      }
      return assina;
    }
    if (atual.verificado) {
      if (atual.pendente !== assina) {
        const nova = { ...atual, pendente: assina };
        this.conhecidas.set(usuario, nova);
        await guardarConhecida(nova);
      }
      return null;
    }
    const nova: Conhecida = { ...atual, assina, anterior: atual.assina, mudou_em: new Date().toISOString(), desde: new Date().toISOString() };
    this.conhecidas.set(usuario, nova);
    await guardarConhecida(nova);
    return assina;
  }

  private refazerAlertas() {
    for (const [conversa, estado] of this.estadoDe) {
      const lista: Alerta[] = [];
      for (const pessoa of estado.identidades) {
        if (pessoa.usuario === this.usuario) continue;
        const conhecida = this.conhecidas.get(pessoa.usuario);
        if (conhecida?.pendente) lista.push({ usuario: pessoa.usuario, nome: pessoa.nome, tipo: "retida" });
        else if (conhecida?.mudou_em) lista.push({ usuario: pessoa.usuario, nome: pessoa.nome, tipo: "mudou" });
      }
      this.alertas.set(conversa, lista);
    }
  }

  /** Os avisos de identidade de uma conversa. */
  alertasDe(conversa: string): Alerta[] {
    return this.alertas.get(conversa) ?? [];
  }

  /** As pessoas de uma conversa com a identidade conhecida e se estão verificadas. */
  pessoasDe(conversa: string): { usuario: string; nome: string; assina: string | null; verificado: boolean }[] {
    const estado = this.estadoDe.get(conversa);
    if (!estado) return [];
    return estado.identidades.map((pessoa) => {
      const conhecida = this.conhecidas.get(pessoa.usuario);
      return { usuario: pessoa.usuario, nome: pessoa.nome, assina: pessoa.usuario === this.usuario ? (this.identidade?.publica ?? null) : (conhecida?.assina ?? null), verificado: Boolean(conhecida?.verificado) };
    });
  }

  /** A identidade com que uma mensagem deste autor deve conferir. */
  private identidadeDe(usuario: string): string | null {
    if (usuario === this.usuario) return this.identidade?.publica ?? null;
    return this.conhecidas.get(usuario)?.assina ?? null;
  }

  // ── O MLS (mensagens "m1") ──

  /**
   * O MLS deste aparelho: só para aparelho aprovado (com a identidade, que certifica a folha dele). A loja do motor fica no OPFS
   * ("core-crypto/equipe-<aparelho>") e os segredos de época no IndexedDB dos grupos, cifrados (lib/rede/grupos/loja-do-navegador.ts,
   * baixado só quando o chat da equipe abre).
   */
  private mlsDoAparelho(): MlsDaEquipe {
    if (!this.identidade || this.estado !== "aprovado") throw new BackendError("aparelho_pendente");
    const identidade = this.identidade;
    const loja = () => import("./rede/grupos/loja-do-navegador");
    const prefixo = `equipe:${this.aparelho}:`;
    this.mls ??= criarMlsDaEquipe({
      chamar: (funcao, argumentos) => rpc(funcao, argumentos),
      aparelho: this.aparelho,
      usuario: this.usuario,
      assinar: (texto) => assinar(identidade.privada, texto),
      verificar,
      identidadeDe: (usuario) => this.identidadeDe(usuario),
      guarda: {
        ler: async (k) => (await loja()).guardaNoNavegador(prefixo).ler(k),
        guardar: async (k, v) => (await loja()).guardaNoNavegador(prefixo).guardar(k, v),
        apagar: async (k) => (await loja()).guardaNoNavegador(prefixo).apagar(k),
      },
      abrirMotor: async () => (await loja()).abrirLojaDoMotor(`equipe-${this.aparelho}`),
    });
    return this.mls;
  }

  /** Esquece o MLS deste aparelho e apaga a loja dele do navegador (ao recomeçar a identidade). */
  async esquecerBiblioteca(): Promise<void> {
    this.mls = null;
    if (typeof navigator === "undefined" || !navigator.storage?.getDirectory) return;
    try {
      const raiz = await navigator.storage.getDirectory();
      const dir = await raiz.getDirectoryHandle("core-crypto");
      await dir.removeEntry(`equipe-${this.aparelho}`, { recursive: true });
    } catch {
      // não havia
    }
  }

  // ── As conversas ──

  /** Busca no banco quem está na conversa e a identidade de cada pessoa (comparada com a que este aparelho já conhecia). */
  carregar(conversa: string): Promise<void> {
    const emCurso = this.carregando.get(conversa);
    if (emCurso) return emCurso;
    const trabalho = (async () => {
      const e = await this.mlsDoAparelho().estado(conversa, true);
      for (const pessoa of e.identidades) await this.aceitarIdentidade(pessoa.usuario, pessoa.assina);
      this.estadoDe.set(conversa, { identidades: e.identidades, em: Date.now() });
      this.refazerAlertas();
    })().finally(() => this.carregando.delete(conversa));
    this.carregando.set(conversa, trabalho);
    return trabalho;
  }

  /** Abre um texto cifrado ("m1") e confere a assinatura do autor. null: não abre neste aparelho (não estava no grupo naquela época). */
  async abrir(conversa: string, corpo: string, contexto: string, autor: string | null): Promise<Aberto | null> {
    if (!autor || this.estado !== "aprovado" || !this.identidade) return null;
    if (Date.now() - (this.estadoDe.get(conversa)?.em ?? 0) > 60_000) await this.carregar(conversa).catch(() => undefined);
    const r = await this.mlsDoAparelho().abrir(conversa, corpo, contexto).catch(() => null);
    if (!r) return null;
    return abrirTexto(r.texto, this.identidadeDe(autor), contexto, r.epoca);
  }

  /**
   * Chat da equipe (onda R3): cifra uma mensagem com quem escreve e a hora DENTRO do cifrado ("s2", lib/equipe/autoria.ts), presa ao
   * id, ao tipo e ao alvo dela. O banco não recebe o autor nem a hora.
   */
  async cifrarMensagem(l: Lugar, texto: string, hora: number = Date.now()): Promise<string> {
    if (!this.identidade) throw new BackendError("aparelho_pendente");
    await this.carregar(l.conversa);
    const identidade = this.identidade;
    return this.mlsDoAparelho().cifrar(l.conversa, contextoDaMensagem(l.conversa, l.id), (epoca) => assinarMensagem(identidade, l, epoca, this.usuario, hora, texto));
  }

  /** Abre uma mensagem do chat da equipe: o texto, quem escreveu e a hora (de dentro), com a assinatura conferida. null: não abre aqui. */
  async abrirMensagem(l: Lugar, corpo: string): Promise<MensagemAberta | null> {
    if (this.estado !== "aprovado" || !this.identidade) return null;
    if (Date.now() - (this.estadoDe.get(l.conversa)?.em ?? 0) > 60_000) await this.carregar(l.conversa).catch(() => undefined);
    const r = await this.mlsDoAparelho().abrir(l.conversa, corpo, contextoDaMensagem(l.conversa, l.id)).catch(() => null);
    if (!r) return null;
    return abrirMensagem(r.texto, l, r.epoca, (usuario) => this.identidadeDe(usuario));
  }

  private fichas(): Promise<Uint8Array> {
    if (!this.identidade) return Promise.reject(new BackendError("aparelho_pendente"));
    this.chaveDeFichas ??= chaveDasFichas(this.identidade);
    return this.chaveDeFichas;
  }

  /** A ficha de dono e o resumo dela para enviar esta mensagem (só os aparelhos aprovados da pessoa fazem). */
  async fichaDoEnvio(l: Lugar): Promise<{ dono: string; ficha: string }> {
    return fichaDoEnvio(await this.fichas(), l);
  }

  /** A ficha de uma mensagem minha (para apagar ou editar) ou da minha reação a uma mensagem (para desfazer). */
  async fichaDe(finalidade: FinalidadeDaFicha, conversa: string, alvo: string): Promise<string> {
    return ficha(await this.fichas(), finalidade, conversa, alvo);
  }

  /** Assina e cifra para enviar, na época atual do grupo da conversa (acertando antes quem entrou e quem saiu). */
  async cifrar(conversa: string, texto: string, contexto: string): Promise<string> {
    if (!this.identidade) throw new BackendError("aparelho_pendente");
    await this.carregar(conversa);
    const identidade = this.identidade;
    return this.mlsDoAparelho().cifrar(conversa, contexto, (epoca) => assinarTexto(identidade, texto, contexto, epoca));
  }

  /**
   * O que o painel aberto faz de tempos em tempos: publica a folha deste aparelho (e repõe os pacotes de chave) e acerta o grupo das
   * conversas em que há aparelho de colega esperando entrar e das abertas nesta página, pondo os aparelhos novos dos colegas (cada um só com o certificado da identidade que este
   * aparelho conhece). Devolve em quantas conversas acertou.
   */
  async repassar(): Promise<number> {
    if (this.estado !== "aprovado" || !this.identidade) return 0;
    const mls = this.mlsDoAparelho();
    await mls.preparar();
    let n = 0;
    const conversas = new Set([...(await mls.pendentes().catch(() => [] as string[])), ...this.estadoDe.keys()]);
    for (const conversa of [...conversas].slice(0, 20)) {
      if (await mls.sincronizar(conversa).catch(() => null)) n++;
    }
    return n;
  }
}

/** Os aparelhos antigos aprovados na migração, por conta, para a tela avisar uma vez. */
const migrados = new Map<string, { id: string; rotulo: string }[]>();
export function aparelhosMigrados(usuario: string): { id: string; rotulo: string }[] {
  const lista = migrados.get(usuario) ?? [];
  migrados.delete(usuario);
  return lista;
}

const abertos = new Map<string, Promise<Chaveiro>>();

/** Um chaveiro por conta, compartilhado por todas as partes do painel. */
export function chaveiroDe(usuario: string): Promise<Chaveiro> {
  let chaveiro = abertos.get(usuario);
  if (!chaveiro) {
    chaveiro = Chaveiro.abrir(usuario);
    chaveiro.catch(() => abertos.delete(usuario));
    abertos.set(usuario, chaveiro);
  }
  return chaveiro;
}

/** Depois de recomeçar a identidade (todos os aparelhos removidos), este aparelho esquece o par antigo e abre de novo como primeiro. */
export async function recomecar(usuario: string): Promise<Chaveiro> {
  await rpc("chat_identidade_redefinir");
  // A loja do MLS deste aparelho sai junto: o aparelho recomeça como novo.
  const antigo = await abertos.get(usuario)?.catch(() => null);
  if (antigo) await antigo.esquecerBiblioteca();
  await esquecer(usuario);
  abertos.delete(usuario);
  return chaveiroDe(usuario);
}

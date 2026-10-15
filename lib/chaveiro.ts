// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O chaveiro deste aparelho: o par de chaves dele (guardado no próprio navegador, em IndexedDB, sem poder ser exportado), a
// identidade da conta (criada no primeiro aparelho e repassada, embrulhada, aos aparelhos aprovados), as identidades que este
// aparelho já conhece dos colegas (para notar quando uma muda) e as chaves das conversas, abertas só na memória enquanto a
// página está aberta. Também repassa chaves para aparelhos de colegas que ainda não as receberam, mas só para aparelhos
// certificados pela identidade da pessoa: o servidor não consegue fazer este aparelho entregar chaves a um aparelho falso.
// A cifra em si mora em lib/sigilo.ts.
import { BackendError, rpc } from "./backend";
import {
  abrirCopia, abrirPedido, abrirTexto, aparelhoCertificado, assinarTexto, type Autoria, certificarAparelho, cifrar, contextoDaIdentidade, contextoDoEmbrulho, type Copia,
  decifrar, deBase64, desembrulhar, desembrulharBytes, embrulhar, embrulharBytes, exportarChave, exportarIdentidade, type Identidade, importarChave, importarIdentidade,
  novaChave, novaIdentidade, novoAparelho, novoCodigo, paraBase64, type Selado, selarCopia, selarPedido, versaoDe,
} from "./sigilo";

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

interface Chaves {
  atual: number | null;
  atual_em: string | null;
  atual_mensagens: number;
  minima: number;
  minhas: { versao: number; embrulho: string; de_publica: string }[];
  aparelhos: { id: string; usuario: string; publica: string; certificado: string | null }[];
  identidades: { usuario: string; nome: string; assina: string | null; versao: number }[];
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

/** A chave de uma conversa é trocada de tempos em tempos, para um aparelho tomado mais tarde não ler o passado inteiro. */
const ROTACAO_DIAS = 7;
const ROTACAO_MENSAGENS = 1000;

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
  /** conversa → versão → chave aberta. */
  private readonly versoes = new Map<string, Map<number, CryptoKey>>();
  private readonly estadoDe = new Map<string, { atual: number | null; atualEm: number; atualMensagens: number; minima: number; aparelhos: Chaves["aparelhos"]; identidades: Chaves["identidades"]; em: number }>();
  private readonly carregando = new Map<string, Promise<void>>();
  private conhecidas = new Map<string, Conhecida>();
  /** Avisos por conversa (identidade de alguém mudou), refeitos a cada carga. */
  private readonly alertas = new Map<string, Alerta[]>();
  private ouvintes = new Set<() => void>();

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
          if (codigo(erro) !== "invalido:publica") throw erro;
          await esquecer(usuario);
          guardado = null;
        }
      }
      if (!guardado) {
        // Aparelho novo: entra pendente, com o pedido selado pelo código. Se a conta ainda não tem identidade, vira o primeiro.
        const par = await novoAparelho();
        const codigoNovo = novoCodigo();
        const registro = await rpc<Registro>("chat_aparelho_registrar", { p_publica: par.publica, p_rotulo: rotulo(), p_pedido: await selarPedido(codigoNovo, usuario, par.publica) });
        guardado = await Chaveiro.acertar({ usuario, id: registro.id, privada: par.privada, publica: par.publica, estado: "pendente", codigo: codigoNovo }, registro);
      }
      await guardar(guardado);
      return new Chaveiro(guardado, conhecidas);
    });
  }

  /** Põe o que o banco disse em dia com o que este aparelho guarda: identidade recebida, migração, pedido novo. */
  private static async acertar(guardado: Guardado, registro: Registro): Promise<Guardado> {
    guardado = { ...guardado, id: registro.id, estado: registro.estado };
    if (registro.estado === "aprovado") {
      guardado.codigo = undefined;
      if (!guardado.identidade && registro.identidade_embrulho && registro.aprovado_publica && registro.identidade?.assina) {
        const secreta = await desembrulharBytes(registro.identidade_embrulho, guardado.privada, registro.aprovado_publica, contextoDaIdentidade(guardado.usuario, registro.id));
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
            p_identidade_embrulho: await embrulharBytes(secreta, guardado.privada, outro.publica, contextoDaIdentidade(guardado.usuario, outro.id)),
          }).catch(() => undefined);
        }
      } finally {
        secreta.fill(0);
      }
      migrados.set(guardado.usuario, resposta.outros.map((outro) => ({ id: outro.id, rotulo: outro.rotulo })));
      return guardado;
    }
    // Pendente sem pedido no banco (ficou de fora da migração, ou o pedido venceu): deixa um pedido novo.
    if (!guardado.codigo) {
      guardado.codigo = novoCodigo();
      await rpc("chat_aparelho_pedir", { p_id: registro.id, p_pedido: await selarPedido(guardado.codigo, guardado.usuario, guardado.publica) }).catch(() => undefined);
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
    this.codigoDePedido = acertado.codigo ?? null;
    if (this.estado === "aprovado") this.avisar();
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
        p_identidade_embrulho: await embrulharBytes(secreta, this.privada, publica, contextoDaIdentidade(this.usuario, aparelho)),
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
    await rpc("chat_aparelho_recuperar", { p_id: this.aparelho, p_assina: identidade.publica, p_certificado: await certificarAparelho(identidade, this.usuario, this.publica) });
    for (const item of copia.chaves) {
      const chave = await importarChave(item.chave);
      if (!chave) continue;
      const abertas = this.versoes.get(item.conversa) ?? new Map<number, CryptoKey>();
      abertas.set(item.versao, chave);
      this.versoes.set(item.conversa, abertas);
    }
    this.identidade = identidade;
    this.estado = "aprovado";
    this.codigoDePedido = null;
    const guardado = await lerGuardado(this.usuario);
    if (guardado) await guardar({ ...guardado, estado: "aprovado", identidade, codigo: undefined });
    this.avisar();
    return true;
  }

  /** Guarda no banco a cópia de recuperação: a identidade e as chaves de conversa que este aparelho conhece, cifradas pela chave de recuperação. */
  async guardarCopia(chaveDeRecuperacao: string): Promise<void> {
    if (!this.identidade) throw new BackendError("aparelho_pendente");
    const secreta = await exportarIdentidade(this.identidade);
    const chaves: Copia["chaves"] = [];
    for (const [conversa, abertas] of this.versoes) for (const [versao, chave] of abertas) chaves.push({ conversa, versao, chave: await exportarChave(chave) });
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

  /** Dos aparelhos de uma conversa, os que este aparelho aceita: certificados pela identidade conhecida de cada pessoa. */
  private async confiaveis(aparelhos: Chaves["aparelhos"]): Promise<Chaves["aparelhos"]> {
    const saida: Chaves["aparelhos"] = [];
    for (const aparelho of aparelhos) {
      const identidade = this.identidadeDe(aparelho.usuario);
      if (!identidade) continue;
      if (await aparelhoCertificado(identidade, aparelho.usuario, aparelho.publica, aparelho.certificado)) saida.push(aparelho);
    }
    return saida;
  }

  // ── Chaves das conversas ──

  /** Busca no banco as chaves desta conversa feitas para este aparelho e abre as que ainda não estão na memória. */
  carregar(conversa: string): Promise<void> {
    const emCurso = this.carregando.get(conversa);
    if (emCurso) return emCurso;
    const trabalho = (async () => {
      const chaves = await rpc<Chaves>("chat_chaves", { p_conversa: conversa, p_aparelho: this.aparelho });
      for (const pessoa of chaves.identidades) await this.aceitarIdentidade(pessoa.usuario, pessoa.assina);
      const abertas = this.versoes.get(conversa) ?? new Map<number, CryptoKey>();
      for (const item of chaves.minhas) {
        if (abertas.has(item.versao)) continue;
        const chave = await desembrulhar(item.embrulho, this.privada, item.de_publica, contextoDoEmbrulho(conversa, item.versao, this.aparelho));
        if (chave) abertas.set(item.versao, chave);
        // Embrulho que não abre (feito errado ou adulterado): devolve, para alguém da conversa repassar de novo.
        else await rpc("chat_chaves_recusar", { p_aparelho: this.aparelho, p_conversa: conversa, p_versao: item.versao }).catch(() => undefined);
      }
      this.versoes.set(conversa, abertas);
      this.estadoDe.set(conversa, {
        atual: chaves.atual,
        atualEm: chaves.atual_em ? new Date(chaves.atual_em).getTime() : 0,
        atualMensagens: chaves.atual_mensagens ?? 0,
        minima: chaves.minima,
        aparelhos: chaves.aparelhos,
        identidades: chaves.identidades,
        em: Date.now(),
      });
      this.refazerAlertas();
    })().finally(() => this.carregando.delete(conversa));
    this.carregando.set(conversa, trabalho);
    return trabalho;
  }

  /** Abre um texto cifrado e confere a assinatura do autor. Se a versão ainda não está na memória, busca no banco (no máximo uma vez a cada dez segundos). */
  async abrir(conversa: string, corpo: string, contexto: string, autor: string | null): Promise<Aberto | null> {
    const versao = versaoDe(corpo);
    if (versao === null) return null;
    let chave = this.versoes.get(conversa)?.get(versao);
    if (!chave && Date.now() - (this.estadoDe.get(conversa)?.em ?? 0) > 10_000) {
      await this.carregar(conversa).catch(() => undefined);
      chave = this.versoes.get(conversa)?.get(versao);
    }
    if (!chave) return null;
    const aberto = await decifrar(chave, corpo, contexto);
    if (aberto === null) return null;
    return abrirTexto(aberto, autor ? this.identidadeDe(autor) : null, contexto, versao);
  }

  /** Assina e cifra para enviar com a versão atual da chave; se este aparelho não a tem (ou se alguém saiu, ou a chave envelheceu), cria a seguinte. */
  async cifrar(conversa: string, texto: string, contexto: string, recarregar = true): Promise<string> {
    if (!this.identidade) throw new BackendError("aparelho_pendente");
    if (recarregar || !this.estadoDe.has(conversa)) await this.carregar(conversa);
    const estado = this.estadoDe.get(conversa)!;
    const atual = estado.atual;
    const chave = atual !== null && atual >= estado.minima ? this.versoes.get(conversa)?.get(atual) : undefined;
    const velha = atual !== null && (Date.now() - estado.atualEm > ROTACAO_DIAS * 86_400_000 || estado.atualMensagens >= ROTACAO_MENSAGENS);
    if (atual !== null && chave && !velha) return cifrar(chave, atual, await assinarTexto(this.identidade, texto, contexto, atual), contexto);
    return this.criarVersao(conversa, Math.max((atual ?? 0) + 1, estado.minima), texto, contexto);
  }

  private async criarVersao(conversa: string, versao: number, texto: string, contexto: string): Promise<string> {
    const chave = await novaChave();
    const aparelhos = await this.confiaveis(this.estadoDe.get(conversa)?.aparelhos ?? []);
    if (!aparelhos.some((aparelho) => aparelho.id === this.aparelho)) throw new BackendError("aparelho_pendente");
    const embrulhos = await Promise.all(
      aparelhos.map(async (aparelho) => ({ para: aparelho.id, embrulho: await embrulhar(chave, this.privada, aparelho.publica, contextoDoEmbrulho(conversa, versao, aparelho.id)) })),
    );
    try {
      await rpc("chat_chave_nova", { p_conversa: conversa, p_aparelho: this.aparelho, p_versao: versao, p_embrulhos: embrulhos });
    } catch (erro) {
      // Outra pessoa criou a mesma versão primeiro: usa a dela.
      if (codigo(erro) === "versao_ocupada") return this.cifrar(conversa, texto, contexto, true);
      throw erro;
    }
    const abertas = this.versoes.get(conversa) ?? new Map<number, CryptoKey>();
    abertas.set(versao, chave);
    this.versoes.set(conversa, abertas);
    const estado = this.estadoDe.get(conversa);
    if (estado) {
      estado.atual = versao;
      estado.atualEm = Date.now();
      estado.atualMensagens = 0;
    }
    return cifrar(chave, versao, await assinarTexto(this.identidade!, texto, contexto, versao), contexto);
  }

  /**
   * Repassa as chaves que este aparelho tem para aparelhos de colegas que ainda não as receberam, só para aparelhos
   * certificados pela identidade que este aparelho conhece da pessoa. Devolve quantas repassou.
   */
  async repassar(): Promise<number> {
    if (this.estado !== "aprovado") return 0;
    const faltam = await rpc<{ conversa: string; versao: number; para: string; usuario: string; publica: string; certificado: string | null }[]>("chat_chaves_pendentes", { p_aparelho: this.aparelho });
    if (faltam.length === 0) return 0;
    for (const conversa of new Set(faltam.map((item) => item.conversa))) await this.carregar(conversa).catch(() => undefined);
    const embrulhos = [];
    for (const item of faltam) {
      const chave = this.versoes.get(item.conversa)?.get(item.versao);
      if (!chave) continue;
      const identidade = this.identidadeDe(item.usuario);
      if (!identidade || !(await aparelhoCertificado(identidade, item.usuario, item.publica, item.certificado))) continue;
      embrulhos.push({ conversa: item.conversa, versao: item.versao, para: item.para, embrulho: await embrulhar(chave, this.privada, item.publica, contextoDoEmbrulho(item.conversa, item.versao, item.para)) });
    }
    if (embrulhos.length === 0) return 0;
    return (await rpc<{ dadas: number }>("chat_chaves_dar", { p_aparelho: this.aparelho, p_embrulhos: embrulhos })).dadas;
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
  await esquecer(usuario);
  abertos.delete(usuario);
  return chaveiroDe(usuario);
}

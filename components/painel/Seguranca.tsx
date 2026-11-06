// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { BellRing, Check, CheckCheck, Copy, KeyRound, LifeBuoy, Plus, RefreshCw, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { getClient, rpc, signOut, type Me } from "@/lib/backend";
import { fingerprintAvailable, listFingerprints, registerFingerprint, removeFingerprint, renameFingerprint, type Passkey } from "@/lib/passkey";
import { Aviso, dataHora, useAcao, useLista } from "./comum";
import { agruparRecados, type RecadoBruto, type RecadoJunto } from "./recados-grupos";
import { Botao, CabecalhoDeSecao, Cartao, Contador, Esqueleto, Faixa, ItemDeLista, Lista, confirmarFrase } from "./ui";

interface Fator {
  id: string;
  status: string;
}

interface Cadastro {
  id: string;
  qr: string;
  segredo: string;
  /** O mesmo conteúdo do QR como endereço otpauth://: tocado no próprio celular, abre o aplicativo autenticador. */
  uri: string;
}

/**
 * Por que o código não passou, dito de um jeito que a pessoa consiga resolver. O serviço de contas diz o motivo em
 * `code` (mfa_verification_failed, mfa_challenge_expired…); sem resposta nenhuma, foi a internet.
 */
function motivoDoErro(erro: unknown): string {
  const falha = (erro ?? {}) as { code?: string; status?: number; name?: string; message?: string };
  const codigo = falha.code ?? "";
  if (codigo === "mfa_verification_failed" || codigo === "invalid_credentials" || /invalid totp/i.test(falha.message ?? "")) {
    return "O código não confere. Cada código vale só 30 segundos: espere aparecer um novo no aplicativo e digite logo. Se continuar errado, confira se a data e a hora do celular estão no automático (nas configurações do celular): com o relógio fora da hora, o aplicativo mostra o código errado. E veja se copiou o código da linha certa do aplicativo.";
  }
  if (codigo === "mfa_challenge_expired") return "O tempo para confirmar acabou. Digite o código que aparece agora no aplicativo e toque em Confirmar de novo.";
  if (codigo === "mfa_factor_not_found") return "Este cadastro do aplicativo não vale mais (demorou demais ou foi aberto em outra aba). Toque em Cancelar e comece de novo.";
  if (codigo === "over_request_rate_limit" || codigo.includes("rate_limit") || falha.status === 429) return "Muitas tentativas seguidas. Espere um minuto e tente de novo com o código que estiver no aplicativo.";
  if (falha.name === "AuthRetryableFetchError" || falha.name === "TypeError" || falha.status === 0) return "Sem conexão com o serviço de contas. Confira a internet e tente de novo.";
  return "Não deu certo. Confira o código e tente de novo.";
}

/** A chave em blocos de quatro letras, como os aplicativos mostram e como é mais fácil de conferir ao digitar. */
const emBlocos = (segredo: string) => segredo.replace(/\s+/g, "").match(/.{1,4}/g) ?? [];

/**
 * A tela de cadastrar o aplicativo autenticador. Quem nunca usou um costuma apontar a câmera comum do celular para o
 * QR: ela lê o quadrado, mas só mostra um texto "otpauth://totp/…" (às vezes no aplicativo de notas). Por isso a tela
 * explica antes do QR que é preciso um aplicativo autenticador e que o quadrado se lê de dentro dele, mostra a chave
 * para quem prefere digitar e pede para não mandar o QR nem a chave para ninguém.
 */
function CadastroDoAplicativo({ cadastro, entrada, pronto, ocupado, aviso, confirmar, cancelar }: { cadastro: Cadastro; entrada: ReactNode; pronto: boolean; ocupado: boolean; aviso: string; confirmar: () => void; cancelar: () => void }) {
  const [ajuda, setAjuda] = useState(false);
  const [copia, setCopia] = useState<"" | "ok" | "falhou">("");
  const blocos = emBlocos(cadastro.segredo);
  // O botão "Cadastrar" some ao abrir esta tela: o foco vem para o começo da explicação, e não se perde no fim da página.
  const inicio = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    inicio.current?.focus();
  }, []);

  async function copiar() {
    const chave = cadastro.segredo.replace(/\s+/g, "");
    let copiou = false;
    try {
      await navigator.clipboard.writeText(chave);
      copiou = true;
    } catch {
      // Navegador sem permissão para a área de transferência: o jeito antigo, por um campo escondido.
      const campo = document.createElement("textarea");
      campo.value = chave;
      campo.setAttribute("readonly", "");
      campo.style.position = "fixed";
      campo.style.opacity = "0";
      document.body.appendChild(campo);
      campo.select();
      try {
        copiou = document.execCommand("copy");
      } catch {
        copiou = false;
      }
      campo.remove();
    }
    setCopia(copiou ? "ok" : "falhou");
    if (copiou) window.setTimeout(() => setCopia(""), 4000);
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <p ref={inicio} tabIndex={-1} className="font-semibold">Você vai precisar do celular com um aplicativo autenticador.</p>
        <p className="pn-ajuda">
          A câmera comum do celular não serve: ela até lê o quadrado, mas mostra só um texto estranho começando com “otpauth://” (às vezes no aplicativo de notas). O quadrado precisa ser lido de dentro do aplicativo autenticador.
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Instale no celular um aplicativo autenticador, pela Play Store ou pela App Store. Todos estes são gratuitos: Google Authenticator, Microsoft Authenticator, 2FAS ou Aegis (só Android). O 2FAS e o Aegis também são de código aberto.
          </li>
          <li>Abra o aplicativo e toque no botão + (em alguns aparece “Adicionar conta” ou “Adicionar código”). No Microsoft Authenticator, escolha “Outra conta”.</li>
          <li>Escolha “Ler código QR” e aponte a câmera que o próprio aplicativo abre para o quadrado abaixo.</li>
          <li>Pronto: o aplicativo passa a mostrar um código de 6 números que muda a cada 30 segundos. Digite esse código no campo do fim desta tela e toque em Confirmar.</li>
        </ol>
      </div>

      <div className="flex flex-wrap items-start gap-4">
        {/* O desenho vem do serviço de contas como imagem embutida; não é carregado de outro site. */}
        {/* O QR fica sobre branco de propósito (é a peça a ser lida pela câmera, não a interface): nos dois fundos ele lê. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cadastro.qr} alt="Código QR para ler com o aplicativo autenticador" width={200} height={200} className="shrink-0 rounded-[var(--pn-raio)] border border-rule bg-white p-2" />
        <div className="grid min-w-0 flex-1 basis-56 gap-2">
          <p className="pn-ajuda">Prefere digitar? No aplicativo, toque em + e escolha “Inserir chave” (ou “Digitar chave de configuração”). Esta é a chave:</p>
          {/* Sem aria-label: em <code> o nome é proibido pelo ARIA e, com translate="no", ficaria em português nos outros idiomas. O parágrafo de cima já apresenta a chave. */}
          <code translate="no" className="flex flex-wrap gap-x-2 gap-y-1 font-mono text-base font-semibold tracking-wider tabular-nums">
            {blocos.map((bloco, indice) => (
              <span key={indice}>{bloco}</span>
            ))}
          </code>
          <p className="flex flex-wrap items-center gap-2">
            <Botao pequeno simbolo={copia === "ok" ? Check : Copy} onClick={() => void copiar()}>
              {copia === "ok" ? "Chave copiada" : "Copiar a chave"}
            </Botao>
            <span role="status" className="pn-ajuda">
              {copia === "ok" && "Cole só no aplicativo autenticador."}
              {copia === "falhou" && "Não deu para copiar: digite a chave olhando a tela."}
            </span>
          </p>
          <p>
            <button type="button" aria-expanded={ajuda} aria-controls="segundo-fator-ajuda" onClick={() => setAjuda((valor) => !valor)} className="cursor-pointer text-sm underline underline-offset-2 hover:text-oxblood">
              Não consigo ler o QR
            </button>
          </p>
        </div>
      </div>

      {ajuda && (
        <Cartao as="div" id="segundo-fator-ajuda" variante="plano" className="grid gap-2 text-sm">
          <p className="font-semibold">Se o QR não for lido</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Abra a câmera de dentro do aplicativo autenticador (botão +, depois “Ler código QR”), não a câmera comum do celular.</li>
            <li>Aumente o brilho da tela do computador e aproxime ou afaste o celular devagar, até o quadrado caber inteiro na moldura.</li>
            <li>Ainda não deu? Digite a chave à mão: no aplicativo, toque em +, escolha “Inserir chave” (ou “Digitar chave de configuração”, “Inserir manualmente”), escreva “Instituto Lúcia” no nome da conta e a chave acima no campo da chave. Se o aplicativo perguntar o tipo, escolha “Baseado em tempo”.</li>
            {cadastro.uri && (
              <li>
                Esta tela está aberta no próprio celular?{" "}
                <a href={cadastro.uri} className="underline underline-offset-2 hover:text-oxblood">
                  Toque aqui para abrir no aplicativo autenticador
                </a>{" "}
                (ele precisa estar instalado).
              </li>
            )}
          </ul>
        </Cartao>
      )}

      <Faixa tom="aviso" titulo="Não mande o QR nem a chave para ninguém">
        <p>Nada de print, foto ou cópia, nem para a coordenação: quem tiver o QR ou a chave consegue gerar os seus códigos. A coordenação nunca pede isso.</p>
      </Faixa>

      {/* Formulário para o Enter do teclado confirmar o código, como na tela de entrar. */}
      <form
        className="grid gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (pronto && !ocupado) confirmar();
        }}
      >
        <p className="pn-rotulo">Código de 6 números que aparece no aplicativo</p>
        <div className="flex flex-wrap items-end gap-3">
          {entrada}
          <Botao type="submit" variante="principal" carregando={ocupado} disabled={!pronto}>
            Confirmar
          </Botao>
          <Botao variante="discreto" onClick={cancelar}>
            Cancelar
          </Botao>
        </div>
      </form>
      <Aviso texto={aviso} />
    </div>
  );
}

/**
 * Segundo fator: além da senha (ou do link no e-mail), um código de seis números que muda a cada
 * trinta segundos em um aplicativo no celular da pessoa. Quem rouba a senha não entra sem o celular.
 */
export function SegundoFator({ me, recarregar }: { me: Me; recarregar: () => void }) {
  const [fatores, setFatores] = useState<Fator[] | null>(null);
  const [cadastro, setCadastro] = useState<Cadastro | null>(null);
  const [codigo, setCodigo] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  /** Trocando de aplicativo: o antigo só sai depois que o novo for confirmado. */
  const [trocando, setTrocando] = useState<string | null>(null);
  const [desligando, setDesligando] = useState(false);
  const [recuperando, setRecuperando] = useState(false);
  const [codigoDeRecuperacao, setCodigoDeRecuperacao] = useState("");

  const [volta, setVolta] = useState(0);
  const carregar = () => setVolta((valor) => valor + 1);

  useEffect(() => {
    let cancelado = false;
    getClient()
      .then((supabase) => supabase.auth.mfa.listFactors())
      .then(({ data, error }) => {
        if (cancelado) return;
        setFatores(error ? [] : (data?.all ?? []).filter((fator) => fator.factor_type === "totp").map((fator) => ({ id: fator.id, status: fator.status })));
      })
      .catch(() => {
        if (!cancelado) setFatores([]);
      });
    return () => {
      cancelado = true;
    };
  }, [volta]);

  const confirmado = fatores?.find((fator) => fator.status === "verified") ?? null;

  async function trabalhar(tarefa: () => Promise<void>) {
    setOcupado(true);
    setAviso("");
    try {
      await tarefa();
    } catch (erro) {
      setAviso(motivoDoErro(erro));
    } finally {
      setOcupado(false);
    }
  }

  const comecar = () =>
    trabalhar(async () => {
      const supabase = await getClient();
      // Tentativas antigas que ficaram pela metade são descartadas antes de começar outra.
      for (const fator of fatores ?? []) if (fator.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: fator.id });
      setTrocando((fatores ?? []).find((fator) => fator.status === "verified")?.id ?? null);
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Instituto Lúcia ${Date.now()}` });
      if (error || !data) throw error ?? new Error("falha");
      setCadastro({ id: data.id, qr: data.totp.qr_code, segredo: data.totp.secret, uri: data.totp.uri ?? "" });
      setCodigo("");
    });

  const confirmar = (fator: string) =>
    trabalhar(async () => {
      const supabase = await getClient();
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: fator, code: codigo.replace(/\D/g, "") });
      if (error) throw error;
      const novo = Boolean(cadastro);
      setCadastro(null);
      setCodigo("");
      if (novo && trocando) {
        // O novo aplicativo já confirmou: o antigo sai da conta.
        await supabase.auth.mfa.unenroll({ factorId: trocando }).catch(() => null);
        setTrocando(null);
      }
      if (novo) await rpc("conta_evento", { p_acao: "segundo_fator_ativado" }).catch(() => null);
      setAviso(novo ? "Aplicativo autenticador ligado ✓ Agora gere os códigos de recuperação." : "Código confirmado ✓");
      carregar();
      recarregar();
    });

  const remover = (fator: string) =>
    trabalhar(async () => {
      const supabase = await getClient();
      // Desligar pede o código do aplicativo de novo: quem pegou o aparelho com a sessão aberta não desliga sozinho.
      const conferido = await supabase.auth.mfa.challengeAndVerify({ factorId: fator, code: codigo.replace(/\D/g, "") });
      if (conferido.error) throw conferido.error;
      const { error } = await supabase.auth.mfa.unenroll({ factorId: fator });
      if (error) throw error;
      setCodigo("");
      setDesligando(false);
      await rpc("conta_evento", { p_acao: "segundo_fator_removido" }).catch(() => null);
      setAviso("Aplicativo autenticador removido desta conta.");
      carregar();
      recarregar();
    });

  const entrada = (
    <input
      value={codigo}
      onChange={(e) => setCodigo(e.target.value)}
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={7}
      placeholder="000000"
      aria-label="Código de seis números do aplicativo autenticador"
      className="pn-campo mt-1 max-w-40 text-center font-mono text-xl tracking-widest tabular-nums"
    />
  );
  const pronto = codigo.replace(/\D/g, "").length === 6;

  if (fatores === null) return <Esqueleto linhas={2} rotulo="Carregando…" />;

  if (cadastro) {
    return (
      <CadastroDoAplicativo
        cadastro={cadastro}
        entrada={entrada}
        pronto={pronto}
        ocupado={ocupado}
        aviso={aviso}
        confirmar={() => confirmar(cadastro.id)}
        cancelar={() => { setCadastro(null); setTrocando(null); setAviso(""); }}
      />
    );
  }

  if (!confirmado) {
    return (
      <div>
        <p className="pn-ajuda">Esta conta ainda não tem aplicativo autenticador. Leva dois minutos e protege a conta mesmo que a senha ou o e-mail vazem.</p>
        <p className="pn-ajuda mt-1">Tenha o celular à mão: no próximo passo você instala um aplicativo autenticador (Google Authenticator, Microsoft Authenticator, 2FAS ou Aegis) e lê um código QR com ele.</p>
        <p className="mt-3">
          <Botao variante="principal" simbolo={ShieldCheck} carregando={ocupado} onClick={comecar}>
            Cadastrar aplicativo autenticador
          </Botao>
        </p>
        <Aviso texto={aviso} />
      </div>
    );
  }

  if (!me.segundo_fator) {
    return (
      <div>
        <p className="pn-ajuda">Digite o código de seis números do seu aplicativo autenticador para confirmar esta sessão.</p>
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (pronto && !ocupado) void confirmar(confirmado.id);
          }}
        >
          {entrada}
          <Botao type="submit" variante="principal" carregando={ocupado} disabled={!pronto}>
            Confirmar
          </Botao>
        </form>
        <Aviso texto={aviso} />
        {recuperando ? (
          <form
            className="mt-3 border-t border-rule pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              void trabalhar(async () => {
                const r = await rpc<{ ok: boolean; restantes?: number }>("conta_codigo_usar", { p_codigo: codigoDeRecuperacao });
                if (!r.ok) {
                  setAviso("Esse código não vale (errado ou já usado). Confira e tente de novo; são cinco tentativas por hora.");
                  return;
                }
                setCodigoDeRecuperacao("");
                setRecuperando(false);
                setAviso(`Aplicativo removido da conta. Cadastre o aplicativo no celular novo agora. Restam ${r.restantes ?? 0} códigos.`);
                carregar();
                recarregar();
              });
            }}
          >
            <label className="pn-rotulo block">
              Código de recuperação (XXXXX-XXXXX)
              <input value={codigoDeRecuperacao} onChange={(e) => setCodigoDeRecuperacao(e.target.value)} autoComplete="off" spellCheck={false} maxLength={14} className="pn-campo mt-1 max-w-56 font-mono uppercase tracking-widest" />
            </label>
            <p className="mt-2"><Botao type="submit" simbolo={KeyRound} disabled={ocupado || codigoDeRecuperacao.replace(/[^0-9a-f]/gi, "").length !== 10}>Usar o código</Botao></p>
          </form>
        ) : (
          <p className="mt-2"><Botao variante="discreto" pequeno simbolo={LifeBuoy} onClick={() => setRecuperando(true)}>Perdi o celular: usar um código de recuperação</Botao></p>
        )}
      </div>
    );
  }

  return (
    <div>
      <p>Aplicativo autenticador cadastrado e confirmado nesta sessão.</p>
      <p className="mt-2 flex flex-wrap gap-2">
        <Botao variante="discreto" pequeno simbolo={RefreshCw} disabled={ocupado} onClick={comecar}>Trocar de aplicativo ou de celular</Botao>
        {!me.exige_segundo_fator && !desligando && (
          <Botao variante="discreto" pequeno perigo simbolo={ShieldOff} disabled={ocupado} onClick={() => setDesligando(true)}>
            Desligar o segundo fator
          </Botao>
        )}
      </p>
      {me.exige_segundo_fator && <p className="pn-ajuda mt-1">A sua função exige o segundo fator: dá para trocar de aplicativo, mas não desligar.</p>}
      {desligando && (
        <div className="mt-3 rounded-[var(--pn-raio)] border border-oxblood p-3">
          <p className="text-sm">Desligar deixa a conta protegida só pela senha. Para confirmar, digite o código atual do aplicativo.</p>
          <div className="mt-2 flex flex-wrap items-end gap-3">
            {entrada}
            <Botao perigo simbolo={ShieldOff} carregando={ocupado} disabled={!pronto} onClick={() => remover(confirmado.id)}>Desligar</Botao>
            <Botao variante="discreto" onClick={() => { setDesligando(false); setCodigo(""); }}>Cancelar</Botao>
          </div>
        </div>
      )}
      <Aviso texto={aviso} />
    </div>
  );
}

/**
 * Entrada pela digital: o aparelho guarda uma chave que só libera com o dedo, e a pessoa entra sem digitar a senha.
 * A senha continua valendo (é o caminho de volta se o celular for trocado ou perdido), e quem tem aplicativo
 * autenticador continua devendo o código depois da digital.
 */
export function Digital() {
  const [chaves, setChaves] = useState<Passkey[] | null>(null);
  const [tem, setTem] = useState<boolean | null>(null);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [volta, setVolta] = useState(0);

  useEffect(() => {
    let cancelado = false;
    void fingerprintAvailable().then((valor) => {
      if (!cancelado) setTem(valor);
    });
    listFingerprints()
      .then((lista) => {
        if (!cancelado) setChaves(lista);
      })
      .catch(() => {
        if (!cancelado) setChaves([]);
      });
    return () => {
      cancelado = true;
    };
  }, [volta]);

  async function cadastrar() {
    setOcupado(true);
    setAviso("");
    const { outcome, detail } = await registerFingerprint();
    setOcupado(false);
    if (outcome === "ok") {
      setAviso("Chave de acesso cadastrada ✓ Na próxima vez, toque em “Entrar com a digital”.");
      await rpc("conta_evento", { p_acao: "chave_acesso_cadastrada" }).catch(() => null);
    }
    else if (outcome === "cancelled") setAviso("Cadastro cancelado. Nada foi gravado.");
    else if (outcome === "exists") setAviso("Este aparelho já está cadastrado nesta conta.");
    else if (outcome === "unsupported") setAviso("Este aparelho não oferece entrada pela digital.");
    else setAviso(`Não deu certo cadastrar a digital.${detail ? ` (${detail})` : ""}`);
    setVolta((valor) => valor + 1);
  }

  async function remover(id: string) {
    setOcupado(true);
    setAviso("");
    try {
      await removeFingerprint(id);
      setAviso("Chave removida: esse aparelho não abre mais esta conta sem senha.");
      await rpc("conta_evento", { p_acao: "chave_acesso_removida" }).catch(() => null);
    } catch {
      setAviso("Não deu certo remover. Tente de novo.");
    } finally {
      setOcupado(false);
      setVolta((valor) => valor + 1);
    }
  }

  if (chaves === null || tem === null) return <Esqueleto linhas={2} rotulo="Carregando…" />;

  return (
    <div>
      {chaves.length > 0 && (
        <ul aria-label="Chaves de acesso" className="pn-lista">
          {chaves.map((chave) => (
            <li key={chave.id} className="pn-item flex-wrap">
              <span className="min-w-0 flex-1">
                <input
                  defaultValue={chave.nome || "Aparelho"}
                  aria-label="Nome desta chave de acesso"
                  maxLength={60}
                  onBlur={(e) => {
                    const nome = e.target.value.trim();
                    if (nome && nome !== chave.nome) void renameFingerprint(chave.id, nome).then(() => setAviso("Nome guardado ✓"), () => setAviso("Não deu para guardar o nome."));
                  }}
                  className="pn-campo max-w-64 font-semibold"
                />
                <span className="pn-item-meta block tabular-nums">
                  Cadastrada em {dataHora(chave.criada)}
                  {chave.usada && ` · usada em ${dataHora(chave.usada)}`}
                </span>
              </span>
              <Botao variante="discreto" pequeno perigo simbolo={Trash2} disabled={ocupado} onClick={async () => { if ((await confirmarFrase(`Remover a chave “${chave.nome || "Aparelho"}”? Esse aparelho vai precisar da senha para entrar.`))) void remover(chave.id); }}>
                Remover
              </Botao>
            </li>
          ))}
        </ul>
      )}
      {chaves.length === 0 && <p className="pn-ajuda">Nenhuma chave de acesso cadastrada ainda.</p>}
      {tem ? (
        <p className="mt-3">
          <Botao simbolo={Plus} carregando={ocupado} onClick={cadastrar}>
            Cadastrar uma chave de acesso neste aparelho
          </Botao>
        </p>
      ) : (
        <p className="pn-ajuda mt-3">Este aparelho não tem leitor de digital configurado (ou o navegador não oferece o recurso). Abra o painel no celular para cadastrar.</p>
      )}
      <Aviso texto={aviso} />
    </div>
  );
}

interface Aparelho {
  marca: string;
  rotulo: string;
  primeiro: string;
  ultimo: string;
}

/** Onde a conta já foi aberta. Aparelho que a pessoa não reconhece é sinal para sair de todos e avisar a coordenação. */
export function Aparelhos() {
  const lista = useLista<Aparelho[]>("aparelhos_meus");
  const acao = useAcao(lista.recarregar);
  return (
    <div className="grid gap-3">
      {lista.dados && lista.dados.length > 0 && (
        <Lista rotulo="Aparelhos">
          {lista.dados.map((aparelho) => (
            <ItemDeLista
              key={aparelho.marca}
              titulo={aparelho.rotulo || "Navegador"}
              meta={<span className="tabular-nums">primeira vez em {dataHora(aparelho.primeiro)} · última em {dataHora(aparelho.ultimo)}</span>}
              acoes={
                <Botao variante="discreto" pequeno onClick={() => acao.agir("aparelho_esquecer", { p_marca: aparelho.marca }, "Aparelho esquecido: se a conta for aberta nele de novo, você será avisado.")}>
                  Esquecer
                </Botao>
              }
            />
          ))}
        </Lista>
      )}
      {lista.dados?.length === 0 && <p className="pn-ajuda">Nenhum aparelho registrado ainda.</p>}
      <p>
        <Botao
          onClick={async () => {
            try {
              const supabase = await getClient();
              await supabase.auth.signOut({ scope: "global" });
            } finally {
              await signOut();
            }
          }}
        >
          Sair de todos os aparelhos
        </Botao>
      </p>
      <Aviso texto={lista.erro || acao.aviso} />
    </div>
  );
}

type Recado = RecadoBruto;

/** Quantos recados cada grupo mostra antes do "ver mais" (na Mesa). */
const RECADOS_POR_GRUPO = 3;

/** Uma linha de recado: o texto em primeiro lugar, a data e as repetições embaixo, em tom menor. */
function LinhaDeRecado({ r }: { r: RecadoJunto }) {
  return (
    <li className={`border-b border-l-2 border-b-rule px-3.5 py-2 last:border-b-0 ${r.novo ? "border-l-oxblood" : "border-l-transparent text-ink-soft"}`}>
      <p className="text-[0.9rem] leading-snug">
        {r.novo && <span className="sr-only">Novo: </span>}
        {r.texto}
      </p>
      <p className="pn-rotulo-mono mt-0.5 tabular-nums">
        {dataHora(r.em)}
        {r.vezes > 1 && ` · ${r.vezes} vezes`}
      </p>
    </li>
  );
}

/**
 * Os recados dentro da Mesa (T27): sem título próprio (a parte "Recados" da Mesa já tem), em grupos por assunto, cada um
 * com o nome e o número de novos; o que não foi lido vem antes, os iguais juntos, e o resto atrás de um "ver mais".
 * Sem nada novo, os já lidos ficam recolhidos, para a lateral da Mesa ficar limpa.
 */
function RecadosNaMesa({ dados, novos, ocupado, marcarTudo }: { dados: Recado[]; novos: number; ocupado: boolean; marcarTudo: () => void }) {
  if (dados.length === 0) return <p className="pn-ajuda">Nenhum recado por aqui. Quando a equipe ou o painel avisarem algo, aparece aqui.</p>;
  const grupos = agruparRecados(dados);
  const blocos = grupos.map((g) => (
    <section key={g.grupo} aria-labelledby={`recados-${g.grupo}`} className="grid gap-1.5">
      <h3 id={`recados-${g.grupo}`} className="pn-rotulo-mono inline-flex items-center gap-2">
        {g.nome} <Contador n={g.novos} rotulo="sem ler" />
      </h3>
      <Cartao as="div" className="!p-0">
        <ul className="grid">
          {g.itens.slice(0, RECADOS_POR_GRUPO).map((r) => (
            <LinhaDeRecado key={r.id} r={r} />
          ))}
        </ul>
        {g.itens.length > RECADOS_POR_GRUPO && (
          <details className="border-t border-rule">
            <summary className="cursor-pointer px-3.5 py-1.5 text-[0.85rem] text-ink-soft">Ver mais {g.itens.length - RECADOS_POR_GRUPO}</summary>
            <ul className="grid border-t border-rule">
              {g.itens.slice(RECADOS_POR_GRUPO).map((r) => (
                <LinhaDeRecado key={r.id} r={r} />
              ))}
            </ul>
          </details>
        )}
      </Cartao>
    </section>
  ));
  return (
    <div className="grid gap-3" data-recados-agrupados="">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="pn-ajuda">{novos === 0 ? "Nada novo. Os recados já lidos ficam guardados aqui." : novos === 1 ? "1 recado sem ler." : `${novos} recados sem ler.`}</p>
        {novos > 0 && (
          <Botao variante="discreto" pequeno simbolo={CheckCheck} disabled={ocupado} onClick={marcarTudo}>
            Marcar tudo como lido
          </Botao>
        )}
      </div>
      {novos > 0 ? (
        blocos
      ) : (
        <details className="grid gap-3">
          <summary className="cursor-pointer text-[0.9rem] font-semibold">Ver os recados já lidos</summary>
          <div className="mt-2 grid gap-3">{blocos}</div>
        </details>
      )}
    </div>
  );
}

/**
 * Recados do painel: papel recebido, contribuição decidida, conta aberta em aparelho novo. O título mantém o id "recados".
 * Com `naMesa` (T27), sem título próprio e em grupos (RecadosNaMesa); sem, a lista de sempre.
 */
export function Recados({ recarregar, naMesa = false }: { recarregar: () => void; naMesa?: boolean }) {
  const lista = useLista<Recado[]>("avisos_meus");
  const acao = useAcao(() => {
    lista.recarregar();
    recarregar();
  });
  const novos = lista.dados?.filter((recado) => !recado.lido) ?? [];
  if (naMesa) {
    if (!lista.dados) return lista.erro ? <Aviso texto={lista.erro} /> : <Esqueleto forma="fila" linhas={2} rotulo="Carregando os recados…" />;
    return <RecadosNaMesa dados={lista.dados} novos={novos.length} ocupado={acao.ocupado} marcarTudo={() => acao.agir("aviso_ler", { p_id: null }, "")} />;
  }
  if (!lista.dados || lista.dados.length === 0) return null;
  return (
    <section aria-labelledby="recados" className="grid gap-3">
      <CabecalhoDeSecao
        nivel={2}
        id="recados"
        simbolo={BellRing}
        titulo={
          <span className="inline-flex flex-wrap items-center gap-2">
            Recados {novos.length > 0 && <Contador n={novos.length} rotulo="sem ler" />}
          </span>
        }
        acoes={
          novos.length > 0 && (
            <Botao variante="discreto" pequeno simbolo={CheckCheck} disabled={acao.ocupado} onClick={() => acao.agir("aviso_ler", { p_id: null }, "")}>
              Marcar tudo como lido
            </Botao>
          )
        }
      />
      <Cartao as="div" className="!p-0">
        <ul className="grid">
          {lista.dados.slice(0, novos.length > 0 ? 40 : 5).map((recado) => (
            <li key={recado.id} className={`border-b border-l-2 border-b-rule px-4 py-2.5 last:border-b-0 ${recado.lido ? "border-l-transparent text-ink-soft" : "border-l-oxblood"}`}>
              <span className="pn-rotulo-mono tabular-nums">{dataHora(recado.criado_em)}</span>
              <p>{recado.texto}</p>
            </li>
          ))}
        </ul>
      </Cartao>
    </section>
  );
}
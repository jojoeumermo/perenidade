// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { BellRing, CheckCheck, KeyRound, LifeBuoy, Plus, RefreshCw, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getClient, rpc, signOut, type Me } from "@/lib/backend";
import { fingerprintAvailable, listFingerprints, registerFingerprint, removeFingerprint, renameFingerprint, type Passkey } from "@/lib/passkey";
import { Aviso, dataHora, useAcao, useLista } from "./comum";
import { Botao, CabecalhoDeSecao, Cartao, Contador, Esqueleto, ItemDeLista, Lista, confirmarFrase } from "./ui";

interface Fator {
  id: string;
  status: string;
}

interface Cadastro {
  id: string;
  qr: string;
  segredo: string;
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
    } catch {
      setAviso("Não deu certo. Confira o código e tente de novo.");
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
      setCadastro({ id: data.id, qr: data.totp.qr_code, segredo: data.totp.secret });
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
      <div className="grid gap-3">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Instale no celular um aplicativo autenticador. Sugestões gratuitas e de código aberto: Aegis (Android) ou 2FAS (Android e iPhone).</li>
          <li>No aplicativo, toque em adicionar conta e aponte a câmera para o quadrado abaixo.</li>
          <li>Digite aqui o código de seis números que o aplicativo mostrar.</li>
        </ol>
        {/* O desenho vem do serviço de contas como imagem embutida; não é carregado de outro site. */}
        {/* O QR fica sobre branco de propósito (é a peça a ser lida pela câmera, não a interface): nos dois fundos ele lê. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cadastro.qr} alt="Código para o aplicativo autenticador" width={200} height={200} className="rounded-[var(--pn-raio)] border border-rule bg-white p-2" />
        <p className="pn-ajuda">
          Sem câmera? Digite esta chave no aplicativo: <code className="break-all font-mono">{cadastro.segredo}</code>
        </p>
        <div className="flex flex-wrap items-end gap-3">
          {entrada}
          <Botao variante="principal" carregando={ocupado} disabled={!pronto} onClick={() => confirmar(cadastro.id)}>
            Confirmar
          </Botao>
          <Botao variante="discreto" onClick={() => { setCadastro(null); setTrocando(null); }}>
            Cancelar
          </Botao>
        </div>
        <Aviso texto={aviso} />
      </div>
    );
  }

  if (!confirmado) {
    return (
      <div>
        <p className="pn-ajuda">Esta conta ainda não tem aplicativo autenticador. Leva dois minutos e protege a conta mesmo que a senha ou o e-mail vazem.</p>
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
        <div className="mt-3 flex flex-wrap items-end gap-3">
          {entrada}
          <Botao variante="principal" carregando={ocupado} disabled={!pronto} onClick={() => confirmar(confirmado.id)}>
            Confirmar
          </Botao>
        </div>
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

interface Recado {
  id: string;
  texto: string;
  lido: boolean;
  criado_em: string;
}

/** Recados do painel: papel recebido, contribuição decidida, conta aberta em aparelho novo. O título mantém o id "recados". */
export function Recados({ recarregar }: { recarregar: () => void }) {
  const lista = useLista<Recado[]>("avisos_meus");
  const acao = useAcao(() => {
    lista.recarregar();
    recarregar();
  });
  const novos = lista.dados?.filter((recado) => !recado.lido) ?? [];
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
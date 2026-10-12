// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { getClient, signOut, type Me } from "@/lib/backend";
import { fingerprintAvailable, listFingerprints, registerFingerprint, removeFingerprint, type Passkey } from "@/lib/passkey";
import { Aviso, botao, botaoClaro, campo, dataHora, elo, rotulo, useAcao, useLista } from "./comum";

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
      setCadastro(null);
      setCodigo("");
      setAviso("Código confirmado.");
      carregar();
      recarregar();
    });

  const remover = (fator: string) =>
    trabalhar(async () => {
      const supabase = await getClient();
      const { error } = await supabase.auth.mfa.unenroll({ factorId: fator });
      if (error) throw error;
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
      className={`${campo} max-w-40 text-center font-mono text-xl tracking-widest`}
    />
  );
  const pronto = codigo.replace(/\D/g, "").length === 6;

  if (fatores === null) return <p className="font-mono text-xs text-ink-soft">Carregando…</p>;

  if (cadastro) {
    return (
      <div className="space-y-3">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Instale no celular um aplicativo autenticador. Sugestões gratuitas e de código aberto: Aegis (Android) ou 2FAS (Android e iPhone).</li>
          <li>No aplicativo, toque em adicionar conta e aponte a câmera para o quadrado abaixo.</li>
          <li>Digite aqui o código de seis números que o aplicativo mostrar.</li>
        </ol>
        {/* O desenho vem do serviço de contas como imagem embutida; não é carregado de outro site. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cadastro.qr} alt="Código para o aplicativo autenticador" width={200} height={200} className="border border-rule bg-white p-2" />
        <p className="text-ink-soft">
          Sem câmera? Digite esta chave no aplicativo: <code className="break-all font-mono">{cadastro.segredo}</code>
        </p>
        <div className="flex flex-wrap items-end gap-3">
          {entrada}
          <button type="button" className={botao} disabled={ocupado || !pronto} onClick={() => confirmar(cadastro.id)}>
            Confirmar
          </button>
          <button type="button" className={elo} onClick={() => setCadastro(null)}>
            Cancelar
          </button>
        </div>
        <Aviso texto={aviso} />
      </div>
    );
  }

  if (!confirmado) {
    return (
      <div>
        <p className="text-ink-soft">Esta conta ainda não tem aplicativo autenticador. Leva dois minutos e protege a conta mesmo que a senha ou o e-mail vazem.</p>
        <button type="button" className={`mt-3 ${botao}`} disabled={ocupado} onClick={comecar}>
          Cadastrar aplicativo autenticador
        </button>
        <Aviso texto={aviso} />
      </div>
    );
  }

  if (!me.segundo_fator) {
    return (
      <div>
        <p className="text-ink-soft">Digite o código de seis números do seu aplicativo autenticador para confirmar esta sessão.</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          {entrada}
          <button type="button" className={botao} disabled={ocupado || !pronto} onClick={() => confirmar(confirmado.id)}>
            Confirmar
          </button>
        </div>
        <Aviso texto={aviso} />
      </div>
    );
  }

  return (
    <div>
      <p>Aplicativo autenticador cadastrado e confirmado nesta sessão.</p>
      {!me.exige_segundo_fator && (
        <button type="button" className={`mt-2 ${elo}`} disabled={ocupado} onClick={() => remover(confirmado.id)}>
          Remover o aplicativo autenticador desta conta
        </button>
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
    if (outcome === "ok") setAviso("Digital cadastrada. Na próxima vez, toque em “Entrar com a digital”.");
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
      setAviso("Aparelho removido: a digital dele não abre mais esta conta.");
    } catch {
      setAviso("Não deu certo remover. Tente de novo.");
    } finally {
      setOcupado(false);
      setVolta((valor) => valor + 1);
    }
  }

  if (chaves === null || tem === null) return <p className="font-mono text-xs text-ink-soft">Carregando…</p>;

  return (
    <div>
      {chaves.length > 0 && (
        <ul className="divide-y divide-rule border-y border-rule">
          {chaves.map((chave) => (
            <li key={chave.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
              <span>
                {chave.nome || "Aparelho"}{" "}
                <span className="text-ink-soft">
                  · cadastrado em {dataHora(chave.criada)}
                  {chave.usada && ` · usado em ${dataHora(chave.usada)}`}
                </span>
              </span>
              <button type="button" className={elo} disabled={ocupado} onClick={() => remover(chave.id)}>
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
      {chaves.length === 0 && <p className="text-ink-soft">Nenhum aparelho cadastrado ainda.</p>}
      {tem ? (
        <button type="button" className={`mt-3 ${botao}`} disabled={ocupado} onClick={cadastrar}>
          Cadastrar a digital deste aparelho
        </button>
      ) : (
        <p className="mt-3 text-ink-soft">Este aparelho não tem leitor de digital configurado (ou o navegador não oferece o recurso). Abra o painel no celular para cadastrar.</p>
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
    <div>
      <ul className="divide-y divide-rule border-y border-rule">
        {lista.dados?.map((aparelho) => (
          <li key={aparelho.marca} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
            <span>
              {aparelho.rotulo || "Navegador"} <span className="text-ink-soft">· primeira vez em {dataHora(aparelho.primeiro)} · última em {dataHora(aparelho.ultimo)}</span>
            </span>
            <button type="button" className={elo} onClick={() => acao.agir("aparelho_esquecer", { p_marca: aparelho.marca }, "Aparelho esquecido: se a conta for aberta nele de novo, você será avisado.")}>
              Esquecer
            </button>
          </li>
        ))}
      </ul>
      {lista.dados?.length === 0 && <p className="text-ink-soft">Nenhum aparelho registrado ainda.</p>}
      <button
        type="button"
        className={`mt-3 ${botaoClaro}`}
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
      </button>
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

/** Recados do painel: papel recebido, contribuição decidida, conta aberta em aparelho novo. */
export function Recados({ recarregar }: { recarregar: () => void }) {
  const lista = useLista<Recado[]>("avisos_meus");
  const acao = useAcao(() => {
    lista.recarregar();
    recarregar();
  });
  const novos = lista.dados?.filter((recado) => !recado.lido) ?? [];
  if (!lista.dados || lista.dados.length === 0) return null;
  return (
    <section aria-labelledby="recados">
      <h2 id="recados" className="font-serif text-2xl font-semibold">
        Recados {novos.length > 0 && <span className="font-sans text-sm text-oxblood">({novos.length} sem ler)</span>}
      </h2>
      <ul className="mt-3 space-y-2">
        {lista.dados.slice(0, novos.length > 0 ? 40 : 5).map((recado) => (
          <li key={recado.id} className={`border-l-2 pl-3 ${recado.lido ? "border-rule text-ink-soft" : "border-oxblood"}`}>
            <span className={rotulo}>{dataHora(recado.criado_em)}</span>
            <p>{recado.texto}</p>
          </li>
        ))}
      </ul>
      {novos.length > 0 && (
        <button type="button" className={`mt-3 ${elo}`} disabled={acao.ocupado} onClick={() => acao.agir("aviso_ler", { p_id: null }, "")}>
          Marcar tudo como lido
        </button>
      )}
    </section>
  );
}

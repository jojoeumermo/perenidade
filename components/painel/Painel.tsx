// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { areaSlugs } from "@/lib/areas";
import { can, hasBackend, rpc, signOut, useMe, type Me, type Role } from "@/lib/backend";
import { L, useI18n } from "../I18n";
import { Aviso, botao, botaoClaro, campo, data, elo, papeis, rotulo, situacoes, textoDoErro, useAcao, useLista } from "./comum";
import { Apoiadores, Comunidade, RadioAdmin } from "./Cuidar";
import { Escrever } from "./Escrever";
import { Fila } from "./Fila";
import { Pessoas } from "./Pessoas";

interface Resumo {
  fila: number;
  aguardando_publicacao: number;
  candidaturas: number;
  denuncias: number;
  anotacoes: number;
  minhas: number;
}

/** Mesa de trabalho de quem faz o instituto. O que cada pessoa vê depende dos papéis que recebeu. */
export function Painel() {
  const me = useMe();
  const params = useSearchParams();
  const router = useRouter();
  const { lang } = useI18n();

  if (!hasBackend) return <p className="mt-8 text-lg text-ink-soft">O painel ainda não foi ligado neste endereço.</p>;
  if (me.status === "loading") return <p className="mt-8 font-mono text-xs text-ink-soft">Carregando…</p>;
  if (me.status === "out") {
    return (
      <p className="mt-8 text-lg">
        Para usar o painel, <L href="/entrar" className={elo}>entre com a sua conta</L>.
      </p>
    );
  }

  const eu = me.me;
  const voluntario = eu.papeis.length > 0;
  const abas: [string, string, boolean][] = [
    ["inicio", "Início", true],
    ["escrever", "Escrever", true],
    ["minhas", "Minhas contribuições", true],
    ["fila", "Fila de revisão", voluntario],
    ["comunidade", "Comunidade", can(eu, "coordenacao", "curadoria", "educacao")],
    ["pessoas", "Voluntários", can(eu, "coordenacao")],
    ["apoiadores", "Apoiadores", can(eu, "coordenacao")],
    ["radio", "Rádio", can(eu, "coordenacao")],
  ];
  const visiveis = abas.filter(([, , mostra]) => mostra);
  const pedida = params.get("aba") ?? "inicio";
  const aba = visiveis.some(([id]) => id === pedida) ? pedida : "inicio";
  const ir = (id: string) => router.replace(`/${lang}/painel?aba=${id}`);

  return (
    <div className="mt-8 font-sans text-sm">
      {eu.suspenso && <p className="mb-6 border-l-2 border-oxblood pl-4 text-oxblood">Esta conta está suspensa: você pode ler, mas não enviar.</p>}
      <nav aria-label="Seções do painel" className="flex flex-wrap gap-2 border-b border-rule pb-4">
        {visiveis.map(([id, nome]) => (
          <button key={id} type="button" onClick={() => ir(id)} aria-current={aba === id ? "page" : undefined} className={`cursor-pointer border-2 px-4 py-2 font-medium ${aba === id ? "border-ink bg-ink text-parchment" : "border-rule hover:border-gold"}`}>
            {nome}
          </button>
        ))}
      </nav>
      <div className="mt-8">
        {aba === "inicio" && <Inicio me={eu} recarregar={me.reload} ir={ir} />}
        {aba === "escrever" && <Escrever me={eu} />}
        {aba === "minhas" && <Fila me={eu} minhas />}
        {aba === "fila" && <Fila me={eu} />}
        {aba === "comunidade" && <Comunidade me={eu} />}
        {aba === "pessoas" && <Pessoas />}
        {aba === "apoiadores" && <Apoiadores />}
        {aba === "radio" && <RadioAdmin />}
      </div>
    </div>
  );
}

function Inicio({ me, recarregar, ir }: { me: Me; recarregar: () => void; ir: (aba: string) => void }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const resumo = useLista<Resumo>("painel_resumo");
  const pedidos = useLista<{ id: string; papel: Role["papel"]; disciplina: string | null; status: string; criado_em: string }[]>("candidaturas_minhas");
  const perfil = useAcao(recarregar);
  const pedido = useAcao(pedidos.recarregar);
  const [nome, setNome] = useState(me.nome);
  const [bio, setBio] = useState(me.bio);
  const [quero, setQuero] = useState<{ papel: string; disciplina: string; mensagem: string }>({ papel: "educacao", disciplina: "", mensagem: "" });
  const [confirma, setConfirma] = useState(false);
  const [aviso, setAviso] = useState("");
  const nomeDaArea = (slug: string | null) => (slug ? (t.areas[slug as keyof typeof t.areas]?.[0] ?? slug) : "todo o site");
  const r = resumo.dados;
  const cartoes: [string, number, string][] = r
    ? [
        ["Na fila de revisão", r.fila, "fila"],
        ["Aprovadas aguardando publicação", r.aguardando_publicacao, "fila"],
        ["Pedidos de voluntariado", r.candidaturas, "pessoas"],
        ["Denúncias abertas", r.denuncias, "comunidade"],
        ["Anotações aguardando", r.anotacoes, "comunidade"],
        ["Minhas contribuições", r.minhas, "minhas"],
      ]
    : [];

  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-serif text-3xl font-semibold">Olá, {me.nome}</h2>
        {me.papeis.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {me.papeis.map((papel) => (
              <li key={papel.id} className="border border-rule bg-parchment-deep px-3 py-1">
                {papeis[papel.papel]} · {nomeDaArea(papel.disciplina)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-ink-soft">Você ainda não tem um papel no instituto. Qualquer pessoa pode escrever e enviar; para revisar, traduzir ou cuidar de uma disciplina, peça um papel abaixo.</p>
        )}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {cartoes
            .filter(([, total]) => total > 0)
            .map(([titulo, total, destino]) => (
              <button key={titulo} type="button" onClick={() => ir(destino)} className="cursor-pointer border border-rule bg-parchment-deep p-4 text-left hover:border-gold">
                <span className="block font-serif text-3xl font-semibold">{total}</span>
                <span className="text-ink-soft">{titulo}</span>
              </button>
            ))}
        </div>
      </section>

      <section>
        <h2 className="font-serif text-2xl font-semibold">Seu perfil</h2>
        <p className="mt-1 text-ink-soft">O nome aparece em tudo o que você publicar.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            Nome
            <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} className={campo} />
          </label>
          <label className="block">
            Sobre você (opcional)
            <input value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} className={campo} />
          </label>
        </div>
        <button type="button" className={`mt-3 ${botaoClaro}`} disabled={perfil.ocupado} onClick={() => perfil.agir("perfil_salvar", { p_nome: nome, p_bio: bio }, "Perfil guardado.")}>
          Guardar perfil
        </button>
        <Aviso texto={perfil.aviso} />
      </section>

      <section>
        <h2 className="font-serif text-2xl font-semibold">Quero ser voluntário</h2>
        <p className="mt-1 text-ink-soft">Diga em que quer ajudar e conte um pouco da sua experiência. A coordenação responde por aqui.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            Em que papel
            <select value={quero.papel} onChange={(e) => setQuero({ ...quero, papel: e.target.value })} className={campo}>
              {(["educacao", "revisao", "traducao", "jornalismo", "curadoria"] as const).map((papel) => (
                <option key={papel} value={papel}>
                  {papeis[papel]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Disciplina{quero.papel === "educacao" ? "" : " (opcional)"}
            <select value={quero.disciplina} onChange={(e) => setQuero({ ...quero, disciplina: e.target.value })} className={campo}>
              <option value="">{quero.papel === "educacao" ? "Escolha…" : "Todo o site"}</option>
              {areaSlugs.map((area) => (
                <option key={area} value={area}>
                  {t.areas[area][0]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-3 block">
          Sua experiência e por que quer ajudar
          <textarea value={quero.mensagem} onChange={(e) => setQuero({ ...quero, mensagem: e.target.value })} rows={3} maxLength={2000} className={campo} />
        </label>
        <button
          type="button"
          className={`mt-3 ${botao}`}
          disabled={pedido.ocupado || quero.mensagem.trim().length < 20 || (quero.papel === "educacao" && !quero.disciplina)}
          onClick={async () => {
            const ok = await pedido.agir("candidatar", { p_papel: quero.papel, p_disciplina: quero.disciplina || null, p_mensagem: quero.mensagem }, "Pedido enviado à coordenação.");
            if (ok) setQuero({ ...quero, mensagem: "" });
          }}
        >
          Enviar pedido
        </button>
        <Aviso texto={pedido.aviso} />
        {(pedidos.dados?.length ?? 0) > 0 && (
          <ul className="mt-3 space-y-1 text-ink-soft">
            {pedidos.dados?.map((item) => (
              <li key={item.id}>
                {papeis[item.papel]} · {nomeDaArea(item.disciplina)} · {data(item.criado_em)} · <span className={rotulo}>{situacoes[item.status] ?? item.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border-t border-rule pt-6">
        <div className="flex flex-wrap gap-4">
          <button type="button" className={botaoClaro} onClick={async () => { await signOut(); router.replace(`/${lang}`); }}>
            Sair
          </button>
          {confirma ? (
            <button
              type="button"
              className="cursor-pointer bg-oxblood px-5 py-2 font-medium text-parchment"
              onClick={async () => {
                try {
                  await rpc("conta_apagar");
                  await signOut();
                  router.replace(`/${lang}`);
                } catch (erro) {
                  setAviso(textoDoErro(erro));
                }
              }}
            >
              Confirmar: apagar minha conta
            </button>
          ) : (
            <button type="button" className={elo} onClick={() => setConfirma(true)}>Apagar minha conta</button>
          )}
        </div>
        <p className="mt-2 text-ink-soft">Apagar a conta remove seu perfil, seus papéis e seus votos. O que já foi publicado continua no acervo.</p>
        <Aviso texto={aviso} />
      </section>
    </div>
  );
}

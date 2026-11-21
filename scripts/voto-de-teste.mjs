// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O voto secreto nos testes de antes (consulta à base, votação da comunidade e votação da equipe), sobre o banco que houver:
//   - sem a migração da R2 (supabase/migracoes/20261124-r2-voto.sql): o caminho de antes (a urna às claras), como os testes sempre
//     fizeram;
//   - com ela: a cédula cifrada de verdade (lib/rede/voto/limiar.ts) para uma chave de TESTE gravada direto no banco pelo dono, e a
//     apuração de teste, que abre as cédulas com a privada de teste e põe as escolhas na urna (num INSERT só, em ordem sorteada),
//     como a abridora poria.
//   - com a R3 (supabase/migracoes/20261125-r3-resto-r2.sql, a urna anônima): a pessoa pega o passe da urna COM a sessão
//     (public.rede_passes_contexto_marcar, que a marca de "já pegou a cédula"; a marca é a do servidor do site, aqui um resumo fixo
//     por pessoa e votação) e a cédula cifrada vai SEM sessão, pelo serviço (public.rede_urna_depositar_anonimo, com um passe gasto).
//     Pegar de novo responde "ja_votou", como antes; a votação fechada, de fora ou que a pessoa não vê responde "sem_permissao" (a
//     emissão do passe não diz o porquê). A equipe pega pelo servidor do site, que confere a mesma regra (passes_contexto_permitido).
// A cerimônia de verdade (guardiãs, partes, abridora, servidor que mente) é provada em scripts/testar-r2-voto.mjs; aqui só o que os
// testes de antes precisam para continuar provando o que provam: votar, as recusas e o resultado.
// Para rodar um teste de antes sobre o banco de depois da junção: ALUMIA_BANCO_EXTRAS com as migrações da R2 (scripts/banco-local.mjs).
import { createHash, randomBytes } from "node:crypto";
import { carregarSodio } from "../lib/rede/cifra/sodio.ts";
import * as L from "../lib/rede/voto/limiar.ts";

/** `banco` é o de scripts/banco-local.mjs. */
export async function votoDeTeste(banco) {
  const { dono } = banco;
  // Cifrado por tipo: a função de voto que está valendo é a da R2? (Um teste de antes que roda de novo a migração dele por cima do
  // banco de depois da junção traz de volta a definição de antes; aí o caminho de antes vale para aquele tipo.)
  const def = async (assinatura) => (await dono("select coalesce((select pg_get_functiondef(to_regprocedure($1))), '') as d", [assinatura])).rows[0].d;
  const daR2 = (d) => d.includes("voto_cedula_valida");
  const porTipo = {
    consulta: daR2(await def("public.rede_org_consulta_votar_cifrada(uuid, text)")),
    decisao: daR2(await def("public.alumia_decisao_votar_cifrada(uuid, text)")),
    equipe: daR2(await def("public.alumia_voto_equipe_cifrada(uuid, uuid, text, text)")) && !(await def("public.alumia_voto_equipe(uuid, uuid, integer, text)")),
  };
  // R3: a urna anônima, por tipo (a função com sessão da R3 responde "voto_anonimo"; um teste de antes que roda de novo a migração dele
  // por cima traz de volta a função de antes, e aí vale o caminho de antes para aquele tipo).
  const temUrna = (await dono("select to_regprocedure('public.rede_urna_depositar_anonimo(text, uuid, text, bytea)') is not null as tem")).rows[0].tem;
  const daR3 = (d) => temUrna && d.includes("voto_anonimo");
  const pelaR3 = {
    consulta: daR3(await def("public.rede_org_consulta_votar_cifrada(uuid, text)")),
    decisao: daR3(await def("public.alumia_decisao_votar_cifrada(uuid, text)")),
    equipe: daR3(await def("public.alumia_voto_equipe_cifrada(uuid, uuid, text, text)")),
  };
  for (const t of Object.keys(pelaR3)) if (pelaR3[t]) porTipo[t] = true;
  const r3 = pelaR3.consulta || pelaR3.decisao || pelaR3.equipe;
  const cifrado = porTipo.consulta || porTipo.decisao || porTipo.equipe;
  const S = cifrado ? await carregarSodio() : null;
  const chaves = new Map();

  async function chave(tipo, alvo) {
    if (chaves.has(alvo)) return chaves.get(alvo);
    const par = S.crypto_kem_xwing_keypair();
    const criador = (await dono("select id from interno.perfis order by id limit 1")).rows[0].id;
    const g = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
    const b = (n) => Buffer.from(S.randombytes_buf(n)).toString("base64");
    await dono(
      `insert into interno.rede_consulta_chaves (consulta, tipo, pk, n, k, guardias, guardias_chaves, partes, assinatura, criador, criada_por_identidade)
       values ($1, $2, $3, 3, 2, $4::uuid[], $5::jsonb, $6::jsonb, $7, $8, $9) on conflict (consulta) do nothing`,
      [alvo, tipo, par.publicKey, g, JSON.stringify(g.map((_, i) => ({ indice: i + 1, voto: b(1216), identidade: b(32), assinatura: b(64) }))), JSON.stringify(g.map(() => b(1193))),
        S.randombytes_buf(64), criador, S.randombytes_buf(32)],
    );
    const c = { tipo, alvo, publica: par.publicKey, privada: par.privateKey };
    chaves.set(alvo, c);
    return c;
  }
  const cedula = async (tipo, alvo, escolha) => L.cifrarCedula(await chave(tipo, alvo), escolha);

  const erro = (codigo) => Object.assign(new Error(codigo), { code: codigo });
  const marca = (tipo, alvo, quem) => createHash("sha256").update(`marca-de-teste:${tipo}:${alvo}:${quem}`).digest();
  /** R3: a cédula, sem sessão, pelo serviço (o que a rota /api/alumia/urna/depositar faz depois de conferir o passe). */
  const depositar = async (tipo, alvo, escolha) => {
    const c = await cedula(tipo, alvo, escolha);
    return banco.rpc({ papel: "service_role" }, "rede_urna_depositar_anonimo", { p_tipo: tipo, p_alvo: alvo, p_cedula: c, p_passe_resumo: randomBytes(32) });
  };
  /** R3: pegar o passe da urna com a sessão de quem vota (chamar) e depois depositar sem sessão. */
  const pelaUrna = async (chamar, quem, tipo, alvo, escolha) => {
    const novo = await chamar(quem, "rede_passes_contexto_marcar", { p_tipo: tipo, p_alvo: alvo, p_marca: marca(tipo, alvo, quem?.sub ?? quem) });
    if (novo !== true) throw erro("ja_votou");
    await depositar(tipo, alvo, escolha);
    return { votei: true };
  };

  return {
    cifrado,
    porTipo,
    cedula,
    /** Vota na consulta como `quem` (com a função `chamar(quem, funcao, argumentos)` do teste). */
    r3,
    pelaR3,
    async consulta(chamar, quem, consulta, ranking) {
      if (pelaR3.consulta) return pelaUrna(chamar, quem, "consulta", consulta, ranking);
      if (!porTipo.consulta) return chamar(quem, "rede_org_consulta_votar", { p_consulta: consulta, p_ranking: ranking });
      return chamar(quem, "rede_org_consulta_votar_cifrada", { p_consulta: consulta, p_cedula: await cedula("consulta", consulta, ranking) });
    },
    /** Vota na decisão secreta da comunidade como `quem`. */
    async decisao(chamar, quem, id, opcao) {
      if (pelaR3.decisao) return pelaUrna(chamar, quem, "decisao", id, [opcao]);
      if (!porTipo.decisao) return chamar(quem, "alumia_decisao_votar", { p_id: id, p_opcao: opcao });
      return chamar(quem, "alumia_decisao_votar_cifrada", { p_id: id, p_cedula: await cedula("decisao", id, [opcao]) });
    },
    /** O voto secreto da equipe pelo servidor do site (`servico(funcao, argumentos)`, com a chave de serviço). */
    async equipe(servico, { p_usuario, p_votacao, p_opcao, p_marca }) {
      if (pelaR3.equipe) {
        // O servidor do site confere a regra e grava a marca (com a sessão da pessoa); aqui, o mesmo pelo dono do banco.
        const pode = (await dono("select interno.passes_contexto_permitido('equipe', $1, $2) as p", [p_votacao, p_usuario])).rows[0].p;
        if (!pode) throw erro("sem_permissao");
        const m = (await dono("insert into interno.passes_emitidos_contexto (marca, dia) values ($1, interno.caixa_hoje()) on conflict do nothing returning 1 as ok", [marca("equipe", p_votacao, p_usuario)])).rows;
        if (!m.length) throw erro("ja_votou");
        await dono("select interno.voto_cedula_tomada('equipe', $1, $2)", [p_votacao, p_usuario]);
        await depositar("equipe", p_votacao, [p_opcao]);
        return { votei: true };
      }
      if (!porTipo.equipe) return servico("alumia_voto_equipe", { p_usuario, p_votacao, p_opcao, p_marca });
      return servico("alumia_voto_equipe_cifrada", { p_usuario, p_votacao, p_cedula: await cedula("equipe", p_votacao, [p_opcao]), p_marca });
    },
    /** Depois do prazo: abre as cédulas cifradas com a privada de teste e as põe na urna, como a abridora. Sem a R2: nada a fazer. */
    async apurar(tipo, alvo) {
      if (!porTipo[tipo] || !chaves.has(alvo)) return { apuradas: 0 };
      const c = chaves.get(alvo);
      const [tabela, coluna] = tipo === "consulta" ? ["rede_consulta_cifradas", "consulta"] : tipo === "decisao" ? ["alumia_decisao_cifradas", "decisao"] : ["votacao_cifradas", "votacao"];
      const cifradas = (await dono(`select cedula from interno.${tabela} where ${coluna} = $1`, [alvo])).rows;
      const escolhas = [];
      for (const x of cifradas) {
        const e = await L.abrirCedula(c.privada, c, x.cedula);
        if (e !== null) escolhas.push(e);
      }
      const lote = JSON.stringify(L.embaralhar(escolhas));
      if (tipo === "consulta") {
        await dono(`insert into interno.rede_consulta_cedulas (consulta, ranking)
          select $1, array(select y::uuid from jsonb_array_elements_text(e) with ordinality as t(y, n) order by n) from jsonb_array_elements($2::jsonb) e order by gen_random_uuid()`, [alvo, lote]);
      } else if (tipo === "decisao") {
        await dono("insert into interno.alumia_decisao_cedulas (decisao, opcao) select $1, (e ->> 0)::uuid from jsonb_array_elements($2::jsonb) e order by gen_random_uuid()", [alvo, lote]);
      } else {
        await dono("insert into interno.votacao_votos (votacao, opcao) select $1, (e ->> 0)::smallint from jsonb_array_elements($2::jsonb) e order by gen_random_uuid()", [alvo, lote]);
      }
      await dono(`delete from interno.${tabela} where ${coluna} = $1`, [alvo]);
      await dono("update interno.rede_consulta_chaves set apurada = true, partes = '[]'::jsonb where consulta = $1", [alvo]);
      return { apuradas: escolhas.length };
    },
  };
}

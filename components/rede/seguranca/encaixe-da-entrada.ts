// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O ENCAIXE da senha de pânico (onda 11, frente 11G) no "Entrar" da Alumia (components/rede/entrada/Formularios.tsx, FormEntrar).
// Como o encaixe da porta (components/rede/convites/encaixe-da-entrada.ts): a entrada importa daqui, de um caminho fixo, e só esta
// frente edita este arquivo.
//
// Antes de a senha sair do aparelho, a entrada pergunta `trocaDePanico(senha)`. Se este aparelho tem o cofre da senha de pânico
// (lib/rede/seguranca/cofre-de-panico.ts) e a senha digitada é a de pânico: tira a conta real do aparelho (a mesma limpeza da
// saída rápida, sem trocar de página) e devolve o e-mail e a senha da conta isca, que a entrada usa no lugar dos digitados. Daí em
// diante tudo é o caminho normal de entrar, com as mesmas telas: nada na tela diz que houve troca. A senha de pânico nunca vai ao
// servidor. Sem cofre (ou senha que não é a de pânico), nulo: segue a entrada de sempre.
import { apagarDoAparelho } from "@/lib/modo-seguro";
import { naoRegistrarRedeNestaPagina } from "@/lib/rede/painel/cliente-rede";
import { abrirCofre, garantirCofre } from "@/lib/rede/seguranca/cofre-de-panico";
import { rodarLimpezas } from "@/lib/rede/saida";

export async function trocaDePanico(senha: string): Promise<{ email: string; senha: string } | null> {
  // Sem cofre, nasce um de fachada (todo aparelho que entra tem um), e a conferência gasta o mesmo tempo nos dois casos.
  const cofre = garantirCofre();
  if (!cofre || !senha) return null;
  const isca = await abrirCofre(senha, cofre);
  if (!isca) return null;
  // A conta real sai do aparelho antes de a isca entrar: sessão, chaves "lucia*", bases, caches, o chaveiro do chat e o que as
  // frentes limpam na saída rápida. O cofre fica (a chave dele não começa com "lucia").
  // Os encaixes vêm só aqui, sob demanda: a entrada não carrega o pacote de todas as frentes para quem só entra.
  const limpezas = await import("../encaixes").then((m) => m.ENCAIXES.aoSairRapido ?? [], () => []);
  await Promise.all([apagarDoAparelho(), rodarLimpezas(limpezas)]);
  // A entrada da isca, logo depois da conta real e da mesma rede, não registra a impressão de rede (só na memória desta página).
  naoRegistrarRedeNestaPagina();
  return { email: isca.email, senha: isca.senha };
}

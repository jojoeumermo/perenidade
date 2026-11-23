# Plano de auditorias

O que o Instituto Lúcia pede a uma auditoria externa de segurança, em que ordem e quando. Público de propósito: quem usa a Alumia
pode cobrar, e quem audita sabe por onde começar. Os relatórios saem **na íntegra** em
[institutolucia.org/transparencia/relatorios](https://institutolucia.org/transparencia/relatorios), com o resumo SHA-256 do
arquivo e a resposta a cada achado. Como avisar de uma falha fora de uma auditoria: [SECURITY.md](../SECURITY.md).

## Quando

- **No mínimo uma vez por ano**, cobrindo o que mudou desde a anterior.
- **A cada mudança grande de criptografia ou de protocolo**, antes de ela ir ao ar para todo mundo: troca de biblioteca de cifra,
  protocolo novo de conversa ou de grupo, mudança no que o servidor vê, novo tipo de app, servidor do chat separado, mixnet ligada,
  mensagens sem internet.
- **Depois de uma falha crítica**, uma revisão focada no mesmo padrão em todo o código.

## O que, em ordem

A ordem é a do dano: primeiro o que, se falhar, entrega conversa, voto ou quem fala com quem.

1. **O chat a dois e os grupos.** Proteus (Double Ratchet com início pós-quântico pelo envelope X-Wing), a camada pós-quântica
   durante a conversa (SPQR), MLS nos grupos, a verificação de segurança entre aparelhos, vários aparelhos por conta, a cópia de
   segurança. A pergunta: só os aparelhos leem? A conversa se cura depois de um aparelho roubado?
2. **As caixas anônimas e os passes.** Depósito e busca sem conta, passes anônimos, tamanhos fixos, lotes em ordem sorteada,
   cobertura de tráfego. A pergunta: o servidor, com o banco inteiro e os registros, liga uma caixa a uma pessoa ou a outra
   caixa?
3. **O voto e as contagens.** Voto em limiar, urna anônima, o piso de 3 em todo número sobre pessoas. A pergunta: dá para saber
   quem votou em quê, ou ver um número abaixo de 3?
4. **As fronteiras do servidor.** As rotas do site, as funções do banco que recebem dados de fora, a porta (funções com a
   conferência de quem pede), a segurança por linha, o que o painel da coordenação consegue ver. A pergunta: um administrador,
   ou quem toma o servidor, lê o que não devia?
5. **Os apps.** Android e computador: cofre de chaves do aparelho, trava, apagar depois de senhas erradas, notificação sem
   conteúdo, atualização conferida no livro público de assinaturas (Sigstore), build reproduzível, modo sem internet.
6. **O resto do site e o painel da equipe.** Conta, segundo fator, convites, moderação, envio de arquivos.

## Escopo de cada auditoria

O escopo de cada rodada é escrito antes, com o commit exato do código, a lista dos componentes acima que entram, o modelo de ameaça
(quem ataca e com o quê: quem copia o banco, o servidor tomado, quem grava o tráfego para quebrar depois, membro malicioso de um
grupo, quem apreende o celular, o observador da rede inteira, aparelhos maliciosos por perto, quem troca o binário do app) e o que
já foi revisado por dentro, com os testes e as provas formais que existem, para a auditoria não gastar tempo no que já está
coberto.

## Como escolhemos quem audita

- experiência pública em auditoria de protocolos de mensagem cifrada ou de criptografia aplicada;
- aceitar, por escrito, que o relatório saia **na íntegra**, sem cortes além de detalhes de falha ainda não corrigida (que saem
  depois da correção);
- nenhuma ligação com quem tenha interesse em vigiar movimentos sociais;
- preço compatível com um projeto voluntário (auditorias pro bono ou com apoio de fundos de software livre são preferidas).

## Depois do relatório

Cada achado vira um teste que falha, a correção, o teste passando e a busca do mesmo padrão no resto do código. A resposta a cada
achado (corrigido, quando, ou por que não) sai junto do relatório. Os achados entram no relatório trimestral de segurança.

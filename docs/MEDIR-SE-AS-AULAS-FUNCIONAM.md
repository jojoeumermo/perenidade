# Medir se as aulas funcionam: opções para decidir

Hoje (recurso `ajudou`), o "Isso ajudou?" no fim de cada aula guarda a resposta **só no aparelho de quem estuda**. Nada vai para o servidor, e o instituto não fica sabendo de nada. Isso protege quem estuda, mas não diz à equipe quais aulas precisam melhorar.

Abaixo, três formas de a equipe saber mais, da que menos expõe para a que mais expõe. **Nenhuma foi implementada.** A escolha é sua.

## Opção A: a pessoa decide mandar (sem nada novo no servidor)

Em Meu estudo, um botão "Mandar minhas respostas para a equipe" monta um texto curto (aula e resposta, sem nome) e abre o formulário que já existe em [Contribuir](/contribuir), já preenchido, como uma sugestão. A pessoa vê exatamente o que vai, pode apagar linhas e decide enviar. Professores do modo turma podem pedir isso à turma.

- **Prós:** nenhum armazenamento novo, nenhum contador, nada automático. Usa a fila e a triagem que já existem. Combina com "nada é enviado sozinho".
- **Contras:** pouca gente manda; a amostra fica pequena e enviesada (manda quem se anima). Dá trabalho manual para a equipe ler.
- **Privacidade:** a mesma de hoje para quem não manda. Quem manda passa pelo mesmo caminho de qualquer contribuição sem conta (o banco guarda o texto e o código embaralhado da origem por dois dias, para barrar abuso).

## Opção B: contagem agregada, sem identificação

Cada clique em "Ajudou / Em parte / Não ajudou" soma 1 num contador por aula no banco (uma função `ajuda_contar(aula, resposta)` que só incrementa números; nada sobre quem clicou). A equipe vê, no painel, os totais por aula.

- **Prós:** dá números de verdade, por aula, sem esforço de quem estuda. Barato e simples.
- **Contras:** é o primeiro dado de estudo que sai do aparelho (mesmo agregado); quebra a promessa "nada do que você faz ao estudar sai do seu aparelho" e exige mudar a página de privacidade. Contadores públicos são fáceis de inflar (robôs, alguém clicando muitas vezes), então os números servem de sinal, não de prova. Precisa de limite de envios.
- **Privacidade:** o pedido chega ao serviço de contas com o endereço de rede de quem clicou (como qualquer pedido da web), mesmo que o banco não guarde. Para reduzir, a soma poderia ir em lote, uma vez por semana, com atraso aleatório; e só com a pessoa tendo marcado "quero ajudar a melhorar as aulas" (desligado por padrão).

## Opção C: pesquisa com turmas parceiras

Professores que usam o modo turma combinam uma pesquisa curta com a turma, de tempos em tempos, e mandam à equipe só o resumo (quantos acharam que a aula ajudou, o que faltou), sem nomes. Pode vir junto dos comprovantes de conclusão.

- **Prós:** informação mais rica (o que faltou, por quê), contexto de sala de aula, nenhum dado individual no instituto.
- **Contras:** depende de professores parceiros; não cobre quem estuda sozinho; é lento.
- **Privacidade:** nenhum dado novo no site. O que circula entre aluno e professor é combinado entre eles.

## Recomendação

Começar pela **A** (custa pouco e não muda nenhuma promessa) e pela **C** onde houver turmas. Só pensar na **B** se a equipe precisar de números que a A e a C não derem, e, nesse caso, com a pessoa escolhendo participar, com limite de envios e com a página de privacidade atualizada no mesmo dia.

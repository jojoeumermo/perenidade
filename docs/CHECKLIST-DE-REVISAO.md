# Checklist de revisão

Para quem revisa uma aula ou um exercício. Leia com calma, do começo ao fim, como alguém que está aprendendo. Anote o que precisa mudar; se estiver tudo certo, diga isso. Ninguém revisa o que escreveu.

## 1. Está certo?

- [ ] Toda conta foi refeita, no papel ou na calculadora. Os resultados do texto, do `verificar`, do `quiz` e dos exercícios batem.
- [ ] Datas, nomes, números, lugares e citações conferem com as fontes.
- [ ] Cada afirmação importante tem fonte, e a fonte diz mesmo aquilo. Links abrem (nada de PDF direto, nada de loja).
- [ ] Não há texto copiado de outro site, livro ou plataforma. Questão adaptada (de prova pública, por exemplo) diz de onde veio.
- [ ] Sobre pessoas vivas, partidos ou empresas: só fatos documentados, em linguagem sóbria.

## 2. Ensina?

- [ ] Segue o modelo (`docs/MODELO-DE-AULA.md`): objetivo, explicação, exemplo resolvido, exercício, resumo e fontes. `npm run pendencias -- <trilha>` mostra o que falta.
- [ ] Parte do que a pessoa já conhece e chega ao novo, uma ideia por vez, com exemplos do dia a dia.
- [ ] O tom combina com a etapa (fundamental, médio, superior). Termo técnico vem explicado na primeira vez.
- [ ] O exemplo resolvido mostra todos os passos, e não só a resposta.

## 3. Os exercícios ajudam?

- [ ] Há uma única resposta certa, e ela está certa.
- [ ] Cada alternativa errada é um engano que alguém de fato cometeria, e a explicação diz onde a pessoa escorregou e como acertar.
- [ ] As explicações são respeitosas: "quase", "vamos ver onde escorregou". Nada de "errado!", "óbvio", "fácil".
- [ ] A dificuldade (1, 2 ou 3) e o tema estão coerentes.
- [ ] Questão com número tem `conferir` e passa em `npm run testar:exercicios`.

## 4. Todo mundo consegue usar?

- [ ] Títulos em ordem (`##` antes de `###`), sem pular nível.
- [ ] Tabelas com linha de cabeçalho; nada que dependa só de cor para ser entendido.
- [ ] Links com texto que diz para onde vão (nunca "clique aqui").
- [ ] Frases curtas. Lido em voz alta (botão de acessibilidade → ouvir), o texto faz sentido.

## 5. Registrar

Revisado, acrescente a linha no cabeçalho da aula (o histórico fica; nunca apague as linhas antigas):

```yaml
revisoes:
  - funcao: "educador de matemática"
    data: "2026-10-20"
    nota: "O que foi conferido ou corrigido."
```

Nos exercícios (`content/exercicios/...`), troque `status: em-revisao` por:

```yaml
  revisao:
    status: revisada
    por: "educador de matemática"
    em: "2026-10-20"
```

Rode `npm run pendencias` e `npm run testar:exercicios` antes de enviar.

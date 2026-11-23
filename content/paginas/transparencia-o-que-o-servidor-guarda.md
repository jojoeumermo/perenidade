---
titulo: "O que o servidor guarda"
sobretitulo: "Transparência"
resumo: "Cada tabela do banco do Instituto, com as colunas, o que ela guarda, se aponta para uma conta e em quanto tempo o banco apaga sozinho. Gerada do banco, não escrita de memória."
---

Esta lista é gerada do banco montado com o código aberto do site (o arquivo `supabase/install.sql`), por um programa que lê o catálogo do próprio banco. Ela não depende de alguém lembrar: o teste automático do código compara a lista com o banco e **falha** quando aparece uma tabela ou uma coluna que não está aqui, ou uma tabela nova sem um comentário dizendo o que guarda.

A versão curta, dado por dado e com quem lê cada um, está em [O que a Alumia guarda](/alumia/o-que-guardamos). Esta é a versão completa, para quem quer conferir.

## Como ler

- **O que é**: o comentário que a migração do banco escreveu logo acima da tabela. Tabelas antigas às vezes não têm; as novas precisam ter.
- **Aponta para uma conta**: as colunas que guardam o número de uma conta (por chave do banco ou pelo nome da coluna). Tabela sem nada aqui não liga o que guarda a uma pessoa.
- **Apaga sozinho**: o prazo das rotinas do banco que apagam as linhas velhas. Vazio não quer dizer "para sempre": muitas tabelas apagam quando a conta é apagada, quando o pacote é entregue ou numa data guardada na própria linha (como as caixas anônimas, que vencem).
- **O que não está aqui**: endereço de rede (IP) não fica guardado em tabela nenhuma; as conversas da Alumia e da equipe ficam só cifradas, e as chaves ficam nos aparelhos.

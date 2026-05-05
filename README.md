# Pulse Finance

Aplicação web de controle financeiro pessoal com login, dashboard, planejamento de metas e análise mensal.

## Acesso

- Login: `alessandro@pulse.local`
- Senha: `1234`

## Como usar

1. Abra `login.html` no navegador.
2. Faça login.
3. O app redireciona para `index.html`.

## Funcionalidades

- Dashboard com KPIs: saldo, entradas, saídas e eficiência.
- Histórico de transações com filtros por descrição, tipo, categoria e período.
- Cadastro de transações com suporte a parcelamento (saídas).
- Comparativo mensal (mês atual vs anterior).
- Calendário financeiro diário.
- Planejamento com metas e aporte rápido.
- Orçamento por categoria com alerta de estouro.
- Exportação CSV de transações.
- Importação CSV de transações.
- Backup e restauração JSON.
- Sessão local com logout.

## Importação CSV

O arquivo deve ter cabeçalho e seguir este formato:

```csv
tipo,descricao,categoria,valor,data
entrada,"Salário","Trabalho",3500,2026-05-01
saida,"Mercado","Alimentação",420.50,2026-05-03
```

Regras:
- `tipo`: `entrada` ou `saida`
- `valor`: número positivo
- `data`: formato `YYYY-MM-DD`

## Estrutura

- `login.html`: tela de login
- `index.html`: app principal
- `styles.css`: estilos
- `app.js`: regras de negócio e persistência local

## Persistência

Os dados são salvos no `localStorage` do navegador.


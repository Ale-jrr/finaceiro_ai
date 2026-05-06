# Zentro / Pulse Finance

Aplicação web de controle financeiro com login local e sincronização opcional com Supabase.

## Acesso

- Login: `alessandro@pulse.local`
- Senha: `1234`

## Rodar local

Abra `login.html` no navegador.

## Supabase (sincronização)

1. No Supabase, abra o SQL Editor e execute o arquivo `supabase.sql`.
2. Copie `supabase-config.example.js` para `supabase-config.js`.
3. Preencha:

```js
window.SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
window.SUPABASE_ANON_KEY = 'SUA_ANON_KEY';
```

4. Reabra o app. A sincronização passa a ocorrer automaticamente.

## Como funciona a sync

- O app continua funcionando offline com `localStorage`.
- Com Supabase configurado, ele sincroniza o estado do app por usuário (`pulse_user`) na tabela `app_user_state`.
- Se houver dado mais novo no Supabase, ele puxa e recarrega a página.

## Deploy na Vercel

1. Suba o repo no GitHub.
2. Na Vercel: `Add New -> Project -> Import Git Repository`.
3. Framework preset: `Other`.
4. Build command: vazio.
5. Output directory: vazio.
6. Deploy.

### Importante para config em produção

Como é um app estático, mantenha `supabase-config.js` no projeto com URL/key anon.
Para segurança real, migre autenticação para Supabase Auth e políticas RLS por usuário.

## Arquivos principais

- `login.html`
- `index.html`
- `app.js`
- `supabase-sync.js`
- `supabase-config.js`
- `supabase.sql`

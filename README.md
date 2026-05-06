# Zentro Finance

Aplicação web de controle financeiro com login local, gestão de usuários e sincronização com Supabase.

## Acesso admin

- Login: `alessandro@pulse.local`
- Senha: `FINANCA2026`

## Abrir em outro PC

1. Instale Git.
2. Clone o repositório:

```bash
git clone https://github.com/Ale-jrr/finaceiro_ai.git
cd finaceiro_ai
```

3. Abra `login.html` no navegador.

## Configuração Supabase (já preenchida no repo)

Arquivo: `supabase-config.js`

```js
window.SUPABASE_URL = 'https://iexskiwhdzrrdofxclil.supabase.co';
window.SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlleHNraXdoZHpycmRvZnhjbGlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwODUyMjgsImV4cCI6MjA5MzY2MTIyOH0.RChts4ddkT1ZfyAh0_rRBofDZp64stRvff7PL7wMz-w';
```

## Setup do banco (obrigatório)

No Supabase SQL Editor, execute:
- `supabase.sql`

Isso cria a tabela de sincronização:
- `app_user_state`

## Observação de segurança

- A `anon key` é pública (uso no frontend).
- **Não** versionar senha do banco nem `service_role key`.

## Deploy

- Produção: `https://zentrofinance.vercel.app`
- Vercel: importar repo e deploy como projeto estático.

## Arquivos principais

- `login.html`
- `index.html`
- `styles.css`
- `app.js`
- `supabase-sync.js`
- `supabase-config.js`
- `supabase.sql`

# Financeiro Restaurante

Aplicacao Next.js para gestao financeira e operacional de restaurantes, com PostgreSQL, Prisma, autenticacao por sessao e isolamento por restaurante.

## Desenvolvimento

Requisitos: Node.js 22 e PostgreSQL externo ou local. O projeto nao usa Docker.

```powershell
Copy-Item .env.example .env
npm install
npm run db:generate
npm run db:push
npm run dev
```

Configure `DATABASE_URL` no `.env`, por exemplo:

```text
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?sslmode=require"
```

Comandos uteis: `npm run db:migrate`, `npm run db:studio`, `npm run lint`, `npm run build`.

## Implementado

- Cadastro transacional de restaurante e usuario proprietario.
- Login e logout com senha bcrypt e cookie httpOnly de sessao.
- Contexto de restaurante baseado no membership do usuario.
- Papeis `OWNER`, `ADMIN`, `MANAGER`, `OPERATOR` e `VIEWER`.
- Schema PostgreSQL com usuarios, memberships, transacoes, categorias, contas, caixa, fornecedores, contas a pagar, funcionarios, folha, estoque e auditoria.
- Dashboard com receitas, despesas, saldo, contas pendentes e lancamentos reais.
- API de leitura e criacao de transacoes com Zod, autenticacao, autorizacao e validacao de referencias no restaurante atual.

## Prisma

O pacote `prisma@8.0.0-rc.13` presente inicialmente no workspace era a nova CLI de plataforma e nao expunha os comandos ORM `generate`/`validate`; tambem nao havia uma versao publica correspondente de `@prisma/client`. Para manter o projeto executavel com PostgreSQL, o runtime foi alinhado em `prisma`/`@prisma/client` `7.10.0`, usando `@prisma/adapter-pg`. O schema esta em `prisma/schema.prisma` e a URL fica somente na configuracao/env.

## Deploy

Na Vercel, configure `DATABASE_URL` como variavel de ambiente. Use `npm run build` no build command e aplique as migracoes contra o PostgreSQL gerenciado antes de publicar alteracoes de schema.

## Escopo restante

As telas e APIs completas de categorias, contas, caixa, fornecedores, contas a pagar, funcionarios, estoque, equipe, auditoria, relatorios/exportacao e edicao/exclusao de transacoes ainda precisam ser implementadas sobre esta base. Integracoes bancarias, emissao fiscal e folha trabalhista oficial nao fazem parte deste projeto.

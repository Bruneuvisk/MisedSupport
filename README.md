# MisedSupport (TypeScript)

Conversão do bot em Python para TypeScript usando Discord.js v14, MongoDB (driver oficial) e MySQL (mysql2/promise).

## Como usar

1. Copie `.env.example` para `.env` e preencha as variáveis.
2. Instale dependências:
   ```bash
   npm i
   ```
3. Rodar em desenvolvimento:
   ```bash
   npm run dev
   ```
4. Build e start:
   ```bash
   npm run build
   npm start
   ```

## Estrutura

- `src/index.ts`: inicia bot, conecta Mongo/MySQL.
- `src/bot/core/Bot.ts`: client, loader de comandos e eventos, sync global.
- `src/bot/db/*`: conexões e DAOs (Metrics + Whitelist).
- `src/bot/commands/ping.ts`: exemplo convertido do `/ping`.
- `src/bot/events/ready.ts`: listeners + roteamento de slash commands.

> Para portar os demais comandos do Python, crie arquivos em `src/bot/commands` exportando `{ data, execute }`. Serviços e DAOs podem ser espelhados em `src/bot/services` e `src/bot/db`.


## Sistemas adicionados nesta leva
- Autorole (admin + listener)
- Giveaway (DAO + command + service; encerramento por sorteio)
- Backup (DAO + service + comando de criar/listar)
- Modmail (estrutura básica de config/thread; listener simplificado para DM futura)
- Antispam (config + listener + admin)

> Observação: Alguns fluxos avançados (ex.: botões/reactions de inscrição em sorteio, painel de modmail, GIF/RemoveBG/ponto) podem ser adicionados depois mantendo o mesmo padrão de DAOs/Services/Commands.

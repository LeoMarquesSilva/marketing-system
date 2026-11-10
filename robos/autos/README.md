# Robô de autos

Baixa os autos dos processos no tribunal e entrega o PDF ao ORQESTRAI, onde a IA lê e deixa sugestões para uma pessoa aprovar. Roda **fora da Vercel**, numa máquina do escritório, com Node e Playwright.

Primeiro conector: **e-SAJ do TJSP**. Os próximos (PJe, eproc, Projudi) entram em `src/conectores/`, um por sistema de tribunal.

## Como funciona

1. Na ficha do processo, alguém clica em **Pedir ao robô**. O pedido entra na fila `proc_autos_pedidos`.
2. O robô pergunta ao ORQESTRAI pelo próximo pedido (`POST /api/robos/autos/proximo`), abre o tribunal com a sessão do advogado, consulta o processo, abre a pasta digital e pede o PDF em arquivo único.
3. O PDF sobe direto ao bucket privado `processos-autos` por URL assinada e o pedido é concluído. O arquivo não fica na máquina do robô.
4. O ORQESTRAI lê o PDF com a IA e mostra as sugestões na ficha. Nada é gravado sem aprovação.
5. O PDF é temporário também no ORQESTRAI: sai do bucket quando a última sugestão dele é decidida, ou depois de 7 dias (`PROCESSOS_AUTOS_DIAS`). Ficam as sugestões, com a página e o trecho de onde saíram.

O robô fala só com as rotas `/api/robos/autos` do ORQESTRAI, com um token próprio. Ele **não** recebe a chave do banco.

## Regras que o robô segue

- **A credencial é do advogado.** Certificado, CPF e senha existem só nesta máquina (arquivo `.env` e pasta `perfil/`, os dois fora do repositório). Nada disso é enviado ao ORQESTRAI, gravado no banco ou escrito em log.
- **Segundo fator e CAPTCHA não são contornados.** Quando o tribunal pede o código de verificação ou mostra um desafio, o robô para, marca o pedido como "aguardando pessoa" (aparece na ficha), toca um aviso no terminal e espera alguém resolver na janela dele. Depois segue sozinho.
- **Segredo de justiça não é baixado sem liberação.** Se o cadastro ou a página do tribunal marcam o processo como segredo de justiça, o pedido fica parado até alguém clicar em "Liberar o download" na ficha. A liberação fica no histórico, com o nome de quem liberou.
- **Sem senha de processo.** Se o e-SAJ pedir a senha do processo para abrir os autos (o advogado não está habilitado), o pedido volta com erro e o PDF é anexado à mão.
- **Um processo por vez**, com pausa entre um e outro, para não sobrecarregar o tribunal.

## O que precisa na máquina

- Node 20.11 ou mais novo.
- Google Chrome instalado. O robô abre o Chrome como um navegador comum, com um perfil só dele (em `perfil/`), e se conecta a ele por uma porta de depuração local (127.0.0.1, sorteada a cada execução). Aberto pelo modo de automação do Playwright, o Chrome não deixa instalar extensão, e o login por certificado precisa da extensão Web Signer.
- Para login com certificado: o **Web Signer** da Softplan instalado no sistema, a extensão Web Signer instalada **no perfil do robô** (passo 3 abaixo) e o certificado do advogado disponível na máquina (no macOS, no Acesso às Chaves).

## Instalação

```bash
cd robos/autos
npm install
cp .env.example .env
```

Edite o `.env`:

| Variável | O que é |
|---|---|
| `ORQESTRAI_URL` | Endereço do ORQESTRAI: o de produção ou `http://localhost:3000` em desenvolvimento. |
| `ROBO_AUTOS_TOKEN` | O mesmo valor configurado no ORQESTRAI (Vercel → Environment Variables → `ROBO_AUTOS_TOKEN`), com 24 caracteres ou mais. Gere com `openssl rand -hex 32`. Sem essa variável no servidor, as rotas do robô respondem 503. |
| `ROBO_NOME` | Nome desta máquina, como aparece na ficha. |
| `ESAJ_LOGIN` | `certificado`, `senha` ou `manual` (veja abaixo). |
| `ESAJ_CERTIFICADO` | Trecho do nome do certificado, como aparece na lista do e-SAJ (modo `certificado`). |
| `ESAJ_USUARIO`, `ESAJ_SENHA` | Só no modo `senha`. |

### Modos de login no e-SAJ

- `certificado`: o robô abre a aba "Certificado digital", escolhe o certificado cujo nome contém `ESAJ_CERTIFICADO` e clica em Entrar. Se houver mais de um candidato, ou nenhum, ele deixa a escolha para a pessoa. O sistema operacional pode pedir permissão para usar a chave do certificado: autorize na janela.
- `senha`: o robô preenche CPF e senha e para no código de verificação, que o advogado informa na janela.
- `manual`: o robô só abre a página de login e espera uma pessoa entrar, do jeito que ela preferir.

A sessão do e-SAJ vale enquanto o Chrome do robô estiver aberto: o tribunal usa um cookie de sessão, que se perde quando o navegador fecha. Por isso cada vez que o robô é iniciado há um login (no modo `certificado`, ele mesmo faz; nos outros, espera a pessoa). Deixar o robô rodando (`npm run robo`) evita logins repetidos.

## Primeiro uso

1. Confira o `.env`.
2. Abra a sessão do tribunal com calma:

   ```bash
   npm run login
   ```

   O Chrome do robô abre na página de login do e-SAJ.
3. Só na primeira vez, com certificado: se o e-SAJ avisar que o Web Signer não está instalado, clique no botão do próprio aviso, instale a extensão **nesta janela** e recarregue a página. A extensão fica no perfil do robô.
4. Conclua o login. O terminal mostra "Sessão do tribunal aberta" e o navegador fecha. Esse passo serve para instalar a extensão e conferir que o certificado funciona; o login vale de novo a cada início do robô.
5. Antes de baixar de verdade, vale conferir se a tela do tribunal está como o conector espera:

   ```bash
   npm run inspecionar -- 0000000-00.0000.8.26.0000
   ```

   O robô abre o processo e a pasta digital, sem pedir o PDF, e guarda em `diagnostico/` uma captura de cada tela e a lista de botões que encontrou.

## Uso

```bash
npm run robo       # fica rodando e atende a fila
npm run uma-vez    # atende o que estiver na fila e sai
```

Deixe a janela do terminal e a do Chrome do robô abertas. Para parar, `Ctrl+C`. No macOS, `caffeinate -i npm run robo` impede a máquina de dormir enquanto o robô roda.

Na ficha do processo, o painel **Autos** mostra a situação do pedido: na fila, baixando, aguardando pessoa (com o motivo), erro (com a mensagem do robô) ou o PDF já entregue.

## Quando algo dá errado

| O que aparece | O que fazer |
|---|---|
| "PRECISA DE UMA PESSOA" no terminal | Resolva o que a mensagem pede (login, código, CAPTCHA) na janela do Chrome do robô. Ele espera `ESPERA_PESSOA_MINUTOS` (15 por padrão); passado o tempo, o pedido continua "aguardando pessoa" e o robô tenta de novo mais tarde. |
| "O e-SAJ pede a senha do processo" | O advogado do certificado não está habilitado naquele processo. Anexe o PDF à mão na ficha. |
| "A tela do e-SAJ mudou ou não carregou" | O tribunal mudou a página. A mensagem aponta a captura guardada em `diagnostico/`; ajuste os seletores em `src/conectores/esaj.ts` (constante `TELA`). |
| "não mostrou o processo" | Número de outro sistema (processos novos do TJSP estão no eproc), segredo de justiça sem acesso do advogado, ou número com mais de um processo. |
| PDF com mais de 200 MB | Passa do limite do bucket. Baixe em partes e anexe à mão. |
| "O navegador do robô não respondeu" | Ficou uma janela do Chrome do robô aberta de uma execução anterior. Feche-a e rode de novo. |
| "ORQESTRAI respondeu 401" ou 503 | `ROBO_AUTOS_TOKEN` diferente do servidor, ou não configurado nele. |

`diagnostico/` guarda capturas e HTML das telas do tribunal, que podem conter dados de processos. A pasta fica só na máquina do robô e fora do repositório; apague o que não for mais útil.

## Pastas

| Pasta | Conteúdo | No repositório? |
|---|---|---|
| `src/` | Código do robô. `conectores/esaj.ts` é o e-SAJ; `conectores/esaj-urls.ts` é a parte sem navegador, com testes (`npx vitest run robos` na raiz). | Sim |
| `perfil/` | Perfil do Chrome do robô: sessão do tribunal e extensão Web Signer. | Não |
| `downloads/` | PDF em trânsito; é apagado depois de subir ao ORQESTRAI. | Não |
| `diagnostico/` | Capturas para ajustar o conector. | Não |
| `.env` | Configuração e, no modo `senha`, a credencial do advogado. | Não |

## Novo conector

1. Crie `src/conectores/<sistema>.ts` implementando `Conector` (`src/conectores/tipos.ts`): `chave` no formato `sistema:TRIBUNAL`, `entrar` e `baixar`.
2. Use `ambiente.aguardarPessoa(...)` em login, segundo fator e CAPTCHA, e lance `SegredoDeJustica` quando o processo for sigiloso e `pedido.segredoLiberado` for falso.
3. Inclua o conector em `CONECTORES` (`src/index.ts`) e o tribunal em `CONECTORES_DISPONIVEIS` (`src/lib/processos/tribunais.ts`, no ORQESTRAI), que é o que libera o botão "Pedir ao robô" na ficha.

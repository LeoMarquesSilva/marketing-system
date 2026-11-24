# Robô de autos no servidor (Easypanel)

Estudo de 17/11/2026 (2 fatores pelo painel em 18/11/2026) sobre rodar o robô de autos num contêiner no Easypanel em vez do Mac, e guia para fazer isso. Em 23/11/2026 o robô da pauta (mesmo código) entrou no PJe pelo jus.br no servidor com o certificado e o código do painel; os serviços `robo-autos-*` estão criados no Easypanel, ainda sem deploy.

## Veredito

**Decisão do usuário (18/11/2026): o servidor atende todos os sistemas e o Mac é desligado, mas só depois de tudo funcionar no Easypanel.** A troca é feita sistema por sistema ([Migração](#migração-do-mac-para-o-servidor)).

- **eproc do TJSP e do TJRJ:** rodam inteiros no servidor. O Playwright apresenta o certificado A1 (.pfx) ao SSO do tribunal sozinho, sem a lista de certificados do Chrome. Depois do certificado vem o código de 2 fatores, que o robô gera sozinho com o segredo do TOTP cadastrado no painel de robôs (sem ele, busca no webhook do n8n; sem os dois, uma pessoa digita pela tela remota). Testado localmente com um servidor que exige certificado de cliente; falta o teste com o certificado e os tribunais de verdade.
- **PJe do TJRJ (1º grau, login pelo jus.br/PDPJ):** o botão "CERTIFICADO DIGITAL" do jus.br chama o PJe Office, programa que não existe no servidor. O robô faz o papel dele (`src/pje-office.ts`): intercepta o pedido da página ao PJe Office dentro do próprio navegador, assina o desafio com o A1 do painel e entrega ao SSO, como o programa faria. Depois vem o código de 2 fatores, que o robô gera com o segredo `pdpj` do painel (o CNJ exige 2 fatores no jus.br desde 03/11/2025, mesmo com certificado). Testado com um SSO de teste que confere a assinatura e, em 23/11/2026, **no jus.br de verdade** pelo robô da pauta (TRT-15): certificado pelo PJe Office do robô e código do painel. Na mesma data o jus.br trocou o botão "CERTIFICADO DIGITAL" pelo link "Seu certificado digital"; o seletor aceita os dois. A assinatura vai ao SSO pelo próprio navegador (`contexto.request`), então sai pelo mesmo proxy do login quando há `NAVEGADOR_PROXY` (o WARP, contra o bloqueio do CloudFront ao IP do servidor). O 2º grau tem login próprio e fica com a pessoa.
- **DCP do TJRJ:** a pessoa entra pela tela remota. O login por certificado do tribunal (`www7.tjrj.jus.br`) pede o certificado de cliente numa renegociação TLS; se o Playwright apresentar o A1 ali (a testar), o certificado deixa de depender da pessoa. O duplo fator vem por e-mail, ou pelo Microsoft Authenticator se o advogado trocar (aí o robô pode gerar o código).
- **e-SAJ (TJSP, TJCE, TJAL, TJMS):** o login por certificado depende do Web Signer da Softplan, que não existe no servidor. O robô faz o papel dele (`src/web-signer.ts`, desde 24/11/2026): troca o `softplan-websigner.js` da página de login por uma versão própria com as mesmas funções (listar, ler o certificado, assinar o hash do desafio), e a assinatura sai do A1 do painel no Node do robô. O login por certificado do e-SAJ não pede o código por e-mail. Com `ESAJ_LOGIN=certificado` e `esaj` em `ROBO_CONECTORES`, o e-SAJ entra sozinho. Testado com uma página que imita o login e confere a assinatura; **falta o primeiro login no e-SAJ de verdade**. `WEB_SIGNER=nao` desliga (aí o login fica com a pessoa, pela tela remota).
- **Pessoa no circuito:** quando o robô precisa de alguém (login, código, CAPTCHA), a pessoa abre a tela do robô no navegador (noVNC), protegida por HTTPS e senha no Easypanel. É o mesmo que acontecia na janela do Mac, só que pelo navegador. O robô continua sem resolver CAPTCHA sozinho.
- **Certificado e 2 fatores no servidor:** decidido pelo usuário: a cópia do A1 vai também para o servidor, enviada pelo painel de robôs, e o segredo do TOTP de cada eproc fica configurado no painel. O robô lê os dois de uma pasta que o painel grava (contrato na seção [Painel de robôs](#painel-de-robôs-certificado-e-segredo-do-2fa)).
- **Depende de outra entrega:** as rotas `/api/robos/autos/*` só existem na branch `feat/processos-linha-do-tempo`. O robô do servidor só funciona depois que ela estiver em produção no ORQESTRAI.

## O que foi verificado e o que não foi

| Ponto | Situação |
|---|---|
| `clientCertificates` do Playwright (desde a v1.46; o robô usa a 1.65.0) com `.pfx` e senha, no navegador e nas requisições do contexto (`contexto.request`, usado pelo eproc para baixar documentos) | **Testado aqui**, com um servidor TLS local que exige certificado de cliente e um certificado de teste descartável: o servidor recebeu o certificado nas duas vias. |
| O intermediário do Playwright confere o certificado do servidor do tribunal | **Testado aqui**: com um servidor de certificado não confiável, ele recusou a conexão. |
| `certificado-sso.tjsp.jus.br` pede certificado de cliente já no aperto de mão TLS, aceita autoridades da ICP-Brasil, e tem certificado de servidor numa cadeia pública (o Node confia sem configuração extra) | **Verificado** com uma conexão TLS pública ao endereço, sem login. `sso.tjsp.jus.br` e `esaj.tjsp.jus.br` não pedem certificado de cliente. |
| `certificado-eproc-sso.tjrj.jus.br` (login por certificado do eproc do TJRJ) pede certificado de cliente no aperto de mão TLS | **Verificado** em 18/11/2026 com uma conexão TLS pública, sem login (o servidor manda o pedido de certificado, sem lista de autoridades). |
| `www7.tjrj.jus.br/autenticadorCertDigital` (login por certificado do DCP) pede o certificado de cliente por **renegociação** TLS 1.2, depois do aperto de mão | **Verificado** que o servidor renegocia (conexão pública, sem login). **Não verificado** se o intermediário do Playwright atende a renegociação com o A1: testar no servidor antes de contar com isso. |
| Senha errada e `.pfx` com cifra antiga (RC2) | **Testado aqui**: senha errada é recusada com mensagem clara e sem mostrar a senha. O `.pfx` exportado com RC2 (comum no Windows) só abre no Node com o provedor legado do OpenSSL; o robô (`NODE_OPTIONS` no `Dockerfile`) e o painel (`--openssl-legacy-provider`) rodam com ele, e o arquivo abre sem reexportar. |
| Contrato do painel (pasta, `certificado.json`, senha cifrada) e troca do certificado | **Testado aqui** (teste automático em `src/certificado.test.ts` e teste local de ponta a ponta). |
| Código TOTP gerado pelo robô (RFC 6238) e contrato `segundo-fator.json` | **Testado aqui** com os vetores das RFCs 4226 e 6238 e segredos fictícios (`src/segundo-fator.test.ts`). |
| Formato do 2FA do eproc: 6 dígitos, novo código a cada 30 s, aplicativos Google/Microsoft Authenticator | **Verificado nos manuais** do TJSP (6 dígitos, conta "eproc TJSP" no aplicativo) e do TJRJ (troca a cada 30 s). O algoritmo (SHA-1, padrão desses aplicativos) é inferência: se o QR code trouxer outro, grave a URI `otpauth://` inteira no painel e o robô usa os parâmetros dela. |
| Código gerado pelo robô aceito pelo eproc de verdade | **Não verificado** (não foi feito login em nada). |
| Imagem `mcr.microsoft.com/playwright:v1.65.0-noble` existe e traz Node e o usuário `pwuser` | **Verificado** na lista de tags do registro da Microsoft e no Dockerfile da imagem no repositório do Playwright. |
| Login real no eproc com o certificado do advogado | **Não verificado** (não foi feito login em nada). |
| Build da imagem (`docker build`) e funcionamento de Xvfb, x11vnc e noVNC no contêiner | **Não verificado** (Docker não foi usado neste estudo). |
| Web Signer em Linux | **Não confirmado**: a página de pré-requisitos do e-SAJ cita Linux baseado em Ubuntu (com Firefox 32 bits), texto sem data e antigo; a página de download da Softplan não abriu (cadeia de certificado incompleta no site). |
| Bloqueio de IP de datacenter pelo TJSP | **Sem fonte oficial atual.** Ver [Rede](#rede-e-destino). |
| Comportamento do Easypanel com volume compartilhado entre dois serviços e com reinício automático | **Não documentado** na página oficial de serviços; ver [Operação](#operação). |

## Como fica

```
Easypanel (mesmo servidor)
├── painel de robôs ──grava──► /srv/robos/certificados (certificado.json, .pfx, segundo-fator.json)
│                                     │ só leitura
└── robô de autos (contêiner) ◄──────┘
      ├── Chromium numa tela virtual (Xvfb) ──► eproc / e-SAJ
      ├── noVNC na porta 6080 ──► domínio HTTPS com Basic Auth (pessoa no circuito)
      └── volume /dados (perfil, PDFs em trânsito, diagnósticos)
            │
            └── fila e entrega do PDF ──► ORQESTRAI (Vercel) /api/robos/autos
```

## Navegador no contêiner

- **Imagem:** `mcr.microsoft.com/playwright:v1.65.0-noble`, fixa na mesma versão do pacote `playwright` do `package-lock.json`. Com versões diferentes o Playwright não acha o navegador; ao atualizar o pacote, atualize o `Dockerfile` junto.
- **Modo do navegador:** `NAVEGADOR_MODO=playwright`. No Mac o robô abre o Chrome como um navegador comum e se conecta a ele, porque só assim dá para instalar a extensão Web Signer. No servidor quem abre é o Playwright, e é esse modo que aceita o certificado em arquivo (`clientCertificates`). O Mac continua no modo antigo quando a variável não existe.
- **Com janela, numa tela virtual:** o Chromium roda com janela numa tela Xvfb (1366×900). Sem janela (`NAVEGADOR_HEADLESS=sim`) ninguém consegue resolver login, código ou CAPTCHA, e sites de tribunal tendem a estranhar navegador sem janela. Fica disponível, mas não é o recomendado.
- **Perfil persistente no volume:** `PASTA_DADOS=/dados` leva `perfil/`, `downloads/` e `diagnostico/` para o volume. Um contêiner novo tem outro nome de máquina e o Chrome acharia o perfil "em uso"; o script de início apaga essa trava, o que é seguro porque só existe um robô por volume.
- **Usuário:** o script de início roda como root só para acertar o dono do volume e copiar a chave do robô; o navegador e o robô rodam como `pwuser`. O Playwright desliga o sandbox do Chromium por padrão (`--no-sandbox`) e usa `--disable-dev-shm-usage`, o que evita depender de `--ipc=host`, que o Easypanel não oferece.

## Pessoa no circuito

Quando o robô chama `aguardarPessoa`, o pedido fica "aguardando pessoa" na ficha (como hoje) e o log mostra `TELA_REMOTA_URL`. A pessoa abre esse endereço, vê a janela do robô e resolve.

Opções pesadas:

| Opção | Como | Segurança | Recomendação |
|---|---|---|---|
| **noVNC atrás do proxy do Easypanel** | x11vnc lê a tela virtual; websockify + noVNC servem a tela pelo navegador na porta 6080; domínio HTTPS do Easypanel com **Basic Auth** (aba Security) | Três barreiras: HTTPS, Basic Auth no proxy e senha do VNC. O VNC só escuta dentro do contêiner. A senha do VNC usa só 8 caracteres: a proteção real é o Basic Auth com senha forte. | **Recomendada.** É o que o `Dockerfile` monta. |
| noVNC sem domínio, por túnel SSH | Porta 6080 publicada só em 127.0.0.1 do servidor; a pessoa abre um túnel SSH | Mais fechada, mas exige acesso SSH ao servidor para cada pessoa que for resolver | Boa para o técnico; ruim para o advogado. |
| Porta publicada direto na internet | — | Expõe a sessão logada do advogado | **Não usar.** |

Por que pesar tanto: quem entra na tela remota vê o navegador **logado como o advogado** no eproc (e no e-SAJ). Dali dá para consultar qualquer processo a que ele tenha acesso e até peticionar. Por isso:

- Basic Auth com usuário e senha fortes, compartilhados só com quem resolve (advogado e operador). Se o Easypanel permitir, restrinja também por IP (middleware do Traefik no domínio).
- `VNC_SENHA` diferente da senha do Basic Auth. Sem `VNC_SENHA`, a tela remota nem sobe.
- Dá para desligar o domínio da tela quando ninguém precisa dela; o robô segue rodando e os pedidos ficam "aguardando pessoa".

## Certificado digital

### eproc do TJSP: certificado em arquivo

- O SSO do eproc pede o certificado no endereço `certificado-sso.tjsp.jus.br`, já no aperto de mão TLS (conferido). É exatamente o caso do `clientCertificates` do Playwright: ele recebe o `.pfx` e a senha e apresenta o certificado só às origens indicadas. O padrão do robô é `CERTIFICADO_ORIGENS=https://certificado-sso.tjsp.jus.br`; os demais sites passam direto, sem certificado.
- Como funciona por dentro: o Playwright põe um intermediário local entre o navegador e a internet. Para a origem do certificado, ele abre a conexão com o tribunal apresentando o `.pfx` e confere o certificado do servidor do tribunal. O Chrome não mostra a lista de certificados.
- Depois do certificado, o eproc pede o código de 2 fatores. O robô gera o código com o segredo do TOTP cadastrado no painel ([contrato](#segredo-do-totp-2-fatores)); sem ele, busca no webhook do n8n (`ROBO_2FA_WEBHOOK_*`); sem os dois, espera a pessoa pela tela remota.
- **Formato do .pfx:** o `.pfx` exportado pelo Windows costuma usar a cifra antiga RC2, que o Node (OpenSSL 3) só abre com o provedor legado. O contêiner do robô e o painel rodam com `--openssl-legacy-provider` (18/11/2026: o primeiro certificado enviado ao painel veio assim), e o arquivo é aceito como está.

### e-SAJ: Web Signer

- O login por certificado no e-SAJ não é certificado de cliente TLS: a página pede ao **Web Signer** (extensão do navegador + aplicativo instalado no computador) que assine um desafio. O `clientCertificates` não serve para isso.
- O Web Signer não instala com o navegador aberto pelo Playwright (a Chrome Web Store recusa navegador em modo de automação; é por isso que o Mac usa o modo comum).
- Em Linux: a página de pré-requisitos do e-SAJ lista "Linux 32 bits ou 64 bits de distribuição baseada no Ubuntu", ligado ao Firefox 32 bits, sem data. A ajuda da Softplan sobre instalação no Chrome não fala de Linux. A página de download da Softplan não abriu neste estudo. **Não dá para afirmar que funciona num contêiner.**
- **Alternativas, em ordem de simplicidade:**
  1. **Dividir o trabalho:** robô do servidor com `ROBO_CONECTORES=eproc` e robô do Mac com `ROBO_CONECTORES=esaj`. O Mac continua com o Web Signer e o certificado no Acesso às Chaves. **Vale só durante a migração**: o usuário decidiu desligar o Mac quando tudo funcionar no servidor, e aí o e-SAJ fica com a alternativa 2.
  2. **CPF e senha no servidor** (`ESAJ_LOGIN=senha`): desde 24/03/2025 o e-SAJ do TJSP pede um código de verificação enviado ao e-mail do advogado no login por CPF e senha (o login por certificado não pede). Hoje o robô espera a pessoa digitar esse código pela tela remota. Automatizar a leitura do código no e-mail (pelo n8n, como no TOTP do eproc) é possível, mas é decisão dos advogados, porque o n8n passaria a ler a caixa de e-mail do advogado. A sessão do e-SAJ cai quando o navegador fecha: um login por reinício do robô.
  3. **Piloto do Web Signer em Linux:** um contêiner à parte com o Google Chrome no modo comum, a extensão e o aplicativo do Web Signer (se a Softplan oferecer pacote Linux) e o certificado no repositório de certificados do sistema. Trabalho exploratório, sem garantia.

### Guardar o certificado no servidor

A decisão de levar uma cópia do A1 ao servidor é do usuário e já foi tomada; o Mac continua com a dele. O que muda e como reduzir o risco:

- **Onde fica:** numa pasta do servidor (`/srv/robos/certificados`, por exemplo), gravada pelo painel de robôs e montada **só leitura** no robô. Nunca na imagem, no repositório, no `.env` versionado ou no volume `/dados` (que pode ir para backup junto com os diagnósticos).
- **A senha nunca fica em texto puro:** o painel cifra a senha com a **chave pública do robô**; só a chave privada, que existe apenas no serviço do robô, decifra. O `.pfx` já é cifrado pela própria senha. Quem pegar só a pasta não tem nem o certificado utilizável nem a senha.
- **Quem acessa:**
  - quem administra o Easypanel ou tem root no servidor consegue, em tese, juntar a pasta e a chave do robô. A cifra não protege contra essa pessoa; protege contra cópia da pasta, backup, erro de permissão e invasão só do painel;
  - quem usa o painel pode **trocar** o certificado, mas não consegue ler a senha de volta;
  - quem entra na tela remota usa a sessão já aberta, sem ver o certificado.
- **Riscos:**
  - O A1 permite agir como o advogado (peticionar, assinar) até vencer ou ser revogado. Uma cópia vazada vale como o próprio advogado.
  - Passam a existir duas cópias (Mac e servidor): as duas precisam ser trocadas no vencimento e revogadas se houver vazamento. Quando o Mac for desligado, decida se a cópia dele continua no Acesso às Chaves (o advogado pode usá-la no dia a dia) ou sai.
  - O intermediário do Playwright guarda o `.pfx` e a senha na memória do processo do robô enquanto ele roda.
- **O que reduz o risco:** acesso ao Easypanel só para quem precisa; senha forte e única no painel de robôs; tela remota com Basic Auth; pasta de certificados fora dos backups do volume; registro de quem enviou cada certificado; revogação imediata na autoridade certificadora se houver suspeita.

## Painel de robôs: certificado e segredo do 2FA

O painel de robôs (outro app no mesmo Easypanel, código fora deste repositório) passa a receber o certificado e o segredo do TOTP de cada eproc. Este é o contrato que ele precisa cumprir para o robô usar os dois sem reiniciar. O segredo do TOTP segue o mesmo modelo do certificado: mesma pasta, mesma chave do robô, mesma cifra (detalhes em [Segredo do TOTP](#segredo-do-totp-2-fatores)).

### Como o painel entrega ao robô: opções

| Opção | Segurança | Troca no vencimento | Reinício do robô |
|---|---|---|---|
| **A. Pasta do servidor compartilhada** (bind mount: painel lê e grava; robô só lê) | Boa: a senha vai cifrada para o robô; o painel não consegue ler a senha de volta; nada trafega pela rede | O painel grava os arquivos novos; o robô percebe em até ~30 s | Não precisa: o robô reabre o navegador com o certificado novo |
| B. Painel guarda e o robô busca por uma rota autenticada | Boa se a senha for cifrada para o robô; exige token entre os dois, rota nova no painel e o painel no ar sempre que o robô inicia | O robô consulta a rota de tempos em tempos | Não precisa, mas há mais código e mais pontos de falha |
| C. À mão, nas variáveis e montagens do Easypanel | Senha visível na tela do Easypanel; sem validação nem aviso de vencimento | Alguém edita e faz deploy | Precisa de deploy |

**Recomendação: A**, enquanto painel e robô estiverem no mesmo servidor. Se um dia ficarem em servidores diferentes, vale a B com o mesmo formato de arquivo.

### Chave do robô (uma vez)

Gerada fora do repositório, por quem administra o servidor:

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out robo-certificado.key
openssl pkey -in robo-certificado.key -pubout -out robo-certificado.pub
```

- `robo-certificado.key` (privada): fica no servidor, em `/srv/robos/segredos` (dono root, `0600`), e chega aos serviços do robô por bind dessa pasta em `/segredos`, apontada por `CERTIFICADO_CHAVE_PRIVADA_ARQUIVO`. Ninguém copia o conteúdo dela para tela, conversa ou campo do Easypanel.
- `robo-certificado.pub` (pública, não é segredo): no painel, numa variável como `ROBO_CERTIFICADO_CHAVE_PUBLICA`.

### Formulário de envio

- Só para usuários do painel com permissão de administrar o robô.
- Campos: arquivo do certificado (`.pfx` ou `.p12`, até 100 KB; um A1 tem poucos KB) e senha (campo de senha, sem autocompletar).
- Botão "Validar e salvar". A senha vai só ao servidor do painel, por HTTPS, e não é gravada em banco, log nem arquivo em texto puro.

### Validação (no servidor do painel, antes de gravar)

1. Abrir o PKCS#12 com a senha (em Python: `cryptography.hazmat.primitives.serialization.pkcs12.load_key_and_certificates`; em Node, uma biblioteca como `node-forge`). Senha errada: recusar com "A senha não abre o certificado".
2. Conferir que há chave privada e certificado, e que o certificado não venceu.
3. Mostrar a quem enviou, sem expor a chave: titular (CN do certificado), emissor, início e fim da validade. Não mostrar nem registrar a chave privada nem a senha.
4. Abrir com o provedor legado do OpenSSL (`node --openssl-legacy-provider`), como o robô: assim o `.pfx` com RC2, comum no Windows, é aceito como está.

### Gravação na pasta compartilhada

Pasta montada no painel (leitura e escrita) e no robô (só leitura), por exemplo `/srv/robos/certificados` no servidor. Ordem, para o robô nunca ver um arquivo pela metade:

1. Gravar o `.pfx` com um nome novo, ex. `certificado-20261117T150000Z.pfx`, num arquivo temporário na mesma pasta e renomear (renomear é atômico).
2. Cifrar a senha com a chave pública do robô: **RSA-OAEP com SHA-256** (também no MGF1), resultado em base64. Em Node: `crypto.publicEncrypt({ key, padding: RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" }, senha)` (a função `cifrarSenha` em `src/certificado.ts` é a referência). Em Python: `public_key.encrypt(senha, padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None))`.
3. Gravar `certificado.json` por último, também por arquivo temporário e renomeação:

```json
{
  "formato": "orqestrai-certificado/1",
  "arquivo": "certificado-20261117T150000Z.pfx",
  "sha256": "<sha256 do .pfx, em hexadecimal>",
  "senha_cifrada": "<base64>",
  "valido_ate": "2027-11-17T23:59:59Z",
  "titular": "<CN do certificado>",
  "emissor": "<CN do emissor>",
  "enviado_em": "2026-11-17T15:00:00Z",
  "enviado_por": "<usuário do painel>"
}
```

O robô exige `formato`, `arquivo` (só o nome, na mesma pasta), `sha256` e `senha_cifrada`; usa `valido_ate` para avisar do vencimento no log. Os demais campos são para o painel.

4. Manter o `.pfx` anterior até o robô adotar o novo (para voltar atrás, basta regravar o `certificado.json` antigo) e apagar os mais velhos, deixando no máximo dois.

**Permissões:** pasta `0750` e arquivos `0640`, do usuário e grupo do painel (`1000`). O robô lê porque o script de início põe o `pwuser` no grupo da pasta; ninguém mais lê. O robô não escreve nessa pasta.

### Aviso de vencimento

- O painel guarda (sem a senha) titular, validade e quem enviou, e avisa com 30, 15, 7 e 1 dia de antecedência, pelo canal que a equipe já usa.
- O robô também escreve no log, ao carregar o certificado, "vence em N dias" (a partir de 30) e "venceu em …".
- Certificado vencido não entra: o eproc recusa o login e o robô passa o login para a pessoa.

### Como o robô percebe o certificado novo

- Entre um pedido e outro (com a fila vazia, a cada `INTERVALO_SEGUNDOS`, 30 s por padrão), o robô lê o `certificado.json`. Se o conteúdo mudou, ele confere o novo (sha256, senha, abertura do `.pfx`).
- Válido: fecha o navegador e reabre com o certificado novo. A sessão do eproc recomeça (login com certificado e código de 2 fatores).
- Inválido: segue com o anterior e escreve o motivo no log (sem senha nem conteúdo).
- Sem certificado ainda (painel não enviou): o robô sobe assim mesmo, e o login por certificado fica com a pessoa até chegar um válido.

### Segredo do TOTP (2 fatores)

**O que é.** Quando o advogado liga a autenticação em 2 fatores no eproc, a tela mostra um QR code e, junto, o "código para gerar o OTP" (letras A–Z e dígitos 2–7, em base32). É esse código que vai para o painel. O aplicativo do celular e o robô passam a gerar os mesmos códigos de 6 dígitos a cada 30 s. Um segredo por sistema:

| Sistema no contrato | Tribunal |
|---|---|
| `eproc` | eproc do TJSP |
| `eproc-tjrj` | eproc do TJRJ (cadastro e segredo próprios) |
| `pdpj` | SSO nacional da PDPJ (jus.br), usado pelo PJe do TJRJ no 1º grau: depois do certificado (PJe Office do robô), o robô digita o código |

Se o 2FA já foi ligado e ninguém guardou o código, ele não aparece de novo: é preciso desativar e ativar o 2FA no eproc ("Autenticação em 2 fatores", na tela inicial), cadastrar o QR code novo no celular do advogado e o código no painel, no mesmo momento. O registro antigo do celular deixa de valer.

**Quem guarda o quê.** O segredo gera o código sem o celular: quem tem o segredo e o certificado (ou a senha) entra como o advogado. Por isso ele segue o mesmo caminho da senha do certificado: cifrado com a chave pública do robô, gravado só na pasta compartilhada, nunca no banco do painel, em log, em variável do Easypanel ou no volume `/dados`.

**Cifra.** Igual à da senha do certificado: **RSA-OAEP com SHA-256**, com a chave pública do robô, sobre o texto do segredo em UTF-8, resultado em base64. O texto pode ser o código base32 (com ou sem espaços) ou a URI inteira do QR code (`otpauth://totp/...?secret=...`); com a URI, o robô usa `algorithm`, `digits` e `period` dela. Um segredo cabe de sobra numa chave RSA de 3072 bits.

**Arquivo `segundo-fator.json`**, na mesma pasta do `certificado.json` (o robô lê de `ROBO_2FA_PASTA` ou, sem ela, de `CERTIFICADO_PASTA`):

```json
{
  "formato": "orqestrai-segundo-fator/1",
  "sistemas": {
    "eproc": {
      "segredo_cifrado": "<base64>",
      "enviado_em": "2026-11-18T15:00:00Z",
      "enviado_por": "<usuário do painel>"
    },
    "eproc-tjrj": {
      "segredo_cifrado": "<base64>",
      "enviado_em": "2026-11-18T15:05:00Z",
      "enviado_por": "<usuário do painel>"
    }
  }
}
```

O robô exige `formato` e `sistemas`, e de cada sistema só `segredo_cifrado`. Os demais campos são para o painel.

**Gravação.**

1. Ler o `segundo-fator.json` atual (se houver) e trocar **só** o item do sistema enviado. Os outros itens continuam como estão: o painel copia o `segredo_cifrado` deles sem decifrar (nem consegue).
2. Gravar num arquivo temporário na mesma pasta e renomear (atômico), como o `certificado.json`. Permissão `0640`.
3. Remover um segredo = gravar o arquivo sem aquele item. O robô passa a usar o webhook ou a pessoa.

**Validação no painel, antes de gravar.**

1. Normalizar (tirar espaços e hífens, maiúsculas) e conferir que é base32 com pelo menos 16 caracteres, ou uma URI `otpauth://totp/` com `secret`.
2. **Conferência recomendada:** pedir também o código de 6 dígitos que o aplicativo do advogado mostra naquele momento e conferir que o segredo gera esse código (aceitando a janela anterior e a seguinte, ±30 s; referência: `conferirCodigo` em `src/segundo-fator.ts`). Isso prova que o segredo é o certo sem tentar login no tribunal. Código diferente: recusar com "O segredo não gera o código do aplicativo".
3. Depois de cifrar, descartar o segredo da memória da requisição. A resposta mostra só "cadastrado em … por …", nunca o segredo, nem parte dele.

**Como o robô usa.**

- A cada tela de código do eproc, o robô lê o `segundo-fator.json`, decifra o segredo do sistema e gera o código do instante. Trocar o segredo no painel vale no próximo login, sem reiniciar.
- Se faltam menos de 5 s para o código trocar, ele espera o próximo. Código recusado: tenta mais um, da janela seguinte (nunca repete um código recusado), limpa o campo e passa para o webhook do n8n; se o webhook não existir ou falhar, para a pessoa pela tela remota.
- Nem o segredo nem o código vão para log, diagnóstico ou captura de tela; o log diz só "código gerado pelo segredo do painel e aceito" ou o motivo de não ter usado (arquivo inválido, chave errada, segredo não aceito).
- **Relógio:** o TOTP depende da hora certa. VPS costuma ter NTP ligado; se o código for recusado sempre, confira a hora do servidor (`date -u`) antes de suspeitar do segredo.

### Tela de configuração no painel

O que o painel tem (o código está no repositório do painel, fora deste):

- **Acesso:** só quem administra o robô de autos: a senha do painel (que hoje só o administrador tem) ou, com `PAINEL_ADMINS`, o login próprio de cada administrador. Conferido no servidor, não só escondendo o menu.
- **Certificado A1:** upload do `.pfx`/`.p12` e campo de senha (`type=password`, `autocomplete=off`); botão "Validar e salvar" ([validação](#validação-no-servidor-do-painel-antes-de-gravar)). Mostra titular, emissor, validade, quem enviou e quando. Nunca mostra a senha.
- **Segredo do 2FA, um bloco por sistema** (eproc TJSP, eproc TJRJ): campo do segredo (`type=password`, `autocomplete=off`, sem botão de "mostrar"), campo do código atual do aplicativo (conferência), botões "Salvar" e "Remover". Mostra só "configurado em … por …" ou "não configurado".
- **Registro de alterações:** cada troca grava quem, quando e o quê ("certificado trocado", "segredo do eproc-tjrj trocado", "segredo do eproc removido"), sem valor nenhum, nem hash. Fica visível na própria tela.
- **No servidor do painel:** HTTPS (proxy do Easypanel); envio só em JSON, com cabeçalho próprio e da mesma origem (contra envio de outro site com a senha guardada no navegador); atraso a cada senha errada; corpo da requisição fora dos logs; a chave pública do robô numa variável (`ROBO_CERTIFICADO_CHAVE_PUBLICA`); a chave privada **nunca** no painel.

## Rede e destino

- **`ORQESTRAI_URL`:** o endereço de produção do ORQESTRAI (Vercel). Hoje o robô do Mac aponta para o servidor local de desenvolvimento.
- **Dependência:** as rotas `/api/robos/autos/proximo`, `/api/robos/autos/capa` e `/api/robos/autos/pedidos/[pedidoId]` existem só nesta branch (`feat/processos-linha-do-tempo`). Antes do robô do servidor: juntar a branch, publicar na Vercel, aplicar a migration `20261110160000_processos_autos.sql` (fila e bucket privado `processos-autos`) no banco de produção e configurar `ROBO_AUTOS_TOKEN` na Vercel. Sem o token no servidor, as rotas respondem 503.
- **Dois robôs ao mesmo tempo:** a fila já reserva cada pedido para um robô. Com `ROBO_CONECTORES`, cada um só pede o que atende. A capa pelo DataJud deve ficar ligada em um só (`CAPA_DATAJUD=nao` no outro), porque o DataJud recusa consultas em sequência.
- **IP de datacenter:** não achei regra oficial atual do TJSP sobre IP de datacenter. O que existe: comunicado de 15/07/2019 da Presidência do TJSP (reproduzido pela AASP) atribuindo lentidão do e-SAJ ao uso excessivo por robôs externos; e atas de 2021 do Comitê Gestor de TI do TJSP, que a busca indicou citar bloqueio de IPs com volume alto de requisições e limite de requisições para IPs internacionais (não consegui abrir o texto das atas para confirmar). Na prática: servidor com IP no Brasil, o ritmo atual do robô (um processo por vez, com pausas) e um piloto curto antes de pôr a fila toda.

## Operação

- **Um contêiner, um navegador:** em cada serviço, réplicas = 1 e **sem** "zero-downtime deployment" (dois contêineres no mesmo volume brigariam pelo perfil do navegador). Cada serviço tem o seu volume.
- **Logs:** o robô escreve no terminal; no Easypanel, aba Logs do serviço. Os logs não trazem senha, certificado nem código de 2 fatores; trazem o número dos processos atendidos, como no Mac.
- **Reinício:** se o robô cair, o processo principal termina e o contêiner para. A página oficial do Easypanel não descreve a política de reinício automático: no primeiro teste, encerre o robô de propósito e confira se o serviço volta sozinho. Quando volta, a sessão do tribunal recomeça (novo login). Trocar o certificado não exige reinício.
- **Recursos (estimativa, não medida):** 2 vCPU; memória com reserva de 1,5 GB e limite de 3 GB (o Chromium com janela usa de 0,5 a 1 GB, e o eproc monta o PDF dos autos na memória, que pode chegar a 200 MB). Disco: 5 GB no volume.
- **Volume `/dados`:** `perfil/` (sessão dos tribunais), `downloads/` (PDF em trânsito) e `diagnostico/` (capturas e HTML das telas, que podem ter dados de processos).
- **Limpeza:** o PDF sai de `downloads/` logo depois do envio (como hoje); a cópia temporária que o navegador guarda de cada download do e-SAJ agora também é apagada na hora; no início do contêiner saem diagnósticos com mais de `DIAGNOSTICO_DIAS` (7) e PDFs esquecidos de pedidos interrompidos.
- **Fuso:** `TZ=America/Sao_Paulo`, para os horários do log baterem com os do escritório.

## Passo a passo no Easypanel

Só depois de as rotas estarem em produção (ver [Rede](#rede-e-destino)). Nenhum valor real vai para o repositório: senhas, token, chave privada, certificado e segredos entram só no Easypanel e no painel.

### Três serviços no projeto `bibliotecaBP`

O servidor roda o robô em três serviços, do mesmo código e da mesma imagem, para os tribunais andarem em paralelo (dentro de cada serviço, um processo por vez, no ritmo que o tribunal aguenta):

| Serviço | `ROBO_NOME` | `ROBO_CONECTORES` no fim | Login |
|---|---|---|---|
| `robo-autos-eproc-tjsp` | `servidor-eproc-tjsp` | `eproc:TJSP` | Sozinho: certificado A1 e código do segredo do painel |
| `robo-autos-tjrj` | `servidor-tjrj` | `eproc:TJRJ,dcp,pje` | eproc e PJe (1º grau) sozinhos: certificado (no PJe, pelo PJe Office do robô) e código do painel; DCP pela pessoa, pela tela remota |
| `robo-autos-esaj` | `servidor-esaj` | `esaj` (TJSP, TJCE, TJAL, TJMS) | Pela pessoa: CPF, senha e código do e-mail |

- **TJRJ num serviço só:** o DCP devolve ao eproc do TJRJ o processo já migrado e usa a sessão do eproc. Separados, seriam dois logins do mesmo advogado no eproc do TJRJ.
- **Cada serviço tem** o seu volume `/dados` (perfil do navegador e sessões), a sua tela remota (domínio próprio, com Basic Auth) e o seu `ROBO_NOME`. A pasta do certificado e a chave do robô são as mesmas nos três, montadas só leitura.
- **Capas pelo DataJud:** só no `robo-autos-eproc-tjsp` (`CAPA_DATAJUD=sim` a partir da etapa 4); `nao` nos outros dois.
- **Memória:** cada serviço tem o seu navegador: limite de 3 GB em cada um (até 9 GB no total, uso típico de 1 a 2 GB por serviço). Confira a sobra do servidor antes de subir os três.

### Migração do Mac para o servidor

O Mac continua ligado e atendendo o que ainda não passou, e cada sistema muda de lado só depois de funcionar no servidor. Quem divide o trabalho é `ROBO_CONECTORES`: a fila reserva cada pedido para um robô, e cada um só pede o que está na sua lista. Um sistema nunca fica em duas listas ao mesmo tempo (seriam dois logins do mesmo advogado no mesmo tribunal).

| Etapa | `robo-autos-eproc-tjsp` | `robo-autos-tjrj` | `robo-autos-esaj` | Mac (`ROBO_CONECTORES`) |
|---|---|---|---|---|
| 1 | `eproc:TJSP` | `eproc:TJRJ` | parado | `esaj,dcp,pje` |
| 2 | `eproc:TJSP` | `eproc:TJRJ,pje` | parado | `esaj,dcp` |
| 3 | `eproc:TJSP` | `eproc:TJRJ,dcp,pje` | parado | `esaj` |
| 4 | `eproc:TJSP` | `eproc:TJRJ,dcp,pje` | `esaj` | robô desligado |

Enquanto o DCP estiver no Mac (etapas 1 e 2), o eproc do TJRJ fica nos dois lados só para os processos que o DCP devolve ao eproc: o robô do Mac abre a sessão do eproc do TJRJ dele nesses casos.

**Para passar de uma etapa à seguinte:**

1. No Easypanel, acrescente o sistema em `ROBO_CONECTORES` do serviço da tabela (ou ligue o `robo-autos-esaj`) e faça o deploy desse serviço (a sessão dos tribunais dele recomeça: novos logins).
2. No mesmo momento, tire o sistema do `ROBO_CONECTORES` do `.env` do Mac e reinicie o robô do Mac.
3. Acompanhe os primeiros pedidos desse sistema nos logs do servidor e na ficha do processo (o nome do robô, `ROBO_NOME`, aparece em cada pedido). Para considerar o sistema funcionando no servidor: pelo menos um login completo pela tela remota (ou sozinho), e alguns pedidos concluídos sem erro, incluindo um com documentos novos.
4. Deu problema? Volte o sistema para o Mac (o inverso dos passos 1 e 2) e anote o motivo; os diagnósticos ficam em `/dados/diagnostico` no servidor.

**Etapa 4, desligar o Mac:** só quando os quatro sistemas tiverem passado pelo passo 3 no servidor. Antes de desligar, mude `CAPA_DATAJUD` para o servidor (ligue no `robo-autos-eproc-tjsp` e desligue no Mac): só um robô completa capas pelo DataJud. Guarde o `.env` do Mac fora do repositório, para voltar se for preciso.

**Durante a migração:**
- Conectores que ainda não foram rodados no servidor (DCP, PJe e e-SAJ no modo do contêiner) podem estranhar o navegador do Playwright em algum detalhe (janela nova, download). Por isso a etapa de teste existe: o que aparecer vira ajuste no conector antes de passar o próximo sistema.

### 1. Gerar a chave do robô

Gerada por quem administra o servidor, fora do repositório ([comandos](#chave-do-robô-uma-vez)). A mesma chave serve para a senha do certificado e para os segredos do TOTP.

**Já feito em 18/11/2026:** o par foi gerado direto no servidor, em `/srv/robos/segredos` (`robo-certificado.key`, root, `0600`; e `robo-certificado.pub`), e a pública foi para a `ROBO_CERTIFICADO_CHAVE_PUBLICA` do `painel-robos`. Para conferir que a privada é o par da pública do painel, compare as impressões digitais, sem imprimir a privada:

```bash
# no servidor, como root
openssl pkey -in /srv/robos/segredos/robo-certificado.key -pubout -outform DER | openssl dgst -sha256
openssl pkey -pubin -in /srv/robos/segredos/robo-certificado.pub -outform DER | openssl dgst -sha256
```

A prova final é o log do robô ao subir: "Certificado do painel carregado (…)" só aparece quando a privada decifra a senha que o painel cifrou com a pública.

### 2. Pasta compartilhada no servidor

```bash
sudo mkdir -p /srv/robos/certificados
sudo chown 1000:1000 /srv/robos/certificados
sudo chmod 0750 /srv/robos/certificados
```

Dono e grupo: `1000`, o usuário `node` com que o painel grava (imagem `node:22-alpine`). O painel grava os arquivos com `0640`; o script de início do robô põe o `pwuser` no grupo da pasta (o `1000`) antes de rodar o robô, e assim ele lê sem a pasta ficar aberta para todos. Fora dos backups do volume `/dados`.

### 3. Serviços do robô (App), um por linha da [tabela](#três-serviços-no-projeto-bibliotecabp)

Os três serviços são iguais, menos `ROBO_NOME`, `ROBO_CONECTORES`, `CAPA_DATAJUD`, o volume e o domínio da tela remota.

1. **Fonte:** o repositório no GitHub, branch com o robô; **Build Path** `/robos/autos`; construção por **Dockerfile** (`Dockerfile`).
2. **Environment** (valores só no Easypanel):

   | Variável | Valor |
   |---|---|
   | `ORQESTRAI_URL` | endereço de produção do ORQESTRAI |
   | `ROBO_AUTOS_TOKEN` | o mesmo da Vercel |
   | `ROBO_NOME` | o da [tabela](#três-serviços-no-projeto-bibliotecabp) |
   | `ROBO_CONECTORES` | o do serviço na [etapa da migração](#migração-do-mac-para-o-servidor) |
   | `EPROC_LOGIN` | `certificado` |
   | `EPROC_TJRJ_LOGIN` | `certificado` |
   | `ESAJ_LOGIN` | `manual` (sem Web Signer no servidor: a pessoa entra com CPF, senha e o código do e-mail pela tela remota) |
   | `CERTIFICADO_PASTA` | `/certificados` |
   | `CERTIFICADO_CHAVE_PRIVADA_ARQUIVO` | `/segredos/robo-certificado.key` |
   | `CERTIFICADO_ORIGENS` | `https://certificado-sso.tjsp.jus.br,https://certificado-eproc-sso.tjrj.jus.br`; na etapa 3, para testar o certificado do DCP, acrescente `,https://www7.tjrj.jus.br` |
   | `ROBO_2FA_WEBHOOK_URL`, `ROBO_2FA_WEBHOOK_TOKEN` | os do n8n, só se quiser a alternativa ao segredo do painel |
   | `VNC_SENHA` | senha da tela remota |
   | `TELA_REMOTA_URL` | `https://<domínio da tela>/vnc.html` |
   | `CAPA_DATAJUD` | `nao`; no `robo-autos-eproc-tjsp`, `sim` a partir da etapa 4 |

   O segredo do TOTP **não** vai em variável: o robô lê o `segundo-fator.json` da mesma pasta do certificado. `ROBO_2FA_PASTA` só é preciso se o painel gravar o segredo em outra pasta. `NAVEGADOR_MODO`, `NAVEGADOR_CANAL`, `PASTA_DADOS`, `DISPLAY` e `TZ` já vêm do `Dockerfile`.
3. **Mounts:**
   - **Volume** em `/dados` (perfil, PDFs em trânsito, diagnósticos), um por serviço;
   - **Bind** de `/srv/robos/certificados` em `/certificados` (o formulário do Easypanel 2.37 não tem opção de só leitura: o robô não escreve nessa pasta, e as permissões da pasta no servidor fazem o resto);
   - **Bind** de `/srv/robos/segredos` em `/segredos`: a pasta do servidor onde está a chave privada do robô. A chave não sai do servidor e ninguém precisa copiá-la. O script de início, que começa como root, copia a chave para `/run/robo/certificado.key`, que só o `pwuser` lê, fora do volume.
4. **Domains:** um domínio por serviço para a tela remota, HTTPS, porta **6080**; em Security, **Basic Auth** ligado, com usuário e senha diferentes da `VNC_SENHA`. O `TELA_REMOTA_URL` de cada serviço aponta para o domínio dele.
5. **Resources:** por serviço, limite de 2 vCPU e 3 GB de memória, reserva 0 (uma reserva maior que a sobra do servidor impede o serviço de subir) ([Operação](#operação)).
6. **Deploy:** 1 réplica, **sem** zero-downtime (aba Avançado; o Easypanel cria o serviço com ele ligado). **Antes do primeiro deploy**, ligue o Basic Auth do domínio (aba Segurança): sem ele, a tela remota fica protegida só pela `VNC_SENHA`.

### 4. Painel de robôs

A tela de configuração está no repositório do painel (`painel/config.js` e `painel/config.html`, rota `/config`). No serviço `painel-robos`:

1. **Bind** de `/srv/robos/certificados` em `/robos-autos` (leitura e escrita).
2. **Variáveis:**
   - `ROBO_AUTOS_PASTA=/robos-autos`;
   - `ROBO_CERTIFICADO_CHAVE_PUBLICA`: o conteúdo de `robo-certificado.pub` (não é segredo), ou o mesmo em base64 (`base64 < robo-certificado.pub | tr -d '\n'`), que cabe numa linha;
   - opcional, `PAINEL_ADMINS`: só se a configuração não deve abrir com a senha do painel (por exemplo, quando mais gente passar a ver o painel). Quem pode trocar certificado e segredos, cada um como `usuario=scrypt:…`, separados por vírgula. A linha de cada pessoa sai de `node painel/senha-admin.js <usuario>`, rodado por ela no próprio computador (a senha não aparece na tela e não fica em lugar nenhum; só o hash vai para a variável).
3. Deploy do painel. Sem as duas primeiras variáveis, `/config` responde que a área está desligada e o painel de leitura segue igual.

Decisão do usuário (18/11/2026): só quem administra os robôs tem a senha do painel, então a `/config` abre com essa mesma senha e o registro de alterações mostra o usuário do painel. Com `PAINEL_ADMINS`, a área passa a exigir login próprio por pessoa, e é esse usuário que fica no registro.

### 5. Certificado e segredos pelo painel

Quem administra o robô entra no painel e envia:

1. o certificado A1 e a senha;
2. o segredo do TOTP do eproc do TJSP, com o código atual do aplicativo do advogado para conferência;
3. o segredo do TOTP do eproc do TJRJ, do mesmo jeito.

O robô adota o certificado em até ~30 s (com a fila vazia) e lê os segredos no próximo login. Nos logs: "Certificado em arquivo carregado (…)", sem conteúdo.

### 6. Robô do Mac (etapa 1)

No `.env` do Mac: `ROBO_CONECTORES=esaj,dcp,pje` e `CAPA_DATAJUD` como está (o Mac segue completando as capas até a etapa 4). Reinicie o robô do Mac. Daqui em diante, siga a [migração](#migração-do-mac-para-o-servidor).

### 7. Primeiro teste (eproc, serviços `robo-autos-eproc-tjsp` e `robo-autos-tjrj`)

1. Com um pedido do eproc do TJSP na fila, acompanhe os logs do serviço. O esperado: "Sessão do eproc … fechada: iniciando o login (certificado)", depois "Código de 2 fatores gerado pelo segredo do painel e aceito. Login concluído."
2. Se aparecer "PRECISA DE UMA PESSOA", abra a tela remota e resolva; o log diz antes o motivo (certificado não aceito, segredo não aceito, CAPTCHA).
3. Repita com um pedido do eproc do TJRJ.
4. Encerre o robô de propósito uma vez e confira se o serviço volta sozinho ([Operação](#operação)).

### 8. Etapas seguintes

PJe, DCP e e-SAJ, um de cada vez, como na [migração](#migração-do-mac-para-o-servidor). Em cada uma, a pessoa que faz o login precisa do endereço da tela remota e das senhas do Basic Auth e do VNC.

### Voltar atrás

Enquanto o Mac não foi desligado: volte para ele o sistema com problema (ou todos, tirando `ROBO_CONECTORES` do `.env` do Mac) e tire o mesmo sistema do servidor, ou pare o serviço do robô no Easypanel. Um pedido que o servidor tinha reservado quando parou pode precisar ser liberado na ficha do processo.

`docker/compose.exemplo.yml` reúne o mesmo serviço em formato compose, para referência.

## Robô da Pauta de Audiências (PJe-JT)

O mesmo código e a mesma imagem rodam um segundo programa, `src/pauta.ts`, num serviço à parte (`robo-pauta`). Ele entra no PJe da Justiça do Trabalho como o advogado do certificado, lê a "Minha Pauta" e manda o resultado ao ORQESTRAI (`POST /api/robos/pauta`, com o mesmo `ROBO_AUTOS_TOKEN`). No tribunal, só lê. O módulo que recebe a pauta está em `docs/pauta-audiencias/PLANO.md`, na raiz do repositório.

### Como entra

1. Abre `https://pje.trtNN.jus.br/primeirograu/login.seam` e clica em "Entrar com PDPJ".
2. No SSO da PDPJ (`sso.cloud.pje.jus.br`), clica no botão do certificado. O PJe Office do robô (`src/pje-office.ts`) assina o desafio com o certificado A1 do painel: sem PJe Office instalado e sem CPF e senha.
3. Se o SSO pedir o código de 2 fatores, o robô gera com o segredo `pdpj` do painel ([Segredo do TOTP](#segredo-do-totp-2-fatores)). Sem esse segredo, tenta o webhook do n8n (`ROBO_2FA_WEBHOOK_URL` com `?sistema=pdpj`). Sem os dois, avisa no log e espera a pessoa digitar pela tela remota (até `ESPERA_PESSOA_MINUTOS`, 15).
4. A sessão fica no perfil do volume `/dados`. As leituras seguintes aproveitam e só refazem o login quando ela cai.
5. Com a sessão aberta, chama a consulta da Minha Pauta (designadas e canceladas, de hoje até `PAUTA_DIAS` à frente) em cada tribunal de `PAUTA_TRIBUNAIS`.

A Minha Pauta só mostra os processos em que o advogado do certificado está habilitado. Os outros advogados da área ficam com o DJEN até cada um ter o seu login no robô.

### Serviço `robo-pauta` no projeto `bibliotecaBP`

Igual aos [serviços do robô de autos](#3-serviços-do-robô-app-um-por-linha-da-tabela), com estas diferenças:

1. **Fonte:** branch `feat/robo-pauta-certificado` (traz a branch do robô de autos e o main); **Build Path** `/robos/autos`; **Dockerfile**.
2. **Environment** (valores só no Easypanel):

   | Variável | Valor |
   |---|---|
   | `ROBO_COMANDO` | `pauta-teste` no primeiro teste; `pauta-ciclo` quando o ORQESTRAI estiver pronto para receber |
   | `ROBO_NOME` | `servidor-pauta` |
   | `PAUTA_TRIBUNAIS` | `TRT15`; outros tribunais separados por vírgula, depois do primeiro teste |
   | `PAUTA_DIAS` | `60` |
   | `PAUTA_HORARIOS` | `06:45,11:45,16:45` (horário de Brasília) |
   | `CERTIFICADO_PASTA` | `/certificados` |
   | `CERTIFICADO_CHAVE_PRIVADA_ARQUIVO` | `/segredos/robo-certificado.key` |
   | `ROBO_2FA_WEBHOOK_URL`, `ROBO_2FA_WEBHOOK_TOKEN` | os do n8n, só se o segredo `pdpj` não estiver no painel |
   | `VNC_SENHA` | senha da tela remota deste serviço |
   | `TELA_REMOTA_URL` | `https://<domínio da tela>/vnc.html` |
   | `ORQESTRAI_URL`, `ROBO_AUTOS_TOKEN` | os de produção; no `pauta-teste` podem ficar de fora |

   Não precisa de `ROBO_CONECTORES`, `EPROC_*`, `ESAJ_LOGIN`, `CERTIFICADO_ORIGENS` nem `CAPA_DATAJUD`: o programa da pauta não atende a fila de autos, e o PJe Office do robô só responde ao SSO da PDPJ.
3. **Mounts:** volume `/dados` **próprio** (o perfil do navegador é de um robô só); binds de `/srv/robos/certificados` em `/certificados` e de `/srv/robos/segredos` em `/segredos`, os mesmos dos outros serviços.
4. **Domains:** domínio próprio para a tela remota, HTTPS, porta **6080**, com **Basic Auth** ligado antes do primeiro deploy.
5. **Resources:** 1 vCPU e 2 GB de memória bastam (uma aba aberta poucas vezes ao dia); reserva 0.
6. **Deploy:** 1 réplica, sem zero-downtime.

### Primeiro teste (`ROBO_COMANDO=pauta-teste`)

O robô lê logo ao subir e de novo em cada horário de `PAUTA_HORARIOS`, sem mandar nada ao ORQESTRAI. Ele fica de pé entre as leituras, para o serviço não reiniciar em laço e refazer o login sem parar.

1. Confira no painel que o certificado está válido e, se houver, que o segredo `pdpj` está cadastrado.
2. Faça o deploy e acompanhe os logs. O esperado, nesta ordem:
   - "Certificado do painel carregado (…)" e "Robô da pauta · TRT15 · login pelo certificado do painel · teste (só lê) · ciclo";
   - "TRT15: entrando pelo certificado (PJe Office do robô).";
   - "Código de 2 fatores gerado pelo segredo do painel e aceito. Login concluído." (ou "obtido do webhook e aceito");
   - "TRT15: login concluído." e "TRT15: N registro(s) lido(s) de … a … · …", só com contagens;
   - "TRT15: teste de acesso OK. Nada foi mandado ao ORQESTRAI (--so-ler)."
3. Se aparecer "esperando a pessoa" ou "o SSO pediu o código de 2 fatores e o robô não conseguiu", abra a tela remota e conclua o login. O robô segue sozinho.
4. Se aparecer "não deu certo", a captura da tela fica em `/dados/diagnostico` (sai depois de `DIAGNOSTICO_DIAS`).
5. Compare as contagens do log com a tela "Minha Pauta" do mesmo advogado no PJe.

### Depois do teste

1. Aplicar a migration da pauta no Supabase e preparar o ORQESTRAI (`docs/pauta-audiencias/PLANO.md`).
2. Trocar para `ROBO_COMANDO=pauta-ciclo`, com `ORQESTRAI_URL` e `ROBO_AUTOS_TOKEN`, e fazer o deploy. O log passa a dizer "gravado no ORQESTRAI · {…}".
3. Para uma leitura fora de hora, reinicie o serviço: ele lê ao subir. Não rode `iniciar-robo pauta` dentro do contêiner em funcionamento: seriam dois navegadores no mesmo perfil.

## Decisões que ficam com o usuário e os advogados

1. **Código do e-SAJ por e-mail:** no servidor, a pessoa digita pela tela remota a cada login. Para automatizar: uma regra na caixa do advogado encaminha só os e-mails de código do e-SAJ para uma caixa que o robô lê (exige ajuste no robô, não feito); ou um piloto do Web Signer em Linux.
2. **Login sem pessoa no PJe e no DCP (fase 2):** guardar no painel, cifrados para o robô, CPF e senha do PJe e o segredo do Microsoft Authenticator da PDPJ; no DCP, trocar o duplo fator do advogado do e-mail para o aplicativo.
3. **Quem acessa a tela remota** e quem guarda as senhas do Basic Auth e do VNC.
4. **Quem pode enviar ou trocar o certificado e os segredos do 2FA no painel**, e o procedimento se houver suspeita de vazamento (revogar o certificado; desativar e reativar o 2FA no eproc, o que troca o segredo).
5. **Ritmo e piloto:** quantos processos no primeiro teste no servidor, para observar bloqueio ou lentidão do tribunal.

## Variáveis novas do robô

| Variável | Padrão | O que faz |
|---|---|---|
| `ROBO_CONECTORES` | todos | Conectores atendidos: `eproc`, `esaj`, `esaj:TJCE`… |
| `NAVEGADOR_MODO` | `comum` (ou `playwright` com certificado em arquivo) | Quem abre o navegador. |
| `NAVEGADOR_HEADLESS` | `nao` | Sem janela (só no modo `playwright`). |
| `NAVEGADOR_ARGS` | — | Argumentos extras do navegador. |
| `PASTA_DADOS` | a pasta do robô | Onde ficam `perfil/`, `downloads/`, `diagnostico/`. |
| `TELA_REMOTA_URL` | — | Endereço da tela remota, mostrado no log. |
| `CERTIFICADO_PFX`, `CERTIFICADO_SENHA`, `CERTIFICADO_SENHA_ARQUIVO` | — | Certificado em arquivo, fonte simples. |
| `CERTIFICADO_PASTA`, `CERTIFICADO_CHAVE_PRIVADA_ARQUIVO` | — | Certificado enviado pelo painel. |
| `SEGREDO_JUSTICA` | baixa | Processo em segredo de justiça que o robô abre com o login do advogado é baixado sem esperar a liberação na ficha (decisão de 24/11/2026). `esperar` volta a parar e esperar a liberação. |
| `EPROC_PERFIL` | `SP` | Na tela "Seleção de perfil" do eproc (advogado com inscrições em mais de um estado), o robô escolhe o perfil de advogado cuja sigla começa por este prefixo; sem ele, o primeiro de advogado. Vale para o TJSP e o TJRJ. |
| `WEB_SIGNER` | ligado com certificado no modo playwright | `nao` desliga o Web Signer do robô (o login por certificado no e-SAJ volta para a pessoa). |
| `PJE_OFFICE` | ligado com certificado no modo playwright | `nao` desliga o PJe Office do robô (o login por certificado no jus.br volta para a pessoa). |
| `ROBO_2FA_PASTA` | `CERTIFICADO_PASTA` | Onde está o `segundo-fator.json` gravado pelo painel (segredo do TOTP, decifrado com `CERTIFICADO_CHAVE_PRIVADA_ARQUIVO`). |
| `CERTIFICADO_ORIGENS` | `https://certificado-sso.tjsp.jus.br` | Onde o certificado é apresentado. |
| `VNC_SENHA`, `VNC_SENHA_ARQUIVO` | — | Senha da tela remota (só no contêiner). |
| `DIAGNOSTICO_DIAS` | 7 | Idade máxima dos diagnósticos (só no contêiner). |
| `ROBO_COMANDO` | `robo` | Programa do contêiner quando o serviço não passa argumento: `robo`, `pauta-teste`, `pauta-ciclo`… (só no contêiner). |
| `PAUTA_TRIBUNAIS` | `TRT15` | Tribunais lidos pelo robô da pauta, separados por vírgula. |
| `PAUTA_DIAS` | 60 | Quantos dias à frente o robô da pauta lê. |
| `PAUTA_HORARIOS` | `06:45,11:45,16:45` | Horários de leitura do robô da pauta (Brasília), no `pauta-ciclo` e no `pauta-teste`. |

## Fontes

- Playwright, opção `clientCertificates` (adicionada na v1.46): https://playwright.dev/docs/api/class-browser#browser-new-context-option-client-certificates
- Playwright em Docker (tags da imagem, root, `--ipc=host`, `--init`): https://playwright.dev/docs/docker
- Dockerfile da imagem 1.65.0 (Node, `pwuser`, navegadores): https://github.com/microsoft/playwright/blob/v1.65.0/utils/docker/Dockerfile.noble
- Easypanel, serviço App (Build Path, Dockerfile, variáveis, Volume/Bind/File, domínios, Basic Auth, recursos, réplicas): https://easypanel.io/docs/services/app
- e-SAJ, pré-requisitos de acesso (sistemas e Web Signer): https://esaj.tjsp.jus.br/WebHelp/id_pre_requisitos.htm
- Softplan, instalação do Web Signer no Google Chrome: https://sajajuda.esaj.softplan.com.br/hc/pt-br/articles/12917516417687-Como-instalo-o-Web-Signer-do-Portal-e-SAJ-no-Google-Chrome
- OAB-SP, autenticação em duas etapas no e-SAJ (20/03/2025): https://www.oabsp.org.br/jornaldaadvocacia/25-03-20-1715-acessos-ao-e-saj-e-ao-pje-terao-novos-fatores-de-autenticacao-medidas-reforcam-seguranca-e-alinham-se-as-acoes-da-oab-sp
- AASP, duplo fator no e-SAJ (certificado não pede código): https://www.aasp.org.br/?p=81735
- AASP, comunicado da Presidência do TJSP sobre robôs externos (15/07/2019): https://www.aasp.org.br/?p=40632
- TOTP: RFC 6238 (https://www.rfc-editor.org/rfc/rfc6238) e HOTP: RFC 4226 (https://www.rfc-editor.org/rfc/rfc4226)
- TJSP, eproc, manual do advogado (primeiros passos, código do aplicativo de autenticação): https://www.tjsp.jus.br/download/EPROC/ManuaisPublicoExterno/1-1-EPROC-ADVOGADO-Primeiros-passos.pdf
- TJRJ, manual de autenticação em dois fatores do eproc: https://www.tjrj.jus.br/documents/d/guest/manual_do_usuario_autenticacao_de_dois_fatores_2fa_eproc_v1-0_1-1
- TJSP, atas do Comitê Gestor de TI (2021), citadas pela busca, texto não conferido: https://www.tjsp.jus.br/Download/Portal/PlanejamentoEstrategicoDeTI/PlanejamentoEstrategicoDeTI/ComiteGestaoTI/REGISTROCGesTI09-04-2021v1rev.pdf

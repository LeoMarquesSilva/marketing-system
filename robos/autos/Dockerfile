# Robô de autos do ORQESTRAI no servidor (Easypanel). Guia: docs/easypanel.md.
#
# A imagem oficial do Playwright já traz Node, o Chromium e as bibliotecas do sistema. A versão da imagem
# tem de ser a mesma do pacote playwright travada no package-lock.json (hoje 1.65.0): com versões diferentes
# o Playwright não acha o navegador. Ao atualizar o pacote, atualize esta linha junto.
FROM mcr.microsoft.com/playwright:v1.65.0-noble

# Tela virtual (Xvfb) e acesso a ela pelo navegador (x11vnc + noVNC), para uma pessoa resolver login,
# código ou CAPTCHA quando o robô pede. tini cuida dos processos filhos (o Easypanel não passa --init).
RUN apt-get update \
 && apt-get install -y --no-install-recommends xvfb x11vnc novnc websockify tini \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# Dependências primeiro (camada reaproveitada entre builds). tsx é dependência de desenvolvimento e é ele
# que roda o TypeScript, por isso o npm ci instala tudo.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
COPY docker/iniciar.sh /usr/local/bin/iniciar-robo
RUN chmod 755 /usr/local/bin/iniciar-robo

# Nada de segredo aqui: token, certificado, senhas e chaves entram pelo Easypanel (variáveis e montagens).
ENV NAVEGADOR_MODO=playwright \
    NAVEGADOR_CANAL=chromium \
    NAVEGADOR_ARGS="--window-position=0,0 --window-size=1366,900" \
    PASTA_DADOS=/dados \
    TELA=1366x900x24 \
    DISPLAY=:99 \
    TZ=America/Sao_Paulo \
    NODE_OPTIONS=--openssl-legacy-provider
# NODE_OPTIONS: o certificado A1 exportado pelo Windows costuma vir com a cifra antiga RC2, que o OpenSSL 3 do Node só
# abre com o provedor legado. Sem isso, o .pfx enviado pelo painel seria recusado ("Unsupported PKCS12 PFX data").

# Perfil do navegador (sessão dos tribunais), PDFs em trânsito e diagnósticos.
VOLUME ["/dados"]
# noVNC (tela remota). Só abra com domínio HTTPS e Basic Auth do Easypanel; veja docs/easypanel.md.
EXPOSE 6080

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/iniciar-robo"]
CMD ["robo"]

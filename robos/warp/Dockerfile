# Saída dos robôs pelo Cloudflare WARP (proxy SOCKS5 na porta 1080, só na rede interna do Easypanel).
#
# Por quê: o CloudFront dos tribunais (PJe do TRT-2 e do TRT-15, testes de 23/11/2026) responde 403 "Request blocked"
# a IP de data center, como o do servidor do Easypanel. Pelo WARP a mesma consulta chega ao PJe.
# Quem usa: o navegador do robô, com NAVEGADOR_PROXY=socks5://bibliotecabp_warp:1080 (só o navegador; o robô fala
# com o ORQESTRAI direto). Este serviço não tem domínio nem porta publicada.
#
# Cliente oficial da Cloudflare (pacote cloudflare-warp do repositório pkg.cloudflareclient.com), em modo proxy:
# não cria interface de rede, só abre um SOCKS5 em 127.0.0.1:40000; o socat expõe esse proxy na 1080 do contêiner.
FROM debian:bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl gnupg dbus socat procps \
 && curl -fsSL https://pkg.cloudflareclient.com/pubkey.gpg | gpg --yes --dearmor --output /usr/share/keyrings/cloudflare-warp-archive-keyring.gpg \
 && echo "deb [signed-by=/usr/share/keyrings/cloudflare-warp-archive-keyring.gpg] https://pkg.cloudflareclient.com/ bookworm main" > /etc/apt/sources.list.d/cloudflare-client.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends cloudflare-warp \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

COPY iniciar.sh /usr/local/bin/iniciar-warp
RUN chmod 755 /usr/local/bin/iniciar-warp

# Registro do WARP (para não criar um novo a cada reinício): monte um volume em /var/lib/cloudflare-warp.
VOLUME ["/var/lib/cloudflare-warp"]
EXPOSE 1080

HEALTHCHECK --interval=60s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -fsS --max-time 8 --socks5-hostname 127.0.0.1:1080 https://www.cloudflare.com/cdn-cgi/trace | grep -q "warp=on" || exit 1

ENTRYPOINT ["/usr/local/bin/iniciar-warp"]

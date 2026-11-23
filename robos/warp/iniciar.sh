#!/bin/sh
# Sobe o cliente oficial do Cloudflare WARP em modo proxy e expõe o SOCKS5 dele na porta 1080 do contêiner.
set -eu

log() { echo "[$(date '+%d/%m/%Y %H:%M:%S')] $*"; }
warp() { warp-cli --accept-tos "$@"; }

# O warp-svc conversa com o warp-cli pelo D-Bus do sistema.
mkdir -p /run/dbus
rm -f /run/dbus/pid
dbus-daemon --config-file=/usr/share/dbus-1/system.conf --fork >/dev/null 2>&1 || true

warp-svc --accept-tos >/tmp/warp-svc.log 2>&1 &

for _ in $(seq 1 60); do
  if warp status >/dev/null 2>&1; then break; fi
  sleep 1
done

# Um registro por volume (/var/lib/cloudflare-warp). Nomes novos e antigos dos comandos do warp-cli.
if ! warp registration show >/dev/null 2>&1; then
  log "Registrando este serviço no WARP."
  warp registration new >/dev/null 2>&1 || warp register >/dev/null 2>&1
fi
warp mode proxy >/dev/null 2>&1 || warp set-mode proxy >/dev/null 2>&1
warp proxy port 40000 >/dev/null 2>&1 || warp set-proxy-port 40000 >/dev/null 2>&1
warp connect >/dev/null 2>&1 || true

for _ in $(seq 1 60); do
  # "Disconnected" também contém "connected": confere a frase inteira.
  if warp status 2>/dev/null | grep -qiE "status update: connected"; then break; fi
  sleep 1
done
log "$(warp status 2>/dev/null | tr '\n' ' ')"

# Conferência: pelo proxy, o trace da Cloudflare deve dizer warp=on (o IP de saída não vai para o log).
if curl -fsS --max-time 15 --socks5-hostname 127.0.0.1:40000 https://www.cloudflare.com/cdn-cgi/trace 2>/dev/null | grep -q "warp=on"; then
  log "WARP ligado: o tráfego do proxy sai pela Cloudflare."
else
  log "ATENÇÃO: o proxy ainda não sai pelo WARP (veja /tmp/warp-svc.log). Sigo tentando pelo healthcheck."
fi

log "Proxy SOCKS5 em 0.0.0.0:1080 (encaminha para o WARP em 127.0.0.1:40000), só na rede interna do Easypanel."
exec socat TCP-LISTEN:1080,fork,reuseaddr TCP:127.0.0.1:40000

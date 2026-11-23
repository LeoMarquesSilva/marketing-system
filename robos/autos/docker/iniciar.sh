#!/bin/sh
# Início do robô de autos no contêiner (Dockerfile ao lado; guia em docs/easypanel.md).
#
#   robo                      fica rodando e atende a fila (padrão)
#   uma-vez                   atende o que estiver na fila e sai
#   login [eproc|TJCE…]       só abre a sessão do tribunal
#   inspecionar [eproc] CNJ   abre o processo e descreve a tela, sem baixar
#   pauta                     uma leitura da Minha Pauta do PJe-JT, mandada ao ORQESTRAI, e sai (src/pauta.ts)
#   pauta-teste               teste de acesso ao PJe-JT: lê ao subir e nos horários de PAUTA_HORARIOS, só mostra
#                             os números no log e não manda nada (fica de pé, para o serviço não reiniciar em laço)
#   pauta-ciclo               fica rodando: lê ao subir e nos horários de PAUTA_HORARIOS e manda ao ORQESTRAI
#
# Sem argumento, o comando vem de ROBO_COMANDO (padrão robo): é como o serviço do Easypanel escolhe o programa.
#
# Como root, só prepara o volume e passa para o usuário pwuser (o da imagem do Playwright). O navegador,
# a tela virtual e o robô rodam como pwuser.
set -eu

PASTA_DADOS="${PASTA_DADOS:-/dados}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$PASTA_DADOS"
  chown -R pwuser:pwuser "$PASTA_DADOS"
  # A chave privada do robô costuma chegar como montagem de arquivo do root: vai para uma cópia que só o
  # pwuser lê, dentro do contêiner e fora do volume (não vai para backup do volume).
  if [ -n "${CERTIFICADO_CHAVE_PRIVADA_ARQUIVO:-}" ] && [ -r "$CERTIFICADO_CHAVE_PRIVADA_ARQUIVO" ]; then
    mkdir -p /run/robo
    install -o pwuser -g pwuser -m 0400 "$CERTIFICADO_CHAVE_PRIVADA_ARQUIVO" /run/robo/certificado.key
    export CERTIFICADO_CHAVE_PRIVADA_ARQUIVO=/run/robo/certificado.key
  fi
  # O painel de robôs grava o certificado e os segredos com o grupo dele e permissão 0640. O pwuser entra nesse
  # grupo (o da pasta compartilhada) para ler, sem a pasta precisar ficar aberta para todos.
  for pasta_painel in "${CERTIFICADO_PASTA:-}" "${ROBO_2FA_PASTA:-}"; do
    [ -n "$pasta_painel" ] && [ -d "$pasta_painel" ] || continue
    gid="$(stat -c %g "$pasta_painel")"
    [ "$gid" != "0" ] || continue
    grupo="$(getent group "$gid" | cut -d: -f1)"
    if [ -z "$grupo" ]; then
      grupo=painel-robos
      groupadd -g "$gid" "$grupo"
    fi
    usermod -aG "$grupo" pwuser
  done
  export HOME=/home/pwuser
  exec setpriv --reuid=pwuser --regid=pwuser --init-groups "$0" "$@"
fi

# O Chrome trava o perfil com o nome da máquina. Cada contêiner novo tem outro nome e acharia o perfil
# "em uso por outro computador". Como só existe um robô por volume (réplicas = 1), a trava velha pode sair.
rm -f "$PASTA_DADOS/perfil/SingletonLock" "$PASTA_DADOS/perfil/SingletonSocket" "$PASTA_DADOS/perfil/SingletonCookie"

# Capturas e HTML de diagnóstico podem conter dados de processos: saem depois de DIAGNOSTICO_DIAS (7).
# Os PDFs em downloads/ já são apagados pelo robô depois do envio; sobra só o de um pedido interrompido.
find "$PASTA_DADOS/diagnostico" -type f -mtime "+${DIAGNOSTICO_DIAS:-7}" -delete 2>/dev/null || true
find "$PASTA_DADOS/downloads" -type f -mtime +1 -delete 2>/dev/null || true

if [ "${NAVEGADOR_HEADLESS:-nao}" != "sim" ]; then
  Xvfb "$DISPLAY" -screen 0 "${TELA:-1366x900x24}" -nolisten tcp >/dev/null 2>&1 &
  espera=0
  while [ ! -e "/tmp/.X11-unix/X${DISPLAY#:}" ] && [ "$espera" -lt 50 ]; do
    sleep 0.1
    espera=$((espera + 1))
  done

  # Tela remota só com senha. A senha não aparece na linha de comando: vai para um arquivo temporário que o
  # x11vnc apaga assim que lê (prefixo rm:). O VNC usa só os 8 primeiros caracteres: a proteção de verdade é
  # o HTTPS com Basic Auth do Easypanel na frente do noVNC.
  senha_vnc=""
  if [ -n "${VNC_SENHA_ARQUIVO:-}" ] && [ -r "$VNC_SENHA_ARQUIVO" ]; then
    senha_vnc="$(cat "$VNC_SENHA_ARQUIVO")"
  elif [ -n "${VNC_SENHA:-}" ]; then
    senha_vnc="$VNC_SENHA"
  fi
  if [ -n "$senha_vnc" ]; then
    arquivo_senha="$(mktemp)"
    printf '%s\n' "$senha_vnc" > "$arquivo_senha"
    x11vnc -display "$DISPLAY" -localhost -rfbport 5900 -passwdfile "rm:$arquivo_senha" -forever -shared -quiet -bg -o /tmp/x11vnc.log >/dev/null 2>&1
    websockify --web /usr/share/novnc 0.0.0.0:6080 127.0.0.1:5900 >/tmp/novnc.log 2>&1 &
    echo "Tela remota (noVNC) na porta 6080: /vnc.html"
  else
    echo "Tela remota desligada: defina VNC_SENHA (ou VNC_SENHA_ARQUIVO) para alguém resolver login, código ou CAPTCHA."
  fi
  unset senha_vnc VNC_SENHA
fi

comando="${1:-${ROBO_COMANDO:-robo}}"
[ "$#" -gt 0 ] && shift
programa=src/index.ts
case "$comando" in
  robo) set -- ;;
  uma-vez) set -- --uma-vez ;;
  login) set -- --login "$@" ;;
  inspecionar) set -- --inspecionar "$@" ;;
  pauta) programa=src/pauta.ts ;;
  pauta-teste) programa=src/pauta.ts; set -- --so-ler --ciclo "$@" ;;
  pauta-ciclo) programa=src/pauta.ts; set -- --ciclo "$@" ;;
  *) echo "Comando desconhecido: $comando (use robo, uma-vez, login, inspecionar, pauta, pauta-teste ou pauta-ciclo)"; exit 2 ;;
esac

cd /app
exec /app/node_modules/.bin/tsx "$programa" "$@"

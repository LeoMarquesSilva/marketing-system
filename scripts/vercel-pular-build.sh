#!/usr/bin/env bash
# "Ignored Build Step" da Vercel, chamado pelo ignoreCommand do vercel.json.
# Sai com 0: a Vercel PULA o build (o deployment fica "Canceled" e a Produção
# continua no deploy anterior). Sai com 1: a Vercel faz o build.
#
# Pula só quando, desde o último deploy que deu certo neste branch
# (VERCEL_GIT_PREVIOUS_SHA), nada mudou fora das pastas que o site não usa:
# robos/ (Easypanel), vios-app/ (máquina do escritório) e docs/.
# A comparação é com o último deploy, não com o commit anterior: num push com
# vários commits, uma mudança no site em qualquer um deles faz o build.
# Na dúvida (sem deploy anterior, commit fora do clone, erro do git), faz o build.

anterior="${VERCEL_GIT_PREVIOUS_SHA:-}"

if [ -z "$anterior" ]; then
  echo "Sem deploy anterior neste branch: build."
  exit 1
fi

# A Vercel clona só os últimos commits; se o do último deploy não veio, busca mais.
if ! git cat-file -e "${anterior}^{commit}" 2>/dev/null; then
  GIT_TERMINAL_PROMPT=0 timeout 60 git fetch --quiet --deepen=300 >/dev/null 2>&1 || true
fi
if ! git cat-file -e "${anterior}^{commit}" 2>/dev/null; then
  echo "O commit do último deploy (${anterior}) não está no clone: build."
  exit 1
fi

if git diff --quiet "$anterior" HEAD -- . ':(exclude)robos' ':(exclude)vios-app' ':(exclude)docs'; then
  echo "Desde ${anterior} só mudou robos/, vios-app/ ou docs/: build pulado."
  exit 0
fi

echo "Há mudança fora de robos/, vios-app/ e docs/ desde ${anterior}: build."
exit 1

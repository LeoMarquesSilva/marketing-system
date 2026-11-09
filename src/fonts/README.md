# Fontes do sistema

Arquivos usados com `next/font/local`. Ficam no projeto para o build não depender do Google Fonts: o `next/font/google` baixa as fontes durante o build e quebra quando o Google devolve uma URL sem extensão (`/l/font?kit=…`), o que acontece ao acaso. O ESLint bloqueia novos usos dele.

Origem: Google Fonts, arquivo do subconjunto `latin` (português completo e pontuação). Licença: SIL Open Font License 1.1.

| Arquivo | Fonte | Pesos |
| --- | --- | --- |
| `geist-latin-variable.woff2` | Geist | 100 a 900 |
| `geist-mono-latin-variable.woff2` | Geist Mono | 100 a 900 |
| `baloo-bhaijaan-2-latin-variable.woff2` | Baloo Bhaijaan 2 | 400 a 800 |
| `montserrat-latin-variable.woff2` | Montserrat | 100 a 900 |
| `source-sans-3-latin-variable.woff2` | Source Sans 3 | 200 a 900 |
| `source-sans-3-italic-latin-variable.woff2` | Source Sans 3 itálico | 200 a 900 |
| `bebas-neue-latin.woff2` | Bebas Neue | 400 |
| `kanit-600-latin.woff2` | Kanit | 600 |

Fora do `latin`, a letra aparece na fonte de reserva. Para acrescentar uma fonte, baixe o `.woff2` e aponte `next/font/local` para ele com caminho relativo.

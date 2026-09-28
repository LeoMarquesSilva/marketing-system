# Relatório final de correções — perfil público NFC

Data: 2026-07-29

## Status

Todos os Critical, Important e Minors diretamente relacionados do
`final-fix-brief.md` foram corrigidos. Não houve commit, instalação de
dependências nem criação de uma segunda instância de desenvolvimento.

## Correções implementadas

### 1. SSR visível e progressivo

- `ProfileMotionItem` passou a usar `initial={false}` também no modo normal.
  O HTML inicial deixa de serializar `opacity:0` e `translateY(18px)` em hero,
  ações, seções e conteúdo recente.
- O primeiro markup fica determinístico entre servidor e cliente. Com
  `prefers-reduced-motion: reduce`, não há translação nem animação em execução.
- A investigação da rota ativa encontrou um segundo bloqueio: `AuthGuard`
  substituía rotas públicas por “Carregando...” enquanto a sessão inicializava.
  O fallback agora continua protegendo rotas privadas, mas não esconde rotas
  públicas. Isso fez o perfil e a campanha chegarem como markup HTML literal,
  legível sem JavaScript.

### 2. Ordem de foco e microinterações

- Todos os `m.div` com `whileTap`/`whileHover` que envolviam links e botões em
  `profile-contact-actions.tsx` foram substituídos por `div` sem gesto.
- Os links, botões, URLs, `data-action`, callbacks e beacons existentes foram
  preservados.
- A resposta SSR e o DOM hidratado passaram a ter zero wrappers
  `.pp-action-wrap`/`.pp-contact-dock__item` focáveis e nenhum
  `tabindex="0"` extra.
- A resposta tátil foi movida para `:active` no próprio elemento interativo,
  limitada a `prefers-reduced-motion: no-preference`.

### 3. Minors relacionados

- A campanha estática não usa mais `role="status"`. O `role="status"` dinâmico
  das mensagens após copiar/compartilhar foi mantido por ser apropriado.
- O rótulo “Compartilhar” ganhou `max-width: 100%` e
  `overflow-wrap: anywhere`; em 320 px ele quebra em duas linhas sem escapar do
  botão ou da viewport.
- Nenhum movimento foi adicionado à luz ambiente.

## TDD — RED

1. Primeira execução direcionada:
   - comando:
     `npx vitest run src/components/profiles/profile-motion.test.tsx src/components/profiles/professional-profile-page.test.tsx`
   - resultado esperado: exit 1, 4 falhas e 18 testes passando;
   - falhas reproduzidas: estado inicial com `opacity:0`, markup SSR invisível,
     wrappers com `tabindex="0"` e campanha estática com `role="status"`.
2. Regressão de página completa:
   - teste “mantém hero, ações e seções visíveis no HTML inicial”;
   - resultado esperado: exit 1, pois o markup continha
     `style="opacity:0;transform:translateY(18px)"`.
3. Regressão do guard:
   - comando:
     `npx vitest run src/components/auth/auth-guard.test.tsx`;
   - resultado esperado: exit 1, 1 falha e 1 teste passando;
   - o perfil público era substituído por “Carregando...”, enquanto o teste de
     ocultação da rota protegida já passava.

## TDD — GREEN

- Regressões de motion/página: 2 arquivos, 23/23 testes passando.
- Regressões do guard: 1 arquivo, 2/2 testes passando.
- Validação final expandida:
  `npx vitest run src/components/auth/auth-guard.test.tsx src/components/profiles/profile-motion.test.tsx src/components/profiles/professional-profile-page.test.tsx src/lib/profiles/public.test.ts src/lib/profiles/text.test.ts`
  — exit 0, 5 arquivos e 46/46 testes passando.
- O comando obrigatório original também passou com 4 arquivos e 44/44 testes.

## Lint e build

- ESLint obrigatório do brief: exit 0, sem erros.
- ESLint final expandido, incluindo `auth-guard.tsx` e seu novo teste:
  exit 0, sem erros.
- Diagnósticos do editor nos arquivos alterados: nenhum erro.
- `npm run build`: exit 0. Build final compilado com sucesso, TypeScript,
  coleta de dados e 11/11 páginas estáticas concluídos; `/perfil/[slug]`
  permaneceu como rota dinâmica.

## Validação da instância ativa

- Instância reutilizada: `npm run dev`, PID 28776, sem iniciar outro servidor.
- Rota:
  `http://localhost:3000/perfil/felipe-soares-de-camargo?source=nfc`
- Resposta SSR final: HTTP 200 com markup literal de `pp-profile-card`,
  `pp-chrome`, `Felipe Soares de Camargo` e `Feliz Dia do Advogado`.
- A resposta não contém “Carregando...”, `opacity:0` nem `tabindex="0"`.

## Validação headless

Microsoft Edge e Google Chrome já estavam instalados; Microsoft Edge foi usado
via CDP, sem instalar navegador ou biblioteca.

- 390×844: card e chrome presentes, nome/campanha corretos, zero overflow
  horizontal, zero wrappers focáveis, zero wrappers essenciais com opacidade
  zero; “Compartilhar” dentro da viewport.
- 1440×900: mesmos resultados, sem overflow horizontal.
- 390×844 com movimento reduzido: media query ativa, transforms essenciais
  `none` e zero animações em execução.
- 320×844 adicional: viewport real confirmada via CDP; documento com 320 px,
  card entre x=14 e x=306, sem overflow; “Compartilhar” com largura de 62 px,
  quebra em duas linhas e permanece dentro da viewport.

## Preservação funcional

- Nenhuma alteração em consultas de perfil, regras de privacidade, dados
  públicos, geração de vCard, URLs canônicas ou utilitários de links.
- `ProfileEventLink`, eventos de WhatsApp/e-mail/LinkedIn/site, beacon de
  compartilhamento e métrica de visualização foram preservados.
- A regressão de privacidade continuou cobrindo a omissão de e-mail e WhatsApp.
- O novo teste do `AuthGuard` confirma que conteúdo protegido continua oculto
  durante a inicialização da sessão.

## Arquivos desta rodada

- `src/components/auth/auth-guard.tsx`
- `src/components/auth/auth-guard.test.tsx`
- `src/components/profiles/profile-motion.tsx`
- `src/components/profiles/profile-motion.test.tsx`
- `src/components/profiles/profile-contact-actions.tsx`
- `src/components/profiles/professional-profile-page.tsx`
- `src/components/profiles/professional-profile-page.module.css`
- `src/components/profiles/professional-profile-page.test.tsx`
- `.superpowers/sdd/2026-07-28-perfil-publico-framer-motion/final-fix-report.md`

## Preocupações residuais

- O npm emite `Unknown env config "devdir"` em todos os comandos. O aviso não
  afetou testes, lint ou build, mas a configuração deverá ser removida antes de
  uma futura versão major do npm.
- Durante hot reload/build, a instância dev registrou um full reload e um
  `ECONNRESET` isolado. As requisições posteriores da rota piloto responderam
  200 e serviram o markup atualizado; não foi necessário reiniciar o processo.

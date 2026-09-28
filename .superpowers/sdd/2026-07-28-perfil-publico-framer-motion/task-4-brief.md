# Task 4: Verificação final e acabamento responsivo

## Objetivo

Validar o redesign completo antes da entrega e corrigir apenas problemas
objetivos encontrados nos arquivos do perfil público.

## Arquivos permitidos para correção

- `src/components/profiles/professional-profile-page.module.css`
- `src/components/profiles/profile-motion.tsx`
- Testes focais relacionados, somente se um defeito exigir regressão.

Não alterar regras de negócio, dados, links, métricas ou componentes fora da
página pública.

## Verificações obrigatórias

### 1. Lint

```powershell
npx eslint src/components/profiles/profile-motion.tsx src/components/profiles/profile-motion.test.tsx src/components/profiles/professional-profile-page.tsx src/components/profiles/profile-hero.tsx src/components/profiles/profile-contact-actions.tsx src/components/profiles/profile-recent-content.tsx
```

Esperado: exit code 0.

### 2. Build

```powershell
npm run build
```

Esperado: exit code 0, sem erro TypeScript ou de fronteira servidor/cliente.

### 3. Perfil piloto

Rota:

```text
http://localhost:3000/perfil/felipe-soares-de-camargo
```

Antes de iniciar servidor, verificar se `npm run dev` já está ativo nos
terminais do Cursor. Não iniciar uma segunda instância.

Validar, na medida permitida pelas ferramentas disponíveis:

- 320×568, 390×844, 430×932 e 1440×900;
- campanha “Feliz Dia do Advogado” integrada;
- nome e foto acima da dobra no celular;
- CTA e redes sem overflow;
- animações sem salto de layout;
- biografia e seções legíveis;
- desktop sem esticar conteúdo;
- movimento reduzido sem translações.

Se não houver ferramenta de screenshot/browser disponível, registrar essa
limitação no relatório e fazer inspeção estática rigorosa de CSS, markup e
breakpoints. Não instalar navegador ou dependência apenas para esta validação.

### 4. Suíte focal final

```powershell
npx vitest run src/components/profiles/profile-motion.test.tsx src/components/profiles/professional-profile-page.test.tsx src/lib/profiles/public.test.ts src/lib/profiles/text.test.ts
```

Esperado: todos os testes passando.

## Restrições

- Corrigir somente defeitos comprovados.
- Não criar commit.
- Não adicionar dependências.
- Escrever relatório em
  `.superpowers/sdd/2026-07-28-perfil-publico-framer-motion/task-4-report.md`.


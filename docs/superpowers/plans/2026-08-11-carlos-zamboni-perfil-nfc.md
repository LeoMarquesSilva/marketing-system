# Carlos Zamboni Profile and NFC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar, publicar e validar o perfil institucional de Carlos Zamboni com foto, contatos, trajetória, Reel da CPFL Energia e etiqueta NFC contabilizável.

**Architecture:** Um script administrativo local e idempotente fará o preflight, enviará a foto ao Supabase Storage e gravará usuário, perfil, seções, entradas, etiqueta e cartão usando o cliente `service_role` apenas no servidor. Uma auditoria independente consultará todas as relações e o domínio público antes da entrega do link.

**Tech Stack:** Node.js, `@supabase/supabase-js`, Supabase Postgres/Storage, Next.js 16 e PowerShell para verificação HTTP.

## Global Constraints

- Nome público: `Carlos Zamboni`.
- Slug: `carlos-zamboni`.
- Cargo: `Consultor em Liderança e Gestão Estratégica`.
- Área: `Liderança, Gestão Estratégica e Transformação Organizacional`.
- E-mail visível: `czambonineto@hotmail.com`.
- LinkedIn visível: `https://www.linkedin.com/in/carlos-zamboni/`.
- Reel: `https://www.instagram.com/reel/DAtegZsygMk/?igsh=eXpoeXkybHA5bzM4`.
- Foto de origem: `C:\Users\Leonardo Marques\Downloads\foto-zamboni.jpg`.
- Não mostrar tempo de escritório, WhatsApp ou website.
- A confirmação física do cartão permanece pendente.
- Não alterar registros de outras pessoas.
- Nenhuma credencial ou token pode ser impresso ou persistido no repositório.

---

### Task 1: Preflight de identidade e sequências

**Files:**
- Create temporarily: `.codex-tmp/create-carlos-zamboni-profile.mjs`
- Read: `.env`
- Read: `C:\Users\Leonardo Marques\Downloads\foto-zamboni.jpg`

**Interfaces:**
- Consumes: variáveis `NEXT_PUBLIC_SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já configuradas.
- Produces: relatório JSON com correspondências existentes, disponibilidade do slug, próximos códigos `NFC-####` e `PPC-####`, bucket e metadados da foto.

- [ ] **Step 1: Criar o modo de preflight**

O script deve aceitar `--apply`; sem essa opção, executar somente consultas. O preflight deve procurar correspondências por nome, e-mail e slug, recusar múltiplas correspondências e calcular códigos sequenciais com as expressões `/^NFC-(\d+)$/` e `/^PPC-(\d+)$/`.

- [ ] **Step 2: Validar a foto antes de qualquer escrita**

Verificar existência, extensão `.jpg`, tamanho maior que zero e MIME `image/jpeg`. O caminho de destino será `colaboradores/<userId>/carlos-zamboni.jpg`.

- [ ] **Step 3: Executar o preflight**

Run: `node .codex-tmp/create-carlos-zamboni-profile.mjs`

Expected: JSON com `mode: "preflight"`, no máximo uma correspondência segura, foto válida e códigos disponíveis; nenhuma tabela ou objeto do Storage alterado.

---

### Task 2: Cadastro idempotente completo

**Files:**
- Modify temporarily: `.codex-tmp/create-carlos-zamboni-profile.mjs`

**Interfaces:**
- Consumes: resultado validado do Task 1.
- Produces: IDs de usuário, perfil, seções, entradas, etiqueta e cartão; URL pública da foto; link público do perfil.

- [ ] **Step 1: Criar ou atualizar o usuário de Carlos**

Usar uma única correspondência segura por nome/e-mail. O registro deve conter:

```js
{
  name: "Carlos Zamboni",
  email: "czambonineto@hotmail.com",
  department: "Consultoria Estratégica",
  is_active: true,
  photo_collected: true,
  photo_collected_at: now
}
```

- [ ] **Step 2: Enviar a foto e vincular ao usuário**

Fazer upload com `upsert: true`, `contentType: "image/jpeg"` ao bucket `MARKETING-SYSTEM-FOTOS`. Obter a URL pública e gravá-la em `users.avatar_url` e `professional_profiles.photo_url`.

- [ ] **Step 3: Criar o perfil primeiro como rascunho**

Gravar `professional_profiles` com `show_tenure: false`, `show_email: true`, `show_linkedin: true`, demais contatos ocultos, e os valores exatos dos Global Constraints.

- [ ] **Step 4: Gravar a localização institucional em português**

Usar `is_approved: true` e os textos:

```text
Chamada: Liderança não é sobre dar ordens, mas sobre inspirar, transformar e construir um legado.

Biografia: Consultor em Liderança e Gestão Estratégica, presta consultoria aos sócios do Bismarchi | Pires com foco no fortalecimento da liderança, na tomada de decisão e na construção de culturas de alto desempenho.

Com mais de 35 anos de experiência, percorreu todas as etapas da liderança, de estagiário a presidente de grandes empresas do Grupo CPFL Energia. Ao longo dessa trajetória, liderou milhares de colaboradores e esteve à frente da gestão de grandes negócios, consolidando uma atuação marcada pela liderança humanizada, pela visão estratégica e pela transformação organizacional.

À frente da Zamboni Pro Leaders, dedica-se ao desenvolvimento de executivos, empresários e gestores, ajudando-os a construir uma liderança mais humana e de impacto, baseada em propósito, estratégia e alta performance, com resultados tangíveis e sustentáveis.
```

- [ ] **Step 5: Criar seções e entradas sem duplicação**

Criar as seções padrão e substituir somente as entradas do perfil de Carlos. Conteúdo mínimo:

```text
Atuação — Consultoria aos sócios do Bismarchi | Pires
Conhecimentos — Liderança humanizada
Conhecimentos — Gestão estratégica e transformação organizacional
Conhecimentos — Formação de líderes e culturas de alta performance
Destaques — Mais de 35 anos de experiência em liderança e gestão
Destaques — Trajetória de estagiário a presidente no Grupo CPFL Energia
Destaques — Fundador da Zamboni Pro Leaders
Trajetória — Reconhecimento à trajetória na CPFL Energia
```

A entrada de Trajetória deve conter o link exato do Reel e a descrição: `Registro da despedida de Carlos da CPFL Energia e do reconhecimento das equipes à sua trajetória de liderança.`

- [ ] **Step 6: Criar etiqueta e cartão**

Criar ou reutilizar uma única etiqueta ativa com:

```js
{
  name: "Perfil — Carlos Zamboni",
  category: "Perfil profissional",
  environment: "Material comercial",
  access_mode: "public",
  action_type: "professional_profile",
  action_config: { profileId },
  cooldown_seconds: 0
}
```

Criar cartão `active`, vinculado à etiqueta, com `physically_activated_at: null`. Nunca reutilizar etiqueta de outro perfil.

- [ ] **Step 7: Validar requisitos e publicar**

Reconsultar nome, cargo, área, chamada, bio, foto, e-mail e LinkedIn. Somente se todos estiverem presentes, atualizar `status: "published"` e `published_at: now`.

- [ ] **Step 8: Executar a aplicação**

Run: `node .codex-tmp/create-carlos-zamboni-profile.mjs --apply`

Expected: JSON com `status: "published"`, `photoUploaded: true`, `tagStatus: "active"`, `cardStatus: "active"`, `physicalDone: false` e o link `https://marketing-system-xi.vercel.app/perfil/carlos-zamboni`.

---

### Task 3: Auditoria de banco e perfil público

**Files:**
- Modify temporarily: `.codex-tmp/create-carlos-zamboni-profile.mjs`
- Delete after verification: `.codex-tmp/create-carlos-zamboni-profile.mjs`

**Interfaces:**
- Consumes: IDs e URLs produzidos pelo Task 2.
- Produces: evidência de consistência no banco e resposta pública correta.

- [ ] **Step 1: Executar auditoria somente leitura**

Run: `node .codex-tmp/create-carlos-zamboni-profile.mjs --verify`

Expected: exatamente um usuário, um perfil publicado, uma etiqueta ativa, um cartão ativo, foto coletada, oito entradas localizadas e nenhuma confirmação física.

- [ ] **Step 2: Verificar a página pública**

Run:

```powershell
curl.exe -sS --max-time 20 "https://marketing-system-xi.vercel.app/perfil/carlos-zamboni?source=nfc"
```

Expected: HTML contendo `Carlos Zamboni`, `Consultor em Liderança e Gestão Estratégica`, e-mail, LinkedIn, URL do Reel e referência à foto pública.

- [ ] **Step 3: Verificar o redirecionamento contabilizável**

Run:

```powershell
curl.exe -sS --max-time 20 "https://marketing-system-xi.vercel.app/perfil/carlos-zamboni"
```

Expected: resposta de streaming contendo `NEXT_REDIRECT` para a rota `/t/<token>?source=nfc`; a URL com `?source=nfc` não deve redirecionar novamente.

- [ ] **Step 4: Limpar o script temporário**

Excluir `.codex-tmp/create-carlos-zamboni-profile.mjs` com `apply_patch`. Não remover outros arquivos existentes em `.codex-tmp`.

- [ ] **Step 5: Entregar dados de gravação**

Informar nome, link público, código da etiqueta, status físico pendente e confirmar que o perfil aparece em Fotos dos Colaboradores.

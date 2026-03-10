# Resumo para prompt: Sidebar, Login e Página de Perfil (Next.js + Supabase)

Use este texto como prompt em outro projeto para recriar a mesma arquitetura de **sidebar**, **sistema de login** e **página de perfil**.

---

## 1. Stack e dependências

- **Next.js** (App Router), **React**, **TypeScript**
- **Supabase** (Auth + tabela `users` com `auth_id` ligado ao usuário do Auth)
- **react-hook-form** + **zod** + **@hookform/resolvers** para formulários
- **shadcn/ui** (ou similar): `Button`, `Input`, `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`, `Avatar`, `AvatarFallback`, `AvatarImage`, `Select`, etc.
- **lucide-react** para ícones

---

## 2. Autenticação (Auth Context + Login)

### 2.1 Context de autenticação

- **AuthProvider** envolve a aplicação no `layout.tsx` (root).
- Estado: `user` (Supabase Auth User), `profile` (registro da tabela `users`: id, name, email, department, role, auth_id, avatar_url), `loading`.
- **Inicialização**: `getSession()` no mount; se houver sessão, buscar perfil na tabela `users` onde `auth_id = session.user.id`.
- **Listener**: `supabase.auth.onAuthStateChange` para atualizar `user` e chamar `fetchProfile(authId)` quando houver sessão.
- **Funções expostas**: `signIn(email, password)`, `signUp(email, password, name)`, `signOut()`, `refreshProfile()`.
- **fetchProfile(authId)**: `select` em `users` com `eq("auth_id", authId).single()` e `setProfile(data)`.
- **signUp**: além de `supabase.auth.signUp`, inserir um registro em `users` (id, name, email, department padrão, auth_id do usuário criado, is_active, etc.).
- Hook `useAuth()` que usa o context; lança erro se usado fora de `AuthProvider`.

### 2.2 Página de login

- Layout: **split screen** — em telas grandes (lg), metade esquerda com branding (gradiente escuro, logo, texto); metade direita com o formulário. Em mobile, só o formulário e logo pequeno no topo.
- **LoginForm**: alternância entre “Entrar” e “Criar conta” (estado `isSignUp`). Dois formulários (react-hook-form + zod): um para login (email, senha), outro para signup (nome, email, senha). Validação com zod (email válido, senha obrigatória, nome mínimo no signup). Ao submeter login/signup, chama `signIn`/`signUp` do context; em sucesso, `router.push("/")` e `router.refresh()`. Exibir erro de submit em texto (ex.: `submitError`). Link/botão “Não tem conta? Criar conta” / “Já tem conta? Entrar” que alterna o modo e reseta os formulários.

### 2.3 Proteção de rotas (AuthGuard)

- Componente **AuthGuard** que usa `useAuth()` e `usePathname()`.
- Lista **PUBLIC_PATHS** (ex.: `["/login"]`). Se `loading`, mostrar tela de “Carregando...”. Se não está em path público e não há `user`, `router.replace("/login")`. Se há `user` e está em `/login`, `router.replace("/")`. Caso contrário, renderizar `children`.

---

## 3. Layout da aplicação (Sidebar + Header + Conteúdo)

### 3.1 AppLayout

- **AppLayout** recebe `children` e usa o mesmo `PUBLIC_PATHS`.
- Se a rota atual for pública (ex.: `/login`), renderizar só `children` (sem sidebar/header).
- Caso contrário, renderizar:
  - **AuthGuard** (ou assumir que já está protegido pelo layout pai),
  - **Sidebar**,
  - Uma div com `pl-0 md:pl-16` contendo **Header** fixo no topo e `<main>` com o conteúdo (`children`).
- Assim, a página de login fica “fora” do shell (sidebar + header).

### 3.2 Sidebar

- **Desktop (md+)**: barra fixa à esquerda (`fixed left-0 top-0 z-40 h-screen w-16`), fundo em gradiente escuro, borda sutil. Conteúdo em coluna:
  - Logo/link para “/” no topo.
  - Lista de **navItems** (href, ícone Lucide, label): cada item é um `Link` com ícone; item ativo quando `pathname === href` ou `pathname.startsWith(href)` (para subrotas). Estilo ativo: fundo claro/destaque; inativo: texto mais suave, hover com fundo leve. Tooltips no hover (texto ao lado da barra) para acessibilidade e UX.
  - Divisor.
  - Avatar do usuário (usando `profile` do `useAuth()`): link para “/perfil”, fallback com iniciais do nome. Opcional: indicador “online”.
  - Botão de logout (ícone LogOut) que chama `signOut()` e `router.replace("/login")`.
- **Mobile**: esconder sidebar lateral; mostrar **bottom navigation** fixa com os primeiros N itens + botão “Sair”, e um padding inferior no conteúdo para não ficar atrás da nav (`md:hidden h-16` no final).
- Opcional: badge de notificações (ex.: número) em um item (ex.: Planner), atualizado por effect que busca dados (ex.: contagem de alterações pendentes).

---

## 4. Página de perfil

### 4.1 Rota e container

- Rota: **/perfil**. Página “client” que usa `useAuth()` e `useRouter()`.
- Se `loading` ou não há `profile`, mostrar estado “Carregando...” ou redirecionar para `/login` quando `!loading && !profile` (após mount).
- Título e descrição (ex.: “Meu Perfil”, “Ajuste suas informações pessoais”). Conteúdo em `max-w-xl`, com cards/sections.

### 4.2 Formulário de perfil (ProfileForm)

- Recebe `profile` (AuthProfile) como prop.
- Campos: **nome**, **email**, **avatar_url** (URL), **departamento** (select; opções podem vir de API ou constante). Validação zod: nome obrigatório, email opcional mas válido se preenchido, avatar_url opcional mas URL válida, departamento obrigatório.
- **react-hook-form** com `defaultValues` e `form.reset(profile)` em `useEffect` quando `profile` mudar. Select de departamento: opções dinâmicas (ex.: lista de áreas) mantendo o valor atual nas opções.
- Exibir **Avatar** no topo do form (usando `avatar_url` do form ou do profile); fallback com iniciais do nome.
- Ao submeter: chamar API/service que atualiza o usuário na tabela `users` (por `profile.id`) com name, email, avatar_url, department. Em sucesso, chamar `refreshProfile()` do context. Exibir erro de submit e estado de loading no botão (“Salvando...”).

### 4.3 Alterar senha (ChangePasswordForm)

- Segundo bloco na página de perfil: card “Alterar senha”.
- Form com **nova senha** e **confirmar senha**; zod com `.refine` para coincidência. Botão “Atualizar senha”.
- Submeter com `supabase.auth.updateUser({ password: newPassword })`. Mensagens de sucesso e erro; em sucesso, resetar o form.

---

## 5. Estrutura de arquivos sugerida

```
src/
  app/
    layout.tsx          → AuthProvider + AppLayout envolvendo children
    login/
      page.tsx          → Split screen + LoginForm
    perfil/
      page.tsx          → Título, ProfileForm, ChangePasswordForm
  components/
    auth/
      auth-guard.tsx    → Redireciona conforme user/loading e PUBLIC_PATHS
      login-form.tsx    → Formulários de login e signup
    layout/
      app-layout.tsx    → Sidebar + Header + main ou só children (login)
      sidebar.tsx       → Nav lateral + bottom nav mobile + avatar + logout
      header.tsx        → (opcional) Título da página, busca, etc.
    perfil/
      profile-form.tsx
      change-password-form.tsx
  contexts/
    auth-context.tsx    → AuthProvider, useAuth, user/profile/loading, signIn/signUp/signOut, refreshProfile, fetchProfile
  utils/supabase/
    client.ts           → createBrowserClient (Supabase)
```

---

## 6. Tabela `users` (Supabase)

- Colunas sugeridas: `id` (uuid, PK), `auth_id` (uuid, ligado ao Supabase Auth), `name`, `email`, `department`, `role`, `avatar_url`, `is_active`, timestamps. RLS conforme sua política (ex.: usuário pode atualizar apenas o próprio registro).

---

## 7. Checklist rápido para o outro projeto

- [ ] AuthProvider no root layout com getSession + onAuthStateChange + fetchProfile
- [ ] signIn / signUp / signOut; no signUp inserir linha em `users`
- [ ] AuthGuard com PUBLIC_PATHS e redirecionamentos
- [ ] AppLayout: em rota pública só children; senão Sidebar + Header + main
- [ ] Sidebar: nav por pathname, avatar com link para /perfil, logout, bottom nav no mobile
- [ ] Página de login: split screen + LoginForm com toggle login/signup e zod
- [ ] Página /perfil: ProfileForm (nome, email, avatar_url, departamento) + ChangePasswordForm (updateUser password)
- [ ] Formulários com react-hook-form, zod e componentes de Form/Input/Button/Select do design system

Copie e cole este resumo no outro projeto como prompt para implementar sidebar, login e perfil na mesma linha deste sistema.

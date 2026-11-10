/** Regra de senha nova (primeiro acesso), a mesma de /alterar-senha e /redefinir-senha. */
export function validateNewPassword(password: string): string | null {
  if (password.length < 6) return "A senha deve ter ao menos 6 caracteres.";
  if (password === "123456") return "Escolha uma senha diferente da padrão.";
  if (password.length > 72) return "A senha pode ter no máximo 72 caracteres.";
  return null;
}

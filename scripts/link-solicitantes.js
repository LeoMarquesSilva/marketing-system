/**
 * Vincula solicitantes (texto) às tabela users pelo nome.
 * Atualiza marketing_requests.solicitante_id onde há match.
 * Uso: node scripts/link-solicitantes.js
 */

require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });
const { createClient } = require("@supabase/supabase-js");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Configure .env.local com NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(url, key);

function normalize(str) {
  return (str || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

function findUserByName(solicitante, users) {
  if (!solicitante || !solicitante.trim()) return null;
  const s = normalize(solicitante);
  const words = s.split(" ").filter(Boolean);
  if (words.length === 0) return null;

  // 1. Match exato
  const exact = users.find((u) => normalize(u.name) === s);
  if (exact) return exact.id;

  // 2. Nome do usuário começa com o solicitante (ex: "Pamela Klava" -> "Pamela Klava Senna Patricio")
  const startsWith = users.find((u) => {
    const un = normalize(u.name);
    return un.startsWith(s) || un.startsWith(s + " ");
  });
  if (startsWith) return startsWith.id;

  // 3. Todas as palavras do solicitante estão no nome do usuário (ex: "Gabriela Consul" -> "Gabriela Nicolau Olmedo Consul")
  const wordMatch = users.find((u) => {
    const un = normalize(u.name);
    return words.every((w) => un.includes(w));
  });
  if (wordMatch) return wordMatch.id;

  // 4. Primeira palavra + última palavra (ex: "Ana Borba" -> "Ana Clara Borba Tavares")
  if (words.length >= 2) {
    const firstLast = words[0] + " " + words[words.length - 1];
    const flMatch = users.find((u) => {
      const un = normalize(u.name);
      const uWords = un.split(" ");
      return uWords[0] === words[0] && uWords[uWords.length - 1] === words[words.length - 1];
    });
    if (flMatch) return flMatch.id;
  }

  return null;
}

async function main() {
  const { data: users, error: usersErr } = await supabase
    .from("users")
    .select("id, name");

  if (usersErr) {
    console.error("Erro ao buscar usuários:", usersErr);
    process.exit(1);
  }

  const { data: requests, error: reqErr } = await supabase
    .from("marketing_requests")
    .select("id, solicitante, solicitante_id")
    .not("solicitante", "is", null);

  if (reqErr) {
    console.error("Erro ao buscar solicitações:", reqErr);
    process.exit(1);
  }

  const toUpdate = [];
  const nameToId = new Map();

  for (const r of requests || []) {
    if (r.solicitante_id) continue;
    let userId = nameToId.get(r.solicitante);
    if (userId === undefined) {
      userId = findUserByName(r.solicitante, users || []);
      nameToId.set(r.solicitante, userId);
    }
    if (userId) {
      toUpdate.push({ id: r.id, solicitante_id: userId });
    }
  }

  if (toUpdate.length === 0) {
    console.log("Nenhuma solicitação para vincular.");
    return;
  }

  let updated = 0;
  for (const u of toUpdate) {
    const { error } = await supabase
      .from("marketing_requests")
      .update({ solicitante_id: u.solicitante_id })
      .eq("id", u.id);
    if (!error) updated++;
  }

  console.log(`Vinculados ${updated} de ${toUpdate.length} solicitações a usuários.`);
}

main();

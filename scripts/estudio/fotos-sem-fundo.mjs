#!/usr/bin/env node
// Prepara as fotos sem fundo para as capas do Estúdio de peças (coleção BP).
//
// Pega a foto que cada colaborador marcou para o uso "Posts" em Minhas fotos, tira o
// fundo com o BiRefNet-portrait (licença MIT) rodando local, e sobe o PNG em
// ESTUDIO-PECAS/BP/fotos/<data>-<nome>-<foto>.png. O Estúdio acha a foto pelo nome
// do autor. Quem já tem o PNG daquela foto é pulado, então dá para rodar de novo
// quando alguém trocar a foto de Posts.
//
// Preparação (uma vez, fora do projeto, para não pesar no deploy):
//   mkdir rmbg && cd rmbg && npm init -y && npm i onnxruntime-node@1.22.0
//   baixar https://huggingface.co/onnx-community/BiRefNet-portrait-ONNX/resolve/main/onnx/model.onnx
//   para rmbg/modelo/birefnet-portrait.onnx
//
// Uso:
//   node scripts/estudio/fotos-sem-fundo.mjs --rmbg <pasta rmbg> [--so "Nome"] [--local <pasta>] [--refazer] [--cpu] [--threads 8]
//   --cpu pula a GPU (com 6 GB ela não aguenta o modelo); cada foto leva ~1 min no processador.
//   --local salva os PNGs na pasta em vez de subir (para conferir antes).

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");
const { createClient } = require("@supabase/supabase-js");

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const rmbgDir = opt("--rmbg");
const only = opt("--so");
const localDir = opt("--local");
const redo = args.includes("--refazer");
if (!rmbgDir) {
  console.error("Informe --rmbg <pasta com onnxruntime-node e modelo/birefnet-portrait.onnx>");
  process.exit(1);
}

const ort = createRequire(path.join(path.resolve(rmbgDir), "package.json"))("onnxruntime-node");

for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const BUCKET_FOTOS = "MARKETING-SYSTEM-FOTOS";
const BUCKET_ESTUDIO = "ESTUDIO-PECAS";
const PASTA = "BP/fotos";
const SIZE = 1024;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

const slug = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

async function loadSession() {
  const model = path.join(rmbgDir, "modelo", "birefnet-portrait.onnx");
  // a GPU (DirectML) é tentada primeiro; se faltar memória na rodada de teste, vai pelo processador
  for (const providers of args.includes("--cpu") ? [["cpu"]] : [["dml"], ["cpu"]]) {
    try {
      // --threads deixa núcleos livres para o resto da máquina (o modelo usa todos por padrão)
      const threads = Number(opt("--threads")) || undefined;
      const session = await ort.InferenceSession.create(model, {
        executionProviders: providers,
        graphOptimizationLevel: "all",
        ...(threads ? { intraOpNumThreads: threads, interOpNumThreads: 1 } : {}),
      });
      if (providers[0] !== "cpu") {
        const zeros = new ort.Tensor("float32", new Float32Array(3 * SIZE * SIZE), [1, 3, SIZE, SIZE]);
        await session.run({ [session.inputNames[0]]: zeros });
      }
      console.log(`modelo carregado (${providers[0]}); entrada ${session.inputNames}, saída ${session.outputNames}`);
      return session;
    } catch (err) {
      console.log(`sem ${providers[0]}: ${err.message.split("\n")[0]}`);
    }
  }
  throw new Error("Não foi possível carregar o modelo.");
}

/** Máscara do primeiro plano (0–255) no tamanho da foto. */
async function personMask(session, image, width, height) {
  const { data } = await image.clone().resize(SIZE, SIZE, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const input = new Float32Array(3 * SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    for (let c = 0; c < 3; c++) input[c * SIZE * SIZE + i] = (data[i * 3 + c] / 255 - MEAN[c]) / STD[c];
  }
  const feeds = { [session.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, SIZE, SIZE]) };
  const out = await session.run(feeds);
  const logits = out[session.outputNames[session.outputNames.length - 1]].data;
  let min = Infinity;
  let max = -Infinity;
  for (const v of logits) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const needsSigmoid = min < 0 || max > 1;
  const mask = Buffer.alloc(SIZE * SIZE);
  for (let i = 0; i < mask.length; i++) {
    const p = needsSigmoid ? 1 / (1 + Math.exp(-logits[i])) : logits[i];
    mask[i] = p < 0.03 ? 0 : Math.round(Math.min(1, p) * 255);
  }
  // extractChannel: o sharp devolve 3 canais depois do resize, e a máscara precisa de 1
  return sharp(mask, { raw: { width: SIZE, height: SIZE, channels: 1 } })
    .resize(width, height, { fit: "fill", kernel: "lanczos3" })
    .extractChannel(0)
    .raw()
    .toBuffer();
}

async function cutout(session, bytes) {
  const base = sharp(bytes).rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true });
  const { data: rgb, info } = await base.clone().removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = await personMask(session, sharp(rgb, { raw: info }), info.width, info.height);
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) {
    rgba[i * 4] = rgb[i * 3];
    rgba[i * 4 + 1] = rgb[i * 3 + 1];
    rgba[i * 4 + 2] = rgb[i * 3 + 2];
    rgba[i * 4 + 3] = alpha[i];
  }
  const trimmed = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  return sharp(trimmed)
    .trim({ threshold: 10 })
    // na capa a foto ocupa uns 830 px de altura: 1800 dá folga para zoom sem pesar no PNG
    .resize({ width: 1400, height: 1800, fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  const { data: rows, error } = await db
    .from("collaborator_photo_usages")
    .select("user_id, photo_id, photo_usage_types!inner(slug), collaborator_photos!inner(storage_path)")
    .eq("photo_usage_types.slug", "posts");
  if (error) throw error;

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: people } = await db.from("hr_employees").select("user_id, full_name").in("user_id", userIds);
  const { data: users } = await db.from("users").select("id, name").in("id", userIds);
  const nameOf = (id) => people?.find((p) => p.user_id === id)?.full_name ?? users?.find((u) => u.id === id)?.name ?? null;

  const { data: existing } = await db.storage.from(BUCKET_ESTUDIO).list(PASTA, { limit: 1000 });
  const done = new Set((existing ?? []).map((f) => f.name.replace(/\.png$/, "").split("-").pop()));

  const session = await loadSession();
  let feitos = 0;
  for (const row of rows) {
    const name = nameOf(row.user_id);
    if (!name) continue;
    if (only && !slug(name).includes(slug(only))) continue;
    const tag = row.photo_id.slice(0, 8);
    if (!redo && !localDir && done.has(tag)) {
      console.log(`já pronta: ${name}`);
      continue;
    }
    const started = Date.now();
    const { data: file, error: dlError } = await db.storage.from(BUCKET_FOTOS).download(row.collaborator_photos.storage_path);
    if (dlError) {
      console.log(`sem foto: ${name} (${dlError.message})`);
      continue;
    }
    const png = await cutout(session, Buffer.from(await file.arrayBuffer()));
    const fileName = `${Date.now()}-${slug(name)}-${tag}.png`;
    if (localDir) {
      fs.mkdirSync(localDir, { recursive: true });
      fs.writeFileSync(path.join(localDir, fileName), png);
    } else {
      const { error: upError } = await db.storage.from(BUCKET_ESTUDIO).upload(`${PASTA}/${fileName}`, png, { contentType: "image/png", upsert: false });
      if (upError) throw upError;
    }
    feitos++;
    console.log(`ok: ${name} (${Math.round(png.length / 1024)} KB, ${((Date.now() - started) / 1000).toFixed(1)} s)`);
  }
  console.log(`${feitos} foto(s) processada(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Referências de looks da festa de 10 anos (cartela "Azul e areia", opção 3 do guia).
 * As fotos ficam em /public/dress-code/10-anos. As sem crédito vieram do PDF oficial;
 * as com crédito são de bancos com licença livre (Unsplash/Pexels), escolhidas para
 * variar etnias, idades e tipos de corpo.
 */

export interface LookCredit {
  name: string;
  source: "Unsplash" | "Pexels";
  url: string;
}

export interface Look {
  src: string;
  width: number;
  height: number;
  caption: string;
  credit?: LookCredit;
}

export interface Swatch {
  name: string;
  hex: string;
}

const DIR = "/dress-code/10-anos";

function pexels(name: string, url: string): LookCredit {
  return { name, source: "Pexels", url };
}

function unsplash(name: string, url: string): LookCredit {
  return { name, source: "Unsplash", url };
}

export const PALETA: Swatch[] = [
  { name: "Off-white", hex: "#f8f6f1" },
  { name: "Bege", hex: "#faebd7" },
  { name: "Areia", hex: "#d8c2a0" },
  { name: "Celeste", hex: "#bbd5ee" },
  { name: "Azul-céu", hex: "#8db8e0" },
  { name: "Azul-jeans", hex: "#5b86b8" },
  { name: "Cobalto", hex: "#2e5fa3" },
  { name: "Petróleo", hex: "#2f6f7a" },
  { name: "Marinho", hex: "#1f3556" },
  { name: "Marinho noite", hex: "#0d1e2e" },
];

// Ordem de leitura por linha: intercala fotos do guia e inspirações, variando etnias desde o topo.
export const LOOKS_ELAS: Look[] = [
  {
    src: `${DIR}/elas-conjunto-celeste-pexels-12904474.jpg`,
    width: 1100,
    height: 1650,
    caption: "Conjunto celeste",
    credit: pexels("J-Scott Photography", "https://www.pexels.com/photo/woman-wearing-white-tube-top-12904474/"),
  },
  { src: `${DIR}/elas-longo-marinho-cetim.jpg`, width: 356, height: 1118, caption: "Longo marinho em cetim" },
  {
    src: `${DIR}/elas-off-white-palha-pexels-38221804.jpg`,
    width: 1100,
    height: 1649,
    caption: "Off-white com chapéu de palha",
    credit: pexels("Giang Đỗ", "https://www.pexels.com/photo/woman-in-white-dress-walking-in-a-floral-garden-38221804/"),
  },
  {
    src: `${DIR}/elas-macacao-azul-ceu-pexels-27954789.jpg`,
    width: 1100,
    height: 1650,
    caption: "Macacão azul-céu",
    credit: pexels(
      "pedro furtado",
      "https://www.pexels.com/photo/a-woman-in-a-blue-jumpsuit-with-a-flower-on-her-head-27954789/"
    ),
  },
  { src: `${DIR}/elas-conjunto-celeste.jpg`, width: 296, height: 920, caption: "Conjunto celeste" },
  {
    src: `${DIR}/elas-alfaiataria-marinho-unsplash-PFdDqC-9Bzk.jpg`,
    width: 1100,
    height: 1650,
    caption: "Alfaiataria marinho",
    credit: unsplash("sammy swae", "https://unsplash.com/photos/woman-in-a-navy-blue-suit-by-the-ocean-PFdDqC-9Bzk"),
  },
  {
    src: `${DIR}/elas-vestido-marinho-cetim-pexels-32192276.jpg`,
    width: 1100,
    height: 1656,
    caption: "Vestido marinho em cetim",
    credit: pexels("Aleksey Mayorov", "https://www.pexels.com/photo/elegant-woman-in-blue-satin-evening-dress-32192276/"),
  },
  {
    src: `${DIR}/elas-midi-bege-pexels-26760653.jpg`,
    width: 1100,
    height: 1956,
    caption: "Midi bege com faixa",
    credit: pexels("Brian Jiz", "https://www.pexels.com/photo/woman-wearing-a-dress-26760653/"),
  },
  {
    src: `${DIR}/elas-longo-azul-ceu-pexels-30158511.jpg`,
    width: 1100,
    height: 1648,
    caption: "Longo azul-céu",
    credit: pexels("Deji Prince", "https://www.pexels.com/photo/elegant-woman-in-a-garden-setting-30158511/"),
  },
  { src: `${DIR}/elas-conjunto-marinho.jpg`, width: 381, height: 1188, caption: "Conjunto marinho" },
  {
    src: `${DIR}/elas-vestido-azul-claro-pexels-4937997.jpg`,
    width: 1100,
    height: 1650,
    caption: "Vestido azul-claro fluido",
    credit: pexels("Yaroslav Shuraev", "https://www.pexels.com/photo/a-woman-in-blue-dress-4937997/"),
  },
  {
    src: `${DIR}/elas-longo-bege-pexels-36742035.jpg`,
    width: 1100,
    height: 1375,
    caption: "Longo bege",
    credit: pexels("K Studios", "https://www.pexels.com/photo/elegant-woman-strolling-in-lush-green-field-36742035/"),
  },
  {
    src: `${DIR}/elas-conjunto-azul-ceu-pexels-13067028.jpg`,
    width: 1100,
    height: 1756,
    caption: "Conjunto azul-céu com pantalona",
    credit: pexels(
      "mehrab zahedbeigi",
      "https://www.pexels.com/photo/a-woman-in-blue-long-sleeves-and-pants-standing-on-a-concrete-floor-13067028/"
    ),
  },
  { src: `${DIR}/elas-macacao-marinho.jpg`, width: 174, height: 539, caption: "Macacão marinho" },
];

export const LOOKS_ELES: Look[] = [
  {
    src: `${DIR}/eles-terno-areia-pexels-39731511.jpg`,
    width: 1100,
    height: 1650,
    caption: "Terno areia, camisa branca",
    credit: pexels("BMH Shot It", "https://www.pexels.com/photo/man-in-stylish-beige-suit-on-rooftop-patio-39731511/"),
  },
  {
    src: `${DIR}/eles-marinho-bege-azul-claro.jpg`,
    width: 1020,
    height: 1114,
    caption: "Marinho, bege e azul-claro",
  },
  {
    src: `${DIR}/eles-camisa-listrada-unsplash-sNiTXjs8ldk.jpg`,
    width: 1100,
    height: 1650,
    caption: "Camisa listrada e calça clara",
    credit: unsplash("Muzamil Hussain", "https://unsplash.com/photos/man-in-a-striped-shirt-holding-a-jacket-sNiTXjs8ldk"),
  },
  {
    src: `${DIR}/eles-blazer-cobalto-pexels-40079139.jpg`,
    width: 1100,
    height: 1650,
    caption: "Blazer cobalto e calça creme",
    credit: pexels(
      "Khutso Mokoena",
      "https://www.pexels.com/photo/stylish-businessman-in-blue-blazer-outdoors-40079139/"
    ),
  },
  {
    src: `${DIR}/eles-linho-areia-azul-jeans.jpg`,
    width: 897,
    height: 1114,
    caption: "Linho areia e azul-jeans",
  },
  {
    src: `${DIR}/eles-terno-bege-pexels-15298646.jpg`,
    width: 1100,
    height: 1650,
    caption: "Terno bege sem gravata",
    credit: pexels("Kushan Perera", "https://www.pexels.com/photo/man-in-suit-15298646/"),
  },
  {
    src: `${DIR}/eles-blazer-cobalto-unsplash-h2kODkqFL6g.jpg`,
    width: 1100,
    height: 1650,
    caption: "Blazer cobalto e calça clara",
    credit: unsplash(
      "Marcos Paulo Prado",
      "https://unsplash.com/photos/man-in-blue-suit-standing-on-white-sand-near-body-of-water-during-daytime-h2kODkqFL6g"
    ),
  },
  {
    src: `${DIR}/eles-terno-linho-camisa-branca.jpg`,
    width: 523,
    height: 1017,
    caption: "Terno de linho, camisa branca",
  },
  {
    src: `${DIR}/eles-calca-marinho-pexels-18703880.jpg`,
    width: 1100,
    height: 1649,
    caption: "Calça marinho e camisa branca",
    credit: pexels("Anyana Webb", "https://www.pexels.com/photo/elegant-african-man-standing-on-a-bridge-18703880/"),
  },
  {
    src: `${DIR}/eles-calca-marinho-camisa-branca.jpg`,
    width: 693,
    height: 1017,
    caption: "Calça marinho e camisa branca",
  },
  {
    src: `${DIR}/eles-camisa-listrada-calca-linho.jpg`,
    width: 644,
    height: 1017,
    caption: "Camisa listrada e calça de linho",
  },
];

// Enviopack pide el ID de provincia bajo el estándar ISO 3166-2:AR
// sin el prefijo "AR-" (ej: Buenos Aires = "B", CABA = "C").
const PROVINCE_ISO_CODES = {
  "ciudad autonoma de buenos aires": "C",
  caba: "C",
  "buenos aires": "B",
  catamarca: "K",
  chaco: "H",
  chubut: "U",
  cordoba: "X",
  corrientes: "W",
  "entre rios": "E",
  formosa: "P",
  jujuy: "Y",
  "la pampa": "L",
  "la rioja": "F",
  mendoza: "M",
  misiones: "N",
  neuquen: "Q",
  "rio negro": "R",
  salta: "A",
  "san juan": "J",
  "san luis": "D",
  "santa cruz": "Z",
  "santa fe": "S",
  "santiago del estero": "G",
  "tierra del fuego": "V",
  tucuman: "T",
};

function normalize(value) {
  return (value || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getProvinceIsoCode(provinceName) {
  return PROVINCE_ISO_CODES[normalize(provinceName)] || null;
}

module.exports = { getProvinceIsoCode };
const MiCorreoClient = require("./MicorreoClient");

// =====================================================
// CONFIGURACIÓN
// =====================================================

const miCorreo = new MiCorreoClient({
  baseUrl: process.env.MICORREO_BASE_URL, // https://apitest.correoargentino.com.ar/micorreo/v1 (QA) o api.correoargentino.com.ar/micorreo/v1 (prod)
  user: process.env.MICORREO_USER,
  password: process.env.MICORREO_PASSWORD,
  customerId: process.env.MICORREO_CUSTOMER_ID,
});

// CP del depósito/centro de despacho desde donde salen los envíos.
// Ojo: es DISTINTO de SHIPPING_ORIGIN_LAT/LON del controller (esas son
// coordenadas para el cálculo de distancia/zona directa con Haversine;
// MiCorreo necesita el CP, no lat/lon).
const ORIGIN_POSTAL_CODE = process.env.MICORREO_ORIGIN_POSTAL_CODE;

const MIN_DIMENSION_CM = 1;
const MAX_DIMENSION_CM = 150;
const MIN_WEIGHT_G = 1;
const MAX_WEIGHT_G = 25000;

// =====================================================
// VOLUMEN (m3) -> DIMENSIONES (cm)
// =====================================================
//
// El carrito solo trae peso y volumen total (no un largo/ancho/alto por
// paquete), así que aproximamos el bulto como un cubo equivalente a ese
// volumen. Es una simplificación razonable para cotizar; si en algún
// momento cargás dimensiones reales por producto, conviene sumarlas en
// vez de estimarlas acá.
// =====================================================

function volumeToDimensionsCm(totalVolumeM3) {
  const safeVolume = totalVolumeM3 > 0 ? totalVolumeM3 : 0.01;
  const sideCm = Math.cbrt(safeVolume * 1_000_000);

  const side = Math.min(
    Math.max(Math.round(sideCm), MIN_DIMENSION_CM),
    MAX_DIMENSION_CM,
  );

  return { height: side, width: side, length: side };
}

function kgToGramsClamped(totalWeightKg) {
  const grams = Math.round((totalWeightKg || 0) * 1000);
  return Math.min(Math.max(grams, MIN_WEIGHT_G), MAX_WEIGHT_G);
}

// =====================================================
// COTIZAR CON MICORREO
// =====================================================
//
// Firma idéntica a la que ya usa evaluateShipping():
//   quoteExternalShipping({ postalCode, totalWeightKg, totalVolumeM3 })
//
// Devuelve un objeto shipping con la misma forma que el de "envío directo"
// ({ id, title, description, price, estimatedDelivery }) para que el
// controller no necesite cambios.
// =====================================================

async function quoteExternalShipping({ postalCode, totalWeightKg, totalVolumeM3 }) {
  if (!postalCode) {
    throw new Error("Falta postalCode para cotizar con MiCorreo");
  }
  if (!ORIGIN_POSTAL_CODE) {
    throw new Error(
      "Falta configurar MICORREO_ORIGIN_POSTAL_CODE (CP del depósito) en las variables de entorno",
    );
  }

  const dimensions = {
    weight: kgToGramsClamped(totalWeightKg),
    ...volumeToDimensionsCm(totalVolumeM3),
  };

  let response;
  try {
    response = await miCorreo.getRates({
      postalCodeOrigin: ORIGIN_POSTAL_CODE,
      postalCodeDestination: postalCode,
      // Sin deliveredType: pedimos ambas cotizaciones (domicilio y sucursal)
      // y nos quedamos con la de domicilio, que es la que corresponde acá.
      dimensions,
    });
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;
    console.error("Error cotizando con MiCorreo:", status, data || error.message);
    throw new Error(
      data?.message || "No se pudo obtener la cotización de MiCorreo",
    );
  }

  const rates = response.rates || [];
  const domicilio = rates.find((r) => r.deliveredType === "D");
  const chosen = domicilio || rates[0];

  if (!chosen) {
    throw new Error("MiCorreo no devolvió tarifas para ese código postal");
  }

  return {
    id: "micorreo",
    title: chosen.productName || "Correo Argentino",
    description:
      chosen.deliveredType === "D"
        ? "Entrega a domicilio con Correo Argentino."
        : "Entrega en sucursal de Correo Argentino.",
    price: chosen.price,
    // /rates no informa plazo de entrega, solo precio.
    estimatedDelivery: null,
    provider: "micorreo",
    productType: chosen.productType || null,
    dimensionsUsed: dimensions,
  };
}

module.exports = { quoteExternalShipping };
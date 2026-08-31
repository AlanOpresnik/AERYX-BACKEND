const axios = require("axios");

// =====================================================
// CONFIGURACIÓN
// =====================================================

const CORREO_ENV = process.env.CORREO_ENV || "test"; // "test" | "production"

const CORREO_BASE_URL =
  CORREO_ENV === "production"
    ? "https://api.correoargentino.com.ar/micorreo/v1"
    : "https://apitest.correoargentino.com.ar/micorreo/v1";

const CORREO_USER_TOKEN = process.env.CORREO_USER_TOKEN || "";
const CORREO_PASSWORD_TOKEN = process.env.CORREO_PASSWORD_TOKEN || "";
const CORREO_EMAIL = process.env.CORREO_EMAIL || "";
const CORREO_PASSWORD = process.env.CORREO_PASSWORD || "";

// Opcional: si ya sabés tu customerId, lo cargás acá y te saltás
// el paso de /users/validate en cada request.
const CORREO_CUSTOMER_ID_ENV = process.env.CORREO_CUSTOMER_ID || "";

// =====================================================
// CACHE EN MEMORIA (token + customerId)
// =====================================================
//
// Simple porque corre en un solo proceso Node. Si en algún
// momento escalás a múltiples instancias, esto tendría que
// pasar a algo compartido (Redis, etc.) para no pedir un
// token nuevo por instancia innecesariamente.
//
// =====================================================

let cachedToken = null;
let cachedTokenExpiresAt = 0; // epoch ms
let cachedCustomerId = CORREO_CUSTOMER_ID_ENV || null;

function hasCredentials() {
  return Boolean(
    CORREO_USER_TOKEN &&
      CORREO_PASSWORD_TOKEN &&
      CORREO_EMAIL &&
      CORREO_PASSWORD,
  );
}

// =====================================================
// AUTENTICACIÓN: POST /token (Basic Auth) -> JWT
// =====================================================

async function fetchToken() {
  const basicAuth = Buffer.from(
    `${CORREO_USER_TOKEN}:${CORREO_PASSWORD_TOKEN}`,
  ).toString("base64");

  const response = await axios.post(
    `${CORREO_BASE_URL}/token`,
    {},
    {
      headers: {
        Authorization: `Basic ${basicAuth}`,
      },
      timeout: 8000,
    },
  );

  const { token, expires } = response.data;

  cachedToken = token;

  // Restamos 60s de margen para no usar un token a punto de vencer.
  cachedTokenExpiresAt = expires
    ? new Date(expires).getTime() - 60_000
    : Date.now() + 5 * 60_000;

  return token;
}

async function getValidToken() {
  if (cachedToken && Date.now() < cachedTokenExpiresAt) {
    return cachedToken;
  }

  return fetchToken();
}

// =====================================================
// CUSTOMER ID: POST /users/validate
// =====================================================

async function fetchCustomerId(token) {
  const response = await axios.post(
    `${CORREO_BASE_URL}/users/validate`,
    {
      email: CORREO_EMAIL,
      password: CORREO_PASSWORD,
    },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: 8000,
    },
  );

  cachedCustomerId = response.data.customerId;

  return cachedCustomerId;
}

async function getCustomerId(token) {
  if (CORREO_CUSTOMER_ID_ENV) {
    return CORREO_CUSTOMER_ID_ENV;
  }

  if (cachedCustomerId) {
    return cachedCustomerId;
  }

  return fetchCustomerId(token);
}

// =====================================================
// DIMENSIONES: aproximamos un cubo a partir del volumen
// =====================================================
//
// MiCorreo pide length/width/height individuales en cm, pero
// hoy solo tenemos volumen total (m³) del carrito, no las tres
// dimensiones reales. Mientras no carguemos dimensiones reales
// por producto, aproximamos el paquete como un cubo cuyo
// volumen coincide con el total: L = W = H = cbrt(volumen_cm3).
//
// Es una aproximación razonable para cotizar, pero no es exacta.
// Si en algún momento cargás L/W/H reales por producto, este es
// el lugar para reemplazar el cálculo.
//
// =====================================================

function estimateCubicDimensionsCm(totalVolumeM3) {
  const volumeCm3 = Math.max(totalVolumeM3, 0.0001) * 1_000_000;

  const side = Math.cbrt(volumeCm3);

  // MiCorreo limita cada lado a 150cm.
  const clampedSide = Math.min(side, 150);

  return {
    length: Math.max(Math.ceil(clampedSide), 1),
    width: Math.max(Math.ceil(clampedSide), 1),
    height: Math.max(Math.ceil(clampedSide), 1),
  };
}

// =====================================================
// COTIZAR: POST /rates
// =====================================================

async function quoteCorreoArgentinoShipping({
  postalCodeOrigin,
  postalCodeDestination,
  totalWeightKg,
  totalVolumeM3,
}) {
  if (!hasCredentials()) {
    console.error(
      "Correo Argentino: faltan CORREO_USER_TOKEN / CORREO_PASSWORD_TOKEN / CORREO_EMAIL / CORREO_PASSWORD en el .env",
    );

    return null;
  }

  try {
    const token = await getValidToken();
    const customerId = await getCustomerId(token);

    const weightGrams = Math.min(
      Math.max(Math.round(totalWeightKg * 1000), 1),
      25000, // límite de MiCorreo
    );

    const { length, width, height } =
      estimateCubicDimensionsCm(totalVolumeM3);

    const response = await axios.post(
      `${CORREO_BASE_URL}/rates`,
      {
        customerId,
        postalCodeOrigin,
        postalCodeDestination,
        dimensions: {
          weight: weightGrams,
          length,
          width,
          height,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 8000,
      },
    );
    const rates = response.data?.rates || [];

    if (!rates.length) {
      return null;
    }

    // Nos quedamos con la tarifa más barata entre las modalidades
    // que devuelva (a domicilio "D" y/o a sucursal "S").
    const cheapest = rates.reduce((min, current) =>
      current.price < min.price ? current : min,
    );

    return {
      price: Number(cheapest.price.toFixed(2)),
      estimatedDelivery:
        cheapest.deliveryTimeMin && cheapest.deliveryTimeMax
          ? `${cheapest.deliveryTimeMin}-${cheapest.deliveryTimeMax} días hábiles`
          : "Según localidad",
      productName: cheapest.productName,
      raw: rates,
    };
  } catch (error) {
    // Si el token cacheado quedó inválido (401), lo limpiamos para
    // forzar un re-login en el próximo intento.
    if (error.response?.status === 401) {
      cachedToken = null;
      cachedTokenExpiresAt = 0;
    }

    console.error(
      "Correo Argentino: error consultando /rates:",
      error.response?.data || error.message,
    );

    return null;
  }
}

module.exports = {
  quoteCorreoArgentinoShipping,
};
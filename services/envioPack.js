// =====================================================
// services/envioPack.js
// =====================================================

const axios = require("axios");

const BASE_URL = "https://api.enviopack.com";

// =====================================================
// TOKEN
// =====================================================

let cachedToken = null;
let tokenExpiresAt = 0;

async function requestNewToken() {
  if (
    !process.env.ENVIOPACK_API_KEY ||
    !process.env.ENVIOPACK_SECRET_KEY
  ) {
    throw new Error(
      "[Enviopack] Faltan ENVIOPACK_API_KEY o ENVIOPACK_SECRET_KEY",
    );
  }

  const { data } = await axios.post(
    `${BASE_URL}/auth`,
    new URLSearchParams({
      "api-key": process.env.ENVIOPACK_API_KEY,
      "secret-key": process.env.ENVIOPACK_SECRET_KEY,
    }),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      timeout: 10000,
    },
  );

  if (!data?.token) {
    throw new Error(
      `[Enviopack] La respuesta de /auth no trajo token. ${JSON.stringify(
        data,
      )}`,
    );
  }

  cachedToken = data.token;

  // Token válido aproximadamente 4 horas.
  // Renovamos 5 minutos antes.
  tokenExpiresAt =
    Date.now() +
    4 * 60 * 60 * 1000 -
    5 * 60 * 1000;

  return cachedToken;
}

async function getAccessToken() {
  if (
    cachedToken &&
    Date.now() < tokenExpiresAt
  ) {
    return cachedToken;
  }

  return requestNewToken();
}

async function withAuthRequest(request) {
  try {
    const token = await getAccessToken();

    return await request(token);
  } catch (error) {
    if (error.response?.status === 401) {
      const freshToken = await requestNewToken();

      return await request(freshToken);
    }

    throw error;
  }
}

// =====================================================
// COTIZAR PRECIO CLIENTE
// =====================================================

async function quoteHomeDelivery({
  provinciaId,
  codigoPostal,
  pesoKg,
  paquetes,
  servicio = "N",
}) {
  return withAuthRequest(async (accessToken) => {
    const params = {
      access_token: accessToken,
      provincia: provinciaId,
      codigo_postal: codigoPostal,
      peso: pesoKg,
      servicio,
    };

    if (paquetes) {
      params.paquetes = paquetes;
    }

    // Si tenés configurado un depósito específico,
    // también lo usamos para cotizar.
    if (process.env.ENVIOPACK_DIRECCION_ENVIO_ID) {
      params.direccion_envio =
        process.env.ENVIOPACK_DIRECCION_ENVIO_ID;
    }

    const { data } = await axios.get(
      `${BASE_URL}/cotizar/precio/a-domicilio`,
      {
        params,
        timeout: 10000,
      },
    );

    return Array.isArray(data) ? data : [];
  });
}

// =====================================================
// COTIZAR COSTO REAL / CARRIER
// =====================================================

async function quoteCarrier({
  provinciaId,
  codigoPostal,
  pesoKg,
  paquetes,
  servicio = "N",
}) {
  return withAuthRequest(async (accessToken) => {
    const params = {
      access_token: accessToken,

      provincia: provinciaId,

      codigo_postal: codigoPostal,

      peso: pesoKg,

      servicio,

      modalidad: "D",

      despacho: "D",

      orden_columna: "valor",

      orden_sentido: "asc",
    };

    if (paquetes) {
      params.paquetes = paquetes;
    }

    if (process.env.ENVIOPACK_DIRECCION_ENVIO_ID) {
      params.direccion_envio =
        process.env.ENVIOPACK_DIRECCION_ENVIO_ID;
    }

    const { data } = await axios.get(
      `${BASE_URL}/cotizar/costo`,
      {
        params,
        timeout: 10000,
      },
    );

    return Array.isArray(data) ? data : [];
  });
}

// =====================================================
// COTIZACIÓN COMPLETA
// =====================================================

async function quoteHomeDeliveryComplete({
  provinciaId,
  codigoPostal,
  pesoKg,
  paquetes,
  servicio = "N",
}) {
  const [
    prices,
    carrierQuotes,
  ] = await Promise.all([
    quoteHomeDelivery({
      provinciaId,
      codigoPostal,
      pesoKg,
      paquetes,
      servicio,
    }),

    quoteCarrier({
      provinciaId,
      codigoPostal,
      pesoKg,
      paquetes,
      servicio,
    }),
  ]);

  return {
    prices,
    carrierQuotes,
  };
}

// =====================================================
// CREAR PEDIDO EN ENVIOPACK
// =====================================================
//
// IMPORTANTE:
//
// /pedidos NO recibe la dirección completa.
//
// La dirección pertenece a /envios.
//
// /pedidos necesita obligatoriamente:
// id_externo
// nombre
// apellido
// email
// monto
// fecha_alta
// pagado
//
// =====================================================

async function createOrder(data) {
  if (!data?.idExterno) {
    throw new Error(
      "[Enviopack] Falta idExterno.",
    );
  }

  const body = {
    id_externo: String(data.idExterno),

    nombre: String(data.nombre || "").slice(
      0,
      30,
    ),

    apellido: String(data.apellido || "").slice(
      0,
      30,
    ),

    email: String(data.email || "").slice(
      0,
      100,
    ),

    telefono: String(data.telefono || "").slice(
      0,
      30,
    ),

    celular: String(data.celular || "").slice(
      0,
      30,
    ),

    monto: Number(data.monto || 0),

    fecha_alta:
      data.fechaAlta ||
      new Date().toISOString(),

    pagado: Boolean(data.pagado),

    provincia: data.provincia || undefined,

    localidad: String(
      data.localidad || "",
    ).slice(0, 50),
  };

  // Eliminamos propiedades undefined.
  Object.keys(body).forEach((key) => {
    if (body[key] === undefined) {
      delete body[key];
    }
  });

  console.log(
    "[Enviopack] BODY /pedidos:",
    JSON.stringify(body, null, 2),
  );

  return withAuthRequest(
    async (accessToken) => {
      const { data: responseData } =
        await axios.post(
          `${BASE_URL}/pedidos`,
          body,
          {
            params: {
              access_token: accessToken,
            },

            headers: {
              "Content-Type":
                "application/json",
            },

            timeout: 15000,
          },
        );

      console.log(
        "[Enviopack] RESPONSE /pedidos:",
        JSON.stringify(
          responseData,
          null,
          2,
        ),
      );

      return responseData;
    },
  );
}

// =====================================================
// CREAR ENVÍO
// =====================================================
//
// /envios ES donde van:
//
// - dirección
// - paquetes
// - destinatario
// - modalidad
// - servicio
// - correo
//
// =====================================================

async function createShipment({
  pedido,
  direccionEnvio,
  destinatario,
  observaciones,
  modalidad = "D",
  servicio,
  correo,
  confirmado = false,
  paquetes,

  calle,
  numero,
  piso,
  depto,
  referenciaDomicilio,
  codigoPostal,
  provincia,
  localidad,
}) {
  if (!pedido) {
    throw new Error(
      "[Enviopack] Falta pedido.",
    );
  }

  if (!Array.isArray(paquetes) || !paquetes.length) {
    throw new Error(
      "[Enviopack] El envío debe tener al menos un paquete.",
    );
  }

  if (!calle) {
    throw new Error(
      "[Enviopack] Falta calle.",
    );
  }

  if (!numero) {
    throw new Error(
      "[Enviopack] Falta número.",
    );
  }

  if (!codigoPostal) {
    throw new Error(
      "[Enviopack] Falta código postal.",
    );
  }

  if (!provincia) {
    throw new Error(
      "[Enviopack] Falta provincia.",
    );
  }

  if (!localidad) {
    throw new Error(
      "[Enviopack] Falta localidad.",
    );
  }

  if (!destinatario) {
    throw new Error(
      "[Enviopack] Falta destinatario.",
    );
  }

  if (!servicio) {
    throw new Error(
      "[Enviopack] Falta servicio.",
    );
  }

  if (!correo) {
    throw new Error(
      "[Enviopack] Falta correo/carrier.",
    );
  }

  if (
    confirmado &&
    !process.env.ENVIOPACK_DIRECCION_ENVIO_ID &&
    !direccionEnvio
  ) {
    throw new Error(
      "[Enviopack] Para confirmar el envío necesitás ENVIOPACK_DIRECCION_ENVIO_ID.",
    );
  }

  return withAuthRequest(
    async (accessToken) => {
      const body = {
        pedido,

        destinatario,

        observaciones:
          observaciones || "",

        modalidad,

        servicio,

        correo,

        confirmado,

        despacho: "D",

        paquetes,

        calle,

        numero,

        piso: piso || "",

        depto: depto || "",

        referencia_domicilio:
          referenciaDomicilio || "",

        codigo_postal: String(
          codigoPostal,
        ),

        provincia,

        localidad,
      };

      // direccion_envio identifica el DEPÓSITO
      // de origen, NO la dirección del cliente.
      //
      // Para un envío confirmado es obligatorio.
      const sourceAddressId =
        direccionEnvio ||
        process.env
          .ENVIOPACK_DIRECCION_ENVIO_ID;

      if (sourceAddressId) {
        body.direccion_envio =
          sourceAddressId;
      }

      console.log(
        "[Enviopack] BODY /envios:",
        JSON.stringify(body, null, 2),
      );

      const { data } =
        await axios.post(
          `${BASE_URL}/envios`,
          body,
          {
            params: {
              access_token: accessToken,
            },

            headers: {
              "Content-Type":
                "application/json",
            },

            timeout: 15000,
          },
        );

      console.log(
        "[Enviopack] RESPONSE /envios:",
        JSON.stringify(data, null, 2),
      );

      return data;
    },
  );
}

// =====================================================
// OBTENER ENVÍO
// =====================================================

async function getShipment(shipmentId) {
  if (!shipmentId) {
    throw new Error(
      "[Enviopack] Falta shipmentId.",
    );
  }

  return withAuthRequest(
    async (accessToken) => {
      const { data } =
        await axios.get(
          `${BASE_URL}/envios/${shipmentId}`,
          {
            params: {
              access_token: accessToken,
            },

            timeout: 10000,
          },
        );

      return data;
    },
  );
}

// =====================================================
// OBTENER PEDIDO
// =====================================================

async function getOrder(orderId) {
  if (!orderId) {
    throw new Error(
      "[Enviopack] Falta orderId.",
    );
  }

  return withAuthRequest(
    async (accessToken) => {
      const { data } =
        await axios.get(
          `${BASE_URL}/pedidos/${orderId}`,
          {
            params: {
              access_token: accessToken,
            },

            timeout: 10000,
          },
        );

      return data;
    },
  );
}

// =====================================================
// OBTENER IDS POR ID EXTERNO
// =====================================================

async function getOrderIdsByExternalId(
  idExterno,
) {
  if (!idExterno) {
    throw new Error(
      "[Enviopack] Falta idExterno.",
    );
  }

  return withAuthRequest(
    async (accessToken) => {
      const { data } =
        await axios.post(
          `${BASE_URL}/pedidos/obtener-ids`,
          {
            id_externo: String(
              idExterno,
            ),
            plataforma: "web",
          },
          {
            params: {
              access_token: accessToken,
            },

            headers: {
              "Content-Type":
                "application/json",
            },

            timeout: 10000,
          },
        );

      return data;
    },
  );
}

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  getAccessToken,

  quoteHomeDelivery,

  quoteCarrier,

  quoteHomeDeliveryComplete,

  createOrder,

  createShipment,

  getShipment,

  getOrder,

  getOrderIdsByExternalId,
};
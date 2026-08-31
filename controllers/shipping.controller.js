const axios = require("axios");

const PostalCode = require("../models/postalCode");

const enviopackService = require("../services/envioPack");

const {
  getProvinceIsoCode,
} = require("../services/provinciasAr");

// =====================================================
// CONFIGURACIÓN
// =====================================================

const SHIPPING_ORIGIN = {
  lat: Number(
    process.env.SHIPPING_ORIGIN_LAT ||
      -34.6647,
  ),

  lon: Number(
    process.env.SHIPPING_ORIGIN_LON ||
      -58.7101,
  ),
};

const DIRECT_SHIPPING_MAX_KM =
  Number(
    process.env.DIRECT_SHIPPING_MAX_KM ||
      4,
  );

const DEFAULT_WEIGHT_KG =
  Number(
    process.env.SHIPPING_DEFAULT_WEIGHT_KG ||
      1,
  );

const DEFAULT_PACKAGE_CM =
  process.env.SHIPPING_DEFAULT_PACKAGE_CM ||
  "20x20x20";

const GEOREF_DIRECCIONES_URL =
  "https://apis.datos.gob.ar/georef/api/direcciones";

// =====================================================
// HELPERS
// =====================================================

function normalize(value) {
  return (value || "")
    .toString()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .toLowerCase()
    .trim();
}

function escapeRegex(value) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}

function haversine(
  lat1,
  lon1,
  lat2,
  lon2,
) {
  const toRad = (v) =>
    (v * Math.PI) / 180;

  const R = 6371;

  const dLat = toRad(
    lat2 - lat1,
  );

  const dLon = toRad(
    lon2 - lon1,
  );

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return (
    R *
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a),
    )
  );
}

function sameAddressNumber(
  resultNumber,
  requestedNumber,
) {
  if (
    !resultNumber ||
    !requestedNumber
  ) {
    return false;
  }

  return (
    String(resultNumber).replace(
      /\D/g,
      "",
    ) ===
    String(requestedNumber).replace(
      /\D/g,
      "",
    )
  );
}

function sameCity(
  resultCity,
  requestedCity,
) {
  if (
    !resultCity ||
    !requestedCity
  ) {
    return false;
  }

  const a = normalize(resultCity);

  const b = normalize(
    requestedCity,
  );

  return (
    a === b ||
    a.includes(b) ||
    b.includes(a)
  );
}

// =====================================================
// DIRECCIÓN
// =====================================================
//
// Si frontend manda:
//
// "PUENTE MARQUEZ 978"
// número: "978"
//
// Enviopack debe recibir:
//
// calle: "PUENTE MARQUEZ"
// numero: "978"
//
// =====================================================

function cleanStreetName(
  street,
  number,
) {
  let result = String(
    street || "",
  ).trim();

  const cleanNumber = String(
    number || "",
  )
    .replace(/\D/g, "")
    .trim();

  if (!result || !cleanNumber) {
    return result;
  }

  // Si termina exactamente en el número
  // lo removemos.
  const regex = new RegExp(
    `\\s+${escapeRegex(
      cleanNumber,
    )}\\s*$`,
  );

  result = result.replace(
    regex,
    "",
  );

  return result.trim();
}

// =====================================================
// POSTAL CODE
// =====================================================

async function findPostalRecord({
  postalCode,
  city,
}) {
  if (postalCode) {
    const byPostalCode =
      await PostalCode.findOne({
        postalCode,
      });

    if (byPostalCode) {
      return byPostalCode;
    }
  }

  if (city) {
    return PostalCode.findOne({
      city: {
        $regex: `^${escapeRegex(
          city,
        )}$`,
        $options: "i",
      },
    });
  }

  return null;
}

// =====================================================
// GEOREF
// =====================================================

async function queryGeoref({
  direccion,
  city,
  province,
}) {
  const baseParams = {
    direccion,

    provincia:
      province ||
      "Buenos Aires",

    max: 10,

    campos: "completo",
  };

  try {
    if (city) {
      const byDepartamento =
        await axios.get(
          GEOREF_DIRECCIONES_URL,
          {
            params: {
              ...baseParams,
              departamento: city,
            },

            timeout: 6000,
          },
        );

      const resultsByDepartamento =
        byDepartamento.data
          ?.direcciones || [];

      if (
        resultsByDepartamento.length
      ) {
        return resultsByDepartamento;
      }

      const byLocalidad =
        await axios.get(
          GEOREF_DIRECCIONES_URL,
          {
            params: {
              ...baseParams,
              localidad_censal:
                city,
            },

            timeout: 6000,
          },
        );

      return (
        byLocalidad.data
          ?.direcciones || []
      );
    }

    const response =
      await axios.get(
        GEOREF_DIRECCIONES_URL,
        {
          params: baseParams,
          timeout: 6000,
        },
      );

    return (
      response.data?.direcciones ||
      []
    );
  } catch (error) {
    console.error(
      "[Georef] request falló:",
      error.response?.status,
      error.response?.data ||
        error.message,
    );

    return [];
  }
}

async function searchGeoref({
  address,
  addressNumber,
  city,
  province,
}) {
  console.log(
    "[Georef] buscando con altura:",
    {
      address,
      addressNumber,
      city,
      province,
    },
  );

  const withNumber =
    await queryGeoref({
      direccion: `${address} ${addressNumber}`,
      city,
      province,
    });

  console.log(
    `[Georef] con altura -> ${withNumber.length} resultados`,
  );

  if (withNumber.length) {
    return withNumber.map(
      (item) => ({
        ...item,
        __approximate: false,
      }),
    );
  }

  console.log(
    "[Georef] reintentando solo por nombre de calle:",
    {
      address,
      city,
      province,
    },
  );

  const streetOnly =
    await queryGeoref({
      direccion: address,
      city,
      province,
    });

  console.log(
    `[Georef] solo calle -> ${streetOnly.length} resultados`,
  );

  return streetOnly.map(
    (item) => ({
      ...item,
      __approximate: true,
    }),
  );
}

function normalizeGeorefResult(
  item,
  index,
  fallbackPostalCode,
) {
  const lat = Number(
    item.ubicacion?.lat,
  );

  const lon = Number(
    item.ubicacion?.lon,
  );

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    return null;
  }

  return {
    id: `georef-${
      item.calle?.id || "sc"
    }-${
      item.altura?.valor || "0"
    }-${index}`,

    address:
      item.calle?.nombre || "",

    addressNumber:
      item.altura?.valor
        ? String(
            item.altura.valor,
          )
        : "",

    fullAddress:
      item.nomenclatura || "",

    city:
      item.localidad_censal
        ?.nombre ||
      item.departamento?.nombre ||
      "",

    province:
      item.provincia?.nombre ||
      "",

    postalCode:
      fallbackPostalCode || "",

    lat,

    lon,

    approximate:
      Boolean(
        item.__approximate,
      ),
  };
}

async function geocodeAddress({
  address,
  addressNumber,
  city,
  postalCode,
  province,
}) {
  const raw =
    await searchGeoref({
      address,
      addressNumber,
      city,
      province,
    });

  const normalized =
    raw
      .map(
        (
          item,
          index,
        ) =>
          normalizeGeorefResult(
            item,
            index,
            postalCode,
          ),
      )
      .filter(Boolean);

  if (!normalized.length) {
    return [];
  }

  const seen = new Set();

  const deduped =
    normalized.filter(
      (result) => {
        const key = `${normalize(
          result.address,
        )}|${
          result.addressNumber
        }|${result.lat.toFixed(
          6,
        )}|${result.lon.toFixed(
          6,
        )}`;

        if (seen.has(key)) {
          return false;
        }

        seen.add(key);

        return true;
      },
    );

  const byCity =
    deduped.filter(
      (result) =>
        sameCity(
          result.city,
          city,
        ),
    );

  const filtered =
    byCity.length
      ? byCity
      : deduped;

  const exactMatches =
    filtered.filter(
      (result) =>
        sameAddressNumber(
          result.addressNumber,
          addressNumber,
        ),
    );

  if (exactMatches.length) {
    return exactMatches;
  }

  return filtered
    .slice(0, 5)
    .map((result) => ({
      ...result,

      addressNumber,

      approximate: true,
    }));
}

// =====================================================
// PAQUETE PARA COTIZAR
// =====================================================

function parsePackageDimensions(
  packageString,
) {
  const [
    alto,
    ancho,
    largo,
  ] = String(
    packageString ||
      DEFAULT_PACKAGE_CM,
  )
    .split("x")
    .map((value) =>
      Number(value),
    );

  return {
    alto:
      Number.isFinite(alto) &&
      alto > 0
        ? Math.round(alto)
        : 20,

    ancho:
      Number.isFinite(ancho) &&
      ancho > 0
        ? Math.round(ancho)
        : 20,

    largo:
      Number.isFinite(largo) &&
      largo > 0
        ? Math.round(largo)
        : 20,
  };
}

// =====================================================
// PAQUETE PARA ENVIOPACK
// =====================================================
//
// IMPORTANTE:
//
// /cotizar usa:
//
// "20x20x20"
//
// /envios usa:
//
// [
//   {
//     alto: 20,
//     ancho: 20,
//     largo: 20,
//     peso: 1
//   }
// ]
//
// =====================================================

function buildShipmentPackagesFromItems(
  items = [],
) {
  if (
    !Array.isArray(items) ||
    !items.length
  ) {
    const dimensions =
      parsePackageDimensions(
        DEFAULT_PACKAGE_CM,
      );

    return [
      {
        ...dimensions,

        peso:
          Number(
            DEFAULT_WEIGHT_KG,
          ) || 1,

        descripcion_primera_linea:
          "Pedido Aeryx",

        descripcion_segunda_linea:
          "",
      },
    ];
  }

  let totalWeightKg = 0;

  let totalVolumeM3 = 0;

  let productNames = [];

  for (const item of items) {
    const quantity =
      Number(
        item.quantity,
      ) || 1;

    const weight =
      Number(
        item.weightKg,
      ) ||
      Number(
        item.weight,
      ) ||
      DEFAULT_WEIGHT_KG;

    totalWeightKg +=
      weight * quantity;

    const volume =
      Number(
        item.volumeM3,
      ) || 0;

    totalVolumeM3 +=
      volume * quantity;

    if (item.name) {
      productNames.push(
        `${quantity}x ${item.name}`,
      );
    }
  }

  // ===================================================
  // SI NO TENEMOS VOLUMEN
  // ===================================================

  if (
    !totalVolumeM3 ||
    totalVolumeM3 <= 0
  ) {
    const dimensions =
      parsePackageDimensions(
        DEFAULT_PACKAGE_CM,
      );

    return [
      {
        ...dimensions,

        peso: Number(
          totalWeightKg ||
            DEFAULT_WEIGHT_KG,
        ).toFixed(2),

        descripcion_primera_linea:
          productNames
            .join(" | ")
            .slice(0, 50),

        descripcion_segunda_linea:
          "",
      },
    ];
  }

  // ===================================================
  // ESTIMAMOS UN ÚNICO PAQUETE CÚBICO
  // ===================================================

  const totalVolumeCm3 =
    totalVolumeM3 * 1_000_000;

  const side =
    Math.max(
      1,
      Math.round(
        Math.cbrt(
          totalVolumeCm3,
        ),
      ),
    );

  return [
    {
      alto: side,

      ancho: side,

      largo: side,

      peso: Number(
        totalWeightKg ||
          DEFAULT_WEIGHT_KG,
      ).toFixed(2),

      descripcion_primera_linea:
        productNames
          .join(" | ")
          .slice(0, 50),

      descripcion_segunda_linea:
        "",
    },
  ];
}

// =====================================================
// PAQUETE PARA COTIZAR
// =====================================================

function buildPackageFromItems(
  items = [],
) {
  const packages =
    buildShipmentPackagesFromItems(
      items,
    );

  return {
    pesoKg: packages.reduce(
      (total, item) =>
        total +
        Number(item.peso || 0),
      0,
    ),

    paquetes: packages
      .map(
        (item) =>
          `${item.alto}x${item.ancho}x${item.largo}`,
      )
      .join(","),
  };
}

// =====================================================
// COTIZACIÓN ENVIOPACK
// =====================================================

async function quoteWithEnviopack({
  province,
  postalCode,
  items,
}) {
  const provinciaId =
    getProvinceIsoCode(
      province,
    );

  if (!provinciaId) {
    return {
      error: `No reconocemos la provincia "${province}" para cotizar con Enviopack.`,
    };
  }

  const {
    pesoKg,
    paquetes,
  } =
    buildPackageFromItems(
      items,
    );

  console.log(
    "[Enviopack] DATOS COTIZACIÓN:",
    {
      provinciaId,
      postalCode,
      pesoKg,
      paquetes,
    },
  );

  const cotizaciones =
    await enviopackService.quoteHomeDelivery(
      {
        provinciaId,

        codigoPostal:
          postalCode,

        pesoKg,

        paquetes,
      },
    );

  if (
    !Array.isArray(
      cotizaciones,
    ) ||
    !cotizaciones.length
  ) {
    return {
      error:
        "Enviopack no devolvió cotizaciones para ese destino.",
    };
  }

  const cheapest =
    cotizaciones[0];

  console.log(
    "====================================",
  );

  console.log(
    "[Enviopack] TODAS LAS COTIZACIONES:",
  );

  console.log(
    JSON.stringify(
      cotizaciones,
      null,
      2,
    ),
  );

  console.log(
    "====================================",
  );

  console.log(
    "[Enviopack] COTIZACIÓN SELECCIONADA:",
    JSON.stringify(
      cheapest,
      null,
      2,
    ),
  );

  return {
    shipping: {
      id: `enviopack-${
        cheapest.correo || "correo"
      }-${
        cheapest.servicio ||
        "standard"
      }-${cheapest.id || 0}`,

      title:
        cheapest.nombre ||
        cheapest.descripcion ||
        `Envío ${
          cheapest.correo || ""
        }`.trim() ||
        "Envío a domicilio",

      description:
        "Envío a domicilio gestionado a través de Enviopack.",

      price: Number(
        cheapest.valor,
      ),

      service:
        cheapest.servicio ||
        cheapest.service ||
        null,

      carrier:
        cheapest.correo ||
        cheapest.carrier ||
        null,

      carrierName:
        cheapest.nombre_correo ||
        cheapest.carrier_name ||
        cheapest.correo_nombre ||
        null,

      estimatedDelivery:
        cheapest.horas_entrega
          ? `${cheapest.horas_entrega} horas`
          : "A coordinar",
    },

    allQuotes:
      cotizaciones,
  };
}

// =====================================================
// AUTOCOMPLETE
// =====================================================

exports.autocompleteAddress =
  async (
    req,
    res,
  ) => {
    try {
      const address = (
        req.query.address || ""
      )
        .toString()
        .trim();

      const addressNumber = (
        req.query.address_number ||
        ""
      )
        .toString()
        .trim();

      const city = (
        req.query.city || ""
      )
        .toString()
        .trim();

      const postalCode = (
        req.query.postal_code ||
        ""
      )
        .toString()
        .trim();

      const province = (
        req.query.province || ""
      )
        .toString()
        .trim();

      if (
        !address ||
        !addressNumber ||
        !city
      ) {
        return res.json({
          success: true,

          results: [],
        });
      }

      const results =
        await geocodeAddress({
          address,

          addressNumber,

          city,

          postalCode,

          province,
        });

      return res.json({
        success: true,

        results,
      });
    } catch (error) {
      console.error(
        "Error buscando dirección:",
        error.response?.data ||
          error.message,
      );

      return res.status(500).json({
        success: false,

        error:
          "No se pudieron buscar las direcciones.",
      });
    }
  };

// =====================================================
// EVALUATE SHIPPING
// =====================================================

exports.evaluateShipping =
  async (
    req,
    res,
  ) => {
    try {
      const body =
        req.body || {};

      const query =
        req.query || {};

      const address = (
        body.address ||
        query.address ||
        ""
      )
        .toString()
        .trim();

      const addressNumber = (
        body.addressNumber ||
        body.address_number ||
        query.address_number ||
        ""
      )
        .toString()
        .trim();

      const city = (
        body.city ||
        query.city ||
        ""
      )
        .toString()
        .trim();

      const postalCode = (
        body.postalCode ||
        body.postal_code ||
        query.postal_code ||
        ""
      )
        .toString()
        .trim();

      const province = (
        body.province ||
        query.province ||
        ""
      )
        .toString()
        .trim();

      const items =
        Array.isArray(
          body.items,
        )
          ? body.items
          : [];

      const latitude =
        body.latitude !==
        undefined
          ? Number(
              body.latitude,
            )
          : null;

      const longitude =
        body.longitude !==
        undefined
          ? Number(
              body.longitude,
            )
          : null;

      const clientMarkedApproximate =
        body.approximate === true;

      if (
        !address ||
        !addressNumber
      ) {
        return res.status(400).json({
          success: false,

          error:
            "Se requiere calle y número.",
        });
      }

      if (
        !city ||
        !postalCode
      ) {
        return res.status(400).json({
          success: false,

          error:
            "Se requiere localidad y código postal.",
        });
      }

      const record =
        await findPostalRecord({
          postalCode,

          city,
        });

      const usedProvince =
        record?.province ||
        province ||
        "Buenos Aires";

      // =================================================
      // COORDENADAS
      // =================================================

      let destinationCoords =
        null;

      let geocodingMethod =
        null;

      let approximate =
        clientMarkedApproximate;

      if (
        Number.isFinite(
          latitude,
        ) &&
        Number.isFinite(
          longitude,
        )
      ) {
        destinationCoords = {
          lat: latitude,

          lon: longitude,

          displayName: [
            address,

            addressNumber,

            city,

            postalCode,
          ]
            .filter(Boolean)
            .join(", "),
        };

        geocodingMethod =
          "selected_address";
      } else {
        const results =
          await geocodeAddress({
            address,

            addressNumber,

            city,

            postalCode,

            province:
              usedProvince,
          });

        const selected =
          results[0];

        if (selected) {
          destinationCoords = {
            lat: selected.lat,

            lon: selected.lon,

            displayName:
              selected.fullAddress,
          };

          geocodingMethod =
            selected.approximate
              ? "address_approximate"
              : "address";

          approximate =
            Boolean(
              selected.approximate,
            );
        }
      }

      if (
        !destinationCoords
      ) {
        return res.status(422).json({
          success: false,

          error:
            "No pudimos localizar esa dirección en Georef.",

          message:
            "Revisá la calle, número, localidad y código postal.",
        });
      }

      // =================================================
      // DISTANCIA
      // =================================================

      const distanceKm =
        haversine(
          SHIPPING_ORIGIN.lat,

          SHIPPING_ORIGIN.lon,

          destinationCoords.lat,

          destinationCoords.lon,
        );

      const isDirectShipping =
        distanceKm <=
        DIRECT_SHIPPING_MAX_KM;

      let shipping;

      let enviopackQuotes =
        null;

      // =================================================
      // ENVÍO DIRECTO
      // =================================================

      if (
        isDirectShipping
      ) {
        shipping = {
          id: "directo",

          title:
            "Envío Aeryx",

          description:
            "Entrega directa desde nuestro centro de despacho.",

          price: 5000,

          estimatedDelivery:
            "24-48 horas",
        };
      }

      // =================================================
      // ENVIOPACK
      // =================================================

      else {
        const result =
          await quoteWithEnviopack({
            province:
              usedProvince,

            postalCode,

            items,
          });

        if (result.error) {
          console.error(
            "Error cotizando con Enviopack:",
            result.error,
          );

          return res.status(502).json({
            success: false,

            error:
              "No pudimos cotizar el envío en este momento.",

            details:
              result.error,
          });
        }

        shipping =
          result.shipping;

        enviopackQuotes =
          result.allQuotes;
      }

      return res.json({
        success: true,

        decision:
          isDirectShipping
            ? "near"
            : "enviopack",

        message:
          isDirectShipping
            ? "Tu dirección está dentro de nuestra zona de envío directo."
            : "Tu dirección está fuera de nuestra zona de envío directo.",

        approximate,

        distanceKm:
          Number(
            distanceKm.toFixed(
              2,
            ),
          ),

        geocodingMethod,

        destination: {
          ...destinationCoords,
        },

        address: {
          street: address,

          number:
            addressNumber,

          city,

          postalCode,

          province:
            usedProvince,
        },

        shipping,

        enviopackQuotes,
      });
    } catch (error) {
      console.error(
        "Error evaluando envío:",
        error,
      );

      return res.status(500).json({
        success: false,

        error:
          "Error interno al calcular el envío.",

        details:
          process.env.NODE_ENV ===
          "development"
            ? error.message
            : undefined,
      });
    }
  };

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  autocompleteAddress:
    exports.autocompleteAddress,

  evaluateShipping:
    exports.evaluateShipping,

  buildPackageFromItems,

  buildShipmentPackagesFromItems,

  quoteWithEnviopack,

  cleanStreetName,
};
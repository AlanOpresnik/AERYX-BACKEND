const axios = require("axios");
const PostalCode = require("../models/postalCode");

// =====================================================
// CONFIGURACIÓN
// =====================================================

const SHIPPING_ORIGIN = {
  lat: Number(
    process.env.SHIPPING_ORIGIN_LAT || -34.6647,
  ),
  lon: Number(
    process.env.SHIPPING_ORIGIN_LON || -58.7101,
  ),
};

const DIRECT_SHIPPING_MAX_KM = 30;

const GEOREF_DIRECCIONES_URL =
  "https://apis.datos.gob.ar/georef/api/direcciones";

// =====================================================
// HAVERSINE
// =====================================================

function haversine(lat1, lon1, lat2, lon2) {
  const toRad = (value) =>
    (value * Math.PI) / 180;

  const R = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a),
    );

  return R * c;
}

function sameAddressNumber(
  resultNumber,
  requestedNumber,
) {
  if (!resultNumber || !requestedNumber) {
    return false;
  }

  const result = String(resultNumber)
    .replace(/\D/g, "");

  const requested = String(requestedNumber)
    .replace(/\D/g, "");

  return result === requested;
}

// =====================================================
// ESCAPAR REGEX
// =====================================================

function escapeRegex(value) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}

// =====================================================
// NORMALIZAR TEXTO
// =====================================================

function normalize(value) {
  return (value || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

// =====================================================
// BUSCAR POSTAL EN DB
// =====================================================

async function findPostalRecord({
  postalCode,
  city,
}) {
  let record = null;

  if (postalCode) {
    record = await PostalCode.findOne({
      postalCode,
    });
  }

  if (!record && city) {
    record = await PostalCode.findOne({
      city: {
        $regex: `^${escapeRegex(city)}$`,
        $options: "i",
      },
    });
  }

  return record;
}

// =====================================================
// VALIDAR LOCALIDAD
// =====================================================

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

  const a =
    normalize(resultCity);

  const b =
    normalize(requestedCity);

  return (
    a === b ||
    a.includes(b) ||
    b.includes(a)
  );
}

// =====================================================
// GEOREF (datos.gob.ar)
// =====================================================
//
// Única fuente de geocodificación. Usa la nomenclatura
// oficial (INDEC / Correo Argentino) para direcciones
// de Argentina, incluyendo interpolación de alturas.
//
// Importante: NO mandamos "departamento" y
// "localidad_censal" en la misma consulta con el mismo
// valor. Georef matchea por cualquiera de los dos campos
// que coincida, y si ambos coinciden (como pasa en Merlo,
// donde el partido y la localidad se llaman igual) te
// devuelve la MISMA dirección duplicada, una vez por cada
// campo que matcheó — eso era lo que estaba generando la
// key duplicada en el front. Por eso probamos primero por
// "departamento" y solo si no hay resultados probamos por
// "localidad_censal".
//
// =====================================================

async function searchGeoref({
  address,
  addressNumber,
  city,
  province,
}) {
  const baseParams = {
    direccion: `${address} ${addressNumber}`,
    provincia: province || "Buenos Aires",
    max: 10,
    campos: "completo",
  };

  try {
    if (city) {
      const byDepartamento = await axios.get(
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
        byDepartamento.data?.direcciones || [];

      if (resultsByDepartamento.length) {
        console.log(
          "GEOREF RESULTS (por departamento):",
          resultsByDepartamento.map((r) => ({
            nomenclatura: r.nomenclatura,
            altura: r.altura,
            lat: r.ubicacion?.lat,
            lon: r.ubicacion?.lon,
          })),
        );

        return resultsByDepartamento;
      }

      const byLocalidad = await axios.get(
        GEOREF_DIRECCIONES_URL,
        {
          params: {
            ...baseParams,
            localidad_censal: city,
          },
          timeout: 6000,
        },
      );

      const resultsByLocalidad =
        byLocalidad.data?.direcciones || [];

      console.log(
        "GEOREF RESULTS (por localidad_censal):",
        resultsByLocalidad.map((r) => ({
          nomenclatura: r.nomenclatura,
          altura: r.altura,
          lat: r.ubicacion?.lat,
          lon: r.ubicacion?.lon,
        })),
      );

      return resultsByLocalidad;
    }

    const response = await axios.get(
      GEOREF_DIRECCIONES_URL,
      {
        params: baseParams,
        timeout: 6000,
      },
    );

    return response.data?.direcciones || [];
  } catch (error) {
    console.error(
      "Error consultando Georef direcciones:",
      error.message,
    );

    return [];
  }
}

function normalizeGeorefResult(
  item,
  index,
  fallbackPostalCode,
) {
  const lat = Number(item.ubicacion?.lat);
  const lon = Number(item.ubicacion?.lon);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon)
  ) {
    return null;
  }

  return {
    // El índice va siempre en el id para garantizar que
    // sea único, incluso si Georef llegara a devolver dos
    // entradas con la misma calle+altura (por ejemplo con
    // distinto piso/depto).
    id: `georef-${item.calle?.id || "sc"}-${
      item.altura?.valor || "0"
    }-${index}`,

    placeId: null,

    address: item.calle?.nombre || "",

    addressNumber: item.altura?.valor
      ? String(item.altura.valor)
      : "",

    fullAddress: item.nomenclatura || "",

    city:
      item.localidad_censal?.nombre ||
      item.departamento?.nombre ||
      "",

    province: item.provincia?.nombre || "",

    postalCode: fallbackPostalCode || "",

    lat,
    lon,

    importance: 1,

    type: "georef_direccion",

    source: "georef",

    approximate: false,
  };
}

// =====================================================
// BUSCAR DIRECCIÓN
// =====================================================

async function geocodeAddress({
  address,
  addressNumber,
  city,
  postalCode,
  province,
}) {
  const raw = await searchGeoref({
    address,
    addressNumber,
    city,
    province,
  });

  const normalized = raw
    .map((item, index) =>
      normalizeGeorefResult(item, index, postalCode),
    )
    .filter(Boolean);

  if (!normalized.length) {
    return [];
  }

  // =====================================================
  // DEDUPE
  // =====================================================
  //
  // Por las dudas: si dos entradas apuntan exactamente a
  // la misma calle + altura + coordenadas, nos quedamos
  // con una sola.
  //
  // =====================================================

  const seen = new Set();

  const deduped = normalized.filter((result) => {
    const key = `${normalize(result.address)}|${
      result.addressNumber
    }|${result.lat.toFixed(6)}|${result.lon.toFixed(6)}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });

  // =====================================================
  // LOCALIDAD
  // =====================================================

  const byCity = deduped.filter((result) =>
    sameCity(result.city, city),
  );

  // Si Georef ya filtró por departamento/localidad al
  // consultar, esto casi siempre va a matchear. Si por
  // algún motivo el nombre de localidad que devuelve
  // Georef no coincide textualmente con lo que escribió
  // el usuario, no descartamos los resultados: seguimos
  // con lo que vino.
  const filtered = byCity.length
    ? byCity
    : deduped;

  // =====================================================
  // ALTURA EXACTA
  // =====================================================

  const exactMatches = filtered.filter((result) =>
    sameAddressNumber(
      result.addressNumber,
      addressNumber,
    ),
  );

  if (exactMatches.length) {
    return exactMatches;
  }

  // =====================================================
  // SIN ALTURA EXACTA: APROXIMADO
  // =====================================================

  return filtered.slice(0, 5).map((result) => ({
    ...result,
    addressNumber,
    approximate: true,
    source: "georef_street_level",
  }));
}

// =====================================================
// AUTOCOMPLETE / BUSCADOR
// =====================================================

exports.autocompleteAddress = async (
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
      req.query.province ||
      ""
    )
      .toString()
      .trim();

    // Necesitamos al menos calle,
    // número y localidad.
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
// EVALUAR SHIPPING
// =====================================================

exports.evaluateShipping = async (
  req,
  res,
) => {
  try {
    // =================================================
    // DATOS
    // =================================================

    const address = (
      req.body?.address ||
      req.query.address ||
      ""
    )
      .toString()
      .trim();

    const addressNumber = (
      req.body?.addressNumber ||
      req.body?.address_number ||
      req.query.addressNumber ||
      req.query.address_number ||
      ""
    )
      .toString()
      .trim();

    const betweenStreet1 = (
      req.body?.betweenStreet1 ||
      req.body?.between_street_1 ||
      req.query.betweenStreet1 ||
      req.query.between_street_1 ||
      ""
    )
      .toString()
      .trim();

    const betweenStreet2 = (
      req.body?.betweenStreet2 ||
      req.body?.between_street_2 ||
      req.query.betweenStreet2 ||
      req.query.between_street_2 ||
      ""
    )
      .toString()
      .trim();

    const city = (
      req.body?.city ||
      req.query.city ||
      ""
    )
      .toString()
      .trim();

    const postalCode = (
      req.body?.postalCode ||
      req.body?.postal_code ||
      req.query.postalCode ||
      req.query.postal_code ||
      ""
    )
      .toString()
      .trim();

    const province = (
      req.body?.province ||
      req.query.province ||
      ""
    )
      .toString()
      .trim();

    // =================================================
    // COORDENADAS DEL FRONT
    // =================================================

    const latitudeRaw =
      req.body?.latitude ??
      req.query.latitude;

    const longitudeRaw =
      req.body?.longitude ??
      req.query.longitude;

    const latitude =
      latitudeRaw !== undefined
        ? Number(latitudeRaw)
        : null;

    const longitude =
      longitudeRaw !== undefined
        ? Number(longitudeRaw)
        : null;

    const placeId = (
      req.body?.placeId ||
      req.body?.place_id ||
      req.query.placeId ||
      req.query.place_id ||
      ""
    )
      .toString()
      .trim();

    const clientMarkedApproximate =
      req.body?.approximate === true ||
      req.query.approximate === "true";

    // =================================================
    // VALIDACIONES
    // =================================================

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

    // =================================================
    // POSTAL
    // =================================================

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

    // -------------------------------------------------
    // PRIMERA PRIORIDAD:
    // COORDENADAS SELECCIONADAS POR EL USUARIO
    // -------------------------------------------------

    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
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
    }

    // -------------------------------------------------
    // SEGUNDA PRIORIDAD:
    // BUSCAR DIRECCIÓN (GEOREF)
    // -------------------------------------------------

    if (
      !destinationCoords
    ) {
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
          Boolean(selected.approximate);
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

        record: record
          ? {
              postalCode:
                record.postalCode,

              city:
                record.city,

              province:
                record.province,

              zone:
                record.zone,
            }
          : null,
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

    const roundedDistance =
      Number(
        distanceKm.toFixed(2),
      );

    // =================================================
    // DECISIÓN
    // =================================================

    const isDirectShipping =
      distanceKm <=
      DIRECT_SHIPPING_MAX_KM;

    const decision =
      isDirectShipping
        ? "near"
        : "oca";

    // =================================================
    // SHIPPING
    // =================================================

    const shipping =
      isDirectShipping
        ? {
            id: "directo",

            title:
              "Envío Aeryx",

            description:
              "Entrega directa desde nuestro centro de despacho.",

            price: 5000,

            estimatedDelivery:
              "24-48 horas",
          }
        : {
            id: "oca",

            title:
              "Envío por OCA",

            description:
              "El envío será gestionado mediante OCA.",

            price: null,

            estimatedDelivery:
              "Según localidad",
          };

    // =================================================
    // RESPONSE
    // =================================================

    return res.json({
      success: true,

      decision,

      message:
        isDirectShipping
          ? "Tu dirección está dentro de nuestra zona de envío directo."
          : "Tu dirección está fuera de nuestra zona de envío directo.",

      approximate,

      distanceKm:
        roundedDistance,

      geocodingMethod,

      origin: {
        lat:
          SHIPPING_ORIGIN.lat,

        lon:
          SHIPPING_ORIGIN.lon,
      },

      destination: {
        lat:
          destinationCoords.lat,

        lon:
          destinationCoords.lon,

        displayName:
          destinationCoords.displayName ||
          null,
      },

      address: {
        street:
          address,

        number:
          addressNumber,

        betweenStreet1:
          betweenStreet1 ||
          null,

        betweenStreet2:
          betweenStreet2 ||
          null,

        city,

        postalCode,

        province:
          usedProvince,

        placeId:
          placeId ||
          null,
      },

      shipping,

      record: record
        ? {
            postalCode:
              record.postalCode,

            city:
              record.city,

            province:
              record.province,

            zone:
              record.zone,
          }
        : null,
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
// =====================================================
// controllers/mercado_pago.controller.js
// =====================================================

const crypto = require("crypto");

const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");

const productModel = require("../models/product.model");

const Order = require("../models/order");

const enviopackService = require("../services/envioPack");

const { getProvinceIsoCode } = require("../services/provinciasAr");

// =====================================================
// MERCADO PAGO
// =====================================================

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

// =====================================================
// ESTADOS MP
// =====================================================

const MP_STATUS_MAP = {
  approved: "approved",

  pending: "pending",

  in_process: "pending",

  authorized: "pending",

  rejected: "rejected",

  cancelled: "cancelled",

  refunded: "refunded",
};

// =====================================================
// HELPERS
// =====================================================

function isEnviopackMethod(method) {
  const value = method || "";

  return value === "enviopack" || value.startsWith("enviopack-");
}

function extractService(shipping) {
  const option = shipping?.option || {};

  const quote = option.quote || {};

  const enviopack = option.enviopack || {};

  const candidates = [
    option.service,

    option.servicio,

    enviopack.service,

    enviopack.servicio,

    quote.service,

    quote.servicio,

    quote.servicio_id,

    quote.codigo_servicio,

    quote.codigoServicio,

    shipping.service,

    shipping.servicio,
  ];

  for (const value of candidates) {
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }

  const method = shipping?.method || "";

  const match = method.match(/enviopack-[^-]+-([NPXR])(?:-|$)/i);

  if (match?.[1]) {
    return match[1].toUpperCase();
  }

  return null;
}

function extractCarrier(shipping) {
  const option = shipping?.option || {};

  const quote = option.quote || {};

  const enviopack = option.enviopack || {};

  const candidates = [
    option.carrier,

    option.correo,

    enviopack.carrier,

    enviopack.correo,

    quote.carrier,

    quote.correo,

    quote.codigo_correo,

    quote.id_correo,

    shipping.carrier,

    shipping.correo,
  ];

  for (const value of candidates) {
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }

  return null;
}

function extractCarrierName(shipping) {
  const option = shipping?.option || {};

  const quote = option.quote || {};

  const enviopack = option.enviopack || {};

  const candidates = [
    option.carrierName,

    option.nombre_correo,

    enviopack.carrierName,

    enviopack.nombre_correo,

    quote.carrierName,

    quote.nombre_correo,

    quote.correo_nombre,

    shipping.carrierName,
  ];

  for (const value of candidates) {
    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }

  return null;
}

// =====================================================
// LIMPIAR CALLE
// =====================================================

function cleanStreetName(street, number) {
  let result = String(street || "").trim();

  const cleanNumber = String(number || "")
    .replace(/\D/g, "")
    .trim();

  if (!result || !cleanNumber) {
    return result;
  }

  const regex = new RegExp(`\\s+${cleanNumber}\\s*$`);

  result = result.replace(regex, "");

  return result.trim();
}

// =====================================================
// CREAR PEDIDO ENVIOPACK
// =====================================================

async function createEnviopackOrderForOrder(order) {
  if (!order) {
    throw new Error("[Enviopack] Order inválida.");
  }

  if (!isEnviopackMethod(order.shipping?.method)) {
    return null;
  }

  // Ya existe.
  if (order.shipping?.enviopack?.orderId) {
    console.log(
      "[Enviopack] Pedido ya creado:",
      order.shipping.enviopack.orderId,
    );

    return {
      id: order.shipping.enviopack.orderId,
    };
  }

  const address = order.shippingAddress || {};

  const customer = order.customer || {};

  const provinciaId = getProvinceIsoCode(address.province || "");

  if (!provinciaId) {
    throw new Error(
      `[Enviopack] No se pudo obtener ISO de provincia: ${address.province}`,
    );
  }

  const enviopackOrder = await enviopackService.createOrder({
    idExterno: order._id.toString(),
    nombre: customer.firstName || "",
    apellido: customer.lastName || "",
    email: customer.email || "",
    telefono: customer.phone || "",
    celular: customer.phone || "",
    monto: Number(order.totals?.total || 0),
    fechaAlta: new Date().toISOString(),
    pagado: order.payment?.status === "approved",
    provincia: provinciaId,
    localidad: address.city || "",
   // productos: buildEnviopackProducts(order), // 👈 agregado
  });

  console.log(
    "[Enviopack] PEDIDO CREADO:",
    JSON.stringify(enviopackOrder, null, 2),
  );

  const enviopackOrderId =
    enviopackOrder?.id ||
    enviopackOrder?.pedido ||
    enviopackOrder?.order_id ||
    enviopackOrder?.orderId ||
    null;

  if (!enviopackOrderId) {
    throw new Error("[Enviopack] No devolvió ID de pedido.");
  }

  order.shipping.enviopack.orderId = enviopackOrderId;

  await order.save();

  return enviopackOrder;
}

// =====================================================
// PRODUCTOS
// =====================================================

function buildEnviopackProducts(order) {
  const items = Array.isArray(order.items) ? order.items : [];

  return items.map((item) => {
    const hasSku = item.sku && String(item.sku).trim();

    return {
      tipo_identificador: hasSku ? "SKU" : "ID", // 👈 obligatorio

      // Si es SKU, Enviopack espera el campo `sku`.
      // Si es ID, espera `id_externo`.
      ...(hasSku
        ? { sku: String(item.sku).trim() }
        : { id_externo: item.productId ? item.productId.toString() : null }),

      nombre: item.name || "",
      cantidad: Number(item.quantity || 1),
      precio: Number(item.price || 0),
      subtotal: Number(item.subtotal || 0),
      peso: Number(item.weightKg || 0),
    };
  });
}

// =====================================================
// CREAR ENVÍO ENVIOPACK
// =====================================================
//
// IMPORTANTE:
//
// Este método SOLO crea el envío cuando:
//
// confirmado = true
//
// Es decir, después de que Mercado Pago
// confirma el pago.
//
// =====================================================

async function createEnviopackShipmentForOrder(order, confirmado = true) {
  if (!order) {
    throw new Error("[Enviopack] Order inválida.");
  }

  if (!isEnviopackMethod(order.shipping?.method)) {
    return null;
  }

  console.log("====================================");

  console.log("[Enviopack] CREANDO ENVÍO:", order._id.toString());

  const shipping = order.shipping || {};

  const address = order.shippingAddress || {};

  const customer = order.customer || {};

  // =================================================
  // SI YA EXISTE ENVÍO
  // =================================================

  if (order.shipping.enviopack?.shipmentId) {
    console.log(
      "[Enviopack] El envío ya existe:",
      order.shipping.enviopack.shipmentId,
    );

    return {
      id: order.shipping.enviopack.shipmentId,

      tracking_number: order.shipping.enviopack.trackingNumber,

      status: order.shipping.enviopack.status,
    };
  }

  // =================================================
  // PEDIDO ENVIOPACK
  // =================================================

  let enviopackOrderId = order.shipping.enviopack?.orderId;

  if (!enviopackOrderId) {
    const createdOrder = await createEnviopackOrderForOrder(order);

    enviopackOrderId =
      createdOrder?.id ||
      createdOrder?.pedido ||
      createdOrder?.order_id ||
      createdOrder?.orderId ||
      order.shipping.enviopack.orderId;
  }

  if (!enviopackOrderId) {
    throw new Error("[Enviopack] Falta ID del pedido.");
  }

  // =================================================
  // PROVINCIA
  // =================================================

  const provinciaId = getProvinceIsoCode(address.province || "");

  if (!provinciaId) {
    throw new Error(
      `[Enviopack] No se pudo obtener ISO de provincia: ${address.province}`,
    );
  }

  // =================================================
  // SERVICE
  // =================================================

  const service = extractService(shipping);

  console.log("[Enviopack] SERVICE:", service);

  if (!service) {
    throw new Error("[Enviopack] Falta service/servicio.");
  }

  // =================================================
  // CARRIER
  // =================================================

  let carrier = extractCarrier(shipping);

  const carrierName = extractCarrierName(shipping);

  console.log("[Enviopack] CARRIER:", carrier);

  console.log("[Enviopack] CARRIER NAME:", carrierName);

  // =================================================
  // SI NO TENEMOS CARRIER
  // =================================================

  if (!carrier) {
    const { buildPackageFromItems } = require("./shipping.controller");

    const packageData = buildPackageFromItems(order.items);

    const quotes = await enviopackService.quoteCarrier({
      provinciaId,

      codigoPostal: address.postalCode,

      pesoKg: packageData.pesoKg,

      paquetes: packageData.paquetes,

      servicio: service,
    });

    const carrierQuote = Array.isArray(quotes)
      ? quotes.find(
          (quote) =>
            quote?.modalidad === "D" &&
            quote?.servicio === service &&
            quote?.correo?.id,
        )
      : null;

    carrier = carrierQuote?.correo?.id || null;
  }

  console.log("[Enviopack] CARRIER FINAL:", carrier);

  if (!carrier) {
    throw new Error("[Enviopack] No se pudo determinar el carrier/correo.");
  }

  // =================================================
  // PAQUETES
  // =================================================

  const { buildShipmentPackagesFromItems } = require("./shipping.controller");

  const paquetes = buildShipmentPackagesFromItems(order.items);

  if (!Array.isArray(paquetes) || !paquetes.length) {
    throw new Error("[Enviopack] No se pudieron construir los paquetes.");
  }

  console.log("[Enviopack] PAQUETES:", JSON.stringify(paquetes, null, 2));

  // =================================================
  // CALLE
  // =================================================

  const calle = cleanStreetName(address.address, address.addressNumber);

  const numero = String(address.addressNumber || "").trim();

  if (!calle) {
    throw new Error("[Enviopack] Falta calle.");
  }

  if (!numero) {
    throw new Error("[Enviopack] Falta número.");
  }

  // =================================================
  // REFERENCIA
  // =================================================

  const referenciaDomicilio = [
    address.betweenStreet1 ? `Entre ${address.betweenStreet1}` : null,

    address.betweenStreet2 ? `y ${address.betweenStreet2}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  // =================================================
  // DESTINATARIO
  // =================================================

  const destinatario = `${customer.firstName || ""} ${
    customer.lastName || ""
  }`.trim();

  // =================================================
  // CREAR ENVÍO
  // =================================================

  const enviopackShipment = await enviopackService.createShipment({
    pedido: enviopackOrderId,

    direccionEnvio: process.env.ENVIOPACK_DIRECCION_ENVIO_ID,

    destinatario,

    observaciones: shipping.option?.description || "",

    modalidad: "D",

    servicio: service,

    correo: carrier,

    confirmado,

    paquetes,

    calle,

    numero,

    piso: address.floor || "",

    depto: address.apartment || "",

    referenciaDomicilio,

    codigoPostal: address.postalCode,

    provincia: provinciaId,

    localidad: address.city,
  });

  console.log(
    "[Enviopack] ENVÍO CREADO:",
    JSON.stringify(enviopackShipment, null, 2),
  );

  // =================================================
  // GUARDAR EN MONGO
  // =================================================

  const shipmentId =
    enviopackShipment?.id ||
    enviopackShipment?.envio_id ||
    enviopackShipment?.shipment_id ||
    enviopackShipment?.shipmentId ||
    null;

  const trackingNumber =
    enviopackShipment?.tracking_number ||
    enviopackShipment?.trackingNumber ||
    enviopackShipment?.tracking ||
    null;

  order.shipping.enviopack.orderId = enviopackOrderId;

  order.shipping.enviopack.shipmentId = shipmentId;

  order.shipping.enviopack.trackingNumber = trackingNumber;

  order.shipping.enviopack.carrier = carrierName || carrier;

  order.shipping.enviopack.service = service;

  order.shipping.enviopack.status =
    enviopackShipment?.estado ||
    enviopackShipment?.status ||
    (confirmado ? "created" : "draft");

  // Guardamos también la
  // información normalizada
  // en shipping.option

  if (!order.shipping.option) {
    order.shipping.option = {};
  }

  order.shipping.option.service = service;

  order.shipping.option.servicio = service;

  order.shipping.option.carrier = carrier;

  order.shipping.option.correo = carrier;

  order.shipping.option.carrierName = carrierName || carrier;

  await order.save();

  return enviopackShipment;
}

// =====================================================
// CREAR ORDER
// =====================================================

const createOrder = async (req, res) => {
  try {
    const { customer, shippingAddress, shipping, payment, items } = req.body;

    const userId = customer?.userId || null;

    // =================================================
    // VALIDACIONES
    // =================================================

    if (!customer) {
      return res.status(400).json({
        success: false,

        message: "Faltan los datos del cliente.",
      });
    }

    if (!customer.firstName || !customer.lastName) {
      return res.status(400).json({
        success: false,

        message: "Nombre y apellido son obligatorios.",
      });
    }

    if (!customer.email) {
      return res.status(400).json({
        success: false,

        message: "El email es obligatorio.",
      });
    }

    if (!shippingAddress) {
      return res.status(400).json({
        success: false,

        message: "Faltan los datos de envío.",
      });
    }

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({
        success: false,

        message: "El pedido debe tener al menos un producto.",
      });
    }

    if (!payment?.method) {
      return res.status(400).json({
        success: false,

        message: "Debe seleccionar un método de pago.",
      });
    }

    // =================================================
    // PRODUCTOS
    // =================================================

    const productIds = items.map((item) => item.productId);

    const products = await productModel.find({
      _id: {
        $in: productIds,
      },
    });

    if (products.length !== productIds.length) {
      return res.status(400).json({
        success: false,

        message: "Uno o más productos ya no existen.",
      });
    }

    // =================================================
    // SNAPSHOT
    // =================================================

    const orderItems = [];

    for (const item of items) {
      const product = products.find(
        (p) => p._id.toString() === item.productId.toString(),
      );

      if (!product) {
        return res.status(400).json({
          success: false,

          message: `Producto no encontrado: ${item.productId}`,
        });
      }

      const quantity = Number(item.quantity);

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({
          success: false,

          message: `Cantidad inválida para ${product.name}.`,
        });
      }

      const unitPrice = 1; //Number(product.price);

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return res.status(400).json({
          success: false,

          message: `El producto ${product.name} no tiene un precio válido.`,
        });
      }

      const subtotal = unitPrice * quantity;

      orderItems.push({
        productId: product._id,

        name: product.name,

        price: unitPrice,

        quantity,

        subtotal,

        image: product.images?.[0] || product.image || null,
      });
    }

    // =================================================
    // SUBTOTAL
    // =================================================

    const subtotal = orderItems.reduce(
      (total, item) => total + item.subtotal,

      0,
    );

    // =================================================
    // SHIPPING COST
    // =================================================

    const shippingCost = 1; //shipping?.manual ? 0 : Number(shipping?.cost || 0);

    if (!Number.isFinite(shippingCost) || shippingCost < 0) {
      return res.status(400).json({
        success: false,

        message: "Costo de envío inválido.",
      });
    }

    // =================================================
    // SHIPPING OPTION
    // =================================================

    const shippingOption = shipping?.option
      ? {
          id: shipping.option.id || null,

          title: shipping.option.title || null,

          description: shipping.option.description || null,

          price: Number(shipping.option.price || 0),

          service:
            shipping.option.service ||
            shipping.option.servicio ||
            shipping.option.quote?.servicio ||
            null,

          servicio:
            shipping.option.service ||
            shipping.option.servicio ||
            shipping.option.quote?.servicio ||
            null,

          carrier:
            shipping.option.carrier ||
            shipping.option.correo ||
            shipping.option.quote?.correo ||
            null,

          correo:
            shipping.option.carrier ||
            shipping.option.correo ||
            shipping.option.quote?.correo ||
            null,

          carrierName:
            shipping.option.carrierName ||
            shipping.option.nombre_correo ||
            shipping.option.quote?.nombre_correo ||
            null,

          quote: shipping.option.quote || null,

          enviopack: shipping.option.enviopack || null,
        }
      : null;

    // =================================================
    // TOTAL
    // =================================================

    const total = subtotal + shippingCost;

    // =================================================
    // ORDER MONGO
    // =================================================

    const order = await Order.create({
      customer: {
        userId,

        firstName: customer.firstName.trim(),

        lastName: customer.lastName.trim(),

        email: customer.email.trim().toLowerCase(),

        phone: customer.phone?.trim() || "",
      },

      shippingAddress: {
        address: shippingAddress.address?.trim() || "",

        addressNumber: shippingAddress.addressNumber?.trim() || "",

        betweenStreet1: shippingAddress.betweenStreet1?.trim() || "",

        betweenStreet2: shippingAddress.betweenStreet2?.trim() || "",

        city: shippingAddress.city?.trim() || "",

        postalCode: shippingAddress.postalCode?.trim() || "",

        province: shippingAddress.province?.trim() || "",

        latitude: shippingAddress.latitude ?? null,

        longitude: shippingAddress.longitude ?? null,

        placeId: shippingAddress.placeId ?? null,

        approximate: Boolean(shippingAddress.approximate),
      },

      items: orderItems,

      shipping: {
        method: shipping?.method || null,

        manual: Boolean(shipping?.manual),

        option: shippingOption,

        cost: shippingCost,

        enviopack: {
          orderId: null,

          shipmentId: null,

          trackingNumber: null,

          carrier: null,

          service: null,

          status: null,
        },
      },

      totals: {
        subtotal,

        shipping: shippingCost,

        total,
      },

      payment: {
        method: payment.method,

        status: "pending",

        preferenceId: null,

        paymentId: null,

        mpStatus: null,
      },

      status: "pending",
    });

    console.log("[ORDER] CREADA:", order._id.toString());

    // =================================================
    // ENVIOPACK
    // =================================================
    //
    // IMPORTANTE:
    //
    // Acá SOLO creamos /pedidos.
    //
    // NO creamos /envios todavía.
    //
    // La dirección + paquetes se crean
    // cuando Mercado Pago confirma.
    //
    // =================================================

    if (isEnviopackMethod(order.shipping?.method)) {
      try {
        await createEnviopackOrderForOrder(order);

        console.log(
          "[Enviopack] PEDIDO CREADO. ENVÍO SE CREARÁ AL APROBAR EL PAGO.",
        );
      } catch (error) {
        console.error("[Enviopack] ERROR CREANDO PEDIDO:");

        console.error(error.response?.data || error.message || error);

        // No cortamos la compra.
        // El webhook podrá crear nuevamente
        // el pedido cuando el pago sea aprobado.
      }
    }

    // =================================================
    // TRANSFERENCIA
    // =================================================

    if (payment.method === "Transferencia_bancaria") {
      return res.status(201).json({
        success: true,

        message: "Pedido creado correctamente.",

        order: {
          id: order._id,

          userId: order.customer.userId,

          status: order.status,

          payment: order.payment,

          totals: order.totals,

          shipping: order.shipping,
        },
      });
    }

    // =================================================
    // VALIDAR MP
    // =================================================

    if (payment.method !== "mp") {
      return res.status(400).json({
        success: false,

        message: "Método de pago no soportado.",
      });
    }

    // =================================================
    // MERCADO PAGO
    // =================================================

    const totalAmount = subtotal + shippingCost;

    const mpItems = [
      {
        id: order._id.toString(),

        title: orderItems.map((item) => item.name).join(" | "),

        description: orderItems
          .map((item) => `${item.quantity}x ${item.name}`)
          .join(", "),

        quantity: 1,

        currency_id: "ARS",

        unit_price: Number(totalAmount.toFixed(2)),
      },
    ];

    const preference = new Preference(mpClient);

    const preferenceResponse = await preference.create({
      body: {
        items: mpItems,

        payer: {
          name: customer.firstName,

          surname: customer.lastName,

          email: customer.email,

          phone: {
            number: customer.phone || "",
          },
        },

        external_reference: order._id.toString(),

        back_urls: {
          success: `${process.env.FRONTEND_URL}/checkout/payment/success`,

          failure: `${process.env.FRONTEND_URL}/checkout/payment/success`,

          pending: `${process.env.FRONTEND_URL}/checkout/payment/success`,
        },

        notification_url: `${process.env.BACKEND_URL}/api/mp/webhook`,
      },
    });

    // =================================================
    // GUARDAR PREFERENCE
    // =================================================

    order.payment.preferenceId = preferenceResponse.id;

    order.payment.status = "pending";

    await order.save();

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(201).json({
      success: true,

      message: "Pedido creado y preferencia generada.",

      order: {
        id: order._id,

        userId: order.customer.userId,

        status: order.status,

        payment: {
          method: order.payment.method,

          status: order.payment.status,

          preferenceId: order.payment.preferenceId,
        },

        totals: order.totals,

        shipping: order.shipping,
      },

      mercadoPago: {
        preferenceId: preferenceResponse.id,

        initPoint: preferenceResponse.init_point,

        sandboxInitPoint: preferenceResponse.sandbox_init_point,
      },
    });
  } catch (error) {
    console.error("ERROR CREANDO ORDER / MP:", error);

    console.error(error.response?.data || error.message);

    return res.status(500).json({
      success: false,

      message: "No se pudo crear el pedido.",

      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// =====================================================
// FIRMA MERCADO PAGO
// =====================================================

function isValidMpSignature(req) {
  const xSignature = req.headers["x-signature"];
  const xRequestId = req.headers["x-request-id"];

  if (!xSignature || !xRequestId) {
    console.warn("[MP] Faltan headers x-signature o x-request-id");
    return false;
  }

  const dataIdFromQuery = req.query["data.id"] || req.query.id;
  const dataId = (dataIdFromQuery || req.body?.data?.id || "")
    .toString()
    .toLowerCase();

  let ts, hash;

  xSignature.split(",").forEach((part) => {
    const [key, value] = part.split("=");
    if (key?.trim() === "ts") ts = value?.trim();
    if (key?.trim() === "v1") hash = value?.trim();
  });

  if (!ts || !hash) {
    console.warn("[MP] No se pudo parsear ts/v1 de x-signature:", xSignature);
    return false;
  }

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

  const secret = String(process.env.MP_WEBHOOK_SECRET || "").trim(); // 👈 trim

  const computedHash = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  // 🔍 TEMPORAL: sacar estos logs una vez resuelto
  console.log("[MP DEBUG] manifest:", manifest);
  console.log("[MP DEBUG] secret configurado:", secret ? `sí (${secret.length} chars)` : "NO");
  console.log("[MP DEBUG] hash recibido:", hash);
  console.log("[MP DEBUG] hash calculado:", computedHash);

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computedHash, "utf8"),
      Buffer.from(hash, "utf8"),
    );
  } catch (e) {
    console.warn("[MP] timingSafeEqual falló (largos distintos):", e.message);
    return false;
  }
}
// =====================================================
// WEBHOOK MERCADO PAGO
// =====================================================

const mercadoPagoWebhook = async (req, res) => {
  try {
    // =================================================
    // VALIDAR FIRMA
    // =================================================

    if (!isValidMpSignature(req)) {
      console.warn("WEBHOOK MP: firma inválida.");

      return res.status(401).json({
        success: false,

        message: "Firma inválida.",
      });
    }

    const type = req.body?.type || req.query.type;

    // =================================================
    // SOLO PAYMENT
    // =================================================

    if (type !== "payment") {
      return res.status(200).json({
        success: true,
      });
    }

    // =================================================
    // PAYMENT ID
    // =================================================

    const paymentId =
      req.body?.data?.id || req.query["data.id"] || req.query.id;

    if (!paymentId) {
      return res.status(200).json({
        success: true,
      });
    }

    // =================================================
    // CONSULTAR PAYMENT
    // =================================================

    const paymentClient = new Payment(mpClient);

    const paymentInfo = await paymentClient.get({
      id: paymentId,
    });

    console.log("[MP] PAYMENT:", JSON.stringify(paymentInfo, null, 2));

    // =================================================
    // ORDER ID
    // =================================================

    const orderId = paymentInfo.external_reference;

    if (!orderId) {
      console.warn("[MP] Payment sin external_reference:", paymentId);

      return res.status(200).json({
        success: true,
      });
    }

    // =================================================
    // ORDER
    // =================================================

    const order = await Order.findById(orderId);

    if (!order) {
      console.error("[MP] ORDER NO ENCONTRADA:", orderId);

      return res.status(200).json({
        success: true,
      });
    }

    // =================================================
    // STATUS
    // =================================================

    const internalStatus =
      MP_STATUS_MAP[paymentInfo.status] || paymentInfo.status || "pending";

    order.payment.status = internalStatus;

    order.payment.paymentId = String(paymentInfo.id);

    order.payment.mpStatus =
      paymentInfo.status_detail || paymentInfo.status || null;

    // =================================================
    // APROBADO
    // =================================================

    if (internalStatus === "approved") {
      order.status = "approved";

      // Guardamos primero el estado
      // aprobado.
      await order.save();

      // =================================================
      // CREAR ENVÍO ENVIOPACK
      // =================================================

      if (isEnviopackMethod(order.shipping?.method)) {
        try {
          const shipment = await createEnviopackShipmentForOrder(order, true);

          console.log(
            "[Enviopack] ENVÍO CONFIRMADO:",
            JSON.stringify(shipment, null, 2),
          );
        } catch (error) {
          console.error("[Enviopack] ERROR CREANDO ENVÍO DESPUÉS DEL PAGO:");

          console.error(error.response?.data || error.message || error);

          // Devolvemos 500 para que MP
          // pueda volver a notificar.
          return res.status(500).json({
            success: false,

            message: "Pago aprobado pero no se pudo crear el envío.",
          });
        }
      }
    }

    // =================================================
    // RECHAZADO
    // =================================================
    else if (internalStatus === "rejected" || internalStatus === "cancelled") {
      order.status = "cancelled";

      await order.save();
    }

    // =================================================
    // REFUNDED
    // =================================================
    else if (internalStatus === "refunded") {
      order.status = "refunded";

      await order.save();
    }

    // =================================================
    // PENDING
    // =================================================
    else {
      order.status = "pending";

      await order.save();
    }

    console.log(
      `[MP] ORDER ${order._id} -> payment=${internalStatus} / order=${order.status}`,
    );

    return res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error("ERROR WEBHOOK MP:", error);

    console.error(error.response?.data || error.message);

    return res.status(500).json({
      success: false,

      message: "Error procesando webhook.",

      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  createOrder,

  mercadoPagoWebhook,

  createEnviopackShipmentForOrder,

  createEnviopackOrderForOrder,
};

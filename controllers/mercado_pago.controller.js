const crypto = require("crypto");

const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const { sendOrderConfirmationEmail } = require("../config/mailer");
const productModel = require("../models/product.model");
const Order = require("../models/order");

// =====================================================
// MERCADO PAGO
// =====================================================

const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

// =====================================================
// CREAR ORDER + PREFERENCE
// =====================================================

const createOrder = async (req, res) => {
  try {
    const { customer, shippingAddress, shipping, payment, items } = req.body;

    // =====================================================
    // VALIDACIONES
    // =====================================================

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

    if (!Array.isArray(items) || items.length === 0) {
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

    // =====================================================
    // BUSCAR PRODUCTOS
    // =====================================================

    const productIds = items.map((item) => item.productId);

    const products = await productModel.find({
      _id: { $in: productIds },
    });

    if (products.length !== productIds.length) {
      return res.status(400).json({
        success: false,
        message: "Uno o más productos ya no existen.",
      });
    }

    // =====================================================
    // CREAR SNAPSHOT DE LOS PRODUCTOS
    // =====================================================

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

      // =====================================================
      // PRECIO REAL DEL BACKEND
      // =====================================================

      const unitPrice = Number(product.price);

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return res.status(400).json({
          success: false,
          message: `El producto ${product.name} no tiene un precio válido.`,
        });
      }

      const subtotal = unitPrice * quantity;

      // =====================================================
      // SNAPSHOT
      // =====================================================

      orderItems.push({
        productId: product._id,

        name: product.name,

        price: unitPrice,

        quantity,

        subtotal,

        image: product.images?.[0] || product.image || null,
      });
    }

    // =====================================================
    // SUBTOTAL REAL
    // =====================================================

    const subtotal = orderItems.reduce(
      (total, item) => total + item.subtotal,
      0,
    );

    // =====================================================
    // ENVÍO
    // =====================================================

    const shippingCost = shipping?.manual ? 0 : Number(shipping?.cost || 0);

    if (!Number.isFinite(shippingCost) || shippingCost < 0) {
      return res.status(400).json({
        success: false,
        message: "Costo de envío inválido.",
      });
    }

    // =====================================================
    // TOTAL REAL
    // =====================================================

    const total = subtotal + shippingCost;

    // =====================================================
    // CREAR ORDER
    // =====================================================

    const order = await Order.create({
      customer: {
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

      shipping: {
        method: shipping?.method || null,

        manual: Boolean(shipping?.manual),

        option: shipping?.option
          ? {
              id: shipping.option.id,

              title: shipping.option.title,

              description: shipping.option.description,

              price: Number(shipping.option.price || 0),
            }
          : null,

        cost: shippingCost,
      },

      // =====================================================
      // PRODUCTOS
      // =====================================================

      items: orderItems,

      // =====================================================
      // TOTALES
      // =====================================================

      totals: {
        subtotal,

        shipping: shippingCost,

        total,
      },

      // =====================================================
      // PAYMENT
      // =====================================================

      payment: {
        method: payment.method,

        status: "pending",
      },

      // =====================================================
      // ORDER STATUS
      // =====================================================

      status: "pending",
    });

    // =====================================================
    // SI ES TRANSFERENCIA
    // =====================================================

    if (payment.method === "Transferencia_bancaria") {
      return res.status(201).json({
        success: true,

        message: "Pedido creado correctamente.",

        order: {
          id: order._id,

          status: order.status,

          payment: order.payment,

          totals: order.totals,
        },
      });
    }

    // =====================================================
    // VALIDAR MERCADO PAGO
    // =====================================================

    if (payment.method !== "mp") {
      return res.status(400).json({
        success: false,

        message: "Método de pago no soportado.",
      });
    }

    // =====================================================
    // TOTAL PARA MERCADO PAGO
    // =====================================================

    // IMPORTANTE:
    // Acá ya está incluido el envío.
    // NO se vuelve a sumar después.

    const totalAmount =
      orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0) +
      shippingCost;

    // =====================================================
    // ITEMS PARA MERCADO PAGO
    // =====================================================

    const mpItems = [
      {
        id: order._id.toString(),

        title: orderItems.map((item) => item.name).join(" | "),

        description: orderItems
          .map((item) => `${item.quantity}x ${item.name}`)
          .join(", "),

        quantity: 1,

        currency_id: "ARS",

        // Productos + envío
        unit_price: totalAmount,
      },
    ];

    // =====================================================
    // CREAR PREFERENCE
    // =====================================================

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
        auto_return: "approved",

        // =================================================
        // WEBHOOK
        // =================================================

        notification_url: `${process.env.BACKEND_URL}/api/mp/webhook`,
      },
    });

    // =====================================================
    // GUARDAR DATOS DE MERCADO PAGO
    // =====================================================

    order.payment.preferenceId = preferenceResponse.id;

    order.payment.status = "pending";

    await order.save();

    // =====================================================
    // RESPUESTA
    // =====================================================

    return res.status(201).json({
      success: true,

      message: "Pedido creado y preferencia generada.",

      order: {
        id: order._id,

        status: order.status,

        payment: {
          method: order.payment.method,

          status: order.payment.status,

          preferenceId: order.payment.preferenceId,
        },

        totals: order.totals,
      },

      mercadoPago: {
        preferenceId: preferenceResponse.id,

        initPoint: preferenceResponse.init_point,

        sandboxInitPoint: preferenceResponse.sandbox_init_point,
      },
    });
  } catch (error) {
    console.error("ERROR CREANDO ORDER / MERCADO PAGO:", error);

    return res.status(500).json({
      success: false,

      message: "No se pudo crear el pedido.",

      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// =====================================================
// WEBHOOK MERCADO PAGO
// =====================================================
//
// IMPORTANTE:
// - MP puede reintentar el mismo webhook varias veces.
//   El handler tiene que ser idempotente.
// - Hay que responder rápido (200) o MP reintenta.
// - La firma se valida SIEMPRE antes de tocar la base
//   de datos, para evitar que cualquiera dispare
//   cambios de estado pegándole a esta URL.
// =====================================================

// Mapeo de estados de pago de MP -> estados internos
const MP_STATUS_MAP = {
  approved: "approved",
  pending: "pending",
  in_process: "pending",
  authorized: "pending",
  rejected: "rejected",
  cancelled: "cancelled",
  refunded: "refunded",
  charged_back: "charged_back",
};

// =====================================================
// VALIDAR FIRMA DEL WEBHOOK (x-signature)
// =====================================================

const isValidMpSignature = (req) => {
  const xSignature = req.headers["x-signature"];
  const xRequestId = req.headers["x-request-id"];

  if (!xSignature || !xRequestId) {
    return false;
  }

  // dataId puede venir en query (?data.id=...) o en el body
  const dataIdFromQuery = req.query["data.id"] || req.query.id;

  const dataId = (dataIdFromQuery || req.body?.data?.id || "")
    .toString()
    .toLowerCase();

  // x-signature viene con formato: "ts=...,v1=..."
  let ts;
  let hash;

  xSignature.split(",").forEach((part) => {
    const [key, value] = part.split("=");

    if (key?.trim() === "ts") {
      ts = value?.trim();
    }

    if (key?.trim() === "v1") {
      hash = value?.trim();
    }
  });

  if (!ts || !hash) {
    return false;
  }

  // Manifest oficial de Mercado Pago
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

  const computedHash = crypto
    .createHmac("sha256", process.env.MP_WEBHOOK_SECRET)
    .update(manifest)
    .digest("hex");

  // Comparación en tiempo constante
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computedHash, "utf8"),
      Buffer.from(hash, "utf8"),
    );
  } catch {
    return false;
  }
};

// =====================================================
// HANDLER DEL WEBHOOK
// =====================================================

const mercadoPagoWebhook = async (req, res) => {
  try {
    if (!isValidMpSignature(req)) {
      console.warn("WEBHOOK MP: firma inválida o ausente.");

      return res.status(401).json({
        success: false,
        message: "Firma inválida.",
      });
    }

    // =====================================================
    // 2) IDENTIFICAR EL TIPO DE NOTIFICACIÓN
    // =====================================================

    const type = req.body?.type || req.query.type;

    // Solo nos interesan las notificaciones de pago
    if (type !== "payment") {
      return res.status(200).json({ success: true });
    }

    const paymentId =
      req.body?.data?.id || req.query["data.id"] || req.query.id;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: "Falta el id del pago.",
      });
    }

    const paymentClient = new Payment(mpClient);

    const paymentInfo = await paymentClient.get({
      id: paymentId,
    });

    const orderId = paymentInfo.external_reference;

    if (!orderId) {
      console.error(
        "WEBHOOK MP: el pago no tiene external_reference.",
        paymentId,
      );

      return res.status(200).json({ success: true });
    }

    // =====================================================
    // 4) BUSCAR LA ORDER
    // =====================================================

    const order = await Order.findById(orderId);

    if (!order) {
      console.error("WEBHOOK MP: order no encontrada.", orderId);

      // Respondemos 200 igual para que MP no siga
      // reintentando algo que nunca va a resolverse.
      return res.status(200).json({ success: true });
    }

    // =====================================================
    // 5) IDEMPOTENCIA
    // =====================================================
    // Si ya procesamos este mismo pago con este mismo
    // estado, no volvemos a tocar nada.

    if (
      order.payment.mpPaymentId === paymentInfo.id.toString() &&
      order.payment.status ===
        (MP_STATUS_MAP[paymentInfo.status] || paymentInfo.status)
    ) {
      return res.status(200).json({ success: true });
    }

    // =====================================================
    // 6) ACTUALIZAR PAYMENT
    // =====================================================

    const internalStatus =
      MP_STATUS_MAP[paymentInfo.status] || paymentInfo.status;

    order.payment.status = internalStatus;
    order.payment.mpPaymentId = paymentInfo.id.toString();
    order.payment.mpStatusDetail = paymentInfo.status_detail || null;
    order.payment.mpPaymentType = paymentInfo.payment_type_id || null;

    // =====================================================
    // 7) ACTUALIZAR STATUS DE LA ORDER SEGÚN EL PAGO
    // =====================================================

    if (internalStatus === "approved") {
      order.status = "paid";
    } else if (
      internalStatus === "rejected" ||
      internalStatus === "cancelled"
    ) {
      order.status = "cancelled";
    } else if (internalStatus === "refunded") {
      order.status = "refunded";
    } else if (internalStatus === "charged_back") {
      order.status = "charged_back";
    }
    // Si es "pending" dejamos el status de la order como está.

    await order.save();

    await sendOrderConfirmationEmail(order);

    console.log(
      `WEBHOOK MP: order ${order._id} actualizada -> payment: ${internalStatus} / order: ${order.status}`,
    );

    // =====================================================
    // 8) RESPONDER 200 SIEMPRE QUE SE PROCESÓ OK
    // =====================================================

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("ERROR EN WEBHOOK DE MERCADO PAGO:", error);

    // Igual devolvemos 200 para evitar reintentos infinitos
    // de MP ante un error propio (por ejemplo, si el
    // pago todavía no está disponible en su API).
    // Si preferís que MP reintente, cambiar a 500.
    return res.status(200).json({
      success: false,

      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  createOrder,
  mercadoPagoWebhook,
};

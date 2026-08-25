const mongoose = require("mongoose");

// =====================================================
// ITEM DE LA ORDER
// =====================================================

const OrderItemSchema = new mongoose.Schema(
  {
    // Referencia original al producto
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    // Snapshot del producto al momento de comprar
    name: {
      type: String,
      required: true,
      trim: true,
    },

    image: {
      type: String,
      default: null,
    },

    // Precio unitario en el momento de la compra
    price: {
      type: Number,
      required: true,
      min: 0,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    // price * quantity
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

// =====================================================
// DIRECCIÓN DE ENVÍO
// =====================================================

const ShippingAddressSchema = new mongoose.Schema(
  {
    address: {
      type: String,
      required: true,
      trim: true,
    },

    addressNumber: {
      type: String,
      required: true,
      trim: true,
    },

    betweenStreet1: {
      type: String,
      default: "",
      trim: true,
    },

    betweenStreet2: {
      type: String,
      default: "",
      trim: true,
    },

    city: {
      type: String,
      required: true,
      trim: true,
    },

    postalCode: {
      type: String,
      required: true,
      trim: true,
    },

    province: {
      type: String,
      default: "",
      trim: true,
    },

    latitude: {
      type: Number,
      default: null,
    },

    longitude: {
      type: Number,
      default: null,
    },

    placeId: {
      type: String,
      default: null,
    },

    approximate: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
);

// =====================================================
// INFORMACIÓN DEL CLIENTE
// =====================================================

const CustomerSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    phone: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false },
);

// =====================================================
// OPCIÓN DE ENVÍO
// =====================================================

const ShippingOptionSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      default: null,
    },

    title: {
      type: String,
      default: "",
    },

    description: {
      type: String,
      default: "",
    },

    price: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false },
);

// =====================================================
// ENVÍO
// =====================================================

const ShippingSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      default: null,
    },

    manual: {
      type: Boolean,
      default: false,
    },

    option: {
      type: ShippingOptionSchema,
      default: null,
    },

    cost: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false },
);

// =====================================================
// TOTALES
// =====================================================

const TotalsSchema = new mongoose.Schema(
  {
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    shipping: {
      type: Number,
      required: true,
      min: 0,
    },

    total: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

// =====================================================
// PAYMENT
// =====================================================

const PaymentSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: [
        "mp",
        "Transferencia_bancaria",
      ],
      required: true,
    },

    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected",
        "cancelled",
      ],
      default: "pending",
    },

    // ID de la Preference de Mercado Pago
    preferenceId: {
      type: String,
      default: null,
    },

    // ID del pago real de Mercado Pago
    paymentId: {
      type: String,
      default: null,
    },

    // Estado recibido desde Mercado Pago
    mpStatus: {
      type: String,
      default: null,
    },
  },
  { _id: false },
);

// =====================================================
// ORDER
// =====================================================

const OrderSchema = new mongoose.Schema(
  {
    // ===================================================
    // CLIENTE
    // ===================================================

    customer: {
      type: CustomerSchema,
      required: true,
    },

    // ===================================================
    // DIRECCIÓN
    // ===================================================

    shippingAddress: {
      type: ShippingAddressSchema,
      required: true,
    },

    // ===================================================
    // PRODUCTOS
    // ===================================================

    items: {
      type: [OrderItemSchema],
      required: true,

      validate: {
        validator: function (items) {
          return items.length > 0;
        },

        message:
          "La orden debe contener al menos un producto.",
      },
    },

    // ===================================================
    // ENVÍO
    // ===================================================

    shipping: {
      type: ShippingSchema,
      required: true,
    },

    // ===================================================
    // TOTALES
    // ===================================================

    totals: {
      type: TotalsSchema,
      required: true,
    },

    // ===================================================
    // PAGO
    // ===================================================

    payment: {
      type: PaymentSchema,
      required: true,
    },

    // ===================================================
    // ESTADO DE LA ORDER
    // ===================================================

    status: {
      type: String,

      enum: [
        "pending",
        "paid",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],

      default: "pending",
    },
  },

  {
    timestamps: true,
  },
);

// =====================================================
// ÍNDICES
// =====================================================

OrderSchema.index({
  "customer.email": 1,
});

OrderSchema.index({
  status: 1,
});

OrderSchema.index({
  "payment.preferenceId": 1,
});

OrderSchema.index({
  "payment.paymentId": 1,
});

// =====================================================
// MODEL
// =====================================================

module.exports = mongoose.model(
  "Order",
  OrderSchema,
);
const mongoose = require("mongoose");

// =====================================================
// SUBDOCUMENTO: DIRECCIÓN
// =====================================================
// Mismo estilo que ShippingAddressSchema, pero acá todos los
// campos son opcionales (default "") porque el usuario puede
// no haber cargado su dirección todavía.

const AddressSchema = new mongoose.Schema(
  {
    address: {
      type: String,
      trim: true,
      default: "",
    },

    addressNumber: {
      type: String,
      trim: true,
      default: "",
    },

    betweenStreet1: {
      type: String,
      trim: true,
      default: "",
    },

    betweenStreet2: {
      type: String,
      trim: true,
      default: "",
    },

    floorApt: {
      type: String,
      trim: true,
      default: "",
    },

    city: {
      type: String,
      trim: true,
      default: "",
    },

    postalCode: {
      type: String,
      trim: true,
      default: "",
    },

    province: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    // ID del usuario en Clerk
    clerkId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Datos propios de nuestra aplicación
    username: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 30,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    firstName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 50,
    },

    lastName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 50,
    },

    imageUrl: {
      type: String,
      default: null,
    },

    // =====================================================
    // CONTACTO
    // =====================================================

    phone: {
      type: String,
      trim: true,
      default: "",
      maxlength: 20,
    },

    // =====================================================
    // DIRECCIÓN
    // =====================================================

    address: {
      type: AddressSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", userSchema);
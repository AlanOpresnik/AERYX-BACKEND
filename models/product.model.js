const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true },
  tag: { type: String, required: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  aeryx_drop: { type: String, required: true },
  price: { type: String, required: true },
  originalPrice: { type: String, required: true },
  images: [{ type: String, required: true }],
  publicity_image: { type: String, required: false },
  specs: { type: mongoose.Schema.Types.Mixed, default: {} },
  descriptionSetUp: [{ type: String, required: true }],
  position: { type: String, required: true },
  description: { type: String, required: true },
  features: [{ type: String, required: true }],
  created_at: { type: Date, default: () => new Date() },
  isNew: { type: Boolean, default: false },
  inDiscount: { type: Boolean, default: false },
  type: { type: String, required: true },
  sizes: [{ type: String, required: true }],
  stock: { type: Number, default: 0, min: 0 },

  
  // =====================================================
  // SHIPPING (para cotizar con OCA)
  // =====================================================
  // Opcionales: si no están cargados, el shipping controller
  // usa un default por variable de entorno.

  weightKg: { type: Number, required: false, min: 0 },
  volumeM3: { type: Number, required: false, min: 0 },
});

module.exports = mongoose.model("Product", productSchema);
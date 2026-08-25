const mongoose = require("mongoose");

const postalCodeSchema = new mongoose.Schema(
  {
    postalCode: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    city: {
      type: String,
      required: true,
      trim: true,
    },

    province: {
      type: String,
      required: true,
      trim: true,
    },

    zone: {
      type: String,
      enum: [
        "CABA",
        "GBA",
        "BUENOS_AIRES",
        "RESTO",
      ],
      default: "RESTO",
    },
  },
  {
    timestamps: true,
  }
);

postalCodeSchema.index({
  postalCode: 1,
});

module.exports = mongoose.model(
  "PostalCode",
  postalCodeSchema
);
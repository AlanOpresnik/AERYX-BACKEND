const express = require("express");
const router = express.Router();
const shippingController = require("../controllers/shipping.controller");

router.get("/autocomplete", shippingController.autocompleteAddress);

router.get("/evaluate", shippingController.evaluateShipping);

module.exports = router;

const express = require("express");
const router = express.Router();
const mercadooPagoController = require("../controllers/mercado_pago.controller");
const { optionalAuth } = require("../middlewares/auth");

router.post("/preference", optionalAuth, mercadooPagoController.createOrder);
router.post("/webhook", mercadooPagoController.mercadoPagoWebhook);
module.exports = router;

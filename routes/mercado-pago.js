const express = require("express");
const router = express.Router();
const mercadooPagoController = require("../controllers/mercado_pago.controller");

router.post("/preference", mercadooPagoController.createOrder);
router.post("/webhook", mercadooPagoController.mercadoPagoWebhook);
module.exports = router;

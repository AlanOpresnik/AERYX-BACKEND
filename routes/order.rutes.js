const express = require("express");
const router = express.Router();

const orderController = require("../controllers/orders.controller");
const { requireAuth } = require("../middlewares/auth");

// Rutas públicas o de admin (sin cambios)
router.get("/all", orderController.getOrders);
router.get("/metric", orderController.getDashboardMetrics);

// Esta SÍ necesita el middleware, porque el controller lee req.user
router.get("/my-orders", requireAuth, orderController.getMyOrders);

router.get("/:id", orderController.getOrderById);

module.exports = router;
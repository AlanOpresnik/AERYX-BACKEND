const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orders.controller');

router.get("/all", orderController.getOrders);
router.get('/metric',orderController.getDashboardMetrics)
router.get('/:id', orderController.getOrderById)
module.exports = router;

const express = require('express');
const router = express.Router();
const productController = require('../controllers/product.controller');

router.post("/validate", productController.validateCart);
module.exports = router;

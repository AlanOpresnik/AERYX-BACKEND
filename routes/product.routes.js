const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload.middleware');
const productController = require('../controllers/product.controller');
const {
  createProductRules,
  updateProductRules,
  validateProduct,
} = require('../validators/product.validator');

const uploadFields = upload.fields([
  { name: 'images', maxCount: 10 },
  { name: 'publicity', maxCount: 1 },
]);

router.get('/', productController.listProducts);
router.get('/:id', productController.getProduct);
router.post('/', uploadFields, createProductRules, productController.createProduct);
router.put('/:id', uploadFields, updateProductRules, validateProduct, productController.updateProduct);
router.delete('/all', productController.deleteAll);
router.delete('/:id', productController.deleteProduct);

module.exports = router;

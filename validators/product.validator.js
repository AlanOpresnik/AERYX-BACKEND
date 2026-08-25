const { body, validationResult } = require('express-validator');

const createProductRules = [
  body('slug').trim().notEmpty().withMessage('slug es obligatorio'),
  body('tag').trim().notEmpty().withMessage('tag es obligatorio'),
  body('name').trim().notEmpty().withMessage('name es obligatorio'),
  body('category').trim().notEmpty().withMessage('category es obligatorio'),
  body('drop').trim().notEmpty().withMessage('drop es obligatorio'),
  body('price').trim().notEmpty().withMessage('price es obligatorio'),
  body('originalPrice').trim().notEmpty().withMessage('originalPrice es obligatorio'),
  body('images').optional().isArray().withMessage('images debe ser un array'),
  body('images.*').optional().trim().notEmpty().withMessage('Cada imagen debe ser una string no vacía'),
  body('publicity').optional().isArray().withMessage('publicity debe ser un array'),
  body('publicity.*').optional().trim().notEmpty().withMessage('Cada publicity debe ser una string no vacía'),
  body('setup').optional().isArray().withMessage('setup debe ser un array'),
  body('setup.*').optional().trim().notEmpty().withMessage('Cada setup debe ser una string no vacía'),
  body('position').trim().notEmpty().withMessage('position es obligatorio'),
  body('description').trim().notEmpty().withMessage('description es obligatorio'),
  body('features').optional().isArray().withMessage('features debe ser un array'),
  body('features.*').optional().trim().notEmpty().withMessage('Cada feature debe ser una string no vacía'),
  body('type').trim().notEmpty().withMessage('type es obligatorio'),
  body('sizes').optional().isArray().withMessage('sizes debe ser un array'),
  body('sizes.*').optional().trim().notEmpty().withMessage('Cada tamaño debe ser una string no vacía'),
  body('stock').optional().isInt({ min: 0 }).withMessage('stock debe ser un número entero mayor o igual a 0'),
  body('isNew').optional().isBoolean().withMessage('isNew debe ser booleano'),
  body('inDiscount').optional().isBoolean().withMessage('inDiscount debe ser booleano'),
  body('specs').optional().isObject().withMessage('specs debe ser un objeto'),
  body('specs.Superficie').optional().trim().notEmpty(),
  body('specs.Base').optional().trim().notEmpty(),
  body('specs.espesor').optional().trim().notEmpty(),
  body('specs.Compatibilidad').optional().trim().notEmpty(),
  body('specs.Cuidado').optional().trim().notEmpty(),
  body('created_at').optional().isISO8601().toDate().withMessage('created_at debe ser una fecha válida'),
];

const updateProductRules = [
  body('slug').optional().trim().notEmpty().withMessage('slug no puede estar vacío'),
  body('tag').optional().trim().notEmpty().withMessage('tag no puede estar vacío'),
  body('name').optional().trim().notEmpty().withMessage('name no puede estar vacío'),
  body('category').optional().trim().notEmpty().withMessage('category no puede estar vacío'),
  body('drop').optional().trim().notEmpty().withMessage('drop no puede estar vacío'),
  body('price').optional().trim().notEmpty().withMessage('price no puede estar vacío'),
  body('originalPrice').optional().trim().notEmpty().withMessage('originalPrice no puede estar vacío'),
  body('images').optional().isArray().withMessage('images debe ser un array'),
  body('images.*').optional().trim().notEmpty().withMessage('Cada imagen debe ser una string no vacía'),
  body('publicity').optional().isArray().withMessage('publicity debe ser un array'),
  body('publicity.*').optional().trim().notEmpty().withMessage('Cada publicity debe ser una string no vacía'),
  body('setup').optional().isArray().withMessage('setup debe ser un array'),
  body('setup.*').optional().trim().notEmpty().withMessage('Cada setup debe ser una string no vacía'),
  body('position').optional().trim().notEmpty().withMessage('position no puede estar vacío'),
  body('description').optional().trim().notEmpty().withMessage('description no puede estar vacío'),
  body('features').optional().isArray().withMessage('features debe ser un array'),
  body('features.*').optional().trim().notEmpty().withMessage('Cada feature debe ser una string no vacía'),
  body('type').optional().trim().notEmpty().withMessage('type no puede estar vacío'),
  body('sizes').optional().isArray().withMessage('sizes debe ser un array'),
  body('sizes.*').optional().trim().notEmpty().withMessage('Cada tamaño debe ser una string no vacía'),
  body('stock').optional().isInt({ min: 0 }).withMessage('stock debe ser un número entero mayor o igual a 0'),
  body('isNew').optional().isBoolean().withMessage('isNew debe ser booleano'),
  body('inDiscount').optional().isBoolean().withMessage('inDiscount debe ser booleano'),
  body('specs').optional().isObject().withMessage('specs debe ser un objeto'),
  body('specs.Superficie').optional().trim().notEmpty(),
  body('specs.Base').optional().trim().notEmpty(),
  body('specs.espesor').optional().trim().notEmpty(),
  body('specs.Compatibilidad').optional().trim().notEmpty(),
  body('specs.Cuidado').optional().trim().notEmpty(),
  body('created_at').optional().isISO8601().toDate().withMessage('created_at debe ser una fecha válida'),
];

const validateProduct = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  next();
};

module.exports = {
  createProductRules,
  updateProductRules,
  validateProduct,
};

const Product = require("../models/product.model");
const cloudinary = require("../config/cloudinary");

const buildErrorResponse = (res, error) => {
  if (error.name === "CastError") {
    return res.status(400).json({ message: "ID de producto inválido" });
  }

  if (error.code === 11000) {
    return res
      .status(400)
      .json({ message: "Ya existe un producto con ese slug" });
  }

  return res
    .status(500)
    .json({ message: "Error en el servidor", error: error.message });
};

const uploadToCloudinary = (buffer) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'aeryx_products',
        resource_type: 'image',
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      },
    );

    stream.end(buffer);
  });

const uploadDataUriToCloudinary = (dataUri) =>
  new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      dataUri,
      {
        folder: 'aeryx_products',
        resource_type: 'image',
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      },
    );
  });

const normalizeBoolean = (value) =>
  value === true || value === 'true' || value === '1' || value === 1;

const isDataUri = (value) => typeof value === 'string' && value.startsWith('data:image');
const isBlobUrl = (value) => typeof value === 'string' && value.startsWith('blob:');
const isRemoteUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value);

const normalizeArrayField = (field) => {
  if (Array.isArray(field)) return field;
  if (typeof field === 'string') {
    try {
      const parsed = JSON.parse(field);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [field];
    }
  }
  return [];
};

exports.listProducts = async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (error) {
    buildErrorResponse(res, error);
  }
};

exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    res.json(product);
  } catch (error) {
    buildErrorResponse(res, error);
  }
};

exports.createProduct = async (req, res) => {
  try {
    const {
      category,
      description,
      drop,
      features,
      images,
      inDiscount,
      isNew,
      name,
      originalPrice,
      position,
      price,
      publicity,
      setup,
      sizes,
      slug,
      specs,
      stock,
      tag,
      type,
    } = req.body;

    const normalizedImages = normalizeArrayField(images).filter((item) => typeof item === 'string' && item.trim() !== '');
    const uploadedImages = [];
    if (req.files?.images) {
      for (const file of req.files.images) {
        uploadedImages.push(await uploadToCloudinary(file.buffer));
      }
    }

    for (const image of normalizedImages) {
      if (isDataUri(image)) {
        uploadedImages.push(await uploadDataUriToCloudinary(image));
      }
    }

    const finalImages = uploadedImages.length > 0
      ? uploadedImages
      : normalizedImages.filter((item) => isRemoteUrl(item));

    let publicityImage = '';
    const publicityValues = normalizeArrayField(publicity).filter((item) => typeof item === 'string' && item.trim() !== '');
    if (req.files?.publicity && req.files.publicity.length > 0) {
      publicityImage = await uploadToCloudinary(req.files.publicity[0].buffer);
    } else if (publicityValues.length > 0) {
      const base64Publicity = publicityValues.find(isDataUri);
      if (base64Publicity) {
        publicityImage = await uploadDataUriToCloudinary(base64Publicity);
      } else {
        publicityImage = publicityValues.find((item) => isRemoteUrl(item)) || '';
      }
    }

    const product = new Product({
      slug,
      tag,
      name,
      category,
      aeryx_drop: drop,
      price,
      originalPrice,
      images: finalImages,
      publicity_image: publicityImage,
      specs: typeof specs === 'object' && specs !== null ? specs : {},
      descriptionSetUp: Array.isArray(setup) ? setup : [],
      position,
      description,
      features: Array.isArray(features) ? features : [],
      isNew: normalizeBoolean(isNew),
      inDiscount: normalizeBoolean(inDiscount),
      type,
      sizes: Array.isArray(sizes) ? sizes : [],
      stock: Number(stock) >= 0 ? Number(stock) : 0,
    });

    await product.save();
    res.status(201).json(product);
  } catch (error) {
    buildErrorResponse(res, error);
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true,
      },
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    res.json(updatedProduct);
  } catch (error) {
    buildErrorResponse(res, error);
  }
};
exports.validateCart = async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "El carrito está vacío",
      });
    }

    const productIds = items.map((item) => item.productId);

    const products = await Product.find({
      _id: { $in: productIds },
    }).lean();

    const validItems = items
      .map((cartItem) => {
        const product = products.find(
          (product) => product._id.toString() === cartItem.productId,
        );

        if (!product) return null;

        return {
          productId: product._id,
          name: product.name,
          price: product.price,
          image: product.images?.[0] || null,
          quantity: cartItem.quantity,
        };
      })
      .filter(Boolean);

    if (validItems.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No hay productos válidos en el carrito",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        items: validItems,
      },
    });
  } catch (error) {
    console.error("validateCart:", error);

    return res.status(500).json({
      success: false,
      message: "Error validando el carrito",
    });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);

    if (!deletedProduct) {
      return res.status(404).json({ message: "Producto no encontrado" });
    }

    res.json({ message: "Producto eliminado correctamente" });
  } catch (error) {
    buildErrorResponse(res, error);
  }
};

exports.deleteAll = async (req, res) => {
  try {
    const result = await Product.deleteMany({});
    res.json({ message: 'Todos los productos fueron eliminados', deletedCount: result.deletedCount });
  } catch (error) {
    buildErrorResponse(res, error);
  }
};
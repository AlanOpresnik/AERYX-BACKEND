const { getAuth } = require("@clerk/express");
const User = require("../models/User");

// =====================================================
// CAMPOS PLANOS QUE EL USUARIO PUEDE ACTUALIZAR
// =====================================================

const UPDATABLE_FIELDS = ["firstName", "lastName", "phone"];

// =====================================================
// CAMPOS DENTRO DE address QUE EL USUARIO PUEDE ACTUALIZAR
// =====================================================

const UPDATABLE_ADDRESS_FIELDS = [
  "address",
  "addressNumber",
  "betweenStreet1",
  "betweenStreet2",
  "floorApt",
  "city",
  "postalCode",
  "province",
];

// =====================================================
// CREAR / SINCRONIZAR USUARIO CON CLERK
// =====================================================

const syncUser = async (req, res) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "No autenticado",
      });
    }

    // =====================================================
    // BUSCAR USUARIO EXISTENTE
    // =====================================================

    const existingUser = await User.findOne({
      clerkId: userId,
    });

    if (existingUser) {
      return res.status(200).json({
        success: true,
        created: false,
        user: existingUser,
      });
    }

    // =====================================================
    // DATOS DEL USUARIO
    // =====================================================

    // Estos datos pueden venir del frontend después
    // de obtenerlos desde Clerk.
    const {
      email,
      firstName,
      lastName,
      username,
      imageUrl,
    } = req.body;

    // =====================================================
    // CREAR USUARIO
    // =====================================================

    const user = await User.create({
      clerkId: userId,
      email: email || "",
      firstName: firstName || "",
      lastName: lastName || "",
      username: username || null,
      imageUrl: imageUrl || null,
    });

    return res.status(201).json({
      success: true,
      created: true,
      user,
    });
  } catch (error) {
    console.error("ERROR SINCRONIZANDO USUARIO:", error);

    return res.status(500).json({
      success: false,
      message: "Error creando usuario",
    });
  }
};

// =====================================================
// OBTENER USUARIO ACTUAL
// =====================================================

const getMe = async (req, res) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "No autenticado",
      });
    }

    const user = await User.findOne({
      clerkId: userId,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("ERROR OBTENIENDO USUARIO:", error);

    return res.status(500).json({
      success: false,
      message: "Error obteniendo usuario",
    });
  }
};

// =====================================================
// ACTUALIZAR DATOS DEL USUARIO (nombre, tel, dirección, etc.)
// =====================================================

const updateUser = async (req, res) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "No autenticado",
      });
    }

    // =====================================================
    // FILTRAR CAMPOS PLANOS PERMITIDOS
    // =====================================================
    // Evita que manden clerkId, email, imageUrl, etc. por el body.

    const updates = {};

    for (const field of UPDATABLE_FIELDS) {
      const value = req.body[field];

      if (value !== undefined) {
        updates[field] = typeof value === "string" ? value.trim() : value;
      }
    }

    // =====================================================
    // FILTRAR CAMPOS DE address (dot-notation)
    // =====================================================
    // Usamos "address.campo" en el $set para actualizar solo
    // los campos que vinieron, sin pisar el resto del subdocumento.

    const addressInput = req.body.address;

    if (addressInput && typeof addressInput === "object") {
      for (const field of UPDATABLE_ADDRESS_FIELDS) {
        const value = addressInput[field];

        if (value !== undefined) {
          updates[`address.${field}`] =
            typeof value === "string" ? value.trim() : value;
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No enviaste ningún dato para actualizar",
      });
    }

    // =====================================================
    // ACTUALIZAR USUARIO
    // =====================================================

    const user = await User.findOneAndUpdate(
      { clerkId: userId },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("ERROR ACTUALIZANDO USUARIO:", error);

    // Errores de validación del schema (maxlength, etc.)
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Datos inválidos",
        errors: Object.values(error.errors).map((e) => e.message),
      });
    }

    return res.status(500).json({
      success: false,
      message: "Error actualizando usuario",
    });
  }
};

module.exports = {
  syncUser,
  getMe,
  updateUser,
};
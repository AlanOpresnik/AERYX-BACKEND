// middlewares/auth.js
const { getAuth } = require("@clerk/express");
const User = require("../models/User");

// Para rutas que SÍ necesitan estar logueado (ej. /my-orders)
const requireAuth = async (req, res, next) => {
  const { isAuthenticated, userId: clerkId } = getAuth(req);

  if (!isAuthenticated || !clerkId) {
    return res.status(401).json({
      success: false,
      message: "No autenticado",
    });
  }

  const user = await User.findOne({ clerkId });

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Usuario no encontrado",
    });
  }

  req.user = user;
  next();
};

// Para rutas donde el login es opcional (ej. crear order / guest checkout)
// Nunca bloquea: si hay sesión válida popula req.user, si no, sigue sin él.
const optionalAuth = async (req, res, next) => {
  try {
    const { isAuthenticated, userId: clerkId } = getAuth(req);

    if (isAuthenticated && clerkId) {
      const user = await User.findOne({ clerkId });

      if (user) {
        req.user = user;
      }
    }
  } catch (error) {
    console.error("OPTIONAL AUTH ERROR:", error);
    // no rompemos el checkout si esto falla
  }

  next();
};

module.exports = { requireAuth, optionalAuth };
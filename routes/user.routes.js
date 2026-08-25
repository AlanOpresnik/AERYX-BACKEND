  const express = require("express");

  const {
    syncUser,
    getMe,
    updateUser,
  } = require("../controllers/user.controller");

  const requireAuth = require("../middlewares/auth");

  const router = express.Router();

  // Todas las rutas requieren sesión de Clerk
  router.use(requireAuth);

  // Crear/sincronizar usuario
  router.post("/sync", syncUser);
  router.patch("/update", updateUser);

  // Obtener usuario autenticado
  router.get("/me", getMe);

  module.exports = router;
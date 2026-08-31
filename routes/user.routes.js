const express = require("express");

const {
  syncUser,
  getMe,
  updateUser,
} = require("../controllers/user.controller");
const { requireAuth } = require("../middlewares/auth");

const router = express.Router();

// Todas las rutas requieren sesión de Clerk

// Crear/sincronizar usuario
router.post("/sync", requireAuth, syncUser);
router.patch("/update", requireAuth, updateUser);

// Obtener usuario autenticado
router.get("/me", requireAuth, getMe);

module.exports = router;

const { getAuth } = require("@clerk/express");

const requireAuth = (req, res, next) => {
  const { isAuthenticated, userId } = getAuth(req);

  if (!isAuthenticated || !userId) {
    return res.status(401).json({
      success: false,
      message: "No autenticado",
    });
  }

  next();
};

module.exports = requireAuth;
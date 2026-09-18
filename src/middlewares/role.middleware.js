export function requireRole(...roles) {
  return (req, res, next) => {
    const role = req.auth?.compte?.role;

    if (!role) {
      return res
        .status(401)
        .json({ success: false, message: "Authentification requise" });
    }

    if (!roles.includes(role)) {
      return res.status(403).json({ success: false, message: "Accès interdit" });
    }

    return next();
  };
}

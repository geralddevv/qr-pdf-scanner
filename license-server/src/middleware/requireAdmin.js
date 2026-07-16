module.exports = function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) {
    return next();
  }
  res.redirect("/admin/login");
};

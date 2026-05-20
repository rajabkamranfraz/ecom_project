module.exports = async function (req, res, next) {
  if (!req.session.user) {
    req.flash("danger", "Please login to continue");
    return res.redirect("/login");
  }
  if (req.session.user.role !== "admin") {
    req.flash("danger", "Unauthorized access. Admins only.");
    return res.redirect("/");
  }
  res.locals.layout = "super-admin-layout";
  res.locals.title = "FightFit Admin Panel";
  res.locals.user = req.session.user;
  next();
};

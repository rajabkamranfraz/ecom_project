//sets user variable for EJS files
async function sessionAuth(req, res, next) {
  res.locals.user = req.session.user;
  res.locals.isAdmin = false;
  if (req.session.user) {
    res.locals.isAdmin = (req.session.user.role === "admin");
  } else {
    req.session.user = null;
  }
  //set flash function to req;
  //use req.flash("info","message") in router to set a flash message
  req.flash = function (type, message) {
    req.session.flash = { type, message };
  };
  //if flash message is set. set it to res.locals and clear it.
  if (req.session.flash) {
    res.locals.flash = req.session.flash;
    req.session.flash = null;
  }
  next();
}

module.exports = sessionAuth;

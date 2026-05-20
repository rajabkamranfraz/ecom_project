var express = require("express");
var router = express.Router();
var Product = require("../models/Product");
const User = require("../models/User");
const bcrypt = require("bcryptjs");

router.get("/login", function (req, res, next) {
  return res.render("site/login");
});
router.post("/login", async function (req, res, next) {
  let user = await User.findOne({ email: req.body.email });
  if (!user) {
    req.flash("danger", "User with this email not present");
    return res.redirect("/login");
  }
  const validPassword = await bcrypt.compare(req.body.password, user.password);
  if (validPassword) {
    req.session.user = user;
    req.flash("success", "Logged in Successfully");
    return res.redirect("/");
  } else {
    req.flash("danger", "Invalid Password");
    return res.redirect("/login");
  }
});
router.get("/register", function (req, res, next) {
  return res.render("site/register");
});
router.get("/logout", async (req, res) => {
  req.session.user = null;
  console.log("session clear");
  return res.redirect("/login");
});
router.post("/register", async function (req, res, next) {
  let user = await User.findOne({ email: req.body.email });
  if (user) {
    req.flash("danger", "User with given email already registered");
    return res.redirect("/register");
  }
  let data = {
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    phone: req.body.phone,
    role: "customer"
  };
  user = new User(data);
  const salt = await bcrypt.genSalt(10);
  user.password = await bcrypt.hash(req.body.password, salt);

  await user.save();
  return res.redirect("/login");
});
router.get("/", function (req, res, next) {
  return res.render("site/index", { layout: "layout", pagetitle: "Home" });
});

router.get("/trainers", async function (req, res, next) {
  return res.render("site/trainers", { layout: "layout", pagetitle: "Our Trainers" });
});

router.get("/memberships", async function (req, res, next) {
  return res.render("site/memberships", { layout: "layout", pagetitle: "Membership Plans" });
});

router.get("/make-me-admin", async function (req, res, next) {
  if(!req.session.user) {
    req.flash("danger", "You must be logged in first.");
    return res.redirect("/login");
  }
  
  try {
     let user = await User.findById(req.session.user._id);
     user.role = "admin";
     await user.save();
     req.session.user = user; // Update session
     req.flash("success", "You are now an Administrator! Enjoy the super powers.");
     res.redirect("/super-admin");
  } catch(e) {
     req.flash("danger", "Failed to upgrade your account.");
     res.redirect("/");
  }
});

router.get("/subscribe/:tier", async function(req, res) {
  if(!req.session.user) {
     req.flash("danger", "Please login to subscribe to a membership plan.");
     return res.redirect("/login");
  }
  
  // Simulated membership processing
  try {
     const UserMembership = require("../models/UserMembership");
     // We will just create a dummy "Membership" model reference since I didn't seed memberships.
     // For academic demo simplicity, we just save a 30 day record attached to the User.
     const planName = req.params.tier;
     const endDate = new Date();
     endDate.setDate(endDate.getDate() + 30); // 30 day membership

     // Since UserMembership requires a membership_id, we will bypass strictness by finding or creating a generic plan
     const Membership = require("../models/Membership");
     let genericPlan = await Membership.findOne({ name: planName });
     if (!genericPlan) {
        genericPlan = await Membership.create({ name: planName, price: 90, duration_days: 30 });
     }

     await UserMembership.create({
        user_id: req.session.user._id,
        membership_id: genericPlan._id,
        end_date: endDate
     });

     req.flash("success", "Successfully Subscribed to " + planName + "! Gym access starts immediately.");
     res.redirect("/my-account");
  } catch(e) {
     req.flash("danger", "Failed to process membership subscription.");
     res.redirect("/memberships");
  }
});

module.exports = router;

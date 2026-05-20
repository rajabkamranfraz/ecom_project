var express = require("express");
var router = express.Router();
const Order = require("../models/Order");
const UserMembership = require("../models/UserMembership");
const ClassBooking = require("../models/ClassBooking");

router.get("/", async function (req, res, next) {
  try {
    let userId = req.session.user._id;

    let orders = await Order.find({ user_id: userId }).sort({ createdAt: -1 });
    let memberships = await UserMembership.find({ user_id: userId }).populate("membership_id");
    let bookings = await ClassBooking.find({ user_id: userId }).populate("trainer_id").sort({ date: -1 });

    res.render("site/myaccount", {
      layout: "layout",
      user: req.session.user,
      orders,
      memberships,
      bookings
    });
  } catch (error) {
    console.log(error);
    req.flash("danger", "Failed to load dashboard");
    res.redirect("/");
  }
});

module.exports = router;

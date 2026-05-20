var express = require("express");
var router = express.Router();
const User = require("../../models/User");
const Product = require("../../models/Product");
const Order = require("../../models/Order");
const Membership = require("../../models/Membership");

router.get("/", async function (req, res, next) {
  try {
    const totalUsers = await User.countDocuments();
    const totalProducts = await Product.countDocuments();
    const activeOrders = await Order.countDocuments({ status: { $ne: "Delivered" } });
    
    // Revenue calculations (can be optimized with MongoDB Aggregation)
    const orders = await Order.find();
    const totalRevenue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
    
    res.render("super-admin/dashboard", {
      layout: "super-admin-layout",
      title: "FightFit Dashboard Overview",
      stats: { totalUsers, totalProducts, activeOrders, totalRevenue }
    });
  } catch (error) {
    req.flash("danger", "Failed to load dashboard data.");
    res.redirect("/");
  }
});

module.exports = router;

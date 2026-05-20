var express = require("express");
var router = express.Router();
const Order = require("../../models/Order");

router.get("/", async function (req, res, next) {
  try {
    let orders = await Order.find().populate("user_id").sort({ createdAt: -1 });
    res.render("super-admin/orders/index", { layout: "super-admin-layout", title: "Order Management", orders });
  } catch(e) {
    res.redirect("/super-admin");
  }
});

router.post("/update-status/:id", async function(req, res) {
  try {
     let order = await Order.findById(req.params.id);
     order.status = req.body.status;
     await order.save();
     req.flash("success", "Order status updated.");
     res.redirect("/super-admin/orders");
  } catch(e) {
     req.flash("danger", "Failed to update order status.");
     res.redirect("/super-admin/orders");
  }
});

module.exports = router;

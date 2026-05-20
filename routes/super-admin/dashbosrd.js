const express = require("express");
let router = express.Router();
router.get("/", async (req, res) => {
  return res.render("super-admin/dashboard", { layout: false, activePage: 'super-admin', pagetitle: "Super Admin Dashboard" });
});
module.exports = router;

const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  order_id: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ["Pending", "Success", "Failed"], default: "Pending" },
  transaction_id: String,
});

module.exports = mongoose.model("Payment", paymentSchema);

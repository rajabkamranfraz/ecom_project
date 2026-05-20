const mongoose = require("mongoose");

const membershipSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g., Monthly Plan, Premium Plan
  price: { type: Number, required: true },
  duration_days: { type: Number, required: true },
});

module.exports = mongoose.model("Membership", membershipSchema);

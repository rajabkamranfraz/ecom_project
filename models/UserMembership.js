const mongoose = require("mongoose");

const userMembershipSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  membership_id: { type: mongoose.Schema.Types.ObjectId, ref: "Membership", required: true },
  start_date: { type: Date, default: Date.now },
  end_date: { type: Date, required: true },
});

module.exports = mongoose.model("UserMembership", userMembershipSchema);

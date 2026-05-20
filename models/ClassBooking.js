const mongoose = require("mongoose");

const classBookingSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  trainer_id: { type: mongoose.Schema.Types.ObjectId, ref: "Trainer", required: true },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  status: { type: String, enum: ["Pending", "Confirmed", "Cancelled"], default: "Pending" },
});

module.exports = mongoose.model("ClassBooking", classBookingSchema);

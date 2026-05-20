const mongoose = require("mongoose");

const trainerSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  bio: String,
  experience_years: Number,
  specialty: String,
});

module.exports = mongoose.model("Trainer", trainerSchema);

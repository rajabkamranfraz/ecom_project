const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const config = require("config");

mongoose.connect(config.get("db"))
  .then(async () => {
    console.log("Connected to DB for seeding...");
    let admin = await User.findOne({ role: "admin" });
    if (admin) {
      console.log("An admin already exists. Use Email: " + admin.email);
      process.exit();
    }
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash("admin123", salt);

    await User.create({
      name: "Super Admin",
      email: "admin@fightfit.com",
      password: hashedPassword,
      role: "admin",
      phone: "000-000-0000"
    });
    console.log("SUCCESS! Default admin created:");
    console.log("Email: admin@fightfit.com");
    console.log("Password: admin123");
    process.exit();
  })
  .catch(err => {
    console.error("Database connection error:", err);
    process.exit(1);
  });

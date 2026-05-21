const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const Product = require("./models/Product");
const Category = require("./models/Category");
const Trainer = require("./models/Trainer");
const Membership = require("./models/Membership");
const config = require("config");

const productsToSeed = [
  {
    name: "Pro Sparring Gloves",
    description: "Premium leather boxing and sparring gloves for intense workouts.",
    price: 49.99,
    stock: 50,
    department: "GLOVES",
    image: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=500&q=80"
  },
  {
    name: "MMA Training Gloves",
    description: "Lightweight and versatile gloves designed for grappling and striking.",
    price: 35.00,
    stock: 25,
    department: "GLOVES",
    image: "https://images.unsplash.com/photo-1509563268479-0f004cf3f58b?w=500&q=80"
  },
  {
    name: "Krav Maga Tactical Uniform",
    description: "Durable Krav Maga uniform built for intense combat and tactical training.",
    price: 85.00,
    stock: 30,
    department: "UNIFORMS",
    image: "https://images.unsplash.com/photo-1555597673-b21d5c935865?w=500&q=80"
  },
  {
    name: "Classic BJJ Gi",
    description: "High-quality Brazilian Jiu-Jitsu Gi crafted from rip-stop fabric.",
    price: 110.00,
    stock: 15,
    department: "UNIFORMS",
    image: "https://images.unsplash.com/photo-1560021674-faeb89c67087?w=500&q=80"
  },
  {
    name: "Heavy Duty Punching Bag",
    description: "100lb heavy bag designed for powerful kicks and punches.",
    price: 120.00,
    stock: 10,
    department: "EQUIPMENT",
    image: "https://images.unsplash.com/photo-1548690312-e3b507d8c110?w=500&q=80"
  },
  {
    name: "Thai Kick Pads (Pair)",
    description: "High-density foam strike pads for Muay Thai and kickboxing.",
    price: 65.00,
    stock: 45,
    department: "EQUIPMENT",
    image: "https://images.unsplash.com/photo-1517438322307-e67111335449?w=500&q=80"
  },
  {
    name: "Gold Champion Boxing Gloves",
    description: "Exclusive premium 24k gold accented boxing gloves for champions. Hand-stitched.",
    price: 350.00,
    stock: 5,
    department: "Premium",
    image: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=500&q=80"
  },
  {
    name: "Dragon Silk Competition Gi",
    description: "Ultra-lightweight, durable competition Gi made with high-end dragon silk blend.",
    price: 250.00,
    stock: 10,
    department: "Premium",
    image: "https://images.unsplash.com/photo-1560021674-faeb89c67087?w=500&q=80"
  }
];

const membershipsToSeed = [
  { name: "Starter", price: 50, duration_days: 30 },
  { name: "Fighter", price: 90, duration_days: 30 },
  { name: "Pro", price: 150, duration_days: 30 }
];

const trainersToSeed = [
  { name: "Chen", email: "chen@fightfit.com", bio: "Martial arts expert.", experience_years: 10, specialty: "Kung Fu" },
  { name: "Khabib", email: "khabib@fightfit.com", bio: "Wrestling and Sambo master.", experience_years: 15, specialty: "Sambo" },
  { name: "Sarah", email: "sarah@fightfit.com", bio: "Kickboxing and Muay Thai specialist.", experience_years: 8, specialty: "Muay Thai" }
];

const categoriesToSeed = [
  "GLOVES", "UNIFORMS", "EQUIPMENT", "Premium"
];

async function seed() {
  try {
    await mongoose.connect(config.get("db"));
    console.log("Connected to DB for seeding...");

    // Seed Categories
    for (let catName of categoriesToSeed) {
      await Category.findOneAndUpdate({ name: catName }, { name: catName }, { upsert: true, new: true });
    }
    console.log("Categories seeded.");

    // Seed Admin
    let admin = await User.findOne({ email: "lionelmessi@abc.com" });
    if (!admin) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash("me", salt);
      admin = await User.create({
        name: "Super Admin",
        email: "lionelmessi@abc.com",
        password: hashedPassword,
        role: "admin",
        phone: "000-000-0000"
      });
      console.log("Admin seeded.");
    } else {
      console.log("Admin already exists.");
    }

    // Seed Test User
    let testUser = await User.findOne({ email: "abc@abc.com" });
    if (!testUser) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash("abc", salt);
      testUser = await User.create({
        name: "Test User",
        email: "abc@abc.com",
        password: hashedPassword,
        role: "customer",
        phone: "111-111-1111"
      });
      console.log("Test User seeded.");
    } else {
      console.log("Test User already exists.");
    }

    // Seed Trainers
    for (let t of trainersToSeed) {
      let tUser = await User.findOne({ email: t.email });
      if (!tUser) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash("trainer123", salt);
        tUser = await User.create({
          name: t.name,
          email: t.email,
          password: hashedPassword,
          role: "trainer"
        });
      }
      
      await Trainer.findOneAndUpdate(
        { user_id: tUser._id },
        { 
          user_id: tUser._id,
          bio: t.bio,
          experience_years: t.experience_years,
          specialty: t.specialty
        },
        { upsert: true, new: true }
      );
    }
    console.log("Trainers seeded.");

    // Seed Memberships
    for (let m of membershipsToSeed) {
      await Membership.findOneAndUpdate(
        { name: m.name },
        { name: m.name, price: m.price, duration_days: m.duration_days },
        { upsert: true, new: true }
      );
    }
    console.log("Memberships seeded.");

    // Seed Products
    for (let p of productsToSeed) {
      // Find category
      const cat = await Category.findOne({ name: p.department });
      if (cat) {
        p.category_id = cat._id;
      }
      await Product.findOneAndUpdate({ name: p.name }, { $set: p }, { upsert: true, new: true });
    }
    console.log("Products seeded.");

    console.log("Seeding process completed!");
    process.exit();
  } catch (err) {
    console.error("Database Error:", err);
    process.exit(1);
  }
}

seed();

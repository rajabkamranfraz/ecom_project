const mongoose = require("mongoose");
const Product = require("./models/Product");
const Category = require("./models/Category");
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
  }
];

mongoose.connect(config.get("db"))
  .then(async () => {
    console.log("Connected to MongoDB...");
    
    // Attempt to seed categories as strings into description or create new objects
    for (let p of productsToSeed) {
      await Product.findOneAndUpdate({ name: p.name }, { $set: p }, { upsert: true, new: true });
      console.log(`Upserted: ${p.name}`);
    }
    
    console.log("Seeding process completed!");
    process.exit();
  })
  .catch((err) => {
    console.error("Database Error:", err);
    process.exit(1);
  });

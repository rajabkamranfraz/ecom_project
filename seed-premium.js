const mongoose = require('mongoose');
const config = require('config');
const Product = require('./models/Product');

mongoose.connect(config.get('db'))
  .then(async () => {
    console.log("Connected to MongoDB");

    const premiumProducts = [
      {
        name: "Carbon Fiber Training Katana",
        description: "Ultra-lightweight, perfectly balanced carbon fiber katana for advanced striking and parrying practice. Strictly reserved for premium members.",
        price: 199.99,
        stock: 20,
        department: "Premium",
        image: "/images/uploaded/Gemini_Generated_Image_vz6oguvz6oguvz6o.png",
        seoTags: "katana, carbon fiber, training sword, premium martial arts gear",
        metaDetails: "Weight: 450g | Material: Carbon Fiber | Edition: Founder's Run"
      },
      {
        name: "Stealth Tactical Vest - Obsidian",
        description: "Grade-A impact absorption tactical vest. Low-profile design allows it to be worn under standard training gear without restricting kinetic movement.",
        price: 349.00,
        stock: 15,
        department: "Premium",
        image: "/images/uploaded/equip.png",
        seoTags: "tactical vest, stealth armor, krav maga vest, premium defense gear",
        metaDetails: "Armor Class: Level IIIA Soft | Color: Vantablack"
      },
      {
        name: "Reflex Augmentation Tracker",
        description: "Wearable biometric sensor that tracks striking velocity, reaction times, and heart rate variability to mathematically optimize your combat performance.",
        price: 299.50,
        stock: 50,
        department: "Premium",
        image: "/images/uploaded/1766087263327-smartwatch.jpg",
        seoTags: "biometric tracker, reflex sensor, combat analytics, wearable tech",
        metaDetails: "Sensors: 6-Axis Gyro, Optical HR | Battery: 14 Days"
      },
      {
        name: "Elite Krav Maga Gi - Shadow Edition",
        description: "Woven with ripstop technology and reinforced stitching. The Shadow Edition Gi is designed to withstand the highest levels of friction and tearing.",
        price: 150.00,
        stock: 100,
        department: "Premium",
        image: "/images/uploaded/uniform.png",
        seoTags: "krav maga gi, martial arts uniform, shadow edition gi, premium apparel",
        metaDetails: "Material: 450 GSM Pearl Weave | Antimicrobial Treated"
      },
      {
        name: "Zero-G Recovery Pod Token",
        description: "Exclusive access token for a 90-minute session in our facility's Zero-G Sensory Deprivation Recovery Pods. Accelerate muscle and neural recovery.",
        price: 99.00,
        stock: 5,
        department: "Premium",
        image: "/images/uploaded/1766087909019-water-bottle.jpeg",
        seoTags: "sensory deprivation, recovery pod, zero-g therapy, premium service",
        metaDetails: "Duration: 90 Minutes | Location: Facility Alpha"
      }
    ];

    for (let p of premiumProducts) {
      let existing = await Product.findOne({ name: p.name });
      if (!existing) {
        await Product.create(p);
        console.log(`Created Premium Product: ${p.name}`);
      } else {
        console.log(`Product already exists: ${p.name}`);
      }
    }

    console.log("Premium products seeding completed.");
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

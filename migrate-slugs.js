// One-time script to generate slugs for all existing products
// Run with: node migrate-slugs.js

const mongoose = require('mongoose');
const config = require('config');
const Product = require('./models/Product');

async function migrate() {
  await mongoose.connect(config.get('db'));
  console.log('Connected to DB.');

  const products = await Product.find();
  console.log(`Found ${products.length} products. Generating slugs...`);

  for (let p of products) {
    await p.save(); // pre-save hook generates slug
    console.log(`  ✓ ${p.name} → ${p.slug}`);
  }

  console.log('Migration complete!');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

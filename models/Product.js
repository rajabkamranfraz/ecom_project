const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, unique: true },
  description: String,
  price: Number,
  stock: { type: Number, default: 0 },
  category_id: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
  department: String,
  image: String,
  seoTags: String,
  metaDetails: String,
  createdAt: { type: Date, default: Date.now },
});

// Auto-generate slug from name
productSchema.pre('save', function() {
  if (this.isModified('name') || !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
});

module.exports = mongoose.model("Product", productSchema);

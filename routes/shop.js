var express = require("express");
var router = express.Router();
var Product = require("../models/Product");
const Category = require("../models/Category");

const Cart = require("../models/Cart");
const CartItem = require("../models/CartItem");
const Order = require("../models/Order");
const OrderItem = require("../models/OrderItem");

const User = require("../models/User");

router.get("/cart", async function (req, res) {
  if (!req.session.user) {
    req.flash("danger", "Please login to view cart");
    return res.redirect("/login");
  }

  let cart = await Cart.findOne({ user_id: req.session.user._id });
  let cartItems = [];
  let total = 0;
  let discountRate = 0;
  let code = "";

  if (cart) {
    cartItems = await CartItem.find({ cart_id: cart._id }).populate("product_id");
    total = cartItems.reduce((sum, item) => sum + (item.product_id.price * item.quantity), 0);
    if (req.session.coupon) {
      discountRate = req.session.coupon.rate;
      code = req.session.coupon.code;
    }
  }

  res.render("site/cart", { layout: "layout", pagetitle: "Your Cart", cartItems, total, discountRate, code });
});

router.get("/add-cart/:id", async function (req, res) {
  if (!req.session.user) {
    req.flash("danger", "Please login to add to cart");
    return res.redirect("/login");
  }
  if (req.session.user.role === 'admin') {
    req.flash("danger", "Admins cannot place orders.");
    return res.redirect("/shop");
  }

  let cart = await Cart.findOne({ user_id: req.session.user._id });
  if (!cart) {
    cart = await Cart.create({ user_id: req.session.user._id });
  }

  let product = await Product.findById(req.params.id);
  if (!product) return res.redirect("/shop");

  let item = await CartItem.findOne({ cart_id: cart._id, product_id: req.params.id });
  
  if (item) {
    if (item.quantity + 1 > product.stock) {
      req.flash("danger", "Cannot add more items. Not enough stock.");
      return res.redirect("/cart");
    }
    item.quantity += 1;
    await item.save();
  } else {
    if (product.stock < 1) {
      req.flash("danger", "Product is out of stock.");
      return res.redirect("/shop");
    }
    await CartItem.create({ cart_id: cart._id, product_id: req.params.id, quantity: 1 });
  }

  req.flash("success", "Item added to cart");
  res.redirect("/cart");
});

router.get("/remove-cart/:id", async function(req, res) {
  if (!req.session.user) return res.redirect("/login");
  try {
    await CartItem.findByIdAndDelete(req.params.id);
    req.flash("success", "Item removed from cart");
  } catch(e) {
    req.flash("danger", "Failed to remove item");
  }
  res.redirect("/cart");
});

router.get("/checkout", async function(req, res) {
  if (!req.session.user) return res.redirect("/login");
  if (req.session.user.role === 'admin') {
    req.flash("danger", "Admins cannot place orders.");
    return res.redirect("/shop");
  }
  let cart = await Cart.findOne({ user_id: req.session.user._id });
  if (!cart) return res.redirect("/cart");
  
  let cartItems = await CartItem.find({ cart_id: cart._id }).populate("product_id");
  let total = cartItems.reduce((sum, item) => sum + (item.product_id.price * item.quantity), 0);
  
  let discount = 0;
  let code = "";
  if (req.session.coupon) {
    discount = total * req.session.coupon.rate;
    code = req.session.coupon.code;
  }
  
  res.render("site/checkout", { layout: "layout", pagetitle: "Checkout", total, discount, code });
});

router.post("/apply-coupon", async (req, res) => {
  let { code } = req.body;
  if (code && code.toUpperCase() === "CYBER20") {
    req.session.coupon = { code: "CYBER20", rate: 0.20 };
    req.flash("success", "Coupon applied: 20% OFF");
  } else {
    req.flash("danger", "Invalid or expired coupon.");
  }
  res.redirect("/cart");
});

router.post("/checkout/process", async function(req, res) {
  if (!req.session.user) return res.redirect("/login");
  if (req.session.user.role === 'admin') {
    req.flash("danger", "Admins cannot place orders.");
    return res.redirect("/shop");
  }
  let cart = await Cart.findOne({ user_id: req.session.user._id });
  if (!cart) return res.redirect("/cart");

  let cartItems = await CartItem.find({ cart_id: cart._id }).populate("product_id");
  let total = cartItems.reduce((sum, item) => sum + (item.product_id.price * item.quantity), 0);

  let discountAmount = 0;
  if (req.session.coupon) {
    discountAmount = total * req.session.coupon.rate;
    total = total - discountAmount;
  }

  // Sandbox payment processing
  let order = await Order.create({
    user_id: req.session.user._id,
    total_amount: total,
    status: "Processing",
    payment_method: req.body.payment_method || "Card"
  });

  let hasMembership = false;
  let membershipTier = "";

  for (let item of cartItems) {
    // Save order item
    await OrderItem.create({
      order_id: order._id,
      product_id: item.product_id._id,
      quantity: item.quantity,
      price: item.product_id.price
    });
    
    // Deduct stock safely
    let prod = await Product.findById(item.product_id._id);
    if(prod) {
       prod.stock = Math.max(0, prod.stock - item.quantity);
       await prod.save();
       
       if (prod.department === "Memberships") {
         hasMembership = true;
         membershipTier = prod.name;
       }
    }
  }

  if (hasMembership) {
    await User.findByIdAndUpdate(req.session.user._id, { membership: membershipTier });
    req.session.user.membership = membershipTier;
  }

  await CartItem.deleteMany({ cart_id: cart._id });
  await Cart.findByIdAndDelete(cart._id);
  req.session.coupon = null;

  req.flash("success", "Order placed successfully! Sandbox payment processed.");
  res.redirect("/my-account");
});

// WISHLIST LOGIC
router.get("/wishlist", async (req, res) => {
  if (!req.session.user) {
    req.flash("danger", "Please login to view your wishlist.");
    return res.redirect("/login");
  }
  const user = await User.findById(req.session.user._id).populate("wishlist");
  res.render("site/wishlist", { layout: "layout", pagetitle: "Your Wishlist", wishlist: user.wishlist || [] });
});

router.get("/wishlist/add/:id", async (req, res) => {
  if (!req.session.user) {
    req.flash("danger", "Login required.");
    return res.redirect("/login");
  }
  await User.findByIdAndUpdate(req.session.user._id, { $addToSet: { wishlist: req.params.id } });
  req.flash("success", "Added to wishlist.");
  res.redirect(req.get('referer') || '/shop');
});

router.get("/wishlist/remove/:id", async (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  await User.findByIdAndUpdate(req.session.user._id, { $pull: { wishlist: req.params.id } });
  req.flash("success", "Removed from wishlist.");
  res.redirect("/wishlist");
});

// SUBSCRIPTIONS & TRAINERS
router.get("/activate-membership/:tier", async (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  res.render("site/activate-membership", { layout: "layout", pagetitle: "Initialize Protocol", tier: req.params.tier });
});

router.post("/subscribe/:tier", async (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  let tierName = req.params.tier;
  let price = tierName.includes("Pro") ? 150 : tierName.includes("Fighter") ? 90 : 50;
  
  let prodName = `Membership - ${tierName}`;
  let prod = await Product.findOne({ name: prodName });
  if (!prod) {
    prod = await Product.create({ name: prodName, price: price, stock: 9999, department: "Memberships", image: '/images/uploaded/membership_badge.png' });
  }
  res.redirect(`/add-cart/${prod._id}`);
});

router.get("/book-trainer/:name", async (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  res.render("site/book-trainer", { layout: "layout", pagetitle: "Schedule Session", trainer: req.params.name });
});

router.post("/schedule-trainer/:name", async (req, res) => {
  if (!req.session.user) return res.redirect("/login");
  let trainerName = req.params.name;
  let { date, time } = req.body;
  if(!date || !time) {
     req.flash("danger", "Please provide a valid date and time slot.");
     return res.redirect(`/book-trainer/${trainerName}`);
  }
  let prodName = `Trainer Session - ${trainerName} (${date} at ${time})`;
  let imgUrl = trainerName.toLowerCase() === 'chen' ? '/images/uploaded/chen.png' : trainerName.toLowerCase() === 'khabib' ? '/images/uploaded/khabib.png' : '/images/uploaded/sarah.png';
  
  let prod = await Product.findOne({ name: prodName });
  if (!prod) {
    prod = await Product.create({ name: prodName, price: 60, stock: 1, department: "Services", image: imgUrl });
  }
  res.redirect(`/add-cart/${prod._id}`);
});

// PREMIUM ACCESS
router.get("/premium-gear", async (req, res) => {
  if (!req.session.user || !req.session.user.membership) {
    req.flash("danger", "ACCESS DENIED. Active membership required for Premium Gear.");
    return res.redirect("/memberships");
  }
  let products = await Product.find({ department: "Premium" });
  res.render("site/shop", { layout: "layout", pagetitle: "Premium Gear", products, currentFilters: {}, page: 1, totalPages: 1 });
});

router.get("/product/:slug", async function (req, res) {
  try {
    let product = await Product.findOne({ slug: req.params.slug }).populate("category_id");
    if (!product) {
      req.flash("danger", "Product not found");
      return res.redirect("/shop");
    }
    res.render("site/product-detail", {
      layout: "layout",
      pagetitle: product.seoTags || product.name,
      product
    });
  } catch(e) {
    res.redirect("/shop");
  }
});

router.get("/category/:name", async function (req, res) {
  let categoryName = req.params.name;

  let categories = await Category.find();
  let products = await Product.find({ category: categoryName });

  res.render("site/collections/Catetorys", {
    Category_title: categoryName,
    categories,
    products,
  });
});

router.get("/shop/:page?", async function (req, res) {
  let page = Number(req.params.page) || 1;
  let pageSize = 10;
  let skip = (page - 1) * pageSize;

  let { category, minPrice, maxPrice } = req.query;

  let allProducts = await Product.find({ department: { $nin: ["Services", "Memberships"] } }).lean();

  if (category && category !== '') {
    allProducts = allProducts.filter(product => {
      return product.department && product.department.toLowerCase() === category.toLowerCase();
    });
  }

  if ((minPrice && !isNaN(minPrice)) || (maxPrice && !isNaN(maxPrice))) {
    allProducts = allProducts.filter(product => {
      let productPrice = Number(product.price.toString().replace(/,/g, ''));

      let minCheck = true;
      let maxCheck = true;

      if (minPrice && !isNaN(minPrice)) {
        minCheck = productPrice >= Number(minPrice);
      }

      if (maxPrice && !isNaN(maxPrice)) {
        maxCheck = productPrice <= Number(maxPrice);
      }

      return minCheck && maxCheck;
    });
  }

  let totalProducts = allProducts.length;
  let totalPages = Math.ceil(totalProducts / pageSize);
  let startIndex = (page - 1) * pageSize;
  let endIndex = startIndex + pageSize;
  let products = allProducts.slice(startIndex, endIndex);

  res.render("site/shop", {
    layout: "layout",
    pagetitle: "Shop",
    products,
    page,
    pageSize,
    totalPages,
    currentFilters: {
      category: category || '',
      minPrice: minPrice || '',
      maxPrice: maxPrice || ''
    }
  });
});

module.exports = router;

const express = require("express");
const router = express.Router();
const Product = require("../models/Product");
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const CartItem = require("../models/CartItem");
const OrderItem = require("../models/OrderItem");
const config = require("config");

const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");

// Helper function: Ensure regex escape for db search
function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// Ensure the application doesn't crash if the key is missing initially
let genAI = null;
try {
  if (config.has("geminiApiKey") && config.get("geminiApiKey") !== "YOUR_API_KEY_HERE") {
    genAI = new GoogleGenerativeAI(config.get("geminiApiKey"));
  }
} catch (e) {
  console.log("No Gemini API key supplied yet.");
}

router.post("/message", async (req, res) => {
  try {
    const rawMessage = req.body.message;
    if (!rawMessage) return res.json({ text: "Please say something!" });

    if (rawMessage.startsWith("EXECUTE_FINAL_CHECKOUT")) {
      const pm = rawMessage.replace("EXECUTE_FINAL_CHECKOUT", "").trim() || "Card";
      if (!req.session.user) return res.json({ text: "Please <a href='/login'>login</a> to complete your checkout." });
      if (req.session.user.role === 'admin') return res.json({ text: "Admins cannot place orders. Please use a customer account." });
      
      let cart = await Cart.findOne({ user_id: req.session.user._id });
      if (!cart) return res.json({ text: "You don't have an active cart to checkout." });

      let cartItems = await CartItem.find({ cart_id: cart._id }).populate("product_id");
      if (cartItems.length === 0) return res.json({ text: "Your cart is empty. Add some products first!" });

      let total = cartItems.reduce((sum, item) => sum + (item.product_id.price * item.quantity), 0);

      let botOrder = await Order.create({
        user_id: req.session.user._id,
        total_amount: total,
        status: "Processing",
        payment_method: `Chatbot ${pm} (Sandbox)`
      });

      for (let item of cartItems) {
        await OrderItem.create({
          order_id: botOrder._id,
          product_id: item.product_id._id,
          quantity: item.quantity,
          price: item.product_id.price
        });
        
        let prod = await Product.findById(item.product_id._id);
        if(prod) {
           prod.stock = Math.max(0, prod.stock - item.quantity);
           await prod.save();
        }
      }

      await CartItem.deleteMany({ cart_id: cart._id });
      await Cart.findByIdAndDelete(cart._id);

      return res.json({ text: `OVERRIDE SUCCESSFUL. Your <strong>${pm}</strong> payment was processed via Sandbox. Order Hash: <strong>#${botOrder._id.toString().substring(0,8)}</strong>.<br><br><button onclick="document.getElementById('chatInput').value='track order ${botOrder._id}'; document.getElementById('chatbotForm').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}))" class="btn-add" style="width: 100%; padding: 12px; border: none; font-weight: 800; cursor: pointer; text-transform: uppercase;">TRACK SHIPMENT</button>` });
    }

    let intent = "unknown";
    let analysis = { searchTerm: null, maxPrice: null, orderId: null };

    // Hybrid Approach: Try Gemini API first
    if (genAI) {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `
          You are the NLU agent for the FightFit e-commerce platform.
          You are the NLU agent for the FightFit e-commerce platform.
          Analyze the user's message and extract the 'intent', 'searchTerm', 'maxPrice' and 'orderId'.
          IMPORTANT: For 'searchTerm', aggressively strip out all conversational filler words like 'only', 'just', 'some', 'any', 'please', 'can you', 'show me'. Extract ONLY the exact product name or raw category (e.g., 'gloves', 'heavy bag').
          Respond ONLY with a valid JSON object matching this schema, no markdown:
          { "intent": "search | track | cart | checkout | recommend | faq | remove_cart | clear_cart | wishlist_add | wishlist_remove | wishlist_view | schedule_trainer | subscribe_membership | unknown", "searchTerm": "string | null", "maxPrice": "number | null", "orderId": "string | null", "targetName": "string | null" }
          
          User Message: "${rawMessage}"
        `;
        const aiResult = await model.generateContent(prompt);
        let rawText = aiResult.response.text().replace(/```json/gi, '').replace(/```/gi, '').trim();
        const aiAnalysis = JSON.parse(rawText);
        intent = aiAnalysis.intent;
        analysis = aiAnalysis;
      } catch (aiError) {
        console.log("Gemini API Error (Falling back to local NLU):", aiError.message);
      }
    }

    // Local Fallback NLU parser (if Gemini key fails or genAI is null)
    if (intent === "unknown") {
      const msg = rawMessage.toLowerCase();
      // Price extraction
      const match = rawMessage.match(/(under|below|<|less than)\s*\$?\s*(\d+(\.\d+)?)/i);
      analysis.maxPrice = match ? parseFloat(match[2]) : null;
      
      // Intent parsing
      if (msg.includes("shipping") || msg.includes("return") || msg.includes("payment")) {
        intent = "faq";
      } else if (msg.includes("order") && (msg.includes("where") || msg.includes("track"))) {
        intent = "track";
        const idMatch = rawMessage.match(/[a-f0-9]{24}/);
        analysis.orderId = idMatch ? idMatch[0] : null;
      } else if (msg.includes("wishlist") || msg.includes("saved")) {
        if (msg.includes("add") || msg.includes("save")) {
           intent = "wishlist_add";
           analysis.targetName = rawMessage.replace(/(add|save|to|my|wishlist)/gi, "").trim();
        } else if (msg.includes("remove") || msg.includes("delete")) {
           intent = "wishlist_remove";
           analysis.targetName = rawMessage.replace(/(remove|delete|from|my|wishlist)/gi, "").trim();
        } else {
           intent = "wishlist_view";
        }
      } else if (msg.includes("schedule") || msg.includes("trainer") || msg.includes("book")) {
         intent = "schedule_trainer";
         analysis.targetName = rawMessage.replace(/(schedule|book|trainer|with)/gi, "").trim();
      } else if (msg.includes("subscribe") || msg.includes("membership") || msg.includes("tier")) {
         intent = "subscribe_membership";
         analysis.targetName = rawMessage.replace(/(subscribe|to|membership|tier)/gi, "").trim();
      } else if (msg.includes("cart")) {
        if (msg.includes("remove") || msg.includes("delete")) {
          intent = "remove_cart";
          analysis.targetName = rawMessage.replace(/(remove|delete|from|my|cart|the|please)/gi, "").trim();
        } else if (msg.includes("empty") || msg.includes("clear")) {
          intent = "clear_cart";
        } else {
          intent = "cart";
        }
      } else if (msg.includes("checkout") || msg.includes("pay for my cart") || msg.includes("buy my cart")) {
        intent = "checkout";
      } else if (msg.includes("recommend") || msg.includes("popular")) {
        intent = "recommend";
      } else if (msg.includes("show") || msg.includes("find") || msg.split(" ").length <= 5) {
        intent = "search";
        analysis.searchTerm = rawMessage.replace(/(show me|show|find|get|search for|buy|products|under \d+|less than \d+|only|just|some|any|available|for sale|please|can you)/gi, "").trim();
      }
    }

    // 2. Route intents to your existing backend fetchers
    if (intent === "faq") {
      const msg = rawMessage.toLowerCase();
      if (msg.includes("shipping") || msg.includes("delivery")) {
        return res.json({ text: "Standard shipping takes 3-5 business days. Expedited shipping is available at checkout for an additional fee." });
      }
      if (msg.includes("return") || msg.includes("refund")) {
        return res.json({ text: "We offer a 30-day money-back guarantee. If you're not satisfied, you can return the item within 30 days of receipt." });
      }
      return res.json({ text: "We accept all major credit cards, PayPal, and handle returns within 30 days! Standard shipping takes 3-5 business days." });
    }

    if (intent === "track") {
      if (analysis.orderId) {
        const order = await Order.findById(analysis.orderId);
        if (order) {
          let timeline = `
          <div class="ai-product-card" style="border-color: #fff; margin-top: 15px;">
            <div style="color: #ccc; font-size: 0.8rem; margin-bottom: 5px; font-weight: bold; letter-spacing: 1px;">TIMESTAMP</div>
            <div style="color: #fff; margin-bottom: 15px; font-weight: bold; font-size: 1.1rem;">${new Date(order.createdAt).toLocaleDateString()}</div>
            <div style="color: #ccc; font-size: 0.8rem; margin-bottom: 5px; font-weight: bold; letter-spacing: 1px;">CURRENT STATUS</div>
            <div style="color: var(--accent-cyan); margin-bottom: 15px; font-weight: 900; font-size: 1.5rem; text-transform: uppercase; text-shadow: 0 0 10px rgba(204,255,0,0.3);">${order.status}</div>
            <div style="color: #ccc; font-size: 0.8rem; margin-bottom: 5px; font-weight: bold; letter-spacing: 1px;">VALUE</div>
            <div style="color: #fff; font-weight: bold; font-family: monospace; font-size: 1.2rem;">$${order.total_amount.toFixed(2)}</div>
          </div>`;
          return res.json({ text: `Uplink established. Tracking data for your order:<br>${timeline}` });
        } else {
          return res.json({ text: "I couldn't find an order with that ID." });
        }
      } else {
        if (req.session.user) {
          const activeOrders = await Order.find({ user_id: req.session.user._id, status: { $ne: "Delivered" } }).sort({ createdAt: -1 }).lean();
          if (activeOrders.length > 0) {
            return res.json({ 
              text: "Here are your active orders. Click one to track its real-time status:", 
              orders: activeOrders 
            });
          } else {
            return res.json({ text: "You don't have any active active orders to track right now!" });
          }
        } else {
          return res.json({ text: "To track your order, please provide your 24-character Order ID (e.g. 'track order 60d5ec...' ) or <a href='/login'>login</a> to view your active orders natively." });
        }
      }
    }

    if (intent === "cart") {
      if (!req.session.user) {
        return res.json({ text: "Please <a href='/login'>login</a> to view your cart." });
      }
      let cart = await Cart.findOne({ user_id: req.session.user._id });
      if (!cart) return res.json({ text: "Your cart is currently empty." });
      
      let cartItems = await CartItem.find({ cart_id: cart._id }).populate("product_id");
      if (cartItems.length === 0) return res.json({ text: "Your cart is currently empty." });
      
      let itemsHtml = cartItems.map(item => `
        <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px; background: #111; padding: 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
          <img src="${item.product_id.image || 'https://dummyimage.com/100x100/111/ccff00.png&text=' + encodeURIComponent(item.product_id.name)}" style="width: 60px; height: 60px; object-fit: contain; border-radius: 8px; background: #fff;">
          <div style="flex-grow: 1;">
            <div style="color: #fff; font-weight: 800; font-size: 0.95rem; line-height: 1.2; margin-bottom: 4px;">${item.product_id.name}</div>
            <div style="color: var(--accent-cyan); font-weight: bold; font-family: monospace; font-size: 1rem;">${item.quantity} <span style="color:#666;">x</span> $${item.product_id.price}</div>
          </div>
        </div>`).join("");
      return res.json({ text: `Current inventory loaded in your cart:<br><br>${itemsHtml}<br><button onclick="document.getElementById('chatInput').value='checkout'; document.getElementById('chatbotForm').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}))" class="btn-add" style="width: 100%; padding: 15px; border: none; font-weight: 900; font-size: 1rem; cursor: pointer; margin-top: 10px; border-radius: 12px;">INITIATE CHECKOUT</button>` });
    }

    if (intent === "clear_cart") {
       if (!req.session.user) return res.json({ text: "Authentication required to modify cart." });
       let cart = await Cart.findOne({ user_id: req.session.user._id });
       if (cart) {
          await CartItem.deleteMany({ cart_id: cart._id });
          return res.json({ text: "Cart purged successfully. Ready for new hardware." });
       }
       return res.json({ text: "Cart is already empty." });
    }

    if (intent === "remove_cart") {
       if (!req.session.user) return res.json({ text: "Authentication required to modify cart." });
       let cart = await Cart.findOne({ user_id: req.session.user._id });
       if (!cart) return res.json({ text: "Cart is already empty." });
       
       let cartItems = await CartItem.find({ cart_id: cart._id }).populate("product_id");
       let target = (analysis.targetName || analysis.searchTerm || "").toLowerCase();
       let foundItem = cartItems.find(i => i.product_id.name.toLowerCase().includes(target));
       
       if(foundItem) {
          await CartItem.findByIdAndDelete(foundItem._id);
          return res.json({ text: `Target confirmed. Removed <strong>${foundItem.product_id.name}</strong> from your cart.` });
       } else {
          return res.json({ text: `Could not locate "${target}" in your cart to remove.` });
       }
    }

    if (intent === "wishlist_view") {
       if (!req.session.user) return res.json({ text: "Please <a href='/login'>login</a> to view your wishlist." });
       const User = require("../models/User");
       const user = await User.findById(req.session.user._id).populate("wishlist");
       if (!user.wishlist || user.wishlist.length === 0) return res.json({ text: "Your wishlist is currently empty." });
       let itemsHtml = user.wishlist.map(p => `
         <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px; background: #111; padding: 15px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
           <img src="${p.image || 'https://dummyimage.com/60/111/ccff00'}" style="width: 50px; height: 50px; object-fit: contain; border-radius: 8px;">
           <div style="flex-grow: 1;">
             <div style="color: #fff; font-weight: 800; font-size: 0.95rem;">${p.name}</div>
             <div style="color: var(--accent-cyan); font-weight: bold;">$${p.price}</div>
           </div>
           <button onclick="document.getElementById('chatInput').value='remove ${p.name.replace(/'/g, "\\'")} from wishlist'; document.getElementById('chatbotForm').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}))" style="background:transparent; border:1px solid var(--accent-pink); color:var(--accent-pink); border-radius:8px; padding:5px 10px; cursor:pointer;"><i class="fas fa-trash"></i></button>
         </div>`).join("");
       return res.json({ text: `Your wishlist targets:<br><br>${itemsHtml}` });
    }

    if (intent === "wishlist_add") {
       if (!req.session.user) return res.json({ text: "Please <a href='/login'>login</a> to add to wishlist." });
       let target = (analysis.targetName || analysis.searchTerm || "").toLowerCase();
       if (!target) return res.json({ text: "Please specify the product to add to your wishlist." });
       const prod = await Product.findOne({ name: new RegExp(escapeRegex(target), 'i') });
       if (!prod) return res.json({ text: `Could not find a product matching "${target}".` });
       const User = require("../models/User");
       await User.findByIdAndUpdate(req.session.user._id, { $addToSet: { wishlist: prod._id } });
       return res.json({ text: `Target acquired. <strong>${prod.name}</strong> added to your wishlist.` });
    }

    if (intent === "wishlist_remove") {
       if (!req.session.user) return res.json({ text: "Please <a href='/login'>login</a> to remove from wishlist." });
       let target = (analysis.targetName || analysis.searchTerm || "").toLowerCase();
       if (!target) return res.json({ text: "Please specify the product to remove." });
       const User = require("../models/User");
       const user = await User.findById(req.session.user._id).populate("wishlist");
       let foundProd = user.wishlist.find(p => p.name.toLowerCase().includes(target));
       if (!foundProd) return res.json({ text: `Could not find "${target}" in your wishlist.` });
       await User.findByIdAndUpdate(req.session.user._id, { $pull: { wishlist: foundProd._id } });
       return res.json({ text: `Target removed. <strong>${foundProd.name}</strong> deleted from wishlist.` });
    }

    if (intent === "schedule_trainer") {
       if (!req.session.user) return res.json({ text: "Please <a href='/login'>login</a> to schedule a trainer." });
       let target = (analysis.targetName || analysis.searchTerm || "").toLowerCase();
       const trainers = ["Chen", "Khabib", "Sarah"];
       let matchedTrainer = trainers.find(t => target.includes(t.toLowerCase()));
       if (!matchedTrainer) return res.json({ text: "Please specify the trainer (Chen, Khabib, or Sarah)." });
       return res.json({ text: `To confirm booking with Trainer ${matchedTrainer}, <a href="/schedule-trainer/${matchedTrainer}" style="color:var(--accent-cyan); text-decoration:underline;">Click Here to Add to Cart</a>.` });
    }

    if (intent === "subscribe_membership") {
       if (!req.session.user) return res.json({ text: "Please <a href='/login'>login</a> to subscribe." });
       let target = (analysis.targetName || analysis.searchTerm || "").toLowerCase();
       const tiers = ["BasicTier", "FighterTier", "ProTier"];
       let matchedTier = tiers.find(t => target.includes(t.toLowerCase().replace("tier", "")));
       if (!matchedTier) return res.json({ text: "Please specify the membership tier (Basic, Fighter, or Pro)." });
       return res.json({ text: `To initialize ${matchedTier} protocol, <a href="/subscribe/${matchedTier}" style="color:var(--accent-cyan); text-decoration:underline;">Click Here to Add to Cart</a>.` });
    }

    if (intent === "checkout") {
      if (!req.session.user) return res.json({ text: "Please <a href='/login'>login</a> to complete your checkout." });
      if (req.session.user.role === 'admin') return res.json({ text: "Admins cannot place orders. Please use a customer account." });
      let cart = await Cart.findOne({ user_id: req.session.user._id });
      if (!cart) return res.json({ text: "You don't have an active cart to checkout." });
      let cartItems = await CartItem.find({ cart_id: cart._id }).populate("product_id");
      if (cartItems.length === 0) return res.json({ text: "Your cart is empty. Add some products first!" });

      let total = cartItems.reduce((sum, item) => sum + (item.product_id.price * item.quantity), 0);
      
      const formHtml = `
         <div class="ai-product-card" style="border-color: var(--accent-cyan); background: #0a0a0a; margin-top: 15px;">
            <h6 style="color: #fff; margin-bottom: 20px; font-weight: 800; font-size: 0.9rem; letter-spacing: 1px;"><i class="fas fa-truck" style="color: var(--accent-cyan);"></i> ROUTING DETAILS</h6>
            <form onsubmit="event.preventDefault(); document.getElementById('chatInput').value='EXECUTE_FINAL_CHECKOUT ' + this.paymentMethod.value; document.getElementById('chatbotForm').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));">
               <input type="text" placeholder="Full Name" required style="width: 100%; background: #111; color: #fff; border: 1px solid rgba(255,255,255,0.1); padding: 12px 15px; border-radius: 8px; margin-bottom: 10px; outline: none;">
               <input type="text" placeholder="123 Fighter St, City" required style="width: 100%; background: #111; color: #fff; border: 1px solid rgba(255,255,255,0.1); padding: 12px 15px; border-radius: 8px; margin-bottom: 10px; outline: none;">
               <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                 <input type="text" placeholder="City" required style="width: 100%; background: #111; color: #fff; border: 1px solid rgba(255,255,255,0.1); padding: 12px 15px; border-radius: 8px; outline: none;">
                 <input type="text" placeholder="Postal Code" required style="width: 100%; background: #111; color: #fff; border: 1px solid rgba(255,255,255,0.1); padding: 12px 15px; border-radius: 8px; outline: none;">
               </div>
               <h6 style="color: #fff; margin-top: 25px; margin-bottom: 15px; font-weight: 800; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px; font-size: 0.9rem; letter-spacing: 1px;"><i class="fas fa-credit-card" style="color: var(--accent-cyan);"></i> PAYMENT PROTOCOL</h6>
               <select name="paymentMethod" style="width: 100%; background: #111; color: #fff; border: 1px solid rgba(255,255,255,0.1); padding: 12px 15px; border-radius: 8px; margin-bottom: 20px; outline: none; font-weight: bold;">
                  <option value="Credit Card">Credit Card</option>
                  <option value="Crypto Transfer">Crypto Transfer</option>
               </select>
               <p style="color: rgba(255,255,255,0.4); font-size: 0.75rem; margin-bottom: 20px; font-weight: bold;"><i class="fas fa-info-circle"></i> Sandbox mode: Processed without actual charging.</p>
               <button type="submit" class="btn-add" style="width: 100%; padding: 15px; border: none; font-weight: 900; font-size: 1rem; cursor: pointer; border-radius: 8px;">CONFIRM TRANSFER ($${total.toFixed(2)})</button>
            </form>
         </div>
      `;

      return res.json({ text: `Secure channel open. Please confirm routing parameters below.<br>${formHtml}` });
    }

    if (intent === "recommend") {
      const products = await Product.aggregate([{ $match: { stock: { $gt: 0 } } }, { $sample: { size: 3 } }]);
      return res.json({ 
        text: "Here are some popular products you might love:", 
        products: products 
      });
    }

    if (intent === "search") {
      let query = { stock: { $gt: 0 } };
      
      const genericTerms = ["all", "all products", "everything", "products", "any"];
      let isGenericSearch = false;
      
      if (analysis.searchTerm && analysis.searchTerm.length >= 2) {
        let term = analysis.searchTerm.toLowerCase().trim();
        if (genericTerms.includes(term)) {
           isGenericSearch = true;
        } else {
          const regex = new RegExp(escapeRegex(analysis.searchTerm), 'i');
          query.$or = [
            { name: regex },
            { department: regex },
            { description: regex }
          ];
        }
      }
      
      const products = await Product.find(query).lean();
      
      let filteredProducts = products;
      if (analysis.maxPrice) {
         filteredProducts = products.filter(p => {
             let pPrice = typeof p.price === 'string' ? Number(p.price.replace(/,/g, '')) : p.price;
             return !isNaN(pPrice) && pPrice <= analysis.maxPrice;
         });
      }
      
      // Cap at 10 to prevent overwhelming the chat UI, but show enough for 'all' queries
      filteredProducts = filteredProducts.slice(0, 10);
      
      if (filteredProducts.length > 0) {
        return res.json({
          text: `I found ${filteredProducts.length} product(s) targeting your search:`,
          products: filteredProducts
        });
      } else {
        return res.json({
          text: `I couldn't find any products matching "${analysis.searchTerm || rawMessage}". Try asking for something else or saying "recommend products".`
        });
      }
    }
    
    return res.json({ text: "I'm a FightFit Assistant! I can help you find products (e.g. 'show gloves under 50'), track your order, or answer FAQs about shipping and returns. How can I help?" });

  } catch (err) {
    console.error(err);
    res.json({ text: "Sorry, I am having trouble connecting to my AI brain right now. Please try again later." });
  }
});

// Autocomplete endpoint for smart search (Leave intact, we don't need AI cost for simple auto-completes)
router.get("/autocomplete", async (req, res) => {
  const q = req.query.q || "";
  if (q.length < 2) return res.json([]);
  
  try {
    const regex = new RegExp(escapeRegex(q), 'i');
    const products = await Product.find({ name: regex }).limit(5).select("name _id");
    res.json(products);
  } catch(e) {
    res.json([]);
  }
});

module.exports = router;

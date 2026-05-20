var express = require("express");
var router = express.Router();
var Product = require("../../models/Product");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const config = require("config");

let genAI = null;
try {
  if (config.has("geminiApiKey") && config.get("geminiApiKey") !== "YOUR_API_KEY_HERE") {
    genAI = new GoogleGenerativeAI(config.get("geminiApiKey"));
  }
} catch (e) {
  console.log("No Gemini API key supplied yet.");
}

// In-memory cache for SEO Generations to avoid redundant API calls and save tokens
const seoCache = new Map();
router.get("/", async (req, res) => {
  let products = await Product.find();
  res.render("super-admin/products/index", { layout: "super-admin-layout", title: "Product Management", products });
});

router.get("/add", async (req, res) => {
  res.render("super-admin/products/add", { layout: "super-admin-layout", title: "Add Product" });
});

router.post("/add", async (req, res) => {
  try {
     let product = new Product(req.body);
     await product.save();
     req.flash("success", "Product successfully added!");
     res.redirect("/super-admin/products");
  } catch(e) {
     req.flash("danger", "Failed to add product");
     res.redirect("/super-admin/products/add");
  }
});

router.get("/edit/:identifier", async (req, res) => {
  try {
     let query = require('mongoose').Types.ObjectId.isValid(req.params.identifier) ? 
                 { _id: req.params.identifier } : 
                 { slug: req.params.identifier };
     let product = await Product.findOne(query);
     if (!product) {
       req.flash("danger", "Product not found!");
       return res.redirect("/super-admin/products");
     }
     res.render("super-admin/products/edit", { layout: "super-admin-layout", title: "Edit Product", product });
  } catch(e) {
     res.redirect("/super-admin/products");
  }
});

router.post("/edit/:identifier", async (req, res) => {
  try {
     let query = require('mongoose').Types.ObjectId.isValid(req.params.identifier) ? 
                 { _id: req.params.identifier } : 
                 { slug: req.params.identifier };
     let product = await Product.findOne(query);
     product.name = req.body.name;
     product.price = req.body.price;
     product.description = req.body.description;
     product.image = req.body.image;
     product.stock = req.body.stock;
     product.seoTags = req.body.seoTags;
     product.metaDetails = req.body.metaDetails;
     product.department = req.body.department;
     
     await product.save();
     req.flash("success", "Product updated.");
     res.redirect("/super-admin/products");
  } catch(e) {
     req.flash("danger", "Failed to update.");
     res.redirect("/super-admin/products");
  }
});

router.get("/delete/:identifier", async (req, res) => {
  try {
     let query = require('mongoose').Types.ObjectId.isValid(req.params.identifier) ? 
                 { _id: req.params.identifier } : 
                 { slug: req.params.identifier };
     await Product.findOneAndDelete(query);
     req.flash("success", "Product deleted.");
     res.redirect("/super-admin/products");
  } catch(e) {
     res.redirect("/super-admin/products");
  }
});

router.post("/generate-seo", async (req, res) => {
  try {
    if (!genAI) {
      return res.status(500).json({ error: "Gemini API key is not configured." });
    }
    const { name, department } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Product name is required" });
    }

    const cacheKey = `${name.toLowerCase()}_${department.toLowerCase()}`;
    if (seoCache.has(cacheKey)) {
      return res.json(seoCache.get(cacheKey));
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = `
      You are an elite, highly creative SEO specialist and copywriter for a GenZ combat sports and fitness e-commerce store called FightFit.
      Your aesthetic is "Neon Brutalist" - intense, high-tech, raw, and premium.
      Please generate optimal SEO tags, a meta details sentence, and an EXTENSIVE product description for the following product.
      
      Product Name: "${name}"
      Department: "${department || 'General'}"
      
      Requirements:
      1. 'description': An extremely comprehensive, unique, and highly detailed product description (approx. 500 - 1500 words). Make it engaging, professional, and do not repeat generic phrases. Format the description with engaging paragraphs, highlighting specs, durability, and performance.
      2. 'seoTags': A comma-separated string of 8-12 highly relevant SEO keywords. IMPORTANT: Keywords must be strictly non-repetitive and unique.
      3. 'metaDetails': A 1-2 sentence compelling tech spec or meta description highlighting the product's likely features for search engines.
      
      Respond ONLY with a valid JSON object, no markdown blocks. Schema:
      {
        "description": "The extensive product description...",
        "seoTags": "tag1, tag2, tag3...",
        "metaDetails": "The meta description..."
      }
    `;

    const aiResult = await model.generateContent(prompt);
    let rawText = aiResult.response.text().replace(/\`\`\`json/gi, '').replace(/\`\`\`/gi, '').trim();
    const data = JSON.parse(rawText);
    
    // Save to cache
    seoCache.set(cacheKey, data);
    
    return res.json(data);
  } catch (err) {
    console.error("SEO Generation Error:", err);
    return res.status(500).json({ error: "AI Error: " + err.message });
  }
});

router.post("/chatbot/message", async (req, res) => {
  try {
    const rawMsg = req.body.message || "";
    const msg = rawMsg.toLowerCase();
    
    // Hardcoded handlers
    if (msg.includes("low stock") || msg.includes("inventory")) {
      const lowStock = await Product.find({ stock: { $lt: 5 } }).limit(5);
      if(lowStock.length === 0) return res.json({ text: "Inventory optimal. No low stock anomalies detected." });
      
      let html = `<div class="ai-admin-card"><h6 style="color:var(--accent-cyan);margin-bottom:10px;"><i class="fas fa-exclamation-triangle"></i> CRITICAL INVENTORY</h6>`;
      lowStock.forEach(p => {
        html += `<div style="display:flex; justify-content:space-between; margin-bottom:5px; border-bottom:1px solid #333; padding-bottom:5px;"><span>${p.name}</span><span style="color:#e63946; font-weight:bold;">${p.stock} left</span></div>`;
      });
      html += `</div>`;
      return res.json({ text: html });
    }
    
    if (msg.includes("order") || msg.includes("sale") || msg.includes("recent")) {
      const Order = require("../../models/Order");
      const orders = await Order.find().sort({ createdAt: -1 }).limit(3);
      if(orders.length === 0) return res.json({ text: "No recent orders detected in grid." });
      
      let html = `<div class="ai-admin-card"><h6 style="color:var(--accent-cyan);margin-bottom:10px;"><i class="fas fa-satellite-dish"></i> RECENT TRANSMISSIONS</h6>`;
      orders.forEach(o => {
        html += `<div style="margin-bottom:8px; border-bottom:1px solid #333; padding-bottom:5px;">
          <div style="color:#aaa; font-size:0.8rem;">${new Date(o.createdAt).toLocaleDateString()}</div>
          <div style="display:flex; justify-content:space-between; gap: 15px;">
            <span style="font-family:monospace;">#${o._id.toString().substring(0,8)}</span>
            <span style="color:#fff; font-weight:bold;">$${parseFloat(o.total_amount).toFixed(2)}</span>
          </div>
          <div style="color:var(--accent-cyan); font-size:0.8rem;">STATUS: ${o.status}</div>
        </div>`;
      });
      html += `</div>`;
      return res.json({ text: html });
    }

    // Dynamic Multi-Turn NLU Logic
    if (!genAI) {
      return res.json({ text: "NLU Core offline. Provide valid manual command." });
    }

    if (!req.session.adminChatHistory) {
      req.session.adminChatHistory = [];
    }
    
    req.session.adminChatHistory.push({ role: "user", parts: [{ text: rawMsg }] });
    
    // Keep history manageable
    if(req.session.adminChatHistory.length > 10) {
       req.session.adminChatHistory = req.session.adminChatHistory.slice(-10);
    }

    const prompt = `
      You are the elite "FightFit Admin AI". You help the admin manage the e-commerce database.
      Analyze the conversation history and the latest message.
      Your goal is to parse intents like "ADD_PRODUCT" and "UPDATE_STOCK".
      
      If the user wants to ADD a product, you MUST explicitly collect all of these: name, price, stock, department (Data Node), and image (Visual Source URL).
      If ANY of these 5 fields (name, price, stock, department, image) are missing, respond with "action": null and explicitly ask the user for the missing fields directly in the "reply".
      If ALL 5 fields are present, ask for confirmation (e.g. "Are you sure you want to add X for $Y in department Z?"). If they confirm (say yes/sure/proceed), then return "action": "EXECUTE_ADD_PRODUCT" and the fields in "payload".
      
      If the user wants to UPDATE a product (e.g. update stock, update price, change image), collect the product name and the specific fields they want to update. Ask what they want to update if it's not clear. Ask for confirmation once the changes are specified. If confirmed, return "action": "EXECUTE_UPDATE_PRODUCT" and the payload containing the "name" and ONLY the fields being updated.
      
      Respond ONLY with a valid JSON object matching this schema:
      {
        "reply": "The natural language response to the admin, asking for missing info, confirming, or acknowledging.",
        "action": "EXECUTE_ADD_PRODUCT" | "EXECUTE_UPDATE_PRODUCT" | null,
        "payload": {
           "name": "string",
           "price": 100,
           "stock": 5,
           "department": "string",
           "image": "url string"
        }
      }
    `;

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      systemInstruction: String(prompt)
    });

    // Ensure strict alternation of user/model for Gemini
    let validContents = [];
    let lastRole = null;
    for (let msg of req.session.adminChatHistory) {
        if (msg.role !== lastRole) {
            validContents.push(msg);
            lastRole = msg.role;
        } else {
            // Replace the last message of the same role instead of failing
            validContents[validContents.length - 1] = msg;
        }
    }

    const aiResult = await model.generateContent({
      contents: validContents
    });
    
    let jsonText = aiResult.response.text().replace(/\`\`\`json/gi, '').replace(/\`\`\`/gi, '').trim();
    let data;
    try {
       data = JSON.parse(jsonText);
    } catch(e) {
       return res.json({ text: "System failed to parse NLU matrix." });
    }

    req.session.adminChatHistory.push({ role: "model", parts: [{ text: data.reply }] });

    if (data.action === "EXECUTE_ADD_PRODUCT" && data.payload) {
        // Automatically generate SEO in background
        const seoPrompt = `Generate a 500-1000 word description, 8-12 comma separated seoTags, and a metaDetails sentence for product "${data.payload.name}" in department "${data.payload.department}". Format as JSON with keys: description, seoTags, metaDetails.`;
        let seoData = { description: "", seoTags: "", metaDetails: "" };
        try {
           const seoResult = await model.generateContent(seoPrompt);
           seoData = JSON.parse(seoResult.response.text().replace(/\`\`\`json/gi, '').replace(/\`\`\`/gi, '').trim());
        } catch(e) {}
        
        let newProd = new Product({
           name: data.payload.name,
           price: data.payload.price || 0,
           stock: data.payload.stock || 0,
           department: data.payload.department || "General",
           image: data.payload.image || "",
           description: seoData.description,
           seoTags: seoData.seoTags,
           metaDetails: seoData.metaDetails
        });
        await newProd.save();
        req.session.adminChatHistory = []; // clear context
        return res.json({ text: `<div class="ai-admin-card"><h6 style="color:var(--accent-cyan);"><i class="fas fa-check"></i> ASSET DEPLOYED</h6>Product <b>${newProd.name}</b> added with auto-generated SEO.</div>` });
    }
    
    if (data.action === "EXECUTE_UPDATE_PRODUCT" && data.payload) {
        const prod = await Product.findOne({ name: new RegExp(data.payload.name, 'i') });
        if(prod) {
           let updateHtml = `<div class="ai-admin-card"><h6 style="color:var(--accent-cyan);"><i class="fas fa-check"></i> ASSET UPDATED: ${prod.name}</h6><ul>`;
           
           if(data.payload.price !== undefined) { prod.price = data.payload.price; updateHtml += `<li>Price updated to $${prod.price}</li>`; }
           if(data.payload.stock !== undefined) { prod.stock = data.payload.stock; updateHtml += `<li>Stock updated to ${prod.stock}</li>`; }
           if(data.payload.department !== undefined) { prod.department = data.payload.department; updateHtml += `<li>Department updated to ${prod.department}</li>`; }
           if(data.payload.image !== undefined && data.payload.image !== "") { prod.image = data.payload.image; updateHtml += `<li>Visual Source URL updated</li>`; }
           
           await prod.save();
           req.session.adminChatHistory = [];
           updateHtml += `</ul></div>`;
           return res.json({ text: updateHtml });
        } else {
           return res.json({ text: "Cannot locate that asset in the database to update." });
        }
    }

    return res.json({ text: data.reply });
  } catch (err) {
    console.error("CHATBOT CRASH:", err);
    req.session.adminChatHistory = []; // Reset history to break death loops
    if (err.message && (err.message.includes("429") || err.message.toLowerCase().includes("quota"))) {
        return res.status(500).json({ text: `<div class="ai-admin-card"><h6 style="color:#ff0055;"><i class="fas fa-exclamation-circle"></i> AI CORE OVERLOADED</h6><p class="m-0 text-muted">The Neural Network has hit its request limit (Rate Limit 429). Please wait 30 seconds before sending another command.</p></div>` });
    }
    return res.status(500).json({ text: `SYSTEM ERROR: ${err.message}` });
  }
});

module.exports = router;

const { GoogleGenerativeAI } = require('@google/generative-ai');
const config = require('config');
const genAI = new GoogleGenerativeAI(config.get('geminiApiKey'));

async function test() {
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
      systemInstruction: prompt
    });

    let validContents = [{ role: 'user', parts: [{ text: 'update MMA Training Shorts' }] }];
    
    try {
        const aiResult = await model.generateContent({ contents: validContents });
        console.log(aiResult.response.text());
    } catch (e) {
        console.error("CAUGHT:", e.message);
    }
}
test();

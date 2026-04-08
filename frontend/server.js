require("dotenv").config();
const express = require("express");
const PocketBase = require("pocketbase/cjs");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 3000;


app.use(express.static("public"));

const PB_ADMIN_EMAIL = process.env.PB_EMAIL;
const PB_ADMIN_PASSWORD = process.env.PB_PASSWORD;
const PB_URL = process.env.POCKETBASE_URL;

const pb = new PocketBase(PB_URL);


app.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error("Webhook Error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.client_reference_id;

    if (userId) {
      try {

        await pb.collection("_superusers").authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
        await pb.collection("users").update(userId, { is_pro: true });
        console.log(`User ${userId} upgraded to PRO`);
      } catch (e) {
        console.error("Pocketbase update error:", e);
      }
    }
  }

  res.json({ received: true });
});


app.use(express.json());

app.post("/api/apply-pro", async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "No userId provided" });
  }

  try {

    await pb.collection("_superusers").authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
    await pb.collection("users").update(userId, { is_pro: true });
    res.json({ success: true });
  } catch (err) {
    console.error("Pro upgrade error:", err.message);
    res.status(500).json({ error: err.message });
  }
});


app.get("/api/admin/users", async (req, res) => {
  try {
    await pb.collection("_superusers").authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD);
    const records = await pb.collection("users").getFullList({ sort: "-created" });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

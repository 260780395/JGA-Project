require("dotenv").config();

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const mysql = require("mysql2/promise");
const rateLimit = require("express-rate-limit");
const nodemailer = require("nodemailer");

const app = express();
const port = Number(process.env.PORT || 3001);
const production = process.env.NODE_ENV === "production";
if (production && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
  throw new Error("Set SESSION_SECRET to a random value of at least 32 characters in production.");
}
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_NAME || "kasi_crunch",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  ssl: process.env.DB_SSL === "true" ? {} : undefined,
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4",
});
const sessionStore = new MySQLStore({}, pool);

const menuSeed = [
  ["crunch-classic", "The Kasi Classic", "Crispy chicken, slaw, pickles and our signature sauce in a toasted bun.", 82, "Burgers", "photo-1568901346375-23c9450c58cd", false],
  ["double-trouble", "Double Trouble", "Two flame-grilled patties, melted cheese, caramelised onion and smoky sauce.", 109, "Burgers", "photo-1553979459-d2229ba7433a", false],
  ["spicy-crunch", "Spicy Crunch Burger", "Golden crunchy chicken, fresh lettuce and a proper peri-peri kick.", 89, "Burgers", "photo-1606755962773-d324e0a13086", false],
  ["classic-combo", "Kasi Classic Combo", "The Kasi Classic with a serving of fries and your choice of cool drink.", 119, "Meal Combos", "photo-1568901346375-23c9450c58cd", true],
  ["double-combo", "Double Trouble Combo", "Two flame-grilled patties with fries and your choice of cool drink.", 149, "Meal Combos", "photo-1553979459-d2229ba7433a", true],
  ["spicy-combo", "Spicy Crunch Combo", "A spicy chicken burger, fries and your choice of cool drink.", 129, "Meal Combos", "photo-1606755962773-d324e0a13086", true],
  ["street-wings", "Street Wings", "Six smoky wings tossed in your choice of house sauce.", 76, "Chicken", "photo-1527477396000-e27163b481c2", false],
  ["crunch-box", "Kasi Crunch Box Meal", "Crispy chicken pieces with fries, creamy slaw, a soft roll and your choice of cool drink.", 139, "Meal Combos", "photo-1626082927389-6cd097cdc6ec", true],
  ["wing-combo", "Street Wings Combo", "Six house-sauced wings served with fries and your choice of cool drink.", 119, "Meal Combos", "photo-1527477396000-e27163b481c2", true],
  ["classic-fries", "Hand-Cut Fries", "Golden, lightly seasoned fries, cooked until crisp.", 29, "Sides", "photo-1573080496219-bb080dd4f877", false],
  ["loaded-chips", "Loaded Township Chips", "Skin-on chips with cheese sauce, jalapeños and house seasoning.", 64, "Sides", "photo-1573080496219-bb080dd4f877", false],
  ["mac-cheese", "Mac & Cheese Bites", "Six cheesy, golden bites with a cool ranch dip.", 52, "Sides", "photo-1485963631004-f2f00b1d6606", false],
  ["chicken-pie", "Golden Chicken Pie", "A flaky pastry filled with savoury chicken and a gently spiced gravy.", 32, "Pies", "photo-1509440159596-0249088772ff", false],
  ["pepper-pie", "Pepper Steak Pie", "A crisp, golden pastry filled with a savoury, peppery filling.", 36, "Pies", "photo-1509440159596-0249088772ff", false],
  ["braai-roll", "Braai Chicken Roll", "Seasoned chicken, crunchy slaw and tangy house sauce in a soft roll.", 59, "Rolls", "photo-1539252554453-80ab65ce3586", false],
  ["spicy-roll", "Chilli Crunch Roll", "Crispy chicken, fresh greens and a lively chilli dressing in a toasted roll.", 62, "Rolls", "photo-1539252554453-80ab65ce3586", false],
  ["ice-cream-small", "Vanilla Ice Cream · Small", "A small cup of smooth vanilla ice cream.", 22, "Ice Cream", "photo-1501446529957-6226bd447c46", false],
  ["ice-cream-regular", "Vanilla Ice Cream · Regular", "A regular cup of smooth vanilla ice cream.", 32, "Ice Cream", "photo-1501446529957-6226bd447c46", false],
  ["ice-cream-large", "Vanilla Ice Cream · Large", "A large cup of smooth vanilla ice cream.", 42, "Ice Cream", "photo-1501446529957-6226bd447c46", false],
  ["choco-shake", "Choc-O-Block Shake", "Thick chocolate shake blended fresh and topped with a little extra.", 48, "Drinks", "photo-1572490122747-3968b75cc699", false],
  ["lemonade", "House Lemonade", "Fresh, zesty lemonade. The perfect sidekick to the heat.", 32, "Drinks", "photo-1513558161293-cdadcf081c75", false],
  ["guava-juice", "Guava Cooler", "A chilled, fruity guava drink.", 28, "Drinks", "photo-1513558161293-cdadcf081c75", false],
  ["coke", "Coke", "A chilled Coke.", 25, "Drinks", "photo-1544145945-f90425340c7e", false],
  ["sprite", "Sprite", "A chilled Sprite.", 25, "Drinks", "photo-1544145945-f90425340c7e", false],
  ["pepsi", "Pepsi", "A chilled Pepsi.", 25, "Drinks", "photo-1544145945-f90425340c7e", false],
  ["still-water", "Still Water", "A bottle of refreshing still water.", 20, "Drinks", "photo-1548839140-29a749e1cf4d", false],
];

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function requireUser(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Please sign in to continue." });
  next();
}

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function establishSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) return reject(error);
      req.session.user = user;
      req.session.save((saveError) => saveError ? reject(saveError) : resolve());
    });
  });
}

function emailTransport() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

async function initializeDatabase() {
  const schema = fs.readFileSync(path.join(__dirname, "sql", "schema.sql"), "utf8");
  for (const statement of schema.split(/;\s*(?:\r?\n|$)/).filter((sql) => sql.trim())) {
    await pool.query(statement);
  }

  for (const [id, name, description, price, category, imageId, isMeal] of menuSeed) {
    await pool.query(
      `INSERT INTO menu_items (id, name, description, price_cents, category, image_id, is_meal)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         description = VALUES(description),
         price_cents = VALUES(price_cents),
         category = VALUES(category),
         image_id = VALUES(image_id),
         is_meal = VALUES(is_meal)`,
      [id, name, description, price * 100, category, imageId, isMeal],
    );
  }
}

app.set("trust proxy", 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "https://images.unsplash.com", "data:"],
      connectSrc: ["'self'"],
      upgradeInsecureRequests: production ? [] : null,
    },
  },
}));
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ extended: false, limit: "20kb" }));
app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || "local-development-only-change-this-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again in a little while." },
});

app.get("/api/health", asyncRoute(async (_req, res) => {
  await pool.query("SELECT 1");
  res.json({ status: "ok" });
}));

app.get("/api/menu", asyncRoute(async (_req, res) => {
  const [rows] = await pool.query(
    "SELECT id, name, description, price_cents, category, image_id, is_meal FROM menu_items WHERE available = TRUE ORDER BY category, id",
  );
  res.json(rows);
}));

app.get("/api/session", (req, res) => {
  res.json({ user: req.session.user || null });
});

app.post("/api/auth/signup", authLimiter, asyncRoute(async (req, res) => {
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const email = normalizeEmail(req.body.email);
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (name.length < 2 || name.length > 80) return res.status(400).json({ error: "Enter your name (2–80 characters)." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (password.length < 10 || password.length > 128) {
    return res.status(400).json({ error: "Use a password between 10 and 128 characters." });
  }
  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const [result] = await pool.query(
      "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
      [name, email, passwordHash],
    );
    const [userRows] = await pool.query(
      "SELECT id, name, email FROM users WHERE id = ?",
      [result.insertId],
    );
    await establishSession(req, userRows[0]);
    res.status(201).json({ user: userRows[0] });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "An account with that email already exists." });
    throw error;
  }
}));

app.post("/api/auth/login", authLimiter, asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const [rows] = await pool.query(
    "SELECT id, name, email, password_hash FROM users WHERE email = ?",
    [email],
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Email or password is incorrect." });
  }
  const sessionUser = { id: user.id, name: user.name, email: user.email };
  await establishSession(req, sessionUser);
  res.json({ user: sessionUser });
}));

app.post("/api/auth/logout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);
    res.clearCookie("connect.sid", { httpOnly: true, secure: production, sameSite: "lax" });
    res.status(204).end();
  });
});

app.post("/api/auth/forgot-password", authLimiter, asyncRoute(async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  const transport = emailTransport();
  if (!transport) {
    return res.status(503).json({ error: "Password reset email is not configured yet. Please contact the restaurant." });
  }
  const [rows] = await pool.query("SELECT id, email FROM users WHERE email = ?", [email]);
  if (rows[0]) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    await pool.query("DELETE FROM password_reset_tokens WHERE user_id = ?", [rows[0].id]);
    await pool.query(
      "INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))",
      [tokenHash, rows[0].id],
    );
    const baseUrl = process.env.APP_BASE_URL || `${req.protocol}://${req.get("host")}`;
    const resetUrl = new URL(`/reset-password?token=${rawToken}`, baseUrl).toString();
    await transport.sendMail({
      from: process.env.EMAIL_FROM || "Kasi - Crunch <no-reply@example.com>",
      to: rows[0].email,
      subject: "Reset your Kasi - Crunch password",
      text: `Use this link to reset your password. It expires in 30 minutes:\n\n${resetUrl}`,
      html: `<p>Use the link below to reset your password. It expires in 30 minutes.</p><p><a href="${resetUrl}">Reset password</a></p>`,
    });
  }
  res.json({ message: "If an account exists for that email, a reset link is on its way." });
}));

app.post("/api/auth/reset-password", authLimiter, asyncRoute(async (req, res) => {
  const token = typeof req.body.token === "string" ? req.body.token : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  if (!/^[a-f0-9]{64}$/.test(token)) return res.status(400).json({ error: "This reset link is invalid or expired." });
  if (password.length < 10 || password.length > 128) {
    return res.status(400).json({ error: "Use a password between 10 and 128 characters." });
  }
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const passwordHash = await bcrypt.hash(password, 12);
  const [updateResult] = await pool.query(
    `UPDATE users SET password_hash = ?
     WHERE id = (SELECT user_id FROM password_reset_tokens WHERE token_hash = ? AND expires_at > NOW())`,
    [passwordHash, tokenHash],
  );
  if (!updateResult.affectedRows) return res.status(400).json({ error: "This reset link is invalid or expired." });
  await pool.query("DELETE FROM password_reset_tokens WHERE token_hash = ?", [tokenHash]);
  res.json({ message: "Password updated. You can now sign in." });
}));

app.post("/api/orders", requireUser, asyncRoute(async (req, res) => {
  const fulfillment = req.body.fulfillment;
  const customerName = typeof req.body.customerName === "string" ? req.body.customerName.trim() : "";
  const phone = typeof req.body.phone === "string" ? req.body.phone.trim() : "";
  const address = typeof req.body.address === "string" ? req.body.address.trim() : "";
  const distance = Number(req.body.distanceKm);
  const items = req.body.items;
  if (!["delivery", "collection"].includes(fulfillment)) return res.status(400).json({ error: "Choose delivery or collection." });
  if (customerName.length < 2 || customerName.length > 80) return res.status(400).json({ error: "Enter your name." });
  if (phone.length < 7 || phone.length > 30) return res.status(400).json({ error: "Enter a valid contact number." });
  if (fulfillment === "delivery" && (address.length < 8 || address.length > 300)) {
    return res.status(400).json({ error: "Enter your full delivery address." });
  }
  if (fulfillment === "delivery" && (!Number.isFinite(distance) || distance <= 0 || distance > 250)) {
    return res.status(400).json({ error: "Enter a delivery distance between 0.1 and 250 km." });
  }
  if (!Array.isArray(items) || items.length < 1 || items.length > 30) {
    return res.status(400).json({ error: "Your basket is empty or too large." });
  }

  const quantities = new Map();
  const drinks = new Map();
  const itemsMissingDrink = new Set();
  for (const item of items) {
    if (!item || typeof item.id !== "string" || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) {
      return res.status(400).json({ error: "One or more basket items are invalid." });
    }
    if (item.drink !== undefined && !["Coke", "Sprite", "Pepsi"].includes(item.drink)) {
      return res.status(400).json({ error: "Choose Coke, Sprite or Pepsi as your meal drink." });
    }
    if (item.drink !== undefined && drinks.has(item.id) && drinks.get(item.id) !== item.drink) {
      return res.status(400).json({ error: "Choose one cool drink for each meal item." });
    }
    if (item.drink !== undefined) drinks.set(item.id, item.drink);
    else itemsMissingDrink.add(item.id);
    quantities.set(item.id, (quantities.get(item.id) || 0) + item.quantity);
  }
  if ([...quantities.values()].some((quantity) => quantity > 20)) {
    return res.status(400).json({ error: "You can order up to 20 of each item." });
  }

  const client = await pool.getConnection();
  try {
    await client.beginTransaction();
    const ids = [...quantities.keys()];
    const [products] = await client.query(
      "SELECT id, name, price_cents, is_meal FROM menu_items WHERE available = TRUE AND id IN (?)",
      [ids],
    );
    if (products.length !== ids.length) {
      await client.rollback();
      return res.status(400).json({ error: "A menu item is no longer available. Please refresh your basket." });
    }
    if (products.some((product) => product.is_meal && (!drinks.has(product.id) || itemsMissingDrink.has(product.id)))) {
      await client.rollback();
      return res.status(400).json({ error: "Choose a cool drink for every meal." });
    }
    if (products.some((product) => !product.is_meal && drinks.has(product.id))) {
      await client.rollback();
      return res.status(400).json({ error: "A drink choice can only be added to a meal." });
    }
    const subtotal = products.reduce((sum, product) => sum + product.price_cents * quantities.get(product.id), 0);
    const distanceKm = fulfillment === "delivery" ? Math.round(distance * 100) / 100 : 0;
    const deliveryFee = fulfillment === "delivery" ? Math.round(distanceKm * 1600) : 0;
    const orderNumber = `KC-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
    const [orderResult] = await client.query(
      `INSERT INTO orders
        (user_id, order_number, fulfillment, customer_name, phone, delivery_address, distance_km, subtotal_cents, delivery_fee_cents, total_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.session.user.id, orderNumber, fulfillment, customerName, phone, fulfillment === "delivery" ? address : null, distanceKm, subtotal, deliveryFee, subtotal + deliveryFee],
    );
    const [orderRows] = await client.query(
      "SELECT id, order_number, total_cents, status, created_at FROM orders WHERE id = ?",
      [orderResult.insertId],
    );
    for (const product of products) {
      await client.query(
        "INSERT INTO order_items (order_id, menu_item_id, item_name, unit_price_cents, quantity, drink_choice) VALUES (?, ?, ?, ?, ?, ?)",
        [orderRows[0].id, product.id, product.name, product.price_cents, quantities.get(product.id), drinks.get(product.id) || null],
      );
    }
    await client.commit();
    res.status(201).json({ order: { ...orderRows[0], subtotal_cents: subtotal, delivery_fee_cents: deliveryFee } });
  } catch (error) {
    await client.rollback();
    throw error;
  } finally {
    client.release();
  }
}));

app.get("/api/orders", requireUser, asyncRoute(async (req, res) => {
  const [orders] = await pool.query(
    `SELECT o.id, o.order_number, o.fulfillment, o.total_cents, o.status, o.created_at,
            oi.item_name AS name, oi.quantity, oi.drink_choice AS drink
     FROM (
       SELECT id, order_number, fulfillment, total_cents, status, created_at
       FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
     ) o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     ORDER BY o.created_at DESC, oi.id`,
    [req.session.user.id],
  );
  const groupedOrders = new Map();
  for (const order of orders) {
    if (!groupedOrders.has(order.id)) {
      groupedOrders.set(order.id, {
        id: order.id,
        order_number: order.order_number,
        fulfillment: order.fulfillment,
        total_cents: order.total_cents,
        status: order.status,
        created_at: order.created_at,
        items: [],
      });
    }
    if (order.name !== null) {
      groupedOrders.get(order.id).items.push({
        name: order.name,
        quantity: order.quantity,
        drink: order.drink,
      });
    }
  }
  res.json([...groupedOrders.values()].slice(0, 20));
}));

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API endpoint not found." });
});

app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.use((error, _req, res, _next) => {
  console.error("Request failed:", error);
  if (res.headersSent) return;
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

Promise.all([initializeDatabase(), sessionStore.onReady()])
  .then(() => app.listen(port, () => console.log(`Kasi - Crunch is listening on port ${port}`)))
  .catch((error) => {
    console.error("Could not initialize MySQL:", error);
    process.exit(1);
  });

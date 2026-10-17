# Kasi - Crunch

A responsive online ordering website for Kasi - Crunch, built with Express and MySQL. It includes customer accounts, email password resets, a seeded menu, delivery/collection checkout, persisted orders and sessions, and a Render blueprint for connecting to an externally hosted MySQL database. Render provides HTTPS automatically for deployed web services.

## Run locally

1. Install Node.js 20 or newer and MySQL Server.
2. In the MySQL command-line client, create the app database and a dedicated local user (replace the example password with your own):

   ```sql
   CREATE DATABASE kasi_crunch CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'kasi_crunch'@'localhost' IDENTIFIED BY 'choose-a-local-password';
   GRANT ALL PRIVILEGES ON kasi_crunch.* TO 'kasi_crunch'@'localhost';
   ```

3. Copy `.env.example` to `.env` and set `DB_PASSWORD` to the password you chose and `SESSION_SECRET` to a unique, random value. In PowerShell, copy the template with `Copy-Item .env.example .env`.
4. Open PowerShell in the project folder, install packages, and start the app:

   ```powershell
   npm.cmd install
   npm.cmd run dev
   ```

5. Open `http://localhost:3001` in your browser. Do not open `public/index.html` directly as a `file:///` page: account, menu and order requests require the app server. The default port is 3001 to avoid conflicts with software using port 3000.

The app applies [`sql/schema.sql`](./sql/schema.sql), creates its MySQL session table, and seeds the menu when it starts. Password reset requires SMTP settings (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`). Without them, the reset endpoint clearly reports that email is not configured.

## Deploy to Render

1. Push this project to a GitHub repository and connect it to Render.
2. Choose **New + > Blueprint** and select the repository containing `render.yaml`.
3. Provide `DB_HOST`, `DB_NAME`, `DB_USER`, and `DB_PASSWORD` for a reachable external MySQL 8-compatible database. The database provider must allow connections from Render; set `DB_SSL` according to its TLS requirements.
4. Set `APP_BASE_URL` to the HTTPS URL Render assigns to the web service.
5. Add your SMTP settings as private environment variables in Render to enable password reset emails.
6. Deploy. Render provides HTTPS for the public service URL; the MySQL database is hosted separately.

Review hosting and database pricing before deploying. Never expose database credentials in source control.

## Ordering and delivery

Customers can create accounts, sign in, reset passwords by email, browse the menu, place delivery or collection orders, and view recent orders. Meal combos include fries and a choice of Coke, Sprite or Pepsi; the choice is saved with each order line. The original Kasi - Crunch menu includes burgers, chicken combos, sides, pies, rolls, several ice cream sizes, shakes and other drinks. Displayed prices are draft prices and must be confirmed before launch; they are not comparisons with other restaurants. Order totals and menu prices are calculated and validated on the server. Collection is free. Delivery is calculated as `R16 times estimated kilometres`; because the restaurant address and a routing/maps provider have not yet been selected, the customer enters the estimated distance at checkout. The distance is stored with the order.

Online payment is not enabled yet. Checkout supports payment on delivery or at collection; select a payment gateway and configure it before accepting online payments.

## Security notes

- Passwords are hashed with bcrypt; reset tokens are random, stored as hashes, and expire after 30 minutes.
- Authentication endpoints are rate-limited; session cookies are HTTP-only and secure in production.
- Database values from requests use parameterized MySQL queries; do not build SQL by concatenating user input. The browser HTML, CSS, and JavaScript do not connect to MySQL directly.
- Never commit `.env` or paste SMTP, database, or payment credentials into source control.

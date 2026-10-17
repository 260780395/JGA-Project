const state = { menu: [], category: "All", cart: new Map(), user: null, authMode: "login" };
const $ = (selector) => document.querySelector(selector);
const money = (cents) => new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(cents / 100);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]));

async function api(url, options = {}) {
  if (location.protocol === "file:") {
    throw new Error("This page is open as a local file. Start the app with npm run dev, then visit http://localhost:3001. Sign-up requires the app server and MySQL database.");
  }
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
    });
  } catch {
    throw new Error("Can't reach the Kasi - Crunch app server. Start it with npm run dev and check that MySQL is running.");
  }
  let payload = null;
  if (response.status !== 204) {
    const body = await response.text();
    try {
      payload = body ? JSON.parse(body) : null;
    } catch {
      const contentType = response.headers.get("content-type") || "an unknown content type";
      throw new Error(`The API returned ${response.status} with ${contentType} instead of JSON. This address may be serving another app. Start Kasi - Crunch and open http://localhost:3001.`);
    }
  }
  if (!response.ok) throw new Error(payload?.error || "That didn't work. Please try again.");
  return payload;
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("toast-visible");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => el.classList.remove("toast-visible"), 3000);
}

function renderCategories() {
  const categories = ["All", ...new Set(state.menu.map((item) => item.category))];
  $("#category-list").innerHTML = categories.map((category) =>
    `<button class="category-chip${category === state.category ? " active" : ""}" data-category="${escapeHtml(category)}" type="button">${escapeHtml(category)}</button>`,
  ).join("");
}

function renderMenu() {
  const items = state.menu.filter((item) => state.category === "All" || item.category === state.category);
  $("#menu-grid").innerHTML = items.map((item) => {
    const quantity = state.cart.get(item.id)?.quantity || 0;
    return `<article class="menu-card">
      <div class="menu-image"><img src="https://images.unsplash.com/${encodeURIComponent(item.image_id)}?auto=format&fit=crop&w=700&q=80" alt="${escapeHtml(item.name)}" loading="lazy"><span class="menu-category">${escapeHtml(item.category)}</span><span class="menu-number">0${state.menu.indexOf(item) + 1}</span></div>
      <div class="menu-card-body"><div class="menu-card-title"><h3>${escapeHtml(item.name)}</h3><strong>${money(item.price_cents)}</strong></div><p>${escapeHtml(item.description)}</p>
      ${item.is_meal ? '<span class="meal-includes">FRIES + COKE, SPRITE OR PEPSI INCLUDED · CHOOSE IN BASKET</span>' : ""}
      <button class="add-button${quantity ? " added" : ""}" data-add="${escapeHtml(item.id)}" type="button">${quantity ? `IN YOUR BASKET · ${quantity}` : item.is_meal ? "ADD MEAL TO BASKET" : "ADD TO BASKET"} <span aria-hidden="true">${quantity ? "+" : "↗"}</span></button></div>
    </article>`;
  }).join("") || '<p class="loading-card">No items in this category just yet.</p>';
}

function cartTotals() {
  let subtotal = 0;
  for (const [id, cartItem] of state.cart) {
    const product = state.menu.find((item) => item.id === id);
    if (product) subtotal += product.price_cents * cartItem.quantity;
  }
  return subtotal;
}

function renderCart() {
  const count = [...state.cart.values()].reduce((sum, cartItem) => sum + cartItem.quantity, 0);
  $("#basket-count").textContent = count;
  $("#panel-count").textContent = count ? ` (${count})` : "";
  $("#basket-empty").hidden = count > 0;
  $("#basket-summary").hidden = count === 0;
  $("#basket-subtotal").textContent = money(cartTotals());
  $("#basket-items").innerHTML = [...state.cart.entries()].map(([id, cartItem]) => {
    const product = state.menu.find((item) => item.id === id);
    if (!product) return "";
    return `<article class="basket-item"><img src="https://images.unsplash.com/${encodeURIComponent(product.image_id)}?auto=format&fit=crop&w=180&q=70" alt=""><div class="basket-item-info"><h3>${escapeHtml(product.name)}</h3><span>${money(product.price_cents)}</span>${product.is_meal ? `<label class="drink-choice">Included drink<select data-drink="${escapeHtml(id)}"><option${cartItem.drink === "Coke" ? " selected" : ""}>Coke</option><option${cartItem.drink === "Sprite" ? " selected" : ""}>Sprite</option><option${cartItem.drink === "Pepsi" ? " selected" : ""}>Pepsi</option></select></label>` : ""}<div class="quantity-control"><button data-quantity="${escapeHtml(id)}" data-delta="-1" aria-label="Remove one ${escapeHtml(product.name)}">−</button><span>${cartItem.quantity}</span><button data-quantity="${escapeHtml(id)}" data-delta="1" aria-label="Add one ${escapeHtml(product.name)}">+</button></div></div><strong>${money(product.price_cents * cartItem.quantity)}</strong></article>`;
  }).join("");
  renderMenu();
  updateCheckoutTotals();
}

function updateCheckoutTotals() {
  const subtotal = cartTotals();
  const fulfillment = new FormData($("#checkout-form")).get("fulfillment");
  const km = Number($("#checkout-form").elements.distanceKm?.value || 0);
  const fee = fulfillment === "delivery" && Number.isFinite(km) ? Math.round(Math.round(km * 100) * 16) : 0;
  $("#checkout-subtotal").textContent = money(subtotal);
  $("#checkout-delivery").textContent = money(fee);
  $("#checkout-total").textContent = money(subtotal + fee);
}

function setUser(user) {
  state.user = user;
  $("#account-button").textContent = user ? `Hi, ${user.name.split(" ")[0]}` : "Sign in";
  $("#auth-title").innerHTML = user ? `Hey, <em>${escapeHtml(user.name.split(" ")[0])}.</em>` : "Welcome <em>back.</em>";
  $("#auth-intro").textContent = user ? "Your Kasi - Crunch account." : "Sign in to place your order and keep track of the good stuff.";
  $("#auth-form").hidden = Boolean(user);
  $("#auth-links").hidden = Boolean(user);
  $("#account-actions").hidden = !user;
}

function showAuthNotice(message, error = false) {
  const notice = $("#auth-notice");
  notice.textContent = message;
  notice.className = `notice${error ? " notice-error" : ""}`;
  notice.hidden = false;
}

function setAuthMode(mode) {
  state.authMode = mode;
  $("#auth-notice").hidden = true;
  $("#name-field").hidden = mode !== "signup";
  $("#name-field").querySelector("input").required = mode === "signup";
  $("#email-field").hidden = mode === "reset";
  $("#auth-form").elements.email.required = mode !== "reset";
  $("#password-field").hidden = mode === "forgot" || mode === "reset";
  $("#reset-password-field").hidden = mode !== "reset";
  $("#auth-title").innerHTML = {
    login: "Welcome <em>back.</em>",
    signup: "Join the <em>good side.</em>",
    forgot: "Forgot your <em>password?</em>",
    reset: "Pick a <em>new password.</em>",
  }[mode];
  $("#auth-intro").textContent = {
    login: "Sign in to place your order and keep track of the good stuff.",
    signup: "Create an account and make your next order a little easier.",
    forgot: "Enter your email and we'll send a password reset link if an account exists.",
    reset: "Choose a new password to get back to the good stuff.",
  }[mode];
  $("#auth-submit").innerHTML = {
    login: "SIGN IN <span aria-hidden=\"true\">↗</span>",
    signup: "CREATE MY ACCOUNT <span aria-hidden=\"true\">↗</span>",
    forgot: "SEND RESET LINK <span aria-hidden=\"true\">↗</span>",
    reset: "UPDATE PASSWORD <span aria-hidden=\"true\">↗</span>",
  }[mode];
  $("#auth-links").hidden = mode === "reset";
  $("#auth-links").innerHTML = {
    login: '<button type="button" data-auth-mode="forgot">Forgot your password?</button><span>New around here? <button type="button" data-auth-mode="signup">Create an account</button></span>',
    signup: '<span>Already have an account? <button type="button" data-auth-mode="login">Sign in</button></span>',
    forgot: '<button type="button" data-auth-mode="login">← Back to sign in</button>',
    reset: "",
  }[mode];
  $("#auth-form").hidden = false;
  $("#account-actions").hidden = true;
  $("#auth-form").elements.password.required = mode === "login" || mode === "signup";
  $("#auth-form").elements.newPassword.required = mode === "reset";
}

async function loadOrders() {
  const orders = await api("/api/orders");
  $("#orders-list").innerHTML = orders.length ? orders.map((order) =>
    `<article class="order-history"><div><strong>${escapeHtml(order.order_number)}</strong><span>${new Date(order.created_at).toLocaleDateString("en-ZA")} · ${escapeHtml(order.fulfillment)}</span></div><strong>${money(order.total_cents)}</strong><p>${order.items.map((item) => `${escapeHtml(item.quantity)} × ${escapeHtml(item.name)}${item.drink ? ` (drink: ${escapeHtml(item.drink)})` : ""}`).join(" · ")}</p><span class="order-status">${escapeHtml(order.status)}</span></article>`,
  ).join("") : '<p class="empty-orders">No orders yet. Your first favourite is waiting.</p>';
}

function setBasketOpen(open) {
  $("#basket-panel").classList.toggle("basket-open", open);
  $("#basket-panel").setAttribute("aria-hidden", String(!open));
  $("#scrim").classList.toggle("scrim-visible", open);
  document.body.classList.toggle("no-scroll", open);
}

async function initialize() {
  $("#year").textContent = new Date().getFullYear();
  if (location.protocol === "file:") {
    $("#runtime-warning").innerHTML = '<strong>Preview mode only.</strong> Sign-up, sign-in, menu loading, and orders require the app server and MySQL. Run <code>npm.cmd install</code> and <code>npm.cmd run dev</code> from the project folder, then open <code>http://localhost:3001</code>.';
    $("#runtime-warning").hidden = false;
    $("#menu-grid").innerHTML = '<p class="loading-card error-card">The menu will load when the app is running at http://localhost:3001.</p>';
    return;
  }
  try {
    const [menu, sessionData] = await Promise.all([api("/api/menu"), api("/api/session")]);
    state.menu = menu;
    setUser(sessionData.user);
    renderCategories();
    renderMenu();
    renderCart();
  } catch (error) {
    $("#menu-grid").innerHTML = `<p class="loading-card error-card">${escapeHtml(error.message)} Refresh the page to try again.</p>`;
  }

  if (location.pathname === "/reset-password" && new URLSearchParams(location.search).has("token")) {
    setAuthMode("reset");
    $("#auth-dialog").showModal();
  }
}

$("#category-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-category]");
  if (!button) return;
  state.category = button.dataset.category;
  renderCategories();
  renderMenu();
});

$("#menu-grid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-add]");
  if (!button) return;
  const id = button.dataset.add;
  const cartItem = state.cart.get(id);
  if (cartItem && cartItem.quantity >= 20) {
    toast("You can add up to 20 of each menu item.");
    return;
  }
  state.cart.set(id, {
    quantity: (cartItem?.quantity || 0) + 1,
    drink: cartItem?.drink || (state.menu.find((item) => item.id === id)?.is_meal ? "Coke" : null),
  });
  renderCart();
  toast("Added to your basket. Nice choice.");
});

$("#basket-items").addEventListener("click", (event) => {
  const button = event.target.closest("[data-quantity]");
  if (!button) return;
  const id = button.dataset.quantity;
  const cartItem = state.cart.get(id);
  const next = (cartItem?.quantity || 0) + Number(button.dataset.delta);
  if (next <= 0) state.cart.delete(id);
  else state.cart.set(id, { ...cartItem, quantity: Math.min(20, next) });
  renderCart();
});

$("#basket-items").addEventListener("change", (event) => {
  const select = event.target.closest("[data-drink]");
  if (!select) return;
  const cartItem = state.cart.get(select.dataset.drink);
  if (!cartItem) return;
  state.cart.set(select.dataset.drink, { ...cartItem, drink: select.value });
});

$("#basket-button").addEventListener("click", () => setBasketOpen(true));
$("#scrim").addEventListener("click", () => setBasketOpen(false));
document.querySelectorAll("[data-close-basket]").forEach((button) => button.addEventListener("click", () => setBasketOpen(false)));
$("#checkout-button").addEventListener("click", () => {
  setBasketOpen(false);
  if (!state.user) {
    setAuthMode("login");
    $("#auth-dialog").showModal();
    showAuthNotice("Sign in or create an account before checking out.");
    return;
  }
  $("#checkout-form").elements.customerName.value = state.user.name;
  $("#checkout-dialog").showModal();
  updateCheckoutTotals();
});

$("#account-button").addEventListener("click", () => {
  if (!state.user) setAuthMode("login");
  $("#auth-dialog").showModal();
  if (location.protocol === "file:") {
    $("#auth-form").hidden = true;
    $("#auth-links").hidden = true;
    showAuthNotice("Preview only: account access needs the running app server and database. Open http://localhost:3001 after starting the app.");
  }
});
document.querySelectorAll("[data-close-auth]").forEach((button) => button.addEventListener("click", () => $("#auth-dialog").close()));
document.querySelectorAll("[data-close-checkout]").forEach((button) => button.addEventListener("click", () => $("#checkout-dialog").close()));
$("#auth-links").addEventListener("click", (event) => {
  const button = event.target.closest("[data-auth-mode]");
  if (button) setAuthMode(button.dataset.authMode);
});

$("#auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const mode = state.authMode;
  const notice = $("#auth-notice");
  notice.hidden = true;
  $("#auth-submit").disabled = true;
  try {
    if (mode === "forgot") {
      const result = await api("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: data.get("email") }) });
      showAuthNotice(result.message);
    } else if (mode === "reset") {
      const result = await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token: new URLSearchParams(location.search).get("token"), password: data.get("newPassword") }),
      });
      setAuthMode("login");
      showAuthNotice(result.message);
      history.replaceState(null, "", "/");
    } else {
      const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const result = await api(endpoint, {
        method: "POST",
        body: JSON.stringify({ name: data.get("name"), email: data.get("email"), password: data.get("password") }),
      });
      setUser(result.user);
      $("#auth-dialog").close();
      toast(`You're in, ${result.user.name.split(" ")[0]}. Let's eat.`);
    }
  } catch (error) {
    showAuthNotice(error.message, true);
  } finally {
    $("#auth-submit").disabled = false;
  }
});

$("#logout-button").addEventListener("click", async () => {
  try {
    await api("/api/auth/logout", { method: "POST" });
    setUser(null);
    $("#auth-dialog").close();
    toast("You've been signed out.");
  } catch (error) {
    showAuthNotice(error.message, true);
  }
});

$("#orders-button").addEventListener("click", async () => {
  try { await loadOrders(); } catch (error) { showAuthNotice(error.message, true); }
});

$("#checkout-form").addEventListener("change", (event) => {
  if (event.target.name === "fulfillment") {
    const delivery = event.target.value === "delivery";
    $("#delivery-fields").hidden = !delivery;
    $("#checkout-form").elements.address.required = delivery;
    $("#checkout-form").elements.distanceKm.required = delivery;
  }
  updateCheckoutTotals();
});
$("#checkout-form").elements.distanceKm.addEventListener("input", updateCheckoutTotals);

$("#checkout-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const submit = form.querySelector('[type="submit"]');
  const notice = $("#checkout-notice");
  notice.hidden = true;
  submit.disabled = true;
  try {
    const result = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        customerName: data.get("customerName"),
        phone: data.get("phone"),
        fulfillment: data.get("fulfillment"),
        address: data.get("address"),
        distanceKm: Number(data.get("distanceKm") || 0),
        items: [...state.cart.entries()].map(([id, cartItem]) => ({
          id,
          quantity: cartItem.quantity,
          ...(state.menu.find((item) => item.id === id)?.is_meal ? { drink: cartItem.drink } : {}),
        })),
      }),
    });
    state.cart.clear();
    renderCart();
    $("#checkout-dialog").close();
    form.reset();
    $("#delivery-fields").hidden = false;
    form.elements.address.required = true;
    form.elements.distanceKm.required = true;
    updateCheckoutTotals();
    toast(`Order ${result.order.order_number} is in! Pay ${money(result.order.total_cents)} on arrival.`);
  } catch (error) {
    notice.textContent = error.message;
    notice.className = "notice notice-error";
    notice.hidden = false;
  } finally {
    submit.disabled = false;
  }
});

$("#mobile-menu").addEventListener("click", () => document.querySelector(".main-nav").classList.toggle("nav-open"));
initialize();

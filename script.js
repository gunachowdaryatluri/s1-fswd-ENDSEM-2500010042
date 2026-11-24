const API = "http://localhost:3000";
const money = n => "₹" + n.toFixed(2);

let menu = [], settings = { restaurant: "Restaurant", taxRate: 5 };
let cart = {};            // { dishId: qty }
let activeCategory = "All";

const $ = id => document.getElementById(id);

// ---------- Load data from db.json (through json-server) ----------
async function init() {
  try {
    [menu, settings] = await Promise.all([
      fetch(`${API}/menu`).then(r => r.json()),
      fetch(`${API}/settings`).then(r => r.json())
    ]);
  } catch {
    $("menuGrid").innerHTML = "<p>Could not reach the server. Run <b>npm start</b> and reload.</p>";
    return;
  }
  $("restaurantName").textContent = settings.restaurant;
  $("taxLabel").textContent = `GST (${settings.taxRate}%)`;
  renderCategories();
  renderMenu();
  renderBill();
}

// ---------- Menu ----------
function renderCategories() {
  const cats = ["All", ...new Set(menu.map(m => m.category))];
  $("categories").innerHTML = cats.map(c =>
    `<button class="chip ${c === activeCategory ? "active" : ""}" data-cat="${c}">${c}</button>`).join("");
}

function renderMenu() {
  const list = menu.filter(m => activeCategory === "All" || m.category === activeCategory);
  $("menuGrid").innerHTML = list.map(m => `
    <button class="dish" data-id="${m.id}">
      <span class="name">${m.name}</span>
      <span class="row">
       
        <span class="price">${money(m.price)}</span>
      </span>
    </button>`).join("");
}

$("categories").onclick = e => {
  if (!e.target.dataset.cat) return;
  activeCategory = e.target.dataset.cat;
  renderCategories(); renderMenu();
};
$("menuGrid").onclick = e => {
  const card = e.target.closest(".dish");
  if (!card) return;
  const id = card.dataset.id;
  cart[id] = (cart[id] || 0) + 1;
  renderBill();
};

// ---------- Bill ----------
function totals() {
  const subtotal = Object.entries(cart).reduce((s, [id, q]) => s + menu.find(m => m.id == id).price * q, 0);
  const tax = subtotal * settings.taxRate / 100;
  return { subtotal, tax, total: subtotal + tax };
}

function renderBill() {
  const ids = Object.keys(cart);
  $("items").innerHTML = ids.map(id => {
    const m = menu.find(x => x.id == id);
    return `<li>
      <span>${m.name}<br><small>${money(m.price)}</small></span>
      <span class="qty">
        <button data-act="dec" data-id="${id}" aria-label="Remove one">−</button>
        ${cart[id]}
        <button data-act="inc" data-id="${id}" aria-label="Add one">+</button>
      </span>
      <span class="line-total">${money(m.price * cart[id])}</span>
    </li>`;
  }).join("");
  $("empty").classList.toggle("hidden", ids.length > 0);
  $("generate").disabled = ids.length === 0;
  const t = totals();
  $("subtotal").textContent = money(t.subtotal);
  $("tax").textContent = money(t.tax);
  $("total").textContent = money(t.total);
}

$("items").onclick = e => {
  const { act, id } = e.target.dataset;
  if (!act) return;
  cart[id] += act === "inc" ? 1 : -1;
  if (cart[id] <= 0) delete cart[id];
  renderBill();
};
$("clear").onclick = () => { cart = {}; renderBill(); };

// ---------- Save order to db.json and show receipt ----------
$("generate").onclick = async () => {
  const t = totals();
  const order = {
    customer: $("customer").value.trim() || "Walk-in",
    table: $("table").value || "-",
    date: new Date().toLocaleString("en-IN"),
    items: Object.entries(cart).map(([id, qty]) => {
      const m = menu.find(x => x.id == id);
      return { name: m.name, price: m.price, qty };
    }),
    taxRate: settings.taxRate,
    ...t
  };
  const saved = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(order)
  }).then(r => r.json());
  showReceipt(saved);
  cart = {}; $("customer").value = ""; $("table").value = "";
  renderBill();
};

function showReceipt(o) {
  $("receipt").innerHTML = `
    <h3>${settings.restaurant}</h3>
    <p class="c">Bill #${o.id}</p>
    <hr>
    <div>Customer: ${o.customer}</div>
    <div>Table: ${o.table}</div>
    <div>${o.date}</div>
    <hr>
    ${o.items.map(i => `<div class="r"><span>${i.name} x${i.qty}</span><span>${money(i.price * i.qty)}</span></div>`).join("")}
    <hr>
    <div class="r"><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
    <div class="r"><span>GST (${o.taxRate}%)</span><span>${money(o.tax)}</span></div>
    <div class="r b"><span>Total</span><span>${money(o.total)}</span></div>
    <hr>
    <p class="c">Thank you, visit again!</p>
    <div class="btns">
      <button class="ghost" id="closeModal">Close</button>
      <button class="primary" onclick="window.print()">Print</button>
    </div>`;
  $("modal").classList.remove("hidden");
  $("closeModal").onclick = () => $("modal").classList.add("hidden");
}

// ---------- Past bills ----------
async function loadHistory() {
  const orders = await fetch(`${API}/orders?_sort=id&_order=desc`).then(r => r.json());
  $("orders").innerHTML = orders.length ? orders.map(o => `
    <div class="order-card">
      <div><b>Bill #${o.id} – ${o.customer}</b><br>
        <small>${o.date} · Table ${o.table}</small><br>
        <small>${o.items.map(i => `${i.name} x${i.qty}`).join(", ")}</small></div>
      <b>${money(o.total)}</b>
    </div>`).join("") : "<p class='empty'>No bills yet. Generate one from the New order tab.</p>";
}

document.querySelectorAll(".tab").forEach(btn => btn.onclick = () => {
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b === btn));
  const history = btn.dataset.view === "history";
  $("orderView").classList.toggle("hidden", history);
  $("historyView").classList.toggle("hidden", !history);
  if (history) loadHistory();
});

init();

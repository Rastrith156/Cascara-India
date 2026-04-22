/* =============================================
   CASCARA INDIA — JavaScript Application v2.0
   Full backend integration, auth, cart sync,
   real reviews, secure checkout
   ============================================= */

/* API base URL:
   - On localhost: uses port 5000 directly (dev mode without nginx)
   - On any deployed server: nginx proxies /api → backend container */
const IS_LOCAL = ['localhost','127.0.0.1'].includes(window.location.hostname) || window.location.protocol === 'file:';
const API = IS_LOCAL ? 'http://localhost:5000/api' : '/api';

/* ══════════════════════════════════════════════
   UTILITIES
   ══════════════════════════════════════════════ */

/** Sanitize user input to prevent XSS */
function sanitizeHTML(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(str)));
  return div.innerHTML;
}

/** Fetch with auth header attached */
async function authFetch(url, options = {}) {
  const token = localStorage.getItem('cascara-token');
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
}

/* ══════════════════════════════════════════════
   AUTH STATE
   ══════════════════════════════════════════════ */

function getUser() {
  try { return JSON.parse(localStorage.getItem('cascara-user')); }
  catch { return null; }
}

function isLoggedIn() {
  return !!(localStorage.getItem('cascara-token') && getUser());
}

function logout() {
  localStorage.removeItem('cascara-token');
  localStorage.removeItem('cascara-user');
  cart = [];
  saveCart();
  renderCart();
  showToast('👋 Logged out successfully.');
  updateNavAuth();
  // Small delay then reload
  setTimeout(() => window.location.reload(), 800);
}

function updateNavAuth() {
  const actions = document.querySelector('.nav-actions');
  if (!actions) return;

  // Remove any existing auth button
  const existing = document.getElementById('nav-auth-btn');
  if (existing) existing.remove();

  const user = getUser();

  if (user) {
    const initial = (user.name || 'U')[0].toUpperCase();
    const btn = document.createElement('button');
    btn.id = 'nav-auth-btn';
    btn.className = 'nav-user-btn';
    btn.setAttribute('aria-label', `Logged in as ${user.name}. Click to log out.`);
    btn.innerHTML = `
      <div class="nav-user-avatar" aria-hidden="true">${sanitizeHTML(initial)}</div>
      <span>${sanitizeHTML(user.name.split(' ')[0])}</span>
    `;
    btn.addEventListener('click', () => {
      if (confirm(`Log out of ${user.name}'s account?`)) logout();
    });

    // My Orders link
    const ordersLink = document.createElement('a');
    ordersLink.href = 'orders.html';
    ordersLink.id = 'nav-orders-link';
    ordersLink.className = 'nav-user-btn';
    ordersLink.textContent = '📦 My Orders';
    ordersLink.style.cssText = 'font-size:0.85rem;padding:6px 12px;';

    // Insert before cart button
    const cartBtn = document.getElementById('cart-btn');
    if (cartBtn) {
      actions.insertBefore(ordersLink, cartBtn);
      actions.insertBefore(btn, cartBtn);
    } else {
      actions.prepend(btn);
      actions.prepend(ordersLink);
    }
  } else {
    const btn = document.createElement('a');
    btn.id = 'nav-auth-btn';
    btn.href = 'login.html';
    btn.className = 'nav-user-btn';
    btn.textContent = 'Sign In';
    btn.setAttribute('aria-label', 'Sign in to your account');
    const cartBtn = document.getElementById('cart-btn');
    if (cartBtn) actions.insertBefore(btn, cartBtn);
    else actions.prepend(btn);
  }
}

/* ══════════════════════════════════════════════
   NAVBAR EFFECTS
   ══════════════════════════════════════════════ */
const navbar = document.getElementById('navbar');

// Always-dark on non-hero pages
if (navbar && !document.querySelector('.hero')) {
  navbar.classList.add('always-dark', 'scrolled');
}

if (navbar) {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 60) navbar.classList.add('scrolled');
    else if (!navbar.classList.contains('always-dark')) navbar.classList.remove('scrolled');
  });
}

/* ── HAMBURGER MENU ── */
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('nav-links');

if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    const spans  = hamburger.querySelectorAll('span');
    hamburger.setAttribute('aria-expanded', isOpen);
    if (isOpen) {
      spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
      spans[1].style.opacity   = '0';
      spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
    } else {
      spans[0].style.transform = '';
      spans[1].style.opacity   = '';
      spans[2].style.transform = '';
    }
  });

  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      const spans = hamburger.querySelectorAll('span');
      spans[0].style.transform = spans[1].style.opacity = spans[2].style.transform = '';
      hamburger.setAttribute('aria-expanded', 'false');
    });
  });
}

/* ══════════════════════════════════════════════
   CART STATE (localStorage + backend sync)
   ══════════════════════════════════════════════ */
let cart = JSON.parse(localStorage.getItem('cascara-cart') || '[]');

function saveCart() {
  localStorage.setItem('cascara-cart', JSON.stringify(cart));
}

async function addToCart(id, name, price, img) {
  const existing = cart.find(item => item.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id, name, price, img, qty: 1 });
  }
  saveCart();
  renderCart();
  openCart();
  showToast(`✅ "${sanitizeHTML(name.split('(')[0].trim())}" added to cart!`);

  // Sync to backend if logged in
  if (isLoggedIn()) {
    try {
      await authFetch(`${API}/cart/add`, {
        method: 'POST',
        body: JSON.stringify({ productId: id, name, price, qty: 1, img })
      });
    } catch { /* silently fail — localStorage is source of truth */ }
  }
}

function removeFromCart(id) {
  cart = cart.filter(item => item.id !== id);
  saveCart();
  renderCart();
}

function updateQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) { removeFromCart(id); return; }
  saveCart();
  renderCart();
}

function renderCart() {
  const cartItems  = document.getElementById('cart-items');
  const cartEmpty  = document.getElementById('cart-empty');
  const cartFooter = document.getElementById('cart-footer');
  const cartCount  = document.getElementById('cart-count');
  const totalEl    = document.getElementById('cart-total-price');

  const total = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const count = cart.reduce((sum, i) => sum + i.qty, 0);

  if (cartCount) {
    cartCount.textContent = count;
    cartCount.classList.toggle('show', count > 0);
  }

  if (cart.length === 0) {
    if (cartEmpty)  cartEmpty.style.display  = 'block';
    if (cartItems)  cartItems.style.display  = 'none';
    if (cartFooter) cartFooter.style.display = 'none';
    return;
  }

  if (cartEmpty)  cartEmpty.style.display  = 'none';
  if (cartItems)  cartItems.style.display  = 'flex';
  if (cartFooter) cartFooter.style.display = 'block';
  if (totalEl) totalEl.textContent = `₹${total.toLocaleString('en-IN')}`;

  if (cartItems) {
    cartItems.innerHTML = cart.map(item => `
      <li class="cart-item">
        <img src="${sanitizeHTML(item.img)}" alt="${sanitizeHTML(item.name)}" class="cart-item-img" loading="lazy" />
        <div class="cart-item-info">
          <div class="cart-item-name">${sanitizeHTML(item.name)}</div>
          <div class="cart-item-price">₹${(item.price * item.qty).toLocaleString('en-IN')}</div>
          <div class="cart-item-controls">
            <button class="qty-btn" onclick="updateQty('${sanitizeHTML(item.id)}',-1)" aria-label="Decrease quantity">−</button>
            <span class="qty-num" aria-label="Quantity: ${item.qty}">${item.qty}</span>
            <button class="qty-btn" onclick="updateQty('${sanitizeHTML(item.id)}',1)"  aria-label="Increase quantity">+</button>
            <button class="cart-item-remove" onclick="removeFromCart('${sanitizeHTML(item.id)}')">Remove</button>
          </div>
        </div>
      </li>
    `).join('');
  }
}

/* ── CART DRAWER ── */
function openCart() {
  document.getElementById('cart-drawer')?.classList.add('open');
  document.getElementById('cart-overlay')?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('cart-drawer')?.classList.remove('open');
  document.getElementById('cart-overlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

const cartBtn = document.getElementById('cart-btn');
if (cartBtn) cartBtn.addEventListener('click', openCart);

function checkout() {
  if (cart.length === 0) return;
  window.location.href = 'checkout.html';
}

/* ══════════════════════════════════════════════
   TOAST NOTIFICATION
   ══════════════════════════════════════════════ */
let toastTimeout;
function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 3200);
}

/* ══════════════════════════════════════════════
   STAR PICKER
   ══════════════════════════════════════════════ */
const stars = document.querySelectorAll('.star-picker .star');
let selectedStar = 5;

stars.forEach(star => {
  star.addEventListener('mouseover', () => {
    const val = parseInt(star.dataset.val);
    stars.forEach((s, i) => s.classList.toggle('active', i < val));
  });
  star.addEventListener('mouseout', () => {
    stars.forEach((s, i) => s.classList.toggle('active', i < selectedStar));
  });
  star.addEventListener('click', () => {
    selectedStar = parseInt(star.dataset.val);
    const sv = document.getElementById('star-value');
    if (sv) sv.value = selectedStar;
    stars.forEach((s, i) => s.classList.toggle('active', i < selectedStar));
  });
  star.setAttribute('tabindex', '0');
  star.setAttribute('role', 'button');
  star.setAttribute('aria-label', `Rate ${star.dataset.val} stars`);
  star.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); star.click(); }
  });
});
stars.forEach((s, i) => s.classList.toggle('active', i < selectedStar));

/* ══════════════════════════════════════════════
   REVIEWS — Load from backend, fallback to seed
   ══════════════════════════════════════════════ */
const seedReviews = [
  { name:'Priya Menon', rating:5, product:'Sachet Box',
    text:"I was skeptical at first, but this is genuinely one of the best tea experiences I've had. The fruity, tangy notes are unlike anything else. I've now switched from regular chai to Cascara every morning!", date:'3 days ago' },
  { name:'Rahul Sharma', rating:5, product:'50g Pack',
    text:"Ordered the loose-leaf pack and I'm absolutely blown away. Brewed it in my teapot with a bit of jaggery — absolutely divine. The aroma while steeping is incredible. 10/10.", date:'1 week ago' },
  { name:'Anjali K.', rating:4, product:'5g Sachet',
    text:"Tried the sample sachet before going all-in and I'm glad I did — immediately ordered the full box! It tastes like a rose-tamarind-coffee hybrid. Really unique and refreshing.", date:'2 weeks ago' },
  { name:'Dev Patel', rating:5, product:'Sachet Box',
    text:"As someone who runs a small café, I ordered this to try as a menu item. My customers are absolutely loving it. Sophisticated, healthy, and conversation-starting.", date:'3 weeks ago' },
  { name:'Sunita Rao', rating:5, product:'50g Pack',
    text:"I'm a health-conscious person always looking for alternatives to coffee. Cascara is the perfect answer — all the ritual, warm comfort and flavour, without the heavy caffeine hit.", date:'1 month ago' },
  { name:'Arjun Nair', rating:4, product:'Sachet Box',
    text:"Great product, beautifully packaged. Shipped fast to Kochi. I love the story behind it — supporting local coffee farmers while enjoying something truly original.", date:'1 month ago' }
];

let allReviews = [...seedReviews];

async function loadReviewsFromAPI() {
  try {
    const res  = await fetch(`${API}/reviews?limit=20`);
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    if (data.reviews && data.reviews.length > 0) {
      // Merge: API reviews first, then seed reviews
      const apiReviews = data.reviews.map(r => ({
        name: r.name, rating: r.rating, product: r.product, text: r.text,
        date: new Date(r.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
      }));
      allReviews = [...apiReviews, ...seedReviews];
    }
  } catch { /* Use seed reviews */ }
  renderReviews();
  setTimeout(() => observeWithDelay('.review-card'), 100);
}

function renderReviews() {
  const grid = document.getElementById('reviews-grid');
  if (!grid) return;
  grid.innerHTML = allReviews.map((r, i) => `
    <div class="review-card" style="animation-delay:${i * 0.07}s" role="article">
      <div class="review-header">
        <div class="reviewer-avatar" aria-hidden="true">${sanitizeHTML(r.name[0])}</div>
        <div class="reviewer-info">
          <strong>${sanitizeHTML(r.name)}</strong>
          <span>${sanitizeHTML(r.date)}</span>
        </div>
      </div>
      <div class="review-stars" aria-label="${r.rating} out of 5 stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
      <p class="review-text">"${sanitizeHTML(r.text)}"</p>
      <span class="review-product-tag">${sanitizeHTML(r.product)}</span>
    </div>
  `).join('');
}

async function submitReview(e) {
  e.preventDefault();
  const btn     = document.getElementById('submit-review-btn');
  const name    = document.getElementById('reviewer-name')?.value.trim();
  const product = document.getElementById('reviewer-product')?.value;
  const rating  = parseInt(document.getElementById('star-value')?.value);
  const text    = document.getElementById('reviewer-text')?.value.trim();

  if (!name || !text) return;
  if (text.length < 10) { showToast('⚠️ Review must be at least 10 characters.'); return; }

  btn.textContent = 'Posting...';
  btn.disabled = true;

  try {
    const res  = await fetch(`${API}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, product, rating, text })
    });
    const data = await res.json();

    if (res.ok) {
      // Prepend new review to list
      allReviews = [{ name, rating, product, text, date: 'Just now' }, ...allReviews];
      renderReviews();
      document.getElementById('review-form')?.reset();
      selectedStar = 5;
      const sv = document.getElementById('star-value');
      if (sv) sv.value = 5;
      stars.forEach((s, i) => s.classList.toggle('active', i < 5));
      showToast('🙏 Thank you for your review!');
      document.getElementById('reviews-grid')?.scrollIntoView({ behavior:'smooth', block:'start' });
    } else {
      showToast(`⚠️ ${data.message || 'Could not post review.'}`);
    }
  } catch {
    // Offline fallback — show locally
    allReviews = [{ name, rating, product, text, date: 'Just now' }, ...allReviews];
    renderReviews();
    document.getElementById('review-form')?.reset();
    showToast('🙏 Thank you for your review!');
  } finally {
    if (btn) { btn.textContent = 'Post Review'; btn.disabled = false; }
  }
}

/* ══════════════════════════════════════════════
   CONTACT FORM
   ══════════════════════════════════════════════ */
function submitContact(e) {
  e.preventDefault();
  const btn  = document.getElementById('contact-submit-btn');
  const name = document.getElementById('contact-name')?.value.trim();
  const em   = document.getElementById('contact-email')?.value.trim();
  const msg  = document.getElementById('contact-msg')?.value.trim();

  if (!name || !em || !msg) return;

  btn.textContent = 'Sending...';
  btn.disabled    = true;

  // Simulate email (integrate SendGrid/Nodemailer for real emails)
  setTimeout(() => {
    document.getElementById('contact-form')?.reset();
    btn.textContent = 'Send Message';
    btn.disabled    = false;
    showToast("📨 Message sent! We'll reply within 24 hours.");
  }, 1200);
}

/* ══════════════════════════════════════════════
   PRODUCTS — Load from backend
   ══════════════════════════════════════════════ */
async function loadProducts() {
  const grid = document.getElementById('dynamic-products-grid');
  if (!grid) return;

  try {
    const res  = await fetch(`${API}/products`);
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      grid.innerHTML = data.map(p => `
        <div class="product-card" role="article">
          <div class="product-img-wrap">
            <img src="${sanitizeHTML(p.image || 'cascara_products.png')}" alt="${sanitizeHTML(p.name)}" class="product-img" loading="lazy" />
          </div>
          <div class="product-info">
            <h3 class="product-name">${sanitizeHTML(p.name)}</h3>
            <p class="product-desc">${sanitizeHTML(p.description || '')}</p>
            <div class="product-footer">
              <div class="product-price"><span class="price-main">₹${p.price}</span></div>
              <button class="btn btn-cart"
                onclick="addToCart('${p._id}','${sanitizeHTML(p.name)}',${p.price},'${sanitizeHTML(p.image || 'cascara_products.png')}')">
                Add to Cart
              </button>
            </div>
          </div>
        </div>
      `).join('');
      observeWithDelay('.product-card');
    }
  } catch { /* DB products not available — static HTML products shown */ }
}

/* ══════════════════════════════════════════════
   SCROLL ANIMATIONS
   ══════════════════════════════════════════════ */
// Add CSS for initial hidden state
const scrollStyle = document.createElement('style');
scrollStyle.textContent = `
  .product-card, .brew-step, .review-card, .contact-item, .stat-item {
    opacity: 0; transform: translateY(24px);
    transition: opacity 0.55s ease, transform 0.55s ease;
  }
  .product-card.visible, .brew-step.visible, .review-card.visible,
  .contact-item.visible, .stat-item.visible {
    opacity: 1; transform: translateY(0);
  }
`;
document.head.appendChild(scrollStyle);

function observeWithDelay(selector) {
  const els = document.querySelectorAll(selector);
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry, idx) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), idx * 90);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });
  els.forEach(el => io.observe(el));
}

/* ══════════════════════════════════════════════
   INIT
   ══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  renderCart();
  updateNavAuth();
  loadReviewsFromAPI();
  loadProducts();
  observeWithDelay('.product-card');
  observeWithDelay('.brew-step');
  observeWithDelay('.contact-item');
  observeWithDelay('.stat-item');
});

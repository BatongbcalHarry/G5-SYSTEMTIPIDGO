// ============================================================
// TipidGo - Front-end <-> Backend connector (PHP + MySQL)
// This is the only file that talks to the backend. Everything
// here uses fetch() to call the PHP files inside /api, which
// read and write the real MySQL database.
// ============================================================

// Escapes text before it is placed into innerHTML, so anything a user typed
// (feedback, requests, store names...) is shown as text and never run as HTML.
function esc(value){
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[ch]));
}

// Shown when a product has no picture or its picture file is missing.
const PRODUCT_FALLBACK_IMAGE = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><rect width="120" height="80" fill="#E9EFFD"/>' +
  '<path d="M38 36h44l-5 24H43z" fill="#2451C4"/><path d="M48 36a12 12 0 0 1 24 0" fill="none" stroke="#2451C4" stroke-width="4"/>' +
  '<circle cx="60" cy="48" r="4" fill="#E3A116"/></svg>');

const API_BASE = /\/HTML(?:\/|$)/i.test(window.location.pathname) ? '../api' : 'api';

const productImageFallbacks = {
  'Rice (1kg)': 'images/rice.svg',
  'Corn Grits (1kg)': 'images/corn-grits.svg',
  'Eggs (per piece)': 'images/eggs.svg',
  'Milk (1L)': 'images/milk.svg',
  'Cooking Oil (1L)': 'images/cooking-oil.svg',
  'Vinegar (1L)': 'images/vinegar.svg',
  'Soap (100g)': 'images/soap.svg',
  'Detergent (1kg)': 'images/detergent.svg',
  'Canned Sardines': 'images/canned-sardines.svg',
  'Corned Beef': 'images/corned-beef.svg'
};

function resolveImagePath(imagePath, productName){
  const sourcePath = imagePath || productImageFallbacks[productName];
  if(!sourcePath || /^(?:[a-z][a-z\d+.-]*:|\/)/i.test(sourcePath)) return sourcePath || '';

  const relativePath = sourcePath.replace(/^\.\//, '');
  const assetBase = /\/HTML(?:\/|$)/i.test(window.location.pathname) ? '../' : './';
  return `${assetBase}${relativePath}`;
}

function backendUnavailableMessage(){
  if(window.location.protocol === 'file:'){
    return 'TipidGo must be opened through a local web server. Start Apache + MySQL in XAMPP, then open http://localhost/tipidgo/HTML/ (or http://127.0.0.1:8000/HTML/ if you are using PHP\'s built-in server).';
  }
  return 'Could not reach the backend. Check that Apache and MySQL are running, then open the app through http://localhost/tipidgo/HTML/. The API folder must be in the project root.';
}

let currentFeedbackType = 'Comments';
let currentRequestType = '';
let currentUser = null;
let currentUserLocation = null;
let currentStoreRadiusKm = 5;
let storeMap = null;
let userLocationMarker = null;
let userAccuracyCircle = null;
let searchRadiusCircle = null;
let storeMarkersLayer = null;
let loadedStores = [];

const knownStoreLocations = {
  puregold: {
    lat: 15.4870358,
    lng: 120.9610067,
    address: 'Burgos Avenue, Kapitan Pepe Subdivision, Cabanatuan, Nueva Ecija'
  },
  snr: {
    lat: 15.4622234,
    lng: 120.9453489,
    address: 'Felipe Vergara Highway, Don Jose de Real Subdivision, Cabanatuan, Nueva Ecija'
  },
  robinson: {
    lat: 15.4601748,
    lng: 120.949796,
    address: 'Felipe Vergara Highway, Don Jose de Real Subdivision, Cabanatuan, Nueva Ecija'
  }
};

function toRadians(value){
  return (value * Math.PI) / 180;
}

function haversineDistanceKm(lat1, lng1, lat2, lng2){
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getStoreCoordinates(store){
  if(!store) return null;

  const name = typeof store.name === 'string' ? store.name.trim().toLowerCase() : '';
  const knownLocation = knownStoreLocations[name];
  if(knownLocation) return knownLocation;

  const rawLocation = typeof store.location === 'string' ? store.location.trim() : '';
  const coordinateMatch = rawLocation.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if(coordinateMatch){
    const lat = Number(coordinateMatch[1]);
    const lng = Number(coordinateMatch[2]);
    if(Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180){
      return { lat, lng };
    }
  }

  return null;
}

function getStoreAddress(store){
  const name = typeof store.name === 'string' ? store.name.trim().toLowerCase() : '';
  return knownStoreLocations[name]?.address || store.location || 'Store location';
}

function updateLocationStatus(message, isError = false){
  const status = document.getElementById('locationStatus');
  if(!status) return;
  status.textContent = message;
  status.style.color = isError ? '#d33' : '#5b6b7d';
}

function updateStoreRadiusDisplay(){
  const radiusInput = document.getElementById('storeRadius');
  const radiusValue = document.getElementById('radiusValue');
  if(radiusInput && radiusValue){
    currentStoreRadiusKm = Number(radiusInput.value) || 5;
    radiusValue.textContent = `${currentStoreRadiusKm}km`;
    renderStoreList(loadedStores);
    renderStoreLocationMap();
  }
}

function renderStoreLocationMap(){
  const mapElement = document.getElementById('storeMap');
  const status = document.getElementById('mapLocationStatus');
  if(!mapElement) return;

  if(typeof L === 'undefined'){
    if(status) status.textContent = 'The map could not load. Check your internet connection and reload the page.';
    return;
  }

  if(!storeMap){
    storeMap = L.map(mapElement).setView([15.4842, 120.9675], 13);
    const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });
    tiles.on('tileerror', () => {
      if(status) status.textContent = 'Map tiles could not be loaded. Check your internet connection.';
    });
    tiles.addTo(storeMap);
    storeMarkersLayer = L.layerGroup().addTo(storeMap);
  }

  if(userLocationMarker){
    userLocationMarker.remove();
    userLocationMarker = null;
  }
  if(userAccuracyCircle){
    userAccuracyCircle.remove();
    userAccuracyCircle = null;
  }
  if(searchRadiusCircle){
    searchRadiusCircle.remove();
    searchRadiusCircle = null;
  }

  let radiusCenter = [15.4842, 120.9675];
  if(currentUserLocation){
    const { lat, lng, accuracy } = currentUserLocation;
    radiusCenter = [lat, lng];
    userLocationMarker = L.marker([lat, lng]).addTo(storeMap)
      .bindPopup(`<strong>Your location</strong><br>Accuracy: &plusmn;${Math.round(accuracy)} m`);
    userAccuracyCircle = L.circle([lat, lng], {
      radius: accuracy,
      color: '#2451C4',
      fillColor: '#2451C4',
      fillOpacity: 0.15,
      weight: 2
    }).addTo(storeMap);
  }

  searchRadiusCircle = L.circle(radiusCenter, {
    radius: currentStoreRadiusKm * 1000,
    color: '#e07800',
    fillColor: '#ffb347',
    fillOpacity: 0.12,
    weight: 2,
    dashArray: '6 5'
  }).addTo(storeMap);
  storeMap.fitBounds(searchRadiusCircle.getBounds(), { padding: [24, 24], maxZoom: 15 });

  const unknownLocationCount = loadedStores.filter(store => !getStoreCoordinates(store)).length;
  if(status){
    const centerDescription = currentUserLocation
      ? `GPS location accuracy: ±${Math.round(currentUserLocation.accuracy)} m`
      : 'Radius is centered on Cabanatuan City until you share your GPS location';
    const pinDescription = unknownLocationCount
      ? ` ${unknownLocationCount} store(s) have no exact coordinates, so they cannot be pinned or radius-filtered.`
      : '';
    status.textContent = `Search radius: ${currentStoreRadiusKm} km. ${centerDescription}.${pinDescription}`;
  }

  storeMarkersLayer.clearLayers();
  loadedStores.forEach(store => {
    const coords = getStoreCoordinates(store);
    if(!coords) return;

    const distance = currentUserLocation
      ? haversineDistanceKm(currentUserLocation.lat, currentUserLocation.lng, coords.lat, coords.lng)
      : null;
    if(distance !== null && distance > currentStoreRadiusKm) return;

    const popup = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = store.name;
    popup.appendChild(name);
    const address = document.createElement('div');
    address.textContent = getStoreAddress(store);
    popup.appendChild(address);
    if(distance !== null){
      const distanceLabel = document.createElement('div');
      distanceLabel.textContent = `${distance.toFixed(1)} km away`;
      popup.appendChild(distanceLabel);
    }
    const marker = L.marker([coords.lat, coords.lng]).bindPopup(popup);
    storeMarkersLayer.addLayer(marker);
  });

  window.setTimeout(() => storeMap.invalidateSize(), 0);
}

async function detectCurrentLocation(fieldId = null, refreshStoreList = false){
  if(!navigator.geolocation){
    updateLocationStatus('This browser cannot detect your location. Please enter the store address manually.', true);
    const mapStatus = document.getElementById('mapLocationStatus');
    if(mapStatus) mapStatus.textContent = 'This browser cannot detect your location. Check device/browser support or enter coordinates in the store address.';
    return;
  }

  const button = fieldId ? document.getElementById('detectLocationButton') : document.getElementById('useMyLocationBtn');
  if(button) button.disabled = true;

  navigator.geolocation.getCurrentPosition(
    position => {
      currentUserLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy
      };

      const coordsText = `${currentUserLocation.lat.toFixed(5)}, ${currentUserLocation.lng.toFixed(5)}`;
      if(fieldId){
        const field = document.getElementById(fieldId);
        if(field) field.value = coordsText;
        updateLocationStatus(`Current location saved: ${coordsText}`);
      }

      renderStoreLocationMap();
      if(refreshStoreList || loadedStores.length) renderStoreList(loadedStores);

      if(button) button.disabled = false;
    },
    error => {
      console.error('Geolocation failed', error);
      const message = error.code === error.PERMISSION_DENIED
        ? 'Location access was denied. Allow location access in your browser settings and try again.'
        : error.code === error.POSITION_UNAVAILABLE
          ? 'Your device could not determine its location. Try again outdoors or check device location settings.'
          : 'Location request timed out. Please try again.';
      updateLocationStatus(message, true);
      const mapStatus = document.getElementById('mapLocationStatus');
      if(mapStatus) mapStatus.textContent = message;
      if(button) button.disabled = false;
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000
    }
  );
}

// ------------------------------------------------------------
// SESSION / LOGIN / LOGOUT
// ------------------------------------------------------------

// runs once when the page loads - checks if a session already
// exists (e.g. the user refreshed the page) and skips straight
// to the Home screen if so.
async function checkSession(){
  try{
    const res = await fetch(`${API_BASE}/session.php`);
    const data = await res.json();

    if(data.loggedIn){
      onLoginSuccess(data.user);
    } else {
      showGuestHome();
    }
  } catch(err){
    showGuestHome();
    console.error('Could not reach the backend. Is XAMPP (Apache + MySQL) running?', err);
  }
}

function showOwnerLogin(){
  showScreen('login');
  document.getElementById('loginForm').style.display = 'block';
  document.getElementById('ownerRegisterForm').style.display = 'none';
  document.getElementById('loginError').textContent = '';
  document.getElementById('ownerRegistrationNotice').style.display = 'none';
  document.getElementById('loginEmail').focus();
}

function configureOwnerPasswordFields(){
  const passwordField = document.getElementById('ownerPassword');
  const confirmField = document.getElementById('ownerPasswordConfirm');
  if(!passwordField || !confirmField) return;

  passwordField.minLength = 8;
  passwordField.pattern = '(?=.*[^A-Za-z0-9]).{8,}';
  passwordField.title = 'Use at least 8 characters and include 1 special character.';
  passwordField.placeholder = 'At least 8 characters + 1 special';

  confirmField.minLength = 8;
  confirmField.pattern = '(?=.*[^A-Za-z0-9]).{8,}';
  confirmField.title = 'Use at least 8 characters and include 1 special character.';
  confirmField.placeholder = 'Enter your password again';
}

function showOwnerSignup(){
  showScreen('login');
  document.getElementById('loginForm').style.display = 'none';
  document.getElementById('ownerRegisterForm').style.display = 'block';
  document.getElementById('ownerRegisterError').textContent = '';
  document.getElementById('ownerRegistrationNotice').style.display = 'none';
  configureOwnerPasswordFields();
  document.getElementById('ownerName').focus();
}

function updateAccountBadge(){
  const signedIn = Boolean(currentUser);
  const canManage = signedIn && currentUser.role === 'admin';

  document.getElementById('accountBadge').style.display = 'block';
  document.getElementById('accountName').textContent = signedIn ? currentUser.full_name : 'Browsing as guest';
  document.getElementById('ownerLoginButton').style.display = signedIn ? 'none' : 'inline-flex';
  document.getElementById('accountLogout').style.display = signedIn ? 'inline' : 'none';

  const managementItems = new Set(['Administrator', 'Moderator', 'Verification']);
  const accountItems = new Set(['Profile', 'Setting']);
  document.querySelectorAll('.sidebar .navitem').forEach(item => {
    const label = item.textContent.trim();
    item.hidden = (managementItems.has(label) && !canManage) || (accountItems.has(label) && !signedIn);
  });
}

function loadPublicData(){
  loadProducts();
  loadFeedback();
  loadStores();
  loadRequests();
}

function showGuestHome(){
  currentUser = null;
  updateAccountBadge();
  showScreen('home');
  loadPublicData();
}

async function login(){
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorBox = document.getElementById('loginError');
  errorBox.textContent = '';

  if(!email || !password){
    errorBox.textContent = 'Please enter your email and password.';
    return;
  }

  try{
    const res = await fetch(`${API_BASE}/login.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if(!res.ok){
      errorBox.textContent = data.error || 'Login failed.';
      return;
    }

    if(!['admin', 'moderator', 'store_owner'].includes(data.role)){
      errorBox.textContent = 'This sign-in is for staff only.';
      return;
    }

    onLoginSuccess(data);
  } catch(err){
    errorBox.textContent = backendUnavailableMessage();
    console.error(err);
  }
}

async function registerStoreOwner(){
  const full_name = document.getElementById('ownerName').value.trim();
  const store_name = document.getElementById('ownerStoreName').value.trim();
  const store_location = document.getElementById('ownerStoreLocation').value.trim();
  const storePhoto = document.getElementById('ownerStorePhoto').files[0];
  const email = document.getElementById('ownerEmail').value.trim();
  const password = document.getElementById('ownerPassword').value;
  const passwordConfirm = document.getElementById('ownerPasswordConfirm').value;
  const errorBox = document.getElementById('ownerRegisterError');
  const submitButton = document.getElementById('ownerRegisterSubmit');
  errorBox.textContent = '';

  if(!storePhoto){
    errorBox.textContent = 'A photo of your store is required.';
    document.getElementById('ownerStorePhoto').focus();
    return;
  }

  if(storePhoto.size > 5 * 1024 * 1024){
    errorBox.textContent = 'The store photo must be 5 MB or smaller.';
    document.getElementById('ownerStorePhoto').focus();
    return;
  }

  if(storePhoto.type && !['image/jpeg', 'image/png', 'image/webp'].includes(storePhoto.type)){
    errorBox.textContent = 'Choose a JPEG, PNG, or WebP photo.';
    document.getElementById('ownerStorePhoto').focus();
    return;
  }

  const hasSpecialCharacter = /[^A-Za-z0-9]/.test(password);

  if(password.length < 8 || !hasSpecialCharacter){
    errorBox.textContent = 'Password must be at least 8 characters and include at least 1 special character.';
    return;
  }

  if(password !== passwordConfirm){
    errorBox.textContent = 'Passwords do not match.';
    document.getElementById('ownerPasswordConfirm').focus();
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = 'Creating account...';

  try{
    const formData = new FormData();
    formData.append('full_name', full_name);
    formData.append('store_name', store_name);
    formData.append('store_location', store_location);
    formData.append('email', email);
    formData.append('password', password);
    formData.append('store_photo', storePhoto);

    const res = await fetch(`${API_BASE}/register_owner.php`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if(!res.ok){
      errorBox.textContent = data.error || 'Could not create owner account.';
      return;
    }

    document.getElementById('ownerPassword').value = '';
    document.getElementById('ownerPasswordConfirm').value = '';
    document.getElementById('ownerRegisterForm').style.display = 'none';
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('ownerRegistrationNotice').textContent = data.message;
    document.getElementById('ownerRegistrationNotice').style.display = 'block';
    document.getElementById('loginEmail').focus();
  } catch(err){
    errorBox.textContent = backendUnavailableMessage();
    console.error(err);
  } finally{
    submitButton.disabled = false;
    submitButton.textContent = 'Create owner account';
  }
}

function onLoginSuccess(user){
  currentUser = user;
  updateAccountBadge();

  // clear the login form fields so the password isn't left sitting in the DOM
  if(document.getElementById('loginEmail')) document.getElementById('loginEmail').value = '';
  if(document.getElementById('loginPassword')) document.getElementById('loginPassword').value = '';

  const adminWorkspace = new URLSearchParams(window.location.search).get('workspace') === '1';
  if(user.role === 'admin' && !adminWorkspace){
    window.location.href = 'admin.html';
    return;
  }
  if(user.role === 'moderator'){
    window.location.href = 'moderator.html';
    return;
  }
  if(user.role === 'store_owner'){
    window.location.href = 'owner.html';
    return;
  }

  showScreen('home');
  loadPublicData();
}

async function logout(){
  try{
    await fetch(`${API_BASE}/logout.php`, { method: 'POST' });
  } catch(err){
    console.error(err);
  }

  showGuestHome();
}

// ------------------------------------------------------------
// PRODUCT LIST (Product screen)
// ------------------------------------------------------------
async function loadProducts(){
  const grid = document.getElementById('productGrid');
  if(!grid) return;

  try{
    const res = await fetch(`${API_BASE}/products.php`);
    const products = await res.json();

    grid.innerHTML = '';

    products.forEach(p => {
      const card = document.createElement('div');
      card.className = 'product-item';
      card.dataset.category = p.category;

      const imgSrc = resolveImagePath(p.image, p.name);
      card.innerHTML = `
        <img src="${esc(imgSrc)}" alt="${esc(p.name)}" onerror="this.onerror=null;this.src=PRODUCT_FALLBACK_IMAGE;" style="width:100%;height:70px;object-fit:contain;background:var(--brand-light);border-radius:6px;">
        <div style="font-size:13px;margin-top:4px;">${esc(p.name)}<br>${p.lowestPrice.toFixed(2)}</div>
        <button class="btn" style="width:100%;margin-top:4px;" onclick="viewProduct(${p.id})">VIEW PRODUCTS</button>
      `;
      grid.appendChild(card);
    });
  } catch(err){
    grid.innerHTML = '<div style="color:var(--danger);font-size:13px;">Could not load products. Check that XAMPP (Apache + MySQL) is running and the database is imported.</div>';
    console.error(err);
  }
}

// ------------------------------------------------------------
// PRODUCT DETAIL
// ------------------------------------------------------------
async function viewProduct(id){
  try{
    const res = await fetch(`${API_BASE}/product_detail.php?id=${id}`);
    const data = await res.json();

    document.getElementById('detailName').textContent = data.product.name;
    document.getElementById('detailImage').src = resolveImagePath(data.product.image, data.product.name);
    document.getElementById('detailImage').alt = data.product.name;
    document.getElementById('detailImage').onerror = function(){ this.onerror = null; this.src = PRODUCT_FALLBACK_IMAGE; };

    const lowest = data.prices[0];
    document.getElementById('detailPrice').textContent = lowest ? lowest.price.toFixed(2) : 'No Price Available';

    const rows = document.getElementById('detailPriceRows');
    rows.innerHTML = '';
    if(data.prices.length === 0){
      rows.innerHTML = '<tr><td colspan="3">No Price Available</td></tr>';
    } else {
      data.prices.forEach((pr, index) => {
        const tr = document.createElement('tr');
        const lowestTag = index === 0 ? ' ✅ Lowest' : '';
        tr.innerHTML = `
          <td>${esc(pr.storeName)}${pr.verified ? ' ✔' : ''}</td>
          <td>${pr.price.toFixed(2)}${lowestTag}</td>
          <td>${esc(pr.lastUpdated)}</td>
        `;
        rows.appendChild(tr);
      });
    }

    const historyBox = document.getElementById('detailHistory');
    if(data.history && data.history.length){
      historyBox.innerHTML = 'Price history: ' + data.history.map(h => `${esc(h.date)} - ₱${h.price.toFixed(2)}`).join(' → ');
    } else {
      historyBox.textContent = 'No price history yet';
    }

    showScreen('productDetail');
  } catch(err){
    alert('Could not load product details. Check that XAMPP (Apache + MySQL) is running.');
    console.error(err);
  }
}

// ------------------------------------------------------------
// STORES
// ------------------------------------------------------------
function renderStoreList(stores){
  const list = document.getElementById('storeList');
  if(!list) return;
  list.dataset.stores = JSON.stringify(stores);

  const rows = [...stores].map(store => {
    const coords = getStoreCoordinates(store);
    let distance = null;
    if(currentUserLocation && coords){
      distance = haversineDistanceKm(currentUserLocation.lat, currentUserLocation.lng, coords.lat, coords.lng);
    }

    if(distance !== null && distance > currentStoreRadiusKm){
      return null;
    }

    const label = distance !== null ? `${distance.toFixed(1)} km away` : coords ? 'Distance unavailable' : 'Exact pin not set (not filtered)';
    const row = document.createElement('div');
    row.className = 'store-item';
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.marginBottom = '6px';
    row.style.gap = '8px';
    row.distance = distance;
    const location = getStoreAddress(store);
    row.innerHTML = `
      <span>📍 ${esc(store.name)}${store.verified ? ' ✔' : ''} - ${esc(location)}</span>
      <span style="color:var(--muted);white-space:nowrap;">${label}</span>
    `;
    return row;
  }).filter(Boolean);

  rows.sort((a, b) => {
    if(a.distance === null && b.distance === null) return 0;
    if(a.distance === null) return 1;
    if(b.distance === null) return -1;
    return a.distance - b.distance;
  });

  list.innerHTML = '';
  if(rows.length === 0){
    list.innerHTML = '<span style="color:var(--muted);">No stores within the current radius. Try a bigger radius or allow location access.</span>';
    return;
  }

  rows.forEach(row => list.appendChild(row));
}

async function loadStores(){
  const list = document.getElementById('storeList');
  if(!list) return;

  try{
    const res = await fetch(`${API_BASE}/stores.php`);
    const stores = await res.json();
    loadedStores = stores;
    renderStoreList(stores);
    renderStoreLocationMap();
  } catch(err){
    list.innerHTML = '<span style="color:var(--danger);">Could not load stores.</span>';
    console.error(err);
  }
}

// ------------------------------------------------------------
// FEEDBACK
// ------------------------------------------------------------
async function loadFeedback(){
  const list = document.getElementById('feedbackList');
  if(!list) return;

  try{
    const res = await fetch(`${API_BASE}/feedback.php`);
    const feedback = await res.json();

    list.innerHTML = '';
    feedback.forEach(f => {
      const row = document.createElement('div');
      row.style.padding = '6px 0';
      row.style.borderBottom = '1px solid #eee';
      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;">
          <span>👤 ${esc(f.user)} <span style="color:var(--muted);">(${esc(f.type)})</span></span>
          <span>${esc(f.date)}</span>
        </div>
        <div style="color:var(--ink);margin-top:2px;">${esc(f.message)}</div>
      `;
      list.appendChild(row);
    });
  } catch(err){
    list.innerHTML = '<div style="color:var(--danger);">Could not load feedback.</div>';
    console.error(err);
  }
}

function selectFeedbackType(type, btn){
  currentFeedbackType = type;
  document.querySelectorAll('#feedback .cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

async function submitFeedback(){
  const textarea = document.getElementById('feedbackText');
  const message = textarea.value.trim();

  if(!message){
    alert('Please write your feedback first.');
    return;
  }

  try{
    const res = await fetch(`${API_BASE}/feedback.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: currentFeedbackType, message })
    });

    if(!res.ok){
      const data = await res.json();
      alert(data.error || 'Could not submit feedback.');
      return;
    }

    textarea.value = '';
    loadFeedback();
  } catch(err){
    alert('Could not submit feedback. Check that XAMPP (Apache + MySQL) is running.');
    console.error(err);
  }
}

// ------------------------------------------------------------
// REQUESTS (Request Price Update / Request Product)
// ------------------------------------------------------------
function openRequestForm(type){
  currentRequestType = type;
  document.getElementById('requestFormBox').style.display = 'block';
  document.getElementById('requestFormTitle').textContent = type === 'Price Update'
    ? 'Request a Price Update'
    : 'Request a New Product';
  document.getElementById('requestDetails').value = '';
}

async function submitRequest(){
  const details = document.getElementById('requestDetails').value.trim();

  if(!details){
    alert('Please describe your request first.');
    return;
  }

  try{
    const res = await fetch(`${API_BASE}/requests.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: currentRequestType, details })
    });

    if(!res.ok){
      const data = await res.json();
      alert(data.error || 'Could not submit request.');
      return;
    }

    document.getElementById('requestFormBox').style.display = 'none';
    loadRequests();
  } catch(err){
    alert('Could not submit request. Check that XAMPP (Apache + MySQL) is running.');
    console.error(err);
  }
}

async function loadRequests(){
  const list = document.getElementById('requestList');
  if(!list) return;

  try{
    const res = await fetch(`${API_BASE}/requests.php`);
    const requests = await res.json();

    if(requests.length === 0){
      list.innerHTML = '<span style="color:var(--muted);">No requests submitted yet.</span>';
      return;
    }

    list.innerHTML = '';
    requests.forEach(r => {
      const row = document.createElement('div');
      row.style.padding = '6px 0';
      row.style.borderBottom = '1px solid #eee';
      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;">
          <span><b>${esc(r.type)}</b> - ${esc(r.details)}</span>
          <span style="color:var(--muted);">${esc(r.status)}</span>
        </div>
      `;
      list.appendChild(row);
    });
  } catch(err){
    list.innerHTML = '<span style="color:var(--danger);">Could not load requests.</span>';
    console.error(err);
  }
}

// ------------------------------------------------------------
// Check login state as soon as the page loads
// ------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  checkSession();
});

// ------------------------------------------------------------
// PROFILE & SETTINGS (signed-in staff)
// ------------------------------------------------------------
function setProfileMessage(id, text, kind){
  const box = document.getElementById(id);
  if(!box) return;
  box.textContent = text || '';
  if(kind) box.dataset.kind = kind; else delete box.dataset.kind;
}

async function loadProfile(){
  if(!currentUser){
    showScreen('home');
    return;
  }
  try{
    const res = await fetch(`${API_BASE}/profile.php`);
    const data = await res.json();
    if(!res.ok) throw new Error(data.error || 'Could not load your profile.');

    document.getElementById('profileName').textContent = data.full_name;
    document.getElementById('profileEmail').textContent = data.email;
    document.getElementById('profileRole').textContent = 'Role: ' + String(data.role).replace('_', ' ');
    document.getElementById('profileJoined').textContent = data.joined ? 'Member since ' + data.joined : '';
    document.getElementById('profileAvatar').textContent = (data.full_name || '?').trim().charAt(0).toUpperCase();
    document.getElementById('editName').value = data.full_name;
    document.getElementById('editEmail').value = data.email;
  } catch(err){
    document.getElementById('profileName').textContent = 'Could not load your profile';
    console.error(err);
  }
}

function openEditProfile(){
  showScreen('editProfile');
  setProfileMessage('editProfileMessage', '');
  document.getElementById('editCurrentPassword').value = '';
  document.getElementById('editNewPassword').value = '';
  loadProfile();
}

async function saveProfile(){
  const full_name = document.getElementById('editName').value.trim();
  const current_password = document.getElementById('editCurrentPassword').value;
  const new_password = document.getElementById('editNewPassword').value;

  if(!full_name){
    setProfileMessage('editProfileMessage', 'Enter your name.', 'error');
    return;
  }
  if(new_password && !current_password){
    setProfileMessage('editProfileMessage', 'Enter your current password to set a new one.', 'error');
    return;
  }

  try{
    const res = await fetch(`${API_BASE}/profile.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name, current_password, new_password })
    });
    const data = await res.json();
    if(!res.ok){
      setProfileMessage('editProfileMessage', data.error || 'Could not save your changes.', 'error');
      return;
    }

    currentUser.full_name = data.full_name;
    updateAccountBadge();
    document.getElementById('editCurrentPassword').value = '';
    document.getElementById('editNewPassword').value = '';
    setProfileMessage('editProfileMessage', data.passwordChanged ? 'Saved. Your password was changed.' : 'Saved.');
    loadProfile();
  } catch(err){
    setProfileMessage('editProfileMessage', 'Could not reach the server. Check that Apache and MySQL are running.', 'error');
    console.error(err);
  }
}

function clearBudgetData(){
  if(!confirm('Remove the budget and all expenses saved on this device?')) return;
  try{ localStorage.removeItem('tipidgo.budget.v1'); } catch(err){ /* ignore */ }
  if(typeof renderBudget === 'function') renderBudget();
  setProfileMessage('settingsMessage', 'Budget data cleared.');
}

const API_ROOT = '../api';
let dashboardData = null;

async function requestJson(url, options){
  const response = await fetch(url, options);
  const data = await response.json();
  if(!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function showMessage(message, kind = ''){
  const element = document.getElementById('ownerMessage');
  element.textContent = message;
  element.dataset.kind = kind;
}

function renderProductOptions(selectedId = ''){
  const select = document.getElementById('productSelect');
  select.replaceChildren();

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = 'Choose a product';
  select.appendChild(placeholder);

  dashboardData.products.forEach(product => {
    const option = document.createElement('option');
    option.value = product.id;
    option.textContent = product.name;
    select.appendChild(option);
  });

  if(selectedId) select.value = String(selectedId);
}

function renderPrices(){
  const body = document.getElementById('ownerPriceRows');
  body.replaceChildren();
  document.getElementById('priceCount').textContent = `${dashboardData.prices.length} prices`;

  if(dashboardData.prices.length === 0){
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.className = 'staff-empty';
    cell.textContent = 'No prices have been added for this store yet.';
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  dashboardData.prices.forEach(price => {
    const row = document.createElement('tr');
    [price.name, price.category, `PHP ${price.price.toFixed(2)}`, price.lastUpdated].forEach(value => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.appendChild(cell);
    });
    body.appendChild(row);
  });
}

async function loadDashboard(){
  const selectedId = document.getElementById('productSelect').value;
  dashboardData = await requestJson(`${API_ROOT}/owner_dashboard.php`);
  document.getElementById('storeName').textContent = dashboardData.store.name;
  document.getElementById('storeLocation').textContent = dashboardData.store.location || 'Location not listed';
  renderProductOptions(selectedId);
  renderPrices();
}

function selectCurrentPrice(){
  if(!dashboardData) return;
  const productId = Number(document.getElementById('productSelect').value);
  const currentPrice = dashboardData.prices.find(price => price.productId === productId);
  document.getElementById('priceInput').value = currentPrice ? currentPrice.price.toFixed(2) : '';
}

async function savePrice(event){
  event.preventDefault();
  const productId = Number(document.getElementById('productSelect').value);
  const price = Number(document.getElementById('priceInput').value);
  const button = document.getElementById('savePriceButton');

  if(!productId || !Number.isFinite(price) || price <= 0){
    showMessage('Choose a product and enter a price greater than zero.', 'error');
    return;
  }

  button.disabled = true;
  button.textContent = 'Saving...';
  try{
    const result = await requestJson(`${API_ROOT}/owner_prices.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: productId, price })
    });
    const message = result.status === 'added'
      ? 'Price added to your store.'
      : result.status === 'updated'
        ? 'Store price updated.'
        : 'That price is already current.';
    showMessage(message, 'success');
    await loadDashboard();
    document.getElementById('priceInput').value = result.price.toFixed(2);
  } catch(error){
    showMessage(error.message, 'error');
  } finally{
    button.disabled = false;
    button.textContent = 'Save price';
  }
}

async function signOut(){
  await fetch(`${API_ROOT}/logout.php`, { method: 'POST' });
  window.location.href = 'index.html';
}

async function initializeOwnerDashboard(){
  try{
    const session = await requestJson(`${API_ROOT}/session.php`);
    if(!session.loggedIn){
      window.location.replace('index.html');
      return;
    }
    if(session.user.role === 'admin'){
      window.location.replace('admin.html');
      return;
    }
    if(session.user.role === 'moderator'){
      window.location.replace('moderator.html');
      return;
    }
    if(session.user.role !== 'store_owner'){
      window.location.replace('index.html');
      return;
    }

    document.getElementById('ownerName').textContent = session.user.full_name;
    await loadDashboard();
  } catch(error){
    showMessage(error.message, 'error');
  }
}

document.getElementById('priceForm').addEventListener('submit', savePrice);
document.getElementById('productSelect').addEventListener('change', selectCurrentPrice);
document.getElementById('refreshPrices').addEventListener('click', () => {
  loadDashboard().catch(error => showMessage(error.message, 'error'));
});
document.getElementById('logoutButton').addEventListener('click', signOut);
initializeOwnerDashboard();
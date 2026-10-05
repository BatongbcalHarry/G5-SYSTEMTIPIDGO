const API_ROOT = '../api';
let ownerApplications = [];

async function requestJson(url, options){
  const response = await fetch(url, options);
  const data = await response.json();
  if(!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function showMessage(message, kind = ''){
  const element = document.getElementById('staffMessage');
  element.textContent = message;
  element.dataset.kind = kind;
}

function showDashboardView(view){
  document.querySelectorAll('[data-panel]').forEach(panel => {
    panel.hidden = panel.dataset.panel !== view;
  });
  document.querySelectorAll('.staff-nav [data-view]').forEach(button => {
    button.classList.toggle('active', button.dataset.view === view);
  });
}

async function loadSummary(){
  const summary = await requestJson(`${API_ROOT}/admin_summary.php`);
  const fields = {
    products: 'statProducts',
    stores: 'statStores',
    prices: 'statPrices',
    users: 'statUsers',
    feedback: 'statFeedback',
    requests: 'statRequests',
    pendingOwnerApplications: 'statPendingOwners'
  };

  Object.entries(fields).forEach(([key, id]) => {
    document.getElementById(id).textContent = summary[key] ?? 0;
  });
  document.getElementById('pendingBadge').textContent = summary.pendingOwnerApplications || '';
}

function createCell(value){
  const cell = document.createElement('td');
  cell.textContent = value || '—';
  return cell;
}

function renderApplications(){
  const body = document.getElementById('applicationRows');
  const filter = document.getElementById('applicationFilter').value;
  const visibleApplications = ownerApplications.filter(application => filter === 'all' || application.status === filter);
  body.replaceChildren();

  if(visibleApplications.length === 0){
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 7;
    cell.className = 'staff-empty';
    cell.textContent = filter === 'pending' ? 'No pending store-owner applications.' : 'No applications in this view.';
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  visibleApplications.forEach(application => {
    const row = document.createElement('tr');
    row.append(createCell(`${application.fullName} (${application.email})`));
    row.append(createCell(application.storeName));
    row.append(createCell(application.storeLocation));
    const photoCell = document.createElement('td');
    if(application.photoAvailable){
      const photoLink = document.createElement('a');
      photoLink.href = `${API_ROOT}/owner_store_photo.php?id=${encodeURIComponent(application.id)}`;
      photoLink.target = '_blank';
      photoLink.rel = 'noopener noreferrer';
      photoLink.setAttribute('aria-label', `View store photo for ${application.storeName}`);
      const photo = document.createElement('img');
      photo.src = photoLink.href;
      photo.alt = `Store photo for ${application.storeName}`;
      photo.className = 'staff-store-photo';
      photoLink.appendChild(photo);
      photoCell.appendChild(photoLink);
    } else {
      photoCell.textContent = 'No photo';
    }
    row.appendChild(photoCell);
    row.append(createCell(application.submittedAt?.slice(0, 10)));

    const statusCell = document.createElement('td');
    const status = document.createElement('span');
    status.className = `staff-status ${application.status}`;
    status.textContent = application.status;
    statusCell.appendChild(status);
    row.appendChild(statusCell);

    const actionCell = document.createElement('td');
    const actions = document.createElement('div');
    actions.className = 'staff-actions';
    if(application.status === 'pending'){
      actions.append(
        createDecisionButton(application.id, 'approved', 'Approve'),
        createDecisionButton(application.id, 'rejected', 'Reject')
      );
    } else if(application.status === 'approved'){
      actions.appendChild(createDecisionButton(application.id, 'rejected', 'Revoke approval'));
    } else {
      actions.appendChild(createDecisionButton(application.id, 'approved', 'Reapprove'));
    }
    actionCell.appendChild(actions);
    row.appendChild(actionCell);
    body.appendChild(row);
  });
}

function createDecisionButton(id, decision, label){
  const button = document.createElement('button');
  button.className = `staff-action ${decision === 'approved' ? 'approve' : 'reject'}`;
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', () => reviewApplication(id, decision));
  return button;
}

async function loadApplications(){
  ownerApplications = await requestJson(`${API_ROOT}/owner_applications.php`);
  renderApplications();
  await loadSummary();
}

async function reviewApplication(id, decision){
  const label = decision === 'approved' ? 'approve' : 'reject';
  if(!window.confirm(`Are you sure you want to ${label} this store-owner application?`)) return;

  try{
    await requestJson(`${API_ROOT}/owner_applications.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, decision })
    });
    showMessage(`Application ${decision}.`, 'success');
    await loadApplications();
  } catch(error){
    showMessage(error.message, 'error');
  }
}

async function signOut(){
  await fetch(`${API_ROOT}/logout.php`, { method: 'POST' });
  window.location.href = 'index.html';
}

async function initializeAdmin(){
  try{
    const session = await requestJson(`${API_ROOT}/session.php`);
    if(!session.loggedIn){
      window.location.replace('index.html');
      return;
    }
    if(session.user.role === 'moderator'){
      window.location.replace('moderator.html');
      return;
    }
    if(session.user.role !== 'admin'){
      window.location.replace('index.html');
      return;
    }

    document.getElementById('staffName').textContent = session.user.full_name;
    await loadApplications();
  } catch(error){
    showMessage(error.message, 'error');
  }
}

document.querySelectorAll('.staff-nav [data-view], [data-view="applications"]').forEach(button => {
  button.addEventListener('click', () => showDashboardView(button.dataset.view));
});
document.getElementById('applicationFilter').addEventListener('change', renderApplications);
document.getElementById('logoutButton').addEventListener('click', signOut);
initializeAdmin();
const API_ROOT = '../api';

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

function makeCell(value){
  const cell = document.createElement('td');
  cell.textContent = value || '—';
  return cell;
}

function renderApplications(applications){
  const body = document.getElementById('applicationRows');
  body.replaceChildren();
  document.getElementById('pendingCount').textContent = applications.length || '';
  document.getElementById('pendingSummary').textContent = applications.length === 1
    ? '1 application needs a decision.'
    : `${applications.length} applications need a decision.`;

  if(applications.length === 0){
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 7;
    cell.className = 'staff-empty';
    cell.textContent = 'There are no pending store-owner applications.';
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }

  applications.forEach(application => {
    const row = document.createElement('tr');
    row.append(makeCell(application.fullName));
    row.append(makeCell(application.email));
    row.append(makeCell(application.storeName));
    row.append(makeCell(application.storeLocation));
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
    row.append(makeCell(application.submittedAt?.slice(0, 10)));

    const actionCell = document.createElement('td');
    const actions = document.createElement('div');
    actions.className = 'staff-actions';
    actions.append(
      createDecisionButton(application.id, 'approved', 'Approve'),
      createDecisionButton(application.id, 'rejected', 'Reject')
    );
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
  try{
    const applications = await requestJson(`${API_ROOT}/owner_applications.php`);
    renderApplications(applications);
  } catch(error){
    showMessage(error.message, 'error');
  }
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

async function initializeModerator(){
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
    if(session.user.role !== 'moderator'){
      window.location.replace('index.html');
      return;
    }

    document.getElementById('staffName').textContent = session.user.full_name;
    await loadApplications();
  } catch(error){
    showMessage(error.message, 'error');
  }
}

document.getElementById('refreshApplications').addEventListener('click', loadApplications);
document.getElementById('logoutButton').addEventListener('click', signOut);
initializeModerator();
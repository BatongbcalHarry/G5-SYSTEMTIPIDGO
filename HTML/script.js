if (window.location.protocol === 'file:') {
  const showFileProtocolNotice = () => {
    const notice = document.createElement('div');
    notice.style.cssText = [
      'max-width: 680px;',
      'margin: 72px auto 0;',
      'padding: 24px 28px;',
      'border: 1px solid #d8dfe8;',
      'border-radius: 14px;',
      'background: #fff;',
      'box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);',
      'font-family: Arial, sans-serif;',
      'color: #213247;',
      'line-height: 1.6;'
    ].join('');
    notice.innerHTML = [
      '<h2 style="margin:0 0 12px; font-size:28px;">TipidGo needs a web server</h2>',
      '<p style="margin:0 0 10px;">This app cannot run from a file:// page because the PHP API and database must be served by a browser-accessible server.</p>',
      '<p style="margin:0;">Start Apache + MySQL in XAMPP, then open <strong>http://localhost/tipidgo/HTML/</strong> in your browser.</p>'
    ].join('');
    document.body.innerHTML = '';
    document.body.appendChild(notice);
  };

  const attemptLocalRedirect = async () => {
    const candidates = [
      'http://localhost/tipidgo/HTML/',
      'http://127.0.0.1:8000/HTML/'
    ];

    for (const url of candidates) {
      try {
        const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
        if (response && typeof response.type === 'string') {
          window.location.replace(url);
          return;
        }
      } catch (error) {
        // The local server is not ready yet; fall back to the help notice below.
      }
    }

    showFileProtocolNotice();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attemptLocalRedirect, { once: true });
  } else {
    attemptLocalRedirect();
  }
}

const sidebarDestinations = {
  Home: 'home',
  Product: 'product',
  Stores: 'stores',
  Budget: 'budget',
  Feedback: 'feedback',
  Request: 'request',
  Administrator: 'administrator',
  Moderator: 'moderator',
  Verification: 'verifyInfo',
  Profile: 'profile',
  Setting: 'settings'
};

const sidebarScreenGroups = {
  productDetail: 'product',
  reviewStore: 'moderator',
  checkReports: 'moderator',
  verifyStoreAdmin: 'verifyInfo',
  verificationResult: 'verifyInfo',
  editProfile: 'profile'
};

function showScreen(id){
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');

    if(id === 'stores' && typeof renderStoreLocationMap === 'function'){
      renderStoreLocationMap();
    }

    const activeScreen = sidebarScreenGroups[id] || id;
    document.querySelectorAll('.sidebar').forEach(sidebar => {
      sidebar.querySelectorAll('.navitem').forEach(item => {
        item.classList.toggle('active', sidebarDestinations[item.textContent.trim()] === activeScreen);
      });
    });

  }

  document.addEventListener('click', event => {
    const item = event.target.closest('.sidebar .navitem');
    if(!item) return;

    event.preventDefault();
    const label = item.textContent.trim();
    if(label === 'Administrator'){
      window.location.href = 'admin.html';
      return;
    }
    if(label === 'Moderator'){
      window.location.href = 'moderator.html';
      return;
    }
    showScreen(sidebarDestinations[label]);
  });

  function applySearch(screen, query){
    const normalizedQuery = query.trim().toLowerCase();
    const category = screen.dataset.categoryFilter || 'all';

    screen.querySelectorAll('.product-item, .quickbox, .store-item, .content table tr').forEach(item => {
      if(item.querySelector('th')) return;

      const matchesText = item.textContent.toLowerCase().includes(normalizedQuery);
      const matchesCategory = !item.matches('.product-item') || category === 'all' || item.dataset.category === category;
      item.classList.toggle('search-hidden', !matchesText || !matchesCategory);
    });
  }

  document.addEventListener('input', event => {
    const input = event.target;
    if(!input.matches('.search[placeholder^="Search"]')) return;

    const screen = input.closest('.screen');
    screen.querySelectorAll('.search[placeholder^="Search"]').forEach(searchInput => {
      searchInput.value = input.value;
    });
    applySearch(screen, input.value);
  });

  // filters the product grid on the Product screen by category
  function filterCategory(category, btn){
    // highlight the clicked category button
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const screen = btn.closest('.screen');
    screen.dataset.categoryFilter = category;
    const searchInput = screen.querySelector('.search[placeholder^="Search"]');
    applySearch(screen, searchInput ? searchInput.value : '');
  }

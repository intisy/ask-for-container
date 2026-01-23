const urlParams = new URLSearchParams(window.location.search);
const requestId = urlParams.get('requestId');
const targetUrl = decodeURIComponent(urlParams.get('url') || '');

const containerColors = {
  blue: '#37adff',
  turquoise: '#00c79a',
  green: '#51cd00',
  yellow: '#ffcb00',
  orange: '#ff9f00',
  red: '#ff613d',
  pink: '#ff4bda',
  purple: '#af51f5',
  toolbar: '#7c7c7d'
};

const containerIcons = {
  fingerprint: '🔒',
  briefcase: '💼',
  dollar: '💰',
  cart: '🛒',
  circle: '⭕',
  gift: '🎁',
  vacation: '🏖️',
  food: '🍔',
  fruit: '🍇',
  pet: '🐱',
  tree: '🌲',
  chill: '❄️',
  fence: '🏠'
};

const urlDisplay = document.getElementById('urlDisplay');
const containerList = document.getElementById('containerList');
const toggleCreateBtn = document.getElementById('toggleCreate');
const createForm = document.getElementById('createForm');
const containerNameInput = document.getElementById('containerName');
const colorPicker = document.getElementById('colorPicker');
const iconPicker = document.getElementById('iconPicker');
const createContainerBtn = document.getElementById('createContainerBtn');
const noContainerBtn = document.getElementById('noContainerBtn');
const cancelBtn = document.getElementById('cancelBtn');

let selectedColor = 'blue';
let selectedIcon = 'fingerprint';

document.addEventListener('DOMContentLoaded', async () => {
  urlDisplay.textContent = targetUrl || 'Unknown URL';
  await loadContainers();
  setupEventListeners();
});

async function loadContainers() {
  try {
    const containers = await browser.runtime.sendMessage({ action: 'getContainers' });
    if (containers && containers.length > 0) {
      containerList.innerHTML = containers.map(container => `
        <div class="container-item" data-id="${container.cookieStoreId}">
          <div class="container-icon" style="background: ${containerColors[container.color] || container.colorCode || '#7c7c7d'}20; color: ${containerColors[container.color] || container.colorCode || '#7c7c7d'}">
            ${containerIcons[container.icon] || '📦'}
          </div>
          <span class="container-name">${escapeHtml(container.name)}</span>
          <span class="container-arrow">→</span>
        </div>
      `).join('');
      containerList.querySelectorAll('.container-item').forEach(item => {
        item.addEventListener('click', () => openInContainer(item.dataset.id));
      });
    } else {
      containerList.innerHTML = '<div class="no-containers">No containers found. Create one below!</div>';
    }
  } catch (error) {
    containerList.innerHTML = '<div class="no-containers">Error loading containers</div>';
  }
}

function setupEventListeners() {
  toggleCreateBtn.addEventListener('click', () => {
    createForm.classList.toggle('hidden');
    if (!createForm.classList.contains('hidden')) {
      containerNameInput.focus();
    }
  });
  
  colorPicker.querySelectorAll('.color-option').forEach(btn => {
    btn.addEventListener('click', () => {
      colorPicker.querySelectorAll('.color-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedColor = btn.dataset.color;
    });
  });
  
  iconPicker.querySelectorAll('.icon-option').forEach(btn => {
    btn.addEventListener('click', () => {
      iconPicker.querySelectorAll('.icon-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedIcon = btn.dataset.icon;
    });
  });
  
  createContainerBtn.addEventListener('click', createAndOpen);
  containerNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') createAndOpen();
  });
  noContainerBtn.addEventListener('click', openWithoutContainer);
  cancelBtn.addEventListener('click', cancel);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cancel();
  });
}

async function openInContainer(containerId) {
  try {
    await browser.runtime.sendMessage({
      action: 'openInContainer',
      requestId: requestId,
      containerId: containerId,
      url: targetUrl
    });
  } catch (error) {}
}

async function createAndOpen() {
  const name = containerNameInput.value.trim();
  if (!name) {
    containerNameInput.focus();
    containerNameInput.style.borderColor = '#f85149';
    setTimeout(() => { containerNameInput.style.borderColor = ''; }, 2000);
    return;
  }
  try {
    const container = await browser.runtime.sendMessage({
      action: 'createContainer',
      name: name,
      color: selectedColor,
      icon: selectedIcon
    });
    await openInContainer(container.cookieStoreId);
  } catch (error) {}
}

async function openWithoutContainer() {
  try {
    await browser.runtime.sendMessage({
      action: 'openWithoutContainer',
      requestId: requestId,
      url: targetUrl
    });
  } catch (error) {}
}

async function cancel() {
  try {
    await browser.runtime.sendMessage({
      action: 'cancel',
      requestId: requestId
    });
  } catch (error) {}
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

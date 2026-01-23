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

document.addEventListener('DOMContentLoaded', async () => {
  const containerList = document.getElementById('containerList');
  try {
    const containers = await browser.contextualIdentities.query({});
    if (containers && containers.length > 0) {
      containerList.innerHTML = containers.map(container => `
        <div class="container-chip" style="border-color: ${containerColors[container.color] || '#7c7c7d'}40">
          <span class="icon">${containerIcons[container.icon] || '📦'}</span>
          <span>${escapeHtml(container.name)}</span>
        </div>
      `).join('');
    } else {
      containerList.innerHTML = '<div class="no-containers">No containers yet</div>';
    }
  } catch (error) {
    containerList.innerHTML = '<div class="no-containers">Error loading containers</div>';
  }
});

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

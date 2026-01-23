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
    containerList.textContent = '';
    if (containers && containers.length > 0) {
      containers.forEach(container => {
        const chip = document.createElement('div');
        chip.className = 'container-chip';
        chip.style.borderColor = (containerColors[container.color] || '#7c7c7d') + '40';

        const icon = document.createElement('span');
        icon.className = 'icon';
        icon.textContent = containerIcons[container.icon] || '📦';

        const name = document.createElement('span');
        name.textContent = container.name;

        chip.appendChild(icon);
        chip.appendChild(name);
        containerList.appendChild(chip);
      });
    } else {
      const noContainers = document.createElement('div');
      noContainers.className = 'no-containers';
      noContainers.textContent = 'No containers yet';
      containerList.appendChild(noContainers);
    }
  } catch (error) {
    containerList.textContent = '';
    const errorDiv = document.createElement('div');
    errorDiv.className = 'no-containers';
    errorDiv.textContent = 'Error loading containers';
    containerList.appendChild(errorDiv);
  }
});

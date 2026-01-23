# Ask for Container

A Firefox extension that prompts you to select or create a container when opening external links.

## Features

- **Intercept External Links**: When you click a link from another application (email client, chat app, etc.), a popup appears asking which container to use
- **Select Existing Containers**: Choose from your existing Multi-Account Containers
- **Create New Containers**: Create a new container on-the-fly with custom name, color, and icon
- **Skip Container**: Option to open the link without any container

## Requirements

- Firefox 57 or later
- [Mozilla Multi-Account Containers](https://addons.mozilla.org/en-US/firefox/addon/multi-account-containers/) extension (recommended but not required - containers are a built-in Firefox feature)

## Installation

### From Source (Developer Mode)

1. Open Firefox and navigate to `about:debugging`
2. Click "This Firefox" in the left sidebar
3. Click "Load Temporary Add-on..."
4. Navigate to this extension folder and select the `manifest.json` file
5. The extension is now installed (temporarily - it will be removed when Firefox closes)

### Permanent Installation

1. Zip all files in this directory (manifest.json, background.js, popup/, icons/)
2. Rename the `.zip` to `.xpi`
3. In Firefox, go to `about:addons`
4. Click the gear icon → "Install Add-on From File..."
5. Select the `.xpi` file

**Note**: For permanent installation without Mozilla signing, you need to use Firefox Developer Edition or Nightly and set `xpinstall.signatures.required` to `false` in `about:config`.

## Usage

1. Once installed, the extension runs automatically
2. When you open a link from an external application (like clicking a link in your email client or chat app), a popup window will appear
3. Choose an existing container, create a new one, or click "Open without Container"
4. The link will open in the selected container

## Container Colors

The extension supports all Firefox container colors:
- Blue, Turquoise, Green, Yellow, Orange, Red, Pink, Purple

## Container Icons

Available icons:
- 🔒 Fingerprint
- 💼 Briefcase
- 💰 Dollar
- 🛒 Cart
- ⭕ Circle
- 🎁 Gift
- 🏖️ Vacation
- 🍔 Food
- 🍇 Fruit
- 🐱 Pet
- 🌲 Tree
- ❄️ Chill

## How It Works

The extension monitors for new tabs being created with URLs that aren't internal Firefox pages. When it detects an external link being opened:

1. It captures the URL before the page loads
2. Opens a popup window with container options
3. Once you select a container, it closes the original tab and opens a new one in the selected container

## Permissions

This extension requires the following permissions:

- `contextualIdentities`: To read and create containers
- `cookies`: Required for container functionality
- `tabs`: To manage tabs (close original, open in container)
- `webNavigation`: To intercept navigation events
- `webRequest` / `webRequestBlocking`: To intercept requests
- `<all_urls>`: To work with any URL
- `storage`: To store preferences (future use)

## License

MIT License

# Custom Building Registration System Fixes (2026-01-20)

## Overview
Resolved issues preventing the "Deploy" function in the Building Designer (`building-designer.html`) from sending data to the Map Editor (`map-editor.html`). Implemented a robust communication system and added support for custom building persistence.

## Key Changes

### 1. Communication Upgrade
- **BroadcastChannel API**: Replaced reliance on `window.opener` with `BroadcastChannel('fantasy-rts-editor')`. This allows the designer and editor to communicate even when opened in separate tabs or windows without a direct parent-child relationship.
- **Fallback**: Retained `window.opener.postMessage` as a fallback mechanism.

### 2. Map Editor Enhancements (`map-editor.html`)
- **Custom Building Registration**: Implemented `registerCustomBuilding` to handle incoming building data.
    - **Name Support**: Added a prompt to name the custom building upon registration.
    - **Persistence**: Saved custom definitions to `map.customBuildingDefinitions` so they persist through save/load cycles.
- **UI Updates**:
    - **Dynamic Buttons**: Updated `generateBuildingButtons` to render buttons for custom buildings alongside standard templates.
    - **Auto-Scroll**: Automatically scrolls to the newly added button in the toolbar.
    - **Manual Import**: Added a **"📋 JSON貼付" (Paste JSON)** button to the toolbar. This allows users to manually import building JSON from the clipboard if the direct connection fails.
- **Rendering**:
    - Introduced `getTemplate(id)` to unify retrieval of standard and custom building data.
    - Updated 2D canvas rendering and 3D preview logic to support custom definitions.

### 3. Verification
- **Test deployment**: Verified that clicking "Deploy" in the designer now triggers a prompt in the editor.
- **Manual Import**: Verified that copying JSON from the designer's "Export" modal and pasting it in the editor correctly registers the building.

## Files Modified
- `c:\fantasyrts\map-editor.html`
- `c:\fantasyrts\building-designer.html`

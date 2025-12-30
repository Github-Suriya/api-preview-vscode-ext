# Change Log

All notable changes to the "API Preview" extension will be documented in this file.

## [0.3.3] - 2025-12-30
### Added
- **Folder Support**: You can now organize your saved requests into folders for better project structure.

### Changed
- **UI Overhaul**: Switched from a side-by-side layout to a **Top-Bottom Split Layout** (Postman-style) for better usability on smaller screens.
- **Resizable Panes**: Added a draggable handle between the Request and Response sections, allowing users to adjust the height of the editor area.
- **Responsive Design**: The response pane now takes up the full width at the bottom, making large JSON responses easier to read.

## [0.3.0] - 2025-12-23
### Added
- **Environment Variables Support**: You can now define variables in your VS Code settings (`apiPreview.variables`) and use them in your requests (e.g., `{{baseUrl}}/api/v1`).
- **Sidebar "New Request" Button**: Added a `+` icon in the "Saved Requests" view title to quickly open a blank request panel.
- **Variable Processor**: Automatically parses and replaces `{{variable}}` syntax in URLs, Headers, and JSON Bodies before sending.

### Changed
- Improved the "Save Request" workflow to allow updating existing requests or creating new ones with unique IDs.
- Refactored `ApiPreviewPanel` to separate UI logic from variable processing logic.

## [0.1.5] - 2025-12-20
### Added
- **Sidebar History**: Introduced the "Saved Requests" view in the Activity Bar to manage your API history.
- **JSON Tree Viewer**: Responses are now rendered in a collapsible, color-coded JSON tree for better readability.
- **Workspace Persistence**: Saved requests are now stored in the Workspace State, persisting across VS Code reloads.
- **One-Click Loading**: Clicking a request in the sidebar instantly loads the Method, URL, Headers, and Body into the preview panel.
- **Status Indicators**: Added visual badges for HTTP Status codes (Green for 2xx, Red for 4xx/5xx).
- **Performance Metrics**: Added Response Time (ms) and Response Size (bytes) indicators.

### Fixed
- Fixed layout issues where the response area would not scroll independently of the input area.
- Improved error handling for invalid JSON in the Request Body tab.

## [0.0.1] - 2025-12-18
### Initial Release
- Basic HTTP Request functionality (GET, POST, PUT, DELETE, PATCH).
- Dual-tab interface for Request Body and Headers.
- Raw JSON response viewer.
- Simple "Send" and "Reset" functionality.
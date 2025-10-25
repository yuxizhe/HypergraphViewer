# HypergraphViewer

A Hypergraph Visualization Framework in JavaScript. Support JSON/HIF/Hypergraph-DB/Hyper-RAG

## Hypergraph-DB

<img width="100%" alt="image" src="https://github.com/user-attachments/assets/f9c36051-43c5-4e49-a725-08276aa99833" />

## Hyper-RAG

<img width="100%" alt="image" src="https://github.com/user-attachments/assets/2f42d377-c56d-45f8-ad33-0f50c1a98de7" />

<img width="100%" alt="image" src="https://github.com/user-attachments/assets/f9c6b3d6-619d-41b3-9765-29c0f1f8736d" />

## Features

- 🔍 **Search Functionality**: Search by vertex ID, entity type, or description
- 📊 **Dual Mode Visualization**:
  - Hypergraph Mode: Displays hyperedges and bubble collections
  - Graph Mode: Traditional node-edge graph visualization
- 🎨 **Interactive Interface**:
  - Mouse hover for detailed information
  - Draggable graph elements
  - Zoom and pan functionality
- 📝 **Details Panel**: Real-time display of hyperedge and node properties
- 🎯 **Pagination**: Efficient handling of large datasets

## Tech Stack

- **React 19**: Frontend framework
- **Vite**: Build tool and development server
- **G6 (Local version)**: Graph visualization library - uses local g6.min.js file
- **Tailwind CSS v4**: Styling framework
- **JavaScript/JSX**: Development language

## Installation and Setup

### 1. Install Dependencies

```bash
# Using yarn (recommended)
yarn install

# Or using npm (may require permission fixes)
npm install
```

### 2. Start Development Server

```bash
# Using yarn
yarn dev

# Or using npm
npm run dev
```

### 3. Access Application

Open your browser and visit: http://localhost:5173

## Project Structure

```
src/
├── components/
│   └── HypergraphViewer.jsx    # Main hypergraph visualization component
├── data.js                     # Data file
├── index.css                   # Global styles
├── App.jsx                     # Root application component
└── main.jsx                    # Application entry point
```

## Data Format

The application uses the following data formats:

- **Database Info**: Basic database information (vertex count, hyperedge count)
- **Vertices**: Array of vertices containing ID, type, degree, description, etc.
- **Graphs**: Graph data indexed by vertex ID, including related vertices and edges

## Usage Instructions

1. **Search Vertices**: Enter keywords in the left search box
2. **Select Vertices**: Click on any vertex in the left list
3. **Toggle Modes**: Use the mode toggle button at the top
4. **View Details**: Hover over graph elements to see detailed information
5. **Interact**: Supports drag, zoom, pan operations

## Build for Production

```bash
# Build
yarn build

# Preview build result
yarn preview
```

## Local G6 Integration

This project uses a local `g6.min.js` file instead of the npm package:

- **G6 File Location**: `public/g6.min.js`
- **Loading Method**: Loaded via HTML `<script>` tag
- **Usage**: Accessed through `window.G6.Graph`

This approach ensures complete consistency with the original HTML template's G6 version and functionality.

## Development Notes

This project fully recreates the functionality of the original HTML template, including:

- Complete G6 graph visualization logic
- Hyperedge bubble collection rendering
- Real-time search and filtering
- Responsive UI design
- Detailed data display panels

All original visualization effects, interactive features, and data processing logic have been completely preserved.

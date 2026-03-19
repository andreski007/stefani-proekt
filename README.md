# Robotic Tic-Tac-Toe — v2 (3D Edition)

A 3D simulation of a robotic tic-tac-toe system featuring a Three.js rendered board,
animated robot arm with inverse kinematics, minimax AI, vision-based control,
and Player vs Player mode.

---

## Project Structure

```
robotic-tictactoe-v2/
├── public/
│   └── index.html
├── src/
│   ├── index.js               # Entry point
│   ├── index.css              # Global dark theme styles
│   ├── App.js                 # App wrapper
│   └── components/
│       ├── RoboticTicTacToe.js  # Main orchestrator (game loop, state)
│       ├── Scene3D.js           # Three.js 3D scene (board, arm, pieces)
│       ├── HUD.js               # UI overlay panels (scores, log, AI)
│       └── gameLogic.js         # Board eval, minimax, PvP logic
├── package.json
└── README.md
```

---

## How to Run

### Prerequisites

- **Node.js** version 16+ — download from https://nodejs.org/

### Steps

1. **Open the folder in VS Code**
   - `File → Open Folder → select robotic-tictactoe-v2`

2. **Open the terminal**
   - Press `Ctrl + `` ` (backtick) in VS Code

3. **Install dependencies**
   ```bash
   npm install
   ```
   This installs React, Three.js, React Three Fiber, and Drei.
   Takes ~2 minutes on first run. Deprecation warnings are normal.

4. **Start the app**
   ```bash
   npm start
   ```

5. **Open in browser**
   - Automatically opens at `http://localhost:3000`
   - Use Chrome or Edge for best WebGL performance

---

## Game Modes

| Mode     | Description                                          |
|----------|------------------------------------------------------|
| **PvP**  | Player 1 (X) vs Player 2 (O) — both click the board |
| **Easy** | Player vs AI — robot makes 60% random moves          |
| **Medium** | Player vs AI — 25% random, 75% optimal             |
| **Hard** | Player vs AI — pure minimax (unbeatable)             |
| **Auto** | Robot vs Robot demo — watch the AI play itself        |

### PvP Mode
- Both players click directly on the 3D board
- Custom player names can be entered in the right panel
- The robot arm animates for both players' moves
- Win detection highlights the winning line in gold with glow effects

---

## Controls

- **Click** on empty cells to place your piece
- **Drag** the 3D viewport to orbit the camera
- **Scroll** to zoom in/out
- **Vision** checkbox toggles the green scan overlay
- **New game** resets the current match (scores persist)
- Mode buttons reset the board and switch game mode

---

## Technical Architecture

### 1. 3D Rendering (Scene3D.js)
- **Three.js** via React Three Fiber for declarative 3D
- **X pieces**: Two crossed box geometries with metallic red material
- **O pieces**: Torus geometry with metallic blue material
- **Win animation**: Pieces spin + gold point lights
- **Robot arm**: Multi-joint arm with shoulder, elbow, gripper
  - Joints animate smoothly via `lerp` toward target cell
  - Gripper pulses and changes color (green=idle, red=moving)
- **Vision scan**: Translucent green plane that oscillates
- **OrbitControls**: Camera rotation, zoom with constraints
- **Lighting**: Ambient + directional + colored point lights

### 2. Game Logic (gameLogic.js)
- Board evaluation checks all 8 win lines
- **Minimax** with **alpha-beta pruning** — O(b^(d/2)) time
- Difficulty varies random-move probability
- Move evaluator classifies each option (WIN/OK/RISK/DRAW)

### 3. Game Controller (RoboticTicTacToe.js)
- State machine managing turns, animations, AI triggers
- Pipeline per move: click → arm animate → place → evaluate → next
- PvP: both players trigger through `handleCellClick`
- PvE: human clicks trigger `processMove`, then `doAiTurn`
- Auto: `useEffect` watches for AI turns and auto-triggers

### 4. HUD Panels (HUD.js)
- **Player badges**: Active state glow, score counter
- **System log**: Color-coded event stream
- **AI analysis**: Visual move evaluation cards
- **Subsystems**: Live status indicators
- **Result overlay**: Win/draw announcement with replay button

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Black 3D viewport | Your browser may not support WebGL2 — use Chrome or Edge |
| Slow performance | Try reducing browser tab count or closing DevTools |
| `npm install` warnings | These are deprecation notices in sub-dependencies — safe to ignore |
| Can't click cells | Check the status bar — it may be the AI's turn or the game is over |
| Pieces don't appear | Orbit the camera — they may be below the viewing angle |

---

## Built With

- **React 18** — Component framework
- **Three.js** — 3D rendering engine
- **React Three Fiber** — React renderer for Three.js
- **@react-three/drei** — Helper components (OrbitControls, Text, RoundedBox)
- **Outfit** — Display typeface
- **JetBrains Mono** — Monospace typeface

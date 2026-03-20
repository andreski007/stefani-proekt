import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  EMPTY, X_PLAYER, O_PLAYER, GAME_MODE,
  evaluateBoard, getBestMove
} from './gameLogic';
import Scene3D from './Scene3D';
import CameraFeed, { VISION_STAGE } from './CameraFeed';
import {
  PlayerBadge, SystemLog, DecisionPanel,
  SubsystemsPanel, GameResultOverlay, ModeButton
} from './HUD';

export default function RoboticTicTacToe() {
  // ── State ──────────────────────────────────────────────

  const [board, setBoard] = useState(Array(9).fill(EMPTY));
  const [currentPlayer, setCurrentPlayer] = useState(X_PLAYER);
  const [gameResult, setGameResult] = useState(null);
  const [winLine, setWinLine] = useState(null);
  const [gameMode, setGameMode] = useState(GAME_MODE.PVE_HARD);

  // Player names
  const [p1Name, setP1Name] = useState("Player 1");
  const [p2Name, setP2Name] = useState("Robot");

  // Robot state
  const [robotTarget, setRobotTarget] = useState(null);
  const [isArmMoving, setIsArmMoving] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawSymbol, setDrawSymbol] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showVision, setShowVision] = useState(true);
  const [bestMove, setBestMove] = useState(-1);

  // Camera / vision pipeline state
  const [visionStage, setVisionStage] = useState(VISION_STAGE.IDLE);
  const [detectedBoard, setDetectedBoard] = useState(null);

  // Scores
  const [scores, setScores] = useState({ x: 0, o: 0, draws: 0 });

  // Log
  const [log, setLog] = useState([]);

  // Processing flag
  const processingRef = useRef(false);
  const timersRef = useRef([]);

  const addLog = useCallback((msg) => {
    setLog(prev => [...prev.slice(-24), { t: Date.now(), msg }]);
  }, []);

  // Helper to schedule timeouts that get cleaned up on reset
  const scheduleTimeout = useCallback((fn, delay) => {
    const id = setTimeout(fn, delay);
    timersRef.current.push(id);
    return id;
  }, []);

  // ── Determine who is human / AI ───────────────────────

  const isPvP = gameMode === GAME_MODE.PVP;
  const isAuto = gameMode === GAME_MODE.AUTO;
  const robotSymbol = O_PLAYER;

  // ── Process a move (arm moves, piece placed) ──────────

  const processMove = useCallback((idx, symbol, currentBoard) => {
    processingRef.current = true;
    setRobotTarget(idx);
    setIsArmMoving(true);

    const prefix = isPvP ? '[PVP]' : '[ARM]';
    addLog(`${prefix} ${symbol} → cell [${Math.floor(idx / 3)},${idx % 3}]`);

    const TRAVEL_MS = 700;   // arm travels to cell
    const DRAW_MS   = 800;   // arm draws the symbol

    // Phase 1: arm arrives, mark appears, drawing animation begins
    scheduleTimeout(() => {
      const updated = [...currentBoard];
      updated[idx] = symbol;
      setBoard(updated);
      setIsDrawing(true);
      setDrawSymbol(symbol);
      addLog(`[PLACE] ${symbol} placed at [${Math.floor(idx / 3)},${idx % 3}]`);
    }, TRAVEL_MS);

    // Phase 2: drawing complete, process game state
    scheduleTimeout(() => {
      setIsDrawing(false);
      setIsArmMoving(false);
      setIsScanning(false);
      setVisionStage(VISION_STAGE.IDLE);

      const updated = [...currentBoard];
      updated[idx] = symbol;

      // Check game end
      const result = evaluateBoard(updated);
      if (result.winner) {
        setGameResult(result.winner);
        setWinLine(result.line);
        setRobotTarget(null);

        if (result.winner === 'draw') {
          addLog('[GAME] Draw — no moves remaining');
          setScores(s => ({ ...s, draws: s.draws + 1 }));
        } else {
          const name = result.winner === X_PLAYER ? p1Name : p2Name;
          addLog(`[GAME] ${name} (${result.winner}) wins!`);
          setScores(s => ({
            ...s,
            [result.winner === X_PLAYER ? 'x' : 'o']: s[result.winner === X_PLAYER ? 'x' : 'o'] + 1
          }));
        }
        processingRef.current = false;
        return;
      }

      // Next turn
      const next = symbol === X_PLAYER ? O_PLAYER : X_PLAYER;
      setCurrentPlayer(next);

      if ((isPvP === false || isAuto) && ((isAuto) || (next === robotSymbol))) {
        scheduleTimeout(() => runVisionPipeline(updated, next), 400);
      } else {
        setRobotTarget(null);
        processingRef.current = false;
      }
    }, TRAVEL_MS + DRAW_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPvP, isAuto, robotSymbol, addLog, p1Name, p2Name, scheduleTimeout]);

  // ── Vision pipeline: Camera → Process → Detect → AI ──

  const runVisionPipeline = useCallback((currentBoard, aiPlayer) => {
    processingRef.current = true;

    // ── Stage 1: CAPTURING (camera takes a snapshot) ────
    addLog('[VISION] Camera capturing frame...');
    setVisionStage(VISION_STAGE.CAPTURING);
    setIsScanning(true);

    scheduleTimeout(() => {
      addLog('[VISION] Frame captured (640x480 @ 30fps)');

      // ── Stage 2: PROCESSING (grayscale, edge detection, grid finding) ──
      addLog('[VISION] Converting to grayscale...');
      addLog('[VISION] Running Canny edge detection...');
      setVisionStage(VISION_STAGE.PROCESSING);

      scheduleTimeout(() => {
        addLog('[VISION] Hough transform — grid lines detected');
        addLog('[VISION] Grid segmented into 9 cells');

        // ── Stage 3: DETECTING (classify each cell) ──────
        addLog('[VISION] Classifying cell contents...');
        setVisionStage(VISION_STAGE.DETECTING);

        // Simulate the detection — "read" the board
        const detected = [...currentBoard];
        setDetectedBoard(detected);

        scheduleTimeout(() => {
          // Log each detected cell
          const xCount = detected.filter(c => c === X_PLAYER).length;
          const oCount = detected.filter(c => c === O_PLAYER).length;
          const emptyCount = detected.filter(c => c === EMPTY).length;
          addLog(`[VISION] Detected: ${xCount}×X, ${oCount}×O, ${emptyCount}×empty`);

          // ── Stage 4: COMPLETE — board state acquired ───
          setVisionStage(VISION_STAGE.COMPLETE);
          addLog('[VISION] Board state acquired ✓');

          scheduleTimeout(() => {
            // ── Now run AI decision ──────────────────────
            addLog(`[AI] Computing optimal move for ${aiPlayer}...`);
            const aiMode = isAuto ? GAME_MODE.PVE_HARD : gameMode;
            const move = getBestMove([...currentBoard], aiMode, aiPlayer);
            setBestMove(move);

            if (move >= 0) {
              addLog(`[AI] Minimax result → cell [${Math.floor(move / 3)},${move % 3}]`);

              scheduleTimeout(() => {
                processMove(move, aiPlayer, currentBoard);
              }, 300);
            } else {
              processingRef.current = false;
            }
          }, 400);
        }, 600);
      }, 800);
    }, 500);
  }, [addLog, gameMode, isAuto, processMove, scheduleTimeout]);

  // ── Human click ───────────────────────────────────────

  const handleCellClick = useCallback((idx) => {
    if (gameResult) return;
    if (processingRef.current) return;
    if (board[idx] !== EMPTY) return;

    if (!isPvP && !isAuto && currentPlayer === robotSymbol) return;

    processMove(idx, currentPlayer, board);
  }, [gameResult, board, isPvP, isAuto, currentPlayer, robotSymbol, processMove]);

  // ── Reset ─────────────────────────────────────────────

  const resetGame = useCallback(() => {
    // Clear all pending timeouts
    timersRef.current.forEach(id => clearTimeout(id));
    timersRef.current = [];

    processingRef.current = false;
    setBoard(Array(9).fill(EMPTY));
    setCurrentPlayer(X_PLAYER);
    setGameResult(null);
    setWinLine(null);
    setRobotTarget(null);
    setIsArmMoving(false);
    setIsDrawing(false);
    setDrawSymbol(null);
    setIsScanning(false);
    setBestMove(-1);
    setVisionStage(VISION_STAGE.IDLE);
    setDetectedBoard(null);
    addLog('[SYS] New game started');
  }, [addLog]);

  // ── Mode change ───────────────────────────────────────

  const changeMode = useCallback((newMode) => {
    timersRef.current.forEach(id => clearTimeout(id));
    timersRef.current = [];

    processingRef.current = false;
    setGameMode(newMode);
    setBoard(Array(9).fill(EMPTY));
    setCurrentPlayer(X_PLAYER);
    setGameResult(null);
    setWinLine(null);
    setRobotTarget(null);
    setIsArmMoving(false);
    setIsDrawing(false);
    setDrawSymbol(null);
    setIsScanning(false);
    setBestMove(-1);
    setVisionStage(VISION_STAGE.IDLE);
    setDetectedBoard(null);

    if (newMode === GAME_MODE.PVP) {
      setP2Name("Player 2");
      addLog('[SYS] Mode: Player vs Player');
    } else if (newMode === GAME_MODE.AUTO) {
      setP2Name("Robot");
      addLog('[SYS] Mode: Auto demo');
    } else {
      setP2Name("Robot");
      const diff = newMode === GAME_MODE.PVE_EASY ? 'Easy' : newMode === GAME_MODE.PVE_MED ? 'Medium' : 'Hard';
      addLog(`[SYS] Mode: vs AI (${diff})`);
    }
  }, [addLog]);

  // ── Auto-play trigger ─────────────────────────────────

  useEffect(() => {
    if (isAuto && !gameResult && !processingRef.current && board.some(c => c === EMPTY)) {
      const timer = setTimeout(() => {
        if (!processingRef.current) runVisionPipeline(board, currentPlayer);
      }, 600);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuto, gameResult, currentPlayer, board]);

  // ── Init ──────────────────────────────────────────────

  useEffect(() => {
    addLog('[SYS] Robotic system v2.1 initialized');
    addLog('[SYS] 3D renderer online');
    addLog('[SYS] IK solver ready');
    addLog('[VISION] Camera module initialized (640x480)');
    addLog('[VISION] OpenCV pipeline ready');
    addLog('[AI] Minimax engine loaded');
  }, [addLog]);

  // ── Can human click? ──────────────────────────────────

  const hoverEnabled = !gameResult && !processingRef.current && (
    isPvP || (!isAuto && currentPlayer !== robotSymbol)
  );

  // ── Render ────────────────────────────────────────────

  return (
    <div style={{ fontFamily: 'var(--font-display)' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <h1 style={{
            fontSize: 26, fontWeight: 700, color: 'var(--text-primary)',
            letterSpacing: '-0.02em', margin: 0,
          }}>
            Robotic Tic-Tac-Toe
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
            3D simulation · IK robot arm · Vision-based control · Minimax AI
          </p>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <ModeButton label="PvP" icon="⚔" active={gameMode === GAME_MODE.PVP}
            onClick={() => changeMode(GAME_MODE.PVP)} color="var(--accent-o)" />
          <ModeButton label="Easy" active={gameMode === GAME_MODE.PVE_EASY}
            onClick={() => changeMode(GAME_MODE.PVE_EASY)} color="var(--success)" />
          <ModeButton label="Medium" active={gameMode === GAME_MODE.PVE_MED}
            onClick={() => changeMode(GAME_MODE.PVE_MED)} color="var(--warning)" />
          <ModeButton label="Hard" active={gameMode === GAME_MODE.PVE_HARD}
            onClick={() => changeMode(GAME_MODE.PVE_HARD)} color="var(--danger)" />
          <ModeButton label="Auto" icon="⚡" active={gameMode === GAME_MODE.AUTO}
            onClick={() => changeMode(GAME_MODE.AUTO)} color="var(--accent-robot)" />
        </div>
      </div>

      {/* Main layout — 3 columns: viewport | camera | info panels */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 220px 260px',
        gap: 14,
        minHeight: 500,
      }}>

        {/* Column 1: 3D viewport */}
        <div style={{ position: 'relative' }}>
          {/* Player badges */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12,
            marginBottom: 12, alignItems: 'center',
          }}>
            <PlayerBadge
              symbol={X_PLAYER} name={p1Name}
              isActive={currentPlayer === X_PLAYER && !gameResult}
              score={scores.x} isRobot={isAuto}
            />
            <div style={{
              fontSize: 13, color: 'var(--text-muted)', fontWeight: 600,
              fontFamily: 'var(--font-mono)', textAlign: 'center', padding: '0 8px',
            }}>
              VS
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, fontWeight: 400 }}>
                {scores.draws} draws
              </div>
            </div>
            <PlayerBadge
              symbol={O_PLAYER} name={p2Name}
              isActive={currentPlayer === O_PLAYER && !gameResult}
              score={scores.o} isRobot={!isPvP}
            />
          </div>

          {/* 3D Scene */}
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            position: 'relative',
            height: 420,
          }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
              padding: '8px 14px',
              background: 'linear-gradient(to bottom, rgba(28,29,42,0.85) 0%, transparent 100%)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
            }}>
              <span>3D_VIEWPORT</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <input type="checkbox" checked={showVision} onChange={e => setShowVision(e.target.checked)}
                    style={{ accentColor: 'var(--accent-vision)' }} />
                  <span style={{ color: showVision ? 'var(--accent-vision)' : 'var(--text-muted)' }}>Vision</span>
                </label>
                <span>{isArmMoving ? '● ARM:ACTIVE' : '○ ARM:IDLE'}</span>
              </span>
            </div>

            <Scene3D
              board={board}
              winLine={winLine}
              onCellClick={handleCellClick}
              currentPlayer={currentPlayer}
              gameResult={gameResult}
              robotTarget={robotTarget}
              isArmMoving={isArmMoving}
              isDrawing={isDrawing}
              drawSymbol={drawSymbol}
              isScanning={isScanning}
              showVision={showVision}
              hoverEnabled={hoverEnabled}
            />

            <GameResultOverlay
              result={gameResult}
              xName={p1Name} oName={p2Name}
              onReset={resetGame}
            />
          </div>

          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: 10, padding: '0 4px',
          }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Drag to orbit · Scroll to zoom
            </span>
            <button onClick={resetGame} style={{
              padding: '6px 20px', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)', cursor: 'pointer',
              fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 500,
            }}>
              New game
            </button>
          </div>
        </div>

        {/* Column 2: Camera feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <CameraFeed
            board={board}
            visionStage={visionStage}
            detectedBoard={detectedBoard}
          />

          {/* Pipeline description */}
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '10px 14px',
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-tertiary)',
            lineHeight: 1.7,
          }}>
            <div style={{ color: 'var(--text-secondary)', fontWeight: 500, marginBottom: 4, fontSize: 11 }}>
              Vision pipeline
            </div>
            <div>1. Camera captures top-down frame</div>
            <div>2. Grayscale + Canny edge detection</div>
            <div>3. Hough transform finds grid lines</div>
            <div>4. Segment 9 cells, classify X/O/empty</div>
            <div>5. Board state → Minimax AI</div>
            <div>6. AI decision → IK → Robot arm</div>
          </div>
        </div>

        {/* Column 3: Info panels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {isPvP && (
            <div style={{
              ...cardStyle, padding: '12px 14px',
              display: 'flex', flexDirection: 'column', gap: 8,
            }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Player names
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={p1Name} onChange={e => setP1Name(e.target.value || "Player 1")}
                  placeholder="Player 1" style={inputStyle('var(--accent-x-dim)', 'var(--accent-x)')} />
                <input value={p2Name} onChange={e => setP2Name(e.target.value || "Player 2")}
                  placeholder="Player 2" style={inputStyle('var(--accent-o-dim)', 'var(--accent-o)')} />
              </div>
            </div>
          )}

          {!isPvP && <DecisionPanel board={board} bestMove={bestMove} robotSymbol={robotSymbol} />}

          <SystemLog log={log} />

          <SubsystemsPanel isArmMoving={isArmMoving} showVision={showVision} gameMode={gameMode} />
        </div>
      </div>
    </div>
  );
}

const cardStyle = {
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-lg)',
};

const inputStyle = (bg, borderColor) => ({
  flex: 1, padding: '6px 10px', borderRadius: 'var(--radius-sm)',
  background: bg, color: 'var(--text-primary)',
  border: `1px solid ${borderColor}33`,
  fontSize: 12, fontFamily: 'var(--font-display)',
  outline: 'none', width: '100%',
});

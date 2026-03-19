// ============================================
// GAME LOGIC — Board, Minimax AI, PvP support
// ============================================

export const EMPTY = null;
export const X_PLAYER = "X";
export const O_PLAYER = "O";

export const GAME_MODE = {
  PVP: "pvp",           // Player vs Player
  PVE_EASY: "pve_easy", // Player vs AI (easy)
  PVE_MED: "pve_med",   // Player vs AI (medium)
  PVE_HARD: "pve_hard", // Player vs AI (hard / unbeatable)
  AUTO: "auto"           // Robot vs Robot (demo)
};

export const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],  // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8],  // columns
  [0, 4, 8], [2, 4, 6]              // diagonals
];

/**
 * Evaluate the board for a winner or draw.
 */
export function evaluateBoard(board) {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a, b, c] };
    }
  }
  if (board.every(c => c !== EMPTY)) {
    return { winner: "draw", line: null };
  }
  return { winner: null, line: null };
}

/**
 * Minimax with alpha-beta pruning.
 */
function minimax(board, depth, isMaximizing, alpha, beta, maxP, minP) {
  const result = evaluateBoard(board);
  if (result.winner === maxP) return 10 - depth;
  if (result.winner === minP) return depth - 10;
  if (result.winner === "draw") return 0;

  if (isMaximizing) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === EMPTY) {
        board[i] = maxP;
        best = Math.max(best, minimax(board, depth + 1, false, alpha, beta, maxP, minP));
        board[i] = EMPTY;
        alpha = Math.max(alpha, best);
        if (beta <= alpha) break;
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === EMPTY) {
        board[i] = minP;
        best = Math.min(best, minimax(board, depth + 1, true, alpha, beta, maxP, minP));
        board[i] = EMPTY;
        beta = Math.min(beta, best);
        if (beta <= alpha) break;
      }
    }
    return best;
  }
}

/**
 * Get the best move for AI.
 */
export function getBestMove(board, mode, aiSymbol) {
  const humanSymbol = aiSymbol === X_PLAYER ? O_PLAYER : X_PLAYER;
  const empty = board.map((c, i) => c === EMPTY ? i : -1).filter(i => i >= 0);
  if (empty.length === 0) return -1;

  // Random chance based on difficulty
  const randChance = mode === GAME_MODE.PVE_EASY ? 0.6
    : mode === GAME_MODE.PVE_MED ? 0.25 : 0;

  if (Math.random() < randChance) {
    return empty[Math.floor(Math.random() * empty.length)];
  }

  let bestScore = -Infinity;
  let bestMove = empty[0];
  for (const i of empty) {
    board[i] = aiSymbol;
    const score = minimax(board, 0, false, -Infinity, Infinity, aiSymbol, humanSymbol);
    board[i] = EMPTY;
    if (score > bestScore) {
      bestScore = score;
      bestMove = i;
    }
  }
  return bestMove;
}

/**
 * Evaluate all possible moves for display.
 */
export function evaluateMoves(board, symbol) {
  const opponent = symbol === X_PLAYER ? O_PLAYER : X_PLAYER;
  const empty = board.map((c, i) => c === EMPTY ? i : -1).filter(i => i >= 0);

  return empty.map(i => {
    const b = [...board];
    b[i] = symbol;
    const r = evaluateBoard(b);
    if (r.winner === symbol) return { idx: i, score: 10, label: "WIN" };
    if (r.winner === "draw") return { idx: i, score: 0, label: "DRAW" };

    let risk = false;
    for (let j = 0; j < 9; j++) {
      if (b[j] === EMPTY) {
        b[j] = opponent;
        if (evaluateBoard(b).winner === opponent) { risk = true; b[j] = EMPTY; break; }
        b[j] = EMPTY;
      }
    }
    return risk ? { idx: i, score: -5, label: "RISK" } : { idx: i, score: 2, label: "OK" };
  });
}

/**
 * Get cell grid position.
 */
export function getCellPos(index) {
  return { row: Math.floor(index / 3), col: index % 3 };
}

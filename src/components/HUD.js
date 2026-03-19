import React from 'react';
import { X_PLAYER, O_PLAYER, evaluateMoves, getCellPos } from './gameLogic';

// ── Shared styles ──────────────────────────────────────────

const s = {
  card: {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
  },
  cardHeader: {
    padding: '8px 14px',
    borderBottom: '1px solid var(--border-subtle)',
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-tertiary)',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pill: (active, color) => ({
    fontSize: 10,
    padding: '2px 10px',
    borderRadius: 20,
    fontFamily: 'var(--font-mono)',
    fontWeight: 500,
    background: active ? (color || 'var(--accent-robot-dim)') : 'transparent',
    color: active ? '#fff' : 'var(--text-tertiary)',
    border: `1px solid ${active ? 'transparent' : 'var(--border-subtle)'}`,
  }),
};

// ── Player indicator ───────────────────────────────────────

export function PlayerBadge({ symbol, name, isActive, score, isRobot }) {
  const color = symbol === X_PLAYER ? 'var(--accent-x)' : 'var(--accent-o)';
  const glow = symbol === X_PLAYER ? 'var(--shadow-glow-x)' : 'var(--shadow-glow-o)';
  const dimBg = symbol === X_PLAYER ? 'var(--accent-x-dim)' : 'var(--accent-o-dim)';

  return (
    <div style={{
      ...s.card,
      padding: '14px 18px',
      borderColor: isActive ? color : 'var(--border-subtle)',
      boxShadow: isActive ? glow : 'none',
      transition: 'all 0.3s ease',
      position: 'relative',
      overflow: 'visible',
    }}>
      {isActive && (
        <div style={{
          position: 'absolute', top: -1, left: 14, right: 14, height: 2,
          background: color, borderRadius: '0 0 2px 2px',
        }} />
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 'var(--radius-md)',
          background: dimBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 20, fontWeight: 700, color: color,
          fontFamily: 'var(--font-display)',
        }}>
          {symbol}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {name}
            {isRobot && (
              <span style={{
                fontSize: 9, padding: '1px 6px', borderRadius: 20,
                background: 'var(--accent-robot-dim)', color: 'var(--accent-robot)',
                fontFamily: 'var(--font-mono)', fontWeight: 500,
              }}>BOT</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
            {isActive ? 'Thinking...' : 'Waiting'}
          </div>
        </div>
        <div style={{
          fontSize: 28, fontWeight: 700, color: color,
          fontFamily: 'var(--font-mono)',
          lineHeight: 1,
        }}>
          {score}
        </div>
      </div>
    </div>
  );
}

// ── System log ─────────────────────────────────────────────

export function SystemLog({ log }) {
  const logEndRef = React.useRef(null);

  React.useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [log]);

  const getColor = (msg) => {
    if (msg.includes('[AI]')) return 'var(--accent-robot)';
    if (msg.includes('[ARM]')) return 'var(--success)';
    if (msg.includes('[VISION]')) return 'var(--accent-vision)';
    if (msg.includes('[GAME]')) return 'var(--accent-x)';
    if (msg.includes('[PLACE]')) return 'var(--warning)';
    if (msg.includes('[PVP]')) return 'var(--accent-o)';
    return 'var(--text-tertiary)';
  };

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <span>System log</span>
        <span style={{ color: 'var(--success)', fontSize: 9 }}>● LIVE</span>
      </div>
      <div style={{
        padding: '8px 12px', maxHeight: 200, overflowY: 'auto',
        fontSize: 11, fontFamily: 'var(--font-mono)', lineHeight: 1.8,
      }}>
        {log.map((entry, i) => (
          <div key={i} style={{
            color: getColor(entry.msg),
            animation: 'slideIn 0.2s ease',
          }}>
            <span style={{ color: 'var(--text-muted)', marginRight: 6 }}>
              {new Date(entry.t).toLocaleTimeString('en', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            {entry.msg}
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}

// ── Decision tree ──────────────────────────────────────────

export function DecisionPanel({ board, bestMove, robotSymbol }) {
  const moves = evaluateMoves(board, robotSymbol);
  if (moves.length === 0 || bestMove < 0) return null;

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <span>AI analysis</span>
        <span style={{ color: 'var(--accent-robot)' }}>minimax</span>
      </div>
      <div style={{ padding: '10px 12px', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {moves.slice(0, 9).map((m, i) => {
          const isBest = m.idx === bestMove;
          const color = m.score >= 8 ? 'var(--success)' : m.score < 0 ? 'var(--danger)' : 'var(--warning)';
          const { row, col } = getCellPos(m.idx);
          return (
            <div key={i} style={{
              padding: '6px 10px', borderRadius: 'var(--radius-sm)',
              background: isBest ? 'var(--bg-elevated)' : 'var(--bg-tertiary)',
              border: isBest ? `1px solid ${color}` : '1px solid transparent',
              textAlign: 'center', minWidth: 48,
              boxShadow: isBest ? `0 0 10px ${color}33` : 'none',
            }}>
              <div style={{
                fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 500,
                color: isBest ? color : 'var(--text-secondary)',
              }}>
                [{row},{col}]
              </div>
              <div style={{
                fontSize: 9, fontFamily: 'var(--font-mono)',
                color: isBest ? color : 'var(--text-tertiary)',
                marginTop: 2,
              }}>
                {m.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Subsystems panel ───────────────────────────────────────

export function SubsystemsPanel({ isArmMoving, showVision, gameMode }) {
  const systems = [
    { name: 'Inverse kinematics', status: 'online', color: 'var(--success)' },
    { name: 'Vision system', status: showVision ? 'online' : 'off', color: showVision ? 'var(--accent-vision)' : 'var(--text-muted)' },
    { name: 'Minimax engine', status: 'online', color: 'var(--accent-robot)' },
    { name: 'Gripper servo', status: isArmMoving ? 'active' : 'idle', color: isArmMoving ? 'var(--warning)' : 'var(--text-tertiary)' },
    { name: 'Game controller', status: gameMode, color: 'var(--accent-o)' },
  ];

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <span>Subsystems</span>
      </div>
      <div style={{ padding: '8px 12px' }}>
        {systems.map((sys) => (
          <div key={sys.name} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '4px 0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%', background: sys.color,
                boxShadow: `0 0 6px ${sys.color}`,
              }} />
              {sys.name}
            </div>
            <span style={{
              fontSize: 10, fontFamily: 'var(--font-mono)', color: sys.color,
            }}>
              {sys.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Game result overlay ────────────────────────────────────

export function GameResultOverlay({ result, xName, oName, onReset }) {
  if (!result) return null;

  const isDraw = result === 'draw';
  const winnerName = result === X_PLAYER ? xName : result === O_PLAYER ? oName : null;
  const color = result === X_PLAYER ? 'var(--accent-x)' : result === O_PLAYER ? 'var(--accent-o)' : 'var(--warning)';

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(10, 10, 15, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 20, borderRadius: 'var(--radius-lg)',
      animation: 'fadeIn 0.3s ease',
    }}>
      <div style={{
        fontSize: 48, fontWeight: 700, color: color,
        fontFamily: 'var(--font-display)',
        textShadow: `0 0 40px ${color}`,
        marginBottom: 8,
      }}>
        {isDraw ? 'DRAW' : `${result} WINS`}
      </div>
      <div style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 28 }}>
        {isDraw ? 'No moves remaining' : `${winnerName} takes the round`}
      </div>
      <button onClick={onReset} style={{
        padding: '10px 32px', borderRadius: 'var(--radius-md)',
        background: 'var(--bg-elevated)', color: 'var(--text-primary)',
        border: `1px solid ${color}`, cursor: 'pointer',
        fontSize: 14, fontFamily: 'var(--font-display)', fontWeight: 500,
        transition: 'all 0.2s',
        boxShadow: `0 0 20px ${color}33`,
      }}>
        Play again
      </button>
    </div>
  );
}

// ── Mode selector button ───────────────────────────────────

export function ModeButton({ label, active, onClick, color, icon }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 16px',
      borderRadius: 'var(--radius-md)',
      background: active ? (color || 'var(--accent-robot)') : 'var(--bg-tertiary)',
      color: active ? '#fff' : 'var(--text-secondary)',
      border: `1px solid ${active ? 'transparent' : 'var(--border-subtle)'}`,
      cursor: 'pointer', fontSize: 12, fontFamily: 'var(--font-display)',
      fontWeight: 500, transition: 'all 0.2s',
      display: 'flex', alignItems: 'center', gap: 6,
      boxShadow: active ? `0 0 12px ${color || 'var(--accent-robot)'}44` : 'none',
    }}>
      {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
      {label}
    </button>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { EMPTY, X_PLAYER, O_PLAYER, getCellPos } from './gameLogic';

// ── Vision processing stages ────────────────────────────────
// These simulate what a real CV pipeline does:
// 1. IDLE        — camera waiting
// 2. CAPTURING   — camera takes a photo of the board
// 3. PROCESSING  — grayscale + edge detection + grid finding
// 4. DETECTING   — classify each cell (empty / X / O)
// 5. COMPLETE    — board state extracted, ready for AI

export const VISION_STAGE = {
  IDLE: 'idle',
  CAPTURING: 'capturing',
  PROCESSING: 'processing',
  DETECTING: 'detecting',
  COMPLETE: 'complete',
};

// ── Simulated camera feed — top-down board view ─────────────

export default function CameraFeed({ board, visionStage, detectedBoard }) {
  const canvasRef = useRef(null);
  const [scanY, setScanY] = useState(0);

  const cellSize = 52;
  const boardPx = cellSize * 3;
  const padding = 16;
  const totalSize = boardPx + padding * 2;

  // Animate scan line during PROCESSING stage
  useEffect(() => {
    if (visionStage !== VISION_STAGE.PROCESSING) {
      setScanY(0);
      return;
    }
    let frame;
    let start = performance.now();
    const duration = 800;
    const animate = (now) => {
      const t = ((now - start) % duration) / duration;
      setScanY(t * boardPx);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [visionStage, boardPx]);

  // Draw the camera feed onto canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = totalSize;
    const h = totalSize;
    canvas.width = w * 2;  // retina
    canvas.height = h * 2;
    ctx.scale(2, 2);

    // Background — simulated camera noise
    ctx.fillStyle = '#1a1e2e';
    ctx.fillRect(0, 0, w, h);

    // Slight noise texture
    for (let i = 0; i < 300; i++) {
      const nx = Math.random() * w;
      const ny = Math.random() * h;
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
      ctx.fillRect(nx, ny, 1, 1);
    }

    const ox = padding;
    const oy = padding;

    // Board background
    const isGrayscale = visionStage === VISION_STAGE.PROCESSING;

    ctx.fillStyle = isGrayscale ? '#3a3a3a' : '#3a4058';
    ctx.beginPath();
    ctx.roundRect(ox - 2, oy - 2, boardPx + 4, boardPx + 4, 4);
    ctx.fill();

    ctx.fillStyle = isGrayscale ? '#4a4a4a' : '#4a5070';
    ctx.fillRect(ox, oy, boardPx, boardPx);

    // Grid lines
    ctx.strokeStyle = isGrayscale ? '#777' : '#8090b8';
    ctx.lineWidth = 1.5;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(ox + i * cellSize, oy + 2);
      ctx.lineTo(ox + i * cellSize, oy + boardPx - 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ox + 2, oy + i * cellSize);
      ctx.lineTo(ox + boardPx - 2, oy + i * cellSize);
      ctx.stroke();
    }

    // Draw X and O marks
    const showDetection = visionStage === VISION_STAGE.DETECTING || visionStage === VISION_STAGE.COMPLETE;
    const sourceBoard = showDetection && detectedBoard ? detectedBoard : board;

    for (let idx = 0; idx < 9; idx++) {
      const cell = sourceBoard[idx];
      if (cell === EMPTY) continue;

      const { row, col } = getCellPos(idx);
      const cx = ox + col * cellSize + cellSize / 2;
      const cy = oy + row * cellSize + cellSize / 2;
      const r = cellSize * 0.32;

      if (cell === X_PLAYER) {
        ctx.strokeStyle = isGrayscale ? '#ccc' : '#ff4d6a';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - r, cy - r);
        ctx.lineTo(cx + r, cy + r);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx + r, cy - r);
        ctx.lineTo(cx - r, cy + r);
        ctx.stroke();
      } else if (cell === O_PLAYER) {
        ctx.strokeStyle = isGrayscale ? '#ccc' : '#00d4ff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Detection bounding boxes
      if (showDetection) {
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 2]);
        ctx.strokeRect(
          ox + col * cellSize + 4,
          oy + row * cellSize + 4,
          cellSize - 8,
          cellSize - 8
        );
        ctx.setLineDash([]);

        // Classification label
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.fillStyle = '#00ff88';
        ctx.fillText(
          cell,
          ox + col * cellSize + 6,
          oy + row * cellSize + 13
        );

        // Confidence score
        const conf = (85 + Math.random() * 14).toFixed(1);
        ctx.font = '7px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(0,255,136,0.6)';
        ctx.fillText(
          `${conf}%`,
          ox + col * cellSize + cellSize - 28,
          oy + row * cellSize + 13
        );
      }
    }

    // Detection boxes for empty cells too (during detecting)
    if (showDetection) {
      for (let idx = 0; idx < 9; idx++) {
        if (sourceBoard[idx] !== EMPTY) continue;
        const { row, col } = getCellPos(idx);
        ctx.strokeStyle = 'rgba(0,255,136,0.2)';
        ctx.lineWidth = 0.5;
        ctx.setLineDash([2, 3]);
        ctx.strokeRect(
          ox + col * cellSize + 4,
          oy + row * cellSize + 4,
          cellSize - 8,
          cellSize - 8
        );
        ctx.setLineDash([]);
        ctx.font = '7px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(0,255,136,0.3)';
        ctx.fillText('empty', ox + col * cellSize + 6, oy + row * cellSize + 13);
      }
    }

    // Processing scan line
    if (visionStage === VISION_STAGE.PROCESSING) {
      const gradient = ctx.createLinearGradient(ox, oy + scanY - 8, ox, oy + scanY + 8);
      gradient.addColorStop(0, 'rgba(0,255,136,0)');
      gradient.addColorStop(0.5, 'rgba(0,255,136,0.4)');
      gradient.addColorStop(1, 'rgba(0,255,136,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(ox, oy + scanY - 8, boardPx, 16);

      // Edge detection overlay hint
      ctx.strokeStyle = 'rgba(0,255,136,0.15)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(ox + i * cellSize, oy);
        ctx.lineTo(ox + i * cellSize, oy + boardPx);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(ox, oy + i * cellSize);
        ctx.lineTo(ox + boardPx, oy + i * cellSize);
        ctx.stroke();
      }
    }

    // Camera capture flash effect
    if (visionStage === VISION_STAGE.CAPTURING) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(0, 0, w, h);
    }

    // Camera frame border
    ctx.strokeStyle = visionStage === VISION_STAGE.IDLE ? 'rgba(255,255,255,0.1)' : '#00ff88';
    ctx.lineWidth = visionStage === VISION_STAGE.IDLE ? 0.5 : 1;
    ctx.setLineDash(visionStage === VISION_STAGE.IDLE ? [] : [4, 3]);
    ctx.strokeRect(2, 2, w - 4, h - 4);
    ctx.setLineDash([]);

    // Corner markers (camera alignment indicators)
    const cornerLen = 12;
    const corners = [[4, 4], [w - 4, 4], [4, h - 4], [w - 4, h - 4]];
    const cornerDirs = [[1, 1], [-1, 1], [1, -1], [-1, -1]];
    ctx.strokeStyle = visionStage === VISION_STAGE.IDLE ? 'rgba(255,255,255,0.15)' : '#00ff88';
    ctx.lineWidth = 1.5;
    corners.forEach(([x, y], i) => {
      const [dx, dy] = cornerDirs[i];
      ctx.beginPath();
      ctx.moveTo(x + dx * cornerLen, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + dy * cornerLen);
      ctx.stroke();
    });

  }, [board, visionStage, detectedBoard, scanY, cellSize, boardPx, padding, totalSize]);

  // Stage info text
  const stageInfo = {
    [VISION_STAGE.IDLE]: { label: 'Standby', color: 'var(--text-muted)' },
    [VISION_STAGE.CAPTURING]: { label: 'Capturing frame...', color: 'var(--accent-vision)' },
    [VISION_STAGE.PROCESSING]: { label: 'Processing image...', color: 'var(--accent-vision)' },
    [VISION_STAGE.DETECTING]: { label: 'Classifying cells...', color: 'var(--accent-vision)' },
    [VISION_STAGE.COMPLETE]: { label: 'Board state acquired', color: 'var(--success)' },
  };

  const info = stageInfo[visionStage] || stageInfo[VISION_STAGE.IDLE];

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
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
      }}>
        <span>Camera feed</span>
        <span style={{
          color: visionStage !== VISION_STAGE.IDLE ? 'var(--accent-vision)' : 'var(--text-muted)',
          fontSize: 9,
        }}>
          {visionStage !== VISION_STAGE.IDLE ? '● REC' : '○ IDLE'}
        </span>
      </div>

      {/* Canvas */}
      <div style={{ padding: '10px', display: 'flex', justifyContent: 'center' }}>
        <canvas
          ref={canvasRef}
          style={{
            width: totalSize,
            height: totalSize,
            borderRadius: 'var(--radius-sm)',
          }}
        />
      </div>

      {/* Stage pipeline indicator */}
      <div style={{
        padding: '8px 14px 10px',
        borderTop: '1px solid var(--border-subtle)',
      }}>
        {/* Pipeline steps */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          {[
            { key: VISION_STAGE.CAPTURING, label: 'Capture' },
            { key: VISION_STAGE.PROCESSING, label: 'Process' },
            { key: VISION_STAGE.DETECTING, label: 'Detect' },
            { key: VISION_STAGE.COMPLETE, label: 'Done' },
          ].map((step, i) => {
            const stages = [VISION_STAGE.CAPTURING, VISION_STAGE.PROCESSING, VISION_STAGE.DETECTING, VISION_STAGE.COMPLETE];
            const currentIdx = stages.indexOf(visionStage);
            const stepIdx = stages.indexOf(step.key);
            const isActive = stepIdx === currentIdx;
            const isDone = stepIdx < currentIdx;

            return (
              <React.Fragment key={step.key}>
                {i > 0 && (
                  <div style={{
                    width: 12, height: 2, alignSelf: 'center',
                    background: isDone ? 'var(--accent-vision)' : 'var(--border-subtle)',
                    borderRadius: 1,
                  }} />
                )}
                <div style={{
                  flex: 1,
                  padding: '3px 0',
                  textAlign: 'center',
                  fontSize: 9,
                  fontFamily: 'var(--font-mono)',
                  borderRadius: 'var(--radius-sm)',
                  background: isActive ? 'rgba(0,255,136,0.12)' : isDone ? 'rgba(0,255,136,0.06)' : 'transparent',
                  color: isActive ? 'var(--accent-vision)' : isDone ? 'var(--success)' : 'var(--text-muted)',
                  border: isActive ? '1px solid rgba(0,255,136,0.3)' : '1px solid transparent',
                }}>
                  {isDone ? '✓' : ''} {step.label}
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {/* Current status */}
        <div style={{
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          color: info.color,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          {visionStage !== VISION_STAGE.IDLE && visionStage !== VISION_STAGE.COMPLETE && (
            <span style={{ animation: 'pulse 1s infinite' }}>●</span>
          )}
          {info.label}
        </div>
      </div>
    </div>
  );
}

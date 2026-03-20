import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, RoundedBox, Line } from '@react-three/drei';
import * as THREE from 'three';
import { EMPTY, X_PLAYER, O_PLAYER, getCellPos } from './gameLogic';

// ── Flat drawn X mark — strokes drawn one by one ────────────
function DrawnX({ position, isWin }) {
  const groupRef = useRef();
  const line1Ref = useRef();
  const line2Ref = useRef();
  const progressRef = useRef(0);
  const s = 0.22;

  useFrame((_, delta) => {
    if (progressRef.current < 1) {
      progressRef.current = Math.min(1, progressRef.current + delta * 1.25);
    }
    const p = progressRef.current;

    // Stroke 1: top-left → bottom-right, draws during p 0→0.5
    if (line1Ref.current?.geometry?.setPositions) {
      const t1 = Math.min(1, p / 0.5);
      line1Ref.current.geometry.setPositions([
        -s, 0, -s,
        -s + 2 * s * t1, 0, -s + 2 * s * t1,
      ]);
    }

    // Stroke 2: top-right → bottom-left, draws during p 0.5→1
    if (line2Ref.current) {
      const t2 = Math.max(0, Math.min(1, (p - 0.5) / 0.5));
      line2Ref.current.visible = p > 0.5;
      if (p > 0.5 && line2Ref.current.geometry?.setPositions) {
        line2Ref.current.geometry.setPositions([
          s, 0, -s,
          s - 2 * s * t2, 0, -s + 2 * s * t2,
        ]);
      }
    }

    // Win pulse after drawing is complete
    if (isWin && p >= 1 && groupRef.current) {
      const pulse = 1 + Math.sin(Date.now() * 0.006) * 0.06;
      groupRef.current.scale.setScalar(pulse);
    }
  });

  const color = isWin ? '#ffd700' : '#ff4d6a';

  return (
    <group ref={groupRef} position={position}>
      <Line ref={line1Ref}
        points={[[-s, 0, -s], [-s + 0.001, 0, -s + 0.001]]}
        color={color} lineWidth={4} />
      <Line ref={line2Ref}
        points={[[s, 0, -s], [s - 0.001, 0, -s + 0.001]]}
        color={color} lineWidth={4} visible={false} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <planeGeometry args={[0.55, 0.55]} />
        <meshBasicMaterial color={color} transparent opacity={isWin ? 0.12 : 0.05} />
      </mesh>
    </group>
  );
}

// ── Flat drawn O mark — arc drawn around the circle ─────────
function DrawnO({ position, isWin }) {
  const groupRef = useRef();
  const circleRef = useRef();
  const progressRef = useRef(0);
  const radius = 0.22;
  const segments = 48;

  // Full circle points — rendered partially via instanceCount
  const circlePoints = useMemo(() => {
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius
      ));
    }
    return pts;
  }, []);

  useFrame((_, delta) => {
    if (progressRef.current < 1) {
      progressRef.current = Math.min(1, progressRef.current + delta * 1.25);
    }
    const p = progressRef.current;

    // Limit rendered arc segments to show only what's been "drawn" so far
    if (circleRef.current?.geometry) {
      const numSegs = Math.max(1, Math.round(p * segments));
      circleRef.current.geometry.instanceCount = numSegs;
    }

    // Win pulse after drawing is complete
    if (isWin && p >= 1 && groupRef.current) {
      const pulse = 1 + Math.sin(Date.now() * 0.006) * 0.06;
      groupRef.current.scale.setScalar(pulse);
    }
  });

  const color = isWin ? '#ffd700' : '#00d4ff';

  return (
    <group ref={groupRef} position={position}>
      <Line ref={circleRef} points={circlePoints} color={color} lineWidth={4} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.005, 0]}>
        <circleGeometry args={[0.26, 32]} />
        <meshBasicMaterial color={color} transparent opacity={isWin ? 0.1 : 0.04} />
      </mesh>
    </group>
  );
}

// ── Win line beam ───────────────────────────────────────────
function WinLineBeam({ winLine }) {
  const lineRef = useRef();
  const progressRef = useRef(0);

  useFrame((_, delta) => {
    progressRef.current = Math.min(1, progressRef.current + delta * 3);
    if (lineRef.current) {
      lineRef.current.scale.x = progressRef.current;
    }
  });

  if (!winLine) return null;

  const start = getCellPos(winLine[0]);
  const end = getCellPos(winLine[2]);
  const p1 = new THREE.Vector3((start.col - 1) * 0.75, 0.03, (start.row - 1) * 0.75);
  const p2 = new THREE.Vector3((end.col - 1) * 0.75, 0.03, (end.row - 1) * 0.75);

  return (
    <group ref={lineRef}>
      <Line points={[p1, p2]} color="#ffd700" lineWidth={3} transparent opacity={0.7} />
    </group>
  );
}

// ── 6-Axis Robot Arm with full IK ───────────────────────────
function RobotArm3D({ targetCell, isMoving, isDrawing, drawSymbol }) {
  const ARM_BASE = useMemo(() => new THREE.Vector3(1.8, 0, 0), []);
  const L1 = 1.5;   // upper arm
  const L2 = 1.2;   // forearm
  const L3 = 0.3;   // wrist section (J4-J6)
  const BASE_HEIGHT = 0.16;

  // IK targets the wrist centre — tool tip hangs L3 below it
  const currentTarget = useRef(new THREE.Vector3(2.1, 0.6, 0.3));
  const desiredTarget  = useRef(new THREE.Vector3(2.1, 0.6, 0.3));

  const currentBaseAngle = useRef(0);
  const currentShoulder  = useRef(-0.6);
  const currentElbow     = useRef(-1.2);
  const drawPhase = useRef(0);

  // Drawing stroke size — matches DrawnX/DrawnO dimensions
  const DRAW_S = 0.20;
  const DRAW_R = 0.20;

  useEffect(() => {
    if (isDrawing) {
      drawPhase.current = 0;
    }
  }, [isDrawing]);

  useEffect(() => {
    if (targetCell !== null && targetCell !== undefined) {
      if (!isDrawing) {
        const { row, col } = getCellPos(targetCell);
        desiredTarget.current.set(
          (col - 1) * 0.75,
          0.12 + L3,
          (row - 1) * 0.75
        );
      }
    } else {
      desiredTarget.current.set(ARM_BASE.x + 0.3, 0.6, ARM_BASE.z + 0.3);
    }
  }, [targetCell, ARM_BASE, isDrawing]);

  useFrame((_, delta) => {
    // When drawing, animate arm tip along the symbol path
    if (isDrawing && targetCell !== null && targetCell !== undefined) {
      drawPhase.current = Math.min(1, drawPhase.current + delta * 1.25);
      const { row, col } = getCellPos(targetCell);
      const cx = (col - 1) * 0.75;
      const cz = (row - 1) * 0.75;
      const drawY = 0.12 + L3;
      if (drawSymbol === X_PLAYER) {
        const p = drawPhase.current;
        let tx, tz;
        if (p <= 0.5) {
          const t = p / 0.5;
          tx = cx + (-DRAW_S + 2 * DRAW_S * t);
          tz = cz + (-DRAW_S + 2 * DRAW_S * t);
        } else {
          const t = (p - 0.5) / 0.5;
          tx = cx + (DRAW_S - 2 * DRAW_S * t);
          tz = cz + (-DRAW_S + 2 * DRAW_S * t);
        }
        desiredTarget.current.set(tx, drawY, tz);
      } else {
        // O: trace a full circle around cell centre
        const angle = drawPhase.current * Math.PI * 2;
        desiredTarget.current.set(
          cx + Math.cos(angle) * DRAW_R,
          drawY,
          cz + Math.sin(angle) * DRAW_R
        );
      }
    }

    // Lerp faster during drawing so arm tracks the path closely
    const lerpSpeed = isDrawing ? Math.min(1, delta * 5) : Math.min(1, delta * 1.8);
    currentTarget.current.lerp(desiredTarget.current, lerpSpeed);
    const target = currentTarget.current;

    const dx = target.x - ARM_BASE.x;
    const dz = target.z - ARM_BASE.z;
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);

    const desiredBase = Math.atan2(dx, dz);
    currentBaseAngle.current += (desiredBase - currentBaseAngle.current) * Math.min(1, delta * 2);

    const py = target.y - BASE_HEIGHT;
    const px = horizontalDist;
    const reach = Math.sqrt(px * px + py * py);
    const maxReach = L1 + L2 - 0.05;
    const minReach = Math.abs(L1 - L2) + 0.05;
    const clampedReach = Math.max(minReach, Math.min(maxReach, reach));

    const angle2target = Math.atan2(py, px);

    let cosElbow = (L1 * L1 + L2 * L2 - clampedReach * clampedReach) / (2 * L1 * L2);
    cosElbow = Math.max(-1, Math.min(1, cosElbow));
    const elbowAngle = -(Math.PI - Math.acos(cosElbow));

    let cosShoulder = (clampedReach * clampedReach + L1 * L1 - L2 * L2) / (2 * clampedReach * L1);
    cosShoulder = Math.max(-1, Math.min(1, cosShoulder));
    const shoulderAngle = angle2target + Math.acos(cosShoulder);

    const ikLerpSpeed = Math.min(1, delta * 2);
    currentShoulder.current += (shoulderAngle - currentShoulder.current) * ikLerpSpeed;
    currentElbow.current    += (elbowAngle    - currentElbow.current)    * ikLerpSpeed;
  });

  const baseMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#888899', metalness: 0.6, roughness: 0.25,
  }), []);
  const armMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#a0a0bb', metalness: 0.5, roughness: 0.2,
  }), []);
  const jointMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#a594ff', emissive: '#a594ff', emissiveIntensity: 0.5,
    metalness: 0.5, roughness: 0.2,
  }), []);
  const gripColor = isMoving ? '#ff6b6b' : '#4ade80';
  const gripMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: gripColor, emissive: gripColor, emissiveIntensity: 0.7,
    metalness: 0.4, roughness: 0.2,
  }), [gripColor]);

  return (
    <group position={[ARM_BASE.x, 0.05, ARM_BASE.z]}>
      {/* Base pedestal */}
      <mesh position={[0, 0.02, 0]} material={baseMat}>
        <cylinderGeometry args={[0.28, 0.32, 0.04, 32]} />
      </mesh>
      <mesh position={[0, 0.06, 0]} material={jointMat}>
        <cylinderGeometry args={[0.22, 0.24, 0.06, 32]} />
      </mesh>

      <ArmYawGroup
        baseAngleRef={currentBaseAngle}
        shoulderRef={currentShoulder}
        elbowRef={currentElbow}
        L1={L1} L2={L2} L3={L3}
        armMat={armMat} jointMat={jointMat} gripMat={gripMat}
        gripColor={gripColor} isMoving={isMoving}
      />

      <pointLight position={[0, 0.8, 0]} color="#c8bbff" intensity={2} distance={4} />
    </group>
  );
}

// Sub-component — reads joint refs every frame and drives all 6 axes
function ArmYawGroup({ baseAngleRef, shoulderRef, elbowRef, L1, L2, L3,
                       armMat, jointMat, gripMat, gripColor, isMoving }) {
  const yawRef            = useRef();
  const shoulderGroupRef  = useRef();
  const elbowGroupRef     = useRef();
  const wristRollRef      = useRef();   // J4 — forearm roll
  const wristPitchRef     = useRef();   // J5 — keeps tool pointing down
  const toolRollRef       = useRef();   // J6 — tool spin
  const gripperRef        = useRef();

  const forearmRoll = useRef(0);
  const toolRoll    = useRef(0);

  useFrame((_, delta) => {
    // J1 — base yaw
    if (yawRef.current)
      yawRef.current.rotation.y = baseAngleRef.current;

    // J2 — shoulder pitch
    if (shoulderGroupRef.current)
      shoulderGroupRef.current.rotation.x = -(shoulderRef.current - Math.PI / 2);

    // J3 — elbow pitch
    if (elbowGroupRef.current)
      elbowGroupRef.current.rotation.x = -elbowRef.current;

    // J4 — forearm roll: cocks to 45° when moving, returns to 0 at rest
    if (wristRollRef.current) {
      const target = isMoving ? Math.PI / 4 : 0;
      forearmRoll.current += (target - forearmRoll.current) * Math.min(1, delta * 3);
      wristRollRef.current.rotation.y = forearmRoll.current;
    }

    // J5 — wrist pitch: compensates J2+J3 so the tool always points straight down
    // total x-rotation through J2+J3+J5 must equal π (pointing −Y)
    // → J5 = π − (PI/2 − shoulder) − (−elbow) = PI/2 + shoulder + elbow
    if (wristPitchRef.current)
      wristPitchRef.current.rotation.x = Math.PI / 2 + shoulderRef.current + elbowRef.current;

    // J6 — tool roll: slow spin while moving
    if (toolRollRef.current) {
      if (isMoving) toolRoll.current += delta * 3;
      toolRollRef.current.rotation.y = toolRoll.current;
    }

    // Gripper pulse
    if (gripperRef.current) {
      const s = isMoving ? 1 + Math.sin(Date.now() * 0.008) * 0.12 : 1;
      gripperRef.current.scale.setScalar(s);
    }
  });

  const halfL1 = L1 / 2;
  const halfL2 = L2 / 2;
  const halfL3 = L3 / 2;

  return (
    <group ref={yawRef} position={[0, 0.11, 0]}>

      {/* J2 shoulder joint sphere */}
      <mesh material={jointMat}>
        <sphereGeometry args={[0.10, 20, 20]} />
      </mesh>

      {/* J2 shoulder pitch */}
      <group ref={shoulderGroupRef}>
        {/* Upper arm */}
        <mesh position={[0, halfL1, 0]} material={armMat}>
          <boxGeometry args={[0.09, L1, 0.09]} />
        </mesh>
        {/* Detail ring mid-upper-arm */}
        <mesh position={[0, halfL1 * 0.5, 0]} material={jointMat}>
          <cylinderGeometry args={[0.055, 0.055, 0.035, 16]} />
        </mesh>

        {/* J3 elbow joint */}
        <group position={[0, L1, 0]}>
          <mesh material={jointMat}>
            <sphereGeometry args={[0.08, 20, 20]} />
          </mesh>

          {/* J3 elbow pitch */}
          <group ref={elbowGroupRef}>
            {/* Forearm */}
            <mesh position={[0, halfL2, 0]} material={armMat}>
              <boxGeometry args={[0.075, L2, 0.075]} />
            </mesh>
            {/* Detail ring mid-forearm */}
            <mesh position={[0, halfL2 * 0.6, 0]} material={jointMat}>
              <cylinderGeometry args={[0.048, 0.048, 0.035, 16]} />
            </mesh>

            {/* J4 wrist-roll joint + group */}
            <group position={[0, L2, 0]}>
              <mesh material={jointMat}>
                <sphereGeometry args={[0.065, 20, 20]} />
              </mesh>

              <group ref={wristRollRef}>

                {/* J5 wrist-pitch group */}
                <group ref={wristPitchRef}>
                  {/* Wrist section */}
                  <mesh position={[0, halfL3, 0]} material={armMat}>
                    <boxGeometry args={[0.06, L3, 0.06]} />
                  </mesh>

                  {/* J6 tool-roll joint + group */}
                  <group position={[0, L3, 0]}>
                    <mesh material={jointMat}>
                      <sphereGeometry args={[0.05, 16, 16]} />
                    </mesh>

                    <group ref={toolRollRef}>
                      {/* Tool / marker */}
                      <group ref={gripperRef}>
                        <mesh position={[0, 0.05, 0]} material={gripMat}>
                          <cylinderGeometry args={[0.025, 0.03, 0.10, 16]} />
                        </mesh>
                        <mesh position={[0, 0.115, 0]} material={gripMat}>
                          <coneGeometry args={[0.025, 0.05, 16]} />
                        </mesh>
                        <pointLight color={gripColor} intensity={2} distance={2} />
                      </group>
                    </group>
                  </group>

                </group>
              </group>
            </group>

          </group>
        </group>
      </group>

    </group>
  );
}

// ── Board Grid ──────────────────────────────────────────────
function BoardGrid({ board, winLine, onCellClick, currentPlayer, gameResult, hoverEnabled }) {
  return (
    <group>
      {/* Board base */}
      <RoundedBox args={[2.6, 0.1, 2.6]} radius={0.06} position={[0, -0.05, 0]}>
        <meshStandardMaterial color="#4a4e65" metalness={0.3} roughness={0.4} />
      </RoundedBox>

      {/* Board top surface */}
      <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.5, 2.5]} />
        <meshStandardMaterial color="#555872" metalness={0.15} roughness={0.55} />
      </mesh>

      {/* Grid lines — bright and clear */}
      {[-0.375, 0.375].map((pos, i) => (
        <React.Fragment key={i}>
          <mesh position={[pos, 0.013, 0]}>
            <boxGeometry args={[0.028, 0.016, 2.35]} />
            <meshStandardMaterial color="#a0a0c0" emissive="#a0a0c0" emissiveIntensity={0.3} />
          </mesh>
          <mesh position={[0, 0.013, pos]}>
            <boxGeometry args={[2.35, 0.016, 0.028]} />
            <meshStandardMaterial color="#a0a0c0" emissive="#a0a0c0" emissiveIntensity={0.3} />
          </mesh>
        </React.Fragment>
      ))}

      {/* Corner accent dots */}
      {[[-1.18, -1.18], [-1.18, 1.18], [1.18, -1.18], [1.18, 1.18]].map(([x, z], i) => (
        <mesh key={`dot-${i}`} position={[x, 0.013, z]}>
          <sphereGeometry args={[0.028, 12, 12]} />
          <meshStandardMaterial color="#a594ff" emissive="#a594ff" emissiveIntensity={0.6} />
        </mesh>
      ))}

      {/* Cells */}
      {board.map((cell, idx) => {
        const { row, col } = getCellPos(idx);
        const x = (col - 1) * 0.75;
        const z = (row - 1) * 0.75;
        const isWin = winLine && winLine.includes(idx);

        return (
          <group key={idx}>
            {cell === EMPTY && !gameResult && hoverEnabled && (
              <mesh
                position={[x, 0.01, z]}
                rotation={[-Math.PI / 2, 0, 0]}
                onClick={(e) => { e.stopPropagation(); onCellClick(idx); }}
                onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
                onPointerOut={() => { document.body.style.cursor = 'default'; }}
              >
                <planeGeometry args={[0.7, 0.7]} />
                <meshBasicMaterial transparent opacity={0} />
              </mesh>
            )}

            {cell === EMPTY && !gameResult && hoverEnabled && (
              <mesh position={[x, 0.008, z]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.62, 0.62]} />
                <meshBasicMaterial
                  color={currentPlayer === X_PLAYER ? '#ff4d6a' : '#00d4ff'}
                  transparent opacity={0.07}
                />
              </mesh>
            )}

            {/* Flat drawn marks */}
            {cell === X_PLAYER && <DrawnX position={[x, 0.02, z]} isWin={isWin} />}
            {cell === O_PLAYER && <DrawnO position={[x, 0.02, z]} isWin={isWin} />}

            {isWin && (
              <pointLight position={[x, 0.3, z]} color="#ffd700" intensity={1.5} distance={1.2} />
            )}
          </group>
        );
      })}

      <WinLineBeam winLine={winLine} />
    </group>
  );
}

// ── Vision scan ─────────────────────────────────────────────
function VisionScan({ active }) {
  const meshRef = useRef();

  useFrame(() => {
    if (meshRef.current && active) {
      meshRef.current.position.y = 0.25 + Math.sin(Date.now() * 0.003) * 0.12;
      meshRef.current.material.opacity = 0.06 + Math.sin(Date.now() * 0.005) * 0.03;
    }
  });

  if (!active) return null;

  return (
    <mesh ref={meshRef} position={[0, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[2.6, 2.6]} />
      <meshBasicMaterial color="#00ff88" transparent opacity={0.06} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ── Camera ──────────────────────────────────────────────────
function CameraRig() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(2.2, 2.8, 2.2);
    camera.lookAt(0, 0, 0);
  }, [camera]);
  return null;
}

// ── Main Scene ──────────────────────────────────────────────
export default function Scene3D({
  board, winLine, onCellClick, currentPlayer, gameResult,
  robotTarget, isArmMoving, isDrawing, drawSymbol, isScanning, showVision, hoverEnabled
}) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      style={{ background: 'transparent' }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.6 }}
    >
      <CameraRig />
      <OrbitControls
        enablePan={false}
        minDistance={2}
        maxDistance={6}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 0, 0]}
      />

      {/* Bright lighting — everything clearly visible */}
      <ambientLight intensity={1.2} />
      <directionalLight position={[4, 8, 4]} intensity={2.0} color="#ffffff" />
      <directionalLight position={[-3, 6, -2]} intensity={1.0} color="#e0e4ff" />
      <directionalLight position={[0, 5, -4]} intensity={0.8} color="#ffffff" />
      <pointLight position={[0, 4, 0]} intensity={1.5} color="#d4ccff" distance={12} />
      {/* Extra fill light from below-camera angle */}
      <pointLight position={[2, 1, 2]} intensity={0.6} color="#ffffff" distance={8} />

      {/* Lighter fog */}
      <fog attach="fog" args={['#252838', 10, 22]} />

      {/* Floor — lighter */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.12, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#2a2d40" metalness={0.2} roughness={0.7} />
      </mesh>

      <BoardGrid
        board={board}
        winLine={winLine}
        onCellClick={onCellClick}
        currentPlayer={currentPlayer}
        gameResult={gameResult}
        hoverEnabled={hoverEnabled}
      />

      <RobotArm3D targetCell={robotTarget} isMoving={isArmMoving} isDrawing={isDrawing} drawSymbol={drawSymbol} />

      {showVision && <VisionScan active={isScanning} />}
    </Canvas>
  );
}

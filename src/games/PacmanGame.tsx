import React, { useEffect, useRef, useState, useCallback } from 'react';
import { sound } from '../utils/audio';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';

interface PacmanProps {
  onGameOver: (score: number) => void;
  isPaused: boolean;
}

const TILE_SIZE = 28;
const COLS = 13;

export const PacmanGame: React.FC<PacmanProps> = ({ onGameOver, isPaused }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  // References for game loop state
  const stateRef = useRef({
    player: {
      x: 6,
      y: 10,
      dirX: 0,
      dirY: -1,
      nextDirX: 0,
      nextDirY: -1,
      mouthAngle: 0.2,
      mouthOpening: true,
    },
    cameraY: 0,
    glitchY: 20, // starts below player
    speed: 0.12,
    glitchSpeed: 0.03,
    frightenedTime: 0,
    score: 0,
    combo: 0,
    mazeRows: new Map<number, number[]>(), // row index -> columns array (0: wall, 1: path with dot, 2: path with power pellet, 3: empty path)
    ghosts: [
      { x: 4, y: 8, dirX: 0, dirY: -1, color: '#ef4444', name: 'Blinky', eaten: false },
      { x: 8, y: 8, dirX: 0, dirY: -1, color: '#f472b6', name: 'Pinky', eaten: false },
      { x: 5, y: 6, dirX: 1, dirY: 0, color: '#38bdf8', name: 'Inky', eaten: false },
      { x: 7, y: 6, dirX: -1, dirY: 0, color: '#fb923c', name: 'Clyde', eaten: false },
    ],
  });

  // Generate maze rows procedurally
  const getMazeRow = useCallback((rowY: number) => {
    const map = stateRef.current.mazeRows;
    if (map.has(rowY)) return map.get(rowY)!;

    const row = new Array(COLS).fill(0);
    // Outer walls
    row[0] = 0;
    row[COLS - 1] = 0;

    // Interior paths based on pseudorandom pattern
    for (let c = 1; c < COLS - 1; c++) {
      // Connect vertical corridors every 2-3 columns, create horizontal corridors
      const isCross = (Math.abs(rowY) % 3 === 0) || (c % 3 === 1) || (c % 2 === 0 && Math.abs(rowY) % 4 === 1);
      if (isCross) {
        // Dot or rare power pellet
        row[c] = Math.random() < 0.03 ? 2 : 1;
      } else {
        row[c] = 0; // Wall
      }
    }
    // Ensure at least one passage always exists
    row[1 + (Math.abs(rowY) % (COLS - 2))] = 1;
    row[1 + ((Math.abs(rowY) + 3) % (COLS - 2))] = 1;

    map.set(rowY, row);
    return row;
  }, []);

  const setDirection = (dx: number, dy: number) => {
    stateRef.current.player.nextDirX = dx;
    stateRef.current.player.nextDirY = dy;
  };

  const restartGame = () => {
    stateRef.current = {
      player: {
        x: 6,
        y: 10,
        dirX: 0,
        dirY: -1,
        nextDirX: 0,
        nextDirY: -1,
        mouthAngle: 0.2,
        mouthOpening: true,
      },
      cameraY: 0,
      glitchY: 20,
      speed: 0.12,
      glitchSpeed: 0.032,
      frightenedTime: 0,
      score: 0,
      combo: 0,
      mazeRows: new Map<number, number[]>(),
      ghosts: [
        { x: 4, y: 8, dirX: 0, dirY: -1, color: '#ef4444', name: 'Blinky', eaten: false },
        { x: 8, y: 8, dirX: 0, dirY: -1, color: '#f472b6', name: 'Pinky', eaten: false },
        { x: 5, y: 6, dirX: 1, dirY: 0, color: '#38bdf8', name: 'Inky', eaten: false },
        { x: 7, y: 6, dirX: -1, dirY: 0, color: '#fb923c', name: 'Clyde', eaten: false },
      ],
    };
    setScore(0);
    setCombo(0);
    setGameOver(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) {
        setDirection(0, -1);
        e.preventDefault();
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
        setDirection(0, 1);
        e.preventDefault();
      } else if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        setDirection(-1, 0);
        e.preventDefault();
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        setDirection(1, 0);
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Main game loop
  useEffect(() => {
    let animId: number;
    let glitchSoundTimer = 0;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      if (!isPaused && !gameOver) {
        const s = stateRef.current;
        const p = s.player;

        // Try apply next direction if valid tile
        const targetX = Math.round(p.x + p.nextDirX);
        const targetY = Math.round(p.y + p.nextDirY);
        const nextRow = getMazeRow(targetY);

        if (nextRow && nextRow[targetX] !== 0) {
          p.dirX = p.nextDirX;
          p.dirY = p.nextDirY;
        }

        // Move player
        const checkTargetX = Math.round(p.x + p.dirX);
        const checkTargetY = Math.round(p.y + p.dirY);
        const checkRow = getMazeRow(checkTargetY);

        if (checkRow && checkRow[checkTargetX] !== 0) {
          p.x += p.dirX * s.speed;
          p.y += p.dirY * s.speed;
        }

        // Mouth animation
        if (p.mouthOpening) {
          p.mouthAngle += 0.04;
          if (p.mouthAngle >= 0.35) p.mouthOpening = false;
        } else {
          p.mouthAngle -= 0.04;
          if (p.mouthAngle <= 0.05) p.mouthOpening = true;
        }

        // Check tile consumption
        const cellX = Math.round(p.x);
        const cellY = Math.round(p.y);
        const currentRow = getMazeRow(cellY);

        if (currentRow && (currentRow[cellX] === 1 || currentRow[cellX] === 2)) {
          if (currentRow[cellX] === 1) {
            // Dot
            s.score += 10 + Math.min(s.combo, 256);
            s.combo += 1;
            sound.playCoin();
          } else if (currentRow[cellX] === 2) {
            // Power pellet!
            s.score += 50;
            s.frightenedTime = 300; // 5 seconds at 60fps
            sound.playPowerup();
          }
          currentRow[cellX] = 3; // Empty
          setScore(s.score);
          setCombo(s.combo);
        }

        // Camera smoothly follows player upward
        const targetCamY = p.y - 8;
        s.cameraY += (targetCamY - s.cameraY) * 0.08;

        // Glitch rises continuously
        s.glitchY -= s.glitchSpeed;
        glitchSoundTimer++;
        if (glitchSoundTimer > 120 && s.glitchY - p.y < 6) {
          sound.playGlitch();
          glitchSoundTimer = 0;
        }

        // Check glitch collision
        if (p.y >= s.glitchY) {
          sound.playExplosion();
          sound.playGameOver();
          setGameOver(true);
          onGameOver(s.score);
        }

        // Frightened timer
        if (s.frightenedTime > 0) {
          s.frightenedTime--;
        }

        // Ghosts update
        s.ghosts.forEach((ghost) => {
          // If ghost is far behind glitch, respawn ahead of player
          if (ghost.y > s.glitchY + 2) {
            ghost.y = p.y - 12 - Math.random() * 4;
            ghost.x = 2 + Math.floor(Math.random() * (COLS - 4));
            ghost.eaten = false;
          }

          // Simple AI pathing
          const gCellX = Math.round(ghost.x);
          const gCellY = Math.round(ghost.y);
          const possibleDirs = [
            { x: 0, y: -1 },
            { x: 0, y: 1 },
            { x: -1, y: 0 },
            { x: 1, y: 0 },
          ].filter((d) => {
            if (d.x === -ghost.dirX && d.y === -ghost.dirY) return false; // Don't turn 180 immediately
            const r = getMazeRow(Math.round(ghost.y + d.y));
            return r && r[Math.round(ghost.x + d.x)] !== 0;
          });

          if (possibleDirs.length > 0) {
            // Choose dir closest or furthest depending on frightened
            let chosen = possibleDirs[0];
            let bestDist = s.frightenedTime > 0 ? -Infinity : Infinity;

            for (const d of possibleDirs) {
              const nx = ghost.x + d.x;
              const ny = ghost.y + d.y;
              const dist = Math.hypot(nx - p.x, ny - p.y);
              if (s.frightenedTime > 0) {
                if (dist > bestDist) {
                  bestDist = dist;
                  chosen = d;
                }
              } else {
                if (dist < bestDist) {
                  bestDist = dist;
                  chosen = d;
                }
              }
            }
            ghost.dirX = chosen.x;
            ghost.dirY = chosen.y;
          }

          const ghostSpeed = s.frightenedTime > 0 ? 0.05 : 0.07;
          ghost.x += ghost.dirX * ghostSpeed;
          ghost.y += ghost.dirY * ghostSpeed;

          // Ghost collision with player
          const distToPlayer = Math.hypot(ghost.x - p.x, ghost.y - p.y);
          if (distToPlayer < 0.7) {
            if (s.frightenedTime > 0 && !ghost.eaten) {
              // Eat ghost
              ghost.eaten = true;
              ghost.y += 10;
              s.score += 200;
              setScore(s.score);
              sound.playPowerup();
            } else if (!ghost.eaten) {
              sound.playExplosion();
              sound.playGameOver();
              setGameOver(true);
              onGameOver(s.score);
            }
          }
        });
      }

      // RENDER
      const s = stateRef.current;
      const p = s.player;
      ctx.fillStyle = '#050714';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const viewStartRow = Math.floor(s.cameraY) - 2;
      const viewEndRow = Math.floor(s.cameraY + canvas.height / TILE_SIZE) + 2;

      // Draw Maze
      for (let r = viewStartRow; r <= viewEndRow; r++) {
        const row = getMazeRow(r);
        const drawY = (r - s.cameraY) * TILE_SIZE;

        for (let c = 0; c < COLS; c++) {
          const drawX = c * TILE_SIZE;
          const cell = row[c];

          if (cell === 0) {
            // Wall: stylish retro neon blue borders
            ctx.fillStyle = '#1e1b4b';
            ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(drawX + 1, drawY + 1, TILE_SIZE - 2, TILE_SIZE - 2);
          } else if (cell === 1) {
            // Small dot
            ctx.fillStyle = '#fde047';
            ctx.beginPath();
            ctx.arc(drawX + TILE_SIZE / 2, drawY + TILE_SIZE / 2, 2.8, 0, Math.PI * 2);
            ctx.fill();
          } else if (cell === 2) {
            // Power Pellet pulsating
            const pulse = Math.sin(Date.now() * 0.01) * 2;
            ctx.fillStyle = '#fbbf24';
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = 8;
            ctx.beginPath();
            ctx.arc(drawX + TILE_SIZE / 2, drawY + TILE_SIZE / 2, 6 + pulse, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
      }

      // Draw Player (Pac-Man)
      const playerDrawX = p.x * TILE_SIZE + TILE_SIZE / 2;
      const playerDrawY = (p.y - s.cameraY) * TILE_SIZE + TILE_SIZE / 2;
      let baseAngle = 0;
      if (p.dirX === 1) baseAngle = 0;
      else if (p.dirX === -1) baseAngle = Math.PI;
      else if (p.dirY === 1) baseAngle = Math.PI / 2;
      else if (p.dirY === -1) baseAngle = -Math.PI / 2;

      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(
        playerDrawX,
        playerDrawY,
        TILE_SIZE * 0.42,
        baseAngle + p.mouthAngle * Math.PI,
        baseAngle + (2 - p.mouthAngle) * Math.PI
      );
      ctx.lineTo(playerDrawX, playerDrawY);
      ctx.closePath();
      ctx.fill();

      // Draw Ghosts
      s.ghosts.forEach((ghost) => {
        const gDrawX = ghost.x * TILE_SIZE + TILE_SIZE / 2;
        const gDrawY = (ghost.y - s.cameraY) * TILE_SIZE + TILE_SIZE / 2;

        if (ghost.eaten) return;

        ctx.fillStyle = s.frightenedTime > 0 ? (s.frightenedTime < 60 && Math.floor(s.frightenedTime / 10) % 2 === 0 ? '#f8fafc' : '#2563eb') : ghost.color;
        
        // Ghost body
        const r = TILE_SIZE * 0.4;
        ctx.beginPath();
        ctx.arc(gDrawX, gDrawY - 2, r, Math.PI, 0);
        ctx.lineTo(gDrawX + r, gDrawY + r);
        // Wavy skirt
        ctx.lineTo(gDrawX + r * 0.5, gDrawY + r * 0.7);
        ctx.lineTo(gDrawX, gDrawY + r);
        ctx.lineTo(gDrawX - r * 0.5, gDrawY + r * 0.7);
        ctx.lineTo(gDrawX - r, gDrawY + r);
        ctx.closePath();
        ctx.fill();

        // Eyes
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(gDrawX - 4, gDrawY - 3, 3.5, 0, Math.PI * 2);
        ctx.arc(gDrawX + 4, gDrawY - 3, 3.5, 0, Math.PI * 2);
        ctx.fill();
        // Pupils
        ctx.fillStyle = s.frightenedTime > 0 ? '#ef4444' : '#1e1b4b';
        ctx.beginPath();
        ctx.arc(gDrawX - 4 + ghost.dirX * 1.5, gDrawY - 3 + ghost.dirY * 1.5, 1.8, 0, Math.PI * 2);
        ctx.arc(gDrawX + 4 + ghost.dirX * 1.5, gDrawY - 3 + ghost.dirY * 1.5, 1.8, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw The Infamous 256 Glitch wave from bottom!
      const glitchDrawY = (s.glitchY - s.cameraY) * TILE_SIZE;
      if (glitchDrawY < canvas.height) {
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(0, glitchDrawY, canvas.width, canvas.height - glitchDrawY);

        // Corrupted 8-bit text fragments and glyphs
        ctx.font = '12px monospace';
        const glyphs = ['256', '0xFA', 'ERR', '§', '¶', '!!', '010', 'NULL', '#', '??', 'PAC'];
        for (let gy = glitchDrawY; gy < canvas.height; gy += 16) {
          for (let gx = 0; gx < canvas.width; gx += 32) {
            ctx.fillStyle = Math.random() < 0.4 ? '#facc15' : Math.random() < 0.7 ? '#00ffff' : '#ffffff';
            const text = glyphs[Math.floor(Math.random() * glyphs.length)];
            ctx.fillText(text, gx + (Math.random() * 4 - 2), gy + 12);
          }
        }

        // Glitch crest boundary with digital sparks
        ctx.fillStyle = '#f43f5e';
        ctx.fillRect(0, glitchDrawY - 4, canvas.width, 6);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPaused, gameOver, getMazeRow, onGameOver]);

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto">
      {/* Top Game Bar */}
      <div className="flex items-center justify-between w-full px-4 py-2 bg-slate-900/90 rounded-t-xl border border-slate-800 backdrop-blur-sm text-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">SCORE</span>
          <span className="text-amber-400 font-bold text-lg tabular-nums">{score}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">COMBO</span>
          <span className="text-pink-400 font-bold tabular-nums">x{combo}</span>
        </div>
      </div>

      {/* Canvas Frame */}
      <div className="relative border-x border-b border-slate-800 rounded-b-xl overflow-hidden shadow-2xl bg-black">
        <canvas
          ref={canvasRef}
          width={COLS * TILE_SIZE}
          height={500}
          className="block touch-none"
        />

        {gameOver && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
            <h3 className="text-2xl font-black text-rose-500 mb-1 tracking-wider">GLITCHED OUT!</h3>
            <p className="text-sm text-slate-300 mb-4">The corruption swallowed you.</p>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-6 w-48">
              <span className="text-xs text-slate-400">Final Score</span>
              <div className="text-2xl font-extrabold text-amber-400">{score}</div>
            </div>
            <button
              onClick={restartGame}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold shadow-lg hover:brightness-110 active:scale-95 transition"
            >
              <RotateCcw className="w-4 h-4" />
              Play Again
            </button>
          </div>
        )}
      </div>

      {/* Mobile Touch Directional Controls */}
      <div className="mt-4 grid grid-cols-3 gap-2 w-52 sm:hidden select-none">
        <div />
        <button
          onClick={() => setDirection(0, -1)}
          className="h-12 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-slate-200 active:bg-amber-500 active:text-white"
        >
          <ArrowUp className="w-6 h-6" />
        </button>
        <div />
        <button
          onClick={() => setDirection(-1, 0)}
          className="h-12 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-slate-200 active:bg-amber-500 active:text-white"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <button
          onClick={() => setDirection(0, 1)}
          className="h-12 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-slate-200 active:bg-amber-500 active:text-white"
        >
          <ArrowDown className="w-6 h-6" />
        </button>
        <button
          onClick={() => setDirection(1, 0)}
          className="h-12 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-slate-200 active:bg-amber-500 active:text-white"
        >
          <ArrowRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

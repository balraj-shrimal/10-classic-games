import React, { useEffect, useRef, useState, useCallback } from 'react';
import { sound } from '../utils/audio';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';

interface CrossyRoadProps {
  onGameOver: (score: number) => void;
  isPaused: boolean;
}

const CELL_SIZE = 36;
const COLS = 11;

type LaneType = 'grass' | 'road' | 'river' | 'rail';

interface Lane {
  y: number;
  type: LaneType;
  speed: number;
  direction: number; // 1 (right) or -1 (left)
  obstacles: { x: number; width: number; color?: string }[];
  railWarning?: boolean;
  trainProgress?: number; // 0 to 1 when train zooms
}

export const CrossyRoadGame: React.FC<CrossyRoadProps> = ({ onGameOver, isPaused }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const stateRef = useRef({
    player: {
      x: 5,
      y: 0,
      animHop: 0, // 0 to 1 for hopping arc
      dir: 'up',
      alive: true,
    },
    cameraY: 0,
    maxForwardY: 0,
    idleTimer: 0,
    score: 0,
    coins: 0,
    lanes: new Map<number, Lane>(),
    eagleY: -999,
    eagleActive: false,
    coinsMap: new Map<string, boolean>(), // "x,y"
  });

  // Generate a lane procedurally
  const getLane = useCallback((laneY: number): Lane => {
    const map = stateRef.current.lanes;
    if (map.has(laneY)) return map.get(laneY)!;

    let type: LaneType = 'grass';
    if (laneY > 1) {
      const rand = Math.random();
      if (rand < 0.28) type = 'grass';
      else if (rand < 0.62) type = 'road';
      else if (rand < 0.88) type = 'river';
      else type = 'rail';
    }

    const direction = Math.random() < 0.5 ? 1 : -1;
    const speed = 0.02 + Math.random() * 0.04;
    const obstacles: { x: number; width: number; color?: string }[] = [];

    if (type === 'road') {
      const carCount = 2 + Math.floor(Math.random() * 2);
      const spacing = COLS / carCount;
      const colors = ['#ef4444', '#3b82f6', '#eab308', '#ec4899', '#8b5cf6'];
      for (let i = 0; i < carCount; i++) {
        obstacles.push({
          x: i * spacing + Math.random() * 2,
          width: Math.random() < 0.3 ? 2.2 : 1.4, // truck or car
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    } else if (type === 'river') {
      const logCount = 2 + Math.floor(Math.random() * 2);
      const spacing = COLS / logCount;
      for (let i = 0; i < logCount; i++) {
        obstacles.push({
          x: i * spacing + Math.random() * 2,
          width: 2.2 + Math.random() * 1.2,
          color: '#854d0e',
        });
      }
    } else if (type === 'grass' && laneY > 0) {
      // Tree obstacles
      const treeCount = Math.floor(Math.random() * 3);
      for (let i = 0; i < treeCount; i++) {
        const tx = Math.floor(Math.random() * COLS);
        if (tx !== 5 || laneY !== 0) {
          obstacles.push({ x: tx, width: 1, color: '#15803d' });
        }
      }
    }

    // Rare coin in lane
    if (Math.random() < 0.25 && type !== 'river') {
      const cx = Math.floor(Math.random() * (COLS - 2)) + 1;
      stateRef.current.coinsMap.set(`${cx},${laneY}`, true);
    }

    const lane: Lane = {
      y: laneY,
      type,
      speed,
      direction,
      obstacles,
      railWarning: false,
      trainProgress: -1,
    };

    map.set(laneY, lane);
    return lane;
  }, []);

  const movePlayer = (dx: number, dy: number) => {
    if (gameOver || isPaused) return;
    const s = stateRef.current;
    const p = s.player;
    if (!p.alive) return;

    const nx = Math.max(0, Math.min(COLS - 1, p.x + dx));
    const ny = Math.max(0, p.y + dy);

    // Check tree obstacles on grass
    const targetLane = getLane(ny);
    if (targetLane.type === 'grass') {
      const hitTree = targetLane.obstacles.some(
        (t) => Math.round(t.x) === nx
      );
      if (hitTree) return; // Blocked by tree
    }

    p.x = nx;
    p.y = ny;
    p.animHop = 1.0;
    s.idleTimer = 0; // Reset eagle timer
    sound.playJump();

    // Check Coin
    const coinKey = `${p.x},${p.y}`;
    if (s.coinsMap.has(coinKey)) {
      s.coinsMap.delete(coinKey);
      s.coins += 1;
      s.score += 5;
      setCoins(s.coins);
      sound.playCoin();
    }

    // Update forward score
    if (p.y > s.maxForwardY) {
      s.maxForwardY = p.y;
      s.score += 1;
      setScore(s.score);
    }
  };

  const restartGame = () => {
    stateRef.current = {
      player: {
        x: 5,
        y: 0,
        animHop: 0,
        dir: 'up',
        alive: true,
      },
      cameraY: 0,
      maxForwardY: 0,
      idleTimer: 0,
      score: 0,
      coins: 0,
      lanes: new Map<number, Lane>(),
      eagleY: -999,
      eagleActive: false,
      coinsMap: new Map<string, boolean>(),
    };
    setScore(0);
    setCoins(0);
    setGameOver(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'KeyW'].includes(e.code)) {
        movePlayer(0, 1);
        e.preventDefault();
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
        movePlayer(0, -1);
        e.preventDefault();
      } else if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        movePlayer(-1, 0);
        e.preventDefault();
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        movePlayer(1, 0);
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameOver, isPaused]);

  // Game Loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      if (!isPaused && !gameOver) {
        const s = stateRef.current;
        const p = s.player;

        // Animate hop
        if (p.animHop > 0) {
          p.animHop = Math.max(0, p.animHop - 0.15);
        }

        // Camera smoothly follows player Y
        const targetCamY = p.y - 3;
        s.cameraY += (targetCamY - s.cameraY) * 0.1;

        // Eagle Idle Countdown
        s.idleTimer += 1 / 60;
        if (s.idleTimer > 3.8 && !s.eagleActive) {
          s.eagleActive = true;
          s.eagleY = p.y + 10;
        }

        if (s.eagleActive) {
          s.eagleY -= 0.35;
          if (s.eagleY <= p.y) {
            p.alive = false;
            sound.playExplosion();
            sound.playGameOver();
            setGameOver(true);
            onGameOver(s.score);
          }
        }

        // Update lanes and obstacles
        const visibleStart = Math.max(0, Math.floor(s.cameraY) - 2);
        const visibleEnd = Math.floor(s.cameraY + canvas.height / CELL_SIZE) + 3;

        for (let ly = visibleStart; ly <= visibleEnd; ly++) {
          const lane = getLane(ly);

          if (lane.type === 'road' || lane.type === 'river') {
            lane.obstacles.forEach((obs) => {
              obs.x += lane.speed * lane.direction;
              // Wrap around
              if (lane.direction === 1 && obs.x > COLS + 2) {
                obs.x = -obs.width - 2;
              } else if (lane.direction === -1 && obs.x < -obs.width - 2) {
                obs.x = COLS + 2;
              }
            });
          } else if (lane.type === 'rail') {
            // Periodic high-speed train
            if (lane.trainProgress !== undefined) {
              if (lane.trainProgress >= 0) {
                lane.trainProgress += 0.05;
                if (lane.trainProgress > 1.4) {
                  lane.trainProgress = -1;
                  lane.railWarning = false;
                }
              } else if (Math.random() < 0.005) {
                // Trigger warning lights
                lane.railWarning = true;
                setTimeout(() => {
                  lane.trainProgress = 0;
                }, 1200);
              }
            }
          }
        }

        // Collision Checks
        const currentLane = getLane(p.y);
        if (p.alive) {
          if (currentLane.type === 'road') {
            const hitCar = currentLane.obstacles.some(
              (car) => p.x >= car.x - 0.4 && p.x <= car.x + car.width - 0.2
            );
            if (hitCar) {
              p.alive = false;
              sound.playExplosion();
              sound.playGameOver();
              setGameOver(true);
              onGameOver(s.score);
            }
          } else if (currentLane.type === 'river') {
            // Must be standing on a log!
            let onLog = false;
            currentLane.obstacles.forEach((log) => {
              if (p.x >= log.x - 0.3 && p.x <= log.x + log.width + 0.3) {
                onLog = true;
                // Carry player with log movement
                p.x += currentLane.speed * currentLane.direction;
              }
            });

            if (!onLog || p.x < 0 || p.x > COLS - 1) {
              p.alive = false;
              sound.playExplosion();
              sound.playGameOver();
              setGameOver(true);
              onGameOver(s.score);
            }
          } else if (currentLane.type === 'rail') {
            if (currentLane.trainProgress && currentLane.trainProgress >= 0 && currentLane.trainProgress <= 1) {
              p.alive = false;
              sound.playExplosion();
              sound.playGameOver();
              setGameOver(true);
              onGameOver(s.score);
            }
          }
        }
      }

      // RENDER
      const s = stateRef.current;
      const p = s.player;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const visibleStart = Math.max(0, Math.floor(s.cameraY) - 2);
      const visibleEnd = Math.floor(s.cameraY + canvas.height / CELL_SIZE) + 2;

      // Draw Lanes from back to front (top of screen to bottom)
      for (let ly = visibleEnd; ly >= visibleStart; ly--) {
        const lane = getLane(ly);
        const drawY = canvas.height - (ly - s.cameraY + 1) * CELL_SIZE;

        // Background of lane
        if (lane.type === 'grass') {
          ctx.fillStyle = ly % 2 === 0 ? '#15803d' : '#16a34a';
          ctx.fillRect(0, drawY, canvas.width, CELL_SIZE);
        } else if (lane.type === 'road') {
          ctx.fillStyle = '#334155';
          ctx.fillRect(0, drawY, canvas.width, CELL_SIZE);
          // Dashed road line
          ctx.strokeStyle = '#94a3b8';
          ctx.setLineDash([10, 10]);
          ctx.beginPath();
          ctx.moveTo(0, drawY + CELL_SIZE / 2);
          ctx.lineTo(canvas.width, drawY + CELL_SIZE / 2);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (lane.type === 'river') {
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(0, drawY, canvas.width, CELL_SIZE);
          // Subtle river wave ripples
          ctx.fillStyle = '#38bdf8';
          for (let rx = 0; rx < canvas.width; rx += 40) {
            ctx.fillRect(rx + (Date.now() * 0.02) % 40, drawY + 8, 12, 3);
          }
        } else if (lane.type === 'rail') {
          ctx.fillStyle = '#475569';
          ctx.fillRect(0, drawY, canvas.width, CELL_SIZE);
          // Sleepers
          ctx.fillStyle = '#78350f';
          for (let rx = 0; rx < canvas.width; rx += 14) {
            ctx.fillRect(rx, drawY + 4, 6, CELL_SIZE - 8);
          }
          // Rails
          ctx.fillStyle = '#cbd5e1';
          ctx.fillRect(0, drawY + 8, canvas.width, 3);
          ctx.fillRect(0, drawY + CELL_SIZE - 11, canvas.width, 3);

          // Warning lights
          if (lane.railWarning) {
            const blink = Math.floor(Date.now() / 200) % 2 === 0;
            ctx.fillStyle = blink ? '#ef4444' : '#7f1d1d';
            ctx.beginPath();
            ctx.arc(16, drawY + 12, 6, 0, Math.PI * 2);
            ctx.arc(canvas.width - 16, drawY + 12, 6, 0, Math.PI * 2);
            ctx.fill();
          }

          // Zooming train
          if (lane.trainProgress !== undefined && lane.trainProgress >= 0) {
            const trainX = (lane.trainProgress * 1.5 - 0.3) * canvas.width;
            ctx.fillStyle = '#dc2626';
            ctx.fillRect(trainX - 250, drawY + 2, 250, CELL_SIZE - 4);
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(trainX - 20, drawY + 6, 16, 8); // Headlight
          }
        }

        // Draw Obstacles (Cars, Logs, Trees)
        if (lane.type === 'grass') {
          lane.obstacles.forEach((tree) => {
            const tx = tree.x * CELL_SIZE;
            // Tree trunk
            ctx.fillStyle = '#78350f';
            ctx.fillRect(tx + 12, drawY + 18, 12, 14);
            // Foliage voxel blocks
            ctx.fillStyle = '#166534';
            ctx.fillRect(tx + 4, drawY + 2, 28, 20);
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(tx + 8, drawY - 2, 20, 12);
          });
        } else if (lane.type === 'road') {
          lane.obstacles.forEach((car) => {
            const cx = car.x * CELL_SIZE;
            const cw = car.width * CELL_SIZE;
            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillRect(cx + 4, drawY + CELL_SIZE - 6, cw - 4, 4);
            // Car body voxel
            ctx.fillStyle = car.color || '#ef4444';
            ctx.fillRect(cx, drawY + 6, cw, CELL_SIZE - 12);
            // Roof / Windshield
            ctx.fillStyle = '#1e293b';
            ctx.fillRect(cx + cw * 0.25, drawY + 9, cw * 0.5, CELL_SIZE - 18);
            // Headlights
            ctx.fillStyle = '#fef08a';
            const lightX = lane.direction === 1 ? cx + cw - 3 : cx;
            ctx.fillRect(lightX, drawY + 8, 3, 4);
            ctx.fillRect(lightX, drawY + CELL_SIZE - 12, 3, 4);
          });
        } else if (lane.type === 'river') {
          lane.obstacles.forEach((log) => {
            const lx = log.x * CELL_SIZE;
            const lw = log.width * CELL_SIZE;
            ctx.fillStyle = '#854d0e';
            ctx.beginPath();
            ctx.roundRect(lx, drawY + 6, lw, CELL_SIZE - 12, 6);
            ctx.fill();
            // Wood rings
            ctx.strokeStyle = '#713f12';
            ctx.stroke();
          });
        }

        // Draw Coins on lane
        for (let c = 0; c < COLS; c++) {
          if (s.coinsMap.has(`${c},${ly}`)) {
            const coinX = c * CELL_SIZE + CELL_SIZE / 2;
            const coinY = drawY + CELL_SIZE / 2;
            ctx.fillStyle = '#eab308';
            ctx.beginPath();
            ctx.arc(coinX, coinY, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fef08a';
            ctx.beginPath();
            ctx.arc(coinX - 1, coinY - 1, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Draw Player (Cute Voxel Chicken)
      if (p.alive) {
        const px = p.x * CELL_SIZE + CELL_SIZE / 2;
        const basePy = canvas.height - (p.y - s.cameraY + 1) * CELL_SIZE + CELL_SIZE / 2;
        const hopOffset = Math.sin(p.animHop * Math.PI) * 14;
        const py = basePy - hopOffset;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(px, basePy + 8, 10 - p.animHop * 3, 5 - p.animHop * 2, 0, 0, Math.PI * 2);
        ctx.fill();

        // White voxel body
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(px - 10, py - 12, 20, 20);

        // Red comb
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(px - 4, py - 18, 8, 6);

        // Orange beak
        ctx.fillStyle = '#f97316';
        ctx.fillRect(px - 3, py - 8, 6, 6);

        // Eyes
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(px - 7, py - 8, 3, 3);
        ctx.fillRect(px + 4, py - 8, 3, 3);
      }

      // Draw Eagle if active
      if (s.eagleActive) {
        const ey = canvas.height - (s.eagleY - s.cameraY + 1) * CELL_SIZE;
        const ex = p.x * CELL_SIZE + CELL_SIZE / 2;
        // Eagle Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.ellipse(ex, canvas.height - (p.y - s.cameraY + 1) * CELL_SIZE, 24, 12, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eagle wings
        ctx.fillStyle = '#451a03';
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - 35, ey - 15);
        ctx.lineTo(ex - 10, ey + 10);
        ctx.lineTo(ex, ey + 4);
        ctx.lineTo(ex + 10, ey + 10);
        ctx.lineTo(ex + 35, ey - 15);
        ctx.closePath();
        ctx.fill();
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPaused, gameOver, getLane, onGameOver]);

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto">
      {/* Top HUD */}
      <div className="flex items-center justify-between w-full px-4 py-2 bg-slate-900/90 rounded-t-xl border border-slate-800 backdrop-blur-sm text-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">HOPS</span>
          <span className="text-emerald-400 font-bold text-lg tabular-nums">{score}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">COINS</span>
          <span className="text-amber-400 font-bold tabular-nums">★ {coins}</span>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative border-x border-b border-slate-800 rounded-b-xl overflow-hidden shadow-2xl bg-black">
        <canvas
          ref={canvasRef}
          width={COLS * CELL_SIZE}
          height={500}
          className="block touch-none cursor-pointer"
          onClick={() => movePlayer(0, 1)}
        />

        {gameOver && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
            <h3 className="text-2xl font-black text-rose-500 mb-1 tracking-wider">SPLAT!</h3>
            <p className="text-sm text-slate-300 mb-4">Traffic or the river caught you.</p>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-6 w-48">
              <span className="text-xs text-slate-400">Score</span>
              <div className="text-2xl font-extrabold text-emerald-400">{score}</div>
            </div>
            <button
              onClick={restartGame}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-semibold shadow-lg hover:brightness-110 active:scale-95 transition"
            >
              <RotateCcw className="w-4 h-4" />
              Hop Again
            </button>
          </div>
        )}
      </div>

      {/* Mobile Touch Controls */}
      <div className="mt-4 grid grid-cols-3 gap-2 w-52 sm:hidden select-none">
        <div />
        <button
          onClick={() => movePlayer(0, 1)}
          className="h-12 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-slate-200 active:bg-emerald-500 active:text-white"
        >
          <ArrowUp className="w-6 h-6" />
        </button>
        <div />
        <button
          onClick={() => movePlayer(-1, 0)}
          className="h-12 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-slate-200 active:bg-emerald-500 active:text-white"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <button
          onClick={() => movePlayer(0, -1)}
          className="h-12 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-slate-200 active:bg-emerald-500 active:text-white"
        >
          <ArrowDown className="w-6 h-6" />
        </button>
        <button
          onClick={() => movePlayer(1, 0)}
          className="h-12 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-slate-200 active:bg-emerald-500 active:text-white"
        >
          <ArrowRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

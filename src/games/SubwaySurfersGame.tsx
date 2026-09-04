import React, { useEffect, useRef, useState } from 'react';
import { sound } from '../utils/audio';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';

interface SubwayProps {
  onGameOver: (score: number) => void;
  isPaused: boolean;
}

type ObstacleType = 'train' | 'jump_barrier' | 'slide_barrier';

interface Obstacle {
  z: number; // distance from player (10 to 1000)
  lane: number; // -1, 0, 1
  type: ObstacleType;
  color?: string;
}

interface Coin {
  z: number;
  lane: number;
  collected: boolean;
}

export const SubwaySurfersGame: React.FC<SubwayProps> = ({ onGameOver, isPaused }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const stateRef = useRef({
    player: {
      lane: 0, // -1, 0, 1
      targetLane: 0,
      visualLane: 0, // for smooth interpolation
      y: 0, // jump height
      vy: 0,
      isSliding: false,
      slideTimer: 0,
    },
    distance: 0,
    speed: 7.5,
    coinsCount: 0,
    obstacles: [] as Obstacle[],
    coins: [] as Coin[],
    inspectorDistance: 120, // 0 = caught
    stumble: false,
  });

  const switchLane = (delta: number) => {
    const p = stateRef.current.player;
    p.targetLane = Math.max(-1, Math.min(1, p.targetLane + delta));
  };

  const jump = () => {
    const p = stateRef.current.player;
    if (p.y === 0 && !p.isSliding) {
      p.vy = 11.5;
      sound.playJump();
    }
  };

  const slide = () => {
    const p = stateRef.current.player;
    if (p.y > 0) {
      // Fast drop
      p.vy = -12;
    }
    p.isSliding = true;
    p.slideTimer = 35;
  };

  const restartGame = () => {
    stateRef.current = {
      player: {
        lane: 0,
        targetLane: 0,
        visualLane: 0,
        y: 0,
        vy: 0,
        isSliding: false,
        slideTimer: 0,
      },
      distance: 0,
      speed: 7.5,
      coinsCount: 0,
      obstacles: [],
      coins: [],
      inspectorDistance: 120,
      stumble: false,
    };
    setScore(0);
    setCoins(0);
    setGameOver(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        switchLane(-1);
        e.preventDefault();
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        switchLane(1);
        e.preventDefault();
      } else if (['ArrowUp', 'KeyW'].includes(e.code)) {
        jump();
        e.preventDefault();
      } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
        slide();
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Main Loop
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Touch swipe gesture handlers
    let touchStartX = 0;
    let touchStartY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 30) switchLane(1);
        else if (dx < -30) switchLane(-1);
      } else {
        if (dy < -30) jump();
        else if (dy > 30) slide();
      }
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: true });

    const loop = () => {
      if (!isPaused && !gameOver) {
        const s = stateRef.current;
        const p = s.player;

        s.distance += s.speed;
        setScore(Math.floor(s.distance / 8) + s.coinsCount * 10);

        // Smooth lane movement
        p.visualLane += (p.targetLane - p.visualLane) * 0.25;

        // Jump physics
        if (p.vy !== 0 || p.y > 0) {
          p.y += p.vy;
          p.vy -= 0.65; // gravity
          if (p.y <= 0) {
            p.y = 0;
            p.vy = 0;
          }
        }

        // Slide timer
        if (p.isSliding) {
          p.slideTimer--;
          if (p.slideTimer <= 0) p.isSliding = false;
        }

        // Spawn obstacles
        if (s.obstacles.length < 5 && Math.random() < 0.03) {
          const lastZ = s.obstacles.length > 0 ? s.obstacles[s.obstacles.length - 1].z : 0;
          if (1200 - lastZ > 220) {
            const lane = Math.floor(Math.random() * 3) - 1;
            const randType = Math.random();
            const type: ObstacleType =
              randType < 0.45 ? 'train' : randType < 0.75 ? 'jump_barrier' : 'slide_barrier';
            s.obstacles.push({
              z: 1200,
              lane,
              type,
              color: type === 'train' ? '#0284c7' : '#ef4444',
            });
          }
        }

        // Spawn Coins
        if (s.coins.length < 12 && Math.random() < 0.04) {
          const coinLane = Math.floor(Math.random() * 3) - 1;
          for (let i = 0; i < 5; i++) {
            s.coins.push({
              z: 1000 + i * 45,
              lane: coinLane,
              collected: false,
            });
          }
        }

        // Update Obstacles
        s.obstacles.forEach((obs) => {
          obs.z -= s.speed;

          // Collision Check when close to player (z between 20 and 70)
          if (obs.z >= 20 && obs.z <= 65) {
            const laneDiff = Math.abs(p.visualLane - obs.lane);
            if (laneDiff < 0.65) {
              if (obs.type === 'train') {
                // Must not be in same lane
                sound.playExplosion();
                sound.playGameOver();
                setGameOver(true);
                onGameOver(Math.floor(s.distance / 8) + s.coinsCount * 10);
              } else if (obs.type === 'jump_barrier') {
                // Must jump over
                if (p.y < 35) {
                  sound.playExplosion();
                  sound.playGameOver();
                  setGameOver(true);
                  onGameOver(Math.floor(s.distance / 8) + s.coinsCount * 10);
                }
              } else if (obs.type === 'slide_barrier') {
                // Must slide under
                if (!p.isSliding) {
                  sound.playExplosion();
                  sound.playGameOver();
                  setGameOver(true);
                  onGameOver(Math.floor(s.distance / 8) + s.coinsCount * 10);
                }
              }
            }
          }
        });
        s.obstacles = s.obstacles.filter((o) => o.z > 0);

        // Update Coins
        s.coins.forEach((c) => {
          c.z -= s.speed;
          if (!c.collected && c.z >= 20 && c.z <= 70) {
            const laneDiff = Math.abs(p.visualLane - c.lane);
            if (laneDiff < 0.6) {
              c.collected = true;
              s.coinsCount++;
              setCoins(s.coinsCount);
              sound.playCoin();
            }
          }
        });
        s.coins = s.coins.filter((c) => c.z > 0);
      }

      // RENDER (Pseudo 3D)
      const s = stateRef.current;
      const p = s.player;

      const horizonY = 160;
      const horizonWidth = 60;
      const bottomWidth = 380;
      const centerX = canvas.width / 2;

      // Sky & City Skyline
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, horizonY);
      // City buildings on horizon
      ctx.fillStyle = '#1e293b';
      for (let bx = 0; bx < canvas.width; bx += 35) {
        const bHeight = 40 + (Math.sin(bx * 0.1) * 20 + 20);
        ctx.fillRect(bx, horizonY - bHeight, 30, bHeight);
      }

      // Ground / Railway ballast
      ctx.fillStyle = '#334155';
      ctx.fillRect(0, horizonY, canvas.width, canvas.height - horizonY);

      // Perspective 3 Track Lanes
      const project = (lane: number, z: number, yOffset: number = 0) => {
        const factor = 120 / (z + 120);
        const currentWidth = horizonWidth + (bottomWidth - horizonWidth) * factor;
        const screenX = centerX + (lane * currentWidth) / 3;
        const screenY = horizonY + (canvas.height - horizonY) * factor - yOffset * factor * 1.5;
        const scale = factor;
        return { x: screenX, y: screenY, scale };
      };

      // Draw Rails
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 2;
      for (let l = -1; l <= 1; l++) {
        const pTopLeft = project(l - 0.45, 1200);
        const pBotLeft = project(l - 0.45, 0);
        const pTopRight = project(l + 0.45, 1200);
        const pBotRight = project(l + 0.45, 0);

        // Ties / Sleepers moving with distance
        const offsetZ = (s.distance * 2) % 40;
        for (let tz = 1000; tz >= 20; tz -= 40) {
          const curZ = tz - offsetZ;
          if (curZ <= 0) continue;
          const leftPt = project(l - 0.5, curZ);
          const rightPt = project(l + 0.5, curZ);
          ctx.strokeStyle = '#713f12';
          ctx.lineWidth = Math.max(1, 4 * leftPt.scale);
          ctx.beginPath();
          ctx.moveTo(leftPt.x, leftPt.y);
          ctx.lineTo(rightPt.x, rightPt.y);
          ctx.stroke();
        }

        // Metal rails
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(pTopLeft.x, pTopLeft.y);
        ctx.lineTo(pBotLeft.x, pBotLeft.y);
        ctx.moveTo(pTopRight.x, pTopRight.y);
        ctx.lineTo(pBotRight.x, pBotRight.y);
        ctx.stroke();
      }

      // Draw Coins (back to front)
      const sortedCoins = [...s.coins].sort((a, b) => b.z - a.z);
      sortedCoins.forEach((c) => {
        if (c.collected) return;
        const pos = project(c.lane, c.z, 20);
        const r = Math.max(2, 10 * pos.scale);
        ctx.fillStyle = '#facc15';
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(pos.x - 1, pos.y - 1, r * 0.4, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw Obstacles (back to front)
      const sortedObs = [...s.obstacles].sort((a, b) => b.z - a.z);
      sortedObs.forEach((obs) => {
        if (obs.type === 'train') {
          // 3D train body
          const frontPos = project(obs.lane, obs.z);
          const backPos = project(obs.lane, obs.z + 180);
          const w = Math.max(15, 90 * frontPos.scale);
          const h = Math.max(25, 130 * frontPos.scale);

          // Train front
          ctx.fillStyle = obs.color || '#0284c7';
          ctx.fillRect(frontPos.x - w / 2, frontPos.y - h, w, h);
          // Windshield
          ctx.fillStyle = '#e0f2fe';
          ctx.fillRect(frontPos.x - w * 0.35, frontPos.y - h * 0.85, w * 0.7, h * 0.3);
          // Headlights
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(frontPos.x - w * 0.35, frontPos.y - h * 0.3, w * 0.2, h * 0.15);
          ctx.fillRect(frontPos.x + w * 0.15, frontPos.y - h * 0.3, w * 0.2, h * 0.15);
        } else if (obs.type === 'jump_barrier') {
          const pos = project(obs.lane, obs.z);
          const w = Math.max(12, 75 * pos.scale);
          const h = Math.max(8, 32 * pos.scale);
          // Red & white construction barrier
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(pos.x - w / 2, pos.y - h, w, h);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(pos.x - w * 0.25, pos.y - h, w * 0.2, h);
          ctx.fillRect(pos.x + w * 0.1, pos.y - h, w * 0.2, h);
        } else if (obs.type === 'slide_barrier') {
          const pos = project(obs.lane, obs.z);
          const w = Math.max(14, 80 * pos.scale);
          const h = Math.max(14, 85 * pos.scale);
          // Overhead sign / arch
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = Math.max(2, 6 * pos.scale);
          ctx.beginPath();
          ctx.moveTo(pos.x - w / 2, pos.y);
          ctx.lineTo(pos.x - w / 2, pos.y - h);
          ctx.lineTo(pos.x + w / 2, pos.y - h);
          ctx.lineTo(pos.x + w / 2, pos.y);
          ctx.stroke();

          // Low-hanging caution bar
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(pos.x - w / 2, pos.y - h * 0.8, w, h * 0.25);
        }
      });

      // Draw Player (Jake)
      const pPos = project(p.visualLane, 35, p.y);
      const pw = Math.max(16, 40 * pPos.scale);
      const ph = p.isSliding ? Math.max(10, 22 * pPos.scale) : Math.max(20, 60 * pPos.scale);

      // Shadow
      const shadowPos = project(p.visualLane, 35, 0);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(shadowPos.x, shadowPos.y, pw * 0.7, pw * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();

      // Body (Cap, Hoodie, Jeans)
      // Cap
      ctx.fillStyle = '#ef4444'; // Red baseball cap
      ctx.beginPath();
      ctx.arc(pPos.x, pPos.y - ph, pw * 0.35, Math.PI, 0);
      ctx.fill();
      // Hoodie
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(pPos.x - pw * 0.35, pPos.y - ph * 0.75, pw * 0.7, ph * 0.45);
      // Pants
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(pPos.x - pw * 0.3, pPos.y - ph * 0.3, pw * 0.6, ph * 0.3);

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isPaused, gameOver, onGameOver]);

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto">
      {/* Top HUD */}
      <div className="flex items-center justify-between w-full px-4 py-2 bg-slate-900/90 rounded-t-xl border border-slate-800 backdrop-blur-sm text-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">METERS</span>
          <span className="text-rose-400 font-bold text-lg tabular-nums">
            {Math.floor(stateRef.current.distance / 8)}m
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">COINS</span>
          <span className="text-amber-300 font-bold tabular-nums">★ {coins}</span>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative border-x border-b border-slate-800 rounded-b-xl overflow-hidden shadow-2xl bg-black">
        <canvas
          ref={canvasRef}
          width={420}
          height={480}
          className="block touch-none"
        />

        {gameOver && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
            <h3 className="text-2xl font-black text-rose-500 mb-1 tracking-wider">BUSTED!</h3>
            <p className="text-sm text-slate-300 mb-4">You crashed into a train or barricade.</p>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-6 w-48">
              <span className="text-xs text-slate-400">Score</span>
              <div className="text-2xl font-extrabold text-rose-400">{score} pts</div>
            </div>
            <button
              onClick={restartGame}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white font-semibold shadow-lg hover:brightness-110 active:scale-95 transition"
            >
              <RotateCcw className="w-4 h-4" />
              Surf Again
            </button>
          </div>
        )}
      </div>

      {/* Mobile Touch Controls */}
      <div className="mt-4 grid grid-cols-3 gap-2 w-52 sm:hidden select-none">
        <div />
        <button
          onClick={jump}
          className="h-12 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-slate-200 active:bg-rose-500 active:text-white"
        >
          <ArrowUp className="w-6 h-6" />
        </button>
        <div />
        <button
          onClick={() => switchLane(-1)}
          className="h-12 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-slate-200 active:bg-rose-500 active:text-white"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <button
          onClick={slide}
          className="h-12 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-slate-200 active:bg-rose-500 active:text-white"
        >
          <ArrowDown className="w-6 h-6" />
        </button>
        <button
          onClick={() => switchLane(1)}
          className="h-12 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center text-slate-200 active:bg-rose-500 active:text-white"
        >
          <ArrowRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

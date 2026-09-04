import React, { useEffect, useRef, useState } from 'react';
import { sound } from '../utils/audio';
import { ArrowLeft, ArrowRight, Crosshair, RotateCcw } from 'lucide-react';

interface DoodleProps {
  onGameOver: (score: number) => void;
  isPaused: boolean;
}

type PlatformType = 'green' | 'blue' | 'brown' | 'white';

interface Platform {
  x: number;
  y: number;
  width: number;
  height: number;
  type: PlatformType;
  vx?: number;
  broken?: boolean;
  hasSpring?: boolean;
  hasJetpack?: boolean;
}

interface Monster {
  x: number;
  y: number;
  width: number;
  height: number;
  alive: boolean;
}

interface Bullet {
  x: number;
  y: number;
  vy: number;
}

export const DoodleJumpGame: React.FC<DoodleProps> = ({ onGameOver, isPaused }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const stateRef = useRef({
    player: {
      x: 180,
      y: 400,
      vx: 0,
      vy: -10,
      facingLeft: false,
      jetpackTime: 0,
    },
    cameraY: 0,
    maxHeight: 0,
    score: 0,
    platforms: [] as Platform[],
    monsters: [] as Monster[],
    bullets: [] as Bullet[],
    keys: { left: false, right: false },
  });

  const restartGame = () => {
    initGame();
    setGameOver(false);
  };

  const initGame = () => {
    const platforms: Platform[] = [
      { x: 160, y: 520, width: 68, height: 14, type: 'green' },
      { x: 80, y: 440, width: 68, height: 14, type: 'green' },
      { x: 240, y: 360, width: 68, height: 14, type: 'green' },
      { x: 140, y: 280, width: 68, height: 14, type: 'blue', vx: 1.5 },
      { x: 200, y: 200, width: 68, height: 14, type: 'green', hasSpring: true },
      { x: 60, y: 120, width: 68, height: 14, type: 'green' },
      { x: 250, y: 40, width: 68, height: 14, type: 'green' },
    ];

    stateRef.current = {
      player: {
        x: 180,
        y: 490,
        vx: 0,
        vy: -11,
        facingLeft: false,
        jetpackTime: 0,
      },
      cameraY: 0,
      maxHeight: 0,
      score: 0,
      platforms,
      monsters: [],
      bullets: [],
      keys: { left: false, right: false },
    };
    setScore(0);
  };

  const shoot = () => {
    const s = stateRef.current;
    if (gameOver || isPaused) return;
    s.bullets.push({
      x: s.player.x + 18,
      y: s.player.y - 12,
      vy: -14,
    });
    sound.playJump();
  };

  useEffect(() => {
    initGame();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        stateRef.current.keys.left = true;
        e.preventDefault();
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        stateRef.current.keys.right = true;
        e.preventDefault();
      } else if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
        shoot();
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'KeyA'].includes(e.code)) {
        stateRef.current.keys.left = false;
        e.preventDefault();
      } else if (['ArrowRight', 'KeyD'].includes(e.code)) {
        stateRef.current.keys.right = false;
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Main Loop
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

        // Player horizontal movement
        if (s.keys.left) {
          p.vx -= 0.6;
          p.facingLeft = true;
        } else if (s.keys.right) {
          p.vx += 0.6;
          p.facingLeft = false;
        } else {
          p.vx *= 0.85; // Friction
        }
        p.vx = Math.max(-6.5, Math.min(6.5, p.vx));
        p.x += p.vx;

        // Wrap around screen edges
        if (p.x < -20) p.x = canvas.width;
        else if (p.x > canvas.width) p.x = -20;

        // Jetpack mode
        if (p.jetpackTime > 0) {
          p.jetpackTime--;
          p.vy = -12;
        } else {
          p.vy += 0.32; // Gravity
        }
        p.y += p.vy;

        // Camera scroll upwards
        if (p.y < s.cameraY + 240) {
          const delta = s.cameraY + 240 - p.y;
          s.cameraY -= delta;
          s.score += Math.floor(delta);
          setScore(s.score);
        }

        // Generate platforms above camera
        const highestPlatformY = s.platforms.reduce((min, pl) => Math.min(min, pl.y), 9999);
        if (highestPlatformY > s.cameraY - 100) {
          const newY = highestPlatformY - (55 + Math.random() * 45);
          const rand = Math.random();
          const type: PlatformType =
            rand < 0.55 ? 'green' : rand < 0.78 ? 'blue' : rand < 0.92 ? 'brown' : 'white';
          const hasSpring = Math.random() < 0.08 && type === 'green';
          const hasJetpack = Math.random() < 0.03 && type === 'green';

          s.platforms.push({
            x: 20 + Math.random() * (canvas.width - 95),
            y: newY,
            width: 68,
            height: 14,
            type,
            vx: type === 'blue' ? (Math.random() < 0.5 ? 1.5 : -1.5) : undefined,
            hasSpring,
            hasJetpack,
          });

          // Occasional Monster
          if (Math.random() < 0.08 && s.monsters.length < 2) {
            s.monsters.push({
              x: 40 + Math.random() * (canvas.width - 80),
              y: newY - 45,
              width: 36,
              height: 32,
              alive: true,
            });
          }
        }

        // Update Moving Platforms
        s.platforms.forEach((pl) => {
          if (pl.type === 'blue' && pl.vx) {
            pl.x += pl.vx;
            if (pl.x < 10 || pl.x > canvas.width - pl.width - 10) {
              pl.vx = -pl.vx;
            }
          }
        });

        // Platform Bouncing Collisions (only when falling downwards!)
        if (p.vy > 0) {
          s.platforms.forEach((pl) => {
            if (pl.broken) return;

            const playerBottom = p.y + 36;
            const playerCenterX = p.x + 18;

            if (
              playerBottom >= pl.y &&
              playerBottom <= pl.y + 16 &&
              playerCenterX >= pl.x - 6 &&
              playerCenterX <= pl.x + pl.width + 6
            ) {
              if (pl.type === 'brown') {
                // Cracked breaks!
                pl.broken = true;
                sound.playExplosion();
              } else {
                // Spring bounce or Normal bounce
                if (pl.hasSpring) {
                  p.vy = -18;
                  sound.playPowerup();
                } else if (pl.hasJetpack) {
                  p.jetpackTime = 140; // Fly up!
                  pl.hasJetpack = false;
                  sound.playPowerup();
                } else {
                  p.vy = -10.5;
                  sound.playJump();
                }

                if (pl.type === 'white') {
                  pl.broken = true;
                }
              }
            }
          });
        }

        // Bullets update & monster collisions
        s.bullets.forEach((b) => {
          b.y += b.vy;
          s.monsters.forEach((m) => {
            if (m.alive && Math.hypot(b.x - (m.x + m.width / 2), b.y - (m.y + m.height / 2)) < 22) {
              m.alive = false;
              s.score += 200;
              sound.playExplosion();
            }
          });
        });
        s.bullets = s.bullets.filter((b) => b.y > s.cameraY - 50);

        // Monster vs Player Collision
        s.monsters.forEach((m) => {
          if (!m.alive) return;
          const dist = Math.hypot(p.x + 18 - (m.x + m.width / 2), p.y + 18 - (m.y + m.height / 2));
          if (dist < 26) {
            // If stomping monster from above
            if (p.vy > 0 && p.y + 30 < m.y + 10) {
              m.alive = false;
              p.vy = -12;
              sound.playJump();
              s.score += 200;
            } else if (p.jetpackTime <= 0) {
              // Hit monster and died
              sound.playExplosion();
              sound.playGameOver();
              setGameOver(true);
              onGameOver(s.score);
            }
          }
        });

        // Clean up passed platforms
        s.platforms = s.platforms.filter((pl) => pl.y < s.cameraY + canvas.height + 80);
        s.monsters = s.monsters.filter((m) => m.y < s.cameraY + canvas.height + 80);

        // Fall below camera = Game Over
        if (p.y > s.cameraY + canvas.height + 40) {
          sound.playGameOver();
          setGameOver(true);
          onGameOver(s.score);
        }
      }

      // RENDER
      const s = stateRef.current;
      const p = s.player;

      // Graph paper background
      ctx.fillStyle = '#fefce8'; // Light notebook paper
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid lines
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
      ctx.lineWidth = 1;
      const camOffsetY = s.cameraY % 24;
      for (let y = -camOffsetY; y < canvas.height; y += 24) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      for (let x = 0; x < canvas.width; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      ctx.save();
      ctx.translate(0, -s.cameraY);

      // Draw Platforms
      s.platforms.forEach((pl) => {
        if (pl.broken) return;

        if (pl.type === 'green') ctx.fillStyle = '#65a30d';
        else if (pl.type === 'blue') ctx.fillStyle = '#0284c7';
        else if (pl.type === 'brown') ctx.fillStyle = '#b45309';
        else ctx.fillStyle = '#cbd5e1';

        ctx.beginPath();
        ctx.roundRect(pl.x, pl.y, pl.width, pl.height, 6);
        ctx.fill();

        // Platform border
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Spring
        if (pl.hasSpring) {
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(pl.x + pl.width / 2 - 6, pl.y - 10, 12, 10);
        }
        // Jetpack
        if (pl.hasJetpack) {
          ctx.fillStyle = '#ea580c';
          ctx.fillRect(pl.x + pl.width / 2 - 8, pl.y - 14, 16, 14);
        }
      });

      // Draw Bullets
      s.bullets.forEach((b) => {
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw Monsters
      s.monsters.forEach((m) => {
        if (!m.alive) return;
        ctx.fillStyle = '#9333ea';
        ctx.beginPath();
        ctx.ellipse(m.x + m.width / 2, m.y + m.height / 2, m.width / 2, m.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Eye
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(m.x + m.width / 2, m.y + m.height / 2 - 2, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.beginPath();
        ctx.arc(m.x + m.width / 2, m.y + m.height / 2 - 2, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw Doodler Character
      ctx.save();
      ctx.translate(p.x + 18, p.y + 18);
      if (p.facingLeft) ctx.scale(-1, 1);

      // Jetpack flames if active
      if (p.jetpackTime > 0) {
        ctx.fillStyle = '#f97316';
        ctx.fillRect(-18, 10, 8, 18 + Math.random() * 8);
      }

      // Yellow-green body
      ctx.fillStyle = '#a3e635';
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3f6212';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Snout / Nose
      ctx.fillStyle = '#84cc16';
      ctx.beginPath();
      ctx.ellipse(14, 0, 8, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Eyes
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(6, -4, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Four tiny legs
      ctx.strokeStyle = '#3f6212';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-10, 14);
      ctx.lineTo(-10, 20);
      ctx.moveTo(-4, 14);
      ctx.lineTo(-4, 20);
      ctx.moveTo(4, 14);
      ctx.lineTo(4, 20);
      ctx.moveTo(10, 14);
      ctx.lineTo(10, 20);
      ctx.stroke();

      ctx.restore();

      ctx.restore();

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPaused, gameOver, onGameOver]);

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto">
      {/* Top HUD */}
      <div className="flex items-center justify-between w-full px-4 py-2 bg-slate-900/90 rounded-t-xl border border-slate-800 backdrop-blur-sm text-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">ALTITUDE</span>
          <span className="text-lime-400 font-bold text-lg tabular-nums">{score}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={shoot}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-lime-600 hover:bg-lime-500 text-white font-semibold text-xs active:scale-95 transition"
          >
            <Crosshair className="w-3.5 h-3.5" />
            SHOOT
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative border-x border-b border-slate-800 rounded-b-xl overflow-hidden shadow-2xl bg-black">
        <canvas
          ref={canvasRef}
          width={380}
          height={500}
          className="block touch-none"
        />

        {gameOver && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
            <h3 className="text-2xl font-black text-rose-500 mb-1 tracking-wider">FELL DOWN!</h3>
            <p className="text-sm text-slate-300 mb-4">You tumbled into the void.</p>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-6 w-48">
              <span className="text-xs text-slate-400">Score</span>
              <div className="text-2xl font-extrabold text-lime-400">{score} pts</div>
            </div>
            <button
              onClick={restartGame}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-lime-500 to-green-600 text-white font-semibold shadow-lg hover:brightness-110 active:scale-95 transition"
            >
              <RotateCcw className="w-4 h-4" />
              Bounce Again
            </button>
          </div>
        )}
      </div>

      {/* Mobile Touch Controls */}
      <div className="mt-4 flex items-center justify-between gap-4 w-full px-4 sm:hidden select-none">
        <button
          onPointerDown={() => (stateRef.current.keys.left = true)}
          onPointerUp={() => (stateRef.current.keys.left = false)}
          className="flex-1 h-14 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center text-slate-200 active:bg-lime-500 active:text-white text-lg font-bold"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <button
          onClick={shoot}
          className="w-14 h-14 bg-lime-600 rounded-xl flex items-center justify-center text-white active:bg-lime-500 shadow-md"
        >
          <Crosshair className="w-6 h-6" />
        </button>
        <button
          onPointerDown={() => (stateRef.current.keys.right = true)}
          onPointerUp={() => (stateRef.current.keys.right = false)}
          className="flex-1 h-14 bg-slate-800 border border-slate-700 rounded-xl flex items-center justify-center text-slate-200 active:bg-lime-500 active:text-white text-lg font-bold"
        >
          <ArrowRight className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

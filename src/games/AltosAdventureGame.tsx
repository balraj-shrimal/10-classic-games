import React, { useEffect, useRef, useState } from 'react';
import { sound } from '../utils/audio';
import { RotateCcw } from 'lucide-react';

interface AltosProps {
  onGameOver: (score: number) => void;
  isPaused: boolean;
}

export const AltosAdventureGame: React.FC<AltosProps> = ({ onGameOver, isPaused }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [llamas, setLlamas] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isHoldingJump, setIsHoldingJump] = useState(false);

  const stateRef = useRef({
    player: {
      x: 120,
      y: 0,
      vy: 0,
      angle: 0, // rotation in radians
      inAir: false,
      flips: 0,
      rotationAccum: 0,
      scarfPoints: [] as { x: number; y: number }[],
    },
    distance: 0,
    speed: 5.5,
    llamasCount: 0,
    score: 0,
    llamas: [] as { x: number; y: number; caught: boolean }[],
    coins: [] as { x: number; y: number; collected: boolean }[],
    chasms: [] as { startX: number; endX: number }[],
    snowflakes: [] as { x: number; y: number; speed: number; size: number }[],
    timeOfDay: 0, // 0 to 1 cycle
  });

  // Calculate terrain height at global X
  const getTerrainHeight = (worldX: number): number => {
    // Check if in chasm
    for (const c of stateRef.current.chasms) {
      if (worldX >= c.startX && worldX <= c.endX) {
        return 700; // Deep drop
      }
    }

    const h1 = Math.sin(worldX * 0.003) * 60;
    const h2 = Math.sin(worldX * 0.008 + 1) * 35;
    const h3 = Math.cos(worldX * 0.001) * 20;
    return 320 + h1 + h2 + h3;
  };

  const getTerrainSlope = (worldX: number): number => {
    const delta = 2;
    const y1 = getTerrainHeight(worldX - delta);
    const y2 = getTerrainHeight(worldX + delta);
    return Math.atan2(y2 - y1, delta * 2);
  };

  const startJump = () => {
    setIsHoldingJump(true);
    const p = stateRef.current.player;
    if (!p.inAir) {
      p.vy = -9.2;
      p.inAir = true;
      p.rotationAccum = 0;
      sound.playJump();
    }
  };

  const stopJump = () => {
    setIsHoldingJump(false);
  };

  const restartGame = () => {
    stateRef.current = {
      player: {
        x: 120,
        y: 280,
        vy: 0,
        angle: 0,
        inAir: false,
        flips: 0,
        rotationAccum: 0,
        scarfPoints: [],
      },
      distance: 0,
      speed: 5.5,
      llamasCount: 0,
      score: 0,
      llamas: [],
      coins: [],
      chasms: [],
      snowflakes: Array.from({ length: 45 }, () => ({
        x: Math.random() * 500,
        y: Math.random() * 400,
        speed: 1 + Math.random() * 2,
        size: 1 + Math.random() * 2,
      })),
      timeOfDay: 0,
    };
    setScore(0);
    setLlamas(0);
    setGameOver(false);
  };

  useEffect(() => {
    // Generate initial snowflakes
    stateRef.current.snowflakes = Array.from({ length: 45 }, () => ({
      x: Math.random() * 500,
      y: Math.random() * 400,
      speed: 1 + Math.random() * 2,
      size: 1 + Math.random() * 2,
    }));

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
        startJump();
        e.preventDefault();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
        stopJump();
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

        s.distance += s.speed;
        s.score = Math.floor(s.distance / 10) + s.llamasCount * 50;
        setScore(s.score);
        s.timeOfDay = (s.timeOfDay + 0.0003) % 1;

        // Spawn llamas & coins & chasms ahead
        if (s.llamas.length === 0 || s.llamas[s.llamas.length - 1].x < s.distance + 1200) {
          const spawnX = s.distance + 800 + Math.random() * 600;
          s.llamas.push({ x: spawnX, y: getTerrainHeight(spawnX), caught: false });
        }
        if (s.coins.length === 0 || s.coins[s.coins.length - 1].x < s.distance + 1200) {
          const spawnX = s.distance + 600 + Math.random() * 500;
          s.coins.push({ x: spawnX, y: getTerrainHeight(spawnX) - 30, collected: false });
        }
        if (s.chasms.length === 0 || s.chasms[s.chasms.length - 1].endX < s.distance + 2000) {
          if (Math.random() < 0.3) {
            const startX = s.distance + 1400 + Math.random() * 800;
            s.chasms.push({ startX, endX: startX + 90 });
          }
        }

        // Clean up passed objects
        s.llamas = s.llamas.filter((l) => l.x > s.distance - 200);
        s.coins = s.coins.filter((c) => c.x > s.distance - 200);
        s.chasms = s.chasms.filter((c) => c.endX > s.distance - 200);

        // Physics
        const groundY = getTerrainHeight(s.distance + p.x);
        const slope = getTerrainSlope(s.distance + p.x);

        if (p.inAir) {
          p.vy += 0.32; // Gravity
          p.y += p.vy;

          // Backflip rotation if holding jump
          if (isHoldingJump) {
            const rotSpeed = 0.085;
            p.angle += rotSpeed;
            p.rotationAccum += rotSpeed;
          } else {
            // Slight tilt towards velocity
            p.angle += (Math.atan2(p.vy, s.speed) - p.angle) * 0.05;
          }

          // Land on ground
          if (p.y >= groundY - 4) {
            // Check if landed properly or crash
            const normalizedAngle = ((p.angle - slope) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
            // Must be close to 0 or 2*PI (right side up)
            const safeLanding = normalizedAngle < 1.1 || normalizedAngle > Math.PI * 2 - 1.1;

            if (!safeLanding || groundY > 600) {
              // Crash!
              sound.playExplosion();
              sound.playGameOver();
              setGameOver(true);
              onGameOver(s.score);
            } else {
              // Successfully landed!
              p.y = groundY - 4;
              p.vy = 0;
              p.inAir = false;
              p.angle = slope;

              // Check if completed flip
              if (p.rotationAccum >= Math.PI * 1.8) {
                p.flips += 1;
                s.score += 150;
                s.speed = Math.min(9.5, s.speed + 1.2); // Speed boost on backflip!
                sound.playPowerup();
              }
            }
          }
        } else {
          // On the ground
          p.y = groundY - 4;
          p.angle = slope;
          p.vy = 0;

          // Natural speed deceleration towards baseline
          if (s.speed > 5.5) s.speed -= 0.008;

          // Slope acceleration
          if (slope > 0.1) {
            s.speed += 0.015;
          }
        }

        // Scarf trailing physics
        p.scarfPoints.unshift({ x: p.x - Math.cos(p.angle) * 12, y: p.y - 14 });
        if (p.scarfPoints.length > 18) {
          p.scarfPoints.pop();
        }

        // Check Llama rescues
        s.llamas.forEach((llama) => {
          if (!llama.caught && Math.abs(s.distance + p.x - llama.x) < 25 && Math.abs(p.y - llama.y) < 35) {
            llama.caught = true;
            s.llamasCount += 1;
            setLlamas(s.llamasCount);
            sound.playCoin();
          }
        });

        // Check Coin pickups
        s.coins.forEach((coin) => {
          if (!coin.collected && Math.abs(s.distance + p.x - coin.x) < 25 && Math.abs(p.y - coin.y) < 35) {
            coin.collected = true;
            s.score += 20;
            sound.playCoin();
          }
        });

        // Snowflakes update
        s.snowflakes.forEach((sf) => {
          sf.y += sf.speed;
          sf.x -= s.speed * 0.4;
          if (sf.y > canvas.height) sf.y = 0;
          if (sf.x < 0) sf.x = canvas.width;
        });
      }

      // RENDER
      const s = stateRef.current;
      const p = s.player;

      // Dynamic Sky Gradient based on timeOfDay (Day -> Sunset -> Night -> Sunrise)
      const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      if (s.timeOfDay < 0.35) {
        // Crisp Daylight
        grad.addColorStop(0, '#38bdf8');
        grad.addColorStop(1, '#e0f2fe');
      } else if (s.timeOfDay < 0.7) {
        // Sunset
        grad.addColorStop(0, '#f97316');
        grad.addColorStop(0.5, '#ec4899');
        grad.addColorStop(1, '#312e81');
      } else {
        // Night
        grad.addColorStop(0, '#0f172a');
        grad.addColorStop(1, '#1e1b4b');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Distant Parallax Mountain Ridges
      ctx.fillStyle = s.timeOfDay > 0.7 ? '#1e293b' : '#94a3b8';
      ctx.beginPath();
      ctx.moveTo(0, canvas.height);
      for (let mx = 0; mx <= canvas.width; mx += 20) {
        const my = 220 + Math.sin((s.distance * 0.15 + mx) * 0.005) * 70;
        ctx.lineTo(mx, my);
      }
      ctx.lineTo(canvas.width, canvas.height);
      ctx.closePath();
      ctx.fill();

      // Midground Snow Dunes
      ctx.fillStyle = s.timeOfDay > 0.7 ? '#334155' : '#cbd5e1';
      ctx.beginPath();
      ctx.moveTo(0, canvas.height);
      for (let mx = 0; mx <= canvas.width; mx += 15) {
        const my = 270 + Math.sin((s.distance * 0.4 + mx) * 0.007) * 45;
        ctx.lineTo(mx, my);
      }
      ctx.lineTo(canvas.width, canvas.height);
      ctx.closePath();
      ctx.fill();

      // Foreground Terrain (Snow slope)
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(0, canvas.height);
      for (let cx = 0; cx <= canvas.width; cx += 5) {
        const worldX = s.distance + cx;
        const ty = getTerrainHeight(worldX);
        ctx.lineTo(cx, ty);
      }
      ctx.lineTo(canvas.width, canvas.height);
      ctx.closePath();
      ctx.fill();

      // Subtle ice sheen line
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let cx = 0; cx <= canvas.width; cx += 5) {
        const worldX = s.distance + cx;
        const ty = getTerrainHeight(worldX);
        if (cx === 0) ctx.moveTo(cx, ty);
        else ctx.lineTo(cx, ty);
      }
      ctx.stroke();

      // Draw Llamas
      s.llamas.forEach((llama) => {
        if (llama.caught) return;
        const screenX = llama.x - s.distance;
        const screenY = llama.y;
        if (screenX >= -30 && screenX <= canvas.width + 30) {
          // Llama body
          ctx.fillStyle = '#fed7aa';
          ctx.beginPath();
          ctx.ellipse(screenX, screenY - 12, 12, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          // Neck & Head
          ctx.fillRect(screenX + 6, screenY - 24, 5, 14);
          ctx.fillRect(screenX + 4, screenY - 26, 9, 6);
          // Legs
          ctx.strokeStyle = '#fdba74';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(screenX - 6, screenY - 6);
          ctx.lineTo(screenX - 6, screenY);
          ctx.moveTo(screenX + 6, screenY - 6);
          ctx.lineTo(screenX + 6, screenY);
          ctx.stroke();
        }
      });

      // Draw Coins
      s.coins.forEach((coin) => {
        if (coin.collected) return;
        const screenX = coin.x - s.distance;
        const screenY = coin.y;
        if (screenX >= -20 && screenX <= canvas.width + 20) {
          ctx.fillStyle = '#facc15';
          ctx.beginPath();
          ctx.arc(screenX, screenY, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#fef08a';
          ctx.beginPath();
          ctx.arc(screenX - 1, screenY - 1, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      // Draw Player Scarf
      if (p.scarfPoints.length > 1) {
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        p.scarfPoints.forEach((pt, idx) => {
          const sx = pt.x;
          const sy = pt.y + idx * 0.4;
          if (idx === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        });
        ctx.stroke();
      }

      // Draw Snowboarder (Alto)
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);

      // Snowboard
      ctx.fillStyle = '#e11d48';
      ctx.beginPath();
      ctx.roundRect(-20, -2, 40, 4, 2);
      ctx.fill();

      // Alto Figure
      // Cloak
      ctx.fillStyle = '#b91c1c';
      ctx.beginPath();
      ctx.moveTo(-6, -2);
      ctx.lineTo(6, -2);
      ctx.lineTo(2, -18);
      ctx.lineTo(-4, -18);
      ctx.closePath();
      ctx.fill();
      // Head
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(0, -22, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Snowflakes overlay
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      s.snowflakes.forEach((sf) => {
        ctx.beginPath();
        ctx.arc(sf.x, sf.y, sf.size, 0, Math.PI * 2);
        ctx.fill();
      });

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPaused, gameOver, isHoldingJump, onGameOver]);

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto">
      {/* Top HUD */}
      <div className="flex items-center justify-between w-full px-4 py-2 bg-slate-900/90 rounded-t-xl border border-slate-800 backdrop-blur-sm text-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">DISTANCE</span>
          <span className="text-sky-400 font-bold text-lg tabular-nums">{score}m</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">LLAMAS</span>
          <span className="text-amber-300 font-bold tabular-nums">🦙 {llamas}</span>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative border-x border-b border-slate-800 rounded-b-xl overflow-hidden shadow-2xl bg-black">
        <canvas
          ref={canvasRef}
          width={450}
          height={420}
          className="block touch-none cursor-pointer"
          onMouseDown={startJump}
          onMouseUp={stopJump}
          onTouchStart={startJump}
          onTouchEnd={stopJump}
        />

        {gameOver && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
            <h3 className="text-2xl font-black text-rose-500 mb-1 tracking-wider">WIPEOUT!</h3>
            <p className="text-sm text-slate-300 mb-4">You tumbled in the deep snow.</p>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-6 w-48">
              <span className="text-xs text-slate-400">Score</span>
              <div className="text-2xl font-extrabold text-sky-400">{score} pts</div>
            </div>
            <button
              onClick={restartGame}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-semibold shadow-lg hover:brightness-110 active:scale-95 transition"
            >
              <RotateCcw className="w-4 h-4" />
              Ride Again
            </button>
          </div>
        )}
      </div>

      {/* Touch Button */}
      <div className="mt-4 w-full px-4 sm:hidden">
        <button
          onMouseDown={startJump}
          onMouseUp={stopJump}
          onTouchStart={startJump}
          onTouchEnd={stopJump}
          className="w-full h-14 bg-sky-600 active:bg-sky-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg"
        >
          JUMP / HOLD TO FLIP
        </button>
      </div>
    </div>
  );
};

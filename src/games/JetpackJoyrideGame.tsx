import React, { useEffect, useRef, useState } from 'react';
import { sound } from '../utils/audio';
import { RotateCcw } from 'lucide-react';

interface JetpackProps {
  onGameOver: (score: number) => void;
  isPaused: boolean;
}

interface Zapper {
  x: number;
  y: number;
  angle: number;
  length: number;
}

interface Laser {
  y: number;
  timer: number; // counts down: >60 warning, 0-60 firing
  height: number;
}

interface Missile {
  x: number;
  y: number;
  targetY: number;
  speed: number;
  warningTimer: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

export const JetpackJoyrideGame: React.FC<JetpackProps> = ({ onGameOver, isPaused }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isThrusting, setIsThrusting] = useState(false);

  const stateRef = useRef({
    player: {
      x: 80,
      y: 350,
      vy: 0,
      width: 28,
      height: 38,
      grounded: true,
      runFrame: 0,
    },
    distance: 0,
    speed: 6.2,
    coinsCount: 0,
    zappers: [] as Zapper[],
    lasers: [] as Laser[],
    missiles: [] as Missile[],
    coins: [] as { x: number; y: number; collected: boolean }[],
    particles: [] as Particle[],
  });

  const startThrust = () => {
    setIsThrusting(true);
  };
  const stopThrust = () => {
    setIsThrusting(false);
  };

  const restartGame = () => {
    stateRef.current = {
      player: {
        x: 80,
        y: 350,
        vy: 0,
        width: 28,
        height: 38,
        grounded: true,
        runFrame: 0,
      },
      distance: 0,
      speed: 6.2,
      coinsCount: 0,
      zappers: [],
      lasers: [],
      missiles: [],
      coins: [],
      particles: [],
    };
    setScore(0);
    setCoins(0);
    setGameOver(false);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
        startThrust();
        e.preventDefault();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
        stopThrust();
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
    let thrustAudioCooldown = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const loop = () => {
      if (!isPaused && !gameOver) {
        const s = stateRef.current;
        const p = s.player;

        s.distance += s.speed;
        setScore(Math.floor(s.distance / 10) + s.coinsCount * 10);

        // Player physics
        if (isThrusting) {
          p.vy -= 0.65;
          thrustAudioCooldown++;
          if (thrustAudioCooldown % 6 === 0) {
            sound.playJetpackThrust();
          }

          // Emit machine gun bullets/smoke downwards
          for (let i = 0; i < 3; i++) {
            s.particles.push({
              x: p.x + 4 + Math.random() * 6,
              y: p.y + p.height - 4,
              vx: -s.speed * 0.5 + (Math.random() - 0.5) * 3,
              vy: 7 + Math.random() * 5,
              life: 1.0,
              color: Math.random() < 0.4 ? '#f59e0b' : '#94a3b8',
            });
          }
        } else {
          p.vy += 0.45; // Gravity
        }

        // Terminal velocity
        p.vy = Math.max(-8, Math.min(8, p.vy));
        p.y += p.vy;

        // Floor & Ceiling bounds
        const floorY = canvas.height - 48 - p.height;
        const ceilY = 40;

        if (p.y >= floorY) {
          p.y = floorY;
          p.vy = 0;
          p.grounded = true;
          p.runFrame = (p.runFrame + 0.25) % 4;
        } else {
          p.grounded = false;
        }

        if (p.y <= ceilY) {
          p.y = ceilY;
          p.vy = 0;
        }

        // Spawn Obstacles & Coins
        if (s.zappers.length < 3 && Math.random() < 0.02) {
          const lastZapperX = s.zappers.length > 0 ? s.zappers[s.zappers.length - 1].x : 0;
          if (canvas.width - lastZapperX > 220) {
            s.zappers.push({
              x: canvas.width + 50,
              y: 80 + Math.random() * (canvas.height - 200),
              angle: (Math.random() - 0.5) * 1.2,
              length: 65 + Math.random() * 30,
            });
          }
        }

        if (s.lasers.length === 0 && Math.random() < 0.008) {
          s.lasers.push({
            y: 80 + Math.random() * (canvas.height - 180),
            timer: 150, // 90 frames warning, 60 frames firing
            height: 24,
          });
        }

        if (s.missiles.length === 0 && Math.random() < 0.012) {
          s.missiles.push({
            x: canvas.width + 40,
            y: p.y,
            targetY: p.y,
            speed: 10,
            warningTimer: 75,
          });
        }

        if (s.coins.length < 8 && Math.random() < 0.03) {
          const coinPatternY = 90 + Math.random() * (canvas.height - 200);
          for (let i = 0; i < 6; i++) {
            s.coins.push({
              x: canvas.width + 40 + i * 28,
              y: coinPatternY + Math.sin(i * 0.5) * 20,
              collected: false,
            });
          }
        }

        // Update Zappers
        s.zappers.forEach((z) => {
          z.x -= s.speed;

          // Check Collision with player
          const zx1 = z.x - (Math.cos(z.angle) * z.length) / 2;
          const zy1 = z.y - (Math.sin(z.angle) * z.length) / 2;
          const zx2 = z.x + (Math.cos(z.angle) * z.length) / 2;
          const zy2 = z.y + (Math.sin(z.angle) * z.length) / 2;

          // Check line-box intersection roughly
          const steps = 6;
          for (let i = 0; i <= steps; i++) {
            const sx = zx1 + ((zx2 - zx1) * i) / steps;
            const sy = zy1 + ((zy2 - zy1) * i) / steps;
            if (
              sx >= p.x &&
              sx <= p.x + p.width &&
              sy >= p.y &&
              sy <= p.y + p.height
            ) {
              sound.playExplosion();
              sound.playGameOver();
              setGameOver(true);
              onGameOver(Math.floor(s.distance / 10) + s.coinsCount * 10);
            }
          }
        });
        s.zappers = s.zappers.filter((z) => z.x > -100);

        // Update Lasers
        s.lasers.forEach((l) => {
          l.timer--;
          // When firing (timer < 60)
          if (l.timer < 60) {
            if (p.y + p.height >= l.y && p.y <= l.y + l.height) {
              sound.playExplosion();
              sound.playGameOver();
              setGameOver(true);
              onGameOver(Math.floor(s.distance / 10) + s.coinsCount * 10);
            }
          }
        });
        s.lasers = s.lasers.filter((l) => l.timer > 0);

        // Update Missiles
        s.missiles.forEach((m) => {
          if (m.warningTimer > 0) {
            m.warningTimer--;
            // Track player Y during warning
            m.targetY += (p.y - m.targetY) * 0.08;
            m.y = m.targetY;
          } else {
            m.x -= m.speed;
            // Collision with player
            if (
              m.x >= p.x &&
              m.x <= p.x + p.width + 20 &&
              m.y >= p.y - 10 &&
              m.y <= p.y + p.height + 10
            ) {
              sound.playExplosion();
              sound.playGameOver();
              setGameOver(true);
              onGameOver(Math.floor(s.distance / 10) + s.coinsCount * 10);
            }
          }
        });
        s.missiles = s.missiles.filter((m) => m.x > -80);

        // Update Coins
        s.coins.forEach((c) => {
          c.x -= s.speed;
          if (
            !c.collected &&
            c.x >= p.x - 12 &&
            c.x <= p.x + p.width + 12 &&
            c.y >= p.y - 12 &&
            c.y <= p.y + p.height + 12
          ) {
            c.collected = true;
            s.coinsCount++;
            setCoins(s.coinsCount);
            sound.playCoin();
          }
        });
        s.coins = s.coins.filter((c) => c.x > -30);

        // Update Particles
        s.particles.forEach((pt) => {
          pt.x += pt.vx;
          pt.y += pt.vy;
          pt.life -= 0.05;
        });
        s.particles = s.particles.filter((pt) => pt.life > 0);
      }

      // RENDER
      const s = stateRef.current;
      const p = s.player;

      // Lab Wall Background
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Lab Wall Panels & Grids
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      const bgOffset = (s.distance * 0.4) % 60;
      for (let x = -bgOffset; x < canvas.width; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 60) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Metal Ceiling & Floor Stripes
      // Ceiling
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, 36);
      ctx.fillStyle = '#eab308';
      for (let x = -(s.distance % 40); x < canvas.width; x += 40) {
        ctx.fillRect(x, 32, 20, 4);
      }
      // Floor
      const floorY = canvas.height - 48;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, floorY, canvas.width, 48);
      ctx.fillStyle = '#eab308';
      for (let x = -(s.distance % 40); x < canvas.width; x += 40) {
        ctx.fillRect(x, floorY, 20, 4);
      }

      // Render Coins
      s.coins.forEach((c) => {
        if (c.collected) return;
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.arc(c.x, c.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(c.x - 1, c.y - 1, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      // Render Zappers
      s.zappers.forEach((z) => {
        ctx.save();
        ctx.translate(z.x, z.y);
        ctx.rotate(z.angle);

        // Zapper Nodes
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.arc(-z.length / 2, 0, 8, 0, Math.PI * 2);
        ctx.arc(z.length / 2, 0, 8, 0, Math.PI * 2);
        ctx.fill();

        // High voltage electric arc
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(-z.length / 2, 0);
        const arcSteps = 5;
        for (let i = 1; i < arcSteps; i++) {
          const stepX = -z.length / 2 + (z.length * i) / arcSteps;
          const stepY = (Math.random() - 0.5) * 8;
          ctx.lineTo(stepX, stepY);
        }
        ctx.lineTo(z.length / 2, 0);
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.restore();
      });

      // Render Lasers
      s.lasers.forEach((l) => {
        if (l.timer >= 60) {
          // Warning state (blinking red line)
          const blink = Math.floor(Date.now() / 100) % 2 === 0;
          ctx.strokeStyle = blink ? '#ef4444' : 'rgba(239, 68, 68, 0.2)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(0, l.y + l.height / 2);
          ctx.lineTo(canvas.width, l.y + l.height / 2);
          ctx.stroke();
        } else {
          // Firing state!
          ctx.fillStyle = '#ef4444';
          ctx.shadowColor = '#dc2626';
          ctx.shadowBlur = 14;
          ctx.fillRect(0, l.y, canvas.width, l.height);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, l.y + l.height * 0.35, canvas.width, l.height * 0.3);
          ctx.shadowBlur = 0;
        }
      });

      // Render Missiles
      s.missiles.forEach((m) => {
        if (m.warningTimer > 0) {
          // Exclamation indicator on right side
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.roundRect(canvas.width - 32, m.y - 14, 28, 28, 6);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 18px sans-serif';
          ctx.fillText('!', canvas.width - 20, m.y + 6);
        } else {
          // Rocket flying left
          ctx.fillStyle = '#e11d48';
          ctx.beginPath();
          ctx.moveTo(m.x, m.y);
          ctx.lineTo(m.x + 30, m.y - 8);
          ctx.lineTo(m.x + 30, m.y + 8);
          ctx.closePath();
          ctx.fill();
          // Thruster flame
          ctx.fillStyle = '#f59e0b';
          ctx.beginPath();
          ctx.moveTo(m.x + 30, m.y - 5);
          ctx.lineTo(m.x + 45 + Math.random() * 8, m.y);
          ctx.lineTo(m.x + 30, m.y + 5);
          ctx.closePath();
          ctx.fill();
        }
      });

      // Render Particles (Bullet casings / Smoke)
      s.particles.forEach((pt) => {
        ctx.fillStyle = pt.color;
        ctx.globalAlpha = pt.life;
        ctx.fillRect(pt.x, pt.y, 3, 3);
      });
      ctx.globalAlpha = 1.0;

      // Render Barry Steakfries & Jetpack
      ctx.save();
      ctx.translate(p.x, p.y);

      // Jetpack body on Barry's back
      ctx.fillStyle = '#64748b';
      ctx.fillRect(-6, 8, 10, 22);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(-4, 6, 6, 8); // Jetpack nozzle cap
      ctx.fillStyle = '#475569';
      ctx.fillRect(-6, 28, 10, 5); // Exhaust nozzle

      // Barry Character
      // Head
      ctx.fillStyle = '#fde047'; // Blonde hair
      ctx.fillRect(6, 0, 14, 6);
      ctx.fillStyle = '#fed7aa'; // Face
      ctx.fillRect(8, 6, 12, 10);
      // Torso / Suit
      ctx.fillStyle = '#0284c7'; // Blue suit
      ctx.fillRect(4, 16, 18, 14);
      // Legs / Running
      ctx.fillStyle = '#1e293b';
      if (p.grounded) {
        const legOffset = Math.sin(p.runFrame * Math.PI) * 6;
        ctx.fillRect(6, 30, 5, 8 + legOffset);
        ctx.fillRect(14, 30, 5, 8 - legOffset);
      } else {
        // Flying legs bent
        ctx.fillRect(6, 30, 6, 6);
        ctx.fillRect(12, 28, 6, 6);
      }

      ctx.restore();

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isPaused, gameOver, isThrusting, onGameOver]);

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto">
      {/* Top HUD */}
      <div className="flex items-center justify-between w-full px-4 py-2 bg-slate-900/90 rounded-t-xl border border-slate-800 backdrop-blur-sm text-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">DISTANCE</span>
          <span className="text-amber-400 font-bold text-lg tabular-nums">
            {Math.floor(stateRef.current.distance / 10)}m
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">COINS</span>
          <span className="text-yellow-300 font-bold tabular-nums">★ {coins}</span>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative border-x border-b border-slate-800 rounded-b-xl overflow-hidden shadow-2xl bg-black">
        <canvas
          ref={canvasRef}
          width={450}
          height={420}
          className="block touch-none cursor-pointer"
          onMouseDown={startThrust}
          onMouseUp={stopThrust}
          onTouchStart={startThrust}
          onTouchEnd={stopThrust}
        />

        {gameOver && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
            <h3 className="text-2xl font-black text-rose-500 mb-1 tracking-wider">ZAPPED!</h3>
            <p className="text-sm text-slate-300 mb-4">The lab security got you.</p>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-6 w-48">
              <span className="text-xs text-slate-400">Score</span>
              <div className="text-2xl font-extrabold text-amber-400">{score} pts</div>
            </div>
            <button
              onClick={restartGame}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold shadow-lg hover:brightness-110 active:scale-95 transition"
            >
              <RotateCcw className="w-4 h-4" />
              Fly Again
            </button>
          </div>
        )}
      </div>

      {/* Touch Button */}
      <div className="mt-4 w-full px-4 sm:hidden">
        <button
          onMouseDown={startThrust}
          onMouseUp={stopThrust}
          onTouchStart={startThrust}
          onTouchEnd={stopThrust}
          className="w-full h-14 bg-amber-600 active:bg-amber-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg"
        >
          HOLD TO FIRE JETPACK
        </button>
      </div>
    </div>
  );
};

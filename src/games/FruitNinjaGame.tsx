import React, { useEffect, useRef, useState } from 'react';
import { sound } from '../utils/audio';
import { RotateCcw } from 'lucide-react';

interface FruitNinjaProps {
  onGameOver: (score: number) => void;
  isPaused: boolean;
}

interface Fruit {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  vRot: number;
  radius: number;
  type: 'watermelon' | 'orange' | 'apple' | 'banana' | 'bomb';
  color: string;
  innerColor: string;
  sliced: boolean;
  // Sliced halves
  half1?: { x: number; y: number; vx: number; vy: number; rot: number };
  half2?: { x: number; y: number; vx: number; vy: number; rot: number };
}

interface Splash {
  x: number;
  y: number;
  color: string;
  radius: number;
  alpha: number;
}

interface TrailPoint {
  x: number;
  y: number;
  time: number;
}

export const FruitNinjaGame: React.FC<FruitNinjaProps> = ({ onGameOver, isPaused }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [comboText, setComboText] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);

  const stateRef = useRef({
    score: 0,
    strikes: 0,
    fruits: [] as Fruit[],
    splashes: [] as Splash[],
    trail: [] as TrailPoint[],
    isMouseDown: false,
    comboCount: 0,
    comboTimer: 0,
    nextFruitId: 1,
    spawnCooldown: 0,
  });

  const restartGame = () => {
    stateRef.current = {
      score: 0,
      strikes: 0,
      fruits: [],
      splashes: [],
      trail: [],
      isMouseDown: false,
      comboCount: 0,
      comboTimer: 0,
      nextFruitId: 1,
      spawnCooldown: 0,
    };
    setScore(0);
    setStrikes(0);
    setComboText(null);
    setGameOver(false);
  };

  // Slice check along blade segment
  const checkSlice = (x1: number, y1: number, x2: number, y2: number) => {
    const s = stateRef.current;
    if (gameOver || isPaused) return;

    let slicedThisStroke = 0;

    s.fruits.forEach((f) => {
      if (f.sliced) return;

      // Distance from point to line segment
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) return;

      let t = ((f.x - x1) * dx + (f.y - y1) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const nearestX = x1 + t * dx;
      const nearestY = y1 + t * dy;
      const dist = Math.hypot(f.x - nearestX, f.y - nearestY);

      if (dist < f.radius + 6) {
        if (f.type === 'bomb') {
          // Explode!
          sound.playExplosion();
          sound.playGameOver();
          setGameOver(true);
          onGameOver(s.score);
        } else {
          // Slice fruit
          f.sliced = true;
          f.half1 = { x: f.x, y: f.y, vx: f.vx - 3, vy: f.vy - 2, rot: f.rotation };
          f.half2 = { x: f.x, y: f.y, vx: f.vx + 3, vy: f.vy - 2, rot: f.rotation };

          // Add splatter
          s.splashes.push({
            x: f.x,
            y: f.y,
            color: f.innerColor,
            radius: f.radius * 1.5,
            alpha: 0.8,
          });

          slicedThisStroke++;
          s.comboCount++;
          s.comboTimer = 25; // Window for combo
          sound.playSlice();

          s.score += 10;
          setScore(s.score);
        }
      }
    });

    if (slicedThisStroke >= 2) {
      sound.playPowerup();
      setComboText(`Combo x${slicedThisStroke}! +${slicedThisStroke * 5}`);
      s.score += slicedThisStroke * 5;
      setScore(s.score);
      setTimeout(() => setComboText(null), 1200);
    }
  };

  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Track mouse & touch movements for blade trail
    const handlePointerDown = (e: PointerEvent) => {
      stateRef.current.isMouseDown = true;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      stateRef.current.trail = [{ x, y, time: Date.now() }];
    };

    const handlePointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (stateRef.current.isMouseDown) {
        const tr = stateRef.current.trail;
        if (tr.length > 0) {
          const prev = tr[tr.length - 1];
          checkSlice(prev.x, prev.y, x, y);
        }
        tr.push({ x, y, time: Date.now() });
      }
    };

    const handlePointerUp = () => {
      stateRef.current.isMouseDown = false;
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    const loop = () => {
      if (!isPaused && !gameOver) {
        const s = stateRef.current;

        // Clean old blade trail points
        const now = Date.now();
        s.trail = s.trail.filter((p) => now - p.time < 180);

        // Spawn fruits
        s.spawnCooldown--;
        if (s.spawnCooldown <= 0) {
          s.spawnCooldown = 40 + Math.floor(Math.random() * 35);
          const count = 1 + Math.floor(Math.random() * 3);
          const types: Fruit['type'][] = ['watermelon', 'orange', 'apple', 'banana'];

          for (let i = 0; i < count; i++) {
            const isBomb = Math.random() < 0.16;
            const type = isBomb ? 'bomb' : types[Math.floor(Math.random() * types.length)];
            const x = 70 + Math.random() * (canvas.width - 140);
            const targetCenterX = canvas.width / 2;
            const vx = (targetCenterX - x) * 0.015 + (Math.random() - 0.5) * 3;
            const vy = -12.5 - Math.random() * 3.5;

            let color = '#22c55e';
            let innerColor = '#ef4444';
            let radius = 24;

            if (type === 'orange') {
              color = '#f97316';
              innerColor = '#fb923c';
              radius = 20;
            } else if (type === 'apple') {
              color = '#dc2626';
              innerColor = '#fef08a';
              radius = 19;
            } else if (type === 'banana') {
              color = '#facc15';
              innerColor = '#fef9c3';
              radius = 22;
            } else if (type === 'bomb') {
              color = '#0f172a';
              innerColor = '#ef4444';
              radius = 22;
            }

            s.fruits.push({
              id: s.nextFruitId++,
              x,
              y: canvas.height + 20,
              vx,
              vy,
              rotation: Math.random() * Math.PI,
              vRot: (Math.random() - 0.5) * 0.15,
              radius,
              type,
              color,
              innerColor,
              sliced: false,
            });
          }
        }

        // Update Fruits
        s.fruits.forEach((f) => {
          if (!f.sliced) {
            f.x += f.vx;
            f.y += f.vy;
            f.vy += 0.32; // Gravity
            f.rotation += f.vRot;

            // Missed fruit fallen below screen
            if (f.y > canvas.height + 40 && f.vy > 0) {
              if (f.type !== 'bomb') {
                s.strikes++;
                setStrikes(s.strikes);
                sound.playGlitch();
                if (s.strikes >= 3) {
                  sound.playGameOver();
                  setGameOver(true);
                  onGameOver(s.score);
                }
              }
            }
          } else if (f.half1 && f.half2) {
            // Sliced halves physics
            f.half1.x += f.half1.vx;
            f.half1.y += f.half1.vy;
            f.half1.vy += 0.35;
            f.half1.rot += 0.1;

            f.half2.x += f.half2.vx;
            f.half2.y += f.half2.vy;
            f.half2.vy += 0.35;
            f.half2.rot -= 0.1;
          }
        });

        // Filter out off-screen fruits
        s.fruits = s.fruits.filter((f) => {
          if (!f.sliced) return f.y <= canvas.height + 50;
          return f.half1 && f.half1.y <= canvas.height + 50;
        });

        // Fade splashes
        s.splashes.forEach((sp) => {
          sp.alpha -= 0.002;
        });
        s.splashes = s.splashes.filter((sp) => sp.alpha > 0);
      }

      // RENDER
      const s = stateRef.current;

      // Dojo Wood Texture Background
      ctx.fillStyle = '#451a03';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Wood grain planks
      ctx.strokeStyle = '#291102';
      ctx.lineWidth = 2;
      for (let y = 0; y < canvas.height; y += 45) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Draw Splashes
      s.splashes.forEach((sp) => {
        ctx.fillStyle = sp.color;
        ctx.globalAlpha = sp.alpha * 0.35;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.radius, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // Draw Fruits
      s.fruits.forEach((f) => {
        if (!f.sliced) {
          ctx.save();
          ctx.translate(f.x, f.y);
          ctx.rotate(f.rotation);

          if (f.type === 'bomb') {
            // Bomb body
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
            ctx.fill();
            // Fuse & Spark
            ctx.strokeStyle = '#f59e0b';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, -f.radius);
            ctx.lineTo(6, -f.radius - 8);
            ctx.stroke();
            // Burning spark
            const sparkBlink = Math.floor(Date.now() / 80) % 2 === 0;
            ctx.fillStyle = sparkBlink ? '#ef4444' : '#facc15';
            ctx.beginPath();
            ctx.arc(6, -f.radius - 8, 4, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Whole fruit rind & body
            ctx.fillStyle = f.color;
            ctx.beginPath();
            ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
            ctx.fill();
            // Inner color rim
            ctx.fillStyle = f.innerColor;
            ctx.beginPath();
            ctx.arc(0, 0, f.radius * 0.75, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        } else if (f.half1 && f.half2) {
          // Half 1
          ctx.save();
          ctx.translate(f.half1.x, f.half1.y);
          ctx.rotate(f.half1.rot);
          ctx.fillStyle = f.color;
          ctx.beginPath();
          ctx.arc(0, 0, f.radius, Math.PI, 0);
          ctx.fill();
          ctx.fillStyle = f.innerColor;
          ctx.beginPath();
          ctx.arc(0, 0, f.radius * 0.75, Math.PI, 0);
          ctx.fill();
          ctx.restore();

          // Half 2
          ctx.save();
          ctx.translate(f.half2.x, f.half2.y);
          ctx.rotate(f.half2.rot);
          ctx.fillStyle = f.color;
          ctx.beginPath();
          ctx.arc(0, 0, f.radius, 0, Math.PI);
          ctx.fill();
          ctx.fillStyle = f.innerColor;
          ctx.beginPath();
          ctx.arc(0, 0, f.radius * 0.75, 0, Math.PI);
          ctx.fill();
          ctx.restore();
        }
      });

      // Draw Glowing Blade Trail
      if (s.trail.length > 1) {
        const currentTime = Date.now();
        for (let i = 1; i < s.trail.length; i++) {
          const p1 = s.trail[i - 1];
          const p2 = s.trail[i];
          const age = (currentTime - p2.time) / 180;
          const alpha = Math.max(0, 1 - age);

          ctx.strokeStyle = '#ffffff';
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 10;
          ctx.lineWidth = Math.max(1, 8 * (1 - age));
          ctx.lineCap = 'round';
          ctx.globalAlpha = alpha;
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
        ctx.shadowBlur = 0;
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isPaused, gameOver, onGameOver]);

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto">
      {/* Top HUD */}
      <div className="flex items-center justify-between w-full px-4 py-2 bg-slate-900/90 rounded-t-xl border border-slate-800 backdrop-blur-sm text-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">SLICES</span>
          <span className="text-amber-400 font-bold text-lg tabular-nums">{score}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">STRIKES</span>
          <div className="flex gap-1 text-base">
            <span className={strikes >= 1 ? 'text-rose-500 font-black' : 'text-slate-700'}>✕</span>
            <span className={strikes >= 2 ? 'text-rose-500 font-black' : 'text-slate-700'}>✕</span>
            <span className={strikes >= 3 ? 'text-rose-500 font-black' : 'text-slate-700'}>✕</span>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative border-x border-b border-slate-800 rounded-b-xl overflow-hidden shadow-2xl bg-black">
        <canvas
          ref={canvasRef}
          width={420}
          height={460}
          className="block touch-none cursor-crosshair"
        />

        {comboText && (
          <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-amber-500/90 text-slate-950 font-black px-4 py-1.5 rounded-full text-base shadow-xl pointer-events-none animate-bounce">
            {comboText}
          </div>
        )}

        {gameOver && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
            <h3 className="text-2xl font-black text-rose-500 mb-1 tracking-wider">GAME OVER!</h3>
            <p className="text-sm text-slate-300 mb-4">Bomb sliced or 3 missed fruits.</p>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-6 w-48">
              <span className="text-xs text-slate-400">Score</span>
              <div className="text-2xl font-extrabold text-amber-400">{score} pts</div>
            </div>
            <button
              onClick={restartGame}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-500 to-amber-500 text-white font-semibold shadow-lg hover:brightness-110 active:scale-95 transition"
            >
              <RotateCcw className="w-4 h-4" />
              Slice Again
            </button>
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-slate-400 text-center">
        Swipe mouse or finger rapidly across fruit to slice. Avoid black bombs!
      </p>
    </div>
  );
};

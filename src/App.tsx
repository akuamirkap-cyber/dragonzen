import { useCallback, useEffect, useRef, useState } from 'react';
import { Game, type GameStats } from './game/engine';

type Screen = 'menu' | 'playing' | 'over';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const screenRef = useRef<Screen>('menu');
  const [screen, setScreen] = useState<Screen>('menu');
  const [stats, setStats] = useState<GameStats | null>(null);
  const [best, setBest] = useState<number>(() => Number(localStorage.getItem('naga-angin-best') || 0));
  const [newBest, setNewBest] = useState(false);
  const [muted, setMuted] = useState(false);

  const go = (s: Screen) => {
    screenRef.current = s;
    setScreen(s);
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    const g = new Game(canvasRef.current, {
      onGameOver: (s) => {
        setStats(s);
        setBest((b) => {
          const nb = s.score > b;
          setNewBest(nb);
          const v = Math.max(b, s.score);
          localStorage.setItem('naga-angin-best', String(v));
          return v;
        });
        go('over');
      },
    });
    gameRef.current = g;
    g.run();
    return () => g.destroy();
  }, []);

  const start = useCallback(() => {
    gameRef.current?.start();
    go('playing');
  }, []);

  // Update target dragon vertical position from pointer (mouse / touch)
  const updatePointerY = useCallback((clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (!rect.height) return;
    const relY = ((clientY - rect.top) / rect.height) * 800;
    gameRef.current?.setTargetY(relY);
  }, []);

  // Track pointer movements on window for buttery smooth responsiveness
  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      if (screenRef.current === 'playing') {
        updatePointerY(e.clientY);
      }
    };
    window.addEventListener('pointermove', handleMove);
    return () => window.removeEventListener('pointermove', handleMove);
  }, [updatePointerY]);

  // Keyboard navigation support (Arrow Up / Down, W / S, Space to start)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (screenRef.current !== 'playing') start();
      } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        gameRef.current?.adjustTargetY(-35);
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        gameRef.current?.adjustTargetY(35);
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [start]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    updatePointerY(e.clientY);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const m = !muted;
    setMuted(m);
    gameRef.current?.setMuted(m);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0b0a18] select-none cursor-default">
      <div
        ref={containerRef}
        className={`relative overflow-hidden shadow-2xl sm:rounded-[28px] ${screen === 'playing' ? 'cursor-none' : 'cursor-default'}`}
        style={{
          width: 'min(100vw, calc(100dvh * 9 / 16))',
          height: 'min(100dvh, calc(100vw * 16 / 9))',
          touchAction: 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={(e) => updatePointerY(e.clientY)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={toggleMute}
          className="absolute bottom-4 right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur-sm transition hover:bg-white/20 cursor-pointer"
          aria-label="Suara"
        >
          {muted ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 5 6 9H3v6h3l5 4V5z" /><path d="m23 9-6 6M17 9l6 6" /></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 5 6 9H3v6h3l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /></svg>
          )}
        </button>

        {screen === 'menu' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-between px-8 py-[10%] text-center text-white">
            <div className="anim-fadeup mt-2">
              <div className="mb-2 text-xs font-semibold tracking-[0.5em] text-white/70">龍 · ZEN · FLIGHT</div>
              <h1 className="font-title anim-floaty text-6xl font-bold leading-none tracking-wide drop-shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
                Naga<br />Angin
              </h1>
              <p className="mx-auto mt-4 max-w-[270px] text-sm font-medium text-white/80">
                Kendalikan naga ke atas dan bawah dengan gerakan mouse sesukamu.
              </p>
            </div>

            <div className="anim-fadeup flex w-full flex-col items-center gap-5" style={{ animationDelay: '.2s' }}>
              <div className="w-full max-w-[290px] space-y-2.5 rounded-2xl bg-white/10 p-4 text-left text-[13px] leading-snug text-white/90 backdrop-blur-md">
                <div className="flex gap-3"><span className="w-5 text-center">↕</span><span><b>Gerakkan Mouse / Sentuh</b> ke atas & bawah untuk naik-turun</span></div>
                <div className="flex gap-3"><span className="w-5 text-center text-amber-200">◯</span><span>Lewati <b className="text-amber-200">cincin emas</b> untuk dorongan & kombo</span></div>
                <div className="flex gap-3"><span className="w-5 text-center">⛰</span><span>Hindari menabrak tebing karang & pulau terbang</span></div>
                <div className="flex gap-3"><span className="w-5 text-center">✦</span><span>Terbang rendah dekat tanah untuk <b>Selancar Angin</b></span></div>
              </div>
              <button
                onClick={start}
                className="rounded-full bg-white/90 px-10 py-4 text-base font-bold tracking-wider text-[#5a2a44] shadow-xl transition active:scale-95 hover:bg-white cursor-pointer"
              >
                Mulai Terbang
              </button>
              {best > 0 && <div className="text-xs font-semibold tracking-widest text-white/70">REKOR · {best}</div>}
            </div>
          </div>
        )}

        {screen === 'over' && stats && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/20 px-8 text-center text-white backdrop-blur-[2px]">
            <div className="anim-fadeup w-full max-w-[300px]">
              <div className="text-xs font-semibold tracking-[0.4em] text-white/70">PERJALANAN BERAKHIR</div>
              <h2 className="font-title mt-2 text-4xl font-bold">Sang Naga Beristirahat</h2>
              <div className="mt-8 text-6xl font-bold">{stats.score}</div>
              <div className="mt-1 text-xs font-semibold tracking-widest text-white/70">
                {newBest ? <span className="anim-breathe text-amber-200">✦ REKOR BARU ✦</span> : `REKOR · ${best}`}
              </div>
              <div className="mt-8 grid grid-cols-3 gap-2 rounded-2xl bg-white/10 p-4 backdrop-blur-md">
                <Stat label="Jarak" value={`${stats.distance}m`} />
                <Stat label="Cincin" value={stats.rings} />
                <Stat label="Kombo" value={`×${stats.bestCombo}`} />
              </div>
              <button
                onClick={start}
                className="mt-10 rounded-full bg-white/90 px-10 py-4 text-base font-bold tracking-wider text-[#5a2a44] shadow-xl transition active:scale-95 hover:bg-white cursor-pointer"
              >
                Terbang Lagi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xl font-bold">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-widest text-white/60">{label}</div>
    </div>
  );
}

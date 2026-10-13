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
  // Kotak bingkai disimpan agar pointermove tidak perlu memaksa reflow layout
  // setiap event (dulu getBoundingClientRect() dipanggil puluhan kali per detik).
  const rectRef = useRef<DOMRect | null>(null);

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
    let rect = rectRef.current;
    if (!rect && containerRef.current) {
      rect = containerRef.current.getBoundingClientRect();
      rectRef.current = rect;
    }
    if (!rect || !rect.height) return;
    const relRatio = (clientY - rect.top) / rect.height;
    gameRef.current?.setPointerRatio(relRatio);
  }, []);

  // Ukuran bingkai hanya berubah saat jendela berubah ukuran / digulir - ukur ulang
  // hanya pada saat-saat itu, bukan pada setiap gerakan pointer.
  useEffect(() => {
    const measure = () => {
      rectRef.current = containerRef.current?.getBoundingClientRect() ?? null;
    };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro && containerRef.current) ro.observe(containerRef.current);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
      ro?.disconnect();
    };
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
    rectRef.current = containerRef.current?.getBoundingClientRect() ?? null;
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
        className={`[container-type:size] relative overflow-hidden shadow-2xl sm:rounded-[28px] ${screen === 'playing' ? 'cursor-none' : 'cursor-default'}`}
        style={{
          width: 'min(100vw, calc(100dvh * 16 / 9))',
          height: 'min(100dvh, calc(100vw * 9 / 16))',
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
          className="absolute bottom-4 right-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-black/25 text-white/80 transition hover:bg-black/40 cursor-pointer"
          aria-label="Suara"
        >
          {muted ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 5 6 9H3v6h3l5 4V5z" /><path d="m23 9-6 6M17 9l6 6" /></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 5 6 9H3v6h3l5 4V5z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /></svg>
          )}
        </button>

        {screen === 'menu' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-[3cqh] px-[4cqw] text-center text-white">
            <div className="anim-fadeup">
              <div className="mb-1 text-[clamp(9px,1.7cqh,12px)] font-semibold tracking-[0.5em] text-white/70">龍 · ZEN · FLIGHT</div>
              <h1 className="font-title anim-floaty text-[clamp(30px,9cqh,64px)] font-bold leading-none tracking-wide drop-shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
                Naga Angin
              </h1>
              <p className="mx-auto mt-2 max-w-[340px] text-[clamp(11px,2.2cqh,14px)] font-medium text-white/80">
                Kendalikan naga ke atas dan bawah dengan gerakan mouse sesukamu.
              </p>
            </div>

            <div className="anim-fadeup flex w-full flex-col items-center gap-[2.4cqh]" style={{ animationDelay: '.2s' }}>
              <div className="w-full max-w-[430px] space-y-1.5 rounded-2xl bg-white/10 p-3.5 text-left text-[clamp(11px,2cqh,12.5px)] leading-snug text-white/90 backdrop-blur-md">
                <div className="text-[clamp(9px,1.7cqh,11px)] font-bold uppercase tracking-wider text-amber-200">✦ ALIRAN ANGIN (SPEED FLOW)</div>
                <div className="flex gap-2.5"><span className="w-4 text-center text-amber-200">◯</span><span>Lewati <b>cincin emas</b> untuk mulai Aliran & dorongan</span></div>
                <div className="flex gap-2.5"><span className="w-4 text-center text-amber-200">✦</span><span>Terbang rendah untuk <b>Selancar Angin</b> & rawat kombo</span></div>
                <div className="flex gap-2.5"><span className="w-4 text-center text-amber-200">⛰</span><span><b>Terelak tebing</b> nyaris senggol untuk bonus Aliran</span></div>
                <div className="flex gap-2.5"><span className="w-4 text-center text-amber-200">⚡</span><span>Rantai Aliran tanpa henti untuk melesat hingga <b>6.0×</b></span></div>
              </div>
              <button
                onClick={start}
                className="rounded-full bg-white/90 px-[3.2cqw] py-[1.6cqh] text-[clamp(13px,2.6cqh,16px)] font-bold tracking-wider text-[#5a2a44] shadow-xl transition active:scale-95 hover:bg-white cursor-pointer"
              >
                Mulai Terbang
              </button>
              {best > 0 && <div className="text-xs font-semibold tracking-widest text-white/70">REKOR · {best}</div>}
            </div>
          </div>
        )}

        {screen === 'over' && stats && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/20 px-8 text-center text-white backdrop-blur-[2px]">
            <div className="anim-fadeup w-full max-w-[420px]">
              <div className="text-[clamp(9px,1.7cqh,12px)] font-semibold tracking-[0.4em] text-white/70">PERJALANAN BERAKHIR</div>
              <h2 className="font-title mt-1 text-[clamp(22px,5.4cqh,36px)] font-bold">Sang Naga Beristirahat</h2>
              <div className="mt-[3cqh] text-[clamp(34px,10cqh,60px)] font-bold leading-none">{stats.score}</div>
              <div className="mt-1 text-xs font-semibold tracking-widest text-white/70">
                {newBest ? <span className="anim-breathe text-amber-200">✦ REKOR BARU ✦</span> : `REKOR · ${best}`}
              </div>
              <div className="mt-[3cqh] grid grid-cols-4 gap-1.5 rounded-2xl bg-white/10 p-3.5 backdrop-blur-md">
                <Stat label="Jarak" value={`${stats.distance}m`} />
                <Stat label="Cincin" value={stats.rings} />
                <Stat label="Aliran" value={`×${stats.bestCombo}`} />
                <Stat label="Puncak" value={stats.maxSpeed} />
              </div>
              <button
                onClick={start}
                className="mt-[4cqh] rounded-full bg-white/90 px-[3.2cqw] py-[1.6cqh] text-[clamp(13px,2.6cqh,16px)] font-bold tracking-wider text-[#5a2a44] shadow-xl transition active:scale-95 hover:bg-white cursor-pointer"
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

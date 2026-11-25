import React, { useEffect, useRef, useState } from 'react';
import { CalendarDays, RefreshCw, Clock, Pencil, Check } from 'lucide-react';

const DEFAULT_SHORT_BASE = 'https://qm7.vercel.app';
const STORAGE_KEY = 'qct_student_short_links_v3';

interface StoredConfig {
  baseUrl: string;
  lang: 'en' | 'ar';
}

interface Props {
  onToast: (msg: string) => void;
}

interface SpringState {
  x: number;
  v: number;
  t: number;
  k: number;
  c: number;
}

function makeSpring(x: number, k = 400, c = 30): SpringState {
  return { x, v: 0, t: x, k, c };
}

function stepSpring(s: SpringState, dt: number) {
  const a = -s.k * (s.x - s.t) - s.c * s.v;
  s.v += a * dt;
  s.x += s.v * dt;
}

const CALM_STYLES = {
  fixed: {
    background: 'linear-gradient(155deg, #f4fbf7 0%, #dfefe6 100%)',
    color: '#1e6e53',
  },
  reschedule: {
    background: 'linear-gradient(155deg, #fbf7f0 0%, #eee4d4 100%)',
    color: '#7a5c32',
  },
  dur30: {
    background: 'linear-gradient(155deg, #f3faf6 0%, #dceee4 100%)',
    color: '#1e6e53',
  },
  dur60: {
    background: 'linear-gradient(155deg, #f2f7fb 0%, #dde9f3 100%)',
    color: '#2c5878',
  },
  custom: {
    background: 'linear-gradient(155deg, #f7f4fb 0%, #e8e2f2 100%)',
    color: '#5a4c78',
  },
};

function loadConfig(): StoredConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        baseUrl:
          typeof parsed.baseUrl === 'string' && parsed.baseUrl.trim()
            ? parsed.baseUrl.trim().replace(/\/+$/, '')
            : DEFAULT_SHORT_BASE,
        lang: parsed.lang === 'ar' ? 'ar' : 'en',
      };
    }
  } catch {
    // ignore
  }
  return { baseUrl: DEFAULT_SHORT_BASE, lang: 'en' };
}

interface FanIconCard {
  id: string;
  label: string;
  pos: number; // + right, 0 center, - left
  style: React.CSSProperties;
  icon: React.ReactNode;
  onClick: () => void;
}

const AnchoredIconFan: React.FC<{ cards: FanIconCard[]; deckKey: string }> = ({ cards, deckKey }) => {
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const cardSpringsRef = useRef<{ pop: SpringState; fan: SpringState; lift: SpringState; sc: SpringState; delay: number }[]>([]);

  useEffect(() => {
    cardSpringsRef.current = cards.map((_, i) => ({
      pop: makeSpring(0, 340, 22),
      fan: makeSpring(0, 240, 19),
      lift: makeSpring(0, 440, 21),
      sc: makeSpring(1, 440, 22),
      delay: i * 0.038,
    }));

    let rafId = 0;
    let elapsed = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      elapsed += dt;

      const cs = cardSpringsRef.current;
      for (let i = 0; i < cs.length; i++) {
        if (elapsed >= cs[i].delay) {
          cs[i].pop.t = 1;
          cs[i].fan.t = 1;
        }
      }

      for (let sub = 0; sub < 4; sub++) {
        for (let i = 0; i < cs.length; i++) {
          stepSpring(cs[i].pop, dt / 4);
          stepSpring(cs[i].fan, dt / 4);
          stepSpring(cs[i].lift, dt / 4);
          stepSpring(cs[i].sc, dt / 4);
        }
      }

      const spread = cs.length === 2 ? 48 : 74;
      for (let i = 0; i < cs.length; i++) {
        const el = cardRefs.current[i];
        if (!el) continue;
        const d = cards[i].pos;
        const p = cs[i].pop.x;
        const f = cs[i].fan.x;
        const x = d * (4 + f * (spread - 4));
        const r = d * (2 + f * 6.5);
        const y = (1 - p) * -16 + Math.abs(d) * f * 6 + cs[i].lift.x;
        const scale = Math.max(0.1, (0.48 + 0.52 * p) * cs[i].sc.x);
        el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${r.toFixed(3)}deg) scale(${scale.toFixed(4)})`;
        el.style.opacity = String(Math.max(0, Math.min(1, p * 1.45)));
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [deckKey, cards.length]);

  const setHot = (idx: number) => {
    cardSpringsRef.current.forEach((s, i) => {
      s.lift.t = i === idx ? -12 : 0;
      s.sc.t = i === idx ? 1.09 : 1;
      const el = cardRefs.current[i];
      if (el) el.style.zIndex = String(i === idx ? 12 : cards[i].pos === 0 ? 5 : 4);
    });
  };

  return (
    <div className="relative w-[68px] h-[68px] select-none" onPointerLeave={() => setHot(-1)}>
      {cards.map((card, i) => (
        <button
          key={card.id}
          ref={(el) => {
            cardRefs.current[i] = el;
          }}
          type="button"
          title={card.label}
          aria-label={card.label}
          onPointerEnter={() => setHot(i)}
          onFocus={() => setHot(i)}
          onBlur={() => setHot(-1)}
          onClick={() => {
            if (cardSpringsRef.current[i]) {
              cardSpringsRef.current[i].lift.v = -200;
            }
            card.onClick();
          }}
          style={{
            ...card.style,
            transformOrigin: '50% 0%',
            willChange: 'transform, opacity',
            zIndex: card.pos === 0 ? 5 : 4,
          }}
          className="absolute inset-0 rounded-[18px] flex items-center justify-center shadow-[0_10px_24px_-6px_rgba(15,23,42,0.16)] border border-white/90 ring-1 ring-slate-200/70 cursor-pointer focus:outline-none"
        >
          {card.icon}
        </button>
      ))}
    </div>
  );
};

const StudentAvailabilityLinkModal: React.FC<Props> = ({ onToast }) => {
  const [config, setConfig] = useState<StoredConfig>(() => loadConfig());
  const [step, setStep] = useState<'closed' | 'mode' | 'duration' | 'custom' | 'copied' | 'settings'>('closed');
  const [mode, setMode] = useState<'fixed' | 'all' | null>(null);
  const [customMinutes, setCustomMinutes] = useState('45');
  const [baseUrlDraft, setBaseUrlDraft] = useState(DEFAULT_SHORT_BASE);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const customInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (step === 'closed') return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setStep('closed');
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setStep('closed');
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [step]);

  useEffect(() => {
    if (step === 'custom') {
      setTimeout(() => {
        customInputRef.current?.focus();
        customInputRef.current?.select();
      }, 40);
    }
  }, [step]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  const persistConfig = (next: StoredConfig) => {
    setConfig(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const openMenu = () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    if (step !== 'closed') {
      setStep('closed');
      return;
    }
    const loaded = loadConfig();
    setConfig(loaded);
    setMode(null);
    setStep('mode');
  };

  const openSettings = (e: React.MouseEvent) => {
    e.preventDefault();
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    const loaded = loadConfig();
    setConfig(loaded);
    setBaseUrlDraft(loaded.baseUrl);
    setStep((prev) => (prev === 'settings' ? 'closed' : 'settings'));
  };

  const buildLink = (selectedMode: 'fixed' | 'all', durMinutes: number): string => {
    const base = (config.baseUrl || DEFAULT_SHORT_BASE).replace(/\/+$/, '');
    const code = selectedMode === 'fixed' ? 'f' : 'r';
    if (base.endsWith('/exec')) {
      const langPart = config.lang === 'ar' ? '&l=ar' : '';
      return `${base}?${code}=${durMinutes}${langPart}`;
    }
    const langPart = config.lang === 'ar' ? '?l=ar' : '';
    return `${base}/${code}${durMinutes}${langPart}`;
  };

  const copyAndFinish = async (selectedMode: 'fixed' | 'all', durMinutes: number) => {
    const url = buildLink(selectedMode, durMinutes);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // ignore
    }
    setStep('copied');
    onToast('تم النسخ ✅');
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setStep('closed');
    }, 950);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mode) return;
    const n = Math.round(Number(customMinutes));
    if (!Number.isFinite(n) || n < 15 || n > 180) {
      onToast('اكتب مدة بين 15 و 180 دقيقة ⚠️');
      return;
    }
    copyAndFinish(mode, n);
  };

  const handleSaveSettings = () => {
    const cleanBase = (baseUrlDraft.trim() || DEFAULT_SHORT_BASE).replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(cleanBase)) {
      onToast('أدخل رابطاً صحيحاً يبدأ بـ https:// ⚠️');
      return;
    }
    persistConfig({ ...config, baseUrl: cleanBase });
    setStep('closed');
    onToast('تم الحفظ ✅');
  };

  // Step 1: Right (+pos) = Fixed, Left (-pos) = Reschedule
  const modeCards: FanIconCard[] = [
    {
      id: 'fixed',
      label: 'مواعيد ثابتة',
      pos: 0.9,
      style: CALM_STYLES.fixed,
      icon: <CalendarDays size={25} strokeWidth={2} />,
      onClick: () => {
        setMode('fixed');
        setStep('duration');
      },
    },
    {
      id: 'reschedule',
      label: 'إعادة جدولة',
      pos: -0.9,
      style: CALM_STYLES.reschedule,
      icon: <RefreshCw size={24} strokeWidth={2} />,
      onClick: () => {
        setMode('all');
        setStep('duration');
      },
    },
  ];

  // Step 2: Right-to-left: 30 (+1), 60 (0), Edit (-1)
  const durationCards: FanIconCard[] = [
    {
      id: '30',
      label: '30 دقيقة',
      pos: 1,
      style: CALM_STYLES.dur30,
      icon: <span className="font-english text-2xl font-bold leading-none">30</span>,
      onClick: () => {
        if (mode) copyAndFinish(mode, 30);
      },
    },
    {
      id: '60',
      label: '60 دقيقة',
      pos: 0,
      style: CALM_STYLES.dur60,
      icon: <span className="font-english text-2xl font-bold leading-none">60</span>,
      onClick: () => {
        if (mode) copyAndFinish(mode, 60);
      },
    },
    {
      id: 'custom',
      label: 'كتابة مدة مخصصة',
      pos: -1,
      style: CALM_STYLES.custom,
      icon: <Pencil size={22} strokeWidth={2} />,
      onClick: () => setStep('custom'),
    },
  ];

  const isCopied = step === 'copied';

  return (
    <div ref={rootRef} className="relative font-arabic" dir="rtl">
      <button
        type="button"
        onClick={openMenu}
        onContextMenu={openSettings}
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90 shadow-sm border ${
          isCopied
            ? 'bg-emerald-500 text-white border-emerald-500 scale-105'
            : step !== 'closed'
            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-100/50'
        }`}
        title="رابط المواعيد المتاحة (كليك للاختيار · كليك يمين للإعدادات)"
      >
        {isCopied ? <Check size={19} strokeWidth={2.8} /> : <Clock size={19} strokeWidth={2.2} />}
      </button>

      {step !== 'closed' && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 z-[120] flex flex-col items-center">
          {step === 'mode' && <AnchoredIconFan deckKey="mode" cards={modeCards} />}

          {step === 'duration' && <AnchoredIconFan deckKey={`dur-${mode}`} cards={durationCards} />}

          {step === 'custom' && (
            <form
              onSubmit={handleCustomSubmit}
              className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md rounded-2xl p-2 shadow-[0_12px_30px_-8px_rgba(15,23,42,0.18)] border border-slate-200/80 animate-in fade-in zoom-in-95 duration-150"
            >
              <input
                ref={customInputRef}
                type="number"
                min={15}
                max={180}
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                dir="ltr"
                aria-label="المدة بالدقائق"
                className="w-16 text-center font-english text-lg font-bold py-1 bg-slate-50 border border-slate-200 focus:border-emerald-400 rounded-xl outline-none text-slate-700"
              />
              <button
                type="submit"
                title="نسخ الرابط"
                className="w-9 h-9 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-center transition-all active:scale-95"
              >
                <Check size={18} strokeWidth={2.6} />
              </button>
            </form>
          )}

          {step === 'copied' && (
            <div className="px-3.5 py-1.5 bg-white/95 backdrop-blur-md rounded-full shadow-[0_10px_24px_-6px_rgba(15,23,42,0.16)] border border-emerald-200/80 flex items-center gap-1.5 whitespace-nowrap animate-in fade-in zoom-in-95 duration-150">
              <span className="text-xs font-bold text-emerald-700">تم النسخ</span>
            </div>
          )}

          {step === 'settings' && (
            <div className="w-[240px] bg-white/95 backdrop-blur-md rounded-2xl p-3 shadow-[0_14px_34px_-10px_rgba(15,23,42,0.2)] border border-slate-200/80 space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">لغة الصفحة</label>
                <select
                  value={config.lang}
                  onChange={(e) => persistConfig({ ...config, lang: e.target.value === 'ar' ? 'ar' : 'en' })}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                >
                  <option value="en">English</option>
                  <option value="ar">عربي</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">الرابط المختصر</label>
                <input
                  type="text"
                  value={baseUrlDraft}
                  onChange={(e) => setBaseUrlDraft(e.target.value)}
                  dir="ltr"
                  className="w-full px-2.5 py-1.5 text-[11px] font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-600"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveSettings}
                className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl"
              >
                حفظ
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StudentAvailabilityLinkModal;

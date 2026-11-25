import React, { useEffect, useState } from 'react';
import { X, Clock, CalendarDays, RefreshCw, Copy, Check, ExternalLink, Settings, MessageCircle } from 'lucide-react';

const DEFAULT_VIEWER_URL =
  'https://script.google.com/macros/s/AKfycbxs79eM-EiAo1Nwlkvlh7iaX-Wbgs9cA4MYobfxF_DW6xfQTDPEZY6aiheD7fiPzkODjg/exec';
const STORAGE_KEY = 'qct_student_availability_link_v1';

interface StoredConfig {
  secret: string;
  viewerUrl: string;
  lang: 'ar' | 'en';
  expiryDays: 1 | 3 | 7;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onToast: (msg: string) => void;
  onOpenLink: (url: string) => void;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signStudentLink(params: {
  viewerUrl: string;
  secret: string;
  mode: 'fixed' | 'all';
  duration: 30 | 45 | 60;
  lang: 'ar' | 'en';
  expiryDays: 1 | 3 | 7;
  studentName: string;
}): Promise<string> {
  const idBytes = new Uint8Array(6);
  crypto.getRandomValues(idBytes);
  const id = Array.from(idBytes, (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 10);

  const payload = {
    v: 1,
    id,
    exp: Date.now() + params.expiryDays * 86400000,
    dur: params.duration,
    p: 7,
    m: params.mode,
    l: params.lang,
    sn: params.studentName.trim().slice(0, 60),
  };

  const encoder = new TextEncoder();
  const payloadB64 = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(params.secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64));
  const sigB64 = toBase64Url(new Uint8Array(sigBuf));

  return `${params.viewerUrl}?t=${encodeURIComponent(`${payloadB64}.${sigB64}`)}`;
}

function loadConfig(): StoredConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        secret: typeof parsed.secret === 'string' ? parsed.secret : '',
        viewerUrl:
          typeof parsed.viewerUrl === 'string' && parsed.viewerUrl.trim()
            ? parsed.viewerUrl.trim()
            : DEFAULT_VIEWER_URL,
        lang: parsed.lang === 'ar' ? 'ar' : 'en',
        expiryDays: [1, 3, 7].includes(Number(parsed.expiryDays)) ? (Number(parsed.expiryDays) as 1 | 3 | 7) : 3,
      };
    }
  } catch {
    // ignore corrupted storage
  }
  return { secret: '', viewerUrl: DEFAULT_VIEWER_URL, lang: 'en', expiryDays: 3 };
}

const StudentAvailabilityLinkModal: React.FC<Props> = ({ isOpen, onClose, onToast, onOpenLink }) => {
  const [config, setConfig] = useState<StoredConfig>(() => loadConfig());
  const [mode, setMode] = useState<'fixed' | 'all' | null>(null);
  const [duration, setDuration] = useState<30 | 45 | 60 | null>(null);
  const [studentName, setStudentName] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [secretDraft, setSecretDraft] = useState('');
  const [viewerUrlDraft, setViewerUrlDraft] = useState(DEFAULT_VIEWER_URL);

  useEffect(() => {
    if (!isOpen) return;
    const loaded = loadConfig();
    setConfig(loaded);
    setSecretDraft(loaded.secret);
    setViewerUrlDraft(loaded.viewerUrl);
    setMode(null);
    setDuration(null);
    setStudentName('');
    setGeneratedUrl('');
    setCopied(false);
    setShowSettings(!loaded.secret);
  }, [isOpen]);

  if (!isOpen) return null;

  const persistConfig = (next: StoredConfig) => {
    setConfig(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const handleSaveSettings = () => {
    const cleanSecret = secretDraft.trim();
    const cleanUrl = viewerUrlDraft.trim() || DEFAULT_VIEWER_URL;
    if (!cleanSecret) {
      onToast('أدخل مفتاح الربط أولاً ⚠️');
      return;
    }
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(cleanUrl)) {
      onToast('رابط صفحة الطلاب غير صالح ⚠️');
      return;
    }
    persistConfig({ ...config, secret: cleanSecret, viewerUrl: cleanUrl });
    setShowSettings(false);
    onToast('تم حفظ مفتاح الربط بنجاح ✅');
  };

  const handleSelectDuration = async (selectedDur: 30 | 45 | 60) => {
    if (!mode) return;
    if (!config.secret) {
      setShowSettings(true);
      onToast('أدخل مفتاح الربط أولاً لمرة واحدة ⚠️');
      return;
    }
    setDuration(selectedDur);
    try {
      const url = await signStudentLink({
        viewerUrl: config.viewerUrl || DEFAULT_VIEWER_URL,
        secret: config.secret,
        mode,
        duration: selectedDur,
        lang: config.lang,
        expiryDays: config.expiryDays,
        studentName,
      });
      setGeneratedUrl(url);
      await navigator.clipboard.writeText(url);
      setCopied(true);
      onToast('تم إنشاء ونسخ رابط المواعيد! 🔗');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onToast('تعذّر إنشاء الرابط ⚠️');
    }
  };

  const handleCopyAgain = async () => {
    if (!generatedUrl) return;
    await navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    onToast('تم نسخ الرابط! 📋');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsappShare = () => {
    if (!generatedUrl) return;
    const name = studentName.trim();
    const msg =
      config.lang === 'ar'
        ? `${name ? `أهلاً ${name}،\n` : ''}يمكنك الاطلاع على مواعيدي المتاحة (بتوقيتك الحالي) واختيار الموعد المناسب من هذا الرابط:\n${generatedUrl}`
        : `${name ? `Hi ${name},\n` : ''}You can view my live available times (in your local timezone) and pick a slot here:\n${generatedUrl}`;
    onOpenLink(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`);
  };

  return (
    <div
      className="fixed inset-0 z-[125] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 font-arabic"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[2.2rem] shadow-[0_20px_70px_-10px_rgba(0,0,0,0.18)] w-full max-w-md overflow-hidden border border-white/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-6 py-5 border-b border-slate-100 bg-gradient-to-b from-teal-50/70 to-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-teal-700 flex items-center justify-center">
              <Clock size={19} strokeWidth={2.2} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 leading-tight">رابط المواعيد المتاحة</h2>
              <p className="text-xs text-slate-500">صفحة مباشرة بتوقيت الطالب · صلاحية {config.expiryDays} {config.expiryDays === 1 ? 'يوم' : 'أيام'}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowSettings((prev) => !prev)}
              className={`p-2 rounded-full transition-all ${showSettings ? 'bg-teal-100 text-teal-700' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
              title="إعدادات الربط واللغة"
            >
              <Settings size={18} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-rose-50 hover:text-rose-500 rounded-full text-slate-400 transition-all"
            >
              <X size={19} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {showSettings ? (
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <p className="text-xs text-slate-600 leading-relaxed">
                أدخل <strong>مفتاح الربط</strong> مرة واحدة فقط (نفس المفتاح الصادر من دالة <code dir="ltr" className="bg-white px-1 rounded">setupViewer</code> في مشروع عرض المواعيد للطلاب):
              </p>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">مفتاح الربط</label>
                <input
                  type="password"
                  value={secretDraft}
                  onChange={(e) => setSecretDraft(e.target.value)}
                  placeholder="الصق مفتاح الربط هنا..."
                  dir="ltr"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">لغة الصفحة</label>
                  <select
                    value={config.lang}
                    onChange={(e) => persistConfig({ ...config, lang: e.target.value === 'ar' ? 'ar' : 'en' })}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl"
                  >
                    <option value="en">English</option>
                    <option value="ar">عربي</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">صلاحية الرابط</label>
                  <select
                    value={config.expiryDays}
                    onChange={(e) =>
                      persistConfig({
                        ...config,
                        expiryDays: Number(e.target.value) as 1 | 3 | 7,
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl"
                  >
                    <option value={1}>يوم واحد</option>
                    <option value={3}>3 أيام</option>
                    <option value={7}>أسبوع</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">رابط صفحة الطلاب</label>
                <input
                  type="text"
                  value={viewerUrlDraft}
                  onChange={(e) => setViewerUrlDraft(e.target.value)}
                  dir="ltr"
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-200 rounded-xl text-slate-600 focus:outline-none focus:border-teal-500"
                />
              </div>
              <button
                type="button"
                onClick={handleSaveSettings}
                className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm rounded-xl transition-all"
              >
                حفظ الإعدادات
              </button>
            </div>
          ) : (
            <>
              {/* Step 1: Choose Mode */}
              <div>
                <div className="text-xs font-bold text-slate-500 mb-2">1. اختر نوع المواعيد:</div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('fixed');
                      setGeneratedUrl('');
                      setDuration(null);
                    }}
                    className={`flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                      mode === 'fixed'
                        ? 'border-teal-500 bg-teal-50/80 text-teal-800 shadow-sm'
                        : 'border-slate-100 bg-slate-50/70 text-slate-700 hover:border-teal-200 hover:bg-teal-50/30'
                    }`}
                  >
                    <CalendarDays size={22} className={mode === 'fixed' ? 'text-teal-600' : 'text-slate-400'} />
                    <span className="font-bold text-base">مواعيد ثابتة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMode('all');
                      setGeneratedUrl('');
                      setDuration(null);
                    }}
                    className={`flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-2xl border-2 transition-all active:scale-[0.98] ${
                      mode === 'all'
                        ? 'border-emerald-500 bg-emerald-50/80 text-emerald-800 shadow-sm'
                        : 'border-slate-100 bg-slate-50/70 text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/30'
                    }`}
                  >
                    <RefreshCw size={21} className={mode === 'all' ? 'text-emerald-600' : 'text-slate-400'} />
                    <span className="font-bold text-base">إعادة جدولة</span>
                  </button>
                </div>
              </div>

              {/* Optional student name */}
              {mode && (
                <div>
                  <input
                    type="text"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="اسم الطالب (اختياري — لو فارغ يكتبه الطالب)"
                    dir="auto"
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-teal-500 focus:bg-white"
                  />
                </div>
              )}

              {/* Step 2: Choose Duration (30 or 60 primary + 45 optional) */}
              {mode && (
                <div>
                  <div className="text-xs font-bold text-slate-500 mb-2">2. كم مدة الحصة؟ (ينسخ الرابط مباشرة)</div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleSelectDuration(30)}
                      className={`py-3.5 rounded-2xl border-2 font-bold transition-all active:scale-[0.98] flex flex-col items-center ${
                        duration === 30
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                          : 'border-slate-100 bg-white hover:border-emerald-300 hover:bg-emerald-50/40 text-slate-800 shadow-sm'
                      }`}
                    >
                      <span className="font-english text-2xl leading-none">30</span>
                      <span className="text-xs text-slate-500 mt-1">دقيقة</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectDuration(60)}
                      className={`py-3.5 rounded-2xl border-2 font-bold transition-all active:scale-[0.98] flex flex-col items-center ${
                        duration === 60
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                          : 'border-slate-100 bg-white hover:border-emerald-300 hover:bg-emerald-50/40 text-slate-800 shadow-sm'
                      }`}
                    >
                      <span className="font-english text-2xl leading-none">60</span>
                      <span className="text-xs text-slate-500 mt-1">دقيقة</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSelectDuration(45)}
                    className={`w-full mt-2.5 py-2 rounded-xl border text-xs font-bold transition-all ${
                      duration === 45
                        ? 'border-teal-400 bg-teal-50 text-teal-800'
                        : 'border-slate-200/80 bg-slate-50/70 text-slate-500 hover:text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    أو 45 دقيقة
                  </button>
                </div>
              )}

              {/* Generated Result */}
              {generatedUrl && (
                <div className="bg-teal-50/70 border border-teal-200/80 rounded-2xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-teal-800 font-bold">
                    <span>✅ الرابط جاهز ومنسوخ في الحافظة</span>
                    <span className="font-english">{duration} min</span>
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={generatedUrl}
                    dir="ltr"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-teal-100 rounded-lg text-slate-700"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCopyAgain}
                      className="flex-1 py-2 bg-white hover:bg-teal-100/60 text-teal-800 border border-teal-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copied ? 'تم النسخ' : 'نسخ'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenLink(generatedUrl)}
                      className="flex-1 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <ExternalLink size={14} />
                      <span>معاينة</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleWhatsappShare}
                      className="flex-1 py-2 bg-[#25D366] hover:brightness-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <MessageCircle size={14} />
                      <span>واتساب</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentAvailabilityLinkModal;

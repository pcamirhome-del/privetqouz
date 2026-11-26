import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  Disc3,
  HeartHandshake,
  HelpCircle,
  Images,
  Settings,
  Sparkles,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from 'lucide-react';
import {
  DEFAULT_ROOM_SETTINGS,
  EncryptedRoomSettings,
  MainTab,
  MediaBackgroundConfig,
  MysteryCardsLiveState,
  PartnerPresenceData,
  PartnerRole,
  PhotosLiveState,
  QuizRoundState,
  ReactionEvent,
  SharedPhotoItem,
  WheelLiveState,
} from './types/app';
import {
  connectOrCreateRoom,
  deleteEncryptedPhoto,
  fetchEncryptedPhoto,
  reEncryptRoomOnPinChange,
  saveRoomSettings,
  subscribeLiveState,
  subscribeMysteryCardsState,
  subscribePartnerPresence,
  subscribeRoomSettings,
  subscribeSharedBackground,
  subscribeSharedGallery,
  type SyncedBackgroundPayload,
  testConnection,
  updatePartnerPresence,
  uploadEncryptedPhoto,
  uploadSharedBackground,
  writeLiveState,
  writeMysteryCardsState,
} from './services/firebase';
import {
  deleteEncryptedLocalMedia,
  loadEncryptedLocalMedia,
  saveEncryptedLocalMedia,
} from './services/mediaStore';
import {soundEngine} from './services/sound';
import {useOnlineStatus} from './hooks/useOnlineStatus';
import {ErrorBoundary} from './components/ErrorBoundary';
import {LoginScreen} from './components/LoginScreen';
import {RomanticFloatingLayer} from './components/RomanticFloatingLayer';
import {
  EntranceCharacterOverlay,
  ReactionPopupOverlay,
} from './components/AnimatedCharacter';
import {SpinWheelTab} from './components/SpinWheelTab';
import {QuizTab} from './components/QuizTab';
import {PhotosTab} from './components/PhotosTab';
import {MysteryCardsTab} from './components/MysteryCardsTab';
import {PartnerSyncTab} from './components/PartnerSyncTab';
import {LoveCounterBar} from './components/LoveCounterBar';
import {SettingsModal} from './components/SettingsModal';

const DEFAULT_BG_IMAGE = '/src/assets/images/default_romantic_bg_1795637641791.jpg';
const STORAGE_ROOM_KEY = 'nabd_last_room_id';

function MainAppContent() {
  const [session, setSession] = useState<{
    roomId: string;
    pin: string;
    role: PartnerRole;
  } | null>(null);

  const [settings, setSettings] = useState<EncryptedRoomSettings>(
    DEFAULT_ROOM_SETTINGS
  );
  const [wheelState, setWheelState] = useState<WheelLiveState | null>(null);
  const [quizState, setQuizState] = useState<QuizRoundState | null>(null);
  const [photosState, setPhotosState] = useState<PhotosLiveState | null>(null);
  const [cardsState, setCardsState] = useState<MysteryCardsLiveState | null>(null);
  const [photos, setPhotos] = useState<SharedPhotoItem[]>([]);
  const [malePresence, setMalePresence] = useState<PartnerPresenceData | null>(null);
  const [femalePresence, setFemalePresence] = useState<PartnerPresenceData | null>(
    null
  );

  const [activeTab, setActiveTab] = useState<MainTab>('wheel');
  const [showEntrance, setShowEntrance] = useState(false);
  const [activeReaction, setActiveReaction] = useState<ReactionEvent | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);
  const [muted, setMuted] = useState<boolean>(() => soundEngine.muted);
  const [localBgUrl, setLocalBgUrl] = useState<string>('');
  const [syncedBgPayload, setSyncedBgPayload] =
    useState<SyncedBackgroundPayload | null>(null);
  const [bgPreviewOverrides, setBgPreviewOverrides] = useState<{
    overlayOpacity?: number;
    backgroundScale?: number;
    backgroundFit?: 'cover' | 'contain';
  } | null>(null);

  const lastReactionIdRef = useRef<string | null>(null);
  const fetchedPhotoIdsRef = useRef<Set<string>>(new Set());
  const rtdbPhotoIdsRef = useRef<Set<string>>(new Set());
  const isOnline = useOnlineStatus();

  // Boot connection check
  useEffect(() => {
    testConnection();
  }, []);

  // Viewport zoom toggle control
  useEffect(() => {
    const meta = document.getElementById('app-viewport');
    if (!meta) return;
    if (settings.allowZoom) {
      meta.setAttribute(
        'content',
        'width=device-width, initial-scale=1.0, viewport-fit=cover'
      );
    } else {
      meta.setAttribute(
        'content',
        'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
      );
    }
  }, [settings.allowZoom]);

  // Load locally encrypted large background (e.g., MP4/WebM/large GIF)
  useEffect(() => {
    if (!session) return;
    loadEncryptedLocalMedia(
      `bg_${session.roomId}`,
      session.roomId,
      session.pin
    ).then((url) => {
      if (url) setLocalBgUrl(url);
    });
  }, [session]);

  // Subscribe to all encrypted Firestore live streams once logged in
  useEffect(() => {
    if (!session) return;
    const {roomId, pin, role} = session;

    const unsubSettings = subscribeRoomSettings(
      roomId,
      pin,
      (nextSettings) => {
        setSettings(nextSettings);
        if (nextSettings.passcode && nextSettings.passcode !== pin) {
          setSession((prev) =>
            prev ? {...prev, pin: nextSettings.passcode} : prev
          );
        }
      },
      () => {}
    );

    const unsubMale = subscribePartnerPresence(roomId, pin, 'male', setMalePresence);
    const unsubFemale = subscribePartnerPresence(
      roomId,
      pin,
      'female',
      setFemalePresence
    );
    const unsubWheel = subscribeLiveState<WheelLiveState>(
      roomId,
      pin,
      'wheel',
      setWheelState
    );
    const unsubQuiz = subscribeLiveState<QuizRoundState>(
      roomId,
      pin,
      'quiz',
      setQuizState
    );
    const unsubPhotos = subscribeLiveState<PhotosLiveState>(
      roomId,
      pin,
      'photos',
      setPhotosState
    );
    const unsubCards = subscribeMysteryCardsState(roomId, pin, setCardsState);
    const unsubBackground = subscribeSharedBackground(roomId, pin, (bg) => {
      if (!bg) return;
      setSyncedBgPayload(bg);
      if (bg.type === 'default') {
        setLocalBgUrl('');
        deleteEncryptedLocalMedia(`bg_${roomId}`).catch(() => {});
      } else if (bg.url) {
        setLocalBgUrl(bg.url);
        saveEncryptedLocalMedia(`bg_${roomId}`, bg.url, roomId, pin).catch(() => {});
      }
    });
    const unsubGallery = subscribeSharedGallery(roomId, pin, (rtdbPhotos) => {
      const nextRtdbIds = new Set(rtdbPhotos.map((p) => p.id));
      const prevRtdbIds = rtdbPhotoIdsRef.current;
      rtdbPhotoIdsRef.current = nextRtdbIds;
      rtdbPhotos.forEach((p) => fetchedPhotoIdsRef.current.add(p.id));

      setPhotos((prev) => {
        const legacyNonRtdb = prev.filter(
          (p) => !nextRtdbIds.has(p.id) && !prevRtdbIds.has(p.id)
        );
        return [...rtdbPhotos, ...legacyNonRtdb];
      });
    });
    const unsubReaction = subscribeLiveState<ReactionEvent>(
      roomId,
      pin,
      'reaction',
      (evt) => {
        if (!evt || evt.id === lastReactionIdRef.current) return;
        // Ignore stale reactions older than 8 seconds
        if (Date.now() - evt.timestamp > 8000) return;
        lastReactionIdRef.current = evt.id;
        setActiveReaction(evt);
        if (evt.type === 'happy') soundEngine.playWin();
        else if (evt.type === 'sad') soundEngine.playSad();
        else soundEngine.playKissPing();
        setTimeout(() => {
          setActiveReaction((curr) => (curr?.id === evt.id ? null : curr));
        }, 2800);
      }
    );

    // Heartbeat presence every 25s
    const pushPresence = (online: boolean) => {
      updatePartnerPresence(roomId, pin, role, {
        role,
        online,
        lastSeen: Date.now(),
      }).catch(() => {});
    };
    pushPresence(true);
    const heartbeat = setInterval(() => pushPresence(true), 25000);

    const handleBeforeUnload = () => pushPresence(false);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(heartbeat);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      unsubSettings();
      unsubMale();
      unsubFemale();
      unsubWheel();
      unsubQuiz();
      unsubPhotos();
      unsubCards();
      unsubBackground();
      unsubGallery();
      unsubReaction();
    };
  }, [session]);

  // Fetch & decrypt photos whenever photosState.photoIds updates
  useEffect(() => {
    if (!session || !photosState?.photoIds) return;
    const ids = photosState.photoIds;
    setPhotos((prev) => prev.filter((p) => ids.includes(p.id)));

    const missing = ids.filter((id) => !fetchedPhotoIdsRef.current.has(id));
    if (missing.length === 0) return;

    missing.forEach(async (id) => {
      fetchedPhotoIdsRef.current.add(id);
      try {
        const item = await fetchEncryptedPhoto(session.roomId, session.pin, id);
        if (item) {
          setPhotos((prev) => {
            if (prev.some((p) => p.id === item.id)) return prev;
            return [...prev, item];
          });
        }
      } catch {
        fetchedPhotoIdsRef.current.delete(id);
      }
    });
  }, [session, photosState?.photoIds]);

  const handleAuthenticateRoom = async (
    rawRoomId: string,
    pin: string,
    role: PartnerRole
  ) => {
    const result = await connectOrCreateRoom(rawRoomId, pin);
    localStorage.setItem(STORAGE_ROOM_KEY, result.roomId);
    setSettings(result.settings);
    setSession({roomId: result.roomId, pin, role});
    setShowEntrance(true);
    soundEngine.playKissPing();
  };

  const handleSaveSettings = useCallback(
    async (next: EncryptedRoomSettings) => {
      if (!session) return;
      setSettings(next);
      await saveRoomSettings(session.roomId, session.pin, next);
    },
    [session]
  );

  const handleChangePasscode = useCallback(
    async (newPin: string, nextSettings: EncryptedRoomSettings) => {
      if (!session) return;
      await reEncryptRoomOnPinChange(
        session.roomId,
        session.pin,
        newPin,
        nextSettings,
        wheelState,
        quizState,
        photosState,
        activeReaction,
        photos,
        malePresence,
        femalePresence,
        syncedBgPayload,
        cardsState
      );
      setSettings({...nextSettings, passcode: newPin});
      setSession({...session, pin: newPin});
    },
    [
      session,
      wheelState,
      quizState,
      photosState,
      activeReaction,
      photos,
      malePresence,
      femalePresence,
      syncedBgPayload,
      cardsState,
    ]
  );

  const handleUpdateBackground = async (
    type: MediaBackgroundConfig['type'],
    fileOrUrl?: File | string
  ) => {
    if (!session) return;
    const result = await uploadSharedBackground(
      session.roomId,
      session.pin,
      type,
      fileOrUrl
    );
    setSyncedBgPayload(result);

    if (result.type === 'default') {
      setLocalBgUrl('');
      await deleteEncryptedLocalMedia(`bg_${session.roomId}`);
      const next: EncryptedRoomSettings = {
        ...settings,
        backgroundType: 'default',
        backgroundScale: 1,
        backgroundFit: 'cover',
      };
      setSettings(next);
      await saveRoomSettings(session.roomId, session.pin, next);
      return;
    }

    setLocalBgUrl(result.url);
    await saveEncryptedLocalMedia(
      `bg_${session.roomId}`,
      result.url,
      session.roomId,
      session.pin
    ).catch(() => {});
    const next: EncryptedRoomSettings = {
      ...settings,
      backgroundType: result.type,
    };
    setSettings(next);
    await saveRoomSettings(session.roomId, session.pin, next);
  };

  const handleUploadPhoto = async (dataUrl: string, caption: string) => {
    if (!session) return;
    const item: SharedPhotoItem = {
      id: `ph_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      dataUrl,
      caption,
      uploadedBy: session.role,
      createdAt: Date.now(),
    };
    fetchedPhotoIdsRef.current.add(item.id);
    setPhotos((prev) => [...prev, item]);
    await uploadEncryptedPhoto(session.roomId, session.pin, item, photosState);
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!session) return;
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    await deleteEncryptedPhoto(session.roomId, session.pin, photoId, photosState);
  };

  const handleSignOut = async () => {
    if (session) {
      await updatePartnerPresence(session.roomId, session.pin, session.role, {
        role: session.role,
        online: false,
        lastSeen: Date.now(),
      }).catch(() => {});
    }
    setSession(null);
    setSettingsOpen(false);
    setShowEntrance(false);
  };

  if (!session) {
    return (
      <LoginScreen
        onAuthenticateRoom={handleAuthenticateRoom}
        defaultRoomId={localStorage.getItem(STORAGE_ROOM_KEY) || 'habibi-room'}
      />
    );
  }

  const effectiveBgType = syncedBgPayload
    ? syncedBgPayload.type
    : localBgUrl && settings.backgroundType !== 'default'
      ? settings.backgroundType
      : 'default';

  const effectiveBgUrl = syncedBgPayload
    ? syncedBgPayload.type === 'default'
      ? DEFAULT_BG_IMAGE
      : syncedBgPayload.url || DEFAULT_BG_IMAGE
    : localBgUrl && settings.backgroundType !== 'default'
      ? localBgUrl
      : DEFAULT_BG_IMAGE;

  const effectiveOverlayOpacity =
    bgPreviewOverrides?.overlayOpacity ?? settings.overlayOpacity ?? 0.62;
  const effectiveBgScale =
    bgPreviewOverrides?.backgroundScale ?? settings.backgroundScale ?? 1;
  const effectiveBgFit =
    bgPreviewOverrides?.backgroundFit ?? settings.backgroundFit ?? 'cover';

  const partnerPresence = session.role === 'male' ? femalePresence : malePresence;
  const isPartnerOnline = Boolean(
    partnerPresence?.online &&
      Date.now() - (partnerPresence?.lastSeen || 0) < 90000
  );

  return (
    <div className="relative flex h-[100dvh] w-screen flex-col overflow-hidden bg-[#140309] text-rose-50">
      {/* Dynamic Custom Background (Static Image, Looping Video, or GIF) */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center overflow-hidden">
        {effectiveBgType === 'video' && effectiveBgUrl ? (
          <video
            key={effectiveBgUrl}
            src={effectiveBgUrl}
            autoPlay
            loop
            muted
            playsInline
            className={`h-full w-full origin-center transition-transform duration-150 ${
              effectiveBgFit === 'contain' ? 'object-contain' : 'object-cover'
            }`}
            style={{transform: `scale(${effectiveBgScale})`}}
          />
        ) : (
          <img
            key={effectiveBgUrl || DEFAULT_BG_IMAGE}
            src={effectiveBgUrl || DEFAULT_BG_IMAGE}
            alt="خلفية التطبيق"
            className={`h-full w-full origin-center transition-transform duration-150 ${
              effectiveBgFit === 'contain' ? 'object-contain' : 'object-cover'
            }`}
            style={{transform: `scale(${effectiveBgScale})`}}
          />
        )}
      </div>

      {/* Adjustable Overlay Opacity */}
      <div
        className="pointer-events-none fixed inset-0 bg-[#120208]"
        style={{opacity: effectiveOverlayOpacity}}
      />

      {/* Romantic Floating Hearts & Expressive Lips */}
      <RomanticFloatingLayer density="normal" />

      {/* Main Mobile-Locked App Shell */}
      <div className="relative z-20 mx-auto flex h-full w-full max-w-2xl flex-col px-2.5 pt-2 pb-2">
        {/* Top Marquee Banner + Top-Left Settings Button */}
        <header className="relative flex h-10 shrink-0 items-center justify-between gap-2 rounded-2xl border border-rose-300/25 bg-black/50 px-2 backdrop-blur-xl shadow-lg">
          {/* Top-Left Controls (forced left position in RTL via order/dir) */}
          <div className="flex items-center gap-1 shrink-0 order-last">
            <button
              type="button"
              onClick={() => setPartnerModalOpen(true)}
              aria-label="حالة الشريك وإرسال نبضة"
              className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-rose-100 hover:bg-rose-500/30 transition"
            >
              <HeartHandshake className="h-4 w-4" />
              <span
                className={`absolute top-1 right-1 h-2 w-2 rounded-full ${
                  isPartnerOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400/50'
                }`}
              />
            </button>
            <button
              type="button"
              onClick={() => {
                soundEngine.muted = !muted;
                setMuted(!muted);
              }}
              aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-rose-100 hover:bg-rose-500/30 transition"
            >
              {muted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="الإعدادات"
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-600/80 text-white hover:bg-rose-500 transition shadow"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>

          {/* Scrolling Romantic Ticker */}
          <div className="flex-1 overflow-hidden px-1">
            <div className="animate-marquee-rtl text-xs font-bold text-amber-100">
              {settings.bannerText}
            </div>
          </div>

          {!isOnline && (
            <span
              title="وضع عدم الاتصال"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/25 text-amber-200"
            >
              <WifiOff className="h-3.5 w-3.5" />
            </span>
          )}
        </header>

        {/* Single-Row 4-Tab Navigation Bar */}
        <nav className="mt-2 grid grid-cols-4 gap-1.5 shrink-0">
          {(
            [
              {id: 'wheel' as MainTab, label: 'عجلة الحظ', Icon: Disc3},
              {id: 'quiz' as MainTab, label: 'مسابقة', Icon: HelpCircle},
              {id: 'photos' as MainTab, label: 'صور عشوائية', Icon: Images},
              {id: 'cards' as MainTab, label: 'كروت الحظ', Icon: Sparkles},
            ] as const
          ).map(({id, label, Icon}) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`flex min-h-[42px] flex-col items-center justify-center gap-0.5 rounded-2xl border px-1 py-1 text-[10px] sm:text-xs font-extrabold leading-tight break-words transition ${
                  active
                    ? 'border-rose-300/60 bg-gradient-to-b from-rose-600 to-rose-700 text-white shadow-lg backdrop-blur-xl'
                    : 'border-rose-200/20 bg-black/55 text-rose-100/90 backdrop-blur-xl hover:bg-black/65'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate max-w-full">{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Digital Love & Anniversary Counter Bar */}
        <LoveCounterBar
          roomId={session.roomId}
          settings={settings}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        {/* Active Tab Viewport Container */}
        <main className="mt-1.5 flex-1 min-h-0 overflow-hidden rounded-3xl border border-rose-200/20 bg-black/15 p-2.5 sm:p-3.5 backdrop-blur-[2px] shadow-xl">
          {activeTab === 'wheel' && (
            <SpinWheelTab
              role={session.role}
              segments={settings.wheelSegments}
              wheelState={wheelState}
              onUpdateWheel={(next) =>
                writeLiveState(session.roomId, session.pin, 'wheel', next)
              }
            />
          )}

          {activeTab === 'quiz' && (
            <QuizTab
              role={session.role}
              settings={settings}
              quizState={quizState}
              onUpdateQuiz={(next) =>
                writeLiveState(session.roomId, session.pin, 'quiz', next)
              }
              onUpdateSettings={handleSaveSettings}
              onTriggerReaction={(evt) =>
                writeLiveState(session.roomId, session.pin, 'reaction', evt)
              }
            />
          )}

          {activeTab === 'photos' && (
            <PhotosTab
              role={session.role}
              photos={photos}
              photosState={photosState}
              onUpdatePhotosState={(next) =>
                writeLiveState(session.roomId, session.pin, 'photos', next)
              }
            />
          )}

          {activeTab === 'cards' && (
            <MysteryCardsTab
              role={session.role}
              cardsPool={settings.mysteryCards}
              cardsState={cardsState}
              onUpdateCards={(next) =>
                writeMysteryCardsState(session.roomId, session.pin, next)
              }
              onTriggerReaction={(evt) =>
                writeLiveState(session.roomId, session.pin, 'reaction', evt)
              }
            />
          )}
        </main>
      </div>

      {/* Partner Presence & Kiss Ping Modal Overlay */}
      {partnerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 backdrop-blur-md">
          <div className="relative flex max-h-[82dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-rose-300/30 bg-[#1a050e]/95 p-3.5 text-rose-50 shadow-2xl">
            <div className="mb-2 flex items-center justify-between border-b border-rose-300/15 pb-2">
              <span className="text-sm font-extrabold text-white">حالة الشريك والنبضات</span>
              <button
                type="button"
                onClick={() => setPartnerModalOpen(false)}
                aria-label="إغلاق حالة الشريك"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-rose-600 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <PartnerSyncTab
                role={session.role}
                roomId={session.roomId}
                malePresence={malePresence}
                femalePresence={femalePresence}
                onSendKissPing={async (evt, note) => {
                  await updatePartnerPresence(session.roomId, session.pin, session.role, {
                    role: session.role,
                    online: true,
                    lastSeen: Date.now(),
                    lastPingAt: Date.now(),
                    pingMessage: note,
                    pingId: evt.id,
                  });
                  await writeLiveState(session.roomId, session.pin, 'reaction', evt);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Login Entrance Walking & Kiss-Blowing Character */}
      {showEntrance && (
        <EntranceCharacterOverlay
          role={session.role}
          onDismiss={() => setShowEntrance(false)}
        />
      )}

      {/* Synced Transparent Reaction Popup Overlay (Happy / Sad / Kiss) */}
      <ReactionPopupOverlay
        type={activeReaction?.type || null}
        label={activeReaction?.label}
        role={activeReaction?.triggeredBy || session.role}
      />

      {/* PIN-Protected Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => {
          setBgPreviewOverrides(null);
          setSettingsOpen(false);
        }}
        currentPin={session.pin}
        settings={settings}
        photos={photos}
        onSaveSettings={handleSaveSettings}
        onChangePasscode={handleChangePasscode}
        onUpdateBackground={handleUpdateBackground}
        onUploadPhoto={handleUploadPhoto}
        onDeletePhoto={handleDeletePhoto}
        onSignOut={handleSignOut}
        onPreviewBackgroundControls={setBgPreviewOverrides}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainAppContent />
    </ErrorBoundary>
  );
}

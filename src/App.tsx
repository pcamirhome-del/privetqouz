import React, {useCallback, useEffect, useRef, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import confetti from 'canvas-confetti';
import {
  BellRing,
  Disc3,
  EyeOff,
  Gift,
  HeartHandshake,
  Images,
  LogOut,
  Music,
  Settings,
  Sparkles,
  Volume2,
  VolumeX,
  WifiOff,
  X,
} from 'lucide-react';
import {
  CouplesScoreState,
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
  ScreenEffectEvent,
  ScreenEffectType,
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
import {ambientAudio} from './services/ambientAudio';
import {useOnlineStatus} from './hooks/useOnlineStatus';
import {ErrorBoundary} from './components/ErrorBoundary';
import {LoginScreen} from './components/LoginScreen';
import {RomanticFloatingLayer} from './components/RomanticFloatingLayer';
import {
  CenterKissMessageOverlay,
  ClappingHandsOverlay,
  EntranceCharacterOverlay,
  ReactionPopupOverlay,
} from './components/AnimatedCharacter';
import {SpinWheelTab} from './components/SpinWheelTab';
// QuizTab retained safely in codebase while hidden from top navigation UI
// import {QuizTab} from './components/QuizTab';
import {PhotosTab} from './components/PhotosTab';
import {MysteryCardsTab} from './components/MysteryCardsTab';
import {PartnerSyncTab} from './components/PartnerSyncTab';
import {LoveCounterBar} from './components/LoveCounterBar';
import {SettingsModal} from './components/SettingsModal';
import {PrivacyLockOverlay} from './components/PrivacyLockOverlay';
import {ScreenEffectOverlay} from './components/ScreenEffectOverlay';
import {
  PartnerRewardAlertOverlay,
  SpecialRewardModal,
} from './components/SpecialRewardModal';

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
  const [scoreState, setScoreState] = useState<CouplesScoreState | null>(null);
  const [photos, setPhotos] = useState<SharedPhotoItem[]>([]);
  const [malePresence, setMalePresence] = useState<PartnerPresenceData | null>(null);
  const [femalePresence, setFemalePresence] = useState<PartnerPresenceData | null>(
    null
  );

  const [activeTab, setActiveTab] = useState<MainTab>('wheel');
  const [showEntrance, setShowEntrance] = useState(false);
  const [activeReaction, setActiveReaction] = useState<ReactionEvent | null>(null);
  const [activeScreenEffect, setActiveScreenEffect] =
    useState<ScreenEffectEvent | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);
  const [rewardModalOpen, setRewardModalOpen] = useState(false);
  const [privacyLocked, setPrivacyLocked] = useState(false);
  const [muted, setMuted] = useState<boolean>(() => soundEngine.muted);
  const [ambientPlaying, setAmbientPlaying] = useState<boolean>(
    () => ambientAudio.isPlaying
  );
  const [clapLabel, setClapLabel] = useState<string | null>(null);
  const [periodicReminderVisible, setPeriodicReminderVisible] = useState(false);
  const [localBgUrl, setLocalBgUrl] = useState<string>('');
  const [syncedBgPayload, setSyncedBgPayload] =
    useState<SyncedBackgroundPayload | null>(null);
  const [bgPreviewOverrides, setBgPreviewOverrides] = useState<{
    overlayOpacity?: number;
    backgroundScale?: number;
    backgroundFit?: 'cover' | 'contain';
  } | null>(null);

  const lastReactionIdRef = useRef<string | null>(null);
  const lastScreenEffectIdRef = useRef<string | null>(null);
  const lastWinWheelIdRef = useRef<string | null>(null);
  const lastWinDrawIdRef = useRef<string | null>(null);
  const lastWinQuizIdRef = useRef<string | null>(null);
  const clapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchedPhotoIdsRef = useRef<Set<string>>(new Set());
  const rtdbPhotoIdsRef = useRef<Set<string>>(new Set());
  const isOnline = useOnlineStatus();

  const triggerClap = useCallback((label?: string) => {
    if (clapTimeoutRef.current) clearTimeout(clapTimeoutRef.current);
    setClapLabel(label || 'مبروك الفوز! 👏🎉');
    clapTimeoutRef.current = setTimeout(() => {
      setClapLabel(null);
    }, 2800);
  }, []);

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
    const unsubScores = subscribeLiveState<CouplesScoreState>(
      roomId,
      pin,
      'scores',
      setScoreState
    );
    const unsubScreenEffect = subscribeLiveState<ScreenEffectEvent>(
      roomId,
      pin,
      'screenEffect',
      (evt) => {
        if (!evt || evt.id === lastScreenEffectIdRef.current) return;
        if (Date.now() - evt.timestamp > 10000) return;
        lastScreenEffectIdRef.current = evt.id;
        // Launch 4-second full-screen particle shower on the partner's active screen
        if (evt.sentBy !== role) {
          setActiveScreenEffect(evt);
          soundEngine.playPop();
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
              navigator.vibrate([150, 80, 150]);
            } catch {
              // ignore unsupported vibration
            }
          }
          setTimeout(() => {
            setActiveScreenEffect((curr) => (curr?.id === evt.id ? null : curr));
          }, 4000);
        }
      }
    );
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
        if (evt.type === 'happy') {
          soundEngine.playWin();
          triggerClap('إجابة موفقة! 👏✨');
        } else if (evt.type === 'sad') {
          soundEngine.playSad();
        } else {
          soundEngine.playKissPing();
        }
        setTimeout(() => {
          setActiveReaction((curr) => (curr?.id === evt.id ? null : curr));
        }, evt.source === 'ping' ? 4500 : 2800);
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
      unsubScores();
      unsubScreenEffect();
      unsubBackground();
      unsubGallery();
      unsubReaction();
    };
  }, [session]);

  // Trigger center-screen clapping hands on game wins (Quiz round win / Spin Wheel accepted / Final random draw)
  useEffect(() => {
    if (!session || !wheelState) return;
    if (
      wheelState.status === 'accepted' &&
      wheelState.spinId !== lastWinWheelIdRef.current &&
      Date.now() - (wheelState.timestamp || 0) < 12000
    ) {
      lastWinWheelIdRef.current = wheelState.spinId;
      triggerClap(`مبروك الفوز: ${wheelState.targetLabel} 👏`);
    }
    if (
      wheelState.finalDraw?.status === 'revealed' &&
      wheelState.finalDraw.drawId !== lastWinDrawIdRef.current &&
      Date.now() - (wheelState.finalDraw.startedAt || 0) < 15000
    ) {
      lastWinDrawIdRef.current = wheelState.finalDraw.drawId;
      triggerClap(`الاختيار العشوائي: ${wheelState.finalDraw.chosenLabel} 👏`);
    }
  }, [session, wheelState, triggerClap]);

  useEffect(() => {
    if (!session || !quizState) return;
    if (
      quizState.status === 'finished' &&
      quizState.roundId !== lastWinQuizIdRef.current &&
      Date.now() - (quizState.updatedAt || 0) < 15000
    ) {
      lastWinQuizIdRef.current = quizState.roundId;
      if (quizState.winnerRole === session.role) {
        triggerClap('مبروك الفوز بالمسابقة! 🏆👏');
      } else if (quizState.winnerRole === 'tie') {
        triggerClap('تعادل رائع! 👏❤️');
      }
    }
  }, [session, quizState, triggerClap]);

  // Configurable periodic playtime reminder message (default every 2 minutes)
  useEffect(() => {
    if (!session) {
      setPeriodicReminderVisible(false);
      return;
    }
    const enabled = settings.periodicReminderEnabled ?? true;
    const msg = (
      settings.periodicReminderMessage ??
      DEFAULT_ROOM_SETTINGS.periodicReminderMessage ??
      ''
    ).trim();
    const minutes = Math.max(1, Number(settings.periodicReminderMinutes ?? 2));

    if (!enabled || !msg) {
      setPeriodicReminderVisible(false);
      return;
    }

    let autoHideTimer: ReturnType<typeof setTimeout> | null = null;
    const interval = setInterval(() => {
      setPeriodicReminderVisible(true);
      soundEngine.playKissPing();
      if (autoHideTimer) clearTimeout(autoHideTimer);
      autoHideTimer = setTimeout(() => {
        setPeriodicReminderVisible(false);
      }, 14000);
    }, minutes * 60 * 1000);

    return () => {
      clearInterval(interval);
      if (autoHideTimer) clearTimeout(autoHideTimer);
    };
  }, [
    session,
    settings.periodicReminderEnabled,
    settings.periodicReminderMinutes,
    settings.periodicReminderMessage,
  ]);

  // Fetch & decrypt photos whenever photosState.photoIds updates without wiping RTDB gallery items
  useEffect(() => {
    if (!session || !photosState?.photoIds) return;
    const ids = photosState.photoIds;
    setPhotos((prev) =>
      prev.filter((p) => ids.includes(p.id) || rtdbPhotoIdsRef.current.has(p.id))
    );

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

  const handleAuthenticateRoom = async (rawRoomId: string, pin: string) => {
    const result = await connectOrCreateRoom(rawRoomId, pin);
    localStorage.setItem(STORAGE_ROOM_KEY, result.roomId);
    setSettings(result.settings);
    setSession({
      roomId: result.roomId,
      pin: result.cipherKey,
      role: result.role,
    });
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

  const handleUploadPhoto = async (
    dataUrl: string,
    caption: string,
    hashes?: {contentHash: string; perceptualHash: string}
  ) => {
    if (!session) return;
    const item: SharedPhotoItem = {
      id: `ph_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      dataUrl,
      caption,
      uploadedBy: session.role,
      createdAt: Date.now(),
      contentHash: hashes?.contentHash,
      perceptualHash: hashes?.perceptualHash,
    };
    fetchedPhotoIdsRef.current.add(item.id);
    rtdbPhotoIdsRef.current.add(item.id);
    setPhotos((prev) => [...prev, item]);
    await uploadEncryptedPhoto(session.roomId, session.pin, item, photosState);
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!session) return;
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    await deleteEncryptedPhoto(session.roomId, session.pin, photoId, photosState);
  };

  const handleConfirmTaskCompletion = useCallback(
    async (taskId: string, executingRole: PartnerRole) => {
      if (!session) return;
      const existingIds = scoreState?.confirmedTaskIds || [];
      if (existingIds.includes(taskId)) return;

      const nextScores: CouplesScoreState = {
        malePoints:
          (scoreState?.malePoints || 0) + (executingRole === 'male' ? 1 : 0),
        femalePoints:
          (scoreState?.femalePoints || 0) + (executingRole === 'female' ? 1 : 0),
        confirmedTaskIds: [...existingIds.slice(-49), taskId],
        activeRewardRequest: scoreState?.activeRewardRequest || null,
        updatedAt: Date.now(),
      };

      setScoreState(nextScores);
      soundEngine.playWin();
      confetti({
        particleCount: 60,
        spread: 70,
        origin: {y: 0.6},
        colors: ['#34d399', '#fde68a', '#fb7185', '#ffffff'],
      });
      triggerClap(
        `+1 نقطة لـ${executingRole === 'male' ? 'لزوج' : 'لزوجة'}! ✅`
      );
      await writeLiveState(session.roomId, session.pin, 'scores', nextScores);
    },
    [session, scoreState, triggerClap]
  );

  const handleSubmitSpecialReward = useCallback(
    async (rewardText: string, deductPoints: boolean) => {
      if (!session) return;
      const targetPoints = Math.max(1, settings.rewardTargetPoints ?? 5);
      const currMale = scoreState?.malePoints || 0;
      const currFemale = scoreState?.femalePoints || 0;

      const nextScores: CouplesScoreState = {
        malePoints:
          deductPoints && session.role === 'male'
            ? Math.max(0, currMale - targetPoints)
            : currMale,
        femalePoints:
          deductPoints && session.role === 'female'
            ? Math.max(0, currFemale - targetPoints)
            : currFemale,
        confirmedTaskIds: scoreState?.confirmedTaskIds || [],
        activeRewardRequest: {
          id: `rew_${Date.now().toString(36)}`,
          requestedBy: session.role,
          rewardText,
          pointsSpent: deductPoints ? targetPoints : 0,
          status: 'pending',
          createdAt: Date.now(),
        },
        updatedAt: Date.now(),
      };

      setScoreState(nextScores);
      soundEngine.playKissPing();
      await writeLiveState(session.roomId, session.pin, 'scores', nextScores);
    },
    [session, settings.rewardTargetPoints, scoreState]
  );

  const handleAcknowledgeSpecialReward = useCallback(async () => {
    if (!session || !scoreState?.activeRewardRequest) return;
    const nextScores: CouplesScoreState = {
      ...scoreState,
      activeRewardRequest: {
        ...scoreState.activeRewardRequest,
        status: 'accepted',
      },
      updatedAt: Date.now(),
    };
    setScoreState(nextScores);
    soundEngine.playWin();
    triggerClap('تم تأكيد طلب المكافأة الخاصة! 🎁❤️');
    await writeLiveState(session.roomId, session.pin, 'scores', nextScores);
  }, [session, scoreState, triggerClap]);

  const handleSendScreenEffect = useCallback(
    async (effect: ScreenEffectType) => {
      if (!session) return;
      soundEngine.playPop();
      const evt: ScreenEffectEvent = {
        id: `fx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
        effect,
        sentBy: session.role,
        timestamp: Date.now(),
      };
      await writeLiveState(session.roomId, session.pin, 'screenEffect', evt);
    },
    [session]
  );

  const handleSignOut = async () => {
    if (session) {
      await updatePartnerPresence(session.roomId, session.pin, session.role, {
        role: session.role,
        online: false,
        lastSeen: Date.now(),
      }).catch(() => {});
    }
    ambientAudio.stop();
    setAmbientPlaying(false);
    setPrivacyLocked(false);
    setRewardModalOpen(false);
    setPartnerModalOpen(false);
    setSettingsOpen(false);
    setShowEntrance(false);
    setActiveReaction(null);
    setActiveScreenEffect(null);
    setClapLabel(null);
    setPeriodicReminderVisible(false);
    setSession(null);
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

  const malePoints = scoreState?.malePoints ?? 0;
  const femalePoints = scoreState?.femalePoints ?? 0;
  const myPoints = session.role === 'male' ? malePoints : femalePoints;
  const targetPoints = Math.max(1, settings.rewardTargetPoints ?? 5);
  const canRequestReward = myPoints >= targetPoints;
  const confirmedTaskIds = scoreState?.confirmedTaskIds || [];

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
        {/* Top Compact 2-Tier Header: Ticker + Controls + Reactions + Score */}
        <header className="relative shrink-0 rounded-2xl border border-rose-300/25 bg-black/50 px-2 py-1 backdrop-blur-xl shadow-lg space-y-1">
          {/* Row 1: Marquee + Role + Ambient + Mute + Privacy Lock + Settings + LogOut */}
          <div className="flex h-8 items-center justify-between gap-1.5">
            <div className="flex items-center gap-1 shrink-0 order-last">
              {/* Active Account Role Badge (الزوج / الزوجة) */}
              <span
                className={`flex h-7 items-center rounded-xl border px-2 text-[10px] sm:text-[11px] font-extrabold shadow-sm ${
                  session.role === 'male'
                    ? 'border-sky-300/45 bg-sky-500/25 text-sky-100'
                    : 'border-pink-300/45 bg-pink-500/25 text-pink-100'
                }`}
              >
                {session.role === 'male' ? 'الزوج' : 'الزوجة'}
              </span>
              {/* Ambient Lounge Audio Quick Toggle */}
              <button
                type="button"
                onClick={() => {
                  const next = ambientAudio.toggle();
                  setAmbientPlaying(next);
                }}
                aria-label={ambientPlaying ? 'إيقاف الأجواء الصوتية' : 'تشغيل الأجواء الصوتية'}
                title="الأجواء الصوتية"
                className={`flex h-7 w-7 items-center justify-center rounded-xl transition ${
                  ambientPlaying
                    ? 'bg-amber-500/35 text-amber-200 border border-amber-300/55 shadow-[0_0_10px_rgba(251,191,36,0.45)] animate-pulse'
                    : 'bg-white/10 text-rose-100 hover:bg-rose-500/30'
                }`}
              >
                <Music className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  soundEngine.muted = !muted;
                  setMuted(!muted);
                }}
                aria-label={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
                title={muted ? 'تشغيل الصوت' : 'كتم الصوت'}
                className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/10 text-rose-100 hover:bg-rose-500/30 transition"
              >
                {muted ? (
                  <VolumeX className="h-3.5 w-3.5" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5" />
                )}
              </button>
              {/* One-Tap Quick Privacy Screen Lock */}
              <button
                type="button"
                onClick={() => setPrivacyLocked(true)}
                aria-label="قفل الخصوصية السريع"
                title="قفل الخصوصية السريع"
                className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/10 text-amber-200 hover:bg-amber-500/30 transition"
              >
                <EyeOff className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                aria-label="الإعدادات"
                title="الإعدادات"
                className="flex h-7 w-7 items-center justify-center rounded-xl bg-rose-600/80 text-white hover:bg-rose-500 transition shadow"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                aria-label="تسجيل الخروج"
                title="تسجيل الخروج"
                className="flex h-7 w-7 items-center justify-center rounded-xl border border-rose-300/35 bg-rose-950/75 text-rose-100 hover:bg-red-600 hover:text-white transition shadow"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Scrolling Romantic Ticker */}
            <div className="flex-1 min-w-0 overflow-hidden px-1">
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
          </div>

          {/* Row 2: Heartbeat + 3 Live Screen Reactions (💋 🔥 🌹) + Live Score Badge + Special Reward Trigger */}
          <div className="flex h-7 items-center justify-between gap-1.5 border-t border-rose-300/15 pt-1">
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setPartnerModalOpen(true)}
                aria-label="حالة الشريك وإرسال نبضة"
                title="حالة الشريك وإرسال نبضة"
                className="relative flex h-6 w-7 items-center justify-center rounded-lg bg-white/10 text-rose-100 hover:bg-rose-500/30 transition"
              >
                <HeartHandshake className="h-3.5 w-3.5" />
                <span
                  className={`absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full ${
                    isPartnerOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400/50'
                  }`}
                />
              </button>
              <button
                type="button"
                onClick={() => handleSendScreenEffect('kisses')}
                aria-label="إرسال أمطار قبلات"
                title="أمطار من القبلات 💋"
                className="flex h-6 w-7 items-center justify-center rounded-lg bg-rose-500/20 border border-rose-300/25 text-xs hover:bg-rose-500/40 active:scale-90 transition"
              >
                💋
              </button>
              <button
                type="button"
                onClick={() => handleSendScreenEffect('fire_hearts')}
                aria-label="إرسال قلوب نارية"
                title="قلوب نارية 🔥"
                className="flex h-6 w-7 items-center justify-center rounded-lg bg-amber-500/20 border border-amber-300/25 text-xs hover:bg-amber-500/40 active:scale-90 transition"
              >
                🔥
              </button>
              <button
                type="button"
                onClick={() => handleSendScreenEffect('roses')}
                aria-label="إرسال ورود حمراء"
                title="ورود حمراء 🌹"
                className="flex h-6 w-7 items-center justify-center rounded-lg bg-pink-500/20 border border-pink-300/25 text-xs hover:bg-pink-500/40 active:scale-90 transition"
              >
                🌹
              </button>
            </div>

            <div className="flex items-center gap-1.5 min-w-0">
              {canRequestReward && (
                <button
                  type="button"
                  onClick={() => setRewardModalOpen(true)}
                  className="flex h-6 shrink-0 items-center gap-1 rounded-lg bg-gradient-to-r from-amber-500 to-rose-500 px-2 text-[10px] font-extrabold text-white shadow animate-pulse hover:from-amber-400 hover:to-rose-400 transition"
                >
                  <Gift className="h-3 w-3 shrink-0" />
                  <span>اطلب مكافأة خاصة 🎁</span>
                </button>
              )}

              {/* Compact Live Score Counter */}
              <div
                title="نقاط الزوج والزوجة"
                className="flex h-6 shrink-0 items-center gap-1.5 rounded-lg border border-amber-300/30 bg-black/45 px-2 text-[10px] font-extrabold text-white"
              >
                <span className="text-sky-200">
                  👨🏻 <span className="font-mono-num">{malePoints}</span>
                </span>
                <span className="text-rose-300/50">|</span>
                <span className="text-pink-200">
                  👩🏻 <span className="font-mono-num">{femalePoints}</span>
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Single-Row 3-Tab Navigation Bar */}
        <nav className="mt-2 grid grid-cols-3 gap-1.5 shrink-0">
          {(
            [
              {id: 'wheel' as MainTab, label: 'عجلة الحظ', Icon: Disc3},
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
          {(activeTab === 'wheel' || activeTab === 'quiz') && (
            <SpinWheelTab
              role={session.role}
              segments={settings.wheelSegments}
              wheelState={wheelState}
              onUpdateWheel={(next) =>
                writeLiveState(session.roomId, session.pin, 'wheel', next)
              }
              confirmedTaskIds={confirmedTaskIds}
              onConfirmTaskCompletion={handleConfirmTaskCompletion}
            />
          )}

          {/* Quiz Tab intentionally hidden from UI while keeping QuizTab logic safely in codebase */}
          {/* {activeTab === 'quiz' && (
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
          )} */}

          {activeTab === 'photos' && (
            <PhotosTab
              role={session.role}
              photos={photos}
              photosState={photosState}
              onUpdatePhotosState={(next) =>
                writeLiveState(session.roomId, session.pin, 'photos', next)
              }
              confirmedTaskIds={confirmedTaskIds}
              onConfirmTaskCompletion={handleConfirmTaskCompletion}
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
              confirmedTaskIds={confirmedTaskIds}
              onConfirmTaskCompletion={handleConfirmTaskCompletion}
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
                onAfterSend={() => setPartnerModalOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Login Entrance Walking & Kiss-Blowing Character (visible for 10s on open) */}
      <AnimatePresence>
        {showEntrance && (
          <EntranceCharacterOverlay
            role={session.role}
            onDismiss={() => setShowEntrance(false)}
          />
        )}
      </AnimatePresence>

      {/* Center-Screen Clapping Hands on Win */}
      <ClappingHandsOverlay active={Boolean(clapLabel)} label={clapLabel || undefined} />

      {/* Periodic Configurable Playtime Reminder Message */}
      <AnimatePresence>
        {periodicReminderVisible && (
          <motion.div
            initial={{opacity: 0, y: -16, scale: 0.95}}
            animate={{opacity: 1, y: 0, scale: 1}}
            exit={{opacity: 0, y: -16, scale: 0.95}}
            transition={{duration: 0.25}}
            className="fixed top-14 inset-x-0 z-50 mx-auto flex w-[92%] max-w-md items-center justify-between gap-2.5 rounded-2xl border border-amber-300/45 bg-[#240614]/95 px-3.5 py-2.5 text-white shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center gap-2 min-w-0">
              <BellRing className="h-4 w-4 shrink-0 text-amber-300 animate-bounce" />
              <p className="text-xs sm:text-sm font-extrabold text-amber-100 leading-snug break-words">
                {settings.periodicReminderMessage ||
                  DEFAULT_ROOM_SETTINGS.periodicReminderMessage}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPeriodicReminderVisible(false)}
              className="shrink-0 rounded-xl bg-rose-600 px-2.5 py-1 text-[11px] font-extrabold text-white hover:bg-rose-500 transition"
            >
              إغلاق
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Center-Screen Princess with Sent Kiss Ping Message in front of her hand */}
      <CenterKissMessageOverlay
        active={Boolean(
          activeReaction?.type === 'kiss' && activeReaction?.source === 'ping'
        )}
        message={activeReaction?.label}
        role={activeReaction?.triggeredBy || session.role}
      />

      {/* Synced Transparent Reaction Popup Overlay (Happy / Sad / Card Kiss) */}
      <ReactionPopupOverlay
        type={
          activeReaction?.source === 'ping'
            ? null
            : activeReaction?.type || null
        }
        label={activeReaction?.label}
        role={activeReaction?.triggeredBy || session.role}
      />

      {/* Live Screen-Wide Reaction Shower (💋 / 🔥 / 🌹) */}
      <ScreenEffectOverlay activeEffect={activeScreenEffect} />

      {/* Special Reward Request & Partner Full-Focus Alert */}
      <SpecialRewardModal
        isOpen={rewardModalOpen}
        role={session.role}
        myPoints={myPoints}
        targetPoints={targetPoints}
        onClose={() => setRewardModalOpen(false)}
        onSubmitRequest={handleSubmitSpecialReward}
      />
      <PartnerRewardAlertOverlay
        request={scoreState?.activeRewardRequest}
        myRole={session.role}
        onAcknowledge={handleAcknowledgeSpecialReward}
      />

      {/* PIN-Protected Settings Modal */}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => {
          setBgPreviewOverrides(null);
          setAmbientPlaying(ambientAudio.isPlaying);
          setSettingsOpen(false);
        }}
        currentPin={session.pin}
        role={session.role}
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

      {/* One-Tap Stealth Privacy Lock Overlay (Clock + Functional Calculator) */}
      <PrivacyLockOverlay
        isLocked={privacyLocked}
        validPins={[
          settings.malePasscode || '0000',
          settings.femalePasscode || '1111',
          session.pin,
        ]}
        onUnlock={() => setPrivacyLocked(false)}
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

export type PartnerRole = 'male' | 'female';

export type MainTab = 'wheel' | 'quiz' | 'photos' | 'cards';

export type QuizCategory = 'arts' | 'history' | 'sports';

export type QuizDifficulty = 'easy' | 'medium' | 'hard';

export interface WheelSegment {
  id: string;
  label: string;
  weight: number;
  color: string;
}

export interface QuizRewardButton {
  id: string;
  label: string;
}

export interface QuizQuestion {
  id: string;
  category: QuizCategory;
  difficulty: QuizDifficulty;
  question: string;
  options: string[];
  correctIndex: number;
}

export interface MediaBackgroundConfig {
  type: 'default' | 'image' | 'video' | 'gif';
  url: string;
  localMediaKey?: string;
  overlayOpacity: number;
}

export interface EncryptedRoomSettings {
  passcode: string;
  bannerText: string;
  overlayOpacity: number;
  backgroundType: 'default' | 'image' | 'video' | 'gif';
  backgroundSyncedUrl?: string;
  backgroundScale?: number;
  backgroundFit?: 'cover' | 'contain';
  wheelSegments: WheelSegment[];
  quizRewards: QuizRewardButton[];
  mysteryCards?: MysteryCardItem[];
  anniversaryDate?: string;
  upcomingEventDate?: string;
  upcomingEventTitle?: string;
  askedQuestionIds: string[];
  customQuestions: QuizQuestion[];
  allowZoom: boolean;
}

export interface PartnerPresenceData {
  role: PartnerRole;
  online: boolean;
  lastSeen: number;
  lastPingAt?: number;
  pingMessage?: string;
  pingId?: string;
}

export interface WheelLiveState {
  spinId: string;
  spunBy: PartnerRole;
  targetIndex: number;
  targetLabel: string;
  targetRotation: number;
  status: 'idle' | 'spinning' | 'awaiting_response' | 'accepted' | 'rejected';
  respondedBy?: PartnerRole;
  timestamp: number;
}

export interface QuizAnswerRecord {
  questionIndex: number;
  selectedOption: number;
  isCorrect: boolean;
  answeredAt: number;
}

export interface QuizRoundState {
  roundId: string;
  status: 'idle' | 'playing' | 'finished';
  category: QuizCategory | 'all';
  startedBy: PartnerRole;
  questions: QuizQuestion[];
  currentIndex: number;
  questionStartedAt: number;
  maleScore: number;
  femaleScore: number;
  maleAnswers: Record<number, QuizAnswerRecord>;
  femaleAnswers: Record<number, QuizAnswerRecord>;
  loserSelectedRewardId?: string;
  loserSelectedRewardLabel?: string;
  loserRole?: PartnerRole | 'tie';
  winnerRole?: PartnerRole | 'tie';
  updatedAt: number;
}

export interface ReactionEvent {
  id: string;
  type: 'happy' | 'sad' | 'kiss';
  triggeredBy: PartnerRole;
  label?: string;
  timestamp: number;
}

export interface SharedPhotoItem {
  id: string;
  dataUrl: string;
  caption: string;
  uploadedBy: PartnerRole;
  createdAt: number;
}

export interface PhotosLiveState {
  photoIds: string[];
  activePhotoId: string | null;
  isShuffling: boolean;
  shuffleId?: string;
  chosenBy?: PartnerRole;
  rerollRequest?: {
    requestId: string;
    requestedBy: PartnerRole;
    status: 'pending' | 'approved' | 'rejected';
    note?: string;
    timestamp: number;
  } | null;
  updatedAt: number;
}

export interface MysteryCardItem {
  id: string;
  text: string;
}

export interface FlippedCardRecord {
  slotIndex: number;
  cardId: string;
  text: string;
  flippedBy: PartnerRole;
  flippedAt: number;
  dayKey: string;
}

export interface MysteryCardsLiveState {
  dayKey: string;
  boardSlots: MysteryCardItem[];
  maleFlip?: FlippedCardRecord | null;
  femaleFlip?: FlippedCardRecord | null;
  lastFlipped?: FlippedCardRecord | null;
  updatedAt: number;
}

export const DEFAULT_WHEEL_SEGMENTS: WheelSegment[] = [
  {id: 'w1', label: 'مم', weight: 18, color: '#be123c'},
  {id: 'w2', label: 'ممم', weight: 18, color: '#9f1239'},
  {id: 'w3', label: 'مممم', weight: 18, color: '#e11d48'},
  {id: 'w4', label: 'راحه م', weight: 16, color: '#881337'},
  {id: 'w5', label: 'خروجه من اقتراح الحبيبه', weight: 2, color: '#d97706'},
  {id: 'w6', label: 'خروجه من اقتراح الحبيب', weight: 14, color: '#9d174d'},
  {id: 'w7', label: 'شاور م', weight: 14, color: '#b91c1c'},
];

export const DEFAULT_QUIZ_REWARDS: QuizRewardButton[] = [
  {id: 'r1', label: 'ن'},
  {id: 'r2', label: 'نن'},
  {id: 'r3', label: 'م'},
  {id: 'r4', label: 'م '},
  {id: 'r5', label: 'ن'},
  {id: 'r6', label: 'تجهيز عشاء او غداء علي حسب الطلب'},
];

export const DEFAULT_MYSTERY_CARDS: MysteryCardItem[] = [
  {id: 'c1', text: 'قهوة على ذوقك'},
  {id: 'c2', text: 'تدليك للرأس 10 دقائق'},
  {id: 'c3', text: 'اختيار فيلم السهرة'},
  {id: 'c4', text: 'عشاء مفاجئ من اختيارك'},
  {id: 'c5', text: 'إعفاء من أي طلب اليوم'},
  {id: 'c6', text: 'رسالة صوتية رومانسية طويلة'},
];

export const DEFAULT_ROOM_SETTINGS: EncryptedRoomSettings = {
  passcode: '0000',
  bannerText: 'أنتِ أجمل أقداري... كل لحظة تجمعنا نبض وحياة ❤️💋',
  overlayOpacity: 0.62,
  backgroundType: 'default',
  backgroundScale: 1,
  backgroundFit: 'cover',
  wheelSegments: DEFAULT_WHEEL_SEGMENTS,
  quizRewards: DEFAULT_QUIZ_REWARDS,
  mysteryCards: DEFAULT_MYSTERY_CARDS,
  anniversaryDate: '',
  upcomingEventDate: '',
  upcomingEventTitle: '',
  askedQuestionIds: [],
  customQuestions: [],
  allowZoom: false,
};

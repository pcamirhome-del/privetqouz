import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import {fileURLToPath} from 'url';
import {GoogleGenAI, Type} from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

type QuizCat = 'arts' | 'history' | 'sports';

interface GeneratedQuestion {
  id: string;
  category: QuizCat;
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  options: string[];
  correctIndex: number;
}

const CATEGORY_AR: Record<QuizCat, string> = {
  arts: 'فنية (سينما، مسرح، موسيقى، أدب، فنون تشكيلية عربية وعالمية)',
  history: 'تاريخية (التاريخ الإسلامي، العربي، والحضارات العالمية القديمة والحديثة)',
  sports: 'رياضية (كرة القدم العالمية والعربية، الأولمبياد، بطولات وتاريخ الرياضة)',
};

async function generateCategoryBatch(
  ai: GoogleGenAI,
  category: QuizCat,
  count: number,
  excludeTopics: string[]
): Promise<GeneratedQuestion[]> {
  const sampleExclude = excludeTopics.slice(-40).join(' | ');
  const prompt = `أنشئ بالضبط ${count} سؤالاً ثقافياً حقيقياً وموثقاً باللغة العربية الفصحى في فئة: ${CATEGORY_AR[category]}.
الشروط الصارمة:
1. تنوع الصعوبة بين easy و medium و hard.
2. لكل سؤال 4 خيارات مميزة وصحيحة الصياغة ومختلفة عن بعضها.
3. تأكد أن correctIndex هو الفهرس الصحيح (0 إلى 3) للإجابة الموثقة تاريخياً أو علمياً أو فنياً.
4. تجنب تماماً أي تكرار أو تشابه مع هذه المواضيع/الأسئلة السابقة: ${sampleExclude || 'لا يوجد'}.`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction:
        'أنت محرر مسابقات ثقافية عربية محترف. أرجع مصفوفة JSON صالحة فقط بدون أي نص إضافي، وتأكد من دقة الحقائق بنسبة 100%.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: {type: Type.STRING},
            options: {
              type: Type.ARRAY,
              items: {type: Type.STRING},
            },
            correctIndex: {type: Type.INTEGER},
            difficulty: {type: Type.STRING},
          },
          required: ['question', 'options', 'correctIndex', 'difficulty'],
        },
      },
    },
  });

  const rawText = (response.text ?? '[]').trim();
  const parsed = JSON.parse(rawText) as Array<{
    question?: string;
    options?: string[];
    correctIndex?: number;
    difficulty?: string;
  }>;

  const timestamp = Date.now();
  return parsed
    .filter(
      (item) =>
        typeof item.question === 'string' &&
        item.question.trim().length > 6 &&
        Array.isArray(item.options) &&
        item.options.length === 4 &&
        typeof item.correctIndex === 'number' &&
        item.correctIndex >= 0 &&
        item.correctIndex <= 3
    )
    .map((item, idx) => {
      const diff =
        item.difficulty === 'easy' || item.difficulty === 'hard'
          ? item.difficulty
          : 'medium';
      return {
        id: `ai_${category}_${timestamp}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
        category,
        difficulty: diff,
        question: item.question!.trim(),
        options: item.options!.map((o) => String(o).trim()),
        correctIndex: item.correctIndex!,
      };
    });
}

async function startServer() {
  const app = express();
  app.use(express.json({limit: '1mb'}));

  app.get('/api/health', (_req, res) => {
    res.json({ok: true, timestamp: Date.now()});
  });

  app.post('/api/quiz/generate', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return res.status(503).json({
        error: 'مفتاح GEMINI_API_KEY غير مُعد في إعدادات الخادم (Secrets).',
      });
    }

    try {
      const requestedCategory = req.body?.category as QuizCat | 'all' | undefined;
      const excludeTopics = Array.isArray(req.body?.excludeTopics)
        ? (req.body.excludeTopics as string[])
        : [];

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      let batches: Promise<GeneratedQuestion[]>[];
      if (
        requestedCategory === 'arts' ||
        requestedCategory === 'history' ||
        requestedCategory === 'sports'
      ) {
        // 3 parallel calls of ~34 questions = 100 fresh questions for the chosen category
        batches = [
          generateCategoryBatch(ai, requestedCategory, 34, excludeTopics),
          generateCategoryBatch(ai, requestedCategory, 33, [
            ...excludeTopics,
            'أسئلة إضافية متقدمة',
          ]),
          generateCategoryBatch(ai, requestedCategory, 33, [
            ...excludeTopics,
            'أسئلة متنوعة نادرة',
          ]),
        ];
      } else {
        // 100 questions across all 3 categories (34 + 33 + 33)
        batches = [
          generateCategoryBatch(ai, 'arts', 34, excludeTopics),
          generateCategoryBatch(ai, 'history', 33, excludeTopics),
          generateCategoryBatch(ai, 'sports', 33, excludeTopics),
        ];
      }

      const settled = await Promise.allSettled(batches);
      const combined: GeneratedQuestion[] = [];
      const seenQuestions = new Set(
        excludeTopics.map((t) => t.trim().toLowerCase())
      );

      for (const result of settled) {
        if (result.status === 'fulfilled') {
          for (const q of result.value) {
            const key = q.question.trim().toLowerCase();
            if (!seenQuestions.has(key)) {
              seenQuestions.add(key);
              combined.push(q);
            }
          }
        }
      }

      if (combined.length === 0) {
        const firstRejected = settled.find((s) => s.status === 'rejected');
        const reason =
          firstRejected && firstRejected.status === 'rejected'
            ? String(firstRejected.reason)
            : 'لم يتم توليد أسئلة صالحة';
        return res.status(502).json({
          error: `تعذر توليد الأسئلة من Gemini: ${reason}`,
        });
      }

      return res.json({questions: combined.slice(0, 100)});
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'خطأ غير متوقع أثناء توليد الأسئلة';
      return res.status(500).json({error: message});
    }
  });

  const httpServer = http.createServer(app);

  if (!isProduction) {
    const {createServer: createViteServer} = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : {server: httpServer},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// server/routes/learningRoutes.js - OPTIMIZED VERSION
import express from 'express';
const router = express.Router();

// Cache for generated content (optional - helps reduce API calls)
const contentCache = new Map();
const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

function cleanJsonText(rawText) {
    let jsonText = rawText.trim();

    if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
    } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
    }

    const jsonStart = jsonText.indexOf('{');
    const jsonEnd = jsonText.lastIndexOf('}') + 1;

    if (jsonStart !== -1 && jsonEnd > jsonStart) {
        jsonText = jsonText.substring(jsonStart, jsonEnd);
    }

    return jsonText;
}

function getCacheKey(topic, subtopic, grade, personality) {
    return `${topic}-${subtopic}-${grade}-${personality}`;
}

router.post('/generate-content', async (req, res) => {
    try {
        const { topic, subtopic, topicId, subtopicId, grade, personality, userId } = req.body;

        console.log('📚 API Request received - Generating learning content:', {
            topic,
            subtopic,
            grade,
            personality,
            userId,
            hasApiKey: !!process.env.ANTHROPIC_API_KEY
        });

        // Validate required fields
        if (!topic || !grade || !personality) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: topic, grade, and personality are required'
            });
        }

        if (!process.env.ANTHROPIC_API_KEY) {
            console.error('❌ ANTHROPIC_API_KEY not found in environment');
            return res.status(500).json({
                success: false,
                error: 'API key not configured'
            });
        }

        // Check cache first (optional)
        const cacheKey = getCacheKey(topic, subtopic, grade, personality);
        const cached = contentCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
            console.log('✅ Returning cached content');
            return res.json({
                success: true,
                content: cached.data,
                cached: true
            });
        }

        const personalityContext = personality === 'dina' ?
            'את דינה - מורה סבלנית ומעודדת המסבירה בצורה ברורה וידידותית' :
            personality === 'ron' ?
                'אתה רון - מורה אנרגטי ומעורר השראה המשתמש בדוגמאות מעולם הספורט והמשחקים' :
                'אתה נקסון - מורה AI מקצועי ומתקדם המותאם אישית לכל תלמיד';

        const learningPrompt = `${personalityContext}

צור תוכן לימוד למתמטיקה עבור:
- נושא: ${topic}
${subtopic ? `- תת-נושא: ${subtopic}` : ''}
- כיתה: ${grade}

החזר JSON בפורמט הזה בדיוק:
{
  "title": "כותרת מושכת לנושא",
  "introduction": "מבוא קצר",
  "pages": [
    {
      "title": "יסודות - מה זה ${topic}?",
      "content": [
        {
          "type": "text",
          "value": "הסבר ראשוני פשוט של הנושא"
        },
        {
          "type": "example",
          "value": "דוגמה פשוטה: 5 + 3 = 8",
          "solution": "כשמחברים 5 ו-3, מקבלים 8"
        },
        {
          "type": "tip",
          "value": "טיפ שימושי לזכור"
        }
      ],
      "quiz": [
        {
          "question": "שאלה פשוטה לבדיקה",
          "options": ["תשובה 1", "תשובה 2", "תשובה 3", "תשובה נכונה"],
          "correctAnswer": 3,
          "explanation": "הסבר קצר"
        }
      ]
    },
    {
      "title": "דוגמאות מתקדמות",
      "content": [
        {
          "type": "text",
          "value": "הסבר מעמיק יותר"
        },
        {
          "type": "example",
          "value": "דוגמה מורכבת יותר",
          "solution": "פתרון מפורט"
        }
      ],
      "quiz": [
        {
          "question": "שאלה מתקדמת",
          "options": ["א", "ב", "ג", "ד"],
          "correctAnswer": 1,
          "explanation": "הסבר"
        }
      ]
    },
    {
      "title": "תרגול וסיכום",
      "content": [
        {
          "type": "text",
          "value": "סיכום של כל מה שלמדנו"
        },
        {
          "type": "tip",
          "value": "טיפ חשוב לסיום"
        }
      ],
      "quiz": [
        {
          "question": "שאלת סיכום",
          "options": ["1", "2", "3", "4"],
          "correctAnswer": 0,
          "explanation": "סיכום"
        }
      ]
    }
  ]
}

חשוב: צור 3-4 דפים, כל דף עם 3-5 content items ו-2-3 שאלות quiz. השתמש בעברית פשוטה וברורה.
החזר רק את ה-JSON, ללא טקסט נוסף.`;

        console.log('🤖 Calling Claude API...');

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': process.env.ANTHROPIC_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 4000,
                temperature: 0.7,
                messages: [{
                    role: 'user',
                    content: learningPrompt
                }]
            })
        });

        console.log('📡 API Response status:', response.status);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ Claude API Error:', {
                status: response.status,
                statusText: response.statusText,
                error: errorData
            });
            return res.status(500).json({
                success: false,
                error: `API Error: ${response.status} ${response.statusText}`,
                details: errorData
            });
        }

        const data = await response.json();
        console.log('✅ Got response from Claude');

        const contentText = data.content[0].text;
        console.log('📄 Raw content length:', contentText.length);
        console.log('📄 First 200 chars:', contentText.substring(0, 200));

        const cleanedText = cleanJsonText(contentText);
        console.log('🧹 Cleaned JSON length:', cleanedText.length);

        let learningContent;
        try {
            learningContent = JSON.parse(cleanedText);
            console.log('✅ JSON parsed successfully');
            console.log('📊 Pages count:', learningContent.pages?.length);
        } catch (parseError) {
            console.error('❌ JSON Parse Error:', parseError.message);
            console.log('📄 Failed text:', cleanedText.substring(0, 500));
            return res.status(500).json({
                success: false,
                error: 'Failed to parse AI response',
                rawResponse: cleanedText.substring(0, 500)
            });
        }

        // Cache the result
        contentCache.set(cacheKey, {
            data: learningContent,
            timestamp: Date.now()
        });

        // Clean old cache entries (keep last 50)
        if (contentCache.size > 50) {
            const entries = Array.from(contentCache.entries());
            entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
            for (let i = 0; i < 10; i++) {
                contentCache.delete(entries[i][0]);
            }
        }

        res.json({
            success: true,
            content: learningContent,
            cached: false
        });

    } catch (error) {
        console.error('❌ CRITICAL Error in generate-content:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error',
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Optional: Clear cache endpoint
router.post('/clear-cache', (req, res) => {
    contentCache.clear();
    res.json({ success: true, message: 'Cache cleared' });
});

export default router;

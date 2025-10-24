// server/routes/learningRoutes.js
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// Helper to call Claude API
async function callClaudeAPI(prompt, maxTokens = 4000) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: 'claude-3-5-haiku-20241022',
            max_tokens: maxTokens,
            temperature: 0.7,
            messages: [{
                role: 'user',
                content: prompt
            }]
        })
    });

    if (!response.ok) {
        throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    return data.content[0].text;
}

// Clean JSON from Claude's response
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

// ==================== GET LEARNING CONTENT ====================
router.post('/get-content', async (req, res) => {
    try {
        const { topicName, subtopicName, topicId, subtopicId } = req.body;

        console.log('📚 Generating learning content for:', {
            topic: topicName,
            subtopic: subtopicName
        });

        const prompt = `אתה מורה למתמטיקה מוכשר בעברית. צור תוכן לימודי מעניין ואינטראקטיבי עבור:
נושא: ${topicName}
${subtopicName ? `תת-נושא: ${subtopicName}` : ''}

צור תוכן לימודי ב-JSON בפורמט הבא:

{
  "title": "כותרת מרכזית מעניינת",
  "introduction": "הקדמה קצרה ומעניינת (2-3 שורות)",
  "sections": [
    {
      "title": "כותרת הסעיף",
      "subtitle": "תיאור קצר",
      "story": "סיפור קצר או אנלוגיה מהחיים (אופציונלי, 2-3 שורות)",
      "explanation": "הסבר מפורט של המושג (3-5 פסקאות, כל פסקה בשורה חדשה)",
      "examples": [
        {
          "title": "כותרת הדוגמה",
          "problem": "השאלה",
          "solution": "פתרון מפורט שלב אחר שלב (כל שלב בשורה חדשה)",
          "answer": "תשובה סופית"
        }
      ],
      "keyPoints": [
        "נקודה חשובה 1",
        "נקודה חשובה 2",
        "נקודה חשובה 3"
      ],
      "quiz": {
        "question": "שאלת הבנה",
        "answer": "תשובה נכונה",
        "hint": "רמז אם התשובה שגויה"
      }
    }
  ]
}

דרישות:
1. 2-4 סעיפים (sections) - מהקל לקשה
2. כל סעיף עם 1-3 דוגמאות פשוטות וברורות
3. השתמש בשפה פשוטה וידידותית
4. כלול סיפורים קצרים או אנלוגיות מהחיים כדי להפוך את הלמידה למעניינת
5. דוגמאות עם פתרונות מפורטים שלב אחר שלב
6. כל סעיף עם 3-4 נקודות מפתח
7. שאלת הבנה בסוף כל סעיף
8. התאם את הרמה לתלמידי חטיבת ביניים/תיכון

החזר רק את ה-JSON, ללא טקסט נוסף.`;

        const claudeResponse = await callClaudeAPI(prompt, 4000);
        const jsonText = cleanJsonText(claudeResponse);
        const content = JSON.parse(jsonText);

        console.log('✅ Learning content generated successfully');
        console.log(`   Sections: ${content.sections?.length || 0}`);

        res.json({
            success: true,
            content: content
        });

    } catch (error) {
        console.error('❌ Error generating learning content:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate learning content',
            details: error.message
        });
    }
});

// ==================== CHECK QUIZ ANSWER ====================
router.post('/check-quiz', async (req, res) => {
    try {
        const { question, correctAnswer, userAnswer } = req.body;

        console.log('🧪 Checking quiz answer:', {
            question: question?.substring(0, 50),
            correct: correctAnswer,
            user: userAnswer
        });

        const prompt = `בדוק אם התשובה של התלמיד נכונה.

שאלה: ${question}
תשובה נכונה: ${correctAnswer}
תשובה של התלמיד: ${userAnswer}

החזר JSON בפורמט:
{
  "isCorrect": true/false,
  "feedback": "משוב מפורט לתלמיד (2-3 שורות)"
}

אם התשובה נכונה - תן חיזוק חיובי.
אם התשובה לא נכונה - הסבר בעדינות מה השגיאה ואיך לתקן.
התייחס גם לתשובות קרובות או חלקיות.

החזר רק JSON, ללא טקסט נוסף.`;

        const claudeResponse = await callClaudeAPI(prompt, 500);
        const jsonText = cleanJsonText(claudeResponse);
        const result = JSON.parse(jsonText);

        console.log(`   Result: ${result.isCorrect ? '✅ Correct' : '❌ Incorrect'}`);

        res.json(result);

    } catch (error) {
        console.error('❌ Error checking quiz:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check quiz answer',
            details: error.message
        });
    }
});

// ==================== GET PERSONALIZED LEARNING PATH ====================
router.post('/get-path', async (req, res) => {
    try {
        const { userId, weakTopics, strengths } = req.body;

        console.log('🎯 Generating personalized learning path for user:', userId);

        const prompt = `צור מסלול למידה מותאם אישית על סמך:
נקודות חולשה: ${weakTopics?.join(', ') || 'לא ידוע'}
נקודות חוזק: ${strengths?.join(', ') || 'לא ידוע'}

צור JSON בפורמט:
{
  "recommendedTopics": [
    {
      "topicName": "שם הנושא",
      "reason": "למה חשוב ללמוד אותו עכשיו",
      "estimatedTime": "זמן משוער בדקות",
      "difficulty": "קל/בינוני/קשה",
      "prerequisites": ["נושא 1", "נושא 2"]
    }
  ],
  "learningTips": [
    "טיפ 1",
    "טיפ 2",
    "טיפ 3"
  ],
  "weeklyGoal": "מטרה לשבוע הקרוב"
}

המלצות:
1. התחל מנושאים יסודיים שחסרים
2. התקדם בהדרגה
3. קשר בין נושאים
4. תן טיפים מעשיים

החזר רק JSON.`;

        const claudeResponse = await callClaudeAPI(prompt, 2000);
        const jsonText = cleanJsonText(claudeResponse);
        const learningPath = JSON.parse(jsonText);

        console.log('✅ Learning path generated');

        res.json({
            success: true,
            path: learningPath
        });

    } catch (error) {
        console.error('❌ Error generating learning path:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate learning path',
            details: error.message
        });
    }
});

export default router;
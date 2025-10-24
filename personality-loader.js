// personality-loader.js - WITH CLEAR QUESTION PROMPTS
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PersonalityLoader {
    constructor() {
        this.personalities = new Map();
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        try {
            const xlsxPath = path.join(__dirname, 'characters.xlsx');

            if (!fs.existsSync(xlsxPath)) {
                console.warn('⚠️ characters.xlsx not found, using defaults');
                this.loadDefaults();
                this.initialized = true;
                return;
            }

            const workbook = XLSX.readFile(xlsxPath);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(sheet);

            data.forEach(row => {
                if (row['שם']) {
                    this.personalities.set(row['שם'], {
                        name: row['שם'],
                        personality: row['אישיות'] || 'חברותי ותומך',
                        style: row['סגנון'] || 'ברור ופשוט',
                        catchphrase: row['משפט מזהה'] || ''
                    });
                }
            });

            console.log(`✅ Loaded ${this.personalities.size} personalities from Excel`);
            this.initialized = true;

        } catch (error) {
            console.error('❌ Error loading personalities:', error);
            this.loadDefaults();
            this.initialized = true;
        }
    }

    loadDefaults() {
        this.personalities.set('נקסון', {
            name: 'נקסון',
            personality: 'מורה מעודד ומחזק, אוהב לראות התקדמות',
            style: 'הסברים ברורים עם דוגמאות',
            catchphrase: 'אתה יכול!'
        });
        console.log('✅ Loaded default personality: נקסון');
    }

    getPersonality(name = 'נקסון') {
        return this.personalities.get(name) || this.personalities.get('נקסון');
    }

    buildQuestionPrompt(topicName, difficulty, teacherName, subtopic = null) {
        const p = this.getPersonality(teacherName);

        let subtopicText = '';
        if (subtopic) {
            subtopicText = `
תת-נושא ספציפי: ${subtopic}
צור שאלה שמתמקדת בדיוק בתת-נושא הזה.`;
        }

        return `אתה ${p.name}, מורה למתמטיקה ${p.personality}.
סגנון ההוראה שלך: ${p.style}
${p.catchphrase ? `המשפט המזהה שלך: "${p.catchphrase}"` : ''}

צור שאלה בנושא: ${topicName}
רמת קושי: ${difficulty}${subtopicText}

חוקים חשובים ליצירת שאלה:
1. השאלה חייבת להיות מלאה, ברורה, וספציפית
2. התחל את השאלה בפועל ברור: "חשב:", "פתור:", "מצא:", "הוכח:"
3. אל תשאיר חלקים חסרים או לא ברורים
4. כלול את כל המספרים והנתונים הדרושים
5. התשובה הנכונה חייבת להיות מדויקת ומספרית (לא "תלוי" או "מחושב")

דוגמאות לשאלות טובות:
✅ "חשב: מהו השורש הריבועי של 144?"
✅ "פתור את המשוואה: x² = 16"
✅ "מצא את שטח משולש עם בסיס 8 ס"מ וגובה 5 ס"מ"

דוגמאות לשאלות לא טובות (אל תיצור כאלה!):
❌ "144 ובחזקת 2" (לא ברור מה לעשות)
❌ "חשב את..." (חסר המשך)
❌ "מהו x?" (חסר מידע)

החזר JSON בפורמט:
{
    "question": "השאלה המלאה והברורה",
    "correctAnswer": "התשובה המדויקת",
    "hints": ["רמז 1", "רמז 2", "רמז 3"],
    "explanation": "הסבר קצר על איך לפתור"
}

חשוב: וודא שהשאלה מתחילה בפועל ברור ומכילה את כל המידע!`;
    }

    buildVerificationPrompt(question, userAnswer, correctAnswer) {
        return `בדוק את התשובה הבאה:

שאלה: ${question}
תשובת התלמיד: ${userAnswer}
תשובה נכונה: ${correctAnswer}

בדוק האם התשובה נכונה, תוך התחשבות ב:
1. שוני בפורמט (למשל: "+-4" זהה ל-"±4" זהה ל-"x=±4")
2. שקילות מתמטית (למשל: "4 ו--4" זהה ל-"±4")
3. תשובה חלקית - האם התלמיד מצא חלק מהפתרונות אבל לא הכל?

החזר JSON בפורמט:
{
    "isCorrect": true/false,
    "isPartial": true/false,
    "confidence": 0-100,
    "feedback": "משוב קצר",
    "explanation": "הסבר מפורט",
    "whatCorrect": "מה התלמיד מצא נכון (אם חלקי)",
    "whatMissing": "מה חסר (אם חלקי)"
}

אם התשובה חלקית נכונה, סמן isPartial=true והסבר מה נכון ומה חסר.`;
    }

    buildHintPrompt(question, currentHintIndex) {
        const hintLevels = [
            'רמז עדין שמכוון לכיוון הנכון',
            'רמז יותר ישיר על השלב הראשון',
            'רמז ספציפי עם דוגמה דומה',
            'כמעט את כל הפתרון'
        ];

        return `תן רמז ${currentHintIndex + 1} לשאלה: ${question}

סוג הרמז: ${hintLevels[currentHintIndex] || hintLevels[hintLevels.length - 1]}

החזר רק את הרמז כטקסט, בלי JSON.
הרמז צריך להיות ${currentHintIndex === 0 ? 'עדין' : currentHintIndex === 3 ? 'מפורט מאוד' : 'מועיל'}.`;
    }
}

export const personalityLoader = new PersonalityLoader();
export default personalityLoader;
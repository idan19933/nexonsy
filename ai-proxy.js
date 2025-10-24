// server/ai-proxy.js - SMART TOPIC-BASED QUESTION GENERATION
import { formatMathAnswer, compareMathExpressions } from './utils/mathFormatter.js';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import personalitySystem from './services/personalityLoader.js';
import questionHistoryManager from './services/questionHistory.js';
import SVGGenerator from './services/svgGenerator.js';
import { bucket } from './config/firebase-admin.js';
import nexonRoutes from './routes/nexonRoutes.js';
import notebookService from './services/notebookService.js';
import notebookRoutes from './routes/notebookRoutes.js';
import userRoutes from './routes/userRoutes.js';
import curriculumRoutes from './routes/curriculumRoutes.js';
import learningRoutes from './routes/learningRoutes.js';


import ISRAELI_CURRICULUM, {
    getGradeConfig,
    getReformNotes,
    getExamInfo,
    getClusters,
    getPedagogicalNote,
    CURRICULUM_METADATA
} from './config/israeliCurriculum.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ==================== MULTER CONFIGURATION ====================
// ==================== MULTER CONFIGURATION - ENHANCED ====================
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        console.log('📁 File upload attempt:');
        console.log('   Original name:', file.originalname);
        console.log('   MIME type:', file.mimetype);

        // Check if it's an Excel file
        const isExcel = file.originalname.toLowerCase().endsWith('.xlsx') ||
            file.originalname.toLowerCase().endsWith('.xls');

        const excelMimeTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'application/octet-stream',
            'application/zip'
        ];

        // Check if it's an image file
        const isImage = file.mimetype.startsWith('image/');

        const imageMimeTypes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
            'image/gif'
        ];

        const validExcel = isExcel || excelMimeTypes.includes(file.mimetype);
        const validImage = isImage || imageMimeTypes.includes(file.mimetype);

        if (validExcel || validImage) {
            console.log('   ✅ File accepted');
            cb(null, true);
        } else {
            console.log('   ❌ File rejected');
            cb(new Error('Only Excel and Image files allowed!'), false);
        }
    }
});

// ==================== HELPER: CLEAN JSON ====================
// ==================== HELPER: CLEAN JSON - ENHANCED ====================
function cleanJsonText(rawText) {
    let jsonText = rawText.trim();

    // Remove markdown code blocks
    if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
    } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```\n?/g, '');
    }

    // Find JSON boundaries
    const jsonStart = jsonText.indexOf('{');
    const jsonEnd = jsonText.lastIndexOf('}') + 1;

    if (jsonStart !== -1 && jsonEnd > jsonStart) {
        jsonText = jsonText.substring(jsonStart, jsonEnd);
    }

    // 🔥 FIX 1: Remove control characters EXCEPT newlines in specific contexts
    jsonText = jsonText
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, '');

    // 🔥 FIX 2: Fix newlines inside string values
    // This regex finds strings and replaces \n with \\n inside them
    jsonText = jsonText.replace(
        /"([^"\\]|\\.)*"/g,
        match => match.replace(/\n/g, '\\n').replace(/\r/g, '\\r')
    );

    // 🔥 FIX 3: Fix common JSON syntax errors
    jsonText = jsonText
        // Fix trailing commas before } or ]
        .replace(/,(\s*[}\]])/g, '$1')
        // Fix missing commas between properties (common Claude error)
        .replace(/("\s*:\s*"[^"]*")\s*("\w+"\s*:)/g, '$1,$2')
        .replace(/("\s*:\s*\d+)\s*("\w+"\s*:)/g, '$1,$2')
        .replace(/("\s*:\s*true|false)\s*("\w+"\s*:)/g, '$1,$2')
        // Fix unescaped quotes in Hebrew text
        .replace(/:\\s*"([^"]*?)"([^,}\]]*?)"/g, (match, p1, p2) => {
            if (p2.includes('"')) {
                return `: "${p1}\\"${p2}"`;
            }
            return match;
        });

    // 🔥 FIX 4: Validate and repair structure
    try {
        // Try to parse - if it works, return as-is
        JSON.parse(jsonText);
        return jsonText;
    } catch (e) {
        console.log('⚠️ JSON still invalid, attempting deep repair...');
        console.log('   Error:', e.message);
        console.log('   Position:', e.message.match(/position (\d+)/)?.[1]);

        // Log the problematic area
        const errorPos = parseInt(e.message.match(/position (\d+)/)?.[1] || '0');
        if (errorPos > 0) {
            const start = Math.max(0, errorPos - 50);
            const end = Math.min(jsonText.length, errorPos + 50);
            console.log('   Context:', jsonText.substring(start, end));
        }

        // Last resort: Try to fix specific common patterns
        jsonText = jsonText
            // Fix Hebrew quotes that break JSON
            .replace(/״/g, '\\"')
            .replace(/׳/g, "'")
            // Fix double quotes in values
            .replace(/"([^"]*)"([^"]*?)"/g, (match, p1, p2) => {
                if (p2.includes(':') || p2.includes(',') || p2.includes('}')) {
                    return `"${p1}"${p2}`;
                }
                return `"${p1}${p2.replace(/"/g, '\\"')}"`;
            });

        return jsonText;
    }
}

// ==================== TOPIC CLASSIFICATION SYSTEM ====================
function classifyTopic(topicName, subtopicName) {
    const topic = String(topicName || '').toLowerCase();
    const subtopic = String(subtopicName || '').toLowerCase();

    const isPureGeometry = (
        (topic.includes('גאומטריה') || topic.includes('geometry')) &&
        (subtopic.includes('נקודות') || subtopic.includes('קווים') ||
            subtopic.includes('מישורים') || subtopic.includes('points') ||
            subtopic.includes('lines') || subtopic.includes('planes'))
    );

    const isAppliedGeometry = (
        (topic.includes('גאומטריה') || topic.includes('geometry')) &&
        (subtopic.includes('משולש') || subtopic.includes('ריבוע') ||
            subtopic.includes('מעגל') || subtopic.includes('שטח') ||
            subtopic.includes('היקף') || subtopic.includes('triangle') ||
            subtopic.includes('rectangle') || subtopic.includes('circle') ||
            subtopic.includes('area') || subtopic.includes('perimeter'))
    );

    const isStatistics = (
        topic.includes('סטטיסטיקה') || topic.includes('statistics') ||
        topic.includes('גרפים') || topic.includes('graphs') ||
        subtopic.includes('פיזור') || subtopic.includes('scatter') ||
        subtopic.includes('רבעון') || subtopic.includes('quartile')
    );

    const isAlgebra = (
        topic.includes('אלגברה') || topic.includes('algebra') ||
        subtopic.includes('משוואות') || subtopic.includes('equations')
    );

    return {
        isPureGeometry,
        isAppliedGeometry,
        isStatistics,
        isAlgebra,
        allowsRealWorld: !isPureGeometry,
        requiresAbstract: isPureGeometry,
        requiresData: isStatistics
    };
}

// ==================== CURRICULUM-AWARE CONTEXT BUILDER ====================
function buildCurriculumContext(gradeId, topic, subtopic) {
    const gradeConfig = getGradeConfig(gradeId);
    if (!gradeConfig) return '';

    let context = `\n📚 CURRICULUM CONTEXT (תשפ"ה Reform):\n`;
    context += `Grade: ${gradeConfig.name} (${gradeConfig.nameEn})\n`;

    if (gradeConfig.implementationYear) {
        context += `Reform Year: ${gradeConfig.implementationYear}\n`;
    }

    const reformNotes = getReformNotes(gradeId);
    if (reformNotes) {
        if (reformNotes.emphasis) {
            context += `\n🎯 Pedagogical Emphasis:\n`;
            reformNotes.emphasis.forEach(e => context += `  - ${e}\n`);
        }
        if (reformNotes.removed) {
            context += `\n❌ Excluded Topics:\n`;
            reformNotes.removed.forEach(r => context += `  - ${r}\n`);
        }
    }

    const clusters = getClusters(gradeId);
    if (clusters) {
        context += `\n🎨 Learning Clusters:\n`;
        clusters.forEach(c => {
            context += `  - ${c.name}: ${c.description}\n`;
        });
    }

    const topicId = topic?.id || '';
    if (topicId) {
        const pedNote = getPedagogicalNote(gradeId, topicId);
        if (pedNote) {
            context += `\n📝 Topic Note: ${pedNote}\n`;
        }
    }

    if (subtopic) {
        const subtopicName = subtopic.name || '';
        if (subtopicName) {
            context += `\n🔍 Specific Subtopic: ${subtopicName}\n`;
            if (subtopic.note) {
                context += `   Note: ${subtopic.note}\n`;
            }
        }
    }

    context += `\n`;
    return context;
}

// ==================== ENHANCED SYSTEM PROMPT ====================
function buildEnhancedSystemPrompt(studentProfile, gradeId, topic, subtopic) {
    const { grade, mathFeeling } = studentProfile || {};

    let prompt = '';

    // Personality
    if (personalitySystem.loaded) {
        const personality = personalitySystem.data.corePersonality;
        prompt += `אתה ${personality.teacher_name}, ${personality.description}.\n`;
        prompt += `${personality.teaching_approach}\n\n`;
    } else {
        prompt += `אתה נקסון, מורה דיגיטלי למתמטיקה.\n\n`;
    }

    // Student context
    if (grade) {
        prompt += `התלמיד בכיתה ${grade}.\n`;
    }

    if (mathFeeling === 'struggle') {
        prompt += `התלמיד מתקשה - היה סבלני מאוד, תן הסברים צעד-צעד.\n`;
    } else if (mathFeeling === 'love') {
        prompt += `התלמיד אוהב מתמטיקה - אתגר אותו!\n`;
    }

    // 🔥 CRITICAL: Core principles
    prompt += `\n🎯 עקרונות חובה:\n`;
    prompt += `✓ יצור שאלות ייחודיות ומגוונות\n`;
    prompt += `✓ עקוב אחר תכנית הלימודים הישראלית (תשפ"ה)\n`;
    prompt += `✓ השתמש בעברית ברורה וטבעית\n`;
    prompt += `✓ החזר JSON תקין בלבד\n`;
    prompt += `✓ אל תחזור על שאלות קודמות\n`;
    prompt += `✓ כל שאלה = חווייה חדשה\n\n`;

    return prompt;
}

// ==================== VALIDATE QUESTION HAS RAW DATA ====================
function validateQuestionHasRawData(parsed, topic, subtopic) {
    const questionText = parsed?.question || '';

    if (!questionText || typeof questionText !== 'string') {
        return { valid: true };
    }

    const graphTopics = [
        'פונקציות', 'גרפים', 'Functions', 'Graphs',
        'סטטיסטיקה', 'Statistics', 'נתונים', 'Data',
        'פיזור', 'Scatter', 'רבעונים', 'Quartiles',
        'תחום בין-רבעוני', 'IQR', 'היסטוגרמה', 'Histogram'
    ];

    const topicName = String(topic?.name || '');
    const topicNameEn = String(topic?.nameEn || '');
    const subtopicName = String(subtopic?.name || '');
    const subtopicNameEn = String(subtopic?.nameEn || '');

    const needsGraph = graphTopics.some(t =>
        topicName.includes(t) ||
        topicNameEn.includes(t) ||
        subtopicName.includes(t) ||
        subtopicNameEn.includes(t)
    );

    if (!needsGraph) {
        return { valid: true };
    }

    console.log('🔍 Validating question has raw data...');

    const forbiddenPatterns = [
        /ממוצע.*הוא/,
        /ממוצע.*הכללי/,
        /נע בין.*\d+-\d+/,
        /גרף.*מראה/,
        /גרף.*מציג/,
        /הגרף.*שלו.*מציג/,
        /הגרף.*שלפניכם/,
        /בגרף.*שלפניכם/,
        /גרף.*הפיזור.*שלפניכם/,
        /תרשים.*מציג/,
        /טבלה.*מציגה/,
        /הקשר בין/,
        /מתואר.*גרף/,
        /מוצגות.*בגרף/,
        /מופיעים.*בגרף/,
        /התוצאות.*מוצגות/,
        /הנתונים.*מוצגים/,
        /נתונים.*אלה.*מוצגים/,
        /מוצגים.*בגרף.*פיזור/,
        /נתוני.*הסקר.*מראים/,
        /נתונים.*אלה/i,
        /להלן.*הנתונים/i,
        /בגרף.*הבא/,
        /בגרף.*הפיזור.*הבא/,
        /שם.*התלמיד.*\|/,
        /\d+-\d+\s*\|/,
        /\d+\+\s*\|/,
        /טבלה.*הבאה/,
        /\|.*\|.*\|/,
        /[א-ת]+\s*\d*\s*:\s*\d+\s*שעות/i,
        /תלמיד\s*\d+\s*:\s*\d+/i,
        /[א-ת]+:\s*\d+\s*שעות,\s*[א-ת]+:\s*\d+\s*שעות/
    ];

    const hasForbiddenPattern = forbiddenPatterns.some(pattern =>
        pattern.test(questionText)
    );

    if (hasForbiddenPattern) {
        console.log('❌ Question has FORBIDDEN pattern');
        return {
            valid: false,
            reason: 'Contains forbidden patterns'
        };
    }

    const hasTwoLabeledLists = /\(x\)\s*:\s*[0-9,\s]+/i.test(questionText) &&
        /\(y\)\s*:\s*[0-9,\s]+/i.test(questionText);

    if (hasTwoLabeledLists) {
        console.log('✅ Question has TWO labeled lists');
        return { valid: true };
    }

    const commaNumbers = questionText.match(/\d+(?:\.\d+)?(?:\s*,\s*\d+(?:\.\d+)?){9,}/g);

    if (commaNumbers && commaNumbers.length > 0) {
        console.log('✅ Question has comma-separated numbers');
        return { valid: true };
    }

    console.log('❌ Question does NOT have proper raw data');
    return {
        valid: false,
        reason: 'Missing proper data format'
    };
}

// ==================== FORCE REWRITE ====================
function forceRewriteGraphDescription(parsed, topic, subtopic) {
    const questionText = parsed?.question || '';

    if (!questionText || typeof questionText !== 'string') {
        return parsed;
    }

    const forbiddenPatterns = [
        /הגרף.*מציג/i,
        /התרשים.*מציג/i,
        /הגרף.*מראה/i,
        /התוצאות.*מוצגות/i,
        /הנתונים.*מוצגים/i,
        /נתונים.*אלה.*מוצגים/i,
        /נתוני.*הסקר.*מראים/i,
        /נתונים.*אלה/i,
        /להלן.*הנתונים/i,
        /הגרף.*שלו.*מציג/i,
        /מוצגים.*בגרף.*פיזור/i
    ];

    const hasGraphDescription = forbiddenPatterns.some(pattern => pattern.test(questionText));

    const anyLabelPattern = /([א-ת]+\s*\d*)\s*:\s*(\d+)\s*שעות/g;
    const anyLabelMatches = [...questionText.matchAll(anyLabelPattern)];
    const hasLabelValueFormat = anyLabelMatches.length >= 3;

    if (!hasGraphDescription && !hasLabelValueFormat) {
        return parsed;
    }

    console.log('🚨 FORCING COMPLETE REWRITE');

    const questionLower = questionText.toLowerCase();
    const isSport = questionLower.includes('ספורט') || questionLower.includes('חוג');
    const isGrades = questionLower.includes('ציון');

    const numPoints = 20 + Math.floor(Math.random() * 4);
    const xValues = [];
    const yValues = [];

    let rewrittenQuestion = '';
    let xLabel = 'X';
    let yLabel = 'Y';

    if (isSport && isGrades) {
        for (let i = 0; i < numPoints; i++) {
            xValues.push(Math.floor(1 + Math.random() * 7));
            yValues.push(Math.floor(65 + Math.random() * 30));
        }

        rewrittenQuestion = `נאספו נתונים על ${numPoints} תלמידים - מספר שעות ספורט שבועיות והציון במתמטיקה:

שעות ספורט שבועיות (x): ${xValues.join(', ')}
ציון במתמטיקה (y): ${yValues.join(', ')}

צרו גרף פיזור והסבירו מה ניתן ללמוד על הקשר בין המשתנים.`;

        xLabel = 'שעות ספורט';
        yLabel = 'ציון במתמטיקה';

    } else {
        for (let i = 0; i < numPoints; i++) {
            xValues.push(Math.floor(10 + Math.random() * 40));
            yValues.push(Math.floor(50 + Math.random() * 50));
        }

        rewrittenQuestion = `נתונות ${numPoints} נקודות עם שני משתנים:

משתנה X: ${xValues.join(', ')}
משתנה Y: ${yValues.join(', ')}

צרו גרף פיזור וקבעו את סוג המתאם בין המשתנים.`;

        xLabel = 'X';
        yLabel = 'Y';
    }

    const points = xValues.map((x, idx) => ({
        x: x,
        y: yValues[idx],
        label: `נקודה ${idx + 1}`
    }));

    const visualData = {
        type: 'scatter',
        points: points,
        xRange: [Math.min(...xValues) - 2, Math.max(...xValues) + 2],
        yRange: [Math.min(...yValues) - 2, Math.max(...yValues) + 2],
        color: '#9333ea',
        label: 'גרף פיזור',
        xLabel: xLabel,
        yLabel: yLabel
    };

    parsed.question = rewrittenQuestion;
    parsed.visualData = visualData;

    console.log('✅ Question REWRITTEN');
    return parsed;
}

// ==================== VISUAL DATA EXTRACTION ====================
function ensureVisualDataForGraphQuestions(parsed, topic, subtopic) {
    try {
        const questionText = parsed?.question || '';

        if (!questionText || typeof questionText !== 'string') {
            console.log('⚠️ Invalid question text');
            return parsed;
        }

        console.log('\n🔥🔥🔥 EXTRACTION V2 STARTING 🔥🔥🔥');
        console.log('Question (first 200):', questionText.substring(0, 200));
        console.log('AI visualData:', parsed.visualData ? 'EXISTS' : 'NULL');

        if (parsed.visualData && (parsed.visualData.data?.length > 0 || parsed.visualData.points?.length > 0)) {
            console.log('✅ visualData already complete');
            return parsed;
        }

        console.log('\n🔎 METHOD 1: X-Y labeled lists');

        const patterns = [
            { x: /([^\n:]+?)\s*\(x\)\s*:\s*([0-9,\s.]+)/i, y: /([^\n:]+?)\s*\(y\)\s*:\s*([0-9,\s.]+)/i },
            { x: /([^\n:]+?)\s*\(x\)\s*\:\s*([0-9,\s.]+)/i, y: /([^\n:]+?)\s*\(y\)\s*\:\s*([0-9,\s.]+)/i },
            { x: /([א-ת\s]+)\(x\)\s*:\s*([0-9,\s.]+)/i, y: /([א-ת\s]+)\(y\)\s*:\s*([0-9,\s.]+)/i }
        ];

        for (let i = 0; i < patterns.length; i++) {
            const xMatch = questionText.match(patterns[i].x);
            const yMatch = questionText.match(patterns[i].y);

            if (xMatch && yMatch) {
                console.log(`✓ Pattern ${i + 1} matched!`);

                const xLabel = xMatch[1].trim();
                const yLabel = yMatch[1].trim();

                const xValues = xMatch[2]
                    .split(/[,،\s]+/)
                    .map(n => parseFloat(n.trim()))
                    .filter(n => !isNaN(n) && isFinite(n));

                const yValues = yMatch[2]
                    .split(/[,،\s]+/)
                    .map(n => parseFloat(n.trim()))
                    .filter(n => !isNaN(n) && isFinite(n));

                console.log(`   X: ${xValues.length} values →`, xValues.slice(0, 5));
                console.log(`   Y: ${yValues.length} values →`, yValues.slice(0, 5));

                if (xValues.length >= 4 && yValues.length >= 4) {
                    const minLength = Math.min(xValues.length, yValues.length);
                    const points = xValues.slice(0, minLength).map((x, idx) => ({
                        x: x,
                        y: yValues[idx],
                        label: `נקודה ${idx + 1}`
                    }));

                    const visualData = {
                        type: 'scatter',
                        points: points,
                        xRange: [Math.min(...xValues.slice(0, minLength)) - 1, Math.max(...xValues.slice(0, minLength)) + 1],
                        yRange: [Math.min(...yValues.slice(0, minLength)) - 1, Math.max(...yValues.slice(0, minLength)) + 1],
                        color: '#9333ea',
                        label: 'גרף פיזור',
                        xLabel: xLabel,
                        yLabel: yLabel
                    };

                    console.log('✅✅✅ SUCCESS! Scatter plot created');
                    console.log('🔥🔥🔥 EXTRACTION COMPLETE 🔥🔥🔥\n');
                    return { ...parsed, visualData };
                }
            }
        }

        console.log('⚠️ Could not extract any valid data');
        console.log('🔥🔥🔥 EXTRACTION FAILED 🔥🔥🔥\n');

    } catch (error) {
        console.error('❌ EXTRACTION ERROR:', error.message);
    }

    return parsed;
}

// ==================== DETECT GEOMETRY QUESTIONS ====================
// ==================== DETECT GEOMETRY QUESTIONS - FIXED ====================
// ==================== DETECT GEOMETRY QUESTIONS - FIXED V2 ====================
// ==================== DETECT GEOMETRY QUESTIONS - FIXED V3 WITH HEIGHT FILTERING ====================
// ==================== DETECT GEOMETRY QUESTIONS - COMPLETE FIXED VERSION ====================
function detectGeometryVisual(parsed, topic, subtopic) {
    const questionText = (parsed?.question || '').toLowerCase();

    if (!questionText || typeof questionText !== 'string') {
        return parsed;
    }

    const geometryKeywords = [
        'משולש', 'triangle', 'ריבוע', 'square', 'מלבן', 'rectangle',
        'עיגול', 'circle', 'מעגל', 'זווית', 'angle', 'צלע', 'side',
        'ניצב', 'right', 'שווה צלעות', 'equilateral', 'היקף', 'perimeter',
        'שטח', 'area', 'רדיוס', 'radius', 'קוטר', 'diameter',
        'שווה שוקיים', 'isosceles', 'שוקיים', 'שווה-שוקיים'
    ];

    const isGeometry = geometryKeywords.some(keyword => questionText.includes(keyword));
    if (!isGeometry) return parsed;

    console.log('🔺 Geometry question detected');
    console.log('   Question:', parsed.question);

    // 🔥 STEP 1: Extract and exclude angles
    const anglePatterns = [
        /זווית.*?(\d+)°/gi,
        /זווית.*?(\d+)\s*מעלות/gi,
        /(\d+)°/g,
        /angle.*?(\d+)/gi
    ];

    const angleNumbers = new Set();
    anglePatterns.forEach(pattern => {
        let match;
        const regex = new RegExp(pattern);
        while ((match = regex.exec(parsed.question)) !== null) {
            angleNumbers.add(parseFloat(match[1]));
        }
    });
    console.log('   🚫 Angles to exclude:', Array.from(angleNumbers));

    // 🔥 STEP 2: Extract and exclude height
    const heightPatterns = [
        /גובה.*?(\d+)/gi,
        /height.*?(\d+)/gi
    ];

    const heightNumbers = new Set();
    heightPatterns.forEach(pattern => {
        let match;
        const regex = new RegExp(pattern);
        while ((match = regex.exec(parsed.question)) !== null) {
            heightNumbers.add(parseFloat(match[1]));
        }
    });
    console.log('   🚫 Heights to exclude:', Array.from(heightNumbers));

    // 🔥 STEP 3: Extract ALL numbers, then filter out angles and heights
    const allNumbers = (parsed.question || '')
        .match(/\d+(\.\d+)?/g)
        ?.map(n => parseFloat(n))
        .filter(n => !angleNumbers.has(n) && !heightNumbers.has(n) && n > 0 && n < 1000) || [];

    console.log('   ✅ Valid numbers (after filtering):', allNumbers);

    let visualData = null;

    // ==================== TRIANGLE DETECTION ====================
    if (questionText.includes('משולש') || questionText.includes('triangle')) {
        console.log('   → Triangle detected');

        // Detect triangle type
        const isRight = questionText.includes('ניצב') || questionText.includes('right') ||
            questionText.includes('ישר-זווית') || questionText.includes('ישר זווית');
        const isEquilateral = questionText.includes('שווה צלעות') || questionText.includes('equilateral');
        const isIsosceles = questionText.includes('שווה שוקיים') || questionText.includes('שווה-שוקיים') ||
            questionText.includes('isosceles') || questionText.includes('שוקיים');

        let type = 'scalene';
        if (isRight) type = 'right';
        else if (isEquilateral) type = 'equilateral';
        else if (isIsosceles) type = 'isosceles';

        console.log('   Triangle type:', type);

        let sideA, sideB, sideC;

        // 🔥 ENHANCED ISOSCELES EXTRACTION
        if (isIsosceles) {
            console.log('   → Processing ISOSCELES triangle');

            // 🔥 METHOD 1: Look for explicit "בסיס" and "שוקיים" keywords
            const basePatterns = [
                /(?:אורך\s+ה?)?בסיס(?:\s+הוא)?\s+(\d+)/i,
                /בסיס\s+(\d+)/i,
                /base\s+(\d+)/i
            ];

            const legPatterns = [
                /(?:אורך\s+ה?)?שוקיים(?:\s+הוא)?\s+(\d+)/i,
                /שוקיים\s+(\d+)/i,
                /legs?\s+(\d+)/i
            ];

            let base = null;
            let leg = null;

            // Try to find base
            for (const pattern of basePatterns) {
                const match = parsed.question.match(pattern);
                if (match) {
                    base = parseFloat(match[1]);
                    console.log('   ✅ Found BASE from keyword:', base);
                    break;
                }
            }

            // Try to find legs
            for (const pattern of legPatterns) {
                const match = parsed.question.match(pattern);
                if (match) {
                    leg = parseFloat(match[1]);
                    console.log('   ✅ Found LEGS from keyword:', leg);
                    break;
                }
            }

            // 🔥 METHOD 2: Fallback - use position in filtered numbers
            if (!base || !leg) {
                console.log('   → Using fallback method');

                if (allNumbers.length >= 2) {
                    // First number is usually base, second is legs
                    base = allNumbers[0];
                    leg = allNumbers[1];
                    console.log('   ✅ Fallback - Base:', base, 'Legs:', leg);
                } else if (allNumbers.length === 1) {
                    // Only one number - make equilateral
                    base = allNumbers[0];
                    leg = allNumbers[0];
                    console.log('   ⚠️ Only one number - using equilateral');
                } else {
                    // No numbers - use defaults
                    base = 8;
                    leg = 10;
                    console.log('   ⚠️ No numbers found - using defaults');
                }
            }

            // Ensure we have valid numbers
            if (!angleNumbers.has(base) && !heightNumbers.has(base) &&
                !angleNumbers.has(leg) && !heightNumbers.has(leg)) {
                sideA = base;    // Base (BC)
                sideB = leg;     // Left leg (AB)
                sideC = leg;     // Right leg (AC)
                console.log('   ✅ FINAL ISOSCELES - Base:', sideA, 'Legs:', sideB, sideC);
            } else {
                // Validation failed - use defaults
                sideA = 8;
                sideB = 10;
                sideC = 10;
                console.log('   ⚠️ Validation failed - using defaults');
            }
        }
        // EQUILATERAL
        else if (isEquilateral) {
            sideA = allNumbers[0] || 8;
            sideB = sideA;
            sideC = sideA;
            console.log('   ✅ Equilateral - All sides:', sideA);
        }
        // RIGHT TRIANGLE
        else if (isRight) {
            sideA = allNumbers[0] || 3;
            sideB = allNumbers[1] || 4;
            sideC = allNumbers[2] || 5;
            console.log('   ✅ Right triangle - Sides:', sideA, sideB, sideC);
        }
        // SCALENE
        else {
            sideA = allNumbers[0] || 6;
            sideB = allNumbers[1] || 8;
            sideC = allNumbers[2] || 7;
            console.log('   ✅ Scalene - Sides:', sideA, sideB, sideC);
        }

        console.log('   📏 FINAL TRIANGLE - A:', sideA, 'B:', sideB, 'C:', sideC);

        visualData = {
            type: 'svg-triangle',
            svgData: {
                type: type,
                sideA: sideA,
                sideB: sideB,
                sideC: sideC,
                showLabels: true,
                showAngles: questionText.includes('זווית') || questionText.includes('angle')
            }
        };
    }
    // ==================== RECTANGLE ====================
    else if (questionText.includes('מלבן') || questionText.includes('rectangle')) {
        const width = allNumbers[0] || 5;
        const height = allNumbers[1] || 3;
        visualData = {
            type: 'svg-rectangle',
            svgData: { width, height, showLabels: true }
        };
    }
    // ==================== CIRCLE ====================
    else if (questionText.includes('עיגול') || questionText.includes('מעגל') || questionText.includes('circle')) {
        const radius = allNumbers[0] || 5;
        visualData = {
            type: 'svg-circle',
            svgData: { radius, showLabels: true }
        };
    }

    if (visualData) {
        console.log('✅ Visual created:', visualData.type);
        console.log('   📊 Data:', JSON.stringify(visualData.svgData, null, 2));
        parsed.visualData = visualData;
    }

    return parsed;
}

// ==================== HEALTH CHECK ====================
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Nexon AI Server - Smart Topic-Based Questions',
        personalityLoaded: personalitySystem.loaded,
        curriculumLoaded: true,
        questionHistoryActive: true,
        visualGenerationActive: true,
        reformYear: CURRICULUM_METADATA.reformYear,
        firebaseStorage: bucket ? 'available' : 'unavailable'
    });
});

// ==================== 🔥 SMART TOPIC-BASED QUESTION PROMPT ====================
// ==================== 🔥 SMART TOPIC-BASED QUESTION PROMPT ====================
// ==================== 🔥 SMART TOPIC-BASED QUESTION PROMPT ====================
// ==================== 🔥 SMART TOPIC-BASED QUESTION PROMPT - COMPLETE ====================
// ==================== 🔥 COMPLETE buildDynamicQuestionPrompt WITH EXAMPLE FILTERING ====================
function buildDynamicQuestionPrompt(topic, subtopic, difficulty, studentProfile, gradeId) {
    try {
        if (!topic || typeof topic !== 'object') {
            console.error('❌ Invalid topic object:', topic);
            throw new Error('Invalid topic object');
        }

        const topicName = String(topic?.name || 'Unknown Topic');
        const subtopicName = String(subtopic?.name || '');
        const studentGrade = String(studentProfile?.grade || '7');

        console.log('✅ Building prompt - Topic:', topicName, '/ Subtopic:', subtopicName);

        const classification = classifyTopic(topicName, subtopicName);

        // 🔥 FIX 1: START WITH CURRICULUM CONTEXT
        let prompt = buildCurriculumContext(gradeId, topic, subtopic);

        prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        prompt += `🎯 יצירת שאלה חדשה ומקורית\n`;
        prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        prompt += `נושא ראשי: ${topicName}\n`;
        if (subtopicName) {
            prompt += `תת-נושא (זה המוקד העיקרי): ${subtopicName}\n`;
            prompt += `⚠️ השאלה חייבת להיות ישירות על "${subtopicName}"\n`;
        }
        prompt += `רמת קושי: ${difficulty}\n`;
        prompt += `כיתה: ${studentGrade}\n`;
        prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

        // 🔥 FIX 2: SHOW RECENT QUESTIONS PROMINENTLY
        const studentId = studentProfile?.studentId || studentProfile?.name || 'anonymous';
        const topicId = topic?.id || topicName;
        const recentQuestions = questionHistoryManager.getRecentQuestions(studentId, topicId, 10);

        if (recentQuestions && recentQuestions.length > 0) {
            prompt += `🚨 אסור לחזור על שאלות קודמות:\n`;
            prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
            recentQuestions.forEach((q, idx) => {
                const preview = q.question.substring(0, 100).replace(/\n/g, ' ');
                prompt += `${idx + 1}. ${preview}...\n`;
            });
            prompt += `\n⚠️⚠️⚠️ צור משהו שונה לחלוטין:\n`;
            prompt += `- הקשר שונה\n`;
            prompt += `- מספרים שונים\n`;
            prompt += `- זווית גישה שונה\n`;
            prompt += `- נוסח שונה\n`;
            prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        }

        // 🔥 FIX 3: GEOMETRY RULES (if applicable)
        if (classification.isPureGeometry) {
            prompt += `📐 גאומטריה טהורה - חובה:\n`;
            prompt += `✓ התחל ב"נתון/נתונה/נתונים"\n`;
            prompt += `✓ אסור הקשרים מהחיים האמיתיים\n`;
            prompt += `✓ דוגמאות: "נתון מישור α", "נתונות נקודות A, B"\n\n`;
        }

        if (classification.isAppliedGeometry) {
            prompt += `📏 גאומטריה יישומית:\n`;
            prompt += `✓ התחל: "נתון משולש...", "נתון ריבוע..."\n`;
            prompt += `✓ שאל על: שטח, היקף, גובה, צלע\n\n`;

            prompt += `🚨 חוקים למשולשים:\n`;
            prompt += `• משולש שווה-שוקיים: רק בסיס + שוקיים (2 מספרים)\n`;
            prompt += `  ❌ אסור לתת גובה!\n`;
            prompt += `  ✅ "נתון משולש שווה-שוקיים, בסיס 12, שוקיים 15"\n`;
            prompt += `• משולש ישר-זווית: שני ניצבים\n`;
            prompt += `• משולש כללי: בסיס + גובה (מותר)\n\n`;
        }

        // 🔥 FIX 4: FILTER EXAMPLES AGGRESSIVELY
        if (personalitySystem.loaded) {
            const topicGuideline = personalitySystem.getTopicGuideline(topicName);
            if (topicGuideline?.curriculum_requirements) {
                prompt += `📚 דרישות תכנית לימודים:\n${topicGuideline.curriculum_requirements}\n\n`;
            }

            try {
                let examples = personalitySystem.getExamplesForTopic(topicName, difficulty);

                if (examples && examples.length > 0) {
                    // 🔥 AGGRESSIVE FILTERING
                    const isTriangleTopic = topicName.includes('משולש') || topicName.includes('triangle') ||
                        topicName.includes('גאומטריה') || subtopicName.includes('משולש');

                    if (isTriangleTopic) {
                        console.log('   🔍 Filtering triangle examples...');

                        examples = examples.filter(ex => {
                            const q = String(ex?.question || '');
                            if (!q) return false;

                            const isIsosceles = /שווה[- ]?שוקיים|isosceles/i.test(q);
                            if (!isIsosceles) return true;

                            // Reject if mentions height as given
                            const badPatterns = [
                                /אם\s+גובה/i,
                                /וגובה\s+המשולש/i,
                                /גובה\s+המשולש\s+(?:לבסיס\s+)?(?:הוא|הינו)\s+\d+/i,
                                /,\s*גובה\s+\d+/i,
                                /\.\s*גובה\s+\d+/i
                            ];

                            const isBad = badPatterns.some(p => p.test(q));
                            if (isBad) {
                                console.log('   ❌ Filtered:', q.substring(0, 60));
                                return false;
                            }
                            return true;
                        });

                        console.log(`   📊 ${examples.length} examples after filtering`);
                    }

                    // 🔥 ALSO FILTER BY RECENT QUESTIONS
                    if (recentQuestions && recentQuestions.length > 0) {
                        examples = examples.filter(ex => {
                            const exQ = String(ex?.question || '').toLowerCase();
                            return !recentQuestions.some(recent => {
                                const recentQ = recent.question.toLowerCase();
                                // Check for similar context/numbers
                                const exNums = exQ.match(/\d+/g) || [];
                                const recentNums = recentQ.match(/\d+/g) || [];
                                const numOverlap = exNums.filter(n => recentNums.includes(n)).length;
                                return numOverlap > 2; // More than 2 same numbers = too similar
                            });
                        });
                    }

                    if (examples.length > 0) {
                        const shuffled = examples.sort(() => 0.5 - Math.random());
                        const selected = shuffled.slice(0, Math.min(2, examples.length));

                        prompt += `📚 סגנונות לדוגמה (צור משהו שונה!):\n`;
                        selected.forEach((ex, i) => {
                            prompt += `${i + 1}. ${ex.question}\n`;
                        });
                        prompt += `\n⚠️ השאלה שלך חייבת להיות ייחודית לגמרי!\n`;

                        if (isTriangleTopic) {
                            prompt += `\n🚨 למשולש שווה-שוקיים:\n`;
                            prompt += `גם אם אתה רואה דוגמאות ישנות עם "גובה" - אל תחקה!\n`;
                            prompt += `השתמש רק: "בסיס X, שוקיים Y" (2 מספרים)\n`;
                        }
                        prompt += `\n`;
                    } else {
                        console.log('   ⚠️ All examples filtered out - creating fresh');
                    }
                }
            } catch (exampleError) {
                console.error('⚠️ Error loading examples:', exampleError.message);
            }
        }

        // 🔥 FIX 5: ADD VARIATION STRATEGIES
        if (!classification.isPureGeometry) {
            const strategies = [
                'גישה מתמטית טהורה: "נתון..."',
                'סיפור מהחיים: בית ספר, ספורט, קניות',
                'אתגר רב-שלבי',
                'גילוי תבנית',
                'השוואה בין מצבים'
            ];
            const randomStrategy = strategies[Math.floor(Math.random() * strategies.length)];
            prompt += `🎲 אסטרטגיה: ${randomStrategy}\n`;
            prompt += `🔢 השתמש במספרים מעניינים ומגוונים\n\n`;
        }

        // Statistics requirements
        if (classification.isStatistics) {
            prompt += `📊 נתונים סטטיסטיים:\n`;
            prompt += `✅ לפחות 20 נקודות מידע\n`;
            prompt += `✅ פורמט: "משתנה X: 12, 15, 18, 21...\n`;
            prompt += `          משתנה Y: 45, 52, 48, 55..."\n\n`;
        }

        // JSON format
        prompt += `\n🚨 פורמט JSON חובה:\n`;
        prompt += `{\n`;
        prompt += `  "question": "השאלה (ללא שורות חדשות אמיתיות)",\n`;
        prompt += `  "correctAnswer": "התשובה",\n`;
        prompt += `  "hints": ["רמז 1", "רמז 2", "רמז 3"],\n`;
        prompt += `  "explanation": "הסבר"\n`;
        prompt += `}\n`;
        prompt += `• השתמש ב-\\n לשורה חדשה, לא Enter\n`;
        prompt += `• בדוק שאין פסיקים מיותרים\n`;
        prompt += `• החזר רק JSON, ללא טקסט נוסף\n\n`;

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📝 PROMPT READY');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log(prompt);
        return prompt;

    } catch (error) {
        console.error('❌ FATAL ERROR in buildDynamicQuestionPrompt:', error);
        throw new Error(`buildDynamicQuestionPrompt failed: ${error.message}`);
    }
}
// ==================== GENERATE QUESTION ENDPOINT ====================
// ==================== GENERATE QUESTION ENDPOINT WITH RETRY LOGIC ====================
app.post('/api/ai/generate-question', async (req, res) => {
    try {
        const { topic, subtopic, difficulty, studentProfile } = req.body;

        if (!topic || !topic.name) {
            return res.status(400).json({
                success: false,
                error: 'Invalid topic object'
            });
        }

        if (!studentProfile || !studentProfile.grade) {
            return res.status(400).json({
                success: false,
                error: 'Invalid student profile'
            });
        }

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📝 SMART QUESTION GENERATION');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('   Topic:', topic.name);
        console.log('   Subtopic:', subtopic?.name || 'General');

        const gradeId = `grade_${studentProfile.grade}`;
        const studentId = studentProfile.studentId || studentProfile.name || 'anonymous';

        let prompt = buildDynamicQuestionPrompt(topic, subtopic, difficulty, studentProfile, gradeId);
        const systemPrompt = buildEnhancedSystemPrompt(studentProfile, gradeId, topic, subtopic);

        let attempts = 0;
        let parsed;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
            attempts++;

            if (process.env.ANTHROPIC_API_KEY) {
                console.log(`   🔄 Attempt ${attempts}/${maxAttempts}`);

                // 🔥 RETRY LOGIC WITH EXPONENTIAL BACKOFF
                let apiSuccess = false;
                let lastError = null;

                for (let retryAttempt = 0; retryAttempt < 3; retryAttempt++) {
                    try {
                        // Wait before retry (exponential backoff: 2s, 4s, 8s)
                        if (retryAttempt > 0) {
                            const waitTime = Math.pow(2, retryAttempt) * 1000;
                            console.log(`   ⏳ API Retry ${retryAttempt}/3 - waiting ${waitTime}ms...`);
                            await new Promise(resolve => setTimeout(resolve, waitTime));
                        }

                        const response = await fetch('https://api.anthropic.com/v1/messages', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-api-key': process.env.ANTHROPIC_API_KEY,
                                'anthropic-version': '2023-06-01'
                            },
                            body: JSON.stringify({
                                model: 'claude-3-5-haiku-20241022',
                                max_tokens: 3000,
                                temperature: 0.8 + (attempts * 0.1),
                                system: systemPrompt,
                                messages: [{ role: 'user', content: prompt }]
                            })
                        });

                        const data = await response.json();

                        // Handle 529 Overloaded error
                        if (response.status === 529) {
                            lastError = new Error('Overloaded');
                            console.log(`   ⚠️ API Overloaded (retry ${retryAttempt + 1}/3)`);
                            continue; // Try again
                        }

                        // Handle other errors
                        if (!response.ok) {
                            lastError = new Error(data.error?.message || `API error: ${response.status}`);
                            console.log(`   ❌ API Error: ${lastError.message}`);

                            // If it's a rate limit or server error, retry
                            if (response.status >= 500 || response.status === 429) {
                                continue;
                            }

                            // For other errors (like auth), don't retry
                            throw lastError;
                        }

                        // Success! Parse the response
                        const rawText = data.content[0].text;
                        const jsonText = cleanJsonText(rawText);
                        parsed = JSON.parse(jsonText);

                        console.log('   ✅ API call successful');
                        apiSuccess = true;
                        break; // Exit retry loop

                    } catch (error) {
                        lastError = error;
                        console.error(`   ❌ API attempt ${retryAttempt + 1} failed:`, error.message);

                        // If it's the last retry attempt, throw
                        if (retryAttempt === 2) {
                            throw error;
                        }

                        // Otherwise, continue to next retry
                    }
                }

                // If all retries failed, throw the last error
                if (!apiSuccess) {
                    throw lastError || new Error('All API retry attempts failed');
                }

                console.log('   ✅ Parsed successfully');

                // Check for similarity with recent questions
                const topicId = topic.id || topic.name;
                const recentQuestions = questionHistoryManager.getRecentQuestions(studentId, topicId, 5);
                const isSimilar = questionHistoryManager.isSimilar(parsed.question, recentQuestions);

                if (isSimilar && attempts < maxAttempts) {
                    console.log(`   ⚠️ Too similar, retrying...`);
                    prompt += `\n\n🚨 TOO SIMILAR! Create MORE DIFFERENT!\n`;
                    continue;
                } else {
                    console.log('   ✅ Question is unique');
                    break;
                }
            } else {
                throw new Error('No AI API configured');
            }
        }

        // Validate and process the question
        const validation = validateQuestionHasRawData(parsed, topic, subtopic);
        if (!validation.valid) {
            console.log('   ⚠️ Validation failed - rewriting');
            parsed = forceRewriteGraphDescription(parsed, topic, subtopic);
        }

        parsed = ensureVisualDataForGraphQuestions(parsed, topic, subtopic);
        parsed = detectGeometryVisual(parsed, topic, subtopic);

        if (parsed.visualData?.type?.startsWith('svg-')) {
            const svgType = parsed.visualData.type.replace('svg-', '');
            let svg = null;

            try {
                if (svgType === 'triangle') {
                    svg = SVGGenerator.generateTriangle(parsed.visualData.svgData);
                } else if (svgType === 'rectangle') {
                    svg = SVGGenerator.generateRectangle(parsed.visualData.svgData);
                } else if (svgType === 'circle') {
                    svg = SVGGenerator.generateCircle(parsed.visualData.svgData);
                }

                if (svg) {
                    parsed.visualData.svg = svg;
                    console.log('   ✅ SVG generated:', svgType);
                }
            } catch (svgError) {
                console.error('   ❌ SVG error:', svgError);
            }
        }

        const topicId = topic.id || topic.name;
        questionHistoryManager.addQuestion(studentId, topicId, {
            question: parsed.question,
            timestamp: Date.now()
        });

        console.log('   ✅ Complete');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        return res.json({
            success: true,
            question: {
                question: parsed.question,
                correctAnswer: parsed.correctAnswer,
                hints: parsed.hints || [],
                explanation: parsed.explanation || '',
                topic: topic.name,
                subtopic: subtopic?.name,
                difficulty: parsed.difficulty || difficulty,
                gradeLevel: studentProfile.grade,
                visualData: parsed.visualData || null,
                curriculumAligned: true,
                reformYear: CURRICULUM_METADATA.reformYear
            },
            model: 'claude-3.5-haiku',
            personalityActive: personalitySystem.loaded,
            attemptCount: attempts
        });

    } catch (error) {
        console.error('❌ Error:', error);

        // Provide user-friendly error messages
        let errorMessage = error.message;
        if (error.message === 'Overloaded') {
            errorMessage = 'השרת עמוס כרגע. אנא נסה שוב בעוד כמה שניות.';
        }

        res.status(500).json({
            success: false,
            error: errorMessage
        });
    }
});
// ==================== VERIFY ANSWER ====================


// Replace your existing endpoint with this:
app.post('/api/ai/verify-answer', async (req, res) => {
    try {
        const { question, userAnswer, correctAnswer, studentName, topic, subtopic, userId } = req.body;

        console.log('🔍 VERIFYING ANSWER');

        let isCorrect = false;
        let feedback = '';
        let explanation = '';
        let confidence = 0;
        let model = '';

        // Check for exact match first
        if (compareMathExpressions(userAnswer, correctAnswer)) {
            console.log('✅ EXACT MATCH');

            isCorrect = true;
            confidence = 100;
            feedback = 'נכון מצוין! 🎉';
            explanation = 'התשובה שלך נכונה!';
            model = 'exact-match';

        } else {
            // Use AI verification
            const prompt = `בדוק:\n\nשאלה: ${question}\nתלמיד: ${userAnswer}\nנכון: ${correctAnswer}\n\nJSON:\n{"isCorrect":true/false,"feedback":"...","explanation":"..."}`;

            if (process.env.ANTHROPIC_API_KEY) {
                const response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': process.env.ANTHROPIC_API_KEY,
                        'anthropic-version': '2023-06-01'
                    },
                    body: JSON.stringify({
                        model: 'claude-3-5-haiku-20241022',
                        max_tokens: 1500,
                        temperature: 0.3,
                        system: 'אתה נקסון. בדוק שקילות מתמטית. JSON בלבד.',
                        messages: [{ role: 'user', content: prompt }]
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error?.message || 'API error');
                }

                const rawText = data.content[0].text;
                const jsonText = cleanJsonText(rawText);
                const parsed = JSON.parse(jsonText);

                isCorrect = parsed.isCorrect;
                confidence = 95;
                feedback = parsed.feedback;
                explanation = parsed.explanation;
                model = 'claude-3.5-haiku';
            } else {
                throw new Error('No AI configured');
            }
        }

        // ✨ AUTO-SAVE TO NOTEBOOK IF CORRECT
        if (isCorrect && userId) {
            try {
                console.log('📓 Saving to notebook...');
                await notebookService.saveExerciseToNotebook(userId, {
                    question: question,
                    answer: correctAnswer,
                    studentAnswer: userAnswer,
                    isCorrect: true,
                    topic: topic || 'כללי',
                    subtopic: subtopic || ''
                });
                console.log('✅ Saved to notebook successfully');
            } catch (notebookError) {
                // Don't fail the request if notebook save fails
                console.error('⚠️ Failed to save to notebook:', notebookError.message);
                // Continue anyway - the answer verification is still valid
            }
        }

        // Return the verification result
        return res.json({
            success: true,
            isCorrect,
            confidence,
            feedback,
            explanation,
            model
        });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
// ==================== GET HINT ====================

// ==================== ADMIN: UPLOAD PERSONALITY FILE ====================
app.post('/api/admin/upload-personality', upload.single('file'), async (req, res) => {
    try {
        console.log('📤 PERSONALITY FILE UPLOAD');

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        console.log('   File:', req.file.originalname);
        console.log('   Size:', req.file.size, 'bytes');

        // Save to local uploads directory
        const uploadsDir = path.join(__dirname, '../uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const localPath = path.join(uploadsDir, 'personality-system.xlsx');
        fs.writeFileSync(localPath, req.file.buffer);
        console.log('   ✅ Saved locally:', localPath);

        // Upload to Firebase Storage if available
        if (bucket) {
            const file = bucket.file('personality-system.xlsx');
            await file.save(req.file.buffer, {
                metadata: {
                    contentType: req.file.mimetype,
                    metadata: {
                        uploadedAt: new Date().toISOString()
                    }
                }
            });
            console.log('   ✅ Uploaded to Firebase Storage');
        } else {
            console.log('   ⚠️ Firebase not configured - local only');
        }

        // Reload personality system
        personalitySystem.loadFromExcel(localPath);
        console.log('   ✅ Personality system reloaded');

        res.json({
            success: true,
            message: 'Personality file uploaded and loaded successfully',
            filename: req.file.originalname,
            size: req.file.size,
            firebaseUploaded: !!bucket,
            personalityLoaded: personalitySystem.loaded
        });

    } catch (error) {
        console.error('❌ Upload error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/api/ai/get-hint', async (req, res) => {
    try {
        const { question, hintIndex } = req.body;

        const hintLevels = ['רמז עדין', 'רמז ישיר', 'רמז ספציפי'];
        const prompt = `תן ${hintLevels[hintIndex]} לשאלה:\n\n${question}`;

        if (process.env.ANTHROPIC_API_KEY) {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-5-haiku-20241022',
                    max_tokens: 500,
                    temperature: 0.7,
                    messages: [{ role: 'user', content: prompt }]
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || 'API error');
            }

            return res.json({
                success: true,
                hint: data.content[0].text
            });
        }

        throw new Error('No AI configured');

    } catch (error) {
        console.error('❌ Error:', error);
        res.json({
            success: true,
            hint: 'נסה לפרק את השאלה 🤔'
        });
    }
});

// ==================== AI CHAT ====================
app.post('/api/ai/chat', async (req, res) => {
    try {
        const { message, context } = req.body;

        const wantsFullSolution = /פתרון|הראה|שלב/i.test(message);

        let conversationPrompt = wantsFullSolution
            ? `תן פתרון מפורט ל: ${context?.question}`
            : `עזור: "${message}"\n\nשאלה: ${context?.question}`;

        if (process.env.ANTHROPIC_API_KEY) {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': process.env.ANTHROPIC_API_KEY,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: 'claude-3-5-haiku-20241022',
                    max_tokens: wantsFullSolution ? 2000 : 800,
                    temperature: 0.7,
                    messages: [{ role: 'user', content: conversationPrompt }]
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error?.message || 'API error');
            }

            return res.json({
                success: true,
                response: data.content[0].text,
                model: 'claude-3.5-haiku'
            });
        }

        throw new Error('No AI configured');

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================== 🔥 IMAGE ANALYSIS FOR HANDWRITTEN WORK ====================
app.post('/api/ai/analyze-handwritten-work', upload.single('image'), async (req, res) => {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📸 ANALYZING HANDWRITTEN WORK');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No image file uploaded'
            });
        }

        const {
            question,
            correctAnswer,
            studentName = 'תלמיד',
            grade = '8',
            topic = '',
            personality = 'nexon',
            mathFeeling = 'okay',
            learningStyle = 'visual'
        } = req.body;

        console.log('   Question:', question?.substring(0, 60) + '...');
        console.log('   Correct Answer:', correctAnswer);
        console.log('   Student:', studentName);
        console.log('   File:', req.file.originalname);
        console.log('   Size:', (req.file.size / 1024).toFixed(2), 'KB');

        if (!question || !correctAnswer) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: question and correctAnswer'
            });
        }

        // Get base64 image from buffer
        const base64Image = req.file.buffer.toString('base64');

        // Determine media type
        const mediaTypeMap = {
            'image/jpeg': 'image/jpeg',
            'image/jpg': 'image/jpeg',
            'image/png': 'image/png',
            'image/webp': 'image/webp',
            'image/gif': 'image/gif'
        };
        const mediaType = mediaTypeMap[req.file.mimetype] || 'image/jpeg';

        console.log('   Media Type:', mediaType);

        // Build personality context
        let personalityContext = 'אתה נקסון - מורה דיגיטלי ידידותי, אופטימי ומעודד. השתמש באימוג׳ים והיה חיובי.';

        if (personalitySystem.loaded) {
            const corePersonality = personalitySystem.data.corePersonality;
            personalityContext = `אתה ${corePersonality.teacher_name}, ${corePersonality.description}. ${corePersonality.teaching_approach}`;
        }

        // Student feeling context
        let feelingContext = '';
        if (mathFeeling === 'struggle') {
            feelingContext = 'התלמיד מתקשה - היה סבלני מאוד ומעודד.';
        } else if (mathFeeling === 'love') {
            feelingContext = 'התלמיד אוהב מתמטיקה - עודד אותו להמשיך!';
        }

        const analysisPrompt = `${personalityContext}

${feelingContext ? feelingContext + '\n' : ''}
אתה בודק את הפתרון בכתב יד של ${studentName} (כיתה ${grade}).
${topic ? `נושא: ${topic}\n` : ''}

**השאלה המקורית:**
${question}

**התשובה הנכונה:**
${correctAnswer}

**המשימה שלך:**
1. זהה את התשובה הסופית שהתלמיד כתב בתמונה
2. בדוק אם התשובה נכונה (השווה לתשובה הנכונה)
3. נתח את השלבים שהתלמיד ביצע (אם נראים)
4. תן משוב מעודד ומועיל בעברית

**חשוב מאוד:**
- אם התלמיד פתר שאלה אחרת (לא את השאלה המקורית), ציין זאת במפורש!
- התעלם מהבדלים קלים בכתיב (למשל: 42 זהה ל-42.0, 1/2 זהה ל-0.5)
- אם אתה רואה רק תשובה סופית ללא שלבים, זה בסדר - נתח מה שאתה רואה
- היה סבלני וחיובי - זה תלמיד שמנסה!

השב במבנה JSON הבא (בדיוק כך):
{
  "detectedAnswer": "התשובה המדויקת שזיהית מהתמונה (טקסט)",
  "isCorrect": true או false,
  "matchesQuestion": true או false (האם התלמיד פתר את השאלה הנכונה),
  "feedback": "משוב מפורט בעברית עם אימוג'ים - עודד את התלמיד ותן טיפים",
  "stepsAnalysis": ["שלב 1 שהתלמיד ביצע", "שלב 2...", "שלב 3..."] או [] אם לא נראים שלבים
}

אם לא מצאת פתרון בתמונה או שהתמונה לא ברורה, ציין זאת ב-feedback ו-detectedAnswer יהיה ריק.
החזר **רק JSON** - ללא טקסט נוסף לפני או אחרי!`;

        console.log('   📤 Sending to Claude Sonnet Vision API...');

        // 🔥 RETRY LOGIC WITH EXPONENTIAL BACKOFF
        let apiSuccess = false;
        let claudeResponse = null;
        let lastError = null;

        for (let retryAttempt = 0; retryAttempt < 3; retryAttempt++) {
            try {
                // Wait before retry (exponential backoff: 2s, 4s, 8s)
                if (retryAttempt > 0) {
                    const waitTime = Math.pow(2, retryAttempt) * 1000;
                    console.log(`   ⏳ API Retry ${retryAttempt}/3 - waiting ${waitTime}ms...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }

                const response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': process.env.ANTHROPIC_API_KEY,
                        'anthropic-version': '2023-06-01'
                    },
                    body: JSON.stringify({
                        model: 'claude-3-5-haiku-20241022',  // ✅ MUST USE SONNET FOR VISION
                        max_tokens: 2000,
                        temperature: 0.5,
                        messages: [{
                            role: 'user',
                            content: [
                                {
                                    type: 'image',
                                    source: {
                                        type: 'base64',
                                        media_type: mediaType,
                                        data: base64Image
                                    }
                                },
                                {
                                    type: 'text',
                                    text: analysisPrompt
                                }
                            ]
                        }]
                    })
                });

                const data = await response.json();

                // Handle 529 Overloaded error
                if (response.status === 529) {
                    lastError = new Error('Overloaded');
                    console.log(`   ⚠️ API Overloaded (retry ${retryAttempt + 1}/3)`);
                    continue;
                }

                // Handle other errors
                if (!response.ok) {
                    lastError = new Error(data.error?.message || `API error: ${response.status}`);
                    console.log(`   ❌ API Error: ${lastError.message}`);
                    console.log('   Full error:', JSON.stringify(data, null, 2));

                    // If it's a rate limit or server error, retry
                    if (response.status >= 500 || response.status === 429) {
                        continue;
                    }

                    throw lastError;
                }

                // Success!
                claudeResponse = data;
                console.log('   ✅ API call successful');
                apiSuccess = true;
                break;

            } catch (error) {
                lastError = error;
                console.error(`   ❌ API attempt ${retryAttempt + 1} failed:`, error.message);

                if (retryAttempt === 2) {
                    throw error;
                }
            }
        }

        if (!apiSuccess) {
            throw lastError || new Error('All API retry attempts failed');
        }

        // Parse Claude's response
        const claudeText = claudeResponse.content[0].text;
        console.log('   📥 Raw response (first 200):', claudeText.substring(0, 200));

        // Extract JSON from response
        let analysis;
        try {
            const jsonText = cleanJsonText(claudeText);
            analysis = JSON.parse(jsonText);
            console.log('   ✅ JSON parsed successfully');
        } catch (parseError) {
            console.error('   ❌ JSON parse error:', parseError.message);

            // Fallback analysis
            analysis = {
                detectedAnswer: '',
                isCorrect: false,
                matchesQuestion: true,
                feedback: claudeText.includes('לא') ? claudeText : 'לא הצלחתי לנתח את התמונה בצורה מלאה. נסה לצלם שוב עם תאורה טובה יותר! 📸',
                stepsAnalysis: []
            };
        }

        // Validate and clean analysis
        const cleanedAnalysis = {
            detectedAnswer: String(analysis.detectedAnswer || '').trim(),
            isCorrect: Boolean(analysis.isCorrect),
            matchesQuestion: analysis.matchesQuestion !== false,
            feedback: String(analysis.feedback || 'לא הצלחתי לנתח את התמונה. נסה שוב! 📸').trim(),
            stepsAnalysis: Array.isArray(analysis.stepsAnalysis) ? analysis.stepsAnalysis : []
        };

        console.log('   📊 Analysis Result:');
        console.log('      Detected:', cleanedAnalysis.detectedAnswer);
        console.log('      Correct:', cleanedAnalysis.isCorrect ? '✅' : '❌');
        console.log('      Matches Question:', cleanedAnalysis.matchesQuestion ? '✅' : '⚠️');
        console.log('      Steps:', cleanedAnalysis.stepsAnalysis.length);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // Return analysis
        res.json({
            success: true,
            analysis: cleanedAnalysis,
            model: 'claude-3-5-haiku-20241022',  // ✅ SONNET FOR VISION
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ CRITICAL ERROR:', error);
        console.error('   Error details:', error.message);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        // User-friendly error messages
        let errorMessage = error.message;
        if (error.message === 'Overloaded') {
            errorMessage = 'השרת עמוס כרגע. אנא נסה שוב בעוד כמה שניות.';
        } else if (error.message.includes('API key')) {
            errorMessage = 'שגיאת הגדרות שרת. אנא פנה למנהל המערכת.';
        } else if (error.message.includes('model')) {
            errorMessage = 'שגיאה במודל AI. מנסה שוב...';
        }

        res.status(500).json({
            success: false,
            error: errorMessage,
            timestamp: new Date().toISOString()
        });
    }
});

// ==================== START SERVER ====================
async function loadPersonalityFromStorage() {
    if (!bucket) {
        console.log('⚠️ Firebase not configured - using local storage');
        const localPath = path.join(__dirname, '../uploads/personality-system.xlsx');
        if (fs.existsSync(localPath)) {
            personalitySystem.loadFromExcel(localPath);
            console.log('✅ Loaded from local file');
        }
        return;
    }

    try {
        const file = bucket.file('personality-system.xlsx');
        const [exists] = await file.exists();
        if (exists) {
            const tempPath = `/tmp/personality-system.xlsx`;
            await file.download({ destination: tempPath });
            personalitySystem.loadFromExcel(tempPath);
            console.log('✅ Loaded from Firebase');
        }
    } catch (error) {
        console.error('❌ Error loading personality:', error.message);
    }
}
app.use('/api/users', userRoutes);

app.use('/api/notebook', notebookRoutes);

app.use('/api/curriculum', curriculumRoutes);

app.use('/api', nexonRoutes);

app.use('/api/learning', learningRoutes);


app.listen(PORT, async () => {
    await loadPersonalityFromStorage();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 NEXON AI - SMART TOPIC-BASED QUESTIONS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📡 Server: http://localhost:${PORT}`);
    console.log(`   • Personality: ${personalitySystem.loaded ? '✅' : '❌'}`);
    console.log(`   • Smart Topics: ✅`);
    console.log(`   • SVG Support: ✅`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});
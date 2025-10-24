// server/topic-fallbacks.js - CLEAR QUESTIONS WITH SUBTOPICS

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

export function getTopicSpecificFallback(topicName, teacherName = 'נקסון', subtopic = null) {
    console.log(`🔄 Generating fallback for: ${topicName}, subtopic: ${subtopic}`);

    const fallbacks = {
        // Grade 7
        'דמיון במשולשים': () => {
            if (subtopic === 'similarity-ratio' || !subtopic) {
                const ratio = rand(2, 5);
                return {
                    question: `משולש ABC דומה למשולש DEF ביחס דמיון 1:${ratio}. אם AB = ${rand(4, 12)} ס"מ, מהו אורך הצלע המתאימה DE?`,
                    correctAnswer: `${rand(4, 12) * ratio}`,
                    topic: 'דמיון במשולשים',
                    subtopic: 'similarity-ratio'
                };
            }
            if (subtopic === 'thales-theorem') {
                return {
                    question: `במשולש ABC, קו המקביל לצלע BC חותך את AB ב-D ואת AC ב-E. אם AD = ${rand(3, 8)} ס"מ ו-DB = ${rand(4, 10)} ס"מ, ו-AE = ${rand(3, 8)} ס"מ, מהו EC?`,
                    correctAnswer: `מחושב לפי משפט תאלס`,
                    topic: 'דמיון במשולשים',
                    subtopic: 'thales-theorem'
                };
            }
            return null;
        },

        'פרופורציה ויחסים': () => {
            if (subtopic === 'simple-ratio' || !subtopic) {
                const a = rand(2, 9);
                const b = rand(2, 9);
                return {
                    question: `מהו היחס בין ${a} ל-${b}?`,
                    correctAnswer: `${a}:${b}`,
                    topic: 'פרופורציה ויחסים',
                    subtopic: 'simple-ratio'
                };
            }
            if (subtopic === 'direct-proportion') {
                const k = rand(2, 5);
                const x = rand(3, 8);
                return {
                    question: `אם y = ${k}x, מהו y כאשר x = ${x}?`,
                    correctAnswer: `${k * x}`,
                    topic: 'פרופורציה ויחסים',
                    subtopic: 'direct-proportion'
                };
            }
            return null;
        },

        'משוואות לינאריות': () => {
            if (subtopic === 'basic-equations' || !subtopic) {
                const a = rand(2, 15);
                const b = rand(5, 20);
                return {
                    question: `פתור את המשוואה: x + ${a} = ${b}`,
                    correctAnswer: `x = ${b - a}`,
                    topic: 'משוואות לינאריות',
                    subtopic: 'basic-equations'
                };
            }
            if (subtopic === 'equations-multiplication') {
                const a = rand(2, 8);
                const b = rand(10, 40);
                return {
                    question: `פתור: ${a}x = ${b}`,
                    correctAnswer: `x = ${b / a}`,
                    topic: 'משוואות לינאריות',
                    subtopic: 'equations-multiplication'
                };
            }
            return null;
        },

        'גרפים של פונקציות': () => {
            if (subtopic === 'linear-function' || !subtopic) {
                const m = rand(1, 5);
                const b = rand(-5, 5);
                const x = rand(1, 10);
                return {
                    question: `בפונקציה y = ${m}x ${b >= 0 ? '+' : ''}${b}, מה ערך y כאשר x = ${x}?`,
                    correctAnswer: `y = ${m * x + b}`,
                    topic: 'גרפים של פונקציות',
                    subtopic: 'linear-function'
                };
            }
            if (subtopic === 'slope') {
                const y1 = rand(2, 10);
                const y2 = rand(12, 20);
                const x1 = rand(1, 5);
                const x2 = rand(6, 12);
                return {
                    question: `מהו השיפוע של ישר העובר דרך הנקודות (${x1}, ${y1}) ו-(${x2}, ${y2})?`,
                    correctAnswer: `${(y2 - y1) / (x2 - x1)}`,
                    topic: 'גרפים של פונקציות',
                    subtopic: 'slope'
                };
            }
            return null;
        },

        'אחוזים': () => {
            const percent = rand(10, 50);
            const number = rand(20, 200);
            return {
                question: `חשב: מהם ${percent}% מ-${number}?`,
                correctAnswer: `${(percent * number) / 100}`,
                topic: 'אחוזים',
                subtopic: 'percent-of-number'
            };
        },

        'משולשים': () => {
            if (subtopic === 'triangle-area' || !subtopic) {
                const base = rand(4, 15);
                const height = rand(3, 12);
                return {
                    question: `חשב את שטח משולש עם בסיס ${base} ס"מ וגובה ${height} ס"מ`,
                    correctAnswer: `${(base * height) / 2}`,
                    topic: 'משולשים',
                    subtopic: 'triangle-area'
                };
            }
            if (subtopic === 'pythagorean') {
                const a = rand(3, 8);
                const b = rand(4, 10);
                const c = Math.sqrt(a * a + b * b).toFixed(1);
                return {
                    question: `במשולש ישר זווית, אם a = ${a} ס"מ ו-b = ${b} ס"מ, מהו אורך היתר c?`,
                    correctAnswer: `${c}`,
                    topic: 'משולשים',
                    subtopic: 'pythagorean'
                };
            }
            return null;
        },

        // Grade 8
        'משוואות ריבועיות': () => {
            if (subtopic === 'quadratic-basic' || !subtopic) {
                const a = rand(2, 12);
                const squared = a * a;
                return {
                    question: `פתור את המשוואה: x² = ${squared}`,
                    correctAnswer: `x = ±${a}`,
                    topic: 'משוואות ריבועיות',
                    subtopic: 'quadratic-basic'
                };
            }
            if (subtopic === 'quadratic-factoring') {
                const r1 = rand(-5, 5);
                const r2 = rand(-5, 5);
                return {
                    question: `פרק לגורמים: x² ${r1 + r2 >= 0 ? '+' : ''}${r1 + r2}x ${r1 * r2 >= 0 ? '+' : ''}${r1 * r2} = 0`,
                    correctAnswer: `(x ${r1 >= 0 ? '-' : '+'}${Math.abs(r1)})(x ${r2 >= 0 ? '-' : '+'}${Math.abs(r2)})`,
                    topic: 'משוואות ריבועיות',
                    subtopic: 'quadratic-factoring'
                };
            }
            return null;
        },

        'פולינומים': () => {
            if (subtopic === 'expand-brackets' || !subtopic) {
                const a = rand(2, 8);
                const b = rand(2, 9);
                const c = rand(3, 12);
                return {
                    question: `פתח סוגריים: ${a}(${b}x + ${c})`,
                    correctAnswer: `${a * b}x + ${a * c}`,
                    topic: 'פולינומים',
                    subtopic: 'expand-brackets'
                };
            }
            if (subtopic === 'common-factor') {
                const a = rand(2, 6);
                const b = rand(2, 8);
                const c = rand(3, 9);
                return {
                    question: `הוצא גורם משותף: ${a * b}x + ${a * c}`,
                    correctAnswer: `${a}(${b}x + ${c})`,
                    topic: 'פולינומים',
                    subtopic: 'common-factor'
                };
            }
            return null;
        },

        // Grade 9
        'חזקות ושורשים': () => {
            if (subtopic === 'square-roots' || !subtopic) {
                const perfect = rand(4, 12);
                const squared = perfect * perfect;
                return {
                    question: `חשב: מהו השורש הריבועי של ${squared}?`,
                    correctAnswer: `${perfect}`,
                    topic: 'חזקות ושורשים',
                    subtopic: 'square-roots'
                };
            }
            if (subtopic === 'powers') {
                const base = rand(2, 5);
                const exp = rand(2, 4);
                return {
                    question: `חשב: ${base}^${exp}`,
                    correctAnswer: `${Math.pow(base, exp)}`,
                    topic: 'חזקות ושורשים',
                    subtopic: 'powers'
                };
            }
            return null;
        },

        'גאומטריה מתקדמת': () => {
            if (subtopic === 'circle-area' || !subtopic) {
                const r = rand(3, 10);
                return {
                    question: `חשב את שטח מעגל עם רדיוס ${r} ס"מ (השתמש ב-π = 3.14)`,
                    correctAnswer: `${(Math.PI * r * r).toFixed(2)}`,
                    topic: 'גאומטריה מתקדמת',
                    subtopic: 'circle-area'
                };
            }
            if (subtopic === 'volume-cube') {
                const a = rand(3, 8);
                return {
                    question: `חשב את נפח קוביה עם צלע ${a} ס"מ`,
                    correctAnswer: `${a * a * a}`,
                    topic: 'גאומטריה מתקדמת',
                    subtopic: 'volume-cube'
                };
            }
            return null;
        },

        'הסתברות': () => {
            if (subtopic === 'basic-probability' || !subtopic) {
                const total = rand(10, 20);
                const favorable = rand(2, total - 2);
                return {
                    question: `בקופסה יש ${total} כדורים, ${favorable} מהם אדומים. מה ההסתברות למשוך כדור אדום?`,
                    correctAnswer: `${favorable}/${total}`,
                    topic: 'הסתברות',
                    subtopic: 'basic-probability'
                };
            }
            return null;
        }
    };

    const fallbackFunc = fallbacks[topicName];
    if (!fallbackFunc) {
        console.warn(`⚠️ No fallback for topic: ${topicName}`);
        return null;
    }

    return fallbackFunc();
}
// server/services/personalityLoader.js - COMPLETE WITH CURRICULUM ENFORCEMENT
import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';

class PersonalitySystem {
    constructor() {
        this.data = {
            corePersonality: {},
            languageStyle: {},
            topicGuidelines: [],
            hintSystem: [],
            stepTemplates: [],
            answerFormats: [],
            examplesBank: [],
            errorPatterns: [],
            encouragementLibrary: [],
            questionTemplates: [],
            progressionRules: [],
            culturalContext: [],
            responseTemplates: [],
            difficultyIndicators: [],
            scaffoldingStrategies: [],
            questionVariationPatterns: [],
            learningMilestones: [],
            adaptiveFeedback: [],
            errorRecoveryStrategies: [],
            motivationTriggers: []
        };
        this.loaded = false;
    }

    loadFromExcel(filePath) {
        try {
            console.log('📚 Loading personality system from Excel...');
            console.log('   File path:', filePath);

            const workbook = xlsx.readFile(filePath);
            console.log('   📑 Available sheets:', workbook.SheetNames.join(', '));

            // 🔥 FLEXIBLE SHEET MAPPING - Order doesn't matter!
            const sheetMapping = [
                {
                    names: ['CORE_PERSONALITY', 'Core_Personality', 'core_personality'],
                    handler: (sheet) => {
                        const data = xlsx.utils.sheet_to_json(sheet);
                        data.forEach(row => {
                            const field = row.field || row.Field || row.FIELD;
                            const value = row.value || row.Value || row.VALUE;
                            if (field && value !== undefined) {
                                this.data.corePersonality[field] = value;
                            }
                        });
                        console.log('   ✅ Core personality loaded:', Object.keys(this.data.corePersonality).length, 'fields');
                    }
                },
                {
                    names: ['LANGUAGE_STYLE', 'Language_Style', 'language_style'],
                    handler: (sheet) => {
                        const data = xlsx.utils.sheet_to_json(sheet);
                        data.forEach(row => {
                            const element = row.element || row.Element || row.ELEMENT || row.field || row.Field;
                            const style = row.style || row.Style || row.STYLE || row.value || row.Value;
                            if (element && style !== undefined) {
                                this.data.languageStyle[element] = style;
                            }
                        });
                        console.log('   ✅ Language style loaded:', Object.keys(this.data.languageStyle).length, 'fields');
                    }
                },
                {
                    names: ['TOPIC_GUIDELINES', 'Topic_Guidelines', 'topic_guidelines'],
                    target: 'topicGuidelines'
                },
                {
                    names: ['HINT_SYSTEM', 'Hint_System', 'hint_system'],
                    target: 'hintSystem'
                },
                {
                    names: ['STEP_TEMPLATES', 'Step_Templates', 'step_templates'],
                    target: 'stepTemplates'
                },
                {
                    names: ['ANSWER_FORMATS', 'Answer_Formats', 'answer_formats'],
                    target: 'answerFormats'
                },
                {
                    names: ['EXAMPLES_BANK', 'Examples_Bank', 'examples_bank'],
                    target: 'examplesBank'
                },
                {
                    names: ['ERROR_PATTERNS', 'Error_Patterns', 'error_patterns'],
                    target: 'errorPatterns'
                },
                {
                    names: ['ENCOURAGEMENT_LIBRARY', 'Encouragement_Library', 'encouragement_library'],
                    target: 'encouragementLibrary'
                },
                {
                    names: ['QUESTION_TEMPLATES', 'Question_Templates', 'question_templates'],
                    target: 'questionTemplates'
                },
                {
                    names: ['PROGRESSION_RULES', 'Progression_Rules', 'progression_rules'],
                    target: 'progressionRules'
                },
                {
                    names: ['CULTURAL_CONTEXT', 'Cultural_Context', 'cultural_context'],
                    target: 'culturalContext'
                },
                {
                    names: ['RESPONSE_TEMPLATES', 'Response_Templates', 'response_templates'],
                    target: 'responseTemplates'
                },
                {
                    names: ['DIFFICULTY_INDICATORS', 'Difficulty_Indicators', 'difficulty_indicators'],
                    target: 'difficultyIndicators'
                },
                {
                    names: ['SCAFFOLDING_STRATEGIES', 'Scaffolding_Strategies', 'scaffolding_strategies'],
                    target: 'scaffoldingStrategies'
                },
                {
                    names: ['QUESTION_VARIATION_PATTERNS', 'Question_Variation_Patterns', 'question_variation_patterns'],
                    target: 'questionVariationPatterns'
                },
                {
                    names: ['LEARNING_MILESTONES', 'Learning_Milestones', 'learning_milestones'],
                    target: 'learningMilestones'
                },
                {
                    names: ['ADAPTIVE_FEEDBACK', 'Adaptive_Feedback', 'adaptive_feedback'],
                    target: 'adaptiveFeedback'
                },
                {
                    names: ['ERROR_RECOVERY_STRATEGIES', 'Error_Recovery_Strategies', 'error_recovery_strategies'],
                    target: 'errorRecoveryStrategies'
                },
                {
                    names: ['MOTIVATION_TRIGGERS', 'Motivation_Triggers', 'motivation_triggers'],
                    target: 'motivationTriggers'
                }
            ];

            // 🔥 LOAD ALL SHEETS DYNAMICALLY
            sheetMapping.forEach(mapping => {
                const sheetName = mapping.names.find(name => workbook.SheetNames.includes(name));

                if (sheetName) {
                    const sheet = workbook.Sheets[sheetName];

                    if (mapping.handler) {
                        // Custom handler for special sheets
                        mapping.handler(sheet);
                    } else if (mapping.target) {
                        // Standard array loading
                        this.data[mapping.target] = xlsx.utils.sheet_to_json(sheet);
                        console.log(`   ✅ ${sheetName} loaded: ${this.data[mapping.target].length} rows`);
                    }
                }
            });

            this.loaded = true;

            console.log('\n✅ Personality system loaded successfully!');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('📊 Summary:');
            console.log(`   👤 Teacher: ${this.data.corePersonality.teacher_name || 'Unknown'}`);
            console.log(`   📚 Examples: ${this.data.examplesBank.length}`);
            console.log(`   🎯 Topics: ${this.data.topicGuidelines.length}`);
            console.log(`   💡 Hints: ${this.data.hintSystem.length}`);
            console.log(`   ❌ Error patterns: ${this.data.errorPatterns.length}`);
            console.log(`   💪 Encouragements: ${this.data.encouragementLibrary.length}`);
            console.log(`   📝 Templates: ${this.data.questionTemplates.length}`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

            return true;
        } catch (error) {
            console.error('❌ Failed to load personality system:', error);
            console.error('   Error details:', error.message);
            console.error('   Stack:', error.stack);
            return false;
        }
    }

    // ==================== HELPER METHODS ====================

    // Get examples for a specific topic
    getExamplesForTopic(topic, difficulty) {
        if (!this.loaded || !this.data.examplesBank) return [];

        // 🔥 FIX: Safe string conversion
        const topicStr = String(topic || '').toLowerCase();

        return this.data.examplesBank.filter(ex => {
            // 🔥 FIX: Safe property access
            const exTopic = String(ex?.topic || '').toLowerCase();
            const exDifficulty = String(ex?.difficulty || '').toLowerCase();
            const difficultyStr = String(difficulty || '').toLowerCase();

            const matchesTopic = exTopic.includes(topicStr);
            const matchesDifficulty = !difficulty || exDifficulty === difficultyStr;

            return matchesTopic && matchesDifficulty;
        });
    }

    // Get topic guidelines
    getTopicGuideline(topicName) {
        if (!topicName) return null;

        return this.data.topicGuidelines.find(t => {
            const tName = t.topic || t.Topic || t.TOPIC || t.topic_name || '';
            return tName.includes(topicName);
        });
    }

    // 🔥 NEW: Get topic guideline with grade filter
    getTopicGuidelineForGrade(topicName, grade) {
        if (!topicName) return null;

        const guidelines = this.data.topicGuidelines.filter(t => {
            const tName = t.topic || t.Topic || t.TOPIC || '';
            const tGrade = t.grade || t.Grade || t.GRADE;
            return tName.includes(topicName) && (!tGrade || tGrade == grade);
        });

        return guidelines[0] || null;
    }

    // 🔥 NEW: Get question template for topic and difficulty
    getQuestionTemplate(topicName, difficulty) {
        if (!topicName) return null;

        let templates = this.data.questionTemplates.filter(t => {
            const tName = t.topic || t.Topic || t.TOPIC || '';
            return tName.includes(topicName);
        });

        if (difficulty) {
            templates = templates.filter(t => {
                const tDiff = t.difficulty || t.Difficulty || t.DIFFICULTY || '';
                return tDiff === difficulty;
            });
        }

        return templates[0] || null;
    }

    // Get hint for topic and level
    getHint(topicName, level = 1) {
        const hints = this.data.hintSystem.filter(h => {
            const hTopic = h.topic || h.Topic || h.TOPIC || '';
            const hLevel = h.hint_level || h.Hint_Level || h.level || 1;
            return hTopic.includes(topicName) && hLevel == level;
        });

        return hints[0] || null;
    }

    // Get error pattern for topic
    getErrorPattern(topicName) {
        if (!topicName) return [];

        return this.data.errorPatterns.filter(e => {
            const eTopic = e.topic || e.Topic || e.TOPIC || e.error_type || '';
            return eTopic.includes(topicName);
        });
    }

    // Get encouragement for situation
    getEncouragement(situation) {
        const encouragement = this.data.encouragementLibrary.find(e => {
            const eSituation = e.situation || e.Situation || e.SITUATION || '';
            return eSituation === situation;
        });

        const phrase = encouragement?.encouragement || encouragement?.Encouragement ||
            encouragement?.encouragement_phrase || 'כל הכבוד! 🌟';

        return phrase;
    }

    // Get step template for topic
    getStepTemplate(topicName) {
        return this.data.stepTemplates.filter(t => {
            const tTopic = t.topic || t.Topic || t.TOPIC || '';
            return tTopic.includes(topicName);
        });
    }

    // Get cultural context items
    getCulturalContext(contextType = null) {
        if (!contextType) return this.data.culturalContext;

        return this.data.culturalContext.filter(c => {
            const cType = c.element || c.Element || c.context_type || '';
            return cType === contextType;
        });
    }

    // Get response template
    getResponseTemplate(situation) {
        return this.data.responseTemplates.find(r => {
            const rSituation = r.situation || r.Situation || r.SITUATION || '';
            return rSituation === situation;
        });
    }

    // Get scaffolding strategy
    getScaffoldingStrategy(strategyType) {
        return this.data.scaffoldingStrategies.find(s => {
            const sType = s.strategy || s.Strategy || s.strategy_type || '';
            return sType === strategyType;
        });
    }

    // Get learning milestone
    getLearningMilestone(milestoneType) {
        return this.data.learningMilestones.find(m => {
            const mType = m.milestone || m.Milestone || m.milestone_type || '';
            return mType === milestoneType;
        });
    }

    // Get adaptive feedback for student type
    getAdaptiveFeedback(studentType) {
        return this.data.adaptiveFeedback.find(f => {
            const fType = f.student_type || f.Student_Type || f.type || '';
            return fType === studentType;
        });
    }

    // ==================== 🔥 ENHANCED SYSTEM PROMPT WITH HARD/SOFT SEPARATION ====================

    buildSystemPrompt(studentProfile = {}) {
        const core = this.data.corePersonality;

        if (!core.teacher_name && !core.Teacher_Name) {
            return buildFallbackSystemPrompt(studentProfile);
        }

        const teacherName = core.teacher_name || core.Teacher_Name || 'נקסון';
        const teachingStyle = core.teaching_style || core.Teaching_Style || 'ידידותי וסבלני';
        const tone = core.tone || core.Tone || 'חם ומעודד';

        let prompt = `אתה ${teacherName}, מורה דיגיטלי למתמטיקה.\n\n`;

        // 🔥 SECTION 1: HARD CURRICULUM RULES (MUST OBEY)
        prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        prompt += `🚨 CURRICULUM RULES (Hard - MUST Obey)\n`;
        prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        prompt += `Israeli Math Curriculum (תשפ"ה Reform)\n`;

        if (studentProfile.grade) {
            prompt += `Grade: ${studentProfile.grade}\n`;

            // Grade-specific hard rules
            if (studentProfile.grade === 7) {
                prompt += `\n📚 Grade 7 Mandatory Principles:\n`;
                prompt += `• Round 1: Variables MUST use concrete examples (fuel ₪7/L, triangle)\n`;
                prompt += `• Round 1: Powers ONLY perfect squares up to 144\n`;
                prompt += `• Round 1: NO formal definitions yet\n`;
                prompt += `• Round 2: Equations - variable on ONE side ONLY\n`;
                prompt += `• Round 2: Negative numbers - START with elevator/temperature/sea level\n`;
                prompt += `• Round 2: Right triangle BEFORE general triangle\n`;
                prompt += `• Round 3: Functions - "soft" introduction, 4 representations\n`;
                prompt += `• NO algebraic power rules (saved for grade 9)\n`;
            }
        }

        prompt += `\n⚠️ These curriculum rules OVERRIDE personality!\n`;
        prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

        // 🎭 SECTION 2: SOFT PERSONALITY (Can Adapt)
        prompt += `🎭 PERSONALITY (Soft - Adapt Style)\n`;
        prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        prompt += `• סגנון הוראה: ${teachingStyle}\n`;
        prompt += `• טון: ${tone}\n`;

        if (core.personality_traits || core.Personality_Traits) {
            prompt += `• תכונות: ${core.personality_traits || core.Personality_Traits}\n`;
        }

        if (core.learning_philosophy || core.Learning_Philosophy) {
            prompt += `• פילוסופיה: ${core.learning_philosophy || core.Learning_Philosophy}\n`;
        }

        prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

        // Student adaptation
        if (studentProfile.mathFeeling === 'struggle') {
            prompt += `Student Adaptation: מתקשה - היה סבלני במיוחד, תן הסברים פשוטים.\n`;
        } else if (studentProfile.mathFeeling === 'love') {
            prompt += `Student Adaptation: אוהב מתמטיקה - תן אתגרים מעניינים.\n`;
        }

        if (studentProfile.learningStyle === 'independent') {
            prompt += `Learning Style: עצמאי - תן רמזים עדינים.\n`;
        } else if (studentProfile.learningStyle === 'ask') {
            prompt += `Learning Style: מעדיף הסברים - תן הסברים מפורטים.\n`;
        }

        // Technical requirements
        prompt += `\n🚨 TECHNICAL REQUIREMENTS:\n`;
        prompt += `• Valid JSON only, no newlines in strings\n`;
        prompt += `• Graph questions: raw data in (x): and (y): format\n`;
        prompt += `• Minimum 20 data points for statistics\n`;
        prompt += `• NO "הגרף מציג" or similar phrases\n`;

        return prompt;
    }

    // Build verification prompt with error patterns
    buildVerificationPrompt(question, userAnswer, correctAnswer, topic) {
        let prompt = `בדוק תשובה מתמטית:\n\n`;

        prompt += `שאלה: ${question}\n`;
        prompt += `תשובת תלמיד: ${userAnswer}\n`;
        prompt += `תשובה נכונה: ${correctAnswer}\n`;
        prompt += `נושא: ${topic}\n\n`;

        // Get error patterns for this topic
        const errors = this.getErrorPattern(topic);
        if (errors.length > 0) {
            prompt += `⚠️ שגיאות נפוצות בנושא:\n`;
            errors.slice(0, 3).forEach(err => {
                const mistake = err.common_mistake || err.Common_Mistake || err.example || '';
                const explanation = err.explanation || err.Explanation || err.why_it_happens || '';
                if (mistake && explanation) {
                    prompt += `• ${mistake}: ${explanation}\n`;
                }
            });
            prompt += `\n`;
        }

        prompt += `בדיקות:\n`;
        prompt += `1. שקילות מתמטית (5+3 = 8 = 3+5)\n`;
        prompt += `2. פורמטים שונים (0.5 = 1/2 = 50%)\n`;
        prompt += `3. דיוק מספרי (עיגול)\n`;
        prompt += `4. תשובות חלקיות\n\n`;

        prompt += `החזר JSON בלבד:\n`;
        prompt += `{\n`;
        prompt += `  "isCorrect": true/false,\n`;
        prompt += `  "isPartial": true/false,\n`;
        prompt += `  "confidence": 0-100,\n`;
        prompt += `  "feedback": "משוב מעודד",\n`;
        prompt += `  "explanation": "הסבר"\n`;
        prompt += `}\n`;

        return prompt;
    }
}

// Fallback system prompt builder
function buildFallbackSystemPrompt(studentProfile) {
    let prompt = `אתה נקסון, מורה דיגיטלי למתמטיקה מומחה.\n\n`;

    if (studentProfile.grade) {
        prompt += `התלמיד לומד בכיתה ${studentProfile.grade}.\n`;
    }

    if (studentProfile.mathFeeling === 'struggle') {
        prompt += `התלמיד מתקשה - היה סבלני.\n`;
    }

    prompt += `\n🚨 CRITICAL: החזר JSON תקין בלבד, ללא newlines בתוך strings.\n`;

    return prompt;
}

// Singleton instance
const personalitySystem = new PersonalitySystem();
export default personalitySystem;
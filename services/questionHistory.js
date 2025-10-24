// server/services/questionHistory.js
class QuestionHistoryManager {
    constructor() {
        this.history = new Map();
        this.maxHistorySize = 15;
    }

    getKey(studentId, topicId) {
        return `${studentId}_${topicId}`;
    }

    addQuestion(studentId, topicId, questionData) {
        const key = this.getKey(studentId, topicId);

        if (!this.history.has(key)) {
            this.history.set(key, []);
        }

        const questions = this.history.get(key);
        questions.push({
            question: questionData.question,
            timestamp: Date.now(),
            keywords: this.extractKeywords(questionData.question),
            numbers: this.extractNumbers(questionData.question)
        });

        if (questions.length > this.maxHistorySize) {
            questions.shift();
        }
    }

    extractKeywords(question) {
        const mathTerms = question.match(/[א-ת]{3,}/g) || [];
        return mathTerms.slice(0, 8);
    }

    extractNumbers(question) {
        return question.match(/\d+(\.\d+)?/g) || [];
    }

    getRecentQuestions(studentId, topicId, count = 5) {
        const key = this.getKey(studentId, topicId);
        const questions = this.history.get(key) || [];
        return questions.slice(-count);
    }

    isSimilar(newQuestion, recentQuestions) {
        const newNumbers = new Set(this.extractNumbers(newQuestion));
        const newKeywords = new Set(this.extractKeywords(newQuestion));

        for (const recent of recentQuestions) {
            const recentNumbers = new Set(recent.numbers);
            const numberOverlap = [...newNumbers].filter(n => recentNumbers.has(n));

            const recentKeywords = new Set(recent.keywords);
            const keywordOverlap = [...newKeywords].filter(k => recentKeywords.has(k));

            const numberSimilarity = numberOverlap.length / Math.max(newNumbers.size, recentNumbers.size, 1);
            const keywordSimilarity = keywordOverlap.length / Math.max(newKeywords.size, recentKeywords.size, 1);

            if (numberSimilarity > 0.5 && keywordSimilarity > 0.5) {
                return true;
            }
        }

        return false;
    }

    buildAvoidancePrompt(studentId, topicId) {
        const recent = this.getRecentQuestions(studentId, topicId, 3);

        if (recent.length === 0) return '';

        let prompt = '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        prompt += '🚫 AVOID REPETITION - Recent Questions\n';
        prompt += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
        prompt += 'DO NOT create questions similar to these recent ones:\n\n';

        recent.forEach((q, i) => {
            const preview = q.question.substring(0, 80);
            prompt += `${i + 1}. "${preview}..."\n`;
            prompt += `   Numbers used: ${q.numbers.join(', ')}\n`;
        });

        prompt += '\n✅ REQUIREMENTS FOR NEW QUESTION:\n';
        prompt += '• Use COMPLETELY DIFFERENT numbers\n';
        prompt += '• Use DIFFERENT context/scenario\n';
        prompt += '• Focus on DIFFERENT aspect of the topic\n';
        prompt += '• Use DIFFERENT question format/wording\n';
        prompt += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

        return prompt;
    }
}

const questionHistoryManager = new QuestionHistoryManager();
export default questionHistoryManager;
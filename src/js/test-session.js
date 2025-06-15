class TestSession {
    static KEYS = {
        TEST_SESSION: 'currentTestSession',
        START_TIME: 'testStartTime',
        END_TIME: 'testEndTime'
    };

    static saveSession(testData) {
        const session = {
            testId: testData.testId,
            questions: testData.questions,
            answers: testData.answers || new Array(testData.questions.length).fill(null),
            currentIndex: testData.currentIndex || 0,
            startTime: testData.startTime || new Date().toISOString(),
            endTime: testData.endTime,
            timeLimit: testData.timeLimit,
            selectedOptions: testData.selectedOptions || {}  // Add this to track selected options
        };
        localStorage.setItem(this.KEYS.TEST_SESSION, JSON.stringify(session));
    }

    static getSession() {
        const session = localStorage.getItem(this.KEYS.TEST_SESSION);
        return session ? JSON.parse(session) : null;
    }

    static clearSession() {
        localStorage.removeItem(this.KEYS.TEST_SESSION);
    }

    static isSessionValid() {
        const session = this.getSession();
        if (!session) return false;

        const now = new Date().getTime();
        const endTime = new Date(session.endTime).getTime();
        return now < endTime;
    }

    static getRemainingTime() {
        const session = this.getSession();
        if (!session) return 0;

        const now = new Date().getTime();
        const endTime = new Date(session.endTime).getTime();
        return Math.max(0, Math.floor((endTime - now) / 1000));
    }

    static saveAnswer(questionIndex, answer) {
        const session = this.getSession();
        if (!session) return;

        session.answers[questionIndex] = answer;
        session.currentIndex = questionIndex;
        session.selectedOptions = session.selectedOptions || {};
        session.selectedOptions[questionIndex] = answer;
        
        this.saveSession(session);
    }

    // Add method to get saved answers
    static getSavedAnswers() {
        const session = this.getSession();
        return session ? session.selectedOptions || {} : {};
    }

    static dismissTest() {
        this.clearSession();
        window.location.href = '../pages/list-tests.html';
    }

    static autoSubmitIfExpired() {
        const session = this.getSession();
        if (!session) return;

        const now = new Date().getTime();
        const endTime = new Date(session.endTime).getTime();
        
        if (now >= endTime) {
            // Auto submit the test
            const testManager = window.testManager;
            if (testManager) {
                testManager.submitTest();
            }
            this.clearSession();
        }
    }
}

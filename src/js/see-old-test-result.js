class TestHistoryManager {
    static groupTestsByType(history) {
        return history.reduce((groups, test) => {
            const key = test.testId;
            if (!groups[key]) {
                groups[key] = {
                    testId: test.testId,
                    testName: test.testName,
                    attempts: [],
                    lastAttempt: null
                };
            }
            groups[key].attempts.push(test);
            if (!groups[key].lastAttempt || new Date(test.timestamp) > new Date(groups[key].lastAttempt.timestamp)) {
                groups[key].lastAttempt = test;
            }
            return groups;
        }, {});
    }

    static displayTestTypes(historyContainer, groupedTests) {
        historyContainer.innerHTML = Object.values(groupedTests).map(test => {
            const lastAttempt = test.lastAttempt;
            const totalAttempts = test.attempts.length;
            const lastScore = this.calculateScore(lastAttempt);
            const scoreClass = this.getScoreClass(lastScore);

            return `
                <div class="test-type-card" onclick="TestHistoryManager.showTestAttempts('${test.testId}')">
                    <div class="test-header">
                        <h3>${test.testName}</h3>
                        <div class="test-stats">
                            <span class="attempts-badge">
                                <i class="fas fa-history"></i> ${totalAttempts} attempt${totalAttempts > 1 ? 's' : ''}
                            </span>
                            <span class="score-badge ${scoreClass}">
                                Last Score: ${lastScore}%
                            </span>
                        </div>
                    </div>
                    <div class="last-attempt-info">
                        <p><i class="fas fa-calendar"></i> Last attempt: ${new Date(lastAttempt.timestamp).toLocaleDateString()}</p>
                        <p class="view-details">Click to view all attempts <i class="fas fa-chevron-right"></i></p>
                    </div>
                </div>
            `;
        }).join('');
    }

    static showTestAttempts(testId) {
        const history = TestStorageManager.getTestHistory();
        const testAttempts = history.filter(test => test.testId === testId);
        const container = document.getElementById('historyContainer');

        container.innerHTML = `
            <div class="attempts-header">
                <button class="back-btn" onclick="TestHistoryManager.init()">
                    <i class="fas fa-arrow-left"></i> Back to All Tests
                </button>
                <h2>${testAttempts[0].testName} - All Attempts</h2>
            </div>
            <div class="attempts-list">
                ${testAttempts.map((attempt, index) => this.renderAttempt(attempt, index + 1)).join('')}
            </div>
        `;
    }

    static renderAttempt(attempt, attemptNumber) {
        const score = this.calculateScore(attempt);
        const scoreClass = this.getScoreClass(score);
        const date = new Date(attempt.timestamp).toLocaleDateString();
        const time = new Date(attempt.timestamp).toLocaleTimeString();

        return `
            <div class="attempt-card" onclick="TestHistoryManager.viewTestDetails('${encodeURIComponent(JSON.stringify(attempt))}')">
                <div class="attempt-header">
                    <span class="attempt-number">Attempt #${attemptNumber}</span>
                    <span class="score-badge ${scoreClass}">${score}%</span>
                </div>
                <div class="attempt-details">
                    <p><i class="fas fa-calendar"></i> ${date} at ${time}</p>
                    <p><i class="fas fa-check-circle"></i> ${this.getCorrectCount(attempt)}/${attempt.totalQuestions} correct</p>
                    <p><i class="fas fa-clock"></i> Time: ${Math.floor(attempt.timeSpent / 60)}:${String(attempt.timeSpent % 60).padStart(2, '0')}</p>
                </div>
            </div>
        `;
    }

    static calculateScore(attempt) {
        const correctCount = this.getCorrectCount(attempt);
        return Math.round((correctCount / attempt.totalQuestions) * 100);
    }

    static getCorrectCount(attempt) {
        return attempt.questions.reduce((count, q, index) => 
            count + (attempt.answers[index] === q.answer ? 1 : 0), 0);
    }

    static getScoreClass(score) {
        if (score >= 80) return 'score-high';
        if (score >= 60) return 'score-mid';
        return 'score-low';
    }

    static viewTestDetails(testData) {
        localStorage.setItem('currentTestResult', testData);
        window.location.href = '../review-your-test.html';
    }

    static init() {
        const history = TestStorageManager.getTestHistory();
        const container = document.getElementById('historyContainer');

        if (!history || history.length === 0) {
            container.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-history fa-3x"></i>
                    <p>No test history available yet.</p>
                    <button class="back-btn" onclick="window.location.href='../../list-tests.html'">
                        Take Your First Test
                    </button>
                </div>`;
            return;
        }

        const groupedTests = this.groupTestsByType(history);
        this.displayTestTypes(container, groupedTests);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    TestHistoryManager.init();
});

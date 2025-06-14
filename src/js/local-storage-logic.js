class TestStorageManager {
    static getUserName() {
        return localStorage.getItem('userName');
    }

    static setUserName(name) {
        localStorage.setItem('userName', name);
    }

    static saveTestResult(testResult) {
        let testHistory = this.getTestHistory();
        if (!Array.isArray(testHistory)) {
            testHistory = [];
        }
        
        // Add metadata
        testResult.savedAt = new Date().toISOString();
        testResult.resultId = this.generateResultId();
        
        // Add to beginning of history
        testHistory.unshift(testResult);
        
        // Keep only last 50 tests to manage storage space
        if (testHistory.length > 50) {
            testHistory = testHistory.slice(0, 50);
        }
        
        try {
            localStorage.setItem('testHistory', JSON.stringify(testHistory));
            return true;
        } catch (error) {
            console.error('Error saving test history:', error);
            // If storage fails, try removing older entries
            if (error.name === 'QuotaExceededError') {
                testHistory = testHistory.slice(0, 25);
                localStorage.setItem('testHistory', JSON.stringify(testHistory));
            }
            return false;
        }
    }

    static generateResultId() {
        return 'result_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    static getTestHistory() {
        try {
            const history = localStorage.getItem('testHistory');
            return history ? JSON.parse(history) : [];
        } catch (error) {
            console.error('Error reading test history:', error);
            return [];
        }
    }

    static clearHistory() {
        localStorage.removeItem('testHistory');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const testGrid = document.getElementById('testGrid');
    const searchInput = document.getElementById('searchTests');

    // Load and display tests
    async function loadTests() {
        try {
            const response = await fetch('../data/question-answers.json');
            const data = await response.json();
            displayTests(data.tests);
        } catch (error) {
            console.error('Error loading tests:', error);
        }
    }

    function displayTests(tests) {
        testGrid.innerHTML = tests.map(test => `
            <div class="test-card">
                <div class="test-header">
                    <div class="test-title">
                        <h2>${test.name}</h2>
                        <p class="test-description">${test.description}</p>
                    </div>
                    <span class="test-category">${test.category}</span>
                </div>
                <div class="test-stats">
                    <div class="stat-item">
                        <i class="fas fa-question-circle stat-icon"></i>
                        <span class="stat-value">${test.questions_per_exam} Questions</span>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-clock stat-icon"></i>
                        <span class="stat-value">${test.time_limit_minutes} Minutes</span>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-book stat-icon"></i>
                        <span class="stat-value">${test.categories.length} Categories</span>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-database stat-icon"></i>
                        <span class="stat-value">${test.total_questions_available} Total Questions</span>
                    </div>
                </div>
                <div class="test-action">
                    <button class="start-test-btn" onclick="window.location.href='take-test.html?id=${test.test_id}'">
                        Start Test <i class="fas fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        `).join('');

        // Add filter tags
        const filterTags = document.getElementById('filterTags');
        const categories = [...new Set(tests.map(test => test.category))];
        filterTags.innerHTML += categories.map(category => 
            `<span class="tag" onclick="filterByCategory('${category}')">${category}</span>`
        ).join('');
    }

    window.filterByCategory = function(category) {
        const searchInput = document.getElementById('searchTests');
        searchInput.value = category;
        searchInput.dispatchEvent(new Event('input'));
    }

    // Search functionality
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const testCards = document.querySelectorAll('.test-card');
            
            testCards.forEach(card => {
                const title = card.querySelector('h2').textContent.toLowerCase();
                const category = card.querySelector('.test-category').textContent.toLowerCase();
                
                if (title.includes(searchTerm) || category.includes(searchTerm)) {
                    card.style.display = 'block';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }

    // Initialize
    loadTests();
});

class TestManager {
    constructor() {
        this.currentTest = null;
        this.selectedQuestions = [];
        this.currentQuestionIndex = 0;
        this.userAnswers = [];
        this.timeRemaining = 0;
        this.timerInterval = null;
        this.testData = null;
    }

    async checkUserName() {
        const userName = localStorage.getItem('userName');
        if (!userName) {
            await this.showNamePrompt();
        }
        await this.initializeTest();
    }

    showNamePrompt() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'name-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <h2>Welcome!</h2>
                    <p>Please enter your full name to continue:</p>
                    <input type="text" id="userName" placeholder="Your full name" autocomplete="name">
                    <button id="submitName">Continue</button>
                </div>
            `;
            document.body.appendChild(modal);

            const input = modal.querySelector('#userName');
            const button = modal.querySelector('#submitName');

            const handleSubmit = () => {
                const name = input.value.trim();
                if (name) {
                    localStorage.setItem('userName', name);
                    modal.remove();
                    resolve();
                } else {
                    input.classList.add('error');
                    setTimeout(() => input.classList.remove('error'), 1000);
                }
            };

            button.addEventListener('click', handleSubmit);
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleSubmit();
            });
            input.focus();
        });
    }

    async initializeTest() {
        // Check for existing session
        const session = TestSession.getSession();
        if (session && session.testId === this.getTestIdFromUrl()) {
            // Resume existing session
            this.resumeSession(session);
            return;
        }

        // Start new test
        const testId = this.getTestIdFromUrl();
        try {
            const response = await fetch('../data/question-answers.json');
            const data = await response.json();
            this.currentTest = data.tests.find(test => test.test_id === testId);
            
            if (!this.currentTest) throw new Error('Test not found');

            this.selectedQuestions = this.selectBalancedQuestions();
            this.timeRemaining = this.currentTest.time_limit_minutes * 60;
            
            // Save initial session
            const now = new Date();
            const endTime = new Date(now.getTime() + this.timeRemaining * 1000);
            TestSession.saveSession({
                testId: this.currentTest.test_id,
                questions: this.selectedQuestions,
                timeLimit: this.timeRemaining,
                startTime: now.toISOString(),
                endTime: endTime.toISOString()
            });

            this.setupUI();
            this.startTimer();
        } catch (error) {
            console.error('Error initializing test:', error);
        }
    }

    resumeSession(session) {
        this.currentTest = { test_id: session.testId };
        this.selectedQuestions = session.questions;
        this.userAnswers = session.answers;
        this.currentQuestionIndex = session.currentIndex;
        this.timeRemaining = TestSession.getRemainingTime();

        // Restore selected answers
        if (session.selectedOptions) {
            this.userAnswers = new Array(this.selectedQuestions.length).fill(null);
            Object.entries(session.selectedOptions).forEach(([index, answer]) => {
                this.userAnswers[parseInt(index)] = answer;
            });
        }
        
        this.setupUI();
        this.startTimer();
    }

    selectBalancedQuestions() {
        const totalQuestionsNeeded = this.currentTest.questions_per_exam;
        const categories = this.currentTest.categories;
        let selectedQuestions = [];
        let usedQuestionIds = new Set(); // Track used questions

        // Calculate minimum questions per category
        const questionsPerCategory = Math.floor(totalQuestionsNeeded / categories.length);
        let remainingQuestions = totalQuestionsNeeded % categories.length;

        // First pass: select minimum questions from each category
        categories.forEach(category => {
            let availableQuestions = category.questions.filter(q => !usedQuestionIds.has(q.id));
            let questionsToSelect = questionsPerCategory;

            // Randomly select questions from this category
            while (questionsToSelect > 0 && availableQuestions.length > 0) {
                const randomIndex = Math.floor(Math.random() * availableQuestions.length);
                const selectedQuestion = availableQuestions[randomIndex];
                
                selectedQuestions.push({
                    ...selectedQuestion,
                    category: category.name
                });
                usedQuestionIds.add(selectedQuestion.id);
                availableQuestions.splice(randomIndex, 1);
                questionsToSelect--;
            }
        });

        // Second pass: distribute remaining questions
        while (remainingQuestions > 0) {
            // Get all available questions that haven't been used
            let allAvailableQuestions = categories
                .flatMap(category => 
                    category.questions
                        .filter(q => !usedQuestionIds.has(q.id))
                        .map(q => ({...q, category: category.name}))
                );

            if (allAvailableQuestions.length === 0) break;

            const randomIndex = Math.floor(Math.random() * allAvailableQuestions.length);
            const selectedQuestion = allAvailableQuestions[randomIndex];
            
            selectedQuestions.push(selectedQuestion);
            usedQuestionIds.add(selectedQuestion.id);
            remainingQuestions--;
        }

        return this.shuffleArray(selectedQuestions);
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    setupUI() {
        document.getElementById('testName').textContent = this.currentTest.name;
        document.getElementById('questionCount').textContent = 
            `Question ${this.currentQuestionIndex + 1}/${this.selectedQuestions.length}`;
        this.displayCurrentQuestion();
        this.updateNavigationButtons();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    displayCurrentQuestion() {
        const question = this.selectedQuestions[this.currentQuestionIndex];
        document.getElementById('currentQuestionNum').textContent = this.currentQuestionIndex + 1;
        document.getElementById('questionText').textContent = question.question;

        // Always shuffle options for every display (no caching)
        const shuffledOptions = this.shuffleArray([...question.options]);

        const optionsContainer = document.getElementById('optionsContainer');
        optionsContainer.innerHTML = shuffledOptions.map((option) => `
            <div class="option ${this.userAnswers[this.currentQuestionIndex] === option ? 'selected' : ''}" 
                 data-option="${this.escapeHtml(option)}">
                <code>${this.escapeHtml(option)}</code>
            </div>
        `).join('');

        this.updateProgressBar();
        this.attachOptionListeners();
    }

    attachOptionListeners() {
        document.querySelectorAll('.option').forEach(option => {
            option.addEventListener('click', () => {
                const optionValue = option.getAttribute('data-option');
                this.userAnswers[this.currentQuestionIndex] = optionValue;
                
                // Save the answer in session
                TestSession.saveAnswer(this.currentQuestionIndex, optionValue);
                
                document.querySelectorAll('.option').forEach(opt => opt.classList.remove('selected'));
                option.classList.add('selected');
                this.updateNavigationButtons();
            });
        });
    }

    updateProgressBar() {
        const progress = ((this.currentQuestionIndex + 1) / this.selectedQuestions.length) * 100;
        document.getElementById('progressBar').style.width = `${progress}%`;
    }

    
    updateNavigationButtons() {
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const submitBtn = document.getElementById('submitBtn');

        prevBtn.disabled = this.currentQuestionIndex === 0;
        nextBtn.style.display = this.currentQuestionIndex === this.selectedQuestions.length - 1 ? 'none' : 'block';
        submitBtn.style.display = this.currentQuestionIndex === this.selectedQuestions.length - 1 ? 'block' : 'none';
    }

    startTimer() {
        this.updateTimerDisplay();
        this.timerInterval = setInterval(() => {
            this.timeRemaining--;
            this.updateTimerDisplay();
            
            if (this.timeRemaining <= 0) {
                this.submitTest();
            }
            
            // Check session validity
            TestSession.autoSubmitIfExpired();
        }, 1000);
    }

    updateTimerDisplay() {
        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = this.timeRemaining % 60;
        document.getElementById('timer').innerHTML = 
            `<i class="fas fa-clock"></i> ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    submitTest() {
        clearInterval(this.timerInterval);
        const timeSpent = (this.currentTest.time_limit_minutes * 60) - this.timeRemaining;
        
        const results = {
            testId: this.currentTest.test_id,
            testName: this.currentTest.name,
            timeSpent: timeSpent,
            totalQuestions: this.selectedQuestions.length,
            answers: this.userAnswers,
            questions: this.selectedQuestions.map(q => ({
                question: q.question,
                options: q.options,
                answer: q.answer,
                category: q.category
            })),
            timestamp: new Date().toISOString(),
            userName: localStorage.getItem('userName') || 'Anonymous'
        };

        try {
            // Save current test result
            localStorage.setItem('currentTestResult', JSON.stringify(results));
            
            // Save to history
            TestStorageManager.saveTestResult(results);
            
            window.location.href = 'result/see-result.html';
        } catch (error) {
            console.error('Error submitting test:', error);
            alert('There was an error submitting your test. Please try again.');
        }

        TestSession.clearSession();
    }

    // Add method to handle answer selection
    handleAnswerSelection(answer) {
        this.userAnswers[this.currentQuestionIndex] = answer;
        TestSession.saveAnswer(this.currentQuestionIndex, answer);
    }

    // Get test ID from URL
    getTestIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('id');
    }
}

// Initialize test manager when on take-test page
if (window.location.pathname.includes('take-test.html')) {
    window.testManager = new TestManager();
    
    // Add event listeners for navigation
    document.getElementById('prevBtn')?.addEventListener('click', () => {
        window.testManager.currentQuestionIndex--;
        window.testManager.setupUI();
    });

    document.getElementById('nextBtn')?.addEventListener('click', () => {
        window.testManager.currentQuestionIndex++;
        window.testManager.setupUI();
    });

    document.getElementById('submitBtn')?.addEventListener('click', () => {
        if (confirm('Are you sure you want to submit the test?')) {
            window.testManager.submitTest();
        }
    });
}

// Results page handling
if (window.location.pathname.includes('see-result.html')) {
    document.addEventListener('DOMContentLoaded', () => {
        const currentResult = JSON.parse(localStorage.getItem('currentTestResult'));
        if (currentResult) {
            const correctCount = currentResult.questions.reduce((count, q, index) => 
                count + (currentResult.answers[index] === q.answer ? 1 : 0), 0);
            const percentage = Math.round((correctCount / currentResult.totalQuestions) * 100);

            // Update score text
            document.getElementById('scorePercentage').textContent = `${percentage}%`;
            
            // Update progress circle
            const circle = document.querySelector('.score-circle');
            const angle = (percentage / 100) * 360;
            const endX = 50 + 50 * Math.cos((angle - 90) * Math.PI / 180);
            const endY = 50 + 50 * Math.sin((angle - 90) * Math.PI / 180);
            
            circle.style.setProperty('--end-x', endX + '%');
            circle.style.setProperty('--end-y', endY + '%');

            // Color based on score
            let color = '#dc2626'; // red for low score
            if (percentage >= 80) color = '#059669'; // green for high score
            else if (percentage >= 60) color = '#d97706'; // yellow for medium score
            
            circle.style.setProperty('--primary-color', color);

            // Update other stats
            document.getElementById('correctAnswers').textContent = 
                `${correctCount}/${currentResult.totalQuestions}`;
            document.getElementById('timeTaken').textContent = 
                `${Math.floor(currentResult.timeSpent / 60)}:${String(currentResult.timeSpent % 60).padStart(2, '0')}`;
        }
    });
}
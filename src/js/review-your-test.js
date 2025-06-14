document.addEventListener('DOMContentLoaded', () => {
    const reviewData = JSON.parse(localStorage.getItem('currentTestResult'));
    if (!reviewData) {
        window.location.href = '../list-tests.html';
        return;
    }

    // Update summary counts
    const correctCount = reviewData.questions.reduce((count, q, index) => 
        count + (reviewData.answers[index] === q.answer ? 1 : 0), 0);
    const incorrectCount = reviewData.answers.filter(a => a).length - correctCount;
    const unattemptedCount = reviewData.questions.length - reviewData.answers.filter(a => a).length;

    document.getElementById('correctCount').textContent = correctCount;
    document.getElementById('incorrectCount').textContent = incorrectCount;
    document.getElementById('unattemptedCount').textContent = unattemptedCount;

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Display questions
    const questionsContainer = document.getElementById('questionsContainer');
    questionsContainer.innerHTML = reviewData.questions.map((question, index) => {
        const userAnswer = reviewData.answers[index];
        const isCorrect = userAnswer === question.answer;
        const status = !userAnswer ? 'unattempted' : (isCorrect ? 'correct' : 'incorrect');

        return `
            <div class="question-card">
                <div class="question-status status-${status}">
                    ${status.charAt(0).toUpperCase() + status.slice(1)}
                </div>
                <div class="question-text">
                    <strong>Q${index + 1}.</strong> ${escapeHtml(question.question)}
                </div>
                <div class="options-list">
                    ${question.options.map(option => `
                        <div class="option ${option === userAnswer ? 'selected' : ''} 
                                         ${option === question.answer ? 'correct' : ''}">
                            <span class="option-status">
                                ${getOptionIcon(option, userAnswer, question.answer)}
                            </span>
                            <code>${escapeHtml(option)}</code>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
});

function getOptionIcon(option, userAnswer, correctAnswer) {
    if (option === correctAnswer) {
        return '<i class="fas fa-check" style="color: var(--correct-color)"></i>';
    }
    if (option === userAnswer && userAnswer !== correctAnswer) {
        return '<i class="fas fa-times" style="color: var(--incorrect-color)"></i>';
    }
    return '';
}

const SPREADSHEET_URL = 'https://script.google.com/macros/s/AKfycbyALjRevzArTAVSQ31umLSq9FVS1A2C2v4Z86fTaEllgxDYuGOf9umQBwlgaCJT2Liw/exec';

// --- 共通の処理 ---
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('question-list')) {
    initListPage();
  } else if (document.getElementById('question-card')) {
    initQuestionPage();
  }
});

async function fetchAllQuestions() {
  const cachedData = sessionStorage.getItem('quizData');
  if (cachedData) {
    return JSON.parse(cachedData);
  }
  try {
    const response = await fetch(SPREADSHEET_URL);
    if (!response.ok) throw new Error('データの取得に失敗しました');
    const data = await response.json();
    const dataWithIndex = data.map((q, index) => ({ ...q, originalIndex: index }));
    sessionStorage.setItem('quizData', JSON.stringify(dataWithIndex));
    return dataWithIndex;
  } catch (error) {
    console.error(error);
    alert(error.message);
    return [];
  }
}

function markdownToHtml(text) {
  if (!text) return '';
  return text
    .replace(/^\* (.*$)/gim, '<ul><li>$1</li></ul>')
    .replace(/<\/ul><ul>/g, '')
    .replace(/\n/g, '<br>');
}

// --- 問題一覧ページの処理 ---
function initListPage() {
  // 問題一覧ページに来たら、回答履歴をリセットする
  sessionStorage.removeItem('answeredIndices');
  displayQuestionList();
}

async function displayQuestionList() {
  const questionListEl = document.getElementById('question-list');
  const questions = await fetchAllQuestions();
  
  const questionsByCategory = questions.reduce((acc, q) => {
    const category = q.category || '未分類';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(q);
    return acc;
  }, {});

  if (Object.keys(questionsByCategory).length > 0) {
    questionListEl.innerHTML = '';
    for (const category in questionsByCategory) {
      const header = document.createElement('h2');
      header.className = 'category-header';
      header.textContent = category;
      questionListEl.appendChild(header);

      questionsByCategory[category].forEach(q => {
        const link = document.createElement('a');
        link.href = `index.html?q=${q.originalIndex}`;
        link.textContent = q.title;
        questionListEl.appendChild(link);
      });
    }
  } else {
    questionListEl.innerHTML = '<p>問題の読み込みに失敗しました。</p>';
  }
}

// --- 問題回答ページの処理 ---
let allQuestions = [];
let currentQuestionIndex = -1; // 未設定状態
let isTrueQuestion = false;

function getAnsweredIndices() {
  const answered = sessionStorage.getItem('answeredIndices');
  return answered ? JSON.parse(answered) : [];
}

function markQuestionAsAnswered(index) {
  let answered = getAnsweredIndices();
  if (!answered.includes(index)) {
    answered.push(index);
    sessionStorage.setItem('answeredIndices', JSON.stringify(answered));
  }
}

// ★★ ここが最重要修正ポイントです ★★
async function initQuestionPage() {
  allQuestions = await fetchAllQuestions();
  if (allQuestions.length === 0) return;

  const params = new URLSearchParams(window.location.search);
  const qIndex = parseInt(params.get('q'), 10);

  // URLに有効な問題番号(?q=...)があるかチェック
  if (!isNaN(qIndex) && allQuestions.some(q => q.originalIndex === qIndex)) {
    // URLで指定された問題から開始する場合
    // これがセッションの開始なので、回答履歴をクリアする
    sessionStorage.setItem('answeredIndices', JSON.stringify([]));
    loadQuestion(qIndex);
  } else {
    // URLで問題が指定されていない場合は、一覧ページにリダイレクトする
    alert('問題が指定されていません。一覧ページから問題を選択してください。');
    window.location.href = 'list.html';
    return;
  }
  
  // イベントリスナーの設定
  document.getElementById('btn-true').addEventListener('click', () => handleAnswer(true));
  document.getElementById('btn-false').addEventListener('click', () => handleAnswer(false));
  document.getElementById('next-question-btn').addEventListener('click', loadNextQuestion);
  document.getElementById('back-to-list-btn').addEventListener('click', () => {
    window.location.href = 'list.html';
  });
}

function loadQuestion(index) {
  resetState();
  const question = allQuestions.find(q => q.originalIndex === index);
  if (!question) {
    alert('問題の読み込みに失敗しました。一覧に戻ります。');
    window.location.href = 'list.html';
    return;
  }
  
  currentQuestionIndex = index;
  
  const answeredCount = getAnsweredIndices().length;
  document.getElementById('question-number').textContent = `問題 ${answeredCount + 1}`;
  
  document.getElementById('category-text').textContent = question.category;
  isTrueQuestion = Math.random() < 0.5;
  document.getElementById('question-text').textContent = isTrueQuestion ? question.question_true : question.question_false;
}

function handleAnswer(userAnswer) {
  // 回答する前に、現在の問題がまだ回答済みリストになければ追加する
  // (ページをリロードして同じ問題に再回答した場合などに対応)
  markQuestionAsAnswered(currentQuestionIndex);

  const question = allQuestions.find(q => q.originalIndex === currentQuestionIndex);
  const isCorrect = (isTrueQuestion && userAnswer) || (!isTrueQuestion && !userAnswer);

  const resultCardEl = document.getElementById('result-card');
  const resultTextEl = document.getElementById('result-text');

  resultCardEl.classList.remove('correct', 'incorrect');
  if (isCorrect) {
    resultTextEl.textContent = '正解！';
    resultTextEl.className = 'correct';
    resultCardEl.classList.add('correct');
  } else {
    resultTextEl.textContent = '間違い';
    resultTextEl.className = 'incorrect';
    resultCardEl.classList.add('incorrect');
  }
  
  document.getElementById('explanation-text').innerHTML = markdownToHtml(question.explanation);
  resultCardEl.style.display = 'block';

  document.getElementById('btn-true').disabled = true;
  document.getElementById('btn-false').disabled = true;
  document.getElementById(userAnswer ? 'btn-false' : 'btn-true').classList.add('disabled');
  
  document.getElementById('nav-buttons').style.display = 'flex';

  const nextQuestion = findNextRandomQuestion();
  if (!nextQuestion) {
    document.getElementById('next-question-btn').style.display = 'none';
  } else {
    document.getElementById('next-question-btn').style.display = 'block';
  }
}

function findNextRandomQuestion() {
  const currentQuestion = allQuestions.find(q => q.originalIndex === currentQuestionIndex);
  if (!currentQuestion) return null;

  const currentCategory = currentQuestion.category;
  const answered = getAnsweredIndices();
  
  const unansweredInCategory = allQuestions.filter(q => 
    q.category === currentCategory && !answered.includes(q.originalIndex)
  );

  if (unansweredInCategory.length === 0) {
    return null;
  }
  
  return unansweredInCategory[Math.floor(Math.random() * unansweredInCategory.length)];
}

function loadNextQuestion() {
  const nextQuestion = findNextRandomQuestion();
  if (nextQuestion) {
    history.pushState(null, '', `?q=${nextQuestion.originalIndex}`);
    loadQuestion(nextQuestion.originalIndex);
  }
}

function resetState() {
  document.getElementById('result-card').style.display = 'none';
  document.getElementById('nav-buttons').style.display = 'none';
  const btnTrue = document.getElementById('btn-true');
  const btnFalse = document.getElementById('btn-false');
  btnTrue.disabled = false;
  btnFalse.disabled = false;
  btnTrue.classList.remove('disabled');
  btnFalse.classList.remove('disabled');
}
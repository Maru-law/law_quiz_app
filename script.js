// Step1で取得したGASのウェブアプリURLをここに貼り付けます
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
    // 元のインデックスを各問題に付与しておく
    const dataWithIndex = data.map((q, index) => ({ ...q, originalIndex: index }));
    sessionStorage.setItem('quizData', JSON.stringify(dataWithIndex));
    return dataWithIndex;
  } catch (error) {
    console.error(error);
    alert(error.message);
    return [];
  }
}

// --- 問題一覧ページの処理 ---
async function initListPage() {
  const questionListEl = document.getElementById('question-list');
  const questions = await fetchAllQuestions();
  
  // カテゴリごとに問題をグループ化
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
      // カテゴリヘッダーを作成
      const header = document.createElement('h2');
      header.className = 'category-header';
      header.textContent = category;
      questionListEl.appendChild(header);

      // カテゴリ内の問題をリスト表示
      questionsByCategory[category].forEach(q => {
        const link = document.createElement('a');
        link.href = `index.html?q=${q.originalIndex}`;
        link.textContent = q.title; // 表示を「title」に変更
        questionListEl.appendChild(link);
      });
    }
  } else {
    questionListEl.innerHTML = '<p>問題の読み込みに失敗しました。</p>';
  }
}

// --- 問題回答ページの処理 ---
let allQuestions = [];
let currentQuestionIndex = 0;
let isTrueQuestion = false;

// 回答済みの問題インデックスを管理する
function getAnsweredIndices() {
  const answered = sessionStorage.getItem('answeredIndices');
  return answered ? JSON.parse(answered) : [];
}

function markQuestionAsAnswered(index) {
  const answered = getAnsweredIndices();
  if (!answered.includes(index)) {
    answered.push(index);
    sessionStorage.setItem('answeredIndices', JSON.stringify(answered));
  }
}

async function initQuestionPage() {
  allQuestions = await fetchAllQuestions();
  if (allQuestions.length === 0) return;

  const params = new URLSearchParams(window.location.search);
  const qIndex = parseInt(params.get('q'), 10);
  
  // URLに指定があればその問題、なければランダムな未回答問題を開始
  if (!isNaN(qIndex) && qIndex >= 0 && qIndex < allQuestions.length) {
    currentQuestionIndex = qIndex;
  } else {
    // ランダムスタート
    const answered = getAnsweredIndices();
    const unanswered = allQuestions.filter(q => !answered.includes(q.originalIndex));
    if (unanswered.length > 0) {
      currentQuestionIndex = unanswered[Math.floor(Math.random() * unanswered.length)].originalIndex;
    } else {
      // 全問回答済みの場合
      alert("すべての問題に回答済みです！お疲れ様でした。");
      window.location.href = 'list.html';
      return;
    }
  }
  
  loadQuestion(currentQuestionIndex);
  
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
  if (!question) return;
  
  currentQuestionIndex = index;
  
  document.getElementById('category-display').textContent = question.category;
  document.getElementById('question-number').textContent = `問題 ${index + 1}`;
  isTrueQuestion = Math.random() < 0.5;
  document.getElementById('question-text').textContent = isTrueQuestion ? question.question_true : question.question_false;
}

function handleAnswer(userAnswer) {
  const question = allQuestions.find(q => q.originalIndex === currentQuestionIndex);
  markQuestionAsAnswered(currentQuestionIndex);

  const isCorrect = (isTrueQuestion && userAnswer) || (!isTrueQuestion && !userAnswer);

  const resultCardEl = document.getElementById('result-card');
  const resultTextEl = document.getElementById('result-text');
  const correctnessStatementEl = document.getElementById('correctness-statement');

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
  
  correctnessStatementEl.textContent = isTrueQuestion ? 'この文章は正しいです。' : 'この文章は誤っています。';
  document.getElementById('explanation-text').textContent = question.explanation;
  resultCardEl.style.display = 'block';

  document.getElementById('btn-true').disabled = true;
  document.getElementById('btn-false').disabled = true;
  document.getElementById(userAnswer ? 'btn-false' : 'btn-true').classList.add('disabled');
  
  document.getElementById('nav-buttons').style.display = 'flex';

  // 同じカテゴリ内で未回答の問題があるかチェック
  const nextQuestion = findNextRandomQuestion();
  if (!nextQuestion) {
    document.getElementById('next-question-btn').style.display = 'none';
  } else {
    document.getElementById('next-question-btn').style.display = 'block';
  }
}

// 同じカテゴリから、未回答の問題をランダムに探す
function findNextRandomQuestion() {
  const currentCategory = allQuestions.find(q => q.originalIndex === currentQuestionIndex).category;
  const answered = getAnsweredIndices();
  
  const unansweredInCategory = allQuestions.filter(q => 
    q.category === currentCategory && !answered.includes(q.originalIndex)
  );

  if (unansweredInCategory.length === 0) {
    return null;
  }
  
  const nextQuestion = unansweredInCategory[Math.floor(Math.random() * unansweredInCategory.length)];
  return nextQuestion;
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
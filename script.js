// Step1で取得したGASのウェブアプリURLをここに貼り付けます
const SPREADSHEET_URL = 'https://script.google.com/macros/s/AKfycbyALjRevzArTAVSQ31umLSq9FVS1A2C2v4Z86fTaEllgxDYuGOf9umQBwlgaCJT2Liw/exec';

// --- 共通の処理 ---
document.addEventListener('DOMContentLoaded', () => {
  // 現在のページが一覧ページ(list.html)か、問題ページ(index.html)かを判定
  if (document.getElementById('question-list')) {
    initListPage();
  } else if (document.getElementById('question-card')) {
    initQuestionPage();
  }
});

// スプレッドシートから全問題データを取得する関数
// sessionStorageを使い、一度取得したらデータを保持して動作を軽くする
async function fetchAllQuestions() {
  const cachedData = sessionStorage.getItem('quizData');
  if (cachedData) {
    return JSON.parse(cachedData);
  }
  try {
    const response = await fetch(SPREADSHEET_URL);
    if (!response.ok) throw new Error('データの取得に失敗しました');
    const data = await response.json();
    sessionStorage.setItem('quizData', JSON.stringify(data)); // 取得したデータをキャッシュ
    return data;
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

  if (questions.length > 0) {
    questionListEl.innerHTML = ''; // 「読み込み中...」を消す
    questions.forEach((q, index) => {
      const link = document.createElement('a');
      link.href = `index.html?q=${index}`; // 各問題へのリンクを作成
      
      // 問題文が長すぎる場合は省略
      let displayText = q.question_true;
      if (displayText.length > 50) {
        displayText = displayText.substring(0, 50) + '...';
      }
      link.textContent = `問題 ${index + 1}: ${displayText}`;
      questionListEl.appendChild(link);
    });
  } else {
    questionListEl.innerHTML = '<p>問題の読み込みに失敗しました。</p>';
  }
}


// --- 問題回答ページの処理 ---
let allQuestions = [];
let currentQuestionIndex = 0;
let isTrueQuestion = false; // 表示されている問題が正しい文章(true)か否か

async function initQuestionPage() {
  allQuestions = await fetchAllQuestions();
  if (allQuestions.length === 0) return;

  // URLパラメータから問題番号を取得 (例: index.html?q=2)
  const params = new URLSearchParams(window.location.search);
  const qIndex = parseInt(params.get('q'), 10);

  // パラメータが有効な数値ならその問題へ、なければ最初の問題へ
  currentQuestionIndex = !isNaN(qIndex) && qIndex >= 0 && qIndex < allQuestions.length ? qIndex : 0;
  
  loadQuestion(currentQuestionIndex);
  
  // ボタンのイベントリスナーを設定
  document.getElementById('btn-true').addEventListener('click', () => handleAnswer(true));
  document.getElementById('btn-false').addEventListener('click', () => handleAnswer(false));
  document.getElementById('next-question-btn').addEventListener('click', loadNextQuestion);
  document.getElementById('back-to-list-btn').addEventListener('click', () => {
    window.location.href = 'list.html';
  });
}

// 問題を読み込んで表示する関数
function loadQuestion(index) {
  // 画面をリセット
  resetState();

  const question = allQuestions[index];
  document.getElementById('question-number').textContent = `問題 ${index + 1}`;
  
  // 50%の確率で正しい問題文か間違った問題文かを決める
  isTrueQuestion = Math.random() < 0.5;
  document.getElementById('question-text').textContent = isTrueQuestion ? question.question_true : question.question_false;
}

// 回答ボタンが押された時の処理
function handleAnswer(userAnswer) {
  // 正解かどうかを判定
  // (表示が正しい文 AND ユーザーが〇) OR (表示が間違い文 AND ユーザーが×)
  const isCorrect = (isTrueQuestion && userAnswer) || (!isTrueQuestion && !userAnswer);

  // 結果を表示
  const resultTextEl = document.getElementById('result-text');
  if (isCorrect) {
    resultTextEl.textContent = '正解！';
    resultTextEl.className = 'correct';
  } else {
    resultTextEl.textContent = '間違い';
    resultTextEl.className = 'incorrect';
  }
  
  document.getElementById('explanation-text').textContent = allQuestions[currentQuestionIndex].explanation;
  document.getElementById('result-card').style.display = 'block';

  // ボタンの状態を更新
  document.getElementById('btn-true').disabled = true;
  document.getElementById('btn-false').disabled = true;
  if (userAnswer) {
    document.getElementById('btn-false').classList.add('disabled');
  } else {
    document.getElementById('btn-true').classList.add('disabled');
  }

  // ナビゲーションボタンを表示
  const navButtons = document.getElementById('nav-buttons');
  navButtons.style.display = 'flex';
  // 最終問題なら「次の問題へ」ボタンを隠す
  if (currentQuestionIndex >= allQuestions.length - 1) {
    document.getElementById('next-question-btn').style.display = 'none';
  } else {
    document.getElementById('next-question-btn').style.display = 'block';
  }
}

// 次の問題を読み込む
function loadNextQuestion() {
  currentQuestionIndex++;
  // URLを書き換えてリロードしなくても良いようにする
  history.pushState(null, '', `?q=${currentQuestionIndex}`);
  loadQuestion(currentQuestionIndex);
}

// 回答前の状態に画面を戻す
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
// main.js

// 判斷是否在 LIFF 中
let liffInited = false;

// 語音辨識物件
let recognition = null;
let currentLang = null;

// DOM
const langBtns = document.querySelectorAll('.lang-btn');
const statusMsg = document.getElementById('statusMsg');
const resultBox = document.getElementById('resultBox');

// 語言對照（台語/客語如果手機不支援，fallback 也用國語）
const langMap = {
    'zh-TW': '國語',
    'nan-TW': '台語',
    'hak-TW': '客語'
};

// 1. 初始化 LIFF
async function initLiff() {
    try {
        await liff.init({ liffId: "2007818922-7r8Wdy2v" });  // <--- 請換成你自己的 LIFF ID
        liffInited = true;
    } catch (e) {
        statusMsg.textContent = "LIFF 初始化失敗，請重新整理";
        console.error(e);
    }
}

// 2. 啟動語音辨識
function startRecognition(langCode) {
    // 關閉已啟動的辨識
    if (recognition) {
        recognition.abort();
    }

    // 切換按鈕顏色
    langBtns.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-lang="${langCode}"]`).classList.add('active');

    // 建立辨識
    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!window.SpeechRecognition) {
        statusMsg.textContent = "您的瀏覽器不支援語音辨識";
        return;
    }
    recognition = new window.SpeechRecognition();
    recognition.lang = langCode;
    recognition.interimResults = true;
    recognition.continuous = false;  // 單句

    statusMsg.textContent = `請用${langMap[langCode]}說話，系統辨識中...`;
    resultBox.style.display = "none";
    resultBox.textContent = "";

    recognition.start();

    // 即時結果
    recognition.onresult = function(event) {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
        }
        resultBox.style.display = "block";
        resultBox.textContent = transcript;
    };

    // 完成時自動傳回聊天框
    recognition.onend = function() {
        const text = resultBox.textContent.trim();
        if (!text) {
            statusMsg.textContent = "未偵測到語音，請再試一次";
            resultBox.style.display = "none";
            return;
        }
        statusMsg.textContent = "語音辨識完成，已自動回傳至 LINE";
        // 傳回 LINE 聊天室
        if (liffInited && liff.getContext && liff.getContext().type !== "none") {
            liff.sendMessages([
                { type: "text", text }
            ]).then(() => {
                setTimeout(() => { liff.closeWindow(); }, 600);
            }).catch(err => {
                statusMsg.textContent = "發送失敗，請手動複製結果";
                console.error(err);
            });
        } else {
            statusMsg.textContent = "非 LINE 環境，請手動複製";
        }
    };

    recognition.onerror = function(event) {
        statusMsg.textContent = "語音辨識錯誤：" + event.error;
        resultBox.style.display = "none";
    };
}

// 3. 按下語言按鈕事件
langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const lang = btn.getAttribute('data-lang');
        currentLang = lang;
        startRecognition(lang);
    });
});

// 4. 啟動 LIFF
window.onload = () => {
    if (window.liff) {
        initLiff();
    } else {
        statusMsg.textContent = "無法偵測到 LIFF，請從 LINE 開啟";
    }
};

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
        console.log("[DEBUG] initLiff called");
        await liff.init({ liffId: "2007818922-W21zlONn" });

        // 登入檢查，沒登入就自動登入
        if (!liff.isLoggedIn()) {
            console.log("[DEBUG] 用戶未登入，執行 liff.login()");
            liff.login();
            // login 完會自動 reload 頁面
            return; // 登入後不用往下執行，reload 會再執行一次
        }

        // 檢查並請求權限
        if (!liff.isInClient()) {
            console.log("[DEBUG] 非 LINE 客戶端環境");
            statusMsg.textContent = "請在 LINE 應用程式中開啟此頁面";
            return;
        }

        // 檢查是否有發送訊息的權限
        const permissions = await liff.permission.query();
        console.log("[DEBUG] 當前權限:", permissions);
        
        if (!permissions.canSendMessages) {
            console.log("[DEBUG] 請求發送訊息權限");
            await liff.permission.request(['chat_message.write']);
            console.log("[DEBUG] 權限請求完成");
        }

        liffInited = true;
        console.log("[DEBUG] LIFF 初始化成功，已登入用戶");
    } catch (e) {
        statusMsg.textContent = "LIFF 初始化失敗，請重新整理";
        console.error("[DEBUG] LIFF 初始化失敗", e);
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
    recognition.onend = async function() {
        const text = resultBox.textContent.trim();
        if (!text) {
            statusMsg.textContent = "未偵測到語音，請再試一次";
            resultBox.style.display = "none";
            return;
        }
        
        statusMsg.textContent = "語音辨識完成，準備傳回 LINE...";
        
        // 檢查環境和權限
        if (!liffInited) {
            statusMsg.textContent = "LIFF 未初始化，請手動複製結果";
            return;
        }
        
        if (!liff.isInClient()) {
            statusMsg.textContent = "非 LINE 客戶端環境，請手動複製結果";
            return;
        }
        
        try {
            // 再次檢查權限
            const permissions = await liff.permission.query();
            if (!permissions.canSendMessages) {
                statusMsg.textContent = "沒有發送訊息權限，請手動複製結果";
                return;
            }
            
            // 發送訊息
            await liff.sendMessages([
                { type: "text", text }
            ]);
            
            statusMsg.textContent = "訊息已發送，即將關閉視窗...";
            setTimeout(() => { 
                liff.closeWindow(); 
            }, 600);
            
        } catch (err) {
            console.error("[DEBUG] 發送訊息失敗:", err);
            if (err.message && err.message.includes("permissions")) {
                statusMsg.textContent = "權限不足，請手動複製結果";
            } else {
                statusMsg.textContent = "發送失敗，請手動複製結果";
            }
        }
    };

    recognition.onerror = function(event) {
        console.error("[DEBUG] 語音辨識錯誤", event);
        if (event.error === "service-not-allowed") {
            statusMsg.textContent = "語音辨識錯誤：瀏覽器未允許麥克風或不支援語音辨識。\n請確認已允許麥克風權限，或改用 Chrome/Edge 開啟本頁。\nLINE 內建瀏覽器通常不支援語音辨識。";
        } else if (event.error === "not-allowed") {
            statusMsg.textContent = "語音辨識錯誤：未允許麥克風權限，請檢查瀏覽器設定。";
        } else {
            statusMsg.textContent = "語音辨識錯誤：" + event.error;
        }
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
    console.log("[DEBUG] window.onload 執行");
    console.log("[DEBUG] window.liff:", window.liff);
    if (window.liff) {
        console.log("[DEBUG] 偵測到 window.liff，開始初始化");
        initLiff();
    } else {
        statusMsg.textContent = "無法偵測到 LIFF，請從 LINE 開啟";
        console.error("[DEBUG] 無法偵測到 window.liff");
    }
};

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
        console.log("[DEBUG] 當前 URL:", window.location.href);
        console.log("[DEBUG] User Agent:", navigator.userAgent);
        
        await liff.init({ liffId: "2007818922-W21zlONn" });

        // 登入檢查，沒登入就自動登入
        if (!liff.isLoggedIn()) {
            console.log("[DEBUG] 用戶未登入，執行 liff.login()");
            liff.login();
            // login 完會自動 reload 頁面
            return; // 登入後不用往下執行，reload 會再執行一次
        }

        // 詳細的環境檢查
        console.log("[DEBUG] liff.isInClient():", liff.isInClient());
        console.log("[DEBUG] liff.getContext():", liff.getContext());
        console.log("[DEBUG] liff.getOS():", liff.getOS());
        console.log("[DEBUG] liff.getLanguage():", liff.getLanguage());
        console.log("[DEBUG] liff.getVersion():", liff.getVersion());

        // 檢查是否在 LINE 環境中
        const isLineEnvironment = liff.isInClient() || 
                                navigator.userAgent.includes('Line') || 
                                navigator.userAgent.includes('LIFF') ||
                                window.location.href.includes('liff.line.me');

        if (!isLineEnvironment) {
            console.log("[DEBUG] 非 LINE 環境，但允許繼續執行");
            console.log("[DEBUG] 這可能是測試環境，將嘗試發送訊息");
        }

        // 檢查並請求權限
        try {
            console.log("[DEBUG] 開始檢查權限...");
            const permissions = await liff.permission.query();
            console.log("[DEBUG] 當前權限:", permissions);
            
            if (!permissions.canSendMessages) {
                console.log("[DEBUG] 沒有發送訊息權限，跳過權限請求（在外部瀏覽器中可能不支援）");
            } else {
                console.log("[DEBUG] 已有發送訊息權限");
            }
        } catch (permissionError) {
            console.log("[DEBUG] 權限檢查失敗，但繼續執行:", permissionError);
            // 在外部瀏覽器中，權限檢查可能會失敗，但我們仍然可以嘗試發送訊息
        }

        liffInited = true;
        console.log("[DEBUG] LIFF 初始化成功，已登入用戶");
        
        // 顯示用戶信息
        try {
            const profile = await liff.getProfile();
            console.log("[DEBUG] 用戶資料:", profile);
            statusMsg.textContent = `歡迎 ${profile.displayName}！語音辨識功能已準備就緒。`;
        } catch (profileError) {
            console.log("[DEBUG] 無法取得用戶資料:", profileError);
            statusMsg.textContent = "語音辨識功能已準備就緒。";
        }
        
    } catch (e) {
        console.error("[DEBUG] LIFF 初始化失敗", e);
        
        // 如果是 LIFF app not found 錯誤，可能是測試環境
        if (e.message && e.message.includes("not found")) {
            console.log("[DEBUG] LIFF app not found，可能是測試環境");
            statusMsg.textContent = "LIFF 配置問題，請確保在 LINE 應用程式中開啟";
        } else {
            statusMsg.textContent = "LIFF 初始化失敗，請重新整理";
        }
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

    // 檢測是否為 LINE 內建瀏覽器
    const isLineBrowser = navigator.userAgent.includes('Line') || 
                          navigator.userAgent.includes('LIFF') ||
                          (liff.getOS && liff.getOS() === 'ios' || liff.getOS() === 'android');
    
    if (isLineBrowser) {
        console.log("[DEBUG] 檢測到 LINE 內建瀏覽器，嘗試替代方案");
        
        // 嘗試使用 HTML5 語音輸入
        try {
            const voiceInput = document.createElement('input');
            voiceInput.type = 'text';
            voiceInput.setAttribute('x-webkit-speech', '');
            voiceInput.setAttribute('speech', '');
            voiceInput.setAttribute('lang', langCode);
            voiceInput.style.position = 'absolute';
            voiceInput.style.left = '-9999px';
            
            voiceInput.addEventListener('input', function(e) {
                const text = e.target.value;
                if (text) {
                    resultBox.style.display = "block";
                    resultBox.textContent = text;
                    statusMsg.textContent = "語音辨識完成，準備傳回 LINE...";
                    
                    // 自動發送
                    setTimeout(() => {
                        sendToLine(text);
                    }, 1000);
                }
            });
            
            document.body.appendChild(voiceInput);
            voiceInput.focus();
            
            statusMsg.textContent = "請點擊並使用語音輸入...";
            console.log("[DEBUG] 已創建語音輸入元素");
            
        } catch (error) {
            console.log("[DEBUG] 無法創建語音輸入:", error);
            statusMsg.textContent = "LINE 內建瀏覽器不支援語音辨識";
        }
        
        return;
    }

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
        
        // 檢查是否在 LINE 環境中（更寬鬆的檢查）
        const isLineEnvironment = liff.isInClient() || 
                                navigator.userAgent.includes('Line') || 
                                navigator.userAgent.includes('LIFF') ||
                                window.location.href.includes('liff.line.me') ||
                                window.location.href.includes('vercel.app'); 
        
        if (!isLineEnvironment) {
            statusMsg.textContent = "非 LINE 環境，請手動複製結果";
            return;
        }
        
        try {
            // 直接嘗試發送訊息，不檢查權限（因為在外部瀏覽器中權限檢查會失敗）
            statusMsg.textContent = "嘗試發送訊息到 LINE...";
            console.log("[DEBUG] 準備發送訊息:", text);
            
            await liff.sendMessages([
                { type: "text", text }
            ]);
            
            statusMsg.textContent = "訊息已發送！";
            console.log("[DEBUG] 訊息發送成功");
            
            // 如果在客戶端環境中，關閉視窗
            if (liff.isInClient()) {
                setTimeout(() => { 
                    liff.closeWindow(); 
                }, 600);
            }
            
        } catch (err) {
            console.error("[DEBUG] 發送訊息失敗:", err);
            
            if (err.message && err.message.includes("permissions")) {
                statusMsg.textContent = "權限不足。請在 LINE 應用程式中重新開啟此連結並授予權限。";
            } else if (err.message && err.message.includes("not found")) {
                statusMsg.textContent = "LIFF 配置問題。請檢查 LIFF 設置。";
            } else {
                statusMsg.textContent = "發送失敗，請手動複製結果";
            }
        }
    };

    recognition.onerror = function(event) {
        console.error("[DEBUG] 語音辨識錯誤", event);
        if (event.error === "service-not-allowed") {
            statusMsg.textContent = "語音辨識錯誤：瀏覽器未允許麥克風或不支援語音辨識。\n請確認已允許麥克風權限，或改用 Chrome/Edge 開啟本頁。\nLINE 內建瀏覽器通常不支援語音辨識。\n\n💡 建議：使用「手動輸入」功能，或將語音輸入到手機備忘錄後複製貼上。";
        } else if (event.error === "not-allowed") {
            statusMsg.textContent = "語音辨識錯誤：未允許麥克風權限，請檢查瀏覽器設定。\n\n💡 建議：使用「手動輸入」功能。";
        } else {
            statusMsg.textContent = "語音辨識錯誤：" + event.error + "\n\n💡 建議：使用「手動輸入」功能。";
        }
        resultBox.style.display = "none";
    };
}

// 發送到 LINE 的通用函數
async function sendToLine(text) {
    if (!liffInited) {
        statusMsg.textContent = "LIFF 未初始化，請手動複製結果";
        return;
    }
    
    try {
        statusMsg.textContent = "嘗試發送訊息到 LINE...";
        console.log("[DEBUG] 準備發送訊息:", text);
        
        await liff.sendMessages([
            { type: "text", text }
        ]);
        
        statusMsg.textContent = "訊息已發送！";
        console.log("[DEBUG] 訊息發送成功");
        
        // 如果在客戶端環境中，關閉視窗
        if (liff.isInClient()) {
            setTimeout(() => { 
                liff.closeWindow(); 
            }, 600);
        }
        
    } catch (err) {
        console.error("[DEBUG] 發送訊息失敗:", err);
        
        if (err.message && err.message.includes("permissions")) {
            statusMsg.textContent = "權限不足。請在 LINE 應用程式中重新開啟此連結並授予權限。";
        } else if (err.message && err.message.includes("not found")) {
            statusMsg.textContent = "LIFF 配置問題。請檢查 LIFF 設置。";
        } else {
            statusMsg.textContent = "發送失敗，請手動複製結果";
        }
    }
}

// 3. 按下語言按鈕事件
langBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const lang = btn.getAttribute('data-lang');
        currentLang = lang;
        
        if (lang === 'manual') {
            // 手動輸入模式
            showManualInput();
        } else {
            // 語音辨識模式
            startRecognition(lang);
        }
    });
});

// 手動輸入相關元素
const manualInputContainer = document.getElementById('manualInputContainer');
const manualInput = document.getElementById('manualInput');
const sendManualBtn = document.getElementById('sendManualBtn');

// 顯示手動輸入界面
function showManualInput() {
    // 隱藏結果框
    resultBox.style.display = "none";
    
    // 顯示手動輸入容器
    manualInputContainer.style.display = "block";
    
    // 更新狀態訊息
    statusMsg.textContent = "請在下方輸入框中輸入文字";
    
    // 聚焦到輸入框
    manualInput.focus();
}

// 發送手動輸入的文字
async function sendManualText() {
    const text = manualInput.value.trim();
    
    if (!text) {
        statusMsg.textContent = "請輸入文字";
        return;
    }
    
    if (!liffInited) {
        statusMsg.textContent = "LIFF 未初始化，請手動複製結果";
        return;
    }
    
    try {
        statusMsg.textContent = "嘗試發送訊息到 LINE...";
        console.log("[DEBUG] 準備發送手動輸入的訊息:", text);
        
        await liff.sendMessages([
            { type: "text", text }
        ]);
        
        statusMsg.textContent = "訊息已發送！";
        console.log("[DEBUG] 手動輸入訊息發送成功");
        
        // 清空輸入框
        manualInput.value = "";
        
        // 如果在客戶端環境中，關閉視窗
        if (liff.isInClient()) {
            setTimeout(() => { 
                liff.closeWindow(); 
            }, 600);
        }
        
    } catch (err) {
        console.error("[DEBUG] 發送手動輸入訊息失敗:", err);
        
        if (err.message && err.message.includes("permissions")) {
            statusMsg.textContent = "權限不足。請在 LINE 應用程式中重新開啟此連結並授予權限。";
        } else if (err.message && err.message.includes("not found")) {
            statusMsg.textContent = "LIFF 配置問題。請檢查 LIFF 設置。";
        } else {
            statusMsg.textContent = "發送失敗，請手動複製結果";
        }
    }
}

// 綁定發送按鈕事件
sendManualBtn.addEventListener('click', sendManualText);

// 綁定輸入框回車事件
manualInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendManualText();
    }
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

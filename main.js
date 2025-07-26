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

// 檢測是否為行動裝置
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// 檢測是否在 LINE 內建瀏覽器
function isLineInAppBrowser() {
    const userAgent = navigator.userAgent;
    return userAgent.includes('Line') || userAgent.includes('LINE');
}

// 1. 初始化 LIFF
async function initLiff() {
    try {
        console.log("[DEBUG] initLiff called");
        await liff.init({ liffId: "2007818922-W21zlONn" });

        // 登入檢查，沒登入就自動登入
        if (!liff.isLoggedIn()) {
            console.log("[DEBUG] 用戶未登入，執行 liff.login()");
            liff.login();
            return;
        }

        liffInited = true;
        console.log("[DEBUG] LIFF 初始化成功，已登入用戶");
        
        // 檢查環境並給予提示
        checkEnvironmentAndShowHint();
        
    } catch (e) {
        statusMsg.textContent = "LIFF 初始化失敗，請重新整理";
        console.error("[DEBUG] LIFF 初始化失敗", e);
    }
}

// 檢查環境並給予適當提示
function checkEnvironmentAndShowHint() {
    if (isLineInAppBrowser() && isMobileDevice()) {
        // 在 LINE 內建瀏覽器中
        statusMsg.innerHTML = `
            <div style="color: #e53e3e; margin-bottom: 10px;">
                ⚠️ LINE 內建瀏覽器不支援語音辨識
            </div>
            <div style="font-size: 0.9rem; line-height: 1.4;">
                請點擊右上角「⋯」→「在瀏覽器中開啟」<br>
                或複製連結到 Chrome/Safari 開啟
            </div>
        `;
        
        // 提供複製連結功能
        addCopyLinkButton();
    } else if (!window.SpeechRecognition && !window.webkitSpeechRecognition) {
        statusMsg.innerHTML = `
            <div style="color: #e53e3e;">
                您的瀏覽器不支援語音辨識功能<br>
                請使用 Chrome、Safari 或 Edge 瀏覽器
            </div>
        `;
    } else {
        statusMsg.textContent = "請選擇語言並開始說話";
    }
}

// 添加複製連結按鈕
function addCopyLinkButton() {
    const copyBtn = document.createElement('button');
    copyBtn.textContent = '📋 複製連結';
    copyBtn.style.cssText = `
        margin-top: 15px;
        padding: 12px 24px;
        background: #4299e1;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        cursor: pointer;
        font-family: inherit;
    `;
    
    copyBtn.onclick = () => {
        navigator.clipboard.writeText(window.location.href).then(() => {
            copyBtn.textContent = '✅ 已複製';
            setTimeout(() => {
                copyBtn.textContent = '📋 複製連結';
            }, 2000);
        }).catch(() => {
            // fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = window.location.href;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            copyBtn.textContent = '✅ 已複製';
            setTimeout(() => {
                copyBtn.textContent = '📋 複製連結';
            }, 2000);
        });
    };
    
    statusMsg.appendChild(copyBtn);
}

// 2. 啟動語音辨識
function startRecognition(langCode) {
    // 如果在不支援的環境中，直接返回
    if (isLineInAppBrowser() && isMobileDevice()) {
        return;
    }
    
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
    recognition.continuous = false;

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

    // 完成時處理結果
    recognition.onend = function() {
        const text = resultBox.textContent.trim();
        if (!text) {
            statusMsg.textContent = "未偵測到語音，請再試一次";
            resultBox.style.display = "none";
            return;
        }
        
        // 嘗試傳送訊息
        sendMessageToLine(text);
    };

    recognition.onerror = function(event) {
        console.error("[DEBUG] 語音辨識錯誤", event);
        handleRecognitionError(event);
    };
}

// 處理語音辨識錯誤
function handleRecognitionError(event) {
    let errorMsg = "";
    
    switch(event.error) {
        case "service-not-allowed":
        case "not-allowed":
            errorMsg = "麥克風權限被拒絕，請允許麥克風權限後重新整理頁面";
            break;
        case "network":
            errorMsg = "網路連線問題，請檢查網路連線";
            break;
        case "no-speech":
            errorMsg = "未偵測到語音，請再試一次";
            break;
        default:
            errorMsg = `語音辨識錯誤：${event.error}`;
    }
    
    statusMsg.textContent = errorMsg;
    resultBox.style.display = "none";
}

// 傳送訊息到 LINE
async function sendMessageToLine(text) {
    if (!liffInited) {
        showManualCopyOption(text);
        return;
    }
    
    try {
        // 檢查是否在 LIFF 環境中
        const context = liff.getContext();
        if (!context || context.type === "none") {
            showManualCopyOption(text);
            return;
        }
        
        // 嘗試發送訊息
        await liff.sendMessages([{
            type: "text",
            text: text
        }]);
        
        statusMsg.textContent = "✅ 語音辨識完成，已成功回傳至 LINE";
        
        // 延遲關閉視窗
        setTimeout(() => {
            if (liff.isApiAvailable('closeWindow')) {
                liff.closeWindow();
            }
        }, 1000);
        
    } catch (error) {
        console.error("[DEBUG] 發送訊息失敗", error);
        
        // 如果是權限問題，嘗試其他方法
        if (error.message && error.message.includes('permission')) {
            tryAlternativeSendMethod(text);
        } else {
            showManualCopyOption(text);
        }
    }
}

// 嘗試替代的發送方法
function tryAlternativeSendMethod(text) {
    try {
        // 嘗試使用 shareTargetPicker
        if (liff.isApiAvailable('shareTargetPicker')) {
            liff.shareTargetPicker([{
                type: "text",
                text: text
            }]).then(() => {
                statusMsg.textContent = "✅ 請選擇要分享到的聊天室";
            }).catch(() => {
                showManualCopyOption(text);
            });
        } else {
            showManualCopyOption(text);
        }
    } catch (error) {
        console.error("[DEBUG] 替代發送方法也失敗", error);
        showManualCopyOption(text);
    }
}

// 顯示手動複製選項
function showManualCopyOption(text) {
    statusMsg.innerHTML = `
        <div style="color: #e53e3e; margin-bottom: 10px;">
            無法自動回傳，請手動複製結果
        </div>
    `;
    
    // 添加複製按鈕
    const copyBtn = document.createElement('button');
    copyBtn.textContent = '📋 複製文字';
    copyBtn.style.cssText = `
        margin-top: 10px;
        padding: 12px 24px;
        background: #48bb78;
        color: white;
        border: none;
        border-radius: 8px;
        font-size: 1rem;
        cursor: pointer;
        font-family: inherit;
    `;
    
    copyBtn.onclick = () => {
        navigator.clipboard.writeText(text).then(() => {
            copyBtn.textContent = '✅ 已複製';
            copyBtn.style.background = '#38a169';
            setTimeout(() => {
                copyBtn.textContent = '📋 複製文字';
                copyBtn.style.background = '#48bb78';
            }, 2000);
        }).catch(() => {
            // fallback
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            copyBtn.textContent = '✅ 已複製';
            copyBtn.style.background = '#38a169';
        });
    };
    
    statusMsg.appendChild(copyBtn);
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
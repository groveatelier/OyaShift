// --- DOM 要素の取得 ---
const cbutton = document.getElementById('Clean');
const sbutton = document.getElementById('Save');
const obutton = document.getElementById('Write');
const mbutton = document.getElementById('Merge');
const fileInput = document.getElementById("import-file-input");

cbutton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'Clean' });
});

sbutton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'Save' });
});

obutton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'Write' });
});

mbutton.addEventListener('click', () => {
    fileInput.click();  // 隠れているファイル選択画面をトリガー（強制クリック）する
});

// ファイルが選択されたらテキストとして読み込む
fileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const fileText = e.target.result;

        // 💡 background.js へテキストデータを送信する
        chrome.runtime.sendMessage({
            action: "parseAndMergeText",
            text: fileText
            }, (response) => {
                // background.js からの返事を受け取る
                if (response && response.success) {
                    alert("設定を正常にマージインポートしました！");
                } else {
                    alert("インポートに失敗しました: " + (response?.error || "Unknown"));
                }
            
                // 連続選択できるようにインプットをリセット
                fileInput.value = "";
        });
    };
    reader.readAsText(file, "UTF-8");
});

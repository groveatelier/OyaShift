document.addEventListener("DOMContentLoaded", () => {
    // --- DOM 要素の取得 ---
    const inputArea = document.getElementById("input-area");
    const cleanButton = document.getElementById('btn-clean');
    const saveButton = document.getElementById('btn-save');
    const writeButton = document.getElementById('btn-write');
    const mergeButton = document.getElementById('btn-merge');
    const fileInput = document.getElementById("import-file-input");

    // 起動時に自動フォーカス
    inputArea.focus();
    async function processCopy() {
        const text = inputArea.value;
        if (!text.trim()) return;
        try {
            await navigator.clipboard.writeText(text);
            // テキストエリアをクリアしてフォーカスを戻す（ウィンドウは開きっぱなし）
            inputArea.value = "";
            inputArea.focus();
        } 
        catch (err) {
            console.error("コピー失敗:", err);
        }
    }

    // ショートカット
    inputArea.addEventListener("keydown", (event) => {
        if (event.shiftKey && event.key === "Enter") {
            event.preventDefault();
            processCopy();
        }
    });

    // イベント割り当て
    cleanButton.addEventListener('click', () => {
        const text = inputArea.value;
        chrome.runtime.sendMessage({ action: 'Clean', text });
    });

    saveButton.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'Save' }, 
            (response) => { // background.js からの返事を受け取る
                if (response && response.success) {
                    alert("ストレージローカルに保存します！");
                }
//                window.close();
            }
        );
    });

    writeButton.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'Write' });
        return false; // フォーム送信を防止
    });

    mergeButton.addEventListener('click', () => {
        fileInput.click();  // 隠れているファイル選択画面をトリガー（強制クリック）する
        return false; // フォーム送信を防止
    });

    // ファイルが選択されたらテキストとして読み込む
    fileInput.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (e) {
            const fileText = e.target.result;

            // background.js へテキストデータを送信する
            chrome.runtime.sendMessage({
                action: "parseAndMergeText",
                text: fileText
                }, (response) => {
                    // background.js からの返事を受け取る
                    if (response && response.success) {
                        alert("マージインポートしました！(未保存)");
                    } 
                    // 連続選択できるようにインプットをリセット
                    fileInput.value = "";
            });
        };
        reader.readAsText(file, "UTF-8");
        return false; // フォーム送信を防止
    });
});

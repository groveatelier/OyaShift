// dictdlg.js for Oya Shift

// --- DOM 要素の取得 ---
const rbutton = document.getElementById('Remove');
const ebutton = document.getElementById('Engage');
const kanjiInput = document.getElementById('Kanji');
const kanaInput = document.getElementById('Kana');
const ibutton = document.getElementById('ime-btn');

// --- ボタンイベント ---
rbutton.addEventListener('click', () => {
    const jtext = kanaInput.value + "\t" + kanjiInput.value;
    chrome.runtime.sendMessage({ type: 'removeOne', jtext });
});

ebutton.addEventListener('click', () => {
    const jtext = kanaInput.value + "\t" + kanjiInput.value;
    chrome.runtime.sendMessage({ type: 'engageOne', jtext });
});

ibutton.addEventListener('click', () => {
    // オプション画面（設定ページ）を新しいタブで開く
    chrome.runtime.openOptionsPage();    
//    fileInput.click();  // 隠れているファイル選択画面をトリガー（強制クリック）する
});

// --- バージョン表示（安全な初期化） ---
document.addEventListener("DOMContentLoaded", () => {
    const verElem = document.getElementById("ver");
    if (verElem) {
        verElem.textContent = "version " + chrome.runtime.getManifest().version;
    }
});

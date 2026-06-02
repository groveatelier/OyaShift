// dictdlg.js for Oya Shift

// --- DOM 要素の取得 ---
const rbutton = document.getElementById('Remove');
const ebutton = document.getElementById('Engage');
const kanjiInput = document.getElementById('Kanji');
const kanaInput = document.getElementById('Kana');
const cbutton = document.getElementById('Clean');
const sbutton = document.getElementById('Save');
const obutton = document.getElementById('DictText');

// --- ボタンイベント ---
rbutton.addEventListener('click', () => {
    const jtext = kanaInput.value + "\t" + kanjiInput.value;
    chrome.runtime.sendMessage({ type: 'removeOne', jtext });
});

ebutton.addEventListener('click', () => {
    const jtext = kanaInput.value + "\t" + kanjiInput.value;
    chrome.runtime.sendMessage({ type: 'engageOne', jtext });
});

cbutton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'Clean' });
});

sbutton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'Save' });
});

obutton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'DictText' });
});

// --- バージョン表示（安全な初期化） ---
document.addEventListener("DOMContentLoaded", () => {
    const verElem = document.getElementById("ver");
    if (verElem) {
        verElem.textContent = "version " + chrome.runtime.getManifest().version;
    }
});

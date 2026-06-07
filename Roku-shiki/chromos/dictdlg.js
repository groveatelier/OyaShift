// dictdlg.js for Oya Shift

document.addEventListener("DOMContentLoaded", () => {
    // --- DOM 要素の取得 ---
    const removebtn = document.getElementById('remove-btn');
    const engagebtn = document.getElementById('engage-btn');
    const kanjiInput = document.getElementById('Kanji');
    const kanaInput = document.getElementById('Kana');
    const optionbtn = document.getElementById('option-btn');
    // --- バージョン表示（安全な初期化） ---
    const verElem = document.getElementById("ver");
    if (verElem) {
        verElem.textContent = "version " + chrome.runtime.getManifest().version;
    }

    function clearInputFields() {
        kanjiInput.value = '';
        kanaInput.value = '';
    }

    // --- ボタンイベント ---
    removebtn.addEventListener('click', () => {
        const jtext = kanaInput.value + "\t" + kanjiInput.value;
        chrome.runtime.sendMessage({ type: 'removeOne', jtext });
        clearInputFields();
    });

    engagebtn.addEventListener('click', () => {
        const jtext = kanaInput.value + "\t" + kanjiInput.value;
        chrome.runtime.sendMessage({ type: 'engageOne', jtext });
        clearInputFields();
    });

    optionbtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'openSettings' });
        window.close();
    });
});


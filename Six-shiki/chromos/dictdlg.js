// ditclg.js for Kana Shift
const rbutton = document.getElementById('Remove');
const ebutton = document.getElementById('Engage');
const kanjiInput = document.getElementById('Kanji');
const kanaInput = document.getElementById('Kana');
const cbutton = document.getElementById('Clean');
const sbutton = document.getElementById('Save');
const obutton = document.getElementById('DictText');

rbutton.addEventListener('click', () => {
    const jtext = kanaInput.value + "\t" + kanjiInput.value;
    chrome.runtime.sendMessage({ type: 'removeOne', jtext });
});

ebutton.addEventListener('click', () => {
    const jtext = kanaInput.value + "\t" + kanjiInput.value;
    chrome.runtime.sendMessage({ type: 'engageOne', jtext });
});

cbutton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'Clean'});
});

sbutton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'Save'});
});

obutton.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'DictText'});
});

function maniVersion(){
    var vertxt = document.getElementById("ver");
    vertxt.innerHTML = "version " + chrome.runtime.getManifest().version;
}

maniVersion();
/*  2026.05.19 18:00
  親指シフトキーボードIME ver 5.2 (JISキーボード用)
    
    カーソル行表示：最初は検索文字（ひらがな）のみの表示、入力増で適度に変換候補筆頭を表示.
    候補窓表示：ユーザー意思の変換が実行される前は 2行のみの窓とし、insidebufを表示
            ユーザー意思の変換が実行された後は1行目はinsidebuf, ２行目以降を imedata１段目の
            変換候補を表示する.    
*/

importScripts("RokushikiIME.js");

const oyaubiline = 3;      // 親指シフトのキーライン
const eimojiline = 32;     // 英文字の境界界 xn2
const iYen = eimojiline + 42;   // IntlYen キーのインデックス境界処3
const iRo = eimojiline + 43;    // IntlRo キーのインデックス
// 奇数行 - 左手キー，偶数行 - 右手キー，親指シフトキーは最初の３行
const kanashifttable = [
   /*Key  単    左+   右+ */
    [" ", " ", "　"],
    ["lang2", ""],
    ["lang1", ""],  /*親指ここまで*/

    /*左手キー                  右手キー*/
    ["g", "せ", "も", "ぜ"],  ["h", "は", "み", "ば"],  
    ["b", "へ", "ぃ", "べ"],  ["n", "め", "ぬ", "ぷ"],
    ["t", "さ", "れ", "ざ"],  ["y", "ら", "よ", "ぱ"],
    ["f", "け", "ゅ", "げ"],  ["j", "と", "お", "ど"],
    ["v", "ふ", "や", "ぶ"],  ["m", "そ", "ゆ", "ぞ"],
    ["r", "こ", "ゃ", "ご"],  ["u", "ち", "に", "ぢ"],
    ["d", "て", "な", "で"],  ["k", "き", "の", "ぎ"],
    ["c", "す", "ろ", "ず"],  ["", ""],
    ["e", "た", "り", "だ"],  ["i", "く", "る", "ぐ"],
    ["s", "し", "あ", "じ"],  ["l", "い", "ょ", "ぽ"],
    ["x", "ひ", "ー", "び"],  ["", ""],
    ["w", "か", "え", "が"],  ["o", "つ", "ま", "づ"],
    ["a", "う", "を", "ゔ"],  ["", ""],
    ["z", "．", "ぅ", "."],   ["", ""],
    ["q", "。", "ぁ", "ぁ゙"],  ["p", "，", "ぇ", "ぴ"],

    ["1", "1", "ф", "一"],  ["0", "0", "、", "０"],
    ["2", "2", "〇", "二"], ["9", "9", "※", "九"],
    ["3", "3", "§", "三"],  ["8", "8", "【】", "八"],
    ["4", "4", "「", "四"],  ["7", "7", "《》", "七"],
    ["5", "5", "」", "五"],  ["6", "6", "［］", "六"],

    ["`", "‘", "’", "かっこ"],  [",", "ね", "む", "ぺ"],
    ["~", "〜"],               [".", "ほ", "わ", "ぼ"],
    ["!", "！"],               [";", "ん", "っ", "："],
    ["@", "＠"],               ["/", "・", "ぉ", "／"],
    ["#", "＃"],               ["-", "ー", "√", "±"],
    ["$", "＄"],               ["=", "＝", "÷", "×"],
    ["%", "％"],               ["[", "』", "『", "《《》》"],
    ["<", "＜"],               ["\\", "￥","＼","くりかえし"],
    [">", "＞"],               ["]", "]", "}","{"],
    [":", "："],               ["?", "？", "!?","！？"],
    ["^", "^"],                ["&", "＆"],
    ["*", "＊"],               ["(", "（"],
    [")", "）"],               ["_", "＿"],
    ["+", "＋"],               ["{", "｛"],
    ["}", "｝"],              ["|", "｜"],
    ["\"", "\"", "”"],        ["Yen", ""],
    ["Ro",""]
];

// chromebook キー入力 覚書.
/*        -^@[;:],./
!@#$%^&*()_+{}:"|<>?
1234567890-=[];'\,./ 
--
 IntlRo "\", "_"
 IntlYen "¥", "|"

*/

const engine   = "GranShift";

// 親指シフトキーの制御クラス
class OyaShiftCtrl { 
    constructor(){
        this.oyaStartTime = 0;   // 押下時間管理
        this.oyaGeneration = 0;  // 世代管理 (0~1023)
        this.oyaTimerid = null;  // タイマーID管理
        this.oyaKeyIndex = -1;   // キーインデックス管理
        this.oyaActive = false;
        this.keyActive = false;  // キーアクティブ管理
        this.keyStartTime = 0;   // キー押下時間管理
        this.keyIndex = -1;      // キーインデックス管理
        this.keyPrevIndex = -1;  // 前回キーインデックス管理
        this.keyKanaOffset = 1;  // かな変換offset量
        this.peekKeyIndex = -1;  // 押されたキーのインデックス
        this.keyGeneration = -1; // キーの世代管理 (0~1023)
        this.oyayubiKeyboard = false;   // 親指シフトキーボードかどうかのフラグ
    }

    oyaKeyDown( keyinx ){
        let live = false;
        if( !this.oyaActive ){
            this.oyaActive = true;  // 押下中
            this.oyaGeneration = (this.oyaGeneration + 1) % 1024;   // 世代管理
            this.oyaStartTime = Date.now();  // 押下時間管理
            this.oyaKeyIndex = keyinx;  // キーインデックス管理
            live = true;
        }
        else{
            live = this.isKeyRepeatAvailable();
        }
        return live;
    }

    oyaKeyUp(){
        this.oyaActive = false;
    }

    isKeyRepeatAvailable(){
        return ( Date.now() - this.oyaStartTime > 2400 );   // キーリピート抑止時間
    }

    oyaSetLateKeyDown( callback ){
        if( this.oyaTimerid ) clearTimeout(this.oyaTimerid);  // 既存のタイマーがあればクリア
        this.oyaTimerid = setTimeout( () => {
            callback();               // 遅延実行するコールバック関数を呼び出す
            this.oyaTimerid = null;   // タイマーIDをリセット
        }, 250);  // 250msの遅延
    }

    oyaClearKeyDownTimer(){
        let cleared = false;
        if( this.oyaTimerid ) {
            clearTimeout(this.oyaTimerid);  // タイマーをクリア
            this.oyaTimerid = null;   // タイマーIDをリセット
            cleared = true;
        }
        return cleared;
    }

    keyKeyDown( index ){
        let live = false;
        this.keyPrevIndex = this.keyIndex;
        this.keyIndex = index;  // キーインデックス管理
        if( !this.keyActive ){
            this.keyActive = true;  // 押下中
            this.keyStartTime = Date.now();  // 押下時間管理
            live = true;
        }
        else if( this.keyPrevIndex !== index || (Date.now() - this.keyStartTime > 1800 ) ){   // リピート抑止
            live = true;
        }
        return live;
    }

    keyKeyUp(){
        this.keyActive = false;
    }

    keyIsLongPress(now){
        const threshold = this.oyayubiKeyboard ? 4096 : 225;  // 長押し判定時間
        return this.keyActive && this.keyKanaOffset && (now - this.keyStartTime > threshold);  // 長押し判定
    }

    keyExpandLongTimer(){
        this.keyStartTime = Date.now() + 800;  // 長押し判定時間を延長
    }

    keyIsMultiTap(){
        return this.oyaGeneration === this.keyGeneration && this.keyPrevIndex === this.keyIndex;  // 同一世代かつ同一キーの判定
    }

    keyGetMoji(){
        let offset = 2;
        if( this.oyaKeyIndex > 0 ){   // 親指キーあり
            if( this.oyaKeyIndex === 1 )  offset = this.keyIndex & 1 ? 3 : 2;   // 右親シフトキー
            else                offset = this.keyIndex & 1 ? 2 : 3;   // 左親シフトキー
            this.oyayubiKeyboard = true;   // 親指シフトキーボードかどうかのフラグ
        }
        this.keyKanaOffset = offset;    // オフセット保存
        return kanashifttable[this.keyIndex][offset];
    }

    keyGetUSMoji(){
        this.keyKanaOffset = 0;    // Shiftキー押下でオフセット0の文字
        return kanashifttable[this.keyIndex][0];   // US文字
    }

    keyGetNextMoji(){
        this.keyKanaOffset = ( this.keyKanaOffset + 1 ) % kanashifttable[this.keyIndex].length;    //文字オフセット変更
        return kanashifttable[this.keyIndex][this.keyKanaOffset];  
    }

    keyGetLPMoji(){
        this.keyKanaOffset = 3;    // 長押しでオフセット3の文字
        return kanashifttable[this.keyIndex][3];   // 長押し文字
    }

    keyGetFirstMoji(){
        let offset = this.keyKanaOffset ? 1 : 0;  // USか日か
        return kanashifttable[this.keyIndex][offset];
    }

    keySyncGeneration(){
        this.keyGeneration = this.oyaGeneration;   // 世代管理
    }
}

class KeyInformation{
    constructor(){
        this.status = {
            pending: false, // キー処理保留フラグ
            index: -1,      // キーインデックス
            char: "",       // 変換文字
            thumb: false,
            shift: false,
            ctrl: false
        };
        this.thumbkeyboard = false; // 親指キーボード
    }

    setStatus( index = -1, char = '', flag = false ){ // KeyStatusの設定
        this.status.index = index;
        this.status.char = char;
        this.status.pending = flag;
    }

    setModifier(keyData){
        this.status.ctrl  = keyData.ctrlKey;
        this.status.shift = keyData.shiftKey;
    }

    setThumb(){
        this.thumbkeyboard = true;
        this.status.thumb = true;
    }

    getKanaIndex(keyData){
        this.setModifier( keyData ); 
        if (keyData.code === "Lang1"){ this.setThumb(); return 1; }
        if (keyData.code === "Lang2"){ this.setThumb(); return 2; }

        const moji = keyData.key.toLowerCase();
        const keyindex = kanaIndexMap.get(moji);
        this.status.thumb = (keyindex === 0 && !this.thumbkeyboard );
        if (keyindex !== undefined) return keyindex;

        if (keyData.code === "IntlYen") return iYen;
        if (keyData.code === "IntlRo") return iRo;
        return -1;
    }
}

const ckey = new OyaShiftCtrl();    // 親指シフトキー管理
const cinf = new KeyInformation();  // 入力キー情報管理
const kanaIndexMap = new Map();   // Map を構築
kanashifttable.forEach((row, index) => {
    kanaIndexMap.set(row[0], index);
});

//  Key Down時に呼び出される.
function thumbShift(keyData){
    let action   = false;
    let lkey     = "";
    let keyinx   = -1;

    if( !keyData.ctrlKey ){     // Ctrl 押されてないこと。
        if( !ckey.keyKanaOffset && (keyData.code === "Enter" || keyData.code === "Tab") ){ // 英モード+Enter&Tabで全吐き出し
            ZenKakuteiKey( keyData );  // 全確定 or 先頭確定
        }
        else {
            //console.log(`x:${keyData.code}/${keyData.key}/${keyinx}/${lkey}`);
            ckey.peekKeyIndex = cinf.getKanaIndex( keyData );  // キーインデックス検索
            if( ckey.peekKeyIndex >= 0 ){
                action = true;
                if( ckey.peekKeyIndex < oyaubiline ) setConvKanaDownOya()  ;  // 設定：親.
                else   setConvKanaDownKey();  // 設定：key.
            } 
            else if( keyData.code === "AltLeft" ) cinf.setStatus( 203 ); // SSKeyUp でUSモード
        }
    }
    //console.log(`thumbShift:${convKana}/${insidebuf}/`);
    return action;
}

//  SPC押下時の convKana 設定. 
function setConvKanaDownOya(){
    //console.log(`SPC:${ckey.keyShift}/${ckey.keyActive}/${insidebuf}/`);
    if (!ckey.oyaKeyDown(ckey.peekKeyIndex)) {
        cinf.status.pending = true;     // リピート抑止期間中は何もしない
        return;
    }

    // 1) 文字キーが押されている → 入力文字確定
    if (ckey.keyActive) {
        cinf.setStatus( ckey.oyaKeyIndex, ckey.keyGetMoji() );
        BackOne();      // 直前の文字確定を取り消す.
        if (ckey.oyaKeyIndex === 0) ckey.keyExpandLongTimer(); // SpC親キーの場合長押し判定時間を延長
        return;
    }

    // 2) 親指キーボード未確定
    if (!ckey.oyayubiKeyboard) {
        handleOyaBeforeConfirmed();
        return;
    }

    // 3) 親指キーボード確定後
    handleOyaAfterConfirmed();
}

// 親指キーボード未確定時の親キーダウン処理
function handleOyaBeforeConfirmed(){
    if( insidebuf.length === 0 ){   // insidebufが空のとき
        if( ckey.isKeyRepeatAvailable() ){   // キーリピート抑止時間確認
            CommitOne(" ");   // SPCをアプリに渡す(キーリピート).
        }
        else{
            ckey.oyaSetLateKeyDown( SPCLateKeyDown );  // シフトの遅延処理をセット
        }
        cinf.status.pending = true;
    }
    else if( ckey.keyKanaOffset !== 0 ){   // US文字以外.
        ckey.oyaSetLateKeyDown( SPCLateKeyDown );  // シフトの遅延処理をセット
        cinf.status.pending = true;
    }
    else {      // 空白
        cinf.setStatus( 0, " " );  // SPCを設定.
    }
}

// 親指キーボード確定後の親キーダウン処理
function handleOyaAfterConfirmed(){
    if( ckey.oyaKeyIndex === 0 ){    // 空白(親指キーボード確定＆スペース)
        if( ckey.keyKanaOffset !== 0 ){   // US文字以外.
            SPCLateKeyDown();           // ノータイムで変換
            cinf.status.pending = true;
        }
        else cinf.setStatus( 0, " " );  // SPCを設定.
    }
    else{   // 親指シフトキーの押下
        cinf.setStatus( ckey.oyaKeyIndex, "", true );
    }
}

//  Key押下時の convKana 設定. 
function setConvKanaDownKey(){
    //console.log(`KY:(${ckey.peekKeyIndex})${convKana}/${ckey.keyShift}`);
    if( ckey.keyKeyDown( ckey.peekKeyIndex ) ){   // 文字キー管理
        if( cinf.status.shift && ckey.keyIndex <= eimojiline ){         // shift key押下 && 通常キー.
            cinf.setStatus( ckey.keyIndex, ckey.keyGetUSMoji().toUpperCase() );  // Key-statusの設定(英大文字)
        }
        else if( ckey.oyaActive ){   // SPCキーが押されている場合は、シフト+文字の変換.
            if( !ckey.oyaClearKeyDownTimer() && !ckey.oyayubiKeyboard ){  // SPCの遅延処理クリア
                BackOne();  // 親指キーボード未確定なら直前の空白を消す処理.
            }
            if( ckey.keyIsMultiTap() ){   // 同一世代かつ同一キーの判定
                if( ckey.oyayubiKeyboard ) BackOne();  // 親指シフトキーボードなら直前の文字を消す処理.
                cinf.setStatus( ckey.keyIndex, ckey.keyGetNextMoji() );  // 次の文字
            }
            else {
                ckey.keySyncGeneration();  // Shiftキーの世代を文字キーにセット
                cinf.setStatus( ckey.keyIndex, ckey.keyGetMoji() );  // シフト+文字の変換
            }
        }
        else {
            // offset==0の且つinsidebufが空では無い時は、insidebufの最後の文字が空白であれば確定させる
            if( ckey.keyKanaOffset === 0 && insidebuf.length > 0 && insidebuf[insidebuf.length - 1] === " " ){
                fixAll();     // 確定
            }
            cinf.setStatus( ckey.keyIndex, ckey.keyGetFirstMoji() );  // シフト+文字の変換
        }
    }
    else cinf.status.pending = true;    // リピート抑止
    //console.log(`KYout:${convKana}/${insidebuf}/`);
}

// US keyDown event
function USKeyDown( keyData ){
    //console.log(`UKD:${keyData.code}/${keyData.shiftKey}`);
    let enact = false;
    if( !keyData.shiftKey && !keyData.ctrlKey ){
        if( keyData.code === "AltRight" ) cinf.setStatus( 202, "" );  // SSKeyUp で日本語モード
        else cinf.status.index = -1;
    }
    cinf.setModifier( keyData );
    return enact;
}

// SS keyUp event
function SSKeyUp(engineID, keyData){
    //console.log(`+kU:${convKana}/${keyData.key}:${insidebuf.length}`);
    const now = Date.now();
    const keyinx = cinf.getKanaIndex( keyData );  // キーインデックス検索

    if( !keyData.ctrlKey ){     // Ctrl 押されてないこと。
        if( keyinx >= 0 ){
            if( keyinx < oyaubiline ){
                ckey.oyaKeyUp();   // 親キー管理
            }
            else{
                if( keycondition < 1024 && ckey.keyIsLongPress(now) ){
                    // Key 長押しが判明，確定文字を一つ削除してからオフセット3の文字を確定する
                    BackOne();
                    cinf.status.char = ckey.keyGetLPMoji();  // オフセット3の文字を確定する
                    keyValidiate( cinf.status.char );  // 確定処理
                }
                ckey.keyKeyUp();   // 文字キー管理
            }
        }
        else {
            if( keycondition < 1024 ){
                if( cinf.status.index === 203 && cinf.status.char === "" ){
                    changeAndClear();       // 英モード
                    ckey.keyKanaOffset = 0;
                }
            }
            else if( cinf.status.index === 202 && cinf.status.char === "" ){ 
                changeAndClear();           // 日 Mode
                ckey.keyKanaOffset = 1;     // かな変換offset量セット (次回以降のキー入力でひらがなになるように)
            }
        }
    }
}

// SS keyDown event
function SSKeyDown(engineID, keyData){
    let enact = false;
//    console.log(`sKD:(${keyData.key}|${keyData.code})`);
    if( thumbShift( keyData ) ){            // 親指シフト判断処理.
        if( !cinf.status.pending ) keyValidiate( cinf.status.char );  // 有効キー&入力確定.
        enact = true;
    } 
    else if( insidebuf.length > 0 ) {    // insidebuf(or cCandidate) が存在する時の処理
//        console.log(`ssKD+:(${keyData.key}|${keyData.code})`);
        // Shift Space と タブ は先頭確定.
        if( keyData.key === " " || keyData.key === "Tab" ){
            if( keyData.shiftKey ) fixOne();        // Shift付きは先頭確定.
            else setOtherCandidate( 1 );            // 先頭変換.
            enact = true;
        } else {
            enact = true;
            switch( keyData.key ){
                case "Enter":                   // Enter は 全確定 か キー処理、shift があれば先頭確定. 
                    if( keyData.shiftKey || compoinfo < 0 ) fixOne();  // 先頭確定.
                    else fixAll();                                      // 全確定.
                    break;
                case "Up":                          // 上下矢印 は先頭変換.
                case "Down":
                    let addinx = ( keyData.key === "Up") ? -1 : 1;
                    setOtherCandidate( addinx );    // 先頭変換
                    break;
                case "Right":                       // 右矢印 は カーソル移動 キー処理. 
                    compoinfo++;                    // カーソル右へ.
                    if( compoinfo > 0 ) compoinfo = 0;
                    showComposition();
                    break;
                case "Left":                        // 左矢印 は カーソル移動 キー処理. 
                    compoinfo--;                    // カーソル左へ.
                    if( insidebuf.length + compoinfo < 0 ) compoinfo = -insidebuf.length;
                    showComposition();
                    break;
                case "Backspace":                   // Backspeceの入力 (変換候補有りの時のみ処理する) 
                    BackOne();
                    henkanAri = false;
                    if( insidebuf.length > 0 ) rokushikiIME();
                    else clearCompoAndCand();
                    break;
                case "BrightnessUp":                // Brightness upの入力 (カタカナ変換) 
                    translateKanaKana( true )
                    showComposition();
                    break;
                case "BrightnessDown":              // Brightness Downの入力 (ひらがな変換)
                    translateKanaKana( false );
                    showComposition();
                    break;
                case "Esc":                         // 未変換化
                    UndoConvert( false );           // ESCキーモードで実行.
                    break;
                case "\"":                      // 一文字確定. Double Quate
                    OneLeCommit();              // 一文字確定＆コミット処理.
                    break;
                default:
                    enact = false;
            }
        }
        if( enact ) cinf.setStatus();               // Key-Statusの初期化.
        if( keyData.code === "IntlRo" ) enact = true;    // IntlRo はハンドリング済に.
    } else {
        clearCompoAndCand();
        if( imemode == 7 && keyData.key === "Esc" && keyData.altKey )
            MakeTextNiwadictionary();             // 辞書のテキスト出力.
    }
    return enact;
}

// シフトの遅延処理
function SPCLateKeyDown(){
    //console.log(`SPCLate:${convKana}/${insidebuf.length}`);
    if( insidebuf.length === 0 ){   // insidebufが空のときは、SPCをアプリに渡す.
        CommitOne(" ");   // SPCをアプリに渡す.
        cinf.status.pending = true;
    }
    else {
        if( cinf.status.shift ) fixOne();        // Shift付きは先頭確定.
        else setOtherCandidate( 1 );   // 先頭変換.
    }
}

function ZenKakuteiKey( keyData ){
    if( keyData.shiftKey || compoinfo < 0 ) fixOne();  // 先頭確定.
    else fixAll();                                      // 全確定.
}


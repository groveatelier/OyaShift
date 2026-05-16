/*  2026.05.09 23:00
  親指シフトキーボードIME ver 5.2 (JISキーボード用)
    
    カーソル行表示：最初は検索文字（ひらがな）のみの表示、入力増で適度に変換候補筆頭を表示.
    候補窓表示：ユーザー意思の変換が実行される前は 2行のみの窓とし、insidebufを表示
            ユーザー意思の変換が実行された後は1行目はinsidebuf, ２行目以降を imedata１段目の
            変換候補を表示する.    
*/

importScripts("RokushikiIME.js");

const oyaubiline = 3;      // 親指シフトのキーライン
const eimoziline = 29;     // 英文字の境界
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
    ["\"", "”"],

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
        this.keyShift = false;   // キーデータ管理
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
        else if( Date.now() - this.oyaStartTime > 2400 ){   // キーリピート抑止時間
            live = true;   // 長押しでリピート有効
        }
        return live;
    }

    oyaKeyUp(){
        this.oyaActive = false;
    }

    oyaSetLateKeyDown( callback ){
        if( this.oyaTimerid ) clearTimeout(this.oyaTimerid);  // 既存のタイマーがあればクリア
        this.oyaTimerid = setTimeout( () => {
            callback(this.keyShift);  // 遅延実行するコールバック関数を呼び出す
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

    keyIsLongPress(){
        return this.keyActive && (Date.now() - this.keyStartTime > 225);  // 長押し判定
    }

    keyExpandLongTimer(){
        this.keyStartTime = Date.now() + 800;  // 長押し判定時間を延長
    }

    keyIsMultiTap(){
        return this.oyaGeneration === this.keyGeneration && this.keyPrevIndex === this.keyIndex;  // 同一世代かつ同一キーの判定
    }

    getKanaIndex( keyData ){
        let keyindex = -1;
        this.keyShift = keyData.shiftKey;   // キーデータ管理
        if( keyData.code === "Lang1" ) keyindex = 1;        // Lang1キー
        else if( keyData.code === "Lang2" ) keyindex = 2;   // Lang2キー
        else
        {
            let moji = keyData.key.toLowerCase();   // 小文字検索の為
            for(let depth = 0; depth < kanashifttable.length; depth++ ){
                if (kanashifttable[depth][0] === moji){
                    keyindex = depth;
                    break;
                }
            }
        }
        return keyindex;
    }

    keyGetMoji(){
        let offset = 2;
        if( this.oyaKeyIndex > 0 ){   // 親指キーあり
            if( this.oyaKeyIndex === 1 )  offset = this.keyIndex && 1 ? 2 : 3;   // 右親シフトキー
            else                offset = this.keyIndex && 1 ? 3 : 2;   // 左親シフトキー
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
//        this.keyKanaOffset = ( this.keyKanaOffset + 1 ) % 4;    //文字オフセット変更
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


const ckey = new OyaShiftCtrl();  // 親指シフトキー管理

//  Key Down時に呼び出される.
function thumbShift(keyData){
    let action   = false;
    let lkey     = "";
    let keyinx   = -1;

    if( !keyData.ctrlKey ){     // Ctrl 押されてないこと。
        if( keyData.code === "Enter" && !ckey.keyKanaOffset ){ // 英モード+Enterで全吐き出し
            ZenKakuteiKey( keyData );  // 全確定 or 先頭確定
        }
        else {
            //console.log(`x:${keyData.code}/${keyData.key}/${keyinx}/${lkey}`);
            ckey.peekKeyIndex = ckey.getKanaIndex( keyData );  // キーインデックス検索
            if( ckey.peekKeyIndex >= 0 ){
                action = true;
                if( ckey.peekKeyIndex < oyaubiline ) setConvKanaDownOya()  ;  // convKana 設定：親.
                else   setConvKanaDownKey();  // convKana 設定：key.
            } 
            else if( keyData.code === "AltLeft" ) convKana = [false,103,'']; // SSKeyUp でUSモード
        }
    }
    //console.log(`thumbShift:${convKana}/${insidebuf}/`);
    return action;
}

//  SPC押下時の convKana 設定. 
function setConvKanaDownOya(){
    //console.log(`SPC:${keyData.shiftKey}/${MJKey.IsActive()}/${insidebuf}/`);
    if( ckey.oyaKeyDown(ckey.peekKeyIndex) ){    // 親key管理
        if( ckey.keyActive ){           // 文字キーが押されている場合は、シフト+文字の変換.
            convKana = [false, 0, ckey.keyGetMoji()]; 
            BackOne();  // 直前の文字を消す処理.
            ckey.keyExpandLongTimer();  // 文字キーの長押し判定時間を延長
        }
        else if( insidebuf.length === 0 ){   // insidebufが空のとき
            if( ckey.oyaKeyDown(ckey.oyaKeyIndex) ){   // キーリピート抑止時間確認
                CommitOne(" ");   // SPCをアプリに渡す(キーリピート).
            }
            else{
                ckey.oyaSetLateKeyDown( SPCLateKeyDown );  // シフトの遅延処理をセット
            }
            convKana[0] = true;
        }
        else if( ckey.keyKanaOffset !== 0 ){   // US文字以外.
            //console.log(`SPC10:/${insidebuf}/`);
            ckey.oyaSetLateKeyDown( SPCLateKeyDown );  // シフトの遅延処理をセット
            convKana[0] = true;
        }
        else {      // insidebufの吐き出しと空白の吐き出し
            //console.log(`SPC20:/${insidebuf}/`);
            fixAll();     // 確定
            CommitOne(" ");   // SPCをアプリに渡す.
            convKana[0] = true;
        }
    }
    else convKana[0] = true;    // リピート抑止
    //console.log(`SPCout:/${insidebuf}/`);
}

//  Key押下時の convKana 設定. 
function setConvKanaDownKey(){
//    console.log(`KY:(${ckey.peekKeyIndex})${convKana}/${ckey.keyShift}`);
    if( ckey.keyKeyDown( ckey.peekKeyIndex ) ){   // 文字キー管理
        if( ckey.keyShift && ckey.keyIndex <= eimoziline ){         // shift key押下 && 通常キー.
            convKana = [false, ckey.keyIndex, ckey.keyGetUSMoji().toUpperCase()];    // 大文字
        }
        else if( ckey.oyaActive ){   // SPCキーが押されている場合は、シフト+文字の変換.
            if( !ckey.oyaClearKeyDownTimer() ){  // SPCの遅延処理クリア
                BackOne();  // 直前の空白を消す処理.
            }
            if( ckey.keyIsMultiTap() ){   // 同一世代かつ同一キーの判定
                convKana = [false, ckey.keyIndex, ckey.keyGetNextMoji()];  // 次の文字
            }
            else {
                ckey.keySyncGeneration();  // Shiftキーの世代を文字キーにセット
                convKana = [false, ckey.keyIndex, ckey.keyGetMoji()];  // シフト+文字の変換
            }
        }
        else {
            convKana = [false, ckey.keyIndex, ckey.keyGetFirstMoji()];  // シフト+文字の変換
        }
    }
    else convKana[0] = true;    // リピート抑止
    //console.log(`KYout:${convKana}/${insidebuf}/`);
}

// US keyDown event
function USKeyDown( keyData ){
    //console.log(`UKD:${keyData.code}/${keyData.shiftKey}`);
    let enact = false;
    if( !keyData.shiftKey && !keyData.ctrlKey ){
        if( keyData.code === "AltRight" ){
            convKana = [false,102,''];   // SSKeyUp で日本語モード
        }
        else convKana[1] = -1;
    }

    return enact;
}

// SS keyUp event
function SSKeyUp(engineID, keyData){
    //console.log(`+kU:${convKana}/${keyData.key}:${insidebuf.length}`);
    if( !keyData.ctrlKey ){     // Ctrl 押されてないこと。
        let keyinx = ckey.getKanaIndex( keyData );  // キーインデックス検索

        if( keyinx >= 0 ){
            if( keyinx < oyaubiline ){
                ckey.oyaKeyUp();   // 親キー管理
            }
            else{
                if( keycondition < 1024 ){
                    if( ckey.keyIsLongPress() && insidebuf.length > 0 ){ 
                        // Key 長押しが判明，確定文字を一つ削除してからオフセット3の文字を確定する
                        BackOne();
                        convKana[2] = ckey.keyGetLPMoji();  // オフセット3の文字を確定する
                        keyValidiate();  // 確定処理
                    }
                }
                ckey.keyKeyUp();   // 文字キー管理
            }
        }
        else {
            if( keycondition < 1024 ){
                if( convKana[1] === 103 && convKana[2] === "" ) changeAndClear();    // 英モード
            }
            else if( convKana[1] === 102 && convKana[2] === "" ){ 
                changeAndClear();  // 日 Mode
                ckey.keyKanaOffset = 1;     // かな変換offset量セット (次回以降のキー入力でひらがなになるように)
            }
        }
    }
}

// シフトの遅延処理
function SPCLateKeyDown( eiShift ){
    //console.log(`SPCLate:${convKana}/${insidebuf.length}`);
    if( insidebuf.length === 0 ){   // insidebufが空のときは、SPCをアプリに渡す.
        CommitOne(" ");   // SPCをアプリに渡す.
        convKana[0] = true;
    }
    else {
        if( eiShift ) fixOne();        // Shift付きは先頭確定.
        else setOtherCandidate( 1 );   // 先頭変換.
    }
}

function ZenKakuteiKey( keyData ){
    if( keyData.shiftKey || compoinfo < 0 ) fixOne();  // 先頭確定.
    else fixAll();                                      // 全確定.
}


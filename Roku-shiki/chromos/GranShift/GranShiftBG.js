/*  2026.05.09 23:00
  親指シフトキーボードIME ver 5.2 (JISキーボード用)
    
    カーソル行表示：最初は検索文字（ひらがな）のみの表示、入力増で適度に変換候補筆頭を表示.
    候補窓表示：ユーザー意思の変換が実行される前は 2行のみの窓とし、insidebufを表示
            ユーザー意思の変換が実行された後は1行目はinsidebuf, ２行目以降を imedata１段目の
            変換候補を表示する.    
*/

importScripts("RokushikiIME.js");

const oyaubiline = 3;      // 親指シフトのキーライン
const normalkeyline = 5;   // 通常文字の境界
const leftkeysLine = normalkeyline + 31;   // 左キーの境界
const kanashifttable = [
   /*Key  単    左+   右+ */
    [" ", " ", "", ""],
    ["lang1", "", "", ""],
    ["lang2", "", "", ""],
    ["?", "？", "!?","！？"],   /* 特別配慮文字 */
    ["!", "！", "!!","！！"],
    ["@", "@", "◯","◎"],

    ["g", "せ", "も", "ぜ"],
    ["b", "へ", "ぃ", "べ"],
    ["t", "さ", "れ", "ざ"],
    ["f", "け", "ゅ", "げ"],
    ["v", "ふ", "や", "ぶ"],
    ["r", "こ", "ゃ", "ご"],
    ["d", "て", "な", "で"],
    ["c", "す", "ろ", "ず"],
    ["e", "た", "り", "だ"],
    ["s", "し", "あ", "じ"],
    ["x", "ひ", "ー", "び"],
    ["w", "か", "え", "が"],
    ["a", "う", "を", "ゔ"],
    ["z", "．", "ぅ", "."],
    ["q", "。", "ぁ", "ぁ゙"],

    ["`", "‘", "’", "かっこ"],      /* US配列に合わせる*/
    ["1", "1", "ф", "一"],
    ["2", "2", "〇", "二"],
    ["3", "3", "§", "三"],
    ["4", "4", "「", "四"],
    ["5", "5", "」", "五"],

    ["h", "は", "み", "ば"],
    ["n", "め", "ぬ", "ぷ"],
    ["y", "ら", "よ", "ぱ"],
    ["j", "と", "お", "ど"],
    ["m", "そ", "ゆ", "ぞ"],
    ["u", "ち", "に", "ぢ"],
    ["k", "き", "の", "ぎ"],
    [",", "ね", "む", "ぺ"],
    ["i", "く", "る", "ぐ"],
    ["l", "い", "ょ", "ぽ"],
    [".", "ほ", "わ", "ぼ"],
    ["o", "つ", "ま", "づ"],
    [";", "ん", "っ", "："],
    ["/", "・", "ぉ", "／"],
    ["p", "，", "ぇ", "ぴ"],

    ["6", "6", "［］", "六"],
    ["7", "7", "《》", "七"],
    ["8", "8", "【】", "八"],
    ["9", "9", "※", "九"],
    ["0", "0", "、", "０"],

    ["-", "-", "√", "±"],
    ["=", "=", "÷", "×"],
    ["[", "』", "『", "《《》》"],
    ["\\", "￥","＼","くりかえし"],
    ["]", "]", "}","{"],
    ["Ro","", " ",  " "]
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
        this.oyaGeneration = 0;  // 世代管理 (0~1023)
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

    oyaIsActive(){
        return this.oyaActive;
    }

    oyaGetGeneration(){
        return this.oyaGeneration;
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
        if( !this.keyActive ){
            this.keyActive = true;  // 押下中
            this.keyStartTime = Date.now();  // 押下時間管理
            this.keyPrevIndex = this.keyIndex;
            this.keyIndex = index;  // キーインデックス管理
            live = true;
        }
        else if( this.keyIndex !== index || (Date.now() - this.keyStartTime > 2400 ) ){   // リピート抑止
            live = true;
        }
        return live;
    }

    keyKeyUp(){
        this.keyActive = false;
    }

    keyIsActive(){
        return this.keyActive;
    }

    keyIsLongPress(){
        return this.keyActive && (Date.now() - this.keyStartTime > 235);  // 長押し判定
    }

    keyExpandLongTimer(){
        this.keyStartTime = Date.now() + 800;  // 長押し判定時間を延長
    }

    keyIsMultiTap(){
        return this.oyaGeneration === this.keyGeneration && this.keyPrevIndex === this.keyIndex;  // 同一世代かつ同一キーの判定
    }

    keyGetNextoffset(){
        this.keyKanaOffset = ( this.keyKanaOffset + 1 ) % 4;    //文字オフセット変更
        return this.keyKanaOffset;
    }

    keySetKanaOffset( offset ){
        this.keyKanaOffset = offset;     // かな変換offset量セット
        return this.keyKanaOffset;
    }

    keyGetKanaOffset(){
        return this.keyKanaOffset ? 1 : 0;     // かな変換offset量取得
    }

    keyGetKanaIndex( keyData ){
        let keyindex = -1;
        this.keyShift = keyData.shiftKey;   // キーデータ管理
        let moji = keyData.key.toLowerCase();   // 小文字検索の為
        for(let depth = 0; depth < kanashifttable.length; depth++ ){
            if (kanashifttable[depth][0] === moji){
                keyindex = depth;
                break;
            }
        }
        this.peekKeyIndex = keyindex;  // 押されたキーのインデックス
        return keyindex;
    }

    keyGetMoji(){
        let offset = 2;
        if( this.oyaKeyIndex > 0 ){   // 親指キーあり
            if( this.oyaKeyIndex === 1 )  offset = this.keyIndex > leftkeysLine ? 2 : 3;   // 右親シフトキー
            else                offset = this.keyIndex > leftkeysLine ? 3 : 2;   // 左親シフトキー
            this.oyayubiKeyboard = true;   // 親指シフトキーボードかどうかのフラグ
        }
        return kanashifttable[this.keyIndex][offset];
    }

    keyGetUSMoji(){
        return kanashifttable[this.keyIndex][0];   // US文字
    }

    keyGetNextMoji(){
        this.keyKanaOffset = ( this.keyKanaOffset + 1 ) % 4;    //文字オフセット変更
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

class ShiftKey {
    constructor(){
        this.startTime = 0;   // 押下時間管理
        this.Generation = 0;    // 世代管理 (0~1023)
        this.timerid = null;    // タイマーID管理
        this.keyIndex = -1;    // キーインデックス管理
        this.Active = false;
    }

    KeyDown( keyinx ){
        let live = false;
        if( !this.Active ){
            this.Active = true;  // 押下中
            this.Generation = (this.Generation + 1) % 1024;   // 世代管理
            this.startTime = Date.now();  // 押下時間管理
            this.keyIndex = keyinx;  // キーインデックス管理
            live = true;
        }
        else if( Date.now() - this.startTime > 2400 ){   // 長押し判定
            live = true;   // 長押しでリピート有効
        }
        return live;
    }

    KeyUp(){
        this.Active = false;
//        return this.ClearKeyDownTimer();  // タイマークリアして結果を返す
    }

    IsActive(){
        return this.Active;
    }

    GetGeneration(){
        return this.Generation;
    }

    SetLateKeyDown( callback, shiftState ){
        if( this.timerid ) clearTimeout(this.timerid);  // 既存のタイマーがあればクリア
        this.timerid = setTimeout( () => {
            callback(shiftState);  // 遅延実行するコールバック関数を呼び出す
            this.timerid = null;   // タイマーIDをリセット
        }, 250);  // 250msの遅延
    }

    ClearKeyDownTimer(){
        let cleared = false;
        if( this.timerid ) {
            clearTimeout(this.timerid);  // タイマーをクリア
            this.timerid = null;   // タイマーIDをリセット
            cleared = true;
        }
        return cleared;
    }
}

class MojiKey {
    constructor(){
        this.Active = false;
        this.startTime = 0;   // 押下時間管理
        this.ShiftGeneration = -1;    // Shiftキーの世代管理 (0~1023)
        this.keyIndex = -1;    // キーインデックス管理
        this.prevkeyIndex = -1;    // キーインデックス管理
        this.kanaoffset = 1;     // かな変換offset量
    }

    KeyDown( index ){
        let live = false;
        if( !this.Active ){
            this.Active = true;  // 押下中
            this.startTime = Date.now();  // 押下時間管理
            this.prevkeyIndex = this.keyIndex;
            this.keyIndex = index;  // キーインデックス管理
            live = true;
        }
        else if( this.keyIndex !== index || (Date.now() - this.startTime > 2400 ) ){   // リピート抑止
            live = true;
        }
        return live;
    }

    KeyUp(){
        this.Active = false;
    }

    IsActive(){
        return this.Active;
    }

    IsLongPress(){
        return this.Active && (Date.now() - this.startTime > 235);  // 長押し判定
    }

    ExpandLongTimer(){
        this.startTime = Date.now() + 800;  // 長押し判定時間を延長
    }

    SetShiftGeneration( gen ){
        this.ShiftGeneration = gen;
    }

    IsMultiTap( gen ){
        return this.ShiftGeneration === gen && this.prevkeyIndex === this.keyIndex;  // 同一世代かつ同一キーの判定
    }

    getNextoffset(){
        this.kanaoffset = ( this.kanaoffset + 1 ) % 4;    //文字オフセット変更
        return this.kanaoffset;
    }

    setKanaOffset( offset ){
        this.kanaoffset = offset;     // かな変換offset量セット
        return this.kanaoffset;
    }

    getKanaOffset(){
        return this.kanaoffset ? 1 : 0;     // かな変換offset量取得
    }
}

//const SPCKey = new ShiftKey();  // SPCキー管理
//const MJKey = new MojiKey();  // 文字キー管理
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
            if( ckey.keyGetKanaIndex( keyData ) >= 0 ){
                action = true;
                if( ckey.peekKeyIndex < oyaubiline ) setConvKanaDownOya()  ;  // convKana 設定：親.
                else   setConvKanaDownKey();  // convKana 設定：key.
            } 
            else if( keyData.code === "AltLeft" ) convKana = [false,103,'']; // SSKeyUp でUSモード
        }
    }
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
    //console.log(`KY:(${keyinx})${convKana}/${keyshift}`);
    if( ckey.keyKeyDown( ckey.peekKeyIndex ) ){   // 文字キー管理
        if( ckey.keyShift && ckey.keyIndex > normalkeyline ){         // shift key押下 && 通常キー.
            convKana = [false, ckey.keyIndex, ckey.keyGetUSMoji().toUpperCase()];    // 大文字
            ckey.keyKanaOffset = 0;     // US大文字.
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
        let keyinx = ckey.keyGetKanaIndex( keyData );  // キーインデックス検索

        if( keyinx < oyaubiline ){
            ckey.oyaKeyUp();   // 親キー管理
        }
        else if( keyinx > 0 ){
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


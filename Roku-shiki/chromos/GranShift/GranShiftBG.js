/*  2026.05.09 23:00
  親指シフトキーボードIME ver 5.2 (JISキーボード用)
    
    カーソル行表示：最初は検索文字（ひらがな）のみの表示、入力増で適度に変換候補筆頭を表示.
    候補窓表示：ユーザー意思の変換が実行される前は 2行のみの窓とし、insidebufを表示
            ユーザー意思の変換が実行された後は1行目はinsidebuf, ２行目以降を imedata１段目の
            変換候補を表示する.    
*/

importScripts("RokushikiIME.js");

const kanashifttable = [
   /*Key  単    左+   右+ */
    [" ", " ", "", ""],
    ["g", "せ", "も", "ぜ"],
    ["Lang2", "", "", ""],
    ["Lang1", "", "", ""],
    ["h", "は", "み", "ば"],
    ["b", "へ", "ぃ", "べ"],
    ["n", "め", "ぬ", "ぷ"],
    ["t", "さ", "れ", "ざ"],
    ["y", "ら", "よ", "ぱ"],
    ["f", "け", "ゅ", "げ"],
    ["j", "と", "お", "ど"],
    ["v", "ふ", "や", "ぶ"],
    ["m", "そ", "ゆ", "ぞ"],
    ["r", "こ", "ゃ", "ご"],
    ["u", "ち", "に", "ぢ"],
    ["d", "て", "な", "で"],
    ["k", "き", "の", "ぎ"],
    ["c", "す", "ろ", "ず"],
    [",", "ね", "む", "ぺ"],
    ["e", "た", "り", "だ"],
    ["i", "く", "る", "ぐ"],
    ["s", "し", "あ", "じ"],
    ["l", "い", "ょ", "ぽ"],
    ["x", "ひ", "ー", "び"],
    [".", "ほ", "わ", "ぼ"],
    ["w", "か", "え", "が"],
    ["o", "つ", "ま", "づ"],
    ["a", "う", "を", "ゔ"],
    [";", "ん", "っ", "："],
    ["z", "．", "ぅ", "."],
    ["/", "・", "ぉ", "／"],
    ["q", "。", "ぁ", "ぁ゙"],
    ["p", "，", "ぇ", "ぴ"],

    ["`", "‘", "’", "かっこ"],      /* US配列に合わせる*/
    ["1", "1", "ф", "一"],
    ["6", "6", "［］", "六"],
    ["2", "2", "〇", "二"],
    ["7", "7", "《》", "七"],
    ["3", "3", "§", "三"],
    ["8", "8", "【】", "八"],
    ["4", "4", "「", "四"],
    ["9", "9", "※", "九"],
    ["5", "5", "」", "五"],
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

class ShiftKey {
    constructor(){
        this.startTime = 0;   // 押下時間管理
        this.Generation = 0;    // 世代管理 (0~1023)
        this.timerid = null;    // タイマーID管理
        this.Active = false;
    }

    KeyDown(){
        let live = false;
        if( !this.Active ){
            this.Active = true;  // 押下中
            this.Generation = (this.Generation + 1) % 1024;   // 世代管理
            this.startTime = Date.now();  // 押下時間管理
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

const SPCKey = new ShiftKey();  // SPCキー管理
const MJKey = new MojiKey();  // 文字キー管理

//  Key Down時に呼び出される.
function thumbShift(keyData){
    let action   = false;
    let lkey     = "";
    let keyinx   = -1;

    if( !keyData.ctrlKey ){     // Ctrl 押されてないこと。
        if( keyData.code === "Enter" && !MJKey.getKanaOffset() ){     // 
            ZenKakuteiKey( keyData );  // 全確定 or 先頭確定
        }
        else {
            lkey = keyData.key.toLowerCase();   // 小文字検索の為
            keyinx = GetKanaIndex( lkey );
            //console.log(`x:${keyData.code}/${keyData.key}/${keyinx}/${lkey}`);
            if( keyinx >= 0 ){
                action = true;
                if( keyinx === 0 ){   // SPCキー押下
                    setConvKanaDownSpc(keyData)    ;   // convKana 設定：SPC.
                } else {                            // 通常キー入力
                    setConvKanaDownKey( keyinx, (keyData.shiftKey) );   // convKana 設定：key.
                }
            } 
            else if( keyData.code === "AltLeft" ){
                convKana = [false,103,''];   // SSKeyUp でUSモード
            }
        }
    }
    return action;
}

//  SPC押下時の convKana 設定. 
function setConvKanaDownSpc(keyData){
    //console.log(`SPC:${keyData.shiftKey}/${MJKey.IsActive()}/${insidebuf}/`);
    if( SPCKey.KeyDown() ){    // SPCkey管理
        if( MJKey.IsActive() ){   // 文字キーが押されている場合は、シフト+文字の変換.
            convKana = [false, 0, kanashifttable[convKana[1]][2]]; 
            BackOne();  // 直前の文字を消す処理.
            MJKey.ExpandLongTimer();  // 文字キーの長押し判定時間を延長
        }
        else if( insidebuf.length === 0 ){   // insidebufが空のとき
            convKana = [false, 0, " "];  // 単なるSPCを一旦設定
        }
        else if( MJKey.getKanaOffset() ){   // 変換候補の操作.
            //console.log(`SPC10:/${insidebuf}/`);
            SPCKey.SetLateKeyDown( SPCLateKeyDown, keyData.shiftKey );  // シフトの遅延処理をセット
            convKana[0] = true;
        }
        else {      // insidebufの吐き出しと空白の吐き出し
            //console.log(`SPC20:/${insidebuf}/`);
            fixAll();     // 確定
            CommitOne(" ");   // SPCをアプリに渡す.
            convKana[0] = true;
        }
    }
    else convKana[0] = true;    // SPCリピート無効
    //console.log(`SPCout:/${insidebuf}/`);
}

//  Key押下時の convKana 設定. 
function setConvKanaDownKey( keyinx, keyshift ){
    //console.log(`KY:(${keyinx})${convKana}/${keyshift}`);
    if( MJKey.KeyDown( keyinx ) ){   // 文字キー管理
        if( keyshift ){         // shift key押下.
            convKana = [false, keyinx, kanashifttable[keyinx][0].toUpperCase()];    // 大文字
            MJKey.setKanaOffset(0);     // US大文字.
        }
        else if( SPCKey.IsActive() ){   // SPCキーが押されている場合は、シフト+文字の変換.
            if( !SPCKey.ClearKeyDownTimer() ){  // SPCの遅延処理クリア
                BackOne();  // 直前の空白を消す処理.
            }
            if( MJKey.IsMultiTap(SPCKey.GetGeneration()) ){   // 同一世代かつ同一キーの判定
                convKana = [false, keyinx, kanashifttable[keyinx][MJKey.getNextoffset()]]; 
            }
            else {
                MJKey.SetShiftGeneration(SPCKey.GetGeneration());  // Shiftキーの世代を文字キーにセット
                convKana = [false, keyinx, kanashifttable[keyinx][MJKey.setKanaOffset(2)]];  // シフト+文字の変換
            }
        }
        else {
            convKana = [false, keyinx, kanashifttable[keyinx][MJKey.getKanaOffset()]];  // シフト+文字の変換
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
        let lkey = keyData.key.toLowerCase();   // 小文字検索の為
        let keyinx = GetKanaIndex( lkey );

        if( keyinx === 0 ){
            SPCKey.KeyUp();   // SPCキー管理
//            if( SPCKey.KeyUp() ){    // SPCkey管理
//                if(insidebuf.trim().length === 0) {    // insidebufに何かある
//                    SPCLateKeyDown( keyData.shiftKey );  // シフトの遅延処理を実行
//                }
//                else{
//                    //fixAll();     // 確定
//                    CommitOne(" ");   // SPCをアプリに渡す.
//                }
//            }
        }
        else if( keyinx > 0 ){
            if( keycondition < 1024 ){
                if( MJKey.IsLongPress() && insidebuf.length > 0 ){ 
                    // Key 長押しが判明，確定文字を一つ削除してからオフセット3の文字を確定する
                    BackOne();
                    convKana[2] = kanashifttable[keyinx][MJKey.setKanaOffset(3)];  // オフセット3の文字を確定する
                    keyValidiate();  // 確定処理
                }
            }
            MJKey.KeyUp();   // 文字キー管理    
        }
        else {
            if( keycondition < 1024 ){
                if( convKana[1] === 103 && convKana[2] === "" ) changeAndClear();    // 英モード
            }
            else if( convKana[1] === 102 && convKana[2] === "" ) changeAndClear();  // 日 Mode
        }
    }
}

// シフトの遅延処理
function SPCLateKeyDown( eiShift ){
    //console.log(`SPCLate:${convKana}/${insidebuf.length}`);
    if( eiShift ) fixOne();        // Shift付きは先頭確定.
    else setOtherCandidate( 1 );   // 先頭変換.
}

function ZenKakuteiKey( keyData ){
    if( keyData.shiftKey || compoinfo < 0 ) fixOne();  // 先頭確定.
    else fixAll();                                      // 全確定.
}

// 単独SPC KeyUp の際に SPCをアプリに渡すか変換候補を変更するか判断
//function SPConlyUp( keyData ){
//    let action = false;
//    //console.log(`SPCUP:${convKana}/${insidebuf.length}`);
//    if( convKana[2] === " " ){   // SPCの単独押しであることの判定
//        action = true;
//        BackOne();  // 直前のスペースを消す処理.
//        if( insidebuf.length === 0 ){
//            // insidebufが空のときは、SPCをアプリに渡す.
//            CommitOne( " " );  // SPCをアプリに渡す.
//        }
//        else {
//            // insidebufが空でないときは、次変換候補の表示処理に.
//            if( keyData.shiftKey ) fixOne();        // Shift付きは先頭確定.
//            else setOtherCandidate( 1 );            // 先頭変換.
//            //UndoConvert(1);  // 変換前の状態に戻す.
//        }
//    }
//    return action;
//}

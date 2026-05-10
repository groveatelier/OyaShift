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
    ["h", "は", "ば", "み"],
    ["b", "へ", "ぃ", "べ"],
    ["n", "め", "ぷ", "ぬ"],
    ["t", "さ", "れ", "ざ"],
    ["y", "ら", "ぱ", "よ"],
    ["f", "け", "ゅ", "げ"],
    ["j", "と", "ど", "お"],
    ["v", "ふ", "や", "ぶ"],
    ["m", "そ", "ぞ", "ゆ"],
    ["r", "こ", "ゃ", "ご"],
    ["u", "ち", "ぢ", "に"],
    ["d", "て", "な", "で"],
    ["k", "き", "ぎ", "の"],
    ["c", "す", "ろ", "ず"],
    [",", "ね", "ぺ", "む"],
    ["e", "た", "り", "だ"],
    ["i", "く", "ぐ", "る"],
    ["s", "し", "あ", "じ"],
    ["l", "い", "ぽ", "ょ"],
    ["x", "ひ", "ー", "び"],
    [".", "ほ", "ぼ", "わ"],
    ["w", "か", "え", "が"],
    ["o", "つ", "づ", "ま"],
    ["a", "う", "を", "ゔ"],
    [";", "ん", "：", "っ"],
    ["z", "．", "ぅ", "."],
    ["/", "・", "／", "ぉ"],
    ["q", "。", "ぁ", "ぁ゙"],
    ["p", "，", "ぴ", "ぇ"],

    ["`", "‘",  "かっこ", "’"],      /* US配列に合わせる*/
    ["1", "1",  "ф", "一"],
    ["6", "6",  "六", "［］"],
    ["2", "2",  "〇", "二"],
    ["7", "7",  "七", "《》"],
    ["3", "3",  "§", "三"],
    ["8", "8",  "八", "【】"],
    ["4", "4",  "「", "四"],
    ["9", "9",  "九", "※"],
    ["5", "5",  "」", "五"],
    ["0", "0",  "０", "、"],

    ["-", "-", "√", "±"],
    ["=", "=", "×", "÷"],
    ["[", "』", "《《》》", "『"],
    ["\\", "￥","くりかえし","＼"],
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
        this.Generation = 0;    // 世代管理 (0~1023)
        this.Active = false;
    }

    KeyDown(){
        this.Generation = (this.Generation + 1) % 1024;   // 世代管理
        this.Active = true;  // 押下中
    }

    KeyUp(){
        this.Active = false;
    }

    IsActive(){
        return this.Active;
    }

    GetGeneration(){
        return this.Generation;
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
        this.prevkanaofs = 1;     // 直前のかな変換offset量
    }

    KeyDown( index ){
        this.Active = true;  // 押下中
        this.startTime = Date.now();  // 押下時間管理
        this.prevkeyIndex = this.keyIndex;
        this.keyIndex = index;  // キーインデックス管理
    }

    KeyUp(){
        this.Active = false;
    }

    IsActive(){
        return this.Active;
    }

    LongPress(){
        return this.Active && (Date.now() - this.startTime > 1200);  // 長押し判定
    }

    SetShiftGeneration( gen ){
        this.ShiftGeneration = gen;
    }

    IsMultiTap( gen ){
        return this.ShiftGeneration === gen && this.prevkeyIndex === this.keyIndex;  // 同一世代かつ同一キーの判定
    }

    getNextoffset(){
        this.kanaoffset = ( this.kanaoffset + 1 ) % 4;    //文字オフセット変更
        this.prevkanaofs = this.kanaoffset;  // 直前のかな変換offset量を保存.
        return this.kanaoffset;
    }

    setKanaOffset( offset ){
        this.kanaoffset = offset;     // かな変換offset量セット
        this.prevkanaofs = this.kanaoffset;  // 直前のかな変換offset量を保存.
        return this.kanaoffset;
    }

    getKanaOffset(){
        return this.prevkanaofs ? 1 : 0;     // かな変換offset量取得
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
        //lkey = keyData.key.toLowerCase();   // 小文字検索の為
        //keyinx = GetKanaIndex( lkey );
        keyinx = GetKanaIndex( keyData.key );
        //console.log(`x:${keyData.code}/${keyData.key}/${keyinx}/${lkey}`);
        if( keyinx >= 0 ){
            action = true;
            if( keyinx === 0 ){   // SPCキー押下
                setConvKanaDownSpc()    ;   // convKana 設定：SPC.
            } else {                            // 通常キー入力
                setConvKanaDownKey( keyinx, (keyData.shiftKey) );   // convKana 設定：key.
            }
        } 
    }
    return action;
}

//  SPC押下時の convKana 設定. 
function setConvKanaDownSpc(){
    SPCKey.KeyDown();   // SPCキー管理
    if( MJKey.IsActive() ){   // 文字キーが押されている場合は、シフト+文字の変換.
        convKana = [false, 0, kanashifttable[convKana[1]][2]]; 
        BackOne();  // 直前の文字を消す処理.
    }
    else {
        convKana = [false, 0, " "];  // 単なるSPC
    }
}

//  Key押下時の convKana 設定. 
function setConvKanaDownKey( keyinx, keyshift ){
//    console.log(`KY:(${kinx})${convKana}/${keyshift}`);
    MJKey.KeyDown( keyinx );   // 文字キー管理
    if( keyshift ){         // shift key押下.
        convKana = [false, keyinx, kanashifttable[keyinx][0].toUpperCase()];    // 大文字
        MJKey.setKanaOffset(0);     // US大文字.
    }
    else if( SPCKey.IsActive() ){   // SPCキーが押されている場合は、シフト+文字の変換.
        BackOne();  // 直前の文字を消す処理.
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
    //let lkey = keyData.key.toLowerCase();   // 小文字検索の為
    //let keyinx = GetKanaIndex( lkey );
    let keyinx = GetKanaIndex( keyData.key );

    if( keyinx === 0 ){
        SPCKey.KeyUp();   // SPCキー管理
        if( keycondition < 1024 ){ 
            //UndoConvert( true );  // 変換候補確定とか
            if( convKana[1] === 102 && convKana[2] === "" ) changeAndClear();    // 日モード
        }
    }
    else if( keyinx > 0 ){
        MJKey.KeyUp();   // 文字キー管理    
        if( keycondition < 1024 ){
            if( MJKey.LongPress() ){ 
                // Key 長押しが判明，確定文字を一つ削除してからオフセット3の文字を確定する
                BackOne();
                convKana[2] = kanashifttable[keyinx][MJKey.setKanaOffset(3)];  // オフセット3の文字を確定する
                keyValidiate();  // 確定処理
            }
            else if( convKana[1] === 103 && convKana[2] === "" ) changeAndClear();
        }
    }
}


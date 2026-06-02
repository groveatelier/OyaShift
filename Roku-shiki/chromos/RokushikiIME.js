/*  2026.05.29 20:00
  Oya Key shift keyboard (自作キーボード用)
    
    >> Spcial keys << inbuf.length > 0 
    "\"(Backslash) : enter                 
    "'"(Quote)     : BackSpace            
    "]"(BracketRight) : 記号入力特殊キー

    カーソル行表示：最初は検索文字（ひらがな）のみの表示、入力増で適度に変換候補筆頭を表示.
    候補窓表示：ユーザー意思の変換が実行される前は 2行のみの窓とし、inbufを表示
            ユーザー意思の変換が実行された後は1行目はinbuf, ２行目以降を data１段目の
            変換候補を表示する.    
*/
/*const { cloneElement } = require("react"); */

class FIFO {
    constructor(){
        this.inbuf = "";    // 入力バッファ
        this.curbuf = "";   // カーソル行バッファ
        this.bufptr = 0;    // バッファ内ポインター
    }

    isEmpty() { return (this.inbuf.length === 0); }
    isAvailable() { return (this.inbuf.trim().length > 0); }
    substr( num ){ this.inbuf = this.inbuf.substring( num ); }

    clear(){
        this.inbuf = "";
        this.curbuf = "";
        this.bufptr = 0;
    }

    pullOne() {
        if( this.isEmpty() ) return null;
        const first = this.inbuf[0];
        this.inbuf = this.inbuf.slice(1);
        return first;
    }

    pushOne( moji ){
        // need commit then return false
        if( this.bufptr < 0 ){
            const temptext = this.inbuf.slice(0, this.bufptr) + moji 
                    + this.inbuf.slice(this.inbuf.length + this.bufptr);
            this.inbuf = temptext;
        } else if( this.inbuf.length === 0 && "。、―".indexOf( moji ) >= 0 ) return false;
        else {
            this.inbuf += moji;     // 確定済キー.
        }
        return true;
    }

    deleteLastOne(){
        if( this.bufptr < 0 && this.inbuf.length + this.bufptr > 0){
            const tempbuf = this.inbuf.slice(0, this.bufptr-1) 
                        + inbuf.slice(inbuf.length + this.bufptr);
            this.inbuf = tempbuf;
            if( this.inbuf.length + this.bufptr < 0 ) this.bufptr = -this.inbuf.length;
        } else this.inbuf = this.inbuf.slice(0,-1);   // javaの仕様上inbufが空でもOK
    }

    remakeFIFO( stepbuf ){
        this.inbuf = "";
        for( let depth = 0; depth < stepbuf.length; depth++ ){
            this.inbuf += stepbuf[depth][0];     // inbuf作り直し.
        }
    }

    pullTop(){
        if( this.bufptr < 0 ){            // 今は無変換確定になりますね.
            const pulledtext = this.inbuf.slice(0, this.bufptr);
            const restin = this.inbuf.slice(this.inbuf.length+this.bufptr);
            this.inbuf = restin;
            return pulledtest;
        }
        return null;
    }

}

class Converter{
    constructor(fifo){
        this.fo = fifo;
        this.candidate = [];    // 変換候補 ver2.2以降.
        this.index = -1;        // 変換候補用 index
        this.data = [];         // 変換候補データ IME結果
        this.netgetid = null;   // google変換待ちタイマーID
        this.initialize();
    }

    initialize( word = "" ){
        this.candidate = [{annotation:"<入力>", candidate:word, id:0}]; // 変換候補 ver2.2以降.
        this.index = 0;
    }

    clearData(){
        this.data = [];
        this.fo.clear();
    }

    // カーソル行に表示する文字列を作成 : 適度に変換筆頭文字を加える.
    makeCursolbuf(){
        if( this.data.length > 0 ){
            let imeline  = this.index > 0 ? this.candidate[ this.index ].candidate : this.data[0][1][0];
            let limitcnt = 1;
            if( this.fo.inbuf.length >= 8 ){            // 筆頭変換制限.
                limitcnt = this.fo.inbuf.length >> 2;   // 4文字単位だと多い？ どうする?
            }
            //  筆頭候補を一本につなげる. 
            for( let depth = 1; depth < this.data.length; depth++ ){
                let mayoke = this.data[depth][0].length * 2;  // 2倍変換文字列は対象外.
                if( --limitcnt > 0 && this.data[depth][1][0].length < mayoke )
                    imeline += this.data[depth][1][0];       // 筆頭候補をつなげる.
                else imeline += this.data[depth][0];          // 変換無し.
            }
            this.fo.curbuf = imeline;
        }
        else this.fo.curbuf = this.fo.inbuf;
    }

    remakeFIFO(){
        this.fo.remakeFIFO( this.data );
        this.candidate[0].candidate = this.fo.inbuf;
        this.index = 0;             // 候補筆頭も取り止め.
    }

    indexUpDown( updown ){
        this.index += updown;
        if( this.index < 0 ) this.index = this.candidate.length - 1;
        else if( this.index >= this.candidate.length ){
             this.index = 0;
             return true;  //  下の下へ    
        }
        return false;
    }

    // ひらがな−カタカナ コード変換を行う.
    // input: Hira2Kata true - カナ2かな, false - かな2カナ.
    convertKana2( Hira2Kata ){
        const mojihani = Hira2Kata ? [12353,12439,12445,12446] : [12449,12535,12541,12542];
        const shiftval = Hira2Kata ? 96 : -96;
        let kanabuf  = [];
        for(let ofs = 0; ofs < this.fo.inbuf.length; ofs++ ){
            let hirachar  = this.fo.inbuf.codePointAt( ofs );
            let hirachar2 = hirachar;
            if((mojihani[0] <= hirachar && hirachar <= mojihani[1])
                ||(mojihani[2] <= hirachar && hirachar <= mojihani[3])){ // 変換文字範囲の場合.
                hirachar2 += shiftval;
            }
            kanabuf += String.fromCharCode(hirachar2);
        }
//        console.log(`kana2:/${this.fo.inbuf}/${kanabuf}/`)
        this.initialize( kanabuf );
        this.candidate[0].annotation = this.fo.inbuf;
        this.data = [[ this.fo.inbuf, [kanabuf, this.fo.inbuf]]];
    }

    // candidate 作成.
    makeCandidate( mode ){
        this.initialize( this.fo.inbuf );   // candidate初期化.
        if( this.data.length >= 1 )         // dataが存在すれば実行.
            this.copyTo( this.data[0][1], mode ); // 一段目の候補を設定: candidateに複製.
        return;   
    }

    // candidate 作成.
    makeCandidate2( imeStep ){
        this.initialize( this.fo.inbuf );   // candidate初期化.
        if( this.data.length >= 1 )         // dataが存在すれば実行.
            this.copyTo2( this.data[0][1], imeStep ); // 一段目の候補を設定: candidateに複製.
        this.mergeData()
        return;   
    }

    // candidate へのデータ設定.
    copyTo( arrayone, mode ){
        for( let pos = 0; pos < arrayone.length; pos++ ){
            let idno = this.candidate.length;
            if( arrayone[pos] !== this.candidate[0].candidate ){
                if( mode === 3 ){
                    this.candidate.push({annotation:arrayone[pos+1], candidate:arrayone[pos], id:idno});
                    pos++;
                }
                else this.candidate.push({annotation:"", candidate:arrayone[pos], id:idno});
            }
        }
    }

    // candidate へのデータ設定.
    copyTo2( arrayone, imeStep ){
        for( let pos = 0; pos < arrayone.length; pos++ ){
            let idno = this.candidate.length;
            if( arrayone[pos] !== this.candidate[0].candidate ){
                if( imeStep === 0 ){
                    this.candidate.push({annotation:arrayone[pos+1], candidate:arrayone[pos], id:idno});
                    pos++;
                }
                else this.candidate.push({annotation:"", candidate:arrayone[pos], id:idno});
            }
        }
    }

    mergeData(){
        if( gidata === null && gidata.length === 0 ) return;  // マージするデータがないときは何もしない.
        if( this.data.length === 0 ){
            this.data = structuredClone( gidata );
            // 消してから追加すれば、常に先頭に
            const nginx = this.data[0][1].indexOf( this.data[0][0] );   
            if( nginx >= 0 ) this.data[0][1].splice( nginx, 1 );
            this.data[0][1].unshift( this.data[0][0] );
        }
        else{
            const maxlayer = this.data.length > gidata.length ? this.data.length : gidata.length;
            for( let layer = 0; layer < maxlayer; layer++ ){
                if( this.data[layer] && gidata[layer] && this.data[layer][0] === gidata[layer][0] ){
                    for( let element = 0; element < gidata[layer][1].length; element++ ){
                        if( !this.data[layer][1].includes( gidata[layer][1][element]) )
                            this.data[layer][1].push( gidata[layer][1][element] );
                    }
                }
            }
         }
        gidata = null;  // マージ済は削除
    }

    // Google IME の出力待ち.
    setNetInterval(){
        this.clearNetInterval();
        this.netgetid = setInterval(() => {
            if( controller === null ){
                if( gidata === null ) this.clearNetInterval();
                else {
                    this.clearNetInterval();
                    this.mergeData();
                }
            }            
        }, 300);
    }

    clearNetInterval(){
        if( this.netgetid ) clearInterval( this.netgetid );
        this.netgetid = null;
    }

}

class Renderer{
    constructor(converter){
        this.con = converter;
        this.context = -1;
        this.convCandidate = false;
    }

    //  カーソル行表示と候補窓表示を消去.
    clearComposition(){
        if( this.context >= 0 ) 
            chrome.input.ime.clearComposition({contextID: this.context});
        this.invibleCandidate();
        this.con.clearData();
    }

    //  候補窓表示を消去.
    invibleCandidate(){
        chrome.input.ime.setCandidateWindowProperties({
            engineID: engine,
            properties:{
                visible:false
            }
        });
        this.con.initialize();
        this.convCandidate = false;
    }

    // 無変換処理.
    undo(){
        if( !this.convCandidate ){
            this.clearComposition(); // 変換無状態なら 入力自体をクリア.
            return false;
        }
        else {
            this.con.remakeFIFO();  // inbuf作り直し.
            this.convCandidate = false;   // 変換も無効.
        }
        return true;
    }

    // テキスト(カーソル行)の表示.
    showLine( text ){
    //    console.log(`cur>${text}`); 
        const obj = {
            contextID: this.context,
            text: text,
            cursor: text.length,
            selectionStart: 0,
            selectionEnd: text.length+this.con.fo.bufptr
        };
        chrome.input.ime.setComposition(obj); // カーソル位置に未変換文字列をアンダーライン表示
    }

    //  dataから cursol lineを作り直して表示.
    showComposition(){
        if( this.con.fo.bufptr < 0 ){
            this.showLine( this.con.fo.inbuf );
        } else {
            this.con.makeCursolbuf();
            this.showLine( this.con.fo.curbuf );
        }
    }

    showCandidates( mode ){
        let auxtext = "六式 IME";
        let displines = this.convCandidate ? this.con.candidate.length : 2;  // 変換無
        const curpos = displines <= this.con.index ? displines-1 : this.con.index;
        if( mode === 0 ) auxtext = "google IME cgi";
        else if( mode === 3 ) auxtext += " cahce";
        if( this.con.candidate.length > 0 ){
            displines = this.con.candidate.length;
//          console.log(`sC:${this.con.index}/${curpos}`);
            if( displines > 10 ) displines = 10;
            chrome.input.ime.setCandidateWindowProperties({
                engineID: engine,
                properties:{
                    visible: true,
                    cursorVisible: true,
                    vertical:true,
                    pageSize: displines,
                    totalCandidates: this.con.candidate.length,
                    currentCandidateIndex: this.con.index,
                    auxiliaryText: auxtext,
                    auxiliaryTextVisible: true
                }
            });
            chrome.input.ime.setCandidates({
                contextID:this.context,
                candidates:this.con.candidate
            });
            if( this.con.index >= 0 ){
                chrome.input.ime.setCursorPosition({
                    contextID:this.context,
                    candidateID:curpos 
                })
            }
        }
    }

    showCompositionAnd( mode ){        // バインド関数
        this.showComposition();
        if (this.con.fo.isAvailable()) this.showCandidates( mode );     // fifo 空白文字以外もあるときは候補表示する
    }

    undoConvert( mode ){
        if( this.undo() ) this.showCompositionAnd( mode );  // 表示と変換候補窓を更新.
    }

    //  別の候補文字を設定する.
    // 呼び出し元はcandidate.length > 0 を要確認.
    otherCandidate( updown, mode ){
        this.convCandidate = true;
        if( this.con.indexUpDown( updown ) ) return true;   // IME変更要求
        this.showCompositionAnd( mode );
        return false;
    }

    translateKana2( Hira2Kana ){
        this.con.convertKana2( Hira2Kana );
        this.convCandidate = true;
        this.showComposition();
    }
}

class Commit{
    constructor(render, fifo)
    {
        this.rn = render;
        this.fo = fifo;
    }

    commitText( text ){ // 文字確定.
        chrome.input.ime.commitText({
            "contextID": this.rn.context, 
            "text": text
        });
    }

    commitOne( moji ){  // 一文字確定
        this.commitText( moji );
        if( this.fo.isEmpty() ){    // FIFO が空の場合
            this.rn.clearComposition();
        }
        else{
            this.rn.convCandidate = false;  // 空でなくてもこれだけは
        }
    }

    commitFO(){                         // FIFOから一個出力
        const moji = this.fo.pullone();
        if( moji ) this.commitOne( moji );
    }

    pushAndCommitIfNeed( moji ){
        console.log(`pc(${this.fo.bufptr}):${moji}`);
        if( this.fo.pushOne( moji )) return false;
        this.commitOne( moji );
        return true;
    }

    //  先頭の検索キーを確定させる
    preCommit(){
        //  異状停止: 入力無し状態で呼ばれたくない。デバッグ用に停止コードを仕込む.
        //if( this.rn.con.data.length <= 0 || this.fo.isEmpty() ){ //---------------------------
        //    console.log(`@@ Halt-preCommit: data=${this.rn.con.data}, inbuf=${this.fo.inbuf}`);
        //    while(true);        // debug stop
        //}   //---------------------------------------------------------------------------

        //  候補選択がない場合は 未変換のまま.
        const validiate = this.rn.con.candidate[this.rn.con.index].candidate;
        let optionext = "";
        console.log( `preCmt>${validiate}-${this.rn.con.candidate[this.rn.con.index].candidate}(${this.rn.con.index})` );
        this.fo.substr( this.rn.con.data[0][0].length );

        // 確定オプション: data 二段目が 「てにをは」なら二段目も確定させる.
        if( this.rn.con.data.length > 1 ){
            const optionmoji = "てにをはのもでがと、。";
            if( optionmoji.indexOf( this.rn.con.data[1][0] ) >= 0 ){
                optionext = this.rn.con.data[1][0];      // 二段目を追加確定.
                this.fo.substr( this.rn.con.data[1][0].length );
                this.rn.con.data.splice(1,1);            // 二段目も消しておく.
            }
        }

        this.commitText( validiate+optionext );
        return validiate;
    }

    //  先頭候補確定.
    commitTopCandidate( mode ){
        let allclear = false;
        console.log(`cmtTop>${this.rn.con.data}/${this.fo.inbuf}/${this.rn.con.index}`);
        // 最前一個を確定させる.
        const text = this.fo.pullTop();
        if( text ) this.commitText( text );
        else if( this.rn.con.data.length > 0 ) PrefixOne();
        if( !this.fo.isEmpty() ){
            this.rn.showCompositionAnd( mode );         // 残りの文字を表示.
        } else {
            this.rn.clearComposition();
            allclear = true;
        }
        console.log(`cmdTop<${this.rn.con.data}/${this.fo.inbuf}`);
        return allclear;
    }


}

class UIMenu{
    constructor(){
        this.menuInp = "minput";
        this.menuArg = [{"id": this.menuInp, "label": "かな"}];
    }

    itemRevise( isjp ){
        this.menuArg[0].label = isjp ? "かな" : "英字"; // かな入力モード.
    }

    itemUpdate( isjp ){
        this.itemRevise( isjp );
        chrome.input.ime.updateMenuItems({
            "engineID": engine,
            "items": this.menuArg
        });
    }
}

const fifo = new FIFO();
const con = new Converter(fifo);
const ren = new Renderer(con);
const cmt = new Commit(ren,fifo);
const mnu = new UIMenu();

chrome.input.ime.onFocus.addListener(function(context) {
    ren.context = context.contextID;
});

chrome.input.ime.onBlur.addListener(function(context) {
    ren.context = -1;
    ren.clearComposition();
    console.log(`onBlur`);
});

chrome.input.ime.onActivate.addListener(function(eng,scrtype){
    console.log(`onActivate:${eng}/${scrtype}`);
    mnu.itemRevise( cmap.jpmode );   // menu item 更新.
    chrome.input.ime.setMenuItems({
        "engineID": engine,
        "items": mnu.menuArg
    });
});

chrome.input.ime.onMenuItemActivated.addListener(function(eng,name){
    if( eng == engine ){
        if( name == mnu.menuInp ){  // 入力モードがクリックされた.
            cmap.changeJPandUS();
            ren.clearComposition();
        }
        mnu.itemUpdate();       // menu Item update
    }
});

chrome.input.ime.onCandidateClicked.addListener(
    function(engineID, candidate, button, mouse) {
    	if(cmap.jpmode && button == "left"){
            con.index = candidate;                   // set index
            ren.showComposition();
        }
    }
);

//  PrefixOne: 先頭の検索キーを確定させ, 辞書に登録する.
//  入力: candidate, data, inbuf
//  出力: data, inbuf
//  操作: 辞書登録, commitText, 候補窓変更
function PrefixOne(){   // 先頭確定.
    const validiate = cmt.preCommit();
    console.log(`Prefix:${validiate}`);

    dic.saveEntry2Rokushiki( con, validiate ); // 先に変換データを保存.
    con.data.splice(0,1);           // dataの一段目を削除.
    ren.invibleCandidate();         // candidate windowの消去.

//    if( con.data.length > 0 ) makeCandidate();   // candidateの作り直し
    con.makeCandidate( dic.mode );  // candidateの作り直し
    console.log( `PrefixOne<${validiate}:${fifo.inbuf}` );
}

//  fixAll： 全確定はカーソル行表示をそのまま確定させる.
function fixAll(){  //  変換候補を全FIX.
    cmt.commitText( fifo.curbuf );
    if( con.data.length > 0 ){
        for( let depth = 1; depth < con.data.length; depth++ )
            con.data[0][0] += con.data[depth][0];
        console.log(`fixAll>${fifo.curbuf}`);
//        console.log(con.data);

        // 長文登録は避ける 文字数制限を実施.
        if( con.data[0][0].length < 16 )
            dic.saveEntry2Rokushiki( con, fifo.curbuf );    // 先に変換データを保存.
    }
    con.clearData();    // dataを削除.
    ren.invibleCandidate(); // candidate windowの消去.
}

//  別の候補文字を設定する.
// 呼び出し元はcandidate.length > 0 を要確認.
function setOtherCandidate( updown ){
    if( ren.otherCandidate( updown, dic.mode ) ) SelectIME();    // IME切り替え.
}

// 辞書から変換文字列を検索し、dataを作成する.
// 入力: inbuf - 変換入力文字
// 出力: data, Index
function GetNiwaDictEntry(){
    con.data = [];
    if( !dic.opened ){        // local 辞書が読まれる前は待つ.
        dic.open();
        ren.showLine( fifo.inbuf );      // 辞書が開くまでの暫定表示.
        fifo.curbuf = fifo.inbuf;
    } else {
        let tagtext  = fifo.inbuf;   // 変換対象文字列.
        let stoplimit = 64;         // 長文変換の制限.
        dic.mode = 2;                // Rokushiki IME 動作―早めに設定要.

        // textの中に変換候補文字列があるか検索.
        while( tagtext.length > 0 ){
            if( stoplimit-- <= 0 ){
                console.log(`*Stop limit* (${stoplimit}):${tagtext}`); 
            }
            let entryone  = [];     // dataに展開する1エントリ.
            for( let depth = 1; depth < dic.rokushiki.length; depth++ ){     // 辞書検索ループ.
                let etag   = dic.copyEntry( depth );            // etag <- dic.rokushikiの参照
                let hitpos = tagtext.indexOf( etag[0] );    // 変換文字にヒットするか?
                if( hitpos >= 0 ){                          // hit
                    if( hitpos === 0 ){                     // 先頭で一致.
                        entryone = [];                  // entryone初期化.
                        entryone.push( etag[0] );       // dataにも変換前文字列を入れる.
                        entryone.push( etag[3] );       // dataに変換候補郡を入れる.
                        entryone[1].unshift( etag[0] ); // 変換候補郡先頭は検索文字.
                        con.data.push( entryone );      // dataに1エントリ追加.
 
                        if( tagtext !== etag[0] ){      // 前方一致?
                            let newtag = tagtext.slice(( etag[0].length - tagtext.length ));
                            tagtext = newtag;               // 残り検索文字設定.
                            //console.log( `>> Rest:${tagtext}(${stoplimit})` );
                        } else {
                            tagtext = "";                   // 完全一致は残り検索文字無し.
                            break;
                        }
                    } else {
                        //console.log( `>> Post hit:(${hitpos})${etag}` );
                        let pretag = tagtext.split( etag[0] )[0];  // hit前の文字列切り出し.
                        entryone = [ pretag, [pretag] ];        // data 1エントリ準備
                        con.data.push( entryone );              // data 1エントリ追加.
                        let newtag = tagtext.slice( pretag.length ); // 残検索文字の切り出し.
                        tagtext = newtag;
                    }
                }
            }
            if( entryone.length <= 0 ){             // 一致なし：検索文字そのまま.
                entryone = [ tagtext, [tagtext] ];    // data 1エントリ準備
                con.data.push( entryone );           // data 1エントリ追加.
                //console.log( `>> No hit:${tagtext}` );
                break;
            }
        }
    }
}

// Google IME の終了待ち
function googleConvert(){
    if( controller === null && gidata === null ) con.clearNetInterval();
    if( controller === null && gidata ){
        con.clearNetInterval();
        con.mergeData();
    }
}

//---- 居眠り防止 ------------------------------------
async function setUpOffscreen() {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['BLOBS'],
      justification: 'To keep service worker',
    });
}

// 拡張機能インストール時にoffscreen作成
chrome.runtime.onInstalled.addListener(() => {
    setUpOffscreen();
});
  
// ブラウザ起動時にoffscreen作成
chrome.runtime.onStartup.addListener(() => {
    setUpOffscreen();
});
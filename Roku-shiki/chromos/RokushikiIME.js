/*  2026.06.08 23:00
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
            return true;
        } 
        else if( this.isEmpty() && "。、―".indexOf( moji ) >= 0 ){
            return false;
        }
        this.inbuf += moji;     // 確定済キー.
        return true;
    }

    deleteLastOne(){
        if( this.bufptr < 0 && this.inbuf.length + this.bufptr > 0){
            const tempbuf = this.inbuf.slice(0, this.bufptr-1) 
                        + this.inbuf.slice(this.inbuf.length + this.bufptr);
            this.inbuf = tempbuf;
            if( this.inbuf.length + this.bufptr < 0 ) this.bufptr = -this.inbuf.length;
        } else this.inbuf = this.inbuf.slice(0,-1);   // javaの仕様上inbufが空でもOK
    }

    remakeFIFO( stepbuf ){
        this.inbuf = stepbuf.map(step => step[0]).join(""); // inbuf作り直し 
    }

    pullTop(){
        if( this.bufptr < 0 ){            // 今は無変換確定になりますね.
            const pulledtext = this.inbuf.slice(0, this.bufptr);
            const restin = this.inbuf.slice(this.inbuf.length+this.bufptr);
            this.inbuf = restin;
            return pulledtext;
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
        this.googles = null;    // Google変換データ結果
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

    isGoogles(){ return ( this.googles && this.googles.length !== 0 ); }

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
        const [min, max] = Hira2Kata ? [12353, 12439] : [12449, 12535]; // 範囲をスッキリ定義
        const shiftval = Hira2Kata ? 96 : -96;
        
        // 配列化してmapで回すのがモダンなJSのスタイル
        const kanabuf = Array.from(this.fo.inbuf).map(char => {
            const code = char.codePointAt(0);
            return ((code >= min && code <= max) || code === 12445 || code === 12446 || code === 12541 || code === 12542)
                ? String.fromCharCode(code + shiftval)
                : char;
        }).join("");

        this.initialize(kanabuf);
        this.candidate[0].annotation = this.fo.inbuf;
        this.data = [[this.fo.inbuf, [kanabuf, this.fo.inbuf]]];
    }

    // candidate 作成.
    makeCandidate( cache ){
        this.initialize( this.fo.inbuf );   // candidate初期化.
        if( this.data.length >= 1 )         // dataが存在すれば実行.
            this.copyTo( this.data[0][1], cache ); // 一段目の候補を設定: candidateに複製.
        return;   
    }

    // candidate へのデータ設定.
    copyTo( arrayone, cache ){
        for( let pos = 0; pos < arrayone.length; pos++ ){
            if( arrayone[pos] !== this.candidate[0].candidate ){
                this.candidate.push({
                    annotation: cache ? arrayone[pos + 1] : "",
                    candidate: arrayone[pos],
                    id: this.candidate.length
                });
                if (cache) pos++;
            }
        }
    }

    // Google IME を丸コピ
    circleCopy(){
            this.data = structuredClone( this.googles );
            // 消してから追加すれば、常に先頭に
            const nginx = this.data[0][1].indexOf( this.data[0][0] );   
            if( nginx >= 0 ) this.data[0][1].splice( nginx, 1 );
            this.data[0][1].unshift( this.data[0][0] );
    }

    // Google IME のマージ
    // 階層や解釈がことなるケースの対応を考慮
    mergeData( cache ){
        let merged = false;
        if( !this.isGoogles() ) return; // マージするデータがないときは何もしない.
        if( this.data.length === 0 ){   // 元が無いケースは丸コピ
            this.circleCopy();
        }
        else{
            const maxlayer = this.data.length > this.googles.length ? this.data.length : this.googles.length;
            for( let layer = 0; layer < maxlayer; layer++ ){
                if( this.data[layer] && this.googles[layer] && this.data[layer][0] === this.googles[layer][0] ){
                    for( let element = 0; element < this.googles[layer][1].length; element++ ){
                        if( !this.data[layer][1].includes( this.googles[layer][1][element]) )
                            this.data[layer][1].push( this.googles[layer][1][element] );
                    }
                    merged = true;  // merge 済
                }
                else{
                    break;
                }
            }
        }
//        console.log(`mD:${this.data}/${merged}`);
        if( merged ){
            if( !cache ) this.makeCandidate( cache );   // cache mode でなければコールする
            this.googles = null;  // マージ済は削除
        }
    }
}

class Renderer{
    constructor(dictionary, converter){
        this.di = dictionary;
        this.con = converter;
        this.context = -1;
        this.convCandidate = false;
    }

    //  カーソル行表示と候補窓表示を消去.
    clearComposition(){
        if( this.context >= 0 ) 
            chrome.input.ime.clearComposition({contextID: this.context});
        this.invisibleCandidate();
        this.con.clearData();
    }

    //  候補窓表示を消去.
    invisibleCandidate(){
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
            selectionEnd: Math.max(0, text.length+this.con.fo.bufptr)
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

    showCandidates(){
        let auxtext = "六式 IME";
        let displines = this.convCandidate ? this.con.candidate.length : 2;  // 変換無
        const curpos = displines <= this.con.index ? displines-1 : this.con.index;
        if( this.di.isCacheState() ) auxtext += " cache";
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

    showCompositionAnd(){      // バインド関数
        this.showComposition();
        if (this.con.fo.isAvailable()) this.showCandidates();     // fifo 空白文字以外もあるときは候補表示する
    }

    undoConvert(){
        if( this.undo() ) this.showCompositionAnd();  // 表示と変換候補窓を更新.
    }

    //  別の候補文字を設定する.
    otherCandidate( updown ){
        this.convCandidate = true;
        const cache = this.di.isCacheState();
        //console.log(`oC:${this.con.googles}/${cache}`);
        if( !cache ) this.con.mergeData( cache );  // google IME のマージ
        if( this.con.indexUpDown( updown ) ) return this.di.IME_Select(this);   // IME変更要求
        this.showCompositionAnd();
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
        const moji = this.fo.pullOne();
        if( moji ) this.commitOne( moji );
    }

    pushAndCommitIfNeed( moji ){
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
//        console.log( `preCmt>${validiate}-${this.rn.con.candidate[this.rn.con.index].candidate}(${this.rn.con.index})` );
        this.fo.substr( this.rn.con.data[0][0].length );

        // 確定オプション: data 二段目が 「てにをは」なら二段目も確定させる.
        if( this.rn.con.data.length > 1 ){
            const optionmoji = "てにをはのもでがと、。";
            if(optionmoji.includes(this.rn.con.data[1][0])){
                optionext = this.rn.con.data[1][0];      // 二段目を追加確定.
                this.fo.substr( this.rn.con.data[1][0].length );
                this.rn.con.data.splice(1,1);            // 二段目も消しておく.
            }
        }

        this.commitText( validiate+optionext );
        return validiate;
    }

    //  先頭候補確定.
    commitTopCandidate(){
        let allclear = false;
//        console.log(`cmtTop>${this.rn.con.data}/${this.fo.inbuf}/${this.rn.con.index}`);
        // 最前一個を確定させる.
        const text = this.fo.pullTop();
        if( text ) this.commitText( text );
        else if( this.rn.con.data.length > 0 ) this.prefixOne();
        if( !this.fo.isEmpty() ){
            this.rn.showCompositionAnd(); // 残りの文字を表示.
        } else {
            this.rn.clearComposition();
            allclear = true;
        }
//        console.log(`cmdTop<${this.rn.con.data}/${this.fo.inbuf}`);
        return allclear;
    }

    prefixOne(){   // 先頭確定.
        const validiate = this.preCommit();
        //1console.log(`Prefix:${validiate}`);

        this.rn.di.saveEntry2Rokushiki( validiate ); // 先に変換データを保存.
        this.rn.con.data.splice(0,1);         // dataの一段目を削除.
        this.rn.invisibleCandidate();         // candidate windowの消去.

        this.rn.con.makeCandidate( this.rn.di.isCacheState() );  // candidateの作り直し
        //1console.log( `PrefixOne<${validiate}:${this.rn.fo.inbuf}` );
    }

    //  fixAll： 全確定はカーソル行表示をそのまま確定させる.
    fixAll(){  //  変換候補を全FIX.
        this.commitText( this.fo.curbuf );
        if( this.rn.con.data.length > 0 ){
            this.rn.con.data[0][0] = this.rn.con.data.map(item => item[0]).join("");
            //1console.log(`fixAll>${this.rn.fo.curbuf}`);

            // 長文登録は避ける 文字数制限を実施.
            if( this.rn.con.data[0][0].length < 16 )
                this.rn.di.saveEntry2Rokushiki( this.fo.curbuf );  // 先に変換データを保存.
        }
        this.rn.con.clearData();      // dataを削除.
        this.rn.invisibleCandidate(); // candidate windowの消去.
    }
}

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
});

chrome.input.ime.onCandidateClicked.addListener(
    function(engineID, candidate, button, mouse) {
    	if(cmap.jpmode && button == "left"){
            con.index = candidate;                   // set index
            ren.showComposition();
        }
    }
);

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

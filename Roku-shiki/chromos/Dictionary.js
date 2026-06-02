/*  2026.05.29 20:00
    六式IME‐辞書
*/

class Dictionary{
    constructor(){
        this.mode = 4;          // 0-google, 1-google url応答待ち, 2-不揮発辞書, 3-揮発辞書, 4-起動前, 7-特殊.
        this.state = {
            SLEEP: 0,       // 起動前
            READY: 1,       // 起動完了
            CACHE: 2,       // cache辞書
            LOCAL: 3,       // ローカル & Google辞書
            SPECIAL: 7      // 特殊状態
        };
        this.step = this.state.SLEEP;
//        this.state = 0;         // 0-起動前，1-Cache辞書，2-ローカル辞書+GoogleURL，7-特殊状態
        this.ramp = 0;          // 辞書まとめ書き用変数.
        this.rokushiki = [];    // 辞書 Version 3 以降.
        this.opened = false;    // 辞書がOpen済の判断.
        this.volatile = [];     // 揮発辞書.
//        this.specialkey = 0;    // 特殊キー対応Index.
        this.interval = -1;     // 辞書出力用1
        this.dictline = 1;      // 辞書出力用2
        this.open();
        this.openCache();
    }

    open(){
        // storage.local.get()が非同期で呼ばれるのでasync-awaitを使う
        console.log(`Preparing rokushiki dictionary...`);
        (async () => {
            await chrome.storage.local.get(['Rokushiki'], (result) => {
                this.rokushiki = result.Rokushiki;
                if(this.rokushiki == undefined) this.rokushiki = [[4,0]];
    //            if(this.rokushiki[0].length <2) this.rokushiki.splice(0,1,[4,0]);   // Dict ver up
    //            KeyStyle = dic.rokushiki[0][1];
                console.log(`...Open Rokushiki dictionary`);
                this.opened = true;
                this.step = this.state.READY;
            });
        })();
    }

    // キャッシュ辞書のロード.
    openCache(){
        console.log(`Preparing Cache table...`);
        (async () => {
            await chrome.storage.local.get(['Voldict'], (result) => {
                this.volatile = result.Voldict;
                if(this.volatile === undefined) this.volatile = [];
                console.log(`...Loaded Cache table`);
            });
        })();
    }

    search( key ){
        let entryindex = 0;
        for( let depth = 1; depth < this.rokushiki.length; depth++ ){
            if( this.rokushiki[depth][0] === key ){
                entryindex = depth;
                break;            
            }
        }
        return entryindex;
    }

    getEntry( entryindex, code ){
        let tagEntry = structuredClone(this.rokushiki[entryindex]); // entryを複製.対象エントリ用ワーク.
        //console.log(`**de>${code}::${tagEntry}`);
        // 変換データ側の修正.
        if( code == tagEntry[3][0] ){               // 変換候補筆頭と同じ場合.
            if( tagEntry[2] < 32 ) tagEntry[2]++;   // 強制変換値を変更. エントリはそのままで良い.
        } else {
            let pos = tagEntry[3].indexOf( code );  // 変換コードが存在する位置を特定.
            if( pos >= 0 ) tagEntry[3].splice( pos, 1 );    // 変換コードを一旦削除.
            if( tagEntry[2] < 4 ){              // 強制カウント4未満なら筆頭を書き換え.
                tagEntry[3].unshift( code );    // 変換確定文字を先頭に追加.
                tagEntry[2] = 0;                // 強制変換値は初期化.
            } else {
                tagEntry[3].splice( 1, 0, code ); // 変換確定文字を2個目に追加.
                tagEntry[2]--;                  // 強制変換値を減算.
            }
        }
        for( let pos = 0; pos < 5; pos++ ){     // loop数の5回は failsafe設計.
            let mojiInx = tagEntry[3].indexOf( code, 2 );   // 2以降の変換確定文字を削除.
            if( mojiInx >= 0 ) tagEntry[3].splice( mojiInx, 1 );  // 同じ要素を削除.
        }

        tagEntry[1] += 1;                   // エントリ更新カウントをアップ.
        this.rokushiki.splice( entryindex, 1 );   // 変換対象エントリを一旦削除.
        return tagEntry;
    }

    copyEntry( entryindex ){
        return structuredClone(this.rokushiki[entryindex]);
    }

    engage( tagEntry, entryindex ){    // 登録点を探して登録.
        // 検索キーの長さ別に範囲の絞りこむ.
        let kenkey = [tagEntry[0].length, 0, 1 ];
        for( let span = 1; span < entryindex; span++ ){
            let tagentlen = this.rokushiki[span][0].length;
            if( kenkey[1] == 0 ){
                if( tagentlen <= kenkey[0] ) kenkey[1] = span;
            } else {
                if( this.rokushiki[span][0].length < kenkey[0]) break;
                kenkey[2] = span;
            }
        }
        if( kenkey[1] == 0 ) kenkey[1] = entryindex;    // entryindex制限で範囲検索が終了した場合.
        if( kenkey[2] > kenkey[1] ){ 
            let tagCount = tagEntry[1]; 
            for( let limit = 0; limit < 256; limit++ ){
                let cpo = (kenkey[1] + kenkey[2]);  //  検索範囲内の中央.
                cpo >>= 1;                          //  int型保持のため.
                if( kenkey[1] >= kenkey[2] ) break; // 検索終了.
                if( this.rokushiki[cpo][1] <= tagCount ){ // 中央が低いか同じなら上を検索.
                    kenkey[2] = cpo;
                } else kenkey[1] = cpo+1;
            }
        } else kenkey[2] = kenkey[1];
        this.rokushiki.splice( kenkey[2], 0, tagEntry );  // 登録点に…  エントリ追加登録.
        console.log(`*new>(${kenkey[2]})${tagEntry}`);
    }

    // ひらがな文字判斷　: 文字列がひらがなだけの場合は true
    kanaOnly( tagmoji ){
        return (tagmoji.match(/^[ぁ-ゞ]+$/g) != null);  // ひらがな範囲のみの構成かを判断.
    }

    // カタカナ文字判斷　: 文字列がカタカナだけの場合は true
    kataOnly( tagmoji ){
        return (tagmoji.match(/^[ァ-ヾ]+$/g) != null);  // ひらがな範囲のみの構成かを判断.
    }

    // 漢字文字判斷　: 文字列が漢字だけの場合は true
    kanjiOnly( tagmoji ){
        return (tagmoji.match(/^[一-鿯]+$/g) != null);  // 漢字範囲のみの構成かを判断.
    }

    // 前後一致を回避 : 二文字は出来るだけ残す.
    removeKana( henkan, kakutei ){
        let removed = 0;
    //    console.log(`reKa>${henkan}/${kakutei}`)
        for( let limit = 0; limit < henkan.length; limit++ ){
            if( henkan.charCodeAt(0) == kakutei.charCodeAt(0) ){    // 元と同じ?
                henkan  = henkan.substr( 1 );
                kakutei = kakutei.substr( 1 );
                removed++;
            } else break;
        }
        for( let limit = henkan.length; limit > 0; limit-- ){
            if( henkan.length <= 2 ) break;             // 二文字は残したい.
            if( henkan.charCodeAt(henkan.length-1) == kakutei.charCodeAt(kakutei.length-1) ){    // 元と同じ?
                henkan  = henkan.substr( 0, henkan.length-1 );
                kakutei = kakutei.substr( 0, kakutei.length-1 );
                removed++;
            } else break;
        }
    //    console.log(`reKa<${henkan}/${kakutei}`)
        const ret = [henkan, kakutei, removed];
        return ret;
    }

    // キャッシュ辞書の検索.
    // 前方一致で検索する.
    // 出力：[[変換候補,よみ],....]
    searchCache( tagword ){
        let hitque = [];
        let insinx = 0;
        const taglen = tagword.length;
//        const vlimit = this.volatile.length > 6 ? 6 : this.volatile.length;
        const vlimit = this.volatile.length - 1;
//        console.log(`sC:${tagword}/${taglen}/${vlimit}`);
        this.mode = 3; 
        for( let inx = 0; inx <= vlimit; inx++ ){
//            console.log(`sC1:${this.volatile[inx]}`);
            if( taglen <= this.volatile[inx][0].length ){
                if( tagword === this.volatile[inx][0] ){               // 完全一致の場合.
                    hitque.unshift([this.volatile[inx][0],this.volatile[inx][1]]);
                    insinx++;
                    if( this.volatile[inx][2] && inx < vlimit ){    // 漢字のみの場合は結合候補を筆頭.
                        hitque.splice(1,0,[this.volatile[inx][0]+this.volatile[inx+1][0],this.volatile[inx][1]+this.volatile[inx+1][1]]);
                        insinx++;
                    }
                }
                else {
                    let cutword = this.volatile[inx][0].slice(0,taglen);
                    if( cutword === tagword ){
                        hitque.splice(insinx, 0, [this.volatile[inx][0],this.volatile[inx][1]]);    // 前方一致.
                        if( this.volatile[inx][2] && inx < vlimit ){    // 漢字のみの場合は結合候補を追加.
                            hitque.splice(1,0,[this.volatile[inx][0]+this.volatile[inx+1][0],this.volatile[inx][1]+this.volatile[inx+1][1]]);
                        }
                    }
                }
            }
        }
//        console.log(`sCx:${hitque}`);
        return hitque;
    }

    // キャッシュ辞書の登録.
    saveCache( key, code ){
        let volone = [ key, code, this.kanjiOnly( code ) ];       // 揮発辞書エントリ.
        //3 console.log(`sC3>:${volone}`);
        if( this.volatile.length === 0 ) this.volatile.push( volone );
        else {
            let index = -1;
            for( let pos = 0; pos < this.volatile.length; pos++ ){
                if( this.volatile[pos][0] === volone[0] && this.volatile[pos][1] === volone[1] ){
                    index = pos;
                    break;
                }
            }
        //3    console.log(`sC3<:(${index}/${this.volatile.length})${volone}/${this.volatile[0]}`);
            if( index >= 0 ) this.volatile.splice( index, 1 );      // 同じエントリは削除.
            this.volatile.push( volone );                           // 末尾に登録.
            while( this.volatile.length > 512 ) this.volatile.splice(0,1);  // 登録数制限 256 先頭から削除
        }
    }

    saveRokushiki(){
        //4 console.log(`**Save Local`);
        return new Promise(resolve => {
            chrome.storage.local.set({ 
                Rokushiki: this.rokushiki,
                Voldict: this.volatile
            }, resolve);
        });
    }

    /************/
    /* 辞書登録 */
    /* 入力: 検索文字 = data[0][0] -> ひらがな           */
    /*       変換文字 = code -> 変換済文字 */
    /******************************************************/
    saveEntry2Rokushiki( cnv, code ){
        // 異常値のガードをいれておきます. Index == 0 は非変換となります.
        if( cnv.candidate.length <= 1 || code.length <= 0 || !this.open ) return -1;   // 異常値のガード.
        if( this.kanaOnly( code ) ) return -1;   // かなだけの登録は NG

        let key = cnv.data[0][0];           // 検索キー.　dataの検索文字で検索要.
        console.log(`*Save(${this.rokushiki.length})=${code}:${key}/${cnv.index}/${this.mode}`);

        // Debug codes
        if( code.length > key.length * 5 ){
            console.log(`@@ Error : ignore too large code, key:${key} code:${code}`);
            return -1;
        }

        if( this.mode === 3 ){              // 揮発辞書
            key = cnv.candidate[cnv.index].annotation;
        //3    console.log(`vd:${con.index}/${key}:${con.candidate[con.index].candidate}/`);
        }
        this.saveCache( key, code );        // 揮発辞書への登録.
        // 前処理 = ひらがな除外.
        const keycode = this.removeKana( key, code );   // 前処理 = ひらがな除外.
        key  = keycode[0];
        code = keycode[1];

        //　検索文字列のエントリを探す.
        let entryindex = this.search( key );  // 検索キー登録場所を探す.
        let tagEntry = [];
        if( entryindex <= 0 ){                      // 検索文字が辞書に存在しない場合.
            // -----------------------------------------------------------
            // (注意)検索キー 未登録 且つ 変換文字が同一であれば 何もせずに終了.
            if( key === code )  return 0;
            // -----------------------------------------------------------
            tagEntry = [ key, 0, 0, [code]];   // 登録エントリ
            if( this.rokushiki.length > 65000 ) this.rokushiki.pop();  // 辞書の肥大化防止.
            entryindex = this.rokushiki.length;
        } else {
            tagEntry = this.getEntry( entryindex, code );
            // 辞書のスリム化(変換候補数の制限)
            while( tagEntry[3].length > 256 ) tagEntry[3].pop();    //  一番後ろの候補から削除.
        }

        // 変換データ以外の候補も必要に応じて登録.
        if( keycode[2] === 0 ){         // 文字を減らした場合は登録回避.
            for( let koinx = 1; koinx < cnv.candidate.length; koinx++ ){
                let tagcand = cnv.candidate[koinx].candidate;
                if( !this.kanaOnly( tagcand ) && !this.kataOnly( tagcand )){    // かなだけの登録は NG
                    let mojiInx = tagEntry[3].indexOf( tagcand );               // エントリ内を検索.
                    if( mojiInx < 0 ){
                        tagEntry[3].push( tagcand );    // 登録がなければ後ろに追加.
                        break;                          // 一回に一個だけの登録に留める.   
                    }
                }
            }
        }

        this.engage( tagEntry, entryindex );                     // 登録点を探してて登録.

        if( tagEntry[1] > 64000 ){                              // 更新値上がり過ぎり対策.
            for( let depth=1; depth < this.rokushiki.length; depth++ )
                this.rokushiki[depth][1] >= 1;                        // 値を半分に
        }
        if( this.ramp++ >= 16 ){    // 辞書へのライト処理をまとめる. 
            this.saveRokushiki();   // 保存処理.
            this.ramp = 0;
        }
        return;
    }

    // 辞書から変換文字列を検索し、dataを作成する.
    // 入力: inbuf - 変換入力文字
    // 出力: data, Index
    getData( io, cn, rn ){
        cn.data = [];
        if( !this.opened ){        // local 辞書が読まれる前は待つ.
//            dic.open();
            rn.showLine( io.inbuf );    // 辞書が開くまでの暫定表示.
            io.curbuf = io.inbuf;
        } else {
            let tagtext  = io.inbuf;    // 変換対象文字列.
            let stoplimit = 64;         // 長文変換の制限.
// 要注意           dic.mode = 2;               // Rokushiki IME 動作―早めに設定要.

            // textの中に変換候補文字列があるか検索.
            while( tagtext.length > 0 ){
                if( stoplimit-- <= 0 ){
                    console.log(`*Stop limit* (${stoplimit}):${tagtext}`); 
                }
                let entryone  = [];     // dataに展開する1エントリ.
                for( let depth = 1; depth < this.rokushiki.length; depth++ ){     // 辞書検索ループ.
                    let etag = this.rokushiki[depth];       // etag <- dic.rokushikiの参照
                    let hitpos = tagtext.indexOf( etag[0] );    // 変換文字にヒットするか?
                    //console.log(`gD1:${etag}/${hitpos}/${this.rokushiki[depth]}/${depth}`);
                    if( hitpos >= 0 ){                          // hit
                        if( hitpos === 0 ){                     // 先頭で一致.
                            entryone = [];                  // entryone初期化.
                            entryone.push( etag[0] );       // dataにも変換前文字列を入れる.
                            entryone.push( etag[3] );       // dataに変換候補郡を入れる.
                            entryone[1].unshift( etag[0] ); // 変換候補郡先頭は検索文字.
                            cn.data.push( structuredClone(entryone) );  // dataに1エントリ追加.
    
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
                            entryone = [ pretag, [pretag] ];    // data 1エントリ準備
                            cn.data.push( entryone );           // data 1エントリ追加.
                            let newtag = tagtext.slice( pretag.length ); // 残検索文字の切り出し.
                            tagtext = newtag;
                        }
                    }
                }
                if( entryone.length <= 0 ){             // 一致なし：検索文字そのまま.
                    entryone = [ tagtext, [tagtext] ];          // data 1エントリ準備
                    cn.data.push( structuredClone(entryone) );  // data 1エントリ追加.
                    //console.log( `>> No hit:${tagtext}` );
                    break;
                }
            }
        }
    }

    // @todo kokomade
    // テキスト群を 辞書に展開する. 「＠＠＠」キー入力時.
    // addmode: true - 追加登録, false - 置き換え登録
    saveWords( addmode, words ) {
        if( this.rokushiki == undefined ) return;     // 辞書が開いてない場合は 何もしない.
        let wdary = words.split("]");
        for( let depth = 0; depth < wdary.length; depth++ ){
            if( wdary[depth].indexOf("[") < 0 ) break;
            let abar = wdary[depth].split("[");
            if( abar.length > 0 && abar[1].length > 2 ){
                let bbar = abar[1].split(",");
                if( bbar.length > 3 ){
                    let kouho = [];
                    for( let pos = 3; pos < bbar.length; pos++ ){
                        if( bbar[pos] != "" )
                            kouho.push( bbar[pos] );            // 候補群作成.
                    }
                    let entryindex = this.search( bbar[0] );     // 検索キー登録場所を探す.
                    if( entryindex <= 0 ){                      // 検索文字が辞書に存在しない場合.
                        let tagEntry = [ bbar[0], 0, 0, kouho]; // 登録エントリ
                        //if( this.rokushiki.length > 65000 )  this.rokushiki.pop();    // 辞書の肥大化防止.
                        entryindex = (this.rokushiki.length >> 1) + 1;      // 適当な位置へ.
                        this.rokushiki.splice( entryindex, 0, tagEntry );   // 登録.
                    } else {
                        if( !addmode ){                                     // 置き換えの場合.
                            this.rokushiki[entryindex].splice(3,1,kouho);   //  置き換え.
                        } else {                                    // 追加モード.
                            for( let pos = kouho.length-1; pos >= 0; pos-- ){
                                if( this.rokushiki[entryindex][3].indexOf( kouho[pos] ) < 0 ){
                                    this.rokushiki[entryindex][3].unshift( kouho[pos] );  // 未登録文字は登録.
                                }
                            }
                        }
                    }
                }
            }
        }
    }



}

const dic = new Dictionary();

//let context_id = -1;
//let imemode  = 4;           // 0-google, 1-google url応答待ち, 2-不揮発辞書, 3-揮発辞書, 4-起動前, 7-特殊. // classed to mode
//let rampwait = 0;           // 辞書まとめ書き用変数.      // classed to ramp
//let Niwadict  = [];         // 辞書 Version 3 以降.     // classed to rokushiki 
//let dictOpen  = false;      // 辞書がOpen済の判断.       // classed to open
//let Voldict   = [];         // 揮発辞書.                // classed to volatile
//let spkeyinx = 0;           // 特殊キー対応Index.       // classed to slecialkey
//let interval  = -1;         // 辞書出力用1              // classed
//let dictline = 1;           // 辞書出力用2              // classed

/***************************************/
/* 以下は変換候補サーチ(IME)関連のコード  */
/***************************************/
//  IME を呼ばれた際は cursole lineも作り直しとする。
//  入力： inbuf
//  出力： data
function IME_Rokushiki_old(){
    if( ren.convCandidate ) PrefixOne();    // 先頭が選択済ならFIXさせる.
    if( fifo.isAvailable() ){
        dic.mode = 4;                    // ime再起動状態に設定.
        SelectIME();
    }
}

function IME_Rokushiki(){
    if( dic.step !== dic.state.SLEEP ){
        if( ren.convCandidate ) PrefixOne();    // 先頭が選択済ならFIXさせる.
        if( fifo.isAvailable() ){
            dic.step = dic.state.READY;         // IME Ready状態に設定.
            ImeEngage();
        }
    }
}

//  IME起動
function ImeEngage(){
    con.initialize();
    if( !fifo.isAvailable() ) return;
    // 最初に裏でGoogle IMEを呼んでおく(ループの度に)
    loadGoogleIME();
//    con.setNetInterval();   // google IME用インターバル起動
    if( dic.step !== dic.state.SLEEP && dic.step !== dic.state.LOCAL ) GetCacheDict_new(); // キャッシュ辞書検索
    if( dic.step === dic.state.LOCAL ) GetNiwaDictEntry();  // ローカル辞書検索
    con.makeCandidate_new( dic.step === dic.state.CACHE );     // candidateの作り直し
    ren.showCompositionAnd_new( dic.step === dic.state.CACHE ); // conpositionとcandidate表示
}

function SelectIME(){ 
    if( dic.step !== dic.state.SLEEP ){
        if( dic.step === dic.state.CACHE ) dic.step = dic.state.LOCAL;
        else dic.step = dic.state.READY;
        ImeEngage(); 
    }
}

function SelectIME_old(){
//    console.log(`SI:${dic.mode}`)
    if( dic.mode !== 1 ){
        con.initialize();
        if( fifo.isAvailable() ){
            if( dic.mode === 2 ) googleIMEcgi();  // web search
            else if( dic.mode === 3 ) GetNiwaDictEntry();
            else {
                if( !GetCacheDict() )           // キャッシュ辞書検索.
                    GetNiwaDictEntry();         // キャッシュヒットなし → local search
            }
            if( dic.mode !== 1 ){                 // web 
                con.makeCandidate( dic.mode );   // candidateの作り直し
                ren.showCompositionAnd( dic.mode );
            }
            else if( dic.interval < 0 )
                dic.interval = setInterval( WebResponceTimer, 32 );
        }
    }
}

// web IME の変換待ち.
function WebResponceTimer(){
    if( dic.mode === 0 ){
        clearInterval( dic.interval );
        dic.interval = -1;
        con.makeCandidate( dic.mode );   // candidateの作り直し
        ren.showCompositionAnd( dic.mode );
    }
}

/************************/
/* 以下は辞書関連のコード */
/************************/
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const spkey = "@@@";
    if( dic.opened ){        // local 辞書が読まれる前は待つ.
        var saverequest = false;
        if(message.type === 'removeOne'){
            const name = message.jtext;
            console.log(`Remove:${name}`);
            var sakujyo = name.split("\t");
            if( sakujyo[1] == spkey ){              // 登録キー.
                dic.saveWords( false, sakujyo[0] ); // 置き換え登録.
            } else if( sakujyo.length == 2 && sakujyo[0].length > 0 && sakujyo[1].length > 0 ){
                var entryindex = dic.search( sakujyo[0] );
                if( entryindex > 0 ){
                    for( var limit = 0; limit < 10; limit++ ){
                        var sakupos = dic.rokushiki[entryindex][3].indexOf( sakujyo[1] );
                        if( sakupos < 0 ) sakupos = dic.rokushiki[entryindex][3].indexOf( dic.rokushiki[entryindex][0] );
                        if( sakupos >= 0 ){
                            dic.rokushiki[entryindex][3].splice( sakupos, 1 );   // 候補削除.
                        }
                    }
                    saverequest = true;                             // 辞書保存要求
                }
                if( dic.rokushiki[entryindex].length >=3 && dic.rokushiki[entryindex][3].length <= 0 )   // 候補が全てなくなった.
                    dic.rokushiki.splice( entryindex,1 );
            }
        } else if(message.type === 'engageOne') {
            const name = message.jtext;
            console.log(`Engage:${name}`);
            var touroku = name.split("\t");
            if( touroku[1] == spkey ){              // 登録キー.
                dic.saveWords( true, touroku[0] );  // 追加登録.
            } else if( touroku.length == 2 && touroku[0].length > 0 && touroku[1].length > 0 ){
                var tagEntry   = [];
                var entryindex = dic.search( touroku[0] );
                if( entryindex <= 0 ){
                    tagEntry = [ touroku[0], 0, 0, [touroku[1]]];   // 登録エントリ
                    entryindex = dic.rokushiki.length;
                } else {
                    tagEntry = dic.getEntry( entryindex, touroku[1] );
                }
                dic.engage( tagEntry, entryindex );                 // 登録点を探してて登録.
                saverequest = true;                                 // 辞書保存要求.
            }
        } else if(message.type === 'Clean') {
            console.log(`Debug ope.`);          // 暫定コード : 辞書の整理.
            ConvertOldtoNewDict();                  // 辞書内の整理.
        } else if(message.type === 'Save') {
            saverequest = true;                     // 辞書保存要求.
        } else if(message.type === 'DictText') {
            console.log(`Special mode`)
            dic.mode  = 7;                            // 辞書出力特殊モード. 
            dic.dictline = 0;
        }    
        if( saverequest ){
            dic.saveRokushiki();
            console.log(dic.rokushiki);
        }
    }
});

// Google変換のデータの書式を修正. 
function googleData2MyIME( data ) {
    console.log(`google:${data[0][0]}/${data[0][1]}/${data[0][1][0]}`);
    console.log(data);
    con.data   = data;
    //  とりあえず、最初の1エントリのみ書式修正.
    if( con.data[0][0] != con.data[0][1][0] ){                // 先頭が検索文字で無い場合.
        var pos = con.data[0][1].indexOf( con.data[0][0] );   // 検索文字の位置.
        if( pos > 0 ){
            con.data[0][1].splice( pos, 1 );         // 先頭以外の検索文字は削除.
            con.data[0][1].unshift( con.data[0][0] ); // 先頭に検索文字を追加.
        } else if( pos < 0 ){                       // 検索文字がなかった場合.
            con.data[0][1].unshift( con.data[0][0] ); // 先頭に検索文字を追加.
        }
    }
}

// Google IME での検索.
// 入力: inbuf - 変換入力文字
// 出力: data, Index
function googleIMEcgi(){
    if( fifo.isEmpty() ) return;
    var url = "http://google.com/transliterate?langpair=ja-Hira|ja&text=" + fifo.inbuf;
    dic.mode = 1;
//    console.log(`GI:${fifo.inbuf}`);
    fetch(url).then(function(response){
        return response.json();
    }).catch(function(){
        console.log("error caught at fetch()!");
    }).then(function(data){
        // 変換候補が無い場合、RokushikiIMEが起動済の場合は何もしない.
        if( data !== undefined && dic.mode === 1 ){
            dic.mode = 0;
            googleData2MyIME( data );
        }
    });
}

// キャッシュ辞書から data を作成.
function GetCacheDict(){
    con.data = [[fifo.inbuf,[fifo.inbuf]]];
    let hitque = dic.searchCache( fifo.inbuf );
    if( hitque.length > 0 ){
        for( let depth = 0; depth < hitque.length; depth++ ){
            con.data[0][1].push( hitque[depth][1] );
            con.data[0][1].push( hitque[depth][0] );
        }
        return true;
    }
    return false;
}

// キャッシュ辞書から data を作成.
function GetCacheDict_new(){
    con.data = [[fifo.inbuf,[fifo.inbuf]]];
    let hitque = dic.searchCache( fifo.inbuf );
    if( hitque.length > 0 ){
        for( let depth = 0; depth < hitque.length; depth++ ){
            con.data[0][1].push( hitque[depth][1] );
            con.data[0][1].push( hitque[depth][0] );
        }
        dic.step = dic.state.CACHE;
        return;
    }
    dic.step = dic.state.LOCAL;
    return;
}

let controller = null;
let gidata = null;

async function loadGoogleIME() {
    gidata = null;

    // 前回の通信が残っていればキャンセル
    if (controller) {
        controller.abort();
        console.log("前の通信をキャンセルしました。");
    }

    controller = new AbortController();
    const signal = controller.signal;
    const url = "http://google.com/transliterate?langpair=ja-Hira|ja&text=" + fifo.inbuf;

    try {
        if( fifo.isAvailable() && navigator.onLine ){
            const response = await fetch(url, { signal });
            gidata = await response.json();
            console.log("最新のデータを取得:", gidata);
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log("リクエストがキャンセルされました。");
        } else {
            console.error("エラー:", error);
        }
    } finally {
        controller = null;
    }
}

// 辞書のテキスト書き出し
// chromeの拡張機能では Secureの為、ファイルへの書き出しは制限されている.
// ファイルの書き出しは実行できないが、Text化して sendTextしてみる.
function MakeTextNiwadictionary(){
    if( dic.rokushiki == undefined ) return;     // 辞書が開いてない場合は 何もしない.
    var startline = dic.dictline;
    dic.dictline = startline+2;
    if( dic.dictline >= dic.rokushiki.length ){
        dic.dictline = dic.rokushiki.length;      // 最後まで出力.
        dic.mode = 4;                    // 通常モードに戻しておく.
    }
    for( var depth = startline; depth < dic.dictline; depth++ ){
        var wbuf  = "[";
        if( depth == 0 ){
            wbuf += dic.rokushiki[depth][0].toString() + "," + dic.rokushiki[depth][1];
        }
        else if( dic.rokushiki[depth][0].indexOf(",") < 0 ){                  // ',' があるばあいはファイル出力しない.
            wbuf += dic.rokushiki[depth][0].toString() + "," + dic.rokushiki[depth][1] + "," + dic.rokushiki[depth][2];
            for( var pos = 0; pos < dic.rokushiki[depth][3].length; pos++ ){
                if( dic.rokushiki[depth][3][pos].indexOf(",") < 0 ){     // ',' があるばあいはファイル出力しない.
                    wbuf += ",";
                    wbuf += dic.rokushiki[depth][3][pos].toString();
                }
            }
        }
        wbuf += "],\n";               // 改行コード.
        cmt.commitText( wbuf );
    }
    if( dic.mode === 7 && dic.interval < 0 ){
        dic.interval = setInterval( MakeTextNiwadictionary, 240 );
    } else if( dic.mode === 4 && dic.interval >= 0 ){
        clearInterval( dic.interval );
        dic.interval = -1;
    }
}

// 辞書版数のコンバート.
function ConvertOldtoNewDict(){
    if( dic.rokushiki.length <= 0 ){
        dic.rokushiki = [[4,0]];       // ver.4　辞書初期化.
        return;
    }
}

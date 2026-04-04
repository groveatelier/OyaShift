function maniVersion2(){
    var version = document.getElementById("ver");
    version.innerHTML = document.write( chrome.runtime.getManifest().version );
}
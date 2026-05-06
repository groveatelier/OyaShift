// 27秒ごとにchrome.runtime.sendMessageを呼ぶ.
setInterval(() => {
  chrome.runtime.sendMessage("heartbeet");
}, 27000);
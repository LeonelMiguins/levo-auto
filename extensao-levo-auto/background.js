console.log("BACKGROUND CARREGADO");

chrome.action.onClicked.addListener(async () => {
    await chrome.tabs.create({
        url: chrome.runtime.getURL("app/index.html")
    });
});

var qs = window.location.href.split("?")[1];
var matches = qs.match("github_token=([^&]+)");

if (matches && matches.length === 2) {
    chrome.extension.sendRequest({
        type:"save",
        key:"access-token",
        value:matches[1]
    }, function (response) {
        chrome.extension.sendRequest({
            type:"get",
            key:"url-before-oauth"
        }, function (response) {
            if (response.value) {
                window.location.href = response.value;
            }
        });
    });
}

gimply.prototype.showOAuthPage = function () {
    var oauthUrl = 'https://github.com/login/oauth/authorize?client_id=e84573e67eb8bed0bf6e&scope=repo&redirect_uri=https%3A%2F%2Fgimply.herokuapp.com%2Fauth%2Fgithub%2Fcallback';
    var div = $("<div id='oauth'></div>");
    var logo = $("<img/>").attr("src", chrome.extension.getURL("images/gimply_logo.png")).addClass("logo");
    var p = $("<p></p>").html("see nice consolidated view of recent updates by contributor<br/>authorize gimply to access the github repositories you visit");
    var p2 =$("<p class='sub'></p>").html("");
    var btn = $("<a class='button logo-color' href='javascript:void(0)' id='token'></a>").html("authroize gimply");
    div.append(logo).append(p).append(p2).append(btn);
    $("#gimply_updates_container").append(div);
    btn.click(function(){
        chrome.extension.sendRequest({
            type:"save",
            key:"url-before-oauth",
            value:window.location.href
        }, function (response) {
            window.location.href = oauthUrl;
        });
    });
}

gimply.prototype.showUserMismatch = function () {
    $("#gimply_updates_container").append($("<p></p>").html("User registered with extension is different from the user currently using github"));
}

gimply.prototype.onInvalidToken = function () {
    this.hasToken = false;
}

gimply.prototype.onRegisteredUserChange = function () {
    this.hasToken = true;
    if(this.isUpdatesTab()){
        this.onUpdatesTabSelect();
    }
}

var $g = new gimply();
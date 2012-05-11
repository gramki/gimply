"use strict";

function gimply() {
    this.init_events();
    this.init_ui();
}

gimply.prototype.init_ui = function () {
    var tabs = $("ul.tabs li");
    if (!tabs || $.trim(tabs[0].innerText) !== "Code") {
        return;
    }
    $(tabs[1]).before("<li id='gimply_updates_tab'><a href='#gimply_updates'>Updates</a></li>");
    $("#gimply_updates_tab").click(this.onUpdatesTabSelect.bind(this));
    if (this.isUpdatesTab()) {
        this.onUpdatesTabSelect();
    }
};

gimply.prototype._removeGithubElements = function(){
    $("a.selected").removeClass("selected");
    $("#gimply_updates_tab a").addClass("selected");
    var pagehead = $(".pagehead")[0];
    var container = pagehead.parentNode;

    $(pagehead).detach();
    $(container).empty();
    $(container).append(pagehead);
    var actions = $(".title-actions-bar", pagehead)[0];
    var tabs = $(".tabs", pagehead)[0];
    $(tabs).detach();
    $(actions).detach();
    $(pagehead).empty();
    $(pagehead).append(actions);
    $(pagehead).append(tabs);

    $(container).append("<div id='gimply_updates_input'></div>");
    $(container).append("<div id='gimply_updates_container'></div>");

}


gimply.prototype.isUpdatesTab = function(){
    return (window.location.href.indexOf("#gimply_updates") > 0);
}

gimply.prototype.onUpdatesTabSelect = function(){
    this._removeGithubElements();
    if(!this.hasToken){
        this.showOAuthPage();
        return;
    }
    if( !this.registeredUser && this.registeredUser.login !== this.getCurrentUser()){
        this.showUserMismatch();
        return;
    }
    this.showUpdates();
}


gimply.prototype.getCurrentRepoName = function(){
    return _(window.location.href.match("https://github.com/([^\/]+)/([^\/#]+)")).rest().join("/");
};

gimply.prototype.getCurrentUser = function(){
    return $("#user .name").text();
};

// Events ContentScript receives from Extension
gimply.prototype.init_events = function () {
    var port = chrome.extension.connect({name: this.getCurrentRepoName()});
    this.port = port;
    port.onMessage.addListener((function (msg) {
        switch (msg.type) {
            case "filtered-events":
                this.addEvents(msg.payload);
                break;
            case "new-event":
                this.filterEvents();
                break;
            case "contributors":
                this.updateContributors(msg.payload);
                break;
            case "contributor":
                this.port.postMessage({type:"fetchContributors"});
                break;
            case "status-update-success":
                this.updateBox.clear();
                this.hideUpdateInput();
                this.filterEvents();
                break;
            case "status-update-failure":
                this.updateBox.showError("Sorry! Gimply failed to post your update.");
                break;
            case "invalid-token":
                this.onInvalidToken();
                break;
            case "user":
            case "current-user":
                this.registeredUser = msg.payload;
                this.onRegisteredUserChange(this.registeredUser);
                break;
            case "user-contributes":
                if(msg.repo === this.getCurrentRepoName()){
                    this.addUpdatesInput();
                }
                break;
            case "repo-status-update":
                console.warn("Repo status", msg);
                if(msg.payload.gimply_status.is_gimply){
                    console.warn("This is a gimply enabled repo");
                }
                this.onRepoStatusUpdate(msg.payload);
        }
    }).bind(this));
}


"use strict";

function gimply() {
    this.init_events();
    this.init_ui();
}

gimply.prototype.showUpdates = function () {
    this._removeGithubElements();
    this.contributors = new ListWidget("contributors", "#gimply_updates_container");
    this.updates = new ListWidget("updates_container", "#gimply_updates_container");
    this.fetchEvents();
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

    $(container).append("<div id='gimply_updates_container'></div>");
}

gimply.prototype.init_ui = function () {
    var tabs = $("ul.tabs li");
    if (!tabs || $.trim(tabs[0].innerText) !== "Code") {
        return;
    }
    $(tabs[1]).before("<li id='gimply_updates_tab'><a href='#gimply_updates'>Updates</a></li>");
    $("#gimply_updates_tab").click(this.showUpdates.bind(this));
    var isUpdatesTab = (window.location.href.indexOf("#gimply_updates") > 0);
    if (isUpdatesTab) {
        this.showUpdates();
    }
};

gimply.prototype.getCurrentRepoName = function(){
    return _(window.location.href.match("https://github.com/(\\w+)/(\\w+)")).rest().join("/");
};

gimply.prototype.init_events = function () {
    var port = chrome.extension.connect({name: this.getCurrentRepoName()});
    this.port = port;
    port.onMessage.addListener(function (msg) {
        switch (msg.type) {
            case "events":
                console.warn("Received events (" + msg.events.length + "): ", msg);
                port.postMessage({type:"fetchContributors"});
                break;
            case "contributors":
                _(msg.contributors).each(function(contributor){
                    $g.contributors.add("contributor_" + contributor.login, contributor.login, contributor.login);
                });
                var sortedLoginIds = _.chain(msg.contributors).sortBy(function(contributor){
                    return contributor.latest_update_at? (-1 * new Date(contributor.latest_update_at)) : 0;;
                }).pluck("login").value();
                $g.contributors.sort(sortedLoginIds);
                break;
            case "contributor":
                this.port.postMessage({type:"fetchContributors"});
                break;
        }
    });
}
gimply.prototype.fetchEvents = function () {
    this.port.postMessage({type:"fetchContributors"});
    this.port.postMessage({type:"fetchEvents"});
}

    gimply.prototype.toHtml = function(update){
        switch(update.type){
            case "":
        }
    }
    gimply.prototype.pushEventToHtml = function(){

    }
    gimply.prototype.issueCommentEventToHtml = function(){

    }
    gimply.prototype.issuesEventToHtml = function(event){

    }

var $g = new gimply();
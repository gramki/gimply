function gimply() {
    this.init_events();
    this.init_ui();
}

gimply.prototype.showUpdates = function () {
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

    $(container).append("<div id='gimply_updates_container'>Hello, Gimply!</div>");
    this.fetchEvents();
};


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
                break;
        }
    });
}
gimply.prototype.fetchEvents = function () {
    this.port.postMessage({type:"fetchEvents", repo:this.getCurrentRepoName()});
}
$g = new gimply();
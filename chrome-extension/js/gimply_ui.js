"use strict";

gimply.prototype._toggleButton = function(name, truthHtml, falseHtml, onChangeCallback){
    var currentValue = this.store.getItem(name) !== false;
    var self = this;
    var button = $("<a href='javascript:void(0)'></a>").addClass("action toggle").html(currentValue?falseHtml:truthHtml).addClass(currentValue?"on":"off");
    button.click(function () {
        $(this).html(currentValue?truthHtml:falseHtml).addClass(currentValue?"on":"off");
        currentValue = !currentValue;
        self.store.setItem(name, currentValue);
        onChangeCallback();
    });
    button.isOn = function(){
        return currentValue;
    }
    return button;
}

gimply.prototype.showUpdates = function () {
    var self = this;

    this._showCommits = this._toggleButton("showCommits", "Show Commits", "Hide Commits", this.filterEvents.bind(this));
    this._showIssues = this._toggleButton("showIssues", "Show Issues", "Hide Issues", this.filterEvents.bind(this));
    this._showUpdates = this._toggleButton("showStatus", "Show Updates", "Hide Updates", this.filterEvents.bind(this));

    var actionBar = $("<div></div>").addClass("right actionBar").append(this._showCommits).append(this._showIssues).append(this._showUpdates);
    $("#gimply_updates_container").append(actionBar);

    this.contributors = new ListWidget("contributors", "#gimply_updates_container");
    this.contributors.setDefault("contributor_" + this.getCurrentUser());
    this.contributors.on('select', (function(){
        this.updates.empty();
        this.showLoading();
        this.filterEvents();
    }).bind(this));

    this.updates = new ListWidget("updates_container", "#gimply_updates_container", {selectable: false});
    $(this.updates.container).addClass("right");
    $(this.updates.container).on("click", ".commit-message", function (e) {
        if(e.target === this){
            window.open("https://github.com/" + self.getCurrentRepoName() + "/commit/" + $(this).attr('data-commit-sha'));
        }
    });
    $(this.updates.container).on("click", ".issue-title", function (e) {
        if(e.target === this){
            window.open("https://github.com/" + self.getCurrentRepoName() + "/issues/" + $(this).attr('data-issue-number'));
        }
    });
    //For some reason, anchor tags are not working when injected through content script
    $(this.updates.container).on("click", "a", function(e){
        if(this.href.indexOf("#") !== 0 && this.href.indexOf("javascript:") !== 0){
            e.stopPropagation();
            window.location.href = this.href;
        }
    });
    this._addLogo();
    this.fetchEvents();
};

gimply.prototype.filterEvents = function() {
    if(!this.isUpdatesTab()){
        return;
    }
    this.port.postMessage({type:"fetchContributors"});
    var msg = {
        type:"filterEvents"
    }
    var logins = this.contributors.selected;
    if(!_(logins).include("*")){
        msg.filter = {login: logins.join(",")}
    };
    this.port.postMessage(msg);
}


gimply.prototype.fetchEvents = function () {
    this.port.postMessage({type:"fetchEvents"});
    this.port.postMessage({type:"fetchContributors"});
}

gimply.prototype.updateContributors = function(contributors){
    if(!this.isUpdatesTab()){
        return;
    }
    _(contributors).each(function(contributor){
        this.contributors.add(contributor.login, "contributor_" + contributor.login, contributor.login);
    }, this);
    if(contributors.length > 1 ){
        this.contributors.add("[everyone]", "all_contributors", "*");
    }
    var sortedLoginIds = _.chain(contributors).sortBy(function(contributor){
        return contributor.latest_update_at? (-1 * new Date(contributor.latest_update_at)) : 0;;
    }).pluck("login").value();
    this.contributors.sort(["*"].concat(sortedLoginIds));
}

gimply.prototype.addEvents = function (events) {
    if(!this.isUpdatesTab()){
        return;
    }
    this.updates.empty();
    this.hideLoading();
    var lastEvent = null;
    var updateList = this.updates;
    var self = this;

    var isMultiUser = this.contributors.selected.length > 1 || _(this.contributors.selected).include("*");

    function _merge (mergeTo, event){
        switch(event.type){
            case "StatusUpdateEvent":
                //Older updates first
                Array.prototype.unshift.apply(mergeTo.payload.comments, event.payload.comments);
                break;
            case "PushEvent":
                //older commits first
                Array.prototype.unshift.apply(mergeTo.payload.commits, event.payload.commits);
                break;
            case "IssuesEvent":
                //older events first
                Array.prototype.unshift.apply(mergeTo.payload.issues, event.payload.issues);
                break;
        }
    }

    var typesOrder = ["StatusUpdateEvent", "IssuesEvent", "PushEvent"];
    var today = new Date();

    _.chain(events).filter(this.shouldRenderEvent.bind(this)).map(function(event){
        _.convert_dates(event, ["created_at", "updated_at"]);
        if(event.type === "StatusUpdateEvent"){
            event.payload.comments = [event.payload.comment];
        }
        if(event.type === "IssuesEvent"){
            event.payload.issues = [event.payload.issue];
        }
        return event;
    }).reduce(function(reducedEvents, event){
        var merged;
        merged = _(reducedEvents).some(function(prevEvent){
            if( prevEvent.type === event.type &&
                (event.type === "IssuesEvent"?(event.payload.action === prevEvent.payload.action):true) &&
                prevEvent.payload.ref === event.payload.ref &&
                prevEvent.actor.login === event.actor.login &&
                _.same_day(prevEvent.created_at, event.created_at)) {
                _merge(prevEvent, event);
                return true;
            }
            return false;
        });
        if(!merged){
            reducedEvents.push(event);
        }
        return reducedEvents;
    }, []).sortBy(function(event){
            //A large number - day part of the millisecond timestamp
            //suffixed by contributor login
            //suffixed by event type
            return "" + (999000 + _.day_diff(today, event.created_at)) +  event.actor.login.toLowerCase() + typesOrder.indexOf(event.type);
        }).tap(function(list){
            console.warn("Sorted List:", list);
        }).each(
        function (event) {
            if (!lastEvent || !_.same_day(lastEvent.created_at, event.created_at)) {
                updateList.add(self.dateToHtml(event.created_at));
            }
            lastEvent = event;
            updateList.add(self.toHtml(event, isMultiUser));
        });
}

gimply.prototype.shouldRenderEvent = function (event) {
    switch (event.type) {
        case "IssuesEvent":
            return this._showIssues.isOn() && (event.payload.action === "closed" || event.payload.action === "reopened");
        case "PushEvent":
            return this._showCommits.isOn();
        case "StatusUpdateEvent":
            return this._showUpdates.isOn();
        default:
            return false;
    }
}
gimply.prototype.toHtml = function (update, isMultiUser) {
    try {
        switch (update.type) {
            case "PushEvent":
                return this.pushEventToHtml(update, isMultiUser);
            case "IssuesEvent":
                return this.issuesEventToHtml(update, isMultiUser);
            case "StatusUpdateEvent":
                return this.statusUpdateEventToHtml(update, isMultiUser);
            default:
                return "";
        }
    }catch(e){
        console.error("failed to format event:", update);
    }
}
gimply.prototype.dateToHtml = function (d) {
    var dateName = _.date_name(d);
    var span = $("<div></div>").addClass("date").attr("value", d.valueOf());
    span.html(dateName);
    return span;
}

gimply.prototype.typeToHtml = function (type) {
    var text = type;
    var className = type;
    if(type === "status") {
        text = "updated status"
    }
    return $("<span></span>").addClass("update-type").addClass(className).html(text);
}

gimply.prototype.pushEventToHtml = function (event, isMultiUser) {
    // refs/heads/master
    var branchName = event.payload.ref.split("/")[2];
    var repoName = this.getCurrentRepoName();

    var div = $("<div></div>").addClass("update").addClass("push");
    var type = this.typeToHtml("pushed");
    var branch = $("<span></span>").addClass("branch-name").html($("<a></a>").attr("href", "https://github.com/" + this.getCurrentRepoName() + "/tree/" + branchName).html(branchName));
    var header = $("<div></div>").addClass("update-header push-details");
    if(isMultiUser){
        header.append($("<span class='contributor-name'></span>").html(event.actor.login));
    }
    header.append(type).append(branch);
    div.append(header);

    _(event.payload.commits).each(function (commit) {
        var sha = _.sha_html(commit.sha, repoName);
        var message = $("<span></span>").addClass("commit-message").html(_.git_message(commit.message, repoName)).attr("data-commit-sha", commit.sha);
        sha.addClass("commit-sha");
        var commitDiv = $("<div></div>").addClass("commit").append(sha).append(message);
        div.append(commitDiv);
    });
    return div;
}

gimply.prototype.statusUpdateEventToHtml = function (event, isMultiUser) {
    var repoName = this.getCurrentRepoName();
    var type = this.typeToHtml("status");
    var header = $("<div></div>").addClass("update-header");
    if(isMultiUser){
        header.append($("<span class='contributor-name'></span>").html(event.actor.login));
    }
    header.append(type);

    var div = $("<div></div>").addClass("update").addClass("status-update");
    var messages = $("<div></div>").addClass("status-messages");
    _(event.payload.comments).each(function(comment){
        var html = $("<div></div>").addClass("status-body").html(_.git_message(comment.body, repoName));
        messages.append(html);
    });
    return div.append(header).append(messages);
}

gimply.prototype.issuesEventToHtml = function (event, isMultiUser) {
    var repoName = this.getCurrentRepoName();
    var div = $("<div></div>").addClass("update").addClass("issue");
    var type = this.typeToHtml(event.payload.action);

    var header = $("<div></div>").addClass("update-header");
    if(isMultiUser){
        header.append($("<span class='contributor-name'></span>").html(event.actor.login));
    }
    header.append(type);

    var issues = $("<div></div>").addClass("issues");

    _(event.payload.issues).each(function(issue){
        var number = $("<span></span>").addClass("issue-number").html($("<a></a>").attr("href", "https://github.com/" + repoName + "/issues/" + issue.number).html("#" + issue.number));
        var title = $("<span></span>").addClass("issue-title").html(_.git_message(issue.title, repoName)).addClass(event.payload.action).attr("data-issue-number", issue.number);
        var html = $("<div></div>").addClass("issue-entry").append(number).append(title);
        issues.append(html);
    });
    div.append(header).append(issues);
    return div;
}

gimply.prototype.showLoading = function(){
    var loading = $("#gimply_updates_container #loading");
    if( loading.length === 0 ){
        var loading = $("<img/>").attr("id", "loading").attr("src", chrome.extension.getURL("images/loading.gif"));
        $("#gimply_updates_container").append(loading);
    }
    loading.show();
}

gimply.prototype.hideLoading = function(){
    var loading = $("#gimply_updates_container #loading");
    loading.hide();
}

gimply.prototype._addLogo = function(){
    if($("#gimply_promo").length !== 0){
        return;
    }
    var img = $('<img/>').attr("src", chrome.extension.getURL("images/gimply_logo_small.png")).attr("title", "http://gimply.com");
    img.click(function(){
        window.open("http://gimply.com");
    });
    var div = $("<div id='gimply_promo'></div>").append(img);
    $("#gimply_updates_container").append(div);
}

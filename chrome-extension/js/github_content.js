"use strict";

function gimply() {
    this.init_events();
    this.init_ui();
}

gimply.prototype.showUpdates = function () {
    this._removeGithubElements();

    this.contributors = new ListWidget("contributors", "#gimply_updates_container");
    this.contributors.setDefault(this.getCurrentUser());
    this.contributors.on('select', this.fetchEvents.bind(this));

    this.updates = new ListWidget("updates_container", "#gimply_updates_container");
    this.updateBox = new UpdateBox("update_input", "#gimply_updates_container");
    this.updateBox.on('enter', (function(txt){
        alert("Entered: " + txt);
        this.port.postMessage({ type: "postStatusUpdate", body: txt});
    }).bind(this));
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

gimply.prototype.getCurrentUser = function(){
    return $("#user .name").text();
};

gimply.prototype.init_events = function () {
    var port = chrome.extension.connect({name: this.getCurrentRepoName()});
    this.port = port;
    port.onMessage.addListener((function (msg) {
        switch (msg.type) {
            case "filtered-events":
                this.addEvents(msg.payload);
                break;
            case "event":
                this.fetchEvents();
                break;
            case "contributors":
                var contributors = msg.payload;
                _(contributors).each(function(contributor){
                    this.contributors.add(contributor.login, "contributor_" + contributor.login, contributor.login);
                }, this);
                var sortedLoginIds = _.chain(contributors).sortBy(function(contributor){
                    return contributor.latest_update_at? (-1 * new Date(contributor.latest_update_at)) : 0;;
                }).pluck("login").value();
                this.contributors.sort(sortedLoginIds);
                break;
            case "contributor":
                this.port.postMessage({type:"fetchContributors"});
                break;
            case "status-update-success":
                this.updateBox.clear();
                break;
            case "status-update-failure":
                this.updateBox.showError("Sorry! Gimply failed to post your update.");
                break;
        }
    }).bind(this));
}

gimply.prototype.fetchEvents = _.throttle(function () {
    this.port.postMessage({type:"fetchContributors"});
    this.port.postMessage({
        type:"filterEvents",
        filter:{
            login: this.contributors.selected.length?this.contributors.selected.join(","):this.getCurrentUser()
        }
    });
}, 1000);

gimply.prototype.addEvents = function (events) {
    this.updates.empty();
    var lastEvent = null;
    var updateList = this.updates;
    var self = this;
    _.chain(events).filter(this.shouldRenderEvent.bind(this)).each(
        function (event) {
            _.convert_dates(event, ["created_at", "updated_at"]);
            if (!lastEvent || !_.same_day(lastEvent.created_at, event.created_at)) {
                updateList.add(self.dateToHtml(event.created_at));
            }
            lastEvent = event;
            updateList.add(self.toHtml(event));
        }).each(function (event) {
            //updateList.add(self.toHtml(event));
        });
}

gimply.prototype.shouldRenderEvent = function(event){
    switch(event.type){
        case "IssuesEvent":
            return event.payload.action === "closed" || event.payload.action === "reopened";
        case "PushEvent":
        case "StatusUpdateEvent":
            return true;
        default:
            return false;
    }
}
gimply.prototype.toHtml = function(update){
    switch(update.type){
        case "PushEvent":
            return this.pushEventToHtml(update);
        case "IssuesEvent":
            return this.issuesEventToHtml(update);
        case "StatusUpdateEvent":
            return this.statusUpdateEventToHtml(update);
        default:
            return "";
    }
}
gimply.prototype.dateToHtml = function(d){
    var dateName = _.date_name(d);
    var span = $("<span></span>").addClass("date").attr("value", d.valueOf());
    span.html(dateName);
    return span;
}

gimply.prototype.pushEventToHtml = function(event){
    // refs/heads/master
    var branchName = event.payload.ref.split("/")[2];
    var repoName = this.getCurrentRepoName();
    var div = $("<div></div>").addClass("update").addClass("push");
    var branch = $("<span></span>").addClass("branch-name").html($("<a></a>").attr("href", "https://github.com/" + this.getCurrentRepoName() + "/tree/" + branchName).html(branchName));
    var timestamp = $("<span></span>").addClass("time").html(_.time_name(event.created_at));
    var contributor = _.git_contributor(event.actor).addClass("contributor");

    div.append(contributor);

    _(event.payload.commits).each(function(commit){
        var message = $("<span></span>").addClass("commit-message").html(_.git_message(commit.message, repoName));
        var sha = _.sha_html(commit.sha, repoName);
        var commitDiv = $("<div></div>").addClass("commit").append(message).append(sha);
        div.append(commitDiv);
    });
    return div.append(branch).append(timestamp);
}
gimply.prototype.statusUpdateEventToHtml = function(event){
    var repoName = this.getCurrentRepoName();
    var div = $("<div></div>").addClass("update").addClass("status-update");
    var contributor = _.git_contributor(event.actor).addClass("contributor");
    var timestamp = $("<span></span>").addClass("time").html(_.time_name(event.created_at));
    var message = $("<span></span>").addClass("issue-title").html(_.git_message(event.payload.comment.body, repoName));
    return div.append(contributor).append(message).append(timestamp);
}
gimply.prototype.issuesEventToHtml = function(event){
    var issue = event.payload.issue;
    var assignee = issue.assignee || event.actor;
    var repoName = this.getCurrentRepoName();
    var div = $("<div></div>").addClass("update").addClass("issue");
    var status = $("<span></span>").addClass("status").addClass(event.payload.action);
    var number = $("<span></span>").addClass("issue-number").html($("<a></a>").attr("href","https://github.com/" + repoName + "/issues/" + issue.number).html("#" + issue.number) );
    var title = $("<span></span>").addClass("issue-title").html(_.git_message(issue.title, repoName));
    var timestamp = $("<span></span>").addClass("time").html(_.time_name(event.created_at));
    div.append(status).append(number).append(title).append(_.git_contributor(assignee).addClass("assignee"));
    if(assignee.login !== event.actor.login){
        div.append(_.git_contributor(event.actor).addClass("actor"));
    }
    div.append(timestamp);
    return div;
}

var $g = new gimply();
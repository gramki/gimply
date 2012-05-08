"use strict";

gimply.prototype.showUpdates = function () {
    var self = this;
    var postUpdate = $("<a id='post_update_action'></a>").addClass("action button post-update-button").html("Post Your Update");
    postUpdate.click(function () {
        self.showUpdateInput();
        $("#gimply_updates_input").addClass("active");
    });
    $("#gimply_updates_input").append(postUpdate);
    $("#gimply_updates_input").append($("<div></div>").attr("id", "update_box_container").addClass("right"));
    this.updateBox = new UpdateBox("update_input", "#update_box_container");
    this.updateBox.on('enter', (function (txt) {
        this.port.postMessage({ type:"postStatusUpdate", body:txt});
    }).bind(this));
    this.updateBox.on('cancel', function () {
        self.hideUpdateInput();
        $("#gimply_updates_input").removeClass("active");
    });
    this.hideUpdateInput();

    this._showCommits = true;

    var toggleCommits = $("<a href='javascript:void(0)'></a>").addClass("action toggle").html("Hide Commits");
    toggleCommits.click(function () {
        if ($(this).html() === "Hide Commits") {
            $(this).html("Show Commits");
            self._showCommits = false;
        } else {
            $(this).html("Hide Commits");
            self._showCommits = true;
        }
        self.filterEvents();
    });
    var actionBar = $("<div></div>").addClass("right actionBar").append(toggleCommits);
    $("#gimply_updates_container").append(actionBar);

    this.contributors = new ListWidget("contributors", "#gimply_updates_container");
    this.contributors.setDefault(this.getCurrentUser());
    this.contributors.on('select', (function(){
        this.updates.empty();
        this.filterEvents();
    }).bind(this));

    this.updates = new ListWidget("updates_container", "#gimply_updates_container");
    $(this.updates.container).addClass("right");
    $(this.updates.container).on("click", ".commit-message", function (e) {
        if(e.target === this){
            window.open("https://github.com/" + self.getCurrentRepoName() + "/commit/" + $(this).attr('data-commit-sha'));
        }
    });
    //For some reason, anchor tags are not working when injected through content script
    $(this.updates.container).on("click", "a", function(e){
        if(this.attr("href").indexOf("#") !== 0 && this.attr("href").indexOf("javascript:") !== 0){
            e.stopPropagation();
            window.location.href = this.attr("href");
        }
    });
    this.fetchEvents();
};

gimply.prototype.showUpdateInput = function () {
    $(this.updateBox.container).show();
    $("textarea", this.updateBox.container)[0].focus();
}
gimply.prototype.hideUpdateInput = function () {
    $(this.updateBox.container).hide();
}

gimply.prototype.filterEvents = _.throttle(function () {
    this.port.postMessage({type:"fetchContributors"});
    this.port.postMessage({
        type:"filterEvents",
        filter:{
            login:this.contributors.selected.length ? this.contributors.selected.join(",") : this.getCurrentUser()
        }
    });
}, 1000);

gimply.prototype.fetchEvents = function () {
    this.port.postMessage({type:"fetchEvents"});
    this.port.postMessage({type:"fetchContributors"});
}

gimply.prototype.updateContributors = function(contributors){
    _(contributors).each(function(contributor){
        this.contributors.add(contributor.login, "contributor_" + contributor.login, contributor.login);
    }, this);
    var sortedLoginIds = _.chain(contributors).sortBy(function(contributor){
        return contributor.latest_update_at? (-1 * new Date(contributor.latest_update_at)) : 0;;
    }).pluck("login").value();
    this.contributors.sort(sortedLoginIds);
}

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

gimply.prototype.shouldRenderEvent = function (event) {
    switch (event.type) {
        case "IssuesEvent":
            return event.payload.action === "closed" || event.payload.action === "reopened";
        case "PushEvent":
            return this._showCommits;
        case "StatusUpdateEvent":
            return true;
        default:
            return false;
    }
}
gimply.prototype.toHtml = function (update) {
    switch (update.type) {
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
gimply.prototype.dateToHtml = function (d) {
    var dateName = _.date_name(d);
    var span = $("<div></div>").addClass("date").attr("value", d.valueOf());
    span.html(dateName);
    return span;
}

gimply.prototype.typeToHtml = function (type) {
    return $("<span></span>").addClass("update-type").addClass(type).html(type);
}

gimply.prototype.pushEventToHtml = function (event) {
    // refs/heads/master
    var branchName = event.payload.ref.split("/")[2];
    var repoName = this.getCurrentRepoName();

    var div = $("<div></div>").addClass("update").addClass("push");
    var type = this.typeToHtml("pushed");
    var branch = $("<span></span>").addClass("branch-name").html($("<a></a>").attr("href", "https://github.com/" + this.getCurrentRepoName() + "/tree/" + branchName).html(branchName));
    var timestamp = $("<span></span>").addClass("time").html(_.time_name(event.created_at));
    var contributor = _.git_contributor(event.actor).addClass("contributor");

    div.append($("<div></div>").addClass("push-details").append(type).append(contributor).append(branch).append(timestamp));

    _(event.payload.commits).each(function (commit) {
        var sha = _.sha_html(commit.sha, repoName);
        var message = $("<span></span>").addClass("commit-message").html(_.git_message(commit.message, repoName)).attr("data-commit-sha", commit.sha);
        sha.addClass("commit-sha");
        var commitDiv = $("<div></div>").addClass("commit").append(sha).append(message);
        div.append(commitDiv);
    });
    return div;
}

gimply.prototype.statusUpdateEventToHtml = function (event) {
    var repoName = this.getCurrentRepoName();
    var type = this.typeToHtml("status");

    var div = $("<div></div>").addClass("update").addClass("status-update");
    var contributor = _.git_contributor(event.actor).addClass("contributor");
    var timestamp = $("<span></span>").addClass("time").html(_.time_name(event.created_at));
    var message = $("<span></span>").addClass("status-body").html(_.git_message(event.payload.comment.body, repoName));

    return div.append(type).append(contributor).append(message).append(timestamp);
}

gimply.prototype.issuesEventToHtml = function (event) {
    var issue = event.payload.issue;
    var assignee = issue.assignee || event.actor;
    var repoName = this.getCurrentRepoName();
    var div = $("<div></div>").addClass("update").addClass("issue");
    var type = this.typeToHtml(event.payload.action);

    var number = $("<span></span>").addClass("issue-number").html($("<a></a>").attr("href", "https://github.com/" + repoName + "/issues/" + issue.number).html("#" + issue.number));
    var title = $("<span></span>").addClass("issue-title").html(_.git_message(issue.title, repoName)).addClass(event.payload.action);
    var timestamp = $("<span></span>").addClass("time").html(_.time_name(event.created_at));

    div.append(type).append(number).append(title).append(_.git_contributor(assignee).addClass("assignee"));
    if (assignee.login !== event.actor.login) {
        div.append(_.git_contributor(event.actor).addClass("actor"));
    }
    div.append(timestamp);
    return div;
}


"use strict";

function Github() {
    this._access_token = "";
    this.eventsById = {};
    this.events = [];
    this._cutoff_time = new Date((new Date()) - 15 * 24 * 60 * 60 * 1000);
    this.repository = {};
}

function convertDates(obj) {
    _(obj).each(function (value, name) {
        if (name === 'created_at' || name === 'updated_at') {
            obj[name] = new Date(value);
        }
        if (_.isObject(value)) {
            convertDates(value);
        }
    });
}

function responseLinks(xhr) {
    var linkText = xhr.getResponseHeader("link");
    if (!linkText) {
        return {};
    }
    var links = {};
    linkText.split(",").forEach(function (txt) {
        var parts = txt.split(";");
        var url = parts[0].match("<([^>]+)>")[1];
        var rel = parts[1].match('rel="([^"]+)"')[1];
        links[rel] = url;
    });
    return links;
};

function paginatedGet(url, onPageResponse, onError){
    $.ajax({
        url:url,
        dataType:"json",
        success:function (response, status, xhr) {
            var shouldFetchNextPage = onPageResponse(response);
            if(shouldFetchNextPage){
                var links = responseLinks(xhr);
                if (links.next) {
                    paginatedGet(links.next, onPageResponse);
                }
            }
        },
        error:function (xhr, status, e) {
            console.error("Failed ", status, xhr);
            onError && onError(xhr, status, e, url);
        }
    });
}


function Repository(name, githubObj) {
    this.github = githubObj;
    this.name = name;
    this.events = [];
    this._requiredEventCount = 0;
    this.contributors = {};
    this.milestones = {};
    this.eventsById = {};
    this.lastFetchTime = 0;
    this.issues = {};
    this._STATUS_UPDATE_ISSUE_NUMBER = 1;
    this.initialFetch();
}

Repository.prototype.initialFetch = function(){
    this.fetchContributors();
    this.fetchMilestones();
};

Repository.prototype._isRequiredEvent = function(event){
    return event.type === "PushEvent" ||
        (event.type === "IssuesEvent" && _(['closed', 'reopened']).include(event.payload.action) ) ||
        (event.type === "IssueCommentEvent" && event.payload.issue.number === this._STATUS_UPDATE_ISSUE_NUMBER);
}
Repository.prototype.addEvent = function (event) {
    if (this.eventsById[event.id]) {
        return false;
    }
    _.convert_dates(event, ["created_at", "updated_at"]);
    event.sort_key = -1 * event.created_at;
    var index = _.chain(this.events).pluck('sort_key').sortedIndex(event.sort_key).value();
    this.events.splice(index, 0, event);
    this.eventsById[event.id] = event;

    if(event.actor && this._isRequiredEvent(event)){
        if(!this.contributors[event.actor.login]){
            this.addContributor(event.actor);
        }
        var contributor = this.contributors[event.actor.login];
        if((contributor.latest_update_at||0) < event.created_at){
            contributor.latest_update_at = event.created_at;
            contributor.last_event = event.id;
        }
        this._requiredEventCount++;
    }
    switch(event.type){
        case "IssuesEvent":
            this.fetchIssue(event.payload.issue.number);
            break;
        case "IssueCommentEvent":
            if(event.payload.issue.number === this._STATUS_UPDATE_ISSUE_NUMBER){
                event.type = "StatusUpdateEvent";
            }
            break;
    }
    return true;
}

Repository.prototype.addMilestone = function(milestone){
    this.milestones[milestone.number] = milestone;
    if(milestone.state === "open" || milestone.open_issues > 0){
        this.fetchIssues({milestone: milestone.number});
    }
    this.github.raise("milestone", [milestone, this.name]);
    return true;
}

Repository.prototype.addIssue = function(issue){
    this.issues[issue.number] = issue;
    this.github.raise("issue", [issue, this.name]);
    return true;
}

Repository.prototype.postStatusUpdate = function (message) {
    var url = "https://api.github.com/repos/" + this.name + "/issues/" + this._STATUS_UPDATE_ISSUE_NUMBER + "/comments?access_token=" + this.github._access_token;
    var self = this;
    $.ajax({
        url: url,
        type: "POST",
        processData: false,
        data: JSON.stringify({ body: message}),
        success: function(comment){
            self.github.raise("status-update-success", [comment, self.name]);
            self.fetchEvents();
        },
        error: function(xhr, status, e){
            console.error("status-update-failure", message, xhr, e);
            self.github.raise("status-update-failure", [message, self.name]);
        }
    });
}

Repository.prototype.oldestEvent = function () {
    return _.last(this.events);
}

Repository.prototype.fetchEvents = function () {
    var url = "https://api.github.com/repos/" + this.name + "/events?access_token=" + this.github._access_token;
    paginatedGet(url, (function(events){
        var addedEventCount = _.chain(events).map(this.addEvent.bind(this)).compact().size().value();
        if(addedEventCount){
            this.github.raise("new-event", [{}, this.name]);
        }
        var canFetchMore = (this._requiredEventCount < 500)?true:(this.oldestEvent().created_at > this.github._cutoff_time);
        return canFetchMore && addedEventCount === events.length;
    }).bind(this));
};

Repository.prototype.filterEvents = function(filter){
    var logins;
    if(filter && filter.login){
        logins = filter.login.split(",");
    }
    return _(this.events).filter(function(event){
        var issue = event.payload.issue;
        return !logins || _(logins).contains(event.actor.login) || (event.type === "IssuesEvent" && issue && issue.assignee && _(logins).contains(issue.assignee.login));
    });
}

Repository.prototype.addContributor = function(contributor){
    this.contributors[contributor.login] = contributor;
    this.github.raise("contributor", [contributor, this.name]);
};

Repository.prototype.fetchContributors = function(){
    var url = "https://api.github.com/repos/" + this.name + "/contributors?access_token=" + this.github._access_token;
    paginatedGet(url, (function(contributors){
        _(contributors).each(this.addContributor.bind(this));
    }).bind(this));
};

Repository.prototype.getActiveContributors = function(){
    return _(this.contributors).filter(function(contributor){
        return !!contributor.latest_update_at;
    });
}

Repository.prototype.fetchMilestones = function(){
    var url = "https://api.github.com/repos/" + this.name + "/milestones?access_token=" + this.github._access_token;
    paginatedGet(url, (function(milestones){
        var didNotFindOverlap = _(milestones).all(this.addMilestone.bind(this));
        return didNotFindOverlap;
    }).bind(this));
};

Repository.prototype.fetchIssues = function(filters){
    var query = _(filters).reduce(function(query, value, key){
        return query + "&" + key + "=" + value;
    }, "");

    var url = "https://api.github.com/repos/" + this.name + "/issues?access_token=" + this.github._access_token + query;
    paginatedGet(url, (function(issues){
        var didNotFindOverlap = _(issues).all(this.addIssue.bind(this));
        return didNotFindOverlap;
    }).bind(this));
};

Repository.prototype.fetchIssue = function(number){
    var url = "https://api.github.com/repos/" + this.name + "/issues/"+number+"?access_token=" + this.github._access_token;
    paginatedGet(url, this.addIssue.bind(this));
};


Github.prototype.addRepository = function (name) {
    return (this.repository[name] = this.repository[name] || new Repository(name, this));
};

Github.prototype.setAccessToken = function (/*String*/ token) {
    this._access_token = token;
    this._getUser();
};

Github.prototype.hasAccessToken = function(){
    return !!this._access_token;
};

Github.prototype.on = event_mixin.on;
Github.prototype.off = event_mixin.off;
Github.prototype.raise = event_mixin.raise;

Github.prototype._getUser = function(){
    var url = "https://api.github.com/user?access_token=" + this._access_token;
    paginatedGet(url, (function(user){
        this.user = user;
        this.raise('user', [user]);
    }).bind(this));
}

Github.prototype.fetchEvents = function (repoName) {
    var repository = this.addRepository(repoName);
    repository.fetchEvents();
};

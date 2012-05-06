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
    this.contributors = {};
    this.eventsById = {};
    this.lastFetchTime = 0;
    this.fetchContributors();
}

Repository.prototype.addEvent = function (event) {
    if (this.eventsById[event.id]) {
        return false;
    }
    convertDates(event);
    var index = _.chain(this.events).pluck('created_at').sortedIndex(event.created_at).value();
    this.events.splice(index, 0, event);
    this.eventsById[event.id] = event;

    if(event.actor && this.contributors[event.actor.login]){
        var contributor = this.contributors[event.actor.login];
        if(contributor && ((contributor.latest_update_at||0) < event.created_at)){
            contributor.latest_update_at = event.created_at;
        }
    }
    this.github.raise(event.type, [event]);
    console.warn("Added event: ", event);
    return true;
}

Repository.prototype.oldestEvent = function () {
    return _.last(this.events);
}

Repository.prototype.fetchEvents = function () {
    var url = "https://api.github.com/repos/" + this.name + "/events?access_token=" + this.github._access_token;
    paginatedGet(url, (function(events){
        var didNotFindOverlap = _(events).all(this.addEvent.bind(this));
        var canFetchMore = (this.oldestEvent().created_at > this.github._cutoff_time);
        return canFetchMore && didNotFindOverlap;
    }).bind(this));
};

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

Github.prototype.addRepository = function (name) {
    return (this.repository[name] = this.repository[name] || new Repository(name, this));
};

Github.prototype.setAccessToken = function (/*String*/ token) {
    this._access_token = token;
};

Github.prototype.on = event_mixin.on;
Github.prototype.off = event_mixin.off;
Github.prototype.raise = event_mixin.raise;

Github.prototype.fetchEvents = function (repoName) {
    var repository = this.addRepository(repoName);
    repository.fetchEvents();
};
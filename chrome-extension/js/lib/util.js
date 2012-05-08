"use strict";
_.mixin({
    same_day:function (d1, d2) {
        return d1.getDate() === d2.getDate() && d1.getMonth() === d2.getMonth() && d1.getYear() === d2.getYear();
    },

    convert_dates:function (obj, attribute_names) {
        _(obj).each(function (value, name) {
            if (_(attribute_names).contains(name)) {
                obj[name] = new Date(value);
            }
            if (_.isObject(value)) {
                _.convert_dates(value, attribute_names);
            }
        });
    },

    date_name:function (d) {
        var today = new Date();
        if (_.same_day(d, today)) {
            return "Today";
        }
        var diff = _.day_diff(today, d);
        if (diff === 1) {
            return "Yesterday";
        }
        return _.day_diff(today, d) + " days ago";
    },

    day_diff:function (later, older) {
        later = _.date_of_day(later);
        older = _.date_of_day(older);
        return Math.floor((later - older) / (24 * 60 * 60 * 1000));
    },

    date_of_day:function (date) {
        date = new Date(date);
        date.setMilliseconds(0);
        date.setSeconds(0);
        date.setMinutes(0);
        date.setHours(0);
        return date;
    },

    time_name: function(d){
        var now = new Date();
        if(_.day_diff(now, d) < 1){
            var mins = now.getMinutes() - d.getMinutes();
            if(mins < 1){
                return "now";
            }
            if( mins < 60){
                return mins + " min ago";
            }
            var hours = Math.round(mins/60);
            if(hours === 1){
                return "an hour ago";
            }
            return hours + " hours ago"
        }
        var h = d.getHours();
        var m = d.getMinutes();
        var ampm = h >= 12 ? "pm" : "am";
        h = (h>12)?h-12:h;
        return h + " " + ampm;
    },

    git_message: function(msg, repoName){
        //Converts git message to html
        msg = msg.replace(/\r?\n/g, "<br/>");
        var matches = msg.match(/\W?[0-9a-f]{5,50}\W?/g);
        _.chain(matches).uniq().filter(function(txt){
            return !!txt.match(/[0-9]+/);
        }).each(function(sha){
            msg = msg.replace(new RegExp(sha, "g"), _.sha_html(sha, repoName)[0].outerHTML);
        });
        matches = msg.match(/#[0-9]+/g);
        if(matches){
            _.chain(matches).uniq().each(function(numWithHash){
                msg = msg.replace(new RegExp(numWithHash, "g"), _.issue_html(numWithHash.substr(1), repoName)[0].outerHTML);
            });
        }
        return msg;
    },

    sha_html: function(sha, repoName){
        return $("<a></a>").attr("href", "/" + repoName+"/commit/"+ sha).addClass('sha').html(sha.substr(0,9));
    },
    issue_html: function(num, repoName) {
        return $("<a></a>").attr("href", "/" + repoName+"/issues/"+ num).addClass('sha').html("#" + num);
    },

    git_contributor: function(contributor){
        var div = $("<div></div>").addClass("contributor");
        var img = $("<img/>").attr("src", contributor.avatar_url).attr("width", 25).attr("height", 25);
        var name = $("<span></span>").addClass("name").html(contributor.login);
        return div.append(img).append(name);
    }
});

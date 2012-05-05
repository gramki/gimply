
function gimply(){
    this.init_ui();
}

gimply.prototype.showUpdates = function(){
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
};


gimply.prototype.init_ui = function(){
    var tabs = $("ul.tabs li");
    if( !tabs || $.trim(tabs[0].innerText) !== "Code"){
        return;
    }

    $(tabs[1]).before("<li id='gimply_updates_tab'><a href='#gimply_updates'>Updates</a></li>");
    $("#gimply_updates_tab").click(this.showUpdates.bind(this));
    var isUpdatesTab = (window.location.href.indexOf("#gimply_updates") > 0);
    if(isUpdatesTab){
        this.showUpdates();
    }
};

$g = new gimply();
"use strict";

gimply.prototype.addUpdatesInput = function(){
    var self = this;
    if(!this.isUpdatesTab() || $("#post_update_action").length !== 0 ){
        return;
    }
    var postUpdate = $("<a id='post_update_action'></a>").addClass("action post-update-button").html("Post Your Update");
    postUpdate.click(function () {
        if(self.updateBox.isVisible()){
            self.hideUpdateInput();
        }else{
            self.showUpdateInput();
        }
    });
    $("#gimply_updates_input").append(postUpdate);

    $("#gimply_updates_input").append($("<div></div>").attr("id", "update_box_container").addClass("right"));

    this._addGimplyEnabler();

    this.updateBox = new UpdateBox("update_input", "#update_box_container");
    this.updateBox.on('enter', (function (txt) {
        this.port.postMessage({ type:"postStatusUpdate", body:txt});
    }).bind(this));

    this.updateBox.on('cancel', function () {
        self.hideUpdateInput();
    });
    this.hideUpdateInput();
    this.onRepoStatusUpdate();
}

gimply.prototype._addGimplyEnabler = function(){
    var div = $("<div></div>").attr("id", "gimply_enabler");
    var html = "<div class='title'>Post custom updates to this repository using gimply</div>";
    html += "<div class='what'>You and your team can post your daily stand-up meeting updates,<br/>other project related updates and accomplishments.</div>"
    html += "<div class='how'>gimply adds them as comments to a github issue it will create in this repository<br/>"
    html+= "and presents them <span class='em'>nicely</span> as status updates here</div>";

    var self = this;
    var enableGimply = $("<a id='enable_gimply'></a>").addClass("button logo-color").html("Enable Gimply");
    enableGimply.click(function(){
        self.port.postMessage({type:"setupGimply"});
    });
    div.html(html).append(enableGimply);
    $("#update_box_container").append(div);
}

gimply.prototype.onRepoStatusUpdate = function(repoStatus){
    if(!repoStatus || !repoStatus.gimply_status.is_gimply){
        this._shouldEnableGimply = true;
    }else{
        this._shouldEnableGimply = false;
    }
    if($("#update_box_container:visible").length !== 0){
        this.showUpdateInput();
    }
}

gimply.prototype.showUpdateInput = function () {
    $("#update_box_container").show();
    $("#gimply_updates_input").addClass("active");
    if(this._shouldEnableGimply){
        $("#gimply_enabler").show();
        $(this.updateBox.container).hide();
    }else{
        $("#gimply_enabler").hide();
        $(this.updateBox.container).show();
        $("textarea", this.updateBox.container)[0].focus();
    }
}

gimply.prototype.hideUpdateInput = function () {
    $("#update_box_container").hide();
    $("#gimply_updates_input").removeClass("active");
}

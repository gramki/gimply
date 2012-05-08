"use strict";
function ListWidget(id, parent, options) {
    if ($("#" + id).length === 0) {
        $(parent).append("<ul id='" + id + "'></ul>");
    }
    this.container = $("#" + id)[0];
    this.selected = [];
    var widget = this;
    if(!options || options.selectable !== false){
        $(this.container).selectable({
            stop:function (event, ui) {
                var selected = _($(".ui-selected", this)).invoke("getAttribute", "data-list-value");
                widget.selected = selected;
                if (selected.length) {
                    widget.raise("select", selected);
                }else{
                    widget.selectDefault();
                }
            }
        });
    }
}

ListWidget.prototype.on = event_mixin.on;
ListWidget.prototype.off = event_mixin.off;
ListWidget.prototype.raise = event_mixin.raise;

ListWidget.prototype.setDefault = function(id){
    this._default = id;
};

ListWidget.prototype.selectDefault = function(){
    this._default && $("#" + this._default, this.container).click();
};

ListWidget.prototype.add = function (innerHTML, id, value) {
    if (id && this.has(id)) {
        return;
    }
    var li = $("<li>");
    if (id) {
        li.attr("id", id);
    }
    if (value) {
        li.attr("data-list-value", value);
    }
    if (typeof innerHTML === 'string') {
        li.html(innerHTML);
    } else {
        li.append(innerHTML);
    }
    $(this.container).append(li);
}
ListWidget.prototype.empty = function () {
    $(this.container).empty();
    this.selected = [];
    this.raise("empty");
}
ListWidget.prototype.has = function (id) {
    return !!$("#" + id, this.container).length;
}

ListWidget.prototype.sort = function (orderedValues) {
    var items = $("li", this.container).detach();
    var container = $(this.container);
    _.chain(items).sortBy(
        function (item) {
            var position = orderedValues.indexOf(item.getAttribute("data-list-value"));
            return position >= 0 ? position : items.length;
        }).each(function (item) {
            container.append(item);
        });
}


function UpdateBox(id, parent){
    if ($("#" + id).length === 0) {
        $(parent).append('<div id="' + id + '"><div class="wrapper textareaWrapper"><textarea tabindex="1"  rows="3" cols="80"></textarea></div><div class="wrapper buttonWrapper"><a tabindex="1" class="button medium green">Post!</a></div><span class="hint">Ctrl+Enter to submit</span><div class="error"></div></div>');
    }
    this.container = $("#" + id)[0];
    var raiseEnter = (function(){
        var message = $("textarea", this.container).val();
        $("a.button", this.container).attr('disabled', 'disabled');
    }).bind(this);

    $("a.button", this.container).click(raiseEnter);
    $("textarea", this.container).keypress(function(e){
        if(e.ctrlKey && e.which === 10){
            raiseEnter();
        }
    });
    var widget = this;
    var cancel = $("<a></a>").addClass("cancel").attr("href", "javascript:void(0)").html("x").click(function(){
        widget.raise("cancel", [widget]);
    });
    $(this.container).append(cancel);
}

UpdateBox.prototype.on = event_mixin.on;
UpdateBox.prototype.off = event_mixin.off;
UpdateBox.prototype.raise = event_mixin.raise;

UpdateBox.prototype.clear = function(){
    $("textarea", this.container).val("");
    this.enableButton();
};

UpdateBox.prototype.enableButton = function(){
    $("a.button", this.container).removeAttr('disabled')
};

UpdateBox.prototype.showError = function(msg){
    $(".error", this.container).html(msg);
    $(".error", this.container).show('slow');
    this.enableButton();
    $("textarea", this.container).one('keypress click', function(){
        $(".error", this.container).hide('slow');
    });
};

UpdateBox.prototype.isVisible = function(){
    return $("textarea:visible", this.container).length !== 0;
}

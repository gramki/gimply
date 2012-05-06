"use strict";
function ListWidget(id, parent, options) {
    if ($("#" + id).length === 0) {
        $(parent).append("<ul id='" + id + "'></ul>");
    }
    this.container = $("#" + id)[0];
    var widget = this;
    if(!options || options.selectable !== false){
        $(this.container).selectable({
            stop:function (event, ui) {
                var selected = _($(".ui-selected", this)).invoke("getAttribute", "data-list-value");
                if (selected.length) {
                    widget.raise("select", selected);
                }
            }
        });
    }
}

ListWidget.prototype.on = event_mixin.on;
ListWidget.prototype.off = event_mixin.off;
ListWidget.prototype.raise = event_mixin.raise;

ListWidget.prototype.add = function (id, value, innerHTML) {
    if (!this.has(id)) {
        if(typeof innerHTML === 'string'){
            $(this.container).append('<li id="' + id + '" data-list-value="' + value + '">' + innerHTML + '</li>');
        }else{
            $(this.container).append('<li id="' + id + '" data-list-value="' + value + '"></li>');
            $("#" + id , this.container).append(innerHTML);
        }
    }
}
ListWidget.prototype.empty = function () {
    $(this.container).empty();
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

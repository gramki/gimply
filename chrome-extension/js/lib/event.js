
event_mixin = {
    on: function(name, handler){
        if(!this._eh){
            this._eh = {};
        }
        if(!this._eh[name]){
            this._eh[name] = [];
        }
        this._eh[name].push = handler;
    },
    off: function(name, handler){
        var arr = this._eh && this._eh[name];
        if(!arr){
            return;
        }
        var index = arr.indexOf(handler);
        arr.splice(index,1);
    },
    raise: function(name, args){
        var arr = this._eh && this._eh[name];
        if(!arr){
            return;
        }
        arr.forEach(function(handler){
            handler.apply(this, args);
        });
    }
}
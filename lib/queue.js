var util = require("util");
var events = require("events");
var request = require("request");

function Queue() {
  thisQueue = this;
  events.EventEmitter.call(this);

  this.apiKey = null;
  this.databaseName = null;
  this.debug = false;

  this._items = [];
  this._timer = null;

  this.postInterval = 500;
  this.maxQueueSize = 10000;
  this.maxPostSize = 200;
  this.postTimeout = 2500;
  this.apiHost = "w.apiv3.errplane.com";

  this.push = function(point) {
    if (this._items.length >= this.maxQueueSize) { return; }

    this._items.push(point);
    this.emit("setTimeout")

    if (this._items.length >= this.maxPostSize) {
      this.emit("post");
    }
  }

  this.flush = function() {
    while (this._items.length > 0) { this._post(); }
  }

  this._setTimeout = function() {
    var _this = this;
    if (!this._timer) {
      this._timer = setTimeout(function () {
        _this.emit("post");
      }, this.postInterval)
    }
  }

  this._clearTimeout = function() {
    if (this._timer) { clearTimeout(this._timer); }
    this._timer = null;
  }

  this._post = function() {
    var body, output, start, data = [];

    this.emit("clearTimeout");

    if (this._items.length == 0) { return; }

    while ((this._items.length > 0) && (data.length <= this.maxPostSize)) {
      var point, item, line;
      item = this._items.pop();

      point = {};

      point["v"] = item["value"] || 1;

      if (item["timestamp"] != null) {
        point["t"] = item["timestamp"];
      }

      if (item["context"] != null) {
        point["c"] = JSON.stringify(item["context"]);
      }

      if (item["dimensions"] != null) {
        point["d"] = item["dimensions"];
      }

      data.push({n: item["name"], p: [point]});
    }

    body = JSON.stringify(data);

    if (this.debug) {
      util.log("[Errplane] Starting POST:\n" + body);
    }

    var options = {
      method: "POST",
      url: "https://" + this.apiHost + "/databases/" + this.databaseName + "/points?api_key=" + this.apiKey,
      body: body,
      timeout: this.postTimeout,
      headers: {
        'Content-Length': body.length,
        'Content-Type': 'text/plain',
      },
    }

    var self = this;
    request(options, function(err, response, body) {
      if (err) {
        util.log("[Errplane] Error received while contacting API: " + err);
      }
      else {
        if (response.statusCode >= 300) {
          util.log("[Errplane] POST failed (HTTP " + response.statusCode + "): " + body);
        }
        else {
          if (self.debug) { util.log("[Errplane] POST succeeded."); }
        }
      }
    })
  }

  this.on("post", this._post)
  this.on("setTimeout", this._setTimeout)
  this.on("clearTimeout", this._clearTimeout)
}

util.inherits(Queue, events.EventEmitter);
module.exports = new Queue();

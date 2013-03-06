var util = require("util");
var events = require("events");
var request = require("request");

function Queue() {
  events.EventEmitter.call(this);

  this._items = [];
  this._timer = null;

  this.postInterval = 500;
  this.maxQueueSize = 10000;
  this.maxPostSize = 200;
  this.postTimeout = 3000;
  this.apiHost = "apiv2.errplane.com";

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

  var _setTimeout = function() {
    _this = this;
    if (!this._timer) {
      this._timer = setTimeout(function () {
        _this.emit("post");
      }, this.postInterval)
    }
  }

  var _clearTimeout = function() {
    if (this._timer) { clearTimeout(this._timer); }
    this._timer = null;
  }

  var _post = function() {
    var lines = [];

    this.emit("clearTimeout")

    if (this._items.length == 0) { return; }

    while ((this._items.length > 0) && (lines.length <= this.maxPostSize)) {
      point = this._items.pop();
      point["value"] = point["value"] || 1;
      point["timestamp"] = point["timestamp"] || "now";
      point["context"] = point["context"];
      line = [point["name"], point["value"], point["timestamp"]].join(" ")
      if (point["context"]) {
        line += " " + new Buffer(JSON.stringify(point["context"])).toString("base64");
      }
      lines.push(line);
    }

    body = lines.join("\n")
    output = lines.map(function(line) {
      return "    " + line.substr(0,99);
    }).join("\n")
    util.log("[Errplane] Starting POST:\n" + output)

    var options = {
      method: "POST",
      url: "https://apiv2.errplane.com/databases/" + this.applicationId + this.environment + "/points?api_key=" + this.apiKey,
      body: body,
      timeout: this.postTimeout,
      headers: {
        'Content-Length': body.length,
        'Content-Type': 'text/plain',
      },
    }

    _this = this;
    start = Date.now()
    request(options, function(err, res, body) {
      util.log("[Errplane] POST succeeded.")
    })
  }

  this.on("post", _post)
  this.on("setTimeout", _setTimeout)
  this.on("clearTimeout", _clearTimeout)
}

util.inherits(Queue, events.EventEmitter);
module.exports = new Queue();

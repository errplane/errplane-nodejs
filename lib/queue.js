var util = require("util");
var events = require("events");
var request = require("request");

function Queue() {
  thisQueue = this;
  events.EventEmitter.call(this);

  this.apiKey = null;
  this.applicationId = null;
  this.environment = process.env.NODE_ENV || 'development';
  this.debug = false;

  this._items = [];
  this._timer = null;

  this.postInterval = 500;
  this.maxQueueSize = 10000;
  this.maxPostSize = 200;
  this.postTimeout = 2500;
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
    var body, output, start, lines = [];

    this.emit("clearTimeout");

    if (this._items.length == 0) { return; }

    while ((this._items.length > 0) && (lines.length <= this.maxPostSize)) {
      var point, line;
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

    var body = lines.join("\n")
    if (this.debug) {
      var output = lines.map(function(line) {
        return "    " + line.substr(0,99);
      }).join("\n")

      util.log("[Errplane] Starting POST:\n" + output)
    }

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

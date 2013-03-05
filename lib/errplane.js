var fs = require("fs");
var os = require("os");
var request = require("request");
var stackTrace = require("stack-trace");
var sha1 = require("sha1");

module.exports = Errplane;

function Errplane() {
  this.apiKey = null;

  this.host = 'http://' + os.hostname();
  this.environment = process.env.NODE_ENV || 'development';
  this.postTimeout = 3 * 1000;
  this.queue = [];
  this.maxQueueSize = 10000;
  this.maxPostSize = 200;
  this.postTimeout = 5000;

  this.apiHost = "apiv2.errplane.com";

  this.applicationId = null;
  this.projectRoot = null;
  this.appVersion = null;
}

Errplane.PACKAGE = (function() {
  var json = fs.readFileSync(__dirname + '/../package.json', 'utf8');
  return JSON.parse(json);
})();

Errplane.configure = function(options) {
  var instance = new this();
  instance.apiKey         = options["apiKey"];
  instance.applicationId  = options["applicationId"];
  instance.environment    = options["environment"] || instance.environment;

  return instance;
};

Errplane.prototype.handleUncaughtExceptions = function() {
  var _this = this;
  process.on('uncaughtException', function(exception) {
    _this.enqueueException(exception);
  });
};

Errplane.prototype.report = function(name, options) {
  options = options || {}

  this._enqueue({
    name: name,
    value: options["value"],
    timestamp: options["timestamp"],
    context: options["context"]
  })
}

Errplane.prototype.heartbeat = function(name, interval, options) {
  _this = this
  setInterval(function() {
    _this._log("heartbeating after " + interval + "ms " + Date.now() % 1000000 / 1000)
    _this.report(name, options);
  }, interval);
}

Errplane.prototype.time = function(name, f, context) {
  var timedFunction = function() {
    var start, end, result;

    context = context || this;
    start = Date.now();
    result = f.apply(context, arguments);
    var elapsed = Date.now() - start;
    _this.report(name, {
      value: elapsed
    })
    return result;
  };
  return timedFunction;
};

Errplane.prototype.timeAsync = function(name, f, context) {
  _this = this;
  var slice = Array.prototype.slice,

  timedFunction = function() {
    var args = slice.call(arguments), start, end, callback, timedCallback;
    context = context || this;
    callback = args.pop();
    timedCallback = function() {
      var elapsed = Date.now() - start;
      _this.report(name, {
        value: elapsed
      })
    }

    args.push(timedCallback);
    start = Date.now();
    result = f.apply(context, args);
  };
  return timedFunction;
};

Errplane.prototype._setTimeout = function() {
  this._log("setTimeout")

  if (!this.timer) {
    _this = this
    this.timer = setTimeout(function () {
      _this._post();
    }, this.postTimeout)
  }
}

Errplane.prototype._clearTimeout = function() {
  this._log("clearTimeout")

  if (this.timer) {
    clearTimeout(this.timer);
  }
  this.timer = null;
}

Errplane.prototype._enqueue = function(point) {
  if (this.queue.length >= this.maxQueueSize) {
    return;
  }

  this.queue.push(point);

  if (this.queue.length >= this.maxPostSize) {
    this._post();
  }

  this._setTimeout();
}

Errplane.prototype.enqueueException = function(exception) {
  this._log(exception)

  backtrace = stackTrace.parse(exception).map(function(line) {
    return [line.getFunctionName(), line.getFileName(), line.getLineNumber()].join(" ");
  });

  hash = sha1(exception.name + backtrace[0])

  point = {
    name: "exceptions/" + hash,
    context: {}
  }

  this._enqueue(point);

  this._log(hash)
  this._log(exception.name)
  this._log(exception.message)
  this._log(backtrace[0])
}

Errplane.prototype._flush = function() {
  this._log("Flushing");
  while (this.queue.length > 0) {
    this._post();
  }
}

Errplane.prototype._post = function() {
  var lines = [];

  this._log("post")
  this._clearTimeout();

  if (this.queue.length == 0) { return; }

  while ((this.queue.length > 0) && (lines.length <= this.maxPostSize)) {
    point = this.queue.pop();
    point["value"] = point["value"] || 1;
    point["timestamp"] = point["timestamp"] || "now";
    point["context"] = point["context"];
    line = [point["name"], point["value"], point["timestamp"]].join(" ")
    if (point["context"]) {
      line += " " + new Buffer(point["context"]).toString("base64");
    }
    lines.push(line);
  }

  body = lines.join("\n")
  this._log("Starting POST:\n" + body)

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

  request(options, function(err, res, body) {
    console.log("[Errplane] POST succeeded.")
  })
}

Errplane.prototype._log = function(message) {
  console.log("[Errplane]", message);
}

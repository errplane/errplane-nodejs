var fs = require("fs");
var os = require("os");
var stackTrace = require("stack-trace");
var queue = require("./queue");
var util = require("util");
var dgram = require('dgram');
var Buffer = require('buffer').Buffer;

function Errplane() {
  this.environment = process.env.NODE_ENV || 'development';
}

Errplane.PACKAGE = (function() {
  var json = fs.readFileSync(__dirname + '/../package.json', 'utf8');
  return JSON.parse(json);
})();

Errplane.configure = function(options) {
  var instance = new this();

  instance.udpClient      = dgram.createSocket("udp4");
  instance.environment    = options["environment"] || instance.environment;
  instance.apiKey         = options["apiKey"];
  instance.applicationId  = options["applicationId"];
  instance.databaseName   = instance.applicationId + instance.environment;

  queue.apiKey         = options["apiKey"];
  queue.databaseName   = instance.databaseName;
  queue.postInterval   = options["postInterval"] || queue.postInterval;
  queue.maxQueueSize   = options["maxQueueSize"] || queue.maxQueueSize;
  queue.maxPostSize    = options["maxPostSize"] || queue.maxPostSize;
  queue.postTimeout    = options["postTimeout"] || queue.postTimeout;
  queue.debug          = options["debug"] || queue.debug;

  return instance;
};

Errplane.prototype.reportUncaughtExceptions = function(die) {
  var self = this;

  process.on('uncaughtException', function(exception) {
    self._enqueueException(exception);

    if (die) {
      process.exit(1);
    }
  });
};

Errplane.prototype.expressExceptionHandler = function() {
  var self = this;

  return function exceptionHandler(exception, request, response, next) {
    util.log("[Errplane] Caught Exception.");

    if (response.statusCode < 400) response.statusCode = 500;
    exception.request_url = request.url;
    exception.action = request.method;
    exception.params = request.params;
    exception.session_data = request.session;
    exception.user_agent = request.headers["user-agent"];

    self._enqueueException(exception);
    next(exception);
  }
}

Errplane.prototype.reportException = function(exception) {
  this._enqueueException(exception);
}

Errplane.prototype.expressResponseTimeReporter = function() {
  var self = this;

  return function(request, response, next){
    var start = Date.now();
    var writeHead = response.writeHead;

    if (response._responseTime) return next();
    response._responseTime = true;

    response.writeHead = function(status, headers) {
      var duration = Date.now() - start;

      if (request.route != null) {
        var path = (request.route.path == "/") ? "index" : request.route.path;
        var dimensions = { method: path, server: os.hostname() }

        self.aggregate("controllers", {
          value: Date.now() - start,
          dimensions: dimensions
        });
      }

      response.writeHead = writeHead;
      response.writeHead(status, headers);
    }

    next();
  };
};

Errplane.prototype.report = function(name, options, udp) {
  options = options || {};
  udp = udp || false;

  queue.push({
    name: name,
    value: options["value"],
    timestamp: options["timestamp"],
    dimensions: options["dimensions"],
    context: options["context"]
  });
}

Errplane.prototype._formatData = function(name, options) {
  var point = {};

  point["v"] = options["value"] || 1;

  if (options["timestamp"] != null) {
    point["t"] = options["timestamp"];
  }

  if (options["context"] != null) {
    point["c"] = JSON.stringify(options["context"]);
  }

  if (options["dimensions"] != null) {
    point["d"] = options["dimensions"];
  }

  return {n: name, p: [point]};
}

Errplane.prototype.aggregate = function(name, options) {
  var data = this._formatData(name, options || {});
  this.udp(data, "t");
}

Errplane.prototype.sum = function(name, options) {
  var data = this._formatData(name, options || {});
  this.udp(data, "c");
}

Errplane.prototype.udp = function(data, operator) {
  operator = operator || "r";

  var packet = {
    d: this.databaseName,
    a: this.apiKey,
    o: operator,
    w: [data]
  }

  packet = JSON.stringify(packet)

  util.log("[Errplane] Sending UDP Packet: " + packet);
  var buf = new Buffer(packet);

  this.udpClient.send(buf, 0, buf.length, 8126, "udp.apiv3.errplane.com")
}

Errplane.prototype.heartbeat = function(name, interval, options) {
  var self = this;
  setInterval(function() {
    self.report(name, options);
  }, interval);
}

Errplane.prototype.timeSync = function(name, f, context) {
  var self = this;
  var timedFunction = function() {
    var start, end, result;

    context = context || this;
    start = Date.now();
    result = f.apply(context, arguments);
    var elapsed = Date.now() - start;
    self.report(name, {
      value: elapsed
    })
    return result;
  };
  return timedFunction;
};

Errplane.prototype.timeAsync = function(name, f, context) {
  var self = this;
  var slice = Array.prototype.slice;

  var timedFunction = function() {
    var args = slice.call(arguments), start, end, callback, timedCallback;
    context = context || this;
    callback = args.pop();
    timedCallback = function() {
      var elapsed = Date.now() - start;
      self.report(name, {
        value: elapsed
      })
    }

    args.push(timedCallback);
    start = Date.now();
    result = f.apply(context, args);
  };

  return timedFunction;
};

Errplane.prototype.flush = function() {
  queue.flush();
};

Errplane.prototype._enqueueException = function(exception) {
  var context = this._formatException(exception);
  var dimensions = {};

  dimensions["class"] = exception.name;
  dimensions["server"] = os.hostname();
  dimensions["status"] = "open";
  dimensions["method"] = exception.request_url;

  var point = {
    name: "exceptions",
    context: context,
    dimensions: dimensions
  }

  queue.push(point);
}

Errplane.prototype._formatException = function(exception) {
  var context = {}

  var backtrace = stackTrace.parse(exception).map(function(line) {
    return line.getFunctionName() + " " + line.getFileName() + ":" + line.getLineNumber();
  });

  var request_data = {
    params: (exception.params instanceof Object) ? exception.params : {},
    session_data: (exception.session instanceof Object) ? exception.session : {},
    request_url: exception.request_url || null,
    user_agent: exception.user_agent || null
  }

  context["backtrace"] = backtrace;
  context["hostname"] = os.hostname();
  context["message"] = exception.message;
  context["exception_class"] = exception.name;
  context["request_data"] = request_data;

  return context;
}

module.exports = Errplane;

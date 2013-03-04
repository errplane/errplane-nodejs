var fs = require("fs");
var os = require("os");
var request = require("request");
var stackTrace = require("stack-trace");
var _ = require("underscore");

module.exports = Errplane;

function Errplane() {
  this.apiKey = null;

  this.host = 'http://' + os.hostname();
  this.environment = process.env.NODE_ENV || 'development';
  this.applicationKey = null;
  this.projectRoot = null;
  this.appVersion = null;
  this.timeout = 30 * 1000;

  this.apiHost = "apiv2.errplane.com";
}

Errplane.PACKAGE = (function() {
  var json = fs.readFileSync(__dirname + '/../package.json', 'utf8');
  return JSON.parse(json);
})();

Errplane.initialize = function(apiKey, applicationKey, environment) {
  var instance = new this();
  instance.apiKey = apiKey;
  instance.applicationKey = applicationKey;
  instance.environment = environment || instance.environment;
  return instance;
};

Errplane.prototype.enqueueException = function(exception) {
  console.log("[Errplane]", exception)
  this.postException(exception);
}

Errplane.prototype.reportExceptions = function() {
  var _this = this;
  process.on('uncaughtException', function(exception) {
    _this.enqueueException(exception);
  });
};

Errplane.prototype.postException = function(exception) {
  backtrace = _.map(stackTrace.parse(exception), function(line) {
    return [line.getFunctionName(), line.getFileName(), line.getLineNumber()].join(" ");
  });

  hash = Base64.encode(exception.name + backtrace[0])
  body = "exceptions/" + hash + " 1 now"

  console.log(hash)
  console.log(exception.name)
  console.log(exception.message)
  console.log(backtrace)

  var options = {
    method: "POST",
    url: "https://apiv2.errplane.com/databases/" + this.applicationKey + this.environment + "/points?api_key=" + this.apiKey,
    body: body,
    timeout: 3000,
    headers: {
      'Content-Length': body.length,
      'Content-Type': 'text/plain',
    },
  }
  console.log(options)
  request(options, function(err, res, body) {
    console.log(err)
    console.log(res)
    console.log(body)
  })
}

/**
*
*  Base64 encode / decode
*  http://www.webtoolkit.info/
*
**/
var Base64 = {

  // private property
  _keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

  // public method for encoding
  encode : function (input) {
    var output = "";
    var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    var i = 0;

    input = Base64._utf8_encode(input);

    while (i < input.length) {

      chr1 = input.charCodeAt(i++);
      chr2 = input.charCodeAt(i++);
      chr3 = input.charCodeAt(i++);

      enc1 = chr1 >> 2;
      enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
      enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
      enc4 = chr3 & 63;

      if (isNaN(chr2)) {
        enc3 = enc4 = 64;
      } else if (isNaN(chr3)) {
        enc4 = 64;
      }

      output = output +
        this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) +
        this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);

    }

    return output;
  },

  // public method for decoding
  decode : function (input) {
    var output = "";
    var chr1, chr2, chr3;
    var enc1, enc2, enc3, enc4;
    var i = 0;

    input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

    while (i < input.length) {

      enc1 = this._keyStr.indexOf(input.charAt(i++));
      enc2 = this._keyStr.indexOf(input.charAt(i++));
      enc3 = this._keyStr.indexOf(input.charAt(i++));
      enc4 = this._keyStr.indexOf(input.charAt(i++));

      chr1 = (enc1 << 2) | (enc2 >> 4);
      chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      chr3 = ((enc3 & 3) << 6) | enc4;

      output = output + String.fromCharCode(chr1);

      if (enc3 != 64) {
        output = output + String.fromCharCode(chr2);
      }
      if (enc4 != 64) {
        output = output + String.fromCharCode(chr3);
      }

    }

    output = Base64._utf8_decode(output);

    return output;

  },

  // private method for UTF-8 encoding
  _utf8_encode : function (string) {
    string = string.replace(/\r\n/g,"\n");
    var utftext = "";

    for (var n = 0; n < string.length; n++) {

      var c = string.charCodeAt(n);

      if (c < 128) {
        utftext += String.fromCharCode(c);
      }
      else if((c > 127) && (c < 2048)) {
        utftext += String.fromCharCode((c >> 6) | 192);
        utftext += String.fromCharCode((c & 63) | 128);
      }
      else {
        utftext += String.fromCharCode((c >> 12) | 224);
        utftext += String.fromCharCode(((c >> 6) & 63) | 128);
        utftext += String.fromCharCode((c & 63) | 128);
      }

    }

    return utftext;
  },

  // private method for UTF-8 decoding
  _utf8_decode : function (utftext) {
    var string = "";
    var i = 0;
    var c = c1 = c2 = 0;

    while ( i < utftext.length ) {

      c = utftext.charCodeAt(i);

      if (c < 128) {
        string += String.fromCharCode(c);
        i++;
      }
      else if((c > 191) && (c < 224)) {
        c2 = utftext.charCodeAt(i+1);
        string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
        i += 2;
      }
      else {
        c2 = utftext.charCodeAt(i+1);
        c3 = utftext.charCodeAt(i+2);
        string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
        i += 3;
      }

    }

    return string;
  }

}

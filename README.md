# Errplane

A Node.js library for reporting exceptions, metrics, and performance data to [https://errplane.com](Errplane).

## Installation

``` bash
npm install errplane
```

## Configuration

Load and configure the Errplane object:

``` javascript
var errplane = require('errplane').configure({
  apiKey: "1234-5678-abcdefgh-wxyz",
  applicationId: "a1b2c3d4"
});
```

## Reporting Exceptions

First, you can tell Errplane to start reporting uncaught exceptions:

``` javascript
errplane.reportUncaughtExceptions();
```

Note that the library will reraise these exceptions after they're reported, so your application will still crash afterwards.

## Metrics and Instrumentation

### Reporting Values

``` javascript
errplane.report("queue_depth", {value: queue.length});
```

### Heartbeats

``` javascript
errplane.heartbeat("background_worker", 5000);
```

### Timing Synchronous Functions

``` javascript
syncThing = function() {
  // perform complex calculation here
}

timedSyncThing = errplane.timeSync("sync_thing_runtime", syncThing)
value = timedSyncThing();
```

### Timing Asynchronous Functions

``` javascript
asyncThing = function(value, callback) {
  setTimeout(function () {
    callback(value);
  }, 100)
}

timedAsyncThing = errplane.timeAsync("async_thing_runtime", asyncThing);

timedAsyncThing(99, function(value) {
  console.log(value)
})
```
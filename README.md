# Errplane

A Node.js library for reporting exceptions, metrics, and performance data to [Errplane](https://errplane.com).

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
## Usage with Express

This library has built-in support for Express. Currently, it supplies middleware that can report exceptions and basic performance data.

### Reporting Exceptions

Before you call app.listen(...), insert the Errplane exception middleware as follows:

``` javascript
app.use(errplane.expressExceptionHandler());
```

### Reporting Request Response Time

``` javascript
app.use(errplane.expressResponseTimeReporter());
```

## Reporting A Single Exception

``` javascript
try {
  // do something risky
}
catch(exception) {
  errplane.reportException(exception);

  // do some other stuff to handle the exception
}
```

## Reporting All Generic Exceptions

First, you can tell Errplane to start reporting uncaught exceptions:

``` javascript
errplane.reportUncaughtExceptions();
```

Note that the library will not reraise these exceptions by default after they're reported. If you'd like your application to die
afterwards (the normal behavior for uncaught exceptions), you can do the following:

``` javascript
errplane.reportUncaughtExceptions(true);
```

## Reporting All Generic Exceptions with Cluster

Ensure that the following line gets run both in the cluster master and workers:

``` javascript
errplane.reportClusterUncaughtExceptions();
```

This will catch an exception in the cluster worker, which will pass it back to the master to post to errplane.  If you aren't catching uncaughtException yourself, afterwards the worker will die. (and get restarted by cluster)


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

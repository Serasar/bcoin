/*!
 * tcp.js - tcp backend for bcoin
 * Copyright (c) 2014-2016, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var EventEmitter = require('events').EventEmitter;
var net = require('net');
var tcp = exports;

tcp.createSocket = function createSocket(port, host, proxy) {
  return net.connect(port, host);
};

tcp.createServer = function createServer() {
  var server = new net.Server();
  var ee = new EventEmitter();

  ee.listen = function listen(port, host) {
    return new Promise(function(resolve, reject) {
      server.listen(port, host, wrap(resolve, reject));
    });
  };

  ee.close = function close() {
    return new Promise(function(resolve, reject) {
      server.close(wrap(resolve, reject));
    });
  };

  ee.address = function address() {
    return server.address();
  };

  server.on('listening', function() {
    ee.emit('listening');
  });

  server.on('connection', function(socket) {
    ee.emit('connection', socket);
  });

  server.on('error', function(err) {
    ee.emit('error', err);
  });

  return ee;
};

function wrap(resolve, reject) {
  return function(err, result) {
    if (err) {
      reject(err);
      return;
    }
    resolve(result);
  };
}

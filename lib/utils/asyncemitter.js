/*!
 * asyncemitter.js - event emitter which resolves promises.
 * Copyright (c) 2014-2016, Christopher Jeffrey (MIT License).
 * https://github.com/bcoin-org/bcoin
 */

'use strict';

var assert = require('assert');
var co = require('./co');

/**
 * Represents a promise-resolving event emitter.
 * @see EventEmitter
 * @constructor
 */

function AsyncEmitter() {
  if (!(this instanceof AsyncEmitter))
    return new AsyncEmitter();

  this._events = Object.create(null);
}

/**
 * Add a listener.
 * @param {String} type
 * @param {Function} handler
 */

AsyncEmitter.prototype.addListener = function addListener(type, handler) {
  return this._push(type, handler, false);
};

/**
 * Add a listener.
 * @param {String} type
 * @param {Function} handler
 */

AsyncEmitter.prototype.on = function on(type, handler) {
  return this.addListener(type, handler);
};

/**
 * Add a listener to execute once.
 * @param {String} type
 * @param {Function} handler
 */

AsyncEmitter.prototype.once = function once(type, handler) {
  return this._push(type, handler, true);
};

/**
 * Prepend a listener.
 * @param {String} type
 * @param {Function} handler
 */

AsyncEmitter.prototype.prependListener = function prependListener(type, handler) {
  return this._unshift(type, handler, false);
};

/**
 * Prepend a listener to execute once.
 * @param {String} type
 * @param {Function} handler
 */

AsyncEmitter.prototype.prependOnceListener = function prependOnceListener(type, handler) {
  return this._unshift(type, handler, true);
};

/**
 * Push a listener.
 * @private
 * @param {String} type
 * @param {Function} handler
 * @param {Boolean} once
 */

AsyncEmitter.prototype._push = function _push(type, handler, once) {
  assert(typeof type === 'string', '`type` must be a string.');

  if (!this._events[type])
    this._events[type] = [];

  this._events[type].push(new Listener(handler, once));

  this.tryEmit('newListener', type, handler);
};

/**
 * Unshift a listener.
 * @param {String} type
 * @param {Function} handler
 * @param {Boolean} once
 */

AsyncEmitter.prototype._unshift = function _unshift(type, handler, once) {
  assert(typeof type === 'string', '`type` must be a string.');

  if (!this._events[type])
    this._events[type] = [];

  this._events[type].unshift(new Listener(handler, once));

  this.tryEmit('newListener', type, handler);
};

/**
 * Remove a listener.
 * @param {String} type
 * @param {Function} handler
 */

AsyncEmitter.prototype.removeListener = function removeListener(type, handler) {
  var i, listeners, listener;
  var index = -1;

  assert(typeof type === 'string', '`type` must be a string.');

  listeners = this._events[type];

  if (!listeners)
    return;

  for (i = 0; i < listeners.length; i++) {
    listener = listeners[i];
    if (listener.handler === handler) {
      index = i;
      break;
    }
  }

  if (index === -1)
    return;

  listeners.splice(index, 1);

  if (listeners.length === 0)
    delete this._events[type];

  this.tryEmit('removeListener', type, handler);
};

/**
 * Set max listeners.
 * @param {Number} max
 */

AsyncEmitter.prototype.setMaxListeners = function setMaxListeners(max) {
  assert(typeof max === 'number', '`max` must be a number.');
  assert(max >= 0, '`max` must be non-negative.');
  assert(max % 1 === 0, '`max` must be an integer.');
};

/**
 * Remove all listeners.
 * @param {String?} type
 */

AsyncEmitter.prototype.removeAllListeners = function removeAllListeners(type) {
  if (arguments.length === 0) {
    this._events = Object.create(null);
    return;
  }

  assert(typeof type === 'string', '`type` must be a string.');

  delete this._events[type];
};

/**
 * Get listeners array.
 * @param {String} type
 * @returns {Function[]}
 */

AsyncEmitter.prototype.listeners = function listeners(type) {
  var i, listeners, listener;
  var result = [];

  assert(typeof type === 'string', '`type` must be a string.');

  listeners = this._events[type];

  if (!listeners)
    return result;

  for (i = 0; i < listeners.length; i++) {
    listener = listeners[i];
    result.push(listener.handler);
  }

  return result;
};

/**
 * Get listener count for an event.
 * @param {String} type
 */

AsyncEmitter.prototype.listenerCount = function listenerCount(type) {
  var listeners;

  assert(typeof type === 'string', '`type` must be a string.');

  listeners = this._events[type];

  if (!listeners)
    return 0;

  return listeners.length;
};

/**
 * Emit an event. Wait for promises to resolve.
 * @param {String} type
 * @param {...Object} args
 * @returns {Promise}
 */

AsyncEmitter.prototype.emit = co(function* emit(type) {
  var i, j, listeners, error, err, args, listener, handler;

  assert(typeof type === 'string', '`type` must be a string.');

  listeners = this._events[type];

  if (!listeners || listeners.length === 0) {
    if (type === 'error') {
      error = arguments[1];

      if (error instanceof Error)
        throw error;

      err = new Error('Uncaught, unspecified "error" event. (' + error + ')');
      err.context = error;
      throw err;
    }
    return;
  }

  for (i = 0; i < listeners.length; i++) {
    listener = listeners[i];
    handler = listener.handler;

    if (listener.once) {
      listeners.splice(i, 1);
      i--;
    }

    switch (arguments.length) {
      case 1:
        yield handler();
        break;
      case 2:
        yield handler(arguments[1]);
        break;
      case 3:
        yield handler(arguments[1], arguments[2]);
        break;
      case 4:
        yield handler(arguments[1], arguments[2], arguments[3]);
        break;
      default:
        if (!args) {
          args = new Array(arguments.length - 1);
          for (j = 1; j < arguments.length; j++)
            args[j - 1] = arguments[j];
        }
        yield handler.apply(null, args);
        break;
    }
  }
});

/**
 * Emit an event. Ignore rejections.
 * @param {String} type
 * @param {...Object} args
 * @returns {Promise}
 */

AsyncEmitter.prototype.tryEmit = co(function* tryEmit() {
  try {
    yield this.emit.apply(this, arguments);
  } catch (e) {
    ;
  }
});

/**
 * Event Listener
 * @constructor
 * @param {Function} handler
 * @param {Boolean} once
 * @property {Function} handler
 * @property {Boolean} once
 */

function Listener(handler, once) {
  assert(typeof handler === 'function', '`handler` must be a function.');
  assert(typeof once === 'boolean', '`once` must be a function.');
  this.handler = handler;
  this.once = once;
}

/*
 * Expose
 */

module.exports = AsyncEmitter;

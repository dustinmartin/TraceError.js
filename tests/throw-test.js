'use strict';

var TraceError = require('../');
var assert = require('assert');
var fs = require('fs');
var path = require('path');

describe('TraceError', function () {
  it('should be able to access the properties via. toJSON', function () {
    var err = new TraceError('sup');
    assert.deepEqual(Object.keys(err.toJSON()).sort(), ['stack', 'name', 'message'].sort());
    TraceError.Exception.searchPrototype = true;
    assert.deepEqual(Object.keys(err.toJSON()).sort(), ['stack', 'name', 'message'].sort());
    TraceError.Exception.searchPrototype = false;
  });

  it('should assign the constructor name', function () {
    assert.equal(new TraceError('sup').name, 'TraceError');
  });

  it('should chain multiple errors across different levels', function () {
    try {
      try {
        throw new TraceError('Test error', Error('Test cause'), {error: 'test'});
      } catch (e) {
        throw new TraceError('Captured', {test: 5}, e);
      }
    } catch (e) {
      assert.deepEqual(e.messages(), ['Captured', {test: 5}, 'Test error', 'Test cause', {error: 'test'}]);
      assert.equal(e.message, 'Captured');
      assert.equal(e.cause().test, 5);
      assert.equal(e.cause(1).message, 'Test error');
      assert.equal(e.cause(1).cause().message, 'Test cause');
      assert.equal(e.cause(1).cause(1).error, 'test');
    }
  });

  it('should show type info', function () {
    assert.equal(new TraceError() instanceof TraceError, true);
    assert.equal(new TraceError() instanceof TraceError.Exception, true);
    assert.equal(new TraceError() instanceof Error, true);
  });

  it('should use a custom stack by modifying Error prototype', function () {
    Object.defineProperty(Error.prototype, 'customStack', {
      configurable: true,
      get: function () {
        return this.message;
      }
    });

    TraceError.globalStackProperty = 'customStack';

    try {
      try {
        throw new TraceError('Test error', Error('Test cause'), {error: 'test'});
      } catch (e) {
        throw new TraceError('Captured', {test: 5}, e);
      }
    } catch (e) {
      assert.equal(e.stack, fs.readFileSync(path.join(__dirname, 'custom-stack-1.txt'), 'utf8'));
    }
  });

  it('should use a custom stack by modifying Error prototype; should not cause stack overflow', function () {
    Object.defineProperty(Error.prototype, 'customStack', {
      configurable: true,
      get: function () {
        return this.stack.split('\n')[0];
      }
    });

    TraceError.globalStackProperty = 'customStack';

    try {
      try {
        throw new TraceError('Test error', Error('Test cause'), {error: 'test'});
      } catch (e) {
        throw new TraceError('Captured', {test: 5}, e);
      }
    } catch (e) {
      assert.equal(e.stack, fs.readFileSync(path.join(__dirname, 'custom-stack-2.txt'), 'utf8'));
    }

    // restore
    TraceError.globalStackProperty = 'stack';
  });

  it('should extend TraceError using classical inheritance and modify the stack appropriately', function () {
    function MyError() {
      TraceError.apply(this, arguments);
    }

    MyError.prototype = Object.create(TraceError.prototype);
    MyError.prototype.constructor = MyError;

    Object.defineProperty(MyError.prototype, 'stack', {
      get: function () {
        return Object.getOwnPropertyDescriptor(Object.getPrototypeOf(MyError.prototype), 'stack')
                     .get
                     .call(this)
                     .split('\n')[0];
      }
    });

    assert.equal(new MyError() instanceof MyError, true);
    assert.equal(new MyError('Cat dog').name, 'MyError');
    assert.equal(new MyError('lol').stack, 'MyError: lol');
  });

  it('should extend TraceError using classical inheritance and modify the stack with custom stack', function () {
    Object.defineProperty(Error.prototype, 'customStack', {
      configurable: true,
      get: function () {
        return 'YoloCat';
      }
    });

    function CodeError(code) {
      TraceError.apply(this, arguments);

      // add a code property
      this.defineHiddenProperty('code', code);
    }

    CodeError.prototype = Object.create(TraceError.prototype);
    CodeError.prototype.constructor = CodeError;

    CodeError.prototype.code = function () {
      return this.getHiddenProperty('code');
    };

    Object.defineProperty(CodeError.prototype, 'stack', {
      get: function () {
        return this.code() + ': ' +
          Object.getOwnPropertyDescriptor(Object.getPrototypeOf(CodeError.prototype), 'stack')
                .get
                .call(this)
                .split('\n')[0];
      }
    });

    TraceError.globalStackProperty = 'customStack';

    assert.equal(new CodeError() instanceof CodeError, true);
    assert.equal(new CodeError('Cat dog').name, 'CodeError');
    assert.equal(new CodeError('lol').stack, 'lol: YoloCat');
    assert.equal(new CodeError('lol').customStack, 'YoloCat');

    TraceError.globalStackProperty = 'stack';
  });
});

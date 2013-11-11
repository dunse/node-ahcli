var request = require('request');
var async = require('async');
var prompt = require('prompt');
prompt.message = 'Enter'.green;

module.exports = {
  config: {
    url: undefined
  },
  api: {},

  setUrl: function(url) {
    this.config.url = url;
  },
  request: function (path, opts, cb) {
    if (typeof opts === 'function') {
      cb = opts;
      opts = {};
    }
    var defaults = function (name, value) {
      if (!opts.hasOwnProperty(name)) {
        opts[name] = value;
      }
    };
    defaults('url', this.config.url + '/' + path);

    defaults('json', true);
    if (opts.hasOwnProperty('body')) {
      opts.method = 'POST';
    } else {
      opts.method = 'GET';
    }

    opts.headers = opts.headers || {};
    opts.headers.referer = this.config.url + '/';
    var response = {};
    var retryrequest = true, attempts = 0;
    async.until(
      function() { return attempts++ > 2 || !retryrequest },
      function(callback) {
        request(opts, function (err, res) {
          if (err) {
            return callback(err, res);
          }
          response = res;
          if ([400, 500, 502, 503].indexOf(res.statusCode) >= 0) {
            retryrequest = false;
            return callback('Request failed (' + res.statusCode + ')');
          }
          if ([403].indexOf(res.statusCode) >= 0) {
            retryrequest = false;
            return callback('Forbidden (' + res.statusCode + ')');
          }
          if ([401].indexOf(res.statusCode) < 0) { // For all other response codes, return
            retryrequest = false;
            return callback(err);
          }
          console.log('Authentication required');
          retryrequest = true;
          prompt.get({properties: { username: { required: true }, password: {hidden: true} } }, function (err, result) {
            if (err) {
              retryrequest = false;
              return callback(err);
            } else {
              opts.auth = {
                user: result.username,
                pass: result.password,
                sendImmediately: true
              }
            }
            callback();
          });
        });
      },
      function(err) {
        cb(err, response);
      }
    )
  },
  init: function (config, next) {
    var self = this;
    self.config = config;
    self.request('', function (err, res) {
      if (err) { return next(err); }
      var actions = res.body.documentation;
      Object.keys(actions).forEach(function (key) {
        var versions = actions[key];
        Object.keys(versions).forEach(function(version) {
          self.api[key] = {
            required: actions[key][version].inputs.required,
            optional: actions[key][version].inputs.optional,
            description: actions[key][version].description
          };
        })
      });
      next(err);
    });
  },
  run: function (command, args, next) {
    var self = this;

    self.request(command, {qs: args}, function (err, res) {
      if (err) { return next(err); }
      if (res.body.error) { return next(res.body.error); }

      delete res.body.serverInformation;
      delete res.body.requestorInformation;

      next(err, res);
    });
  },
  testUrl: function(url, next) {
    var self = this;
    self.setUrl(url);
    self.request('', function (err, res) {
      if (!err && res.statusCode !== 200) {
        err = res.statusCode;
      }
      next(err);
    });

  }
};
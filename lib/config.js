var fs = require('fs');
var async = require('async');
var client = require(__dirname + '/client');
var prompt = require('prompt');
prompt.message = 'Enter'.green;

var config = {
    configFile: process.env.HOME + '/.ahcli.json',
    config: {
      url: undefined
    },
    loadConfig: function (next) {
      var self = this;
      if (!fs.existsSync(self.configFile)) {
        return self.initConfigFile(next);
      }
      self.loadConfigFile(next);
    },
    loadConfigFile: function (next) {
      var self = this;
      fs.readFile(self.configFile, function (err, data) {
        if (err) {
          return next(err);
        }
        try {
          self.config = JSON.parse(data);
        } catch (e) {
          console.log('ERROR: Could not parse config file ' + self.configFile + ': ' + e);
          process.exit(1);
        }
        next(null)
      });
    },
    initConfigFile: function (next) {
      var self = this;
      self.getActionHeroUrl(function (err) {
        if (err) {
          return next(err);
        }
        // Create initial config file
        fs.writeFile(self.configFile, JSON.stringify(self.config, null, '\t'), function () {
          self.loadConfigFile(next);
        });
      })
    },
    getActionHeroUrl: function (next) {
      var self = this;
      var attempts = 0;
      prompt.start();
      async.until(
        function () {
          return self.config.url !== undefined || attempts++ > 2;
        },
        function (callback) {
          prompt.get(['actionHeroURL'], function (err, result) {
            if (err) {
              return callback(err);
            }
            client.testUrl(result.actionHeroURL, function(err) {
              if (err) {
                console.log('ERROR: Incorrect URL: ' + err);
              } else {
                self.config.url = result.actionHeroURL;
              }
              callback();
            })
          });
        }, function (err) {
          if (!self.config.url) {
            err = 'Could not determine actionHero URL';
          }
          next(err);
        }
      );
    }
};
module.exports = config;

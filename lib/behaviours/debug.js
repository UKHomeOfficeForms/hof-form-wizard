'use strict';
/* eslint no-process-env:0 no-console:0, consistent-return:0 */

const chalk = require('chalk');
const debug = level => {
  const filter = process.env.HOF_DEBUG || process.env.DEBUG || 'hof-debug:all';
  if (filter === 'hof-debug:all' || level.indexOf(filter) === 0) {
    console.log('\n');
    console.log(chalk.green(level));
    return function log() {
      console.log.apply(console, arguments);
    };
  }
  return () => {};
};


module.exports = superclass => class Debugger extends superclass {

  constructor(options) {
    const log = debug(`hof-debug:constructor:${options.route.replace('/', '')}`);
    log(`Controller mounted on route: ${options.route}`);
    super(options);
    log(this.options);
  }

  _configure(req, res, next) {
    const log = debug(`hof-debug:${req.method.toLowerCase()}:configure`);
    log(chalk.yellow('_configure'));
    super._configure(req, res, err => {
      if (err) {
        return next(err);
      }
      log(req.form.options);
      next();
    });
  }

  _getValues(req, res, next) {
    const log = debug(`hof-debug:${req.method.toLowerCase()}:getvalues`);
    log(chalk.yellow('_getValues'));
    super._getValues(req, res, err => {
      if (err) {
        return next(err);
      }
      log(req.form.values);
      next();
    });
  }

  render(req, res, next) {
    const log = debug(`hof-debug:${req.method.toLowerCase()}:render`);
    log(chalk.yellow('render'));
    log(`Rendering template: ${req.form.options.template}`);
    log(res.locals);
    super.render(req, res, next);
  }

  _process(req, res, next) {
    const log = debug(`hof-debug:${req.method.toLowerCase()}:process`);
    log(chalk.yellow('_process'));
    super._process(req, res, err => {
      if (err) {
        return next(err);
      }
      log(req.form.values);
      next();
    });
  }

  _validate(req, res, next) {
    const log = debug(`hof-debug:${req.method.toLowerCase()}:validate`);
    log(chalk.yellow('_validate'));
    super._validate(req, res, err => {
      if (err) {
        log('Failed validation');
        log(err);
        return next(err);
      }
      log('Passed validation');
      next();
    });
  }

  validateField(key, req, validator, formatter) {
    const log = debug(`hof-debug:${req.method.toLowerCase()}:validate:${key}`);
    log(chalk.yellow('validateField'));
    log(`field: ${key}`);
    log(`value: ${req.form.values[key]}`);
    const result = super.validateField(key, req, validator, formatter);
    if (result) {
      log('result: 💩');
    } else {
      log('result: 👌');
    }
    log('\n');
    return result;
  }

  _saveValues(req, res, next) {
    const log = debug(`hof-debug:${req.method.toLowerCase()}:savevalues`);
    log(chalk.yellow('_saveValues'));
    super._saveValues(req, res, err => {
      if (err) {
        return next(err);
      }
      log(req.form.values);
      next();
    });
  }

  _successHandler(req, res, next) {
    const log = debug(`hof-debug:${req.method.toLowerCase()}:successhandler`);
    log(chalk.yellow('_successHandler'));
    super._successHandler(req, res, err => {
      if (err) {
        return next(err);
      }
      next();
    });
  }

};

'use strict';

const _ = require('lodash');
const debug = require('debug')('hof:progress-check');
const helpers = require('../util/helpers');

module.exports = (route, controller, steps, start) => {
  start = start || '/';
  const previousSteps = helpers.getRouteSteps(route, steps);
  const prereqs = (controller.options.prereqs || []).concat(previousSteps);

  const invalidatingFields = _.pickBy(controller.options.fields, field => {
    return field && field.invalidates && field.invalidates.length;
  });

  const getAllPossibleSteps = (stepName, scopedSteps, allSteps) => {
    allSteps = allSteps || [stepName];
    let step = scopedSteps[stepName];
    const forksReducer = (arr, fork) => getAllPossibleSteps(fork, scopedSteps, allSteps);
    // don't loop over steps that have already been added
    while (step && step.next && allSteps.indexOf(step.next) === -1) {
      allSteps.push(step.next);
      // ignore forks that have already been traversed.
      const forks = _.difference(_.map(step.forks, 'target'), allSteps);
      allSteps = allSteps.concat(forks.reduce(forksReducer, []));
      step = scopedSteps[step.next];
    }
    return _.uniq(allSteps);
  };

  const invalidateStep = (stepName, scopedSteps, sessionModel) => {
    debug('Invalidating', stepName);
    const step = scopedSteps[stepName] || {};
    sessionModel.unset(step.fields || []);
    sessionModel.set('steps', _.without(sessionModel.get('steps'), stepName));
  };

  // detect if a path will arrive back at the current step if followed
  const isLoop = (target, current) => {
    return getAllPossibleSteps(target, steps).indexOf(current) > -1;
  };

  const invalidatePath = (req, res) => {

    let nextStep = controller.getForkTarget(req, res);

    const forks = controller.options.forks.map(fork => fork.target);

    let potentialPaths = [controller.options.next].concat(forks);
    // do not invalidate forks which loop back to the current step and are *not* being followed
    potentialPaths = potentialPaths.filter(path => path === nextStep || !isLoop(path, req.path));
    // if we're following a loop then allow the loop to be invalidated
    const whitelist = isLoop(nextStep, req.path) ? [] : getAllPossibleSteps(nextStep, steps);
    // aggregate all potential journeys from the invalidating step
    const invalidateSteps = potentialPaths.reduce((arr, step) => {
      return arr.concat(getAllPossibleSteps(step, steps));
    }, []);

    _.difference(_.uniq(invalidateSteps), whitelist).forEach(step => {
      invalidateStep(step, steps, req.sessionModel);
    });
  };

  controller.on('complete', (req, res, path) => {
    let sessionsteps = req.sessionModel.get('steps') || [];
    path = path || route;
    debug('Marking path complete ', path);
    const index = sessionsteps.indexOf(path);
    if (index > -1) {
      sessionsteps.splice(index, 1);
    }
    if (path === start) {
      sessionsteps = [];
    }
    sessionsteps.push(path);
    req.sessionModel.set('steps', sessionsteps);

    if (req.method === 'POST' && controller.options.forks) {
      invalidatePath(req, res);
    }
  });

  return (req, res, next) => {
    _.each(invalidatingFields, (field, key) => {
      req.sessionModel.on('change:' + key, () => {
        debug('Unsetting fields %s', field.invalidates.join(', '));
        req.sessionModel.unset(field.invalidates);
      });
    });

    const visited = _.intersection(req.sessionModel.get('steps'), prereqs);

    debug('Steps ', req.sessionModel.get('steps'));
    debug('Prereqs ' + prereqs);
    debug('Visited ' + visited);
    if (visited.length || !prereqs.length || route === start) {
      next();
    } else {
      const err = new Error('Missing prerequisite');
      err.code = 'MISSING_PREREQ';
      next(err);
    }
  };
};

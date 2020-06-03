# hof-form-wizard

Creates routing and request handling for a multi-step form process.

Given a set of form steps and field definitions, the wizard function will create an express router with routing bound to each step of the form and input validation applied as configured.

Additional checks are also applied to ensure a user completes the form in the correct order.

## Usage

Define a set of steps:

```javascript
// steps.js
module.exports = {
  '/step1': {
    next: '/step2'
  },
  '/step2': {
    next: '/step3',
    fields: ['name']
  },
  '/step3': {
    next: '/step4',
    fields: ['age']
  },
  '/step4': {}
}
```

Define field rules:

```javascript
// fields.js
module.exports = {
  'name': {
    validate: 'required'
  },
  'age': {
    validate: 'required'
  }
}
```

Create a wizard and bind it as middleware to an app:

```javascript
var wizard = require('hof-form-wizard'),
    steps = require('./steps'),
    fields = require('./fields');

app.use(wizard(steps, fields));
```

## Sessions

The wizard expects some kind of session to have been created in previous middleware layers.

For production use a database backed session store is recommended - such as [connect-redis](https://github.com/tj/connect-redis).

### Additional step options

The minimum amount of configuration for a wizard step is the `next` property to determine where the user should be taken after completing a step. A number of additional properties can be defined.

* `fields` - specifies which of the fields from the field definition list are applied to this step. Form inputs which are not named on this list will not be processed. Default: `[]`
* `template` - Specifies the template to render for GET requests to this step. Defaults to the route (without trailing slash)
* `backLink` - Specifies the location of the step previous to this one. If not specified then an algorithm is applied which checks the previously visited steps which have the current step set as `next`.
* `behaviours` - A single behaviour, or an array of behaviours to be mixed into the base controller to extend functionality. If an array of behaviours is given, they are applied left-to-right, so calling super in the right-most behaviour will point to the previous behaviour in the array.
* `forks` - Specifies a list of forks that can be taken depending on a particular field value or conditional function - See  [handling forking journeys](https://github.com/UKHomeOffice/passports-form-controller#handles-journey-forking) in hof-form-controller.
* `allowPostComplete` - If set to true allows a step to be accessed after the application has been completed. If not set then accessing this step will reset the session.

### Additional field options

* `invalidates` - an array of field names that will be 'invalidated' when this field value is set or changed. Any fields specified in the `invalidates` array will be removed from the `sessionModel`. Further to this any future steps from the invalidating step field will be removed from the `sessionModel`.

Remaining field options documentation can be found in the hof-template-mixins [README](https://github.com/UKHomeOffice/passports-template-mixins#options-1).

### Additional wizard options

A number of options can be passed to the wizard as a third argument to customise aspects of the behaviour for all steps.

`translate` - provide a function for translating validation error codes into usable messages. Previous implementations have used [i18next](https://www.npmjs.com/package/i18next) to do translations.
`templatePath` - provides the location within `app.get('views')` that templates are stored. Default `pages`.
* `controller` - The constructor for the controller to be used for request handling. The default is an extension of the [hof-form-controller](https://www.npmjs.com/package/hof-form-controller), which is exported as a `Controller` property of this module. If custom behaviour is required for a particular form step then custom extensions can be defined by passing a list of Behaviours - see [Behaviours](#behaviours)
`params` - define a suffix for the routes for supporting additional URL parameters.
`formatters` - defines a standard list of formatters to be applied to all field data. Default: `['trim', 'singlespaces', 'hyphens']` - see [formatters.js](https://github.com/UKHomeOfficeForms/hof-form-controller/blob/master/lib/formatting/formatters.js) for a list of available formatters.

### Behaviours

Creating a behaviour:

```js
// behaviour-one.js

module.exports = SuperClass => class extends SuperClass {
  getValues(req, res, callback) {
    super.getValues(req, res, (err, values) => {
      if (err) {
        return callback(err);
      }
      const errorValues = req.sessionModel.get('errorValues') || {};
      return callback(null, Object.assign({}, values, errorValues))
    });
  }
}
```

```js
//index.js
const app = require('express')();
const Wizard = require('hof-form-wizard')
const BehaviourOne = require('./behaviours/behaviour-one')
const BehaviourTwo = require('./behaviours/behaviour-two')

app.use(Wizard({
  '/': {
    behaviours: [BehaviourOne, BehaviourTwo]
  }
}, {}, {}));
```

### Predefined behaviours

Some behaviours are built-in to the Wizard, and can be declared by passing a string as a behaviour.

These are:

* `complete` - if applied to a step then this step will mark the application as complete. The user will then have their session reset if they attempt to access any step of the form. The `next` step of a completing step will always be accessible following completion. Any other steps which should also be accessible on a complete session should have their `allowPostComplete` option set to `true`.

```js
//index.js
const app = require('express')();
const Wizard = require('hof-form-wizard')

app.use(Wizard({
  ...
  '/confirm-submission': {
    behaviours: ['complete'],
    next: '/finished'
  },
  '/finished': {},
  '/download-receipt': {
    allowPostComplete: true
  }
}, {}, {}));
```

* `debug` - if applied to a step then debugging information will be output to the console through the request pipeline. The debug output can be filtered by setting a `HOF_DEBUG` environment variable. e.g. to output debug information only for POST requests, set the debug environment to `hof-debug:post`.


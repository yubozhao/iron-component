/*****************************************************************************/
/* Imports */
/*****************************************************************************/
var extend = Iron.utils.extend;
var debug = Iron.utils.debug('iron-component');
var camelCase = Iron.utils.camelCase;
var defaultValue = Iron.utils.defaultValue;
var assert = Iron.utils.assert;
var DynamicTemplate = Iron.DynamicTemplate;
var extend = Iron.utils.extend;

/*****************************************************************************/
/* Private */
/*****************************************************************************/
var registerComponentHelper = function (name, Comp) {
  var tmpl = new Template(name, function () {
    var opts = Component.getInclusionArguments(this);
    var content = this.templateContentBlock;
    var elseContent = this.templateElseBlock;
    var instance = new Comp(_.extend(opts || {}, {
      content: content,
      elseContent: elseContent
    }));
    return instance.create();
  });

  UI.registerHelper(name, tmpl);
};

var typeOf = function (value) {
  return Object.prototype.toString.call(value);
};

/*****************************************************************************/
/* Component */
/*****************************************************************************/
Component = extend(DynamicTemplate, {
  constructor: function (options) {
    var self = this;
    DynamicTemplate.prototype.constructor.apply(this, arguments);
    this.state = new ReactiveDict;
    this._isComponent = true;
    this.events(this.constructor._eventMap, this);

    _.each(this.constructor._hooks, function (callbacks, hook) {
      _.each(callbacks, function (cb) { self[hook](cb); });
    });

    this.init(this.options);
  }
});

Component.prototype.init = function (options) {};

Component.prototype.create = function () {
  var view = DynamicTemplate.prototype.create.apply(this, arguments);
  // set ourselves as a lookup host
  this._setLookupHost(this);
  return view;
};

Component.prototype.lookupTemplate = function () {
  var self = this;
  var template = this.constructor.template;
  var tmpl = null;

  // is it a template name like "MyTemplate"?
  if (typeof template === 'string') {
    tmpl = Template[template];

    if (!tmpl)
      // as a fallback double check the user didn't actually define
      // a camelCase version of the template.
      tmpl = Template[camelCase(template)];

    if (!tmpl)
      throw new Error("Couldn't find a template named " + JSON.stringify(template) + " or " + JSON.stringify(camelCase(template))+ ". Are you sure you defined it?");

    tmpl = Spacebars.include(
      tmpl,
      function contentBlock () { return self.options.content; },
      function elseBlock () { return self.options.elseContent; }
    );

  } else if (typeOf(template) === '[object Object]') {
    // or maybe a view already?
    tmpl = template;
  } else if (typeof self.options.content !== 'undefined') {
    // or maybe its block content like 
    // {{#DynamicTemplate}}
    //  Some block
    // {{/DynamicTemplate}}
    tmpl = self.options.content;
    tmpl.template = self;
  }

  return tmpl;
};

Component.prototype.renderView = function (template) {
  return this.lookupTemplate();
};

Component.prototype.call = function (prop) {
  var args = _.toArray(arguments).slice(1);
  return this.apply(prop, args);
};

Component.prototype.apply = function (prop, args) {
  var func = Component.lookup(this.view, prop);
  var thisArg = Component.getDataContext(this.view) || {};
  assert(typeof func === 'function', "Couldn't find a function named " + JSON.stringify(prop));
  return func.apply(thisArg, args);
};

Component.prototype.toggleState = function (key) {
  check(key, String);
  var isStateTrue = this.state.equals(key, true);
  this.state.set(key, !isStateTrue); 
};

/*****************************************************************************/
/* Component Static Methods */
/*****************************************************************************/
Component._helpers = {};

Component.helpers = function (helpers) {
  _.extend(this._helpers, helpers);
  return this;
};

Component.template = function (template) {
  this.template = template;
  return this;
};

/**
 * Register a global UI helper for the component.
 */
var hasOwn = function (o, prop) {
  return Object.prototype.hasOwnProperty.call(o, prop);
};

Component.registerHelper = function (name) {
  if (!name && hasOwn(this.prototype, 'name'))
    name = this.prototype.name;
  else if (!name && hasOwn(this, 'name'))
    name = this.name;
  
  if (!name)
    throw new Error("You called registerHelper() for a component that doesn't have a name!");

  registerComponentHelper(name, this);

  return this;
};

/**
 * Allow components to define their own events.
 */
Component.events = function (events) {
  this._eventMap = events;
  return this;
};

_.each(['onViewCreated', 'onViewReady', '_onViewRendered', 'onViewDestroyed'], function (hook) {
  Component[hook] = function (cb) {
    this._hooks = this._hooks || {};
    var hooks = this._hooks[hook] = this._hooks[hook] || [];
    hooks.push(cb);
  };
});

/**
 * Search templates and lookup hosts for a given property. If the property
 * is found the value is returned directly.
 * XXX fix?
 */
Component.lookup = function (view, prop) {
  var template;
  var origView = view;
  var host = DynamicTemplate.findLookupHostWithProperty(view, prop);
  var value;

  if (host)
    return (typeof host[prop] === 'function') ? _.bind(host[prop], host) : host[prop];
  else {
    // search up the template hierarchy looking for the first
    // helper property that matches the prop we're looking for then
    // return its value.
    while (view) {
      if (view.template && view.template.__helpers.has(prop))
        return view.template.__helpers.get(prop);
      else
        view = view.parentView;
    }
  }

  return undefined;
};

Component.lookupProp = function (view, prop) {
  var template;
  var origView = view;
  var host = DynamicTemplate.findLookupHostWithProperty(view, prop);
  var value;

  if (host)
    return (typeof host[prop] === 'function') ? _.bind(host[prop], host) : host[prop];
  else {
    // search up the template hierarchy looking for the first
    // helper property that matches the prop we're looking for then
    // return its value.
    while (view) {
      if (view.template && view.template.__helpers.has(prop)) {
        return view.template.__helpers.get(prop);
      } else if (view.template && view.template[prop]) {
        //XXX this is for something like template.HOME.someProp;
        return view.template[prop];
      } else {
        view = view.parentView;
      }
    }
  }

  return undefined;
};

Component.findFirstComponent = function (view) {
  return DynamicTemplate.findLookupHostWithProperty(view, '_isComponent');
};

/*****************************************************************************/
/* Global Helpers */
/*****************************************************************************/
UI.registerHelper('getState', function (key) {
  var cmp = Component.findFirstComponent(Blaze.getView());
  return cmp.state.get(key);
});

UI.registerHelper('stateValue', function (key) {
  var cmp = Component.findFirstComponent(Blaze.getView());
  return cmp.state.get(key);
});

UI.registerHelper('hasState', function (key) {
  var cmp = Component.findFirstComponent(Blaze.getView());
  return !!cmp.state.get(key);
});

UI.registerHelper('stateEquals', function (key, value) {
  var cmp = Component.findFirstComponent(Blaze.getView());
  return cmp.state.equals(key, value);
});


/*****************************************************************************/
/* Namespacing */
/*****************************************************************************/
Iron.Component = Component;

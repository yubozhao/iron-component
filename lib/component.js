/*****************************************************************************/
/* Imports */
/*****************************************************************************/
var extend = Iron.utils.extend;
var debug = Iron.utils.debug('iron-component');
var camelCase = Iron.utils.camelCase;
var defaultValue = Iron.utils.defaultValue;
var assert = Iron.utils.assert;

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
    return instance.createView();
  });

  UI.registerHelper(name, tmpl);
};

var findFirstComponentOfType = function (type, view) {
  assert(typeof type === 'string', "type must be a string");
  assert(view instanceof Blaze.View, "view must be a Blaze.View");

  while (view) {
    if (view.name === type)
      return view.__component__;
    else
      view = view.parentView;
  }

  return null;
};

var registerComponentMethod = function (method, Comp) {
  var type = Comp.name;
  var helperName = type + '_' + method;

  UI.registerHelper(helperName, function (/* args, options */) {
    var view = Blaze.currentView;

    var cmp = findFirstComponentOfType(type, view);
    assert(cmp, "Couldn't find a component of type " + JSON.stringify(type) + " in view tree.");

    var func = cmp.methods && cmp.methods[method];
    assert(func, "The " + JSON.stringify(type) + " component does not have a method " + JSON.stringify(method) + ".");

    var args = _.toArray(arguments);
    var lastArg = args[args.length - 1];
    var options;


    if (typeOf(lastArg) === '[object Object]') {
      options = args.pop().hash;
      args.push(options);
    }

    return func.apply(cmp, args);
  });
};

var typeOf = function (value) {
  return Object.prototype.toString.call(value);
};

/*****************************************************************************/
/* Component */
/*****************************************************************************/
Component = function (options) {
  this.options = options = options || {};
  this._data = options.data;
  this._dataDep = new Deps.Dependency;
  this._hooks = {};
  this.state = new ReactiveDict;

  // has the Blaze.View been created?
  this.isCreated = false;

  // has the Blaze.View been destroyed and not created again?
  this.isDestroyed = false;

  this.init(this.options);
};

Component.prototype.template = null;

Component.prototype.init = function (options) {};

/**
 * Insert the Layout view into the dom.
 */
Component.prototype.insert = function (options) {
  options = options || {};

  if (this.isInserted)
    return;
  this.isInserted = true;

  var el = options.el || document.body;
  var $el = $(el);

  if ($el.length === 0)
    throw new Error("No element to insert layout into. Is your element defined? Try a Meteor.startup callback.");

  if (!this.view)
    this.createView(options);

  Blaze.render(this.view, $el[0], options.nextNode, options.parentView);
  return this;
};

/**
 * Get or set the data context.
 */
Component.prototype.data = function (value) {
  if (arguments.length === 1 && value !== this._data) {
    this._data = value;
    this._dataDep.changed();
    return;
  }

  this._dataDep.depend();
  return typeof this._data === 'function' ? this._data() : this._data;
};

Component.prototype.createView = function (options) {
  var self = this;

  if (this.isCreated) {
    throw new Error("Component view is already created");
  }

  this.isCreated = true;
  this.isDestroyed = false;

  var view = Blaze.View('Component', function () {
    var thisView = this;

    return Blaze.With(function () {
      // NOTE: This will rerun anytime the data function invalidates this
      // computation OR if created from an inclusion helper (see note below) any
      // time any of the argument functions invlidate the computation. For
      // example, when the template changes this function will rerun also. But
      // it's probably generally ok. The more serious use case is to not
      // re-render the entire template every time the data context changes.
      var result = self.data();

      if (typeof result !== 'undefined')
        // looks like data was set directly on this dynamic template
        return result;
      else
        // return the first parent data context that is not inclusion arguments
        return Component.getParentDataContext(thisView);
    }, function () {
      return self.render();
    });
  });

  // wire up the view lifecycle callbacks
  /*
  _.each(['onCreated', 'onMaterialized', 'onRendered', 'onDestroyed'], function (hook) {
    view[hook](function () {
      // "this" is the view instance
      self._runHooks(hook, this);
    });
  });
  */

  view._onViewRendered(function () {
    // avoid inserting the view twice by accident.
    self.isInserted = true;

    // following the lead of template.js in core
    if (view.renderCount !== 1)
      return;

    _.each(self.constructor._eventMaps, function (m) {
      Blaze._addEventMap(view, m, view);
    });
  });

  view._templateInstance = new Blaze.TemplateInstance(view);
  view.templateInstance = function () {
    // Update data, firstNode, and lastNode, and return the TemplateInstance
    // object.
    var inst = view._templateInstance;

    inst.data = Blaze.getData(view);

    if (view._domrange && !view.isDestroyed) {
      inst.firstNode = view._domrange.firstNode();
      inst.lastNode = view._domrange.lastNode();
    } else {
      // on 'created' or 'destroyed' callbacks we don't have a DomRange
      inst.firstNode = null;
      inst.lastNode = null;
    }

    return inst;
  };

  this.view = view;
  view.__component__ = this;
  // so helper lookup works as expected
  view.template = this;
  view.name = this.constructor.name;

  return view;
};

/**
 * Destroy the component.
 */
Component.prototype.destroy = function () {
  if (this.isCreated) {
    Blaze.remove(this.view);
    this.view = null;
    this.isDestroyed = true;
    this.isCreated = false;
  }
};

Component.prototype.lookupTemplate = function () {
  var self = this;
  var template = this.template;
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

Component.prototype.render = function (options) {
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

/**
 * View lifecycle hooks.
 * XXX update for new blaze
 */
_.each([], function (hook) {
  Component.prototype[hook] = function (cb) {
    var hooks = this._hooks[hook] = this._hooks[hook] || [];
    hooks.push(cb);
    return this;
  };
});

Component.prototype._runHooks = function (name, view) {
  var hooks = this._hooks[name] || [];
  var hook;

  for (var i = 0; i < hooks.length; i++) {
    hook = hooks[i];
    // keep the "thisArg" pointing to the view, but make the first parameter to
    // the callback teh dynamic template instance.
    hook.call(view, this);
  }
};

/*****************************************************************************/
/* Component Static Methods */
/*****************************************************************************/
//XXX how do we use extends with harmony?
//XXX need a way to plug into the extension time or ctor time
Component.create = function (definition) {
  var klass = this.extend(definition);

  if (definition.events) {
    klass.events(definition.events);
    delete definition.events;
  }

  // register helper
  if (definition.name) {
    klass.type = definition.name;
    klass.prototype.type = definition.name;
    registerComponentHelper(definition.name, klass);
  }

  if (definition.methods) {
    _.each(_.keys(definition.methods), function (key) {
      registerComponentMethod(key, klass);
    });
  }

  return klass;
};

Component.methods = function (methodsMap) {
  var self = this;
  var methods = self.prototype.methods = self.prototype.methods || {};
  _.extend(methods, methodsMap);
  _.each(_.keys(methodsMap), function (key) {
    registerComponentMethod(key, self);
  });
};

Component.extend = function (definition) {
  return extend(this, definition);
};

/**
 * Register a global UI helper for the component.
 */
Component.registerHelper = function () {
  check(this.name, String);
  registerComponentHelper(this.name, this);
  return this;
};

// XXX This needs to be rewritten becuase none of this stuff
// works anymore. maybe we can borrow constructView from
// Template.prototype?
Component.events = function (events) {
  var maps = defaultValue(this, '_eventMaps', []);

  var boundMap = {};

  for (var key in events) {
    boundMap[key] = (function (key, handler) {
      return function (e) {
        var view = this; 
        var component = view.__component__;
        var args = Array.prototype.slice.call(arguments);
        var tmplInstance = view.templateInstance();
        return handler.call(component, e, tmplInstance);
      };
    })(key, events[key]);
  }

  maps.push(boundMap);
};

/**
 * Get the first parent data context that are not inclusion arguments
 * (see above function). Note: This function can create reactive dependencies.
 */
Component.getParentDataContext = function (view) {
  return Component.getDataContext(view && view.parentView);
};

Component.getDataContext = function (view) {
  while (view) {
    if (view.name === 'with' && !view.__isTemplateWith)
      return view.dataVar.get();
    else
      view = view.parentView;
  }

  return null;
};


/**
 * Get inclusion arguments, if any, from a view.
 *
 * Uses the __isTemplateWith property set when a parent view is used
 * specificially for a data context with inclusion args.
 *
 * Inclusion arguments are arguments provided in a template like this:
 * {{> yield "inclusionArg"}}
 * or
 * {{> yield region="inclusionArgValue"}}
 */
Component.getInclusionArguments = function (view) {
  var parent = view && view.parentView;

  if (!parent)
    return null;

  if (parent.__isTemplateWith)
    return parent.dataVar.get();

  return null;
};

/**
 * Given a view, return a function that can be used to access argument values at
 * the time the view was rendered. There are two key benefits:
 *
 * 1. Save the argument data at the time of rendering. When you use lookup(...)
 *    it starts from the current data context which can change.
 * 2. Defer creating a dependency on inclusion arguments until later.
 *
 * Example:
 *
 *   {{> MyTemplate template="MyTemplate"
 *   var args = Component.args(view);
 *   var tmplValue = args('template');
 *     => "MyTemplate"
 */
Component.args = function (view) {
  return function (key) {
    var data = Component.getInclusionArguments(view);

    if (data) {
      if (key)
        return data[key];
      else
        return data;
    }

    return null;
  };
};

Component.lookup = function (view, prop) {
  var template;

  while (view) {
    template = view.template;

    if (template && template[prop])
      return template[prop];
    else
      view = view.parentView;
  }

  return undefined;
};

Component.findFirstComponent = function (view) {
  assert(view instanceof Blaze.View, "view must be a Blaze.View");

  while (view) {
    if (view.__component__)
      return view.__component__;
    else
      view = view.parentView;
  }

  return null;
};

/*****************************************************************************/
/* Global Helpers */
/*****************************************************************************/
UI.registerHelper('getState', function (key) {
  var cmp = Component.findFirstComponent(Blaze.getView());
  return cmp.state.get(key);
});

/*****************************************************************************/
/* Namespacing */
/*****************************************************************************/
Iron.Component = Component;

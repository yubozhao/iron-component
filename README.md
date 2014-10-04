Iron.Component
===============================================================
A Component base class for building UI widgets. This is an alpha project and
will very likely be replaced by a core package at some point. For this reason,
it is not published to Atmosphere. Use with caution, but maybe we can use this
to generate some ideas!

TODO: Update to work with METEOR@0.9.1

### Examples

```javascript
Form = Component.extend({
  init: function (opts) {
    this._errors = new Meteor.Collection(null);
  },
  
  renderView: function () {
    var view = self.lookupTemplate();
    return HTML.FORM(this.options, view);
  }
});

Form.helpers({
  errors: function () {
    return this._errors.find();
  }
});

Form.events({
 'submit form': function (e) {
    e.preventDefault();
    var values = {someValue: true};

    // call a method named 'submit' somewhere in the view hierarchy
    this.call('submit', e, values, form);
  }
});
```

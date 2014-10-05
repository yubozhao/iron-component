Iron.Component
===============================================================
A Component base class for building UI widgets.

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

Form.registerHelper();
```

Component = Iron.Component;

Form = Component.create({
  name: 'Form',

  init: function (options) {
    this._errors = new Meteor.Collection(null);
    this._errors.insert({error: 'one'});
    this._errors.insert({error: 'two'});
  },

  methods: {
    errors: function () {
      console.log(arguments);
      return this._errors.find();
    }
  },

  events: {
    'submit form': function (e) {
      e.preventDefault();
      var values = {title: 'boom'};
      var form = {}
      this.call('submit', e, values, form);
    }
  },

  render: function () {
    var self = this;
    var view = self.lookupTemplate();
    return HTML.FORM(this.options, view);
  }
});

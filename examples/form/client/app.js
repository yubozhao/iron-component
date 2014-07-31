UI.body.data = { title: "hello world" };

Template.Page.submit = function (e, values, form) {
  console.log('submit!');
  console.log(arguments);
  console.log(this);
};

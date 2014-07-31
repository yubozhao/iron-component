Package.describe({
  summary: 'UI Component base class',
  version: "0.1.0"
});

Package.on_use(function (api) {
  api.use('underscore');
  api.use('jquery')
  api.use('deps');
  api.use('templating');
  api.use('ui');
  api.use('blaze');

  api.use('iron-core');
  api.imply('iron-core');

  api.add_files('lib/component.js');
});

Package.on_test(function (api) {
});

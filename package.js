Package.describe({
  summary: 'UI Component base class',
  version: "1.0.0-pre0",
  git: "https://github.com/eventedmind/iron-component"
});

Package.on_use(function (api) {
  api.versionsFrom('METEOR@0.9.2-rc0');
  api.use('underscore');
  api.use('jquery')
  api.use('tracker');
  api.use('templating');
  api.use('blaze');
  api.use('check');
  api.use('reactive-dict');

  api.use('iron:core@1.0.0-pre0');
  api.imply('iron:core');

  api.add_files('lib/component.js', 'client');
});

Package.on_test(function (api) {
  api.use('iron:component');
  api.use('templating');
  api.use('tinytest');
  api.use('test-helpers');
  api.use('blaze');
  api.use('tracker');

  api.add_files('test/component_test.html', 'client');
  api.add_files('test/component_test.js', 'client');
});

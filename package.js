Package.describe({
  summary: 'UI Component base class',
  version: "0.1.0",
  git: "https://github.com/eventedmind/iron-component"
});

Package.on_use(function (api) {
  api.versionsFrom('METEOR@0.9.1-rc2');
  api.use('underscore');
  api.use('jquery')
  api.use('tracker');
  api.use('templating');
  api.use('blaze');

  api.use('iron:core@0.3.2');
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

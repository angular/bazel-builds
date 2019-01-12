/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 *
 * @fileoverview Schematics for ng-new project that builds with Bazel.
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("angular/packages/bazel/src/schematics/ng-new/index", ["require", "exports", "tslib", "@angular-devkit/schematics", "@angular-devkit/core", "@schematics/angular/utility/json-utils", "@schematics/angular/utility/validation", "@schematics/angular/utility/config"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var schematics_1 = require("@angular-devkit/schematics");
    var core_1 = require("@angular-devkit/core");
    var json_utils_1 = require("@schematics/angular/utility/json-utils");
    var validation_1 = require("@schematics/angular/utility/validation");
    var config_1 = require("@schematics/angular/utility/config");
    function addDevDependenciesToPackageJson(options) {
        return function (host) {
            var e_1, _a;
            var packageJson = options.name + "/package.json";
            if (!host.exists(packageJson)) {
                throw new Error("Could not find " + packageJson);
            }
            var packageJsonContent = host.read(packageJson);
            if (!packageJsonContent) {
                throw new Error('Failed to read package.json content');
            }
            var jsonAst = core_1.parseJsonAst(packageJsonContent.toString());
            var deps = json_utils_1.findPropertyInAstObject(jsonAst, 'dependencies');
            var devDeps = json_utils_1.findPropertyInAstObject(jsonAst, 'devDependencies');
            var angularCoreNode = json_utils_1.findPropertyInAstObject(deps, '@angular/core');
            var angularCoreVersion = angularCoreNode.value;
            var devDependencies = {
                '@angular/bazel': angularCoreVersion,
                // TODO(kyliau): Consider moving this to latest-versions.ts
                '@bazel/bazel': '^0.21.0',
                '@bazel/ibazel': '^0.9.0',
                '@bazel/karma': '^0.22.0',
                '@bazel/typescript': '^0.22.0',
            };
            var recorder = host.beginUpdate(packageJson);
            try {
                for (var _b = tslib_1.__values(Object.keys(devDependencies)), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var packageName = _c.value;
                    var version = devDependencies[packageName];
                    var indent = 4;
                    json_utils_1.insertPropertyInAstObjectInOrder(recorder, devDeps, packageName, version, indent);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
            host.commitUpdate(recorder);
            return host;
        };
    }
    function overwriteMainAndIndex(options) {
        return function (host) {
            var newProjectRoot = '';
            try {
                var workspace = config_1.getWorkspace(host);
                newProjectRoot = workspace.newProjectRoot || '';
            }
            catch (_a) {
            }
            var srcDir = newProjectRoot + "/" + options.name + "/src";
            return schematics_1.mergeWith(schematics_1.apply(schematics_1.url('./files'), [
                schematics_1.applyTemplates(tslib_1.__assign({ utils: core_1.strings }, options, { 'dot': '.' })),
                schematics_1.move(srcDir),
            ]), schematics_1.MergeStrategy.Overwrite);
        };
    }
    function overwriteGitignore(options) {
        return function (host) {
            var gitignore = options.name + "/.gitignore";
            if (!host.exists(gitignore)) {
                return host;
            }
            var gitIgnoreContent = host.read(gitignore);
            if (!gitIgnoreContent) {
                throw new Error('Failed to read .gitignore content');
            }
            if (gitIgnoreContent.includes('/bazel-out\n')) {
                return host;
            }
            var lines = gitIgnoreContent.toString().split(/\n/g);
            var recorder = host.beginUpdate(gitignore);
            var compileOutput = lines.findIndex(function (line) { return line === '# compiled output'; });
            recorder.insertRight(compileOutput, '\n/bazel-out');
            host.commitUpdate(recorder);
            return host;
        };
    }
    function replacePropertyInAstObject(recorder, node, propertyName, value, indent) {
        var property = json_utils_1.findPropertyInAstObject(node, propertyName);
        if (property === null) {
            throw new Error("Property " + propertyName + " does not exist in JSON object");
        }
        var start = property.start, text = property.text;
        recorder.remove(start.offset, text.length);
        var indentStr = '\n' +
            ' '.repeat(indent);
        var content = JSON.stringify(value, null, '  ').replace(/\n/g, indentStr);
        recorder.insertLeft(start.offset, content);
    }
    function updateWorkspaceFileToUseBazelBuilder(options) {
        return function (host, context) {
            var name = options.name;
            var workspacePath = name + "/angular.json";
            if (!host.exists(workspacePath)) {
                throw new schematics_1.SchematicsException("Workspace file " + workspacePath + " not found.");
            }
            var workspaceBuffer = host.read(workspacePath);
            var workspaceJsonAst = core_1.parseJsonAst(workspaceBuffer.toString());
            var projects = json_utils_1.findPropertyInAstObject(workspaceJsonAst, 'projects');
            if (!projects) {
                throw new schematics_1.SchematicsException('Expect projects in angular.json to be an Object');
            }
            var project = json_utils_1.findPropertyInAstObject(projects, name);
            if (!project) {
                throw new schematics_1.SchematicsException("Expected projects to contain " + name);
            }
            var recorder = host.beginUpdate(workspacePath);
            var indent = 6;
            replacePropertyInAstObject(recorder, project, 'architect', {
                'build': {
                    'builder': '@angular/bazel:build',
                    'options': { 'targetLabel': '//src:bundle.js', 'bazelCommand': 'build' },
                    'configurations': { 'production': { 'targetLabel': '//src:bundle' } }
                },
                'serve': {
                    'builder': '@angular/bazel:build',
                    'options': { 'targetLabel': '//src:devserver', 'bazelCommand': 'run' },
                    'configurations': { 'production': { 'targetLabel': '//src:prodserver' } }
                },
                'extract-i18n': {
                    'builder': '@angular-devkit/build-angular:extract-i18n',
                    'options': { 'browserTarget': name + ":build" }
                },
                'test': {
                    'builder': '@angular/bazel:build',
                    'options': { 'bazelCommand': 'test', 'targetLabel': '//src/...' }
                },
                'lint': {
                    'builder': '@angular-devkit/build-angular:tslint',
                    'options': {
                        'tsConfig': ['src/tsconfig.app.json', 'src/tsconfig.spec.json'],
                        'exclude': ['**/node_modules/**']
                    }
                }
            }, indent);
            var e2e = options.name + "-e2e";
            var e2eNode = json_utils_1.findPropertyInAstObject(projects, e2e);
            if (e2eNode) {
                replacePropertyInAstObject(recorder, e2eNode, 'architect', {
                    'e2e': {
                        'builder': '@angular/bazel:build',
                        'options': { 'bazelCommand': 'test', 'targetLabel': '//e2e:devserver_test' },
                        'configurations': { 'production': { 'targetLabel': '//e2e:prodserver_test' } }
                    },
                    'lint': {
                        'builder': '@angular-devkit/build-angular:tslint',
                        'options': { 'tsConfig': 'e2e/tsconfig.e2e.json', 'exclude': ['**/node_modules/**'] }
                    }
                }, indent);
            }
            host.commitUpdate(recorder);
            return host;
        };
    }
    function default_1(options) {
        return function (host) {
            validation_1.validateProjectName(options.name);
            return schematics_1.chain([
                schematics_1.externalSchematic('@schematics/angular', 'ng-new', tslib_1.__assign({}, options, { skipInstall: true })),
                addDevDependenciesToPackageJson(options),
                schematics_1.schematic('bazel-workspace', options),
                overwriteMainAndIndex(options),
                overwriteGitignore(options),
                updateWorkspaceFileToUseBazelBuilder(options),
            ]);
        };
    }
    exports.default = default_1;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvc2NoZW1hdGljcy9uZy1uZXcvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCx5REFBK007SUFDL00sNkNBQXFGO0lBQ3JGLHFFQUFpSDtJQUNqSCxxRUFBMkU7SUFDM0UsNkRBQWdFO0lBR2hFLFNBQVMsK0JBQStCLENBQUMsT0FBZTtRQUN0RCxPQUFPLFVBQUMsSUFBVTs7WUFDaEIsSUFBTSxXQUFXLEdBQU0sT0FBTyxDQUFDLElBQUksa0JBQWUsQ0FBQztZQUVuRCxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsRUFBRTtnQkFDN0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxvQkFBa0IsV0FBYSxDQUFDLENBQUM7YUFDbEQ7WUFDRCxJQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDbEQsSUFBSSxDQUFDLGtCQUFrQixFQUFFO2dCQUN2QixNQUFNLElBQUksS0FBSyxDQUFDLHFDQUFxQyxDQUFDLENBQUM7YUFDeEQ7WUFDRCxJQUFNLE9BQU8sR0FBRyxtQkFBWSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsRUFBRSxDQUFrQixDQUFDO1lBQzdFLElBQU0sSUFBSSxHQUFHLG9DQUF1QixDQUFDLE9BQU8sRUFBRSxjQUFjLENBQWtCLENBQUM7WUFDL0UsSUFBTSxPQUFPLEdBQUcsb0NBQXVCLENBQUMsT0FBTyxFQUFFLGlCQUFpQixDQUFrQixDQUFDO1lBRXJGLElBQU0sZUFBZSxHQUFHLG9DQUF1QixDQUFDLElBQUksRUFBRSxlQUFlLENBQUMsQ0FBQztZQUN2RSxJQUFNLGtCQUFrQixHQUFHLGVBQWlCLENBQUMsS0FBZSxDQUFDO1lBRTdELElBQU0sZUFBZSxHQUEwQjtnQkFDN0Ms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QyxDQUFDO1lBRWxDLE9BQU8sa0JBQUssQ0FBQztnQkFDWCw4QkFBaUIsQ0FBQyxxQkFBcUIsRUFBRSxRQUFRLHVCQUM1QyxPQUFPLElBQ1YsV0FBVyxFQUFFLElBQUksSUFDakI7Z0JBQ0YsK0JBQStCLENBQUMsT0FBTyxDQUFDO2dCQUN4QyxzQkFBUyxDQUFDLGlCQUFpQixFQUFFLE9BQU8sQ0FBQztnQkFDckMscUJBQXFCLENBQUMsT0FBTyxDQUFDO2dCQUM5QixrQkFBa0IsQ0FBQyxPQUFPLENBQUM7Z0JBQzNCLG9DQUFvQyxDQUFDLE9BQU8sQ0FBQzthQUM5QyxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUM7SUFDSixDQUFDO0lBaEJELDRCQWdCQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKlxuICogQGZpbGVvdmVydmlldyBTY2hlbWF0aWNzIGZvciBuZy1uZXcgcHJvamVjdCB0aGF0IGJ1aWxkcyB3aXRoIEJhemVsLlxuICovXG5cbmltcG9ydCB7U2NoZW1hdGljQ29udGV4dCwgYXBwbHksIGFwcGx5VGVtcGxhdGVzLCBjaGFpbiwgZXh0ZXJuYWxTY2hlbWF0aWMsIE1lcmdlU3RyYXRlZ3ksIG1lcmdlV2l0aCwgbW92ZSwgUnVsZSwgc2NoZW1hdGljLCBUcmVlLCB1cmwsIFNjaGVtYXRpY3NFeGNlcHRpb24sIFVwZGF0ZVJlY29yZGVyLH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L3NjaGVtYXRpY3MnO1xuaW1wb3J0IHtwYXJzZUpzb25Bc3QsIEpzb25Bc3RPYmplY3QsIHN0cmluZ3MsIEpzb25WYWx1ZX0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHtmaW5kUHJvcGVydHlJbkFzdE9iamVjdCwgaW5zZXJ0UHJvcGVydHlJbkFzdE9iamVjdEluT3JkZXJ9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS9qc29uLXV0aWxzJztcbmltcG9ydCB7dmFsaWRhdGVQcm9qZWN0TmFtZX0gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L3ZhbGlkYXRpb24nO1xuaW1wb3J0IHtnZXRXb3Jrc3BhY2V9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS9jb25maWcnO1xuaW1wb3J0IHtTY2hlbWF9IGZyb20gJy4vc2NoZW1hJztcblxuZnVuY3Rpb24gYWRkRGV2RGVwZW5kZW5jaWVzVG9QYWNrYWdlSnNvbihvcHRpb25zOiBTY2hlbWEpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgY29uc3QgcGFja2FnZUpzb24gPSBgJHtvcHRpb25zLm5hbWV9L3BhY2thZ2UuanNvbmA7XG5cbiAgICBpZiAoIWhvc3QuZXhpc3RzKHBhY2thZ2VKc29uKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgZmluZCAke3BhY2thZ2VKc29ufWApO1xuICAgIH1cbiAgICBjb25zdCBwYWNrYWdlSnNvbkNvbnRlbnQgPSBob3N0LnJlYWQocGFja2FnZUpzb24pO1xuICAgIGlmICghcGFja2FnZUpzb25Db250ZW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byByZWFkIHBhY2thZ2UuanNvbiBjb250ZW50Jyk7XG4gICAgfVxuICAgIGNvbnN0IGpzb25Bc3QgPSBwYXJzZUpzb25Bc3QocGFja2FnZUpzb25Db250ZW50LnRvU3RyaW5nKCkpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgY29uc3QgZGVwcyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGpzb25Bc3QsICdkZXBlbmRlbmNpZXMnKSBhcyBKc29uQXN0T2JqZWN0O1xuICAgIGNvbnN0IGRldkRlcHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChqc29uQXN0LCAnZGV2RGVwZW5kZW5jaWVzJykgYXMgSnNvbkFzdE9iamVjdDtcblxuICAgIGNvbnN0IGFuZ3VsYXJDb3JlTm9kZSA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGRlcHMsICdAYW5ndWxhci9jb3JlJyk7XG4gICAgY29uc3QgYW5ndWxhckNvcmVWZXJzaW9uID0gYW5ndWxhckNvcmVOb2RlICEudmFsdWUgYXMgc3RyaW5nO1xuXG4gICAgY29uc3QgZGV2RGVwZW5kZW5jaWVzOiB7W2s6IHN0cmluZ106IHN0cmluZ30gPSB7XG4gICAgICAnQGFuZ3VsYXIvYmF6ZWwnOiBhbmd1bGFyQ29yZVZlcnNpb24sXG4gICAgICAvLyBUT0RPKGt5bGlhdSk6IENvbnNpZGVyIG1vdmluZyB0aGlzIHRvIGxhdGVzdC12ZXJzaW9ucy50c1xuICAgICAgJ0BiYXplbC9iYXplbCc6ICdeMC4yMS4wJyxcbiAgICAgICdAYmF6ZWwvaWJhemVsJzogJ14wLjkuMCcsXG4gICAgICAnQGJhemVsL2thcm1hJzogJ14wLjIyLjAnLFxuICAgICAgJ0BiYXplbC90eXBlc2NyaXB0JzogJ14wLjIyLjAnLFxuICAgIH07XG5cbiAgICBjb25zdCByZWNvcmRlciA9IGhvc3QuYmVnaW5VcGRhdGUocGFja2FnZUpzb24pO1xuICAgIGZvciAoY29uc3QgcGFja2FnZU5hbWUgb2YgT2JqZWN0LmtleXMoZGV2RGVwZW5kZW5jaWVzKSkge1xuICAgICAgY29uc3QgdmVyc2lvbiA9IGRldkRlcGVuZGVuY2llc1twYWNrYWdlTmFtZV07XG4gICAgICBjb25zdCBpbmRlbnQgPSA0O1xuICAgICAgaW5zZXJ0UHJvcGVydHlJbkFzdE9iamVjdEluT3JkZXIocmVjb3JkZXIsIGRldkRlcHMsIHBhY2thZ2VOYW1lLCB2ZXJzaW9uLCBpbmRlbnQpO1xuICAgIH1cbiAgICBob3N0LmNvbW1pdFVwZGF0ZShyZWNvcmRlcik7XG4gICAgcmV0dXJuIGhvc3Q7XG4gIH07XG59XG5cbmZ1bmN0aW9uIG92ZXJ3cml0ZU1haW5BbmRJbmRleChvcHRpb25zOiBTY2hlbWEpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgbGV0IG5ld1Byb2plY3RSb290ID0gJyc7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHdvcmtzcGFjZSA9IGdldFdvcmtzcGFjZShob3N0KTtcbiAgICAgIG5ld1Byb2plY3RSb290ID0gd29ya3NwYWNlLm5ld1Byb2plY3RSb290IHx8ICcnO1xuICAgIH0gY2F0Y2gge1xuICAgIH1cbiAgICBjb25zdCBzcmNEaXIgPSBgJHtuZXdQcm9qZWN0Um9vdH0vJHtvcHRpb25zLm5hbWV9L3NyY2A7XG5cbiAgICByZXR1cm4gbWVyZ2VXaXRoKFxuICAgICAgICBhcHBseShcbiAgICAgICAgICAgIHVybCgnLi9maWxlcycpLFxuICAgICAgICAgICAgW1xuICAgICAgICAgICAgICBhcHBseVRlbXBsYXRlcyh7XG4gICAgICAgICAgICAgICAgdXRpbHM6IHN0cmluZ3MsXG4gICAgICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgICAgICAnZG90JzogJy4nLFxuICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgbW92ZShzcmNEaXIpLFxuICAgICAgICAgICAgXSksXG4gICAgICAgIE1lcmdlU3RyYXRlZ3kuT3ZlcndyaXRlKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gb3ZlcndyaXRlR2l0aWdub3JlKG9wdGlvbnM6IFNjaGVtYSkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUpID0+IHtcbiAgICBjb25zdCBnaXRpZ25vcmUgPSBgJHtvcHRpb25zLm5hbWV9Ly5naXRpZ25vcmVgO1xuICAgIGlmICghaG9zdC5leGlzdHMoZ2l0aWdub3JlKSkge1xuICAgICAgcmV0dXJuIGhvc3Q7XG4gICAgfVxuICAgIGNvbnN0IGdpdElnbm9yZUNvbnRlbnQgPSBob3N0LnJlYWQoZ2l0aWdub3JlKTtcbiAgICBpZiAoIWdpdElnbm9yZUNvbnRlbnQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIHJlYWQgLmdpdGlnbm9yZSBjb250ZW50Jyk7XG4gICAgfVxuXG4gICAgaWYgKGdpdElnbm9yZUNvbnRlbnQuaW5jbHVkZXMoJy9iYXplbC1vdXRcXG4nKSkge1xuICAgICAgcmV0dXJuIGhvc3Q7XG4gICAgfVxuICAgIGNvbnN0IGxpbmVzID0gZ2l0SWdub3JlQ29udGVudC50b1N0cmluZygpLnNwbGl0KC9cXG4vZyk7XG4gICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKGdpdGlnbm9yZSk7XG4gICAgY29uc3QgY29tcGlsZU91dHB1dCA9IGxpbmVzLmZpbmRJbmRleCgobGluZTogc3RyaW5nKSA9PiBsaW5lID09PSAnIyBjb21waWxlZCBvdXRwdXQnKTtcbiAgICByZWNvcmRlci5pbnNlcnRSaWdodChjb21waWxlT3V0cHV0LCAnXFxuL2JhemVsLW91dCcpO1xuICAgIGhvc3QuY29tbWl0VXBkYXRlKHJlY29yZGVyKTtcblxuICAgIHJldHVybiBob3N0O1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChcbiAgICByZWNvcmRlcjogVXBkYXRlUmVjb3JkZXIsIG5vZGU6IEpzb25Bc3RPYmplY3QsIHByb3BlcnR5TmFtZTogc3RyaW5nLCB2YWx1ZTogSnNvblZhbHVlLFxuICAgIGluZGVudDogbnVtYmVyKSB7XG4gIGNvbnN0IHByb3BlcnR5ID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3Qobm9kZSwgcHJvcGVydHlOYW1lKTtcbiAgaWYgKHByb3BlcnR5ID09PSBudWxsKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBQcm9wZXJ0eSAke3Byb3BlcnR5TmFtZX0gZG9lcyBub3QgZXhpc3QgaW4gSlNPTiBvYmplY3RgKTtcbiAgfVxuICBjb25zdCB7c3RhcnQsIHRleHR9ID0gcHJvcGVydHk7XG4gIHJlY29yZGVyLnJlbW92ZShzdGFydC5vZmZzZXQsIHRleHQubGVuZ3RoKTtcbiAgY29uc3QgaW5kZW50U3RyID0gJ1xcbicgK1xuICAgICAgJyAnLnJlcGVhdChpbmRlbnQpO1xuICBjb25zdCBjb250ZW50ID0gSlNPTi5zdHJpbmdpZnkodmFsdWUsIG51bGwsICcgICcpLnJlcGxhY2UoL1xcbi9nLCBpbmRlbnRTdHIpO1xuICByZWNvcmRlci5pbnNlcnRMZWZ0KHN0YXJ0Lm9mZnNldCwgY29udGVudCk7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZVdvcmtzcGFjZUZpbGVUb1VzZUJhemVsQnVpbGRlcihvcHRpb25zOiBTY2hlbWEpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgY29uc3Qge25hbWV9ID0gb3B0aW9ucztcbiAgICBjb25zdCB3b3Jrc3BhY2VQYXRoID0gYCR7bmFtZX0vYW5ndWxhci5qc29uYDtcbiAgICBpZiAoIWhvc3QuZXhpc3RzKHdvcmtzcGFjZVBhdGgpKSB7XG4gICAgICB0aHJvdyBuZXcgU2NoZW1hdGljc0V4Y2VwdGlvbihgV29ya3NwYWNlIGZpbGUgJHt3b3Jrc3BhY2VQYXRofSBub3QgZm91bmQuYCk7XG4gICAgfVxuICAgIGNvbnN0IHdvcmtzcGFjZUJ1ZmZlciA9IGhvc3QucmVhZCh3b3Jrc3BhY2VQYXRoKSAhO1xuICAgIGNvbnN0IHdvcmtzcGFjZUpzb25Bc3QgPSBwYXJzZUpzb25Bc3Qod29ya3NwYWNlQnVmZmVyLnRvU3RyaW5nKCkpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgY29uc3QgcHJvamVjdHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdCh3b3Jrc3BhY2VKc29uQXN0LCAncHJvamVjdHMnKTtcbiAgICBpZiAoIXByb2plY3RzKSB7XG4gICAgICB0aHJvdyBuZXcgU2NoZW1hdGljc0V4Y2VwdGlvbignRXhwZWN0IHByb2plY3RzIGluIGFuZ3VsYXIuanNvbiB0byBiZSBhbiBPYmplY3QnKTtcbiAgICB9XG4gICAgY29uc3QgcHJvamVjdCA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KHByb2plY3RzIGFzIEpzb25Bc3RPYmplY3QsIG5hbWUpO1xuICAgIGlmICghcHJvamVjdCkge1xuICAgICAgdGhyb3cgbmV3IFNjaGVtYXRpY3NFeGNlcHRpb24oYEV4cGVjdGVkIHByb2plY3RzIHRvIGNvbnRhaW4gJHtuYW1lfWApO1xuICAgIH1cbiAgICBjb25zdCByZWNvcmRlciA9IGhvc3QuYmVnaW5VcGRhdGUod29ya3NwYWNlUGF0aCk7XG4gICAgY29uc3QgaW5kZW50ID0gNjtcbiAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChcbiAgICAgICAgcmVjb3JkZXIsIHByb2plY3QgYXMgSnNvbkFzdE9iamVjdCwgJ2FyY2hpdGVjdCcsIHtcbiAgICAgICAgICAnYnVpbGQnOiB7XG4gICAgICAgICAgICAnYnVpbGRlcic6ICdAYW5ndWxhci9iYXplbDpidWlsZCcsXG4gICAgICAgICAgICAnb3B0aW9ucyc6IHsndGFyZ2V0TGFiZWwnOiAnLy9zcmM6YnVuZGxlLmpzJywgJ2JhemVsQ29tbWFuZCc6ICdidWlsZCd9LFxuICAgICAgICAgICAgJ2NvbmZpZ3VyYXRpb25zJzogeydwcm9kdWN0aW9uJzogeyd0YXJnZXRMYWJlbCc6ICcvL3NyYzpidW5kbGUnfX1cbiAgICAgICAgICB9LFxuICAgICAgICAgICdzZXJ2ZSc6IHtcbiAgICAgICAgICAgICdidWlsZGVyJzogJ0Bhbmd1bGFyL2JhemVsOmJ1aWxkJyxcbiAgICAgICAgICAgICdvcHRpb25zJzogeyd0YXJnZXRMYWJlbCc6ICcvL3NyYzpkZXZzZXJ2ZXInLCAnYmF6ZWxDb21tYW5kJzogJ3J1bid9LFxuICAgICAgICAgICAgJ2NvbmZpZ3VyYXRpb25zJzogeydwcm9kdWN0aW9uJzogeyd0YXJnZXRMYWJlbCc6ICcvL3NyYzpwcm9kc2VydmVyJ319XG4gICAgICAgICAgfSxcbiAgICAgICAgICAnZXh0cmFjdC1pMThuJzoge1xuICAgICAgICAgICAgJ2J1aWxkZXInOiAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXI6ZXh0cmFjdC1pMThuJyxcbiAgICAgICAgICAgICdvcHRpb25zJzogeydicm93c2VyVGFyZ2V0JzogYCR7bmFtZX06YnVpbGRgfVxuICAgICAgICAgIH0sXG4gICAgICAgICAgJ3Rlc3QnOiB7XG4gICAgICAgICAgICAnYnVpbGRlcic6ICdAYW5ndWxhci9iYXplbDpidWlsZCcsXG4gICAgICAgICAgICAnb3B0aW9ucyc6IHsnYmF6ZWxDb21tYW5kJzogJ3Rlc3QnLCAndGFyZ2V0TGFiZWwnOiAnLy9zcmMvLi4uJ31cbiAgICAgICAgICB9LFxuICAgICAgICAgICdsaW50Jzoge1xuICAgICAgICAgICAgJ2J1aWxkZXInOiAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXI6dHNsaW50JyxcbiAgICAgICAgICAgICdvcHRpb25zJzoge1xuICAgICAgICAgICAgICAndHNDb25maWcnOiBbJ3NyYy90c2NvbmZpZy5hcHAuanNvbicsICdzcmMvdHNjb25maWcuc3BlYy5qc29uJ10sXG4gICAgICAgICAgICAgICdleGNsdWRlJzogWycqKi9ub2RlX21vZHVsZXMvKionXVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgaW5kZW50KTtcblxuICAgIGNvbnN0IGUyZSA9IGAke29wdGlvbnMubmFtZX0tZTJlYDtcbiAgICBjb25zdCBlMmVOb2RlID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QocHJvamVjdHMgYXMgSnNvbkFzdE9iamVjdCwgZTJlKTtcbiAgICBpZiAoZTJlTm9kZSkge1xuICAgICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QoXG4gICAgICAgICAgcmVjb3JkZXIsIGUyZU5vZGUgYXMgSnNvbkFzdE9iamVjdCwgJ2FyY2hpdGVjdCcsIHtcbiAgICAgICAgICAgICdlMmUnOiB7XG4gICAgICAgICAgICAgICdidWlsZGVyJzogJ0Bhbmd1bGFyL2JhemVsOmJ1aWxkJyxcbiAgICAgICAgICAgICAgJ29wdGlvbnMnOiB7J2JhemVsQ29tbWFuZCc6ICd0ZXN0JywgJ3RhcmdldExhYmVsJzogJy8vZTJlOmRldnNlcnZlcl90ZXN0J30sXG4gICAgICAgICAgICAgICdjb25maWd1cmF0aW9ucyc6IHsncHJvZHVjdGlvbic6IHsndGFyZ2V0TGFiZWwnOiAnLy9lMmU6cHJvZHNlcnZlcl90ZXN0J319XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgJ2xpbnQnOiB7XG4gICAgICAgICAgICAgICdidWlsZGVyJzogJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyOnRzbGludCcsXG4gICAgICAgICAgICAgICdvcHRpb25zJzogeyd0c0NvbmZpZyc6ICdlMmUvdHNjb25maWcuZTJlLmpzb24nLCAnZXhjbHVkZSc6IFsnKiovbm9kZV9tb2R1bGVzLyoqJ119XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICBpbmRlbnQpO1xuICAgIH1cblxuICAgIGhvc3QuY29tbWl0VXBkYXRlKHJlY29yZGVyKTtcbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24ob3B0aW9uczogU2NoZW1hKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIHZhbGlkYXRlUHJvamVjdE5hbWUob3B0aW9ucy5uYW1lKTtcblxuICAgIHJldHVybiBjaGFpbihbXG4gICAgICBleHRlcm5hbFNjaGVtYXRpYygnQHNjaGVtYXRpY3MvYW5ndWxhcicsICduZy1uZXcnLCB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIHNraXBJbnN0YWxsOiB0cnVlLFxuICAgICAgfSksXG4gICAgICBhZGREZXZEZXBlbmRlbmNpZXNUb1BhY2thZ2VKc29uKG9wdGlvbnMpLFxuICAgICAgc2NoZW1hdGljKCdiYXplbC13b3Jrc3BhY2UnLCBvcHRpb25zKSxcbiAgICAgIG92ZXJ3cml0ZU1haW5BbmRJbmRleChvcHRpb25zKSxcbiAgICAgIG92ZXJ3cml0ZUdpdGlnbm9yZShvcHRpb25zKSxcbiAgICAgIHVwZGF0ZVdvcmtzcGFjZUZpbGVUb1VzZUJhemVsQnVpbGRlcihvcHRpb25zKSxcbiAgICBdKTtcbiAgfTtcbn1cbiJdfQ==
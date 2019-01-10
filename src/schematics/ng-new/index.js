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
                updateWorkspaceFileToUseBazelBuilder(options),
            ]);
        };
    }
    exports.default = default_1;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi4vLi4vLi4vLi4vLi4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9iYXplbC9zcmMvc2NoZW1hdGljcy9uZy1uZXcvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCx5REFBK007SUFDL00sNkNBQXFGO0lBQ3JGLHFFQUFpSDtJQUNqSCxxRUFBMkU7SUFDM0UsNkRBQWdFO0lBR2hFLFNBQVMsK0JBQStCLENBQUMsT0FBZTtRQUN0RCxPQUFPLFVBQUMsSUFBVTs7WUFDaEIsSUFBTSxXQUFXLEdBQU0sT0FBTyxDQUFDLElBQUksa0JBQWUsQ0FBQztZQUVuRCxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsRUFBRTtnQkFDN0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxvQkFBa0IsV0FBYSxDQUFDLENBQUM7YUFDbEQ7WUFDRCxJQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDbEQsSUFBSSxDQUFDLGtCQUFrQixFQUFFO2dCQUN2QixNQUFNLElBQUksS0FBSyxDQUFDLHFDQUFxQyxDQUFDLENBQUM7YUFDeEQ7WUFDRCxJQUFNLE9BQU8sR0FBRyxtQkFBWSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsRUFBRSxDQUFrQixDQUFDO1lBQzdFLElBQU0sSUFBSSxHQUFHLG9DQUF1QixDQUFDLE9BQU8sRUFBRSxjQUFjLENBQWtCLENBQUM7WUFDL0UsSUFBTSxPQUFPLEdBQUcsb0NBQXVCLENBQUMsT0FBTyxFQUFFLGlCQUFpQixDQUFrQixDQUFDO1lBRXJGLElBQU0sZUFBZSxHQUFHLG9DQUF1QixDQUFDLElBQUksRUFBRSxlQUFlLENBQUMsQ0FBQztZQUN2RSxJQUFNLGtCQUFrQixHQUFHLGVBQWlCLENBQUMsS0FBZSxDQUFDO1lBRTdELElBQU0sZUFBZSxHQUEwQjtnQkFDN0MsZ0JBQWdCLEVB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O1lBQzVCLE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVELG1CQUF3QixPQUFlO1FBQ3JDLE9BQU8sVUFBQyxJQUFVO1lBQ2hCLGdDQUFtQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUVsQyxPQUFPLGtCQUFLLENBQUM7Z0JBQ1gsOEJBQWlCLENBQUMscUJBQXFCLEVBQUUsUUFBUSx1QkFDNUMsT0FBTyxJQUNWLFdBQVcsRUFBRSxJQUFJLElBQ2pCO2dCQUNGLCtCQUErQixDQUFDLE9BQU8sQ0FBQztnQkFDeEMsc0JBQVMsQ0FBQyxpQkFBaUIsRUFBRSxPQUFPLENBQUM7Z0JBQ3JDLHFCQUFxQixDQUFDLE9BQU8sQ0FBQztnQkFDOUIsb0NBQW9DLENBQUMsT0FBTyxDQUFDO2FBQzlDLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQztJQUNKLENBQUM7SUFmRCw0QkFlQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKlxuICogQGZpbGVvdmVydmlldyBTY2hlbWF0aWNzIGZvciBuZy1uZXcgcHJvamVjdCB0aGF0IGJ1aWxkcyB3aXRoIEJhemVsLlxuICovXG5cbmltcG9ydCB7U2NoZW1hdGljQ29udGV4dCwgYXBwbHksIGFwcGx5VGVtcGxhdGVzLCBjaGFpbiwgZXh0ZXJuYWxTY2hlbWF0aWMsIE1lcmdlU3RyYXRlZ3ksIG1lcmdlV2l0aCwgbW92ZSwgUnVsZSwgc2NoZW1hdGljLCBUcmVlLCB1cmwsIFNjaGVtYXRpY3NFeGNlcHRpb24sIFVwZGF0ZVJlY29yZGVyLH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L3NjaGVtYXRpY3MnO1xuaW1wb3J0IHtwYXJzZUpzb25Bc3QsIEpzb25Bc3RPYmplY3QsIHN0cmluZ3MsIEpzb25WYWx1ZX0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHtmaW5kUHJvcGVydHlJbkFzdE9iamVjdCwgaW5zZXJ0UHJvcGVydHlJbkFzdE9iamVjdEluT3JkZXJ9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS9qc29uLXV0aWxzJztcbmltcG9ydCB7dmFsaWRhdGVQcm9qZWN0TmFtZX0gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L3ZhbGlkYXRpb24nO1xuaW1wb3J0IHtnZXRXb3Jrc3BhY2V9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS9jb25maWcnO1xuaW1wb3J0IHtTY2hlbWF9IGZyb20gJy4vc2NoZW1hJztcblxuZnVuY3Rpb24gYWRkRGV2RGVwZW5kZW5jaWVzVG9QYWNrYWdlSnNvbihvcHRpb25zOiBTY2hlbWEpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgY29uc3QgcGFja2FnZUpzb24gPSBgJHtvcHRpb25zLm5hbWV9L3BhY2thZ2UuanNvbmA7XG5cbiAgICBpZiAoIWhvc3QuZXhpc3RzKHBhY2thZ2VKc29uKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgZmluZCAke3BhY2thZ2VKc29ufWApO1xuICAgIH1cbiAgICBjb25zdCBwYWNrYWdlSnNvbkNvbnRlbnQgPSBob3N0LnJlYWQocGFja2FnZUpzb24pO1xuICAgIGlmICghcGFja2FnZUpzb25Db250ZW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byByZWFkIHBhY2thZ2UuanNvbiBjb250ZW50Jyk7XG4gICAgfVxuICAgIGNvbnN0IGpzb25Bc3QgPSBwYXJzZUpzb25Bc3QocGFja2FnZUpzb25Db250ZW50LnRvU3RyaW5nKCkpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgY29uc3QgZGVwcyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGpzb25Bc3QsICdkZXBlbmRlbmNpZXMnKSBhcyBKc29uQXN0T2JqZWN0O1xuICAgIGNvbnN0IGRldkRlcHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChqc29uQXN0LCAnZGV2RGVwZW5kZW5jaWVzJykgYXMgSnNvbkFzdE9iamVjdDtcblxuICAgIGNvbnN0IGFuZ3VsYXJDb3JlTm9kZSA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGRlcHMsICdAYW5ndWxhci9jb3JlJyk7XG4gICAgY29uc3QgYW5ndWxhckNvcmVWZXJzaW9uID0gYW5ndWxhckNvcmVOb2RlICEudmFsdWUgYXMgc3RyaW5nO1xuXG4gICAgY29uc3QgZGV2RGVwZW5kZW5jaWVzOiB7W2s6IHN0cmluZ106IHN0cmluZ30gPSB7XG4gICAgICAnQGFuZ3VsYXIvYmF6ZWwnOiBhbmd1bGFyQ29yZVZlcnNpb24sXG4gICAgICAvLyBUT0RPKGt5bGlhdSk6IENvbnNpZGVyIG1vdmluZyB0aGlzIHRvIGxhdGVzdC12ZXJzaW9ucy50c1xuICAgICAgJ0BiYXplbC9iYXplbCc6ICdeMC4yMS4wJyxcbiAgICAgICdAYmF6ZWwva2FybWEnOiAnXjAuMjIuMCcsXG4gICAgICAnQGJhemVsL3R5cGVzY3JpcHQnOiAnXjAuMjIuMCcsXG4gICAgfTtcblxuICAgIGNvbnN0IHJlY29yZGVyID0gaG9zdC5iZWdpblVwZGF0ZShwYWNrYWdlSnNvbik7XG4gICAgZm9yIChjb25zdCBwYWNrYWdlTmFtZSBvZiBPYmplY3Qua2V5cyhkZXZEZXBlbmRlbmNpZXMpKSB7XG4gICAgICBjb25zdCB2ZXJzaW9uID0gZGV2RGVwZW5kZW5jaWVzW3BhY2thZ2VOYW1lXTtcbiAgICAgIGNvbnN0IGluZGVudCA9IDQ7XG4gICAgICBpbnNlcnRQcm9wZXJ0eUluQXN0T2JqZWN0SW5PcmRlcihyZWNvcmRlciwgZGV2RGVwcywgcGFja2FnZU5hbWUsIHZlcnNpb24sIGluZGVudCk7XG4gICAgfVxuICAgIGhvc3QuY29tbWl0VXBkYXRlKHJlY29yZGVyKTtcbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuZnVuY3Rpb24gb3ZlcndyaXRlTWFpbkFuZEluZGV4KG9wdGlvbnM6IFNjaGVtYSkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUpID0+IHtcbiAgICBsZXQgbmV3UHJvamVjdFJvb3QgPSAnJztcbiAgICB0cnkge1xuICAgICAgY29uc3Qgd29ya3NwYWNlID0gZ2V0V29ya3NwYWNlKGhvc3QpO1xuICAgICAgbmV3UHJvamVjdFJvb3QgPSB3b3Jrc3BhY2UubmV3UHJvamVjdFJvb3QgfHwgJyc7XG4gICAgfSBjYXRjaCB7XG4gICAgfVxuICAgIGNvbnN0IHNyY0RpciA9IGAke25ld1Byb2plY3RSb290fS8ke29wdGlvbnMubmFtZX0vc3JjYDtcblxuICAgIHJldHVybiBtZXJnZVdpdGgoXG4gICAgICAgIGFwcGx5KFxuICAgICAgICAgICAgdXJsKCcuL2ZpbGVzJyksXG4gICAgICAgICAgICBbXG4gICAgICAgICAgICAgIGFwcGx5VGVtcGxhdGVzKHtcbiAgICAgICAgICAgICAgICB1dGlsczogc3RyaW5ncyxcbiAgICAgICAgICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAgICAgICAgICdkb3QnOiAnLicsXG4gICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICBtb3ZlKHNyY0RpciksXG4gICAgICAgICAgICBdKSxcbiAgICAgICAgTWVyZ2VTdHJhdGVneS5PdmVyd3JpdGUpO1xuICB9O1xufVxuXG5mdW5jdGlvbiByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChcbiAgICByZWNvcmRlcjogVXBkYXRlUmVjb3JkZXIsIG5vZGU6IEpzb25Bc3RPYmplY3QsIHByb3BlcnR5TmFtZTogc3RyaW5nLCB2YWx1ZTogSnNvblZhbHVlLFxuICAgIGluZGVudDogbnVtYmVyKSB7XG4gIGNvbnN0IHByb3BlcnR5ID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3Qobm9kZSwgcHJvcGVydHlOYW1lKTtcbiAgaWYgKHByb3BlcnR5ID09PSBudWxsKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKGBQcm9wZXJ0eSAke3Byb3BlcnR5TmFtZX0gZG9lcyBub3QgZXhpc3QgaW4gSlNPTiBvYmplY3RgKTtcbiAgfVxuICBjb25zdCB7c3RhcnQsIHRleHR9ID0gcHJvcGVydHk7XG4gIHJlY29yZGVyLnJlbW92ZShzdGFydC5vZmZzZXQsIHRleHQubGVuZ3RoKTtcbiAgY29uc3QgaW5kZW50U3RyID0gJ1xcbicgK1xuICAgICAgJyAnLnJlcGVhdChpbmRlbnQpO1xuICBjb25zdCBjb250ZW50ID0gSlNPTi5zdHJpbmdpZnkodmFsdWUsIG51bGwsICcgICcpLnJlcGxhY2UoL1xcbi9nLCBpbmRlbnRTdHIpO1xuICByZWNvcmRlci5pbnNlcnRMZWZ0KHN0YXJ0Lm9mZnNldCwgY29udGVudCk7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZVdvcmtzcGFjZUZpbGVUb1VzZUJhemVsQnVpbGRlcihvcHRpb25zOiBTY2hlbWEpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgY29uc3Qge25hbWV9ID0gb3B0aW9ucztcbiAgICBjb25zdCB3b3Jrc3BhY2VQYXRoID0gYCR7bmFtZX0vYW5ndWxhci5qc29uYDtcbiAgICBpZiAoIWhvc3QuZXhpc3RzKHdvcmtzcGFjZVBhdGgpKSB7XG4gICAgICB0aHJvdyBuZXcgU2NoZW1hdGljc0V4Y2VwdGlvbihgV29ya3NwYWNlIGZpbGUgJHt3b3Jrc3BhY2VQYXRofSBub3QgZm91bmQuYCk7XG4gICAgfVxuICAgIGNvbnN0IHdvcmtzcGFjZUJ1ZmZlciA9IGhvc3QucmVhZCh3b3Jrc3BhY2VQYXRoKSAhO1xuICAgIGNvbnN0IHdvcmtzcGFjZUpzb25Bc3QgPSBwYXJzZUpzb25Bc3Qod29ya3NwYWNlQnVmZmVyLnRvU3RyaW5nKCkpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgY29uc3QgcHJvamVjdHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdCh3b3Jrc3BhY2VKc29uQXN0LCAncHJvamVjdHMnKTtcbiAgICBpZiAoIXByb2plY3RzKSB7XG4gICAgICB0aHJvdyBuZXcgU2NoZW1hdGljc0V4Y2VwdGlvbignRXhwZWN0IHByb2plY3RzIGluIGFuZ3VsYXIuanNvbiB0byBiZSBhbiBPYmplY3QnKTtcbiAgICB9XG4gICAgY29uc3QgcHJvamVjdCA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KHByb2plY3RzIGFzIEpzb25Bc3RPYmplY3QsIG5hbWUpO1xuICAgIGlmICghcHJvamVjdCkge1xuICAgICAgdGhyb3cgbmV3IFNjaGVtYXRpY3NFeGNlcHRpb24oYEV4cGVjdGVkIHByb2plY3RzIHRvIGNvbnRhaW4gJHtuYW1lfWApO1xuICAgIH1cbiAgICBjb25zdCByZWNvcmRlciA9IGhvc3QuYmVnaW5VcGRhdGUod29ya3NwYWNlUGF0aCk7XG4gICAgY29uc3QgaW5kZW50ID0gNjtcbiAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChcbiAgICAgICAgcmVjb3JkZXIsIHByb2plY3QgYXMgSnNvbkFzdE9iamVjdCwgJ2FyY2hpdGVjdCcsIHtcbiAgICAgICAgICAnYnVpbGQnOiB7XG4gICAgICAgICAgICAnYnVpbGRlcic6ICdAYW5ndWxhci9iYXplbDpidWlsZCcsXG4gICAgICAgICAgICAnb3B0aW9ucyc6IHsndGFyZ2V0TGFiZWwnOiAnLy9zcmM6YnVuZGxlLmpzJywgJ2JhemVsQ29tbWFuZCc6ICdidWlsZCd9LFxuICAgICAgICAgICAgJ2NvbmZpZ3VyYXRpb25zJzogeydwcm9kdWN0aW9uJzogeyd0YXJnZXRMYWJlbCc6ICcvL3NyYzpidW5kbGUnfX1cbiAgICAgICAgICB9LFxuICAgICAgICAgICdzZXJ2ZSc6IHtcbiAgICAgICAgICAgICdidWlsZGVyJzogJ0Bhbmd1bGFyL2JhemVsOmJ1aWxkJyxcbiAgICAgICAgICAgICdvcHRpb25zJzogeyd0YXJnZXRMYWJlbCc6ICcvL3NyYzpkZXZzZXJ2ZXInLCAnYmF6ZWxDb21tYW5kJzogJ3J1bid9LFxuICAgICAgICAgICAgJ2NvbmZpZ3VyYXRpb25zJzogeydwcm9kdWN0aW9uJzogeyd0YXJnZXRMYWJlbCc6ICcvL3NyYzpwcm9kc2VydmVyJ319XG4gICAgICAgICAgfSxcbiAgICAgICAgICAnZXh0cmFjdC1pMThuJzoge1xuICAgICAgICAgICAgJ2J1aWxkZXInOiAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXI6ZXh0cmFjdC1pMThuJyxcbiAgICAgICAgICAgICdvcHRpb25zJzogeydicm93c2VyVGFyZ2V0JzogYCR7bmFtZX06YnVpbGRgfVxuICAgICAgICAgIH0sXG4gICAgICAgICAgJ3Rlc3QnOiB7XG4gICAgICAgICAgICAnYnVpbGRlcic6ICdAYW5ndWxhci9iYXplbDpidWlsZCcsXG4gICAgICAgICAgICAnb3B0aW9ucyc6IHsnYmF6ZWxDb21tYW5kJzogJ3Rlc3QnLCAndGFyZ2V0TGFiZWwnOiAnLy9zcmMvLi4uJ31cbiAgICAgICAgICB9LFxuICAgICAgICAgICdsaW50Jzoge1xuICAgICAgICAgICAgJ2J1aWxkZXInOiAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXI6dHNsaW50JyxcbiAgICAgICAgICAgICdvcHRpb25zJzoge1xuICAgICAgICAgICAgICAndHNDb25maWcnOiBbJ3NyYy90c2NvbmZpZy5hcHAuanNvbicsICdzcmMvdHNjb25maWcuc3BlYy5qc29uJ10sXG4gICAgICAgICAgICAgICdleGNsdWRlJzogWycqKi9ub2RlX21vZHVsZXMvKionXVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgaW5kZW50KTtcblxuICAgIGNvbnN0IGUyZSA9IGAke29wdGlvbnMubmFtZX0tZTJlYDtcbiAgICBjb25zdCBlMmVOb2RlID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QocHJvamVjdHMgYXMgSnNvbkFzdE9iamVjdCwgZTJlKTtcbiAgICBpZiAoZTJlTm9kZSkge1xuICAgICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QoXG4gICAgICAgICAgcmVjb3JkZXIsIGUyZU5vZGUgYXMgSnNvbkFzdE9iamVjdCwgJ2FyY2hpdGVjdCcsIHtcbiAgICAgICAgICAgICdlMmUnOiB7XG4gICAgICAgICAgICAgICdidWlsZGVyJzogJ0Bhbmd1bGFyL2JhemVsOmJ1aWxkJyxcbiAgICAgICAgICAgICAgJ29wdGlvbnMnOiB7J2JhemVsQ29tbWFuZCc6ICd0ZXN0JywgJ3RhcmdldExhYmVsJzogJy8vZTJlOmRldnNlcnZlcl90ZXN0J30sXG4gICAgICAgICAgICAgICdjb25maWd1cmF0aW9ucyc6IHsncHJvZHVjdGlvbic6IHsndGFyZ2V0TGFiZWwnOiAnLy9lMmU6cHJvZHNlcnZlcl90ZXN0J319XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgJ2xpbnQnOiB7XG4gICAgICAgICAgICAgICdidWlsZGVyJzogJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyOnRzbGludCcsXG4gICAgICAgICAgICAgICdvcHRpb25zJzogeyd0c0NvbmZpZyc6ICdlMmUvdHNjb25maWcuZTJlLmpzb24nLCAnZXhjbHVkZSc6IFsnKiovbm9kZV9tb2R1bGVzLyoqJ119XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICBpbmRlbnQpO1xuICAgIH1cblxuICAgIGhvc3QuY29tbWl0VXBkYXRlKHJlY29yZGVyKTtcbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24ob3B0aW9uczogU2NoZW1hKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIHZhbGlkYXRlUHJvamVjdE5hbWUob3B0aW9ucy5uYW1lKTtcblxuICAgIHJldHVybiBjaGFpbihbXG4gICAgICBleHRlcm5hbFNjaGVtYXRpYygnQHNjaGVtYXRpY3MvYW5ndWxhcicsICduZy1uZXcnLCB7XG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgIHNraXBJbnN0YWxsOiB0cnVlLFxuICAgICAgfSksXG4gICAgICBhZGREZXZEZXBlbmRlbmNpZXNUb1BhY2thZ2VKc29uKG9wdGlvbnMpLFxuICAgICAgc2NoZW1hdGljKCdiYXplbC13b3Jrc3BhY2UnLCBvcHRpb25zKSxcbiAgICAgIG92ZXJ3cml0ZU1haW5BbmRJbmRleChvcHRpb25zKSxcbiAgICAgIHVwZGF0ZVdvcmtzcGFjZUZpbGVUb1VzZUJhemVsQnVpbGRlcihvcHRpb25zKSxcbiAgICBdKTtcbiAgfTtcbn1cbiJdfQ==
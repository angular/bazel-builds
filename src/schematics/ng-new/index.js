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
                '@bazel/karma': '0.21.0',
                '@bazel/typescript': '0.21.0',
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvc2NoZW1hdGljcy9uZy1uZXcvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCx5REFBNkw7SUFDN0wsNkNBQXFGO0lBQ3JGLHFFQUFpSDtJQUNqSCxxRUFBMkU7SUFDM0UsNkRBQWdFO0lBR2hFLFNBQVMsK0JBQStCLENBQUMsT0FBZTtRQUN0RCxPQUFPLFVBQUMsSUFBVTs7WUFDaEIsSUFBTSxXQUFXLEdBQU0sT0FBTyxDQUFDLElBQUksa0JBQWUsQ0FBQztZQUVuRCxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsRUFBRTtnQkFDN0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxvQkFBa0IsV0FBYSxDQUFDLENBQUM7YUFDbEQ7WUFDRCxJQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDbEQsSUFBSSxDQUFDLGtCQUFrQixFQUFFO2dCQUN2QixNQUFNLElBQUksS0FBSyxDQUFDLHFDQUFxQyxDQUFDLENBQUM7YUFDeEQ7WUFDRCxJQUFNLE9BQU8sR0FBRyxtQkFBWSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsRUFBRSxDQUFrQixDQUFDO1lBQzdFLElBQU0sSUFBSSxHQUFHLG9DQUF1QixDQUFDLE9BQU8sRUFBRSxjQUFjLENBQWtCLENBQUM7WUFDL0UsSUFBTSxPQUFPLEdBQUcsb0NBQXVCLENBQUMsT0FBTyxFQUFFLGlCQUFpQixDQUFrQixDQUFDO1lBRXJGLElBQU0sZUFBZSxHQUFHLG9DQUF1QixDQUFDLElBQUksRUFBRSxlQUFlLENBQUMsQ0FBQztZQUN2RSxJQUFNLGtCQUFrQixHQUFHLGVBQWlCLENBQUMsS0FBZSxDQUFDO1lBRTdELElBQU0sZUFBZSxHQUEwQjtnQkFDN0Ms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Q0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVELG1CQUF3QixPQUFlO1FBQ3JDLE9BQU8sVUFBQyxJQUFVO1lBQ2hCLGdDQUFtQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUVsQyxPQUFPLGtCQUFLLENBQUM7Z0JBQ1gsOEJBQWlCLENBQUMscUJBQXFCLEVBQUUsUUFBUSx1QkFDNUMsT0FBTyxJQUNWLFdBQVcsRUFBRSxJQUFJLElBQ2pCO2dCQUNGLCtCQUErQixDQUFDLE9BQU8sQ0FBQztnQkFDeEMsc0JBQVMsQ0FBQyxpQkFBaUIsRUFBRSxPQUFPLENBQUM7Z0JBQ3JDLHFCQUFxQixDQUFDLE9BQU8sQ0FBQztnQkFDOUIsb0NBQW9DLENBQUMsT0FBTyxDQUFDO2FBQzlDLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQztJQUNKLENBQUM7SUFmRCw0QkFlQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKlxuICogQGZpbGVvdmVydmlldyBTY2hlbWF0aWNzIGZvciBuZy1uZXcgcHJvamVjdCB0aGF0IGJ1aWxkcyB3aXRoIEJhemVsLlxuICovXG5cbmltcG9ydCB7YXBwbHksIGFwcGx5VGVtcGxhdGVzLCBjaGFpbiwgZXh0ZXJuYWxTY2hlbWF0aWMsIE1lcmdlU3RyYXRlZ3ksIG1lcmdlV2l0aCwgbW92ZSwgUnVsZSwgc2NoZW1hdGljLCBUcmVlLCB1cmwsIFNjaGVtYXRpY3NFeGNlcHRpb24sIFVwZGF0ZVJlY29yZGVyLH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L3NjaGVtYXRpY3MnO1xuaW1wb3J0IHtwYXJzZUpzb25Bc3QsIEpzb25Bc3RPYmplY3QsIHN0cmluZ3MsIEpzb25WYWx1ZX0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHtmaW5kUHJvcGVydHlJbkFzdE9iamVjdCwgaW5zZXJ0UHJvcGVydHlJbkFzdE9iamVjdEluT3JkZXJ9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS9qc29uLXV0aWxzJztcbmltcG9ydCB7dmFsaWRhdGVQcm9qZWN0TmFtZX0gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L3ZhbGlkYXRpb24nO1xuaW1wb3J0IHtnZXRXb3Jrc3BhY2V9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS9jb25maWcnO1xuaW1wb3J0IHtTY2hlbWF9IGZyb20gJy4vc2NoZW1hJztcblxuZnVuY3Rpb24gYWRkRGV2RGVwZW5kZW5jaWVzVG9QYWNrYWdlSnNvbihvcHRpb25zOiBTY2hlbWEpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgY29uc3QgcGFja2FnZUpzb24gPSBgJHtvcHRpb25zLm5hbWV9L3BhY2thZ2UuanNvbmA7XG5cbiAgICBpZiAoIWhvc3QuZXhpc3RzKHBhY2thZ2VKc29uKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgZmluZCAke3BhY2thZ2VKc29ufWApO1xuICAgIH1cbiAgICBjb25zdCBwYWNrYWdlSnNvbkNvbnRlbnQgPSBob3N0LnJlYWQocGFja2FnZUpzb24pO1xuICAgIGlmICghcGFja2FnZUpzb25Db250ZW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byByZWFkIHBhY2thZ2UuanNvbiBjb250ZW50Jyk7XG4gICAgfVxuICAgIGNvbnN0IGpzb25Bc3QgPSBwYXJzZUpzb25Bc3QocGFja2FnZUpzb25Db250ZW50LnRvU3RyaW5nKCkpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgY29uc3QgZGVwcyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGpzb25Bc3QsICdkZXBlbmRlbmNpZXMnKSBhcyBKc29uQXN0T2JqZWN0O1xuICAgIGNvbnN0IGRldkRlcHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChqc29uQXN0LCAnZGV2RGVwZW5kZW5jaWVzJykgYXMgSnNvbkFzdE9iamVjdDtcblxuICAgIGNvbnN0IGFuZ3VsYXJDb3JlTm9kZSA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGRlcHMsICdAYW5ndWxhci9jb3JlJyk7XG4gICAgY29uc3QgYW5ndWxhckNvcmVWZXJzaW9uID0gYW5ndWxhckNvcmVOb2RlICEudmFsdWUgYXMgc3RyaW5nO1xuXG4gICAgY29uc3QgZGV2RGVwZW5kZW5jaWVzOiB7W2s6IHN0cmluZ106IHN0cmluZ30gPSB7XG4gICAgICAnQGFuZ3VsYXIvYmF6ZWwnOiBhbmd1bGFyQ29yZVZlcnNpb24sXG4gICAgICAnQGJhemVsL2thcm1hJzogJzAuMjEuMCcsXG4gICAgICAnQGJhemVsL3R5cGVzY3JpcHQnOiAnMC4yMS4wJyxcbiAgICB9O1xuXG4gICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKHBhY2thZ2VKc29uKTtcbiAgICBmb3IgKGNvbnN0IHBhY2thZ2VOYW1lIG9mIE9iamVjdC5rZXlzKGRldkRlcGVuZGVuY2llcykpIHtcbiAgICAgIGNvbnN0IHZlcnNpb24gPSBkZXZEZXBlbmRlbmNpZXNbcGFja2FnZU5hbWVdO1xuICAgICAgY29uc3QgaW5kZW50ID0gNDtcbiAgICAgIGluc2VydFByb3BlcnR5SW5Bc3RPYmplY3RJbk9yZGVyKHJlY29yZGVyLCBkZXZEZXBzLCBwYWNrYWdlTmFtZSwgdmVyc2lvbiwgaW5kZW50KTtcbiAgICB9XG4gICAgaG9zdC5jb21taXRVcGRhdGUocmVjb3JkZXIpO1xuICAgIHJldHVybiBob3N0O1xuICB9O1xufVxuXG5mdW5jdGlvbiBvdmVyd3JpdGVNYWluQW5kSW5kZXgob3B0aW9uczogU2NoZW1hKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIGxldCBuZXdQcm9qZWN0Um9vdCA9ICcnO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB3b3Jrc3BhY2UgPSBnZXRXb3Jrc3BhY2UoaG9zdCk7XG4gICAgICBuZXdQcm9qZWN0Um9vdCA9IHdvcmtzcGFjZS5uZXdQcm9qZWN0Um9vdCB8fCAnJztcbiAgICB9IGNhdGNoIHtcbiAgICB9XG4gICAgY29uc3Qgc3JjRGlyID0gYCR7bmV3UHJvamVjdFJvb3R9LyR7b3B0aW9ucy5uYW1lfS9zcmNgO1xuXG4gICAgcmV0dXJuIG1lcmdlV2l0aChcbiAgICAgICAgYXBwbHkoXG4gICAgICAgICAgICB1cmwoJy4vZmlsZXMnKSxcbiAgICAgICAgICAgIFtcbiAgICAgICAgICAgICAgYXBwbHlUZW1wbGF0ZXMoe1xuICAgICAgICAgICAgICAgIHV0aWxzOiBzdHJpbmdzLFxuICAgICAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICAgICAgJ2RvdCc6ICcuJyxcbiAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgIG1vdmUoc3JjRGlyKSxcbiAgICAgICAgICAgIF0pLFxuICAgICAgICBNZXJnZVN0cmF0ZWd5Lk92ZXJ3cml0ZSk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0KFxuICAgIHJlY29yZGVyOiBVcGRhdGVSZWNvcmRlciwgbm9kZTogSnNvbkFzdE9iamVjdCwgcHJvcGVydHlOYW1lOiBzdHJpbmcsIHZhbHVlOiBKc29uVmFsdWUsXG4gICAgaW5kZW50OiBudW1iZXIpIHtcbiAgY29uc3QgcHJvcGVydHkgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChub2RlLCBwcm9wZXJ0eU5hbWUpO1xuICBpZiAocHJvcGVydHkgPT09IG51bGwpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoYFByb3BlcnR5ICR7cHJvcGVydHlOYW1lfSBkb2VzIG5vdCBleGlzdCBpbiBKU09OIG9iamVjdGApO1xuICB9XG4gIGNvbnN0IHtzdGFydCwgdGV4dH0gPSBwcm9wZXJ0eTtcbiAgcmVjb3JkZXIucmVtb3ZlKHN0YXJ0Lm9mZnNldCwgdGV4dC5sZW5ndGgpO1xuICBjb25zdCBpbmRlbnRTdHIgPSAnXFxuJyArXG4gICAgICAnICcucmVwZWF0KGluZGVudCk7XG4gIGNvbnN0IGNvbnRlbnQgPSBKU09OLnN0cmluZ2lmeSh2YWx1ZSwgbnVsbCwgJyAgJykucmVwbGFjZSgvXFxuL2csIGluZGVudFN0cik7XG4gIHJlY29yZGVyLmluc2VydExlZnQoc3RhcnQub2Zmc2V0LCBjb250ZW50KTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlV29ya3NwYWNlRmlsZVRvVXNlQmF6ZWxCdWlsZGVyKG9wdGlvbnM6IFNjaGVtYSk6IFJ1bGUge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBjb25zdCB7bmFtZX0gPSBvcHRpb25zO1xuICAgIGNvbnN0IHdvcmtzcGFjZVBhdGggPSBgJHtuYW1lfS9hbmd1bGFyLmpzb25gO1xuICAgIGlmICghaG9zdC5leGlzdHMod29ya3NwYWNlUGF0aCkpIHtcbiAgICAgIHRocm93IG5ldyBTY2hlbWF0aWNzRXhjZXB0aW9uKGBXb3Jrc3BhY2UgZmlsZSAke3dvcmtzcGFjZVBhdGh9IG5vdCBmb3VuZC5gKTtcbiAgICB9XG4gICAgY29uc3Qgd29ya3NwYWNlQnVmZmVyID0gaG9zdC5yZWFkKHdvcmtzcGFjZVBhdGgpICE7XG4gICAgY29uc3Qgd29ya3NwYWNlSnNvbkFzdCA9IHBhcnNlSnNvbkFzdCh3b3Jrc3BhY2VCdWZmZXIudG9TdHJpbmcoKSkgYXMgSnNvbkFzdE9iamVjdDtcbiAgICBjb25zdCBwcm9qZWN0cyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KHdvcmtzcGFjZUpzb25Bc3QsICdwcm9qZWN0cycpO1xuICAgIGlmICghcHJvamVjdHMpIHtcbiAgICAgIHRocm93IG5ldyBTY2hlbWF0aWNzRXhjZXB0aW9uKCdFeHBlY3QgcHJvamVjdHMgaW4gYW5ndWxhci5qc29uIHRvIGJlIGFuIE9iamVjdCcpO1xuICAgIH1cbiAgICBjb25zdCBwcm9qZWN0ID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QocHJvamVjdHMgYXMgSnNvbkFzdE9iamVjdCwgbmFtZSk7XG4gICAgaWYgKCFwcm9qZWN0KSB7XG4gICAgICB0aHJvdyBuZXcgU2NoZW1hdGljc0V4Y2VwdGlvbihgRXhwZWN0ZWQgcHJvamVjdHMgdG8gY29udGFpbiAke25hbWV9YCk7XG4gICAgfVxuICAgIGNvbnN0IHJlY29yZGVyID0gaG9zdC5iZWdpblVwZGF0ZSh3b3Jrc3BhY2VQYXRoKTtcbiAgICBjb25zdCBpbmRlbnQgPSA2O1xuICAgIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0KFxuICAgICAgICByZWNvcmRlciwgcHJvamVjdCBhcyBKc29uQXN0T2JqZWN0LCAnYXJjaGl0ZWN0Jywge1xuICAgICAgICAgICdidWlsZCc6IHtcbiAgICAgICAgICAgICdidWlsZGVyJzogJ0Bhbmd1bGFyL2JhemVsOmJ1aWxkJyxcbiAgICAgICAgICAgICdvcHRpb25zJzogeyd0YXJnZXRMYWJlbCc6ICcvL3NyYzpidW5kbGUuanMnLCAnYmF6ZWxDb21tYW5kJzogJ2J1aWxkJ30sXG4gICAgICAgICAgICAnY29uZmlndXJhdGlvbnMnOiB7J3Byb2R1Y3Rpb24nOiB7J3RhcmdldExhYmVsJzogJy8vc3JjOmJ1bmRsZSd9fVxuICAgICAgICAgIH0sXG4gICAgICAgICAgJ3NlcnZlJzoge1xuICAgICAgICAgICAgJ2J1aWxkZXInOiAnQGFuZ3VsYXIvYmF6ZWw6YnVpbGQnLFxuICAgICAgICAgICAgJ29wdGlvbnMnOiB7J3RhcmdldExhYmVsJzogJy8vc3JjOmRldnNlcnZlcicsICdiYXplbENvbW1hbmQnOiAncnVuJ30sXG4gICAgICAgICAgICAnY29uZmlndXJhdGlvbnMnOiB7J3Byb2R1Y3Rpb24nOiB7J3RhcmdldExhYmVsJzogJy8vc3JjOnByb2RzZXJ2ZXInfX1cbiAgICAgICAgICB9LFxuICAgICAgICAgICdleHRyYWN0LWkxOG4nOiB7XG4gICAgICAgICAgICAnYnVpbGRlcic6ICdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhcjpleHRyYWN0LWkxOG4nLFxuICAgICAgICAgICAgJ29wdGlvbnMnOiB7J2Jyb3dzZXJUYXJnZXQnOiBgJHtuYW1lfTpidWlsZGB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICAndGVzdCc6IHtcbiAgICAgICAgICAgICdidWlsZGVyJzogJ0Bhbmd1bGFyL2JhemVsOmJ1aWxkJyxcbiAgICAgICAgICAgICdvcHRpb25zJzogeydiYXplbENvbW1hbmQnOiAndGVzdCcsICd0YXJnZXRMYWJlbCc6ICcvL3NyYy8uLi4nfVxuICAgICAgICAgIH0sXG4gICAgICAgICAgJ2xpbnQnOiB7XG4gICAgICAgICAgICAnYnVpbGRlcic6ICdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhcjp0c2xpbnQnLFxuICAgICAgICAgICAgJ29wdGlvbnMnOiB7XG4gICAgICAgICAgICAgICd0c0NvbmZpZyc6IFsnc3JjL3RzY29uZmlnLmFwcC5qc29uJywgJ3NyYy90c2NvbmZpZy5zcGVjLmpzb24nXSxcbiAgICAgICAgICAgICAgJ2V4Y2x1ZGUnOiBbJyoqL25vZGVfbW9kdWxlcy8qKiddXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBpbmRlbnQpO1xuXG4gICAgY29uc3QgZTJlID0gYCR7b3B0aW9ucy5uYW1lfS1lMmVgO1xuICAgIGNvbnN0IGUyZU5vZGUgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChwcm9qZWN0cyBhcyBKc29uQXN0T2JqZWN0LCBlMmUpO1xuICAgIGlmIChlMmVOb2RlKSB7XG4gICAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChcbiAgICAgICAgICByZWNvcmRlciwgZTJlTm9kZSBhcyBKc29uQXN0T2JqZWN0LCAnYXJjaGl0ZWN0Jywge1xuICAgICAgICAgICAgJ2UyZSc6IHtcbiAgICAgICAgICAgICAgJ2J1aWxkZXInOiAnQGFuZ3VsYXIvYmF6ZWw6YnVpbGQnLFxuICAgICAgICAgICAgICAnb3B0aW9ucyc6IHsnYmF6ZWxDb21tYW5kJzogJ3Rlc3QnLCAndGFyZ2V0TGFiZWwnOiAnLy9lMmU6ZGV2c2VydmVyX3Rlc3QnfSxcbiAgICAgICAgICAgICAgJ2NvbmZpZ3VyYXRpb25zJzogeydwcm9kdWN0aW9uJzogeyd0YXJnZXRMYWJlbCc6ICcvL2UyZTpwcm9kc2VydmVyX3Rlc3QnfX1cbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAnbGludCc6IHtcbiAgICAgICAgICAgICAgJ2J1aWxkZXInOiAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXI6dHNsaW50JyxcbiAgICAgICAgICAgICAgJ29wdGlvbnMnOiB7J3RzQ29uZmlnJzogJ2UyZS90c2NvbmZpZy5lMmUuanNvbicsICdleGNsdWRlJzogWycqKi9ub2RlX21vZHVsZXMvKionXX1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LFxuICAgICAgICAgIGluZGVudCk7XG4gICAgfVxuXG4gICAgaG9zdC5jb21taXRVcGRhdGUocmVjb3JkZXIpO1xuICAgIHJldHVybiBob3N0O1xuICB9O1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbihvcHRpb25zOiBTY2hlbWEpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgdmFsaWRhdGVQcm9qZWN0TmFtZShvcHRpb25zLm5hbWUpO1xuXG4gICAgcmV0dXJuIGNoYWluKFtcbiAgICAgIGV4dGVybmFsU2NoZW1hdGljKCdAc2NoZW1hdGljcy9hbmd1bGFyJywgJ25nLW5ldycsIHtcbiAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgc2tpcEluc3RhbGw6IHRydWUsXG4gICAgICB9KSxcbiAgICAgIGFkZERldkRlcGVuZGVuY2llc1RvUGFja2FnZUpzb24ob3B0aW9ucyksXG4gICAgICBzY2hlbWF0aWMoJ2JhemVsLXdvcmtzcGFjZScsIG9wdGlvbnMpLFxuICAgICAgb3ZlcndyaXRlTWFpbkFuZEluZGV4KG9wdGlvbnMpLFxuICAgICAgdXBkYXRlV29ya3NwYWNlRmlsZVRvVXNlQmF6ZWxCdWlsZGVyKG9wdGlvbnMpLFxuICAgIF0pO1xuICB9O1xufVxuIl19
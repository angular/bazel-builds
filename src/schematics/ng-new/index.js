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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi4vLi4vLi4vLi4vLi4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9iYXplbC9zcmMvc2NoZW1hdGljcy9uZy1uZXcvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCx5REFBK007SUFDL00sNkNBQXFGO0lBQ3JGLHFFQUFpSDtJQUNqSCxxRUFBMkU7SUFDM0UsNkRBQWdFO0lBR2hFLFNBQVMsK0JBQStCLENBQUMsT0FBZTtRQUN0RCxPQUFPLFVBQUMsSUFBVTs7WUFDaEIsSUFBTSxXQUFXLEdBQU0sT0FBTyxDQUFDLElBQUksa0JBQWUsQ0FBQztZQUVuRCxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsRUFBRTtnQkFDN0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxvQkFBa0IsV0FBYSxDQUFDLENBQUM7YUFDbEQ7WUFDRCxJQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDbEQsSUFBSSxDQUFDLGtCQUFrQixFQUFFO2dCQUN2QixNQUFNLElBQUksS0FBSyxDQUFDLHFDQUFxQyxDQUFDLENBQUM7YUFDeEQ7WUFDRCxJQUFNLE9BQU8sR0FBRyxtQkFBWSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsRUFBRSxDQUFrQixDQUFDO1lBQzdFLElBQU0sSUFBSSxHQUFHLG9DQUF1QixDQUFDLE9BQU8sRUFBRSxjQUFjLENBQWtCLENBQUM7WUFDL0UsSUFBTSxPQUFPLEdBQUcsb0NBQXVCLENBQUMsT0FBTyxFQUFFLGlCQUFpQixDQUFrQixDQUFDO1lBRXJGLElBQU0sZUFBZSxHQUFHLG9DQUF1QixDQUFDLElBQUksRUFBRSxlQUFlLENBQUMsQ0FBQztZQUN2RSxJQUFNLGtCQUFrQixHQUFHLGVBQWlCLENBQUMsS0FBZSxDQUFDO1lBRTdELElBQU0sZUFBZSxHQUEwQjtnQkFDN0MsZ0JBQWdCLEVB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UUFDZCxDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQsbUJBQXdCLE9BQWU7UUFDckMsT0FBTyxVQUFDLElBQVU7WUFDaEIsZ0NBQW1CLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBRWxDLE9BQU8sa0JBQUssQ0FBQztnQkFDWCw4QkFBaUIsQ0FBQyxxQkFBcUIsRUFBRSxRQUFRLHVCQUM1QyxPQUFPLElBQ1YsV0FBVyxFQUFFLElBQUksSUFDakI7Z0JBQ0YsK0JBQStCLENBQUMsT0FBTyxDQUFDO2dCQUN4QyxzQkFBUyxDQUFDLGlCQUFpQixFQUFFLE9BQU8sQ0FBQztnQkFDckMscUJBQXFCLENBQUMsT0FBTyxDQUFDO2dCQUM5QixvQ0FBb0MsQ0FBQyxPQUFPLENBQUM7YUFDOUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQWZELDRCQWVDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqXG4gKiBAZmlsZW92ZXJ2aWV3IFNjaGVtYXRpY3MgZm9yIG5nLW5ldyBwcm9qZWN0IHRoYXQgYnVpbGRzIHdpdGggQmF6ZWwuXG4gKi9cblxuaW1wb3J0IHtTY2hlbWF0aWNDb250ZXh0LCBhcHBseSwgYXBwbHlUZW1wbGF0ZXMsIGNoYWluLCBleHRlcm5hbFNjaGVtYXRpYywgTWVyZ2VTdHJhdGVneSwgbWVyZ2VXaXRoLCBtb3ZlLCBSdWxlLCBzY2hlbWF0aWMsIFRyZWUsIHVybCwgU2NoZW1hdGljc0V4Y2VwdGlvbiwgVXBkYXRlUmVjb3JkZXIsfSBmcm9tICdAYW5ndWxhci1kZXZraXQvc2NoZW1hdGljcyc7XG5pbXBvcnQge3BhcnNlSnNvbkFzdCwgSnNvbkFzdE9iamVjdCwgc3RyaW5ncywgSnNvblZhbHVlfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQge2ZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0LCBpbnNlcnRQcm9wZXJ0eUluQXN0T2JqZWN0SW5PcmRlcn0gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L2pzb24tdXRpbHMnO1xuaW1wb3J0IHt2YWxpZGF0ZVByb2plY3ROYW1lfSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvdmFsaWRhdGlvbic7XG5pbXBvcnQge2dldFdvcmtzcGFjZX0gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L2NvbmZpZyc7XG5pbXBvcnQge1NjaGVtYX0gZnJvbSAnLi9zY2hlbWEnO1xuXG5mdW5jdGlvbiBhZGREZXZEZXBlbmRlbmNpZXNUb1BhY2thZ2VKc29uKG9wdGlvbnM6IFNjaGVtYSkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUpID0+IHtcbiAgICBjb25zdCBwYWNrYWdlSnNvbiA9IGAke29wdGlvbnMubmFtZX0vcGFja2FnZS5qc29uYDtcblxuICAgIGlmICghaG9zdC5leGlzdHMocGFja2FnZUpzb24pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBmaW5kICR7cGFja2FnZUpzb259YCk7XG4gICAgfVxuICAgIGNvbnN0IHBhY2thZ2VKc29uQ29udGVudCA9IGhvc3QucmVhZChwYWNrYWdlSnNvbik7XG4gICAgaWYgKCFwYWNrYWdlSnNvbkNvbnRlbnQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIHJlYWQgcGFja2FnZS5qc29uIGNvbnRlbnQnKTtcbiAgICB9XG4gICAgY29uc3QganNvbkFzdCA9IHBhcnNlSnNvbkFzdChwYWNrYWdlSnNvbkNvbnRlbnQudG9TdHJpbmcoKSkgYXMgSnNvbkFzdE9iamVjdDtcbiAgICBjb25zdCBkZXBzID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoanNvbkFzdCwgJ2RlcGVuZGVuY2llcycpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgY29uc3QgZGV2RGVwcyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGpzb25Bc3QsICdkZXZEZXBlbmRlbmNpZXMnKSBhcyBKc29uQXN0T2JqZWN0O1xuXG4gICAgY29uc3QgYW5ndWxhckNvcmVOb2RlID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoZGVwcywgJ0Bhbmd1bGFyL2NvcmUnKTtcbiAgICBjb25zdCBhbmd1bGFyQ29yZVZlcnNpb24gPSBhbmd1bGFyQ29yZU5vZGUgIS52YWx1ZSBhcyBzdHJpbmc7XG5cbiAgICBjb25zdCBkZXZEZXBlbmRlbmNpZXM6IHtbazogc3RyaW5nXTogc3RyaW5nfSA9IHtcbiAgICAgICdAYW5ndWxhci9iYXplbCc6IGFuZ3VsYXJDb3JlVmVyc2lvbixcbiAgICAgIC8vIFRPRE8oa3lsaWF1KTogQ29uc2lkZXIgbW92aW5nIHRoaXMgdG8gbGF0ZXN0LXZlcnNpb25zLnRzXG4gICAgICAnQGJhemVsL2thcm1hJzogJ14wLjIyLjAnLFxuICAgICAgJ0BiYXplbC90eXBlc2NyaXB0JzogJ14wLjIyLjAnLFxuICAgIH07XG5cbiAgICBjb25zdCByZWNvcmRlciA9IGhvc3QuYmVnaW5VcGRhdGUocGFja2FnZUpzb24pO1xuICAgIGZvciAoY29uc3QgcGFja2FnZU5hbWUgb2YgT2JqZWN0LmtleXMoZGV2RGVwZW5kZW5jaWVzKSkge1xuICAgICAgY29uc3QgdmVyc2lvbiA9IGRldkRlcGVuZGVuY2llc1twYWNrYWdlTmFtZV07XG4gICAgICBjb25zdCBpbmRlbnQgPSA0O1xuICAgICAgaW5zZXJ0UHJvcGVydHlJbkFzdE9iamVjdEluT3JkZXIocmVjb3JkZXIsIGRldkRlcHMsIHBhY2thZ2VOYW1lLCB2ZXJzaW9uLCBpbmRlbnQpO1xuICAgIH1cbiAgICBob3N0LmNvbW1pdFVwZGF0ZShyZWNvcmRlcik7XG4gICAgcmV0dXJuIGhvc3Q7XG4gIH07XG59XG5cbmZ1bmN0aW9uIG92ZXJ3cml0ZU1haW5BbmRJbmRleChvcHRpb25zOiBTY2hlbWEpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgbGV0IG5ld1Byb2plY3RSb290ID0gJyc7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHdvcmtzcGFjZSA9IGdldFdvcmtzcGFjZShob3N0KTtcbiAgICAgIG5ld1Byb2plY3RSb290ID0gd29ya3NwYWNlLm5ld1Byb2plY3RSb290IHx8ICcnO1xuICAgIH0gY2F0Y2gge1xuICAgIH1cbiAgICBjb25zdCBzcmNEaXIgPSBgJHtuZXdQcm9qZWN0Um9vdH0vJHtvcHRpb25zLm5hbWV9L3NyY2A7XG5cbiAgICByZXR1cm4gbWVyZ2VXaXRoKFxuICAgICAgICBhcHBseShcbiAgICAgICAgICAgIHVybCgnLi9maWxlcycpLFxuICAgICAgICAgICAgW1xuICAgICAgICAgICAgICBhcHBseVRlbXBsYXRlcyh7XG4gICAgICAgICAgICAgICAgdXRpbHM6IHN0cmluZ3MsXG4gICAgICAgICAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgICAgICAgICAnZG90JzogJy4nLFxuICAgICAgICAgICAgICB9KSxcbiAgICAgICAgICAgICAgbW92ZShzcmNEaXIpLFxuICAgICAgICAgICAgXSksXG4gICAgICAgIE1lcmdlU3RyYXRlZ3kuT3ZlcndyaXRlKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QoXG4gICAgcmVjb3JkZXI6IFVwZGF0ZVJlY29yZGVyLCBub2RlOiBKc29uQXN0T2JqZWN0LCBwcm9wZXJ0eU5hbWU6IHN0cmluZywgdmFsdWU6IEpzb25WYWx1ZSxcbiAgICBpbmRlbnQ6IG51bWJlcikge1xuICBjb25zdCBwcm9wZXJ0eSA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KG5vZGUsIHByb3BlcnR5TmFtZSk7XG4gIGlmIChwcm9wZXJ0eSA9PT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgUHJvcGVydHkgJHtwcm9wZXJ0eU5hbWV9IGRvZXMgbm90IGV4aXN0IGluIEpTT04gb2JqZWN0YCk7XG4gIH1cbiAgY29uc3Qge3N0YXJ0LCB0ZXh0fSA9IHByb3BlcnR5O1xuICByZWNvcmRlci5yZW1vdmUoc3RhcnQub2Zmc2V0LCB0ZXh0Lmxlbmd0aCk7XG4gIGNvbnN0IGluZGVudFN0ciA9ICdcXG4nICtcbiAgICAgICcgJy5yZXBlYXQoaW5kZW50KTtcbiAgY29uc3QgY29udGVudCA9IEpTT04uc3RyaW5naWZ5KHZhbHVlLCBudWxsLCAnICAnKS5yZXBsYWNlKC9cXG4vZywgaW5kZW50U3RyKTtcbiAgcmVjb3JkZXIuaW5zZXJ0TGVmdChzdGFydC5vZmZzZXQsIGNvbnRlbnQpO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVXb3Jrc3BhY2VGaWxlVG9Vc2VCYXplbEJ1aWxkZXIob3B0aW9uczogU2NoZW1hKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSwgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCkgPT4ge1xuICAgIGNvbnN0IHtuYW1lfSA9IG9wdGlvbnM7XG4gICAgY29uc3Qgd29ya3NwYWNlUGF0aCA9IGAke25hbWV9L2FuZ3VsYXIuanNvbmA7XG4gICAgaWYgKCFob3N0LmV4aXN0cyh3b3Jrc3BhY2VQYXRoKSkge1xuICAgICAgdGhyb3cgbmV3IFNjaGVtYXRpY3NFeGNlcHRpb24oYFdvcmtzcGFjZSBmaWxlICR7d29ya3NwYWNlUGF0aH0gbm90IGZvdW5kLmApO1xuICAgIH1cbiAgICBjb25zdCB3b3Jrc3BhY2VCdWZmZXIgPSBob3N0LnJlYWQod29ya3NwYWNlUGF0aCkgITtcbiAgICBjb25zdCB3b3Jrc3BhY2VKc29uQXN0ID0gcGFyc2VKc29uQXN0KHdvcmtzcGFjZUJ1ZmZlci50b1N0cmluZygpKSBhcyBKc29uQXN0T2JqZWN0O1xuICAgIGNvbnN0IHByb2plY3RzID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3Qod29ya3NwYWNlSnNvbkFzdCwgJ3Byb2plY3RzJyk7XG4gICAgaWYgKCFwcm9qZWN0cykge1xuICAgICAgdGhyb3cgbmV3IFNjaGVtYXRpY3NFeGNlcHRpb24oJ0V4cGVjdCBwcm9qZWN0cyBpbiBhbmd1bGFyLmpzb24gdG8gYmUgYW4gT2JqZWN0Jyk7XG4gICAgfVxuICAgIGNvbnN0IHByb2plY3QgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChwcm9qZWN0cyBhcyBKc29uQXN0T2JqZWN0LCBuYW1lKTtcbiAgICBpZiAoIXByb2plY3QpIHtcbiAgICAgIHRocm93IG5ldyBTY2hlbWF0aWNzRXhjZXB0aW9uKGBFeHBlY3RlZCBwcm9qZWN0cyB0byBjb250YWluICR7bmFtZX1gKTtcbiAgICB9XG4gICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKHdvcmtzcGFjZVBhdGgpO1xuICAgIGNvbnN0IGluZGVudCA9IDY7XG4gICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QoXG4gICAgICAgIHJlY29yZGVyLCBwcm9qZWN0IGFzIEpzb25Bc3RPYmplY3QsICdhcmNoaXRlY3QnLCB7XG4gICAgICAgICAgJ2J1aWxkJzoge1xuICAgICAgICAgICAgJ2J1aWxkZXInOiAnQGFuZ3VsYXIvYmF6ZWw6YnVpbGQnLFxuICAgICAgICAgICAgJ29wdGlvbnMnOiB7J3RhcmdldExhYmVsJzogJy8vc3JjOmJ1bmRsZS5qcycsICdiYXplbENvbW1hbmQnOiAnYnVpbGQnfSxcbiAgICAgICAgICAgICdjb25maWd1cmF0aW9ucyc6IHsncHJvZHVjdGlvbic6IHsndGFyZ2V0TGFiZWwnOiAnLy9zcmM6YnVuZGxlJ319XG4gICAgICAgICAgfSxcbiAgICAgICAgICAnc2VydmUnOiB7XG4gICAgICAgICAgICAnYnVpbGRlcic6ICdAYW5ndWxhci9iYXplbDpidWlsZCcsXG4gICAgICAgICAgICAnb3B0aW9ucyc6IHsndGFyZ2V0TGFiZWwnOiAnLy9zcmM6ZGV2c2VydmVyJywgJ2JhemVsQ29tbWFuZCc6ICdydW4nfSxcbiAgICAgICAgICAgICdjb25maWd1cmF0aW9ucyc6IHsncHJvZHVjdGlvbic6IHsndGFyZ2V0TGFiZWwnOiAnLy9zcmM6cHJvZHNlcnZlcid9fVxuICAgICAgICAgIH0sXG4gICAgICAgICAgJ2V4dHJhY3QtaTE4bic6IHtcbiAgICAgICAgICAgICdidWlsZGVyJzogJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyOmV4dHJhY3QtaTE4bicsXG4gICAgICAgICAgICAnb3B0aW9ucyc6IHsnYnJvd3NlclRhcmdldCc6IGAke25hbWV9OmJ1aWxkYH1cbiAgICAgICAgICB9LFxuICAgICAgICAgICd0ZXN0Jzoge1xuICAgICAgICAgICAgJ2J1aWxkZXInOiAnQGFuZ3VsYXIvYmF6ZWw6YnVpbGQnLFxuICAgICAgICAgICAgJ29wdGlvbnMnOiB7J2JhemVsQ29tbWFuZCc6ICd0ZXN0JywgJ3RhcmdldExhYmVsJzogJy8vc3JjLy4uLid9XG4gICAgICAgICAgfSxcbiAgICAgICAgICAnbGludCc6IHtcbiAgICAgICAgICAgICdidWlsZGVyJzogJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyOnRzbGludCcsXG4gICAgICAgICAgICAnb3B0aW9ucyc6IHtcbiAgICAgICAgICAgICAgJ3RzQ29uZmlnJzogWydzcmMvdHNjb25maWcuYXBwLmpzb24nLCAnc3JjL3RzY29uZmlnLnNwZWMuanNvbiddLFxuICAgICAgICAgICAgICAnZXhjbHVkZSc6IFsnKiovbm9kZV9tb2R1bGVzLyoqJ11cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGluZGVudCk7XG5cbiAgICBjb25zdCBlMmUgPSBgJHtvcHRpb25zLm5hbWV9LWUyZWA7XG4gICAgY29uc3QgZTJlTm9kZSA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KHByb2plY3RzIGFzIEpzb25Bc3RPYmplY3QsIGUyZSk7XG4gICAgaWYgKGUyZU5vZGUpIHtcbiAgICAgIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0KFxuICAgICAgICAgIHJlY29yZGVyLCBlMmVOb2RlIGFzIEpzb25Bc3RPYmplY3QsICdhcmNoaXRlY3QnLCB7XG4gICAgICAgICAgICAnZTJlJzoge1xuICAgICAgICAgICAgICAnYnVpbGRlcic6ICdAYW5ndWxhci9iYXplbDpidWlsZCcsXG4gICAgICAgICAgICAgICdvcHRpb25zJzogeydiYXplbENvbW1hbmQnOiAndGVzdCcsICd0YXJnZXRMYWJlbCc6ICcvL2UyZTpkZXZzZXJ2ZXJfdGVzdCd9LFxuICAgICAgICAgICAgICAnY29uZmlndXJhdGlvbnMnOiB7J3Byb2R1Y3Rpb24nOiB7J3RhcmdldExhYmVsJzogJy8vZTJlOnByb2RzZXJ2ZXJfdGVzdCd9fVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICdsaW50Jzoge1xuICAgICAgICAgICAgICAnYnVpbGRlcic6ICdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhcjp0c2xpbnQnLFxuICAgICAgICAgICAgICAnb3B0aW9ucyc6IHsndHNDb25maWcnOiAnZTJlL3RzY29uZmlnLmUyZS5qc29uJywgJ2V4Y2x1ZGUnOiBbJyoqL25vZGVfbW9kdWxlcy8qKiddfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgICAgICAgaW5kZW50KTtcbiAgICB9XG5cbiAgICBob3N0LmNvbW1pdFVwZGF0ZShyZWNvcmRlcik7XG4gICAgcmV0dXJuIGhvc3Q7XG4gIH07XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKG9wdGlvbnM6IFNjaGVtYSk6IFJ1bGUge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUpID0+IHtcbiAgICB2YWxpZGF0ZVByb2plY3ROYW1lKG9wdGlvbnMubmFtZSk7XG5cbiAgICByZXR1cm4gY2hhaW4oW1xuICAgICAgZXh0ZXJuYWxTY2hlbWF0aWMoJ0BzY2hlbWF0aWNzL2FuZ3VsYXInLCAnbmctbmV3Jywge1xuICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICBza2lwSW5zdGFsbDogdHJ1ZSxcbiAgICAgIH0pLFxuICAgICAgYWRkRGV2RGVwZW5kZW5jaWVzVG9QYWNrYWdlSnNvbihvcHRpb25zKSxcbiAgICAgIHNjaGVtYXRpYygnYmF6ZWwtd29ya3NwYWNlJywgb3B0aW9ucyksXG4gICAgICBvdmVyd3JpdGVNYWluQW5kSW5kZXgob3B0aW9ucyksXG4gICAgICB1cGRhdGVXb3Jrc3BhY2VGaWxlVG9Vc2VCYXplbEJ1aWxkZXIob3B0aW9ucyksXG4gICAgXSk7XG4gIH07XG59XG4iXX0=
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvc2NoZW1hdGljcy9uZy1uZXcvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCx5REFBK007SUFDL00sNkNBQXFGO0lBQ3JGLHFFQUFpSDtJQUNqSCxxRUFBMkU7SUFDM0UsNkRBQWdFO0lBR2hFLFNBQVMsK0JBQStCLENBQUMsT0FBZTtRQUN0RCxPQUFPLFVBQUMsSUFBVTs7WUFDaEIsSUFBTSxXQUFXLEdBQU0sT0FBTyxDQUFDLElBQUksa0JBQWUsQ0FBQztZQUVuRCxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsRUFBRTtnQkFDN0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxvQkFBa0IsV0FBYSxDQUFDLENBQUM7YUFDbEQ7WUFDRCxJQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDbEQsSUFBSSxDQUFDLGtCQUFrQixFQUFFO2dCQUN2QixNQUFNLElBQUksS0FBSyxDQUFDLHFDQUFxQyxDQUFDLENBQUM7YUFDeEQ7WUFDRCxJQUFNLE9BQU8sR0FBRyxtQkFBWSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsRUFBRSxDQUFrQixDQUFDO1lBQzdFLElBQU0sSUFBSSxHQUFHLG9DQUF1QixDQUFDLE9BQU8sRUFBRSxjQUFjLENBQWtCLENBQUM7WUFDL0UsSUFBTSxPQUFPLEdBQUcsb0NBQXVCLENBQUMsT0FBTyxFQUFFLGlCQUFpQixDQUFrQixDQUFDO1lBRXJGLElBQU0sZUFBZSxHQUFHLG9DQUF1QixDQUFDLElBQUksRUFBRSxlQUFlLENBQUMsQ0FBQztZQUN2RSxJQUFNLGtCQUFrQixHQUFHLGVBQWlCLENBQUMsS0FBZSxDQUFDO1lBRTdELElBQU0sZUFBZSxHQUEwQjtnQkFDN0Ms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SyxDQUFDO2dCQUNYLDhCQUFpQixDQUFDLHFCQUFxQixFQUFFLFFBQVEsdUJBQzVDLE9BQU8sSUFDVixXQUFXLEVBQUUsSUFBSSxJQUNqQjtnQkFDRiwrQkFBK0IsQ0FBQyxPQUFPLENBQUM7Z0JBQ3hDLHNCQUFTLENBQUMsaUJBQWlCLEVBQUUsT0FBTyxDQUFDO2dCQUNyQyxxQkFBcUIsQ0FBQyxPQUFPLENBQUM7Z0JBQzlCLGtCQUFrQixDQUFDLE9BQU8sQ0FBQztnQkFDM0Isb0NBQW9DLENBQUMsT0FBTyxDQUFDO2FBQzlDLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQztJQUNKLENBQUM7SUFoQkQsNEJBZ0JDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqXG4gKiBAZmlsZW92ZXJ2aWV3IFNjaGVtYXRpY3MgZm9yIG5nLW5ldyBwcm9qZWN0IHRoYXQgYnVpbGRzIHdpdGggQmF6ZWwuXG4gKi9cblxuaW1wb3J0IHtTY2hlbWF0aWNDb250ZXh0LCBhcHBseSwgYXBwbHlUZW1wbGF0ZXMsIGNoYWluLCBleHRlcm5hbFNjaGVtYXRpYywgTWVyZ2VTdHJhdGVneSwgbWVyZ2VXaXRoLCBtb3ZlLCBSdWxlLCBzY2hlbWF0aWMsIFRyZWUsIHVybCwgU2NoZW1hdGljc0V4Y2VwdGlvbiwgVXBkYXRlUmVjb3JkZXIsfSBmcm9tICdAYW5ndWxhci1kZXZraXQvc2NoZW1hdGljcyc7XG5pbXBvcnQge3BhcnNlSnNvbkFzdCwgSnNvbkFzdE9iamVjdCwgc3RyaW5ncywgSnNvblZhbHVlfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQge2ZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0LCBpbnNlcnRQcm9wZXJ0eUluQXN0T2JqZWN0SW5PcmRlcn0gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L2pzb24tdXRpbHMnO1xuaW1wb3J0IHt2YWxpZGF0ZVByb2plY3ROYW1lfSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvdmFsaWRhdGlvbic7XG5pbXBvcnQge2dldFdvcmtzcGFjZX0gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L2NvbmZpZyc7XG5pbXBvcnQge1NjaGVtYX0gZnJvbSAnLi9zY2hlbWEnO1xuXG5mdW5jdGlvbiBhZGREZXZEZXBlbmRlbmNpZXNUb1BhY2thZ2VKc29uKG9wdGlvbnM6IFNjaGVtYSkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUpID0+IHtcbiAgICBjb25zdCBwYWNrYWdlSnNvbiA9IGAke29wdGlvbnMubmFtZX0vcGFja2FnZS5qc29uYDtcblxuICAgIGlmICghaG9zdC5leGlzdHMocGFja2FnZUpzb24pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBmaW5kICR7cGFja2FnZUpzb259YCk7XG4gICAgfVxuICAgIGNvbnN0IHBhY2thZ2VKc29uQ29udGVudCA9IGhvc3QucmVhZChwYWNrYWdlSnNvbik7XG4gICAgaWYgKCFwYWNrYWdlSnNvbkNvbnRlbnQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIHJlYWQgcGFja2FnZS5qc29uIGNvbnRlbnQnKTtcbiAgICB9XG4gICAgY29uc3QganNvbkFzdCA9IHBhcnNlSnNvbkFzdChwYWNrYWdlSnNvbkNvbnRlbnQudG9TdHJpbmcoKSkgYXMgSnNvbkFzdE9iamVjdDtcbiAgICBjb25zdCBkZXBzID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoanNvbkFzdCwgJ2RlcGVuZGVuY2llcycpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgY29uc3QgZGV2RGVwcyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGpzb25Bc3QsICdkZXZEZXBlbmRlbmNpZXMnKSBhcyBKc29uQXN0T2JqZWN0O1xuXG4gICAgY29uc3QgYW5ndWxhckNvcmVOb2RlID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoZGVwcywgJ0Bhbmd1bGFyL2NvcmUnKTtcbiAgICBjb25zdCBhbmd1bGFyQ29yZVZlcnNpb24gPSBhbmd1bGFyQ29yZU5vZGUgIS52YWx1ZSBhcyBzdHJpbmc7XG5cbiAgICBjb25zdCBkZXZEZXBlbmRlbmNpZXM6IHtbazogc3RyaW5nXTogc3RyaW5nfSA9IHtcbiAgICAgICdAYW5ndWxhci9iYXplbCc6IGFuZ3VsYXJDb3JlVmVyc2lvbixcbiAgICAgIC8vIFRPRE8oa3lsaWF1KTogQ29uc2lkZXIgbW92aW5nIHRoaXMgdG8gbGF0ZXN0LXZlcnNpb25zLnRzXG4gICAgICAnQGJhemVsL2JhemVsJzogJ14wLjIxLjAnLFxuICAgICAgJ0BiYXplbC9rYXJtYSc6ICdeMC4yMi4wJyxcbiAgICAgICdAYmF6ZWwvdHlwZXNjcmlwdCc6ICdeMC4yMi4wJyxcbiAgICB9O1xuXG4gICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKHBhY2thZ2VKc29uKTtcbiAgICBmb3IgKGNvbnN0IHBhY2thZ2VOYW1lIG9mIE9iamVjdC5rZXlzKGRldkRlcGVuZGVuY2llcykpIHtcbiAgICAgIGNvbnN0IHZlcnNpb24gPSBkZXZEZXBlbmRlbmNpZXNbcGFja2FnZU5hbWVdO1xuICAgICAgY29uc3QgaW5kZW50ID0gNDtcbiAgICAgIGluc2VydFByb3BlcnR5SW5Bc3RPYmplY3RJbk9yZGVyKHJlY29yZGVyLCBkZXZEZXBzLCBwYWNrYWdlTmFtZSwgdmVyc2lvbiwgaW5kZW50KTtcbiAgICB9XG4gICAgaG9zdC5jb21taXRVcGRhdGUocmVjb3JkZXIpO1xuICAgIHJldHVybiBob3N0O1xuICB9O1xufVxuXG5mdW5jdGlvbiBvdmVyd3JpdGVNYWluQW5kSW5kZXgob3B0aW9uczogU2NoZW1hKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIGxldCBuZXdQcm9qZWN0Um9vdCA9ICcnO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCB3b3Jrc3BhY2UgPSBnZXRXb3Jrc3BhY2UoaG9zdCk7XG4gICAgICBuZXdQcm9qZWN0Um9vdCA9IHdvcmtzcGFjZS5uZXdQcm9qZWN0Um9vdCB8fCAnJztcbiAgICB9IGNhdGNoIHtcbiAgICB9XG4gICAgY29uc3Qgc3JjRGlyID0gYCR7bmV3UHJvamVjdFJvb3R9LyR7b3B0aW9ucy5uYW1lfS9zcmNgO1xuXG4gICAgcmV0dXJuIG1lcmdlV2l0aChcbiAgICAgICAgYXBwbHkoXG4gICAgICAgICAgICB1cmwoJy4vZmlsZXMnKSxcbiAgICAgICAgICAgIFtcbiAgICAgICAgICAgICAgYXBwbHlUZW1wbGF0ZXMoe1xuICAgICAgICAgICAgICAgIHV0aWxzOiBzdHJpbmdzLFxuICAgICAgICAgICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICAgICAgICAgJ2RvdCc6ICcuJyxcbiAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgIG1vdmUoc3JjRGlyKSxcbiAgICAgICAgICAgIF0pLFxuICAgICAgICBNZXJnZVN0cmF0ZWd5Lk92ZXJ3cml0ZSk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIG92ZXJ3cml0ZUdpdGlnbm9yZShvcHRpb25zOiBTY2hlbWEpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgY29uc3QgZ2l0aWdub3JlID0gYCR7b3B0aW9ucy5uYW1lfS8uZ2l0aWdub3JlYDtcbiAgICBpZiAoIWhvc3QuZXhpc3RzKGdpdGlnbm9yZSkpIHtcbiAgICAgIHJldHVybiBob3N0O1xuICAgIH1cbiAgICBjb25zdCBnaXRJZ25vcmVDb250ZW50ID0gaG9zdC5yZWFkKGdpdGlnbm9yZSk7XG4gICAgaWYgKCFnaXRJZ25vcmVDb250ZW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byByZWFkIC5naXRpZ25vcmUgY29udGVudCcpO1xuICAgIH1cblxuICAgIGlmIChnaXRJZ25vcmVDb250ZW50LmluY2x1ZGVzKCcvYmF6ZWwtb3V0XFxuJykpIHtcbiAgICAgIHJldHVybiBob3N0O1xuICAgIH1cbiAgICBjb25zdCBsaW5lcyA9IGdpdElnbm9yZUNvbnRlbnQudG9TdHJpbmcoKS5zcGxpdCgvXFxuL2cpO1xuICAgIGNvbnN0IHJlY29yZGVyID0gaG9zdC5iZWdpblVwZGF0ZShnaXRpZ25vcmUpO1xuICAgIGNvbnN0IGNvbXBpbGVPdXRwdXQgPSBsaW5lcy5maW5kSW5kZXgoKGxpbmU6IHN0cmluZykgPT4gbGluZSA9PT0gJyMgY29tcGlsZWQgb3V0cHV0Jyk7XG4gICAgcmVjb3JkZXIuaW5zZXJ0UmlnaHQoY29tcGlsZU91dHB1dCwgJ1xcbi9iYXplbC1vdXQnKTtcbiAgICBob3N0LmNvbW1pdFVwZGF0ZShyZWNvcmRlcik7XG5cbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuZnVuY3Rpb24gcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QoXG4gICAgcmVjb3JkZXI6IFVwZGF0ZVJlY29yZGVyLCBub2RlOiBKc29uQXN0T2JqZWN0LCBwcm9wZXJ0eU5hbWU6IHN0cmluZywgdmFsdWU6IEpzb25WYWx1ZSxcbiAgICBpbmRlbnQ6IG51bWJlcikge1xuICBjb25zdCBwcm9wZXJ0eSA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KG5vZGUsIHByb3BlcnR5TmFtZSk7XG4gIGlmIChwcm9wZXJ0eSA9PT0gbnVsbCkge1xuICAgIHRocm93IG5ldyBFcnJvcihgUHJvcGVydHkgJHtwcm9wZXJ0eU5hbWV9IGRvZXMgbm90IGV4aXN0IGluIEpTT04gb2JqZWN0YCk7XG4gIH1cbiAgY29uc3Qge3N0YXJ0LCB0ZXh0fSA9IHByb3BlcnR5O1xuICByZWNvcmRlci5yZW1vdmUoc3RhcnQub2Zmc2V0LCB0ZXh0Lmxlbmd0aCk7XG4gIGNvbnN0IGluZGVudFN0ciA9ICdcXG4nICtcbiAgICAgICcgJy5yZXBlYXQoaW5kZW50KTtcbiAgY29uc3QgY29udGVudCA9IEpTT04uc3RyaW5naWZ5KHZhbHVlLCBudWxsLCAnICAnKS5yZXBsYWNlKC9cXG4vZywgaW5kZW50U3RyKTtcbiAgcmVjb3JkZXIuaW5zZXJ0TGVmdChzdGFydC5vZmZzZXQsIGNvbnRlbnQpO1xufVxuXG5mdW5jdGlvbiB1cGRhdGVXb3Jrc3BhY2VGaWxlVG9Vc2VCYXplbEJ1aWxkZXIob3B0aW9uczogU2NoZW1hKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSwgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCkgPT4ge1xuICAgIGNvbnN0IHtuYW1lfSA9IG9wdGlvbnM7XG4gICAgY29uc3Qgd29ya3NwYWNlUGF0aCA9IGAke25hbWV9L2FuZ3VsYXIuanNvbmA7XG4gICAgaWYgKCFob3N0LmV4aXN0cyh3b3Jrc3BhY2VQYXRoKSkge1xuICAgICAgdGhyb3cgbmV3IFNjaGVtYXRpY3NFeGNlcHRpb24oYFdvcmtzcGFjZSBmaWxlICR7d29ya3NwYWNlUGF0aH0gbm90IGZvdW5kLmApO1xuICAgIH1cbiAgICBjb25zdCB3b3Jrc3BhY2VCdWZmZXIgPSBob3N0LnJlYWQod29ya3NwYWNlUGF0aCkgITtcbiAgICBjb25zdCB3b3Jrc3BhY2VKc29uQXN0ID0gcGFyc2VKc29uQXN0KHdvcmtzcGFjZUJ1ZmZlci50b1N0cmluZygpKSBhcyBKc29uQXN0T2JqZWN0O1xuICAgIGNvbnN0IHByb2plY3RzID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3Qod29ya3NwYWNlSnNvbkFzdCwgJ3Byb2plY3RzJyk7XG4gICAgaWYgKCFwcm9qZWN0cykge1xuICAgICAgdGhyb3cgbmV3IFNjaGVtYXRpY3NFeGNlcHRpb24oJ0V4cGVjdCBwcm9qZWN0cyBpbiBhbmd1bGFyLmpzb24gdG8gYmUgYW4gT2JqZWN0Jyk7XG4gICAgfVxuICAgIGNvbnN0IHByb2plY3QgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChwcm9qZWN0cyBhcyBKc29uQXN0T2JqZWN0LCBuYW1lKTtcbiAgICBpZiAoIXByb2plY3QpIHtcbiAgICAgIHRocm93IG5ldyBTY2hlbWF0aWNzRXhjZXB0aW9uKGBFeHBlY3RlZCBwcm9qZWN0cyB0byBjb250YWluICR7bmFtZX1gKTtcbiAgICB9XG4gICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKHdvcmtzcGFjZVBhdGgpO1xuICAgIGNvbnN0IGluZGVudCA9IDY7XG4gICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QoXG4gICAgICAgIHJlY29yZGVyLCBwcm9qZWN0IGFzIEpzb25Bc3RPYmplY3QsICdhcmNoaXRlY3QnLCB7XG4gICAgICAgICAgJ2J1aWxkJzoge1xuICAgICAgICAgICAgJ2J1aWxkZXInOiAnQGFuZ3VsYXIvYmF6ZWw6YnVpbGQnLFxuICAgICAgICAgICAgJ29wdGlvbnMnOiB7J3RhcmdldExhYmVsJzogJy8vc3JjOmJ1bmRsZS5qcycsICdiYXplbENvbW1hbmQnOiAnYnVpbGQnfSxcbiAgICAgICAgICAgICdjb25maWd1cmF0aW9ucyc6IHsncHJvZHVjdGlvbic6IHsndGFyZ2V0TGFiZWwnOiAnLy9zcmM6YnVuZGxlJ319XG4gICAgICAgICAgfSxcbiAgICAgICAgICAnc2VydmUnOiB7XG4gICAgICAgICAgICAnYnVpbGRlcic6ICdAYW5ndWxhci9iYXplbDpidWlsZCcsXG4gICAgICAgICAgICAnb3B0aW9ucyc6IHsndGFyZ2V0TGFiZWwnOiAnLy9zcmM6ZGV2c2VydmVyJywgJ2JhemVsQ29tbWFuZCc6ICdydW4nfSxcbiAgICAgICAgICAgICdjb25maWd1cmF0aW9ucyc6IHsncHJvZHVjdGlvbic6IHsndGFyZ2V0TGFiZWwnOiAnLy9zcmM6cHJvZHNlcnZlcid9fVxuICAgICAgICAgIH0sXG4gICAgICAgICAgJ2V4dHJhY3QtaTE4bic6IHtcbiAgICAgICAgICAgICdidWlsZGVyJzogJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyOmV4dHJhY3QtaTE4bicsXG4gICAgICAgICAgICAnb3B0aW9ucyc6IHsnYnJvd3NlclRhcmdldCc6IGAke25hbWV9OmJ1aWxkYH1cbiAgICAgICAgICB9LFxuICAgICAgICAgICd0ZXN0Jzoge1xuICAgICAgICAgICAgJ2J1aWxkZXInOiAnQGFuZ3VsYXIvYmF6ZWw6YnVpbGQnLFxuICAgICAgICAgICAgJ29wdGlvbnMnOiB7J2JhemVsQ29tbWFuZCc6ICd0ZXN0JywgJ3RhcmdldExhYmVsJzogJy8vc3JjLy4uLid9XG4gICAgICAgICAgfSxcbiAgICAgICAgICAnbGludCc6IHtcbiAgICAgICAgICAgICdidWlsZGVyJzogJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyOnRzbGludCcsXG4gICAgICAgICAgICAnb3B0aW9ucyc6IHtcbiAgICAgICAgICAgICAgJ3RzQ29uZmlnJzogWydzcmMvdHNjb25maWcuYXBwLmpzb24nLCAnc3JjL3RzY29uZmlnLnNwZWMuanNvbiddLFxuICAgICAgICAgICAgICAnZXhjbHVkZSc6IFsnKiovbm9kZV9tb2R1bGVzLyoqJ11cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGluZGVudCk7XG5cbiAgICBjb25zdCBlMmUgPSBgJHtvcHRpb25zLm5hbWV9LWUyZWA7XG4gICAgY29uc3QgZTJlTm9kZSA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KHByb2plY3RzIGFzIEpzb25Bc3RPYmplY3QsIGUyZSk7XG4gICAgaWYgKGUyZU5vZGUpIHtcbiAgICAgIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0KFxuICAgICAgICAgIHJlY29yZGVyLCBlMmVOb2RlIGFzIEpzb25Bc3RPYmplY3QsICdhcmNoaXRlY3QnLCB7XG4gICAgICAgICAgICAnZTJlJzoge1xuICAgICAgICAgICAgICAnYnVpbGRlcic6ICdAYW5ndWxhci9iYXplbDpidWlsZCcsXG4gICAgICAgICAgICAgICdvcHRpb25zJzogeydiYXplbENvbW1hbmQnOiAndGVzdCcsICd0YXJnZXRMYWJlbCc6ICcvL2UyZTpkZXZzZXJ2ZXJfdGVzdCd9LFxuICAgICAgICAgICAgICAnY29uZmlndXJhdGlvbnMnOiB7J3Byb2R1Y3Rpb24nOiB7J3RhcmdldExhYmVsJzogJy8vZTJlOnByb2RzZXJ2ZXJfdGVzdCd9fVxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICdsaW50Jzoge1xuICAgICAgICAgICAgICAnYnVpbGRlcic6ICdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhcjp0c2xpbnQnLFxuICAgICAgICAgICAgICAnb3B0aW9ucyc6IHsndHNDb25maWcnOiAnZTJlL3RzY29uZmlnLmUyZS5qc29uJywgJ2V4Y2x1ZGUnOiBbJyoqL25vZGVfbW9kdWxlcy8qKiddfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgICAgICAgaW5kZW50KTtcbiAgICB9XG5cbiAgICBob3N0LmNvbW1pdFVwZGF0ZShyZWNvcmRlcik7XG4gICAgcmV0dXJuIGhvc3Q7XG4gIH07XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKG9wdGlvbnM6IFNjaGVtYSk6IFJ1bGUge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUpID0+IHtcbiAgICB2YWxpZGF0ZVByb2plY3ROYW1lKG9wdGlvbnMubmFtZSk7XG5cbiAgICByZXR1cm4gY2hhaW4oW1xuICAgICAgZXh0ZXJuYWxTY2hlbWF0aWMoJ0BzY2hlbWF0aWNzL2FuZ3VsYXInLCAnbmctbmV3Jywge1xuICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICBza2lwSW5zdGFsbDogdHJ1ZSxcbiAgICAgIH0pLFxuICAgICAgYWRkRGV2RGVwZW5kZW5jaWVzVG9QYWNrYWdlSnNvbihvcHRpb25zKSxcbiAgICAgIHNjaGVtYXRpYygnYmF6ZWwtd29ya3NwYWNlJywgb3B0aW9ucyksXG4gICAgICBvdmVyd3JpdGVNYWluQW5kSW5kZXgob3B0aW9ucyksXG4gICAgICBvdmVyd3JpdGVHaXRpZ25vcmUob3B0aW9ucyksXG4gICAgICB1cGRhdGVXb3Jrc3BhY2VGaWxlVG9Vc2VCYXplbEJ1aWxkZXIob3B0aW9ucyksXG4gICAgXSk7XG4gIH07XG59XG4iXX0=
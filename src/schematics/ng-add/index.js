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
        define("npm_angular_bazel/src/schematics/ng-add/index", ["require", "exports", "tslib", "@angular-devkit/core", "@angular-devkit/schematics", "@schematics/angular/utility/config", "@schematics/angular/utility/json-utils", "@schematics/angular/utility/validation", "@angular/bazel/src/schematics/utility/json-utils"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var core_1 = require("@angular-devkit/core");
    var schematics_1 = require("@angular-devkit/schematics");
    var config_1 = require("@schematics/angular/utility/config");
    var json_utils_1 = require("@schematics/angular/utility/json-utils");
    var validation_1 = require("@schematics/angular/utility/validation");
    var json_utils_2 = require("@angular/bazel/src/schematics/utility/json-utils");
    /**
     * Packages that build under Bazel require additional dev dependencies. This
     * function adds those dependencies to "devDependencies" section in
     * package.json.
     */
    function addDevDependenciesToPackageJson(options) {
        return function (host) {
            var e_1, _a;
            var packageJson = 'package.json';
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
            if (!angularCoreNode) {
                throw new Error('@angular/core dependency not found in package.json');
            }
            var angularCoreVersion = angularCoreNode.value;
            var devDependencies = {
                '@angular/bazel': angularCoreVersion,
                '@angular/upgrade': angularCoreVersion,
                '@bazel/bazel': '^0.23.0',
                '@bazel/ibazel': '^0.9.0',
                '@bazel/karma': '^0.26.0',
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
    /**
     * Append additional Javascript / Typescript files needed to compile an Angular
     * project under Bazel.
     */
    function addFilesRequiredByBazel(options) {
        return function (host) {
            return schematics_1.mergeWith(schematics_1.apply(schematics_1.url('./files'), [
                schematics_1.applyTemplates({}),
            ]));
        };
    }
    /**
     * Append '/bazel-out' to the gitignore file.
     */
    function updateGitignore() {
        return function (host) {
            var gitignore = '/.gitignore';
            if (!host.exists(gitignore)) {
                return host;
            }
            var gitIgnoreContent = host.read(gitignore).toString();
            if (gitIgnoreContent.includes('\n/bazel-out\n')) {
                return host;
            }
            var compiledOutput = '# compiled output\n';
            var index = gitIgnoreContent.indexOf(compiledOutput);
            var insertionIndex = index >= 0 ? index + compiledOutput.length : gitIgnoreContent.length;
            var recorder = host.beginUpdate(gitignore);
            recorder.insertRight(insertionIndex, '/bazel-out\n');
            host.commitUpdate(recorder);
            return host;
        };
    }
    function updateAngularJsonToUseBazelBuilder(options) {
        return function (host, context) {
            var name = options.name;
            var workspacePath = config_1.getWorkspacePath(host);
            if (!workspacePath) {
                throw new Error('Could not find angular.json');
            }
            var workspaceContent = host.read(workspacePath).toString();
            var workspaceJsonAst = core_1.parseJsonAst(workspaceContent);
            var projects = json_utils_1.findPropertyInAstObject(workspaceJsonAst, 'projects');
            if (!projects) {
                throw new schematics_1.SchematicsException('Expect projects in angular.json to be an Object');
            }
            var project = json_utils_1.findPropertyInAstObject(projects, name);
            if (!project) {
                throw new schematics_1.SchematicsException("Expected projects to contain " + name);
            }
            var recorder = host.beginUpdate(workspacePath);
            var indent = 8;
            var architect = json_utils_1.findPropertyInAstObject(project, 'architect');
            json_utils_2.replacePropertyInAstObject(recorder, architect, 'build', {
                builder: '@angular/bazel:build',
                options: {
                    targetLabel: '//src:prodapp',
                    bazelCommand: 'build',
                }
            }, indent);
            json_utils_2.replacePropertyInAstObject(recorder, architect, 'serve', {
                builder: '@angular/bazel:build',
                options: {
                    targetLabel: '//src:devserver',
                    bazelCommand: 'run',
                    watch: true,
                },
                configurations: {
                    production: {
                        targetLabel: '//src:prodserver',
                    },
                },
            }, indent);
            json_utils_2.replacePropertyInAstObject(recorder, architect, 'test', {
                builder: '@angular/bazel:build',
                options: { 'bazelCommand': 'test', 'targetLabel': '//src/...' },
            }, indent);
            var e2e = options.name + "-e2e";
            var e2eNode = json_utils_1.findPropertyInAstObject(projects, e2e);
            if (e2eNode) {
                var architect_1 = json_utils_1.findPropertyInAstObject(e2eNode, 'architect');
                json_utils_2.replacePropertyInAstObject(recorder, architect_1, 'e2e', {
                    builder: '@angular/bazel:build',
                    options: {
                        bazelCommand: 'test',
                        targetLabel: '//e2e:devserver_test',
                    },
                    configurations: {
                        production: {
                            targetLabel: '//e2e:prodserver_test',
                        },
                    }
                }, indent);
            }
            host.commitUpdate(recorder);
            return host;
        };
    }
    /**
     * Create a backup for the original angular.json file in case user wants to
     * eject Bazel and revert to the original workflow.
     */
    function backupAngularJson() {
        return function (host, context) {
            var workspacePath = config_1.getWorkspacePath(host);
            if (!workspacePath) {
                return;
            }
            host.create(workspacePath + ".bak", '// This is a backup file of the original angular.json. ' +
                'This file is needed in case you want to revert to the workflow without Bazel.\n\n' +
                host.read(workspacePath));
        };
    }
    /**
     * Create a backup for the original tsconfig.json file in case user wants to
     * eject Bazel and revert to the original workflow.
     */
    function backupTsconfigJson() {
        return function (host, context) {
            var tsconfigPath = 'tsconfig.json';
            if (!host.exists(tsconfigPath)) {
                return;
            }
            host.create(tsconfigPath + ".bak", '// This is a backup file of the original tsconfig.json. ' +
                'This file is needed in case you want to revert to the workflow without Bazel.\n\n' +
                host.read(tsconfigPath));
        };
    }
    /**
     * Bazel controls the compilation options of tsc, so many options in
     * tsconfig.json generated by the default CLI schematics are not applicable.
     * This function updates the tsconfig.json to remove Bazel-controlled
     * parameters. This prevents Bazel from printing out warnings about overriden
     * settings.
     */
    function updateTsconfigJson() {
        return function (host, context) {
            var tsconfigPath = 'tsconfig.json';
            if (!host.exists(tsconfigPath)) {
                return host;
            }
            var content = host.read(tsconfigPath).toString();
            var ast = core_1.parseJsonAst(content);
            if (!json_utils_2.isJsonAstObject(ast)) {
                return host;
            }
            var compilerOptions = json_utils_1.findPropertyInAstObject(ast, 'compilerOptions');
            if (!json_utils_2.isJsonAstObject(compilerOptions)) {
                return host;
            }
            var recorder = host.beginUpdate(tsconfigPath);
            // target and module are controlled by downstream dependencies, such as
            // ts_devserver
            json_utils_2.removeKeyValueInAstObject(recorder, content, compilerOptions, 'target');
            json_utils_2.removeKeyValueInAstObject(recorder, content, compilerOptions, 'module');
            // typeRoots is always set to the @types subdirectory of the node_modules
            // attribute
            json_utils_2.removeKeyValueInAstObject(recorder, content, compilerOptions, 'typeRoots');
            // rootDir and baseUrl are always the workspace root directory
            json_utils_2.removeKeyValueInAstObject(recorder, content, compilerOptions, 'rootDir');
            json_utils_2.removeKeyValueInAstObject(recorder, content, compilerOptions, 'baseUrl');
            host.commitUpdate(recorder);
            return host;
        };
    }
    /**
     * @angular/bazel requires minimum version of rxjs to be 6.4.0. This function
     * upgrades the version of rxjs in package.json if necessary.
     */
    function upgradeRxjs() {
        return function (host, context) {
            var packageJson = 'package.json';
            if (!host.exists(packageJson)) {
                throw new Error("Could not find " + packageJson);
            }
            var content = host.read(packageJson).toString();
            var jsonAst = core_1.parseJsonAst(content);
            if (!json_utils_2.isJsonAstObject(jsonAst)) {
                throw new Error("Failed to parse JSON for " + packageJson);
            }
            var deps = json_utils_1.findPropertyInAstObject(jsonAst, 'dependencies');
            if (!json_utils_2.isJsonAstObject(deps)) {
                throw new Error("Failed to find dependencies in " + packageJson);
            }
            var rxjs = json_utils_1.findPropertyInAstObject(deps, 'rxjs');
            if (!rxjs) {
                throw new Error("Failed to find rxjs in dependencies of " + packageJson);
            }
            var value = rxjs.value; // value can be version or range
            var match = value.match(/(\d)+\.(\d)+.(\d)+$/);
            if (match) {
                var _a = tslib_1.__read(match, 3), _ = _a[0], major = _a[1], minor = _a[2];
                if (major < '6' || (major === '6' && minor < '4')) {
                    var recorder = host.beginUpdate(packageJson);
                    json_utils_2.replacePropertyInAstObject(recorder, deps, 'rxjs', '~6.4.0');
                    host.commitUpdate(recorder);
                }
            }
            else {
                context.logger.info('Could not determine version of rxjs. \n' +
                    'Please make sure that version is at least 6.4.0.');
            }
            return host;
        };
    }
    /**
     * When using Angular NPM packages and building with AOT compilation, ngc
     * requires ngsumamry files but they are not shipped. This function adds a
     * postinstall step to generate these files.
     */
    function addPostinstallToGenerateNgSummaries() {
        return function (host, context) {
            if (!host.exists('angular-metadata.tsconfig.json')) {
                return;
            }
            var packageJson = 'package.json';
            if (!host.exists(packageJson)) {
                throw new Error("Could not find " + packageJson);
            }
            var content = host.read(packageJson).toString();
            var jsonAst = core_1.parseJsonAst(content);
            var scripts = json_utils_1.findPropertyInAstObject(jsonAst, 'scripts');
            var recorder = host.beginUpdate(packageJson);
            if (scripts) {
                json_utils_1.insertPropertyInAstObjectInOrder(recorder, scripts, 'postinstall', 'ngc -p ./angular-metadata.tsconfig.json', 4);
            }
            else {
                json_utils_1.insertPropertyInAstObjectInOrder(recorder, jsonAst, 'scripts', {
                    postinstall: 'ngc -p ./angular-metadata.tsconfig.json',
                }, 2);
            }
            host.commitUpdate(recorder);
            return host;
        };
    }
    function default_1(options) {
        return function (host) {
            validation_1.validateProjectName(options.name);
            return schematics_1.chain([
                addFilesRequiredByBazel(options),
                addDevDependenciesToPackageJson(options),
                addPostinstallToGenerateNgSummaries(),
                backupAngularJson(),
                backupTsconfigJson(),
                updateAngularJsonToUseBazelBuilder(options),
                updateGitignore(),
                updateTsconfigJson(),
                upgradeRxjs(),
            ]);
        };
    }
    exports.default = default_1;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvc2NoZW1hdGljcy9uZy1hZGQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCw2Q0FBMEU7SUFDMUUseURBQTRKO0lBQzVKLDZEQUFvRTtJQUNwRSxxRUFBaUg7SUFDakgscUVBQTJFO0lBQzNFLCtFQUE2RztJQUc3Rzs7OztPQUlHO0lBQ0gsU0FBUywrQkFBK0IsQ0FBQyxPQUFlO1FBQ3RELE9BQU8sVUFBQyxJQUFVOztZQUNoQixJQUFNLFdBQVcsR0FBRyxjQUFjLENBQUM7WUFDbkMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLEVBQUU7Z0JBQzdCLE1BQU0sSUFBSSxLQUFLLENBQUMsb0JBQWtCLFdBQWEsQ0FBQyxDQUFDO2FBQ2xEO1lBQ0QsSUFBTSxrQkFBa0IsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQ2xELElBQUksQ0FBQyxrQkFBa0IsRUFBRTtnQkFDdkIsTUFBTSxJQUFJLEtBQUssQ0FBQyxxQ0FBcUMsQ0FBQyxDQUFDO2FBQ3hEO1lBQ0QsSUFBTSxPQUFPLEdBQUcsbUJBQVksQ0FBQyxrQkFBa0IsQ0FBQyxRQUFRLEVBQUUsQ0FBa0IsQ0FBQztZQUM3RSxJQUFNLElBQUksR0FBRyxvQ0FBdUIsQ0FBQyxPQUFPLEVBQUUsY0FBYyxDQUFrQixDQUFDO1lBQy9FLElBQU0sT0FBTyxHQUFHLG9DQUF1QixDQUFDLE9BQU8sRUFBRSxpQkFBaUIsQ0FBa0IsQ0FBQztZQUVyRixJQUFNLGVBQWUsR0FBRyxvQ0FBdUIsQ0FBQyxJQUFJLEVBQUUsZUFBZSxDQUFDLENBQUM7WUFDdkUsSUFBSSxDQUFDLGVBQWUsRUFBRTtnQkFDcEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxvREFBb0QsQ0FB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QUU7Z0JBQ25CLGtCQUFrQixFQUFFO2dCQUNwQixrQ0FBa0MsQ0FBQyxPQUFPLENBQUM7Z0JBQzNDLGVBQWUsRUFBRTtnQkFDakIsa0JBQWtCLEVBQUU7Z0JBQ3BCLFdBQVcsRUFBRTthQUNkLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQztJQUNKLENBQUM7SUFoQkQsNEJBZ0JDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqXG4gKiBAZmlsZW92ZXJ2aWV3IFNjaGVtYXRpY3MgZm9yIG5nLW5ldyBwcm9qZWN0IHRoYXQgYnVpbGRzIHdpdGggQmF6ZWwuXG4gKi9cblxuaW1wb3J0IHtKc29uQXN0T2JqZWN0LCBwYXJzZUpzb25Bc3QsIHN0cmluZ3N9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7UnVsZSwgU2NoZW1hdGljQ29udGV4dCwgU2NoZW1hdGljc0V4Y2VwdGlvbiwgVHJlZSwgYXBwbHksIGFwcGx5VGVtcGxhdGVzLCBjaGFpbiwgbWVyZ2VXaXRoLCBtb3ZlLCBzY2hlbWF0aWMsIHVybH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L3NjaGVtYXRpY3MnO1xuaW1wb3J0IHtnZXRXb3Jrc3BhY2VQYXRofSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvY29uZmlnJztcbmltcG9ydCB7ZmluZFByb3BlcnR5SW5Bc3RPYmplY3QsIGluc2VydFByb3BlcnR5SW5Bc3RPYmplY3RJbk9yZGVyfSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvanNvbi11dGlscyc7XG5pbXBvcnQge3ZhbGlkYXRlUHJvamVjdE5hbWV9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS92YWxpZGF0aW9uJztcbmltcG9ydCB7aXNKc29uQXN0T2JqZWN0LCByZW1vdmVLZXlWYWx1ZUluQXN0T2JqZWN0LCByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdH0gZnJvbSAnLi4vdXRpbGl0eS9qc29uLXV0aWxzJztcbmltcG9ydCB7U2NoZW1hfSBmcm9tICcuL3NjaGVtYSc7XG5cbi8qKlxuICogUGFja2FnZXMgdGhhdCBidWlsZCB1bmRlciBCYXplbCByZXF1aXJlIGFkZGl0aW9uYWwgZGV2IGRlcGVuZGVuY2llcy4gVGhpc1xuICogZnVuY3Rpb24gYWRkcyB0aG9zZSBkZXBlbmRlbmNpZXMgdG8gXCJkZXZEZXBlbmRlbmNpZXNcIiBzZWN0aW9uIGluXG4gKiBwYWNrYWdlLmpzb24uXG4gKi9cbmZ1bmN0aW9uIGFkZERldkRlcGVuZGVuY2llc1RvUGFja2FnZUpzb24ob3B0aW9uczogU2NoZW1hKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIGNvbnN0IHBhY2thZ2VKc29uID0gJ3BhY2thZ2UuanNvbic7XG4gICAgaWYgKCFob3N0LmV4aXN0cyhwYWNrYWdlSnNvbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IGZpbmQgJHtwYWNrYWdlSnNvbn1gKTtcbiAgICB9XG4gICAgY29uc3QgcGFja2FnZUpzb25Db250ZW50ID0gaG9zdC5yZWFkKHBhY2thZ2VKc29uKTtcbiAgICBpZiAoIXBhY2thZ2VKc29uQ29udGVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gcmVhZCBwYWNrYWdlLmpzb24gY29udGVudCcpO1xuICAgIH1cbiAgICBjb25zdCBqc29uQXN0ID0gcGFyc2VKc29uQXN0KHBhY2thZ2VKc29uQ29udGVudC50b1N0cmluZygpKSBhcyBKc29uQXN0T2JqZWN0O1xuICAgIGNvbnN0IGRlcHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChqc29uQXN0LCAnZGVwZW5kZW5jaWVzJykgYXMgSnNvbkFzdE9iamVjdDtcbiAgICBjb25zdCBkZXZEZXBzID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoanNvbkFzdCwgJ2RldkRlcGVuZGVuY2llcycpIGFzIEpzb25Bc3RPYmplY3Q7XG5cbiAgICBjb25zdCBhbmd1bGFyQ29yZU5vZGUgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChkZXBzLCAnQGFuZ3VsYXIvY29yZScpO1xuICAgIGlmICghYW5ndWxhckNvcmVOb2RlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Bhbmd1bGFyL2NvcmUgZGVwZW5kZW5jeSBub3QgZm91bmQgaW4gcGFja2FnZS5qc29uJyk7XG4gICAgfVxuICAgIGNvbnN0IGFuZ3VsYXJDb3JlVmVyc2lvbiA9IGFuZ3VsYXJDb3JlTm9kZS52YWx1ZSBhcyBzdHJpbmc7XG5cbiAgICBjb25zdCBkZXZEZXBlbmRlbmNpZXM6IHtbazogc3RyaW5nXTogc3RyaW5nfSA9IHtcbiAgICAgICdAYW5ndWxhci9iYXplbCc6IGFuZ3VsYXJDb3JlVmVyc2lvbixcbiAgICAgICdAYW5ndWxhci91cGdyYWRlJzogYW5ndWxhckNvcmVWZXJzaW9uLFxuICAgICAgJ0BiYXplbC9iYXplbCc6ICdeMC4yMy4wJyxcbiAgICAgICdAYmF6ZWwvaWJhemVsJzogJ14wLjkuMCcsXG4gICAgICAnQGJhemVsL2thcm1hJzogJ14wLjI2LjAnLFxuICAgIH07XG5cbiAgICBjb25zdCByZWNvcmRlciA9IGhvc3QuYmVnaW5VcGRhdGUocGFja2FnZUpzb24pO1xuICAgIGZvciAoY29uc3QgcGFja2FnZU5hbWUgb2YgT2JqZWN0LmtleXMoZGV2RGVwZW5kZW5jaWVzKSkge1xuICAgICAgY29uc3QgdmVyc2lvbiA9IGRldkRlcGVuZGVuY2llc1twYWNrYWdlTmFtZV07XG4gICAgICBjb25zdCBpbmRlbnQgPSA0O1xuICAgICAgaW5zZXJ0UHJvcGVydHlJbkFzdE9iamVjdEluT3JkZXIocmVjb3JkZXIsIGRldkRlcHMsIHBhY2thZ2VOYW1lLCB2ZXJzaW9uLCBpbmRlbnQpO1xuICAgIH1cbiAgICBob3N0LmNvbW1pdFVwZGF0ZShyZWNvcmRlcik7XG4gICAgcmV0dXJuIGhvc3Q7XG4gIH07XG59XG5cbi8qKlxuICogQXBwZW5kIGFkZGl0aW9uYWwgSmF2YXNjcmlwdCAvIFR5cGVzY3JpcHQgZmlsZXMgbmVlZGVkIHRvIGNvbXBpbGUgYW4gQW5ndWxhclxuICogcHJvamVjdCB1bmRlciBCYXplbC5cbiAqL1xuZnVuY3Rpb24gYWRkRmlsZXNSZXF1aXJlZEJ5QmF6ZWwob3B0aW9uczogU2NoZW1hKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIHJldHVybiBtZXJnZVdpdGgoYXBwbHkodXJsKCcuL2ZpbGVzJyksIFtcbiAgICAgIGFwcGx5VGVtcGxhdGVzKHt9KSxcbiAgICBdKSk7XG4gIH07XG59XG5cbi8qKlxuICogQXBwZW5kICcvYmF6ZWwtb3V0JyB0byB0aGUgZ2l0aWdub3JlIGZpbGUuXG4gKi9cbmZ1bmN0aW9uIHVwZGF0ZUdpdGlnbm9yZSgpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgY29uc3QgZ2l0aWdub3JlID0gJy8uZ2l0aWdub3JlJztcbiAgICBpZiAoIWhvc3QuZXhpc3RzKGdpdGlnbm9yZSkpIHtcbiAgICAgIHJldHVybiBob3N0O1xuICAgIH1cbiAgICBjb25zdCBnaXRJZ25vcmVDb250ZW50ID0gaG9zdC5yZWFkKGdpdGlnbm9yZSkudG9TdHJpbmcoKTtcbiAgICBpZiAoZ2l0SWdub3JlQ29udGVudC5pbmNsdWRlcygnXFxuL2JhemVsLW91dFxcbicpKSB7XG4gICAgICByZXR1cm4gaG9zdDtcbiAgICB9XG4gICAgY29uc3QgY29tcGlsZWRPdXRwdXQgPSAnIyBjb21waWxlZCBvdXRwdXRcXG4nO1xuICAgIGNvbnN0IGluZGV4ID0gZ2l0SWdub3JlQ29udGVudC5pbmRleE9mKGNvbXBpbGVkT3V0cHV0KTtcbiAgICBjb25zdCBpbnNlcnRpb25JbmRleCA9IGluZGV4ID49IDAgPyBpbmRleCArIGNvbXBpbGVkT3V0cHV0Lmxlbmd0aCA6IGdpdElnbm9yZUNvbnRlbnQubGVuZ3RoO1xuICAgIGNvbnN0IHJlY29yZGVyID0gaG9zdC5iZWdpblVwZGF0ZShnaXRpZ25vcmUpO1xuICAgIHJlY29yZGVyLmluc2VydFJpZ2h0KGluc2VydGlvbkluZGV4LCAnL2JhemVsLW91dFxcbicpO1xuICAgIGhvc3QuY29tbWl0VXBkYXRlKHJlY29yZGVyKTtcbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuZnVuY3Rpb24gdXBkYXRlQW5ndWxhckpzb25Ub1VzZUJhemVsQnVpbGRlcihvcHRpb25zOiBTY2hlbWEpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgY29uc3Qge25hbWV9ID0gb3B0aW9ucztcbiAgICBjb25zdCB3b3Jrc3BhY2VQYXRoID0gZ2V0V29ya3NwYWNlUGF0aChob3N0KTtcbiAgICBpZiAoIXdvcmtzcGFjZVBhdGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IGZpbmQgYW5ndWxhci5qc29uJyk7XG4gICAgfVxuICAgIGNvbnN0IHdvcmtzcGFjZUNvbnRlbnQgPSBob3N0LnJlYWQod29ya3NwYWNlUGF0aCkudG9TdHJpbmcoKTtcbiAgICBjb25zdCB3b3Jrc3BhY2VKc29uQXN0ID0gcGFyc2VKc29uQXN0KHdvcmtzcGFjZUNvbnRlbnQpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgY29uc3QgcHJvamVjdHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdCh3b3Jrc3BhY2VKc29uQXN0LCAncHJvamVjdHMnKTtcbiAgICBpZiAoIXByb2plY3RzKSB7XG4gICAgICB0aHJvdyBuZXcgU2NoZW1hdGljc0V4Y2VwdGlvbignRXhwZWN0IHByb2plY3RzIGluIGFuZ3VsYXIuanNvbiB0byBiZSBhbiBPYmplY3QnKTtcbiAgICB9XG4gICAgY29uc3QgcHJvamVjdCA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KHByb2plY3RzIGFzIEpzb25Bc3RPYmplY3QsIG5hbWUpO1xuICAgIGlmICghcHJvamVjdCkge1xuICAgICAgdGhyb3cgbmV3IFNjaGVtYXRpY3NFeGNlcHRpb24oYEV4cGVjdGVkIHByb2plY3RzIHRvIGNvbnRhaW4gJHtuYW1lfWApO1xuICAgIH1cbiAgICBjb25zdCByZWNvcmRlciA9IGhvc3QuYmVnaW5VcGRhdGUod29ya3NwYWNlUGF0aCk7XG4gICAgY29uc3QgaW5kZW50ID0gODtcbiAgICBjb25zdCBhcmNoaXRlY3QgPVxuICAgICAgICBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChwcm9qZWN0IGFzIEpzb25Bc3RPYmplY3QsICdhcmNoaXRlY3QnKSBhcyBKc29uQXN0T2JqZWN0O1xuICAgIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0KFxuICAgICAgICByZWNvcmRlciwgYXJjaGl0ZWN0LCAnYnVpbGQnLCB7XG4gICAgICAgICAgYnVpbGRlcjogJ0Bhbmd1bGFyL2JhemVsOmJ1aWxkJyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vc3JjOnByb2RhcHAnLFxuICAgICAgICAgICAgYmF6ZWxDb21tYW5kOiAnYnVpbGQnLFxuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgaW5kZW50KTtcbiAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChcbiAgICAgICAgcmVjb3JkZXIsIGFyY2hpdGVjdCwgJ3NlcnZlJywge1xuICAgICAgICAgIGJ1aWxkZXI6ICdAYW5ndWxhci9iYXplbDpidWlsZCcsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgdGFyZ2V0TGFiZWw6ICcvL3NyYzpkZXZzZXJ2ZXInLFxuICAgICAgICAgICAgYmF6ZWxDb21tYW5kOiAncnVuJyxcbiAgICAgICAgICAgIHdhdGNoOiB0cnVlLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgY29uZmlndXJhdGlvbnM6IHtcbiAgICAgICAgICAgIHByb2R1Y3Rpb246IHtcbiAgICAgICAgICAgICAgdGFyZ2V0TGFiZWw6ICcvL3NyYzpwcm9kc2VydmVyJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgaW5kZW50KTtcbiAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChcbiAgICAgICAgcmVjb3JkZXIsIGFyY2hpdGVjdCwgJ3Rlc3QnLCB7XG4gICAgICAgICAgYnVpbGRlcjogJ0Bhbmd1bGFyL2JhemVsOmJ1aWxkJyxcbiAgICAgICAgICBvcHRpb25zOiB7J2JhemVsQ29tbWFuZCc6ICd0ZXN0JywgJ3RhcmdldExhYmVsJzogJy8vc3JjLy4uLid9LFxuICAgICAgICB9LFxuICAgICAgICBpbmRlbnQpO1xuXG4gICAgY29uc3QgZTJlID0gYCR7b3B0aW9ucy5uYW1lfS1lMmVgO1xuICAgIGNvbnN0IGUyZU5vZGUgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChwcm9qZWN0cyBhcyBKc29uQXN0T2JqZWN0LCBlMmUpO1xuICAgIGlmIChlMmVOb2RlKSB7XG4gICAgICBjb25zdCBhcmNoaXRlY3QgPVxuICAgICAgICAgIGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGUyZU5vZGUgYXMgSnNvbkFzdE9iamVjdCwgJ2FyY2hpdGVjdCcpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChcbiAgICAgICAgICByZWNvcmRlciwgYXJjaGl0ZWN0LCAnZTJlJywge1xuICAgICAgICAgICAgYnVpbGRlcjogJ0Bhbmd1bGFyL2JhemVsOmJ1aWxkJyxcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgYmF6ZWxDb21tYW5kOiAndGVzdCcsXG4gICAgICAgICAgICAgIHRhcmdldExhYmVsOiAnLy9lMmU6ZGV2c2VydmVyX3Rlc3QnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYXRpb25zOiB7XG4gICAgICAgICAgICAgIHByb2R1Y3Rpb246IHtcbiAgICAgICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vZTJlOnByb2RzZXJ2ZXJfdGVzdCcsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICBpbmRlbnQpO1xuICAgIH1cblxuICAgIGhvc3QuY29tbWl0VXBkYXRlKHJlY29yZGVyKTtcbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBiYWNrdXAgZm9yIHRoZSBvcmlnaW5hbCBhbmd1bGFyLmpzb24gZmlsZSBpbiBjYXNlIHVzZXIgd2FudHMgdG9cbiAqIGVqZWN0IEJhemVsIGFuZCByZXZlcnQgdG8gdGhlIG9yaWdpbmFsIHdvcmtmbG93LlxuICovXG5mdW5jdGlvbiBiYWNrdXBBbmd1bGFySnNvbigpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgY29uc3Qgd29ya3NwYWNlUGF0aCA9IGdldFdvcmtzcGFjZVBhdGgoaG9zdCk7XG4gICAgaWYgKCF3b3Jrc3BhY2VQYXRoKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGhvc3QuY3JlYXRlKFxuICAgICAgICBgJHt3b3Jrc3BhY2VQYXRofS5iYWtgLCAnLy8gVGhpcyBpcyBhIGJhY2t1cCBmaWxlIG9mIHRoZSBvcmlnaW5hbCBhbmd1bGFyLmpzb24uICcgK1xuICAgICAgICAgICAgJ1RoaXMgZmlsZSBpcyBuZWVkZWQgaW4gY2FzZSB5b3Ugd2FudCB0byByZXZlcnQgdG8gdGhlIHdvcmtmbG93IHdpdGhvdXQgQmF6ZWwuXFxuXFxuJyArXG4gICAgICAgICAgICBob3N0LnJlYWQod29ya3NwYWNlUGF0aCkpO1xuICB9O1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIGJhY2t1cCBmb3IgdGhlIG9yaWdpbmFsIHRzY29uZmlnLmpzb24gZmlsZSBpbiBjYXNlIHVzZXIgd2FudHMgdG9cbiAqIGVqZWN0IEJhemVsIGFuZCByZXZlcnQgdG8gdGhlIG9yaWdpbmFsIHdvcmtmbG93LlxuICovXG5mdW5jdGlvbiBiYWNrdXBUc2NvbmZpZ0pzb24oKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSwgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCkgPT4ge1xuICAgIGNvbnN0IHRzY29uZmlnUGF0aCA9ICd0c2NvbmZpZy5qc29uJztcbiAgICBpZiAoIWhvc3QuZXhpc3RzKHRzY29uZmlnUGF0aCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaG9zdC5jcmVhdGUoXG4gICAgICAgIGAke3RzY29uZmlnUGF0aH0uYmFrYCwgJy8vIFRoaXMgaXMgYSBiYWNrdXAgZmlsZSBvZiB0aGUgb3JpZ2luYWwgdHNjb25maWcuanNvbi4gJyArXG4gICAgICAgICAgICAnVGhpcyBmaWxlIGlzIG5lZWRlZCBpbiBjYXNlIHlvdSB3YW50IHRvIHJldmVydCB0byB0aGUgd29ya2Zsb3cgd2l0aG91dCBCYXplbC5cXG5cXG4nICtcbiAgICAgICAgICAgIGhvc3QucmVhZCh0c2NvbmZpZ1BhdGgpKTtcbiAgfTtcbn1cblxuLyoqXG4gKiBCYXplbCBjb250cm9scyB0aGUgY29tcGlsYXRpb24gb3B0aW9ucyBvZiB0c2MsIHNvIG1hbnkgb3B0aW9ucyBpblxuICogdHNjb25maWcuanNvbiBnZW5lcmF0ZWQgYnkgdGhlIGRlZmF1bHQgQ0xJIHNjaGVtYXRpY3MgYXJlIG5vdCBhcHBsaWNhYmxlLlxuICogVGhpcyBmdW5jdGlvbiB1cGRhdGVzIHRoZSB0c2NvbmZpZy5qc29uIHRvIHJlbW92ZSBCYXplbC1jb250cm9sbGVkXG4gKiBwYXJhbWV0ZXJzLiBUaGlzIHByZXZlbnRzIEJhemVsIGZyb20gcHJpbnRpbmcgb3V0IHdhcm5pbmdzIGFib3V0IG92ZXJyaWRlblxuICogc2V0dGluZ3MuXG4gKi9cbmZ1bmN0aW9uIHVwZGF0ZVRzY29uZmlnSnNvbigpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgY29uc3QgdHNjb25maWdQYXRoID0gJ3RzY29uZmlnLmpzb24nO1xuICAgIGlmICghaG9zdC5leGlzdHModHNjb25maWdQYXRoKSkge1xuICAgICAgcmV0dXJuIGhvc3Q7XG4gICAgfVxuICAgIGNvbnN0IGNvbnRlbnQgPSBob3N0LnJlYWQodHNjb25maWdQYXRoKS50b1N0cmluZygpO1xuICAgIGNvbnN0IGFzdCA9IHBhcnNlSnNvbkFzdChjb250ZW50KTtcbiAgICBpZiAoIWlzSnNvbkFzdE9iamVjdChhc3QpKSB7XG4gICAgICByZXR1cm4gaG9zdDtcbiAgICB9XG4gICAgY29uc3QgY29tcGlsZXJPcHRpb25zID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoYXN0LCAnY29tcGlsZXJPcHRpb25zJyk7XG4gICAgaWYgKCFpc0pzb25Bc3RPYmplY3QoY29tcGlsZXJPcHRpb25zKSkge1xuICAgICAgcmV0dXJuIGhvc3Q7XG4gICAgfVxuICAgIGNvbnN0IHJlY29yZGVyID0gaG9zdC5iZWdpblVwZGF0ZSh0c2NvbmZpZ1BhdGgpO1xuICAgIC8vIHRhcmdldCBhbmQgbW9kdWxlIGFyZSBjb250cm9sbGVkIGJ5IGRvd25zdHJlYW0gZGVwZW5kZW5jaWVzLCBzdWNoIGFzXG4gICAgLy8gdHNfZGV2c2VydmVyXG4gICAgcmVtb3ZlS2V5VmFsdWVJbkFzdE9iamVjdChyZWNvcmRlciwgY29udGVudCwgY29tcGlsZXJPcHRpb25zLCAndGFyZ2V0Jyk7XG4gICAgcmVtb3ZlS2V5VmFsdWVJbkFzdE9iamVjdChyZWNvcmRlciwgY29udGVudCwgY29tcGlsZXJPcHRpb25zLCAnbW9kdWxlJyk7XG4gICAgLy8gdHlwZVJvb3RzIGlzIGFsd2F5cyBzZXQgdG8gdGhlIEB0eXBlcyBzdWJkaXJlY3Rvcnkgb2YgdGhlIG5vZGVfbW9kdWxlc1xuICAgIC8vIGF0dHJpYnV0ZVxuICAgIHJlbW92ZUtleVZhbHVlSW5Bc3RPYmplY3QocmVjb3JkZXIsIGNvbnRlbnQsIGNvbXBpbGVyT3B0aW9ucywgJ3R5cGVSb290cycpO1xuICAgIC8vIHJvb3REaXIgYW5kIGJhc2VVcmwgYXJlIGFsd2F5cyB0aGUgd29ya3NwYWNlIHJvb3QgZGlyZWN0b3J5XG4gICAgcmVtb3ZlS2V5VmFsdWVJbkFzdE9iamVjdChyZWNvcmRlciwgY29udGVudCwgY29tcGlsZXJPcHRpb25zLCAncm9vdERpcicpO1xuICAgIHJlbW92ZUtleVZhbHVlSW5Bc3RPYmplY3QocmVjb3JkZXIsIGNvbnRlbnQsIGNvbXBpbGVyT3B0aW9ucywgJ2Jhc2VVcmwnKTtcbiAgICBob3N0LmNvbW1pdFVwZGF0ZShyZWNvcmRlcik7XG4gICAgcmV0dXJuIGhvc3Q7XG4gIH07XG59XG5cbi8qKlxuICogQGFuZ3VsYXIvYmF6ZWwgcmVxdWlyZXMgbWluaW11bSB2ZXJzaW9uIG9mIHJ4anMgdG8gYmUgNi40LjAuIFRoaXMgZnVuY3Rpb25cbiAqIHVwZ3JhZGVzIHRoZSB2ZXJzaW9uIG9mIHJ4anMgaW4gcGFja2FnZS5qc29uIGlmIG5lY2Vzc2FyeS5cbiAqL1xuZnVuY3Rpb24gdXBncmFkZVJ4anMoKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSwgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCkgPT4ge1xuICAgIGNvbnN0IHBhY2thZ2VKc29uID0gJ3BhY2thZ2UuanNvbic7XG4gICAgaWYgKCFob3N0LmV4aXN0cyhwYWNrYWdlSnNvbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IGZpbmQgJHtwYWNrYWdlSnNvbn1gKTtcbiAgICB9XG4gICAgY29uc3QgY29udGVudCA9IGhvc3QucmVhZChwYWNrYWdlSnNvbikudG9TdHJpbmcoKTtcbiAgICBjb25zdCBqc29uQXN0ID0gcGFyc2VKc29uQXN0KGNvbnRlbnQpO1xuICAgIGlmICghaXNKc29uQXN0T2JqZWN0KGpzb25Bc3QpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBwYXJzZSBKU09OIGZvciAke3BhY2thZ2VKc29ufWApO1xuICAgIH1cbiAgICBjb25zdCBkZXBzID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoanNvbkFzdCwgJ2RlcGVuZGVuY2llcycpO1xuICAgIGlmICghaXNKc29uQXN0T2JqZWN0KGRlcHMpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBmaW5kIGRlcGVuZGVuY2llcyBpbiAke3BhY2thZ2VKc29ufWApO1xuICAgIH1cbiAgICBjb25zdCByeGpzID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoZGVwcywgJ3J4anMnKTtcbiAgICBpZiAoIXJ4anMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGZpbmQgcnhqcyBpbiBkZXBlbmRlbmNpZXMgb2YgJHtwYWNrYWdlSnNvbn1gKTtcbiAgICB9XG4gICAgY29uc3QgdmFsdWUgPSByeGpzLnZhbHVlIGFzIHN0cmluZzsgIC8vIHZhbHVlIGNhbiBiZSB2ZXJzaW9uIG9yIHJhbmdlXG4gICAgY29uc3QgbWF0Y2ggPSB2YWx1ZS5tYXRjaCgvKFxcZCkrXFwuKFxcZCkrLihcXGQpKyQvKTtcbiAgICBpZiAobWF0Y2gpIHtcbiAgICAgIGNvbnN0IFtfLCBtYWpvciwgbWlub3JdID0gbWF0Y2g7XG4gICAgICBpZiAobWFqb3IgPCAnNicgfHwgKG1ham9yID09PSAnNicgJiYgbWlub3IgPCAnNCcpKSB7XG4gICAgICAgIGNvbnN0IHJlY29yZGVyID0gaG9zdC5iZWdpblVwZGF0ZShwYWNrYWdlSnNvbik7XG4gICAgICAgIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0KHJlY29yZGVyLCBkZXBzLCAncnhqcycsICd+Ni40LjAnKTtcbiAgICAgICAgaG9zdC5jb21taXRVcGRhdGUocmVjb3JkZXIpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb250ZXh0LmxvZ2dlci5pbmZvKFxuICAgICAgICAgICdDb3VsZCBub3QgZGV0ZXJtaW5lIHZlcnNpb24gb2Ygcnhqcy4gXFxuJyArXG4gICAgICAgICAgJ1BsZWFzZSBtYWtlIHN1cmUgdGhhdCB2ZXJzaW9uIGlzIGF0IGxlYXN0IDYuNC4wLicpO1xuICAgIH1cbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuLyoqXG4gKiBXaGVuIHVzaW5nIEFuZ3VsYXIgTlBNIHBhY2thZ2VzIGFuZCBidWlsZGluZyB3aXRoIEFPVCBjb21waWxhdGlvbiwgbmdjXG4gKiByZXF1aXJlcyBuZ3N1bWFtcnkgZmlsZXMgYnV0IHRoZXkgYXJlIG5vdCBzaGlwcGVkLiBUaGlzIGZ1bmN0aW9uIGFkZHMgYVxuICogcG9zdGluc3RhbGwgc3RlcCB0byBnZW5lcmF0ZSB0aGVzZSBmaWxlcy5cbiAqL1xuZnVuY3Rpb24gYWRkUG9zdGluc3RhbGxUb0dlbmVyYXRlTmdTdW1tYXJpZXMoKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSwgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCkgPT4ge1xuICAgIGlmICghaG9zdC5leGlzdHMoJ2FuZ3VsYXItbWV0YWRhdGEudHNjb25maWcuanNvbicpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHBhY2thZ2VKc29uID0gJ3BhY2thZ2UuanNvbic7XG4gICAgaWYgKCFob3N0LmV4aXN0cyhwYWNrYWdlSnNvbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IGZpbmQgJHtwYWNrYWdlSnNvbn1gKTtcbiAgICB9XG4gICAgY29uc3QgY29udGVudCA9IGhvc3QucmVhZChwYWNrYWdlSnNvbikudG9TdHJpbmcoKTtcbiAgICBjb25zdCBqc29uQXN0ID0gcGFyc2VKc29uQXN0KGNvbnRlbnQpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgY29uc3Qgc2NyaXB0cyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGpzb25Bc3QsICdzY3JpcHRzJykgYXMgSnNvbkFzdE9iamVjdDtcbiAgICBjb25zdCByZWNvcmRlciA9IGhvc3QuYmVnaW5VcGRhdGUocGFja2FnZUpzb24pO1xuICAgIGlmIChzY3JpcHRzKSB7XG4gICAgICBpbnNlcnRQcm9wZXJ0eUluQXN0T2JqZWN0SW5PcmRlcihcbiAgICAgICAgICByZWNvcmRlciwgc2NyaXB0cywgJ3Bvc3RpbnN0YWxsJywgJ25nYyAtcCAuL2FuZ3VsYXItbWV0YWRhdGEudHNjb25maWcuanNvbicsIDQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpbnNlcnRQcm9wZXJ0eUluQXN0T2JqZWN0SW5PcmRlcihcbiAgICAgICAgICByZWNvcmRlciwganNvbkFzdCwgJ3NjcmlwdHMnLCB7XG4gICAgICAgICAgICBwb3N0aW5zdGFsbDogJ25nYyAtcCAuL2FuZ3VsYXItbWV0YWRhdGEudHNjb25maWcuanNvbicsXG4gICAgICAgICAgfSxcbiAgICAgICAgICAyKTtcbiAgICB9XG4gICAgaG9zdC5jb21taXRVcGRhdGUocmVjb3JkZXIpO1xuICAgIHJldHVybiBob3N0O1xuICB9O1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbihvcHRpb25zOiBTY2hlbWEpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgdmFsaWRhdGVQcm9qZWN0TmFtZShvcHRpb25zLm5hbWUpO1xuXG4gICAgcmV0dXJuIGNoYWluKFtcbiAgICAgIGFkZEZpbGVzUmVxdWlyZWRCeUJhemVsKG9wdGlvbnMpLFxuICAgICAgYWRkRGV2RGVwZW5kZW5jaWVzVG9QYWNrYWdlSnNvbihvcHRpb25zKSxcbiAgICAgIGFkZFBvc3RpbnN0YWxsVG9HZW5lcmF0ZU5nU3VtbWFyaWVzKCksXG4gICAgICBiYWNrdXBBbmd1bGFySnNvbigpLFxuICAgICAgYmFja3VwVHNjb25maWdKc29uKCksXG4gICAgICB1cGRhdGVBbmd1bGFySnNvblRvVXNlQmF6ZWxCdWlsZGVyKG9wdGlvbnMpLFxuICAgICAgdXBkYXRlR2l0aWdub3JlKCksXG4gICAgICB1cGRhdGVUc2NvbmZpZ0pzb24oKSxcbiAgICAgIHVwZ3JhZGVSeGpzKCksXG4gICAgXSk7XG4gIH07XG59XG4iXX0=
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
        define("npm_angular_bazel/src/schematics/ng-add/index", ["require", "exports", "tslib", "@angular-devkit/core", "@angular-devkit/schematics", "@schematics/angular/utility/config", "@schematics/angular/utility/json-utils", "@schematics/angular/utility/validation", "@angular/bazel/src/schematics/utility/json-utils", "@angular/bazel/src/schematics/utility/workspace-utils"], factory);
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
    var workspace_utils_1 = require("@angular/bazel/src/schematics/utility/workspace-utils");
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
                '@bazel/bazel': '^0.24.0',
                '@bazel/ibazel': '^0.9.0',
                '@bazel/karma': '^0.27.8',
                '@bazel/typescript': '^0.27.8',
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
            var gitIgnoreContentRaw = host.read(gitignore);
            if (!gitIgnoreContentRaw) {
                return host;
            }
            var gitIgnoreContent = gitIgnoreContentRaw.toString();
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
    /**
     * Change the architect in angular.json to use Bazel builder.
     */
    function updateAngularJsonToUseBazelBuilder(options) {
        return function (host, context) {
            var name = options.name;
            var workspacePath = config_1.getWorkspacePath(host);
            if (!workspacePath) {
                throw new Error('Could not find angular.json');
            }
            var workspaceContent = host.read(workspacePath);
            if (!workspaceContent) {
                throw new Error('Failed to read angular.json content');
            }
            var workspaceJsonAst = core_1.parseJsonAst(workspaceContent.toString());
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
            var e2eArchitect = workspace_utils_1.findE2eArchitect(workspaceJsonAst, name);
            if (e2eArchitect) {
                json_utils_2.replacePropertyInAstObject(recorder, e2eArchitect, 'e2e', {
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
            var contentRaw = host.read(tsconfigPath).toString();
            if (!contentRaw) {
                return host;
            }
            var content = contentRaw.toString();
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
            var content = host.read(packageJson);
            if (!content) {
                throw new Error('Failed to read package.json content');
            }
            var jsonAst = core_1.parseJsonAst(content.toString());
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
            var content = host.read(packageJson);
            if (!content) {
                throw new Error('Failed to read package.json content');
            }
            var jsonAst = core_1.parseJsonAst(content.toString());
            if (!json_utils_2.isJsonAstObject(jsonAst)) {
                throw new Error("Failed to parse JSON for " + packageJson);
            }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvc2NoZW1hdGljcy9uZy1hZGQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCw2Q0FBaUU7SUFDakUseURBQTJJO0lBQzNJLDZEQUFvRTtJQUNwRSxxRUFBaUg7SUFDakgscUVBQTJFO0lBRTNFLCtFQUE2RztJQUM3Ryx5RkFBNEQ7SUFLNUQ7Ozs7T0FJRztJQUNILFNBQVMsK0JBQStCLENBQUMsT0FBZTtRQUN0RCxPQUFPLFVBQUMsSUFBVTs7WUFDaEIsSUFBTSxXQUFXLEdBQUcsY0FBYyxDQUFDO1lBQ25DLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxFQUFFO2dCQUM3QixNQUFNLElBQUksS0FBSyxDQUFDLG9CQUFrQixXQUFhLENBQUMsQ0FBQzthQUNsRDtZQUNELElBQU0sa0JBQWtCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUNsRCxJQUFJLENBQUMsa0JBQWtCLEVBQUU7Z0JBQ3ZCLE1BQU0sSUFBSSxLQUFLLENBQUMscUNBQXFDLENBQUMsQ0FBQzthQUN4RDtZQUNELElBQU0sT0FBTyxHQUFHLG1CQUFZLENBQUMsa0JBQWtCLENBQUMsUUFBUSxFQUFFLENBQWtCLENBQUM7WUFDN0UsSUFBTSxJQUFJLEdBQUcsb0NBQXVCLENBQUMsT0FBTyxFQUFFLGNBQWMsQ0FBa0IsQ0FBQztZQUMvRSxJQUFNLE9BQU8sR0FBRyxvQ0FBdUIsQ0FBQyxPQUFPLEVBQUUsaUJBQWlCLENBQWtCLENBQUM7WUFFckYsSUFBTSxlQUFlLEdBQUcsb0NBQXVCLENBQUMsSUFBSSxFQUFFLGVBQWUsQ0FBQyxDQUFDO1lBQ3ZFLElBQUksQ0FBQyxlQUFlLEVBQUU7Z0JBQ3BCLE1BQU0sSUFBSSxLQUFLLENB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QUF5QyxFQUFFLENBQUMsQ0FBQyxDQUFDO2FBQ3JGO2lCQUFNO2dCQUNMLDZDQUFnQyxDQUM1QixRQUFRLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRTtvQkFDNUIsV0FBVyxFQUFFLHlDQUF5QztpQkFDdkQsRUFDRCxDQUFDLENBQUMsQ0FBQzthQUNSO1lBQ0QsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUM1QixPQUFPLElBQUksQ0FBQztRQUNkLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRCxtQkFBd0IsT0FBZTtRQUNyQyxPQUFPLFVBQUMsSUFBVTtZQUNoQixnQ0FBbUIsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFbEMsT0FBTyxrQkFBSyxDQUFDO2dCQUNYLHVCQUF1QixDQUFDLE9BQU8sQ0FBQztnQkFDaEMsK0JBQStCLENBQUMsT0FBTyxDQUFDO2dCQUN4QyxtQ0FBbUMsRUFBRTtnQkFDckMsaUJBQWlCLEVBQUU7Z0JBQ25CLGtCQUFrQixFQUFFO2dCQUNwQixrQ0FBa0MsQ0FBQyxPQUFPLENBQUM7Z0JBQzNDLGVBQWUsRUFBRTtnQkFDakIsa0JBQWtCLEVBQUU7Z0JBQ3BCLFdBQVcsRUFBRTthQUNkLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQztJQUNKLENBQUM7SUFoQkQsNEJBZ0JDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqXG4gKiBAZmlsZW92ZXJ2aWV3IFNjaGVtYXRpY3MgZm9yIG5nLW5ldyBwcm9qZWN0IHRoYXQgYnVpbGRzIHdpdGggQmF6ZWwuXG4gKi9cblxuaW1wb3J0IHtKc29uQXN0T2JqZWN0LCBwYXJzZUpzb25Bc3R9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7UnVsZSwgU2NoZW1hdGljQ29udGV4dCwgU2NoZW1hdGljc0V4Y2VwdGlvbiwgVHJlZSwgYXBwbHksIGFwcGx5VGVtcGxhdGVzLCBjaGFpbiwgbWVyZ2VXaXRoLCB1cmx9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9zY2hlbWF0aWNzJztcbmltcG9ydCB7Z2V0V29ya3NwYWNlUGF0aH0gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L2NvbmZpZyc7XG5pbXBvcnQge2ZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0LCBpbnNlcnRQcm9wZXJ0eUluQXN0T2JqZWN0SW5PcmRlcn0gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L2pzb24tdXRpbHMnO1xuaW1wb3J0IHt2YWxpZGF0ZVByb2plY3ROYW1lfSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvdmFsaWRhdGlvbic7XG5cbmltcG9ydCB7aXNKc29uQXN0T2JqZWN0LCByZW1vdmVLZXlWYWx1ZUluQXN0T2JqZWN0LCByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdH0gZnJvbSAnLi4vdXRpbGl0eS9qc29uLXV0aWxzJztcbmltcG9ydCB7ZmluZEUyZUFyY2hpdGVjdH0gZnJvbSAnLi4vdXRpbGl0eS93b3Jrc3BhY2UtdXRpbHMnO1xuXG5pbXBvcnQge1NjaGVtYX0gZnJvbSAnLi9zY2hlbWEnO1xuXG5cbi8qKlxuICogUGFja2FnZXMgdGhhdCBidWlsZCB1bmRlciBCYXplbCByZXF1aXJlIGFkZGl0aW9uYWwgZGV2IGRlcGVuZGVuY2llcy4gVGhpc1xuICogZnVuY3Rpb24gYWRkcyB0aG9zZSBkZXBlbmRlbmNpZXMgdG8gXCJkZXZEZXBlbmRlbmNpZXNcIiBzZWN0aW9uIGluXG4gKiBwYWNrYWdlLmpzb24uXG4gKi9cbmZ1bmN0aW9uIGFkZERldkRlcGVuZGVuY2llc1RvUGFja2FnZUpzb24ob3B0aW9uczogU2NoZW1hKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIGNvbnN0IHBhY2thZ2VKc29uID0gJ3BhY2thZ2UuanNvbic7XG4gICAgaWYgKCFob3N0LmV4aXN0cyhwYWNrYWdlSnNvbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IGZpbmQgJHtwYWNrYWdlSnNvbn1gKTtcbiAgICB9XG4gICAgY29uc3QgcGFja2FnZUpzb25Db250ZW50ID0gaG9zdC5yZWFkKHBhY2thZ2VKc29uKTtcbiAgICBpZiAoIXBhY2thZ2VKc29uQ29udGVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gcmVhZCBwYWNrYWdlLmpzb24gY29udGVudCcpO1xuICAgIH1cbiAgICBjb25zdCBqc29uQXN0ID0gcGFyc2VKc29uQXN0KHBhY2thZ2VKc29uQ29udGVudC50b1N0cmluZygpKSBhcyBKc29uQXN0T2JqZWN0O1xuICAgIGNvbnN0IGRlcHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChqc29uQXN0LCAnZGVwZW5kZW5jaWVzJykgYXMgSnNvbkFzdE9iamVjdDtcbiAgICBjb25zdCBkZXZEZXBzID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoanNvbkFzdCwgJ2RldkRlcGVuZGVuY2llcycpIGFzIEpzb25Bc3RPYmplY3Q7XG5cbiAgICBjb25zdCBhbmd1bGFyQ29yZU5vZGUgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChkZXBzLCAnQGFuZ3VsYXIvY29yZScpO1xuICAgIGlmICghYW5ndWxhckNvcmVOb2RlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Bhbmd1bGFyL2NvcmUgZGVwZW5kZW5jeSBub3QgZm91bmQgaW4gcGFja2FnZS5qc29uJyk7XG4gICAgfVxuICAgIGNvbnN0IGFuZ3VsYXJDb3JlVmVyc2lvbiA9IGFuZ3VsYXJDb3JlTm9kZS52YWx1ZSBhcyBzdHJpbmc7XG5cbiAgICBjb25zdCBkZXZEZXBlbmRlbmNpZXM6IHtbazogc3RyaW5nXTogc3RyaW5nfSA9IHtcbiAgICAgICdAYW5ndWxhci9iYXplbCc6IGFuZ3VsYXJDb3JlVmVyc2lvbixcbiAgICAgICdAYmF6ZWwvYmF6ZWwnOiAnXjAuMjQuMCcsXG4gICAgICAnQGJhemVsL2liYXplbCc6ICdeMC45LjAnLFxuICAgICAgJ0BiYXplbC9rYXJtYSc6ICdeMC4yNy44JyxcbiAgICAgICdAYmF6ZWwvdHlwZXNjcmlwdCc6ICdeMC4yNy44JyxcbiAgICB9O1xuXG4gICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKHBhY2thZ2VKc29uKTtcbiAgICBmb3IgKGNvbnN0IHBhY2thZ2VOYW1lIG9mIE9iamVjdC5rZXlzKGRldkRlcGVuZGVuY2llcykpIHtcbiAgICAgIGNvbnN0IHZlcnNpb24gPSBkZXZEZXBlbmRlbmNpZXNbcGFja2FnZU5hbWVdO1xuICAgICAgY29uc3QgaW5kZW50ID0gNDtcbiAgICAgIGluc2VydFByb3BlcnR5SW5Bc3RPYmplY3RJbk9yZGVyKHJlY29yZGVyLCBkZXZEZXBzLCBwYWNrYWdlTmFtZSwgdmVyc2lvbiwgaW5kZW50KTtcbiAgICB9XG4gICAgaG9zdC5jb21taXRVcGRhdGUocmVjb3JkZXIpO1xuICAgIHJldHVybiBob3N0O1xuICB9O1xufVxuXG4vKipcbiAqIEFwcGVuZCBhZGRpdGlvbmFsIEphdmFzY3JpcHQgLyBUeXBlc2NyaXB0IGZpbGVzIG5lZWRlZCB0byBjb21waWxlIGFuIEFuZ3VsYXJcbiAqIHByb2plY3QgdW5kZXIgQmF6ZWwuXG4gKi9cbmZ1bmN0aW9uIGFkZEZpbGVzUmVxdWlyZWRCeUJhemVsKG9wdGlvbnM6IFNjaGVtYSkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUpID0+IHtcbiAgICByZXR1cm4gbWVyZ2VXaXRoKGFwcGx5KHVybCgnLi9maWxlcycpLCBbXG4gICAgICBhcHBseVRlbXBsYXRlcyh7fSksXG4gICAgXSkpO1xuICB9O1xufVxuXG4vKipcbiAqIEFwcGVuZCAnL2JhemVsLW91dCcgdG8gdGhlIGdpdGlnbm9yZSBmaWxlLlxuICovXG5mdW5jdGlvbiB1cGRhdGVHaXRpZ25vcmUoKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIGNvbnN0IGdpdGlnbm9yZSA9ICcvLmdpdGlnbm9yZSc7XG4gICAgaWYgKCFob3N0LmV4aXN0cyhnaXRpZ25vcmUpKSB7XG4gICAgICByZXR1cm4gaG9zdDtcbiAgICB9XG4gICAgY29uc3QgZ2l0SWdub3JlQ29udGVudFJhdyA9IGhvc3QucmVhZChnaXRpZ25vcmUpO1xuICAgIGlmICghZ2l0SWdub3JlQ29udGVudFJhdykge1xuICAgICAgcmV0dXJuIGhvc3Q7XG4gICAgfVxuICAgIGNvbnN0IGdpdElnbm9yZUNvbnRlbnQgPSBnaXRJZ25vcmVDb250ZW50UmF3LnRvU3RyaW5nKCk7XG4gICAgaWYgKGdpdElnbm9yZUNvbnRlbnQuaW5jbHVkZXMoJ1xcbi9iYXplbC1vdXRcXG4nKSkge1xuICAgICAgcmV0dXJuIGhvc3Q7XG4gICAgfVxuICAgIGNvbnN0IGNvbXBpbGVkT3V0cHV0ID0gJyMgY29tcGlsZWQgb3V0cHV0XFxuJztcbiAgICBjb25zdCBpbmRleCA9IGdpdElnbm9yZUNvbnRlbnQuaW5kZXhPZihjb21waWxlZE91dHB1dCk7XG4gICAgY29uc3QgaW5zZXJ0aW9uSW5kZXggPSBpbmRleCA+PSAwID8gaW5kZXggKyBjb21waWxlZE91dHB1dC5sZW5ndGggOiBnaXRJZ25vcmVDb250ZW50Lmxlbmd0aDtcbiAgICBjb25zdCByZWNvcmRlciA9IGhvc3QuYmVnaW5VcGRhdGUoZ2l0aWdub3JlKTtcbiAgICByZWNvcmRlci5pbnNlcnRSaWdodChpbnNlcnRpb25JbmRleCwgJy9iYXplbC1vdXRcXG4nKTtcbiAgICBob3N0LmNvbW1pdFVwZGF0ZShyZWNvcmRlcik7XG4gICAgcmV0dXJuIGhvc3Q7XG4gIH07XG59XG5cbi8qKlxuICogQ2hhbmdlIHRoZSBhcmNoaXRlY3QgaW4gYW5ndWxhci5qc29uIHRvIHVzZSBCYXplbCBidWlsZGVyLlxuICovXG5mdW5jdGlvbiB1cGRhdGVBbmd1bGFySnNvblRvVXNlQmF6ZWxCdWlsZGVyKG9wdGlvbnM6IFNjaGVtYSk6IFJ1bGUge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBjb25zdCB7bmFtZX0gPSBvcHRpb25zO1xuICAgIGNvbnN0IHdvcmtzcGFjZVBhdGggPSBnZXRXb3Jrc3BhY2VQYXRoKGhvc3QpO1xuICAgIGlmICghd29ya3NwYWNlUGF0aCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgZmluZCBhbmd1bGFyLmpzb24nKTtcbiAgICB9XG4gICAgY29uc3Qgd29ya3NwYWNlQ29udGVudCA9IGhvc3QucmVhZCh3b3Jrc3BhY2VQYXRoKTtcbiAgICBpZiAoIXdvcmtzcGFjZUNvbnRlbnQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIHJlYWQgYW5ndWxhci5qc29uIGNvbnRlbnQnKTtcbiAgICB9XG4gICAgY29uc3Qgd29ya3NwYWNlSnNvbkFzdCA9IHBhcnNlSnNvbkFzdCh3b3Jrc3BhY2VDb250ZW50LnRvU3RyaW5nKCkpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgY29uc3QgcHJvamVjdHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdCh3b3Jrc3BhY2VKc29uQXN0LCAncHJvamVjdHMnKTtcbiAgICBpZiAoIXByb2plY3RzKSB7XG4gICAgICB0aHJvdyBuZXcgU2NoZW1hdGljc0V4Y2VwdGlvbignRXhwZWN0IHByb2plY3RzIGluIGFuZ3VsYXIuanNvbiB0byBiZSBhbiBPYmplY3QnKTtcbiAgICB9XG4gICAgY29uc3QgcHJvamVjdCA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KHByb2plY3RzIGFzIEpzb25Bc3RPYmplY3QsIG5hbWUpO1xuICAgIGlmICghcHJvamVjdCkge1xuICAgICAgdGhyb3cgbmV3IFNjaGVtYXRpY3NFeGNlcHRpb24oYEV4cGVjdGVkIHByb2plY3RzIHRvIGNvbnRhaW4gJHtuYW1lfWApO1xuICAgIH1cbiAgICBjb25zdCByZWNvcmRlciA9IGhvc3QuYmVnaW5VcGRhdGUod29ya3NwYWNlUGF0aCk7XG4gICAgY29uc3QgaW5kZW50ID0gODtcbiAgICBjb25zdCBhcmNoaXRlY3QgPVxuICAgICAgICBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChwcm9qZWN0IGFzIEpzb25Bc3RPYmplY3QsICdhcmNoaXRlY3QnKSBhcyBKc29uQXN0T2JqZWN0O1xuICAgIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0KFxuICAgICAgICByZWNvcmRlciwgYXJjaGl0ZWN0LCAnYnVpbGQnLCB7XG4gICAgICAgICAgYnVpbGRlcjogJ0Bhbmd1bGFyL2JhemVsOmJ1aWxkJyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vc3JjOnByb2RhcHAnLFxuICAgICAgICAgICAgYmF6ZWxDb21tYW5kOiAnYnVpbGQnLFxuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgaW5kZW50KTtcbiAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChcbiAgICAgICAgcmVjb3JkZXIsIGFyY2hpdGVjdCwgJ3NlcnZlJywge1xuICAgICAgICAgIGJ1aWxkZXI6ICdAYW5ndWxhci9iYXplbDpidWlsZCcsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgdGFyZ2V0TGFiZWw6ICcvL3NyYzpkZXZzZXJ2ZXInLFxuICAgICAgICAgICAgYmF6ZWxDb21tYW5kOiAncnVuJyxcbiAgICAgICAgICAgIHdhdGNoOiB0cnVlLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgY29uZmlndXJhdGlvbnM6IHtcbiAgICAgICAgICAgIHByb2R1Y3Rpb246IHtcbiAgICAgICAgICAgICAgdGFyZ2V0TGFiZWw6ICcvL3NyYzpwcm9kc2VydmVyJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgaW5kZW50KTtcbiAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChcbiAgICAgICAgcmVjb3JkZXIsIGFyY2hpdGVjdCwgJ3Rlc3QnLCB7XG4gICAgICAgICAgYnVpbGRlcjogJ0Bhbmd1bGFyL2JhemVsOmJ1aWxkJyxcbiAgICAgICAgICBvcHRpb25zOiB7J2JhemVsQ29tbWFuZCc6ICd0ZXN0JywgJ3RhcmdldExhYmVsJzogJy8vc3JjLy4uLid9LFxuICAgICAgICB9LFxuICAgICAgICBpbmRlbnQpO1xuXG4gICAgY29uc3QgZTJlQXJjaGl0ZWN0ID0gZmluZEUyZUFyY2hpdGVjdCh3b3Jrc3BhY2VKc29uQXN0LCBuYW1lKTtcbiAgICBpZiAoZTJlQXJjaGl0ZWN0KSB7XG4gICAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChcbiAgICAgICAgICByZWNvcmRlciwgZTJlQXJjaGl0ZWN0LCAnZTJlJywge1xuICAgICAgICAgICAgYnVpbGRlcjogJ0Bhbmd1bGFyL2JhemVsOmJ1aWxkJyxcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgYmF6ZWxDb21tYW5kOiAndGVzdCcsXG4gICAgICAgICAgICAgIHRhcmdldExhYmVsOiAnLy9lMmU6ZGV2c2VydmVyX3Rlc3QnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYXRpb25zOiB7XG4gICAgICAgICAgICAgIHByb2R1Y3Rpb246IHtcbiAgICAgICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vZTJlOnByb2RzZXJ2ZXJfdGVzdCcsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICBpbmRlbnQpO1xuICAgIH1cblxuICAgIGhvc3QuY29tbWl0VXBkYXRlKHJlY29yZGVyKTtcbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBiYWNrdXAgZm9yIHRoZSBvcmlnaW5hbCBhbmd1bGFyLmpzb24gZmlsZSBpbiBjYXNlIHVzZXIgd2FudHMgdG9cbiAqIGVqZWN0IEJhemVsIGFuZCByZXZlcnQgdG8gdGhlIG9yaWdpbmFsIHdvcmtmbG93LlxuICovXG5mdW5jdGlvbiBiYWNrdXBBbmd1bGFySnNvbigpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgY29uc3Qgd29ya3NwYWNlUGF0aCA9IGdldFdvcmtzcGFjZVBhdGgoaG9zdCk7XG4gICAgaWYgKCF3b3Jrc3BhY2VQYXRoKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGhvc3QuY3JlYXRlKFxuICAgICAgICBgJHt3b3Jrc3BhY2VQYXRofS5iYWtgLCAnLy8gVGhpcyBpcyBhIGJhY2t1cCBmaWxlIG9mIHRoZSBvcmlnaW5hbCBhbmd1bGFyLmpzb24uICcgK1xuICAgICAgICAgICAgJ1RoaXMgZmlsZSBpcyBuZWVkZWQgaW4gY2FzZSB5b3Ugd2FudCB0byByZXZlcnQgdG8gdGhlIHdvcmtmbG93IHdpdGhvdXQgQmF6ZWwuXFxuXFxuJyArXG4gICAgICAgICAgICBob3N0LnJlYWQod29ya3NwYWNlUGF0aCkpO1xuICB9O1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIGJhY2t1cCBmb3IgdGhlIG9yaWdpbmFsIHRzY29uZmlnLmpzb24gZmlsZSBpbiBjYXNlIHVzZXIgd2FudHMgdG9cbiAqIGVqZWN0IEJhemVsIGFuZCByZXZlcnQgdG8gdGhlIG9yaWdpbmFsIHdvcmtmbG93LlxuICovXG5mdW5jdGlvbiBiYWNrdXBUc2NvbmZpZ0pzb24oKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSwgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCkgPT4ge1xuICAgIGNvbnN0IHRzY29uZmlnUGF0aCA9ICd0c2NvbmZpZy5qc29uJztcbiAgICBpZiAoIWhvc3QuZXhpc3RzKHRzY29uZmlnUGF0aCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaG9zdC5jcmVhdGUoXG4gICAgICAgIGAke3RzY29uZmlnUGF0aH0uYmFrYCwgJy8vIFRoaXMgaXMgYSBiYWNrdXAgZmlsZSBvZiB0aGUgb3JpZ2luYWwgdHNjb25maWcuanNvbi4gJyArXG4gICAgICAgICAgICAnVGhpcyBmaWxlIGlzIG5lZWRlZCBpbiBjYXNlIHlvdSB3YW50IHRvIHJldmVydCB0byB0aGUgd29ya2Zsb3cgd2l0aG91dCBCYXplbC5cXG5cXG4nICtcbiAgICAgICAgICAgIGhvc3QucmVhZCh0c2NvbmZpZ1BhdGgpKTtcbiAgfTtcbn1cblxuLyoqXG4gKiBCYXplbCBjb250cm9scyB0aGUgY29tcGlsYXRpb24gb3B0aW9ucyBvZiB0c2MsIHNvIG1hbnkgb3B0aW9ucyBpblxuICogdHNjb25maWcuanNvbiBnZW5lcmF0ZWQgYnkgdGhlIGRlZmF1bHQgQ0xJIHNjaGVtYXRpY3MgYXJlIG5vdCBhcHBsaWNhYmxlLlxuICogVGhpcyBmdW5jdGlvbiB1cGRhdGVzIHRoZSB0c2NvbmZpZy5qc29uIHRvIHJlbW92ZSBCYXplbC1jb250cm9sbGVkXG4gKiBwYXJhbWV0ZXJzLiBUaGlzIHByZXZlbnRzIEJhemVsIGZyb20gcHJpbnRpbmcgb3V0IHdhcm5pbmdzIGFib3V0IG92ZXJyaWRlblxuICogc2V0dGluZ3MuXG4gKi9cbmZ1bmN0aW9uIHVwZGF0ZVRzY29uZmlnSnNvbigpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgY29uc3QgdHNjb25maWdQYXRoID0gJ3RzY29uZmlnLmpzb24nO1xuICAgIGlmICghaG9zdC5leGlzdHModHNjb25maWdQYXRoKSkge1xuICAgICAgcmV0dXJuIGhvc3Q7XG4gICAgfVxuICAgIGNvbnN0IGNvbnRlbnRSYXcgPSBob3N0LnJlYWQodHNjb25maWdQYXRoKSAhLnRvU3RyaW5nKCk7XG4gICAgaWYgKCFjb250ZW50UmF3KSB7XG4gICAgICByZXR1cm4gaG9zdDtcbiAgICB9XG4gICAgY29uc3QgY29udGVudCA9IGNvbnRlbnRSYXcudG9TdHJpbmcoKTtcbiAgICBjb25zdCBhc3QgPSBwYXJzZUpzb25Bc3QoY29udGVudCk7XG4gICAgaWYgKCFpc0pzb25Bc3RPYmplY3QoYXN0KSkge1xuICAgICAgcmV0dXJuIGhvc3Q7XG4gICAgfVxuICAgIGNvbnN0IGNvbXBpbGVyT3B0aW9ucyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGFzdCwgJ2NvbXBpbGVyT3B0aW9ucycpO1xuICAgIGlmICghaXNKc29uQXN0T2JqZWN0KGNvbXBpbGVyT3B0aW9ucykpIHtcbiAgICAgIHJldHVybiBob3N0O1xuICAgIH1cbiAgICBjb25zdCByZWNvcmRlciA9IGhvc3QuYmVnaW5VcGRhdGUodHNjb25maWdQYXRoKTtcbiAgICAvLyB0YXJnZXQgYW5kIG1vZHVsZSBhcmUgY29udHJvbGxlZCBieSBkb3duc3RyZWFtIGRlcGVuZGVuY2llcywgc3VjaCBhc1xuICAgIC8vIHRzX2RldnNlcnZlclxuICAgIHJlbW92ZUtleVZhbHVlSW5Bc3RPYmplY3QocmVjb3JkZXIsIGNvbnRlbnQsIGNvbXBpbGVyT3B0aW9ucywgJ3RhcmdldCcpO1xuICAgIHJlbW92ZUtleVZhbHVlSW5Bc3RPYmplY3QocmVjb3JkZXIsIGNvbnRlbnQsIGNvbXBpbGVyT3B0aW9ucywgJ21vZHVsZScpO1xuICAgIC8vIHR5cGVSb290cyBpcyBhbHdheXMgc2V0IHRvIHRoZSBAdHlwZXMgc3ViZGlyZWN0b3J5IG9mIHRoZSBub2RlX21vZHVsZXNcbiAgICAvLyBhdHRyaWJ1dGVcbiAgICByZW1vdmVLZXlWYWx1ZUluQXN0T2JqZWN0KHJlY29yZGVyLCBjb250ZW50LCBjb21waWxlck9wdGlvbnMsICd0eXBlUm9vdHMnKTtcbiAgICAvLyByb290RGlyIGFuZCBiYXNlVXJsIGFyZSBhbHdheXMgdGhlIHdvcmtzcGFjZSByb290IGRpcmVjdG9yeVxuICAgIHJlbW92ZUtleVZhbHVlSW5Bc3RPYmplY3QocmVjb3JkZXIsIGNvbnRlbnQsIGNvbXBpbGVyT3B0aW9ucywgJ3Jvb3REaXInKTtcbiAgICByZW1vdmVLZXlWYWx1ZUluQXN0T2JqZWN0KHJlY29yZGVyLCBjb250ZW50LCBjb21waWxlck9wdGlvbnMsICdiYXNlVXJsJyk7XG4gICAgaG9zdC5jb21taXRVcGRhdGUocmVjb3JkZXIpO1xuICAgIHJldHVybiBob3N0O1xuICB9O1xufVxuXG4vKipcbiAqIEBhbmd1bGFyL2JhemVsIHJlcXVpcmVzIG1pbmltdW0gdmVyc2lvbiBvZiByeGpzIHRvIGJlIDYuNC4wLiBUaGlzIGZ1bmN0aW9uXG4gKiB1cGdyYWRlcyB0aGUgdmVyc2lvbiBvZiByeGpzIGluIHBhY2thZ2UuanNvbiBpZiBuZWNlc3NhcnkuXG4gKi9cbmZ1bmN0aW9uIHVwZ3JhZGVSeGpzKCkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBjb25zdCBwYWNrYWdlSnNvbiA9ICdwYWNrYWdlLmpzb24nO1xuICAgIGlmICghaG9zdC5leGlzdHMocGFja2FnZUpzb24pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBmaW5kICR7cGFja2FnZUpzb259YCk7XG4gICAgfVxuICAgIGNvbnN0IGNvbnRlbnQgPSBob3N0LnJlYWQocGFja2FnZUpzb24pO1xuICAgIGlmICghY29udGVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gcmVhZCBwYWNrYWdlLmpzb24gY29udGVudCcpO1xuICAgIH1cbiAgICBjb25zdCBqc29uQXN0ID0gcGFyc2VKc29uQXN0KGNvbnRlbnQudG9TdHJpbmcoKSk7XG4gICAgaWYgKCFpc0pzb25Bc3RPYmplY3QoanNvbkFzdCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIHBhcnNlIEpTT04gZm9yICR7cGFja2FnZUpzb259YCk7XG4gICAgfVxuICAgIGNvbnN0IGRlcHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChqc29uQXN0LCAnZGVwZW5kZW5jaWVzJyk7XG4gICAgaWYgKCFpc0pzb25Bc3RPYmplY3QoZGVwcykpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGZpbmQgZGVwZW5kZW5jaWVzIGluICR7cGFja2FnZUpzb259YCk7XG4gICAgfVxuICAgIGNvbnN0IHJ4anMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChkZXBzLCAncnhqcycpO1xuICAgIGlmICghcnhqcykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gZmluZCByeGpzIGluIGRlcGVuZGVuY2llcyBvZiAke3BhY2thZ2VKc29ufWApO1xuICAgIH1cbiAgICBjb25zdCB2YWx1ZSA9IHJ4anMudmFsdWUgYXMgc3RyaW5nOyAgLy8gdmFsdWUgY2FuIGJlIHZlcnNpb24gb3IgcmFuZ2VcbiAgICBjb25zdCBtYXRjaCA9IHZhbHVlLm1hdGNoKC8oXFxkKStcXC4oXFxkKSsuKFxcZCkrJC8pO1xuICAgIGlmIChtYXRjaCkge1xuICAgICAgY29uc3QgW18sIG1ham9yLCBtaW5vcl0gPSBtYXRjaDtcbiAgICAgIGlmIChtYWpvciA8ICc2JyB8fCAobWFqb3IgPT09ICc2JyAmJiBtaW5vciA8ICc0JykpIHtcbiAgICAgICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKHBhY2thZ2VKc29uKTtcbiAgICAgICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QocmVjb3JkZXIsIGRlcHMsICdyeGpzJywgJ342LjQuMCcpO1xuICAgICAgICBob3N0LmNvbW1pdFVwZGF0ZShyZWNvcmRlcik7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLmluZm8oXG4gICAgICAgICAgJ0NvdWxkIG5vdCBkZXRlcm1pbmUgdmVyc2lvbiBvZiByeGpzLiBcXG4nICtcbiAgICAgICAgICAnUGxlYXNlIG1ha2Ugc3VyZSB0aGF0IHZlcnNpb24gaXMgYXQgbGVhc3QgNi40LjAuJyk7XG4gICAgfVxuICAgIHJldHVybiBob3N0O1xuICB9O1xufVxuXG4vKipcbiAqIFdoZW4gdXNpbmcgQW5ndWxhciBOUE0gcGFja2FnZXMgYW5kIGJ1aWxkaW5nIHdpdGggQU9UIGNvbXBpbGF0aW9uLCBuZ2NcbiAqIHJlcXVpcmVzIG5nc3VtYW1yeSBmaWxlcyBidXQgdGhleSBhcmUgbm90IHNoaXBwZWQuIFRoaXMgZnVuY3Rpb24gYWRkcyBhXG4gKiBwb3N0aW5zdGFsbCBzdGVwIHRvIGdlbmVyYXRlIHRoZXNlIGZpbGVzLlxuICovXG5mdW5jdGlvbiBhZGRQb3N0aW5zdGFsbFRvR2VuZXJhdGVOZ1N1bW1hcmllcygpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgaWYgKCFob3N0LmV4aXN0cygnYW5ndWxhci1tZXRhZGF0YS50c2NvbmZpZy5qc29uJykpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgcGFja2FnZUpzb24gPSAncGFja2FnZS5qc29uJztcbiAgICBpZiAoIWhvc3QuZXhpc3RzKHBhY2thZ2VKc29uKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgZmluZCAke3BhY2thZ2VKc29ufWApO1xuICAgIH1cbiAgICBjb25zdCBjb250ZW50ID0gaG9zdC5yZWFkKHBhY2thZ2VKc29uKTtcbiAgICBpZiAoIWNvbnRlbnQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIHJlYWQgcGFja2FnZS5qc29uIGNvbnRlbnQnKTtcbiAgICB9XG4gICAgY29uc3QganNvbkFzdCA9IHBhcnNlSnNvbkFzdChjb250ZW50LnRvU3RyaW5nKCkpO1xuICAgIGlmICghaXNKc29uQXN0T2JqZWN0KGpzb25Bc3QpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBwYXJzZSBKU09OIGZvciAke3BhY2thZ2VKc29ufWApO1xuICAgIH1cbiAgICBjb25zdCBzY3JpcHRzID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoanNvbkFzdCwgJ3NjcmlwdHMnKSBhcyBKc29uQXN0T2JqZWN0O1xuICAgIGNvbnN0IHJlY29yZGVyID0gaG9zdC5iZWdpblVwZGF0ZShwYWNrYWdlSnNvbik7XG4gICAgaWYgKHNjcmlwdHMpIHtcbiAgICAgIGluc2VydFByb3BlcnR5SW5Bc3RPYmplY3RJbk9yZGVyKFxuICAgICAgICAgIHJlY29yZGVyLCBzY3JpcHRzLCAncG9zdGluc3RhbGwnLCAnbmdjIC1wIC4vYW5ndWxhci1tZXRhZGF0YS50c2NvbmZpZy5qc29uJywgNCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGluc2VydFByb3BlcnR5SW5Bc3RPYmplY3RJbk9yZGVyKFxuICAgICAgICAgIHJlY29yZGVyLCBqc29uQXN0LCAnc2NyaXB0cycsIHtcbiAgICAgICAgICAgIHBvc3RpbnN0YWxsOiAnbmdjIC1wIC4vYW5ndWxhci1tZXRhZGF0YS50c2NvbmZpZy5qc29uJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIDIpO1xuICAgIH1cbiAgICBob3N0LmNvbW1pdFVwZGF0ZShyZWNvcmRlcik7XG4gICAgcmV0dXJuIGhvc3Q7XG4gIH07XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKG9wdGlvbnM6IFNjaGVtYSk6IFJ1bGUge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUpID0+IHtcbiAgICB2YWxpZGF0ZVByb2plY3ROYW1lKG9wdGlvbnMubmFtZSk7XG5cbiAgICByZXR1cm4gY2hhaW4oW1xuICAgICAgYWRkRmlsZXNSZXF1aXJlZEJ5QmF6ZWwob3B0aW9ucyksXG4gICAgICBhZGREZXZEZXBlbmRlbmNpZXNUb1BhY2thZ2VKc29uKG9wdGlvbnMpLFxuICAgICAgYWRkUG9zdGluc3RhbGxUb0dlbmVyYXRlTmdTdW1tYXJpZXMoKSxcbiAgICAgIGJhY2t1cEFuZ3VsYXJKc29uKCksXG4gICAgICBiYWNrdXBUc2NvbmZpZ0pzb24oKSxcbiAgICAgIHVwZGF0ZUFuZ3VsYXJKc29uVG9Vc2VCYXplbEJ1aWxkZXIob3B0aW9ucyksXG4gICAgICB1cGRhdGVHaXRpZ25vcmUoKSxcbiAgICAgIHVwZGF0ZVRzY29uZmlnSnNvbigpLFxuICAgICAgdXBncmFkZVJ4anMoKSxcbiAgICBdKTtcbiAgfTtcbn1cbiJdfQ==
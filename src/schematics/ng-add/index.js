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
        define("npm_angular_bazel/src/schematics/ng-add/index", ["require", "exports", "tslib", "@angular-devkit/core", "@angular-devkit/schematics", "@angular-devkit/schematics/tasks", "@schematics/angular/utility/config", "@schematics/angular/utility/json-utils", "@schematics/angular/utility/validation", "@angular/bazel/src/schematics/utility/json-utils", "@angular/bazel/src/schematics/utility/workspace-utils"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var core_1 = require("@angular-devkit/core");
    var schematics_1 = require("@angular-devkit/schematics");
    var tasks_1 = require("@angular-devkit/schematics/tasks");
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
                '@bazel/bazel': '^0.28.1',
                '@bazel/ibazel': '^0.10.2',
                '@bazel/karma': '0.38.3',
                '@bazel/protractor': '0.38.3',
                '@bazel/typescript': '0.38.3',
                'history-server': '^1.3.1',
            };
            var recorder = host.beginUpdate(packageJson);
            try {
                for (var _b = tslib_1.__values(Object.keys(devDependencies)), _c = _b.next(); !_c.done; _c = _b.next()) {
                    var packageName = _c.value;
                    var existingDep = json_utils_1.findPropertyInAstObject(deps, packageName);
                    if (existingDep) {
                        var content = packageJsonContent.toString();
                        json_utils_2.removeKeyValueInAstObject(recorder, content, deps, packageName);
                    }
                    var version = devDependencies[packageName];
                    var indent = 4;
                    if (json_utils_1.findPropertyInAstObject(devDeps, packageName)) {
                        json_utils_2.replacePropertyInAstObject(recorder, devDeps, packageName, version, indent);
                    }
                    else {
                        json_utils_1.insertPropertyInAstObjectInOrder(recorder, devDeps, packageName, version, indent);
                    }
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
     * Remove packages that are not needed under Bazel.
     * @param options
     */
    function removeObsoleteDependenciesFromPackageJson(options) {
        return function (host) {
            var e_2, _a;
            var packageJson = 'package.json';
            if (!host.exists(packageJson)) {
                throw new Error("Could not find " + packageJson);
            }
            var buffer = host.read(packageJson);
            if (!buffer) {
                throw new Error('Failed to read package.json content');
            }
            var content = buffer.toString();
            var jsonAst = core_1.parseJsonAst(content);
            var deps = json_utils_1.findPropertyInAstObject(jsonAst, 'dependencies');
            var devDeps = json_utils_1.findPropertyInAstObject(jsonAst, 'devDependencies');
            var depsToRemove = [
                '@angular-devkit/build-angular',
            ];
            var recorder = host.beginUpdate(packageJson);
            try {
                for (var depsToRemove_1 = tslib_1.__values(depsToRemove), depsToRemove_1_1 = depsToRemove_1.next(); !depsToRemove_1_1.done; depsToRemove_1_1 = depsToRemove_1.next()) {
                    var packageName = depsToRemove_1_1.value;
                    var depNode = json_utils_1.findPropertyInAstObject(deps, packageName);
                    if (depNode) {
                        json_utils_2.removeKeyValueInAstObject(recorder, content, deps, packageName);
                    }
                    var devDepNode = json_utils_1.findPropertyInAstObject(devDeps, packageName);
                    if (devDepNode) {
                        json_utils_2.removeKeyValueInAstObject(recorder, content, devDeps, packageName);
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (depsToRemove_1_1 && !depsToRemove_1_1.done && (_a = depsToRemove_1.return)) _a.call(depsToRemove_1);
                }
                finally { if (e_2) throw e_2.error; }
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
                },
                configurations: {
                    production: {
                        targetLabel: '//src:prodapp',
                    },
                },
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
            if (json_utils_1.findPropertyInAstObject(architect, 'test')) {
                json_utils_2.replacePropertyInAstObject(recorder, architect, 'test', {
                    builder: '@angular/bazel:build',
                    options: {
                        bazelCommand: 'test',
                        targetLabel: '//src:test',
                    },
                }, indent);
            }
            var e2eArchitect = workspace_utils_1.findE2eArchitect(workspaceJsonAst, name);
            if (e2eArchitect && json_utils_1.findPropertyInAstObject(e2eArchitect, 'e2e')) {
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
            var ngcCommand = 'ngc -p ./angular-metadata.tsconfig.json';
            if (scripts) {
                var postInstall = json_utils_1.findPropertyInAstObject(scripts, 'postinstall');
                if (postInstall) {
                    var command = postInstall.value + "; " + ngcCommand;
                    json_utils_2.replacePropertyInAstObject(recorder, scripts, 'postinstall', command);
                }
                else {
                    json_utils_1.insertPropertyInAstObjectInOrder(recorder, scripts, 'postinstall', ngcCommand, 4);
                }
            }
            else {
                json_utils_1.insertPropertyInAstObjectInOrder(recorder, jsonAst, 'scripts', {
                    postinstall: ngcCommand,
                }, 2);
            }
            host.commitUpdate(recorder);
            return host;
        };
    }
    /**
     * Schedule a task to perform npm / yarn install.
     */
    function installNodeModules(options) {
        return function (host, context) {
            if (!options.skipInstall) {
                context.addTask(new tasks_1.NodePackageInstallTask());
            }
        };
    }
    function default_1(options) {
        return function (host) {
            options.name = options.name || config_1.getWorkspace(host).defaultProject;
            if (!options.name) {
                throw new Error('Please specify a project using "--name project-name"');
            }
            validation_1.validateProjectName(options.name);
            return schematics_1.chain([
                addFilesRequiredByBazel(options),
                addDevDependenciesToPackageJson(options),
                removeObsoleteDependenciesFromPackageJson(options),
                addPostinstallToGenerateNgSummaries(),
                backupAngularJson(),
                updateAngularJsonToUseBazelBuilder(options),
                updateGitignore(),
                upgradeRxjs(),
                installNodeModules(options),
            ]);
        };
    }
    exports.default = default_1;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvc2NoZW1hdGljcy9uZy1hZGQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCw2Q0FBaUU7SUFDakUseURBQTJJO0lBQzNJLDBEQUF3RTtJQUN4RSw2REFBa0Y7SUFDbEYscUVBQWlIO0lBQ2pILHFFQUEyRTtJQUUzRSwrRUFBNkc7SUFDN0cseUZBQTREO0lBSzVEOzs7O09BSUc7SUFDSCxTQUFTLCtCQUErQixDQUFDLE9BQWU7UUFDdEQsT0FBTyxVQUFDLElBQVU7O1lBQ2hCLElBQU0sV0FBVyxHQUFHLGNBQWMsQ0FBQztZQUNuQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsRUFBRTtnQkFDN0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxvQkFBa0IsV0FBYSxDQUFDLENBQUM7YUFDbEQ7WUFDRCxJQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDbEQsSUFBSSxDQUFDLGtCQUFrQixFQUFFO2dCQUN2QixNQUFNLElBQUksS0FBSyxDQUFDLHFDQUFxQyxDQUFDLENBQUM7YUFDeEQ7WUFDRCxJQUFNLE9BQU8sR0FBRyxtQkFBWSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsRUFBRSxDQUFrQixDQUFDO1lBQzdFLElBQU0sSUFBSSxHQUFHLG9DQUF1QixDQUFDLE9BQU8sRUFBRSxjQUFjLENBQWtCLENBQUM7WUFDL0UsSUFBTSxPQUFPLEdBQUcsb0NBQXVCLENBQUMsT0FBTyxFQUFFLGlCQUFpQixDQUFrQixDQUFDO1lBRXJGLElBQU0sZUFBZSxHQUFHLG9DQUF1QixDQUFDLElBQUksRUFBRSxlQUFlLENBQUMsQ0FBQztZQUN2RSxJQUFJLENBQUMsZUFBZSxFQUFFO2dCQUNwQixNQUFN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T0FBTyxDQUFDLElBQUksOEJBQXNCLEVBQUUsQ0FBQyxDQUFDO2FBQy9DO1FBQ0gsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVELG1CQUF3QixPQUFlO1FBQ3JDLE9BQU8sVUFBQyxJQUFVO1lBQ2hCLE9BQU8sQ0FBQyxJQUFJLEdBQUcsT0FBTyxDQUFDLElBQUksSUFBSSxxQkFBWSxDQUFDLElBQUksQ0FBQyxDQUFDLGNBQWMsQ0FBQztZQUNqRSxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRTtnQkFDakIsTUFBTSxJQUFJLEtBQUssQ0FBQyxzREFBc0QsQ0FBQyxDQUFDO2FBQ3pFO1lBQ0QsZ0NBQW1CLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBRWxDLE9BQU8sa0JBQUssQ0FBQztnQkFDWCx1QkFBdUIsQ0FBQyxPQUFPLENBQUM7Z0JBQ2hDLCtCQUErQixDQUFDLE9BQU8sQ0FBQztnQkFDeEMseUNBQXlDLENBQUMsT0FBTyxDQUFDO2dCQUNsRCxtQ0FBbUMsRUFBRTtnQkFDckMsaUJBQWlCLEVBQUU7Z0JBQ25CLGtDQUFrQyxDQUFDLE9BQU8sQ0FBQztnQkFDM0MsZUFBZSxFQUFFO2dCQUNqQixXQUFXLEVBQUU7Z0JBQ2Isa0JBQWtCLENBQUMsT0FBTyxDQUFDO2FBQzVCLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQztJQUNKLENBQUM7SUFwQkQsNEJBb0JDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqXG4gKiBAZmlsZW92ZXJ2aWV3IFNjaGVtYXRpY3MgZm9yIG5nLW5ldyBwcm9qZWN0IHRoYXQgYnVpbGRzIHdpdGggQmF6ZWwuXG4gKi9cblxuaW1wb3J0IHtKc29uQXN0T2JqZWN0LCBwYXJzZUpzb25Bc3R9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7UnVsZSwgU2NoZW1hdGljQ29udGV4dCwgU2NoZW1hdGljc0V4Y2VwdGlvbiwgVHJlZSwgYXBwbHksIGFwcGx5VGVtcGxhdGVzLCBjaGFpbiwgbWVyZ2VXaXRoLCB1cmx9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9zY2hlbWF0aWNzJztcbmltcG9ydCB7Tm9kZVBhY2thZ2VJbnN0YWxsVGFza30gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L3NjaGVtYXRpY3MvdGFza3MnO1xuaW1wb3J0IHtnZXRXb3Jrc3BhY2UsIGdldFdvcmtzcGFjZVBhdGh9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS9jb25maWcnO1xuaW1wb3J0IHtmaW5kUHJvcGVydHlJbkFzdE9iamVjdCwgaW5zZXJ0UHJvcGVydHlJbkFzdE9iamVjdEluT3JkZXJ9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS9qc29uLXV0aWxzJztcbmltcG9ydCB7dmFsaWRhdGVQcm9qZWN0TmFtZX0gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L3ZhbGlkYXRpb24nO1xuXG5pbXBvcnQge2lzSnNvbkFzdE9iamVjdCwgcmVtb3ZlS2V5VmFsdWVJbkFzdE9iamVjdCwgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3R9IGZyb20gJy4uL3V0aWxpdHkvanNvbi11dGlscyc7XG5pbXBvcnQge2ZpbmRFMmVBcmNoaXRlY3R9IGZyb20gJy4uL3V0aWxpdHkvd29ya3NwYWNlLXV0aWxzJztcblxuaW1wb3J0IHtTY2hlbWF9IGZyb20gJy4vc2NoZW1hJztcblxuXG4vKipcbiAqIFBhY2thZ2VzIHRoYXQgYnVpbGQgdW5kZXIgQmF6ZWwgcmVxdWlyZSBhZGRpdGlvbmFsIGRldiBkZXBlbmRlbmNpZXMuIFRoaXNcbiAqIGZ1bmN0aW9uIGFkZHMgdGhvc2UgZGVwZW5kZW5jaWVzIHRvIFwiZGV2RGVwZW5kZW5jaWVzXCIgc2VjdGlvbiBpblxuICogcGFja2FnZS5qc29uLlxuICovXG5mdW5jdGlvbiBhZGREZXZEZXBlbmRlbmNpZXNUb1BhY2thZ2VKc29uKG9wdGlvbnM6IFNjaGVtYSkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUpID0+IHtcbiAgICBjb25zdCBwYWNrYWdlSnNvbiA9ICdwYWNrYWdlLmpzb24nO1xuICAgIGlmICghaG9zdC5leGlzdHMocGFja2FnZUpzb24pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBmaW5kICR7cGFja2FnZUpzb259YCk7XG4gICAgfVxuICAgIGNvbnN0IHBhY2thZ2VKc29uQ29udGVudCA9IGhvc3QucmVhZChwYWNrYWdlSnNvbik7XG4gICAgaWYgKCFwYWNrYWdlSnNvbkNvbnRlbnQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIHJlYWQgcGFja2FnZS5qc29uIGNvbnRlbnQnKTtcbiAgICB9XG4gICAgY29uc3QganNvbkFzdCA9IHBhcnNlSnNvbkFzdChwYWNrYWdlSnNvbkNvbnRlbnQudG9TdHJpbmcoKSkgYXMgSnNvbkFzdE9iamVjdDtcbiAgICBjb25zdCBkZXBzID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoanNvbkFzdCwgJ2RlcGVuZGVuY2llcycpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgY29uc3QgZGV2RGVwcyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGpzb25Bc3QsICdkZXZEZXBlbmRlbmNpZXMnKSBhcyBKc29uQXN0T2JqZWN0O1xuXG4gICAgY29uc3QgYW5ndWxhckNvcmVOb2RlID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoZGVwcywgJ0Bhbmd1bGFyL2NvcmUnKTtcbiAgICBpZiAoIWFuZ3VsYXJDb3JlTm9kZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdAYW5ndWxhci9jb3JlIGRlcGVuZGVuY3kgbm90IGZvdW5kIGluIHBhY2thZ2UuanNvbicpO1xuICAgIH1cbiAgICBjb25zdCBhbmd1bGFyQ29yZVZlcnNpb24gPSBhbmd1bGFyQ29yZU5vZGUudmFsdWUgYXMgc3RyaW5nO1xuXG4gICAgY29uc3QgZGV2RGVwZW5kZW5jaWVzOiB7W2s6IHN0cmluZ106IHN0cmluZ30gPSB7XG4gICAgICAnQGFuZ3VsYXIvYmF6ZWwnOiBhbmd1bGFyQ29yZVZlcnNpb24sXG4gICAgICAnQGJhemVsL2JhemVsJzogJ14wLjI4LjEnLFxuICAgICAgJ0BiYXplbC9pYmF6ZWwnOiAnXjAuMTAuMicsXG4gICAgICAnQGJhemVsL2thcm1hJzogJzAuMzguMycsXG4gICAgICAnQGJhemVsL3Byb3RyYWN0b3InOiAnMC4zOC4zJyxcbiAgICAgICdAYmF6ZWwvdHlwZXNjcmlwdCc6ICcwLjM4LjMnLFxuICAgICAgJ2hpc3Rvcnktc2VydmVyJzogJ14xLjMuMScsXG4gICAgfTtcblxuICAgIGNvbnN0IHJlY29yZGVyID0gaG9zdC5iZWdpblVwZGF0ZShwYWNrYWdlSnNvbik7XG4gICAgZm9yIChjb25zdCBwYWNrYWdlTmFtZSBvZiBPYmplY3Qua2V5cyhkZXZEZXBlbmRlbmNpZXMpKSB7XG4gICAgICBjb25zdCBleGlzdGluZ0RlcCA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGRlcHMsIHBhY2thZ2VOYW1lKTtcbiAgICAgIGlmIChleGlzdGluZ0RlcCkge1xuICAgICAgICBjb25zdCBjb250ZW50ID0gcGFja2FnZUpzb25Db250ZW50LnRvU3RyaW5nKCk7XG4gICAgICAgIHJlbW92ZUtleVZhbHVlSW5Bc3RPYmplY3QocmVjb3JkZXIsIGNvbnRlbnQsIGRlcHMsIHBhY2thZ2VOYW1lKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IHZlcnNpb24gPSBkZXZEZXBlbmRlbmNpZXNbcGFja2FnZU5hbWVdO1xuICAgICAgY29uc3QgaW5kZW50ID0gNDtcbiAgICAgIGlmIChmaW5kUHJvcGVydHlJbkFzdE9iamVjdChkZXZEZXBzLCBwYWNrYWdlTmFtZSkpIHtcbiAgICAgICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QocmVjb3JkZXIsIGRldkRlcHMsIHBhY2thZ2VOYW1lLCB2ZXJzaW9uLCBpbmRlbnQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaW5zZXJ0UHJvcGVydHlJbkFzdE9iamVjdEluT3JkZXIocmVjb3JkZXIsIGRldkRlcHMsIHBhY2thZ2VOYW1lLCB2ZXJzaW9uLCBpbmRlbnQpO1xuICAgICAgfVxuICAgIH1cbiAgICBob3N0LmNvbW1pdFVwZGF0ZShyZWNvcmRlcik7XG4gICAgcmV0dXJuIGhvc3Q7XG4gIH07XG59XG5cbi8qKlxuICogUmVtb3ZlIHBhY2thZ2VzIHRoYXQgYXJlIG5vdCBuZWVkZWQgdW5kZXIgQmF6ZWwuXG4gKiBAcGFyYW0gb3B0aW9uc1xuICovXG5mdW5jdGlvbiByZW1vdmVPYnNvbGV0ZURlcGVuZGVuY2llc0Zyb21QYWNrYWdlSnNvbihvcHRpb25zOiBTY2hlbWEpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgY29uc3QgcGFja2FnZUpzb24gPSAncGFja2FnZS5qc29uJztcbiAgICBpZiAoIWhvc3QuZXhpc3RzKHBhY2thZ2VKc29uKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgZmluZCAke3BhY2thZ2VKc29ufWApO1xuICAgIH1cbiAgICBjb25zdCBidWZmZXIgPSBob3N0LnJlYWQocGFja2FnZUpzb24pO1xuICAgIGlmICghYnVmZmVyKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byByZWFkIHBhY2thZ2UuanNvbiBjb250ZW50Jyk7XG4gICAgfVxuICAgIGNvbnN0IGNvbnRlbnQgPSBidWZmZXIudG9TdHJpbmcoKTtcbiAgICBjb25zdCBqc29uQXN0ID0gcGFyc2VKc29uQXN0KGNvbnRlbnQpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgY29uc3QgZGVwcyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGpzb25Bc3QsICdkZXBlbmRlbmNpZXMnKSBhcyBKc29uQXN0T2JqZWN0O1xuICAgIGNvbnN0IGRldkRlcHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChqc29uQXN0LCAnZGV2RGVwZW5kZW5jaWVzJykgYXMgSnNvbkFzdE9iamVjdDtcblxuICAgIGNvbnN0IGRlcHNUb1JlbW92ZSA9IFtcbiAgICAgICdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhcicsXG4gICAgXTtcblxuICAgIGNvbnN0IHJlY29yZGVyID0gaG9zdC5iZWdpblVwZGF0ZShwYWNrYWdlSnNvbik7XG5cbiAgICBmb3IgKGNvbnN0IHBhY2thZ2VOYW1lIG9mIGRlcHNUb1JlbW92ZSkge1xuICAgICAgY29uc3QgZGVwTm9kZSA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGRlcHMsIHBhY2thZ2VOYW1lKTtcbiAgICAgIGlmIChkZXBOb2RlKSB7XG4gICAgICAgIHJlbW92ZUtleVZhbHVlSW5Bc3RPYmplY3QocmVjb3JkZXIsIGNvbnRlbnQsIGRlcHMsIHBhY2thZ2VOYW1lKTtcbiAgICAgIH1cbiAgICAgIGNvbnN0IGRldkRlcE5vZGUgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChkZXZEZXBzLCBwYWNrYWdlTmFtZSk7XG4gICAgICBpZiAoZGV2RGVwTm9kZSkge1xuICAgICAgICByZW1vdmVLZXlWYWx1ZUluQXN0T2JqZWN0KHJlY29yZGVyLCBjb250ZW50LCBkZXZEZXBzLCBwYWNrYWdlTmFtZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaG9zdC5jb21taXRVcGRhdGUocmVjb3JkZXIpO1xuICAgIHJldHVybiBob3N0O1xuICB9O1xufVxuXG4vKipcbiAqIEFwcGVuZCBhZGRpdGlvbmFsIEphdmFzY3JpcHQgLyBUeXBlc2NyaXB0IGZpbGVzIG5lZWRlZCB0byBjb21waWxlIGFuIEFuZ3VsYXJcbiAqIHByb2plY3QgdW5kZXIgQmF6ZWwuXG4gKi9cbmZ1bmN0aW9uIGFkZEZpbGVzUmVxdWlyZWRCeUJhemVsKG9wdGlvbnM6IFNjaGVtYSkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUpID0+IHtcbiAgICByZXR1cm4gbWVyZ2VXaXRoKGFwcGx5KHVybCgnLi9maWxlcycpLCBbXG4gICAgICBhcHBseVRlbXBsYXRlcyh7fSksXG4gICAgXSkpO1xuICB9O1xufVxuXG4vKipcbiAqIEFwcGVuZCAnL2JhemVsLW91dCcgdG8gdGhlIGdpdGlnbm9yZSBmaWxlLlxuICovXG5mdW5jdGlvbiB1cGRhdGVHaXRpZ25vcmUoKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIGNvbnN0IGdpdGlnbm9yZSA9ICcvLmdpdGlnbm9yZSc7XG4gICAgaWYgKCFob3N0LmV4aXN0cyhnaXRpZ25vcmUpKSB7XG4gICAgICByZXR1cm4gaG9zdDtcbiAgICB9XG4gICAgY29uc3QgZ2l0SWdub3JlQ29udGVudFJhdyA9IGhvc3QucmVhZChnaXRpZ25vcmUpO1xuICAgIGlmICghZ2l0SWdub3JlQ29udGVudFJhdykge1xuICAgICAgcmV0dXJuIGhvc3Q7XG4gICAgfVxuICAgIGNvbnN0IGdpdElnbm9yZUNvbnRlbnQgPSBnaXRJZ25vcmVDb250ZW50UmF3LnRvU3RyaW5nKCk7XG4gICAgaWYgKGdpdElnbm9yZUNvbnRlbnQuaW5jbHVkZXMoJ1xcbi9iYXplbC1vdXRcXG4nKSkge1xuICAgICAgcmV0dXJuIGhvc3Q7XG4gICAgfVxuICAgIGNvbnN0IGNvbXBpbGVkT3V0cHV0ID0gJyMgY29tcGlsZWQgb3V0cHV0XFxuJztcbiAgICBjb25zdCBpbmRleCA9IGdpdElnbm9yZUNvbnRlbnQuaW5kZXhPZihjb21waWxlZE91dHB1dCk7XG4gICAgY29uc3QgaW5zZXJ0aW9uSW5kZXggPSBpbmRleCA+PSAwID8gaW5kZXggKyBjb21waWxlZE91dHB1dC5sZW5ndGggOiBnaXRJZ25vcmVDb250ZW50Lmxlbmd0aDtcbiAgICBjb25zdCByZWNvcmRlciA9IGhvc3QuYmVnaW5VcGRhdGUoZ2l0aWdub3JlKTtcbiAgICByZWNvcmRlci5pbnNlcnRSaWdodChpbnNlcnRpb25JbmRleCwgJy9iYXplbC1vdXRcXG4nKTtcbiAgICBob3N0LmNvbW1pdFVwZGF0ZShyZWNvcmRlcik7XG4gICAgcmV0dXJuIGhvc3Q7XG4gIH07XG59XG5cbi8qKlxuICogQ2hhbmdlIHRoZSBhcmNoaXRlY3QgaW4gYW5ndWxhci5qc29uIHRvIHVzZSBCYXplbCBidWlsZGVyLlxuICovXG5mdW5jdGlvbiB1cGRhdGVBbmd1bGFySnNvblRvVXNlQmF6ZWxCdWlsZGVyKG9wdGlvbnM6IFNjaGVtYSk6IFJ1bGUge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBjb25zdCBuYW1lID0gb3B0aW9ucy5uYW1lICE7XG4gICAgY29uc3Qgd29ya3NwYWNlUGF0aCA9IGdldFdvcmtzcGFjZVBhdGgoaG9zdCk7XG4gICAgaWYgKCF3b3Jrc3BhY2VQYXRoKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIGFuZ3VsYXIuanNvbicpO1xuICAgIH1cbiAgICBjb25zdCB3b3Jrc3BhY2VDb250ZW50ID0gaG9zdC5yZWFkKHdvcmtzcGFjZVBhdGgpO1xuICAgIGlmICghd29ya3NwYWNlQ29udGVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gcmVhZCBhbmd1bGFyLmpzb24gY29udGVudCcpO1xuICAgIH1cbiAgICBjb25zdCB3b3Jrc3BhY2VKc29uQXN0ID0gcGFyc2VKc29uQXN0KHdvcmtzcGFjZUNvbnRlbnQudG9TdHJpbmcoKSkgYXMgSnNvbkFzdE9iamVjdDtcbiAgICBjb25zdCBwcm9qZWN0cyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KHdvcmtzcGFjZUpzb25Bc3QsICdwcm9qZWN0cycpO1xuICAgIGlmICghcHJvamVjdHMpIHtcbiAgICAgIHRocm93IG5ldyBTY2hlbWF0aWNzRXhjZXB0aW9uKCdFeHBlY3QgcHJvamVjdHMgaW4gYW5ndWxhci5qc29uIHRvIGJlIGFuIE9iamVjdCcpO1xuICAgIH1cbiAgICBjb25zdCBwcm9qZWN0ID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QocHJvamVjdHMgYXMgSnNvbkFzdE9iamVjdCwgbmFtZSk7XG4gICAgaWYgKCFwcm9qZWN0KSB7XG4gICAgICB0aHJvdyBuZXcgU2NoZW1hdGljc0V4Y2VwdGlvbihgRXhwZWN0ZWQgcHJvamVjdHMgdG8gY29udGFpbiAke25hbWV9YCk7XG4gICAgfVxuICAgIGNvbnN0IHJlY29yZGVyID0gaG9zdC5iZWdpblVwZGF0ZSh3b3Jrc3BhY2VQYXRoKTtcbiAgICBjb25zdCBpbmRlbnQgPSA4O1xuICAgIGNvbnN0IGFyY2hpdGVjdCA9XG4gICAgICAgIGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KHByb2plY3QgYXMgSnNvbkFzdE9iamVjdCwgJ2FyY2hpdGVjdCcpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QoXG4gICAgICAgIHJlY29yZGVyLCBhcmNoaXRlY3QsICdidWlsZCcsIHtcbiAgICAgICAgICBidWlsZGVyOiAnQGFuZ3VsYXIvYmF6ZWw6YnVpbGQnLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIHRhcmdldExhYmVsOiAnLy9zcmM6cHJvZGFwcCcsXG4gICAgICAgICAgICBiYXplbENvbW1hbmQ6ICdidWlsZCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBjb25maWd1cmF0aW9uczoge1xuICAgICAgICAgICAgcHJvZHVjdGlvbjoge1xuICAgICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vc3JjOnByb2RhcHAnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBpbmRlbnQpO1xuICAgIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0KFxuICAgICAgICByZWNvcmRlciwgYXJjaGl0ZWN0LCAnc2VydmUnLCB7XG4gICAgICAgICAgYnVpbGRlcjogJ0Bhbmd1bGFyL2JhemVsOmJ1aWxkJyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vc3JjOmRldnNlcnZlcicsXG4gICAgICAgICAgICBiYXplbENvbW1hbmQ6ICdydW4nLFxuICAgICAgICAgICAgd2F0Y2g6IHRydWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBjb25maWd1cmF0aW9uczoge1xuICAgICAgICAgICAgcHJvZHVjdGlvbjoge1xuICAgICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vc3JjOnByb2RzZXJ2ZXInLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBpbmRlbnQpO1xuXG4gICAgaWYgKGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGFyY2hpdGVjdCwgJ3Rlc3QnKSkge1xuICAgICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QoXG4gICAgICAgICAgcmVjb3JkZXIsIGFyY2hpdGVjdCwgJ3Rlc3QnLCB7XG4gICAgICAgICAgICBidWlsZGVyOiAnQGFuZ3VsYXIvYmF6ZWw6YnVpbGQnLFxuICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICBiYXplbENvbW1hbmQ6ICd0ZXN0JyxcbiAgICAgICAgICAgICAgdGFyZ2V0TGFiZWw6ICcvL3NyYzp0ZXN0JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBpbmRlbnQpO1xuICAgIH1cblxuICAgIGNvbnN0IGUyZUFyY2hpdGVjdCA9IGZpbmRFMmVBcmNoaXRlY3Qod29ya3NwYWNlSnNvbkFzdCwgbmFtZSk7XG4gICAgaWYgKGUyZUFyY2hpdGVjdCAmJiBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChlMmVBcmNoaXRlY3QsICdlMmUnKSkge1xuICAgICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QoXG4gICAgICAgICAgcmVjb3JkZXIsIGUyZUFyY2hpdGVjdCwgJ2UyZScsIHtcbiAgICAgICAgICAgIGJ1aWxkZXI6ICdAYW5ndWxhci9iYXplbDpidWlsZCcsXG4gICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgIGJhemVsQ29tbWFuZDogJ3Rlc3QnLFxuICAgICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vZTJlOmRldnNlcnZlcl90ZXN0JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjb25maWd1cmF0aW9uczoge1xuICAgICAgICAgICAgICBwcm9kdWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0TGFiZWw6ICcvL2UyZTpwcm9kc2VydmVyX3Rlc3QnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgICAgICAgaW5kZW50KTtcbiAgICB9XG5cbiAgICBob3N0LmNvbW1pdFVwZGF0ZShyZWNvcmRlcik7XG4gICAgcmV0dXJuIGhvc3Q7XG4gIH07XG59XG5cbi8qKlxuICogQ3JlYXRlIGEgYmFja3VwIGZvciB0aGUgb3JpZ2luYWwgYW5ndWxhci5qc29uIGZpbGUgaW4gY2FzZSB1c2VyIHdhbnRzIHRvXG4gKiBlamVjdCBCYXplbCBhbmQgcmV2ZXJ0IHRvIHRoZSBvcmlnaW5hbCB3b3JrZmxvdy5cbiAqL1xuZnVuY3Rpb24gYmFja3VwQW5ndWxhckpzb24oKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSwgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCkgPT4ge1xuICAgIGNvbnN0IHdvcmtzcGFjZVBhdGggPSBnZXRXb3Jrc3BhY2VQYXRoKGhvc3QpO1xuICAgIGlmICghd29ya3NwYWNlUGF0aCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBob3N0LmNyZWF0ZShcbiAgICAgICAgYCR7d29ya3NwYWNlUGF0aH0uYmFrYCwgJy8vIFRoaXMgaXMgYSBiYWNrdXAgZmlsZSBvZiB0aGUgb3JpZ2luYWwgYW5ndWxhci5qc29uLiAnICtcbiAgICAgICAgICAgICdUaGlzIGZpbGUgaXMgbmVlZGVkIGluIGNhc2UgeW91IHdhbnQgdG8gcmV2ZXJ0IHRvIHRoZSB3b3JrZmxvdyB3aXRob3V0IEJhemVsLlxcblxcbicgK1xuICAgICAgICAgICAgaG9zdC5yZWFkKHdvcmtzcGFjZVBhdGgpKTtcbiAgfTtcbn1cblxuLyoqXG4gKiBAYW5ndWxhci9iYXplbCByZXF1aXJlcyBtaW5pbXVtIHZlcnNpb24gb2YgcnhqcyB0byBiZSA2LjQuMC4gVGhpcyBmdW5jdGlvblxuICogdXBncmFkZXMgdGhlIHZlcnNpb24gb2YgcnhqcyBpbiBwYWNrYWdlLmpzb24gaWYgbmVjZXNzYXJ5LlxuICovXG5mdW5jdGlvbiB1cGdyYWRlUnhqcygpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgY29uc3QgcGFja2FnZUpzb24gPSAncGFja2FnZS5qc29uJztcbiAgICBpZiAoIWhvc3QuZXhpc3RzKHBhY2thZ2VKc29uKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgZmluZCAke3BhY2thZ2VKc29ufWApO1xuICAgIH1cbiAgICBjb25zdCBjb250ZW50ID0gaG9zdC5yZWFkKHBhY2thZ2VKc29uKTtcbiAgICBpZiAoIWNvbnRlbnQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIHJlYWQgcGFja2FnZS5qc29uIGNvbnRlbnQnKTtcbiAgICB9XG4gICAgY29uc3QganNvbkFzdCA9IHBhcnNlSnNvbkFzdChjb250ZW50LnRvU3RyaW5nKCkpO1xuICAgIGlmICghaXNKc29uQXN0T2JqZWN0KGpzb25Bc3QpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBwYXJzZSBKU09OIGZvciAke3BhY2thZ2VKc29ufWApO1xuICAgIH1cbiAgICBjb25zdCBkZXBzID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoanNvbkFzdCwgJ2RlcGVuZGVuY2llcycpO1xuICAgIGlmICghaXNKc29uQXN0T2JqZWN0KGRlcHMpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBmaW5kIGRlcGVuZGVuY2llcyBpbiAke3BhY2thZ2VKc29ufWApO1xuICAgIH1cbiAgICBjb25zdCByeGpzID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoZGVwcywgJ3J4anMnKTtcbiAgICBpZiAoIXJ4anMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGZpbmQgcnhqcyBpbiBkZXBlbmRlbmNpZXMgb2YgJHtwYWNrYWdlSnNvbn1gKTtcbiAgICB9XG4gICAgY29uc3QgdmFsdWUgPSByeGpzLnZhbHVlIGFzIHN0cmluZzsgIC8vIHZhbHVlIGNhbiBiZSB2ZXJzaW9uIG9yIHJhbmdlXG4gICAgY29uc3QgbWF0Y2ggPSB2YWx1ZS5tYXRjaCgvKFxcZCkrXFwuKFxcZCkrLihcXGQpKyQvKTtcbiAgICBpZiAobWF0Y2gpIHtcbiAgICAgIGNvbnN0IFtfLCBtYWpvciwgbWlub3JdID0gbWF0Y2g7XG4gICAgICBpZiAobWFqb3IgPCAnNicgfHwgKG1ham9yID09PSAnNicgJiYgbWlub3IgPCAnNCcpKSB7XG4gICAgICAgIGNvbnN0IHJlY29yZGVyID0gaG9zdC5iZWdpblVwZGF0ZShwYWNrYWdlSnNvbik7XG4gICAgICAgIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0KHJlY29yZGVyLCBkZXBzLCAncnhqcycsICd+Ni40LjAnKTtcbiAgICAgICAgaG9zdC5jb21taXRVcGRhdGUocmVjb3JkZXIpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb250ZXh0LmxvZ2dlci5pbmZvKFxuICAgICAgICAgICdDb3VsZCBub3QgZGV0ZXJtaW5lIHZlcnNpb24gb2Ygcnhqcy4gXFxuJyArXG4gICAgICAgICAgJ1BsZWFzZSBtYWtlIHN1cmUgdGhhdCB2ZXJzaW9uIGlzIGF0IGxlYXN0IDYuNC4wLicpO1xuICAgIH1cbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuLyoqXG4gKiBXaGVuIHVzaW5nIEFuZ3VsYXIgTlBNIHBhY2thZ2VzIGFuZCBidWlsZGluZyB3aXRoIEFPVCBjb21waWxhdGlvbiwgbmdjXG4gKiByZXF1aXJlcyBuZ3N1bWFtcnkgZmlsZXMgYnV0IHRoZXkgYXJlIG5vdCBzaGlwcGVkLiBUaGlzIGZ1bmN0aW9uIGFkZHMgYVxuICogcG9zdGluc3RhbGwgc3RlcCB0byBnZW5lcmF0ZSB0aGVzZSBmaWxlcy5cbiAqL1xuZnVuY3Rpb24gYWRkUG9zdGluc3RhbGxUb0dlbmVyYXRlTmdTdW1tYXJpZXMoKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSwgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCkgPT4ge1xuICAgIGlmICghaG9zdC5leGlzdHMoJ2FuZ3VsYXItbWV0YWRhdGEudHNjb25maWcuanNvbicpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHBhY2thZ2VKc29uID0gJ3BhY2thZ2UuanNvbic7XG4gICAgaWYgKCFob3N0LmV4aXN0cyhwYWNrYWdlSnNvbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IGZpbmQgJHtwYWNrYWdlSnNvbn1gKTtcbiAgICB9XG4gICAgY29uc3QgY29udGVudCA9IGhvc3QucmVhZChwYWNrYWdlSnNvbik7XG4gICAgaWYgKCFjb250ZW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byByZWFkIHBhY2thZ2UuanNvbiBjb250ZW50Jyk7XG4gICAgfVxuICAgIGNvbnN0IGpzb25Bc3QgPSBwYXJzZUpzb25Bc3QoY29udGVudC50b1N0cmluZygpKTtcbiAgICBpZiAoIWlzSnNvbkFzdE9iamVjdChqc29uQXN0KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gcGFyc2UgSlNPTiBmb3IgJHtwYWNrYWdlSnNvbn1gKTtcbiAgICB9XG4gICAgY29uc3Qgc2NyaXB0cyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGpzb25Bc3QsICdzY3JpcHRzJykgYXMgSnNvbkFzdE9iamVjdDtcbiAgICBjb25zdCByZWNvcmRlciA9IGhvc3QuYmVnaW5VcGRhdGUocGFja2FnZUpzb24pO1xuICAgIGNvbnN0IG5nY0NvbW1hbmQgPSAnbmdjIC1wIC4vYW5ndWxhci1tZXRhZGF0YS50c2NvbmZpZy5qc29uJztcbiAgICBpZiAoc2NyaXB0cykge1xuICAgICAgY29uc3QgcG9zdEluc3RhbGwgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChzY3JpcHRzLCAncG9zdGluc3RhbGwnKTtcbiAgICAgIGlmIChwb3N0SW5zdGFsbCkge1xuICAgICAgICBjb25zdCBjb21tYW5kID0gYCR7cG9zdEluc3RhbGwudmFsdWV9OyAke25nY0NvbW1hbmR9YDtcbiAgICAgICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QocmVjb3JkZXIsIHNjcmlwdHMsICdwb3N0aW5zdGFsbCcsIGNvbW1hbmQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaW5zZXJ0UHJvcGVydHlJbkFzdE9iamVjdEluT3JkZXIocmVjb3JkZXIsIHNjcmlwdHMsICdwb3N0aW5zdGFsbCcsIG5nY0NvbW1hbmQsIDQpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpbnNlcnRQcm9wZXJ0eUluQXN0T2JqZWN0SW5PcmRlcihcbiAgICAgICAgICByZWNvcmRlciwganNvbkFzdCwgJ3NjcmlwdHMnLCB7XG4gICAgICAgICAgICBwb3N0aW5zdGFsbDogbmdjQ29tbWFuZCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIDIpO1xuICAgIH1cbiAgICBob3N0LmNvbW1pdFVwZGF0ZShyZWNvcmRlcik7XG4gICAgcmV0dXJuIGhvc3Q7XG4gIH07XG59XG5cbi8qKlxuICogU2NoZWR1bGUgYSB0YXNrIHRvIHBlcmZvcm0gbnBtIC8geWFybiBpbnN0YWxsLlxuICovXG5mdW5jdGlvbiBpbnN0YWxsTm9kZU1vZHVsZXMob3B0aW9uczogU2NoZW1hKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSwgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCkgPT4ge1xuICAgIGlmICghb3B0aW9ucy5za2lwSW5zdGFsbCkge1xuICAgICAgY29udGV4dC5hZGRUYXNrKG5ldyBOb2RlUGFja2FnZUluc3RhbGxUYXNrKCkpO1xuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24ob3B0aW9uczogU2NoZW1hKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIG9wdGlvbnMubmFtZSA9IG9wdGlvbnMubmFtZSB8fCBnZXRXb3Jrc3BhY2UoaG9zdCkuZGVmYXVsdFByb2plY3Q7XG4gICAgaWYgKCFvcHRpb25zLm5hbWUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignUGxlYXNlIHNwZWNpZnkgYSBwcm9qZWN0IHVzaW5nIFwiLS1uYW1lIHByb2plY3QtbmFtZVwiJyk7XG4gICAgfVxuICAgIHZhbGlkYXRlUHJvamVjdE5hbWUob3B0aW9ucy5uYW1lKTtcblxuICAgIHJldHVybiBjaGFpbihbXG4gICAgICBhZGRGaWxlc1JlcXVpcmVkQnlCYXplbChvcHRpb25zKSxcbiAgICAgIGFkZERldkRlcGVuZGVuY2llc1RvUGFja2FnZUpzb24ob3B0aW9ucyksXG4gICAgICByZW1vdmVPYnNvbGV0ZURlcGVuZGVuY2llc0Zyb21QYWNrYWdlSnNvbihvcHRpb25zKSxcbiAgICAgIGFkZFBvc3RpbnN0YWxsVG9HZW5lcmF0ZU5nU3VtbWFyaWVzKCksXG4gICAgICBiYWNrdXBBbmd1bGFySnNvbigpLFxuICAgICAgdXBkYXRlQW5ndWxhckpzb25Ub1VzZUJhemVsQnVpbGRlcihvcHRpb25zKSxcbiAgICAgIHVwZGF0ZUdpdGlnbm9yZSgpLFxuICAgICAgdXBncmFkZVJ4anMoKSxcbiAgICAgIGluc3RhbGxOb2RlTW9kdWxlcyhvcHRpb25zKSxcbiAgICBdKTtcbiAgfTtcbn1cbiJdfQ==
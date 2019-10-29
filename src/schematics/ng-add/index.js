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
                '@bazel/karma': '0.39.0',
                '@bazel/protractor': '0.39.0',
                '@bazel/rollup': '0.39.0',
                '@bazel/terser': '0.39.0',
                '@bazel/typescript': '0.39.0',
                'history-server': '^1.3.1',
                'rollup': '^1.25.2',
                'rollup-plugin-commonjs': '^10.1.0',
                'rollup-plugin-node-resolve': '^5.2.0',
                'terser': '^4.3.9',
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
     * When using Ivy, ngcc must be run as a postinstall step.
     * This function adds this postinstall step.
     */
    function addPostinstallToRunNgcc() {
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
            var scripts = json_utils_1.findPropertyInAstObject(jsonAst, 'scripts');
            var recorder = host.beginUpdate(packageJson);
            // For bazel we need to compile the all files in place so we
            // don't use `--first-only` or `--create-ivy-entry-points`
            var ngccCommand = 'ngcc --properties es2015 browser module main';
            if (scripts) {
                var postInstall = json_utils_1.findPropertyInAstObject(scripts, 'postinstall');
                if (postInstall && postInstall.value) {
                    var value = postInstall.value;
                    if (/\bngcc\b/.test(value)) {
                        // `ngcc` is already in the postinstall script
                        value =
                            value.replace(/\s*--first-only\b/, '').replace(/\s*--create-ivy-entry-points\b/, '');
                        json_utils_2.replacePropertyInAstObject(recorder, scripts, 'postinstall', value);
                    }
                    else {
                        var command = postInstall.value + "; " + ngccCommand;
                        json_utils_2.replacePropertyInAstObject(recorder, scripts, 'postinstall', command);
                    }
                }
                else {
                    json_utils_1.insertPropertyInAstObjectInOrder(recorder, scripts, 'postinstall', ngccCommand, 4);
                }
            }
            else {
                json_utils_1.insertPropertyInAstObjectInOrder(recorder, jsonAst, 'scripts', {
                    postinstall: ngccCommand,
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
                addPostinstallToRunNgcc(),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvc2NoZW1hdGljcy9uZy1hZGQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCw2Q0FBaUU7SUFDakUseURBQTJJO0lBQzNJLDBEQUF3RTtJQUN4RSw2REFBa0Y7SUFDbEYscUVBQWlIO0lBQ2pILHFFQUEyRTtJQUUzRSwrRUFBNkc7SUFDN0cseUZBQTREO0lBSzVEOzs7O09BSUc7SUFDSCxTQUFTLCtCQUErQixDQUFDLE9BQWU7UUFDdEQsT0FBTyxVQUFDLElBQVU7O1lBQ2hCLElBQU0sV0FBVyxHQUFHLGNBQWMsQ0FBQztZQUNuQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsRUFBRTtnQkFDN0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxvQkFBa0IsV0FBYSxDQUFDLENBQUM7YUFDbEQ7WUFDRCxJQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDbEQsSUFBSSxDQUFDLGtCQUFrQixFQUFFO2dCQUN2QixNQUFNLElBQUksS0FBSyxDQUFDLHFDQUFxQyxDQUFDLENBQUM7YUFDeEQ7WUFDRCxJQUFNLE9BQU8sR0FBRyxtQkFBWSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsRUFBRSxDQUFrQixDQUFDO1lBQzdFLElBQU0sSUFBSSxHQUFHLG9DQUF1QixDQUFDLE9BQU8sRUFBRSxjQUFjLENBQWtCLENBQUM7WUFDL0UsSUFBTSxPQUFPLEdBQUcsb0NBQXVCLENBQUMsT0FBTyxFQUFFLGlCQUFpQixDQUFrQixDQUFDO1lBRXJGLElBQU0sZUFBZSxHQUFHLG9DQUF1QixDQUFDLElBQUksRUFBRSxlQUFlLENBQUMsQ0FBQztZQUN2RSxJQUFJLENBQUMsZUFBZSxFQUFFO2dCQUNwQixNQUFN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QWUsRUFBRTtnQkFDakIsV0FBVyxFQUFFO2dCQUNiLGtCQUFrQixDQUFDLE9BQU8sQ0FBQzthQUM1QixDQUFDLENBQUM7UUFDTCxDQUFDLENBQUM7SUFDSixDQUFDO0lBcEJELDRCQW9CQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKlxuICogQGZpbGVvdmVydmlldyBTY2hlbWF0aWNzIGZvciBuZy1uZXcgcHJvamVjdCB0aGF0IGJ1aWxkcyB3aXRoIEJhemVsLlxuICovXG5cbmltcG9ydCB7SnNvbkFzdE9iamVjdCwgcGFyc2VKc29uQXN0fSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQge1J1bGUsIFNjaGVtYXRpY0NvbnRleHQsIFNjaGVtYXRpY3NFeGNlcHRpb24sIFRyZWUsIGFwcGx5LCBhcHBseVRlbXBsYXRlcywgY2hhaW4sIG1lcmdlV2l0aCwgdXJsfSBmcm9tICdAYW5ndWxhci1kZXZraXQvc2NoZW1hdGljcyc7XG5pbXBvcnQge05vZGVQYWNrYWdlSW5zdGFsbFRhc2t9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9zY2hlbWF0aWNzL3Rhc2tzJztcbmltcG9ydCB7Z2V0V29ya3NwYWNlLCBnZXRXb3Jrc3BhY2VQYXRofSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvY29uZmlnJztcbmltcG9ydCB7ZmluZFByb3BlcnR5SW5Bc3RPYmplY3QsIGluc2VydFByb3BlcnR5SW5Bc3RPYmplY3RJbk9yZGVyfSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvanNvbi11dGlscyc7XG5pbXBvcnQge3ZhbGlkYXRlUHJvamVjdE5hbWV9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS92YWxpZGF0aW9uJztcblxuaW1wb3J0IHtpc0pzb25Bc3RPYmplY3QsIHJlbW92ZUtleVZhbHVlSW5Bc3RPYmplY3QsIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0fSBmcm9tICcuLi91dGlsaXR5L2pzb24tdXRpbHMnO1xuaW1wb3J0IHtmaW5kRTJlQXJjaGl0ZWN0fSBmcm9tICcuLi91dGlsaXR5L3dvcmtzcGFjZS11dGlscyc7XG5cbmltcG9ydCB7U2NoZW1hfSBmcm9tICcuL3NjaGVtYSc7XG5cblxuLyoqXG4gKiBQYWNrYWdlcyB0aGF0IGJ1aWxkIHVuZGVyIEJhemVsIHJlcXVpcmUgYWRkaXRpb25hbCBkZXYgZGVwZW5kZW5jaWVzLiBUaGlzXG4gKiBmdW5jdGlvbiBhZGRzIHRob3NlIGRlcGVuZGVuY2llcyB0byBcImRldkRlcGVuZGVuY2llc1wiIHNlY3Rpb24gaW5cbiAqIHBhY2thZ2UuanNvbi5cbiAqL1xuZnVuY3Rpb24gYWRkRGV2RGVwZW5kZW5jaWVzVG9QYWNrYWdlSnNvbihvcHRpb25zOiBTY2hlbWEpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgY29uc3QgcGFja2FnZUpzb24gPSAncGFja2FnZS5qc29uJztcbiAgICBpZiAoIWhvc3QuZXhpc3RzKHBhY2thZ2VKc29uKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgZmluZCAke3BhY2thZ2VKc29ufWApO1xuICAgIH1cbiAgICBjb25zdCBwYWNrYWdlSnNvbkNvbnRlbnQgPSBob3N0LnJlYWQocGFja2FnZUpzb24pO1xuICAgIGlmICghcGFja2FnZUpzb25Db250ZW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byByZWFkIHBhY2thZ2UuanNvbiBjb250ZW50Jyk7XG4gICAgfVxuICAgIGNvbnN0IGpzb25Bc3QgPSBwYXJzZUpzb25Bc3QocGFja2FnZUpzb25Db250ZW50LnRvU3RyaW5nKCkpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgY29uc3QgZGVwcyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGpzb25Bc3QsICdkZXBlbmRlbmNpZXMnKSBhcyBKc29uQXN0T2JqZWN0O1xuICAgIGNvbnN0IGRldkRlcHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChqc29uQXN0LCAnZGV2RGVwZW5kZW5jaWVzJykgYXMgSnNvbkFzdE9iamVjdDtcblxuICAgIGNvbnN0IGFuZ3VsYXJDb3JlTm9kZSA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGRlcHMsICdAYW5ndWxhci9jb3JlJyk7XG4gICAgaWYgKCFhbmd1bGFyQ29yZU5vZGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQGFuZ3VsYXIvY29yZSBkZXBlbmRlbmN5IG5vdCBmb3VuZCBpbiBwYWNrYWdlLmpzb24nKTtcbiAgICB9XG4gICAgY29uc3QgYW5ndWxhckNvcmVWZXJzaW9uID0gYW5ndWxhckNvcmVOb2RlLnZhbHVlIGFzIHN0cmluZztcblxuICAgIGNvbnN0IGRldkRlcGVuZGVuY2llczoge1trOiBzdHJpbmddOiBzdHJpbmd9ID0ge1xuICAgICAgJ0Bhbmd1bGFyL2JhemVsJzogYW5ndWxhckNvcmVWZXJzaW9uLFxuICAgICAgJ0BiYXplbC9iYXplbCc6ICdeMC4yOC4xJyxcbiAgICAgICdAYmF6ZWwvaWJhemVsJzogJ14wLjEwLjInLFxuICAgICAgJ0BiYXplbC9rYXJtYSc6ICcwLjM5LjAnLFxuICAgICAgJ0BiYXplbC9wcm90cmFjdG9yJzogJzAuMzkuMCcsXG4gICAgICAnQGJhemVsL3JvbGx1cCc6ICcwLjM5LjAnLFxuICAgICAgJ0BiYXplbC90ZXJzZXInOiAnMC4zOS4wJyxcbiAgICAgICdAYmF6ZWwvdHlwZXNjcmlwdCc6ICcwLjM5LjAnLFxuICAgICAgJ2hpc3Rvcnktc2VydmVyJzogJ14xLjMuMScsXG4gICAgICAncm9sbHVwJzogJ14xLjI1LjInLFxuICAgICAgJ3JvbGx1cC1wbHVnaW4tY29tbW9uanMnOiAnXjEwLjEuMCcsXG4gICAgICAncm9sbHVwLXBsdWdpbi1ub2RlLXJlc29sdmUnOiAnXjUuMi4wJyxcbiAgICAgICd0ZXJzZXInOiAnXjQuMy45JyxcbiAgICB9O1xuXG4gICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKHBhY2thZ2VKc29uKTtcbiAgICBmb3IgKGNvbnN0IHBhY2thZ2VOYW1lIG9mIE9iamVjdC5rZXlzKGRldkRlcGVuZGVuY2llcykpIHtcbiAgICAgIGNvbnN0IGV4aXN0aW5nRGVwID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoZGVwcywgcGFja2FnZU5hbWUpO1xuICAgICAgaWYgKGV4aXN0aW5nRGVwKSB7XG4gICAgICAgIGNvbnN0IGNvbnRlbnQgPSBwYWNrYWdlSnNvbkNvbnRlbnQudG9TdHJpbmcoKTtcbiAgICAgICAgcmVtb3ZlS2V5VmFsdWVJbkFzdE9iamVjdChyZWNvcmRlciwgY29udGVudCwgZGVwcywgcGFja2FnZU5hbWUpO1xuICAgICAgfVxuICAgICAgY29uc3QgdmVyc2lvbiA9IGRldkRlcGVuZGVuY2llc1twYWNrYWdlTmFtZV07XG4gICAgICBjb25zdCBpbmRlbnQgPSA0O1xuICAgICAgaWYgKGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGRldkRlcHMsIHBhY2thZ2VOYW1lKSkge1xuICAgICAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChyZWNvcmRlciwgZGV2RGVwcywgcGFja2FnZU5hbWUsIHZlcnNpb24sIGluZGVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpbnNlcnRQcm9wZXJ0eUluQXN0T2JqZWN0SW5PcmRlcihyZWNvcmRlciwgZGV2RGVwcywgcGFja2FnZU5hbWUsIHZlcnNpb24sIGluZGVudCk7XG4gICAgICB9XG4gICAgfVxuICAgIGhvc3QuY29tbWl0VXBkYXRlKHJlY29yZGVyKTtcbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuLyoqXG4gKiBSZW1vdmUgcGFja2FnZXMgdGhhdCBhcmUgbm90IG5lZWRlZCB1bmRlciBCYXplbC5cbiAqIEBwYXJhbSBvcHRpb25zXG4gKi9cbmZ1bmN0aW9uIHJlbW92ZU9ic29sZXRlRGVwZW5kZW5jaWVzRnJvbVBhY2thZ2VKc29uKG9wdGlvbnM6IFNjaGVtYSkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUpID0+IHtcbiAgICBjb25zdCBwYWNrYWdlSnNvbiA9ICdwYWNrYWdlLmpzb24nO1xuICAgIGlmICghaG9zdC5leGlzdHMocGFja2FnZUpzb24pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBmaW5kICR7cGFja2FnZUpzb259YCk7XG4gICAgfVxuICAgIGNvbnN0IGJ1ZmZlciA9IGhvc3QucmVhZChwYWNrYWdlSnNvbik7XG4gICAgaWYgKCFidWZmZXIpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIHJlYWQgcGFja2FnZS5qc29uIGNvbnRlbnQnKTtcbiAgICB9XG4gICAgY29uc3QgY29udGVudCA9IGJ1ZmZlci50b1N0cmluZygpO1xuICAgIGNvbnN0IGpzb25Bc3QgPSBwYXJzZUpzb25Bc3QoY29udGVudCkgYXMgSnNvbkFzdE9iamVjdDtcbiAgICBjb25zdCBkZXBzID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoanNvbkFzdCwgJ2RlcGVuZGVuY2llcycpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgY29uc3QgZGV2RGVwcyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGpzb25Bc3QsICdkZXZEZXBlbmRlbmNpZXMnKSBhcyBKc29uQXN0T2JqZWN0O1xuXG4gICAgY29uc3QgZGVwc1RvUmVtb3ZlID0gW1xuICAgICAgJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyJyxcbiAgICBdO1xuXG4gICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKHBhY2thZ2VKc29uKTtcblxuICAgIGZvciAoY29uc3QgcGFja2FnZU5hbWUgb2YgZGVwc1RvUmVtb3ZlKSB7XG4gICAgICBjb25zdCBkZXBOb2RlID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoZGVwcywgcGFja2FnZU5hbWUpO1xuICAgICAgaWYgKGRlcE5vZGUpIHtcbiAgICAgICAgcmVtb3ZlS2V5VmFsdWVJbkFzdE9iamVjdChyZWNvcmRlciwgY29udGVudCwgZGVwcywgcGFja2FnZU5hbWUpO1xuICAgICAgfVxuICAgICAgY29uc3QgZGV2RGVwTm9kZSA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGRldkRlcHMsIHBhY2thZ2VOYW1lKTtcbiAgICAgIGlmIChkZXZEZXBOb2RlKSB7XG4gICAgICAgIHJlbW92ZUtleVZhbHVlSW5Bc3RPYmplY3QocmVjb3JkZXIsIGNvbnRlbnQsIGRldkRlcHMsIHBhY2thZ2VOYW1lKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBob3N0LmNvbW1pdFVwZGF0ZShyZWNvcmRlcik7XG4gICAgcmV0dXJuIGhvc3Q7XG4gIH07XG59XG5cbi8qKlxuICogQXBwZW5kIGFkZGl0aW9uYWwgSmF2YXNjcmlwdCAvIFR5cGVzY3JpcHQgZmlsZXMgbmVlZGVkIHRvIGNvbXBpbGUgYW4gQW5ndWxhclxuICogcHJvamVjdCB1bmRlciBCYXplbC5cbiAqL1xuZnVuY3Rpb24gYWRkRmlsZXNSZXF1aXJlZEJ5QmF6ZWwob3B0aW9uczogU2NoZW1hKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIHJldHVybiBtZXJnZVdpdGgoYXBwbHkodXJsKCcuL2ZpbGVzJyksIFtcbiAgICAgIGFwcGx5VGVtcGxhdGVzKHt9KSxcbiAgICBdKSk7XG4gIH07XG59XG5cbi8qKlxuICogQXBwZW5kICcvYmF6ZWwtb3V0JyB0byB0aGUgZ2l0aWdub3JlIGZpbGUuXG4gKi9cbmZ1bmN0aW9uIHVwZGF0ZUdpdGlnbm9yZSgpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgY29uc3QgZ2l0aWdub3JlID0gJy8uZ2l0aWdub3JlJztcbiAgICBpZiAoIWhvc3QuZXhpc3RzKGdpdGlnbm9yZSkpIHtcbiAgICAgIHJldHVybiBob3N0O1xuICAgIH1cbiAgICBjb25zdCBnaXRJZ25vcmVDb250ZW50UmF3ID0gaG9zdC5yZWFkKGdpdGlnbm9yZSk7XG4gICAgaWYgKCFnaXRJZ25vcmVDb250ZW50UmF3KSB7XG4gICAgICByZXR1cm4gaG9zdDtcbiAgICB9XG4gICAgY29uc3QgZ2l0SWdub3JlQ29udGVudCA9IGdpdElnbm9yZUNvbnRlbnRSYXcudG9TdHJpbmcoKTtcbiAgICBpZiAoZ2l0SWdub3JlQ29udGVudC5pbmNsdWRlcygnXFxuL2JhemVsLW91dFxcbicpKSB7XG4gICAgICByZXR1cm4gaG9zdDtcbiAgICB9XG4gICAgY29uc3QgY29tcGlsZWRPdXRwdXQgPSAnIyBjb21waWxlZCBvdXRwdXRcXG4nO1xuICAgIGNvbnN0IGluZGV4ID0gZ2l0SWdub3JlQ29udGVudC5pbmRleE9mKGNvbXBpbGVkT3V0cHV0KTtcbiAgICBjb25zdCBpbnNlcnRpb25JbmRleCA9IGluZGV4ID49IDAgPyBpbmRleCArIGNvbXBpbGVkT3V0cHV0Lmxlbmd0aCA6IGdpdElnbm9yZUNvbnRlbnQubGVuZ3RoO1xuICAgIGNvbnN0IHJlY29yZGVyID0gaG9zdC5iZWdpblVwZGF0ZShnaXRpZ25vcmUpO1xuICAgIHJlY29yZGVyLmluc2VydFJpZ2h0KGluc2VydGlvbkluZGV4LCAnL2JhemVsLW91dFxcbicpO1xuICAgIGhvc3QuY29tbWl0VXBkYXRlKHJlY29yZGVyKTtcbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuLyoqXG4gKiBDaGFuZ2UgdGhlIGFyY2hpdGVjdCBpbiBhbmd1bGFyLmpzb24gdG8gdXNlIEJhemVsIGJ1aWxkZXIuXG4gKi9cbmZ1bmN0aW9uIHVwZGF0ZUFuZ3VsYXJKc29uVG9Vc2VCYXplbEJ1aWxkZXIob3B0aW9uczogU2NoZW1hKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSwgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCkgPT4ge1xuICAgIGNvbnN0IG5hbWUgPSBvcHRpb25zLm5hbWUgITtcbiAgICBjb25zdCB3b3Jrc3BhY2VQYXRoID0gZ2V0V29ya3NwYWNlUGF0aChob3N0KTtcbiAgICBpZiAoIXdvcmtzcGFjZVBhdGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IGZpbmQgYW5ndWxhci5qc29uJyk7XG4gICAgfVxuICAgIGNvbnN0IHdvcmtzcGFjZUNvbnRlbnQgPSBob3N0LnJlYWQod29ya3NwYWNlUGF0aCk7XG4gICAgaWYgKCF3b3Jrc3BhY2VDb250ZW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byByZWFkIGFuZ3VsYXIuanNvbiBjb250ZW50Jyk7XG4gICAgfVxuICAgIGNvbnN0IHdvcmtzcGFjZUpzb25Bc3QgPSBwYXJzZUpzb25Bc3Qod29ya3NwYWNlQ29udGVudC50b1N0cmluZygpKSBhcyBKc29uQXN0T2JqZWN0O1xuICAgIGNvbnN0IHByb2plY3RzID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3Qod29ya3NwYWNlSnNvbkFzdCwgJ3Byb2plY3RzJyk7XG4gICAgaWYgKCFwcm9qZWN0cykge1xuICAgICAgdGhyb3cgbmV3IFNjaGVtYXRpY3NFeGNlcHRpb24oJ0V4cGVjdCBwcm9qZWN0cyBpbiBhbmd1bGFyLmpzb24gdG8gYmUgYW4gT2JqZWN0Jyk7XG4gICAgfVxuICAgIGNvbnN0IHByb2plY3QgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChwcm9qZWN0cyBhcyBKc29uQXN0T2JqZWN0LCBuYW1lKTtcbiAgICBpZiAoIXByb2plY3QpIHtcbiAgICAgIHRocm93IG5ldyBTY2hlbWF0aWNzRXhjZXB0aW9uKGBFeHBlY3RlZCBwcm9qZWN0cyB0byBjb250YWluICR7bmFtZX1gKTtcbiAgICB9XG4gICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKHdvcmtzcGFjZVBhdGgpO1xuICAgIGNvbnN0IGluZGVudCA9IDg7XG4gICAgY29uc3QgYXJjaGl0ZWN0ID1cbiAgICAgICAgZmluZFByb3BlcnR5SW5Bc3RPYmplY3QocHJvamVjdCBhcyBKc29uQXN0T2JqZWN0LCAnYXJjaGl0ZWN0JykgYXMgSnNvbkFzdE9iamVjdDtcbiAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChcbiAgICAgICAgcmVjb3JkZXIsIGFyY2hpdGVjdCwgJ2J1aWxkJywge1xuICAgICAgICAgIGJ1aWxkZXI6ICdAYW5ndWxhci9iYXplbDpidWlsZCcsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgdGFyZ2V0TGFiZWw6ICcvL3NyYzpwcm9kYXBwJyxcbiAgICAgICAgICAgIGJhemVsQ29tbWFuZDogJ2J1aWxkJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvbmZpZ3VyYXRpb25zOiB7XG4gICAgICAgICAgICBwcm9kdWN0aW9uOiB7XG4gICAgICAgICAgICAgIHRhcmdldExhYmVsOiAnLy9zcmM6cHJvZGFwcCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGluZGVudCk7XG4gICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QoXG4gICAgICAgIHJlY29yZGVyLCBhcmNoaXRlY3QsICdzZXJ2ZScsIHtcbiAgICAgICAgICBidWlsZGVyOiAnQGFuZ3VsYXIvYmF6ZWw6YnVpbGQnLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIHRhcmdldExhYmVsOiAnLy9zcmM6ZGV2c2VydmVyJyxcbiAgICAgICAgICAgIGJhemVsQ29tbWFuZDogJ3J1bicsXG4gICAgICAgICAgICB3YXRjaDogdHJ1ZSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvbmZpZ3VyYXRpb25zOiB7XG4gICAgICAgICAgICBwcm9kdWN0aW9uOiB7XG4gICAgICAgICAgICAgIHRhcmdldExhYmVsOiAnLy9zcmM6cHJvZHNlcnZlcicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGluZGVudCk7XG5cbiAgICBpZiAoZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoYXJjaGl0ZWN0LCAndGVzdCcpKSB7XG4gICAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChcbiAgICAgICAgICByZWNvcmRlciwgYXJjaGl0ZWN0LCAndGVzdCcsIHtcbiAgICAgICAgICAgIGJ1aWxkZXI6ICdAYW5ndWxhci9iYXplbDpidWlsZCcsXG4gICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgIGJhemVsQ29tbWFuZDogJ3Rlc3QnLFxuICAgICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vc3JjOnRlc3QnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGluZGVudCk7XG4gICAgfVxuXG4gICAgY29uc3QgZTJlQXJjaGl0ZWN0ID0gZmluZEUyZUFyY2hpdGVjdCh3b3Jrc3BhY2VKc29uQXN0LCBuYW1lKTtcbiAgICBpZiAoZTJlQXJjaGl0ZWN0ICYmIGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGUyZUFyY2hpdGVjdCwgJ2UyZScpKSB7XG4gICAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChcbiAgICAgICAgICByZWNvcmRlciwgZTJlQXJjaGl0ZWN0LCAnZTJlJywge1xuICAgICAgICAgICAgYnVpbGRlcjogJ0Bhbmd1bGFyL2JhemVsOmJ1aWxkJyxcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgYmF6ZWxDb21tYW5kOiAndGVzdCcsXG4gICAgICAgICAgICAgIHRhcmdldExhYmVsOiAnLy9lMmU6ZGV2c2VydmVyX3Rlc3QnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYXRpb25zOiB7XG4gICAgICAgICAgICAgIHByb2R1Y3Rpb246IHtcbiAgICAgICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vZTJlOnByb2RzZXJ2ZXJfdGVzdCcsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICBpbmRlbnQpO1xuICAgIH1cblxuICAgIGhvc3QuY29tbWl0VXBkYXRlKHJlY29yZGVyKTtcbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBiYWNrdXAgZm9yIHRoZSBvcmlnaW5hbCBhbmd1bGFyLmpzb24gZmlsZSBpbiBjYXNlIHVzZXIgd2FudHMgdG9cbiAqIGVqZWN0IEJhemVsIGFuZCByZXZlcnQgdG8gdGhlIG9yaWdpbmFsIHdvcmtmbG93LlxuICovXG5mdW5jdGlvbiBiYWNrdXBBbmd1bGFySnNvbigpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgY29uc3Qgd29ya3NwYWNlUGF0aCA9IGdldFdvcmtzcGFjZVBhdGgoaG9zdCk7XG4gICAgaWYgKCF3b3Jrc3BhY2VQYXRoKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGhvc3QuY3JlYXRlKFxuICAgICAgICBgJHt3b3Jrc3BhY2VQYXRofS5iYWtgLCAnLy8gVGhpcyBpcyBhIGJhY2t1cCBmaWxlIG9mIHRoZSBvcmlnaW5hbCBhbmd1bGFyLmpzb24uICcgK1xuICAgICAgICAgICAgJ1RoaXMgZmlsZSBpcyBuZWVkZWQgaW4gY2FzZSB5b3Ugd2FudCB0byByZXZlcnQgdG8gdGhlIHdvcmtmbG93IHdpdGhvdXQgQmF6ZWwuXFxuXFxuJyArXG4gICAgICAgICAgICBob3N0LnJlYWQod29ya3NwYWNlUGF0aCkpO1xuICB9O1xufVxuXG4vKipcbiAqIEBhbmd1bGFyL2JhemVsIHJlcXVpcmVzIG1pbmltdW0gdmVyc2lvbiBvZiByeGpzIHRvIGJlIDYuNC4wLiBUaGlzIGZ1bmN0aW9uXG4gKiB1cGdyYWRlcyB0aGUgdmVyc2lvbiBvZiByeGpzIGluIHBhY2thZ2UuanNvbiBpZiBuZWNlc3NhcnkuXG4gKi9cbmZ1bmN0aW9uIHVwZ3JhZGVSeGpzKCkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBjb25zdCBwYWNrYWdlSnNvbiA9ICdwYWNrYWdlLmpzb24nO1xuICAgIGlmICghaG9zdC5leGlzdHMocGFja2FnZUpzb24pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBmaW5kICR7cGFja2FnZUpzb259YCk7XG4gICAgfVxuICAgIGNvbnN0IGNvbnRlbnQgPSBob3N0LnJlYWQocGFja2FnZUpzb24pO1xuICAgIGlmICghY29udGVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gcmVhZCBwYWNrYWdlLmpzb24gY29udGVudCcpO1xuICAgIH1cbiAgICBjb25zdCBqc29uQXN0ID0gcGFyc2VKc29uQXN0KGNvbnRlbnQudG9TdHJpbmcoKSk7XG4gICAgaWYgKCFpc0pzb25Bc3RPYmplY3QoanNvbkFzdCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIHBhcnNlIEpTT04gZm9yICR7cGFja2FnZUpzb259YCk7XG4gICAgfVxuICAgIGNvbnN0IGRlcHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChqc29uQXN0LCAnZGVwZW5kZW5jaWVzJyk7XG4gICAgaWYgKCFpc0pzb25Bc3RPYmplY3QoZGVwcykpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGZpbmQgZGVwZW5kZW5jaWVzIGluICR7cGFja2FnZUpzb259YCk7XG4gICAgfVxuICAgIGNvbnN0IHJ4anMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChkZXBzLCAncnhqcycpO1xuICAgIGlmICghcnhqcykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gZmluZCByeGpzIGluIGRlcGVuZGVuY2llcyBvZiAke3BhY2thZ2VKc29ufWApO1xuICAgIH1cbiAgICBjb25zdCB2YWx1ZSA9IHJ4anMudmFsdWUgYXMgc3RyaW5nOyAgLy8gdmFsdWUgY2FuIGJlIHZlcnNpb24gb3IgcmFuZ2VcbiAgICBjb25zdCBtYXRjaCA9IHZhbHVlLm1hdGNoKC8oXFxkKStcXC4oXFxkKSsuKFxcZCkrJC8pO1xuICAgIGlmIChtYXRjaCkge1xuICAgICAgY29uc3QgW18sIG1ham9yLCBtaW5vcl0gPSBtYXRjaDtcbiAgICAgIGlmIChtYWpvciA8ICc2JyB8fCAobWFqb3IgPT09ICc2JyAmJiBtaW5vciA8ICc0JykpIHtcbiAgICAgICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKHBhY2thZ2VKc29uKTtcbiAgICAgICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QocmVjb3JkZXIsIGRlcHMsICdyeGpzJywgJ342LjQuMCcpO1xuICAgICAgICBob3N0LmNvbW1pdFVwZGF0ZShyZWNvcmRlcik7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLmluZm8oXG4gICAgICAgICAgJ0NvdWxkIG5vdCBkZXRlcm1pbmUgdmVyc2lvbiBvZiByeGpzLiBcXG4nICtcbiAgICAgICAgICAnUGxlYXNlIG1ha2Ugc3VyZSB0aGF0IHZlcnNpb24gaXMgYXQgbGVhc3QgNi40LjAuJyk7XG4gICAgfVxuICAgIHJldHVybiBob3N0O1xuICB9O1xufVxuXG4vKipcbiAqIFdoZW4gdXNpbmcgSXZ5LCBuZ2NjIG11c3QgYmUgcnVuIGFzIGEgcG9zdGluc3RhbGwgc3RlcC5cbiAqIFRoaXMgZnVuY3Rpb24gYWRkcyB0aGlzIHBvc3RpbnN0YWxsIHN0ZXAuXG4gKi9cbmZ1bmN0aW9uIGFkZFBvc3RpbnN0YWxsVG9SdW5OZ2NjKCkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBjb25zdCBwYWNrYWdlSnNvbiA9ICdwYWNrYWdlLmpzb24nO1xuICAgIGlmICghaG9zdC5leGlzdHMocGFja2FnZUpzb24pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBmaW5kICR7cGFja2FnZUpzb259YCk7XG4gICAgfVxuICAgIGNvbnN0IGNvbnRlbnQgPSBob3N0LnJlYWQocGFja2FnZUpzb24pO1xuICAgIGlmICghY29udGVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gcmVhZCBwYWNrYWdlLmpzb24gY29udGVudCcpO1xuICAgIH1cbiAgICBjb25zdCBqc29uQXN0ID0gcGFyc2VKc29uQXN0KGNvbnRlbnQudG9TdHJpbmcoKSk7XG4gICAgaWYgKCFpc0pzb25Bc3RPYmplY3QoanNvbkFzdCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIHBhcnNlIEpTT04gZm9yICR7cGFja2FnZUpzb259YCk7XG4gICAgfVxuICAgIGNvbnN0IHNjcmlwdHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChqc29uQXN0LCAnc2NyaXB0cycpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKHBhY2thZ2VKc29uKTtcbiAgICAvLyBGb3IgYmF6ZWwgd2UgbmVlZCB0byBjb21waWxlIHRoZSBhbGwgZmlsZXMgaW4gcGxhY2Ugc28gd2VcbiAgICAvLyBkb24ndCB1c2UgYC0tZmlyc3Qtb25seWAgb3IgYC0tY3JlYXRlLWl2eS1lbnRyeS1wb2ludHNgXG4gICAgY29uc3QgbmdjY0NvbW1hbmQgPSAnbmdjYyAtLXByb3BlcnRpZXMgZXMyMDE1IGJyb3dzZXIgbW9kdWxlIG1haW4nO1xuICAgIGlmIChzY3JpcHRzKSB7XG4gICAgICBjb25zdCBwb3N0SW5zdGFsbCA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KHNjcmlwdHMsICdwb3N0aW5zdGFsbCcpO1xuICAgICAgaWYgKHBvc3RJbnN0YWxsICYmIHBvc3RJbnN0YWxsLnZhbHVlKSB7XG4gICAgICAgIGxldCB2YWx1ZSA9IHBvc3RJbnN0YWxsLnZhbHVlIGFzIHN0cmluZztcbiAgICAgICAgaWYgKC9cXGJuZ2NjXFxiLy50ZXN0KHZhbHVlKSkge1xuICAgICAgICAgIC8vIGBuZ2NjYCBpcyBhbHJlYWR5IGluIHRoZSBwb3N0aW5zdGFsbCBzY3JpcHRcbiAgICAgICAgICB2YWx1ZSA9XG4gICAgICAgICAgICAgIHZhbHVlLnJlcGxhY2UoL1xccyotLWZpcnN0LW9ubHlcXGIvLCAnJykucmVwbGFjZSgvXFxzKi0tY3JlYXRlLWl2eS1lbnRyeS1wb2ludHNcXGIvLCAnJyk7XG4gICAgICAgICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QocmVjb3JkZXIsIHNjcmlwdHMsICdwb3N0aW5zdGFsbCcsIHZhbHVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBjb21tYW5kID0gYCR7cG9zdEluc3RhbGwudmFsdWV9OyAke25nY2NDb21tYW5kfWA7XG4gICAgICAgICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QocmVjb3JkZXIsIHNjcmlwdHMsICdwb3N0aW5zdGFsbCcsIGNvbW1hbmQpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpbnNlcnRQcm9wZXJ0eUluQXN0T2JqZWN0SW5PcmRlcihyZWNvcmRlciwgc2NyaXB0cywgJ3Bvc3RpbnN0YWxsJywgbmdjY0NvbW1hbmQsIDQpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpbnNlcnRQcm9wZXJ0eUluQXN0T2JqZWN0SW5PcmRlcihcbiAgICAgICAgICByZWNvcmRlciwganNvbkFzdCwgJ3NjcmlwdHMnLCB7XG4gICAgICAgICAgICBwb3N0aW5zdGFsbDogbmdjY0NvbW1hbmQsXG4gICAgICAgICAgfSxcbiAgICAgICAgICAyKTtcbiAgICB9XG4gICAgaG9zdC5jb21taXRVcGRhdGUocmVjb3JkZXIpO1xuICAgIHJldHVybiBob3N0O1xuICB9O1xufVxuXG4vKipcbiAqIFNjaGVkdWxlIGEgdGFzayB0byBwZXJmb3JtIG5wbSAvIHlhcm4gaW5zdGFsbC5cbiAqL1xuZnVuY3Rpb24gaW5zdGFsbE5vZGVNb2R1bGVzKG9wdGlvbnM6IFNjaGVtYSk6IFJ1bGUge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBpZiAoIW9wdGlvbnMuc2tpcEluc3RhbGwpIHtcbiAgICAgIGNvbnRleHQuYWRkVGFzayhuZXcgTm9kZVBhY2thZ2VJbnN0YWxsVGFzaygpKTtcbiAgICB9XG4gIH07XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKG9wdGlvbnM6IFNjaGVtYSk6IFJ1bGUge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUpID0+IHtcbiAgICBvcHRpb25zLm5hbWUgPSBvcHRpb25zLm5hbWUgfHwgZ2V0V29ya3NwYWNlKGhvc3QpLmRlZmF1bHRQcm9qZWN0O1xuICAgIGlmICghb3B0aW9ucy5uYW1lKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1BsZWFzZSBzcGVjaWZ5IGEgcHJvamVjdCB1c2luZyBcIi0tbmFtZSBwcm9qZWN0LW5hbWVcIicpO1xuICAgIH1cbiAgICB2YWxpZGF0ZVByb2plY3ROYW1lKG9wdGlvbnMubmFtZSk7XG5cbiAgICByZXR1cm4gY2hhaW4oW1xuICAgICAgYWRkRmlsZXNSZXF1aXJlZEJ5QmF6ZWwob3B0aW9ucyksXG4gICAgICBhZGREZXZEZXBlbmRlbmNpZXNUb1BhY2thZ2VKc29uKG9wdGlvbnMpLFxuICAgICAgcmVtb3ZlT2Jzb2xldGVEZXBlbmRlbmNpZXNGcm9tUGFja2FnZUpzb24ob3B0aW9ucyksXG4gICAgICBhZGRQb3N0aW5zdGFsbFRvUnVuTmdjYygpLFxuICAgICAgYmFja3VwQW5ndWxhckpzb24oKSxcbiAgICAgIHVwZGF0ZUFuZ3VsYXJKc29uVG9Vc2VCYXplbEJ1aWxkZXIob3B0aW9ucyksXG4gICAgICB1cGRhdGVHaXRpZ25vcmUoKSxcbiAgICAgIHVwZ3JhZGVSeGpzKCksXG4gICAgICBpbnN0YWxsTm9kZU1vZHVsZXMob3B0aW9ucyksXG4gICAgXSk7XG4gIH07XG59XG4iXX0=
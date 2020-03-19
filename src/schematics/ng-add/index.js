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
        define("npm_angular_bazel/src/schematics/ng-add/index", ["require", "exports", "tslib", "@angular-devkit/core", "@angular-devkit/schematics", "@angular-devkit/schematics/tasks", "@schematics/angular/utility/config", "@schematics/angular/utility/dependencies", "@schematics/angular/utility/json-utils", "@schematics/angular/utility/validation", "@angular/bazel/src/schematics/utility/json-utils", "@angular/bazel/src/schematics/utility/workspace-utils"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var core_1 = require("@angular-devkit/core");
    var schematics_1 = require("@angular-devkit/schematics");
    var tasks_1 = require("@angular-devkit/schematics/tasks");
    var config_1 = require("@schematics/angular/utility/config");
    var dependencies_1 = require("@schematics/angular/utility/dependencies");
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
            var angularCore = dependencies_1.getPackageJsonDependency(host, '@angular/core');
            if (!angularCore) {
                throw new Error('@angular/core dependency not found in package.json');
            }
            // TODO: use a Record<string, string> when the tsc lib setting allows us
            var devDependencies = [
                ['@angular/bazel', angularCore.version],
                ['@bazel/bazel', '2.1.0'],
                ['@bazel/ibazel', '0.12.3'],
                ['@bazel/karma', '1.4.1'],
                ['@bazel/protractor', '1.4.1'],
                ['@bazel/rollup', '1.4.1'],
                ['@bazel/terser', '1.4.1'],
                ['@bazel/typescript', '1.4.1'],
                ['history-server', '1.3.1'],
                ['html-insert-assets', '0.5.0'],
                ['karma', '4.4.1'],
                ['karma-chrome-launcher', '3.1.0'],
                ['karma-firefox-launcher', '1.2.0'],
                ['karma-jasmine', '2.0.1'],
                ['karma-requirejs', '1.1.0'],
                ['karma-sourcemap-loader', '0.3.7'],
                ['protractor', '5.4.2'],
                ['requirejs', '2.3.6'],
                ['rollup', '1.27.5'],
                ['rollup-plugin-commonjs', '10.1.0'],
                ['rollup-plugin-node-resolve', '5.2.0'],
                ['terser', '4.4.0'],
            ];
            try {
                for (var devDependencies_1 = tslib_1.__values(devDependencies), devDependencies_1_1 = devDependencies_1.next(); !devDependencies_1_1.done; devDependencies_1_1 = devDependencies_1.next()) {
                    var _b = tslib_1.__read(devDependencies_1_1.value, 2), name_1 = _b[0], version = _b[1];
                    var dep = dependencies_1.getPackageJsonDependency(host, name_1);
                    if (dep && dep.type !== dependencies_1.NodeDependencyType.Dev) {
                        dependencies_1.removePackageJsonDependency(host, name_1);
                    }
                    dependencies_1.addPackageJsonDependency(host, {
                        name: name_1,
                        version: version,
                        type: dependencies_1.NodeDependencyType.Dev,
                        overwrite: true,
                    });
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (devDependencies_1_1 && !devDependencies_1_1.done && (_a = devDependencies_1.return)) _a.call(devDependencies_1);
                }
                finally { if (e_1) throw e_1.error; }
            }
        };
    }
    /**
     * Remove packages that are not needed under Bazel.
     * @param options
     */
    function removeObsoleteDependenciesFromPackageJson(options) {
        return function (host) {
            var e_2, _a;
            var depsToRemove = [
                '@angular-devkit/build-angular',
            ];
            try {
                for (var depsToRemove_1 = tslib_1.__values(depsToRemove), depsToRemove_1_1 = depsToRemove_1.next(); !depsToRemove_1_1.done; depsToRemove_1_1 = depsToRemove_1.next()) {
                    var packageName = depsToRemove_1_1.value;
                    dependencies_1.removePackageJsonDependency(host, packageName);
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (depsToRemove_1_1 && !depsToRemove_1_1.done && (_a = depsToRemove_1.return)) _a.call(depsToRemove_1);
                }
                finally { if (e_2) throw e_2.error; }
            }
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
        return function (host) {
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
            var rxjsNode = dependencies_1.getPackageJsonDependency(host, 'rxjs');
            if (!rxjsNode) {
                throw new Error("Failed to find rxjs dependency.");
            }
            var match = rxjsNode.version.match(/(\d)+\.(\d)+.(\d)+$/);
            if (match) {
                var _a = tslib_1.__read(match, 3), _ = _a[0], major = _a[1], minor = _a[2];
                if (major < '6' || (major === '6' && minor < '5')) {
                    dependencies_1.addPackageJsonDependency(host, tslib_1.__assign(tslib_1.__assign({}, rxjsNode), { version: '~6.5.3', overwrite: true }));
                }
            }
            else {
                context.logger.info('Could not determine version of rxjs. \n' +
                    'Please make sure that version is at least 6.5.3.');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvc2NoZW1hdGljcy9uZy1hZGQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCw2Q0FBaUU7SUFDakUseURBQTJJO0lBQzNJLDBEQUF3RTtJQUN4RSw2REFBa0Y7SUFDbEYseUVBQTZKO0lBQzdKLHFFQUFpSDtJQUNqSCxxRUFBMkU7SUFFM0UsK0VBQWtGO0lBQ2xGLHlGQUE0RDtJQU01RDs7OztPQUlHO0lBQ0gsU0FBUywrQkFBK0IsQ0FBQyxPQUFlO1FBQ3RELE9BQU8sVUFBQyxJQUFVOztZQUNoQixJQUFNLFdBQVcsR0FBRyx1Q0FBd0IsQ0FBQyxJQUFJLEVBQUUsZUFBZSxDQUFDLENBQUM7WUFDcEUsSUFBSSxDQUFDLFdBQVcsRUFBRTtnQkFDaEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxvREFBb0QsQ0FBQyxDQUFDO2FBQ3ZFO1lBRUQsd0VBQXdFO1lBQ3hFLElBQU0sZUFBZSxHQUF1QjtnQkFDMUMsQ0FBQyxnQkFBZ0IsRUFBRSxXQUFXLENBQUMsT0FBTyxDQUFDO2dCQUN2QyxDQUFDLGNBQWMsRUFBRSxPQUFPLENBQUM7Z0JBQ3pCLENBQUMsZUFBZSxFQUFFLFFBQVEsQ0FBQztnQkFDM0IsQ0FBQyxjQUFjLEVBQUUsT0FBTyxDQUFDO2dCQUN6QixDQUFDLG1CQUFtQixFQUFFLE9BQU8sQ0FBQztnQkFDOUIsQ0FBQyxlQUFlLEVBQUUsT0FBTyxDQUFDO2dCQUMxQixDQUFDLGVBQWUsRUFBRSxPQUFPLENBQUM7Z0JBQzFCLENBQUMsbUJBQW1CLEVBQUUsT0FBTyxDQUFDO2dCQUM5QixDQUFDLGdCQUFnQixFQUFFLE9BQU8sQ0FBQztnQkFDM0IsQ0FBQyxvQkFBb0IsRUFBRSxPQUFPLENBQUM7Z0JBQy9CLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FB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Q29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICpcbiAqIEBmaWxlb3ZlcnZpZXcgU2NoZW1hdGljcyBmb3IgbmctbmV3IHByb2plY3QgdGhhdCBidWlsZHMgd2l0aCBCYXplbC5cbiAqL1xuXG5pbXBvcnQge0pzb25Bc3RPYmplY3QsIHBhcnNlSnNvbkFzdH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHtSdWxlLCBTY2hlbWF0aWNDb250ZXh0LCBTY2hlbWF0aWNzRXhjZXB0aW9uLCBUcmVlLCBhcHBseSwgYXBwbHlUZW1wbGF0ZXMsIGNoYWluLCBtZXJnZVdpdGgsIHVybH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L3NjaGVtYXRpY3MnO1xuaW1wb3J0IHtOb2RlUGFja2FnZUluc3RhbGxUYXNrfSBmcm9tICdAYW5ndWxhci1kZXZraXQvc2NoZW1hdGljcy90YXNrcyc7XG5pbXBvcnQge2dldFdvcmtzcGFjZSwgZ2V0V29ya3NwYWNlUGF0aH0gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L2NvbmZpZyc7XG5pbXBvcnQge05vZGVEZXBlbmRlbmN5VHlwZSwgYWRkUGFja2FnZUpzb25EZXBlbmRlbmN5LCBnZXRQYWNrYWdlSnNvbkRlcGVuZGVuY3ksIHJlbW92ZVBhY2thZ2VKc29uRGVwZW5kZW5jeX0gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L2RlcGVuZGVuY2llcyc7XG5pbXBvcnQge2ZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0LCBpbnNlcnRQcm9wZXJ0eUluQXN0T2JqZWN0SW5PcmRlcn0gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L2pzb24tdXRpbHMnO1xuaW1wb3J0IHt2YWxpZGF0ZVByb2plY3ROYW1lfSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvdmFsaWRhdGlvbic7XG5cbmltcG9ydCB7aXNKc29uQXN0T2JqZWN0LCByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdH0gZnJvbSAnLi4vdXRpbGl0eS9qc29uLXV0aWxzJztcbmltcG9ydCB7ZmluZEUyZUFyY2hpdGVjdH0gZnJvbSAnLi4vdXRpbGl0eS93b3Jrc3BhY2UtdXRpbHMnO1xuXG5pbXBvcnQge1NjaGVtYX0gZnJvbSAnLi9zY2hlbWEnO1xuXG5cblxuLyoqXG4gKiBQYWNrYWdlcyB0aGF0IGJ1aWxkIHVuZGVyIEJhemVsIHJlcXVpcmUgYWRkaXRpb25hbCBkZXYgZGVwZW5kZW5jaWVzLiBUaGlzXG4gKiBmdW5jdGlvbiBhZGRzIHRob3NlIGRlcGVuZGVuY2llcyB0byBcImRldkRlcGVuZGVuY2llc1wiIHNlY3Rpb24gaW5cbiAqIHBhY2thZ2UuanNvbi5cbiAqL1xuZnVuY3Rpb24gYWRkRGV2RGVwZW5kZW5jaWVzVG9QYWNrYWdlSnNvbihvcHRpb25zOiBTY2hlbWEpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgY29uc3QgYW5ndWxhckNvcmUgPSBnZXRQYWNrYWdlSnNvbkRlcGVuZGVuY3koaG9zdCwgJ0Bhbmd1bGFyL2NvcmUnKTtcbiAgICBpZiAoIWFuZ3VsYXJDb3JlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Bhbmd1bGFyL2NvcmUgZGVwZW5kZW5jeSBub3QgZm91bmQgaW4gcGFja2FnZS5qc29uJyk7XG4gICAgfVxuXG4gICAgLy8gVE9ETzogdXNlIGEgUmVjb3JkPHN0cmluZywgc3RyaW5nPiB3aGVuIHRoZSB0c2MgbGliIHNldHRpbmcgYWxsb3dzIHVzXG4gICAgY29uc3QgZGV2RGVwZW5kZW5jaWVzOiBbc3RyaW5nLCBzdHJpbmddW10gPSBbXG4gICAgICBbJ0Bhbmd1bGFyL2JhemVsJywgYW5ndWxhckNvcmUudmVyc2lvbl0sXG4gICAgICBbJ0BiYXplbC9iYXplbCcsICcyLjEuMCddLFxuICAgICAgWydAYmF6ZWwvaWJhemVsJywgJzAuMTIuMyddLFxuICAgICAgWydAYmF6ZWwva2FybWEnLCAnMS40LjEnXSxcbiAgICAgIFsnQGJhemVsL3Byb3RyYWN0b3InLCAnMS40LjEnXSxcbiAgICAgIFsnQGJhemVsL3JvbGx1cCcsICcxLjQuMSddLFxuICAgICAgWydAYmF6ZWwvdGVyc2VyJywgJzEuNC4xJ10sXG4gICAgICBbJ0BiYXplbC90eXBlc2NyaXB0JywgJzEuNC4xJ10sXG4gICAgICBbJ2hpc3Rvcnktc2VydmVyJywgJzEuMy4xJ10sXG4gICAgICBbJ2h0bWwtaW5zZXJ0LWFzc2V0cycsICcwLjUuMCddLFxuICAgICAgWydrYXJtYScsICc0LjQuMSddLFxuICAgICAgWydrYXJtYS1jaHJvbWUtbGF1bmNoZXInLCAnMy4xLjAnXSxcbiAgICAgIFsna2FybWEtZmlyZWZveC1sYXVuY2hlcicsICcxLjIuMCddLFxuICAgICAgWydrYXJtYS1qYXNtaW5lJywgJzIuMC4xJ10sXG4gICAgICBbJ2thcm1hLXJlcXVpcmVqcycsICcxLjEuMCddLFxuICAgICAgWydrYXJtYS1zb3VyY2VtYXAtbG9hZGVyJywgJzAuMy43J10sXG4gICAgICBbJ3Byb3RyYWN0b3InLCAnNS40LjInXSxcbiAgICAgIFsncmVxdWlyZWpzJywgJzIuMy42J10sXG4gICAgICBbJ3JvbGx1cCcsICcxLjI3LjUnXSxcbiAgICAgIFsncm9sbHVwLXBsdWdpbi1jb21tb25qcycsICcxMC4xLjAnXSxcbiAgICAgIFsncm9sbHVwLXBsdWdpbi1ub2RlLXJlc29sdmUnLCAnNS4yLjAnXSxcbiAgICAgIFsndGVyc2VyJywgJzQuNC4wJ10sXG4gICAgXTtcblxuICAgIGZvciAoY29uc3QgW25hbWUsIHZlcnNpb25dIG9mIGRldkRlcGVuZGVuY2llcykge1xuICAgICAgY29uc3QgZGVwID0gZ2V0UGFja2FnZUpzb25EZXBlbmRlbmN5KGhvc3QsIG5hbWUpO1xuICAgICAgaWYgKGRlcCAmJiBkZXAudHlwZSAhPT0gTm9kZURlcGVuZGVuY3lUeXBlLkRldikge1xuICAgICAgICByZW1vdmVQYWNrYWdlSnNvbkRlcGVuZGVuY3koaG9zdCwgbmFtZSk7XG4gICAgICB9XG5cbiAgICAgIGFkZFBhY2thZ2VKc29uRGVwZW5kZW5jeShob3N0LCB7XG4gICAgICAgIG5hbWUsXG4gICAgICAgIHZlcnNpb24sXG4gICAgICAgIHR5cGU6IE5vZGVEZXBlbmRlbmN5VHlwZS5EZXYsXG4gICAgICAgIG92ZXJ3cml0ZTogdHJ1ZSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfTtcbn1cblxuLyoqXG4gKiBSZW1vdmUgcGFja2FnZXMgdGhhdCBhcmUgbm90IG5lZWRlZCB1bmRlciBCYXplbC5cbiAqIEBwYXJhbSBvcHRpb25zXG4gKi9cbmZ1bmN0aW9uIHJlbW92ZU9ic29sZXRlRGVwZW5kZW5jaWVzRnJvbVBhY2thZ2VKc29uKG9wdGlvbnM6IFNjaGVtYSkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUpID0+IHtcbiAgICBjb25zdCBkZXBzVG9SZW1vdmUgPSBbXG4gICAgICAnQGFuZ3VsYXItZGV2a2l0L2J1aWxkLWFuZ3VsYXInLFxuICAgIF07XG5cbiAgICBmb3IgKGNvbnN0IHBhY2thZ2VOYW1lIG9mIGRlcHNUb1JlbW92ZSkge1xuICAgICAgcmVtb3ZlUGFja2FnZUpzb25EZXBlbmRlbmN5KGhvc3QsIHBhY2thZ2VOYW1lKTtcbiAgICB9XG4gIH07XG59XG5cbi8qKlxuICogQXBwZW5kIGFkZGl0aW9uYWwgSmF2YXNjcmlwdCAvIFR5cGVzY3JpcHQgZmlsZXMgbmVlZGVkIHRvIGNvbXBpbGUgYW4gQW5ndWxhclxuICogcHJvamVjdCB1bmRlciBCYXplbC5cbiAqL1xuZnVuY3Rpb24gYWRkRmlsZXNSZXF1aXJlZEJ5QmF6ZWwob3B0aW9uczogU2NoZW1hKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIHJldHVybiBtZXJnZVdpdGgoYXBwbHkodXJsKCcuL2ZpbGVzJyksIFtcbiAgICAgIGFwcGx5VGVtcGxhdGVzKHt9KSxcbiAgICBdKSk7XG4gIH07XG59XG5cbi8qKlxuICogQXBwZW5kICcvYmF6ZWwtb3V0JyB0byB0aGUgZ2l0aWdub3JlIGZpbGUuXG4gKi9cbmZ1bmN0aW9uIHVwZGF0ZUdpdGlnbm9yZSgpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgY29uc3QgZ2l0aWdub3JlID0gJy8uZ2l0aWdub3JlJztcbiAgICBpZiAoIWhvc3QuZXhpc3RzKGdpdGlnbm9yZSkpIHtcbiAgICAgIHJldHVybiBob3N0O1xuICAgIH1cbiAgICBjb25zdCBnaXRJZ25vcmVDb250ZW50UmF3ID0gaG9zdC5yZWFkKGdpdGlnbm9yZSk7XG4gICAgaWYgKCFnaXRJZ25vcmVDb250ZW50UmF3KSB7XG4gICAgICByZXR1cm4gaG9zdDtcbiAgICB9XG4gICAgY29uc3QgZ2l0SWdub3JlQ29udGVudCA9IGdpdElnbm9yZUNvbnRlbnRSYXcudG9TdHJpbmcoKTtcbiAgICBpZiAoZ2l0SWdub3JlQ29udGVudC5pbmNsdWRlcygnXFxuL2JhemVsLW91dFxcbicpKSB7XG4gICAgICByZXR1cm4gaG9zdDtcbiAgICB9XG4gICAgY29uc3QgY29tcGlsZWRPdXRwdXQgPSAnIyBjb21waWxlZCBvdXRwdXRcXG4nO1xuICAgIGNvbnN0IGluZGV4ID0gZ2l0SWdub3JlQ29udGVudC5pbmRleE9mKGNvbXBpbGVkT3V0cHV0KTtcbiAgICBjb25zdCBpbnNlcnRpb25JbmRleCA9IGluZGV4ID49IDAgPyBpbmRleCArIGNvbXBpbGVkT3V0cHV0Lmxlbmd0aCA6IGdpdElnbm9yZUNvbnRlbnQubGVuZ3RoO1xuICAgIGNvbnN0IHJlY29yZGVyID0gaG9zdC5iZWdpblVwZGF0ZShnaXRpZ25vcmUpO1xuICAgIHJlY29yZGVyLmluc2VydFJpZ2h0KGluc2VydGlvbkluZGV4LCAnL2JhemVsLW91dFxcbicpO1xuICAgIGhvc3QuY29tbWl0VXBkYXRlKHJlY29yZGVyKTtcbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuLyoqXG4gKiBDaGFuZ2UgdGhlIGFyY2hpdGVjdCBpbiBhbmd1bGFyLmpzb24gdG8gdXNlIEJhemVsIGJ1aWxkZXIuXG4gKi9cbmZ1bmN0aW9uIHVwZGF0ZUFuZ3VsYXJKc29uVG9Vc2VCYXplbEJ1aWxkZXIob3B0aW9uczogU2NoZW1hKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIGNvbnN0IG5hbWUgPSBvcHRpb25zLm5hbWUgITtcbiAgICBjb25zdCB3b3Jrc3BhY2VQYXRoID0gZ2V0V29ya3NwYWNlUGF0aChob3N0KTtcbiAgICBpZiAoIXdvcmtzcGFjZVBhdGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IGZpbmQgYW5ndWxhci5qc29uJyk7XG4gICAgfVxuICAgIGNvbnN0IHdvcmtzcGFjZUNvbnRlbnQgPSBob3N0LnJlYWQod29ya3NwYWNlUGF0aCk7XG4gICAgaWYgKCF3b3Jrc3BhY2VDb250ZW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byByZWFkIGFuZ3VsYXIuanNvbiBjb250ZW50Jyk7XG4gICAgfVxuICAgIGNvbnN0IHdvcmtzcGFjZUpzb25Bc3QgPSBwYXJzZUpzb25Bc3Qod29ya3NwYWNlQ29udGVudC50b1N0cmluZygpKSBhcyBKc29uQXN0T2JqZWN0O1xuICAgIGNvbnN0IHByb2plY3RzID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3Qod29ya3NwYWNlSnNvbkFzdCwgJ3Byb2plY3RzJyk7XG4gICAgaWYgKCFwcm9qZWN0cykge1xuICAgICAgdGhyb3cgbmV3IFNjaGVtYXRpY3NFeGNlcHRpb24oJ0V4cGVjdCBwcm9qZWN0cyBpbiBhbmd1bGFyLmpzb24gdG8gYmUgYW4gT2JqZWN0Jyk7XG4gICAgfVxuICAgIGNvbnN0IHByb2plY3QgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChwcm9qZWN0cyBhcyBKc29uQXN0T2JqZWN0LCBuYW1lKTtcbiAgICBpZiAoIXByb2plY3QpIHtcbiAgICAgIHRocm93IG5ldyBTY2hlbWF0aWNzRXhjZXB0aW9uKGBFeHBlY3RlZCBwcm9qZWN0cyB0byBjb250YWluICR7bmFtZX1gKTtcbiAgICB9XG4gICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKHdvcmtzcGFjZVBhdGgpO1xuICAgIGNvbnN0IGluZGVudCA9IDg7XG4gICAgY29uc3QgYXJjaGl0ZWN0ID1cbiAgICAgICAgZmluZFByb3BlcnR5SW5Bc3RPYmplY3QocHJvamVjdCBhcyBKc29uQXN0T2JqZWN0LCAnYXJjaGl0ZWN0JykgYXMgSnNvbkFzdE9iamVjdDtcbiAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChcbiAgICAgICAgcmVjb3JkZXIsIGFyY2hpdGVjdCwgJ2J1aWxkJywge1xuICAgICAgICAgIGJ1aWxkZXI6ICdAYW5ndWxhci9iYXplbDpidWlsZCcsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgdGFyZ2V0TGFiZWw6ICcvL3NyYzpwcm9kYXBwJyxcbiAgICAgICAgICAgIGJhemVsQ29tbWFuZDogJ2J1aWxkJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvbmZpZ3VyYXRpb25zOiB7XG4gICAgICAgICAgICBwcm9kdWN0aW9uOiB7XG4gICAgICAgICAgICAgIHRhcmdldExhYmVsOiAnLy9zcmM6cHJvZGFwcCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGluZGVudCk7XG4gICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QoXG4gICAgICAgIHJlY29yZGVyLCBhcmNoaXRlY3QsICdzZXJ2ZScsIHtcbiAgICAgICAgICBidWlsZGVyOiAnQGFuZ3VsYXIvYmF6ZWw6YnVpbGQnLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIHRhcmdldExhYmVsOiAnLy9zcmM6ZGV2c2VydmVyJyxcbiAgICAgICAgICAgIGJhemVsQ29tbWFuZDogJ3J1bicsXG4gICAgICAgICAgICB3YXRjaDogdHJ1ZSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvbmZpZ3VyYXRpb25zOiB7XG4gICAgICAgICAgICBwcm9kdWN0aW9uOiB7XG4gICAgICAgICAgICAgIHRhcmdldExhYmVsOiAnLy9zcmM6cHJvZHNlcnZlcicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGluZGVudCk7XG5cbiAgICBpZiAoZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoYXJjaGl0ZWN0LCAndGVzdCcpKSB7XG4gICAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChcbiAgICAgICAgICByZWNvcmRlciwgYXJjaGl0ZWN0LCAndGVzdCcsIHtcbiAgICAgICAgICAgIGJ1aWxkZXI6ICdAYW5ndWxhci9iYXplbDpidWlsZCcsXG4gICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgIGJhemVsQ29tbWFuZDogJ3Rlc3QnLFxuICAgICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vc3JjOnRlc3QnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGluZGVudCk7XG4gICAgfVxuXG4gICAgY29uc3QgZTJlQXJjaGl0ZWN0ID0gZmluZEUyZUFyY2hpdGVjdCh3b3Jrc3BhY2VKc29uQXN0LCBuYW1lKTtcbiAgICBpZiAoZTJlQXJjaGl0ZWN0ICYmIGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGUyZUFyY2hpdGVjdCwgJ2UyZScpKSB7XG4gICAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChcbiAgICAgICAgICByZWNvcmRlciwgZTJlQXJjaGl0ZWN0LCAnZTJlJywge1xuICAgICAgICAgICAgYnVpbGRlcjogJ0Bhbmd1bGFyL2JhemVsOmJ1aWxkJyxcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgYmF6ZWxDb21tYW5kOiAndGVzdCcsXG4gICAgICAgICAgICAgIHRhcmdldExhYmVsOiAnLy9lMmU6ZGV2c2VydmVyX3Rlc3QnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYXRpb25zOiB7XG4gICAgICAgICAgICAgIHByb2R1Y3Rpb246IHtcbiAgICAgICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vZTJlOnByb2RzZXJ2ZXJfdGVzdCcsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICBpbmRlbnQpO1xuICAgIH1cblxuICAgIGhvc3QuY29tbWl0VXBkYXRlKHJlY29yZGVyKTtcbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBiYWNrdXAgZm9yIHRoZSBvcmlnaW5hbCBhbmd1bGFyLmpzb24gZmlsZSBpbiBjYXNlIHVzZXIgd2FudHMgdG9cbiAqIGVqZWN0IEJhemVsIGFuZCByZXZlcnQgdG8gdGhlIG9yaWdpbmFsIHdvcmtmbG93LlxuICovXG5mdW5jdGlvbiBiYWNrdXBBbmd1bGFySnNvbigpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgY29uc3Qgd29ya3NwYWNlUGF0aCA9IGdldFdvcmtzcGFjZVBhdGgoaG9zdCk7XG4gICAgaWYgKCF3b3Jrc3BhY2VQYXRoKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGhvc3QuY3JlYXRlKFxuICAgICAgICBgJHt3b3Jrc3BhY2VQYXRofS5iYWtgLCAnLy8gVGhpcyBpcyBhIGJhY2t1cCBmaWxlIG9mIHRoZSBvcmlnaW5hbCBhbmd1bGFyLmpzb24uICcgK1xuICAgICAgICAgICAgJ1RoaXMgZmlsZSBpcyBuZWVkZWQgaW4gY2FzZSB5b3Ugd2FudCB0byByZXZlcnQgdG8gdGhlIHdvcmtmbG93IHdpdGhvdXQgQmF6ZWwuXFxuXFxuJyArXG4gICAgICAgICAgICBob3N0LnJlYWQod29ya3NwYWNlUGF0aCkpO1xuICB9O1xufVxuXG4vKipcbiAqIEBhbmd1bGFyL2JhemVsIHJlcXVpcmVzIG1pbmltdW0gdmVyc2lvbiBvZiByeGpzIHRvIGJlIDYuNC4wLiBUaGlzIGZ1bmN0aW9uXG4gKiB1cGdyYWRlcyB0aGUgdmVyc2lvbiBvZiByeGpzIGluIHBhY2thZ2UuanNvbiBpZiBuZWNlc3NhcnkuXG4gKi9cbmZ1bmN0aW9uIHVwZ3JhZGVSeGpzKCkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBjb25zdCByeGpzTm9kZSA9IGdldFBhY2thZ2VKc29uRGVwZW5kZW5jeShob3N0LCAncnhqcycpO1xuICAgIGlmICghcnhqc05vZGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGZpbmQgcnhqcyBkZXBlbmRlbmN5LmApO1xuICAgIH1cblxuICAgIGNvbnN0IG1hdGNoID0gcnhqc05vZGUudmVyc2lvbi5tYXRjaCgvKFxcZCkrXFwuKFxcZCkrLihcXGQpKyQvKTtcbiAgICBpZiAobWF0Y2gpIHtcbiAgICAgIGNvbnN0IFtfLCBtYWpvciwgbWlub3JdID0gbWF0Y2g7XG4gICAgICBpZiAobWFqb3IgPCAnNicgfHwgKG1ham9yID09PSAnNicgJiYgbWlub3IgPCAnNScpKSB7XG4gICAgICAgIGFkZFBhY2thZ2VKc29uRGVwZW5kZW5jeShob3N0LCB7XG4gICAgICAgICAgLi4ucnhqc05vZGUsXG4gICAgICAgICAgdmVyc2lvbjogJ342LjUuMycsXG4gICAgICAgICAgb3ZlcndyaXRlOiB0cnVlLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29udGV4dC5sb2dnZXIuaW5mbyhcbiAgICAgICAgICAnQ291bGQgbm90IGRldGVybWluZSB2ZXJzaW9uIG9mIHJ4anMuIFxcbicgK1xuICAgICAgICAgICdQbGVhc2UgbWFrZSBzdXJlIHRoYXQgdmVyc2lvbiBpcyBhdCBsZWFzdCA2LjUuMy4nKTtcbiAgICB9XG4gICAgcmV0dXJuIGhvc3Q7XG4gIH07XG59XG5cbi8qKlxuICogV2hlbiB1c2luZyBJdnksIG5nY2MgbXVzdCBiZSBydW4gYXMgYSBwb3N0aW5zdGFsbCBzdGVwLlxuICogVGhpcyBmdW5jdGlvbiBhZGRzIHRoaXMgcG9zdGluc3RhbGwgc3RlcC5cbiAqL1xuZnVuY3Rpb24gYWRkUG9zdGluc3RhbGxUb1J1bk5nY2MoKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSwgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCkgPT4ge1xuICAgIGNvbnN0IHBhY2thZ2VKc29uID0gJ3BhY2thZ2UuanNvbic7XG4gICAgaWYgKCFob3N0LmV4aXN0cyhwYWNrYWdlSnNvbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IGZpbmQgJHtwYWNrYWdlSnNvbn1gKTtcbiAgICB9XG4gICAgY29uc3QgY29udGVudCA9IGhvc3QucmVhZChwYWNrYWdlSnNvbik7XG4gICAgaWYgKCFjb250ZW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byByZWFkIHBhY2thZ2UuanNvbiBjb250ZW50Jyk7XG4gICAgfVxuICAgIGNvbnN0IGpzb25Bc3QgPSBwYXJzZUpzb25Bc3QoY29udGVudC50b1N0cmluZygpKTtcbiAgICBpZiAoIWlzSnNvbkFzdE9iamVjdChqc29uQXN0KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gcGFyc2UgSlNPTiBmb3IgJHtwYWNrYWdlSnNvbn1gKTtcbiAgICB9XG4gICAgY29uc3Qgc2NyaXB0cyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGpzb25Bc3QsICdzY3JpcHRzJykgYXMgSnNvbkFzdE9iamVjdDtcbiAgICBjb25zdCByZWNvcmRlciA9IGhvc3QuYmVnaW5VcGRhdGUocGFja2FnZUpzb24pO1xuICAgIC8vIEZvciBiYXplbCB3ZSBuZWVkIHRvIGNvbXBpbGUgdGhlIGFsbCBmaWxlcyBpbiBwbGFjZSBzbyB3ZVxuICAgIC8vIGRvbid0IHVzZSBgLS1maXJzdC1vbmx5YCBvciBgLS1jcmVhdGUtaXZ5LWVudHJ5LXBvaW50c2BcbiAgICBjb25zdCBuZ2NjQ29tbWFuZCA9ICduZ2NjIC0tcHJvcGVydGllcyBlczIwMTUgYnJvd3NlciBtb2R1bGUgbWFpbic7XG4gICAgaWYgKHNjcmlwdHMpIHtcbiAgICAgIGNvbnN0IHBvc3RJbnN0YWxsID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3Qoc2NyaXB0cywgJ3Bvc3RpbnN0YWxsJyk7XG4gICAgICBpZiAocG9zdEluc3RhbGwgJiYgcG9zdEluc3RhbGwudmFsdWUpIHtcbiAgICAgICAgbGV0IHZhbHVlID0gcG9zdEluc3RhbGwudmFsdWUgYXMgc3RyaW5nO1xuICAgICAgICBpZiAoL1xcYm5nY2NcXGIvLnRlc3QodmFsdWUpKSB7XG4gICAgICAgICAgLy8gYG5nY2NgIGlzIGFscmVhZHkgaW4gdGhlIHBvc3RpbnN0YWxsIHNjcmlwdFxuICAgICAgICAgIHZhbHVlID1cbiAgICAgICAgICAgICAgdmFsdWUucmVwbGFjZSgvXFxzKi0tZmlyc3Qtb25seVxcYi8sICcnKS5yZXBsYWNlKC9cXHMqLS1jcmVhdGUtaXZ5LWVudHJ5LXBvaW50c1xcYi8sICcnKTtcbiAgICAgICAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChyZWNvcmRlciwgc2NyaXB0cywgJ3Bvc3RpbnN0YWxsJywgdmFsdWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IGNvbW1hbmQgPSBgJHtwb3N0SW5zdGFsbC52YWx1ZX07ICR7bmdjY0NvbW1hbmR9YDtcbiAgICAgICAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChyZWNvcmRlciwgc2NyaXB0cywgJ3Bvc3RpbnN0YWxsJywgY29tbWFuZCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGluc2VydFByb3BlcnR5SW5Bc3RPYmplY3RJbk9yZGVyKHJlY29yZGVyLCBzY3JpcHRzLCAncG9zdGluc3RhbGwnLCBuZ2NjQ29tbWFuZCwgNCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGluc2VydFByb3BlcnR5SW5Bc3RPYmplY3RJbk9yZGVyKFxuICAgICAgICAgIHJlY29yZGVyLCBqc29uQXN0LCAnc2NyaXB0cycsIHtcbiAgICAgICAgICAgIHBvc3RpbnN0YWxsOiBuZ2NjQ29tbWFuZCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIDIpO1xuICAgIH1cbiAgICBob3N0LmNvbW1pdFVwZGF0ZShyZWNvcmRlcik7XG4gICAgcmV0dXJuIGhvc3Q7XG4gIH07XG59XG5cbi8qKlxuICogU2NoZWR1bGUgYSB0YXNrIHRvIHBlcmZvcm0gbnBtIC8geWFybiBpbnN0YWxsLlxuICovXG5mdW5jdGlvbiBpbnN0YWxsTm9kZU1vZHVsZXMob3B0aW9uczogU2NoZW1hKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSwgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCkgPT4ge1xuICAgIGlmICghb3B0aW9ucy5za2lwSW5zdGFsbCkge1xuICAgICAgY29udGV4dC5hZGRUYXNrKG5ldyBOb2RlUGFja2FnZUluc3RhbGxUYXNrKCkpO1xuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24ob3B0aW9uczogU2NoZW1hKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIG9wdGlvbnMubmFtZSA9IG9wdGlvbnMubmFtZSB8fCBnZXRXb3Jrc3BhY2UoaG9zdCkuZGVmYXVsdFByb2plY3Q7XG4gICAgaWYgKCFvcHRpb25zLm5hbWUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignUGxlYXNlIHNwZWNpZnkgYSBwcm9qZWN0IHVzaW5nIFwiLS1uYW1lIHByb2plY3QtbmFtZVwiJyk7XG4gICAgfVxuICAgIHZhbGlkYXRlUHJvamVjdE5hbWUob3B0aW9ucy5uYW1lKTtcblxuICAgIHJldHVybiBjaGFpbihbXG4gICAgICBhZGRGaWxlc1JlcXVpcmVkQnlCYXplbChvcHRpb25zKSxcbiAgICAgIGFkZERldkRlcGVuZGVuY2llc1RvUGFja2FnZUpzb24ob3B0aW9ucyksXG4gICAgICByZW1vdmVPYnNvbGV0ZURlcGVuZGVuY2llc0Zyb21QYWNrYWdlSnNvbihvcHRpb25zKSxcbiAgICAgIGFkZFBvc3RpbnN0YWxsVG9SdW5OZ2NjKCksXG4gICAgICBiYWNrdXBBbmd1bGFySnNvbigpLFxuICAgICAgdXBkYXRlQW5ndWxhckpzb25Ub1VzZUJhemVsQnVpbGRlcihvcHRpb25zKSxcbiAgICAgIHVwZGF0ZUdpdGlnbm9yZSgpLFxuICAgICAgdXBncmFkZVJ4anMoKSxcbiAgICAgIGluc3RhbGxOb2RlTW9kdWxlcyhvcHRpb25zKSxcbiAgICBdKTtcbiAgfTtcbn1cbiJdfQ==
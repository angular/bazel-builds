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
                ['@bazel/bazel', '1.1.0'],
                ['@bazel/ibazel', '0.10.3'],
                ['@bazel/karma', '0.42.2'],
                ['@bazel/protractor', '0.42.2'],
                ['@bazel/rollup', '0.42.2'],
                ['@bazel/terser', '0.42.2'],
                ['@bazel/typescript', '0.42.2'],
                ['history-server', '1.3.1'],
                ['html-insert-assets', '0.2.0'],
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvc2NoZW1hdGljcy9uZy1hZGQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCw2Q0FBaUU7SUFDakUseURBQTJJO0lBQzNJLDBEQUF3RTtJQUN4RSw2REFBa0Y7SUFDbEYseUVBQTZKO0lBQzdKLHFFQUFpSDtJQUNqSCxxRUFBMkU7SUFFM0UsK0VBQWtGO0lBQ2xGLHlGQUE0RDtJQU01RDs7OztPQUlHO0lBQ0gsU0FBUywrQkFBK0IsQ0FBQyxPQUFlO1FBQ3RELE9BQU8sVUFBQyxJQUFVOztZQUNoQixJQUFNLFdBQVcsR0FBRyx1Q0FBd0IsQ0FBQyxJQUFJLEVBQUUsZUFBZSxDQUFDLENBQUM7WUFDcEUsSUFBSSxDQUFDLFdBQVcsRUFBRTtnQkFDaEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxvREFBb0QsQ0FBQyxDQUFDO2FBQ3ZFO1lBRUQsd0VBQXdFO1lBQ3hFLElBQU0sZUFBZSxHQUF1QjtnQkFDMUMsQ0FBQyxnQkFBZ0IsRUFBRSxXQUFXLENBQUMsT0FBTyxDQUFDO2dCQUN2QyxDQUFDLGNBQWMsRUFBRSxPQUFPLENBQUM7Z0JBQ3pCLENBQUMsZUFBZSxFQUFFLFFBQVEsQ0FBQztnQkFDM0IsQ0FBQyxjQUFjLEVBQUUsUUFBUSxDQUFDO2dCQUMxQixDQUFDLG1CQUFtQixFQUFFLFFBQVEsQ0FBQztnQkFDL0IsQ0FBQyxlQUFlLEVBQUUsUUFBUSxDQUFDO2dCQUMzQixDQUFDLGVBQWUsRUFBRSxRQUFRLENBQUM7Z0JBQzNCLENBQUMsbUJBQW1CLEVBQUUsUUFBUSxDQUFDO2dCQUMvQixDQUFDLGdCQUFnQixFQUFFLE9BQU8sQ0FBQztnQkFDM0IsQ0FBQyxvQkFBb0IsRUFBRSxPQUFPLENBQUM7Z0JBQy9CLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FB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Q29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICpcbiAqIEBmaWxlb3ZlcnZpZXcgU2NoZW1hdGljcyBmb3IgbmctbmV3IHByb2plY3QgdGhhdCBidWlsZHMgd2l0aCBCYXplbC5cbiAqL1xuXG5pbXBvcnQge0pzb25Bc3RPYmplY3QsIHBhcnNlSnNvbkFzdH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHtSdWxlLCBTY2hlbWF0aWNDb250ZXh0LCBTY2hlbWF0aWNzRXhjZXB0aW9uLCBUcmVlLCBhcHBseSwgYXBwbHlUZW1wbGF0ZXMsIGNoYWluLCBtZXJnZVdpdGgsIHVybH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L3NjaGVtYXRpY3MnO1xuaW1wb3J0IHtOb2RlUGFja2FnZUluc3RhbGxUYXNrfSBmcm9tICdAYW5ndWxhci1kZXZraXQvc2NoZW1hdGljcy90YXNrcyc7XG5pbXBvcnQge2dldFdvcmtzcGFjZSwgZ2V0V29ya3NwYWNlUGF0aH0gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L2NvbmZpZyc7XG5pbXBvcnQge05vZGVEZXBlbmRlbmN5VHlwZSwgYWRkUGFja2FnZUpzb25EZXBlbmRlbmN5LCBnZXRQYWNrYWdlSnNvbkRlcGVuZGVuY3ksIHJlbW92ZVBhY2thZ2VKc29uRGVwZW5kZW5jeX0gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L2RlcGVuZGVuY2llcyc7XG5pbXBvcnQge2ZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0LCBpbnNlcnRQcm9wZXJ0eUluQXN0T2JqZWN0SW5PcmRlcn0gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L2pzb24tdXRpbHMnO1xuaW1wb3J0IHt2YWxpZGF0ZVByb2plY3ROYW1lfSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvdmFsaWRhdGlvbic7XG5cbmltcG9ydCB7aXNKc29uQXN0T2JqZWN0LCByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdH0gZnJvbSAnLi4vdXRpbGl0eS9qc29uLXV0aWxzJztcbmltcG9ydCB7ZmluZEUyZUFyY2hpdGVjdH0gZnJvbSAnLi4vdXRpbGl0eS93b3Jrc3BhY2UtdXRpbHMnO1xuXG5pbXBvcnQge1NjaGVtYX0gZnJvbSAnLi9zY2hlbWEnO1xuXG5cblxuLyoqXG4gKiBQYWNrYWdlcyB0aGF0IGJ1aWxkIHVuZGVyIEJhemVsIHJlcXVpcmUgYWRkaXRpb25hbCBkZXYgZGVwZW5kZW5jaWVzLiBUaGlzXG4gKiBmdW5jdGlvbiBhZGRzIHRob3NlIGRlcGVuZGVuY2llcyB0byBcImRldkRlcGVuZGVuY2llc1wiIHNlY3Rpb24gaW5cbiAqIHBhY2thZ2UuanNvbi5cbiAqL1xuZnVuY3Rpb24gYWRkRGV2RGVwZW5kZW5jaWVzVG9QYWNrYWdlSnNvbihvcHRpb25zOiBTY2hlbWEpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgY29uc3QgYW5ndWxhckNvcmUgPSBnZXRQYWNrYWdlSnNvbkRlcGVuZGVuY3koaG9zdCwgJ0Bhbmd1bGFyL2NvcmUnKTtcbiAgICBpZiAoIWFuZ3VsYXJDb3JlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Bhbmd1bGFyL2NvcmUgZGVwZW5kZW5jeSBub3QgZm91bmQgaW4gcGFja2FnZS5qc29uJyk7XG4gICAgfVxuXG4gICAgLy8gVE9ETzogdXNlIGEgUmVjb3JkPHN0cmluZywgc3RyaW5nPiB3aGVuIHRoZSB0c2MgbGliIHNldHRpbmcgYWxsb3dzIHVzXG4gICAgY29uc3QgZGV2RGVwZW5kZW5jaWVzOiBbc3RyaW5nLCBzdHJpbmddW10gPSBbXG4gICAgICBbJ0Bhbmd1bGFyL2JhemVsJywgYW5ndWxhckNvcmUudmVyc2lvbl0sXG4gICAgICBbJ0BiYXplbC9iYXplbCcsICcxLjEuMCddLFxuICAgICAgWydAYmF6ZWwvaWJhemVsJywgJzAuMTAuMyddLFxuICAgICAgWydAYmF6ZWwva2FybWEnLCAnMC40Mi4yJ10sXG4gICAgICBbJ0BiYXplbC9wcm90cmFjdG9yJywgJzAuNDIuMiddLFxuICAgICAgWydAYmF6ZWwvcm9sbHVwJywgJzAuNDIuMiddLFxuICAgICAgWydAYmF6ZWwvdGVyc2VyJywgJzAuNDIuMiddLFxuICAgICAgWydAYmF6ZWwvdHlwZXNjcmlwdCcsICcwLjQyLjInXSxcbiAgICAgIFsnaGlzdG9yeS1zZXJ2ZXInLCAnMS4zLjEnXSxcbiAgICAgIFsnaHRtbC1pbnNlcnQtYXNzZXRzJywgJzAuMi4wJ10sXG4gICAgICBbJ2thcm1hJywgJzQuNC4xJ10sXG4gICAgICBbJ2thcm1hLWNocm9tZS1sYXVuY2hlcicsICczLjEuMCddLFxuICAgICAgWydrYXJtYS1maXJlZm94LWxhdW5jaGVyJywgJzEuMi4wJ10sXG4gICAgICBbJ2thcm1hLWphc21pbmUnLCAnMi4wLjEnXSxcbiAgICAgIFsna2FybWEtcmVxdWlyZWpzJywgJzEuMS4wJ10sXG4gICAgICBbJ2thcm1hLXNvdXJjZW1hcC1sb2FkZXInLCAnMC4zLjcnXSxcbiAgICAgIFsncHJvdHJhY3RvcicsICc1LjQuMiddLFxuICAgICAgWydyZXF1aXJlanMnLCAnMi4zLjYnXSxcbiAgICAgIFsncm9sbHVwJywgJzEuMjcuNSddLFxuICAgICAgWydyb2xsdXAtcGx1Z2luLWNvbW1vbmpzJywgJzEwLjEuMCddLFxuICAgICAgWydyb2xsdXAtcGx1Z2luLW5vZGUtcmVzb2x2ZScsICc1LjIuMCddLFxuICAgICAgWyd0ZXJzZXInLCAnNC40LjAnXSxcbiAgICBdO1xuXG4gICAgZm9yIChjb25zdCBbbmFtZSwgdmVyc2lvbl0gb2YgZGV2RGVwZW5kZW5jaWVzKSB7XG4gICAgICBjb25zdCBkZXAgPSBnZXRQYWNrYWdlSnNvbkRlcGVuZGVuY3koaG9zdCwgbmFtZSk7XG4gICAgICBpZiAoZGVwICYmIGRlcC50eXBlICE9PSBOb2RlRGVwZW5kZW5jeVR5cGUuRGV2KSB7XG4gICAgICAgIHJlbW92ZVBhY2thZ2VKc29uRGVwZW5kZW5jeShob3N0LCBuYW1lKTtcbiAgICAgIH1cblxuICAgICAgYWRkUGFja2FnZUpzb25EZXBlbmRlbmN5KGhvc3QsIHtcbiAgICAgICAgbmFtZSxcbiAgICAgICAgdmVyc2lvbixcbiAgICAgICAgdHlwZTogTm9kZURlcGVuZGVuY3lUeXBlLkRldixcbiAgICAgICAgb3ZlcndyaXRlOiB0cnVlLFxuICAgICAgfSk7XG4gICAgfVxuICB9O1xufVxuXG4vKipcbiAqIFJlbW92ZSBwYWNrYWdlcyB0aGF0IGFyZSBub3QgbmVlZGVkIHVuZGVyIEJhemVsLlxuICogQHBhcmFtIG9wdGlvbnNcbiAqL1xuZnVuY3Rpb24gcmVtb3ZlT2Jzb2xldGVEZXBlbmRlbmNpZXNGcm9tUGFja2FnZUpzb24ob3B0aW9uczogU2NoZW1hKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIGNvbnN0IGRlcHNUb1JlbW92ZSA9IFtcbiAgICAgICdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhcicsXG4gICAgXTtcblxuICAgIGZvciAoY29uc3QgcGFja2FnZU5hbWUgb2YgZGVwc1RvUmVtb3ZlKSB7XG4gICAgICByZW1vdmVQYWNrYWdlSnNvbkRlcGVuZGVuY3koaG9zdCwgcGFja2FnZU5hbWUpO1xuICAgIH1cbiAgfTtcbn1cblxuLyoqXG4gKiBBcHBlbmQgYWRkaXRpb25hbCBKYXZhc2NyaXB0IC8gVHlwZXNjcmlwdCBmaWxlcyBuZWVkZWQgdG8gY29tcGlsZSBhbiBBbmd1bGFyXG4gKiBwcm9qZWN0IHVuZGVyIEJhemVsLlxuICovXG5mdW5jdGlvbiBhZGRGaWxlc1JlcXVpcmVkQnlCYXplbChvcHRpb25zOiBTY2hlbWEpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgcmV0dXJuIG1lcmdlV2l0aChhcHBseSh1cmwoJy4vZmlsZXMnKSwgW1xuICAgICAgYXBwbHlUZW1wbGF0ZXMoe30pLFxuICAgIF0pKTtcbiAgfTtcbn1cblxuLyoqXG4gKiBBcHBlbmQgJy9iYXplbC1vdXQnIHRvIHRoZSBnaXRpZ25vcmUgZmlsZS5cbiAqL1xuZnVuY3Rpb24gdXBkYXRlR2l0aWdub3JlKCkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUpID0+IHtcbiAgICBjb25zdCBnaXRpZ25vcmUgPSAnLy5naXRpZ25vcmUnO1xuICAgIGlmICghaG9zdC5leGlzdHMoZ2l0aWdub3JlKSkge1xuICAgICAgcmV0dXJuIGhvc3Q7XG4gICAgfVxuICAgIGNvbnN0IGdpdElnbm9yZUNvbnRlbnRSYXcgPSBob3N0LnJlYWQoZ2l0aWdub3JlKTtcbiAgICBpZiAoIWdpdElnbm9yZUNvbnRlbnRSYXcpIHtcbiAgICAgIHJldHVybiBob3N0O1xuICAgIH1cbiAgICBjb25zdCBnaXRJZ25vcmVDb250ZW50ID0gZ2l0SWdub3JlQ29udGVudFJhdy50b1N0cmluZygpO1xuICAgIGlmIChnaXRJZ25vcmVDb250ZW50LmluY2x1ZGVzKCdcXG4vYmF6ZWwtb3V0XFxuJykpIHtcbiAgICAgIHJldHVybiBob3N0O1xuICAgIH1cbiAgICBjb25zdCBjb21waWxlZE91dHB1dCA9ICcjIGNvbXBpbGVkIG91dHB1dFxcbic7XG4gICAgY29uc3QgaW5kZXggPSBnaXRJZ25vcmVDb250ZW50LmluZGV4T2YoY29tcGlsZWRPdXRwdXQpO1xuICAgIGNvbnN0IGluc2VydGlvbkluZGV4ID0gaW5kZXggPj0gMCA/IGluZGV4ICsgY29tcGlsZWRPdXRwdXQubGVuZ3RoIDogZ2l0SWdub3JlQ29udGVudC5sZW5ndGg7XG4gICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKGdpdGlnbm9yZSk7XG4gICAgcmVjb3JkZXIuaW5zZXJ0UmlnaHQoaW5zZXJ0aW9uSW5kZXgsICcvYmF6ZWwtb3V0XFxuJyk7XG4gICAgaG9zdC5jb21taXRVcGRhdGUocmVjb3JkZXIpO1xuICAgIHJldHVybiBob3N0O1xuICB9O1xufVxuXG4vKipcbiAqIENoYW5nZSB0aGUgYXJjaGl0ZWN0IGluIGFuZ3VsYXIuanNvbiB0byB1c2UgQmF6ZWwgYnVpbGRlci5cbiAqL1xuZnVuY3Rpb24gdXBkYXRlQW5ndWxhckpzb25Ub1VzZUJhemVsQnVpbGRlcihvcHRpb25zOiBTY2hlbWEpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgY29uc3QgbmFtZSA9IG9wdGlvbnMubmFtZSAhO1xuICAgIGNvbnN0IHdvcmtzcGFjZVBhdGggPSBnZXRXb3Jrc3BhY2VQYXRoKGhvc3QpO1xuICAgIGlmICghd29ya3NwYWNlUGF0aCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgZmluZCBhbmd1bGFyLmpzb24nKTtcbiAgICB9XG4gICAgY29uc3Qgd29ya3NwYWNlQ29udGVudCA9IGhvc3QucmVhZCh3b3Jrc3BhY2VQYXRoKTtcbiAgICBpZiAoIXdvcmtzcGFjZUNvbnRlbnQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIHJlYWQgYW5ndWxhci5qc29uIGNvbnRlbnQnKTtcbiAgICB9XG4gICAgY29uc3Qgd29ya3NwYWNlSnNvbkFzdCA9IHBhcnNlSnNvbkFzdCh3b3Jrc3BhY2VDb250ZW50LnRvU3RyaW5nKCkpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgY29uc3QgcHJvamVjdHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdCh3b3Jrc3BhY2VKc29uQXN0LCAncHJvamVjdHMnKTtcbiAgICBpZiAoIXByb2plY3RzKSB7XG4gICAgICB0aHJvdyBuZXcgU2NoZW1hdGljc0V4Y2VwdGlvbignRXhwZWN0IHByb2plY3RzIGluIGFuZ3VsYXIuanNvbiB0byBiZSBhbiBPYmplY3QnKTtcbiAgICB9XG4gICAgY29uc3QgcHJvamVjdCA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KHByb2plY3RzIGFzIEpzb25Bc3RPYmplY3QsIG5hbWUpO1xuICAgIGlmICghcHJvamVjdCkge1xuICAgICAgdGhyb3cgbmV3IFNjaGVtYXRpY3NFeGNlcHRpb24oYEV4cGVjdGVkIHByb2plY3RzIHRvIGNvbnRhaW4gJHtuYW1lfWApO1xuICAgIH1cbiAgICBjb25zdCByZWNvcmRlciA9IGhvc3QuYmVnaW5VcGRhdGUod29ya3NwYWNlUGF0aCk7XG4gICAgY29uc3QgaW5kZW50ID0gODtcbiAgICBjb25zdCBhcmNoaXRlY3QgPVxuICAgICAgICBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChwcm9qZWN0IGFzIEpzb25Bc3RPYmplY3QsICdhcmNoaXRlY3QnKSBhcyBKc29uQXN0T2JqZWN0O1xuICAgIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0KFxuICAgICAgICByZWNvcmRlciwgYXJjaGl0ZWN0LCAnYnVpbGQnLCB7XG4gICAgICAgICAgYnVpbGRlcjogJ0Bhbmd1bGFyL2JhemVsOmJ1aWxkJyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vc3JjOnByb2RhcHAnLFxuICAgICAgICAgICAgYmF6ZWxDb21tYW5kOiAnYnVpbGQnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgY29uZmlndXJhdGlvbnM6IHtcbiAgICAgICAgICAgIHByb2R1Y3Rpb246IHtcbiAgICAgICAgICAgICAgdGFyZ2V0TGFiZWw6ICcvL3NyYzpwcm9kYXBwJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgaW5kZW50KTtcbiAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChcbiAgICAgICAgcmVjb3JkZXIsIGFyY2hpdGVjdCwgJ3NlcnZlJywge1xuICAgICAgICAgIGJ1aWxkZXI6ICdAYW5ndWxhci9iYXplbDpidWlsZCcsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgdGFyZ2V0TGFiZWw6ICcvL3NyYzpkZXZzZXJ2ZXInLFxuICAgICAgICAgICAgYmF6ZWxDb21tYW5kOiAncnVuJyxcbiAgICAgICAgICAgIHdhdGNoOiB0cnVlLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgY29uZmlndXJhdGlvbnM6IHtcbiAgICAgICAgICAgIHByb2R1Y3Rpb246IHtcbiAgICAgICAgICAgICAgdGFyZ2V0TGFiZWw6ICcvL3NyYzpwcm9kc2VydmVyJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgaW5kZW50KTtcblxuICAgIGlmIChmaW5kUHJvcGVydHlJbkFzdE9iamVjdChhcmNoaXRlY3QsICd0ZXN0JykpIHtcbiAgICAgIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0KFxuICAgICAgICAgIHJlY29yZGVyLCBhcmNoaXRlY3QsICd0ZXN0Jywge1xuICAgICAgICAgICAgYnVpbGRlcjogJ0Bhbmd1bGFyL2JhemVsOmJ1aWxkJyxcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgYmF6ZWxDb21tYW5kOiAndGVzdCcsXG4gICAgICAgICAgICAgIHRhcmdldExhYmVsOiAnLy9zcmM6dGVzdCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgaW5kZW50KTtcbiAgICB9XG5cbiAgICBjb25zdCBlMmVBcmNoaXRlY3QgPSBmaW5kRTJlQXJjaGl0ZWN0KHdvcmtzcGFjZUpzb25Bc3QsIG5hbWUpO1xuICAgIGlmIChlMmVBcmNoaXRlY3QgJiYgZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoZTJlQXJjaGl0ZWN0LCAnZTJlJykpIHtcbiAgICAgIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0KFxuICAgICAgICAgIHJlY29yZGVyLCBlMmVBcmNoaXRlY3QsICdlMmUnLCB7XG4gICAgICAgICAgICBidWlsZGVyOiAnQGFuZ3VsYXIvYmF6ZWw6YnVpbGQnLFxuICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICBiYXplbENvbW1hbmQ6ICd0ZXN0JyxcbiAgICAgICAgICAgICAgdGFyZ2V0TGFiZWw6ICcvL2UyZTpkZXZzZXJ2ZXJfdGVzdCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY29uZmlndXJhdGlvbnM6IHtcbiAgICAgICAgICAgICAgcHJvZHVjdGlvbjoge1xuICAgICAgICAgICAgICAgIHRhcmdldExhYmVsOiAnLy9lMmU6cHJvZHNlcnZlcl90ZXN0JyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LFxuICAgICAgICAgIGluZGVudCk7XG4gICAgfVxuXG4gICAgaG9zdC5jb21taXRVcGRhdGUocmVjb3JkZXIpO1xuICAgIHJldHVybiBob3N0O1xuICB9O1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIGJhY2t1cCBmb3IgdGhlIG9yaWdpbmFsIGFuZ3VsYXIuanNvbiBmaWxlIGluIGNhc2UgdXNlciB3YW50cyB0b1xuICogZWplY3QgQmF6ZWwgYW5kIHJldmVydCB0byB0aGUgb3JpZ2luYWwgd29ya2Zsb3cuXG4gKi9cbmZ1bmN0aW9uIGJhY2t1cEFuZ3VsYXJKc29uKCk6IFJ1bGUge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBjb25zdCB3b3Jrc3BhY2VQYXRoID0gZ2V0V29ya3NwYWNlUGF0aChob3N0KTtcbiAgICBpZiAoIXdvcmtzcGFjZVBhdGgpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaG9zdC5jcmVhdGUoXG4gICAgICAgIGAke3dvcmtzcGFjZVBhdGh9LmJha2AsICcvLyBUaGlzIGlzIGEgYmFja3VwIGZpbGUgb2YgdGhlIG9yaWdpbmFsIGFuZ3VsYXIuanNvbi4gJyArXG4gICAgICAgICAgICAnVGhpcyBmaWxlIGlzIG5lZWRlZCBpbiBjYXNlIHlvdSB3YW50IHRvIHJldmVydCB0byB0aGUgd29ya2Zsb3cgd2l0aG91dCBCYXplbC5cXG5cXG4nICtcbiAgICAgICAgICAgIGhvc3QucmVhZCh3b3Jrc3BhY2VQYXRoKSk7XG4gIH07XG59XG5cbi8qKlxuICogQGFuZ3VsYXIvYmF6ZWwgcmVxdWlyZXMgbWluaW11bSB2ZXJzaW9uIG9mIHJ4anMgdG8gYmUgNi40LjAuIFRoaXMgZnVuY3Rpb25cbiAqIHVwZ3JhZGVzIHRoZSB2ZXJzaW9uIG9mIHJ4anMgaW4gcGFja2FnZS5qc29uIGlmIG5lY2Vzc2FyeS5cbiAqL1xuZnVuY3Rpb24gdXBncmFkZVJ4anMoKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSwgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCkgPT4ge1xuICAgIGNvbnN0IHJ4anNOb2RlID0gZ2V0UGFja2FnZUpzb25EZXBlbmRlbmN5KGhvc3QsICdyeGpzJyk7XG4gICAgaWYgKCFyeGpzTm9kZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gZmluZCByeGpzIGRlcGVuZGVuY3kuYCk7XG4gICAgfVxuXG4gICAgY29uc3QgbWF0Y2ggPSByeGpzTm9kZS52ZXJzaW9uLm1hdGNoKC8oXFxkKStcXC4oXFxkKSsuKFxcZCkrJC8pO1xuICAgIGlmIChtYXRjaCkge1xuICAgICAgY29uc3QgW18sIG1ham9yLCBtaW5vcl0gPSBtYXRjaDtcbiAgICAgIGlmIChtYWpvciA8ICc2JyB8fCAobWFqb3IgPT09ICc2JyAmJiBtaW5vciA8ICc1JykpIHtcbiAgICAgICAgYWRkUGFja2FnZUpzb25EZXBlbmRlbmN5KGhvc3QsIHtcbiAgICAgICAgICAuLi5yeGpzTm9kZSxcbiAgICAgICAgICB2ZXJzaW9uOiAnfjYuNS4zJyxcbiAgICAgICAgICBvdmVyd3JpdGU6IHRydWUsXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb250ZXh0LmxvZ2dlci5pbmZvKFxuICAgICAgICAgICdDb3VsZCBub3QgZGV0ZXJtaW5lIHZlcnNpb24gb2Ygcnhqcy4gXFxuJyArXG4gICAgICAgICAgJ1BsZWFzZSBtYWtlIHN1cmUgdGhhdCB2ZXJzaW9uIGlzIGF0IGxlYXN0IDYuNS4zLicpO1xuICAgIH1cbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuLyoqXG4gKiBXaGVuIHVzaW5nIEl2eSwgbmdjYyBtdXN0IGJlIHJ1biBhcyBhIHBvc3RpbnN0YWxsIHN0ZXAuXG4gKiBUaGlzIGZ1bmN0aW9uIGFkZHMgdGhpcyBwb3N0aW5zdGFsbCBzdGVwLlxuICovXG5mdW5jdGlvbiBhZGRQb3N0aW5zdGFsbFRvUnVuTmdjYygpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgY29uc3QgcGFja2FnZUpzb24gPSAncGFja2FnZS5qc29uJztcbiAgICBpZiAoIWhvc3QuZXhpc3RzKHBhY2thZ2VKc29uKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgZmluZCAke3BhY2thZ2VKc29ufWApO1xuICAgIH1cbiAgICBjb25zdCBjb250ZW50ID0gaG9zdC5yZWFkKHBhY2thZ2VKc29uKTtcbiAgICBpZiAoIWNvbnRlbnQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIHJlYWQgcGFja2FnZS5qc29uIGNvbnRlbnQnKTtcbiAgICB9XG4gICAgY29uc3QganNvbkFzdCA9IHBhcnNlSnNvbkFzdChjb250ZW50LnRvU3RyaW5nKCkpO1xuICAgIGlmICghaXNKc29uQXN0T2JqZWN0KGpzb25Bc3QpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBwYXJzZSBKU09OIGZvciAke3BhY2thZ2VKc29ufWApO1xuICAgIH1cbiAgICBjb25zdCBzY3JpcHRzID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoanNvbkFzdCwgJ3NjcmlwdHMnKSBhcyBKc29uQXN0T2JqZWN0O1xuICAgIGNvbnN0IHJlY29yZGVyID0gaG9zdC5iZWdpblVwZGF0ZShwYWNrYWdlSnNvbik7XG4gICAgLy8gRm9yIGJhemVsIHdlIG5lZWQgdG8gY29tcGlsZSB0aGUgYWxsIGZpbGVzIGluIHBsYWNlIHNvIHdlXG4gICAgLy8gZG9uJ3QgdXNlIGAtLWZpcnN0LW9ubHlgIG9yIGAtLWNyZWF0ZS1pdnktZW50cnktcG9pbnRzYFxuICAgIGNvbnN0IG5nY2NDb21tYW5kID0gJ25nY2MgLS1wcm9wZXJ0aWVzIGVzMjAxNSBicm93c2VyIG1vZHVsZSBtYWluJztcbiAgICBpZiAoc2NyaXB0cykge1xuICAgICAgY29uc3QgcG9zdEluc3RhbGwgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChzY3JpcHRzLCAncG9zdGluc3RhbGwnKTtcbiAgICAgIGlmIChwb3N0SW5zdGFsbCAmJiBwb3N0SW5zdGFsbC52YWx1ZSkge1xuICAgICAgICBsZXQgdmFsdWUgPSBwb3N0SW5zdGFsbC52YWx1ZSBhcyBzdHJpbmc7XG4gICAgICAgIGlmICgvXFxibmdjY1xcYi8udGVzdCh2YWx1ZSkpIHtcbiAgICAgICAgICAvLyBgbmdjY2AgaXMgYWxyZWFkeSBpbiB0aGUgcG9zdGluc3RhbGwgc2NyaXB0XG4gICAgICAgICAgdmFsdWUgPVxuICAgICAgICAgICAgICB2YWx1ZS5yZXBsYWNlKC9cXHMqLS1maXJzdC1vbmx5XFxiLywgJycpLnJlcGxhY2UoL1xccyotLWNyZWF0ZS1pdnktZW50cnktcG9pbnRzXFxiLywgJycpO1xuICAgICAgICAgIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0KHJlY29yZGVyLCBzY3JpcHRzLCAncG9zdGluc3RhbGwnLCB2YWx1ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgY29tbWFuZCA9IGAke3Bvc3RJbnN0YWxsLnZhbHVlfTsgJHtuZ2NjQ29tbWFuZH1gO1xuICAgICAgICAgIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0KHJlY29yZGVyLCBzY3JpcHRzLCAncG9zdGluc3RhbGwnLCBjb21tYW5kKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaW5zZXJ0UHJvcGVydHlJbkFzdE9iamVjdEluT3JkZXIocmVjb3JkZXIsIHNjcmlwdHMsICdwb3N0aW5zdGFsbCcsIG5nY2NDb21tYW5kLCA0KTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgaW5zZXJ0UHJvcGVydHlJbkFzdE9iamVjdEluT3JkZXIoXG4gICAgICAgICAgcmVjb3JkZXIsIGpzb25Bc3QsICdzY3JpcHRzJywge1xuICAgICAgICAgICAgcG9zdGluc3RhbGw6IG5nY2NDb21tYW5kLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgMik7XG4gICAgfVxuICAgIGhvc3QuY29tbWl0VXBkYXRlKHJlY29yZGVyKTtcbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuLyoqXG4gKiBTY2hlZHVsZSBhIHRhc2sgdG8gcGVyZm9ybSBucG0gLyB5YXJuIGluc3RhbGwuXG4gKi9cbmZ1bmN0aW9uIGluc3RhbGxOb2RlTW9kdWxlcyhvcHRpb25zOiBTY2hlbWEpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgaWYgKCFvcHRpb25zLnNraXBJbnN0YWxsKSB7XG4gICAgICBjb250ZXh0LmFkZFRhc2sobmV3IE5vZGVQYWNrYWdlSW5zdGFsbFRhc2soKSk7XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbihvcHRpb25zOiBTY2hlbWEpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgb3B0aW9ucy5uYW1lID0gb3B0aW9ucy5uYW1lIHx8IGdldFdvcmtzcGFjZShob3N0KS5kZWZhdWx0UHJvamVjdDtcbiAgICBpZiAoIW9wdGlvbnMubmFtZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdQbGVhc2Ugc3BlY2lmeSBhIHByb2plY3QgdXNpbmcgXCItLW5hbWUgcHJvamVjdC1uYW1lXCInKTtcbiAgICB9XG4gICAgdmFsaWRhdGVQcm9qZWN0TmFtZShvcHRpb25zLm5hbWUpO1xuXG4gICAgcmV0dXJuIGNoYWluKFtcbiAgICAgIGFkZEZpbGVzUmVxdWlyZWRCeUJhemVsKG9wdGlvbnMpLFxuICAgICAgYWRkRGV2RGVwZW5kZW5jaWVzVG9QYWNrYWdlSnNvbihvcHRpb25zKSxcbiAgICAgIHJlbW92ZU9ic29sZXRlRGVwZW5kZW5jaWVzRnJvbVBhY2thZ2VKc29uKG9wdGlvbnMpLFxuICAgICAgYWRkUG9zdGluc3RhbGxUb1J1bk5nY2MoKSxcbiAgICAgIGJhY2t1cEFuZ3VsYXJKc29uKCksXG4gICAgICB1cGRhdGVBbmd1bGFySnNvblRvVXNlQmF6ZWxCdWlsZGVyKG9wdGlvbnMpLFxuICAgICAgdXBkYXRlR2l0aWdub3JlKCksXG4gICAgICB1cGdyYWRlUnhqcygpLFxuICAgICAgaW5zdGFsbE5vZGVNb2R1bGVzKG9wdGlvbnMpLFxuICAgIF0pO1xuICB9O1xufVxuIl19
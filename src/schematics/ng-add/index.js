/**
 * @license
 * Copyright Google LLC All Rights Reserved.
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
                ['@bazel/karma', '1.6.0'],
                ['@bazel/protractor', '1.6.0'],
                ['@bazel/rollup', '1.6.0'],
                ['@bazel/terser', '1.6.0'],
                ['@bazel/typescript', '1.6.0'],
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvc2NoZW1hdGljcy9uZy1hZGQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCw2Q0FBaUU7SUFDakUseURBQTJJO0lBQzNJLDBEQUF3RTtJQUN4RSw2REFBa0Y7SUFDbEYseUVBQTZKO0lBQzdKLHFFQUFpSDtJQUNqSCxxRUFBMkU7SUFFM0UsK0VBQWtGO0lBQ2xGLHlGQUE0RDtJQU01RDs7OztPQUlHO0lBQ0gsU0FBUywrQkFBK0IsQ0FBQyxPQUFlO1FBQ3RELE9BQU8sVUFBQyxJQUFVOztZQUNoQixJQUFNLFdBQVcsR0FBRyx1Q0FBd0IsQ0FBQyxJQUFJLEVBQUUsZUFBZSxDQUFDLENBQUM7WUFDcEUsSUFBSSxDQUFDLFdBQVcsRUFBRTtnQkFDaEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxvREFBb0QsQ0FBQyxDQUFDO2FBQ3ZFO1lBRUQsd0VBQXdFO1lBQ3hFLElBQU0sZUFBZSxHQUF1QjtnQkFDMUMsQ0FBQyxnQkFBZ0IsRUFBRSxXQUFXLENBQUMsT0FBTyxDQUFDO2dCQUN2QyxDQUFDLGNBQWMsRUFBRSxPQUFPLENBQUM7Z0JBQ3pCLENBQUMsZUFBZSxFQUFFLFFBQVEsQ0FBQztnQkFDM0IsQ0FBQyxjQUFjLEVBQUUsT0FBTyxDQUFDO2dCQUN6QixDQUFDLG1CQUFtQixFQUFFLE9BQU8sQ0FBQztnQkFDOUIsQ0FBQyxlQUFlLEVBQUUsT0FBTyxDQUFDO2dCQUMxQixDQUFDLGVBQWUsRUFBRSxPQUFPLENBQUM7Z0JBQzFCLENBQUMsbUJBQW1CLEVBQUUsT0FBTyxDQUFDO2dCQUM5QixDQUFDLGdCQUFnQixFQUFFLE9BQU8sQ0FBQztnQkFDM0IsQ0FBQyxvQkFBb0IsRUFBRSxPQUFPLENBQUM7Z0JBQy9CLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQztnQkFDbEIsQ0FBQyx1QkFBdUIsRUFBRSxPQUFPLENBQUM7Z0JBQ2xDLENBQUMsd0JBQXdCLEVBQUUsT0FBTyxDQUFDO2dCQUNuQyxDQUFDLGVBQWUsRUFBRSxPQUFPLENBQUM7Z0JBQzFCLENBQUMsaUJBQWlCLEVBQUUsT0FBTyxDQUFDO2dCQUM1QixDQUFDLHdCQUF3QixFQUFFLE9BQU8sQ0FBQztnQkFDbkMsQ0FBQyxZQUFZLEVBQUUsT0FBTyxDQUFDO2dCQUN2QixDQUFDLFdBQVcsRUFBRSxPQUFPLENBQUM7Z0JBQ3RCLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQztnQkFDcEIsQ0FBQyx3QkFBd0IsRUFBRSxRQUFRLENBQUM7Z0JBQ3BDLENBQUMsNEJBQTRCLEVBQUUsT0FBTyxDQUFDO2dCQUN2QyxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUM7YUFDcEIsQ0FBQzs7Z0JBRUYsS0FBOEIsSUFBQSxvQkFBQSxpQkFBQSxlQUFlLENBQUEsZ0RBQUEsNkVBQUU7b0JBQXBDLElBQUEsS0FBQSw0Q0FBZSxFQUFkLE1BQUksUUFBQSxFQUFFLE9BQU8sUUFBQTtvQkFDdkIsSUFBTSxHQUFHLEdBQUcsdUNBQXdCLENBQUMsSUFBSSxFQUFFLE1BQUksQ0FBQyxDQUFDO29CQUNqRCxJQUFJLEdBQUcsSUFBSSxHQUFHLENBQUMsSUFBSSxLQUFLLGlDQUFrQixDQUFDLEdBQUcsRUFBRTt3QkFDOUMsMENBQTJCLENBQUMsSUFBSSxFQUFFLE1BQUksQ0FBQyxDQUFDO3FCQUN6QztvQkFFRCx1Q0FBd0IsQ0FBQyxJQUFJLEVBQUU7d0JBQzdCLElBQUksUUFBQTt3QkFDSixPQUFPLFNBQUE7d0JBQ1AsSUFBSSxFQUFFLGlDQUFrQixDQUFDLEdBQUc7d0JBQzVCLFNBQVMsRUFBRSxJQUFJO3FCQUNoQixDQUFDLENBQUM7aUJBQ0o7Ozs7Ozs7OztRQUNILENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRDs7O09BR0c7SUFDSCxTQUFTLHlDQUF5QyxDQUFDLE9BQWU7UUFDaEUsT0FBTyxVQUFDLElBQVU7O1lBQ2hCLElBQU0sWUFBWSxHQUFHO2dCQUNuQiwrQkFBK0I7YUFDaEMsQ0FBQzs7Z0JBRUYsS0FBMEIsSUFBQSxpQkFBQSxpQkFBQSxZQUFZLENBQUEsMENBQUEsb0VBQUU7b0JBQW5DLElBQU0sV0FBVyx5QkFBQTtvQkFDcEIsMENBQTJCLENBQUMsSUFBSSxFQUFFLFdBQVcsQ0FBQyxDQUFDO2lCQUNoRDs7Ozs7Ozs7O1FBQ0gsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVEOzs7T0FHRztJQUNILFNBQVMsdUJBQXVCLENBQUMsT0FBZTtRQUM5QyxPQUFPLFVBQUMsSUFBVTtZQUNoQixPQUFPLHNCQUFTLENBQUMsa0JBQUssQ0FBQyxnQkFBRyxDQUFDLFNBQVMsQ0FBQyxFQUFFO2dCQUNyQywyQkFBYyxDQUFDLEVBQUUsQ0FBQzthQUNuQixDQUFDLENBQUMsQ0FBQztRQUNOLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNILFNBQVMsZUFBZTtRQUN0QixPQUFPLFVBQUMsSUFBVTtZQUNoQixJQUFNLFNBQVMsR0FBRyxhQUFhLENBQUM7WUFDaEMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEVBQUU7Z0JBQzNCLE9BQU8sSUFBSSxDQUFDO2FBQ2I7WUFDRCxJQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDakQsSUFBSSxDQUFDLG1CQUFtQixFQUFFO2dCQUN4QixPQUFPLElBQUksQ0FBQzthQUNiO1lBQ0QsSUFBTSxnQkFBZ0IsR0FBRyxtQkFBbUIsQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUN4RCxJQUFJLGdCQUFnQixDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFO2dCQUMvQyxPQUFPLElBQUksQ0FBQzthQUNiO1lBQ0QsSUFBTSxjQUFjLEdBQUcscUJBQXFCLENBQUM7WUFDN0MsSUFBTSxLQUFLLEdBQUcsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1lBQ3ZELElBQU0sY0FBYyxHQUFHLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxjQUFjLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUM7WUFDNUYsSUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUM3QyxRQUFRLENBQUMsV0FBVyxDQUFDLGNBQWMsRUFBRSxjQUFjLENBQUMsQ0FBQztZQUNyRCxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQzVCLE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0gsU0FBUyxrQ0FBa0MsQ0FBQyxPQUFlO1FBQ3pELE9BQU8sVUFBQyxJQUFVO1lBQ2hCLElBQU0sSUFBSSxHQUFHLE9BQU8sQ0FBQyxJQUFLLENBQUM7WUFDM0IsSUFBTSxhQUFhLEdBQUcseUJBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDN0MsSUFBSSxDQUFDLGFBQWEsRUFBRTtnQkFDbEIsTUFBTSxJQUFJLEtBQUssQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDO2FBQ2hEO1lBQ0QsSUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1lBQ2xELElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtnQkFDckIsTUFBTSxJQUFJLEtBQUssQ0FBQyxxQ0FBcUMsQ0FBQyxDQUFDO2FBQ3hEO1lBQ0QsSUFBTSxnQkFBZ0IsR0FBRyxtQkFBWSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxDQUFrQixDQUFDO1lBQ3BGLElBQU0sUUFBUSxHQUFHLG9DQUF1QixDQUFDLGdCQUFnQixFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBQ3ZFLElBQUksQ0FBQyxRQUFRLEVBQUU7Z0JBQ2IsTUFBTSxJQUFJLGdDQUFtQixDQUFDLGlEQUFpRCxDQUFDLENBQUM7YUFDbEY7WUFDRCxJQUFNLE9BQU8sR0FBRyxvQ0FBdUIsQ0FBQyxRQUF5QixFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3pFLElBQUksQ0FBQyxPQUFPLEVBQUU7Z0JBQ1osTUFBTSxJQUFJLGdDQUFtQixDQUFDLGtDQUFnQyxJQUFNLENBQUMsQ0FBQzthQUN2RTtZQUNELElBQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDakQsSUFBTSxNQUFNLEdBQUcsQ0FBQyxDQUFDO1lBQ2pCLElBQU0sU0FBUyxHQUNYLG9DQUF1QixDQUFDLE9BQXdCLEVBQUUsV0FBVyxDQUFrQixDQUFDO1lBQ3BGLHVDQUEwQixDQUN0QixRQUFRLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRTtnQkFDNUIsT0FBTyxFQUFFLHNCQUFzQjtnQkFDL0IsT0FBTyxFQUFFO29CQUNQLFdBQVcsRUFBRSxlQUFlO29CQUM1QixZQUFZLEVBQUUsT0FBTztpQkFDdEI7Z0JBQ0QsY0FBYyxFQUFFO29CQUNkLFVBQVUsRUFBRTt3QkFDVixXQUFXLEVBQUUsZUFBZTtxQkFDN0I7aUJBQ0Y7YUFDRixFQUNELE1BQU0sQ0FBQyxDQUFDO1lBQ1osdUNBQTBCLENBQ3RCLFFBQVEsRUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFO2dCQUM1QixPQUFPLEVBQUUsc0JBQXNCO2dCQUMvQixPQUFPLEVBQUU7b0JBQ1AsV0FBVyxFQUFFLGlCQUFpQjtvQkFDOUIsWUFBWSxFQUFFLEtBQUs7b0JBQ25CLEtBQUssRUFBRSxJQUFJO2lCQUNaO2dCQUNELGNBQWMsRUFBRTtvQkFDZCxVQUFVLEVBQUU7d0JBQ1YsV0FBVyxFQUFFLGtCQUFrQjtxQkFDaEM7aUJBQ0Y7YUFDRixFQUNELE1BQU0sQ0FBQyxDQUFDO1lBRVosSUFBSSxvQ0FBdUIsQ0FBQyxTQUFTLEVBQUUsTUFBTSxDQUFDLEVBQUU7Z0JBQzlDLHVDQUEwQixDQUN0QixRQUFRLEVBQUUsU0FBUyxFQUFFLE1BQU0sRUFBRTtvQkFDM0IsT0FBTyxFQUFFLHNCQUFzQjtvQkFDL0IsT0FBTyxFQUFFO3dCQUNQLFlBQVksRUFBRSxNQUFNO3dCQUNwQixXQUFXLEVBQUUsWUFBWTtxQkFDMUI7aUJBQ0YsRUFDRCxNQUFNLENBQUMsQ0FBQzthQUNiO1lBRUQsSUFBTSxZQUFZLEdBQUcsa0NBQWdCLENBQUMsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDOUQsSUFBSSxZQUFZLElBQUksb0NBQXVCLENBQUMsWUFBWSxFQUFFLEtBQUssQ0FBQyxFQUFFO2dCQUNoRSx1Q0FBMEIsQ0FDdEIsUUFBUSxFQUFFLFlBQVksRUFBRSxLQUFLLEVBQUU7b0JBQzdCLE9BQU8sRUFBRSxzQkFBc0I7b0JBQy9CLE9BQU8sRUFBRTt3QkFDUCxZQUFZLEVBQUUsTUFBTTt3QkFDcEIsV0FBVyxFQUFFLHNCQUFzQjtxQkFDcEM7b0JBQ0QsY0FBYyxFQUFFO3dCQUNkLFVBQVUsRUFBRTs0QkFDVixXQUFXLEVBQUUsdUJBQXVCO3lCQUNyQztxQkFDRjtpQkFDRixFQUNELE1BQU0sQ0FBQyxDQUFDO2FBQ2I7WUFFRCxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQzVCLE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVEOzs7T0FHRztJQUNILFNBQVMsaUJBQWlCO1FBQ3hCLE9BQU8sVUFBQyxJQUFVLEVBQUUsT0FBeUI7WUFDM0MsSUFBTSxhQUFhLEdBQUcseUJBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDN0MsSUFBSSxDQUFDLGFBQWEsRUFBRTtnQkFDbEIsT0FBTzthQUNSO1lBQ0QsSUFBSSxDQUFDLE1BQU0sQ0FDSixhQUFhLFNBQU0sRUFDdEIseURBQXlEO2dCQUNyRCxtRkFBbUY7Z0JBQ25GLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztRQUNwQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsU0FBUyxXQUFXO1FBQ2xCLE9BQU8sVUFBQyxJQUFVLEVBQUUsT0FBeUI7WUFDM0MsSUFBTSxRQUFRLEdBQUcsdUNBQXdCLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQ3hELElBQUksQ0FBQyxRQUFRLEVBQUU7Z0JBQ2IsTUFBTSxJQUFJLEtBQUssQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO2FBQ3BEO1lBRUQsSUFBTSxLQUFLLEdBQUcsUUFBUSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMscUJBQXFCLENBQUMsQ0FBQztZQUM1RCxJQUFJLEtBQUssRUFBRTtnQkFDSCxJQUFBLEtBQUEsZUFBb0IsS0FBSyxJQUFBLEVBQXhCLENBQUMsUUFBQSxFQUFFLEtBQUssUUFBQSxFQUFFLEtBQUssUUFBUyxDQUFDO2dCQUNoQyxJQUFJLEtBQUssR0FBRyxHQUFHLElBQUksQ0FBQyxLQUFLLEtBQUssR0FBRyxJQUFJLEtBQUssR0FBRyxHQUFHLENBQUMsRUFBRTtvQkFDakQsdUNBQXdCLENBQUMsSUFBSSx3Q0FDeEIsUUFBUSxLQUNYLE9BQU8sRUFBRSxRQUFRLEVBQ2pCLFNBQVMsRUFBRSxJQUFJLElBQ2YsQ0FBQztpQkFDSjthQUNGO2lCQUFNO2dCQUNMLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUNmLHlDQUF5QztvQkFDekMsa0RBQWtELENBQUMsQ0FBQzthQUN6RDtZQUNELE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVEOzs7T0FHRztJQUNILFNBQVMsdUJBQXVCO1FBQzlCLE9BQU8sVUFBQyxJQUFVLEVBQUUsT0FBeUI7WUFDM0MsSUFBTSxXQUFXLEdBQUcsY0FBYyxDQUFDO1lBQ25DLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxFQUFFO2dCQUM3QixNQUFNLElBQUksS0FBSyxDQUFDLG9CQUFrQixXQUFhLENBQUMsQ0FBQzthQUNsRDtZQUNELElBQU0sT0FBTyxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDdkMsSUFBSSxDQUFDLE9BQU8sRUFBRTtnQkFDWixNQUFNLElBQUksS0FBSyxDQUFDLHFDQUFxQyxDQUFDLENBQUM7YUFDeEQ7WUFDRCxJQUFNLE9BQU8sR0FBRyxtQkFBWSxDQUFDLE9BQU8sQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1lBQ2pELElBQUksQ0FBQyw0QkFBZSxDQUFDLE9BQU8sQ0FBQyxFQUFFO2dCQUM3QixNQUFNLElBQUksS0FBSyxDQUFDLDhCQUE0QixXQUFhLENBQUMsQ0FBQzthQUM1RDtZQUNELElBQU0sT0FBTyxHQUFHLG9DQUF1QixDQUFDLE9BQU8sRUFBRSxTQUFTLENBQWtCLENBQUM7WUFDN0UsSUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUMvQyw0REFBNEQ7WUFDNUQsMERBQTBEO1lBQzFELElBQU0sV0FBVyxHQUFHLDhDQUE4QyxDQUFDO1lBQ25FLElBQUksT0FBTyxFQUFFO2dCQUNYLElBQU0sV0FBVyxHQUFHLG9DQUF1QixDQUFDLE9BQU8sRUFBRSxhQUFhLENBQUMsQ0FBQztnQkFDcEUsSUFBSSxXQUFXLElBQUksV0FBVyxDQUFDLEtBQUssRUFBRTtvQkFDcEMsSUFBSSxLQUFLLEdBQUcsV0FBVyxDQUFDLEtBQWUsQ0FBQztvQkFDeEMsSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxFQUFFO3dCQUMxQiw4Q0FBOEM7d0JBQzlDLEtBQUs7NEJBQ0QsS0FBSyxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsRUFBRSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsZ0NBQWdDLEVBQUUsRUFBRSxDQUFDLENBQUM7d0JBQ3pGLHVDQUEwQixDQUFDLFFBQVEsRUFBRSxPQUFPLEVBQUUsYUFBYSxFQUFFLEtBQUssQ0FBQyxDQUFDO3FCQUNyRTt5QkFBTTt3QkFDTCxJQUFNLE9BQU8sR0FBTSxXQUFXLENBQUMsS0FBSyxVQUFLLFdBQWEsQ0FBQzt3QkFDdkQsdUNBQTBCLENBQUMsUUFBUSxFQUFFLE9BQU8sRUFBRSxhQUFhLEVBQUUsT0FBTyxDQUFDLENBQUM7cUJBQ3ZFO2lCQUNGO3FCQUFNO29CQUNMLDZDQUFnQyxDQUFDLFFBQVEsRUFBRSxPQUFPLEVBQUUsYUFBYSxFQUFFLFdBQVcsRUFBRSxDQUFDLENBQUMsQ0FBQztpQkFDcEY7YUFDRjtpQkFBTTtnQkFDTCw2Q0FBZ0MsQ0FDNUIsUUFBUSxFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQUU7b0JBQzVCLFdBQVcsRUFBRSxXQUFXO2lCQUN6QixFQUNELENBQUMsQ0FBQyxDQUFDO2FBQ1I7WUFDRCxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQzVCLE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVEOztPQUVHO0lBQ0gsU0FBUyxrQkFBa0IsQ0FBQyxPQUFlO1FBQ3pDLE9BQU8sVUFBQyxJQUFVLEVBQUUsT0FBeUI7WUFDM0MsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUU7Z0JBQ3hCLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSw4QkFBc0IsRUFBRSxDQUFDLENBQUM7YUFDL0M7UUFDSCxDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQsbUJBQXdCLE9BQWU7UUFDckMsT0FBTyxVQUFDLElBQVU7WUFDaEIsT0FBTyxDQUFDLElBQUksR0FBRyxPQUFPLENBQUMsSUFBSSxJQUFJLHFCQUFZLENBQUMsSUFBSSxDQUFDLENBQUMsY0FBYyxDQUFDO1lBQ2pFLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFO2dCQUNqQixNQUFNLElBQUksS0FBSyxDQUFDLHNEQUFzRCxDQUFDLENBQUM7YUFDekU7WUFDRCxnQ0FBbUIsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFbEMsT0FBTyxrQkFBSyxDQUFDO2dCQUNYLHVCQUF1QixDQUFDLE9BQU8sQ0FBQztnQkFDaEMsK0JBQStCLENBQUMsT0FBTyxDQUFDO2dCQUN4Qyx5Q0FBeUMsQ0FBQyxPQUFPLENBQUM7Z0JBQ2xELHVCQUF1QixFQUFFO2dCQUN6QixpQkFBaUIsRUFBRTtnQkFDbkIsa0NBQWtDLENBQUMsT0FBTyxDQUFDO2dCQUMzQyxlQUFlLEVBQUU7Z0JBQ2pCLFdBQVcsRUFBRTtnQkFDYixrQkFBa0IsQ0FBQyxPQUFPLENBQUM7YUFDNUIsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQXBCRCw0QkFvQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIExMQyBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKlxuICogQGZpbGVvdmVydmlldyBTY2hlbWF0aWNzIGZvciBuZy1uZXcgcHJvamVjdCB0aGF0IGJ1aWxkcyB3aXRoIEJhemVsLlxuICovXG5cbmltcG9ydCB7SnNvbkFzdE9iamVjdCwgcGFyc2VKc29uQXN0fSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQge2FwcGx5LCBhcHBseVRlbXBsYXRlcywgY2hhaW4sIG1lcmdlV2l0aCwgUnVsZSwgU2NoZW1hdGljQ29udGV4dCwgU2NoZW1hdGljc0V4Y2VwdGlvbiwgVHJlZSwgdXJsfSBmcm9tICdAYW5ndWxhci1kZXZraXQvc2NoZW1hdGljcyc7XG5pbXBvcnQge05vZGVQYWNrYWdlSW5zdGFsbFRhc2t9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9zY2hlbWF0aWNzL3Rhc2tzJztcbmltcG9ydCB7Z2V0V29ya3NwYWNlLCBnZXRXb3Jrc3BhY2VQYXRofSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvY29uZmlnJztcbmltcG9ydCB7YWRkUGFja2FnZUpzb25EZXBlbmRlbmN5LCBnZXRQYWNrYWdlSnNvbkRlcGVuZGVuY3ksIE5vZGVEZXBlbmRlbmN5VHlwZSwgcmVtb3ZlUGFja2FnZUpzb25EZXBlbmRlbmN5fSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvZGVwZW5kZW5jaWVzJztcbmltcG9ydCB7ZmluZFByb3BlcnR5SW5Bc3RPYmplY3QsIGluc2VydFByb3BlcnR5SW5Bc3RPYmplY3RJbk9yZGVyfSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvanNvbi11dGlscyc7XG5pbXBvcnQge3ZhbGlkYXRlUHJvamVjdE5hbWV9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS92YWxpZGF0aW9uJztcblxuaW1wb3J0IHtpc0pzb25Bc3RPYmplY3QsIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0fSBmcm9tICcuLi91dGlsaXR5L2pzb24tdXRpbHMnO1xuaW1wb3J0IHtmaW5kRTJlQXJjaGl0ZWN0fSBmcm9tICcuLi91dGlsaXR5L3dvcmtzcGFjZS11dGlscyc7XG5cbmltcG9ydCB7U2NoZW1hfSBmcm9tICcuL3NjaGVtYSc7XG5cblxuXG4vKipcbiAqIFBhY2thZ2VzIHRoYXQgYnVpbGQgdW5kZXIgQmF6ZWwgcmVxdWlyZSBhZGRpdGlvbmFsIGRldiBkZXBlbmRlbmNpZXMuIFRoaXNcbiAqIGZ1bmN0aW9uIGFkZHMgdGhvc2UgZGVwZW5kZW5jaWVzIHRvIFwiZGV2RGVwZW5kZW5jaWVzXCIgc2VjdGlvbiBpblxuICogcGFja2FnZS5qc29uLlxuICovXG5mdW5jdGlvbiBhZGREZXZEZXBlbmRlbmNpZXNUb1BhY2thZ2VKc29uKG9wdGlvbnM6IFNjaGVtYSkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUpID0+IHtcbiAgICBjb25zdCBhbmd1bGFyQ29yZSA9IGdldFBhY2thZ2VKc29uRGVwZW5kZW5jeShob3N0LCAnQGFuZ3VsYXIvY29yZScpO1xuICAgIGlmICghYW5ndWxhckNvcmUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQGFuZ3VsYXIvY29yZSBkZXBlbmRlbmN5IG5vdCBmb3VuZCBpbiBwYWNrYWdlLmpzb24nKTtcbiAgICB9XG5cbiAgICAvLyBUT0RPOiB1c2UgYSBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHdoZW4gdGhlIHRzYyBsaWIgc2V0dGluZyBhbGxvd3MgdXNcbiAgICBjb25zdCBkZXZEZXBlbmRlbmNpZXM6IFtzdHJpbmcsIHN0cmluZ11bXSA9IFtcbiAgICAgIFsnQGFuZ3VsYXIvYmF6ZWwnLCBhbmd1bGFyQ29yZS52ZXJzaW9uXSxcbiAgICAgIFsnQGJhemVsL2JhemVsJywgJzIuMS4wJ10sXG4gICAgICBbJ0BiYXplbC9pYmF6ZWwnLCAnMC4xMi4zJ10sXG4gICAgICBbJ0BiYXplbC9rYXJtYScsICcxLjYuMCddLFxuICAgICAgWydAYmF6ZWwvcHJvdHJhY3RvcicsICcxLjYuMCddLFxuICAgICAgWydAYmF6ZWwvcm9sbHVwJywgJzEuNi4wJ10sXG4gICAgICBbJ0BiYXplbC90ZXJzZXInLCAnMS42LjAnXSxcbiAgICAgIFsnQGJhemVsL3R5cGVzY3JpcHQnLCAnMS42LjAnXSxcbiAgICAgIFsnaGlzdG9yeS1zZXJ2ZXInLCAnMS4zLjEnXSxcbiAgICAgIFsnaHRtbC1pbnNlcnQtYXNzZXRzJywgJzAuNS4wJ10sXG4gICAgICBbJ2thcm1hJywgJzQuNC4xJ10sXG4gICAgICBbJ2thcm1hLWNocm9tZS1sYXVuY2hlcicsICczLjEuMCddLFxuICAgICAgWydrYXJtYS1maXJlZm94LWxhdW5jaGVyJywgJzEuMi4wJ10sXG4gICAgICBbJ2thcm1hLWphc21pbmUnLCAnMi4wLjEnXSxcbiAgICAgIFsna2FybWEtcmVxdWlyZWpzJywgJzEuMS4wJ10sXG4gICAgICBbJ2thcm1hLXNvdXJjZW1hcC1sb2FkZXInLCAnMC4zLjcnXSxcbiAgICAgIFsncHJvdHJhY3RvcicsICc1LjQuMiddLFxuICAgICAgWydyZXF1aXJlanMnLCAnMi4zLjYnXSxcbiAgICAgIFsncm9sbHVwJywgJzEuMjcuNSddLFxuICAgICAgWydyb2xsdXAtcGx1Z2luLWNvbW1vbmpzJywgJzEwLjEuMCddLFxuICAgICAgWydyb2xsdXAtcGx1Z2luLW5vZGUtcmVzb2x2ZScsICc1LjIuMCddLFxuICAgICAgWyd0ZXJzZXInLCAnNC40LjAnXSxcbiAgICBdO1xuXG4gICAgZm9yIChjb25zdCBbbmFtZSwgdmVyc2lvbl0gb2YgZGV2RGVwZW5kZW5jaWVzKSB7XG4gICAgICBjb25zdCBkZXAgPSBnZXRQYWNrYWdlSnNvbkRlcGVuZGVuY3koaG9zdCwgbmFtZSk7XG4gICAgICBpZiAoZGVwICYmIGRlcC50eXBlICE9PSBOb2RlRGVwZW5kZW5jeVR5cGUuRGV2KSB7XG4gICAgICAgIHJlbW92ZVBhY2thZ2VKc29uRGVwZW5kZW5jeShob3N0LCBuYW1lKTtcbiAgICAgIH1cblxuICAgICAgYWRkUGFja2FnZUpzb25EZXBlbmRlbmN5KGhvc3QsIHtcbiAgICAgICAgbmFtZSxcbiAgICAgICAgdmVyc2lvbixcbiAgICAgICAgdHlwZTogTm9kZURlcGVuZGVuY3lUeXBlLkRldixcbiAgICAgICAgb3ZlcndyaXRlOiB0cnVlLFxuICAgICAgfSk7XG4gICAgfVxuICB9O1xufVxuXG4vKipcbiAqIFJlbW92ZSBwYWNrYWdlcyB0aGF0IGFyZSBub3QgbmVlZGVkIHVuZGVyIEJhemVsLlxuICogQHBhcmFtIG9wdGlvbnNcbiAqL1xuZnVuY3Rpb24gcmVtb3ZlT2Jzb2xldGVEZXBlbmRlbmNpZXNGcm9tUGFja2FnZUpzb24ob3B0aW9uczogU2NoZW1hKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIGNvbnN0IGRlcHNUb1JlbW92ZSA9IFtcbiAgICAgICdAYW5ndWxhci1kZXZraXQvYnVpbGQtYW5ndWxhcicsXG4gICAgXTtcblxuICAgIGZvciAoY29uc3QgcGFja2FnZU5hbWUgb2YgZGVwc1RvUmVtb3ZlKSB7XG4gICAgICByZW1vdmVQYWNrYWdlSnNvbkRlcGVuZGVuY3koaG9zdCwgcGFja2FnZU5hbWUpO1xuICAgIH1cbiAgfTtcbn1cblxuLyoqXG4gKiBBcHBlbmQgYWRkaXRpb25hbCBKYXZhc2NyaXB0IC8gVHlwZXNjcmlwdCBmaWxlcyBuZWVkZWQgdG8gY29tcGlsZSBhbiBBbmd1bGFyXG4gKiBwcm9qZWN0IHVuZGVyIEJhemVsLlxuICovXG5mdW5jdGlvbiBhZGRGaWxlc1JlcXVpcmVkQnlCYXplbChvcHRpb25zOiBTY2hlbWEpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgcmV0dXJuIG1lcmdlV2l0aChhcHBseSh1cmwoJy4vZmlsZXMnKSwgW1xuICAgICAgYXBwbHlUZW1wbGF0ZXMoe30pLFxuICAgIF0pKTtcbiAgfTtcbn1cblxuLyoqXG4gKiBBcHBlbmQgJy9iYXplbC1vdXQnIHRvIHRoZSBnaXRpZ25vcmUgZmlsZS5cbiAqL1xuZnVuY3Rpb24gdXBkYXRlR2l0aWdub3JlKCkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUpID0+IHtcbiAgICBjb25zdCBnaXRpZ25vcmUgPSAnLy5naXRpZ25vcmUnO1xuICAgIGlmICghaG9zdC5leGlzdHMoZ2l0aWdub3JlKSkge1xuICAgICAgcmV0dXJuIGhvc3Q7XG4gICAgfVxuICAgIGNvbnN0IGdpdElnbm9yZUNvbnRlbnRSYXcgPSBob3N0LnJlYWQoZ2l0aWdub3JlKTtcbiAgICBpZiAoIWdpdElnbm9yZUNvbnRlbnRSYXcpIHtcbiAgICAgIHJldHVybiBob3N0O1xuICAgIH1cbiAgICBjb25zdCBnaXRJZ25vcmVDb250ZW50ID0gZ2l0SWdub3JlQ29udGVudFJhdy50b1N0cmluZygpO1xuICAgIGlmIChnaXRJZ25vcmVDb250ZW50LmluY2x1ZGVzKCdcXG4vYmF6ZWwtb3V0XFxuJykpIHtcbiAgICAgIHJldHVybiBob3N0O1xuICAgIH1cbiAgICBjb25zdCBjb21waWxlZE91dHB1dCA9ICcjIGNvbXBpbGVkIG91dHB1dFxcbic7XG4gICAgY29uc3QgaW5kZXggPSBnaXRJZ25vcmVDb250ZW50LmluZGV4T2YoY29tcGlsZWRPdXRwdXQpO1xuICAgIGNvbnN0IGluc2VydGlvbkluZGV4ID0gaW5kZXggPj0gMCA/IGluZGV4ICsgY29tcGlsZWRPdXRwdXQubGVuZ3RoIDogZ2l0SWdub3JlQ29udGVudC5sZW5ndGg7XG4gICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKGdpdGlnbm9yZSk7XG4gICAgcmVjb3JkZXIuaW5zZXJ0UmlnaHQoaW5zZXJ0aW9uSW5kZXgsICcvYmF6ZWwtb3V0XFxuJyk7XG4gICAgaG9zdC5jb21taXRVcGRhdGUocmVjb3JkZXIpO1xuICAgIHJldHVybiBob3N0O1xuICB9O1xufVxuXG4vKipcbiAqIENoYW5nZSB0aGUgYXJjaGl0ZWN0IGluIGFuZ3VsYXIuanNvbiB0byB1c2UgQmF6ZWwgYnVpbGRlci5cbiAqL1xuZnVuY3Rpb24gdXBkYXRlQW5ndWxhckpzb25Ub1VzZUJhemVsQnVpbGRlcihvcHRpb25zOiBTY2hlbWEpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgY29uc3QgbmFtZSA9IG9wdGlvbnMubmFtZSE7XG4gICAgY29uc3Qgd29ya3NwYWNlUGF0aCA9IGdldFdvcmtzcGFjZVBhdGgoaG9zdCk7XG4gICAgaWYgKCF3b3Jrc3BhY2VQYXRoKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIGFuZ3VsYXIuanNvbicpO1xuICAgIH1cbiAgICBjb25zdCB3b3Jrc3BhY2VDb250ZW50ID0gaG9zdC5yZWFkKHdvcmtzcGFjZVBhdGgpO1xuICAgIGlmICghd29ya3NwYWNlQ29udGVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gcmVhZCBhbmd1bGFyLmpzb24gY29udGVudCcpO1xuICAgIH1cbiAgICBjb25zdCB3b3Jrc3BhY2VKc29uQXN0ID0gcGFyc2VKc29uQXN0KHdvcmtzcGFjZUNvbnRlbnQudG9TdHJpbmcoKSkgYXMgSnNvbkFzdE9iamVjdDtcbiAgICBjb25zdCBwcm9qZWN0cyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KHdvcmtzcGFjZUpzb25Bc3QsICdwcm9qZWN0cycpO1xuICAgIGlmICghcHJvamVjdHMpIHtcbiAgICAgIHRocm93IG5ldyBTY2hlbWF0aWNzRXhjZXB0aW9uKCdFeHBlY3QgcHJvamVjdHMgaW4gYW5ndWxhci5qc29uIHRvIGJlIGFuIE9iamVjdCcpO1xuICAgIH1cbiAgICBjb25zdCBwcm9qZWN0ID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QocHJvamVjdHMgYXMgSnNvbkFzdE9iamVjdCwgbmFtZSk7XG4gICAgaWYgKCFwcm9qZWN0KSB7XG4gICAgICB0aHJvdyBuZXcgU2NoZW1hdGljc0V4Y2VwdGlvbihgRXhwZWN0ZWQgcHJvamVjdHMgdG8gY29udGFpbiAke25hbWV9YCk7XG4gICAgfVxuICAgIGNvbnN0IHJlY29yZGVyID0gaG9zdC5iZWdpblVwZGF0ZSh3b3Jrc3BhY2VQYXRoKTtcbiAgICBjb25zdCBpbmRlbnQgPSA4O1xuICAgIGNvbnN0IGFyY2hpdGVjdCA9XG4gICAgICAgIGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KHByb2plY3QgYXMgSnNvbkFzdE9iamVjdCwgJ2FyY2hpdGVjdCcpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QoXG4gICAgICAgIHJlY29yZGVyLCBhcmNoaXRlY3QsICdidWlsZCcsIHtcbiAgICAgICAgICBidWlsZGVyOiAnQGFuZ3VsYXIvYmF6ZWw6YnVpbGQnLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIHRhcmdldExhYmVsOiAnLy9zcmM6cHJvZGFwcCcsXG4gICAgICAgICAgICBiYXplbENvbW1hbmQ6ICdidWlsZCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBjb25maWd1cmF0aW9uczoge1xuICAgICAgICAgICAgcHJvZHVjdGlvbjoge1xuICAgICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vc3JjOnByb2RhcHAnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBpbmRlbnQpO1xuICAgIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0KFxuICAgICAgICByZWNvcmRlciwgYXJjaGl0ZWN0LCAnc2VydmUnLCB7XG4gICAgICAgICAgYnVpbGRlcjogJ0Bhbmd1bGFyL2JhemVsOmJ1aWxkJyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vc3JjOmRldnNlcnZlcicsXG4gICAgICAgICAgICBiYXplbENvbW1hbmQ6ICdydW4nLFxuICAgICAgICAgICAgd2F0Y2g6IHRydWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBjb25maWd1cmF0aW9uczoge1xuICAgICAgICAgICAgcHJvZHVjdGlvbjoge1xuICAgICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vc3JjOnByb2RzZXJ2ZXInLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBpbmRlbnQpO1xuXG4gICAgaWYgKGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGFyY2hpdGVjdCwgJ3Rlc3QnKSkge1xuICAgICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QoXG4gICAgICAgICAgcmVjb3JkZXIsIGFyY2hpdGVjdCwgJ3Rlc3QnLCB7XG4gICAgICAgICAgICBidWlsZGVyOiAnQGFuZ3VsYXIvYmF6ZWw6YnVpbGQnLFxuICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICBiYXplbENvbW1hbmQ6ICd0ZXN0JyxcbiAgICAgICAgICAgICAgdGFyZ2V0TGFiZWw6ICcvL3NyYzp0ZXN0JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBpbmRlbnQpO1xuICAgIH1cblxuICAgIGNvbnN0IGUyZUFyY2hpdGVjdCA9IGZpbmRFMmVBcmNoaXRlY3Qod29ya3NwYWNlSnNvbkFzdCwgbmFtZSk7XG4gICAgaWYgKGUyZUFyY2hpdGVjdCAmJiBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChlMmVBcmNoaXRlY3QsICdlMmUnKSkge1xuICAgICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QoXG4gICAgICAgICAgcmVjb3JkZXIsIGUyZUFyY2hpdGVjdCwgJ2UyZScsIHtcbiAgICAgICAgICAgIGJ1aWxkZXI6ICdAYW5ndWxhci9iYXplbDpidWlsZCcsXG4gICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgIGJhemVsQ29tbWFuZDogJ3Rlc3QnLFxuICAgICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vZTJlOmRldnNlcnZlcl90ZXN0JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjb25maWd1cmF0aW9uczoge1xuICAgICAgICAgICAgICBwcm9kdWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0TGFiZWw6ICcvL2UyZTpwcm9kc2VydmVyX3Rlc3QnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgICAgICAgaW5kZW50KTtcbiAgICB9XG5cbiAgICBob3N0LmNvbW1pdFVwZGF0ZShyZWNvcmRlcik7XG4gICAgcmV0dXJuIGhvc3Q7XG4gIH07XG59XG5cbi8qKlxuICogQ3JlYXRlIGEgYmFja3VwIGZvciB0aGUgb3JpZ2luYWwgYW5ndWxhci5qc29uIGZpbGUgaW4gY2FzZSB1c2VyIHdhbnRzIHRvXG4gKiBlamVjdCBCYXplbCBhbmQgcmV2ZXJ0IHRvIHRoZSBvcmlnaW5hbCB3b3JrZmxvdy5cbiAqL1xuZnVuY3Rpb24gYmFja3VwQW5ndWxhckpzb24oKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSwgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCkgPT4ge1xuICAgIGNvbnN0IHdvcmtzcGFjZVBhdGggPSBnZXRXb3Jrc3BhY2VQYXRoKGhvc3QpO1xuICAgIGlmICghd29ya3NwYWNlUGF0aCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBob3N0LmNyZWF0ZShcbiAgICAgICAgYCR7d29ya3NwYWNlUGF0aH0uYmFrYCxcbiAgICAgICAgJy8vIFRoaXMgaXMgYSBiYWNrdXAgZmlsZSBvZiB0aGUgb3JpZ2luYWwgYW5ndWxhci5qc29uLiAnICtcbiAgICAgICAgICAgICdUaGlzIGZpbGUgaXMgbmVlZGVkIGluIGNhc2UgeW91IHdhbnQgdG8gcmV2ZXJ0IHRvIHRoZSB3b3JrZmxvdyB3aXRob3V0IEJhemVsLlxcblxcbicgK1xuICAgICAgICAgICAgaG9zdC5yZWFkKHdvcmtzcGFjZVBhdGgpKTtcbiAgfTtcbn1cblxuLyoqXG4gKiBAYW5ndWxhci9iYXplbCByZXF1aXJlcyBtaW5pbXVtIHZlcnNpb24gb2YgcnhqcyB0byBiZSA2LjQuMC4gVGhpcyBmdW5jdGlvblxuICogdXBncmFkZXMgdGhlIHZlcnNpb24gb2YgcnhqcyBpbiBwYWNrYWdlLmpzb24gaWYgbmVjZXNzYXJ5LlxuICovXG5mdW5jdGlvbiB1cGdyYWRlUnhqcygpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgY29uc3Qgcnhqc05vZGUgPSBnZXRQYWNrYWdlSnNvbkRlcGVuZGVuY3koaG9zdCwgJ3J4anMnKTtcbiAgICBpZiAoIXJ4anNOb2RlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBmaW5kIHJ4anMgZGVwZW5kZW5jeS5gKTtcbiAgICB9XG5cbiAgICBjb25zdCBtYXRjaCA9IHJ4anNOb2RlLnZlcnNpb24ubWF0Y2goLyhcXGQpK1xcLihcXGQpKy4oXFxkKSskLyk7XG4gICAgaWYgKG1hdGNoKSB7XG4gICAgICBjb25zdCBbXywgbWFqb3IsIG1pbm9yXSA9IG1hdGNoO1xuICAgICAgaWYgKG1ham9yIDwgJzYnIHx8IChtYWpvciA9PT0gJzYnICYmIG1pbm9yIDwgJzUnKSkge1xuICAgICAgICBhZGRQYWNrYWdlSnNvbkRlcGVuZGVuY3koaG9zdCwge1xuICAgICAgICAgIC4uLnJ4anNOb2RlLFxuICAgICAgICAgIHZlcnNpb246ICd+Ni41LjMnLFxuICAgICAgICAgIG92ZXJ3cml0ZTogdHJ1ZSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLmluZm8oXG4gICAgICAgICAgJ0NvdWxkIG5vdCBkZXRlcm1pbmUgdmVyc2lvbiBvZiByeGpzLiBcXG4nICtcbiAgICAgICAgICAnUGxlYXNlIG1ha2Ugc3VyZSB0aGF0IHZlcnNpb24gaXMgYXQgbGVhc3QgNi41LjMuJyk7XG4gICAgfVxuICAgIHJldHVybiBob3N0O1xuICB9O1xufVxuXG4vKipcbiAqIFdoZW4gdXNpbmcgSXZ5LCBuZ2NjIG11c3QgYmUgcnVuIGFzIGEgcG9zdGluc3RhbGwgc3RlcC5cbiAqIFRoaXMgZnVuY3Rpb24gYWRkcyB0aGlzIHBvc3RpbnN0YWxsIHN0ZXAuXG4gKi9cbmZ1bmN0aW9uIGFkZFBvc3RpbnN0YWxsVG9SdW5OZ2NjKCkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBjb25zdCBwYWNrYWdlSnNvbiA9ICdwYWNrYWdlLmpzb24nO1xuICAgIGlmICghaG9zdC5leGlzdHMocGFja2FnZUpzb24pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBmaW5kICR7cGFja2FnZUpzb259YCk7XG4gICAgfVxuICAgIGNvbnN0IGNvbnRlbnQgPSBob3N0LnJlYWQocGFja2FnZUpzb24pO1xuICAgIGlmICghY29udGVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gcmVhZCBwYWNrYWdlLmpzb24gY29udGVudCcpO1xuICAgIH1cbiAgICBjb25zdCBqc29uQXN0ID0gcGFyc2VKc29uQXN0KGNvbnRlbnQudG9TdHJpbmcoKSk7XG4gICAgaWYgKCFpc0pzb25Bc3RPYmplY3QoanNvbkFzdCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIHBhcnNlIEpTT04gZm9yICR7cGFja2FnZUpzb259YCk7XG4gICAgfVxuICAgIGNvbnN0IHNjcmlwdHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChqc29uQXN0LCAnc2NyaXB0cycpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKHBhY2thZ2VKc29uKTtcbiAgICAvLyBGb3IgYmF6ZWwgd2UgbmVlZCB0byBjb21waWxlIHRoZSBhbGwgZmlsZXMgaW4gcGxhY2Ugc28gd2VcbiAgICAvLyBkb24ndCB1c2UgYC0tZmlyc3Qtb25seWAgb3IgYC0tY3JlYXRlLWl2eS1lbnRyeS1wb2ludHNgXG4gICAgY29uc3QgbmdjY0NvbW1hbmQgPSAnbmdjYyAtLXByb3BlcnRpZXMgZXMyMDE1IGJyb3dzZXIgbW9kdWxlIG1haW4nO1xuICAgIGlmIChzY3JpcHRzKSB7XG4gICAgICBjb25zdCBwb3N0SW5zdGFsbCA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KHNjcmlwdHMsICdwb3N0aW5zdGFsbCcpO1xuICAgICAgaWYgKHBvc3RJbnN0YWxsICYmIHBvc3RJbnN0YWxsLnZhbHVlKSB7XG4gICAgICAgIGxldCB2YWx1ZSA9IHBvc3RJbnN0YWxsLnZhbHVlIGFzIHN0cmluZztcbiAgICAgICAgaWYgKC9cXGJuZ2NjXFxiLy50ZXN0KHZhbHVlKSkge1xuICAgICAgICAgIC8vIGBuZ2NjYCBpcyBhbHJlYWR5IGluIHRoZSBwb3N0aW5zdGFsbCBzY3JpcHRcbiAgICAgICAgICB2YWx1ZSA9XG4gICAgICAgICAgICAgIHZhbHVlLnJlcGxhY2UoL1xccyotLWZpcnN0LW9ubHlcXGIvLCAnJykucmVwbGFjZSgvXFxzKi0tY3JlYXRlLWl2eS1lbnRyeS1wb2ludHNcXGIvLCAnJyk7XG4gICAgICAgICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QocmVjb3JkZXIsIHNjcmlwdHMsICdwb3N0aW5zdGFsbCcsIHZhbHVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBjb21tYW5kID0gYCR7cG9zdEluc3RhbGwudmFsdWV9OyAke25nY2NDb21tYW5kfWA7XG4gICAgICAgICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QocmVjb3JkZXIsIHNjcmlwdHMsICdwb3N0aW5zdGFsbCcsIGNvbW1hbmQpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpbnNlcnRQcm9wZXJ0eUluQXN0T2JqZWN0SW5PcmRlcihyZWNvcmRlciwgc2NyaXB0cywgJ3Bvc3RpbnN0YWxsJywgbmdjY0NvbW1hbmQsIDQpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpbnNlcnRQcm9wZXJ0eUluQXN0T2JqZWN0SW5PcmRlcihcbiAgICAgICAgICByZWNvcmRlciwganNvbkFzdCwgJ3NjcmlwdHMnLCB7XG4gICAgICAgICAgICBwb3N0aW5zdGFsbDogbmdjY0NvbW1hbmQsXG4gICAgICAgICAgfSxcbiAgICAgICAgICAyKTtcbiAgICB9XG4gICAgaG9zdC5jb21taXRVcGRhdGUocmVjb3JkZXIpO1xuICAgIHJldHVybiBob3N0O1xuICB9O1xufVxuXG4vKipcbiAqIFNjaGVkdWxlIGEgdGFzayB0byBwZXJmb3JtIG5wbSAvIHlhcm4gaW5zdGFsbC5cbiAqL1xuZnVuY3Rpb24gaW5zdGFsbE5vZGVNb2R1bGVzKG9wdGlvbnM6IFNjaGVtYSk6IFJ1bGUge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBpZiAoIW9wdGlvbnMuc2tpcEluc3RhbGwpIHtcbiAgICAgIGNvbnRleHQuYWRkVGFzayhuZXcgTm9kZVBhY2thZ2VJbnN0YWxsVGFzaygpKTtcbiAgICB9XG4gIH07XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKG9wdGlvbnM6IFNjaGVtYSk6IFJ1bGUge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUpID0+IHtcbiAgICBvcHRpb25zLm5hbWUgPSBvcHRpb25zLm5hbWUgfHwgZ2V0V29ya3NwYWNlKGhvc3QpLmRlZmF1bHRQcm9qZWN0O1xuICAgIGlmICghb3B0aW9ucy5uYW1lKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1BsZWFzZSBzcGVjaWZ5IGEgcHJvamVjdCB1c2luZyBcIi0tbmFtZSBwcm9qZWN0LW5hbWVcIicpO1xuICAgIH1cbiAgICB2YWxpZGF0ZVByb2plY3ROYW1lKG9wdGlvbnMubmFtZSk7XG5cbiAgICByZXR1cm4gY2hhaW4oW1xuICAgICAgYWRkRmlsZXNSZXF1aXJlZEJ5QmF6ZWwob3B0aW9ucyksXG4gICAgICBhZGREZXZEZXBlbmRlbmNpZXNUb1BhY2thZ2VKc29uKG9wdGlvbnMpLFxuICAgICAgcmVtb3ZlT2Jzb2xldGVEZXBlbmRlbmNpZXNGcm9tUGFja2FnZUpzb24ob3B0aW9ucyksXG4gICAgICBhZGRQb3N0aW5zdGFsbFRvUnVuTmdjYygpLFxuICAgICAgYmFja3VwQW5ndWxhckpzb24oKSxcbiAgICAgIHVwZGF0ZUFuZ3VsYXJKc29uVG9Vc2VCYXplbEJ1aWxkZXIob3B0aW9ucyksXG4gICAgICB1cGRhdGVHaXRpZ25vcmUoKSxcbiAgICAgIHVwZ3JhZGVSeGpzKCksXG4gICAgICBpbnN0YWxsTm9kZU1vZHVsZXMob3B0aW9ucyksXG4gICAgXSk7XG4gIH07XG59XG4iXX0=
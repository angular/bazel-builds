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
                ['@bazel/ibazel', '^0.10.2'],
                ['@bazel/karma', '0.40.0'],
                ['@bazel/protractor', '0.40.0'],
                ['@bazel/rollup', '0.40.0'],
                ['@bazel/terser', '0.40.0'],
                ['@bazel/typescript', '0.40.0'],
                ['history-server', '^1.3.1'],
                ['rollup', '^1.25.2'],
                ['rollup-plugin-commonjs', '^10.1.0'],
                ['rollup-plugin-node-resolve', '^5.2.0'],
                ['terser', '^4.3.9'],
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvc2NoZW1hdGljcy9uZy1hZGQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCw2Q0FBaUU7SUFDakUseURBQTJJO0lBQzNJLDBEQUF3RTtJQUN4RSw2REFBa0Y7SUFDbEYseUVBQTZKO0lBQzdKLHFFQUFpSDtJQUNqSCxxRUFBMkU7SUFFM0UsK0VBQWtGO0lBQ2xGLHlGQUE0RDtJQU01RDs7OztPQUlHO0lBQ0gsU0FBUywrQkFBK0IsQ0FBQyxPQUFlO1FBQ3RELE9BQU8sVUFBQyxJQUFVOztZQUNoQixJQUFNLFdBQVcsR0FBRyx1Q0FBd0IsQ0FBQyxJQUFJLEVBQUUsZUFBZSxDQUFDLENBQUM7WUFDcEUsSUFBSSxDQUFDLFdBQVcsRUFBRTtnQkFDaEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxvREFBb0QsQ0FBQyxDQUFDO2FBQ3ZFO1lBRUQsd0VBQXdFO1lBQ3hFLElBQU0sZUFBZSxHQUF1QjtnQkFDMUMsQ0FBQyxnQkFBZ0IsRUFBRSxXQUFXLENBQUMsT0FBTyxDQUFDO2dCQUN2QyxDQUFDLGNBQWMsRUFBRSxPQUFPLENBQUM7Z0JBQ3pCLENBQUMsZUFBZSxFQUFFLFNBQVMsQ0FBQztnQkFDNUIsQ0FBQyxjQUFjLEVBQUUsUUFBUSxDQUFDO2dCQUMxQixDQUFDLG1CQUFtQixFQUFFLFFBQVEsQ0FBQztnQkFDL0IsQ0FBQyxlQUFlLEVBQUUsUUFBUSxDQUFDO2dCQUMzQixDQUFDLGVBQWUsRUFBRSxRQUFRLENBQUM7Z0JBQzNCLENBQUMsbUJBQW1CLEVBQUUsUUFBUSxDQUFDO2dCQUMvQixDQUFDLGdCQUFnQixFQUFFLFFBQVEsQ0FBQztnQkFDNUIsQ0FBQyxRQUFRLEVBQUUsU0FBUyxDQUFDO2dCQUNyQixDQUFDLHdCQUF3QixFQUFFLFNBQVMsQ0FB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LDhCQUFzQixFQUFFLENBQUMsQ0FBQzthQUMvQztRQUNILENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRCxtQkFBd0IsT0FBZTtRQUNyQyxPQUFPLFVBQUMsSUFBVTtZQUNoQixPQUFPLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQyxJQUFJLElBQUkscUJBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQyxjQUFjLENBQUM7WUFDakUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUU7Z0JBQ2pCLE1BQU0sSUFBSSxLQUFLLENBQUMsc0RBQXNELENBQUMsQ0FBQzthQUN6RTtZQUNELGdDQUFtQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUVsQyxPQUFPLGtCQUFLLENBQUM7Z0JBQ1gsdUJBQXVCLENBQUMsT0FBTyxDQUFDO2dCQUNoQywrQkFBK0IsQ0FBQyxPQUFPLENBQUM7Z0JBQ3hDLHlDQUF5QyxDQUFDLE9BQU8sQ0FBQztnQkFDbEQsdUJBQXVCLEVBQUU7Z0JBQ3pCLGlCQUFpQixFQUFFO2dCQUNuQixrQ0FBa0MsQ0FBQyxPQUFPLENBQUM7Z0JBQzNDLGVBQWUsRUFBRTtnQkFDakIsV0FBVyxFQUFFO2dCQUNiLGtCQUFrQixDQUFDLE9BQU8sQ0FBQzthQUM1QixDQUFDLENBQUM7UUFDTCxDQUFDLENBQUM7SUFDSixDQUFDO0lBcEJELDRCQW9CQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKlxuICogQGZpbGVvdmVydmlldyBTY2hlbWF0aWNzIGZvciBuZy1uZXcgcHJvamVjdCB0aGF0IGJ1aWxkcyB3aXRoIEJhemVsLlxuICovXG5cbmltcG9ydCB7SnNvbkFzdE9iamVjdCwgcGFyc2VKc29uQXN0fSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQge1J1bGUsIFNjaGVtYXRpY0NvbnRleHQsIFNjaGVtYXRpY3NFeGNlcHRpb24sIFRyZWUsIGFwcGx5LCBhcHBseVRlbXBsYXRlcywgY2hhaW4sIG1lcmdlV2l0aCwgdXJsfSBmcm9tICdAYW5ndWxhci1kZXZraXQvc2NoZW1hdGljcyc7XG5pbXBvcnQge05vZGVQYWNrYWdlSW5zdGFsbFRhc2t9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9zY2hlbWF0aWNzL3Rhc2tzJztcbmltcG9ydCB7Z2V0V29ya3NwYWNlLCBnZXRXb3Jrc3BhY2VQYXRofSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvY29uZmlnJztcbmltcG9ydCB7Tm9kZURlcGVuZGVuY3lUeXBlLCBhZGRQYWNrYWdlSnNvbkRlcGVuZGVuY3ksIGdldFBhY2thZ2VKc29uRGVwZW5kZW5jeSwgcmVtb3ZlUGFja2FnZUpzb25EZXBlbmRlbmN5fSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvZGVwZW5kZW5jaWVzJztcbmltcG9ydCB7ZmluZFByb3BlcnR5SW5Bc3RPYmplY3QsIGluc2VydFByb3BlcnR5SW5Bc3RPYmplY3RJbk9yZGVyfSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvanNvbi11dGlscyc7XG5pbXBvcnQge3ZhbGlkYXRlUHJvamVjdE5hbWV9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS92YWxpZGF0aW9uJztcblxuaW1wb3J0IHtpc0pzb25Bc3RPYmplY3QsIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0fSBmcm9tICcuLi91dGlsaXR5L2pzb24tdXRpbHMnO1xuaW1wb3J0IHtmaW5kRTJlQXJjaGl0ZWN0fSBmcm9tICcuLi91dGlsaXR5L3dvcmtzcGFjZS11dGlscyc7XG5cbmltcG9ydCB7U2NoZW1hfSBmcm9tICcuL3NjaGVtYSc7XG5cblxuXG4vKipcbiAqIFBhY2thZ2VzIHRoYXQgYnVpbGQgdW5kZXIgQmF6ZWwgcmVxdWlyZSBhZGRpdGlvbmFsIGRldiBkZXBlbmRlbmNpZXMuIFRoaXNcbiAqIGZ1bmN0aW9uIGFkZHMgdGhvc2UgZGVwZW5kZW5jaWVzIHRvIFwiZGV2RGVwZW5kZW5jaWVzXCIgc2VjdGlvbiBpblxuICogcGFja2FnZS5qc29uLlxuICovXG5mdW5jdGlvbiBhZGREZXZEZXBlbmRlbmNpZXNUb1BhY2thZ2VKc29uKG9wdGlvbnM6IFNjaGVtYSkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUpID0+IHtcbiAgICBjb25zdCBhbmd1bGFyQ29yZSA9IGdldFBhY2thZ2VKc29uRGVwZW5kZW5jeShob3N0LCAnQGFuZ3VsYXIvY29yZScpO1xuICAgIGlmICghYW5ndWxhckNvcmUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQGFuZ3VsYXIvY29yZSBkZXBlbmRlbmN5IG5vdCBmb3VuZCBpbiBwYWNrYWdlLmpzb24nKTtcbiAgICB9XG5cbiAgICAvLyBUT0RPOiB1c2UgYSBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHdoZW4gdGhlIHRzYyBsaWIgc2V0dGluZyBhbGxvd3MgdXNcbiAgICBjb25zdCBkZXZEZXBlbmRlbmNpZXM6IFtzdHJpbmcsIHN0cmluZ11bXSA9IFtcbiAgICAgIFsnQGFuZ3VsYXIvYmF6ZWwnLCBhbmd1bGFyQ29yZS52ZXJzaW9uXSxcbiAgICAgIFsnQGJhemVsL2JhemVsJywgJzEuMS4wJ10sXG4gICAgICBbJ0BiYXplbC9pYmF6ZWwnLCAnXjAuMTAuMiddLFxuICAgICAgWydAYmF6ZWwva2FybWEnLCAnMC40MC4wJ10sXG4gICAgICBbJ0BiYXplbC9wcm90cmFjdG9yJywgJzAuNDAuMCddLFxuICAgICAgWydAYmF6ZWwvcm9sbHVwJywgJzAuNDAuMCddLFxuICAgICAgWydAYmF6ZWwvdGVyc2VyJywgJzAuNDAuMCddLFxuICAgICAgWydAYmF6ZWwvdHlwZXNjcmlwdCcsICcwLjQwLjAnXSxcbiAgICAgIFsnaGlzdG9yeS1zZXJ2ZXInLCAnXjEuMy4xJ10sXG4gICAgICBbJ3JvbGx1cCcsICdeMS4yNS4yJ10sXG4gICAgICBbJ3JvbGx1cC1wbHVnaW4tY29tbW9uanMnLCAnXjEwLjEuMCddLFxuICAgICAgWydyb2xsdXAtcGx1Z2luLW5vZGUtcmVzb2x2ZScsICdeNS4yLjAnXSxcbiAgICAgIFsndGVyc2VyJywgJ140LjMuOSddLFxuICAgIF07XG5cbiAgICBmb3IgKGNvbnN0IFtuYW1lLCB2ZXJzaW9uXSBvZiBkZXZEZXBlbmRlbmNpZXMpIHtcbiAgICAgIGNvbnN0IGRlcCA9IGdldFBhY2thZ2VKc29uRGVwZW5kZW5jeShob3N0LCBuYW1lKTtcbiAgICAgIGlmIChkZXAgJiYgZGVwLnR5cGUgIT09IE5vZGVEZXBlbmRlbmN5VHlwZS5EZXYpIHtcbiAgICAgICAgcmVtb3ZlUGFja2FnZUpzb25EZXBlbmRlbmN5KGhvc3QsIG5hbWUpO1xuICAgICAgfVxuXG4gICAgICBhZGRQYWNrYWdlSnNvbkRlcGVuZGVuY3koaG9zdCwge1xuICAgICAgICBuYW1lLFxuICAgICAgICB2ZXJzaW9uLFxuICAgICAgICB0eXBlOiBOb2RlRGVwZW5kZW5jeVR5cGUuRGV2LFxuICAgICAgICBvdmVyd3JpdGU6IHRydWUsXG4gICAgICB9KTtcbiAgICB9XG4gIH07XG59XG5cbi8qKlxuICogUmVtb3ZlIHBhY2thZ2VzIHRoYXQgYXJlIG5vdCBuZWVkZWQgdW5kZXIgQmF6ZWwuXG4gKiBAcGFyYW0gb3B0aW9uc1xuICovXG5mdW5jdGlvbiByZW1vdmVPYnNvbGV0ZURlcGVuZGVuY2llc0Zyb21QYWNrYWdlSnNvbihvcHRpb25zOiBTY2hlbWEpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgY29uc3QgZGVwc1RvUmVtb3ZlID0gW1xuICAgICAgJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyJyxcbiAgICBdO1xuXG4gICAgZm9yIChjb25zdCBwYWNrYWdlTmFtZSBvZiBkZXBzVG9SZW1vdmUpIHtcbiAgICAgIHJlbW92ZVBhY2thZ2VKc29uRGVwZW5kZW5jeShob3N0LCBwYWNrYWdlTmFtZSk7XG4gICAgfVxuICB9O1xufVxuXG4vKipcbiAqIEFwcGVuZCBhZGRpdGlvbmFsIEphdmFzY3JpcHQgLyBUeXBlc2NyaXB0IGZpbGVzIG5lZWRlZCB0byBjb21waWxlIGFuIEFuZ3VsYXJcbiAqIHByb2plY3QgdW5kZXIgQmF6ZWwuXG4gKi9cbmZ1bmN0aW9uIGFkZEZpbGVzUmVxdWlyZWRCeUJhemVsKG9wdGlvbnM6IFNjaGVtYSkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUpID0+IHtcbiAgICByZXR1cm4gbWVyZ2VXaXRoKGFwcGx5KHVybCgnLi9maWxlcycpLCBbXG4gICAgICBhcHBseVRlbXBsYXRlcyh7fSksXG4gICAgXSkpO1xuICB9O1xufVxuXG4vKipcbiAqIEFwcGVuZCAnL2JhemVsLW91dCcgdG8gdGhlIGdpdGlnbm9yZSBmaWxlLlxuICovXG5mdW5jdGlvbiB1cGRhdGVHaXRpZ25vcmUoKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIGNvbnN0IGdpdGlnbm9yZSA9ICcvLmdpdGlnbm9yZSc7XG4gICAgaWYgKCFob3N0LmV4aXN0cyhnaXRpZ25vcmUpKSB7XG4gICAgICByZXR1cm4gaG9zdDtcbiAgICB9XG4gICAgY29uc3QgZ2l0SWdub3JlQ29udGVudFJhdyA9IGhvc3QucmVhZChnaXRpZ25vcmUpO1xuICAgIGlmICghZ2l0SWdub3JlQ29udGVudFJhdykge1xuICAgICAgcmV0dXJuIGhvc3Q7XG4gICAgfVxuICAgIGNvbnN0IGdpdElnbm9yZUNvbnRlbnQgPSBnaXRJZ25vcmVDb250ZW50UmF3LnRvU3RyaW5nKCk7XG4gICAgaWYgKGdpdElnbm9yZUNvbnRlbnQuaW5jbHVkZXMoJ1xcbi9iYXplbC1vdXRcXG4nKSkge1xuICAgICAgcmV0dXJuIGhvc3Q7XG4gICAgfVxuICAgIGNvbnN0IGNvbXBpbGVkT3V0cHV0ID0gJyMgY29tcGlsZWQgb3V0cHV0XFxuJztcbiAgICBjb25zdCBpbmRleCA9IGdpdElnbm9yZUNvbnRlbnQuaW5kZXhPZihjb21waWxlZE91dHB1dCk7XG4gICAgY29uc3QgaW5zZXJ0aW9uSW5kZXggPSBpbmRleCA+PSAwID8gaW5kZXggKyBjb21waWxlZE91dHB1dC5sZW5ndGggOiBnaXRJZ25vcmVDb250ZW50Lmxlbmd0aDtcbiAgICBjb25zdCByZWNvcmRlciA9IGhvc3QuYmVnaW5VcGRhdGUoZ2l0aWdub3JlKTtcbiAgICByZWNvcmRlci5pbnNlcnRSaWdodChpbnNlcnRpb25JbmRleCwgJy9iYXplbC1vdXRcXG4nKTtcbiAgICBob3N0LmNvbW1pdFVwZGF0ZShyZWNvcmRlcik7XG4gICAgcmV0dXJuIGhvc3Q7XG4gIH07XG59XG5cbi8qKlxuICogQ2hhbmdlIHRoZSBhcmNoaXRlY3QgaW4gYW5ndWxhci5qc29uIHRvIHVzZSBCYXplbCBidWlsZGVyLlxuICovXG5mdW5jdGlvbiB1cGRhdGVBbmd1bGFySnNvblRvVXNlQmF6ZWxCdWlsZGVyKG9wdGlvbnM6IFNjaGVtYSk6IFJ1bGUge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUpID0+IHtcbiAgICBjb25zdCBuYW1lID0gb3B0aW9ucy5uYW1lICE7XG4gICAgY29uc3Qgd29ya3NwYWNlUGF0aCA9IGdldFdvcmtzcGFjZVBhdGgoaG9zdCk7XG4gICAgaWYgKCF3b3Jrc3BhY2VQYXRoKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIGFuZ3VsYXIuanNvbicpO1xuICAgIH1cbiAgICBjb25zdCB3b3Jrc3BhY2VDb250ZW50ID0gaG9zdC5yZWFkKHdvcmtzcGFjZVBhdGgpO1xuICAgIGlmICghd29ya3NwYWNlQ29udGVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gcmVhZCBhbmd1bGFyLmpzb24gY29udGVudCcpO1xuICAgIH1cbiAgICBjb25zdCB3b3Jrc3BhY2VKc29uQXN0ID0gcGFyc2VKc29uQXN0KHdvcmtzcGFjZUNvbnRlbnQudG9TdHJpbmcoKSkgYXMgSnNvbkFzdE9iamVjdDtcbiAgICBjb25zdCBwcm9qZWN0cyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KHdvcmtzcGFjZUpzb25Bc3QsICdwcm9qZWN0cycpO1xuICAgIGlmICghcHJvamVjdHMpIHtcbiAgICAgIHRocm93IG5ldyBTY2hlbWF0aWNzRXhjZXB0aW9uKCdFeHBlY3QgcHJvamVjdHMgaW4gYW5ndWxhci5qc29uIHRvIGJlIGFuIE9iamVjdCcpO1xuICAgIH1cbiAgICBjb25zdCBwcm9qZWN0ID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QocHJvamVjdHMgYXMgSnNvbkFzdE9iamVjdCwgbmFtZSk7XG4gICAgaWYgKCFwcm9qZWN0KSB7XG4gICAgICB0aHJvdyBuZXcgU2NoZW1hdGljc0V4Y2VwdGlvbihgRXhwZWN0ZWQgcHJvamVjdHMgdG8gY29udGFpbiAke25hbWV9YCk7XG4gICAgfVxuICAgIGNvbnN0IHJlY29yZGVyID0gaG9zdC5iZWdpblVwZGF0ZSh3b3Jrc3BhY2VQYXRoKTtcbiAgICBjb25zdCBpbmRlbnQgPSA4O1xuICAgIGNvbnN0IGFyY2hpdGVjdCA9XG4gICAgICAgIGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KHByb2plY3QgYXMgSnNvbkFzdE9iamVjdCwgJ2FyY2hpdGVjdCcpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QoXG4gICAgICAgIHJlY29yZGVyLCBhcmNoaXRlY3QsICdidWlsZCcsIHtcbiAgICAgICAgICBidWlsZGVyOiAnQGFuZ3VsYXIvYmF6ZWw6YnVpbGQnLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIHRhcmdldExhYmVsOiAnLy9zcmM6cHJvZGFwcCcsXG4gICAgICAgICAgICBiYXplbENvbW1hbmQ6ICdidWlsZCcsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBjb25maWd1cmF0aW9uczoge1xuICAgICAgICAgICAgcHJvZHVjdGlvbjoge1xuICAgICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vc3JjOnByb2RhcHAnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBpbmRlbnQpO1xuICAgIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0KFxuICAgICAgICByZWNvcmRlciwgYXJjaGl0ZWN0LCAnc2VydmUnLCB7XG4gICAgICAgICAgYnVpbGRlcjogJ0Bhbmd1bGFyL2JhemVsOmJ1aWxkJyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vc3JjOmRldnNlcnZlcicsXG4gICAgICAgICAgICBiYXplbENvbW1hbmQ6ICdydW4nLFxuICAgICAgICAgICAgd2F0Y2g6IHRydWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBjb25maWd1cmF0aW9uczoge1xuICAgICAgICAgICAgcHJvZHVjdGlvbjoge1xuICAgICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vc3JjOnByb2RzZXJ2ZXInLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBpbmRlbnQpO1xuXG4gICAgaWYgKGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGFyY2hpdGVjdCwgJ3Rlc3QnKSkge1xuICAgICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QoXG4gICAgICAgICAgcmVjb3JkZXIsIGFyY2hpdGVjdCwgJ3Rlc3QnLCB7XG4gICAgICAgICAgICBidWlsZGVyOiAnQGFuZ3VsYXIvYmF6ZWw6YnVpbGQnLFxuICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICBiYXplbENvbW1hbmQ6ICd0ZXN0JyxcbiAgICAgICAgICAgICAgdGFyZ2V0TGFiZWw6ICcvL3NyYzp0ZXN0JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBpbmRlbnQpO1xuICAgIH1cblxuICAgIGNvbnN0IGUyZUFyY2hpdGVjdCA9IGZpbmRFMmVBcmNoaXRlY3Qod29ya3NwYWNlSnNvbkFzdCwgbmFtZSk7XG4gICAgaWYgKGUyZUFyY2hpdGVjdCAmJiBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChlMmVBcmNoaXRlY3QsICdlMmUnKSkge1xuICAgICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QoXG4gICAgICAgICAgcmVjb3JkZXIsIGUyZUFyY2hpdGVjdCwgJ2UyZScsIHtcbiAgICAgICAgICAgIGJ1aWxkZXI6ICdAYW5ndWxhci9iYXplbDpidWlsZCcsXG4gICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgIGJhemVsQ29tbWFuZDogJ3Rlc3QnLFxuICAgICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vZTJlOmRldnNlcnZlcl90ZXN0JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBjb25maWd1cmF0aW9uczoge1xuICAgICAgICAgICAgICBwcm9kdWN0aW9uOiB7XG4gICAgICAgICAgICAgICAgdGFyZ2V0TGFiZWw6ICcvL2UyZTpwcm9kc2VydmVyX3Rlc3QnLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0sXG4gICAgICAgICAgaW5kZW50KTtcbiAgICB9XG5cbiAgICBob3N0LmNvbW1pdFVwZGF0ZShyZWNvcmRlcik7XG4gICAgcmV0dXJuIGhvc3Q7XG4gIH07XG59XG5cbi8qKlxuICogQ3JlYXRlIGEgYmFja3VwIGZvciB0aGUgb3JpZ2luYWwgYW5ndWxhci5qc29uIGZpbGUgaW4gY2FzZSB1c2VyIHdhbnRzIHRvXG4gKiBlamVjdCBCYXplbCBhbmQgcmV2ZXJ0IHRvIHRoZSBvcmlnaW5hbCB3b3JrZmxvdy5cbiAqL1xuZnVuY3Rpb24gYmFja3VwQW5ndWxhckpzb24oKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSwgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCkgPT4ge1xuICAgIGNvbnN0IHdvcmtzcGFjZVBhdGggPSBnZXRXb3Jrc3BhY2VQYXRoKGhvc3QpO1xuICAgIGlmICghd29ya3NwYWNlUGF0aCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBob3N0LmNyZWF0ZShcbiAgICAgICAgYCR7d29ya3NwYWNlUGF0aH0uYmFrYCwgJy8vIFRoaXMgaXMgYSBiYWNrdXAgZmlsZSBvZiB0aGUgb3JpZ2luYWwgYW5ndWxhci5qc29uLiAnICtcbiAgICAgICAgICAgICdUaGlzIGZpbGUgaXMgbmVlZGVkIGluIGNhc2UgeW91IHdhbnQgdG8gcmV2ZXJ0IHRvIHRoZSB3b3JrZmxvdyB3aXRob3V0IEJhemVsLlxcblxcbicgK1xuICAgICAgICAgICAgaG9zdC5yZWFkKHdvcmtzcGFjZVBhdGgpKTtcbiAgfTtcbn1cblxuLyoqXG4gKiBAYW5ndWxhci9iYXplbCByZXF1aXJlcyBtaW5pbXVtIHZlcnNpb24gb2YgcnhqcyB0byBiZSA2LjQuMC4gVGhpcyBmdW5jdGlvblxuICogdXBncmFkZXMgdGhlIHZlcnNpb24gb2YgcnhqcyBpbiBwYWNrYWdlLmpzb24gaWYgbmVjZXNzYXJ5LlxuICovXG5mdW5jdGlvbiB1cGdyYWRlUnhqcygpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgY29uc3Qgcnhqc05vZGUgPSBnZXRQYWNrYWdlSnNvbkRlcGVuZGVuY3koaG9zdCwgJ3J4anMnKTtcbiAgICBpZiAoIXJ4anNOb2RlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBmaW5kIHJ4anMgZGVwZW5kZW5jeS5gKTtcbiAgICB9XG5cbiAgICBjb25zdCBtYXRjaCA9IHJ4anNOb2RlLnZlcnNpb24ubWF0Y2goLyhcXGQpK1xcLihcXGQpKy4oXFxkKSskLyk7XG4gICAgaWYgKG1hdGNoKSB7XG4gICAgICBjb25zdCBbXywgbWFqb3IsIG1pbm9yXSA9IG1hdGNoO1xuICAgICAgaWYgKG1ham9yIDwgJzYnIHx8IChtYWpvciA9PT0gJzYnICYmIG1pbm9yIDwgJzUnKSkge1xuICAgICAgICBhZGRQYWNrYWdlSnNvbkRlcGVuZGVuY3koaG9zdCwge1xuICAgICAgICAgIC4uLnJ4anNOb2RlLFxuICAgICAgICAgIHZlcnNpb246ICd+Ni41LjMnLFxuICAgICAgICAgIG92ZXJ3cml0ZTogdHJ1ZSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLmluZm8oXG4gICAgICAgICAgJ0NvdWxkIG5vdCBkZXRlcm1pbmUgdmVyc2lvbiBvZiByeGpzLiBcXG4nICtcbiAgICAgICAgICAnUGxlYXNlIG1ha2Ugc3VyZSB0aGF0IHZlcnNpb24gaXMgYXQgbGVhc3QgNi41LjMuJyk7XG4gICAgfVxuICAgIHJldHVybiBob3N0O1xuICB9O1xufVxuXG4vKipcbiAqIFdoZW4gdXNpbmcgSXZ5LCBuZ2NjIG11c3QgYmUgcnVuIGFzIGEgcG9zdGluc3RhbGwgc3RlcC5cbiAqIFRoaXMgZnVuY3Rpb24gYWRkcyB0aGlzIHBvc3RpbnN0YWxsIHN0ZXAuXG4gKi9cbmZ1bmN0aW9uIGFkZFBvc3RpbnN0YWxsVG9SdW5OZ2NjKCkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBjb25zdCBwYWNrYWdlSnNvbiA9ICdwYWNrYWdlLmpzb24nO1xuICAgIGlmICghaG9zdC5leGlzdHMocGFja2FnZUpzb24pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBmaW5kICR7cGFja2FnZUpzb259YCk7XG4gICAgfVxuICAgIGNvbnN0IGNvbnRlbnQgPSBob3N0LnJlYWQocGFja2FnZUpzb24pO1xuICAgIGlmICghY29udGVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gcmVhZCBwYWNrYWdlLmpzb24gY29udGVudCcpO1xuICAgIH1cbiAgICBjb25zdCBqc29uQXN0ID0gcGFyc2VKc29uQXN0KGNvbnRlbnQudG9TdHJpbmcoKSk7XG4gICAgaWYgKCFpc0pzb25Bc3RPYmplY3QoanNvbkFzdCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIHBhcnNlIEpTT04gZm9yICR7cGFja2FnZUpzb259YCk7XG4gICAgfVxuICAgIGNvbnN0IHNjcmlwdHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChqc29uQXN0LCAnc2NyaXB0cycpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKHBhY2thZ2VKc29uKTtcbiAgICAvLyBGb3IgYmF6ZWwgd2UgbmVlZCB0byBjb21waWxlIHRoZSBhbGwgZmlsZXMgaW4gcGxhY2Ugc28gd2VcbiAgICAvLyBkb24ndCB1c2UgYC0tZmlyc3Qtb25seWAgb3IgYC0tY3JlYXRlLWl2eS1lbnRyeS1wb2ludHNgXG4gICAgY29uc3QgbmdjY0NvbW1hbmQgPSAnbmdjYyAtLXByb3BlcnRpZXMgZXMyMDE1IGJyb3dzZXIgbW9kdWxlIG1haW4nO1xuICAgIGlmIChzY3JpcHRzKSB7XG4gICAgICBjb25zdCBwb3N0SW5zdGFsbCA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KHNjcmlwdHMsICdwb3N0aW5zdGFsbCcpO1xuICAgICAgaWYgKHBvc3RJbnN0YWxsICYmIHBvc3RJbnN0YWxsLnZhbHVlKSB7XG4gICAgICAgIGxldCB2YWx1ZSA9IHBvc3RJbnN0YWxsLnZhbHVlIGFzIHN0cmluZztcbiAgICAgICAgaWYgKC9cXGJuZ2NjXFxiLy50ZXN0KHZhbHVlKSkge1xuICAgICAgICAgIC8vIGBuZ2NjYCBpcyBhbHJlYWR5IGluIHRoZSBwb3N0aW5zdGFsbCBzY3JpcHRcbiAgICAgICAgICB2YWx1ZSA9XG4gICAgICAgICAgICAgIHZhbHVlLnJlcGxhY2UoL1xccyotLWZpcnN0LW9ubHlcXGIvLCAnJykucmVwbGFjZSgvXFxzKi0tY3JlYXRlLWl2eS1lbnRyeS1wb2ludHNcXGIvLCAnJyk7XG4gICAgICAgICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QocmVjb3JkZXIsIHNjcmlwdHMsICdwb3N0aW5zdGFsbCcsIHZhbHVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBjb25zdCBjb21tYW5kID0gYCR7cG9zdEluc3RhbGwudmFsdWV9OyAke25nY2NDb21tYW5kfWA7XG4gICAgICAgICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QocmVjb3JkZXIsIHNjcmlwdHMsICdwb3N0aW5zdGFsbCcsIGNvbW1hbmQpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpbnNlcnRQcm9wZXJ0eUluQXN0T2JqZWN0SW5PcmRlcihyZWNvcmRlciwgc2NyaXB0cywgJ3Bvc3RpbnN0YWxsJywgbmdjY0NvbW1hbmQsIDQpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpbnNlcnRQcm9wZXJ0eUluQXN0T2JqZWN0SW5PcmRlcihcbiAgICAgICAgICByZWNvcmRlciwganNvbkFzdCwgJ3NjcmlwdHMnLCB7XG4gICAgICAgICAgICBwb3N0aW5zdGFsbDogbmdjY0NvbW1hbmQsXG4gICAgICAgICAgfSxcbiAgICAgICAgICAyKTtcbiAgICB9XG4gICAgaG9zdC5jb21taXRVcGRhdGUocmVjb3JkZXIpO1xuICAgIHJldHVybiBob3N0O1xuICB9O1xufVxuXG4vKipcbiAqIFNjaGVkdWxlIGEgdGFzayB0byBwZXJmb3JtIG5wbSAvIHlhcm4gaW5zdGFsbC5cbiAqL1xuZnVuY3Rpb24gaW5zdGFsbE5vZGVNb2R1bGVzKG9wdGlvbnM6IFNjaGVtYSk6IFJ1bGUge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBpZiAoIW9wdGlvbnMuc2tpcEluc3RhbGwpIHtcbiAgICAgIGNvbnRleHQuYWRkVGFzayhuZXcgTm9kZVBhY2thZ2VJbnN0YWxsVGFzaygpKTtcbiAgICB9XG4gIH07XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKG9wdGlvbnM6IFNjaGVtYSk6IFJ1bGUge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUpID0+IHtcbiAgICBvcHRpb25zLm5hbWUgPSBvcHRpb25zLm5hbWUgfHwgZ2V0V29ya3NwYWNlKGhvc3QpLmRlZmF1bHRQcm9qZWN0O1xuICAgIGlmICghb3B0aW9ucy5uYW1lKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1BsZWFzZSBzcGVjaWZ5IGEgcHJvamVjdCB1c2luZyBcIi0tbmFtZSBwcm9qZWN0LW5hbWVcIicpO1xuICAgIH1cbiAgICB2YWxpZGF0ZVByb2plY3ROYW1lKG9wdGlvbnMubmFtZSk7XG5cbiAgICByZXR1cm4gY2hhaW4oW1xuICAgICAgYWRkRmlsZXNSZXF1aXJlZEJ5QmF6ZWwob3B0aW9ucyksXG4gICAgICBhZGREZXZEZXBlbmRlbmNpZXNUb1BhY2thZ2VKc29uKG9wdGlvbnMpLFxuICAgICAgcmVtb3ZlT2Jzb2xldGVEZXBlbmRlbmNpZXNGcm9tUGFja2FnZUpzb24ob3B0aW9ucyksXG4gICAgICBhZGRQb3N0aW5zdGFsbFRvUnVuTmdjYygpLFxuICAgICAgYmFja3VwQW5ndWxhckpzb24oKSxcbiAgICAgIHVwZGF0ZUFuZ3VsYXJKc29uVG9Vc2VCYXplbEJ1aWxkZXIob3B0aW9ucyksXG4gICAgICB1cGRhdGVHaXRpZ25vcmUoKSxcbiAgICAgIHVwZ3JhZGVSeGpzKCksXG4gICAgICBpbnN0YWxsTm9kZU1vZHVsZXMob3B0aW9ucyksXG4gICAgXSk7XG4gIH07XG59XG4iXX0=
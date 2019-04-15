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
                '@bazel/bazel': '^0.24.0',
                '@bazel/ibazel': '^0.9.0',
                '@bazel/karma': '0.27.10',
                '@bazel/typescript': '0.27.10',
            };
            var recorder = host.beginUpdate(packageJson);
            var depsToInstall = Object.keys(devDependencies).filter(function (name) {
                return !json_utils_1.findPropertyInAstObject(devDeps, name);
            });
            try {
                for (var depsToInstall_1 = tslib_1.__values(depsToInstall), depsToInstall_1_1 = depsToInstall_1.next(); !depsToInstall_1_1.done; depsToInstall_1_1 = depsToInstall_1.next()) {
                    var packageName = depsToInstall_1_1.value;
                    var version = devDependencies[packageName];
                    var indent = 4;
                    json_utils_1.insertPropertyInAstObjectInOrder(recorder, devDeps, packageName, version, indent);
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (depsToInstall_1_1 && !depsToInstall_1_1.done && (_a = depsToInstall_1.return)) _a.call(depsToInstall_1);
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
            if (json_utils_1.findPropertyInAstObject(architect, 'test')) {
                json_utils_2.replacePropertyInAstObject(recorder, architect, 'test', {
                    builder: '@angular/bazel:build',
                    options: { 'bazelCommand': 'test', 'targetLabel': '//src/...' },
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
                installNodeModules(options),
            ]);
        };
    }
    exports.default = default_1;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvc2NoZW1hdGljcy9uZy1hZGQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCw2Q0FBaUU7SUFDakUseURBQTJJO0lBQzNJLDBEQUF3RTtJQUN4RSw2REFBb0U7SUFDcEUscUVBQWlIO0lBQ2pILHFFQUEyRTtJQUUzRSwrRUFBNkc7SUFDN0cseUZBQTREO0lBSzVEOzs7O09BSUc7SUFDSCxTQUFTLCtCQUErQixDQUFDLE9BQWU7UUFDdEQsT0FBTyxVQUFDLElBQVU7O1lBQ2hCLElBQU0sV0FBVyxHQUFHLGNBQWMsQ0FBQztZQUNuQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsRUFBRTtnQkFDN0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxvQkFBa0IsV0FBYSxDQUFDLENBQUM7YUFDbEQ7WUFDRCxJQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDbEQsSUFBSSxDQUFDLGtCQUFrQixFQUFFO2dCQUN2QixNQUFNLElBQUksS0FBSyxDQUFDLHFDQUFxQyxDQUFDLENBQUM7YUFDeEQ7WUFDRCxJQUFNLE9BQU8sR0FBRyxtQkFBWSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsRUFBRSxDQUFrQixDQUFDO1lBQzdFLElBQU0sSUFBSSxHQUFHLG9DQUF1QixDQUFDLE9BQU8sRUFBRSxjQUFjLENBQWtCLENBQUM7WUFDL0UsSUFBTSxPQUFPLEdBQUcsb0NBQXVCLENBQUMsT0FBTyxFQUFFLGlCQUFpQixDQUFrQixDQUFDO1lBRXJGLElBQU0sZUFBZSxHQUFHLG9DQUF1QixDQUFDLElBQUksRUFBRSxlQUFlLENBQUMsQ0FBQztZQUN2RSxJQUFJLENBQUMsZUFBZSxFQUFFO2dCQUNwQixNQUFNLElBQUksS0FBSyxDQUFDLG9EQUFvRCxDQUFDLENBQUM7YUFDdkU7WUFDRCxJQUFNLGtCQUFrQixHQUFHLGVBQWUsQ0FBQyxLQUFlLENBQUM7WUFFM0QsSUFBTSxlQUFlLEdBQTBCO2dCQUM3QyxnQkFBZ0IsRUFBRSxrQkFBa0I7Z0JBQ3BDLGNBQWMsRUFBRSxTQUFTO2dCQUN6QixlQUFlLEVBQUUsUUFBUTtnQkFDekIsY0FBYyxFQUFFLFNBQVM7Z0JBQ3pCLG1CQUFtQixFQUFFLFNBQVM7YUFDL0IsQ0FBQztZQUVGLElBQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDL0MsSUFBTSxhQUFhLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxNQUFNLENBQUMsVUFBQyxJQUFJO2dCQUM3RCxPQUFPLENBQUMsb0NBQXVCLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ2pELENBQUMsQ0FBQyxDQUFDOztnQkFDSCxLQUEwQixJQUFBLGtCQUFBLGlCQUFBLGFBQWEsQ0FBQSw0Q0FBQSx1RUFBRTtvQkFBcEMsSUFBTSxXQUFXLDBCQUFBO29CQUNwQixJQUFNLE9BQU8sR0FBRyxlQUFlLENBQUMsV0FBVyxDQUFDLENBQUM7b0JBQzdDLElBQU0sTUFBTSxHQUFHLENBQUMsQ0FBQztvQkFDakIsNkNBQWdDLENBQUMsUUFBUSxFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxDQUFDO2lCQUNuRjs7Ozs7Ozs7O1lBQ0QsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUM1QixPQUFPLElBQUksQ0FBQztRQUNkLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRDs7O09BR0c7SUFDSCxTQUFTLHVCQUF1QixDQUFDLE9BQWU7UUFDOUMsT0FBTyxVQUFDLElBQVU7WUFDaEIsT0FBTyxzQkFBUyxDQUFDLGtCQUFLLENBQUMsZ0JBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRTtnQkFDckMsMkJBQWMsQ0FBQyxFQUFFLENBQUM7YUFDbkIsQ0FBQyxDQUFDLENBQUM7UUFDTixDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQ7O09BRUc7SUFDSCxTQUFTLGVBQWU7UUFDdEIsT0FBTyxVQUFDLElBQVU7WUFDaEIsSUFBTSxTQUFTLEdBQUcsYUFBYSxDQUFDO1lBQ2hDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxFQUFFO2dCQUMzQixPQUFPLElBQUksQ0FBQzthQUNiO1lBQ0QsSUFBTSxtQkFBbUIsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ2pELElBQUksQ0FBQyxtQkFBbUIsRUFBRTtnQkFDeEIsT0FBTyxJQUFJLENBQUM7YUFDYjtZQUNELElBQU0sZ0JBQWdCLEdBQUcsbUJBQW1CLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDeEQsSUFBSSxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsRUFBRTtnQkFDL0MsT0FBTyxJQUFJLENBQUM7YUFDYjtZQUNELElBQU0sY0FBYyxHQUFHLHFCQUFxQixDQUFDO1lBQzdDLElBQU0sS0FBSyxHQUFHLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQztZQUN2RCxJQUFNLGNBQWMsR0FBRyxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDO1lBQzVGLElBQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDN0MsUUFBUSxDQUFDLFdBQVcsQ0FBQyxjQUFjLEVBQUUsY0FBYyxDQUFDLENBQUM7WUFDckQsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUM1QixPQUFPLElBQUksQ0FBQztRQUNkLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRDs7T0FFRztJQUNILFNBQVMsa0NBQWtDLENBQUMsT0FBZTtRQUN6RCxPQUFPLFVBQUMsSUFBVSxFQUFFLE9BQXlCO1lBQ3BDLElBQUEsbUJBQUksQ0FBWTtZQUN2QixJQUFNLGFBQWEsR0FBRyx5QkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUM3QyxJQUFJLENBQUMsYUFBYSxFQUFFO2dCQUNsQixNQUFNLElBQUksS0FBSyxDQUFDLDZCQUE2QixDQUFDLENBQUM7YUFDaEQ7WUFDRCxJQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDbEQsSUFBSSxDQUFDLGdCQUFnQixFQUFFO2dCQUNyQixNQUFNLElBQUksS0FBSyxDQUFDLHFDQUFxQyxDQUFDLENBQUM7YUFDeEQ7WUFDRCxJQUFNLGdCQUFnQixHQUFHLG1CQUFZLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxFQUFFLENBQWtCLENBQUM7WUFDcEYsSUFBTSxRQUFRLEdBQUcsb0NBQXVCLENBQUMsZ0JBQWdCLEVBQUUsVUFBVSxDQUFDLENBQUM7WUFDdkUsSUFBSSxDQUFDLFFBQVEsRUFBRTtnQkFDYixNQUFNLElBQUksZ0NBQW1CLENBQUMsaURBQWlELENBQUMsQ0FBQzthQUNsRjtZQUNELElBQU0sT0FBTyxHQUFHLG9DQUF1QixDQUFDLFFBQXlCLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDekUsSUFBSSxDQUFDLE9BQU8sRUFBRTtnQkFDWixNQUFNLElBQUksZ0NBQW1CLENBQUMsa0NBQWdDLElBQU0sQ0FBQyxDQUFDO2FBQ3ZFO1lBQ0QsSUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxhQUFhLENBQUMsQ0FBQztZQUNqRCxJQUFNLE1BQU0sR0FBRyxDQUFDLENBQUM7WUFDakIsSUFBTSxTQUFTLEdBQ1gsb0NBQXVCLENBQUMsT0FBd0IsRUFBRSxXQUFXLENBQWtCLENBQUM7WUFDcEYsdUNBQTBCLENBQ3RCLFFBQVEsRUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFO2dCQUM1QixPQUFPLEVBQUUsc0JBQXNCO2dCQUMvQixPQUFPLEVBQUU7b0JBQ1AsV0FBVyxFQUFFLGVBQWU7b0JBQzVCLFlBQVksRUFBRSxPQUFPO2lCQUN0QjthQUNGLEVBQ0QsTUFBTSxDQUFDLENBQUM7WUFDWix1Q0FBMEIsQ0FDdEIsUUFBUSxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUU7Z0JBQzVCLE9BQU8sRUFBRSxzQkFBc0I7Z0JBQy9CLE9BQU8sRUFBRTtvQkFDUCxXQUFXLEVBQUUsaUJBQWlCO29CQUM5QixZQUFZLEVBQUUsS0FBSztvQkFDbkIsS0FBSyxFQUFFLElBQUk7aUJBQ1o7Z0JBQ0QsY0FBYyxFQUFFO29CQUNkLFVBQVUsRUFBRTt3QkFDVixXQUFXLEVBQUUsa0JBQWtCO3FCQUNoQztpQkFDRjthQUNGLEVBQ0QsTUFBTSxDQUFDLENBQUM7WUFFWixJQUFJLG9DQUF1QixDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUMsRUFBRTtnQkFDOUMsdUNBQTBCLENBQ3RCLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFO29CQUMzQixPQUFPLEVBQUUsc0JBQXNCO29CQUMvQixPQUFPLEVBQUUsRUFBQyxjQUFjLEVBQUUsTUFBTSxFQUFFLGFBQWEsRUFBRSxXQUFXLEVBQUM7aUJBQzlELEVBQ0QsTUFBTSxDQUFDLENBQUM7YUFDYjtZQUVELElBQU0sWUFBWSxHQUFHLGtDQUFnQixDQUFDLGdCQUFnQixFQUFFLElBQUksQ0FBQyxDQUFDO1lBQzlELElBQUksWUFBWSxJQUFJLG9DQUF1QixDQUFDLFlBQVksRUFBRSxLQUFLLENBQUMsRUFBRTtnQkFDaEUsdUNBQTBCLENBQ3RCLFFBQVEsRUFBRSxZQUFZLEVBQUUsS0FBSyxFQUFFO29CQUM3QixPQUFPLEVBQUUsc0JBQXNCO29CQUMvQixPQUFPLEVBQUU7d0JBQ1AsWUFBWSxFQUFFLE1BQU07d0JBQ3BCLFdBQVcsRUFBRSxzQkFBc0I7cUJBQ3BDO29CQUNELGNBQWMsRUFBRTt3QkFDZCxVQUFVLEVBQUU7NEJBQ1YsV0FBVyxFQUFFLHVCQUF1Qjt5QkFDckM7cUJBQ0Y7aUJBQ0YsRUFDRCxNQUFNLENBQUMsQ0FBQzthQUNiO1lBRUQsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUM1QixPQUFPLElBQUksQ0FBQztRQUNkLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRDs7O09BR0c7SUFDSCxTQUFTLGlCQUFpQjtRQUN4QixPQUFPLFVBQUMsSUFBVSxFQUFFLE9BQXlCO1lBQzNDLElBQU0sYUFBYSxHQUFHLHlCQUFnQixDQUFDLElBQUksQ0FBQyxDQUFDO1lBQzdDLElBQUksQ0FBQyxhQUFhLEVBQUU7Z0JBQ2xCLE9BQU87YUFDUjtZQUNELElBQUksQ0FBQyxNQUFNLENBQ0osYUFBYSxTQUFNLEVBQUUseURBQXlEO2dCQUM3RSxtRkFBbUY7Z0JBQ25GLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQztRQUNwQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsU0FBUyxrQkFBa0I7UUFDekIsT0FBTyxVQUFDLElBQVUsRUFBRSxPQUF5QjtZQUMzQyxJQUFNLFlBQVksR0FBRyxlQUFlLENBQUM7WUFDckMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLEVBQUU7Z0JBQzlCLE9BQU87YUFDUjtZQUNELElBQUksQ0FBQyxNQUFNLENBQ0osWUFBWSxTQUFNLEVBQUUsMERBQTBEO2dCQUM3RSxtRkFBbUY7Z0JBQ25GLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztRQUNuQyxDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQ7Ozs7OztPQU1HO0lBQ0gsU0FBUyxrQkFBa0I7UUFDekIsT0FBTyxVQUFDLElBQVUsRUFBRSxPQUF5QjtZQUMzQyxJQUFNLFlBQVksR0FBRyxlQUFlLENBQUM7WUFDckMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLEVBQUU7Z0JBQzlCLE9BQU8sSUFBSSxDQUFDO2FBQ2I7WUFDRCxJQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ3hELElBQUksQ0FBQyxVQUFVLEVBQUU7Z0JBQ2YsT0FBTyxJQUFJLENBQUM7YUFDYjtZQUNELElBQU0sT0FBTyxHQUFHLFVBQVUsQ0FBQyxRQUFRLEVBQUUsQ0FBQztZQUN0QyxJQUFNLEdBQUcsR0FBRyxtQkFBWSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ2xDLElBQUksQ0FBQyw0QkFBZSxDQUFDLEdBQUcsQ0FBQyxFQUFFO2dCQUN6QixPQUFPLElBQUksQ0FBQzthQUNiO1lBQ0QsSUFBTSxlQUFlLEdBQUcsb0NBQXVCLENBQUMsR0FBRyxFQUFFLGlCQUFpQixDQUFDLENBQUM7WUFDeEUsSUFBSSxDQUFDLDRCQUFlLENBQUMsZUFBZSxDQUFDLEVBQUU7Z0JBQ3JDLE9BQU8sSUFBSSxDQUFDO2FBQ2I7WUFDRCxJQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQ2hELHVFQUF1RTtZQUN2RSxlQUFlO1lBQ2Ysc0NBQXlCLENBQUMsUUFBUSxFQUFFLE9BQU8sRUFBRSxlQUFlLEVBQUUsUUFBUSxDQUFDLENBQUM7WUFDeEUsc0NBQXlCLENBQUMsUUFBUSxFQUFFLE9BQU8sRUFBRSxlQUFlLEVBQUUsUUFBUSxDQUFDLENBQUM7WUFDeEUseUVBQXlFO1lBQ3pFLFlBQVk7WUFDWixzQ0FBeUIsQ0FBQyxRQUFRLEVBQUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxXQUFXLENBQUMsQ0FBQztZQUMzRSw4REFBOEQ7WUFDOUQsc0NBQXlCLENBQUMsUUFBUSxFQUFFLE9BQU8sRUFBRSxlQUFlLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDekUsc0NBQXlCLENBQUMsUUFBUSxFQUFFLE9BQU8sRUFBRSxlQUFlLEVBQUUsU0FBUyxDQUFDLENBQUM7WUFDekUsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUM1QixPQUFPLElBQUksQ0FBQztRQUNkLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRDs7O09BR0c7SUFDSCxTQUFTLFdBQVc7UUFDbEIsT0FBTyxVQUFDLElBQVUsRUFBRSxPQUF5QjtZQUMzQyxJQUFNLFdBQVcsR0FBRyxjQUFjLENBQUM7WUFDbkMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLEVBQUU7Z0JBQzdCLE1BQU0sSUFBSSxLQUFLLENBQUMsb0JBQWtCLFdBQWEsQ0FBQyxDQUFDO2FBQ2xEO1lBQ0QsSUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUN2QyxJQUFJLENBQUMsT0FBTyxFQUFFO2dCQUNaLE1BQU0sSUFBSSxLQUFLLENBQUMscUNBQXFDLENBQUMsQ0FBQzthQUN4RDtZQUNELElBQU0sT0FBTyxHQUFHLG1CQUFZLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7WUFDakQsSUFBSSxDQUFDLDRCQUFlLENBQUMsT0FBTyxDQUFDLEVBQUU7Z0JBQzdCLE1BQU0sSUFBSSxLQUFLLENBQUMsOEJBQTRCLFdBQWEsQ0FBQyxDQUFDO2FBQzVEO1lBQ0QsSUFBTSxJQUFJLEdBQUcsb0NBQXVCLENBQUMsT0FBTyxFQUFFLGNBQWMsQ0FBQyxDQUFDO1lBQzlELElBQUksQ0FBQyw0QkFBZSxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUMxQixNQUFNLElBQUksS0FBSyxDQUFDLG9DQUFrQyxXQUFhLENBQUMsQ0FBQzthQUNsRTtZQUNELElBQU0sSUFBSSxHQUFHLG9DQUF1QixDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztZQUNuRCxJQUFJLENBQUMsSUFBSSxFQUFFO2dCQUNULE1BQU0sSUFBSSxLQUFLLENBQUMsNENBQTBDLFdBQWEsQ0FBQyxDQUFDO2FBQzFFO1lBQ0QsSUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQWUsQ0FBQyxDQUFFLGdDQUFnQztZQUNyRSxJQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDLHFCQUFxQixDQUFDLENBQUM7WUFDakQsSUFBSSxLQUFLLEVBQUU7Z0JBQ0gsSUFBQSw2QkFBeUIsRUFBeEIsU0FBQyxFQUFFLGFBQUssRUFBRSxhQUFjLENBQUM7Z0JBQ2hDLElBQUksS0FBSyxHQUFHLEdBQUcsSUFBSSxDQUFDLEtBQUssS0FBSyxHQUFHLElBQUksS0FBSyxHQUFHLEdBQUcsQ0FBQyxFQUFFO29CQUNqRCxJQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDO29CQUMvQyx1Q0FBMEIsQ0FBQyxRQUFRLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztvQkFDN0QsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQztpQkFDN0I7YUFDRjtpQkFBTTtnQkFDTCxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FDZix5Q0FBeUM7b0JBQ3pDLGtEQUFrRCxDQUFDLENBQUM7YUFDekQ7WUFDRCxPQUFPLElBQUksQ0FBQztRQUNkLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRDs7OztPQUlHO0lBQ0gsU0FBUyxtQ0FBbUM7UUFDMUMsT0FBTyxVQUFDLElBQVUsRUFBRSxPQUF5QjtZQUMzQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxnQ0FBZ0MsQ0FBQyxFQUFFO2dCQUNsRCxPQUFPO2FBQ1I7WUFDRCxJQUFNLFdBQVcsR0FBRyxjQUFjLENBQUM7WUFDbkMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLEVBQUU7Z0JBQzdCLE1BQU0sSUFBSSxLQUFLLENBQUMsb0JBQWtCLFdBQWEsQ0FBQyxDQUFDO2FBQ2xEO1lBQ0QsSUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUN2QyxJQUFJLENBQUMsT0FBTyxFQUFFO2dCQUNaLE1BQU0sSUFBSSxLQUFLLENBQUMscUNBQXFDLENBQUMsQ0FBQzthQUN4RDtZQUNELElBQU0sT0FBTyxHQUFHLG1CQUFZLENBQUMsT0FBTyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7WUFDakQsSUFBSSxDQUFDLDRCQUFlLENBQUMsT0FBTyxDQUFDLEVBQUU7Z0JBQzdCLE1BQU0sSUFBSSxLQUFLLENBQUMsOEJBQTRCLFdBQWEsQ0FBQyxDQUFDO2FBQzVEO1lBQ0QsSUFBTSxPQUFPLEdBQUcsb0NBQXVCLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBa0IsQ0FBQztZQUM3RSxJQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQy9DLElBQUksT0FBTyxFQUFFO2dCQUNYLDZDQUFnQyxDQUM1QixRQUFRLEVBQUUsT0FBTyxFQUFFLGFBQWEsRUFBRSx5Q0FBeUMsRUFBRSxDQUFDLENBQUMsQ0FBQzthQUNyRjtpQkFBTTtnQkFDTCw2Q0FBZ0MsQ0FDNUIsUUFBUSxFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQUU7b0JBQzVCLFdBQVcsRUFBRSx5Q0FBeUM7aUJBQ3ZELEVBQ0QsQ0FBQyxDQUFDLENBQUM7YUFDUjtZQUNELElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDNUIsT0FBTyxJQUFJLENBQUM7UUFDZCxDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQ7O09BRUc7SUFDSCxTQUFTLGtCQUFrQixDQUFDLE9BQWU7UUFDekMsT0FBTyxVQUFDLElBQVUsRUFBRSxPQUF5QjtZQUMzQyxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRTtnQkFDeEIsT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLDhCQUFzQixFQUFFLENBQUMsQ0FBQzthQUMvQztRQUNILENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRCxtQkFBd0IsT0FBZTtRQUNyQyxPQUFPLFVBQUMsSUFBVTtZQUNoQixnQ0FBbUIsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFbEMsT0FBTyxrQkFBSyxDQUFDO2dCQUNYLHVCQUF1QixDQUFDLE9BQU8sQ0FBQztnQkFDaEMsK0JBQStCLENBQUMsT0FBTyxDQUFDO2dCQUN4QyxtQ0FBbUMsRUFBRTtnQkFDckMsaUJBQWlCLEVBQUU7Z0JBQ25CLGtCQUFrQixFQUFFO2dCQUNwQixrQ0FBa0MsQ0FBQyxPQUFPLENBQUM7Z0JBQzNDLGVBQWUsRUFBRTtnQkFDakIsa0JBQWtCLEVBQUU7Z0JBQ3BCLFdBQVcsRUFBRTtnQkFDYixrQkFBa0IsQ0FBQyxPQUFPLENBQUM7YUFDNUIsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQWpCRCw0QkFpQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICpcbiAqIEBmaWxlb3ZlcnZpZXcgU2NoZW1hdGljcyBmb3IgbmctbmV3IHByb2plY3QgdGhhdCBidWlsZHMgd2l0aCBCYXplbC5cbiAqL1xuXG5pbXBvcnQge0pzb25Bc3RPYmplY3QsIHBhcnNlSnNvbkFzdH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHtSdWxlLCBTY2hlbWF0aWNDb250ZXh0LCBTY2hlbWF0aWNzRXhjZXB0aW9uLCBUcmVlLCBhcHBseSwgYXBwbHlUZW1wbGF0ZXMsIGNoYWluLCBtZXJnZVdpdGgsIHVybH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L3NjaGVtYXRpY3MnO1xuaW1wb3J0IHtOb2RlUGFja2FnZUluc3RhbGxUYXNrfSBmcm9tICdAYW5ndWxhci1kZXZraXQvc2NoZW1hdGljcy90YXNrcyc7XG5pbXBvcnQge2dldFdvcmtzcGFjZVBhdGh9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS9jb25maWcnO1xuaW1wb3J0IHtmaW5kUHJvcGVydHlJbkFzdE9iamVjdCwgaW5zZXJ0UHJvcGVydHlJbkFzdE9iamVjdEluT3JkZXJ9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS9qc29uLXV0aWxzJztcbmltcG9ydCB7dmFsaWRhdGVQcm9qZWN0TmFtZX0gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L3ZhbGlkYXRpb24nO1xuXG5pbXBvcnQge2lzSnNvbkFzdE9iamVjdCwgcmVtb3ZlS2V5VmFsdWVJbkFzdE9iamVjdCwgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3R9IGZyb20gJy4uL3V0aWxpdHkvanNvbi11dGlscyc7XG5pbXBvcnQge2ZpbmRFMmVBcmNoaXRlY3R9IGZyb20gJy4uL3V0aWxpdHkvd29ya3NwYWNlLXV0aWxzJztcblxuaW1wb3J0IHtTY2hlbWF9IGZyb20gJy4vc2NoZW1hJztcblxuXG4vKipcbiAqIFBhY2thZ2VzIHRoYXQgYnVpbGQgdW5kZXIgQmF6ZWwgcmVxdWlyZSBhZGRpdGlvbmFsIGRldiBkZXBlbmRlbmNpZXMuIFRoaXNcbiAqIGZ1bmN0aW9uIGFkZHMgdGhvc2UgZGVwZW5kZW5jaWVzIHRvIFwiZGV2RGVwZW5kZW5jaWVzXCIgc2VjdGlvbiBpblxuICogcGFja2FnZS5qc29uLlxuICovXG5mdW5jdGlvbiBhZGREZXZEZXBlbmRlbmNpZXNUb1BhY2thZ2VKc29uKG9wdGlvbnM6IFNjaGVtYSkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUpID0+IHtcbiAgICBjb25zdCBwYWNrYWdlSnNvbiA9ICdwYWNrYWdlLmpzb24nO1xuICAgIGlmICghaG9zdC5leGlzdHMocGFja2FnZUpzb24pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBmaW5kICR7cGFja2FnZUpzb259YCk7XG4gICAgfVxuICAgIGNvbnN0IHBhY2thZ2VKc29uQ29udGVudCA9IGhvc3QucmVhZChwYWNrYWdlSnNvbik7XG4gICAgaWYgKCFwYWNrYWdlSnNvbkNvbnRlbnQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIHJlYWQgcGFja2FnZS5qc29uIGNvbnRlbnQnKTtcbiAgICB9XG4gICAgY29uc3QganNvbkFzdCA9IHBhcnNlSnNvbkFzdChwYWNrYWdlSnNvbkNvbnRlbnQudG9TdHJpbmcoKSkgYXMgSnNvbkFzdE9iamVjdDtcbiAgICBjb25zdCBkZXBzID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoanNvbkFzdCwgJ2RlcGVuZGVuY2llcycpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgY29uc3QgZGV2RGVwcyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGpzb25Bc3QsICdkZXZEZXBlbmRlbmNpZXMnKSBhcyBKc29uQXN0T2JqZWN0O1xuXG4gICAgY29uc3QgYW5ndWxhckNvcmVOb2RlID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoZGVwcywgJ0Bhbmd1bGFyL2NvcmUnKTtcbiAgICBpZiAoIWFuZ3VsYXJDb3JlTm9kZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdAYW5ndWxhci9jb3JlIGRlcGVuZGVuY3kgbm90IGZvdW5kIGluIHBhY2thZ2UuanNvbicpO1xuICAgIH1cbiAgICBjb25zdCBhbmd1bGFyQ29yZVZlcnNpb24gPSBhbmd1bGFyQ29yZU5vZGUudmFsdWUgYXMgc3RyaW5nO1xuXG4gICAgY29uc3QgZGV2RGVwZW5kZW5jaWVzOiB7W2s6IHN0cmluZ106IHN0cmluZ30gPSB7XG4gICAgICAnQGFuZ3VsYXIvYmF6ZWwnOiBhbmd1bGFyQ29yZVZlcnNpb24sXG4gICAgICAnQGJhemVsL2JhemVsJzogJ14wLjI0LjAnLFxuICAgICAgJ0BiYXplbC9pYmF6ZWwnOiAnXjAuOS4wJyxcbiAgICAgICdAYmF6ZWwva2FybWEnOiAnMC4yNy4xMCcsXG4gICAgICAnQGJhemVsL3R5cGVzY3JpcHQnOiAnMC4yNy4xMCcsXG4gICAgfTtcblxuICAgIGNvbnN0IHJlY29yZGVyID0gaG9zdC5iZWdpblVwZGF0ZShwYWNrYWdlSnNvbik7XG4gICAgY29uc3QgZGVwc1RvSW5zdGFsbCA9IE9iamVjdC5rZXlzKGRldkRlcGVuZGVuY2llcykuZmlsdGVyKChuYW1lKSA9PiB7XG4gICAgICByZXR1cm4gIWZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGRldkRlcHMsIG5hbWUpO1xuICAgIH0pO1xuICAgIGZvciAoY29uc3QgcGFja2FnZU5hbWUgb2YgZGVwc1RvSW5zdGFsbCkge1xuICAgICAgY29uc3QgdmVyc2lvbiA9IGRldkRlcGVuZGVuY2llc1twYWNrYWdlTmFtZV07XG4gICAgICBjb25zdCBpbmRlbnQgPSA0O1xuICAgICAgaW5zZXJ0UHJvcGVydHlJbkFzdE9iamVjdEluT3JkZXIocmVjb3JkZXIsIGRldkRlcHMsIHBhY2thZ2VOYW1lLCB2ZXJzaW9uLCBpbmRlbnQpO1xuICAgIH1cbiAgICBob3N0LmNvbW1pdFVwZGF0ZShyZWNvcmRlcik7XG4gICAgcmV0dXJuIGhvc3Q7XG4gIH07XG59XG5cbi8qKlxuICogQXBwZW5kIGFkZGl0aW9uYWwgSmF2YXNjcmlwdCAvIFR5cGVzY3JpcHQgZmlsZXMgbmVlZGVkIHRvIGNvbXBpbGUgYW4gQW5ndWxhclxuICogcHJvamVjdCB1bmRlciBCYXplbC5cbiAqL1xuZnVuY3Rpb24gYWRkRmlsZXNSZXF1aXJlZEJ5QmF6ZWwob3B0aW9uczogU2NoZW1hKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIHJldHVybiBtZXJnZVdpdGgoYXBwbHkodXJsKCcuL2ZpbGVzJyksIFtcbiAgICAgIGFwcGx5VGVtcGxhdGVzKHt9KSxcbiAgICBdKSk7XG4gIH07XG59XG5cbi8qKlxuICogQXBwZW5kICcvYmF6ZWwtb3V0JyB0byB0aGUgZ2l0aWdub3JlIGZpbGUuXG4gKi9cbmZ1bmN0aW9uIHVwZGF0ZUdpdGlnbm9yZSgpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgY29uc3QgZ2l0aWdub3JlID0gJy8uZ2l0aWdub3JlJztcbiAgICBpZiAoIWhvc3QuZXhpc3RzKGdpdGlnbm9yZSkpIHtcbiAgICAgIHJldHVybiBob3N0O1xuICAgIH1cbiAgICBjb25zdCBnaXRJZ25vcmVDb250ZW50UmF3ID0gaG9zdC5yZWFkKGdpdGlnbm9yZSk7XG4gICAgaWYgKCFnaXRJZ25vcmVDb250ZW50UmF3KSB7XG4gICAgICByZXR1cm4gaG9zdDtcbiAgICB9XG4gICAgY29uc3QgZ2l0SWdub3JlQ29udGVudCA9IGdpdElnbm9yZUNvbnRlbnRSYXcudG9TdHJpbmcoKTtcbiAgICBpZiAoZ2l0SWdub3JlQ29udGVudC5pbmNsdWRlcygnXFxuL2JhemVsLW91dFxcbicpKSB7XG4gICAgICByZXR1cm4gaG9zdDtcbiAgICB9XG4gICAgY29uc3QgY29tcGlsZWRPdXRwdXQgPSAnIyBjb21waWxlZCBvdXRwdXRcXG4nO1xuICAgIGNvbnN0IGluZGV4ID0gZ2l0SWdub3JlQ29udGVudC5pbmRleE9mKGNvbXBpbGVkT3V0cHV0KTtcbiAgICBjb25zdCBpbnNlcnRpb25JbmRleCA9IGluZGV4ID49IDAgPyBpbmRleCArIGNvbXBpbGVkT3V0cHV0Lmxlbmd0aCA6IGdpdElnbm9yZUNvbnRlbnQubGVuZ3RoO1xuICAgIGNvbnN0IHJlY29yZGVyID0gaG9zdC5iZWdpblVwZGF0ZShnaXRpZ25vcmUpO1xuICAgIHJlY29yZGVyLmluc2VydFJpZ2h0KGluc2VydGlvbkluZGV4LCAnL2JhemVsLW91dFxcbicpO1xuICAgIGhvc3QuY29tbWl0VXBkYXRlKHJlY29yZGVyKTtcbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuLyoqXG4gKiBDaGFuZ2UgdGhlIGFyY2hpdGVjdCBpbiBhbmd1bGFyLmpzb24gdG8gdXNlIEJhemVsIGJ1aWxkZXIuXG4gKi9cbmZ1bmN0aW9uIHVwZGF0ZUFuZ3VsYXJKc29uVG9Vc2VCYXplbEJ1aWxkZXIob3B0aW9uczogU2NoZW1hKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSwgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCkgPT4ge1xuICAgIGNvbnN0IHtuYW1lfSA9IG9wdGlvbnM7XG4gICAgY29uc3Qgd29ya3NwYWNlUGF0aCA9IGdldFdvcmtzcGFjZVBhdGgoaG9zdCk7XG4gICAgaWYgKCF3b3Jrc3BhY2VQYXRoKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIGFuZ3VsYXIuanNvbicpO1xuICAgIH1cbiAgICBjb25zdCB3b3Jrc3BhY2VDb250ZW50ID0gaG9zdC5yZWFkKHdvcmtzcGFjZVBhdGgpO1xuICAgIGlmICghd29ya3NwYWNlQ29udGVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gcmVhZCBhbmd1bGFyLmpzb24gY29udGVudCcpO1xuICAgIH1cbiAgICBjb25zdCB3b3Jrc3BhY2VKc29uQXN0ID0gcGFyc2VKc29uQXN0KHdvcmtzcGFjZUNvbnRlbnQudG9TdHJpbmcoKSkgYXMgSnNvbkFzdE9iamVjdDtcbiAgICBjb25zdCBwcm9qZWN0cyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KHdvcmtzcGFjZUpzb25Bc3QsICdwcm9qZWN0cycpO1xuICAgIGlmICghcHJvamVjdHMpIHtcbiAgICAgIHRocm93IG5ldyBTY2hlbWF0aWNzRXhjZXB0aW9uKCdFeHBlY3QgcHJvamVjdHMgaW4gYW5ndWxhci5qc29uIHRvIGJlIGFuIE9iamVjdCcpO1xuICAgIH1cbiAgICBjb25zdCBwcm9qZWN0ID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QocHJvamVjdHMgYXMgSnNvbkFzdE9iamVjdCwgbmFtZSk7XG4gICAgaWYgKCFwcm9qZWN0KSB7XG4gICAgICB0aHJvdyBuZXcgU2NoZW1hdGljc0V4Y2VwdGlvbihgRXhwZWN0ZWQgcHJvamVjdHMgdG8gY29udGFpbiAke25hbWV9YCk7XG4gICAgfVxuICAgIGNvbnN0IHJlY29yZGVyID0gaG9zdC5iZWdpblVwZGF0ZSh3b3Jrc3BhY2VQYXRoKTtcbiAgICBjb25zdCBpbmRlbnQgPSA4O1xuICAgIGNvbnN0IGFyY2hpdGVjdCA9XG4gICAgICAgIGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KHByb2plY3QgYXMgSnNvbkFzdE9iamVjdCwgJ2FyY2hpdGVjdCcpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QoXG4gICAgICAgIHJlY29yZGVyLCBhcmNoaXRlY3QsICdidWlsZCcsIHtcbiAgICAgICAgICBidWlsZGVyOiAnQGFuZ3VsYXIvYmF6ZWw6YnVpbGQnLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIHRhcmdldExhYmVsOiAnLy9zcmM6cHJvZGFwcCcsXG4gICAgICAgICAgICBiYXplbENvbW1hbmQ6ICdidWlsZCcsXG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBpbmRlbnQpO1xuICAgIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0KFxuICAgICAgICByZWNvcmRlciwgYXJjaGl0ZWN0LCAnc2VydmUnLCB7XG4gICAgICAgICAgYnVpbGRlcjogJ0Bhbmd1bGFyL2JhemVsOmJ1aWxkJyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vc3JjOmRldnNlcnZlcicsXG4gICAgICAgICAgICBiYXplbENvbW1hbmQ6ICdydW4nLFxuICAgICAgICAgICAgd2F0Y2g6IHRydWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBjb25maWd1cmF0aW9uczoge1xuICAgICAgICAgICAgcHJvZHVjdGlvbjoge1xuICAgICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vc3JjOnByb2RzZXJ2ZXInLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBpbmRlbnQpO1xuXG4gICAgaWYgKGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGFyY2hpdGVjdCwgJ3Rlc3QnKSkge1xuICAgICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QoXG4gICAgICAgICAgcmVjb3JkZXIsIGFyY2hpdGVjdCwgJ3Rlc3QnLCB7XG4gICAgICAgICAgICBidWlsZGVyOiAnQGFuZ3VsYXIvYmF6ZWw6YnVpbGQnLFxuICAgICAgICAgICAgb3B0aW9uczogeydiYXplbENvbW1hbmQnOiAndGVzdCcsICd0YXJnZXRMYWJlbCc6ICcvL3NyYy8uLi4nfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGluZGVudCk7XG4gICAgfVxuXG4gICAgY29uc3QgZTJlQXJjaGl0ZWN0ID0gZmluZEUyZUFyY2hpdGVjdCh3b3Jrc3BhY2VKc29uQXN0LCBuYW1lKTtcbiAgICBpZiAoZTJlQXJjaGl0ZWN0ICYmIGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGUyZUFyY2hpdGVjdCwgJ2UyZScpKSB7XG4gICAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChcbiAgICAgICAgICByZWNvcmRlciwgZTJlQXJjaGl0ZWN0LCAnZTJlJywge1xuICAgICAgICAgICAgYnVpbGRlcjogJ0Bhbmd1bGFyL2JhemVsOmJ1aWxkJyxcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgYmF6ZWxDb21tYW5kOiAndGVzdCcsXG4gICAgICAgICAgICAgIHRhcmdldExhYmVsOiAnLy9lMmU6ZGV2c2VydmVyX3Rlc3QnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYXRpb25zOiB7XG4gICAgICAgICAgICAgIHByb2R1Y3Rpb246IHtcbiAgICAgICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vZTJlOnByb2RzZXJ2ZXJfdGVzdCcsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICBpbmRlbnQpO1xuICAgIH1cblxuICAgIGhvc3QuY29tbWl0VXBkYXRlKHJlY29yZGVyKTtcbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBiYWNrdXAgZm9yIHRoZSBvcmlnaW5hbCBhbmd1bGFyLmpzb24gZmlsZSBpbiBjYXNlIHVzZXIgd2FudHMgdG9cbiAqIGVqZWN0IEJhemVsIGFuZCByZXZlcnQgdG8gdGhlIG9yaWdpbmFsIHdvcmtmbG93LlxuICovXG5mdW5jdGlvbiBiYWNrdXBBbmd1bGFySnNvbigpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgY29uc3Qgd29ya3NwYWNlUGF0aCA9IGdldFdvcmtzcGFjZVBhdGgoaG9zdCk7XG4gICAgaWYgKCF3b3Jrc3BhY2VQYXRoKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGhvc3QuY3JlYXRlKFxuICAgICAgICBgJHt3b3Jrc3BhY2VQYXRofS5iYWtgLCAnLy8gVGhpcyBpcyBhIGJhY2t1cCBmaWxlIG9mIHRoZSBvcmlnaW5hbCBhbmd1bGFyLmpzb24uICcgK1xuICAgICAgICAgICAgJ1RoaXMgZmlsZSBpcyBuZWVkZWQgaW4gY2FzZSB5b3Ugd2FudCB0byByZXZlcnQgdG8gdGhlIHdvcmtmbG93IHdpdGhvdXQgQmF6ZWwuXFxuXFxuJyArXG4gICAgICAgICAgICBob3N0LnJlYWQod29ya3NwYWNlUGF0aCkpO1xuICB9O1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIGJhY2t1cCBmb3IgdGhlIG9yaWdpbmFsIHRzY29uZmlnLmpzb24gZmlsZSBpbiBjYXNlIHVzZXIgd2FudHMgdG9cbiAqIGVqZWN0IEJhemVsIGFuZCByZXZlcnQgdG8gdGhlIG9yaWdpbmFsIHdvcmtmbG93LlxuICovXG5mdW5jdGlvbiBiYWNrdXBUc2NvbmZpZ0pzb24oKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSwgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCkgPT4ge1xuICAgIGNvbnN0IHRzY29uZmlnUGF0aCA9ICd0c2NvbmZpZy5qc29uJztcbiAgICBpZiAoIWhvc3QuZXhpc3RzKHRzY29uZmlnUGF0aCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaG9zdC5jcmVhdGUoXG4gICAgICAgIGAke3RzY29uZmlnUGF0aH0uYmFrYCwgJy8vIFRoaXMgaXMgYSBiYWNrdXAgZmlsZSBvZiB0aGUgb3JpZ2luYWwgdHNjb25maWcuanNvbi4gJyArXG4gICAgICAgICAgICAnVGhpcyBmaWxlIGlzIG5lZWRlZCBpbiBjYXNlIHlvdSB3YW50IHRvIHJldmVydCB0byB0aGUgd29ya2Zsb3cgd2l0aG91dCBCYXplbC5cXG5cXG4nICtcbiAgICAgICAgICAgIGhvc3QucmVhZCh0c2NvbmZpZ1BhdGgpKTtcbiAgfTtcbn1cblxuLyoqXG4gKiBCYXplbCBjb250cm9scyB0aGUgY29tcGlsYXRpb24gb3B0aW9ucyBvZiB0c2MsIHNvIG1hbnkgb3B0aW9ucyBpblxuICogdHNjb25maWcuanNvbiBnZW5lcmF0ZWQgYnkgdGhlIGRlZmF1bHQgQ0xJIHNjaGVtYXRpY3MgYXJlIG5vdCBhcHBsaWNhYmxlLlxuICogVGhpcyBmdW5jdGlvbiB1cGRhdGVzIHRoZSB0c2NvbmZpZy5qc29uIHRvIHJlbW92ZSBCYXplbC1jb250cm9sbGVkXG4gKiBwYXJhbWV0ZXJzLiBUaGlzIHByZXZlbnRzIEJhemVsIGZyb20gcHJpbnRpbmcgb3V0IHdhcm5pbmdzIGFib3V0IG92ZXJyaWRlblxuICogc2V0dGluZ3MuXG4gKi9cbmZ1bmN0aW9uIHVwZGF0ZVRzY29uZmlnSnNvbigpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgY29uc3QgdHNjb25maWdQYXRoID0gJ3RzY29uZmlnLmpzb24nO1xuICAgIGlmICghaG9zdC5leGlzdHModHNjb25maWdQYXRoKSkge1xuICAgICAgcmV0dXJuIGhvc3Q7XG4gICAgfVxuICAgIGNvbnN0IGNvbnRlbnRSYXcgPSBob3N0LnJlYWQodHNjb25maWdQYXRoKSAhLnRvU3RyaW5nKCk7XG4gICAgaWYgKCFjb250ZW50UmF3KSB7XG4gICAgICByZXR1cm4gaG9zdDtcbiAgICB9XG4gICAgY29uc3QgY29udGVudCA9IGNvbnRlbnRSYXcudG9TdHJpbmcoKTtcbiAgICBjb25zdCBhc3QgPSBwYXJzZUpzb25Bc3QoY29udGVudCk7XG4gICAgaWYgKCFpc0pzb25Bc3RPYmplY3QoYXN0KSkge1xuICAgICAgcmV0dXJuIGhvc3Q7XG4gICAgfVxuICAgIGNvbnN0IGNvbXBpbGVyT3B0aW9ucyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGFzdCwgJ2NvbXBpbGVyT3B0aW9ucycpO1xuICAgIGlmICghaXNKc29uQXN0T2JqZWN0KGNvbXBpbGVyT3B0aW9ucykpIHtcbiAgICAgIHJldHVybiBob3N0O1xuICAgIH1cbiAgICBjb25zdCByZWNvcmRlciA9IGhvc3QuYmVnaW5VcGRhdGUodHNjb25maWdQYXRoKTtcbiAgICAvLyB0YXJnZXQgYW5kIG1vZHVsZSBhcmUgY29udHJvbGxlZCBieSBkb3duc3RyZWFtIGRlcGVuZGVuY2llcywgc3VjaCBhc1xuICAgIC8vIHRzX2RldnNlcnZlclxuICAgIHJlbW92ZUtleVZhbHVlSW5Bc3RPYmplY3QocmVjb3JkZXIsIGNvbnRlbnQsIGNvbXBpbGVyT3B0aW9ucywgJ3RhcmdldCcpO1xuICAgIHJlbW92ZUtleVZhbHVlSW5Bc3RPYmplY3QocmVjb3JkZXIsIGNvbnRlbnQsIGNvbXBpbGVyT3B0aW9ucywgJ21vZHVsZScpO1xuICAgIC8vIHR5cGVSb290cyBpcyBhbHdheXMgc2V0IHRvIHRoZSBAdHlwZXMgc3ViZGlyZWN0b3J5IG9mIHRoZSBub2RlX21vZHVsZXNcbiAgICAvLyBhdHRyaWJ1dGVcbiAgICByZW1vdmVLZXlWYWx1ZUluQXN0T2JqZWN0KHJlY29yZGVyLCBjb250ZW50LCBjb21waWxlck9wdGlvbnMsICd0eXBlUm9vdHMnKTtcbiAgICAvLyByb290RGlyIGFuZCBiYXNlVXJsIGFyZSBhbHdheXMgdGhlIHdvcmtzcGFjZSByb290IGRpcmVjdG9yeVxuICAgIHJlbW92ZUtleVZhbHVlSW5Bc3RPYmplY3QocmVjb3JkZXIsIGNvbnRlbnQsIGNvbXBpbGVyT3B0aW9ucywgJ3Jvb3REaXInKTtcbiAgICByZW1vdmVLZXlWYWx1ZUluQXN0T2JqZWN0KHJlY29yZGVyLCBjb250ZW50LCBjb21waWxlck9wdGlvbnMsICdiYXNlVXJsJyk7XG4gICAgaG9zdC5jb21taXRVcGRhdGUocmVjb3JkZXIpO1xuICAgIHJldHVybiBob3N0O1xuICB9O1xufVxuXG4vKipcbiAqIEBhbmd1bGFyL2JhemVsIHJlcXVpcmVzIG1pbmltdW0gdmVyc2lvbiBvZiByeGpzIHRvIGJlIDYuNC4wLiBUaGlzIGZ1bmN0aW9uXG4gKiB1cGdyYWRlcyB0aGUgdmVyc2lvbiBvZiByeGpzIGluIHBhY2thZ2UuanNvbiBpZiBuZWNlc3NhcnkuXG4gKi9cbmZ1bmN0aW9uIHVwZ3JhZGVSeGpzKCkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBjb25zdCBwYWNrYWdlSnNvbiA9ICdwYWNrYWdlLmpzb24nO1xuICAgIGlmICghaG9zdC5leGlzdHMocGFja2FnZUpzb24pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBmaW5kICR7cGFja2FnZUpzb259YCk7XG4gICAgfVxuICAgIGNvbnN0IGNvbnRlbnQgPSBob3N0LnJlYWQocGFja2FnZUpzb24pO1xuICAgIGlmICghY29udGVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gcmVhZCBwYWNrYWdlLmpzb24gY29udGVudCcpO1xuICAgIH1cbiAgICBjb25zdCBqc29uQXN0ID0gcGFyc2VKc29uQXN0KGNvbnRlbnQudG9TdHJpbmcoKSk7XG4gICAgaWYgKCFpc0pzb25Bc3RPYmplY3QoanNvbkFzdCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIHBhcnNlIEpTT04gZm9yICR7cGFja2FnZUpzb259YCk7XG4gICAgfVxuICAgIGNvbnN0IGRlcHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChqc29uQXN0LCAnZGVwZW5kZW5jaWVzJyk7XG4gICAgaWYgKCFpc0pzb25Bc3RPYmplY3QoZGVwcykpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGZpbmQgZGVwZW5kZW5jaWVzIGluICR7cGFja2FnZUpzb259YCk7XG4gICAgfVxuICAgIGNvbnN0IHJ4anMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChkZXBzLCAncnhqcycpO1xuICAgIGlmICghcnhqcykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gZmluZCByeGpzIGluIGRlcGVuZGVuY2llcyBvZiAke3BhY2thZ2VKc29ufWApO1xuICAgIH1cbiAgICBjb25zdCB2YWx1ZSA9IHJ4anMudmFsdWUgYXMgc3RyaW5nOyAgLy8gdmFsdWUgY2FuIGJlIHZlcnNpb24gb3IgcmFuZ2VcbiAgICBjb25zdCBtYXRjaCA9IHZhbHVlLm1hdGNoKC8oXFxkKStcXC4oXFxkKSsuKFxcZCkrJC8pO1xuICAgIGlmIChtYXRjaCkge1xuICAgICAgY29uc3QgW18sIG1ham9yLCBtaW5vcl0gPSBtYXRjaDtcbiAgICAgIGlmIChtYWpvciA8ICc2JyB8fCAobWFqb3IgPT09ICc2JyAmJiBtaW5vciA8ICc0JykpIHtcbiAgICAgICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKHBhY2thZ2VKc29uKTtcbiAgICAgICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QocmVjb3JkZXIsIGRlcHMsICdyeGpzJywgJ342LjQuMCcpO1xuICAgICAgICBob3N0LmNvbW1pdFVwZGF0ZShyZWNvcmRlcik7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnRleHQubG9nZ2VyLmluZm8oXG4gICAgICAgICAgJ0NvdWxkIG5vdCBkZXRlcm1pbmUgdmVyc2lvbiBvZiByeGpzLiBcXG4nICtcbiAgICAgICAgICAnUGxlYXNlIG1ha2Ugc3VyZSB0aGF0IHZlcnNpb24gaXMgYXQgbGVhc3QgNi40LjAuJyk7XG4gICAgfVxuICAgIHJldHVybiBob3N0O1xuICB9O1xufVxuXG4vKipcbiAqIFdoZW4gdXNpbmcgQW5ndWxhciBOUE0gcGFja2FnZXMgYW5kIGJ1aWxkaW5nIHdpdGggQU9UIGNvbXBpbGF0aW9uLCBuZ2NcbiAqIHJlcXVpcmVzIG5nc3VtYW1yeSBmaWxlcyBidXQgdGhleSBhcmUgbm90IHNoaXBwZWQuIFRoaXMgZnVuY3Rpb24gYWRkcyBhXG4gKiBwb3N0aW5zdGFsbCBzdGVwIHRvIGdlbmVyYXRlIHRoZXNlIGZpbGVzLlxuICovXG5mdW5jdGlvbiBhZGRQb3N0aW5zdGFsbFRvR2VuZXJhdGVOZ1N1bW1hcmllcygpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgaWYgKCFob3N0LmV4aXN0cygnYW5ndWxhci1tZXRhZGF0YS50c2NvbmZpZy5qc29uJykpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgY29uc3QgcGFja2FnZUpzb24gPSAncGFja2FnZS5qc29uJztcbiAgICBpZiAoIWhvc3QuZXhpc3RzKHBhY2thZ2VKc29uKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgZmluZCAke3BhY2thZ2VKc29ufWApO1xuICAgIH1cbiAgICBjb25zdCBjb250ZW50ID0gaG9zdC5yZWFkKHBhY2thZ2VKc29uKTtcbiAgICBpZiAoIWNvbnRlbnQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIHJlYWQgcGFja2FnZS5qc29uIGNvbnRlbnQnKTtcbiAgICB9XG4gICAgY29uc3QganNvbkFzdCA9IHBhcnNlSnNvbkFzdChjb250ZW50LnRvU3RyaW5nKCkpO1xuICAgIGlmICghaXNKc29uQXN0T2JqZWN0KGpzb25Bc3QpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBwYXJzZSBKU09OIGZvciAke3BhY2thZ2VKc29ufWApO1xuICAgIH1cbiAgICBjb25zdCBzY3JpcHRzID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoanNvbkFzdCwgJ3NjcmlwdHMnKSBhcyBKc29uQXN0T2JqZWN0O1xuICAgIGNvbnN0IHJlY29yZGVyID0gaG9zdC5iZWdpblVwZGF0ZShwYWNrYWdlSnNvbik7XG4gICAgaWYgKHNjcmlwdHMpIHtcbiAgICAgIGluc2VydFByb3BlcnR5SW5Bc3RPYmplY3RJbk9yZGVyKFxuICAgICAgICAgIHJlY29yZGVyLCBzY3JpcHRzLCAncG9zdGluc3RhbGwnLCAnbmdjIC1wIC4vYW5ndWxhci1tZXRhZGF0YS50c2NvbmZpZy5qc29uJywgNCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGluc2VydFByb3BlcnR5SW5Bc3RPYmplY3RJbk9yZGVyKFxuICAgICAgICAgIHJlY29yZGVyLCBqc29uQXN0LCAnc2NyaXB0cycsIHtcbiAgICAgICAgICAgIHBvc3RpbnN0YWxsOiAnbmdjIC1wIC4vYW5ndWxhci1tZXRhZGF0YS50c2NvbmZpZy5qc29uJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIDIpO1xuICAgIH1cbiAgICBob3N0LmNvbW1pdFVwZGF0ZShyZWNvcmRlcik7XG4gICAgcmV0dXJuIGhvc3Q7XG4gIH07XG59XG5cbi8qKlxuICogU2NoZWR1bGUgYSB0YXNrIHRvIHBlcmZvcm0gbnBtIC8geWFybiBpbnN0YWxsLlxuICovXG5mdW5jdGlvbiBpbnN0YWxsTm9kZU1vZHVsZXMob3B0aW9uczogU2NoZW1hKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSwgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCkgPT4ge1xuICAgIGlmICghb3B0aW9ucy5za2lwSW5zdGFsbCkge1xuICAgICAgY29udGV4dC5hZGRUYXNrKG5ldyBOb2RlUGFja2FnZUluc3RhbGxUYXNrKCkpO1xuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24ob3B0aW9uczogU2NoZW1hKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIHZhbGlkYXRlUHJvamVjdE5hbWUob3B0aW9ucy5uYW1lKTtcblxuICAgIHJldHVybiBjaGFpbihbXG4gICAgICBhZGRGaWxlc1JlcXVpcmVkQnlCYXplbChvcHRpb25zKSxcbiAgICAgIGFkZERldkRlcGVuZGVuY2llc1RvUGFja2FnZUpzb24ob3B0aW9ucyksXG4gICAgICBhZGRQb3N0aW5zdGFsbFRvR2VuZXJhdGVOZ1N1bW1hcmllcygpLFxuICAgICAgYmFja3VwQW5ndWxhckpzb24oKSxcbiAgICAgIGJhY2t1cFRzY29uZmlnSnNvbigpLFxuICAgICAgdXBkYXRlQW5ndWxhckpzb25Ub1VzZUJhemVsQnVpbGRlcihvcHRpb25zKSxcbiAgICAgIHVwZGF0ZUdpdGlnbm9yZSgpLFxuICAgICAgdXBkYXRlVHNjb25maWdKc29uKCksXG4gICAgICB1cGdyYWRlUnhqcygpLFxuICAgICAgaW5zdGFsbE5vZGVNb2R1bGVzKG9wdGlvbnMpLFxuICAgIF0pO1xuICB9O1xufVxuIl19
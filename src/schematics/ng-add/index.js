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
                '@bazel/bazel': '^0.23.0',
                '@bazel/ibazel': '^0.9.0',
                '@bazel/karma': '^0.27.4',
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvc2NoZW1hdGljcy9uZy1hZGQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCw2Q0FBMEU7SUFDMUUseURBQTRKO0lBQzVKLDZEQUFvRTtJQUNwRSxxRUFBaUg7SUFDakgscUVBQTJFO0lBQzNFLCtFQUE2RztJQUc3Rzs7OztPQUlHO0lBQ0gsU0FBUywrQkFBK0IsQ0FBQyxPQUFlO1FBQ3RELE9BQU8sVUFBQyxJQUFVOztZQUNoQixJQUFNLFdBQVcsR0FBRyxjQUFjLENBQUM7WUFDbkMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLEVBQUU7Z0JBQzdCLE1BQU0sSUFBSSxLQUFLLENBQUMsb0JBQWtCLFdBQWEsQ0FBQyxDQUFDO2FBQ2xEO1lBQ0QsSUFBTSxrQkFBa0IsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQ2xELElBQUksQ0FBQyxrQkFBa0IsRUFBRTtnQkFDdkIsTUFBTSxJQUFJLEtBQUssQ0FBQyxxQ0FBcUMsQ0FBQyxDQUFDO2FBQ3hEO1lBQ0QsSUFBTSxPQUFPLEdBQUcsbUJBQVksQ0FBQyxrQkFBa0IsQ0FBQyxRQUFRLEVBQUUsQ0FBa0IsQ0FBQztZQUM3RSxJQUFNLElBQUksR0FBRyxvQ0FBdUIsQ0FBQyxPQUFPLEVBQUUsY0FBYyxDQUFrQixDQUFDO1lBQy9FLElBQU0sT0FBTyxHQUFHLG9DQUF1QixDQUFDLE9BQU8sRUFBRSxpQkFBaUIsQ0FBa0IsQ0FBQztZQUVyRixJQUFNLGVBQWUsR0FBRyxvQ0FBdUIsQ0FBQyxJQUFJLEVBQUUsZUFBZSxDQUFDLENBQUM7WUFDdkUsSUFBSSxDQUFDLGVBQWUsRUFBRTtnQkFDcEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxvREFBb0QsQ0FBQyxDQUFDO2FBQ3ZFO1lBQ0QsSUFBTSxrQkFBa0IsR0FBRyxlQUFlLENBQUMsS0FBZSxDQUFDO1lBRTNELElBQU0sZUFBZSxHQUEwQjtnQkFDN0MsZ0JBQWdCLEVBQUUsa0JBQWtCO2dCQUNwQyxjQUFjLEVBQUUsU0FBUztnQkFDekIsZUFBZSxFQUFFLFFBQVE7Z0JBQ3pCLGNBQWMsRUFBRSxTQUFTO2FBQzFCLENBQUM7WUFFRixJQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxDQUFDOztnQkFDL0MsS0FBMEIsSUFBQSxLQUFBLGlCQUFBLE1BQU0sQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUEsZ0JBQUEsNEJBQUU7b0JBQW5ELElBQU0sV0FBVyxXQUFBO29CQUNwQixJQUFNLE9BQU8sR0FBRyxlQUFlLENBQUMsV0FBVyxDQUFDLENBQUM7b0JBQzdDLElBQU0sTUFBTSxHQUFHLENBQUMsQ0FBQztvQkFDakIsNkNBQWdDLENBQUMsUUFBUSxFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxDQUFDO2lCQUNuRjs7Ozs7Ozs7O1lBQ0QsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUM1QixPQUFPLElBQUksQ0FBQztRQUNkLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRDs7O09BR0c7SUFDSCxTQUFTLHVCQUF1QixDQUFDLE9BQWU7UUFDOUMsT0FBTyxVQUFDLElBQVU7WUFDaEIsT0FBTyxzQkFBUyxDQUFDLGtCQUFLLENBQUMsZ0JBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRTtnQkFDckMsMkJBQWMsQ0FBQyxFQUFFLENBQUM7YUFDbkIsQ0FBQyxDQUFDLENBQUM7UUFDTixDQUFDLENBQUM7SUFDSixDQUFDO0lBRUQ7O09BRUc7SUFDSCxTQUFTLGVBQWU7UUFDdEIsT0FBTyxVQUFDLElBQVU7WUFDaEIsSUFBTSxTQUFTLEdBQUcsYUFBYSxDQUFDO1lBQ2hDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxFQUFFO2dCQUMzQixPQUFPLElBQUksQ0FBQzthQUNiO1lBQ0QsSUFBTSxtQkFBbUIsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBQ2pELElBQUksQ0FBQyxtQkFBbUIsRUFBRTtnQkFDeEIsT0FBTyxJQUFJLENBQUM7YUFDYjtZQUNELElBQU0sZ0JBQWdCLEdBQUcsbUJBQW1CLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDeEQsSUFBSSxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsRUFBRTtnQkFDL0MsT0FBTyxJQUFJLENBQUM7YUFDYjtZQUNELElBQU0sY0FBYyxHQUFHLHFCQUFxQixDQUFDO1lBQzdDLElBQU0sS0FBSyxHQUFHLGdCQUFnQixDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQztZQUN2RCxJQUFNLGNBQWMsR0FBRyxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLEdBQUcsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsZ0JBQWdCLENBQUMsTUFBTSxDQUFDO1lBQzVGLElBQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDN0MsUUFBUSxDQUFDLFdBQVcsQ0FBQyxjQUFjLEVBQUUsY0FBYyxDQUFDLENBQUM7WUFDckQsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUM1QixPQUFPLElBQUksQ0FBQztRQUNkLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRCxTQUFTLGtDQUFrQyxDQUFDLE9BQWU7UUFDekQsT0FBTyxVQUFDLElBQVUsRUFBRSxPQUF5QjtZQUNwQyxJQUFBLG1CQUFJLENBQVk7WUFDdkIsSUFBTSxhQUFhLEdBQUcseUJBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDN0MsSUFBSSxDQUFDLGFBQWEsRUFBRTtnQkFDbEIsTUFBTSxJQUFJLEtBQUssQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDO2FBQ2hEO1lBQ0QsSUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1lBQ2xELElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtnQkFDckIsTUFBTSxJQUFJLEtBQUssQ0FBQyxxQ0FBcUMsQ0FBQyxDQUFDO2FBQ3hEO1lBQ0QsSUFBTSxnQkFBZ0IsR0FBRyxtQkFBWSxDQUFDLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxDQUFrQixDQUFDO1lBQ3BGLElBQU0sUUFBUSxHQUFHLG9DQUF1QixDQUFDLGdCQUFnQixFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBQ3ZFLElBQUksQ0FBQyxRQUFRLEVBQUU7Z0JBQ2IsTUFBTSxJQUFJLGdDQUFtQixDQUFDLGlEQUFpRCxDQUFDLENBQUM7YUFDbEY7WUFDRCxJQUFNLE9BQU8sR0FBRyxvQ0FBdUIsQ0FBQyxRQUF5QixFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3pFLElBQUksQ0FBQyxPQUFPLEVBQUU7Z0JBQ1osTUFBTSxJQUFJLGdDQUFtQixDQUFDLGtDQUFnQyxJQUFNLENBQUMsQ0FBQzthQUN2RTtZQUNELElBQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsYUFBYSxDQUFDLENBQUM7WUFDakQsSUFBTSxNQUFNLEdBQUcsQ0FBQyxDQUFDO1lBQ2pCLElBQU0sU0FBUyxHQUNYLG9DQUF1QixDQUFDLE9BQXdCLEVBQUUsV0FBVyxDQUFrQixDQUFDO1lBQ3BGLHVDQUEwQixDQUN0QixRQUFRLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRTtnQkFDNUIsT0FBTyxFQUFFLHNCQUFzQjtnQkFDL0IsT0FBTyxFQUFFO29CQUNQLFdBQVcsRUFBRSxlQUFlO29CQUM1QixZQUFZLEVBQUUsT0FBTztpQkFDdEI7YUFDRixFQUNELE1BQU0sQ0FBQyxDQUFDO1lBQ1osdUNBQTBCLENBQ3RCLFFBQVEsRUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFO2dCQUM1QixPQUFPLEVBQUUsc0JBQXNCO2dCQUMvQixPQUFPLEVBQUU7b0JBQ1AsV0FBVyxFQUFFLGlCQUFpQjtvQkFDOUIsWUFBWSxFQUFFLEtBQUs7b0JBQ25CLEtBQUssRUFBRSxJQUFJO2lCQUNaO2dCQUNELGNBQWMsRUFBRTtvQkFDZCxVQUFVLEVBQUU7d0JBQ1YsV0FBVyxFQUFFLGtCQUFrQjtxQkFDaEM7aUJBQ0Y7YUFDRixFQUNELE1BQU0sQ0FBQyxDQUFDO1lBQ1osdUNBQTBCLENBQ3RCLFFBQVEsRUFBRSxTQUFTLEVBQUUsTUFBTSxFQUFFO2dCQUMzQixPQUFPLEVBQUUsc0JBQXNCO2dCQUMvQixPQUFPLEVBQUUsRUFBQyxjQUFjLEVBQUUsTUFBTSxFQUFFLGFBQWEsRUFBRSxXQUFXLEVBQUM7YUFDOUQsRUFDRCxNQUFNLENBQUMsQ0FBQztZQUVaLElBQU0sR0FBRyxHQUFNLE9BQU8sQ0FBQyxJQUFJLFNBQU0sQ0FBQztZQUNsQyxJQUFNLE9BQU8sR0FBRyxvQ0FBdUIsQ0FBQyxRQUF5QixFQUFFLEdBQUcsQ0FBQyxDQUFDO1lBQ3hFLElBQUksT0FBTyxFQUFFO2dCQUNYLElBQU0sV0FBUyxHQUNYLG9DQUF1QixDQUFDLE9BQXdCLEVBQUUsV0FBVyxDQUFrQixDQUFDO2dCQUNwRix1Q0FBMEIsQ0FDdEIsUUFBUSxFQUFFLFdBQVMsRUFBRSxLQUFLLEVBQUU7b0JBQzFCLE9BQU8sRUFBRSxzQkFBc0I7b0JBQy9CLE9BQU8sRUFBRTt3QkFDUCxZQUFZLEVBQUUsTUFBTTt3QkFDcEIsV0FBVyxFQUFFLHNCQUFzQjtxQkFDcEM7b0JBQ0QsY0FBYyxFQUFFO3dCQUNkLFVBQVUsRUFBRTs0QkFDVixXQUFXLEVBQUUsdUJBQXVCO3lCQUNyQztxQkFDRjtpQkFDRixFQUNELE1BQU0sQ0FBQyxDQUFDO2FBQ2I7WUFFRCxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQzVCLE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVEOzs7T0FHRztJQUNILFNBQVMsaUJBQWlCO1FBQ3hCLE9BQU8sVUFBQyxJQUFVLEVBQUUsT0FBeUI7WUFDM0MsSUFBTSxhQUFhLEdBQUcseUJBQWdCLENBQUMsSUFBSSxDQUFDLENBQUM7WUFDN0MsSUFBSSxDQUFDLGFBQWEsRUFBRTtnQkFDbEIsT0FBTzthQUNSO1lBQ0QsSUFBSSxDQUFDLE1BQU0sQ0FDSixhQUFhLFNBQU0sRUFBRSx5REFBeUQ7Z0JBQzdFLG1GQUFtRjtnQkFDbkYsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO1FBQ3BDLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRDs7O09BR0c7SUFDSCxTQUFTLGtCQUFrQjtRQUN6QixPQUFPLFVBQUMsSUFBVSxFQUFFLE9BQXlCO1lBQzNDLElBQU0sWUFBWSxHQUFHLGVBQWUsQ0FBQztZQUNyQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsRUFBRTtnQkFDOUIsT0FBTzthQUNSO1lBQ0QsSUFBSSxDQUFDLE1BQU0sQ0FDSixZQUFZLFNBQU0sRUFBRSwwREFBMEQ7Z0JBQzdFLG1GQUFtRjtnQkFDbkYsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDO1FBQ25DLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRDs7Ozs7O09BTUc7SUFDSCxTQUFTLGtCQUFrQjtRQUN6QixPQUFPLFVBQUMsSUFBVSxFQUFFLE9BQXlCO1lBQzNDLElBQU0sWUFBWSxHQUFHLGVBQWUsQ0FBQztZQUNyQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxZQUFZLENBQUMsRUFBRTtnQkFDOUIsT0FBTyxJQUFJLENBQUM7YUFDYjtZQUNELElBQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFHLENBQUMsUUFBUSxFQUFFLENBQUM7WUFDeEQsSUFBSSxDQUFDLFVBQVUsRUFBRTtnQkFDZixPQUFPLElBQUksQ0FBQzthQUNiO1lBQ0QsSUFBTSxPQUFPLEdBQUcsVUFBVSxDQUFDLFFBQVEsRUFBRSxDQUFDO1lBQ3RDLElBQU0sR0FBRyxHQUFHLG1CQUFZLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDbEMsSUFBSSxDQUFDLDRCQUFlLENBQUMsR0FBRyxDQUFDLEVBQUU7Z0JBQ3pCLE9BQU8sSUFBSSxDQUFDO2FBQ2I7WUFDRCxJQUFNLGVBQWUsR0FBRyxvQ0FBdUIsQ0FBQyxHQUFHLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztZQUN4RSxJQUFJLENBQUMsNEJBQWUsQ0FBQyxlQUFlLENBQUMsRUFBRTtnQkFDckMsT0FBTyxJQUFJLENBQUM7YUFDYjtZQUNELElBQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDaEQsdUVBQXVFO1lBQ3ZFLGVBQWU7WUFDZixzQ0FBeUIsQ0FBQyxRQUFRLEVBQUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxRQUFRLENBQUMsQ0FBQztZQUN4RSxzQ0FBeUIsQ0FBQyxRQUFRLEVBQUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxRQUFRLENBQUMsQ0FBQztZQUN4RSx5RUFBeUU7WUFDekUsWUFBWTtZQUNaLHNDQUF5QixDQUFDLFFBQVEsRUFBRSxPQUFPLEVBQUUsZUFBZSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1lBQzNFLDhEQUE4RDtZQUM5RCxzQ0FBeUIsQ0FBQyxRQUFRLEVBQUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxTQUFTLENBQUMsQ0FBQztZQUN6RSxzQ0FBeUIsQ0FBQyxRQUFRLEVBQUUsT0FBTyxFQUFFLGVBQWUsRUFBRSxTQUFTLENBQUMsQ0FBQztZQUN6RSxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQzVCLE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVEOzs7T0FHRztJQUNILFNBQVMsV0FBVztRQUNsQixPQUFPLFVBQUMsSUFBVSxFQUFFLE9BQXlCO1lBQzNDLElBQU0sV0FBVyxHQUFHLGNBQWMsQ0FBQztZQUNuQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsRUFBRTtnQkFDN0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxvQkFBa0IsV0FBYSxDQUFDLENBQUM7YUFDbEQ7WUFDRCxJQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQ3ZDLElBQUksQ0FBQyxPQUFPLEVBQUU7Z0JBQ1osTUFBTSxJQUFJLEtBQUssQ0FBQyxxQ0FBcUMsQ0FBQyxDQUFDO2FBQ3hEO1lBQ0QsSUFBTSxPQUFPLEdBQUcsbUJBQVksQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztZQUNqRCxJQUFJLENBQUMsNEJBQWUsQ0FBQyxPQUFPLENBQUMsRUFBRTtnQkFDN0IsTUFBTSxJQUFJLEtBQUssQ0FBQyw4QkFBNEIsV0FBYSxDQUFDLENBQUM7YUFDNUQ7WUFDRCxJQUFNLElBQUksR0FBRyxvQ0FBdUIsQ0FBQyxPQUFPLEVBQUUsY0FBYyxDQUFDLENBQUM7WUFDOUQsSUFBSSxDQUFDLDRCQUFlLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQzFCLE1BQU0sSUFBSSxLQUFLLENBQUMsb0NBQWtDLFdBQWEsQ0FBQyxDQUFDO2FBQ2xFO1lBQ0QsSUFBTSxJQUFJLEdBQUcsb0NBQXVCLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQ25ELElBQUksQ0FBQyxJQUFJLEVBQUU7Z0JBQ1QsTUFBTSxJQUFJLEtBQUssQ0FBQyw0Q0FBMEMsV0FBYSxDQUFDLENBQUM7YUFDMUU7WUFDRCxJQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsS0FBZSxDQUFDLENBQUUsZ0NBQWdDO1lBQ3JFLElBQU0sS0FBSyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMscUJBQXFCLENBQUMsQ0FBQztZQUNqRCxJQUFJLEtBQUssRUFBRTtnQkFDSCxJQUFBLDZCQUF5QixFQUF4QixTQUFDLEVBQUUsYUFBSyxFQUFFLGFBQWMsQ0FBQztnQkFDaEMsSUFBSSxLQUFLLEdBQUcsR0FBRyxJQUFJLENBQUMsS0FBSyxLQUFLLEdBQUcsSUFBSSxLQUFLLEdBQUcsR0FBRyxDQUFDLEVBQUU7b0JBQ2pELElBQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLENBQUM7b0JBQy9DLHVDQUEwQixDQUFDLFFBQVEsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO29CQUM3RCxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDO2lCQUM3QjthQUNGO2lCQUFNO2dCQUNMLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUNmLHlDQUF5QztvQkFDekMsa0RBQWtELENBQUMsQ0FBQzthQUN6RDtZQUNELE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVEOzs7O09BSUc7SUFDSCxTQUFTLG1DQUFtQztRQUMxQyxPQUFPLFVBQUMsSUFBVSxFQUFFLE9BQXlCO1lBQzNDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLGdDQUFnQyxDQUFDLEVBQUU7Z0JBQ2xELE9BQU87YUFDUjtZQUNELElBQU0sV0FBVyxHQUFHLGNBQWMsQ0FBQztZQUNuQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsRUFBRTtnQkFDN0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxvQkFBa0IsV0FBYSxDQUFDLENBQUM7YUFDbEQ7WUFDRCxJQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQ3ZDLElBQUksQ0FBQyxPQUFPLEVBQUU7Z0JBQ1osTUFBTSxJQUFJLEtBQUssQ0FBQyxxQ0FBcUMsQ0FBQyxDQUFDO2FBQ3hEO1lBQ0QsSUFBTSxPQUFPLEdBQUcsbUJBQVksQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLENBQUMsQ0FBQztZQUNqRCxJQUFJLENBQUMsNEJBQWUsQ0FBQyxPQUFPLENBQUMsRUFBRTtnQkFDN0IsTUFBTSxJQUFJLEtBQUssQ0FBQyw4QkFBNEIsV0FBYSxDQUFDLENBQUM7YUFDNUQ7WUFDRCxJQUFNLE9BQU8sR0FBRyxvQ0FBdUIsQ0FBQyxPQUFPLEVBQUUsU0FBUyxDQUFrQixDQUFDO1lBQzdFLElBQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDL0MsSUFBSSxPQUFPLEVBQUU7Z0JBQ1gsNkNBQWdDLENBQzVCLFFBQVEsRUFBRSxPQUFPLEVBQUUsYUFBYSxFQUFFLHlDQUF5QyxFQUFFLENBQUMsQ0FBQyxDQUFDO2FBQ3JGO2lCQUFNO2dCQUNMLDZDQUFnQyxDQUM1QixRQUFRLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRTtvQkFDNUIsV0FBVyxFQUFFLHlDQUF5QztpQkFDdkQsRUFDRCxDQUFDLENBQUMsQ0FBQzthQUNSO1lBQ0QsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUM1QixPQUFPLElBQUksQ0FBQztRQUNkLENBQUMsQ0FBQztJQUNKLENBQUM7SUFFRCxtQkFBd0IsT0FBZTtRQUNyQyxPQUFPLFVBQUMsSUFBVTtZQUNoQixnQ0FBbUIsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFbEMsT0FBTyxrQkFBSyxDQUFDO2dCQUNYLHVCQUF1QixDQUFDLE9BQU8sQ0FBQztnQkFDaEMsK0JBQStCLENBQUMsT0FBTyxDQUFDO2dCQUN4QyxtQ0FBbUMsRUFBRTtnQkFDckMsaUJBQWlCLEVBQUU7Z0JBQ25CLGtCQUFrQixFQUFFO2dCQUNwQixrQ0FBa0MsQ0FBQyxPQUFPLENBQUM7Z0JBQzNDLGVBQWUsRUFBRTtnQkFDakIsa0JBQWtCLEVBQUU7Z0JBQ3BCLFdBQVcsRUFBRTthQUNkLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQztJQUNKLENBQUM7SUFoQkQsNEJBZ0JDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqXG4gKiBAZmlsZW92ZXJ2aWV3IFNjaGVtYXRpY3MgZm9yIG5nLW5ldyBwcm9qZWN0IHRoYXQgYnVpbGRzIHdpdGggQmF6ZWwuXG4gKi9cblxuaW1wb3J0IHtKc29uQXN0T2JqZWN0LCBwYXJzZUpzb25Bc3QsIHN0cmluZ3N9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7UnVsZSwgU2NoZW1hdGljQ29udGV4dCwgU2NoZW1hdGljc0V4Y2VwdGlvbiwgVHJlZSwgYXBwbHksIGFwcGx5VGVtcGxhdGVzLCBjaGFpbiwgbWVyZ2VXaXRoLCBtb3ZlLCBzY2hlbWF0aWMsIHVybH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L3NjaGVtYXRpY3MnO1xuaW1wb3J0IHtnZXRXb3Jrc3BhY2VQYXRofSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvY29uZmlnJztcbmltcG9ydCB7ZmluZFByb3BlcnR5SW5Bc3RPYmplY3QsIGluc2VydFByb3BlcnR5SW5Bc3RPYmplY3RJbk9yZGVyfSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvanNvbi11dGlscyc7XG5pbXBvcnQge3ZhbGlkYXRlUHJvamVjdE5hbWV9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS92YWxpZGF0aW9uJztcbmltcG9ydCB7aXNKc29uQXN0T2JqZWN0LCByZW1vdmVLZXlWYWx1ZUluQXN0T2JqZWN0LCByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdH0gZnJvbSAnLi4vdXRpbGl0eS9qc29uLXV0aWxzJztcbmltcG9ydCB7U2NoZW1hfSBmcm9tICcuL3NjaGVtYSc7XG5cbi8qKlxuICogUGFja2FnZXMgdGhhdCBidWlsZCB1bmRlciBCYXplbCByZXF1aXJlIGFkZGl0aW9uYWwgZGV2IGRlcGVuZGVuY2llcy4gVGhpc1xuICogZnVuY3Rpb24gYWRkcyB0aG9zZSBkZXBlbmRlbmNpZXMgdG8gXCJkZXZEZXBlbmRlbmNpZXNcIiBzZWN0aW9uIGluXG4gKiBwYWNrYWdlLmpzb24uXG4gKi9cbmZ1bmN0aW9uIGFkZERldkRlcGVuZGVuY2llc1RvUGFja2FnZUpzb24ob3B0aW9uczogU2NoZW1hKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIGNvbnN0IHBhY2thZ2VKc29uID0gJ3BhY2thZ2UuanNvbic7XG4gICAgaWYgKCFob3N0LmV4aXN0cyhwYWNrYWdlSnNvbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IGZpbmQgJHtwYWNrYWdlSnNvbn1gKTtcbiAgICB9XG4gICAgY29uc3QgcGFja2FnZUpzb25Db250ZW50ID0gaG9zdC5yZWFkKHBhY2thZ2VKc29uKTtcbiAgICBpZiAoIXBhY2thZ2VKc29uQ29udGVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gcmVhZCBwYWNrYWdlLmpzb24gY29udGVudCcpO1xuICAgIH1cbiAgICBjb25zdCBqc29uQXN0ID0gcGFyc2VKc29uQXN0KHBhY2thZ2VKc29uQ29udGVudC50b1N0cmluZygpKSBhcyBKc29uQXN0T2JqZWN0O1xuICAgIGNvbnN0IGRlcHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChqc29uQXN0LCAnZGVwZW5kZW5jaWVzJykgYXMgSnNvbkFzdE9iamVjdDtcbiAgICBjb25zdCBkZXZEZXBzID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoanNvbkFzdCwgJ2RldkRlcGVuZGVuY2llcycpIGFzIEpzb25Bc3RPYmplY3Q7XG5cbiAgICBjb25zdCBhbmd1bGFyQ29yZU5vZGUgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChkZXBzLCAnQGFuZ3VsYXIvY29yZScpO1xuICAgIGlmICghYW5ndWxhckNvcmVOb2RlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Bhbmd1bGFyL2NvcmUgZGVwZW5kZW5jeSBub3QgZm91bmQgaW4gcGFja2FnZS5qc29uJyk7XG4gICAgfVxuICAgIGNvbnN0IGFuZ3VsYXJDb3JlVmVyc2lvbiA9IGFuZ3VsYXJDb3JlTm9kZS52YWx1ZSBhcyBzdHJpbmc7XG5cbiAgICBjb25zdCBkZXZEZXBlbmRlbmNpZXM6IHtbazogc3RyaW5nXTogc3RyaW5nfSA9IHtcbiAgICAgICdAYW5ndWxhci9iYXplbCc6IGFuZ3VsYXJDb3JlVmVyc2lvbixcbiAgICAgICdAYmF6ZWwvYmF6ZWwnOiAnXjAuMjMuMCcsXG4gICAgICAnQGJhemVsL2liYXplbCc6ICdeMC45LjAnLFxuICAgICAgJ0BiYXplbC9rYXJtYSc6ICdeMC4yNy40JyxcbiAgICB9O1xuXG4gICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKHBhY2thZ2VKc29uKTtcbiAgICBmb3IgKGNvbnN0IHBhY2thZ2VOYW1lIG9mIE9iamVjdC5rZXlzKGRldkRlcGVuZGVuY2llcykpIHtcbiAgICAgIGNvbnN0IHZlcnNpb24gPSBkZXZEZXBlbmRlbmNpZXNbcGFja2FnZU5hbWVdO1xuICAgICAgY29uc3QgaW5kZW50ID0gNDtcbiAgICAgIGluc2VydFByb3BlcnR5SW5Bc3RPYmplY3RJbk9yZGVyKHJlY29yZGVyLCBkZXZEZXBzLCBwYWNrYWdlTmFtZSwgdmVyc2lvbiwgaW5kZW50KTtcbiAgICB9XG4gICAgaG9zdC5jb21taXRVcGRhdGUocmVjb3JkZXIpO1xuICAgIHJldHVybiBob3N0O1xuICB9O1xufVxuXG4vKipcbiAqIEFwcGVuZCBhZGRpdGlvbmFsIEphdmFzY3JpcHQgLyBUeXBlc2NyaXB0IGZpbGVzIG5lZWRlZCB0byBjb21waWxlIGFuIEFuZ3VsYXJcbiAqIHByb2plY3QgdW5kZXIgQmF6ZWwuXG4gKi9cbmZ1bmN0aW9uIGFkZEZpbGVzUmVxdWlyZWRCeUJhemVsKG9wdGlvbnM6IFNjaGVtYSkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUpID0+IHtcbiAgICByZXR1cm4gbWVyZ2VXaXRoKGFwcGx5KHVybCgnLi9maWxlcycpLCBbXG4gICAgICBhcHBseVRlbXBsYXRlcyh7fSksXG4gICAgXSkpO1xuICB9O1xufVxuXG4vKipcbiAqIEFwcGVuZCAnL2JhemVsLW91dCcgdG8gdGhlIGdpdGlnbm9yZSBmaWxlLlxuICovXG5mdW5jdGlvbiB1cGRhdGVHaXRpZ25vcmUoKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIGNvbnN0IGdpdGlnbm9yZSA9ICcvLmdpdGlnbm9yZSc7XG4gICAgaWYgKCFob3N0LmV4aXN0cyhnaXRpZ25vcmUpKSB7XG4gICAgICByZXR1cm4gaG9zdDtcbiAgICB9XG4gICAgY29uc3QgZ2l0SWdub3JlQ29udGVudFJhdyA9IGhvc3QucmVhZChnaXRpZ25vcmUpO1xuICAgIGlmICghZ2l0SWdub3JlQ29udGVudFJhdykge1xuICAgICAgcmV0dXJuIGhvc3Q7XG4gICAgfVxuICAgIGNvbnN0IGdpdElnbm9yZUNvbnRlbnQgPSBnaXRJZ25vcmVDb250ZW50UmF3LnRvU3RyaW5nKCk7XG4gICAgaWYgKGdpdElnbm9yZUNvbnRlbnQuaW5jbHVkZXMoJ1xcbi9iYXplbC1vdXRcXG4nKSkge1xuICAgICAgcmV0dXJuIGhvc3Q7XG4gICAgfVxuICAgIGNvbnN0IGNvbXBpbGVkT3V0cHV0ID0gJyMgY29tcGlsZWQgb3V0cHV0XFxuJztcbiAgICBjb25zdCBpbmRleCA9IGdpdElnbm9yZUNvbnRlbnQuaW5kZXhPZihjb21waWxlZE91dHB1dCk7XG4gICAgY29uc3QgaW5zZXJ0aW9uSW5kZXggPSBpbmRleCA+PSAwID8gaW5kZXggKyBjb21waWxlZE91dHB1dC5sZW5ndGggOiBnaXRJZ25vcmVDb250ZW50Lmxlbmd0aDtcbiAgICBjb25zdCByZWNvcmRlciA9IGhvc3QuYmVnaW5VcGRhdGUoZ2l0aWdub3JlKTtcbiAgICByZWNvcmRlci5pbnNlcnRSaWdodChpbnNlcnRpb25JbmRleCwgJy9iYXplbC1vdXRcXG4nKTtcbiAgICBob3N0LmNvbW1pdFVwZGF0ZShyZWNvcmRlcik7XG4gICAgcmV0dXJuIGhvc3Q7XG4gIH07XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUFuZ3VsYXJKc29uVG9Vc2VCYXplbEJ1aWxkZXIob3B0aW9uczogU2NoZW1hKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSwgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCkgPT4ge1xuICAgIGNvbnN0IHtuYW1lfSA9IG9wdGlvbnM7XG4gICAgY29uc3Qgd29ya3NwYWNlUGF0aCA9IGdldFdvcmtzcGFjZVBhdGgoaG9zdCk7XG4gICAgaWYgKCF3b3Jrc3BhY2VQYXRoKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBmaW5kIGFuZ3VsYXIuanNvbicpO1xuICAgIH1cbiAgICBjb25zdCB3b3Jrc3BhY2VDb250ZW50ID0gaG9zdC5yZWFkKHdvcmtzcGFjZVBhdGgpO1xuICAgIGlmICghd29ya3NwYWNlQ29udGVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gcmVhZCBhbmd1bGFyLmpzb24gY29udGVudCcpO1xuICAgIH1cbiAgICBjb25zdCB3b3Jrc3BhY2VKc29uQXN0ID0gcGFyc2VKc29uQXN0KHdvcmtzcGFjZUNvbnRlbnQudG9TdHJpbmcoKSkgYXMgSnNvbkFzdE9iamVjdDtcbiAgICBjb25zdCBwcm9qZWN0cyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KHdvcmtzcGFjZUpzb25Bc3QsICdwcm9qZWN0cycpO1xuICAgIGlmICghcHJvamVjdHMpIHtcbiAgICAgIHRocm93IG5ldyBTY2hlbWF0aWNzRXhjZXB0aW9uKCdFeHBlY3QgcHJvamVjdHMgaW4gYW5ndWxhci5qc29uIHRvIGJlIGFuIE9iamVjdCcpO1xuICAgIH1cbiAgICBjb25zdCBwcm9qZWN0ID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QocHJvamVjdHMgYXMgSnNvbkFzdE9iamVjdCwgbmFtZSk7XG4gICAgaWYgKCFwcm9qZWN0KSB7XG4gICAgICB0aHJvdyBuZXcgU2NoZW1hdGljc0V4Y2VwdGlvbihgRXhwZWN0ZWQgcHJvamVjdHMgdG8gY29udGFpbiAke25hbWV9YCk7XG4gICAgfVxuICAgIGNvbnN0IHJlY29yZGVyID0gaG9zdC5iZWdpblVwZGF0ZSh3b3Jrc3BhY2VQYXRoKTtcbiAgICBjb25zdCBpbmRlbnQgPSA4O1xuICAgIGNvbnN0IGFyY2hpdGVjdCA9XG4gICAgICAgIGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KHByb2plY3QgYXMgSnNvbkFzdE9iamVjdCwgJ2FyY2hpdGVjdCcpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QoXG4gICAgICAgIHJlY29yZGVyLCBhcmNoaXRlY3QsICdidWlsZCcsIHtcbiAgICAgICAgICBidWlsZGVyOiAnQGFuZ3VsYXIvYmF6ZWw6YnVpbGQnLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIHRhcmdldExhYmVsOiAnLy9zcmM6cHJvZGFwcCcsXG4gICAgICAgICAgICBiYXplbENvbW1hbmQ6ICdidWlsZCcsXG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBpbmRlbnQpO1xuICAgIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0KFxuICAgICAgICByZWNvcmRlciwgYXJjaGl0ZWN0LCAnc2VydmUnLCB7XG4gICAgICAgICAgYnVpbGRlcjogJ0Bhbmd1bGFyL2JhemVsOmJ1aWxkJyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vc3JjOmRldnNlcnZlcicsXG4gICAgICAgICAgICBiYXplbENvbW1hbmQ6ICdydW4nLFxuICAgICAgICAgICAgd2F0Y2g6IHRydWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBjb25maWd1cmF0aW9uczoge1xuICAgICAgICAgICAgcHJvZHVjdGlvbjoge1xuICAgICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vc3JjOnByb2RzZXJ2ZXInLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgICBpbmRlbnQpO1xuICAgIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0KFxuICAgICAgICByZWNvcmRlciwgYXJjaGl0ZWN0LCAndGVzdCcsIHtcbiAgICAgICAgICBidWlsZGVyOiAnQGFuZ3VsYXIvYmF6ZWw6YnVpbGQnLFxuICAgICAgICAgIG9wdGlvbnM6IHsnYmF6ZWxDb21tYW5kJzogJ3Rlc3QnLCAndGFyZ2V0TGFiZWwnOiAnLy9zcmMvLi4uJ30sXG4gICAgICAgIH0sXG4gICAgICAgIGluZGVudCk7XG5cbiAgICBjb25zdCBlMmUgPSBgJHtvcHRpb25zLm5hbWV9LWUyZWA7XG4gICAgY29uc3QgZTJlTm9kZSA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KHByb2plY3RzIGFzIEpzb25Bc3RPYmplY3QsIGUyZSk7XG4gICAgaWYgKGUyZU5vZGUpIHtcbiAgICAgIGNvbnN0IGFyY2hpdGVjdCA9XG4gICAgICAgICAgZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoZTJlTm9kZSBhcyBKc29uQXN0T2JqZWN0LCAnYXJjaGl0ZWN0JykgYXMgSnNvbkFzdE9iamVjdDtcbiAgICAgIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0KFxuICAgICAgICAgIHJlY29yZGVyLCBhcmNoaXRlY3QsICdlMmUnLCB7XG4gICAgICAgICAgICBidWlsZGVyOiAnQGFuZ3VsYXIvYmF6ZWw6YnVpbGQnLFxuICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICBiYXplbENvbW1hbmQ6ICd0ZXN0JyxcbiAgICAgICAgICAgICAgdGFyZ2V0TGFiZWw6ICcvL2UyZTpkZXZzZXJ2ZXJfdGVzdCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY29uZmlndXJhdGlvbnM6IHtcbiAgICAgICAgICAgICAgcHJvZHVjdGlvbjoge1xuICAgICAgICAgICAgICAgIHRhcmdldExhYmVsOiAnLy9lMmU6cHJvZHNlcnZlcl90ZXN0JyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LFxuICAgICAgICAgIGluZGVudCk7XG4gICAgfVxuXG4gICAgaG9zdC5jb21taXRVcGRhdGUocmVjb3JkZXIpO1xuICAgIHJldHVybiBob3N0O1xuICB9O1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIGJhY2t1cCBmb3IgdGhlIG9yaWdpbmFsIGFuZ3VsYXIuanNvbiBmaWxlIGluIGNhc2UgdXNlciB3YW50cyB0b1xuICogZWplY3QgQmF6ZWwgYW5kIHJldmVydCB0byB0aGUgb3JpZ2luYWwgd29ya2Zsb3cuXG4gKi9cbmZ1bmN0aW9uIGJhY2t1cEFuZ3VsYXJKc29uKCk6IFJ1bGUge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBjb25zdCB3b3Jrc3BhY2VQYXRoID0gZ2V0V29ya3NwYWNlUGF0aChob3N0KTtcbiAgICBpZiAoIXdvcmtzcGFjZVBhdGgpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaG9zdC5jcmVhdGUoXG4gICAgICAgIGAke3dvcmtzcGFjZVBhdGh9LmJha2AsICcvLyBUaGlzIGlzIGEgYmFja3VwIGZpbGUgb2YgdGhlIG9yaWdpbmFsIGFuZ3VsYXIuanNvbi4gJyArXG4gICAgICAgICAgICAnVGhpcyBmaWxlIGlzIG5lZWRlZCBpbiBjYXNlIHlvdSB3YW50IHRvIHJldmVydCB0byB0aGUgd29ya2Zsb3cgd2l0aG91dCBCYXplbC5cXG5cXG4nICtcbiAgICAgICAgICAgIGhvc3QucmVhZCh3b3Jrc3BhY2VQYXRoKSk7XG4gIH07XG59XG5cbi8qKlxuICogQ3JlYXRlIGEgYmFja3VwIGZvciB0aGUgb3JpZ2luYWwgdHNjb25maWcuanNvbiBmaWxlIGluIGNhc2UgdXNlciB3YW50cyB0b1xuICogZWplY3QgQmF6ZWwgYW5kIHJldmVydCB0byB0aGUgb3JpZ2luYWwgd29ya2Zsb3cuXG4gKi9cbmZ1bmN0aW9uIGJhY2t1cFRzY29uZmlnSnNvbigpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgY29uc3QgdHNjb25maWdQYXRoID0gJ3RzY29uZmlnLmpzb24nO1xuICAgIGlmICghaG9zdC5leGlzdHModHNjb25maWdQYXRoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBob3N0LmNyZWF0ZShcbiAgICAgICAgYCR7dHNjb25maWdQYXRofS5iYWtgLCAnLy8gVGhpcyBpcyBhIGJhY2t1cCBmaWxlIG9mIHRoZSBvcmlnaW5hbCB0c2NvbmZpZy5qc29uLiAnICtcbiAgICAgICAgICAgICdUaGlzIGZpbGUgaXMgbmVlZGVkIGluIGNhc2UgeW91IHdhbnQgdG8gcmV2ZXJ0IHRvIHRoZSB3b3JrZmxvdyB3aXRob3V0IEJhemVsLlxcblxcbicgK1xuICAgICAgICAgICAgaG9zdC5yZWFkKHRzY29uZmlnUGF0aCkpO1xuICB9O1xufVxuXG4vKipcbiAqIEJhemVsIGNvbnRyb2xzIHRoZSBjb21waWxhdGlvbiBvcHRpb25zIG9mIHRzYywgc28gbWFueSBvcHRpb25zIGluXG4gKiB0c2NvbmZpZy5qc29uIGdlbmVyYXRlZCBieSB0aGUgZGVmYXVsdCBDTEkgc2NoZW1hdGljcyBhcmUgbm90IGFwcGxpY2FibGUuXG4gKiBUaGlzIGZ1bmN0aW9uIHVwZGF0ZXMgdGhlIHRzY29uZmlnLmpzb24gdG8gcmVtb3ZlIEJhemVsLWNvbnRyb2xsZWRcbiAqIHBhcmFtZXRlcnMuIFRoaXMgcHJldmVudHMgQmF6ZWwgZnJvbSBwcmludGluZyBvdXQgd2FybmluZ3MgYWJvdXQgb3ZlcnJpZGVuXG4gKiBzZXR0aW5ncy5cbiAqL1xuZnVuY3Rpb24gdXBkYXRlVHNjb25maWdKc29uKCk6IFJ1bGUge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBjb25zdCB0c2NvbmZpZ1BhdGggPSAndHNjb25maWcuanNvbic7XG4gICAgaWYgKCFob3N0LmV4aXN0cyh0c2NvbmZpZ1BhdGgpKSB7XG4gICAgICByZXR1cm4gaG9zdDtcbiAgICB9XG4gICAgY29uc3QgY29udGVudFJhdyA9IGhvc3QucmVhZCh0c2NvbmZpZ1BhdGgpICEudG9TdHJpbmcoKTtcbiAgICBpZiAoIWNvbnRlbnRSYXcpIHtcbiAgICAgIHJldHVybiBob3N0O1xuICAgIH1cbiAgICBjb25zdCBjb250ZW50ID0gY29udGVudFJhdy50b1N0cmluZygpO1xuICAgIGNvbnN0IGFzdCA9IHBhcnNlSnNvbkFzdChjb250ZW50KTtcbiAgICBpZiAoIWlzSnNvbkFzdE9iamVjdChhc3QpKSB7XG4gICAgICByZXR1cm4gaG9zdDtcbiAgICB9XG4gICAgY29uc3QgY29tcGlsZXJPcHRpb25zID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoYXN0LCAnY29tcGlsZXJPcHRpb25zJyk7XG4gICAgaWYgKCFpc0pzb25Bc3RPYmplY3QoY29tcGlsZXJPcHRpb25zKSkge1xuICAgICAgcmV0dXJuIGhvc3Q7XG4gICAgfVxuICAgIGNvbnN0IHJlY29yZGVyID0gaG9zdC5iZWdpblVwZGF0ZSh0c2NvbmZpZ1BhdGgpO1xuICAgIC8vIHRhcmdldCBhbmQgbW9kdWxlIGFyZSBjb250cm9sbGVkIGJ5IGRvd25zdHJlYW0gZGVwZW5kZW5jaWVzLCBzdWNoIGFzXG4gICAgLy8gdHNfZGV2c2VydmVyXG4gICAgcmVtb3ZlS2V5VmFsdWVJbkFzdE9iamVjdChyZWNvcmRlciwgY29udGVudCwgY29tcGlsZXJPcHRpb25zLCAndGFyZ2V0Jyk7XG4gICAgcmVtb3ZlS2V5VmFsdWVJbkFzdE9iamVjdChyZWNvcmRlciwgY29udGVudCwgY29tcGlsZXJPcHRpb25zLCAnbW9kdWxlJyk7XG4gICAgLy8gdHlwZVJvb3RzIGlzIGFsd2F5cyBzZXQgdG8gdGhlIEB0eXBlcyBzdWJkaXJlY3Rvcnkgb2YgdGhlIG5vZGVfbW9kdWxlc1xuICAgIC8vIGF0dHJpYnV0ZVxuICAgIHJlbW92ZUtleVZhbHVlSW5Bc3RPYmplY3QocmVjb3JkZXIsIGNvbnRlbnQsIGNvbXBpbGVyT3B0aW9ucywgJ3R5cGVSb290cycpO1xuICAgIC8vIHJvb3REaXIgYW5kIGJhc2VVcmwgYXJlIGFsd2F5cyB0aGUgd29ya3NwYWNlIHJvb3QgZGlyZWN0b3J5XG4gICAgcmVtb3ZlS2V5VmFsdWVJbkFzdE9iamVjdChyZWNvcmRlciwgY29udGVudCwgY29tcGlsZXJPcHRpb25zLCAncm9vdERpcicpO1xuICAgIHJlbW92ZUtleVZhbHVlSW5Bc3RPYmplY3QocmVjb3JkZXIsIGNvbnRlbnQsIGNvbXBpbGVyT3B0aW9ucywgJ2Jhc2VVcmwnKTtcbiAgICBob3N0LmNvbW1pdFVwZGF0ZShyZWNvcmRlcik7XG4gICAgcmV0dXJuIGhvc3Q7XG4gIH07XG59XG5cbi8qKlxuICogQGFuZ3VsYXIvYmF6ZWwgcmVxdWlyZXMgbWluaW11bSB2ZXJzaW9uIG9mIHJ4anMgdG8gYmUgNi40LjAuIFRoaXMgZnVuY3Rpb25cbiAqIHVwZ3JhZGVzIHRoZSB2ZXJzaW9uIG9mIHJ4anMgaW4gcGFja2FnZS5qc29uIGlmIG5lY2Vzc2FyeS5cbiAqL1xuZnVuY3Rpb24gdXBncmFkZVJ4anMoKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSwgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCkgPT4ge1xuICAgIGNvbnN0IHBhY2thZ2VKc29uID0gJ3BhY2thZ2UuanNvbic7XG4gICAgaWYgKCFob3N0LmV4aXN0cyhwYWNrYWdlSnNvbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IGZpbmQgJHtwYWNrYWdlSnNvbn1gKTtcbiAgICB9XG4gICAgY29uc3QgY29udGVudCA9IGhvc3QucmVhZChwYWNrYWdlSnNvbik7XG4gICAgaWYgKCFjb250ZW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byByZWFkIHBhY2thZ2UuanNvbiBjb250ZW50Jyk7XG4gICAgfVxuICAgIGNvbnN0IGpzb25Bc3QgPSBwYXJzZUpzb25Bc3QoY29udGVudC50b1N0cmluZygpKTtcbiAgICBpZiAoIWlzSnNvbkFzdE9iamVjdChqc29uQXN0KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gcGFyc2UgSlNPTiBmb3IgJHtwYWNrYWdlSnNvbn1gKTtcbiAgICB9XG4gICAgY29uc3QgZGVwcyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGpzb25Bc3QsICdkZXBlbmRlbmNpZXMnKTtcbiAgICBpZiAoIWlzSnNvbkFzdE9iamVjdChkZXBzKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gZmluZCBkZXBlbmRlbmNpZXMgaW4gJHtwYWNrYWdlSnNvbn1gKTtcbiAgICB9XG4gICAgY29uc3QgcnhqcyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGRlcHMsICdyeGpzJyk7XG4gICAgaWYgKCFyeGpzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBmaW5kIHJ4anMgaW4gZGVwZW5kZW5jaWVzIG9mICR7cGFja2FnZUpzb259YCk7XG4gICAgfVxuICAgIGNvbnN0IHZhbHVlID0gcnhqcy52YWx1ZSBhcyBzdHJpbmc7ICAvLyB2YWx1ZSBjYW4gYmUgdmVyc2lvbiBvciByYW5nZVxuICAgIGNvbnN0IG1hdGNoID0gdmFsdWUubWF0Y2goLyhcXGQpK1xcLihcXGQpKy4oXFxkKSskLyk7XG4gICAgaWYgKG1hdGNoKSB7XG4gICAgICBjb25zdCBbXywgbWFqb3IsIG1pbm9yXSA9IG1hdGNoO1xuICAgICAgaWYgKG1ham9yIDwgJzYnIHx8IChtYWpvciA9PT0gJzYnICYmIG1pbm9yIDwgJzQnKSkge1xuICAgICAgICBjb25zdCByZWNvcmRlciA9IGhvc3QuYmVnaW5VcGRhdGUocGFja2FnZUpzb24pO1xuICAgICAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChyZWNvcmRlciwgZGVwcywgJ3J4anMnLCAnfjYuNC4wJyk7XG4gICAgICAgIGhvc3QuY29tbWl0VXBkYXRlKHJlY29yZGVyKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29udGV4dC5sb2dnZXIuaW5mbyhcbiAgICAgICAgICAnQ291bGQgbm90IGRldGVybWluZSB2ZXJzaW9uIG9mIHJ4anMuIFxcbicgK1xuICAgICAgICAgICdQbGVhc2UgbWFrZSBzdXJlIHRoYXQgdmVyc2lvbiBpcyBhdCBsZWFzdCA2LjQuMC4nKTtcbiAgICB9XG4gICAgcmV0dXJuIGhvc3Q7XG4gIH07XG59XG5cbi8qKlxuICogV2hlbiB1c2luZyBBbmd1bGFyIE5QTSBwYWNrYWdlcyBhbmQgYnVpbGRpbmcgd2l0aCBBT1QgY29tcGlsYXRpb24sIG5nY1xuICogcmVxdWlyZXMgbmdzdW1hbXJ5IGZpbGVzIGJ1dCB0aGV5IGFyZSBub3Qgc2hpcHBlZC4gVGhpcyBmdW5jdGlvbiBhZGRzIGFcbiAqIHBvc3RpbnN0YWxsIHN0ZXAgdG8gZ2VuZXJhdGUgdGhlc2UgZmlsZXMuXG4gKi9cbmZ1bmN0aW9uIGFkZFBvc3RpbnN0YWxsVG9HZW5lcmF0ZU5nU3VtbWFyaWVzKCkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBpZiAoIWhvc3QuZXhpc3RzKCdhbmd1bGFyLW1ldGFkYXRhLnRzY29uZmlnLmpzb24nKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBwYWNrYWdlSnNvbiA9ICdwYWNrYWdlLmpzb24nO1xuICAgIGlmICghaG9zdC5leGlzdHMocGFja2FnZUpzb24pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBmaW5kICR7cGFja2FnZUpzb259YCk7XG4gICAgfVxuICAgIGNvbnN0IGNvbnRlbnQgPSBob3N0LnJlYWQocGFja2FnZUpzb24pO1xuICAgIGlmICghY29udGVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gcmVhZCBwYWNrYWdlLmpzb24gY29udGVudCcpO1xuICAgIH1cbiAgICBjb25zdCBqc29uQXN0ID0gcGFyc2VKc29uQXN0KGNvbnRlbnQudG9TdHJpbmcoKSk7XG4gICAgaWYgKCFpc0pzb25Bc3RPYmplY3QoanNvbkFzdCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIHBhcnNlIEpTT04gZm9yICR7cGFja2FnZUpzb259YCk7XG4gICAgfVxuICAgIGNvbnN0IHNjcmlwdHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChqc29uQXN0LCAnc2NyaXB0cycpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKHBhY2thZ2VKc29uKTtcbiAgICBpZiAoc2NyaXB0cykge1xuICAgICAgaW5zZXJ0UHJvcGVydHlJbkFzdE9iamVjdEluT3JkZXIoXG4gICAgICAgICAgcmVjb3JkZXIsIHNjcmlwdHMsICdwb3N0aW5zdGFsbCcsICduZ2MgLXAgLi9hbmd1bGFyLW1ldGFkYXRhLnRzY29uZmlnLmpzb24nLCA0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgaW5zZXJ0UHJvcGVydHlJbkFzdE9iamVjdEluT3JkZXIoXG4gICAgICAgICAgcmVjb3JkZXIsIGpzb25Bc3QsICdzY3JpcHRzJywge1xuICAgICAgICAgICAgcG9zdGluc3RhbGw6ICduZ2MgLXAgLi9hbmd1bGFyLW1ldGFkYXRhLnRzY29uZmlnLmpzb24nLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgMik7XG4gICAgfVxuICAgIGhvc3QuY29tbWl0VXBkYXRlKHJlY29yZGVyKTtcbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24ob3B0aW9uczogU2NoZW1hKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIHZhbGlkYXRlUHJvamVjdE5hbWUob3B0aW9ucy5uYW1lKTtcblxuICAgIHJldHVybiBjaGFpbihbXG4gICAgICBhZGRGaWxlc1JlcXVpcmVkQnlCYXplbChvcHRpb25zKSxcbiAgICAgIGFkZERldkRlcGVuZGVuY2llc1RvUGFja2FnZUpzb24ob3B0aW9ucyksXG4gICAgICBhZGRQb3N0aW5zdGFsbFRvR2VuZXJhdGVOZ1N1bW1hcmllcygpLFxuICAgICAgYmFja3VwQW5ndWxhckpzb24oKSxcbiAgICAgIGJhY2t1cFRzY29uZmlnSnNvbigpLFxuICAgICAgdXBkYXRlQW5ndWxhckpzb25Ub1VzZUJhemVsQnVpbGRlcihvcHRpb25zKSxcbiAgICAgIHVwZGF0ZUdpdGlnbm9yZSgpLFxuICAgICAgdXBkYXRlVHNjb25maWdKc29uKCksXG4gICAgICB1cGdyYWRlUnhqcygpLFxuICAgIF0pO1xuICB9O1xufVxuIl19
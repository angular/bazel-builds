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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvc2NoZW1hdGljcy9uZy1hZGQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCw2Q0FBaUU7SUFDakUseURBQTJJO0lBQzNJLDBEQUF3RTtJQUN4RSw2REFBa0Y7SUFDbEYseUVBQTZKO0lBQzdKLHFFQUFpSDtJQUNqSCxxRUFBMkU7SUFFM0UsK0VBQWtGO0lBQ2xGLHlGQUE0RDtJQU01RDs7OztPQUlHO0lBQ0gsU0FBUywrQkFBK0IsQ0FBQyxPQUFlO1FBQ3RELE9BQU8sVUFBQyxJQUFVOztZQUNoQixJQUFNLFdBQVcsR0FBRyx1Q0FBd0IsQ0FBQyxJQUFJLEVBQUUsZUFBZSxDQUFDLENBQUM7WUFDcEUsSUFBSSxDQUFDLFdBQVcsRUFBRTtnQkFDaEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxvREFBb0QsQ0FBQyxDQUFDO2FBQ3ZFO1lBRUQsd0VBQXdFO1lBQ3hFLElBQU0sZUFBZSxHQUF1QjtnQkFDMUMsQ0FBQyxnQkFBZ0IsRUFBRSxXQUFXLENBQUMsT0FBTyxDQUFDO2dCQUN2QyxDQUFDLGNBQWMsRUFBRSxPQUFPLENBQUM7Z0JBQ3pCLENBQUMsZUFBZSxFQUFFLFFBQVEsQ0FBQztnQkFDM0IsQ0FBQyxjQUFjLEVBQUUsT0FBTyxDQUFDO2dCQUN6QixDQUFDLG1CQUFtQixFQUFFLE9BQU8sQ0FBQztnQkFDOUIsQ0FBQyxlQUFlLEVBQUUsT0FBTyxDQUFDO2dCQUMxQixDQUFDLGVBQWUsRUFBRSxPQUFPLENBQUM7Z0JBQzFCLENBQUMsbUJBQW1CLEVBQUUsT0FBTyxDQUFDO2dCQUM5QixDQUFDLGdCQUFnQixFQUFFLE9BQU8sQ0FBQztnQkFDM0IsQ0FBQyxvQkFBb0IsRUFBRSxPQUFPLENBQUM7Z0JBQy9CLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FB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c0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqXG4gKiBAZmlsZW92ZXJ2aWV3IFNjaGVtYXRpY3MgZm9yIG5nLW5ldyBwcm9qZWN0IHRoYXQgYnVpbGRzIHdpdGggQmF6ZWwuXG4gKi9cblxuaW1wb3J0IHtKc29uQXN0T2JqZWN0LCBwYXJzZUpzb25Bc3R9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7YXBwbHksIGFwcGx5VGVtcGxhdGVzLCBjaGFpbiwgbWVyZ2VXaXRoLCBSdWxlLCBTY2hlbWF0aWNDb250ZXh0LCBTY2hlbWF0aWNzRXhjZXB0aW9uLCBUcmVlLCB1cmx9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9zY2hlbWF0aWNzJztcbmltcG9ydCB7Tm9kZVBhY2thZ2VJbnN0YWxsVGFza30gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L3NjaGVtYXRpY3MvdGFza3MnO1xuaW1wb3J0IHtnZXRXb3Jrc3BhY2UsIGdldFdvcmtzcGFjZVBhdGh9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS9jb25maWcnO1xuaW1wb3J0IHthZGRQYWNrYWdlSnNvbkRlcGVuZGVuY3ksIGdldFBhY2thZ2VKc29uRGVwZW5kZW5jeSwgTm9kZURlcGVuZGVuY3lUeXBlLCByZW1vdmVQYWNrYWdlSnNvbkRlcGVuZGVuY3l9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS9kZXBlbmRlbmNpZXMnO1xuaW1wb3J0IHtmaW5kUHJvcGVydHlJbkFzdE9iamVjdCwgaW5zZXJ0UHJvcGVydHlJbkFzdE9iamVjdEluT3JkZXJ9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS9qc29uLXV0aWxzJztcbmltcG9ydCB7dmFsaWRhdGVQcm9qZWN0TmFtZX0gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L3ZhbGlkYXRpb24nO1xuXG5pbXBvcnQge2lzSnNvbkFzdE9iamVjdCwgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3R9IGZyb20gJy4uL3V0aWxpdHkvanNvbi11dGlscyc7XG5pbXBvcnQge2ZpbmRFMmVBcmNoaXRlY3R9IGZyb20gJy4uL3V0aWxpdHkvd29ya3NwYWNlLXV0aWxzJztcblxuaW1wb3J0IHtTY2hlbWF9IGZyb20gJy4vc2NoZW1hJztcblxuXG5cbi8qKlxuICogUGFja2FnZXMgdGhhdCBidWlsZCB1bmRlciBCYXplbCByZXF1aXJlIGFkZGl0aW9uYWwgZGV2IGRlcGVuZGVuY2llcy4gVGhpc1xuICogZnVuY3Rpb24gYWRkcyB0aG9zZSBkZXBlbmRlbmNpZXMgdG8gXCJkZXZEZXBlbmRlbmNpZXNcIiBzZWN0aW9uIGluXG4gKiBwYWNrYWdlLmpzb24uXG4gKi9cbmZ1bmN0aW9uIGFkZERldkRlcGVuZGVuY2llc1RvUGFja2FnZUpzb24ob3B0aW9uczogU2NoZW1hKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIGNvbnN0IGFuZ3VsYXJDb3JlID0gZ2V0UGFja2FnZUpzb25EZXBlbmRlbmN5KGhvc3QsICdAYW5ndWxhci9jb3JlJyk7XG4gICAgaWYgKCFhbmd1bGFyQ29yZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdAYW5ndWxhci9jb3JlIGRlcGVuZGVuY3kgbm90IGZvdW5kIGluIHBhY2thZ2UuanNvbicpO1xuICAgIH1cblxuICAgIC8vIFRPRE86IHVzZSBhIFJlY29yZDxzdHJpbmcsIHN0cmluZz4gd2hlbiB0aGUgdHNjIGxpYiBzZXR0aW5nIGFsbG93cyB1c1xuICAgIGNvbnN0IGRldkRlcGVuZGVuY2llczogW3N0cmluZywgc3RyaW5nXVtdID0gW1xuICAgICAgWydAYW5ndWxhci9iYXplbCcsIGFuZ3VsYXJDb3JlLnZlcnNpb25dLFxuICAgICAgWydAYmF6ZWwvYmF6ZWwnLCAnMi4xLjAnXSxcbiAgICAgIFsnQGJhemVsL2liYXplbCcsICcwLjEyLjMnXSxcbiAgICAgIFsnQGJhemVsL2thcm1hJywgJzEuNi4wJ10sXG4gICAgICBbJ0BiYXplbC9wcm90cmFjdG9yJywgJzEuNi4wJ10sXG4gICAgICBbJ0BiYXplbC9yb2xsdXAnLCAnMS42LjAnXSxcbiAgICAgIFsnQGJhemVsL3RlcnNlcicsICcxLjYuMCddLFxuICAgICAgWydAYmF6ZWwvdHlwZXNjcmlwdCcsICcxLjYuMCddLFxuICAgICAgWydoaXN0b3J5LXNlcnZlcicsICcxLjMuMSddLFxuICAgICAgWydodG1sLWluc2VydC1hc3NldHMnLCAnMC41LjAnXSxcbiAgICAgIFsna2FybWEnLCAnNC40LjEnXSxcbiAgICAgIFsna2FybWEtY2hyb21lLWxhdW5jaGVyJywgJzMuMS4wJ10sXG4gICAgICBbJ2thcm1hLWZpcmVmb3gtbGF1bmNoZXInLCAnMS4yLjAnXSxcbiAgICAgIFsna2FybWEtamFzbWluZScsICcyLjAuMSddLFxuICAgICAgWydrYXJtYS1yZXF1aXJlanMnLCAnMS4xLjAnXSxcbiAgICAgIFsna2FybWEtc291cmNlbWFwLWxvYWRlcicsICcwLjMuNyddLFxuICAgICAgWydwcm90cmFjdG9yJywgJzUuNC4yJ10sXG4gICAgICBbJ3JlcXVpcmVqcycsICcyLjMuNiddLFxuICAgICAgWydyb2xsdXAnLCAnMS4yNy41J10sXG4gICAgICBbJ3JvbGx1cC1wbHVnaW4tY29tbW9uanMnLCAnMTAuMS4wJ10sXG4gICAgICBbJ3JvbGx1cC1wbHVnaW4tbm9kZS1yZXNvbHZlJywgJzUuMi4wJ10sXG4gICAgICBbJ3RlcnNlcicsICc0LjQuMCddLFxuICAgIF07XG5cbiAgICBmb3IgKGNvbnN0IFtuYW1lLCB2ZXJzaW9uXSBvZiBkZXZEZXBlbmRlbmNpZXMpIHtcbiAgICAgIGNvbnN0IGRlcCA9IGdldFBhY2thZ2VKc29uRGVwZW5kZW5jeShob3N0LCBuYW1lKTtcbiAgICAgIGlmIChkZXAgJiYgZGVwLnR5cGUgIT09IE5vZGVEZXBlbmRlbmN5VHlwZS5EZXYpIHtcbiAgICAgICAgcmVtb3ZlUGFja2FnZUpzb25EZXBlbmRlbmN5KGhvc3QsIG5hbWUpO1xuICAgICAgfVxuXG4gICAgICBhZGRQYWNrYWdlSnNvbkRlcGVuZGVuY3koaG9zdCwge1xuICAgICAgICBuYW1lLFxuICAgICAgICB2ZXJzaW9uLFxuICAgICAgICB0eXBlOiBOb2RlRGVwZW5kZW5jeVR5cGUuRGV2LFxuICAgICAgICBvdmVyd3JpdGU6IHRydWUsXG4gICAgICB9KTtcbiAgICB9XG4gIH07XG59XG5cbi8qKlxuICogUmVtb3ZlIHBhY2thZ2VzIHRoYXQgYXJlIG5vdCBuZWVkZWQgdW5kZXIgQmF6ZWwuXG4gKiBAcGFyYW0gb3B0aW9uc1xuICovXG5mdW5jdGlvbiByZW1vdmVPYnNvbGV0ZURlcGVuZGVuY2llc0Zyb21QYWNrYWdlSnNvbihvcHRpb25zOiBTY2hlbWEpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgY29uc3QgZGVwc1RvUmVtb3ZlID0gW1xuICAgICAgJ0Bhbmd1bGFyLWRldmtpdC9idWlsZC1hbmd1bGFyJyxcbiAgICBdO1xuXG4gICAgZm9yIChjb25zdCBwYWNrYWdlTmFtZSBvZiBkZXBzVG9SZW1vdmUpIHtcbiAgICAgIHJlbW92ZVBhY2thZ2VKc29uRGVwZW5kZW5jeShob3N0LCBwYWNrYWdlTmFtZSk7XG4gICAgfVxuICB9O1xufVxuXG4vKipcbiAqIEFwcGVuZCBhZGRpdGlvbmFsIEphdmFzY3JpcHQgLyBUeXBlc2NyaXB0IGZpbGVzIG5lZWRlZCB0byBjb21waWxlIGFuIEFuZ3VsYXJcbiAqIHByb2plY3QgdW5kZXIgQmF6ZWwuXG4gKi9cbmZ1bmN0aW9uIGFkZEZpbGVzUmVxdWlyZWRCeUJhemVsKG9wdGlvbnM6IFNjaGVtYSkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUpID0+IHtcbiAgICByZXR1cm4gbWVyZ2VXaXRoKGFwcGx5KHVybCgnLi9maWxlcycpLCBbXG4gICAgICBhcHBseVRlbXBsYXRlcyh7fSksXG4gICAgXSkpO1xuICB9O1xufVxuXG4vKipcbiAqIEFwcGVuZCAnL2JhemVsLW91dCcgdG8gdGhlIGdpdGlnbm9yZSBmaWxlLlxuICovXG5mdW5jdGlvbiB1cGRhdGVHaXRpZ25vcmUoKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIGNvbnN0IGdpdGlnbm9yZSA9ICcvLmdpdGlnbm9yZSc7XG4gICAgaWYgKCFob3N0LmV4aXN0cyhnaXRpZ25vcmUpKSB7XG4gICAgICByZXR1cm4gaG9zdDtcbiAgICB9XG4gICAgY29uc3QgZ2l0SWdub3JlQ29udGVudFJhdyA9IGhvc3QucmVhZChnaXRpZ25vcmUpO1xuICAgIGlmICghZ2l0SWdub3JlQ29udGVudFJhdykge1xuICAgICAgcmV0dXJuIGhvc3Q7XG4gICAgfVxuICAgIGNvbnN0IGdpdElnbm9yZUNvbnRlbnQgPSBnaXRJZ25vcmVDb250ZW50UmF3LnRvU3RyaW5nKCk7XG4gICAgaWYgKGdpdElnbm9yZUNvbnRlbnQuaW5jbHVkZXMoJ1xcbi9iYXplbC1vdXRcXG4nKSkge1xuICAgICAgcmV0dXJuIGhvc3Q7XG4gICAgfVxuICAgIGNvbnN0IGNvbXBpbGVkT3V0cHV0ID0gJyMgY29tcGlsZWQgb3V0cHV0XFxuJztcbiAgICBjb25zdCBpbmRleCA9IGdpdElnbm9yZUNvbnRlbnQuaW5kZXhPZihjb21waWxlZE91dHB1dCk7XG4gICAgY29uc3QgaW5zZXJ0aW9uSW5kZXggPSBpbmRleCA+PSAwID8gaW5kZXggKyBjb21waWxlZE91dHB1dC5sZW5ndGggOiBnaXRJZ25vcmVDb250ZW50Lmxlbmd0aDtcbiAgICBjb25zdCByZWNvcmRlciA9IGhvc3QuYmVnaW5VcGRhdGUoZ2l0aWdub3JlKTtcbiAgICByZWNvcmRlci5pbnNlcnRSaWdodChpbnNlcnRpb25JbmRleCwgJy9iYXplbC1vdXRcXG4nKTtcbiAgICBob3N0LmNvbW1pdFVwZGF0ZShyZWNvcmRlcik7XG4gICAgcmV0dXJuIGhvc3Q7XG4gIH07XG59XG5cbi8qKlxuICogQ2hhbmdlIHRoZSBhcmNoaXRlY3QgaW4gYW5ndWxhci5qc29uIHRvIHVzZSBCYXplbCBidWlsZGVyLlxuICovXG5mdW5jdGlvbiB1cGRhdGVBbmd1bGFySnNvblRvVXNlQmF6ZWxCdWlsZGVyKG9wdGlvbnM6IFNjaGVtYSk6IFJ1bGUge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUpID0+IHtcbiAgICBjb25zdCBuYW1lID0gb3B0aW9ucy5uYW1lITtcbiAgICBjb25zdCB3b3Jrc3BhY2VQYXRoID0gZ2V0V29ya3NwYWNlUGF0aChob3N0KTtcbiAgICBpZiAoIXdvcmtzcGFjZVBhdGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IGZpbmQgYW5ndWxhci5qc29uJyk7XG4gICAgfVxuICAgIGNvbnN0IHdvcmtzcGFjZUNvbnRlbnQgPSBob3N0LnJlYWQod29ya3NwYWNlUGF0aCk7XG4gICAgaWYgKCF3b3Jrc3BhY2VDb250ZW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byByZWFkIGFuZ3VsYXIuanNvbiBjb250ZW50Jyk7XG4gICAgfVxuICAgIGNvbnN0IHdvcmtzcGFjZUpzb25Bc3QgPSBwYXJzZUpzb25Bc3Qod29ya3NwYWNlQ29udGVudC50b1N0cmluZygpKSBhcyBKc29uQXN0T2JqZWN0O1xuICAgIGNvbnN0IHByb2plY3RzID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3Qod29ya3NwYWNlSnNvbkFzdCwgJ3Byb2plY3RzJyk7XG4gICAgaWYgKCFwcm9qZWN0cykge1xuICAgICAgdGhyb3cgbmV3IFNjaGVtYXRpY3NFeGNlcHRpb24oJ0V4cGVjdCBwcm9qZWN0cyBpbiBhbmd1bGFyLmpzb24gdG8gYmUgYW4gT2JqZWN0Jyk7XG4gICAgfVxuICAgIGNvbnN0IHByb2plY3QgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChwcm9qZWN0cyBhcyBKc29uQXN0T2JqZWN0LCBuYW1lKTtcbiAgICBpZiAoIXByb2plY3QpIHtcbiAgICAgIHRocm93IG5ldyBTY2hlbWF0aWNzRXhjZXB0aW9uKGBFeHBlY3RlZCBwcm9qZWN0cyB0byBjb250YWluICR7bmFtZX1gKTtcbiAgICB9XG4gICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKHdvcmtzcGFjZVBhdGgpO1xuICAgIGNvbnN0IGluZGVudCA9IDg7XG4gICAgY29uc3QgYXJjaGl0ZWN0ID1cbiAgICAgICAgZmluZFByb3BlcnR5SW5Bc3RPYmplY3QocHJvamVjdCBhcyBKc29uQXN0T2JqZWN0LCAnYXJjaGl0ZWN0JykgYXMgSnNvbkFzdE9iamVjdDtcbiAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChcbiAgICAgICAgcmVjb3JkZXIsIGFyY2hpdGVjdCwgJ2J1aWxkJywge1xuICAgICAgICAgIGJ1aWxkZXI6ICdAYW5ndWxhci9iYXplbDpidWlsZCcsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgdGFyZ2V0TGFiZWw6ICcvL3NyYzpwcm9kYXBwJyxcbiAgICAgICAgICAgIGJhemVsQ29tbWFuZDogJ2J1aWxkJyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvbmZpZ3VyYXRpb25zOiB7XG4gICAgICAgICAgICBwcm9kdWN0aW9uOiB7XG4gICAgICAgICAgICAgIHRhcmdldExhYmVsOiAnLy9zcmM6cHJvZGFwcCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGluZGVudCk7XG4gICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QoXG4gICAgICAgIHJlY29yZGVyLCBhcmNoaXRlY3QsICdzZXJ2ZScsIHtcbiAgICAgICAgICBidWlsZGVyOiAnQGFuZ3VsYXIvYmF6ZWw6YnVpbGQnLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIHRhcmdldExhYmVsOiAnLy9zcmM6ZGV2c2VydmVyJyxcbiAgICAgICAgICAgIGJhemVsQ29tbWFuZDogJ3J1bicsXG4gICAgICAgICAgICB3YXRjaDogdHJ1ZSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvbmZpZ3VyYXRpb25zOiB7XG4gICAgICAgICAgICBwcm9kdWN0aW9uOiB7XG4gICAgICAgICAgICAgIHRhcmdldExhYmVsOiAnLy9zcmM6cHJvZHNlcnZlcicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGluZGVudCk7XG5cbiAgICBpZiAoZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoYXJjaGl0ZWN0LCAndGVzdCcpKSB7XG4gICAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChcbiAgICAgICAgICByZWNvcmRlciwgYXJjaGl0ZWN0LCAndGVzdCcsIHtcbiAgICAgICAgICAgIGJ1aWxkZXI6ICdAYW5ndWxhci9iYXplbDpidWlsZCcsXG4gICAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICAgIGJhemVsQ29tbWFuZDogJ3Rlc3QnLFxuICAgICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vc3JjOnRlc3QnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGluZGVudCk7XG4gICAgfVxuXG4gICAgY29uc3QgZTJlQXJjaGl0ZWN0ID0gZmluZEUyZUFyY2hpdGVjdCh3b3Jrc3BhY2VKc29uQXN0LCBuYW1lKTtcbiAgICBpZiAoZTJlQXJjaGl0ZWN0ICYmIGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGUyZUFyY2hpdGVjdCwgJ2UyZScpKSB7XG4gICAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChcbiAgICAgICAgICByZWNvcmRlciwgZTJlQXJjaGl0ZWN0LCAnZTJlJywge1xuICAgICAgICAgICAgYnVpbGRlcjogJ0Bhbmd1bGFyL2JhemVsOmJ1aWxkJyxcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgYmF6ZWxDb21tYW5kOiAndGVzdCcsXG4gICAgICAgICAgICAgIHRhcmdldExhYmVsOiAnLy9lMmU6ZGV2c2VydmVyX3Rlc3QnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYXRpb25zOiB7XG4gICAgICAgICAgICAgIHByb2R1Y3Rpb246IHtcbiAgICAgICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vZTJlOnByb2RzZXJ2ZXJfdGVzdCcsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICBpbmRlbnQpO1xuICAgIH1cblxuICAgIGhvc3QuY29tbWl0VXBkYXRlKHJlY29yZGVyKTtcbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBiYWNrdXAgZm9yIHRoZSBvcmlnaW5hbCBhbmd1bGFyLmpzb24gZmlsZSBpbiBjYXNlIHVzZXIgd2FudHMgdG9cbiAqIGVqZWN0IEJhemVsIGFuZCByZXZlcnQgdG8gdGhlIG9yaWdpbmFsIHdvcmtmbG93LlxuICovXG5mdW5jdGlvbiBiYWNrdXBBbmd1bGFySnNvbigpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgY29uc3Qgd29ya3NwYWNlUGF0aCA9IGdldFdvcmtzcGFjZVBhdGgoaG9zdCk7XG4gICAgaWYgKCF3b3Jrc3BhY2VQYXRoKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGhvc3QuY3JlYXRlKFxuICAgICAgICBgJHt3b3Jrc3BhY2VQYXRofS5iYWtgLFxuICAgICAgICAnLy8gVGhpcyBpcyBhIGJhY2t1cCBmaWxlIG9mIHRoZSBvcmlnaW5hbCBhbmd1bGFyLmpzb24uICcgK1xuICAgICAgICAgICAgJ1RoaXMgZmlsZSBpcyBuZWVkZWQgaW4gY2FzZSB5b3Ugd2FudCB0byByZXZlcnQgdG8gdGhlIHdvcmtmbG93IHdpdGhvdXQgQmF6ZWwuXFxuXFxuJyArXG4gICAgICAgICAgICBob3N0LnJlYWQod29ya3NwYWNlUGF0aCkpO1xuICB9O1xufVxuXG4vKipcbiAqIEBhbmd1bGFyL2JhemVsIHJlcXVpcmVzIG1pbmltdW0gdmVyc2lvbiBvZiByeGpzIHRvIGJlIDYuNC4wLiBUaGlzIGZ1bmN0aW9uXG4gKiB1cGdyYWRlcyB0aGUgdmVyc2lvbiBvZiByeGpzIGluIHBhY2thZ2UuanNvbiBpZiBuZWNlc3NhcnkuXG4gKi9cbmZ1bmN0aW9uIHVwZ3JhZGVSeGpzKCkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBjb25zdCByeGpzTm9kZSA9IGdldFBhY2thZ2VKc29uRGVwZW5kZW5jeShob3N0LCAncnhqcycpO1xuICAgIGlmICghcnhqc05vZGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGZpbmQgcnhqcyBkZXBlbmRlbmN5LmApO1xuICAgIH1cblxuICAgIGNvbnN0IG1hdGNoID0gcnhqc05vZGUudmVyc2lvbi5tYXRjaCgvKFxcZCkrXFwuKFxcZCkrLihcXGQpKyQvKTtcbiAgICBpZiAobWF0Y2gpIHtcbiAgICAgIGNvbnN0IFtfLCBtYWpvciwgbWlub3JdID0gbWF0Y2g7XG4gICAgICBpZiAobWFqb3IgPCAnNicgfHwgKG1ham9yID09PSAnNicgJiYgbWlub3IgPCAnNScpKSB7XG4gICAgICAgIGFkZFBhY2thZ2VKc29uRGVwZW5kZW5jeShob3N0LCB7XG4gICAgICAgICAgLi4ucnhqc05vZGUsXG4gICAgICAgICAgdmVyc2lvbjogJ342LjUuMycsXG4gICAgICAgICAgb3ZlcndyaXRlOiB0cnVlLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29udGV4dC5sb2dnZXIuaW5mbyhcbiAgICAgICAgICAnQ291bGQgbm90IGRldGVybWluZSB2ZXJzaW9uIG9mIHJ4anMuIFxcbicgK1xuICAgICAgICAgICdQbGVhc2UgbWFrZSBzdXJlIHRoYXQgdmVyc2lvbiBpcyBhdCBsZWFzdCA2LjUuMy4nKTtcbiAgICB9XG4gICAgcmV0dXJuIGhvc3Q7XG4gIH07XG59XG5cbi8qKlxuICogV2hlbiB1c2luZyBJdnksIG5nY2MgbXVzdCBiZSBydW4gYXMgYSBwb3N0aW5zdGFsbCBzdGVwLlxuICogVGhpcyBmdW5jdGlvbiBhZGRzIHRoaXMgcG9zdGluc3RhbGwgc3RlcC5cbiAqL1xuZnVuY3Rpb24gYWRkUG9zdGluc3RhbGxUb1J1bk5nY2MoKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSwgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCkgPT4ge1xuICAgIGNvbnN0IHBhY2thZ2VKc29uID0gJ3BhY2thZ2UuanNvbic7XG4gICAgaWYgKCFob3N0LmV4aXN0cyhwYWNrYWdlSnNvbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IGZpbmQgJHtwYWNrYWdlSnNvbn1gKTtcbiAgICB9XG4gICAgY29uc3QgY29udGVudCA9IGhvc3QucmVhZChwYWNrYWdlSnNvbik7XG4gICAgaWYgKCFjb250ZW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byByZWFkIHBhY2thZ2UuanNvbiBjb250ZW50Jyk7XG4gICAgfVxuICAgIGNvbnN0IGpzb25Bc3QgPSBwYXJzZUpzb25Bc3QoY29udGVudC50b1N0cmluZygpKTtcbiAgICBpZiAoIWlzSnNvbkFzdE9iamVjdChqc29uQXN0KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gcGFyc2UgSlNPTiBmb3IgJHtwYWNrYWdlSnNvbn1gKTtcbiAgICB9XG4gICAgY29uc3Qgc2NyaXB0cyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGpzb25Bc3QsICdzY3JpcHRzJykgYXMgSnNvbkFzdE9iamVjdDtcbiAgICBjb25zdCByZWNvcmRlciA9IGhvc3QuYmVnaW5VcGRhdGUocGFja2FnZUpzb24pO1xuICAgIC8vIEZvciBiYXplbCB3ZSBuZWVkIHRvIGNvbXBpbGUgdGhlIGFsbCBmaWxlcyBpbiBwbGFjZSBzbyB3ZVxuICAgIC8vIGRvbid0IHVzZSBgLS1maXJzdC1vbmx5YCBvciBgLS1jcmVhdGUtaXZ5LWVudHJ5LXBvaW50c2BcbiAgICBjb25zdCBuZ2NjQ29tbWFuZCA9ICduZ2NjIC0tcHJvcGVydGllcyBlczIwMTUgYnJvd3NlciBtb2R1bGUgbWFpbic7XG4gICAgaWYgKHNjcmlwdHMpIHtcbiAgICAgIGNvbnN0IHBvc3RJbnN0YWxsID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3Qoc2NyaXB0cywgJ3Bvc3RpbnN0YWxsJyk7XG4gICAgICBpZiAocG9zdEluc3RhbGwgJiYgcG9zdEluc3RhbGwudmFsdWUpIHtcbiAgICAgICAgbGV0IHZhbHVlID0gcG9zdEluc3RhbGwudmFsdWUgYXMgc3RyaW5nO1xuICAgICAgICBpZiAoL1xcYm5nY2NcXGIvLnRlc3QodmFsdWUpKSB7XG4gICAgICAgICAgLy8gYG5nY2NgIGlzIGFscmVhZHkgaW4gdGhlIHBvc3RpbnN0YWxsIHNjcmlwdFxuICAgICAgICAgIHZhbHVlID1cbiAgICAgICAgICAgICAgdmFsdWUucmVwbGFjZSgvXFxzKi0tZmlyc3Qtb25seVxcYi8sICcnKS5yZXBsYWNlKC9cXHMqLS1jcmVhdGUtaXZ5LWVudHJ5LXBvaW50c1xcYi8sICcnKTtcbiAgICAgICAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChyZWNvcmRlciwgc2NyaXB0cywgJ3Bvc3RpbnN0YWxsJywgdmFsdWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IGNvbW1hbmQgPSBgJHtwb3N0SW5zdGFsbC52YWx1ZX07ICR7bmdjY0NvbW1hbmR9YDtcbiAgICAgICAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChyZWNvcmRlciwgc2NyaXB0cywgJ3Bvc3RpbnN0YWxsJywgY29tbWFuZCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGluc2VydFByb3BlcnR5SW5Bc3RPYmplY3RJbk9yZGVyKHJlY29yZGVyLCBzY3JpcHRzLCAncG9zdGluc3RhbGwnLCBuZ2NjQ29tbWFuZCwgNCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGluc2VydFByb3BlcnR5SW5Bc3RPYmplY3RJbk9yZGVyKFxuICAgICAgICAgIHJlY29yZGVyLCBqc29uQXN0LCAnc2NyaXB0cycsIHtcbiAgICAgICAgICAgIHBvc3RpbnN0YWxsOiBuZ2NjQ29tbWFuZCxcbiAgICAgICAgICB9LFxuICAgICAgICAgIDIpO1xuICAgIH1cbiAgICBob3N0LmNvbW1pdFVwZGF0ZShyZWNvcmRlcik7XG4gICAgcmV0dXJuIGhvc3Q7XG4gIH07XG59XG5cbi8qKlxuICogU2NoZWR1bGUgYSB0YXNrIHRvIHBlcmZvcm0gbnBtIC8geWFybiBpbnN0YWxsLlxuICovXG5mdW5jdGlvbiBpbnN0YWxsTm9kZU1vZHVsZXMob3B0aW9uczogU2NoZW1hKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSwgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCkgPT4ge1xuICAgIGlmICghb3B0aW9ucy5za2lwSW5zdGFsbCkge1xuICAgICAgY29udGV4dC5hZGRUYXNrKG5ldyBOb2RlUGFja2FnZUluc3RhbGxUYXNrKCkpO1xuICAgIH1cbiAgfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24ob3B0aW9uczogU2NoZW1hKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIG9wdGlvbnMubmFtZSA9IG9wdGlvbnMubmFtZSB8fCBnZXRXb3Jrc3BhY2UoaG9zdCkuZGVmYXVsdFByb2plY3Q7XG4gICAgaWYgKCFvcHRpb25zLm5hbWUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignUGxlYXNlIHNwZWNpZnkgYSBwcm9qZWN0IHVzaW5nIFwiLS1uYW1lIHByb2plY3QtbmFtZVwiJyk7XG4gICAgfVxuICAgIHZhbGlkYXRlUHJvamVjdE5hbWUob3B0aW9ucy5uYW1lKTtcblxuICAgIHJldHVybiBjaGFpbihbXG4gICAgICBhZGRGaWxlc1JlcXVpcmVkQnlCYXplbChvcHRpb25zKSxcbiAgICAgIGFkZERldkRlcGVuZGVuY2llc1RvUGFja2FnZUpzb24ob3B0aW9ucyksXG4gICAgICByZW1vdmVPYnNvbGV0ZURlcGVuZGVuY2llc0Zyb21QYWNrYWdlSnNvbihvcHRpb25zKSxcbiAgICAgIGFkZFBvc3RpbnN0YWxsVG9SdW5OZ2NjKCksXG4gICAgICBiYWNrdXBBbmd1bGFySnNvbigpLFxuICAgICAgdXBkYXRlQW5ndWxhckpzb25Ub1VzZUJhemVsQnVpbGRlcihvcHRpb25zKSxcbiAgICAgIHVwZGF0ZUdpdGlnbm9yZSgpLFxuICAgICAgdXBncmFkZVJ4anMoKSxcbiAgICAgIGluc3RhbGxOb2RlTW9kdWxlcyhvcHRpb25zKSxcbiAgICBdKTtcbiAgfTtcbn1cbiJdfQ==
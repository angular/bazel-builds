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
                '@bazel/karma': '0.38.1',
                '@bazel/protractor': '0.38.1',
                '@bazel/typescript': '0.38.1',
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
            options.name = options.name || config_1.getWorkspace(host).defaultProject;
            if (!options.name) {
                throw new Error('Please specify a project using "--name project-name"');
            }
            validation_1.validateProjectName(options.name);
            return schematics_1.chain([
                addFilesRequiredByBazel(options),
                addDevDependenciesToPackageJson(options),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvc2NoZW1hdGljcy9uZy1hZGQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCw2Q0FBaUU7SUFDakUseURBQTJJO0lBQzNJLDBEQUF3RTtJQUN4RSw2REFBa0Y7SUFDbEYscUVBQWlIO0lBQ2pILHFFQUEyRTtJQUUzRSwrRUFBNkc7SUFDN0cseUZBQTREO0lBSzVEOzs7O09BSUc7SUFDSCxTQUFTLCtCQUErQixDQUFDLE9BQWU7UUFDdEQsT0FBTyxVQUFDLElBQVU7O1lBQ2hCLElBQU0sV0FBVyxHQUFHLGNBQWMsQ0FBQztZQUNuQyxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLENBQUMsRUFBRTtnQkFDN0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxvQkFBa0IsV0FBYSxDQUFDLENBQUM7YUFDbEQ7WUFDRCxJQUFNLGtCQUFrQixHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDbEQsSUFBSSxDQUFDLGtCQUFrQixFQUFFO2dCQUN2QixNQUFNLElBQUksS0FBSyxDQUFDLHFDQUFxQyxDQUFDLENBQUM7YUFDeEQ7WUFDRCxJQUFNLE9BQU8sR0FBRyxtQkFBWSxDQUFDLGtCQUFrQixDQUFDLFFBQVEsRUFBRSxDQUFrQixDQUFDO1lBQzdFLElBQU0sSUFBSSxHQUFHLG9DQUF1QixDQUFDLE9BQU8sRUFBRSxjQUFjLENBQWtCLENBQUM7WUFDL0UsSUFBTSxPQUFPLEdBQUcsb0NBQXVCLENBQUMsT0FBTyxFQUFFLGlCQUFpQixDQUFrQixDQUFDO1lBRXJGLElBQU0sZUFBZSxHQUFHLG9DQUF1QixDQUFDLElBQUksRUFBRSxlQUFlLENBQUMsQ0FBQztZQUN2RSxJQUFJLENBQUMsZUFBZSxFQUFFO2dCQUNwQixNQUFN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O2dCQUMzQyxlQUFlLEVBQUU7Z0JBQ2pCLFdBQVcsRUFBRTtnQkFDYixrQkFBa0IsQ0FBQyxPQUFPLENBQUM7YUFDNUIsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQW5CRCw0QkFtQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICpcbiAqIEBmaWxlb3ZlcnZpZXcgU2NoZW1hdGljcyBmb3IgbmctbmV3IHByb2plY3QgdGhhdCBidWlsZHMgd2l0aCBCYXplbC5cbiAqL1xuXG5pbXBvcnQge0pzb25Bc3RPYmplY3QsIHBhcnNlSnNvbkFzdH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHtSdWxlLCBTY2hlbWF0aWNDb250ZXh0LCBTY2hlbWF0aWNzRXhjZXB0aW9uLCBUcmVlLCBhcHBseSwgYXBwbHlUZW1wbGF0ZXMsIGNoYWluLCBtZXJnZVdpdGgsIHVybH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L3NjaGVtYXRpY3MnO1xuaW1wb3J0IHtOb2RlUGFja2FnZUluc3RhbGxUYXNrfSBmcm9tICdAYW5ndWxhci1kZXZraXQvc2NoZW1hdGljcy90YXNrcyc7XG5pbXBvcnQge2dldFdvcmtzcGFjZSwgZ2V0V29ya3NwYWNlUGF0aH0gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L2NvbmZpZyc7XG5pbXBvcnQge2ZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0LCBpbnNlcnRQcm9wZXJ0eUluQXN0T2JqZWN0SW5PcmRlcn0gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L2pzb24tdXRpbHMnO1xuaW1wb3J0IHt2YWxpZGF0ZVByb2plY3ROYW1lfSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvdmFsaWRhdGlvbic7XG5cbmltcG9ydCB7aXNKc29uQXN0T2JqZWN0LCByZW1vdmVLZXlWYWx1ZUluQXN0T2JqZWN0LCByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdH0gZnJvbSAnLi4vdXRpbGl0eS9qc29uLXV0aWxzJztcbmltcG9ydCB7ZmluZEUyZUFyY2hpdGVjdH0gZnJvbSAnLi4vdXRpbGl0eS93b3Jrc3BhY2UtdXRpbHMnO1xuXG5pbXBvcnQge1NjaGVtYX0gZnJvbSAnLi9zY2hlbWEnO1xuXG5cbi8qKlxuICogUGFja2FnZXMgdGhhdCBidWlsZCB1bmRlciBCYXplbCByZXF1aXJlIGFkZGl0aW9uYWwgZGV2IGRlcGVuZGVuY2llcy4gVGhpc1xuICogZnVuY3Rpb24gYWRkcyB0aG9zZSBkZXBlbmRlbmNpZXMgdG8gXCJkZXZEZXBlbmRlbmNpZXNcIiBzZWN0aW9uIGluXG4gKiBwYWNrYWdlLmpzb24uXG4gKi9cbmZ1bmN0aW9uIGFkZERldkRlcGVuZGVuY2llc1RvUGFja2FnZUpzb24ob3B0aW9uczogU2NoZW1hKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIGNvbnN0IHBhY2thZ2VKc29uID0gJ3BhY2thZ2UuanNvbic7XG4gICAgaWYgKCFob3N0LmV4aXN0cyhwYWNrYWdlSnNvbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IGZpbmQgJHtwYWNrYWdlSnNvbn1gKTtcbiAgICB9XG4gICAgY29uc3QgcGFja2FnZUpzb25Db250ZW50ID0gaG9zdC5yZWFkKHBhY2thZ2VKc29uKTtcbiAgICBpZiAoIXBhY2thZ2VKc29uQ29udGVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gcmVhZCBwYWNrYWdlLmpzb24gY29udGVudCcpO1xuICAgIH1cbiAgICBjb25zdCBqc29uQXN0ID0gcGFyc2VKc29uQXN0KHBhY2thZ2VKc29uQ29udGVudC50b1N0cmluZygpKSBhcyBKc29uQXN0T2JqZWN0O1xuICAgIGNvbnN0IGRlcHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChqc29uQXN0LCAnZGVwZW5kZW5jaWVzJykgYXMgSnNvbkFzdE9iamVjdDtcbiAgICBjb25zdCBkZXZEZXBzID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoanNvbkFzdCwgJ2RldkRlcGVuZGVuY2llcycpIGFzIEpzb25Bc3RPYmplY3Q7XG5cbiAgICBjb25zdCBhbmd1bGFyQ29yZU5vZGUgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChkZXBzLCAnQGFuZ3VsYXIvY29yZScpO1xuICAgIGlmICghYW5ndWxhckNvcmVOb2RlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0Bhbmd1bGFyL2NvcmUgZGVwZW5kZW5jeSBub3QgZm91bmQgaW4gcGFja2FnZS5qc29uJyk7XG4gICAgfVxuICAgIGNvbnN0IGFuZ3VsYXJDb3JlVmVyc2lvbiA9IGFuZ3VsYXJDb3JlTm9kZS52YWx1ZSBhcyBzdHJpbmc7XG5cbiAgICBjb25zdCBkZXZEZXBlbmRlbmNpZXM6IHtbazogc3RyaW5nXTogc3RyaW5nfSA9IHtcbiAgICAgICdAYW5ndWxhci9iYXplbCc6IGFuZ3VsYXJDb3JlVmVyc2lvbixcbiAgICAgICdAYmF6ZWwvYmF6ZWwnOiAnXjAuMjguMScsXG4gICAgICAnQGJhemVsL2liYXplbCc6ICdeMC4xMC4yJyxcbiAgICAgICdAYmF6ZWwva2FybWEnOiAnMC4zOC4xJyxcbiAgICAgICdAYmF6ZWwvcHJvdHJhY3Rvcic6ICcwLjM4LjEnLFxuICAgICAgJ0BiYXplbC90eXBlc2NyaXB0JzogJzAuMzguMScsXG4gICAgICAnaGlzdG9yeS1zZXJ2ZXInOiAnXjEuMy4xJyxcbiAgICB9O1xuXG4gICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKHBhY2thZ2VKc29uKTtcbiAgICBmb3IgKGNvbnN0IHBhY2thZ2VOYW1lIG9mIE9iamVjdC5rZXlzKGRldkRlcGVuZGVuY2llcykpIHtcbiAgICAgIGNvbnN0IGV4aXN0aW5nRGVwID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoZGVwcywgcGFja2FnZU5hbWUpO1xuICAgICAgaWYgKGV4aXN0aW5nRGVwKSB7XG4gICAgICAgIGNvbnN0IGNvbnRlbnQgPSBwYWNrYWdlSnNvbkNvbnRlbnQudG9TdHJpbmcoKTtcbiAgICAgICAgcmVtb3ZlS2V5VmFsdWVJbkFzdE9iamVjdChyZWNvcmRlciwgY29udGVudCwgZGVwcywgcGFja2FnZU5hbWUpO1xuICAgICAgfVxuICAgICAgY29uc3QgdmVyc2lvbiA9IGRldkRlcGVuZGVuY2llc1twYWNrYWdlTmFtZV07XG4gICAgICBjb25zdCBpbmRlbnQgPSA0O1xuICAgICAgaWYgKGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGRldkRlcHMsIHBhY2thZ2VOYW1lKSkge1xuICAgICAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChyZWNvcmRlciwgZGV2RGVwcywgcGFja2FnZU5hbWUsIHZlcnNpb24sIGluZGVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpbnNlcnRQcm9wZXJ0eUluQXN0T2JqZWN0SW5PcmRlcihyZWNvcmRlciwgZGV2RGVwcywgcGFja2FnZU5hbWUsIHZlcnNpb24sIGluZGVudCk7XG4gICAgICB9XG4gICAgfVxuICAgIGhvc3QuY29tbWl0VXBkYXRlKHJlY29yZGVyKTtcbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuLyoqXG4gKiBBcHBlbmQgYWRkaXRpb25hbCBKYXZhc2NyaXB0IC8gVHlwZXNjcmlwdCBmaWxlcyBuZWVkZWQgdG8gY29tcGlsZSBhbiBBbmd1bGFyXG4gKiBwcm9qZWN0IHVuZGVyIEJhemVsLlxuICovXG5mdW5jdGlvbiBhZGRGaWxlc1JlcXVpcmVkQnlCYXplbChvcHRpb25zOiBTY2hlbWEpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgcmV0dXJuIG1lcmdlV2l0aChhcHBseSh1cmwoJy4vZmlsZXMnKSwgW1xuICAgICAgYXBwbHlUZW1wbGF0ZXMoe30pLFxuICAgIF0pKTtcbiAgfTtcbn1cblxuLyoqXG4gKiBBcHBlbmQgJy9iYXplbC1vdXQnIHRvIHRoZSBnaXRpZ25vcmUgZmlsZS5cbiAqL1xuZnVuY3Rpb24gdXBkYXRlR2l0aWdub3JlKCkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUpID0+IHtcbiAgICBjb25zdCBnaXRpZ25vcmUgPSAnLy5naXRpZ25vcmUnO1xuICAgIGlmICghaG9zdC5leGlzdHMoZ2l0aWdub3JlKSkge1xuICAgICAgcmV0dXJuIGhvc3Q7XG4gICAgfVxuICAgIGNvbnN0IGdpdElnbm9yZUNvbnRlbnRSYXcgPSBob3N0LnJlYWQoZ2l0aWdub3JlKTtcbiAgICBpZiAoIWdpdElnbm9yZUNvbnRlbnRSYXcpIHtcbiAgICAgIHJldHVybiBob3N0O1xuICAgIH1cbiAgICBjb25zdCBnaXRJZ25vcmVDb250ZW50ID0gZ2l0SWdub3JlQ29udGVudFJhdy50b1N0cmluZygpO1xuICAgIGlmIChnaXRJZ25vcmVDb250ZW50LmluY2x1ZGVzKCdcXG4vYmF6ZWwtb3V0XFxuJykpIHtcbiAgICAgIHJldHVybiBob3N0O1xuICAgIH1cbiAgICBjb25zdCBjb21waWxlZE91dHB1dCA9ICcjIGNvbXBpbGVkIG91dHB1dFxcbic7XG4gICAgY29uc3QgaW5kZXggPSBnaXRJZ25vcmVDb250ZW50LmluZGV4T2YoY29tcGlsZWRPdXRwdXQpO1xuICAgIGNvbnN0IGluc2VydGlvbkluZGV4ID0gaW5kZXggPj0gMCA/IGluZGV4ICsgY29tcGlsZWRPdXRwdXQubGVuZ3RoIDogZ2l0SWdub3JlQ29udGVudC5sZW5ndGg7XG4gICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKGdpdGlnbm9yZSk7XG4gICAgcmVjb3JkZXIuaW5zZXJ0UmlnaHQoaW5zZXJ0aW9uSW5kZXgsICcvYmF6ZWwtb3V0XFxuJyk7XG4gICAgaG9zdC5jb21taXRVcGRhdGUocmVjb3JkZXIpO1xuICAgIHJldHVybiBob3N0O1xuICB9O1xufVxuXG4vKipcbiAqIENoYW5nZSB0aGUgYXJjaGl0ZWN0IGluIGFuZ3VsYXIuanNvbiB0byB1c2UgQmF6ZWwgYnVpbGRlci5cbiAqL1xuZnVuY3Rpb24gdXBkYXRlQW5ndWxhckpzb25Ub1VzZUJhemVsQnVpbGRlcihvcHRpb25zOiBTY2hlbWEpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgY29uc3QgbmFtZSA9IG9wdGlvbnMubmFtZSAhO1xuICAgIGNvbnN0IHdvcmtzcGFjZVBhdGggPSBnZXRXb3Jrc3BhY2VQYXRoKGhvc3QpO1xuICAgIGlmICghd29ya3NwYWNlUGF0aCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgZmluZCBhbmd1bGFyLmpzb24nKTtcbiAgICB9XG4gICAgY29uc3Qgd29ya3NwYWNlQ29udGVudCA9IGhvc3QucmVhZCh3b3Jrc3BhY2VQYXRoKTtcbiAgICBpZiAoIXdvcmtzcGFjZUNvbnRlbnQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIHJlYWQgYW5ndWxhci5qc29uIGNvbnRlbnQnKTtcbiAgICB9XG4gICAgY29uc3Qgd29ya3NwYWNlSnNvbkFzdCA9IHBhcnNlSnNvbkFzdCh3b3Jrc3BhY2VDb250ZW50LnRvU3RyaW5nKCkpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgY29uc3QgcHJvamVjdHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdCh3b3Jrc3BhY2VKc29uQXN0LCAncHJvamVjdHMnKTtcbiAgICBpZiAoIXByb2plY3RzKSB7XG4gICAgICB0aHJvdyBuZXcgU2NoZW1hdGljc0V4Y2VwdGlvbignRXhwZWN0IHByb2plY3RzIGluIGFuZ3VsYXIuanNvbiB0byBiZSBhbiBPYmplY3QnKTtcbiAgICB9XG4gICAgY29uc3QgcHJvamVjdCA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KHByb2plY3RzIGFzIEpzb25Bc3RPYmplY3QsIG5hbWUpO1xuICAgIGlmICghcHJvamVjdCkge1xuICAgICAgdGhyb3cgbmV3IFNjaGVtYXRpY3NFeGNlcHRpb24oYEV4cGVjdGVkIHByb2plY3RzIHRvIGNvbnRhaW4gJHtuYW1lfWApO1xuICAgIH1cbiAgICBjb25zdCByZWNvcmRlciA9IGhvc3QuYmVnaW5VcGRhdGUod29ya3NwYWNlUGF0aCk7XG4gICAgY29uc3QgaW5kZW50ID0gODtcbiAgICBjb25zdCBhcmNoaXRlY3QgPVxuICAgICAgICBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChwcm9qZWN0IGFzIEpzb25Bc3RPYmplY3QsICdhcmNoaXRlY3QnKSBhcyBKc29uQXN0T2JqZWN0O1xuICAgIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0KFxuICAgICAgICByZWNvcmRlciwgYXJjaGl0ZWN0LCAnYnVpbGQnLCB7XG4gICAgICAgICAgYnVpbGRlcjogJ0Bhbmd1bGFyL2JhemVsOmJ1aWxkJyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vc3JjOnByb2RhcHAnLFxuICAgICAgICAgICAgYmF6ZWxDb21tYW5kOiAnYnVpbGQnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgY29uZmlndXJhdGlvbnM6IHtcbiAgICAgICAgICAgIHByb2R1Y3Rpb246IHtcbiAgICAgICAgICAgICAgdGFyZ2V0TGFiZWw6ICcvL3NyYzpwcm9kYXBwJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgaW5kZW50KTtcbiAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChcbiAgICAgICAgcmVjb3JkZXIsIGFyY2hpdGVjdCwgJ3NlcnZlJywge1xuICAgICAgICAgIGJ1aWxkZXI6ICdAYW5ndWxhci9iYXplbDpidWlsZCcsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgdGFyZ2V0TGFiZWw6ICcvL3NyYzpkZXZzZXJ2ZXInLFxuICAgICAgICAgICAgYmF6ZWxDb21tYW5kOiAncnVuJyxcbiAgICAgICAgICAgIHdhdGNoOiB0cnVlLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgY29uZmlndXJhdGlvbnM6IHtcbiAgICAgICAgICAgIHByb2R1Y3Rpb246IHtcbiAgICAgICAgICAgICAgdGFyZ2V0TGFiZWw6ICcvL3NyYzpwcm9kc2VydmVyJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgaW5kZW50KTtcblxuICAgIGlmIChmaW5kUHJvcGVydHlJbkFzdE9iamVjdChhcmNoaXRlY3QsICd0ZXN0JykpIHtcbiAgICAgIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0KFxuICAgICAgICAgIHJlY29yZGVyLCBhcmNoaXRlY3QsICd0ZXN0Jywge1xuICAgICAgICAgICAgYnVpbGRlcjogJ0Bhbmd1bGFyL2JhemVsOmJ1aWxkJyxcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgYmF6ZWxDb21tYW5kOiAndGVzdCcsXG4gICAgICAgICAgICAgIHRhcmdldExhYmVsOiAnLy9zcmM6dGVzdCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgaW5kZW50KTtcbiAgICB9XG5cbiAgICBjb25zdCBlMmVBcmNoaXRlY3QgPSBmaW5kRTJlQXJjaGl0ZWN0KHdvcmtzcGFjZUpzb25Bc3QsIG5hbWUpO1xuICAgIGlmIChlMmVBcmNoaXRlY3QgJiYgZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoZTJlQXJjaGl0ZWN0LCAnZTJlJykpIHtcbiAgICAgIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0KFxuICAgICAgICAgIHJlY29yZGVyLCBlMmVBcmNoaXRlY3QsICdlMmUnLCB7XG4gICAgICAgICAgICBidWlsZGVyOiAnQGFuZ3VsYXIvYmF6ZWw6YnVpbGQnLFxuICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICBiYXplbENvbW1hbmQ6ICd0ZXN0JyxcbiAgICAgICAgICAgICAgdGFyZ2V0TGFiZWw6ICcvL2UyZTpkZXZzZXJ2ZXJfdGVzdCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY29uZmlndXJhdGlvbnM6IHtcbiAgICAgICAgICAgICAgcHJvZHVjdGlvbjoge1xuICAgICAgICAgICAgICAgIHRhcmdldExhYmVsOiAnLy9lMmU6cHJvZHNlcnZlcl90ZXN0JyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LFxuICAgICAgICAgIGluZGVudCk7XG4gICAgfVxuXG4gICAgaG9zdC5jb21taXRVcGRhdGUocmVjb3JkZXIpO1xuICAgIHJldHVybiBob3N0O1xuICB9O1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIGJhY2t1cCBmb3IgdGhlIG9yaWdpbmFsIGFuZ3VsYXIuanNvbiBmaWxlIGluIGNhc2UgdXNlciB3YW50cyB0b1xuICogZWplY3QgQmF6ZWwgYW5kIHJldmVydCB0byB0aGUgb3JpZ2luYWwgd29ya2Zsb3cuXG4gKi9cbmZ1bmN0aW9uIGJhY2t1cEFuZ3VsYXJKc29uKCk6IFJ1bGUge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBjb25zdCB3b3Jrc3BhY2VQYXRoID0gZ2V0V29ya3NwYWNlUGF0aChob3N0KTtcbiAgICBpZiAoIXdvcmtzcGFjZVBhdGgpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaG9zdC5jcmVhdGUoXG4gICAgICAgIGAke3dvcmtzcGFjZVBhdGh9LmJha2AsICcvLyBUaGlzIGlzIGEgYmFja3VwIGZpbGUgb2YgdGhlIG9yaWdpbmFsIGFuZ3VsYXIuanNvbi4gJyArXG4gICAgICAgICAgICAnVGhpcyBmaWxlIGlzIG5lZWRlZCBpbiBjYXNlIHlvdSB3YW50IHRvIHJldmVydCB0byB0aGUgd29ya2Zsb3cgd2l0aG91dCBCYXplbC5cXG5cXG4nICtcbiAgICAgICAgICAgIGhvc3QucmVhZCh3b3Jrc3BhY2VQYXRoKSk7XG4gIH07XG59XG5cbi8qKlxuICogQGFuZ3VsYXIvYmF6ZWwgcmVxdWlyZXMgbWluaW11bSB2ZXJzaW9uIG9mIHJ4anMgdG8gYmUgNi40LjAuIFRoaXMgZnVuY3Rpb25cbiAqIHVwZ3JhZGVzIHRoZSB2ZXJzaW9uIG9mIHJ4anMgaW4gcGFja2FnZS5qc29uIGlmIG5lY2Vzc2FyeS5cbiAqL1xuZnVuY3Rpb24gdXBncmFkZVJ4anMoKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSwgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCkgPT4ge1xuICAgIGNvbnN0IHBhY2thZ2VKc29uID0gJ3BhY2thZ2UuanNvbic7XG4gICAgaWYgKCFob3N0LmV4aXN0cyhwYWNrYWdlSnNvbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IGZpbmQgJHtwYWNrYWdlSnNvbn1gKTtcbiAgICB9XG4gICAgY29uc3QgY29udGVudCA9IGhvc3QucmVhZChwYWNrYWdlSnNvbik7XG4gICAgaWYgKCFjb250ZW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byByZWFkIHBhY2thZ2UuanNvbiBjb250ZW50Jyk7XG4gICAgfVxuICAgIGNvbnN0IGpzb25Bc3QgPSBwYXJzZUpzb25Bc3QoY29udGVudC50b1N0cmluZygpKTtcbiAgICBpZiAoIWlzSnNvbkFzdE9iamVjdChqc29uQXN0KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gcGFyc2UgSlNPTiBmb3IgJHtwYWNrYWdlSnNvbn1gKTtcbiAgICB9XG4gICAgY29uc3QgZGVwcyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGpzb25Bc3QsICdkZXBlbmRlbmNpZXMnKTtcbiAgICBpZiAoIWlzSnNvbkFzdE9iamVjdChkZXBzKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gZmluZCBkZXBlbmRlbmNpZXMgaW4gJHtwYWNrYWdlSnNvbn1gKTtcbiAgICB9XG4gICAgY29uc3QgcnhqcyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGRlcHMsICdyeGpzJyk7XG4gICAgaWYgKCFyeGpzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBmaW5kIHJ4anMgaW4gZGVwZW5kZW5jaWVzIG9mICR7cGFja2FnZUpzb259YCk7XG4gICAgfVxuICAgIGNvbnN0IHZhbHVlID0gcnhqcy52YWx1ZSBhcyBzdHJpbmc7ICAvLyB2YWx1ZSBjYW4gYmUgdmVyc2lvbiBvciByYW5nZVxuICAgIGNvbnN0IG1hdGNoID0gdmFsdWUubWF0Y2goLyhcXGQpK1xcLihcXGQpKy4oXFxkKSskLyk7XG4gICAgaWYgKG1hdGNoKSB7XG4gICAgICBjb25zdCBbXywgbWFqb3IsIG1pbm9yXSA9IG1hdGNoO1xuICAgICAgaWYgKG1ham9yIDwgJzYnIHx8IChtYWpvciA9PT0gJzYnICYmIG1pbm9yIDwgJzQnKSkge1xuICAgICAgICBjb25zdCByZWNvcmRlciA9IGhvc3QuYmVnaW5VcGRhdGUocGFja2FnZUpzb24pO1xuICAgICAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChyZWNvcmRlciwgZGVwcywgJ3J4anMnLCAnfjYuNC4wJyk7XG4gICAgICAgIGhvc3QuY29tbWl0VXBkYXRlKHJlY29yZGVyKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29udGV4dC5sb2dnZXIuaW5mbyhcbiAgICAgICAgICAnQ291bGQgbm90IGRldGVybWluZSB2ZXJzaW9uIG9mIHJ4anMuIFxcbicgK1xuICAgICAgICAgICdQbGVhc2UgbWFrZSBzdXJlIHRoYXQgdmVyc2lvbiBpcyBhdCBsZWFzdCA2LjQuMC4nKTtcbiAgICB9XG4gICAgcmV0dXJuIGhvc3Q7XG4gIH07XG59XG5cbi8qKlxuICogV2hlbiB1c2luZyBBbmd1bGFyIE5QTSBwYWNrYWdlcyBhbmQgYnVpbGRpbmcgd2l0aCBBT1QgY29tcGlsYXRpb24sIG5nY1xuICogcmVxdWlyZXMgbmdzdW1hbXJ5IGZpbGVzIGJ1dCB0aGV5IGFyZSBub3Qgc2hpcHBlZC4gVGhpcyBmdW5jdGlvbiBhZGRzIGFcbiAqIHBvc3RpbnN0YWxsIHN0ZXAgdG8gZ2VuZXJhdGUgdGhlc2UgZmlsZXMuXG4gKi9cbmZ1bmN0aW9uIGFkZFBvc3RpbnN0YWxsVG9HZW5lcmF0ZU5nU3VtbWFyaWVzKCkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBpZiAoIWhvc3QuZXhpc3RzKCdhbmd1bGFyLW1ldGFkYXRhLnRzY29uZmlnLmpzb24nKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBwYWNrYWdlSnNvbiA9ICdwYWNrYWdlLmpzb24nO1xuICAgIGlmICghaG9zdC5leGlzdHMocGFja2FnZUpzb24pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBmaW5kICR7cGFja2FnZUpzb259YCk7XG4gICAgfVxuICAgIGNvbnN0IGNvbnRlbnQgPSBob3N0LnJlYWQocGFja2FnZUpzb24pO1xuICAgIGlmICghY29udGVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gcmVhZCBwYWNrYWdlLmpzb24gY29udGVudCcpO1xuICAgIH1cbiAgICBjb25zdCBqc29uQXN0ID0gcGFyc2VKc29uQXN0KGNvbnRlbnQudG9TdHJpbmcoKSk7XG4gICAgaWYgKCFpc0pzb25Bc3RPYmplY3QoanNvbkFzdCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIHBhcnNlIEpTT04gZm9yICR7cGFja2FnZUpzb259YCk7XG4gICAgfVxuICAgIGNvbnN0IHNjcmlwdHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChqc29uQXN0LCAnc2NyaXB0cycpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKHBhY2thZ2VKc29uKTtcbiAgICBpZiAoc2NyaXB0cykge1xuICAgICAgaW5zZXJ0UHJvcGVydHlJbkFzdE9iamVjdEluT3JkZXIoXG4gICAgICAgICAgcmVjb3JkZXIsIHNjcmlwdHMsICdwb3N0aW5zdGFsbCcsICduZ2MgLXAgLi9hbmd1bGFyLW1ldGFkYXRhLnRzY29uZmlnLmpzb24nLCA0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgaW5zZXJ0UHJvcGVydHlJbkFzdE9iamVjdEluT3JkZXIoXG4gICAgICAgICAgcmVjb3JkZXIsIGpzb25Bc3QsICdzY3JpcHRzJywge1xuICAgICAgICAgICAgcG9zdGluc3RhbGw6ICduZ2MgLXAgLi9hbmd1bGFyLW1ldGFkYXRhLnRzY29uZmlnLmpzb24nLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgMik7XG4gICAgfVxuICAgIGhvc3QuY29tbWl0VXBkYXRlKHJlY29yZGVyKTtcbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuLyoqXG4gKiBTY2hlZHVsZSBhIHRhc2sgdG8gcGVyZm9ybSBucG0gLyB5YXJuIGluc3RhbGwuXG4gKi9cbmZ1bmN0aW9uIGluc3RhbGxOb2RlTW9kdWxlcyhvcHRpb25zOiBTY2hlbWEpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgaWYgKCFvcHRpb25zLnNraXBJbnN0YWxsKSB7XG4gICAgICBjb250ZXh0LmFkZFRhc2sobmV3IE5vZGVQYWNrYWdlSW5zdGFsbFRhc2soKSk7XG4gICAgfVxuICB9O1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbihvcHRpb25zOiBTY2hlbWEpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgb3B0aW9ucy5uYW1lID0gb3B0aW9ucy5uYW1lIHx8IGdldFdvcmtzcGFjZShob3N0KS5kZWZhdWx0UHJvamVjdDtcbiAgICBpZiAoIW9wdGlvbnMubmFtZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdQbGVhc2Ugc3BlY2lmeSBhIHByb2plY3QgdXNpbmcgXCItLW5hbWUgcHJvamVjdC1uYW1lXCInKTtcbiAgICB9XG4gICAgdmFsaWRhdGVQcm9qZWN0TmFtZShvcHRpb25zLm5hbWUpO1xuXG4gICAgcmV0dXJuIGNoYWluKFtcbiAgICAgIGFkZEZpbGVzUmVxdWlyZWRCeUJhemVsKG9wdGlvbnMpLFxuICAgICAgYWRkRGV2RGVwZW5kZW5jaWVzVG9QYWNrYWdlSnNvbihvcHRpb25zKSxcbiAgICAgIGFkZFBvc3RpbnN0YWxsVG9HZW5lcmF0ZU5nU3VtbWFyaWVzKCksXG4gICAgICBiYWNrdXBBbmd1bGFySnNvbigpLFxuICAgICAgdXBkYXRlQW5ndWxhckpzb25Ub1VzZUJhemVsQnVpbGRlcihvcHRpb25zKSxcbiAgICAgIHVwZGF0ZUdpdGlnbm9yZSgpLFxuICAgICAgdXBncmFkZVJ4anMoKSxcbiAgICAgIGluc3RhbGxOb2RlTW9kdWxlcyhvcHRpb25zKSxcbiAgICBdKTtcbiAgfTtcbn1cbiJdfQ==
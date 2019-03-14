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
                '@angular/upgrade': angularCoreVersion,
                '@bazel/bazel': '^0.23.0',
                '@bazel/ibazel': '^0.9.0',
                '@bazel/karma': '^0.26.0',
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvc2NoZW1hdGljcy9uZy1hZGQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCw2Q0FBMEU7SUFDMUUseURBQTRKO0lBQzVKLDZEQUFvRTtJQUNwRSxxRUFBaUg7SUFDakgscUVBQTJFO0lBQzNFLCtFQUE2RztJQUc3Rzs7OztPQUlHO0lBQ0gsU0FBUywrQkFBK0IsQ0FBQyxPQUFlO1FBQ3RELE9BQU8sVUFBQyxJQUFVOztZQUNoQixJQUFNLFdBQVcsR0FBRyxjQUFjLENBQUM7WUFDbkMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsV0FBVyxDQUFDLEVBQUU7Z0JBQzdCLE1BQU0sSUFBSSxLQUFLLENBQUMsb0JBQWtCLFdBQWEsQ0FBQyxDQUFDO2FBQ2xEO1lBQ0QsSUFBTSxrQkFBa0IsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQ2xELElBQUksQ0FBQyxrQkFBa0IsRUFBRTtnQkFDdkIsTUFBTSxJQUFJLEtBQUssQ0FBQyxxQ0FBcUMsQ0FBQyxDQUFDO2FBQ3hEO1lBQ0QsSUFBTSxPQUFPLEdBQUcsbUJBQVksQ0FBQyxrQkFBa0IsQ0FBQyxRQUFRLEVBQUUsQ0FBa0IsQ0FBQztZQUM3RSxJQUFNLElBQUksR0FBRyxvQ0FBdUIsQ0FBQyxPQUFPLEVBQUUsY0FBYyxDQUFrQixDQUFDO1lBQy9FLElBQU0sT0FBTyxHQUFHLG9DQUF1QixDQUFDLE9BQU8sRUFBRSxpQkFBaUIsQ0FBa0IsQ0FBQztZQUVyRixJQUFNLGVBQWUsR0FBRyxvQ0FBdUIsQ0FBQyxJQUFJLEVBQUUsZUFBZSxDQUFDLENBQUM7WUFDdkUsSUFBSSxDQUFDLGVBQWUsRUFBRTtnQkFDcEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxvREFBb0QsQ0FB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LENBQUMsQ0FBQztZQUMvQyxJQUFJLE9BQU8sRUFBRTtnQkFDWCw2Q0FBZ0MsQ0FDNUIsUUFBUSxFQUFFLE9BQU8sRUFBRSxhQUFhLEVBQUUseUNBQXlDLEVBQUUsQ0FBQyxDQUFDLENBQUM7YUFDckY7aUJBQU07Z0JBQ0wsNkNBQWdDLENBQzVCLFFBQVEsRUFBRSxPQUFPLEVBQUUsU0FBUyxFQUFFO29CQUM1QixXQUFXLEVBQUUseUNBQXlDO2lCQUN2RCxFQUNELENBQUMsQ0FBQyxDQUFDO2FBQ1I7WUFDRCxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQzVCLE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVELG1CQUF3QixPQUFlO1FBQ3JDLE9BQU8sVUFBQyxJQUFVO1lBQ2hCLGdDQUFtQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUVsQyxPQUFPLGtCQUFLLENBQUM7Z0JBQ1gsdUJBQXVCLENBQUMsT0FBTyxDQUFDO2dCQUNoQywrQkFBK0IsQ0FBQyxPQUFPLENBQUM7Z0JBQ3hDLG1DQUFtQyxFQUFFO2dCQUNyQyxpQkFBaUIsRUFBRTtnQkFDbkIsa0JBQWtCLEVBQUU7Z0JBQ3BCLGtDQUFrQyxDQUFDLE9BQU8sQ0FBQztnQkFDM0MsZUFBZSxFQUFFO2dCQUNqQixrQkFBa0IsRUFBRTtnQkFDcEIsV0FBVyxFQUFFO2FBQ2QsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQWhCRCw0QkFnQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICpcbiAqIEBmaWxlb3ZlcnZpZXcgU2NoZW1hdGljcyBmb3IgbmctbmV3IHByb2plY3QgdGhhdCBidWlsZHMgd2l0aCBCYXplbC5cbiAqL1xuXG5pbXBvcnQge0pzb25Bc3RPYmplY3QsIHBhcnNlSnNvbkFzdCwgc3RyaW5nc30gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHtSdWxlLCBTY2hlbWF0aWNDb250ZXh0LCBTY2hlbWF0aWNzRXhjZXB0aW9uLCBUcmVlLCBhcHBseSwgYXBwbHlUZW1wbGF0ZXMsIGNoYWluLCBtZXJnZVdpdGgsIG1vdmUsIHNjaGVtYXRpYywgdXJsfSBmcm9tICdAYW5ndWxhci1kZXZraXQvc2NoZW1hdGljcyc7XG5pbXBvcnQge2dldFdvcmtzcGFjZVBhdGh9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS9jb25maWcnO1xuaW1wb3J0IHtmaW5kUHJvcGVydHlJbkFzdE9iamVjdCwgaW5zZXJ0UHJvcGVydHlJbkFzdE9iamVjdEluT3JkZXJ9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS9qc29uLXV0aWxzJztcbmltcG9ydCB7dmFsaWRhdGVQcm9qZWN0TmFtZX0gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L3ZhbGlkYXRpb24nO1xuaW1wb3J0IHtpc0pzb25Bc3RPYmplY3QsIHJlbW92ZUtleVZhbHVlSW5Bc3RPYmplY3QsIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0fSBmcm9tICcuLi91dGlsaXR5L2pzb24tdXRpbHMnO1xuaW1wb3J0IHtTY2hlbWF9IGZyb20gJy4vc2NoZW1hJztcblxuLyoqXG4gKiBQYWNrYWdlcyB0aGF0IGJ1aWxkIHVuZGVyIEJhemVsIHJlcXVpcmUgYWRkaXRpb25hbCBkZXYgZGVwZW5kZW5jaWVzLiBUaGlzXG4gKiBmdW5jdGlvbiBhZGRzIHRob3NlIGRlcGVuZGVuY2llcyB0byBcImRldkRlcGVuZGVuY2llc1wiIHNlY3Rpb24gaW5cbiAqIHBhY2thZ2UuanNvbi5cbiAqL1xuZnVuY3Rpb24gYWRkRGV2RGVwZW5kZW5jaWVzVG9QYWNrYWdlSnNvbihvcHRpb25zOiBTY2hlbWEpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgY29uc3QgcGFja2FnZUpzb24gPSAncGFja2FnZS5qc29uJztcbiAgICBpZiAoIWhvc3QuZXhpc3RzKHBhY2thZ2VKc29uKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgZmluZCAke3BhY2thZ2VKc29ufWApO1xuICAgIH1cbiAgICBjb25zdCBwYWNrYWdlSnNvbkNvbnRlbnQgPSBob3N0LnJlYWQocGFja2FnZUpzb24pO1xuICAgIGlmICghcGFja2FnZUpzb25Db250ZW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byByZWFkIHBhY2thZ2UuanNvbiBjb250ZW50Jyk7XG4gICAgfVxuICAgIGNvbnN0IGpzb25Bc3QgPSBwYXJzZUpzb25Bc3QocGFja2FnZUpzb25Db250ZW50LnRvU3RyaW5nKCkpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgY29uc3QgZGVwcyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGpzb25Bc3QsICdkZXBlbmRlbmNpZXMnKSBhcyBKc29uQXN0T2JqZWN0O1xuICAgIGNvbnN0IGRldkRlcHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChqc29uQXN0LCAnZGV2RGVwZW5kZW5jaWVzJykgYXMgSnNvbkFzdE9iamVjdDtcblxuICAgIGNvbnN0IGFuZ3VsYXJDb3JlTm9kZSA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGRlcHMsICdAYW5ndWxhci9jb3JlJyk7XG4gICAgaWYgKCFhbmd1bGFyQ29yZU5vZGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQGFuZ3VsYXIvY29yZSBkZXBlbmRlbmN5IG5vdCBmb3VuZCBpbiBwYWNrYWdlLmpzb24nKTtcbiAgICB9XG4gICAgY29uc3QgYW5ndWxhckNvcmVWZXJzaW9uID0gYW5ndWxhckNvcmVOb2RlLnZhbHVlIGFzIHN0cmluZztcblxuICAgIGNvbnN0IGRldkRlcGVuZGVuY2llczoge1trOiBzdHJpbmddOiBzdHJpbmd9ID0ge1xuICAgICAgJ0Bhbmd1bGFyL2JhemVsJzogYW5ndWxhckNvcmVWZXJzaW9uLFxuICAgICAgJ0Bhbmd1bGFyL3VwZ3JhZGUnOiBhbmd1bGFyQ29yZVZlcnNpb24sXG4gICAgICAnQGJhemVsL2JhemVsJzogJ14wLjIzLjAnLFxuICAgICAgJ0BiYXplbC9pYmF6ZWwnOiAnXjAuOS4wJyxcbiAgICAgICdAYmF6ZWwva2FybWEnOiAnXjAuMjYuMCcsXG4gICAgfTtcblxuICAgIGNvbnN0IHJlY29yZGVyID0gaG9zdC5iZWdpblVwZGF0ZShwYWNrYWdlSnNvbik7XG4gICAgZm9yIChjb25zdCBwYWNrYWdlTmFtZSBvZiBPYmplY3Qua2V5cyhkZXZEZXBlbmRlbmNpZXMpKSB7XG4gICAgICBjb25zdCB2ZXJzaW9uID0gZGV2RGVwZW5kZW5jaWVzW3BhY2thZ2VOYW1lXTtcbiAgICAgIGNvbnN0IGluZGVudCA9IDQ7XG4gICAgICBpbnNlcnRQcm9wZXJ0eUluQXN0T2JqZWN0SW5PcmRlcihyZWNvcmRlciwgZGV2RGVwcywgcGFja2FnZU5hbWUsIHZlcnNpb24sIGluZGVudCk7XG4gICAgfVxuICAgIGhvc3QuY29tbWl0VXBkYXRlKHJlY29yZGVyKTtcbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuLyoqXG4gKiBBcHBlbmQgYWRkaXRpb25hbCBKYXZhc2NyaXB0IC8gVHlwZXNjcmlwdCBmaWxlcyBuZWVkZWQgdG8gY29tcGlsZSBhbiBBbmd1bGFyXG4gKiBwcm9qZWN0IHVuZGVyIEJhemVsLlxuICovXG5mdW5jdGlvbiBhZGRGaWxlc1JlcXVpcmVkQnlCYXplbChvcHRpb25zOiBTY2hlbWEpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgcmV0dXJuIG1lcmdlV2l0aChhcHBseSh1cmwoJy4vZmlsZXMnKSwgW1xuICAgICAgYXBwbHlUZW1wbGF0ZXMoe30pLFxuICAgIF0pKTtcbiAgfTtcbn1cblxuLyoqXG4gKiBBcHBlbmQgJy9iYXplbC1vdXQnIHRvIHRoZSBnaXRpZ25vcmUgZmlsZS5cbiAqL1xuZnVuY3Rpb24gdXBkYXRlR2l0aWdub3JlKCkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUpID0+IHtcbiAgICBjb25zdCBnaXRpZ25vcmUgPSAnLy5naXRpZ25vcmUnO1xuICAgIGlmICghaG9zdC5leGlzdHMoZ2l0aWdub3JlKSkge1xuICAgICAgcmV0dXJuIGhvc3Q7XG4gICAgfVxuICAgIGNvbnN0IGdpdElnbm9yZUNvbnRlbnRSYXcgPSBob3N0LnJlYWQoZ2l0aWdub3JlKTtcbiAgICBpZiAoIWdpdElnbm9yZUNvbnRlbnRSYXcpIHtcbiAgICAgIHJldHVybiBob3N0O1xuICAgIH1cbiAgICBjb25zdCBnaXRJZ25vcmVDb250ZW50ID0gZ2l0SWdub3JlQ29udGVudFJhdy50b1N0cmluZygpO1xuICAgIGlmIChnaXRJZ25vcmVDb250ZW50LmluY2x1ZGVzKCdcXG4vYmF6ZWwtb3V0XFxuJykpIHtcbiAgICAgIHJldHVybiBob3N0O1xuICAgIH1cbiAgICBjb25zdCBjb21waWxlZE91dHB1dCA9ICcjIGNvbXBpbGVkIG91dHB1dFxcbic7XG4gICAgY29uc3QgaW5kZXggPSBnaXRJZ25vcmVDb250ZW50LmluZGV4T2YoY29tcGlsZWRPdXRwdXQpO1xuICAgIGNvbnN0IGluc2VydGlvbkluZGV4ID0gaW5kZXggPj0gMCA/IGluZGV4ICsgY29tcGlsZWRPdXRwdXQubGVuZ3RoIDogZ2l0SWdub3JlQ29udGVudC5sZW5ndGg7XG4gICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKGdpdGlnbm9yZSk7XG4gICAgcmVjb3JkZXIuaW5zZXJ0UmlnaHQoaW5zZXJ0aW9uSW5kZXgsICcvYmF6ZWwtb3V0XFxuJyk7XG4gICAgaG9zdC5jb21taXRVcGRhdGUocmVjb3JkZXIpO1xuICAgIHJldHVybiBob3N0O1xuICB9O1xufVxuXG5mdW5jdGlvbiB1cGRhdGVBbmd1bGFySnNvblRvVXNlQmF6ZWxCdWlsZGVyKG9wdGlvbnM6IFNjaGVtYSk6IFJ1bGUge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBjb25zdCB7bmFtZX0gPSBvcHRpb25zO1xuICAgIGNvbnN0IHdvcmtzcGFjZVBhdGggPSBnZXRXb3Jrc3BhY2VQYXRoKGhvc3QpO1xuICAgIGlmICghd29ya3NwYWNlUGF0aCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgZmluZCBhbmd1bGFyLmpzb24nKTtcbiAgICB9XG4gICAgY29uc3Qgd29ya3NwYWNlQ29udGVudCA9IGhvc3QucmVhZCh3b3Jrc3BhY2VQYXRoKTtcbiAgICBpZiAoIXdvcmtzcGFjZUNvbnRlbnQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIHJlYWQgYW5ndWxhci5qc29uIGNvbnRlbnQnKTtcbiAgICB9XG4gICAgY29uc3Qgd29ya3NwYWNlSnNvbkFzdCA9IHBhcnNlSnNvbkFzdCh3b3Jrc3BhY2VDb250ZW50LnRvU3RyaW5nKCkpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgY29uc3QgcHJvamVjdHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdCh3b3Jrc3BhY2VKc29uQXN0LCAncHJvamVjdHMnKTtcbiAgICBpZiAoIXByb2plY3RzKSB7XG4gICAgICB0aHJvdyBuZXcgU2NoZW1hdGljc0V4Y2VwdGlvbignRXhwZWN0IHByb2plY3RzIGluIGFuZ3VsYXIuanNvbiB0byBiZSBhbiBPYmplY3QnKTtcbiAgICB9XG4gICAgY29uc3QgcHJvamVjdCA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KHByb2plY3RzIGFzIEpzb25Bc3RPYmplY3QsIG5hbWUpO1xuICAgIGlmICghcHJvamVjdCkge1xuICAgICAgdGhyb3cgbmV3IFNjaGVtYXRpY3NFeGNlcHRpb24oYEV4cGVjdGVkIHByb2plY3RzIHRvIGNvbnRhaW4gJHtuYW1lfWApO1xuICAgIH1cbiAgICBjb25zdCByZWNvcmRlciA9IGhvc3QuYmVnaW5VcGRhdGUod29ya3NwYWNlUGF0aCk7XG4gICAgY29uc3QgaW5kZW50ID0gODtcbiAgICBjb25zdCBhcmNoaXRlY3QgPVxuICAgICAgICBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChwcm9qZWN0IGFzIEpzb25Bc3RPYmplY3QsICdhcmNoaXRlY3QnKSBhcyBKc29uQXN0T2JqZWN0O1xuICAgIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0KFxuICAgICAgICByZWNvcmRlciwgYXJjaGl0ZWN0LCAnYnVpbGQnLCB7XG4gICAgICAgICAgYnVpbGRlcjogJ0Bhbmd1bGFyL2JhemVsOmJ1aWxkJyxcbiAgICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vc3JjOnByb2RhcHAnLFxuICAgICAgICAgICAgYmF6ZWxDb21tYW5kOiAnYnVpbGQnLFxuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgICAgaW5kZW50KTtcbiAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChcbiAgICAgICAgcmVjb3JkZXIsIGFyY2hpdGVjdCwgJ3NlcnZlJywge1xuICAgICAgICAgIGJ1aWxkZXI6ICdAYW5ndWxhci9iYXplbDpidWlsZCcsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgdGFyZ2V0TGFiZWw6ICcvL3NyYzpkZXZzZXJ2ZXInLFxuICAgICAgICAgICAgYmF6ZWxDb21tYW5kOiAncnVuJyxcbiAgICAgICAgICAgIHdhdGNoOiB0cnVlLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgY29uZmlndXJhdGlvbnM6IHtcbiAgICAgICAgICAgIHByb2R1Y3Rpb246IHtcbiAgICAgICAgICAgICAgdGFyZ2V0TGFiZWw6ICcvL3NyYzpwcm9kc2VydmVyJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgaW5kZW50KTtcbiAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChcbiAgICAgICAgcmVjb3JkZXIsIGFyY2hpdGVjdCwgJ3Rlc3QnLCB7XG4gICAgICAgICAgYnVpbGRlcjogJ0Bhbmd1bGFyL2JhemVsOmJ1aWxkJyxcbiAgICAgICAgICBvcHRpb25zOiB7J2JhemVsQ29tbWFuZCc6ICd0ZXN0JywgJ3RhcmdldExhYmVsJzogJy8vc3JjLy4uLid9LFxuICAgICAgICB9LFxuICAgICAgICBpbmRlbnQpO1xuXG4gICAgY29uc3QgZTJlID0gYCR7b3B0aW9ucy5uYW1lfS1lMmVgO1xuICAgIGNvbnN0IGUyZU5vZGUgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChwcm9qZWN0cyBhcyBKc29uQXN0T2JqZWN0LCBlMmUpO1xuICAgIGlmIChlMmVOb2RlKSB7XG4gICAgICBjb25zdCBhcmNoaXRlY3QgPVxuICAgICAgICAgIGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGUyZU5vZGUgYXMgSnNvbkFzdE9iamVjdCwgJ2FyY2hpdGVjdCcpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChcbiAgICAgICAgICByZWNvcmRlciwgYXJjaGl0ZWN0LCAnZTJlJywge1xuICAgICAgICAgICAgYnVpbGRlcjogJ0Bhbmd1bGFyL2JhemVsOmJ1aWxkJyxcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgICAgYmF6ZWxDb21tYW5kOiAndGVzdCcsXG4gICAgICAgICAgICAgIHRhcmdldExhYmVsOiAnLy9lMmU6ZGV2c2VydmVyX3Rlc3QnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGNvbmZpZ3VyYXRpb25zOiB7XG4gICAgICAgICAgICAgIHByb2R1Y3Rpb246IHtcbiAgICAgICAgICAgICAgICB0YXJnZXRMYWJlbDogJy8vZTJlOnByb2RzZXJ2ZXJfdGVzdCcsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICBpbmRlbnQpO1xuICAgIH1cblxuICAgIGhvc3QuY29tbWl0VXBkYXRlKHJlY29yZGVyKTtcbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuLyoqXG4gKiBDcmVhdGUgYSBiYWNrdXAgZm9yIHRoZSBvcmlnaW5hbCBhbmd1bGFyLmpzb24gZmlsZSBpbiBjYXNlIHVzZXIgd2FudHMgdG9cbiAqIGVqZWN0IEJhemVsIGFuZCByZXZlcnQgdG8gdGhlIG9yaWdpbmFsIHdvcmtmbG93LlxuICovXG5mdW5jdGlvbiBiYWNrdXBBbmd1bGFySnNvbigpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgY29uc3Qgd29ya3NwYWNlUGF0aCA9IGdldFdvcmtzcGFjZVBhdGgoaG9zdCk7XG4gICAgaWYgKCF3b3Jrc3BhY2VQYXRoKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGhvc3QuY3JlYXRlKFxuICAgICAgICBgJHt3b3Jrc3BhY2VQYXRofS5iYWtgLCAnLy8gVGhpcyBpcyBhIGJhY2t1cCBmaWxlIG9mIHRoZSBvcmlnaW5hbCBhbmd1bGFyLmpzb24uICcgK1xuICAgICAgICAgICAgJ1RoaXMgZmlsZSBpcyBuZWVkZWQgaW4gY2FzZSB5b3Ugd2FudCB0byByZXZlcnQgdG8gdGhlIHdvcmtmbG93IHdpdGhvdXQgQmF6ZWwuXFxuXFxuJyArXG4gICAgICAgICAgICBob3N0LnJlYWQod29ya3NwYWNlUGF0aCkpO1xuICB9O1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIGJhY2t1cCBmb3IgdGhlIG9yaWdpbmFsIHRzY29uZmlnLmpzb24gZmlsZSBpbiBjYXNlIHVzZXIgd2FudHMgdG9cbiAqIGVqZWN0IEJhemVsIGFuZCByZXZlcnQgdG8gdGhlIG9yaWdpbmFsIHdvcmtmbG93LlxuICovXG5mdW5jdGlvbiBiYWNrdXBUc2NvbmZpZ0pzb24oKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSwgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCkgPT4ge1xuICAgIGNvbnN0IHRzY29uZmlnUGF0aCA9ICd0c2NvbmZpZy5qc29uJztcbiAgICBpZiAoIWhvc3QuZXhpc3RzKHRzY29uZmlnUGF0aCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaG9zdC5jcmVhdGUoXG4gICAgICAgIGAke3RzY29uZmlnUGF0aH0uYmFrYCwgJy8vIFRoaXMgaXMgYSBiYWNrdXAgZmlsZSBvZiB0aGUgb3JpZ2luYWwgdHNjb25maWcuanNvbi4gJyArXG4gICAgICAgICAgICAnVGhpcyBmaWxlIGlzIG5lZWRlZCBpbiBjYXNlIHlvdSB3YW50IHRvIHJldmVydCB0byB0aGUgd29ya2Zsb3cgd2l0aG91dCBCYXplbC5cXG5cXG4nICtcbiAgICAgICAgICAgIGhvc3QucmVhZCh0c2NvbmZpZ1BhdGgpKTtcbiAgfTtcbn1cblxuLyoqXG4gKiBCYXplbCBjb250cm9scyB0aGUgY29tcGlsYXRpb24gb3B0aW9ucyBvZiB0c2MsIHNvIG1hbnkgb3B0aW9ucyBpblxuICogdHNjb25maWcuanNvbiBnZW5lcmF0ZWQgYnkgdGhlIGRlZmF1bHQgQ0xJIHNjaGVtYXRpY3MgYXJlIG5vdCBhcHBsaWNhYmxlLlxuICogVGhpcyBmdW5jdGlvbiB1cGRhdGVzIHRoZSB0c2NvbmZpZy5qc29uIHRvIHJlbW92ZSBCYXplbC1jb250cm9sbGVkXG4gKiBwYXJhbWV0ZXJzLiBUaGlzIHByZXZlbnRzIEJhemVsIGZyb20gcHJpbnRpbmcgb3V0IHdhcm5pbmdzIGFib3V0IG92ZXJyaWRlblxuICogc2V0dGluZ3MuXG4gKi9cbmZ1bmN0aW9uIHVwZGF0ZVRzY29uZmlnSnNvbigpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgY29uc3QgdHNjb25maWdQYXRoID0gJ3RzY29uZmlnLmpzb24nO1xuICAgIGlmICghaG9zdC5leGlzdHModHNjb25maWdQYXRoKSkge1xuICAgICAgcmV0dXJuIGhvc3Q7XG4gICAgfVxuICAgIGNvbnN0IGNvbnRlbnRSYXcgPSBob3N0LnJlYWQodHNjb25maWdQYXRoKS50b1N0cmluZygpO1xuICAgIGlmICghY29udGVudFJhdykge1xuICAgICAgcmV0dXJuIGhvc3Q7XG4gICAgfVxuICAgIGNvbnN0IGNvbnRlbnQgPSBjb250ZW50UmF3LnRvU3RyaW5nKCk7XG4gICAgY29uc3QgYXN0ID0gcGFyc2VKc29uQXN0KGNvbnRlbnQpO1xuICAgIGlmICghaXNKc29uQXN0T2JqZWN0KGFzdCkpIHtcbiAgICAgIHJldHVybiBob3N0O1xuICAgIH1cbiAgICBjb25zdCBjb21waWxlck9wdGlvbnMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChhc3QsICdjb21waWxlck9wdGlvbnMnKTtcbiAgICBpZiAoIWlzSnNvbkFzdE9iamVjdChjb21waWxlck9wdGlvbnMpKSB7XG4gICAgICByZXR1cm4gaG9zdDtcbiAgICB9XG4gICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKHRzY29uZmlnUGF0aCk7XG4gICAgLy8gdGFyZ2V0IGFuZCBtb2R1bGUgYXJlIGNvbnRyb2xsZWQgYnkgZG93bnN0cmVhbSBkZXBlbmRlbmNpZXMsIHN1Y2ggYXNcbiAgICAvLyB0c19kZXZzZXJ2ZXJcbiAgICByZW1vdmVLZXlWYWx1ZUluQXN0T2JqZWN0KHJlY29yZGVyLCBjb250ZW50LCBjb21waWxlck9wdGlvbnMsICd0YXJnZXQnKTtcbiAgICByZW1vdmVLZXlWYWx1ZUluQXN0T2JqZWN0KHJlY29yZGVyLCBjb250ZW50LCBjb21waWxlck9wdGlvbnMsICdtb2R1bGUnKTtcbiAgICAvLyB0eXBlUm9vdHMgaXMgYWx3YXlzIHNldCB0byB0aGUgQHR5cGVzIHN1YmRpcmVjdG9yeSBvZiB0aGUgbm9kZV9tb2R1bGVzXG4gICAgLy8gYXR0cmlidXRlXG4gICAgcmVtb3ZlS2V5VmFsdWVJbkFzdE9iamVjdChyZWNvcmRlciwgY29udGVudCwgY29tcGlsZXJPcHRpb25zLCAndHlwZVJvb3RzJyk7XG4gICAgLy8gcm9vdERpciBhbmQgYmFzZVVybCBhcmUgYWx3YXlzIHRoZSB3b3Jrc3BhY2Ugcm9vdCBkaXJlY3RvcnlcbiAgICByZW1vdmVLZXlWYWx1ZUluQXN0T2JqZWN0KHJlY29yZGVyLCBjb250ZW50LCBjb21waWxlck9wdGlvbnMsICdyb290RGlyJyk7XG4gICAgcmVtb3ZlS2V5VmFsdWVJbkFzdE9iamVjdChyZWNvcmRlciwgY29udGVudCwgY29tcGlsZXJPcHRpb25zLCAnYmFzZVVybCcpO1xuICAgIGhvc3QuY29tbWl0VXBkYXRlKHJlY29yZGVyKTtcbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuLyoqXG4gKiBAYW5ndWxhci9iYXplbCByZXF1aXJlcyBtaW5pbXVtIHZlcnNpb24gb2YgcnhqcyB0byBiZSA2LjQuMC4gVGhpcyBmdW5jdGlvblxuICogdXBncmFkZXMgdGhlIHZlcnNpb24gb2YgcnhqcyBpbiBwYWNrYWdlLmpzb24gaWYgbmVjZXNzYXJ5LlxuICovXG5mdW5jdGlvbiB1cGdyYWRlUnhqcygpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgY29uc3QgcGFja2FnZUpzb24gPSAncGFja2FnZS5qc29uJztcbiAgICBpZiAoIWhvc3QuZXhpc3RzKHBhY2thZ2VKc29uKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgZmluZCAke3BhY2thZ2VKc29ufWApO1xuICAgIH1cbiAgICBjb25zdCBjb250ZW50ID0gaG9zdC5yZWFkKHBhY2thZ2VKc29uKTtcbiAgICBpZiAoIWNvbnRlbnQpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignRmFpbGVkIHRvIHJlYWQgcGFja2FnZS5qc29uIGNvbnRlbnQnKTtcbiAgICB9XG4gICAgY29uc3QganNvbkFzdCA9IHBhcnNlSnNvbkFzdChjb250ZW50LnRvU3RyaW5nKCkpO1xuICAgIGlmICghaXNKc29uQXN0T2JqZWN0KGpzb25Bc3QpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBwYXJzZSBKU09OIGZvciAke3BhY2thZ2VKc29ufWApO1xuICAgIH1cbiAgICBjb25zdCBkZXBzID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoanNvbkFzdCwgJ2RlcGVuZGVuY2llcycpO1xuICAgIGlmICghaXNKc29uQXN0T2JqZWN0KGRlcHMpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBmaW5kIGRlcGVuZGVuY2llcyBpbiAke3BhY2thZ2VKc29ufWApO1xuICAgIH1cbiAgICBjb25zdCByeGpzID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoZGVwcywgJ3J4anMnKTtcbiAgICBpZiAoIXJ4anMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIGZpbmQgcnhqcyBpbiBkZXBlbmRlbmNpZXMgb2YgJHtwYWNrYWdlSnNvbn1gKTtcbiAgICB9XG4gICAgY29uc3QgdmFsdWUgPSByeGpzLnZhbHVlIGFzIHN0cmluZzsgIC8vIHZhbHVlIGNhbiBiZSB2ZXJzaW9uIG9yIHJhbmdlXG4gICAgY29uc3QgbWF0Y2ggPSB2YWx1ZS5tYXRjaCgvKFxcZCkrXFwuKFxcZCkrLihcXGQpKyQvKTtcbiAgICBpZiAobWF0Y2gpIHtcbiAgICAgIGNvbnN0IFtfLCBtYWpvciwgbWlub3JdID0gbWF0Y2g7XG4gICAgICBpZiAobWFqb3IgPCAnNicgfHwgKG1ham9yID09PSAnNicgJiYgbWlub3IgPCAnNCcpKSB7XG4gICAgICAgIGNvbnN0IHJlY29yZGVyID0gaG9zdC5iZWdpblVwZGF0ZShwYWNrYWdlSnNvbik7XG4gICAgICAgIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0KHJlY29yZGVyLCBkZXBzLCAncnhqcycsICd+Ni40LjAnKTtcbiAgICAgICAgaG9zdC5jb21taXRVcGRhdGUocmVjb3JkZXIpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjb250ZXh0LmxvZ2dlci5pbmZvKFxuICAgICAgICAgICdDb3VsZCBub3QgZGV0ZXJtaW5lIHZlcnNpb24gb2Ygcnhqcy4gXFxuJyArXG4gICAgICAgICAgJ1BsZWFzZSBtYWtlIHN1cmUgdGhhdCB2ZXJzaW9uIGlzIGF0IGxlYXN0IDYuNC4wLicpO1xuICAgIH1cbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuLyoqXG4gKiBXaGVuIHVzaW5nIEFuZ3VsYXIgTlBNIHBhY2thZ2VzIGFuZCBidWlsZGluZyB3aXRoIEFPVCBjb21waWxhdGlvbiwgbmdjXG4gKiByZXF1aXJlcyBuZ3N1bWFtcnkgZmlsZXMgYnV0IHRoZXkgYXJlIG5vdCBzaGlwcGVkLiBUaGlzIGZ1bmN0aW9uIGFkZHMgYVxuICogcG9zdGluc3RhbGwgc3RlcCB0byBnZW5lcmF0ZSB0aGVzZSBmaWxlcy5cbiAqL1xuZnVuY3Rpb24gYWRkUG9zdGluc3RhbGxUb0dlbmVyYXRlTmdTdW1tYXJpZXMoKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSwgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCkgPT4ge1xuICAgIGlmICghaG9zdC5leGlzdHMoJ2FuZ3VsYXItbWV0YWRhdGEudHNjb25maWcuanNvbicpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IHBhY2thZ2VKc29uID0gJ3BhY2thZ2UuanNvbic7XG4gICAgaWYgKCFob3N0LmV4aXN0cyhwYWNrYWdlSnNvbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IGZpbmQgJHtwYWNrYWdlSnNvbn1gKTtcbiAgICB9XG4gICAgY29uc3QgY29udGVudCA9IGhvc3QucmVhZChwYWNrYWdlSnNvbik7XG4gICAgaWYgKCFjb250ZW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byByZWFkIHBhY2thZ2UuanNvbiBjb250ZW50Jyk7XG4gICAgfVxuICAgIGNvbnN0IGpzb25Bc3QgPSBwYXJzZUpzb25Bc3QoY29udGVudC50b1N0cmluZygpKTtcbiAgICBpZiAoIWlzSnNvbkFzdE9iamVjdChqc29uQXN0KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gcGFyc2UgSlNPTiBmb3IgJHtwYWNrYWdlSnNvbn1gKTtcbiAgICB9XG4gICAgY29uc3Qgc2NyaXB0cyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGpzb25Bc3QsICdzY3JpcHRzJykgYXMgSnNvbkFzdE9iamVjdDtcbiAgICBjb25zdCByZWNvcmRlciA9IGhvc3QuYmVnaW5VcGRhdGUocGFja2FnZUpzb24pO1xuICAgIGlmIChzY3JpcHRzKSB7XG4gICAgICBpbnNlcnRQcm9wZXJ0eUluQXN0T2JqZWN0SW5PcmRlcihcbiAgICAgICAgICByZWNvcmRlciwgc2NyaXB0cywgJ3Bvc3RpbnN0YWxsJywgJ25nYyAtcCAuL2FuZ3VsYXItbWV0YWRhdGEudHNjb25maWcuanNvbicsIDQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpbnNlcnRQcm9wZXJ0eUluQXN0T2JqZWN0SW5PcmRlcihcbiAgICAgICAgICByZWNvcmRlciwganNvbkFzdCwgJ3NjcmlwdHMnLCB7XG4gICAgICAgICAgICBwb3N0aW5zdGFsbDogJ25nYyAtcCAuL2FuZ3VsYXItbWV0YWRhdGEudHNjb25maWcuanNvbicsXG4gICAgICAgICAgfSxcbiAgICAgICAgICAyKTtcbiAgICB9XG4gICAgaG9zdC5jb21taXRVcGRhdGUocmVjb3JkZXIpO1xuICAgIHJldHVybiBob3N0O1xuICB9O1xufVxuXG5leHBvcnQgZGVmYXVsdCBmdW5jdGlvbihvcHRpb25zOiBTY2hlbWEpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgdmFsaWRhdGVQcm9qZWN0TmFtZShvcHRpb25zLm5hbWUpO1xuXG4gICAgcmV0dXJuIGNoYWluKFtcbiAgICAgIGFkZEZpbGVzUmVxdWlyZWRCeUJhemVsKG9wdGlvbnMpLFxuICAgICAgYWRkRGV2RGVwZW5kZW5jaWVzVG9QYWNrYWdlSnNvbihvcHRpb25zKSxcbiAgICAgIGFkZFBvc3RpbnN0YWxsVG9HZW5lcmF0ZU5nU3VtbWFyaWVzKCksXG4gICAgICBiYWNrdXBBbmd1bGFySnNvbigpLFxuICAgICAgYmFja3VwVHNjb25maWdKc29uKCksXG4gICAgICB1cGRhdGVBbmd1bGFySnNvblRvVXNlQmF6ZWxCdWlsZGVyKG9wdGlvbnMpLFxuICAgICAgdXBkYXRlR2l0aWdub3JlKCksXG4gICAgICB1cGRhdGVUc2NvbmZpZ0pzb24oKSxcbiAgICAgIHVwZ3JhZGVSeGpzKCksXG4gICAgXSk7XG4gIH07XG59XG4iXX0=
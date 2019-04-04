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
        define("npm_angular_bazel/src/schematics/ng-add/index", ["require", "exports", "tslib", "@angular-devkit/core", "@angular-devkit/schematics", "@schematics/angular/utility/config", "@schematics/angular/utility/json-utils", "@schematics/angular/utility/validation", "@angular/bazel/src/schematics/utility/json-utils", "@angular/bazel/src/schematics/utility/workspace-utils"], factory);
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
                '@bazel/karma': '^0.27.10',
                '@bazel/typescript': '^0.27.10',
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvc2NoZW1hdGljcy9uZy1hZGQvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCw2Q0FBaUU7SUFDakUseURBQTJJO0lBQzNJLDZEQUFvRTtJQUNwRSxxRUFBaUg7SUFDakgscUVBQTJFO0lBRTNFLCtFQUE2RztJQUM3Ryx5RkFBNEQ7SUFLNUQ7Ozs7T0FJRztJQUNILFNBQVMsK0JBQStCLENBQUMsT0FBZTtRQUN0RCxPQUFPLFVBQUMsSUFBVTs7WUFDaEIsSUFBTSxXQUFXLEdBQUcsY0FBYyxDQUFDO1lBQ25DLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFdBQVcsQ0FBQyxFQUFFO2dCQUM3QixNQUFNLElBQUksS0FBSyxDQUFDLG9CQUFrQixXQUFhLENBQUMsQ0FBQzthQUNsRDtZQUNELElBQU0sa0JBQWtCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUNsRCxJQUFJLENBQUMsa0JBQWtCLEVBQUU7Z0JBQ3ZCLE1BQU0sSUFBSSxLQUFLLENBQUMscUNBQXFDLENBQUMsQ0FBQzthQUN4RDtZQUNELElBQU0sT0FBTyxHQUFHLG1CQUFZLENBQUMsa0JBQWtCLENBQUMsUUFBUSxFQUFFLENBQWtCLENBQUM7WUFDN0UsSUFBTSxJQUFJLEdBQUcsb0NBQXVCLENBQUMsT0FBTyxFQUFFLGNBQWMsQ0FBa0IsQ0FBQztZQUMvRSxJQUFNLE9BQU8sR0FBRyxvQ0FBdUIsQ0FBQyxPQUFPLEVBQUUsaUJBQWlCLENBQWtCLENBQUM7WUFFckYsSUFBTSxlQUFlLEdBQUcsb0NBQXVCLENBQUMsSUFBSSxFQUFFLGVBQWUsQ0FBQyxDQUFDO1lBQ3ZFLElBQUksQ0FBQyxlQUFlLEVBQUU7Z0JBQ3BCLE1BQU0sSUFBSSxLQUFLLENB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Q0FBQyxXQUFXLENBQUMsQ0FBQztZQUMvQyxJQUFJLE9BQU8sRUFBRTtnQkFDWCw2Q0FBZ0MsQ0FDNUIsUUFBUSxFQUFFLE9BQU8sRUFBRSxhQUFhLEVBQUUseUNBQXlDLEVBQUUsQ0FBQyxDQUFDLENBQUM7YUFDckY7aUJBQU07Z0JBQ0wsNkNBQWdDLENBQzVCLFFBQVEsRUFBRSxPQUFPLEVBQUUsU0FBUyxFQUFFO29CQUM1QixXQUFXLEVBQUUseUNBQXlDO2lCQUN2RCxFQUNELENBQUMsQ0FBQyxDQUFDO2FBQ1I7WUFDRCxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1lBQzVCLE9BQU8sSUFBSSxDQUFDO1FBQ2QsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQUVELG1CQUF3QixPQUFlO1FBQ3JDLE9BQU8sVUFBQyxJQUFVO1lBQ2hCLGdDQUFtQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUVsQyxPQUFPLGtCQUFLLENBQUM7Z0JBQ1gsdUJBQXVCLENBQUMsT0FBTyxDQUFDO2dCQUNoQywrQkFBK0IsQ0FBQyxPQUFPLENBQUM7Z0JBQ3hDLG1DQUFtQyxFQUFFO2dCQUNyQyxpQkFBaUIsRUFBRTtnQkFDbkIsa0JBQWtCLEVBQUU7Z0JBQ3BCLGtDQUFrQyxDQUFDLE9BQU8sQ0FBQztnQkFDM0MsZUFBZSxFQUFFO2dCQUNqQixrQkFBa0IsRUFBRTtnQkFDcEIsV0FBVyxFQUFFO2FBQ2QsQ0FBQyxDQUFDO1FBQ0wsQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQWhCRCw0QkFnQkMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICpcbiAqIEBmaWxlb3ZlcnZpZXcgU2NoZW1hdGljcyBmb3IgbmctbmV3IHByb2plY3QgdGhhdCBidWlsZHMgd2l0aCBCYXplbC5cbiAqL1xuXG5pbXBvcnQge0pzb25Bc3RPYmplY3QsIHBhcnNlSnNvbkFzdH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHtSdWxlLCBTY2hlbWF0aWNDb250ZXh0LCBTY2hlbWF0aWNzRXhjZXB0aW9uLCBUcmVlLCBhcHBseSwgYXBwbHlUZW1wbGF0ZXMsIGNoYWluLCBtZXJnZVdpdGgsIHVybH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L3NjaGVtYXRpY3MnO1xuaW1wb3J0IHtnZXRXb3Jrc3BhY2VQYXRofSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvY29uZmlnJztcbmltcG9ydCB7ZmluZFByb3BlcnR5SW5Bc3RPYmplY3QsIGluc2VydFByb3BlcnR5SW5Bc3RPYmplY3RJbk9yZGVyfSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvanNvbi11dGlscyc7XG5pbXBvcnQge3ZhbGlkYXRlUHJvamVjdE5hbWV9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS92YWxpZGF0aW9uJztcblxuaW1wb3J0IHtpc0pzb25Bc3RPYmplY3QsIHJlbW92ZUtleVZhbHVlSW5Bc3RPYmplY3QsIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0fSBmcm9tICcuLi91dGlsaXR5L2pzb24tdXRpbHMnO1xuaW1wb3J0IHtmaW5kRTJlQXJjaGl0ZWN0fSBmcm9tICcuLi91dGlsaXR5L3dvcmtzcGFjZS11dGlscyc7XG5cbmltcG9ydCB7U2NoZW1hfSBmcm9tICcuL3NjaGVtYSc7XG5cblxuLyoqXG4gKiBQYWNrYWdlcyB0aGF0IGJ1aWxkIHVuZGVyIEJhemVsIHJlcXVpcmUgYWRkaXRpb25hbCBkZXYgZGVwZW5kZW5jaWVzLiBUaGlzXG4gKiBmdW5jdGlvbiBhZGRzIHRob3NlIGRlcGVuZGVuY2llcyB0byBcImRldkRlcGVuZGVuY2llc1wiIHNlY3Rpb24gaW5cbiAqIHBhY2thZ2UuanNvbi5cbiAqL1xuZnVuY3Rpb24gYWRkRGV2RGVwZW5kZW5jaWVzVG9QYWNrYWdlSnNvbihvcHRpb25zOiBTY2hlbWEpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgY29uc3QgcGFja2FnZUpzb24gPSAncGFja2FnZS5qc29uJztcbiAgICBpZiAoIWhvc3QuZXhpc3RzKHBhY2thZ2VKc29uKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBDb3VsZCBub3QgZmluZCAke3BhY2thZ2VKc29ufWApO1xuICAgIH1cbiAgICBjb25zdCBwYWNrYWdlSnNvbkNvbnRlbnQgPSBob3N0LnJlYWQocGFja2FnZUpzb24pO1xuICAgIGlmICghcGFja2FnZUpzb25Db250ZW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byByZWFkIHBhY2thZ2UuanNvbiBjb250ZW50Jyk7XG4gICAgfVxuICAgIGNvbnN0IGpzb25Bc3QgPSBwYXJzZUpzb25Bc3QocGFja2FnZUpzb25Db250ZW50LnRvU3RyaW5nKCkpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgY29uc3QgZGVwcyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGpzb25Bc3QsICdkZXBlbmRlbmNpZXMnKSBhcyBKc29uQXN0T2JqZWN0O1xuICAgIGNvbnN0IGRldkRlcHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChqc29uQXN0LCAnZGV2RGVwZW5kZW5jaWVzJykgYXMgSnNvbkFzdE9iamVjdDtcblxuICAgIGNvbnN0IGFuZ3VsYXJDb3JlTm9kZSA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGRlcHMsICdAYW5ndWxhci9jb3JlJyk7XG4gICAgaWYgKCFhbmd1bGFyQ29yZU5vZGUpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQGFuZ3VsYXIvY29yZSBkZXBlbmRlbmN5IG5vdCBmb3VuZCBpbiBwYWNrYWdlLmpzb24nKTtcbiAgICB9XG4gICAgY29uc3QgYW5ndWxhckNvcmVWZXJzaW9uID0gYW5ndWxhckNvcmVOb2RlLnZhbHVlIGFzIHN0cmluZztcblxuICAgIGNvbnN0IGRldkRlcGVuZGVuY2llczoge1trOiBzdHJpbmddOiBzdHJpbmd9ID0ge1xuICAgICAgJ0Bhbmd1bGFyL2JhemVsJzogYW5ndWxhckNvcmVWZXJzaW9uLFxuICAgICAgJ0BiYXplbC9iYXplbCc6ICdeMC4yNC4wJyxcbiAgICAgICdAYmF6ZWwvaWJhemVsJzogJ14wLjkuMCcsXG4gICAgICAnQGJhemVsL2thcm1hJzogJ14wLjI3LjEwJyxcbiAgICAgICdAYmF6ZWwvdHlwZXNjcmlwdCc6ICdeMC4yNy4xMCcsXG4gICAgfTtcblxuICAgIGNvbnN0IHJlY29yZGVyID0gaG9zdC5iZWdpblVwZGF0ZShwYWNrYWdlSnNvbik7XG4gICAgZm9yIChjb25zdCBwYWNrYWdlTmFtZSBvZiBPYmplY3Qua2V5cyhkZXZEZXBlbmRlbmNpZXMpKSB7XG4gICAgICBjb25zdCB2ZXJzaW9uID0gZGV2RGVwZW5kZW5jaWVzW3BhY2thZ2VOYW1lXTtcbiAgICAgIGNvbnN0IGluZGVudCA9IDQ7XG4gICAgICBpbnNlcnRQcm9wZXJ0eUluQXN0T2JqZWN0SW5PcmRlcihyZWNvcmRlciwgZGV2RGVwcywgcGFja2FnZU5hbWUsIHZlcnNpb24sIGluZGVudCk7XG4gICAgfVxuICAgIGhvc3QuY29tbWl0VXBkYXRlKHJlY29yZGVyKTtcbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuLyoqXG4gKiBBcHBlbmQgYWRkaXRpb25hbCBKYXZhc2NyaXB0IC8gVHlwZXNjcmlwdCBmaWxlcyBuZWVkZWQgdG8gY29tcGlsZSBhbiBBbmd1bGFyXG4gKiBwcm9qZWN0IHVuZGVyIEJhemVsLlxuICovXG5mdW5jdGlvbiBhZGRGaWxlc1JlcXVpcmVkQnlCYXplbChvcHRpb25zOiBTY2hlbWEpIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlKSA9PiB7XG4gICAgcmV0dXJuIG1lcmdlV2l0aChhcHBseSh1cmwoJy4vZmlsZXMnKSwgW1xuICAgICAgYXBwbHlUZW1wbGF0ZXMoe30pLFxuICAgIF0pKTtcbiAgfTtcbn1cblxuLyoqXG4gKiBBcHBlbmQgJy9iYXplbC1vdXQnIHRvIHRoZSBnaXRpZ25vcmUgZmlsZS5cbiAqL1xuZnVuY3Rpb24gdXBkYXRlR2l0aWdub3JlKCkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUpID0+IHtcbiAgICBjb25zdCBnaXRpZ25vcmUgPSAnLy5naXRpZ25vcmUnO1xuICAgIGlmICghaG9zdC5leGlzdHMoZ2l0aWdub3JlKSkge1xuICAgICAgcmV0dXJuIGhvc3Q7XG4gICAgfVxuICAgIGNvbnN0IGdpdElnbm9yZUNvbnRlbnRSYXcgPSBob3N0LnJlYWQoZ2l0aWdub3JlKTtcbiAgICBpZiAoIWdpdElnbm9yZUNvbnRlbnRSYXcpIHtcbiAgICAgIHJldHVybiBob3N0O1xuICAgIH1cbiAgICBjb25zdCBnaXRJZ25vcmVDb250ZW50ID0gZ2l0SWdub3JlQ29udGVudFJhdy50b1N0cmluZygpO1xuICAgIGlmIChnaXRJZ25vcmVDb250ZW50LmluY2x1ZGVzKCdcXG4vYmF6ZWwtb3V0XFxuJykpIHtcbiAgICAgIHJldHVybiBob3N0O1xuICAgIH1cbiAgICBjb25zdCBjb21waWxlZE91dHB1dCA9ICcjIGNvbXBpbGVkIG91dHB1dFxcbic7XG4gICAgY29uc3QgaW5kZXggPSBnaXRJZ25vcmVDb250ZW50LmluZGV4T2YoY29tcGlsZWRPdXRwdXQpO1xuICAgIGNvbnN0IGluc2VydGlvbkluZGV4ID0gaW5kZXggPj0gMCA/IGluZGV4ICsgY29tcGlsZWRPdXRwdXQubGVuZ3RoIDogZ2l0SWdub3JlQ29udGVudC5sZW5ndGg7XG4gICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKGdpdGlnbm9yZSk7XG4gICAgcmVjb3JkZXIuaW5zZXJ0UmlnaHQoaW5zZXJ0aW9uSW5kZXgsICcvYmF6ZWwtb3V0XFxuJyk7XG4gICAgaG9zdC5jb21taXRVcGRhdGUocmVjb3JkZXIpO1xuICAgIHJldHVybiBob3N0O1xuICB9O1xufVxuXG4vKipcbiAqIENoYW5nZSB0aGUgYXJjaGl0ZWN0IGluIGFuZ3VsYXIuanNvbiB0byB1c2UgQmF6ZWwgYnVpbGRlci5cbiAqL1xuZnVuY3Rpb24gdXBkYXRlQW5ndWxhckpzb25Ub1VzZUJhemVsQnVpbGRlcihvcHRpb25zOiBTY2hlbWEpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgY29uc3Qge25hbWV9ID0gb3B0aW9ucztcbiAgICBjb25zdCB3b3Jrc3BhY2VQYXRoID0gZ2V0V29ya3NwYWNlUGF0aChob3N0KTtcbiAgICBpZiAoIXdvcmtzcGFjZVBhdGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignQ291bGQgbm90IGZpbmQgYW5ndWxhci5qc29uJyk7XG4gICAgfVxuICAgIGNvbnN0IHdvcmtzcGFjZUNvbnRlbnQgPSBob3N0LnJlYWQod29ya3NwYWNlUGF0aCk7XG4gICAgaWYgKCF3b3Jrc3BhY2VDb250ZW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byByZWFkIGFuZ3VsYXIuanNvbiBjb250ZW50Jyk7XG4gICAgfVxuICAgIGNvbnN0IHdvcmtzcGFjZUpzb25Bc3QgPSBwYXJzZUpzb25Bc3Qod29ya3NwYWNlQ29udGVudC50b1N0cmluZygpKSBhcyBKc29uQXN0T2JqZWN0O1xuICAgIGNvbnN0IHByb2plY3RzID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3Qod29ya3NwYWNlSnNvbkFzdCwgJ3Byb2plY3RzJyk7XG4gICAgaWYgKCFwcm9qZWN0cykge1xuICAgICAgdGhyb3cgbmV3IFNjaGVtYXRpY3NFeGNlcHRpb24oJ0V4cGVjdCBwcm9qZWN0cyBpbiBhbmd1bGFyLmpzb24gdG8gYmUgYW4gT2JqZWN0Jyk7XG4gICAgfVxuICAgIGNvbnN0IHByb2plY3QgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChwcm9qZWN0cyBhcyBKc29uQXN0T2JqZWN0LCBuYW1lKTtcbiAgICBpZiAoIXByb2plY3QpIHtcbiAgICAgIHRocm93IG5ldyBTY2hlbWF0aWNzRXhjZXB0aW9uKGBFeHBlY3RlZCBwcm9qZWN0cyB0byBjb250YWluICR7bmFtZX1gKTtcbiAgICB9XG4gICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKHdvcmtzcGFjZVBhdGgpO1xuICAgIGNvbnN0IGluZGVudCA9IDg7XG4gICAgY29uc3QgYXJjaGl0ZWN0ID1cbiAgICAgICAgZmluZFByb3BlcnR5SW5Bc3RPYmplY3QocHJvamVjdCBhcyBKc29uQXN0T2JqZWN0LCAnYXJjaGl0ZWN0JykgYXMgSnNvbkFzdE9iamVjdDtcbiAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChcbiAgICAgICAgcmVjb3JkZXIsIGFyY2hpdGVjdCwgJ2J1aWxkJywge1xuICAgICAgICAgIGJ1aWxkZXI6ICdAYW5ndWxhci9iYXplbDpidWlsZCcsXG4gICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgdGFyZ2V0TGFiZWw6ICcvL3NyYzpwcm9kYXBwJyxcbiAgICAgICAgICAgIGJhemVsQ29tbWFuZDogJ2J1aWxkJyxcbiAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIGluZGVudCk7XG4gICAgcmVwbGFjZVByb3BlcnR5SW5Bc3RPYmplY3QoXG4gICAgICAgIHJlY29yZGVyLCBhcmNoaXRlY3QsICdzZXJ2ZScsIHtcbiAgICAgICAgICBidWlsZGVyOiAnQGFuZ3VsYXIvYmF6ZWw6YnVpbGQnLFxuICAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgICAgICAgIHRhcmdldExhYmVsOiAnLy9zcmM6ZGV2c2VydmVyJyxcbiAgICAgICAgICAgIGJhemVsQ29tbWFuZDogJ3J1bicsXG4gICAgICAgICAgICB3YXRjaDogdHJ1ZSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIGNvbmZpZ3VyYXRpb25zOiB7XG4gICAgICAgICAgICBwcm9kdWN0aW9uOiB7XG4gICAgICAgICAgICAgIHRhcmdldExhYmVsOiAnLy9zcmM6cHJvZHNlcnZlcicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIGluZGVudCk7XG5cbiAgICBpZiAoZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoYXJjaGl0ZWN0LCAndGVzdCcpKSB7XG4gICAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChcbiAgICAgICAgICByZWNvcmRlciwgYXJjaGl0ZWN0LCAndGVzdCcsIHtcbiAgICAgICAgICAgIGJ1aWxkZXI6ICdAYW5ndWxhci9iYXplbDpidWlsZCcsXG4gICAgICAgICAgICBvcHRpb25zOiB7J2JhemVsQ29tbWFuZCc6ICd0ZXN0JywgJ3RhcmdldExhYmVsJzogJy8vc3JjLy4uLid9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgaW5kZW50KTtcbiAgICB9XG5cbiAgICBjb25zdCBlMmVBcmNoaXRlY3QgPSBmaW5kRTJlQXJjaGl0ZWN0KHdvcmtzcGFjZUpzb25Bc3QsIG5hbWUpO1xuICAgIGlmIChlMmVBcmNoaXRlY3QgJiYgZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoZTJlQXJjaGl0ZWN0LCAnZTJlJykpIHtcbiAgICAgIHJlcGxhY2VQcm9wZXJ0eUluQXN0T2JqZWN0KFxuICAgICAgICAgIHJlY29yZGVyLCBlMmVBcmNoaXRlY3QsICdlMmUnLCB7XG4gICAgICAgICAgICBidWlsZGVyOiAnQGFuZ3VsYXIvYmF6ZWw6YnVpbGQnLFxuICAgICAgICAgICAgb3B0aW9uczoge1xuICAgICAgICAgICAgICBiYXplbENvbW1hbmQ6ICd0ZXN0JyxcbiAgICAgICAgICAgICAgdGFyZ2V0TGFiZWw6ICcvL2UyZTpkZXZzZXJ2ZXJfdGVzdCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgY29uZmlndXJhdGlvbnM6IHtcbiAgICAgICAgICAgICAgcHJvZHVjdGlvbjoge1xuICAgICAgICAgICAgICAgIHRhcmdldExhYmVsOiAnLy9lMmU6cHJvZHNlcnZlcl90ZXN0JyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LFxuICAgICAgICAgIGluZGVudCk7XG4gICAgfVxuXG4gICAgaG9zdC5jb21taXRVcGRhdGUocmVjb3JkZXIpO1xuICAgIHJldHVybiBob3N0O1xuICB9O1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIGJhY2t1cCBmb3IgdGhlIG9yaWdpbmFsIGFuZ3VsYXIuanNvbiBmaWxlIGluIGNhc2UgdXNlciB3YW50cyB0b1xuICogZWplY3QgQmF6ZWwgYW5kIHJldmVydCB0byB0aGUgb3JpZ2luYWwgd29ya2Zsb3cuXG4gKi9cbmZ1bmN0aW9uIGJhY2t1cEFuZ3VsYXJKc29uKCk6IFJ1bGUge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBjb25zdCB3b3Jrc3BhY2VQYXRoID0gZ2V0V29ya3NwYWNlUGF0aChob3N0KTtcbiAgICBpZiAoIXdvcmtzcGFjZVBhdGgpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaG9zdC5jcmVhdGUoXG4gICAgICAgIGAke3dvcmtzcGFjZVBhdGh9LmJha2AsICcvLyBUaGlzIGlzIGEgYmFja3VwIGZpbGUgb2YgdGhlIG9yaWdpbmFsIGFuZ3VsYXIuanNvbi4gJyArXG4gICAgICAgICAgICAnVGhpcyBmaWxlIGlzIG5lZWRlZCBpbiBjYXNlIHlvdSB3YW50IHRvIHJldmVydCB0byB0aGUgd29ya2Zsb3cgd2l0aG91dCBCYXplbC5cXG5cXG4nICtcbiAgICAgICAgICAgIGhvc3QucmVhZCh3b3Jrc3BhY2VQYXRoKSk7XG4gIH07XG59XG5cbi8qKlxuICogQ3JlYXRlIGEgYmFja3VwIGZvciB0aGUgb3JpZ2luYWwgdHNjb25maWcuanNvbiBmaWxlIGluIGNhc2UgdXNlciB3YW50cyB0b1xuICogZWplY3QgQmF6ZWwgYW5kIHJldmVydCB0byB0aGUgb3JpZ2luYWwgd29ya2Zsb3cuXG4gKi9cbmZ1bmN0aW9uIGJhY2t1cFRzY29uZmlnSnNvbigpOiBSdWxlIHtcbiAgcmV0dXJuIChob3N0OiBUcmVlLCBjb250ZXh0OiBTY2hlbWF0aWNDb250ZXh0KSA9PiB7XG4gICAgY29uc3QgdHNjb25maWdQYXRoID0gJ3RzY29uZmlnLmpzb24nO1xuICAgIGlmICghaG9zdC5leGlzdHModHNjb25maWdQYXRoKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBob3N0LmNyZWF0ZShcbiAgICAgICAgYCR7dHNjb25maWdQYXRofS5iYWtgLCAnLy8gVGhpcyBpcyBhIGJhY2t1cCBmaWxlIG9mIHRoZSBvcmlnaW5hbCB0c2NvbmZpZy5qc29uLiAnICtcbiAgICAgICAgICAgICdUaGlzIGZpbGUgaXMgbmVlZGVkIGluIGNhc2UgeW91IHdhbnQgdG8gcmV2ZXJ0IHRvIHRoZSB3b3JrZmxvdyB3aXRob3V0IEJhemVsLlxcblxcbicgK1xuICAgICAgICAgICAgaG9zdC5yZWFkKHRzY29uZmlnUGF0aCkpO1xuICB9O1xufVxuXG4vKipcbiAqIEJhemVsIGNvbnRyb2xzIHRoZSBjb21waWxhdGlvbiBvcHRpb25zIG9mIHRzYywgc28gbWFueSBvcHRpb25zIGluXG4gKiB0c2NvbmZpZy5qc29uIGdlbmVyYXRlZCBieSB0aGUgZGVmYXVsdCBDTEkgc2NoZW1hdGljcyBhcmUgbm90IGFwcGxpY2FibGUuXG4gKiBUaGlzIGZ1bmN0aW9uIHVwZGF0ZXMgdGhlIHRzY29uZmlnLmpzb24gdG8gcmVtb3ZlIEJhemVsLWNvbnRyb2xsZWRcbiAqIHBhcmFtZXRlcnMuIFRoaXMgcHJldmVudHMgQmF6ZWwgZnJvbSBwcmludGluZyBvdXQgd2FybmluZ3MgYWJvdXQgb3ZlcnJpZGVuXG4gKiBzZXR0aW5ncy5cbiAqL1xuZnVuY3Rpb24gdXBkYXRlVHNjb25maWdKc29uKCk6IFJ1bGUge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBjb25zdCB0c2NvbmZpZ1BhdGggPSAndHNjb25maWcuanNvbic7XG4gICAgaWYgKCFob3N0LmV4aXN0cyh0c2NvbmZpZ1BhdGgpKSB7XG4gICAgICByZXR1cm4gaG9zdDtcbiAgICB9XG4gICAgY29uc3QgY29udGVudFJhdyA9IGhvc3QucmVhZCh0c2NvbmZpZ1BhdGgpICEudG9TdHJpbmcoKTtcbiAgICBpZiAoIWNvbnRlbnRSYXcpIHtcbiAgICAgIHJldHVybiBob3N0O1xuICAgIH1cbiAgICBjb25zdCBjb250ZW50ID0gY29udGVudFJhdy50b1N0cmluZygpO1xuICAgIGNvbnN0IGFzdCA9IHBhcnNlSnNvbkFzdChjb250ZW50KTtcbiAgICBpZiAoIWlzSnNvbkFzdE9iamVjdChhc3QpKSB7XG4gICAgICByZXR1cm4gaG9zdDtcbiAgICB9XG4gICAgY29uc3QgY29tcGlsZXJPcHRpb25zID0gZmluZFByb3BlcnR5SW5Bc3RPYmplY3QoYXN0LCAnY29tcGlsZXJPcHRpb25zJyk7XG4gICAgaWYgKCFpc0pzb25Bc3RPYmplY3QoY29tcGlsZXJPcHRpb25zKSkge1xuICAgICAgcmV0dXJuIGhvc3Q7XG4gICAgfVxuICAgIGNvbnN0IHJlY29yZGVyID0gaG9zdC5iZWdpblVwZGF0ZSh0c2NvbmZpZ1BhdGgpO1xuICAgIC8vIHRhcmdldCBhbmQgbW9kdWxlIGFyZSBjb250cm9sbGVkIGJ5IGRvd25zdHJlYW0gZGVwZW5kZW5jaWVzLCBzdWNoIGFzXG4gICAgLy8gdHNfZGV2c2VydmVyXG4gICAgcmVtb3ZlS2V5VmFsdWVJbkFzdE9iamVjdChyZWNvcmRlciwgY29udGVudCwgY29tcGlsZXJPcHRpb25zLCAndGFyZ2V0Jyk7XG4gICAgcmVtb3ZlS2V5VmFsdWVJbkFzdE9iamVjdChyZWNvcmRlciwgY29udGVudCwgY29tcGlsZXJPcHRpb25zLCAnbW9kdWxlJyk7XG4gICAgLy8gdHlwZVJvb3RzIGlzIGFsd2F5cyBzZXQgdG8gdGhlIEB0eXBlcyBzdWJkaXJlY3Rvcnkgb2YgdGhlIG5vZGVfbW9kdWxlc1xuICAgIC8vIGF0dHJpYnV0ZVxuICAgIHJlbW92ZUtleVZhbHVlSW5Bc3RPYmplY3QocmVjb3JkZXIsIGNvbnRlbnQsIGNvbXBpbGVyT3B0aW9ucywgJ3R5cGVSb290cycpO1xuICAgIC8vIHJvb3REaXIgYW5kIGJhc2VVcmwgYXJlIGFsd2F5cyB0aGUgd29ya3NwYWNlIHJvb3QgZGlyZWN0b3J5XG4gICAgcmVtb3ZlS2V5VmFsdWVJbkFzdE9iamVjdChyZWNvcmRlciwgY29udGVudCwgY29tcGlsZXJPcHRpb25zLCAncm9vdERpcicpO1xuICAgIHJlbW92ZUtleVZhbHVlSW5Bc3RPYmplY3QocmVjb3JkZXIsIGNvbnRlbnQsIGNvbXBpbGVyT3B0aW9ucywgJ2Jhc2VVcmwnKTtcbiAgICBob3N0LmNvbW1pdFVwZGF0ZShyZWNvcmRlcik7XG4gICAgcmV0dXJuIGhvc3Q7XG4gIH07XG59XG5cbi8qKlxuICogQGFuZ3VsYXIvYmF6ZWwgcmVxdWlyZXMgbWluaW11bSB2ZXJzaW9uIG9mIHJ4anMgdG8gYmUgNi40LjAuIFRoaXMgZnVuY3Rpb25cbiAqIHVwZ3JhZGVzIHRoZSB2ZXJzaW9uIG9mIHJ4anMgaW4gcGFja2FnZS5qc29uIGlmIG5lY2Vzc2FyeS5cbiAqL1xuZnVuY3Rpb24gdXBncmFkZVJ4anMoKSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSwgY29udGV4dDogU2NoZW1hdGljQ29udGV4dCkgPT4ge1xuICAgIGNvbnN0IHBhY2thZ2VKc29uID0gJ3BhY2thZ2UuanNvbic7XG4gICAgaWYgKCFob3N0LmV4aXN0cyhwYWNrYWdlSnNvbikpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgQ291bGQgbm90IGZpbmQgJHtwYWNrYWdlSnNvbn1gKTtcbiAgICB9XG4gICAgY29uc3QgY29udGVudCA9IGhvc3QucmVhZChwYWNrYWdlSnNvbik7XG4gICAgaWYgKCFjb250ZW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0ZhaWxlZCB0byByZWFkIHBhY2thZ2UuanNvbiBjb250ZW50Jyk7XG4gICAgfVxuICAgIGNvbnN0IGpzb25Bc3QgPSBwYXJzZUpzb25Bc3QoY29udGVudC50b1N0cmluZygpKTtcbiAgICBpZiAoIWlzSnNvbkFzdE9iamVjdChqc29uQXN0KSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gcGFyc2UgSlNPTiBmb3IgJHtwYWNrYWdlSnNvbn1gKTtcbiAgICB9XG4gICAgY29uc3QgZGVwcyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGpzb25Bc3QsICdkZXBlbmRlbmNpZXMnKTtcbiAgICBpZiAoIWlzSnNvbkFzdE9iamVjdChkZXBzKSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKGBGYWlsZWQgdG8gZmluZCBkZXBlbmRlbmNpZXMgaW4gJHtwYWNrYWdlSnNvbn1gKTtcbiAgICB9XG4gICAgY29uc3QgcnhqcyA9IGZpbmRQcm9wZXJ0eUluQXN0T2JqZWN0KGRlcHMsICdyeGpzJyk7XG4gICAgaWYgKCFyeGpzKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEZhaWxlZCB0byBmaW5kIHJ4anMgaW4gZGVwZW5kZW5jaWVzIG9mICR7cGFja2FnZUpzb259YCk7XG4gICAgfVxuICAgIGNvbnN0IHZhbHVlID0gcnhqcy52YWx1ZSBhcyBzdHJpbmc7ICAvLyB2YWx1ZSBjYW4gYmUgdmVyc2lvbiBvciByYW5nZVxuICAgIGNvbnN0IG1hdGNoID0gdmFsdWUubWF0Y2goLyhcXGQpK1xcLihcXGQpKy4oXFxkKSskLyk7XG4gICAgaWYgKG1hdGNoKSB7XG4gICAgICBjb25zdCBbXywgbWFqb3IsIG1pbm9yXSA9IG1hdGNoO1xuICAgICAgaWYgKG1ham9yIDwgJzYnIHx8IChtYWpvciA9PT0gJzYnICYmIG1pbm9yIDwgJzQnKSkge1xuICAgICAgICBjb25zdCByZWNvcmRlciA9IGhvc3QuYmVnaW5VcGRhdGUocGFja2FnZUpzb24pO1xuICAgICAgICByZXBsYWNlUHJvcGVydHlJbkFzdE9iamVjdChyZWNvcmRlciwgZGVwcywgJ3J4anMnLCAnfjYuNC4wJyk7XG4gICAgICAgIGhvc3QuY29tbWl0VXBkYXRlKHJlY29yZGVyKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgY29udGV4dC5sb2dnZXIuaW5mbyhcbiAgICAgICAgICAnQ291bGQgbm90IGRldGVybWluZSB2ZXJzaW9uIG9mIHJ4anMuIFxcbicgK1xuICAgICAgICAgICdQbGVhc2UgbWFrZSBzdXJlIHRoYXQgdmVyc2lvbiBpcyBhdCBsZWFzdCA2LjQuMC4nKTtcbiAgICB9XG4gICAgcmV0dXJuIGhvc3Q7XG4gIH07XG59XG5cbi8qKlxuICogV2hlbiB1c2luZyBBbmd1bGFyIE5QTSBwYWNrYWdlcyBhbmQgYnVpbGRpbmcgd2l0aCBBT1QgY29tcGlsYXRpb24sIG5nY1xuICogcmVxdWlyZXMgbmdzdW1hbXJ5IGZpbGVzIGJ1dCB0aGV5IGFyZSBub3Qgc2hpcHBlZC4gVGhpcyBmdW5jdGlvbiBhZGRzIGFcbiAqIHBvc3RpbnN0YWxsIHN0ZXAgdG8gZ2VuZXJhdGUgdGhlc2UgZmlsZXMuXG4gKi9cbmZ1bmN0aW9uIGFkZFBvc3RpbnN0YWxsVG9HZW5lcmF0ZU5nU3VtbWFyaWVzKCkge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBpZiAoIWhvc3QuZXhpc3RzKCdhbmd1bGFyLW1ldGFkYXRhLnRzY29uZmlnLmpzb24nKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBwYWNrYWdlSnNvbiA9ICdwYWNrYWdlLmpzb24nO1xuICAgIGlmICghaG9zdC5leGlzdHMocGFja2FnZUpzb24pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYENvdWxkIG5vdCBmaW5kICR7cGFja2FnZUpzb259YCk7XG4gICAgfVxuICAgIGNvbnN0IGNvbnRlbnQgPSBob3N0LnJlYWQocGFja2FnZUpzb24pO1xuICAgIGlmICghY29udGVudCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdGYWlsZWQgdG8gcmVhZCBwYWNrYWdlLmpzb24gY29udGVudCcpO1xuICAgIH1cbiAgICBjb25zdCBqc29uQXN0ID0gcGFyc2VKc29uQXN0KGNvbnRlbnQudG9TdHJpbmcoKSk7XG4gICAgaWYgKCFpc0pzb25Bc3RPYmplY3QoanNvbkFzdCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIHBhcnNlIEpTT04gZm9yICR7cGFja2FnZUpzb259YCk7XG4gICAgfVxuICAgIGNvbnN0IHNjcmlwdHMgPSBmaW5kUHJvcGVydHlJbkFzdE9iamVjdChqc29uQXN0LCAnc2NyaXB0cycpIGFzIEpzb25Bc3RPYmplY3Q7XG4gICAgY29uc3QgcmVjb3JkZXIgPSBob3N0LmJlZ2luVXBkYXRlKHBhY2thZ2VKc29uKTtcbiAgICBpZiAoc2NyaXB0cykge1xuICAgICAgaW5zZXJ0UHJvcGVydHlJbkFzdE9iamVjdEluT3JkZXIoXG4gICAgICAgICAgcmVjb3JkZXIsIHNjcmlwdHMsICdwb3N0aW5zdGFsbCcsICduZ2MgLXAgLi9hbmd1bGFyLW1ldGFkYXRhLnRzY29uZmlnLmpzb24nLCA0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgaW5zZXJ0UHJvcGVydHlJbkFzdE9iamVjdEluT3JkZXIoXG4gICAgICAgICAgcmVjb3JkZXIsIGpzb25Bc3QsICdzY3JpcHRzJywge1xuICAgICAgICAgICAgcG9zdGluc3RhbGw6ICduZ2MgLXAgLi9hbmd1bGFyLW1ldGFkYXRhLnRzY29uZmlnLmpzb24nLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgMik7XG4gICAgfVxuICAgIGhvc3QuY29tbWl0VXBkYXRlKHJlY29yZGVyKTtcbiAgICByZXR1cm4gaG9zdDtcbiAgfTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24ob3B0aW9uczogU2NoZW1hKTogUnVsZSB7XG4gIHJldHVybiAoaG9zdDogVHJlZSkgPT4ge1xuICAgIHZhbGlkYXRlUHJvamVjdE5hbWUob3B0aW9ucy5uYW1lKTtcblxuICAgIHJldHVybiBjaGFpbihbXG4gICAgICBhZGRGaWxlc1JlcXVpcmVkQnlCYXplbChvcHRpb25zKSxcbiAgICAgIGFkZERldkRlcGVuZGVuY2llc1RvUGFja2FnZUpzb24ob3B0aW9ucyksXG4gICAgICBhZGRQb3N0aW5zdGFsbFRvR2VuZXJhdGVOZ1N1bW1hcmllcygpLFxuICAgICAgYmFja3VwQW5ndWxhckpzb24oKSxcbiAgICAgIGJhY2t1cFRzY29uZmlnSnNvbigpLFxuICAgICAgdXBkYXRlQW5ndWxhckpzb25Ub1VzZUJhemVsQnVpbGRlcihvcHRpb25zKSxcbiAgICAgIHVwZGF0ZUdpdGlnbm9yZSgpLFxuICAgICAgdXBkYXRlVHNjb25maWdKc29uKCksXG4gICAgICB1cGdyYWRlUnhqcygpLFxuICAgIF0pO1xuICB9O1xufVxuIl19
/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 *
 * @fileoverview Schematics for bazel-workspace
 */
(function (factory) {
    if (typeof module === "object" && typeof module.exports === "object") {
        var v = factory(require, exports);
        if (v !== undefined) module.exports = v;
    }
    else if (typeof define === "function" && define.amd) {
        define("angular/packages/bazel/src/schematics/bazel-workspace/index", ["require", "exports", "tslib", "@angular-devkit/core", "@angular-devkit/schematics", "@schematics/angular/utility/config", "@schematics/angular/utility/validation"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var core_1 = require("@angular-devkit/core");
    var schematics_1 = require("@angular-devkit/schematics");
    var config_1 = require("@schematics/angular/utility/config");
    var validation_1 = require("@schematics/angular/utility/validation");
    /**
     * Look for package.json file for @angular/core in node_modules and extract its
     * version.
     */
    function findAngularVersion(options, host) {
        var e_1, _a;
        // Need to look in multiple locations because we could be working in a subtree.
        var candidates = [
            'node_modules/@angular/core/package.json',
            options.name + "/node_modules/@angular/core/package.json",
        ];
        try {
            for (var candidates_1 = tslib_1.__values(candidates), candidates_1_1 = candidates_1.next(); !candidates_1_1.done; candidates_1_1 = candidates_1.next()) {
                var candidate = candidates_1_1.value;
                if (host.exists(candidate)) {
                    try {
                        var packageJson = JSON.parse(host.read(candidate).toString());
                        if (packageJson.name === '@angular/core' && packageJson.version) {
                            return packageJson.version;
                        }
                    }
                    catch (_b) {
                    }
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (candidates_1_1 && !candidates_1_1.done && (_a = candidates_1.return)) _a.call(candidates_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return null;
    }
    function default_1(options) {
        return function (host, context) {
            if (!options.name) {
                throw new schematics_1.SchematicsException("Invalid options, \"name\" is required.");
            }
            validation_1.validateProjectName(options.name);
            var newProjectRoot = '';
            try {
                var workspace = config_1.getWorkspace(host);
                newProjectRoot = workspace.newProjectRoot || '';
            }
            catch (_a) {
            }
            var appDir = newProjectRoot + "/" + options.name;
            // If user already has angular installed, Bazel should use that version
            var existingAngularVersion = findAngularVersion(options, host);
            var workspaceVersions = {
                'ANGULAR_VERSION': existingAngularVersion || '7.1.1',
                'RULES_SASS_VERSION': '1.14.1',
                'RXJS_VERSION': '6.3.3',
            };
            return schematics_1.mergeWith(schematics_1.apply(schematics_1.url('./files'), [
                schematics_1.applyTemplates(tslib_1.__assign({ utils: core_1.strings }, options, { 'dot': '.' }, workspaceVersions)),
                schematics_1.move(appDir),
            ]));
        };
    }
    exports.default = default_1;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi4vLi4vLi4vLi4vLi4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9iYXplbC9zcmMvc2NoZW1hdGljcy9iYXplbC13b3Jrc3BhY2UvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCw2Q0FBNkM7SUFDN0MseURBQTBJO0lBQzFJLDZEQUFnRTtJQUNoRSxxRUFBMkU7SUFJM0U7OztPQUdHO0lBQ0gsU0FBUyxrQkFBa0IsQ0FBQyxPQUE4QixFQUFFLElBQVU7O1FBQ3BFLCtFQUErRTtRQUMvRSxJQUFNLFVBQVUsR0FBRztZQUNqQix5Q0FBeUM7WUFDdEMsT0FBTyxDQUFDLElBQUksNkNBQTBDO1NBQzFELENBQUM7O1lBQ0YsS0FBd0IsSUFBQSxlQUFBLGlCQUFBLFVBQVUsQ0FBQSxzQ0FBQSw4REFBRTtnQkFBL0IsSUFBTSxTQUFTLHVCQUFBO2dCQUNsQixJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEVBQUU7b0JBQzFCLElBQUk7d0JBQ0YsSUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7d0JBQ2hFLElBQUksV0FBVyxDQUFDLElBQUksS0FBSyxlQUFlLElBQUksV0FBVyxDQUFDLE9BQU8sRUFBRTs0QkFDL0QsT0FBTyxXQUFXLENBQUMsT0FBTyxDQUFDO3lCQUM1QjtxQkFDRjtvQkFBQyxXQUFNO3FCQUNQO2lCQUNGO2FBQ0Y7Ozs7Ozs7OztRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUdELG1CQUF3QixPQUE4QjtRQUNwRCxPQUFPLFVBQUMsSUFBVSxFQUFFLE9BQXlCO1lBQzNDLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFO2dCQUNqQixNQUFNLElBQUksZ0NBQW1CLENBQUMsd0NBQXNDLENBQUMsQ0FBQzthQUN2RTtZQUNELGdDQUFtQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUNsQyxJQUFJLGNBQWMsR0FBRyxFQUFFLENBQUM7WUFDeEIsSUFBSTtnQkFDRixJQUFNLFNBQVMsR0FBRyxxQkFBWSxDQUFDLElBQUksQ0FBQyxDQUFDO2dCQUNyQyxjQUFjLEdBQUcsU0FBUyxDQUFDLGNBQWMsSUFBSSxFQUFFLENBQUM7YUFDakQ7WUFBQyxXQUFNO2FBQ1A7WUFDRCxJQUFNLE1BQU0sR0FBTSxjQUFjLFNBQUksT0FBTyxDQUFDLElBQU0sQ0FBQztZQUVuRCx1RUFBdUU7WUFDdkUsSUFBTSxzQkFBc0IsR0FBRyxrQkFBa0IsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFFakUsSUFBTSxpQkFBaUIsR0FBRztnQkFDeEIsaUJBQWlCLEVBQUUsc0JBQXNCLElBQUksT0FBTztnQkFDcEQsb0JBQW9CLEVBQUUsUUFBUTtnQkFDOUIsY0FBYyxFQUFFLE9BQU87YUFDeEIsQ0FBQztZQUVGLE9BQU8sc0JBQVMsQ0FBQyxrQkFBSyxDQUFDLGdCQUFHLENBQUMsU0FBUyxDQUFDLEVBQUU7Z0JBQ3JDLDJCQUFjLG9CQUNaLEtBQUssRUFBRSxjQUFPLElBQ1gsT0FBTyxJQUNWLEtBQUssRUFBRSxHQUFHLElBQUssaUJBQWlCLEVBQ2hDO2dCQUNGLGlCQUFJLENBQUMsTUFBTSxDQUFDO2FBQ2IsQ0FBQyxDQUFDLENBQUM7UUFDTixDQUFDLENBQUM7SUFDSixDQUFDO0lBaENELDRCQWdDQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxuICpcbiAqIFVzZSBvZiB0aGlzIHNvdXJjZSBjb2RlIGlzIGdvdmVybmVkIGJ5IGFuIE1JVC1zdHlsZSBsaWNlbnNlIHRoYXQgY2FuIGJlXG4gKiBmb3VuZCBpbiB0aGUgTElDRU5TRSBmaWxlIGF0IGh0dHBzOi8vYW5ndWxhci5pby9saWNlbnNlXG4gKlxuICogQGZpbGVvdmVydmlldyBTY2hlbWF0aWNzIGZvciBiYXplbC13b3Jrc3BhY2VcbiAqL1xuXG5pbXBvcnQge3N0cmluZ3N9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9jb3JlJztcbmltcG9ydCB7UnVsZSwgU2NoZW1hdGljQ29udGV4dCwgU2NoZW1hdGljc0V4Y2VwdGlvbiwgVHJlZSwgYXBwbHksIGFwcGx5VGVtcGxhdGVzLCBtZXJnZVdpdGgsIG1vdmUsIHVybH0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L3NjaGVtYXRpY3MnO1xuaW1wb3J0IHtnZXRXb3Jrc3BhY2V9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS9jb25maWcnO1xuaW1wb3J0IHt2YWxpZGF0ZVByb2plY3ROYW1lfSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvdmFsaWRhdGlvbic7XG5cbmltcG9ydCB7U2NoZW1hIGFzIEJhemVsV29ya3NwYWNlT3B0aW9uc30gZnJvbSAnLi9zY2hlbWEnO1xuXG4vKipcbiAqIExvb2sgZm9yIHBhY2thZ2UuanNvbiBmaWxlIGZvciBAYW5ndWxhci9jb3JlIGluIG5vZGVfbW9kdWxlcyBhbmQgZXh0cmFjdCBpdHNcbiAqIHZlcnNpb24uXG4gKi9cbmZ1bmN0aW9uIGZpbmRBbmd1bGFyVmVyc2lvbihvcHRpb25zOiBCYXplbFdvcmtzcGFjZU9wdGlvbnMsIGhvc3Q6IFRyZWUpOiBzdHJpbmd8bnVsbCB7XG4gIC8vIE5lZWQgdG8gbG9vayBpbiBtdWx0aXBsZSBsb2NhdGlvbnMgYmVjYXVzZSB3ZSBjb3VsZCBiZSB3b3JraW5nIGluIGEgc3VidHJlZS5cbiAgY29uc3QgY2FuZGlkYXRlcyA9IFtcbiAgICAnbm9kZV9tb2R1bGVzL0Bhbmd1bGFyL2NvcmUvcGFja2FnZS5qc29uJyxcbiAgICBgJHtvcHRpb25zLm5hbWV9L25vZGVfbW9kdWxlcy9AYW5ndWxhci9jb3JlL3BhY2thZ2UuanNvbmAsXG4gIF07XG4gIGZvciAoY29uc3QgY2FuZGlkYXRlIG9mIGNhbmRpZGF0ZXMpIHtcbiAgICBpZiAoaG9zdC5leGlzdHMoY2FuZGlkYXRlKSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgcGFja2FnZUpzb24gPSBKU09OLnBhcnNlKGhvc3QucmVhZChjYW5kaWRhdGUpLnRvU3RyaW5nKCkpO1xuICAgICAgICBpZiAocGFja2FnZUpzb24ubmFtZSA9PT0gJ0Bhbmd1bGFyL2NvcmUnICYmIHBhY2thZ2VKc29uLnZlcnNpb24pIHtcbiAgICAgICAgICByZXR1cm4gcGFja2FnZUpzb24udmVyc2lvbjtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCB7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKG9wdGlvbnM6IEJhemVsV29ya3NwYWNlT3B0aW9ucyk6IFJ1bGUge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBpZiAoIW9wdGlvbnMubmFtZSkge1xuICAgICAgdGhyb3cgbmV3IFNjaGVtYXRpY3NFeGNlcHRpb24oYEludmFsaWQgb3B0aW9ucywgXCJuYW1lXCIgaXMgcmVxdWlyZWQuYCk7XG4gICAgfVxuICAgIHZhbGlkYXRlUHJvamVjdE5hbWUob3B0aW9ucy5uYW1lKTtcbiAgICBsZXQgbmV3UHJvamVjdFJvb3QgPSAnJztcbiAgICB0cnkge1xuICAgICAgY29uc3Qgd29ya3NwYWNlID0gZ2V0V29ya3NwYWNlKGhvc3QpO1xuICAgICAgbmV3UHJvamVjdFJvb3QgPSB3b3Jrc3BhY2UubmV3UHJvamVjdFJvb3QgfHwgJyc7XG4gICAgfSBjYXRjaCB7XG4gICAgfVxuICAgIGNvbnN0IGFwcERpciA9IGAke25ld1Byb2plY3RSb290fS8ke29wdGlvbnMubmFtZX1gO1xuXG4gICAgLy8gSWYgdXNlciBhbHJlYWR5IGhhcyBhbmd1bGFyIGluc3RhbGxlZCwgQmF6ZWwgc2hvdWxkIHVzZSB0aGF0IHZlcnNpb25cbiAgICBjb25zdCBleGlzdGluZ0FuZ3VsYXJWZXJzaW9uID0gZmluZEFuZ3VsYXJWZXJzaW9uKG9wdGlvbnMsIGhvc3QpO1xuXG4gICAgY29uc3Qgd29ya3NwYWNlVmVyc2lvbnMgPSB7XG4gICAgICAnQU5HVUxBUl9WRVJTSU9OJzogZXhpc3RpbmdBbmd1bGFyVmVyc2lvbiB8fCAnNy4xLjEnLFxuICAgICAgJ1JVTEVTX1NBU1NfVkVSU0lPTic6ICcxLjE0LjEnLFxuICAgICAgJ1JYSlNfVkVSU0lPTic6ICc2LjMuMycsXG4gICAgfTtcblxuICAgIHJldHVybiBtZXJnZVdpdGgoYXBwbHkodXJsKCcuL2ZpbGVzJyksIFtcbiAgICAgIGFwcGx5VGVtcGxhdGVzKHtcbiAgICAgICAgdXRpbHM6IHN0cmluZ3MsXG4gICAgICAgIC4uLm9wdGlvbnMsXG4gICAgICAgICdkb3QnOiAnLicsIC4uLndvcmtzcGFjZVZlcnNpb25zLFxuICAgICAgfSksXG4gICAgICBtb3ZlKGFwcERpciksXG4gICAgXSkpO1xuICB9O1xufVxuIl19
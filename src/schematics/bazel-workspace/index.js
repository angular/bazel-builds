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
        define("angular/packages/bazel/src/schematics/bazel-workspace/index", ["require", "exports", "tslib", "@angular-devkit/core", "@angular-devkit/schematics", "@schematics/angular/utility/config", "@schematics/angular/utility/latest-versions", "@schematics/angular/utility/validation"], factory);
    }
})(function (require, exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var tslib_1 = require("tslib");
    var core_1 = require("@angular-devkit/core");
    var schematics_1 = require("@angular-devkit/schematics");
    var config_1 = require("@schematics/angular/utility/config");
    var latest_versions_1 = require("@schematics/angular/utility/latest-versions");
    var validation_1 = require("@schematics/angular/utility/validation");
    /**
     * Look for package.json file for package with `packageName` in node_modules and
     * extract its version.
     */
    function findVersion(projectName, packageName, host) {
        var e_1, _a;
        // Need to look in multiple locations because we could be working in a subtree.
        var candidates = [
            "node_modules/" + packageName + "/package.json",
            projectName + "/node_modules/" + packageName + "/package.json",
        ];
        try {
            for (var candidates_1 = tslib_1.__values(candidates), candidates_1_1 = candidates_1.next(); !candidates_1_1.done; candidates_1_1 = candidates_1.next()) {
                var candidate = candidates_1_1.value;
                if (host.exists(candidate)) {
                    try {
                        var packageJson = JSON.parse(host.read(candidate).toString());
                        if (packageJson.name === packageName && packageJson.version) {
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
    /**
     * Clean the version string and return version in the form "1.2.3". Return
     * null if version string is invalid. This is similar to semver.clean() but
     * takes characters like '^' and '~' into account.
     */
    function clean(version) {
        var matches = version.match(/(\d+\.\d+\.\d+)/);
        return matches && matches.pop() || null;
    }
    exports.clean = clean;
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
            // If the project already has some deps installed, Bazel should use existing
            // versions.
            var existingVersions = {
                Angular: findVersion(options.name, '@angular/core', host),
                RxJs: findVersion(options.name, 'rxjs', host),
            };
            Object.keys(existingVersions).forEach(function (name) {
                var version = existingVersions[name];
                if (version) {
                    context.logger.info("Bazel will reuse existing version for " + name + ": " + version);
                }
            });
            var workspaceVersions = {
                'RULES_NODEJS_VERSION': '0.16.5',
                'RULES_TYPESCRIPT_VERSION': '0.22.0',
                'ANGULAR_VERSION': existingVersions.Angular || clean(latest_versions_1.latestVersions.Angular),
                'RXJS_VERSION': existingVersions.RxJs || clean(latest_versions_1.latestVersions.RxJs),
                // TODO(kyliau): Consider moving this to latest-versions.ts
                'RULES_SASS_VERSION': '1.15.1',
            };
            return schematics_1.mergeWith(schematics_1.apply(schematics_1.url('./files'), [
                schematics_1.applyTemplates(tslib_1.__assign({ utils: core_1.strings }, options, { 'dot': '.' }, workspaceVersions)),
                schematics_1.move(appDir),
            ]));
        };
    }
    exports.default = default_1;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiLi4vLi4vLi4vLi4vLi4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9iYXplbC9zcmMvc2NoZW1hdGljcy9iYXplbC13b3Jrc3BhY2UvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCw2Q0FBNkM7SUFDN0MseURBQTBJO0lBQzFJLDZEQUFnRTtJQUNoRSwrRUFBMkU7SUFDM0UscUVBQTJFO0lBSzNFOzs7T0FHRztJQUNILFNBQVMsV0FBVyxDQUFDLFdBQW1CLEVBQUUsV0FBbUIsRUFBRSxJQUFVOztRQUN2RSwrRUFBK0U7UUFDL0UsSUFBTSxVQUFVLEdBQUc7WUFDakIsa0JBQWdCLFdBQVcsa0JBQWU7WUFDdkMsV0FBVyxzQkFBaUIsV0FBVyxrQkFBZTtTQUMxRCxDQUFDOztZQUNGLEtBQXdCLElBQUEsZUFBQSxpQkFBQSxVQUFVLENBQUEsc0NBQUEsOERBQUU7Z0JBQS9CLElBQU0sU0FBUyx1QkFBQTtnQkFDbEIsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxFQUFFO29CQUMxQixJQUFJO3dCQUNGLElBQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO3dCQUNoRSxJQUFJLFdBQVcsQ0FBQyxJQUFJLEtBQUssV0FBVyxJQUFJLFdBQVcsQ0FBQyxPQUFPLEVBQUU7NEJBQzNELE9BQU8sV0FBVyxDQUFDLE9BQU8sQ0FBQzt5QkFDNUI7cUJBQ0Y7b0JBQUMsV0FBTTtxQkFDUDtpQkFDRjthQUNGOzs7Ozs7Ozs7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7OztPQUlHO0lBQ0gsU0FBZ0IsS0FBSyxDQUFDLE9BQWU7UUFDbkMsSUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQ2pELE9BQU8sT0FBTyxJQUFJLE9BQU8sQ0FBQyxHQUFHLEVBQUUsSUFBSSxJQUFJLENBQUM7SUFDMUMsQ0FBQztJQUhELHNCQUdDO0lBRUQsbUJBQXdCLE9BQThCO1FBQ3BELE9BQU8sVUFBQyxJQUFVLEVBQUUsT0FBeUI7WUFDM0MsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUU7Z0JBQ2pCLE1BQU0sSUFBSSxnQ0FBbUIsQ0FBQyx3Q0FBc0MsQ0FBQyxDQUFDO2FBQ3ZFO1lBQ0QsZ0NBQW1CLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2xDLElBQUksY0FBYyxHQUFHLEVBQUUsQ0FBQztZQUN4QixJQUFJO2dCQUNGLElBQU0sU0FBUyxHQUFHLHFCQUFZLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3JDLGNBQWMsR0FBRyxTQUFTLENBQUMsY0FBYyxJQUFJLEVBQUUsQ0FBQzthQUNqRDtZQUFDLFdBQU07YUFDUDtZQUNELElBQU0sTUFBTSxHQUFNLGNBQWMsU0FBSSxPQUFPLENBQUMsSUFBTSxDQUFDO1lBRW5ELDRFQUE0RTtZQUM1RSxZQUFZO1lBQ1osSUFBTSxnQkFBZ0IsR0FBRztnQkFDdkIsT0FBTyxFQUFFLFdBQVcsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRSxJQUFJLENBQUM7Z0JBQ3pELElBQUksRUFBRSxXQUFXLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDO2FBQzlDLENBQUM7WUFFRixNQUFNLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsT0FBTyxDQUFDLFVBQUMsSUFBd0I7Z0JBQzdELElBQU0sT0FBTyxHQUFHLGdCQUFnQixDQUFDLElBQUksQ0FBVyxDQUFDO2dCQUNqRCxJQUFJLE9BQU8sRUFBRTtvQkFDWCxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQywyQ0FBeUMsSUFBSSxVQUFLLE9BQVMsQ0FBQyxDQUFDO2lCQUNsRjtZQUNILENBQUMsQ0FBQyxDQUFDO1lBRUgsSUFBTSxpQkFBaUIsR0FBRztnQkFDeEIsc0JBQXNCLEVBQUUsUUFBUTtnQkFDaEMsMEJBQTBCLEVBQUUsUUFBUTtnQkFDcEMsaUJBQWlCLEVBQUUsZ0JBQWdCLENBQUMsT0FBTyxJQUFJLEtBQUssQ0FBQyxnQ0FBYyxDQUFDLE9BQU8sQ0FBQztnQkFDNUUsY0FBYyxFQUFFLGdCQUFnQixDQUFDLElBQUksSUFBSSxLQUFLLENBQUMsZ0NBQWMsQ0FBQyxJQUFJLENBQUM7Z0JBQ25FLDJEQUEyRDtnQkFDM0Qsb0JBQW9CLEVBQUUsUUFBUTthQUMvQixDQUFDO1lBRUYsT0FBTyxzQkFBUyxDQUFDLGtCQUFLLENBQUMsZ0JBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRTtnQkFDckMsMkJBQWMsb0JBQ1osS0FBSyxFQUFFLGNBQU8sSUFDWCxPQUFPLElBQ1YsS0FBSyxFQUFFLEdBQUcsSUFBSyxpQkFBaUIsRUFDaEM7Z0JBQ0YsaUJBQUksQ0FBQyxNQUFNLENBQUM7YUFDYixDQUFDLENBQUMsQ0FBQztRQUNOLENBQUMsQ0FBQztJQUNKLENBQUM7SUE5Q0QsNEJBOENDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAbGljZW5zZVxuICogQ29weXJpZ2h0IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqXG4gKiBAZmlsZW92ZXJ2aWV3IFNjaGVtYXRpY3MgZm9yIGJhemVsLXdvcmtzcGFjZVxuICovXG5cbmltcG9ydCB7c3RyaW5nc30gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHtSdWxlLCBTY2hlbWF0aWNDb250ZXh0LCBTY2hlbWF0aWNzRXhjZXB0aW9uLCBUcmVlLCBhcHBseSwgYXBwbHlUZW1wbGF0ZXMsIG1lcmdlV2l0aCwgbW92ZSwgdXJsfSBmcm9tICdAYW5ndWxhci1kZXZraXQvc2NoZW1hdGljcyc7XG5pbXBvcnQge2dldFdvcmtzcGFjZX0gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L2NvbmZpZyc7XG5pbXBvcnQge2xhdGVzdFZlcnNpb25zfSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvbGF0ZXN0LXZlcnNpb25zJztcbmltcG9ydCB7dmFsaWRhdGVQcm9qZWN0TmFtZX0gZnJvbSAnQHNjaGVtYXRpY3MvYW5ndWxhci91dGlsaXR5L3ZhbGlkYXRpb24nO1xuXG5pbXBvcnQge1NjaGVtYSBhcyBCYXplbFdvcmtzcGFjZU9wdGlvbnN9IGZyb20gJy4vc2NoZW1hJztcblxuXG4vKipcbiAqIExvb2sgZm9yIHBhY2thZ2UuanNvbiBmaWxlIGZvciBwYWNrYWdlIHdpdGggYHBhY2thZ2VOYW1lYCBpbiBub2RlX21vZHVsZXMgYW5kXG4gKiBleHRyYWN0IGl0cyB2ZXJzaW9uLlxuICovXG5mdW5jdGlvbiBmaW5kVmVyc2lvbihwcm9qZWN0TmFtZTogc3RyaW5nLCBwYWNrYWdlTmFtZTogc3RyaW5nLCBob3N0OiBUcmVlKTogc3RyaW5nfG51bGwge1xuICAvLyBOZWVkIHRvIGxvb2sgaW4gbXVsdGlwbGUgbG9jYXRpb25zIGJlY2F1c2Ugd2UgY291bGQgYmUgd29ya2luZyBpbiBhIHN1YnRyZWUuXG4gIGNvbnN0IGNhbmRpZGF0ZXMgPSBbXG4gICAgYG5vZGVfbW9kdWxlcy8ke3BhY2thZ2VOYW1lfS9wYWNrYWdlLmpzb25gLFxuICAgIGAke3Byb2plY3ROYW1lfS9ub2RlX21vZHVsZXMvJHtwYWNrYWdlTmFtZX0vcGFja2FnZS5qc29uYCxcbiAgXTtcbiAgZm9yIChjb25zdCBjYW5kaWRhdGUgb2YgY2FuZGlkYXRlcykge1xuICAgIGlmIChob3N0LmV4aXN0cyhjYW5kaWRhdGUpKSB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCBwYWNrYWdlSnNvbiA9IEpTT04ucGFyc2UoaG9zdC5yZWFkKGNhbmRpZGF0ZSkudG9TdHJpbmcoKSk7XG4gICAgICAgIGlmIChwYWNrYWdlSnNvbi5uYW1lID09PSBwYWNrYWdlTmFtZSAmJiBwYWNrYWdlSnNvbi52ZXJzaW9uKSB7XG4gICAgICAgICAgcmV0dXJuIHBhY2thZ2VKc29uLnZlcnNpb247XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2gge1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gbnVsbDtcbn1cblxuLyoqXG4gKiBDbGVhbiB0aGUgdmVyc2lvbiBzdHJpbmcgYW5kIHJldHVybiB2ZXJzaW9uIGluIHRoZSBmb3JtIFwiMS4yLjNcIi4gUmV0dXJuXG4gKiBudWxsIGlmIHZlcnNpb24gc3RyaW5nIGlzIGludmFsaWQuIFRoaXMgaXMgc2ltaWxhciB0byBzZW12ZXIuY2xlYW4oKSBidXRcbiAqIHRha2VzIGNoYXJhY3RlcnMgbGlrZSAnXicgYW5kICd+JyBpbnRvIGFjY291bnQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjbGVhbih2ZXJzaW9uOiBzdHJpbmcpOiBzdHJpbmd8bnVsbCB7XG4gIGNvbnN0IG1hdGNoZXMgPSB2ZXJzaW9uLm1hdGNoKC8oXFxkK1xcLlxcZCtcXC5cXGQrKS8pO1xuICByZXR1cm4gbWF0Y2hlcyAmJiBtYXRjaGVzLnBvcCgpIHx8IG51bGw7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKG9wdGlvbnM6IEJhemVsV29ya3NwYWNlT3B0aW9ucyk6IFJ1bGUge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBpZiAoIW9wdGlvbnMubmFtZSkge1xuICAgICAgdGhyb3cgbmV3IFNjaGVtYXRpY3NFeGNlcHRpb24oYEludmFsaWQgb3B0aW9ucywgXCJuYW1lXCIgaXMgcmVxdWlyZWQuYCk7XG4gICAgfVxuICAgIHZhbGlkYXRlUHJvamVjdE5hbWUob3B0aW9ucy5uYW1lKTtcbiAgICBsZXQgbmV3UHJvamVjdFJvb3QgPSAnJztcbiAgICB0cnkge1xuICAgICAgY29uc3Qgd29ya3NwYWNlID0gZ2V0V29ya3NwYWNlKGhvc3QpO1xuICAgICAgbmV3UHJvamVjdFJvb3QgPSB3b3Jrc3BhY2UubmV3UHJvamVjdFJvb3QgfHwgJyc7XG4gICAgfSBjYXRjaCB7XG4gICAgfVxuICAgIGNvbnN0IGFwcERpciA9IGAke25ld1Byb2plY3RSb290fS8ke29wdGlvbnMubmFtZX1gO1xuXG4gICAgLy8gSWYgdGhlIHByb2plY3QgYWxyZWFkeSBoYXMgc29tZSBkZXBzIGluc3RhbGxlZCwgQmF6ZWwgc2hvdWxkIHVzZSBleGlzdGluZ1xuICAgIC8vIHZlcnNpb25zLlxuICAgIGNvbnN0IGV4aXN0aW5nVmVyc2lvbnMgPSB7XG4gICAgICBBbmd1bGFyOiBmaW5kVmVyc2lvbihvcHRpb25zLm5hbWUsICdAYW5ndWxhci9jb3JlJywgaG9zdCksXG4gICAgICBSeEpzOiBmaW5kVmVyc2lvbihvcHRpb25zLm5hbWUsICdyeGpzJywgaG9zdCksXG4gICAgfTtcblxuICAgIE9iamVjdC5rZXlzKGV4aXN0aW5nVmVyc2lvbnMpLmZvckVhY2goKG5hbWU6ICdBbmd1bGFyJyB8ICdSeEpzJykgPT4ge1xuICAgICAgY29uc3QgdmVyc2lvbiA9IGV4aXN0aW5nVmVyc2lvbnNbbmFtZV0gYXMgc3RyaW5nO1xuICAgICAgaWYgKHZlcnNpb24pIHtcbiAgICAgICAgY29udGV4dC5sb2dnZXIuaW5mbyhgQmF6ZWwgd2lsbCByZXVzZSBleGlzdGluZyB2ZXJzaW9uIGZvciAke25hbWV9OiAke3ZlcnNpb259YCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBjb25zdCB3b3Jrc3BhY2VWZXJzaW9ucyA9IHtcbiAgICAgICdSVUxFU19OT0RFSlNfVkVSU0lPTic6ICcwLjE2LjUnLFxuICAgICAgJ1JVTEVTX1RZUEVTQ1JJUFRfVkVSU0lPTic6ICcwLjIyLjAnLFxuICAgICAgJ0FOR1VMQVJfVkVSU0lPTic6IGV4aXN0aW5nVmVyc2lvbnMuQW5ndWxhciB8fCBjbGVhbihsYXRlc3RWZXJzaW9ucy5Bbmd1bGFyKSxcbiAgICAgICdSWEpTX1ZFUlNJT04nOiBleGlzdGluZ1ZlcnNpb25zLlJ4SnMgfHwgY2xlYW4obGF0ZXN0VmVyc2lvbnMuUnhKcyksXG4gICAgICAvLyBUT0RPKGt5bGlhdSk6IENvbnNpZGVyIG1vdmluZyB0aGlzIHRvIGxhdGVzdC12ZXJzaW9ucy50c1xuICAgICAgJ1JVTEVTX1NBU1NfVkVSU0lPTic6ICcxLjE1LjEnLFxuICAgIH07XG5cbiAgICByZXR1cm4gbWVyZ2VXaXRoKGFwcGx5KHVybCgnLi9maWxlcycpLCBbXG4gICAgICBhcHBseVRlbXBsYXRlcyh7XG4gICAgICAgIHV0aWxzOiBzdHJpbmdzLFxuICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAnZG90JzogJy4nLCAuLi53b3Jrc3BhY2VWZXJzaW9ucyxcbiAgICAgIH0pLFxuICAgICAgbW92ZShhcHBEaXIpLFxuICAgIF0pKTtcbiAgfTtcbn1cbiJdfQ==
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
    /**
     * Returns true if project contains routing module, false otherwise.
     */
    function hasRoutingModule(host) {
        var hasRouting = false;
        host.visit(function (file) { hasRouting = hasRouting || file.endsWith('-routing.module.ts'); });
        return hasRouting;
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
                'RULES_TYPESCRIPT_VERSION': '0.22.1',
                'ANGULAR_VERSION': existingVersions.Angular || clean(latest_versions_1.latestVersions.Angular),
                'RXJS_VERSION': existingVersions.RxJs || clean(latest_versions_1.latestVersions.RxJs),
                // TODO(kyliau): Consider moving this to latest-versions.ts
                'RULES_SASS_VERSION': '1.15.1',
            };
            return schematics_1.mergeWith(schematics_1.apply(schematics_1.url('./files'), [
                schematics_1.applyTemplates(tslib_1.__assign({ utils: core_1.strings }, options, { 'dot': '.' }, workspaceVersions, { routing: hasRoutingModule(host) })),
                schematics_1.move(appDir),
            ]));
        };
    }
    exports.default = default_1;
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi8uLi9wYWNrYWdlcy9iYXplbC9zcmMvc2NoZW1hdGljcy9iYXplbC13b3Jrc3BhY2UvaW5kZXgudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7Ozs7O0dBUUc7Ozs7Ozs7Ozs7Ozs7SUFFSCw2Q0FBNkM7SUFDN0MseURBQTBJO0lBQzFJLDZEQUFnRTtJQUNoRSwrRUFBMkU7SUFDM0UscUVBQTJFO0lBSzNFOzs7T0FHRztJQUNILFNBQVMsV0FBVyxDQUFDLFdBQW1CLEVBQUUsV0FBbUIsRUFBRSxJQUFVOztRQUN2RSwrRUFBK0U7UUFDL0UsSUFBTSxVQUFVLEdBQUc7WUFDakIsa0JBQWdCLFdBQVcsa0JBQWU7WUFDdkMsV0FBVyxzQkFBaUIsV0FBVyxrQkFBZTtTQUMxRCxDQUFDOztZQUNGLEtBQXdCLElBQUEsZUFBQSxpQkFBQSxVQUFVLENBQUEsc0NBQUEsOERBQUU7Z0JBQS9CLElBQU0sU0FBUyx1QkFBQTtnQkFDbEIsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxFQUFFO29CQUMxQixJQUFJO3dCQUNGLElBQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO3dCQUNoRSxJQUFJLFdBQVcsQ0FBQyxJQUFJLEtBQUssV0FBVyxJQUFJLFdBQVcsQ0FBQyxPQUFPLEVBQUU7NEJBQzNELE9BQU8sV0FBVyxDQUFDLE9BQU8sQ0FBQzt5QkFDNUI7cUJBQ0Y7b0JBQUMsV0FBTTtxQkFDUDtpQkFDRjthQUNGOzs7Ozs7Ozs7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7OztPQUlHO0lBQ0gsU0FBZ0IsS0FBSyxDQUFDLE9BQWU7UUFDbkMsSUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQ2pELE9BQU8sT0FBTyxJQUFJLE9BQU8sQ0FBQyxHQUFHLEVBQUUsSUFBSSxJQUFJLENBQUM7SUFDMUMsQ0FBQztJQUhELHNCQUdDO0lBRUQ7O09BRUc7SUFDSCxTQUFTLGdCQUFnQixDQUFDLElBQVU7UUFDbEMsSUFBSSxVQUFVLEdBQUcsS0FBSyxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBQyxJQUFZLElBQU8sVUFBVSxHQUFHLFVBQVUsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNsRyxPQUFPLFVBQVUsQ0FBQztJQUNwQixDQUFDO0lBRUQsbUJBQXdCLE9BQThCO1FBQ3BELE9BQU8sVUFBQyxJQUFVLEVBQUUsT0FBeUI7WUFDM0MsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUU7Z0JBQ2pCLE1BQU0sSUFBSSxnQ0FBbUIsQ0FBQyx3Q0FBc0MsQ0FBQyxDQUFDO2FBQ3ZFO1lBQ0QsZ0NBQW1CLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1lBQ2xDLElBQUksY0FBYyxHQUFHLEVBQUUsQ0FBQztZQUN4QixJQUFJO2dCQUNGLElBQU0sU0FBUyxHQUFHLHFCQUFZLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ3JDLGNBQWMsR0FBRyxTQUFTLENBQUMsY0FBYyxJQUFJLEVBQUUsQ0FBQzthQUNqRDtZQUFDLFdBQU07YUFDUDtZQUNELElBQU0sTUFBTSxHQUFNLGNBQWMsU0FBSSxPQUFPLENBQUMsSUFBTSxDQUFDO1lBRW5ELDRFQUE0RTtZQUM1RSxZQUFZO1lBQ1osSUFBTSxnQkFBZ0IsR0FBRztnQkFDdkIsT0FBTyxFQUFFLFdBQVcsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLGVBQWUsRUFBRSxJQUFJLENBQUM7Z0JBQ3pELElBQUksRUFBRSxXQUFXLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxNQUFNLEVBQUUsSUFBSSxDQUFDO2FBQzlDLENBQUM7WUFFRixNQUFNLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsT0FBTyxDQUFDLFVBQUMsSUFBd0I7Z0JBQzdELElBQU0sT0FBTyxHQUFHLGdCQUFnQixDQUFDLElBQUksQ0FBVyxDQUFDO2dCQUNqRCxJQUFJLE9BQU8sRUFBRTtvQkFDWCxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQywyQ0FBeUMsSUFBSSxVQUFLLE9BQVMsQ0FBQyxDQUFDO2lCQUNsRjtZQUNILENBQUMsQ0FBQyxDQUFDO1lBRUgsSUFBTSxpQkFBaUIsR0FBRztnQkFDeEIsc0JBQXNCLEVBQUUsUUFBUTtnQkFDaEMsMEJBQTBCLEVBQUUsUUFBUTtnQkFDcEMsaUJBQWlCLEVBQUUsZ0JBQWdCLENBQUMsT0FBTyxJQUFJLEtBQUssQ0FBQyxnQ0FBYyxDQUFDLE9BQU8sQ0FBQztnQkFDNUUsY0FBYyxFQUFFLGdCQUFnQixDQUFDLElBQUksSUFBSSxLQUFLLENBQUMsZ0NBQWMsQ0FBQyxJQUFJLENBQUM7Z0JBQ25FLDJEQUEyRDtnQkFDM0Qsb0JBQW9CLEVBQUUsUUFBUTthQUMvQixDQUFDO1lBRUYsT0FBTyxzQkFBUyxDQUFDLGtCQUFLLENBQUMsZ0JBQUcsQ0FBQyxTQUFTLENBQUMsRUFBRTtnQkFDckMsMkJBQWMsb0JBQ1osS0FBSyxFQUFFLGNBQU8sSUFDWCxPQUFPLElBQ1YsS0FBSyxFQUFFLEdBQUcsSUFBSyxpQkFBaUIsSUFDaEMsT0FBTyxFQUFFLGdCQUFnQixDQUFDLElBQUksQ0FBQyxJQUMvQjtnQkFDRixpQkFBSSxDQUFDLE1BQU0sQ0FBQzthQUNiLENBQUMsQ0FBQyxDQUFDO1FBQ04sQ0FBQyxDQUFDO0lBQ0osQ0FBQztJQS9DRCw0QkErQ0MiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICpcbiAqIEBmaWxlb3ZlcnZpZXcgU2NoZW1hdGljcyBmb3IgYmF6ZWwtd29ya3NwYWNlXG4gKi9cblxuaW1wb3J0IHtzdHJpbmdzfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZSc7XG5pbXBvcnQge1J1bGUsIFNjaGVtYXRpY0NvbnRleHQsIFNjaGVtYXRpY3NFeGNlcHRpb24sIFRyZWUsIGFwcGx5LCBhcHBseVRlbXBsYXRlcywgbWVyZ2VXaXRoLCBtb3ZlLCB1cmx9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9zY2hlbWF0aWNzJztcbmltcG9ydCB7Z2V0V29ya3NwYWNlfSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvY29uZmlnJztcbmltcG9ydCB7bGF0ZXN0VmVyc2lvbnN9IGZyb20gJ0BzY2hlbWF0aWNzL2FuZ3VsYXIvdXRpbGl0eS9sYXRlc3QtdmVyc2lvbnMnO1xuaW1wb3J0IHt2YWxpZGF0ZVByb2plY3ROYW1lfSBmcm9tICdAc2NoZW1hdGljcy9hbmd1bGFyL3V0aWxpdHkvdmFsaWRhdGlvbic7XG5cbmltcG9ydCB7U2NoZW1hIGFzIEJhemVsV29ya3NwYWNlT3B0aW9uc30gZnJvbSAnLi9zY2hlbWEnO1xuXG5cbi8qKlxuICogTG9vayBmb3IgcGFja2FnZS5qc29uIGZpbGUgZm9yIHBhY2thZ2Ugd2l0aCBgcGFja2FnZU5hbWVgIGluIG5vZGVfbW9kdWxlcyBhbmRcbiAqIGV4dHJhY3QgaXRzIHZlcnNpb24uXG4gKi9cbmZ1bmN0aW9uIGZpbmRWZXJzaW9uKHByb2plY3ROYW1lOiBzdHJpbmcsIHBhY2thZ2VOYW1lOiBzdHJpbmcsIGhvc3Q6IFRyZWUpOiBzdHJpbmd8bnVsbCB7XG4gIC8vIE5lZWQgdG8gbG9vayBpbiBtdWx0aXBsZSBsb2NhdGlvbnMgYmVjYXVzZSB3ZSBjb3VsZCBiZSB3b3JraW5nIGluIGEgc3VidHJlZS5cbiAgY29uc3QgY2FuZGlkYXRlcyA9IFtcbiAgICBgbm9kZV9tb2R1bGVzLyR7cGFja2FnZU5hbWV9L3BhY2thZ2UuanNvbmAsXG4gICAgYCR7cHJvamVjdE5hbWV9L25vZGVfbW9kdWxlcy8ke3BhY2thZ2VOYW1lfS9wYWNrYWdlLmpzb25gLFxuICBdO1xuICBmb3IgKGNvbnN0IGNhbmRpZGF0ZSBvZiBjYW5kaWRhdGVzKSB7XG4gICAgaWYgKGhvc3QuZXhpc3RzKGNhbmRpZGF0ZSkpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHBhY2thZ2VKc29uID0gSlNPTi5wYXJzZShob3N0LnJlYWQoY2FuZGlkYXRlKS50b1N0cmluZygpKTtcbiAgICAgICAgaWYgKHBhY2thZ2VKc29uLm5hbWUgPT09IHBhY2thZ2VOYW1lICYmIHBhY2thZ2VKc29uLnZlcnNpb24pIHtcbiAgICAgICAgICByZXR1cm4gcGFja2FnZUpzb24udmVyc2lvbjtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCB7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG4vKipcbiAqIENsZWFuIHRoZSB2ZXJzaW9uIHN0cmluZyBhbmQgcmV0dXJuIHZlcnNpb24gaW4gdGhlIGZvcm0gXCIxLjIuM1wiLiBSZXR1cm5cbiAqIG51bGwgaWYgdmVyc2lvbiBzdHJpbmcgaXMgaW52YWxpZC4gVGhpcyBpcyBzaW1pbGFyIHRvIHNlbXZlci5jbGVhbigpIGJ1dFxuICogdGFrZXMgY2hhcmFjdGVycyBsaWtlICdeJyBhbmQgJ34nIGludG8gYWNjb3VudC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNsZWFuKHZlcnNpb246IHN0cmluZyk6IHN0cmluZ3xudWxsIHtcbiAgY29uc3QgbWF0Y2hlcyA9IHZlcnNpb24ubWF0Y2goLyhcXGQrXFwuXFxkK1xcLlxcZCspLyk7XG4gIHJldHVybiBtYXRjaGVzICYmIG1hdGNoZXMucG9wKCkgfHwgbnVsbDtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRydWUgaWYgcHJvamVjdCBjb250YWlucyByb3V0aW5nIG1vZHVsZSwgZmFsc2Ugb3RoZXJ3aXNlLlxuICovXG5mdW5jdGlvbiBoYXNSb3V0aW5nTW9kdWxlKGhvc3Q6IFRyZWUpIHtcbiAgbGV0IGhhc1JvdXRpbmcgPSBmYWxzZTtcbiAgaG9zdC52aXNpdCgoZmlsZTogc3RyaW5nKSA9PiB7IGhhc1JvdXRpbmcgPSBoYXNSb3V0aW5nIHx8IGZpbGUuZW5kc1dpdGgoJy1yb3V0aW5nLm1vZHVsZS50cycpOyB9KTtcbiAgcmV0dXJuIGhhc1JvdXRpbmc7XG59XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uKG9wdGlvbnM6IEJhemVsV29ya3NwYWNlT3B0aW9ucyk6IFJ1bGUge1xuICByZXR1cm4gKGhvc3Q6IFRyZWUsIGNvbnRleHQ6IFNjaGVtYXRpY0NvbnRleHQpID0+IHtcbiAgICBpZiAoIW9wdGlvbnMubmFtZSkge1xuICAgICAgdGhyb3cgbmV3IFNjaGVtYXRpY3NFeGNlcHRpb24oYEludmFsaWQgb3B0aW9ucywgXCJuYW1lXCIgaXMgcmVxdWlyZWQuYCk7XG4gICAgfVxuICAgIHZhbGlkYXRlUHJvamVjdE5hbWUob3B0aW9ucy5uYW1lKTtcbiAgICBsZXQgbmV3UHJvamVjdFJvb3QgPSAnJztcbiAgICB0cnkge1xuICAgICAgY29uc3Qgd29ya3NwYWNlID0gZ2V0V29ya3NwYWNlKGhvc3QpO1xuICAgICAgbmV3UHJvamVjdFJvb3QgPSB3b3Jrc3BhY2UubmV3UHJvamVjdFJvb3QgfHwgJyc7XG4gICAgfSBjYXRjaCB7XG4gICAgfVxuICAgIGNvbnN0IGFwcERpciA9IGAke25ld1Byb2plY3RSb290fS8ke29wdGlvbnMubmFtZX1gO1xuXG4gICAgLy8gSWYgdGhlIHByb2plY3QgYWxyZWFkeSBoYXMgc29tZSBkZXBzIGluc3RhbGxlZCwgQmF6ZWwgc2hvdWxkIHVzZSBleGlzdGluZ1xuICAgIC8vIHZlcnNpb25zLlxuICAgIGNvbnN0IGV4aXN0aW5nVmVyc2lvbnMgPSB7XG4gICAgICBBbmd1bGFyOiBmaW5kVmVyc2lvbihvcHRpb25zLm5hbWUsICdAYW5ndWxhci9jb3JlJywgaG9zdCksXG4gICAgICBSeEpzOiBmaW5kVmVyc2lvbihvcHRpb25zLm5hbWUsICdyeGpzJywgaG9zdCksXG4gICAgfTtcblxuICAgIE9iamVjdC5rZXlzKGV4aXN0aW5nVmVyc2lvbnMpLmZvckVhY2goKG5hbWU6ICdBbmd1bGFyJyB8ICdSeEpzJykgPT4ge1xuICAgICAgY29uc3QgdmVyc2lvbiA9IGV4aXN0aW5nVmVyc2lvbnNbbmFtZV0gYXMgc3RyaW5nO1xuICAgICAgaWYgKHZlcnNpb24pIHtcbiAgICAgICAgY29udGV4dC5sb2dnZXIuaW5mbyhgQmF6ZWwgd2lsbCByZXVzZSBleGlzdGluZyB2ZXJzaW9uIGZvciAke25hbWV9OiAke3ZlcnNpb259YCk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBjb25zdCB3b3Jrc3BhY2VWZXJzaW9ucyA9IHtcbiAgICAgICdSVUxFU19OT0RFSlNfVkVSU0lPTic6ICcwLjE2LjUnLFxuICAgICAgJ1JVTEVTX1RZUEVTQ1JJUFRfVkVSU0lPTic6ICcwLjIyLjEnLFxuICAgICAgJ0FOR1VMQVJfVkVSU0lPTic6IGV4aXN0aW5nVmVyc2lvbnMuQW5ndWxhciB8fCBjbGVhbihsYXRlc3RWZXJzaW9ucy5Bbmd1bGFyKSxcbiAgICAgICdSWEpTX1ZFUlNJT04nOiBleGlzdGluZ1ZlcnNpb25zLlJ4SnMgfHwgY2xlYW4obGF0ZXN0VmVyc2lvbnMuUnhKcyksXG4gICAgICAvLyBUT0RPKGt5bGlhdSk6IENvbnNpZGVyIG1vdmluZyB0aGlzIHRvIGxhdGVzdC12ZXJzaW9ucy50c1xuICAgICAgJ1JVTEVTX1NBU1NfVkVSU0lPTic6ICcxLjE1LjEnLFxuICAgIH07XG5cbiAgICByZXR1cm4gbWVyZ2VXaXRoKGFwcGx5KHVybCgnLi9maWxlcycpLCBbXG4gICAgICBhcHBseVRlbXBsYXRlcyh7XG4gICAgICAgIHV0aWxzOiBzdHJpbmdzLFxuICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICAnZG90JzogJy4nLCAuLi53b3Jrc3BhY2VWZXJzaW9ucyxcbiAgICAgICAgcm91dGluZzogaGFzUm91dGluZ01vZHVsZShob3N0KSxcbiAgICAgIH0pLFxuICAgICAgbW92ZShhcHBEaXIpLFxuICAgIF0pKTtcbiAgfTtcbn1cbiJdfQ==